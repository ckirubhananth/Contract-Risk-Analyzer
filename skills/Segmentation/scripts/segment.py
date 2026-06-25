import re

def segment_text(text):
    paragraphs = re.split(r'\n\s*\n', text)
    clauses = []
    clause_id_counter = 1
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        # If a paragraph is exceptionally large, split it on clause numbering starts
        if len(para) > 2000:
            # Matches starts like "18. Pets" or "Par. 3. Rent" or "22.  Notices"
            sub_paras = re.split(r'\n\s*(?=\d+\.\s+[A-Z]|\bPar\.\s*\d+)', para)
            if len(sub_paras) > 1:
                for sub in sub_paras:
                    sub = sub.strip()
                    if sub:
                        clauses.append({
                            "clause_id": f"C{clause_id_counter:02d}",
                            "text": sub
                        })
                        clause_id_counter += 1
                continue
                
        clauses.append({
            "clause_id": f"C{clause_id_counter:02d}",
            "text": para
        })
        clause_id_counter += 1
    return clauses


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python segment.py <text>")
        sys.exit(1)
    import json
    print(json.dumps(segment_text(sys.argv[1]), indent=2))
