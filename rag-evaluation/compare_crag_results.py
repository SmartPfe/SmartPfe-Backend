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
        "crag_trace": case.get("crag_trace", {}),
        "retrieved_preview": retrieved_text[:400] + "..." if len(retrieved_text) > 400 else retrieved_text
    }

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    crag_runs_path = os.path.join(script_dir, "crag_runs_subset.json")
    old_results_path = os.path.join(script_dir, "results.json")
    vector_results_path = os.path.join(script_dir, "vector_comparison_results.json")

    with open(crag_runs_path, "r", encoding="utf-8") as f:
        crag_runs = json.load(f)

    with open(old_results_path, "r", encoding="utf-8") as f:
        old_data = json.load(f)
        old_map = {c["id"]: c["metrics"] for c in old_data.get("results", [])}

    vector_map = {}
    if os.path.exists(vector_results_path):
        with open(vector_results_path, "r", encoding="utf-8") as f:
            v_data = json.load(f)
            vector_map = {c["id"]: c["new_relevance"] for c in v_data.get("comparisons", [])}

    print("Loading SentenceTransformer model...")
    model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    print("\n" + "="*110)
    print("  CRAG (SELF-CORRECTING RAG) BENCHMARK: CASES 1-8 VS NAIVE VECTOR VS FALLBACK")
    print("="*110)

    comparisons = []
    for case in crag_runs:
        new_res = evaluate_case(case, model)
        old_m = old_map.get(new_res["id"], {})
        naive_vec_rel = vector_map.get(new_res["id"], old_m.get("context_relevance", 0.0))
        
        trace = new_res.get("crag_trace", {}) or {}
        pass1_dict = trace.get("pass1") or {}
        pass2_dict = trace.get("pass2") or {}
        p1_score = pass1_dict.get("score", 0.0)
        p1_status = pass1_dict.get("status", "N/A")
        crag_triggered = trace.get("cragTriggered", False)
        p2_score = pass2_dict.get("score", None)

        comp = {
            "id": new_res["id"],
            "title": new_res["title"],
            "domain": new_res["domain"],
            "language": new_res["language"],
            "p1_grader_score": p1_score,
            "p1_status": p1_status,
            "crag_triggered": crag_triggered,
            "p2_grader_score": p2_score,
            "fallback_relevance": old_m.get("context_relevance", 0.0),
            "naive_vector_relevance": naive_vec_rel,
            "crag_relevance": new_res["context_relevance"],
            "crag_gain_over_fallback": round(new_res["context_relevance"] - old_m.get("context_relevance", 0.0), 3),
            "crag_composite": new_res["composite_score"],
            "retrieved_preview": new_res["retrieved_preview"]
        }
        comparisons.append(comp)

    # Print Table
    print(f"\n{'Case ID':<9} | {'Domain':<24} | {'Grader P1':<10} | {'CRAG Triggered?':<18} | {'Fallback':<9} | {'Vector':<8} | {'CRAG (New)':<11} | {'Gain'}")
    print("-" * 115)
    for c in comparisons:
        trigger_str = "YES (Rewritten)" if c['crag_triggered'] else "NO (1st Pass OK)"
        gain_str = f"+{c['crag_gain_over_fallback']:.3f}" if c['crag_gain_over_fallback'] >= 0 else f"{c['crag_gain_over_fallback']:.3f}"
        print(f"{c['id']:<9} | {c['domain'][:24]:<24} | {c['p1_grader_score']:<10.3f} | {trigger_str:<18} | {c['fallback_relevance']:<9.3f} | {c['naive_vector_relevance']:<8.3f} | {c['crag_relevance']:<11.3f} | {gain_str}")

    avg_fallback = np.mean([c["fallback_relevance"] for c in comparisons])
    avg_vector = np.mean([c["naive_vector_relevance"] for c in comparisons])
    avg_crag = np.mean([c["crag_relevance"] for c in comparisons])
    avg_comp = np.mean([c["crag_composite"] for c in comparisons])

    print("-" * 115)
    print(f"{'AVERAGE':<9} | {'Cases 1-8 Average':<24} | {'-':<10} | {'-':<18} | {avg_fallback:<9.3f} | {avg_vector:<8.3f} | {avg_crag:<11.3f} | {f'+{(avg_crag - avg_fallback):.3f}'}")

    # Save to file
    out_comparison = {
        "summary": {
            "cases_tested": len(comparisons),
            "mean_fallback_relevance": round(float(avg_fallback), 3),
            "mean_naive_vector_relevance": round(float(avg_vector), 3),
            "mean_crag_relevance": round(float(avg_crag), 3),
            "mean_crag_composite": round(float(avg_comp), 3),
            "relevance_improvement_over_fallback": round(float(avg_crag - avg_fallback), 3),
            "relevance_improvement_over_vector": round(float(avg_crag - avg_vector), 3),
        },
        "comparisons": comparisons
    }

    comp_json_path = os.path.join(script_dir, "crag_comparison_results.json")
    with open(comp_json_path, "w", encoding="utf-8") as f:
        json.dump(out_comparison, f, indent=2, ensure_ascii=False)
    print(f"\nSaved CRAG comparison results to {comp_json_path}")

if __name__ == "__main__":
    main()
