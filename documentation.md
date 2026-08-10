# PFE Guidance Backend Documentation

## 1. Repository Purpose

This repository contains the backend API for PFE Guidance / Smart PFE.

It is responsible for:

- User authentication and authorization.
- Student project persistence.
- AI generation, refinement, and translation.
- Report structure generation with RAG support.
- Report Builder persistence and final report generation.
- Presentation, pitch, and jury simulation support.
- Notifications.
- Admin dashboard APIs.

The backend is built with:

- Node.js
- Express
- MongoDB
- Mongoose
- JWT authentication
- OpenRouter for most text-generation AI calls
- Gemini for jury simulation audio analysis
- A Python helper for RAG query embeddings

## 2. How To Run The Backend

Install dependencies:

```bash
npm install
```

Start in development mode:

```bash
npm run dev
```

Start in production mode:

```bash
npm start
```

The default server port is:

```text
5000
```

The root endpoint returns a simple confirmation that the backend is running.

```text
GET /
```

## 3. Environment Configuration

The backend loads environment variables from `.env` using `dotenv`.

Important variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend HTTP port. Defaults to `5000`. |
| `MONGO_URI` | MongoDB connection string. |
| `FRONTEND_URL` | Allowed frontend origins for CORS. Can contain multiple comma-separated origins. |
| `JWT_SECRET` | Secret used to sign and verify JWT tokens. |
| `OPENROUTER_API_KEY` | API key used for most text-generation features. |
| `GEMINI_API_KEY` | API key used by jury simulation audio analysis. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID checked during Google login. |
| `BREVO_API_KEY` | Email provider API key for reset/verification emails. |
| `EMAIL_FROM` | Sender address for outgoing emails. |
| `RAG_VECTOR_INDEX_NAME` | Preferred MongoDB vector search index name for RAG. |
| `RAG_PYTHON_COMMAND` | Optional explicit Python executable for query embeddings. |
| `RAG_EMBEDDING_MODEL` | Sentence-transformers model used for query embeddings. |
| `RAG_EMBEDDING_TIMEOUT_MS` | Optional timeout for Python embedding generation. |
| `RAG_VECTOR_LIMIT` | Number of chunks returned by vector search. |
| `RAG_VECTOR_NUM_CANDIDATES` | MongoDB vector search candidate count. |
| `RAG_STRUCTURE_LIMIT` | Number of matched report structures included in context. |
| `RAG_CONTEXT_MAX_CHARS` | Maximum retrieved context size injected into the prompt. |
| `RAG_STRUCTURE_FALLBACK_LIMIT` | Number of fallback TOC structures used if vector search fails or returns nothing. |

Do not hard-code production secrets in source code. Use environment variables in deployment.

## 4. Server Entry Point

The main server file is:

```text
src/server.js
```

It performs the following:

1. Loads environment variables.
2. Connects to MongoDB.
3. Configures CORS with `FRONTEND_URL`.
4. Enables JSON request parsing.
5. Registers API route groups.
6. Starts the Express server.

Registered route groups:

```text
/api/auth
/api/projects
/api/notifications
/api/ai
/api/admin
```

## 5. Database Models

Main models:

```text
src/models/User.js
src/models/Project.js
src/models/Notification.js
```

### User

The `User` model stores:

- Full name.
- Email.
- Hashed password.
- Optional Google ID.
- Avatar.
- Password reset token and expiry.
- Email verification code hash and expiry.
- Onboarding completion flag.
- Role: `etudiant` or `admin`.

Passwords are hashed automatically before saving.

### Project

The `Project` model is the central document for a student's PFE work.

It stores:

- Basics: title, type, domain, language, university, academic year.
- Description: problem statement, objective, detailed description, company, stakeholders, deliverables.
- Technical context: development types, methodology, technologies, target users, complexity, team size, duration.
- Actors.
- Existing solutions.
- Functional requirements.
- Non-functional requirements.
- Product backlog.
- UML preparation.
- Report structure.
- Report chapters.
- Final report.
- Presentation.
- Pitch.
- Jury simulation attempts.

This design keeps the complete PFE workflow attached to one student project.

## 6. Authentication And Authorization

Authentication files:

```text
src/controllers/authController.js
src/routes/authRoutes.js
src/middleware/authMiddleware.js
```

Supported endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create an account and send verification code. |
| `POST /api/auth/verify-email` | Verify the email code. |
| `POST /api/auth/resend-verification-code` | Send a new verification code. |
| `POST /api/auth/login` | Log in with email and password. |
| `POST /api/auth/google` | Log in with Google. |
| `GET /api/auth/profile` | Get current user profile. |
| `PUT /api/auth/profile` | Update current user profile. |
| `POST /api/auth/forgot-password` | Send reset password email. |
| `POST /api/auth/reset-password` | Reset password using a token. |

