import json
import os
import re
import sys
import numpy as np
from sentence_transformers import SentenceTransformer

def compute_similarity(model, text1, text2):
    if not text1 or not text2:
        return 0.0
    emb1 = model.encode([text1], convert_to_numpy=True)[0]
    emb2 = model.encode([text2], convert_to_numpy=True)[0]
    denom = (np.linalg.norm(emb1) * np.linalg.norm(emb2))
    if denom == 0:
        return 0.0
    return float(np.dot(emb1, emb2) / denom)

def evaluate_section_case(case, model):
    retrieved_text = case.get("retrieved_context", "")
    query = case.get("query", "")
    generated_text = case.get("generated_markdown", "")
    ground_truth = case.get("ground_truth", {})
    expected_concepts = ground_truth.get("expected_technical_concepts", [])
    irrelevant_concepts = ground_truth.get("irrelevant_concepts", [])

    has_retrieval = len(retrieved_text.strip()) > 0
    has_generation = len(generated_text.strip()) > 0

    # 1. Context Relevance
    if has_retrieval:
        semantic_sim = max(0.0, min(1.0, compute_similarity(model, query, retrieved_text[:1500])))
        concept_matches = sum(1 for c in expected_concepts if re.search(r'\b' + re.escape(c) + r'\b', retrieved_text, re.IGNORECASE))
        concept_overlap = concept_matches / max(1, len(expected_concepts))
        noise_matches = sum(1 for n in irrelevant_concepts if re.search(r'\b' + re.escape(n) + r'\b', retrieved_text, re.IGNORECASE))
        noise_penalty = min(0.4, noise_matches * 0.15)
        context_relevance = max(0.0, min(1.0, (semantic_sim * 0.6) + (concept_overlap * 0.4) - noise_penalty))
    else:
        context_relevance = 0.0
        semantic_sim = 0.0

    # 2. Generation Faithfulness & Grounding
    if has_generation:
        gen_concept_matches = sum(1 for c in expected_concepts if re.search(r'\b' + re.escape(c) + r'\b', generated_text, re.IGNORECASE))
        gen_concept_ratio = min(1.0, gen_concept_matches / max(1, len(expected_concepts) * 0.5))
        gen_noise = sum(1 for n in irrelevant_concepts if re.search(r'\b' + re.escape(n) + r'\b', generated_text, re.IGNORECASE))
        gen_penalty = min(0.5, gen_noise * 0.25)
        faithfulness = max(0.0, min(1.0, (gen_concept_ratio * 0.8 + 0.2) - gen_penalty))
    else:
        faithfulness = 0.0

    # 3. Technical Depth & Academic Structure (paragraphs, headings, length)
    if has_generation:
        word_count = len(generated_text.split())
        length_score = 1.0 if (250 <= word_count <= 800) else (0.7 if (150 <= word_count <= 1200) else 0.4)
        has_headings = bool(re.search(r'^#{1,4}\s+', generated_text, re.MULTILINE))
        has_lists_or_tables = bool(re.search(r'^\s*[-*]\s+|\bFigure\b|\bTableau\b', generated_text, re.MULTILINE | re.IGNORECASE))
        depth_score = round((length_score * 0.6) + (0.2 if has_headings else 0.0) + (0.2 if has_lists_or_tables else 0.0), 3)
    else:
        depth_score = 0.0

    # 4. Composite Quality Score
    composite_score = round(
        (context_relevance * 0.30) + (faithfulness * 0.35) + (depth_score * 0.35),
        3
    )

    trace = case.get("crag_trace", {}) or {}
    p1 = trace.get("pass1") or {}
    p2 = trace.get("pass2") or {}

    return {
        "id": case["id"],
        "title": case["title"],
        "sectionType": case.get("sectionType", "general"),
        "domain": case.get("domain", ""),
        "language": case.get("language", ""),
        "context_relevance": round(context_relevance, 3),
        "semantic_similarity": round(semantic_sim, 3),
        "faithfulness": round(faithfulness, 3),
        "technical_depth": round(depth_score, 3),
        "composite_score": composite_score,
        "word_count": len(generated_text.split()) if has_generation else 0,
        "retrieval_ms": case.get("retrieval_time_ms", 0),
        "generation_ms": case.get("generation_time_ms", 0),
        "grader_p1_score": p1.get("score", 0.0),
        "crag_triggered": trace.get("cragTriggered", False),
        "grader_p2_score": p2.get("score", None),
        "adopted_pass": trace.get("adoptedPass", 1),
    }

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    raw_runs_path = os.path.join(script_dir, "results", "section_raw_runs.json")

    if not os.path.exists(raw_runs_path):
        raw_runs_path = os.path.join(script_dir, "section_raw_runs.json")

    if not os.path.exists(raw_runs_path):
        print(f"Error: {raw_runs_path} does not exist.")
        sys.exit(1)

    with open(raw_runs_path, "r", encoding="utf-8") as f:
        raw_runs = json.load(f)

    print("Loading SentenceTransformer evaluation model...")
    model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    print("\n" + "="*120)
    print("  REPORT BUILDER: SECTION-LEVEL CRAG EVALUATION RESULTS (10 CASES)")
    print("="*120)

    results = []
    for case in raw_runs:
        metrics = evaluate_section_case(case, model)
        results.append(metrics)

    # Print Formatted Table
    print(f"\n{'ID':<12} | {'Section Title':<34} | {'Grader':<8} | {'CRAG Trigger?':<16} | {'Relevance':<10} | {'Faithful':<9} | {'Depth':<7} | {'Score'}")
    print("-" * 120)
    for r in results:
        trigger_str = "YES (Rewritten)" if r['crag_triggered'] else "NO (1st Pass OK)"
        print(f"{r['id']:<12} | {r['title'][:34]:<34} | {r['grader_p1_score']:<8.3f} | {trigger_str:<16} | {r['context_relevance']:<10.3f} | {r['faithfulness']:<9.3f} | {r['technical_depth']:<7.3f} | {r['composite_score']:<5.3f}")

    avg_rel = np.mean([r["context_relevance"] for r in results])
    avg_faith = np.mean([r["faithfulness"] for r in results])
    avg_depth = np.mean([r["technical_depth"] for r in results])
    avg_comp = np.mean([r["composite_score"] for r in results])
    avg_words = np.mean([r["word_count"] for r in results])

    print("-" * 120)
    print(f"{'AVERAGE':<12} | {'10 Sections Summary':<34} | {'-':<8} | {'-':<16} | {avg_rel:<10.3f} | {avg_faith:<9.3f} | {avg_depth:<7.3f} | {avg_comp:<5.3f}")
    print(f"\nMean Word Count per Section: {avg_words:.0f} words")

    out_data = {
        "summary": {
            "cases_evaluated": len(results),
            "mean_context_relevance": round(float(avg_rel), 3),
            "mean_faithfulness": round(float(avg_faith), 3),
            "mean_technical_depth": round(float(avg_depth), 3),
            "mean_composite_score": round(float(avg_comp), 3),
            "mean_word_count": round(float(avg_words), 0),
        },
        "results": results
    }

    out_json = os.path.join(script_dir, "results", "section_evaluation_results.json")
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2, ensure_ascii=False)
    print(f"Saved evaluation results to {out_json}")

    # Generate Markdown Report
    md_lines = [
        "# Rapport d'Évaluation : Section-Level CRAG pour le Report Builder (10 Cas)\n",
        f"- **Cas Évalués** : {len(results)}",
        f"- **Pertinence Moyenne du Contexte** : `{avg_rel:.3f}` / 1.000",
        f"- **Fidélité de Génération** : `{avg_faith:.3f}` / 1.000",
        f"- **Profondeur & Structure Technique** : `{avg_depth:.3f}` / 1.000",
        f"- **Score Global Composite** : **`{avg_comp:.3f}` / 1.000**\n",
        "## Résultats Détaillés\n",
        "| Case ID | Titre de la Section | Score Grader P1 | Déclenchement CRAG | Pertinence Contexte | Fidélité Génération | Profondeur Technique | **Score Composite** |",
        "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]
    for r in results:
        t_str = "OUI (Réécrit)" if r['crag_triggered'] else "NON (Pass 1 OK)"
        md_lines.append(f"| `{r['id']}` | {r['title']} | `{r['grader_p1_score']:.3f}` | {t_str} | `{r['context_relevance']:.3f}` | `{r['faithfulness']:.3f}` | `{r['technical_depth']:.3f}` | **`{r['composite_score']:.3f}`** |")

    report_path = os.path.join(script_dir, "reports", "04_report_builder_section_crag_report.md")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines) + "\n")
    print(f"Saved benchmark markdown report to {report_path}")

if __name__ == "__main__":
    main()
