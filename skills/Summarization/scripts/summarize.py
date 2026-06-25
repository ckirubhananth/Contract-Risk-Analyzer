import os
import json
from google import genai
from google.genai import types

def generate_summary(evaluated_clauses):
    if not evaluated_clauses:
        return "No clauses to summarize.", 0.0
        
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=30_000)
    )
    
    overall_score = sum(c["score"] for c in evaluated_clauses) / len(evaluated_clauses) if evaluated_clauses else 0.0
    
    # Format a compact input for Gemini
    summary_input = []
    for c in evaluated_clauses:
        if c["risk_level"] in ("High", "Medium"):
            summary_input.append({
                "clause_id": c["clause_id"],
                "risk_category": c["risk_category"],
                "risk_level": c["risk_level"],
                "score": c["score"],
                "text_snippet": c["text"][:100] + "...",
                "explanation": c["explanation"]
            })
            
    prompt = (
        "You are an expert contract risk auditor. Write a professional, executive-level summary and "
        "action plan based on the evaluated contract risks. Start with the overall risk level and then "
        "use Markdown headers and bullet points. Summarize the major risks found and outline 2-3 key "
        "recommended negotiation areas (e.g. indemnity caps, termination terms). Keep the tone "
        "highly professional, concise, and legal-focused. Do not repeat clauses verbatim, but reference "
        "their clause IDs (e.g., C01, C12)."
    )
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            prompt,
            f"Overall contract risk score: {overall_score:.2f} / 9.00\n",
            f"Scored Risk Clauses: {json.dumps(summary_input)}"
        ]
    )
    
    # We prefix the response with Overall score if the model doesn't output it
    summary_text = response.text
    if "#" not in summary_text[:10]:
        summary_header = f"# Contract Risk Executive Summary\n**Overall Contract Risk Score:** {overall_score:.2f} / 9.00\n\n"
        summary_text = summary_header + summary_text
        
    return summary_text, overall_score

if __name__ == "__main__":
    pass
