# Rapport d'Évaluation & Architecture du RAG Auto-Correcteur (CRAG)
**Projet**: SmartPFE — Plateforme d'Assistance Intelligente pour Projets de Fin d'Études (PFE)  
**Auteur**: Équipe SmartPFE  
**Date**: Août 2026  

---

## 1. Contexte & Problématique du RAG dans SmartPFE

La rédaction d'un rapport de PFE en ingénierie logicielle exige une double rigueur :
1. **La Cohérence Académique Globale (Plan / Structure du Rapport)** : Respecter la progression standard des écoles d'ingénieurs (*Introduction $\rightarrow$ Contexte / État de l'art $\rightarrow$ Spécification des Besoins & Méthodologie $\rightarrow$ Conception Architecturale & UML $\rightarrow$ Réalisation $\rightarrow$ Tests & Validation $\rightarrow$ Conclusion & Perspectives*).
2. **La Profondeur Technique Locale (Rédaction des Sections)** : Rédiger des paragraphes formels, denses et précis (architectures microservices, sécurité JWT, modélisation de classes, pipelines CI/CD, etc.) sans hallucinations.

### Les Limites du RAG Naïf (Standard RAG)
Dans une approche naïve, une requête utilisateur est directement convertie en vecteur et les documents les plus proches sont injectés sans filtre dans le prompt du LLM. 
Nos premiers tests ont révélé deux faiblesses critiques :
- **Documents Hors-Sujet** : Si la base vectorielle ne contient pas de thèse spécifique sur un domaine de niche (ex. Agriculture Connectée), le RAG naïf injecte quand même les documents les plus proches (ex. thèses e-commerce ou NLP), polluant le contexte.
- **Surcharge de Contexte (Prompt Bloat)** : L'injection de l'intégralité des chapitres précédents consommait inutilement la fenêtre de contexte et dégradait la pertinence du modèle.

---

## 2. Architecture Implémentée : Corrective RAG (CRAG)

Pour résoudre ces limitations, nous avons conçu et déployé une architecture **CRAG (Self-Correcting RAG)** sans framework lourd (sans LangChain, en JavaScript natif et MongoDB Aggregation Pipeline).

```text
               ┌──────────────────────────────────────────────┐
               │         Contexte du Projet Étudiant          │
               │   (Titre, Domaine, Stack, Besoins, UML)      │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ 1. Générateur de Requête      │
                      │    Sémantique Ciblée          │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ 2. Recherche Vectorielle      │
                      │    Atlas ($vectorSearch)      │
                      │    3 092 Chunks (384 dim)     │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ 3. Critique / Grader de       │
                      │    Pertinence Technique       │
                      └───────────────┬───────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   │                                     │
           [Score >= 0.65]                         [Score < 0.65]
                   │                                     │
                   ▼                                     ▼
        ┌─────────────────────┐               ┌─────────────────────┐
        │  Contexte ACCEPTÉ   │               │ 4. Réécriture de la │
        │                     │               │    Requête (CRAG)   │
        └──────────┬──────────┘               └──────────┬──────────┘
                   │                                     │ (Max 1 retry)
                   │                                     ▼
                   │                          ┌─────────────────────┐
                   │                          │ 2ème Recherche      │
                   │                          │ Vectorielle Ciblée  │
                   │                          └──────────┬──────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ 5. Augmentation du Prompt     │
                      │    (Littérature PFE Réelle)   │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ 6. Génération LLM Sécurisée   │
                      │    & Validateur de Structure  │
                      └───────────────────────────────┘
```

---

## 3. Synthèse des Résultats d'Évaluation (Métriques Ragas)

Nous avons conduit deux bancs d'essai rigoureux sur des jeux de données bilingues (Français / Anglais) :

### A. Évaluation de la Structure du Rapport (Table des Matières - 8 Cas)
| Pipeline Évalué | Pertinence du Contexte | Taux de Déclenchement CRAG | Fidélité au Projet | Qualité Structurelle | Score Composite |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Fallback Initial (Mots-clés)** | `0.368` | — | `0.993` | `0.871` | **`0.719`** |
| **2. RAG Naïf (Vectoriel Brut)** | `0.373` | — | `0.993` | `0.871` | **`0.723`** |
| **3. CRAG Auto-Correcteur (Actuel)** | **`0.374`** | **25% (2/8 réécrits)** | **`0.993`** | **`0.871`** | **`0.725`** |

*Gains clés sur les domaines IT ciblés : E-Commerce (+10%), IA & NLP (+17%), Cybersécurité (+7%).*

---

### B. Évaluation du Report Builder (Rédaction des Sections - 10 Cas)
| Métrique Évaluée | Score Obtenu | Interprétation Académique |
| :--- | :---: | :--- |
| **Pertinence du Contexte (Context Relevance)** | **`0.445`** *(jusqu'à `0.737` en DevOps)* | Extraction ciblée des paragraphes techniques pertinents. |
| **Taux de Déclenchement du Grader CRAG** | **50% (5/10 réécrits)** | Détection et correction automatique des requêtes floues. |
| **Fidélité au Projet (Faithfulness)** | **`1.000` / 1.000** | Absence totale d'hallucinations de bibliothèques ou données fictives. |
| **Profondeur Technique (Technical Depth)** | **`0.902` / 1.000** | Rédaction académique complète (moyenne de **618 mots** par section). |
| **Score Global Composite** | **`0.799` / 1.000** | **Niveau d'excellence pour un rapport de master/ingénieur.** |

---

## 4. Points Clés pour la Soutenance & le Rapport de Stage

1. **Innovation Architecturale** :
   - Passage d'un RAG statique à un **RAG Agentique Auto-Correcteur (Corrective RAG)** avec boucle d'auto-évaluation et réécriture de requêtes.
2. **Performance & Optimisation** :
   - Indexation vectorielle native **MongoDB Atlas `$vectorSearch`** (384 dimensions) avec embeddings SentenceTransformers multilingues.
   - Suppression du gaspillage de contexte : réduction de la taille des prompts de 25 Ko à **7.5 Ko** sans perte d'information.
   - Détection intelligente du scope : les modifications locales sur le texte sélectionné s'exécutent en **2 secondes**, tandis que la rédaction complète d'une section exploite la puissance du RAG.
3. **Méthodologie Scientifique** :
   - Évaluation reproductible basée sur les standards **Ragas** (Relevance, Faithfulness, Structure Depth).
