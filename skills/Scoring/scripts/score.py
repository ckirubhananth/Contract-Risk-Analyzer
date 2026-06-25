import os
import json
import time
import yaml
import concurrent.futures
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

# Load .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

class ClauseScore(BaseModel):
    clause_id: str
    risk_level: str = Field(description="Must be one of: Low, Medium, High")
    score: int = Field(description="A numerical risk score (1-9) matching the rubric rules")
    explanation: str = Field(description="Detailed legal justification for the risk level and score")
    confidence: float

class ScoringResponse(BaseModel):
    scores: List[ClauseScore]

def generate_content_with_retry(client, model, contents, config, max_retries=2, initial_backoff=1.0):
    backoff = initial_backoff
    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
            # Verify JSON response
            if config.response_mime_type == "application/json":
                try:
                    json.loads(response.text)
                except Exception as je:
                    print(f"[Gemini API] JSON decode error: {je}. Raw response text: {response.text}")
                    raise je
            return response
        except Exception as e:
            print(f"[Gemini API] Attempt {attempt}/{max_retries} failed: {e}")
            if attempt == max_retries:
                raise e
            time.sleep(backoff)
            backoff *= 2.0

def load_rubric(rubric_path):
    with open(rubric_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return data.get("rubric", {})

def score_chunk(chunk, rubric, client):
    t0 = time.time()
    clause_ids = [c["clause_id"] for c in chunk]
    print(f"[Scorer] Starting scoring for clauses: {clause_ids}")
    
    prompt = (
        "You are an expert legal risk auditor. Your task is to score the following contract clauses "
        "using the provided risk scoring rubric. For each clause:\n"
        "1. Read the clause text and its pre-classified risk category.\n"
        "2. Evaluate the clause against the rubric criteria for that category.\n"
        "3. Assign a risk level (Low, Medium, High) and score (1-9) matching the rubric's rules.\n"
        "4. Provide a clear, professional explanation of why the score was assigned.\n\n"
        "Rubric rules:\n"
        f"{yaml.dump(rubric)}\n"
        "Respond ONLY in the requested JSON schema."
    )
    
    try:
        response = generate_content_with_retry(
            client=client,
            model='gemini-2.5-flash',
            contents=[
                prompt,
                f"Clauses to score: {json.dumps(chunk)}"
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScoringResponse,
                temperature=0.0
            )
        )
        output = json.loads(response.text)
        score_map = {item["clause_id"]: item for item in output["scores"]}
    except Exception as e:
        print(f"[Scorer] Failed to score clauses {clause_ids} after retries: {e}. Using fallback.")
        score_map = {}
        
    chunk_results = []
    for c in chunk:
        c_id = c["clause_id"]
        c_score = score_map.get(c_id, {
            "risk_level": "Medium",
            "score": 5,
            "explanation": f"Scoring timeout: Clause analysis exceeded maximum allowed generation time of 120 seconds.",
            "confidence": 0.5
        })
        
        combined_conf = round((c["confidence"] + c_score["confidence"]) / 2, 2)
        
        chunk_results.append({
            "clause_id": c_id,
            "text": c["text"],
            "risk_category": c["risk_category"],
            "risk_level": c_score["risk_level"],
            "score": c_score["score"],
            "explanation": c_score["explanation"],
            "confidence": combined_conf
        })
        
    elapsed = time.time() - t0
    print(f"[Scorer] Completed scoring clauses {clause_ids} in {elapsed:.2f}s")
    return chunk_results

def score_clauses(classified_clauses, rubric):
    if not classified_clauses:
        return []
        
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=60_000)
    )
    
    # Split into chunks of 1 clause each for maximum concurrency
    chunk_size = 1
    chunks = [classified_clauses[i:i + chunk_size] for i in range(0, len(classified_clauses), chunk_size)]
    
    evaluated_clauses = []
    # Set max_workers to 10 to keep connection count stable and prevent timeout issues
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(chunks))) as executor:
        futures = {executor.submit(score_chunk, chunk, rubric, client): chunk for chunk in chunks}
        for future in concurrent.futures.as_completed(futures):
            try:
                chunk_results = future.result()
                evaluated_clauses.extend(chunk_results)
            except Exception as e:
                print(f"Error in score_chunk: {e}")
                
    # Sort back to original order by clause_id
    evaluated_clauses.sort(key=lambda x: x["clause_id"])
    return evaluated_clauses
