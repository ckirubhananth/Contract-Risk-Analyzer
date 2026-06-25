from dotenv import load_dotenv
load_dotenv()
import os
import sys
import shutil
import json
import time
import jsonschema
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

# Add the parent directory to the python path so we can import main
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from main import run_pipeline
from skills.Ingestion.scripts.ingest import extract_text
from skills.Segmentation.scripts.segment import segment_text
from skills.Classification.scripts.classify import classify_clauses
from skills.Scoring.scripts.score import score_clauses, load_rubric
from skills.Summarization.scripts.summarize import generate_summary
from skills.Visualization.scripts.visualize import generate_charts
from skills.Evaluation.scripts.evaluate import run_evaluation

app = FastAPI(title="Contract Risk Analyzer API")

# Enable CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local development simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load rubric and schema on startup
specs_path = os.path.join(parent_dir, "specs")
rubric_path = os.path.join(specs_path, "risk_scoring_rubric.yaml")
rubric = load_rubric(rubric_path)

clause_schema_path = os.path.join(specs_path, "contract_clause_schema.json")
with open(clause_schema_path, "r", encoding="utf-8") as f:
    clause_schema = json.load(f)

# Request Models
class ClauseItem(BaseModel):
    clause_id: str
    text: str

class AnalyzeBatchRequest(BaseModel):
    clauses: List[ClauseItem]

class SummarizeRequest(BaseModel):
    filename: str
    clauses: List[Dict[str, Any]]
    trajectory_steps: List[Dict[str, Any]]

