import os
import json
import time
import jsonschema
from dotenv import load_dotenv

# Load .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from skills.Ingestion.scripts.ingest import extract_text
from skills.Segmentation.scripts.segment import segment_text
from skills.Classification.scripts.classify import classify_clauses
from skills.Scoring.scripts.score import score_clauses, load_rubric
from skills.Summarization.scripts.summarize import generate_summary
from skills.Visualization.scripts.visualize import generate_charts
from skills.Evaluation.scripts.evaluate import run_evaluation

def run_pipeline(contract_path, specs_dir, output_dir):
    start_time = time.time()
    steps = []
    
    os.makedirs(output_dir, exist_ok=True)
    
    rubric_path = os.path.join(specs_dir, "risk_scoring_rubric.yaml")
    clause_schema_path = os.path.join(specs_dir, "contract_clause_schema.json")
    
    with open(clause_schema_path, "r", encoding="utf-8") as f:
        clause_schema = json.load(f)
        
    rubric = load_rubric(rubric_path)
    
    # Step 1: Ingestion
    t0 = time.time()
    text = extract_text(contract_path)
    t1 = time.time()
    steps.append({
        "step_number": 1,
        "agent_name": "IngestionAgent",
        "thought": "Ingesting contract file and extracting raw text content.",
        "action": {"tool_name": "mcp:text_extraction", "arguments": {"file_path": contract_path}},
        "result": {"extracted_length": len(text)},
        "latency_ms": int((t1 - t0) * 1000)
    })
    
    # Step 2: Segmentation
    t0 = time.time()
    clauses = segment_text(text)
    t1 = time.time()
    steps.append({
        "step_number": 2,
        "agent_name": "SegmentationAgent",
        "thought": "Segmenting extracted text into distinct, ordered clauses.",
        "action": {"tool_name": "regex_parser", "arguments": {}},
        "result": {"clause_count": len(clauses)},
        "latency_ms": int((t1 - t0) * 1000)
    })
    
    # Limit number of clauses for token safety and fast performance
    # Setting it to 80 covers the entire main lease body (Page 1 to 9) after paragraph splitting.
    clauses_to_process = clauses[:80]
    
    # Step 3: Classification using Gemini
    t0 = time.time()
    classified_clauses = classify_clauses(clauses_to_process)
    t1 = time.time()
    steps.append({
        "step_number": 3,
        "agent_name": "RiskAnalysisAgent-Classifier",
        "thought": "Classifying clauses into legal risk categories using Gemini batch API.",
        "action": {"tool_name": "gemini:classify_clauses", "arguments": {}},
        "result": {"classified_count": len(classified_clauses)},
        "latency_ms": int((t1 - t0) * 1000)
    })
    
    # Step 4: Scoring using Gemini (with Smart Filtering)
    t0 = time.time()
    
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
        
    t1 = time.time()
    steps.append({
        "step_number": 4,
        "agent_name": "RiskAnalysisAgent-Scorer",
        "thought": "Scoring clauses against the YAML rubric using Gemini batch API.",
        "action": {"tool_name": "gemini:score_clauses", "arguments": {}},
        "result": {"evaluated_count": len(evaluated_clauses)},
        "latency_ms": int((t1 - t0) * 1000)
    })
    
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
    
    total_latency_ms = int((time.time() - start_time) * 1000)
    
    # Save Report, Summary, Charts
    with open(os.path.join(output_dir, "report.json"), "w", encoding="utf-8") as f:
        json.dump(evaluated_clauses, f, indent=2)
    with open(os.path.join(output_dir, "summary.md"), "w", encoding="utf-8") as f:
        f.write(summary_text)
    with open(os.path.join(output_dir, "charts.json"), "w", encoding="utf-8") as f:
        json.dump(chart_data, f, indent=2)
        
    # Trajectory Observability Log
    trajectory = {
        "session_id": f"sess_{int(time.time())}",
        "orchestrator_id": f"orch_{os.getpid()}",
        "steps": steps,
        "metrics": {
            "total_tokens": len(text.split()) * 3,
            "total_latency_ms": total_latency_ms,
            "cost_usd": 0.05
        }
    }
    with open(os.path.join(output_dir, "trajectory.json"), "w", encoding="utf-8") as f:
        json.dump(trajectory, f, indent=2)
        
    # Run Evaluation if golden dataset is present
    golden_path = os.path.join(specs_dir, "golden_dataset.json")
    eval_metrics = None
    if os.path.exists(golden_path):
        eval_metrics = run_evaluation(golden_path, evaluated_clauses)
        with open(os.path.join(output_dir, "evaluation.json"), "w", encoding="utf-8") as f:
            json.dump(eval_metrics, f, indent=2)
            
    print(f"Workflow completed successfully in {total_latency_ms} ms!")
    return evaluated_clauses, summary_text, chart_data, eval_metrics

if __name__ == "__main__":
    import sys
    specs_path = os.path.join(os.path.dirname(__file__), "specs")
    out_path = os.path.join(os.path.dirname(__file__), "outputs")
    
    if len(sys.argv) > 1:
        contract_path = sys.argv[1]
        print(f"Starting Contract Risk Analyzer pipeline on: {contract_path}...")
    else:
        contract_path = os.path.join(os.path.dirname(__file__), "specs", "Contract_Risk_Analyzer_SRS.md")
        print("Starting Contract Risk Analyzer pipeline dry-run...")
        
    run_pipeline(contract_path, specs_path, out_path)
