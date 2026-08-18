# Rapport d'Évaluation : Baseline Initiale du RAG (Structure du Rapport)

## 1. Contexte de l'Évaluation
- **Objectif** : Évaluer la performance du système RAG initial (avec fallback textuel avant l'activation de l'index vectoriel natif).
- **Jeu de données** : 18 cas réels de PFE d'ingénierie logicielle (Français / Anglais).
- **Base de connaissances** : 31 thèses de PFE indexées dans MongoDB.

## 2. Métriques Globales Baseline
- **Pertinence Moyenne du Contexte (Context Relevance)** : `0.355` / 1.000
- **Rappel Académique du Contexte (Context Recall)** : `0.825` / 1.000
- **Fidélité de Génération (Faithfulness)** : `0.993` / 1.000
- **Qualité Structurelle de la Table des Matières** : `0.871` / 1.000
- **Score Composite Global RAG** : **`0.710` / 1.000**

## 3. Analyse
- La fidélité était déjà exceptionnelle (`0.993`) : le modèle suit strictement les spécifications de l'étudiant.
- La pertinence du contexte (`0.355`) constituait le point critique à améliorer via l'activation de la recherche vectorielle native et l'auto-correction (CRAG).
