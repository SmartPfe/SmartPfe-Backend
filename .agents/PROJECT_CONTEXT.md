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
- **AI Engine**: Google Gemini API (direct REST, `geminiService.js`) with a **3-tier semantic model fallback chain**:
  - `reasoning` tier — complex synthesis, RAG chapter generation, UML modeling.
  - `default` tier — standard generation (problem statement, requirements, backlog, pitch).
  - `fast` tier — sub-second micro-actions (Floating Dock: expand, simplify, translate, tone).
  - Each tier has an ordered fallback list (e.g. `gemini-2.5-flash` → `gemini-2.0-flash` → lite models) with automatic 429 retry.
- **RAG & Search — Production-Grade Corrective RAG (CRAG)**:
  - **Knowledge Base**: 31 real university PFE theses, 3,092 semantically chunked sections stored across three MongoDB collections: `pfe_chunks` (vector-indexed content), `pfe_documents` (parent metadata), and `pfe_structures` (full table-of-contents hierarchies).
  - **Embedding Runtime**: Dual-runtime architecture — primary in-process ONNX via `@xenova/transformers` (`embeddingService.js`, model cached in memory after first load, query vectorization: **~4ms**, cold start ~2-4s, subsequent <50ms) with automatic fallback to Python `sentence-transformers` bridge (`ragEmbeddingQuery.py`). Model: `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions, bilingual FR/EN).
  - **Vector Search**: Native MongoDB Atlas `$vectorSearch` aggregation pipeline with automatic index discovery and multi-index failover (`pfe_chunks_vector_index` → `vector_index` → `default`).
  - **Hybrid Retrieval**: Vector similarity as primary path, keyword token scoring + structure-level relevance scoring as cascading fallbacks. No single point of failure.
  - **Self-Correcting RAG (CRAG) Loop**: After initial retrieval, a composite relevance grader scores context on academic chapter coverage (60% weight — checks for Introduction, SOTA, Requirements, Design, Implementation, Testing, Conclusion) + domain/technical keyword density (40% weight). If the composite score < 0.65, the system **automatically rewrites the query** (focusing on identified gaps) and executes a second retrieval pass. The best-scoring context is adopted.
  - **Dual CRAG Pipelines at Different Granularities**:
    - *Report Structure CRAG* (`reportStructureRagService.js`): Document-level retrieval of full thesis table-of-contents structures for outline generation/refinement.
    - *Report Builder CRAG* (`reportStudioRagService.js`): Section-level retrieval of specific technical paragraphs for chapter writing, grounded in real academic literature.
  - **Prompt Augmentation Security**: Retrieved literature is injected inside `<retrieved_literature_excerpts>` tags with explicit security directives preventing prompt injection from both student-provided data and retrieved content.
  - **RAG Evaluation Framework** (`rag-evaluation/`): RAGAS-inspired automated benchmark suite with 18+ bilingual test cases measuring 5 metrics (Context Relevance, Context Recall, Faithfulness, Structure Quality, Composite RAG Score). Reproducible via `npm run evaluate:rag`. Results: **0.799 composite, 1.000 faithfulness (zero hallucinations), 50% CRAG self-correction trigger rate**.
- **Observability**: Langfuse tracing (`observabilityService.js`) with `AsyncLocalStorage`-based per-request user context. Every AI trace is tagged with the authenticated user's email (`userId`), name, role, and MongoDB ID — no anonymous traces in production.
- **Streaming**: SSE (`streamGenerateContent`) for Report Studio section generation — chunks streamed to frontend in real-time, saved to DB only after full generation completes.
- **Payload & Error Handling**: Express payload limit set to 50MB (supports large thesis content). Global JSON error middleware ensures all errors (including `PayloadTooLargeError`) return structured JSON — never raw HTML.

---

## 🔑 4. Architecture & Coding Conventions

- **Unified Project Model**: Most module data lives inside the student's single `Project` document in MongoDB under dedicated fields (`technicalContext`, `functionalRequirements`, `umlPreparation`, `reportStructure`, `reportChapters`, `finalReport`).
- **Prompt Builders**: AI prompt assembly is modularized into dedicated builders (`reportStudioPromptBuilder.js`, `reportStructurePromptBuilder.js`, `umlPreparationPromptBuilder.js`).
- **Bilingual Support**: All AI generations strictly respect the student's selected language (`French` or `English`).
- **Resilient AI Parsing**: AI responses are validated and sanitized via JSON extraction helpers with fallback schema normalizers.
- **Context Engineering**: Each workflow module inherits structured context from all preceding steps (problem statement → requirements → UML → report structure → report chapters). Context is injected into every prompt via `buildProjectContext()` / `formatContextString()` in `geminiService.js`, ensuring coherent, project-aware generation across the full thesis lifecycle without context bleed between students.
- **Concurrency Control**: `AiGenerationContext` limits concurrent AI generations to 2 per server to prevent model quota exhaustion.
- **Tests**: `src/tests/observability.test.js` — 5 unit tests covering the full AsyncLocalStorage user-tracking chain.

---

## 💳 5. Credit Economy & Admin Refresh (Implemented September 2026)

### Current implementation status

- The credit-system work is implemented on branch `feature/credit-system-admin-refresh` in both `SmartPfe-Backend` and `SmartPfe-Front`; `main` was not modified directly.
- At the time of this handoff, the feature changes are intentionally **uncommitted** so they can be reviewed before committing or merging.
- Backend credit tests pass (5/5), frontend TypeScript validation passes, the frontend production build passes, and Git diff checks report no whitespace errors.

### Product rules and starting economy

- Verified users receive **110 promotional welcome credits**, granted exactly once.
- The daily allowance is a **refill to 20 promotional credits**, not an unconditional +20 grant. It runs once per calendar day using the configured timezone (`Africa/Tunis` by default). Purchased credits are never changed by the daily refill.
- Promotional credits are spent before purchased credits. Both balances are stored separately and exposed as a combined total.
- Translation and final report compilation are free but rate-limited. Translation is free because students can obtain it elsewhere and charging would add friction without meaningful value.
- Default prices live in `src/config/creditDefaults.js`, but MongoDB is the runtime source of truth. Admins can change prices, limits, enabled state, welcome credits, refill target, timezone, and enforcement mode without a deployment.

| Policy key | Default cost | Notes |
| --- | ---: | --- |
| `problem_statement`, `actors`, `existing_solutions`, `functional_requirements`, `nonfunctional_requirements`, `product_backlog`, `uml_preparation` | 5 | Foundation generate/refine actions |
| `report_structure` | 12 | CRAG/RAG-assisted report outline |
| `report_section` | 10 | Same price regardless of concise/standard/detailed format |
| `report_polish_light` | 0 | Context-free quick polish; 5/minute and 20/day |
| `report_polish_contextual` | 2 | First 2/day free, then charged; 4/minute and 20/day |
| `final_report_compile` | 0 | 1/minute and 2/day; cached/reused where possible |
| `presentation_full` / `presentation_slide` | 8 / 2 | Full deck versus individual slide regeneration |
| `pitch_full` / `pitch_slide` | 6 / 2 | Full pitch versus individual slide speech |
| `jury_simulation` | 20 | Project, deck, pitch and recording analysis |
| `jury_qa_session` | 10 | One bundled charge for the complete Q&A session |
| `jury_qa_included` | 0 | Internal follow-up steps included in the paid Q&A session; not admin-editable |
| `translation` | 0 | 5/minute and 30/day |

### Backend architecture

- `src/services/creditService.js` is the authoritative domain service. It bootstraps configuration, lazily creates wallets, applies grants/refills, reserves/settles/refunds charges, manages free quotas and limits, handles admin changes, and lists ledger history.
- `src/middleware/creditMiddleware.js` wraps AI endpoints with a reserve → execute → settle flow. Failed or disconnected requests are refunded. Reservations older than 15 minutes are recovered automatically.
- Clients send an idempotency key and `X-Credit-Policy-Version`. Reusing a key for another action is rejected; stale policy versions return a conflict so the UI can refresh instead of silently charging a changed price.
- Wallet updates use atomic MongoDB conditions/version checks. Balances cannot go negative. A database-backed `AiConcurrencyLock` limits each user to two simultaneous AI requests.
- Enforcement modes are `off`, `shadow`, and `enforce`; `CREDITS_ENFORCEMENT_MODE` can override the stored setting. Production should normally use `enforce`.
- Every monetary event is recorded in the append-oriented `CreditTransaction` ledger. Admin configuration changes are audited through `CreditPolicyChange`, and credit adjustments require a reason.
- New persistence models: `CreditWallet`, `CreditTransaction`, `CreditPolicy`, `CreditSettings`, `CreditFreeUsage`, `CreditPolicyChange`, `RateLimitCounter`, and `AiConcurrencyLock`.
- User endpoints: `GET /api/credits/me`, `GET /api/credits/catalog`, and `GET /api/credits/transactions`.
- Admin endpoints: `GET /api/admin/credits/economy`, `PATCH /api/admin/credits/policies/:key`, `PATCH /api/admin/credits/settings`, `POST /api/admin/users/:userId/credits/adjust`, and `GET /api/admin/users/:userId/credits`.
- All protected AI POST routes in `src/routes/aiRoutes.js` are mapped to a registered policy. Do not introduce a new AI endpoint without adding an explicit policy and credit gate; unknown/unpriced actions fail closed.
- Report polish was split deliberately: lightweight actions send only selected text and remain free; contextual actions include project/report context, receive two free daily uses, then cost 2 credits.

### Frontend integration and UI rules

- `src/context/CreditContext.tsx` owns wallet, catalog and recent transaction state. `src/lib/api.ts` registers policy versions, attaches idempotency/version headers, and broadcasts `smartpfe:credits-updated` after chargeable responses.
- Reusable credit components live in `src/components/credits/`. The canonical coin artwork lives in `src/assets/` and should be reused everywhere credits are shown.
- Show compact price affordances such as the coin plus `5`; do **not** expand AI button labels into verbose text such as “Generate · 5 credits.” Keep alerts and insufficient-credit messages concise and consistent with the existing visual language.
- The top bar exposes the current balance and activity. Account Settings contains wallet and recent ledger information.
- The admin UI was restyled to match the user application. `/admin/credits` manages the economy; Admin Users supports wallet adjustments and history. `AdminLayout` owns admin navigation, preventing browser/back navigation from accidentally routing into the student workspace.
- Workflow unlocking remains content-driven: foundation steps lead through report structure; report generation then unlocks report builder, presentation and pitch; jury features unlock from generated defense content. Credits price actions but do not replace these prerequisites.

### Guidance for future work

- Treat policy keys as stable identifiers shared by backend routing, persisted configuration, and frontend display. Renaming one requires a deliberate migration.
- Never trust a cost supplied by the browser. Quote and debit exclusively from the server-side policy record.
- Preserve idempotency, refunds, policy-version checks, audit reasons, separate balance buckets, and fail-closed route coverage when extending the system.
- Before production rollout, review the economy in Admin, confirm `enforce` mode, and smoke-test against the deployment's real MongoDB transaction/connection environment. Payments/top-up purchasing are not part of this implementation; only admin adjustments currently populate purchased credits.

### Admin quality-of-life update

- Admin accounts remain visible in the user directory but are wallet-ineligible: no wallet is returned, the UI shows “No wallet”, and wallet APIs reject administrator targets. Credit analytics are student-only.
- Wallet fulfilment defaults to purchased. A positive purchased adjustment sends a reward-style Nodemailer confirmation email. Delivery failure is logged but never reverses settled credits; an idempotency replay does not send another email.
- Users management has name/email search, role/onboarding filters, sortable columns, 10-row pagination, concise success feedback, and minute-accurate transaction timestamps.
- The dashboard now prioritizes student readiness, growth, AI credit usage, paid fulfilments, top AI actions, domains, and recent activity rather than metadata-heavy charts.

---

## 💳 5. Credit Economy & Admin Refresh (Implemented September 2026)

### Current implementation status

- The credit-system work is implemented on branch `feature/credit-system-admin-refresh` in both `SmartPfe-Backend` and `SmartPfe-Front`; `main` was not modified directly.
- At the time of this handoff, the feature changes are intentionally **uncommitted** so they can be reviewed before committing or merging.
- Backend credit tests pass (5/5), frontend TypeScript validation passes, the frontend production build passes, and Git diff checks report no whitespace errors.

### Product rules and starting economy

- Verified users receive **110 promotional welcome credits**, granted exactly once.
- The daily allowance is a **refill to 20 promotional credits**, not an unconditional +20 grant. It runs once per calendar day using the configured timezone (`Africa/Tunis` by default). Purchased credits are never changed by the daily refill.
- Promotional credits are spent before purchased credits. Both balances are stored separately and exposed as a combined total.
- Translation and final report compilation are free but rate-limited. Translation is free because students can obtain it elsewhere and charging would add friction without meaningful value.
- Default prices live in `src/config/creditDefaults.js`, but MongoDB is the runtime source of truth. Admins can change prices, limits, enabled state, welcome credits, refill target, timezone, and enforcement mode without a deployment.

| Policy key | Default cost | Notes |
| --- | ---: | --- |
| `problem_statement`, `actors`, `existing_solutions`, `functional_requirements`, `nonfunctional_requirements`, `product_backlog`, `uml_preparation` | 5 | Foundation generate/refine actions |
| `report_structure` | 12 | CRAG/RAG-assisted report outline |
| `report_section` | 10 | Same price regardless of concise/standard/detailed format |
| `report_polish_light` | 0 | Context-free quick polish; 5/minute and 20/day |
| `report_polish_contextual` | 2 | First 2/day free, then charged; 4/minute and 20/day |
| `final_report_compile` | 0 | 1/minute and 2/day; cached/reused where possible |
| `presentation_full` / `presentation_slide` | 8 / 2 | Full deck versus individual slide regeneration |
| `pitch_full` / `pitch_slide` | 6 / 2 | Full pitch versus individual slide speech |
| `jury_simulation` | 20 | Project, deck, pitch and recording analysis |
| `jury_qa_session` | 10 | One bundled charge for the complete Q&A session |
| `jury_qa_included` | 0 | Internal follow-up steps included in the paid Q&A session; not admin-editable |
| `translation` | 0 | 5/minute and 30/day |

### Backend architecture

- `src/services/creditService.js` is the authoritative domain service. It bootstraps configuration, lazily creates wallets, applies grants/refills, reserves/settles/refunds charges, manages free quotas and limits, handles admin changes, and lists ledger history.
- `src/middleware/creditMiddleware.js` wraps AI endpoints with a reserve → execute → settle flow. Failed or disconnected requests are refunded. Reservations older than 15 minutes are recovered automatically.
- Clients send an idempotency key and `X-Credit-Policy-Version`. Reusing a key for another action is rejected; stale policy versions return a conflict so the UI can refresh instead of silently charging a changed price.
- Wallet updates use atomic MongoDB conditions/version checks. Balances cannot go negative. A database-backed `AiConcurrencyLock` limits each user to two simultaneous AI requests.
- Enforcement modes are `off`, `shadow`, and `enforce`; `CREDITS_ENFORCEMENT_MODE` can override the stored setting. Production should normally use `enforce`.
- Every monetary event is recorded in the append-oriented `CreditTransaction` ledger. Admin configuration changes are audited through `CreditPolicyChange`, and credit adjustments require a reason.
- New persistence models: `CreditWallet`, `CreditTransaction`, `CreditPolicy`, `CreditSettings`, `CreditFreeUsage`, `CreditPolicyChange`, `RateLimitCounter`, and `AiConcurrencyLock`.
- User endpoints: `GET /api/credits/me`, `GET /api/credits/catalog`, and `GET /api/credits/transactions`.
- Admin endpoints: `GET /api/admin/credits/economy`, `PATCH /api/admin/credits/policies/:key`, `PATCH /api/admin/credits/settings`, `POST /api/admin/users/:userId/credits/adjust`, and `GET /api/admin/users/:userId/credits`.
- All protected AI POST routes in `src/routes/aiRoutes.js` are mapped to a registered policy. Do not introduce a new AI endpoint without adding an explicit policy and credit gate; unknown/unpriced actions fail closed.
- Report polish was split deliberately: lightweight actions send only selected text and remain free; contextual actions include project/report context, receive two free daily uses, then cost 2 credits.

### Frontend integration and UI rules

- `src/context/CreditContext.tsx` owns wallet, catalog and recent transaction state. `src/lib/api.ts` registers policy versions, attaches idempotency/version headers, and broadcasts `smartpfe:credits-updated` after chargeable responses.
- Reusable credit components live in `src/components/credits/`. The canonical coin artwork lives in `src/assets/` and should be reused everywhere credits are shown.
- Show compact price affordances such as the coin plus `5`; do **not** expand AI button labels into verbose text such as “Generate · 5 credits.” Keep alerts and insufficient-credit messages concise and consistent with the existing visual language.
- The top bar exposes the current balance and activity. Account Settings contains wallet and recent ledger information.
- The admin UI was restyled to match the user application. `/admin/credits` manages the economy; Admin Users supports wallet adjustments and history. `AdminLayout` owns admin navigation, preventing browser/back navigation from accidentally routing into the student workspace.
- Workflow unlocking remains content-driven: foundation steps lead through report structure; report generation then unlocks report builder, presentation and pitch; jury features unlock from generated defense content. Credits price actions but do not replace these prerequisites.

### Guidance for future work

- Treat policy keys as stable identifiers shared by backend routing, persisted configuration, and frontend display. Renaming one requires a deliberate migration.
- Never trust a cost supplied by the browser. Quote and debit exclusively from the server-side policy record.
- Preserve idempotency, refunds, policy-version checks, audit reasons, separate balance buckets, and fail-closed route coverage when extending the system.
- Before production rollout, review the economy in Admin, confirm `enforce` mode, and smoke-test against the deployment's real MongoDB transaction/connection environment. Payments/top-up purchasing are not part of this implementation; only admin adjustments currently populate purchased credits.

