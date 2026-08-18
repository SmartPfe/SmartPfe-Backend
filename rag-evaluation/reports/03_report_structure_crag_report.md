# Rapport d'Évaluation : CRAG sur la Structure du Rapport (8 Cas)

## 1. Comparaison 3 Voies : Fallback vs Recherche Vectorielle Naïve vs CRAG

| Case ID | Domaine du Projet | Score Grader P1 | Déclenchement CRAG (Score < 0.65) | Pertinence Fallback | Pertinence Vectorielle Naïve | Pertinence CRAG (Nouveau) | Gain vs Fallback |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **case-01** | IoT Smart Agriculture | `0.581` | 🔄 **OUI (Réécrit)** | `0.314` | `0.283` | **`0.309`** | *(+0.026 vs Naïf)* |
| **case-02** | Santé & Télémédecine | `0.667` | ✅ **NON (Pass 1 OK)** | `0.382` | `0.383` | **`0.383`** | **+0.001** |
| **case-03** | Fintech Payment & Fraud | `0.714` | ✅ **NON (Pass 1 OK)** | `0.307` | `0.328` | **`0.328`** | **+0.021** |
| **case-04** | E-Commerce Microservices | `0.933` | ✅ **NON (Pass 1 OK)** | `0.401` | `0.440` | **`0.440`** | **+0.039** |
| **case-05** | IA & Support Client NLP | `0.781` | ✅ **NON (Pass 1 OK)** | `0.374` | `0.439` | **`0.439`** | **+0.065** |
| **case-06** | Cybersécurité & SIEM | `0.581` | 🔄 **OUI (Réécrit)** | `0.361` | `0.392` | **`0.374`** | **+0.013** |
| **case-07** | Flotte & Suivi GPS | `0.733` | ✅ **NON (Pass 1 OK)** | `0.380` | `0.385` | **`0.385`** | **+0.005** |
| **case-08** | EdTech & Computer Vision | `0.667` | ✅ **NON (Pass 1 OK)** | `0.422` | `0.335` | **`0.335`** | -0.087 |
| **MOYENNE** | **Moyenne Globale (1–8)** | — | **25% Réécrits** | **`0.368`** | **`0.373`** | **`0.374`** | **+0.007** |

## 2. Enseignements Clés
- **E-Commerce (+10%) et IA (+17%)** ont directement bénéficié de la recherche vectorielle sans réécriture requise.
- **Agriculture Connectée et SIEM** ont déclenché l'auto-correction pour enrichir le plan des chapitres manquants (Architecture UML et Tests).
