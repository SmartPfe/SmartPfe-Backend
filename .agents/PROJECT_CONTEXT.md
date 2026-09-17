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
- **RAG & Search — Production-Grade Corrective RAG (CRAG)**:
  - **Knowledge Base**: 31 real university PFE theses, 3,092 semantically chunked sections stored across three MongoDB collections: `pfe_chunks` (vector-indexed content), `pfe_documents` (parent metadata), and `pfe_structures` (full table-of-contents hierarchies).
  - **Embedding Runtime**: Dual-runtime architecture — primary in-process ONNX via `@xenova/transformers` (`embeddingService.js`, cold start ~2-4s, subsequent <50ms) with automatic fallback to Python `sentence-transformers` bridge (`ragEmbeddingQuery.py`). Model: `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions, bilingual FR/EN).
  - **Vector Search**: Native MongoDB Atlas `$vectorSearch` aggregation pipeline with automatic index discovery and multi-index failover (`pfe_chunks_vector_index` → `vector_index` → `default`).
  - **Hybrid Retrieval**: Vector similarity as primary path, keyword token scoring + structure-level relevance scoring as cascading fallbacks. No single point of failure.
  - **Self-Correcting RAG (CRAG) Loop**: After initial retrieval, a composite relevance grader scores context on academic chapter coverage (60% weight — checks for Introduction, SOTA, Requirements, Design, Implementation, Testing, Conclusion) + domain/technical keyword density (40% weight). If the composite score < 0.65, the system **automatically rewrites the query** (focusing on identified gaps) and executes a second retrieval pass. The best-scoring context is adopted.
  - **Dual CRAG Pipelines at Different Granularities**:
    - *Report Structure CRAG* (`reportStructureRagService.js`): Document-level retrieval of full thesis table-of-contents structures for outline generation/refinement.
    - *Report Builder CRAG* (`reportStudioRagService.js`): Section-level retrieval of specific technical paragraphs for chapter writing, grounded in real academic literature.
  - **Prompt Augmentation Security**: Retrieved literature is injected inside `<retrieved_literature_excerpts>` tags with explicit security directives preventing prompt injection from both student-provided data and retrieved content.
  - **RAG Evaluation Framework** (`rag-evaluation/`): RAGAS-inspired automated benchmark suite with 18+ bilingual test cases measuring 5 metrics (Context Relevance, Context Recall, Faithfulness, Structure Quality, Composite RAG Score). Reproducible via `npm run evaluate:rag`. Results: **0.799 composite, 1.000 faithfulness (zero hallucinations), 50% CRAG self-correction trigger rate**.
- **LLM Observability**: Langfuse tracing integration (`observabilityService.js`) with per-user context propagation via `AsyncLocalStorage`, tracking every AI call with user identity, action type, model selection, and RAG pipeline state.

---

## 🔑 4. Architecture & Coding Conventions

- **Unified Project Model**: Most module data lives inside the student's single `Project` document in MongoDB under dedicated fields (`technicalContext`, `functionalRequirements`, `umlPreparation`, `reportStructure`, `reportChapters`, `finalReport`).
- **Prompt Builders**: AI prompt assembly is modularized into dedicated builders (`reportStudioPromptBuilder.js`, `reportStructurePromptBuilder.js`, `umlPreparationPromptBuilder.js`).
- **Bilingual Support**: All AI generations strictly respect the student's selected language (`French` or `English`).
- **Resilient AI Parsing**: AI responses are validated and sanitized via JSON extraction helpers with fallback schema normalizers.
