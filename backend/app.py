from dotenv import load_dotenv
load_dotenv()
import os
import sys
import shutil
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Add the parent directory to the python path so we can import main
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from main import run_pipeline

app = FastAPI(title="Contract Risk Analyzer API")

# Enable CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local development simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/analyze")
async def analyze_contract(file: UploadFile = File(...)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".pdf", ".docx", ".txt", ".md"):
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")
        
    # Write file to a temp location inside the workspace
    temp_dir = os.path.join(parent_dir, "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    
    temp_file_path = os.path.join(temp_dir, filename)
    try:
        with open(temp_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Run the orchestrator pipeline
        specs_path = os.path.join(parent_dir, "specs")
        output_path = os.path.join(parent_dir, "outputs")
        
        evaluated_clauses, summary_text, chart_data, eval_metrics = run_pipeline(
            temp_file_path, specs_path, output_path
        )
        
        # Read the trajectory.json from outputs
        trajectory_path = os.path.join(output_path, "trajectory.json")
        trajectory_data = {}
        if os.path.exists(trajectory_path):
            with open(trajectory_path, "r", encoding="utf-8") as f:
                trajectory_data = json.load(f)
                
        # Clean up the temp file
        os.remove(temp_file_path)
        
        # Calculate overall score
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
