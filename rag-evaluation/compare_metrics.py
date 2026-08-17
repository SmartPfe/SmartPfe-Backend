import json
import os
import re
import sys
import numpy as np
from sentence_transformers import SentenceTransformer

def extract_flat_titles(sections):
    titles = []
    def traverse(nodes):
        for node in nodes:
            t = node.get("title", "").strip()
            if t:
                titles.append(t)
            traverse(node.get("children", []))
    traverse(sections)
    return titles

def extract_titles_from_case(case):
    sections = case.get("generated_sections", [])
    if sections and len(sections) > 0:
        return extract_flat_titles(sections), len(sections)
    raw = case.get("generated_response", "")
    titles = re.findall(r'"title"\s*:\s*"([^"]+)"', raw)
    top_level_matches = re.findall(r'\{\s*"id"\s*:\s*"section-\d+"\s*,\s*"title"\s*:\s*"([^"]+)"', raw)
    top_level_count = len(top_level_matches) if top_level_matches else (8 if len(titles) > 10 else 0)
    return titles, top_level_count

def compute_similarity(model, text1, text2):
    if not text1 or not text2:
        return 0.0
    emb1 = model.encode([text1], convert_to_numpy=True)[0]
    emb2 = model.encode([text2], convert_to_numpy=True)[0]
    denom = (np.linalg.norm(emb1) * np.linalg.norm(emb2))
    if denom == 0:
        return 0.0
    return float(np.dot(emb1, emb2) / denom)

