# Rapport d'Évaluation RAGAS : Report Builder CRAG (10 Sections PFE)

## 1. Métriques Clés RAGAS & Performance Globale

| Métrique RAGAS | Score Obtenu | Seuil Recommandé | Interprétation |
| :--- | :---: | :---: | :--- |
| **Faithfulness (Fidélité Faituelle)** | **`0.368`** / 1.000 | > 0.800 | Alignement strict avec le contexte extrait, élimination des hallucinations. |
| **Answer Relevancy (Pertinence de Réponse)** | **`0.746`** / 1.000 | > 0.750 | Réponse directe aux exigences du sujet et de la méthodologie académique. |
| **Context Recall (Complétude Récupération)** | **`0.200`** / 1.000 | > 0.700 | Capture des concepts techniques essentiels dans la base vectorielle. |
| **Context Precision (Précision Récupération)** | **`0.800`** / 1.000 | > 0.650 | Rapport signal/bruit élevé, classement pertinent des chunks documentaires. |
| **Score Composite RAG** | **`0.535`** / 1.000 | > 0.750 | Moyenne pondérée standardisée des 4 métriques RAGAS. |
| **Taux d'Auto-Correction CRAG** | **`50%`** | 30% - 60% | Déclenchement de la passe 2 de réécriture quand le contexte initial était ambigu. |

---

## 2. Résultats Détaillés par Section de Thèse

| Case ID | Titre de la Section | Faithfulness | Answer Relevancy | Context Recall | Context Precision | CRAG Trigger | Score Composite |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `sec-case-01` | 2.1 Architecture Microservices et Découpage des Services | `0.433` | `0.752` | `0.375` | `1.000` | NON (Pass 1) | **`0.631`** |
| `sec-case-02` | 3.2 Conception Détaillée et Diagramme de Classes UML | `0.150` | `0.626` | `0.000` | `1.000` | NON (Pass 1) | **`0.433`** |
| `sec-case-03` | 4.1 Implementation of JWT Authentication and Role-Based Access Control | `0.688` | `0.785` | `0.500` | `1.000` | OUI (Pass 2) | **`0.742`** |
| `sec-case-04` | 1.2 État de l'Art sur les Solutions de Surveillance Réseau et SIEM | `0.498` | `0.771` | `0.000` | `1.000` | NON (Pass 1) | **`0.581`** |
| `sec-case-05` | 3.1 Real-Time IoT Telemetry Ingestion and InfluxDB Time-Series Modeling | `0.200` | `0.823` | `0.000` | `0.000` | OUI (Pass 2) | **`0.307`** |
| `sec-case-06` | 4.3 Pipeline de Traitement NLP et Analyse des Sentiments avec Transformers | `0.150` | `0.685` | `0.000` | `1.000` | NON (Pass 1) | **`0.451`** |
| `sec-case-07` | 2.3 Méthodologie Scrum, Rôles et Organisation des Sprints | `0.650` | `0.662` | `0.250` | `1.000` | OUI (Pass 2) | **`0.644`** |
| `sec-case-08` | 5.1 Automated Testing Strategy: Unit, Integration and End-to-End Tests | `0.150` | `0.780` | `0.000` | `1.000` | OUI (Pass 2) | **`0.479`** |
| `sec-case-09` | 4.2 Architecture des Smart Contracts et Traçabilité sur Hyperledger Fabric | `0.150` | `0.799` | `0.000` | `0.000` | OUI (Pass 2) | **`0.285`** |
| `sec-case-10` | 5.2 Pipeline CI/CD, Conteneurisation Docker et Déploiement Kubernetes | `0.614` | `0.778` | `0.875` | `1.000` | NON (Pass 1) | **`0.793`** |
