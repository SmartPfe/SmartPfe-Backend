# SmartPFE — Project Overview & Architecture Guide

> **Quick Context for AI Agents**: Read this file to instantly understand the entire SmartPFE application, its domain, module workflows, and technical stack without re-explaining the basics.

---

## 🎯 1. What is SmartPFE?
**SmartPFE** (PFE Mentor) is an AI-powered SaaS platform designed to assist university engineering and computer science students throughout their **End-of-Studies Projects (PFE — Projet de Fin d'Études)**. It guides students from initial problem formulation and UML modeling to full report writing and defense preparation.

---

## 🏗️ 2. Core Modules & End-to-End Workflow

The platform is structured into synchronized workspace modules:

1. **Project Setup & Context**:
   - Captures Title, Domain, University, Academic Year, Problem Statement, Objectives, Tech Stack, Methodology (e.g. Scrum), and Actors/Personas.
2. **Requirements Engineering (Backlog)**:
   - Functional (RF-xx) & Non-Functional (RNF-xx) requirements with priorities, descriptions, and actor mappings.
3. **State of the Art (SOTA / Existing Solutions)**:
   - Comparative matrix of existing market tools, their weaknesses, and project differentiation.
4. **UML Preparation & Modeling**:
   - Generates and refines UML entities (Actors, Use Cases, Class Diagrams, Sequence Diagrams).
   - Diagram rendering is done client-side using PlantUML (`plantuml-encoder` $\rightarrow$ SVG/PNG).
5. **Report Structure (Table of Contents)**:
   - Generates a compliant 5–8 chapter university thesis outline conforming to engineering school standards.
   - Enhanced with Corrective RAG (CRAG) over a database of real PFE theses.
6. **Report Builder (Report Studio)**:
   - Section-by-section academic report editor (HTML/Markdown) with two AI interaction scopes:
     - **Full-Section Generation / Enrichment**: Powered by Section-level CRAG for literature grounding.
     - **Floating Selection Dock**: Instant (~2s) in-place text transformation (Expand, Simplify, Academic Tone, Translate).
   - Generates the final compiled thesis report (HTML, Markdown, LaTeX).
7. **Pitch & Defense Simulator**:
   - Generates presentation slides, timed defense speech scripts, and jury Q&A simulation.

---

## 💻 3. Technology Stack & Key Libraries

### Frontend (`SmartPfe-Front`)
- **Core**: React 18, Vite, TypeScript.
- **Styling**: Tailwind CSS, Lucide React icons, modern dark/light card-based executive UI.
- **State & Data**: Modular custom hooks per page (`useReportStudio.ts`, `useUmlPreparation.ts`, etc.) connecting to Axios API endpoints.
- **Rendering**: Client-side PlantUML renderer component (`PlantUmlRenderer.tsx`).

### Backend (`SmartPfe-Backend`)
- **Runtime & Server**: Node.js, Express (REST API).
- **Database**: MongoDB Atlas via Mongoose.
  - Core collections: `projects` (unified project document containing all modules), `users`, `pfe_chunks` (3,092 indexed thesis chunks for vector search).
- **AI Engine**: OpenRouter API (`openRouterService.js`) with automatic multi-model fallback chain.
- **RAG & Search**:
  - Native MongoDB Atlas `$vectorSearch` (`pfe_chunks_vector_index`, 384 dimensions).
  - Python bridge script (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`) for dense embeddings.
  - Native Corrective RAG (CRAG) loop with relevance grading and single-retry query rewriting.

---

## 🔑 4. Architecture & Coding Conventions

- **Unified Project Model**: Most module data lives inside the student's single `Project` document in MongoDB under dedicated fields (`technicalContext`, `functionalRequirements`, `umlPreparation`, `reportStructure`, `reportChapters`, `finalReport`).
- **Prompt Builders**: AI prompt assembly is modularized into dedicated builders (`reportStudioPromptBuilder.js`, `reportStructurePromptBuilder.js`, `umlPreparationPromptBuilder.js`).
- **Bilingual Support**: All AI generations strictly respect the student's selected language (`French` or `English`).
- **Resilient AI Parsing**: AI responses are validated and sanitized via JSON extraction helpers with fallback schema normalizers.
