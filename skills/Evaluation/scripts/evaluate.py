import json

def run_evaluation(golden_path, predicted_clauses):
    with open(golden_path, 'r', encoding='utf-8') as f:
        golden = json.load(f)
        
    correct_category = 0
    correct_level = 0
    total = len(golden)
    
    pred_map = {c["clause_id"]: c for c in predicted_clauses}
    results = []
    
    for g in golden:
        g_text = g["text"].lower()
        best_match = None
        best_overlap = 0.0
        
        for p_id, p_clause in pred_map.items():
            p_text = p_clause["text"].lower()
            g_words = set(g_text.split())
            p_words = set(p_text.split())
            overlap = len(g_words.intersection(p_words)) / max(1, len(g_words))
            if overlap > best_overlap:
                best_overlap = overlap
                best_match = p_clause
                
        if best_match and best_overlap > 0.4:
            cat_match = 1 if best_match["risk_category"] == g["expected"]["risk_category"] else 0
            lvl_match = 1 if best_match["risk_level"] == g["expected"]["risk_level"] else 0
            
            correct_category += cat_match
            correct_level += lvl_match
            
            results.append({
                "clause_id": best_match["clause_id"],
                "golden_id": g["clause_id"],
                "text": g["text"][:60] + "...",
                "expected_category": g["expected"]["risk_category"],
                "predicted_category": best_match["risk_category"],
                "category_match": cat_match,
                "expected_level": g["expected"]["risk_level"],
                "predicted_level": best_match["risk_level"],
                "level_match": lvl_match
            })
            
    cat_accuracy = correct_category / total if total > 0 else 0
    lvl_accuracy = correct_level / total if total > 0 else 0
    
    return {
        "metrics": {
            "total_evaluated": total,
            "category_accuracy": cat_accuracy,
            "risk_level_accuracy": lvl_accuracy
        },
        "results": results
    }

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python evaluate.py <golden_json_path> <predicted_clauses_json>")
        sys.exit(1)
    preds = json.loads(sys.argv[2])
    print(json.dumps(run_evaluation(sys.argv[1], preds), indent=2))
