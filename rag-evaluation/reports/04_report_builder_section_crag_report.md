# Rapport d'Évaluation : Section-Level CRAG pour le Report Builder (10 Cas)

## 1. Résultats par Section

| Case ID | Titre de la Section | Score Grader P1 | Déclenchement CRAG | Pertinence Contexte | Fidélité Génération | Profondeur Technique | **Score Composite** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **sec-case-01** | 2.1 Architecture Microservices & Découpage | `0.805` | ✅ NON (Pass 1 OK) | `0.541` | `1.000` | `1.000` | **`0.862`** |
| **sec-case-02** | 3.2 Conception Détaillée & Diagramme Classes | `0.780` | ✅ NON (Pass 1 OK) | `0.386` | `1.000` | `1.000` | **`0.816`** |
| **sec-case-03** | 4.1 JWT Authentication & RBAC Security | `0.428` | 🔄 **OUI (Réécrit)** | `0.552` | `1.000` | `1.000` | **`0.866`** |
| **sec-case-04** | 1.2 État de l'Art SIEM & Monitoring | `0.678` | ✅ NON (Pass 1 OK) | `0.378` | `1.000` | `1.000` | **`0.814`** |
| **sec-case-05** | 3.1 Real-Time IoT Telemetry & InfluxDB | `0.447` | 🔄 **OUI (Réécrit)** | `0.314` | `1.000` | `0.800` | **`0.724`** |
| **sec-case-06** | 4.3 Pipeline NLP & Transformers Sentiment | `0.660` | ✅ NON (Pass 1 OK) | `0.368` | `1.000` | `1.000` | **`0.810`** |
| **sec-case-07** | 2.3 Méthodologie Scrum & Organisation Sprints | `0.606` | 🔄 **OUI (Réécrit)** | `0.484` | `1.000` | `1.000` | **`0.845`** |
| **sec-case-08** | 5.1 Automated Testing Strategy (Jest/PyTest) | `0.631` | 🔄 **OUI (Réécrit)** | `0.352` | `1.000` | `0.800` | **`0.736`** |
| **sec-case-09** | 4.2 Smart Contracts sur Hyperledger Fabric | `0.617` | 🔄 **OUI (Réécrit)** | `0.339` | `1.000` | `0.620` | **`0.669`** |
| **sec-case-10** | 5.2 Pipeline CI/CD, Docker & Kubernetes | `0.840` | ✅ NON (Pass 1 OK) | `0.737` | `1.000` | `0.800` | **`0.851`** |
| **MOYENNE** | **Moyenne 10 Sections PFE** | — | **50% Réécrits** | **`0.445`** | **`1.000`** | **`0.902`** | **`0.799` / 1.000** |

## 2. Métriques Clés
- **Longueur Moyenne par Section** : **618 mots** (4 à 6 paragraphes structurés avec sous-titres et listes).
- **Fidélité Maximale (`1.000`)** : Aucune hallucination de dépendances ou d'entités non déclarées dans le projet.
- **Auto-Correction Efficace** : Le Grader a détecté et corrigé 5 cas sur 10 où les premiers extraits étaient trop génériques.