@app.post("/api/ingest")
async def ingest_contract(file: UploadFile = File(...)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".pdf", ".docx", ".txt", ".md"):
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")
        
    temp_dir = os.path.join(parent_dir, "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, filename)
    
    try:
        with open(temp_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Step 1: Ingestion
        t0 = time.time()
        text = extract_text(temp_file_path)
        t1 = time.time()
        step1 = {
            "step_number": 1,
            "agent_name": "IngestionAgent",
            "thought": "Ingesting contract file and extracting raw text content.",
            "action": {"tool_name": "mcp:text_extraction", "arguments": {"file_path": filename}},
            "result": {"extracted_length": len(text)},
            "latency_ms": int((t1 - t0) * 1000)
        }
        
        # Step 2: Segmentation
        t0 = time.time()
        clauses = segment_text(text)
        t1 = time.time()
        step2 = {
            "step_number": 2,
            "agent_name": "SegmentationAgent",
            "thought": "Segmenting extracted text into distinct, ordered clauses.",
            "action": {"tool_name": "regex_parser", "arguments": {}},
            "result": {"clause_count": len(clauses)},
            "latency_ms": int((t1 - t0) * 1000)
        }
        
        # Clean up temp file
        os.remove(temp_file_path)
        
        # Limit to 80 clauses (same as main.py)
        clauses_to_process = clauses[:80]
        
        return {
            "success": True,
            "filename": filename,
            "text_length": len(text),
            "clauses": [{"clause_id": f"C{i+1:02d}", "text": txt["text"]} for i, txt in enumerate(clauses_to_process)],
            "steps": [step1, step2]
        }
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-batch")
async def analyze_batch(req: AnalyzeBatchRequest):
    try:
        t0 = time.time()
        clauses_to_process = [c.dict() for c in req.clauses]
        
        # Classify using Gemini
        classified_clauses = classify_clauses(clauses_to_process)
        
        # Score using Gemini (with Smart Filtering)
        boilerplate = []
        reviewable = []
        
        for c in classified_clauses:
            if c["risk_category"] == "Other":
                boilerplate.append({
                    "clause_id": c["clause_id"],
                    "text": c["text"],
                    "risk_category": "Other",
                    "risk_level": "Low",
                    "score": 1,
                    "explanation": "Standard clause with no legal risk triggers identified.",
                    "confidence": round(c["confidence"], 2)
                })
            else:
                reviewable.append(c)
                
        if reviewable:
            scored_reviewable = score_clauses(reviewable, rubric)
            evaluated_clauses = boilerplate + scored_reviewable
        else:
            evaluated_clauses = boilerplate
            
        # Sort back to original order
        evaluated_clauses.sort(key=lambda x: x["clause_id"])
        
        # Validate against JSON schema
        for ec in evaluated_clauses:
            jsonschema.validate(instance=ec, schema=clause_schema)
            
        latency_ms = int((time.time() - t0) * 1000)
            
        return {
            "success": True,
            "clauses": evaluated_clauses,
            "latency_ms": latency_ms
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/summarize")
async def summarize_contract(req: SummarizeRequest):
    try:
        evaluated_clauses = req.clauses
        steps = req.trajectory_steps
        
        # Step 5: Summarization using Gemini
        t0 = time.time()
        summary_text, overall_score = generate_summary(evaluated_clauses)
        t1 = time.time()
        steps.append({
            "step_number": 5,
            "agent_name": "SummaryAgent",
            "thought": "Synthesizing executive summary and recommending negotiation actions using Gemini.",
            "action": {"tool_name": "gemini:summarize", "arguments": {}},
            "result": {"overall_score": overall_score},
            "latency_ms": int((t1 - t0) * 1000)
        })
        
        # Step 6: Visualization
        t0 = time.time()
        chart_data = generate_charts(evaluated_clauses)
        t1 = time.time()
        steps.append({
            "step_number": 6,
            "agent_name": "VisualizationAgent",
            "thought": "Creating visual data maps (heatmaps, distributions) for user interface.",
            "action": {"tool_name": "mcp:chart_generator", "arguments": {}},
            "result": {"charts_generated": list(chart_data.keys())},
            "latency_ms": int((t1 - t0) * 1000)
        })
        
        # Calculate total latency
        total_latency_ms = sum(s["latency_ms"] for s in steps)
        
        # Save Report, Summary, Charts
        output_path = os.path.join(parent_dir, "outputs")
        os.makedirs(output_path, exist_ok=True)
        
        with open(os.path.join(output_path, "report.json"), "w", encoding="utf-8") as f:
            json.dump(evaluated_clauses, f, indent=2)
        with open(os.path.join(output_path, "summary.md"), "w", encoding="utf-8") as f:
            f.write(summary_text)
        with open(os.path.join(output_path, "charts.json"), "w", encoding="utf-8") as f:
            json.dump(chart_data, f, indent=2)
            
        # Trajectory Observability Log
        trajectory = {
            "session_id": f"sess_{int(time.time())}",
            "orchestrator_id": f"orch_{os.getpid()}",
            "steps": steps,
            "metrics": {
                "total_tokens": len(evaluated_clauses) * 50 * 3, # rough estimate
                "total_latency_ms": total_latency_ms,
                "cost_usd": 0.05
            }
        }
        with open(os.path.join(output_path, "trajectory.json"), "w", encoding="utf-8") as f:
            json.dump(trajectory, f, indent=2)
            
        # Run Evaluation if golden dataset is present
        golden_path = os.path.join(specs_path, "golden_dataset.json")
        eval_metrics = None
        if os.path.exists(golden_path):
            eval_metrics = run_evaluation(golden_path, evaluated_clauses)
            with open(os.path.join(output_path, "evaluation.json"), "w", encoding="utf-8") as f:
                json.dump(eval_metrics, f, indent=2)
                
        # Calculate overall score
        overall_score = sum(c["score"] for c in evaluated_clauses) / len(evaluated_clauses) if evaluated_clauses else 0.0
        
        return {
            "success": True,
            "filename": req.filename,
            "overall_score": round(overall_score, 2),
            "clauses": evaluated_clauses,
            "summary": summary_text,
            "charts": chart_data,
            "trajectory": trajectory
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Keep the legacy single-request endpoint for backward compatibility / tests
@app.post("/api/analyze")
async def analyze_contract(file: UploadFile = File(...)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".pdf", ".docx", ".txt", ".md"):
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")
        
    temp_dir = os.path.join(parent_dir, "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, filename)
    try:
        with open(temp_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        specs_path = os.path.join(parent_dir, "specs")
        output_path = os.path.join(parent_dir, "outputs")
        
        evaluated_clauses, summary_text, chart_data, eval_metrics = run_pipeline(
            temp_file_path, specs_path, output_path
        )
        
        trajectory_path = os.path.join(output_path, "trajectory.json")
        trajectory_data = {}
        if os.path.exists(trajectory_path):
            with open(trajectory_path, "r", encoding="utf-8") as f:
                trajectory_data = json.load(f)
                 
        os.remove(temp_file_path)
        overall_score = sum(c["score"] for c in evaluated_clauses) / len(evaluated_clauses) if evaluated_clauses else 0.0
        
        return {
            "success": True,
            "filename": filename,
            "overall_score": round(overall_score, 2),
            "clauses": evaluated_clauses,
            "summary": summary_text,
            "charts": chart_data,
            "trajectory": trajectory_data
        }
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