Protected routes expect:

```text
Authorization: Bearer <jwt>
```

Admin-only routes also require:

```text
role = "admin"
```

## 7. Project APIs

Project routes are defined in:

```text
src/routes/projectRoutes.js
src/controllers/projectController.js
```

Important endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/projects/onboarding` | Create the student's project after onboarding. |
| `GET /api/projects/my-project` | Get the logged-in student's project. |
| `PUT /api/projects/my-project` | Update the general project information. |
| `PATCH /api/projects/problem-statement` | Save the problem statement. |
| `GET/PUT /api/projects/:id/actors` | Load or save actors. |
| `GET/PUT /api/projects/:id/existing-solutions` | Load or save existing solutions. |
| `GET/PUT /api/projects/:id/functional-requirements` | Load or save functional requirements. |
| `GET/PUT /api/projects/:id/non-functional-requirements` | Load or save non-functional requirements. |
| `GET/PUT /api/projects/:id/product-backlog` | Load or save product backlog. |
| `GET/PUT /api/projects/:id/uml-preparation` | Load or save UML preparation data. |
| `GET/PUT /api/projects/:id/report-structure` | Load or save the report table of contents. |
| `GET/PUT /api/projects/:id/report-chapters` | Load or save report chapter content. |
| `PUT /api/projects/:id/final-report` | Save the generated final report. |
| `GET/PUT /api/projects/:id/presentation` | Load or save defense slides. |
| `GET/PUT /api/projects/:id/pitch` | Load or save pitch content. |
| `GET /api/projects/:id/jury-simulation` | Load jury simulation attempts. |

Every project endpoint is protected. The controller always scopes project access to the logged-in user.

## 8. AI API Layer

AI routes are defined in:

```text
src/routes/aiRoutes.js
src/controllers/aiController.js
```

The backend exposes generate/refine/translate operations for most PFE artifacts:

- Problem statement.
- Actors.
- Existing solutions.
- Functional requirements.
- Non-functional requirements.
- Product backlog.
- Report structure.
- UML preparation.
- Presentation.
- Pitch.

It also exposes:

- Report Studio chapter generation.
- Report Studio chapter actions.
- Complete report generation.
- Jury simulation audio analysis.

Most AI services are organized as:

```text
src/services/<feature>Service.js
src/services/<feature>PromptBuilder.js
```

The service validates and normalizes data. The prompt builder prepares a strict prompt and JSON contract when the response must be structured.

## 9. OpenRouter AI Integration

Main file:

```text
src/services/openRouterService.js
```

The backend sends chat-completion requests to OpenRouter. It uses a fallback model list. If one model is unavailable or rate-limited, the service tries the next configured model.

The helper also builds a reusable project context from the MongoDB `Project` document. This project context is included in prompts so generated content is based on the student's real project information.

Used by:

- Problem statement generation/refinement/translation.
- Actors.
- Existing solutions.
- Requirements.
- Backlog.
- UML preparation.
- Report structure.
- Report Studio.
- Presentation.
- Pitch.

## 10. RAG Integration For Report Structure

RAG is used in this backend only for report structure generation and refinement.

Main files:

```text
src/services/reportStructureService.js
src/services/reportStructureRagService.js
src/services/ragEmbeddingQuery.py
src/services/reportStructurePromptBuilder.js
```

### What The RAG System Does

The separate RAG ingestion repository processes real PFE report PDFs and stores their extracted structure and semantic chunks in MongoDB.

This backend then uses that database during:

```text
POST /api/ai/report-structure/generate
POST /api/ai/report-structure/refine
```

The objective is not to copy old reports. The objective is to retrieve academically realistic examples of PFE report organization and use them as supporting context while generating a structure adapted to the current student's project.

### Runtime RAG Flow

When the student asks for a report structure:

1. The backend loads the student's project from MongoDB.
2. `reportStructureRagService.js` builds a semantic retrieval query from the project:
   - title
   - domain
   - problem statement
   - objective
   - development types
   - technologies
   - methodology
   - target users
   - actors
   - requirements
   - backlog
   - UML classes and use cases
3. The backend starts `ragEmbeddingQuery.py` as a child Python process.
4. The Python script uses `sentence-transformers` to generate a 384-dimensional embedding for the query.
5. The backend runs MongoDB `$vectorSearch` against the `pfe_chunks` collection.
6. The backend loads metadata from:
   - `pfe_documents`
   - `pfe_structures`
   - `pfe_chunks`
7. It formats the top matching report examples into a compact internal context.
8. That context is injected into the report-structure prompt.
9. OpenRouter generates a structured JSON table of contents.
10. The backend validates and normalizes the JSON before returning it to the frontend.

### RAG Fallback Behavior

The RAG implementation is defensive. If vector retrieval is unavailable, the backend does not fail the student request.

Fallback cases include:

- MongoDB connection is not ready.
- Python embedding process fails.
- The vector index does not exist.
- `$vectorSearch` fails.
- No chunks are returned.

If vector search returns no usable chunks, the backend tries a structure-first fallback using `pfe_structures`. It ranks TOCs by keyword overlap and structure quality. If even that fails, it returns an empty RAG context and the normal report-structure prompt still works.

This means RAG improves quality when available, but the application remains usable without it.

### MongoDB Collections Used By RAG

The backend expects the ingestion repository to populate these collections in the same MongoDB database:

| Collection | Purpose |
| --- | --- |
| `pfe_documents` | One metadata record per PDF. |
| `pfe_structures` | Extracted table of contents for each PDF. |
| `pfe_chunks` | Text chunks and embeddings used for semantic retrieval. |

### Vector Search Index

The backend expects a vector index on:

```text
collection: pfe_chunks
field: embedding
dimensions: 384
similarity: cosine
```

The preferred index name is configured with:

```text
RAG_VECTOR_INDEX_NAME
```

The service also tries fallback index names:

```text
pfe_chunks_vector_index
vector_index
default
```

## 11. Report Studio

Report Studio files:

```text
src/services/reportStudioService.js
src/services/reportStudioPromptBuilder.js
```

Report Studio is responsible for writing the actual report content after the structure exists.

Important behavior:

- It writes content chapter by chapter.
- It only generates content for leaf sections.
- It preserves student manual edits.
- It supports actions such as expand, shorten, improve academic style, continue writing, rewrite selection, regenerate selection, and translate.
- It stores chapter content as HTML, Markdown, and LaTeX.
- It can generate a complete final report from the available leaf chapters.

## 12. Presentation, Pitch, And Jury Simulation

Presentation service:

```text
src/services/presentationService.js
src/services/presentationPromptBuilder.js
```

Pitch service:

```text
src/services/pitchService.js
src/services/pitchPromptBuilder.js
```

Jury simulation:

```text
src/services/jurySimulationService.js
src/services/geminiJurySimulationService.js
src/services/jurySimulationPromptBuilder.js
```

The presentation feature generates defense slides from project context and report structure. The pitch feature generates spoken content for the defense. Jury simulation accepts an uploaded audio file and evaluates the student's defense delivery and content using Gemini.

## 13. Notifications

Notification files:

```text
src/models/Notification.js
src/controllers/notificationController.js
src/services/notificationService.js
src/routes/notificationRoutes.js
```

The backend supports:

- Loading recent notifications.
- Marking notifications as read.
- Server-sent events for live notification updates.

Endpoints:

```text
GET /api/notifications
PATCH /api/notifications/read
GET /api/notifications/stream?token=<jwt>
```

## 14. Admin APIs

Admin files:

```text
src/controllers/adminController.js
src/routes/adminRoutes.js
```

Admin routes are protected by both authentication and role checking.

Endpoints:

```text
GET /api/admin/dashboard
GET /api/admin/users
GET /api/admin/projects
```

The dashboard returns:

- User totals.
- Student/admin counts.
- Project counts.
- Completed onboarding count.
- User growth.
- Project growth.
- Domain, methodology, and complexity distributions.
- Recent users.
- Recent projects.

## 15. Relationship With The Other Repositories

### Frontend

The frontend calls this backend through HTTP. It uses the JWT returned by the backend to access protected project, AI, notification, and admin APIs.

### RAG Ingestion

The RAG ingestion repository is not a running service. It is an offline data-preparation project.

It fills MongoDB with PFE report examples. This backend reads those examples at runtime when generating or refining report structures.

The backend and RAG ingestion project must point to the same MongoDB database for RAG to work.

## 16. Practical Development Notes

- Start MongoDB before starting the backend.
- Start the backend before using the frontend workspace.
- Make sure `FRONTEND_URL` includes the frontend dev URL to avoid CORS errors.
- Make sure `OPENROUTER_API_KEY` exists before testing AI text features.
- Make sure the RAG ingestion virtual environment exists if the backend must generate query embeddings using the default local Python path.
- If RAG is not configured, report structure generation still works through the normal AI prompt.

