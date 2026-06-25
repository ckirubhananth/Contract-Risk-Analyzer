import os
import json
import time
import concurrent.futures
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

# Load .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

class ClauseClassification(BaseModel):
    clause_id: str
    risk_category: str = Field(description="Must be one of: Indemnity, Limitation of Liability, Termination, Confidentiality, Payment Terms, Governing Law, Arbitration / Dispute Resolution, Other")
    confidence: float

class ClassificationResponse(BaseModel):
    classifications: List[ClauseClassification]

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

def classify_chunk(chunk, client):
    t0 = time.time()
    clause_ids = [c["clause_id"] for c in chunk]
    print(f"[Classifier] Starting classification for clauses: {clause_ids}")
    
    prompt = (
        "You are an expert legal AI assistant. Classify each of the following contract clauses into "
        "one of these 8 categories:\n"
        "1. Indemnity\n"
        "2. Limitation of Liability\n"
        "3. Termination\n"
        "4. Confidentiality\n"
        "5. Payment Terms\n"
        "6. Governing Law\n"
        "7. Arbitration / Dispute Resolution\n"
        "8. Other\n\n"
        "Rely on your deep legal domain understanding. Respond ONLY in the requested JSON schema."
    )
    
    input_data = [{"clause_id": c["clause_id"], "text": c["text"]} for c in chunk]
    
    try:
        response = generate_content_with_retry(
            client=client,
            model='gemini-2.5-flash',
            contents=[
                prompt,
                f"Clauses to classify: {json.dumps(input_data)}"
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ClassificationResponse,
                temperature=0.0
            )
        )
        output = json.loads(response.text)
        class_map = {item["clause_id"]: item for item in output["classifications"]}
    except Exception as e:
        print(f"[Classifier] Failed to classify clauses {clause_ids} after retries: {e}. Using fallback.")
        class_map = {}
    
    chunk_results = []
    for c in chunk:
        c_id = c["clause_id"]
        c_class = class_map.get(c_id, {"risk_category": "Other", "confidence": 0.5})
        chunk_results.append({
            "clause_id": c_id,
            "text": c["text"],
            "risk_category": c_class["risk_category"],
            "confidence": c_class["confidence"]
        })
    
    elapsed = time.time() - t0
    print(f"[Classifier] Completed clauses {clause_ids} in {elapsed:.2f}s")
    return chunk_results

def classify_clauses(clauses):
    if not clauses:
        return []
        
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=45_000)
    )
    
    # Split into chunks of 1 clause each for maximum concurrency
    chunk_size = 1
    chunks = [clauses[i:i + chunk_size] for i in range(0, len(clauses), chunk_size)]
    
    classified_clauses = []
    # Set max_workers to 15 to avoid overwhelming the API gateway queue
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(15, len(chunks))) as executor:
        futures = {executor.submit(classify_chunk, chunk, client): chunk for chunk in chunks}
        for future in concurrent.futures.as_completed(futures):
            try:
                chunk_results = future.result()
                classified_clauses.extend(chunk_results)
            except Exception as e:
                print(f"Error in classify_chunk: {e}")
                
    # Sort back to original order by clause_id
    classified_clauses.sort(key=lambda x: x["clause_id"])
    return classified_clauses

