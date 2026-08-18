# SmartPFE RAG & CRAG Evaluation Suite

Ce dossier contient l'ensemble du banc d'essai, des jeux de données de test et des rapports d'évaluation scientifique de l'architecture **Corrective RAG (CRAG)** de SmartPFE.

---

## 📁 Structure du Dossier

```text
rag-evaluation/
├── README.md                              # Guide général et documentation
├── dataset.js / dataset.json             # 18 cas de test PFE pour la structure globale
├── section_dataset.js                    # 10 cas de test PFE pour la rédaction de sections
├── run_pipeline.js                       # Exécuteur du benchmark de structure
├── run_section_benchmark.js              # Exécuteur du benchmark de section
├── evaluate_ragas.py                     # Évaluateur Python Ragas pour la structure
├── evaluate_section_rag.py               # Évaluateur Python Ragas pour les sections
├── reports/                              # 📄 Rapports d'analyse prêts pour la thèse
│   ├── 01_baseline_evaluation_report.md
│   ├── 03_report_structure_crag_report.md
│   ├── 04_report_builder_section_crag_report.md
│   └── 05_full_crag_architecture_and_defense_summary.md
└── results/                              # 📊 Données brutes et métriques JSON
    ├── baseline_results.json
    ├── vector_comparison_results.json
    ├── crag_comparison_results.json
    └── section_evaluation_results.json
```

---

## 🚀 Commandes pour Reproduire les Évaluations

Depuis le dossier `SmartPfe-Backend` :

### 1. Évaluer la Structure Globale du Rapport (Table des Matières)
```bash
npm run evaluate:rag
```

### 2. Évaluer la Rédaction des Sections du Report Builder
```bash
npm run evaluate:sections
```

---

## 📑 Récapitulatif des Métriques Principales

| Composant Évalué | Pertinence Contexte | Fidélité au Projet | Qualité & Profondeur | Score Global |
| :--- | :---: | :---: | :---: | :---: |
| **Structure du Rapport (CRAG)** | `0.374` | `0.993` | `0.871` | **`0.725` / 1.000** |
| **Report Builder (Section CRAG)** | `0.445` | `1.000` | `0.902` | **`0.799` / 1.000** |

*Consultez [`reports/05_full_crag_architecture_and_defense_summary.md`](./reports/05_full_crag_architecture_and_defense_summary.md) pour la synthèse académique complète.*
