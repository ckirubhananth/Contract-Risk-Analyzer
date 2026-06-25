def generate_charts(evaluated_clauses):
    dist = {"High": 0, "Medium": 0, "Low": 0}
    freq = {}
    heatmap = []
    
    for c in evaluated_clauses:
        dist[c["risk_level"]] = dist.get(c["risk_level"], 0) + 1
        freq[c["risk_category"]] = freq.get(c["risk_category"], 0) + 1
        heatmap.append({
            "clause_id": c["clause_id"],
            "score": c["score"],
            "risk_category": c["risk_category"]
        })
        
    return {
        "risk_distribution": dist,
        "category_frequency": freq,
        "clause_heatmap": heatmap
    }

if __name__ == "__main__":
    import json
    import sys
    if len(sys.argv) < 2:
        print("Usage: python visualize.py <evaluated_clauses_json>")
        sys.exit(1)
    clauses = json.loads(sys.argv[1])
    print(json.dumps(generate_charts(clauses), indent=2))