def evaluate_case(case, model):
    retrieved_text = case.get("retrieved_context", "")
    query = case.get("query", "")
    ground_truth = case.get("ground_truth", {})
    expected_domain_topics = ground_truth.get("expected_domain_topics", [])
    irrelevant_topics = ground_truth.get("irrelevant_topics", [])
    
    generated_titles, top_level_count = extract_titles_from_case(case)
    generated_text = " ".join(generated_titles)

    has_retrieval = len(retrieved_text.strip()) > 0

    if has_retrieval:
        semantic_sim = max(0.0, min(1.0, compute_similarity(model, query, retrieved_text[:1500])))
        domain_matches = sum(1 for topic in expected_domain_topics if re.search(r'\b' + re.escape(topic) + r'\b', retrieved_text, re.IGNORECASE))
        domain_overlap_ratio = domain_matches / max(1, len(expected_domain_topics))
        noise_matches = sum(1 for noise in irrelevant_topics if re.search(r'\b' + re.escape(noise) + r'\b', retrieved_text, re.IGNORECASE))
        noise_penalty = min(0.4, noise_matches * 0.15)
        context_relevance = max(0.0, min(1.0, (semantic_sim * 0.6) + (domain_overlap_ratio * 0.4) - noise_penalty))
    else:
        context_relevance = 0.0
        semantic_sim = 0.0

    if has_retrieval:
        covered_chapters = 0
        chapter_keywords = [
            ["intro", "introduction"],
            ["context", "contexte", "existant", "state of the art", "etat de l'art"],
            ["need", "besoin", "requirement", "specification", "analyse"],
            ["conception", "design", "architecture", "uml"],
            ["implementation", "realisation", "developpement", "realization"],
            ["test", "validation", "evaluation"],
            ["conclusion", "perspective"],
        ]
        for kw_group in chapter_keywords:
            if any(re.search(r'\b' + re.escape(kw) + r'\b', retrieved_text, re.IGNORECASE) for kw in kw_group):
                covered_chapters += 1
        context_recall = round(covered_chapters / len(chapter_keywords), 3)
    else:
        context_recall = 0.0

    if generated_titles:
        gen_domain_matches = sum(1 for topic in expected_domain_topics if re.search(r'\b' + re.escape(topic) + r'\b', generated_text, re.IGNORECASE))
        gen_domain_score = min(1.0, gen_domain_matches / max(1, len(expected_domain_topics) * 0.6))
        gen_hallucinations = sum(1 for noise in irrelevant_topics if re.search(r'\b' + re.escape(noise) + r'\b', generated_text, re.IGNORECASE))
        hallucination_penalty = min(0.5, gen_hallucinations * 0.25)
        faithfulness = round(max(0.0, min(1.0, (gen_domain_score * 0.8 + 0.2) - hallucination_penalty)), 3)
    else:
        faithfulness = 0.0

    count_score = 1.0 if (5 <= top_level_count <= 8) else (0.7 if (4 <= top_level_count <= 9) else 0.4)
    has_subsections = len(generated_titles) > top_level_count
    structure_score = round((count_score * 0.7) + (0.3 if has_subsections else 0.0), 3)

    composite_score = round((context_relevance * 0.35) + (context_recall * 0.25) + (faithfulness * 0.25) + (structure_score * 0.15), 3)

    return {
        "id": case["id"],
        "title": case["title"],
        "domain": case["domain"],
        "language": case["language"],
        "context_relevance": round(context_relevance, 3),
        "semantic_similarity": round(semantic_sim, 3),
        "context_recall": round(context_recall, 3),
        "faithfulness": round(faithfulness, 3),
        "composite_score": composite_score,
        "retrieved_preview": retrieved_text[:400] + "..." if len(retrieved_text) > 400 else retrieved_text
    }

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    vector_runs_path = os.path.join(script_dir, "vector_runs_subset.json")
    old_results_path = os.path.join(script_dir, "results.json")

    with open(vector_runs_path, "r", encoding="utf-8") as f:
        vector_runs = json.load(f)

    with open(old_results_path, "r", encoding="utf-8") as f:
        old_data = json.load(f)
        old_results_map = {c["id"]: c["metrics"] for c in old_data.get("results", [])}

    print("Loading SentenceTransformer model...")
    model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    print("\n" + "="*80)
    print("  SIDE-BY-SIDE COMPARISON: FALLBACK (OLD) vs NATIVE VECTOR SEARCH (NEW)")
    print("="*80)

    comparisons = []
    for case in vector_runs:
        new_res = evaluate_case(case, model)
        old_m = old_results_map.get(new_res["id"], {})
        
        comp = {
            "id": new_res["id"],
            "title": new_res["title"],
            "domain": new_res["domain"],
            "language": new_res["language"],
            "old_relevance": old_m.get("context_relevance", 0.0),
            "new_relevance": new_res["context_relevance"],
            "relevance_diff": round(new_res["context_relevance"] - old_m.get("context_relevance", 0.0), 3),
            "old_recall": old_m.get("context_recall", 0.0),
            "new_recall": new_res["context_recall"],
            "old_composite": old_m.get("composite_rag_score", 0.0),
            "new_composite": new_res["composite_score"],
            "composite_diff": round(new_res["composite_score"] - old_m.get("composite_rag_score", 0.0), 3),
            "retrieved_preview": new_res["retrieved_preview"]
        }
        comparisons.append(comp)

    # Print table
    print(f"\n{'Case ID':<10} | {'Domain':<30} | {'Old Rel':<8} | {'New Rel':<8} | {'Rel Diff':<10} | {'Old Comp':<8} | {'New Comp':<8} | {'Comp Diff'}")
    print("-" * 105)
    for c in comparisons:
        diff_str = f"+{c['relevance_diff']:.3f}" if c['relevance_diff'] >= 0 else f"{c['relevance_diff']:.3f}"
        comp_diff_str = f"+{c['composite_diff']:.3f}" if c['composite_diff'] >= 0 else f"{c['composite_diff']:.3f}"
        print(f"{c['id']:<10} | {c['domain'][:30]:<30} | {c['old_relevance']:<8.3f} | {c['new_relevance']:<8.3f} | {diff_str:<10} | {c['old_composite']:<8.3f} | {c['new_composite']:<8.3f} | {comp_diff_str}")

    avg_old_rel = np.mean([c["old_relevance"] for c in comparisons])
    avg_new_rel = np.mean([c["new_relevance"] for c in comparisons])
    avg_old_comp = np.mean([c["old_composite"] for c in comparisons])
    avg_new_comp = np.mean([c["new_composite"] for c in comparisons])

    print("-" * 105)
    print(f"{'AVERAGE':<10} | {'Cases 1-8 Summary':<30} | {avg_old_rel:<8.3f} | {avg_new_rel:<8.3f} | {f'+{(avg_new_rel - avg_old_rel):.3f}':<10} | {avg_old_comp:<8.3f} | {avg_new_comp:<8.3f} | {f'+{(avg_new_comp - avg_old_comp):.3f}'}")

    # Save to json and md
    out_comparison = {
        "summary": {
            "cases_tested": len(comparisons),
            "old_mean_relevance": round(float(avg_old_rel), 3),
            "new_mean_relevance": round(float(avg_new_rel), 3),
            "relevance_improvement_percent": round(float((avg_new_rel - avg_old_rel) / max(0.001, avg_old_rel) * 100), 1),
            "old_mean_composite": round(float(avg_old_comp), 3),
            "new_mean_composite": round(float(avg_new_comp), 3),
            "composite_improvement_percent": round(float((avg_new_comp - avg_old_comp) / max(0.001, avg_old_comp) * 100), 1),
        },
        "comparisons": comparisons
    }

    comp_json_path = os.path.join(script_dir, "vector_comparison_results.json")
    with open(comp_json_path, "w", encoding="utf-8") as f:
        json.dump(out_comparison, f, indent=2, ensure_ascii=False)
    print(f"\nSaved comparison results to {comp_json_path}")

if __name__ == "__main__":
    main()
