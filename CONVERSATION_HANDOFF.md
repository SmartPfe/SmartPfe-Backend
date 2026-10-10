# SmartPFE conversation handoff

Prepared 2026-10-10 for continuing work on another PC. This is a durable summary
of the conversation and implemented work, not a verbatim chat transcript.
The same document is committed to the frontend and backend repositories.

## Current outcome

The staged English/French interface migration is complete through Stage 9.
Frontend implementation checkpoint: `e87b204`. Backend implementation checkpoint:
`f514853`. No remaining translation stage is awaiting implementation.

The app can show its menus, controls and known system messages in French while
the project and generated report remain in English, French or Arabic. Interface
switching uses shipped dictionaries; it does not invoke an LLM.

## Repositories and original workspace

- Frontend: https://github.com/SmartPfe/SmartPfe-Front
- Backend: https://github.com/SmartPfe/SmartPfe-Backend
- Configured frontend push mirror: https://github.com/ahmedneffati/PFEGuidanceFront
- Configured backend push mirror: https://github.com/ahmedneffati/PFEGuidanceBack
- Application parent on the original PC: `C:\Users\hamma\Documents\Github\SmartPFE`.
- Child checkouts: `SmartPfe-Front`, `SmartPfe-Backend`, and `RAG-ingestion`.
- Chat reports/screenshots: `C:\Users\hamma\Documents\ChatGPT\SmartPFE`.
  This is an artifact folder, not the application checkout.
- Work was done on each existing repository's `main` branch with local stage
  commits. This handoff accompanies the user's request to push those commits.
  No application deployment was requested.

## User requirements and working preferences

1. Translate static interface text and display labels. Preserve business logic,
   permissions, routes, conditions, filters, enum values, calculations, credit
   quantities/prices, request bodies and existing content-generation behavior.
2. `uiLanguage` is an independent personal preference: `en` or `fr`.
   Existing project generation language, including `basics.language`, keeps its
   English/French/Arabic meaning. Never rename or repurpose it as UI language.
3. UI switching must not translate or overwrite project content, change prompts,
   retrieval/speech/export language, spend credits, start/restart generation,
   discard unsaved edits, interrupt streaming or reset a session.
4. Use concise, natural French. Avoid literal English translations, redundant
   explanations and long button labels. Retain information needed for financial
   confirmations and other consequential actions.
5. Work in stages and commit each completed stage as a recovery checkpoint.
   The user experienced quota interruptions and requested clean resume notes.
6. Root supervises bounded GPT-6 Luna agents at high effort, supplies the overall
   goal/file allowlists, reviews actual diffs and authorizes follow-up work.
   Agents must not expand scope, commit, deploy or delegate independently.
   The user specifically requested direct root work for language-control design.
7. Query Graphify first for navigation, then inspect actual source. Keep indexing
   code-only; no semantic extraction, background watchers or hooks were added.

## Work history and checkpoints

| Stage | Work completed | Frontend | Backend |
| --- | --- | --- | --- |
| 1 / initial planning | Graphify setup, translation inventory and staged plan | No separate checkpoint recorded | — |
| 2 | Shared EN/FR engine, independent preference, language controls and design refinement | `200539f` | `81dde26` |
| 3 | Workspace/admin shell, navigation, search, shared controls, wallet and AI status UI | `a827926` | — |
| 4 | Landing, auth, account, onboarding and project settings | `edcfcb3` | — |
| 5 | Overview, problem, actors, solutions, requirements, backlog and UML | `336e7e2` | — |
| 6 | Report structure/builder, presentation, speech and jury/Q&A interfaces | `3a96a54` | — |
| 7 | Credit history and administration | `78f6155` | — |
| 8 | Backend message metadata, live notifications and recipient-language emails | `5a31a0e` | `f514853` |
| 9 | Final completeness audit, concise French, plurals, formatting and responsive/accessibility fixes | `e87b204` | — |

After a quota interruption, Stage 7 was found fully committed and clean. Its
48 frontend checks and TypeScript were rerun before Stage 8 began. The app was
restarted after a PC restart. Stages 8 and 9 completed and were committed.

## Translation foundation

- Frontend: React/TypeScript/Vite, `i18next` and `react-i18next`.
- `src/lib/i18n.ts` registers English/French resources and English fallback.
- `src/context/InterfaceLanguageContext.tsx` manages account/device preference,
  session changes, cross-tab synchronization, optimistic updates and rollback.
- Backend `User.uiLanguage` defaults to English and accepts only `en`/`fr`.
  Protected `GET/PUT /auth/preferences` support email and Google accounts.
  Saving UI language updates only that preference and does not produce a
  misleading profile/password notification.
- `src/components/LanguageSelector.tsx` provides styled English/Français choices.
  The user rejected the original home placement/default list styling and settings
  card; these were refined before later page stages.
- Dictionaries live at `src/locales/en/*.json` and `src/locales/fr/*.json`.
  The 19 namespaces are common, settings, controls, shell, auth, onboarding,
  landing, design, planning, analysis, outline, report, delivery, jury,
  creditHistory, adminCredits, adminManagement, notifications and server.
- Translate complete messages with interpolation. Keep both languages' keys and
  placeholders aligned. Display maps translate enums while retaining their
  original stored/comparison/request values.
- Do not put translation dependencies into effects that start generation,
  autosave or content synchronization.

## Stage 8 boundaries worth understanding before future edits

### API messages

Backend `src/lib/interfaceMessages.js` attaches explicit `messageKey` and
`messageParams` to known static responses/errors. Original message, code, HTTP
status and data remain intact. Known AI validation errors carry metadata, and
report SSE progress/error events retain original text/chunks with additive keys.
Unknown provider/exception text stays raw.

Frontend `src/lib/apiMessage.ts` keeps a display descriptor and resolves it at
render time, so loaded errors change language without another request. Only known
server-namespace keys and primitive parameters are accepted; namespace escapes and
i18next option fields are rejected.

**Never localize `Error.message` inside `fetchApi`.** Existing business code compares
the original English message (for example project-not-found and concurrency-limit
checks). `src/lib/api.ts` preserves raw messages and adds a validated
`X-UI-Language` header without changing content/generation bodies.

`AiGenerationContext` retains its original raw error field and optional display
metadata; task runner/autosave dependencies are preserved.

### Notifications

Notification records optionally carry `titleKey`, `messageKey`, `messageParams`
alongside original titles/bodies/type/link. `src/lib/notificationDisplay.ts`
localizes history and SSE toasts during render, without reconnecting, refetching
or changing read state.

New project, settings, profile/password, registration and credit events use
explicit keys. Legacy `generation_complete` notifications translate only when
their canonical feature is recognized. Untyped legacy records and unknown keys
retain original text; no broad string matching or backfill was performed.
User names, project titles, administrator notes and cancellation reasons stay raw.

### Emails

Backend `src/services/emailLocale.js` supplies EN/FR copy; email service locale
parameters preserve SMTP behavior, recipients, reset URLs/tokens, verification
codes, prices, credit amounts/currency, receipts and idempotency.

Saved recipient `uiLanguage` wins. Pre-account flows use a validated header
fallback; new email/Google accounts initialize only the UI preference from it.
Credit acknowledgments follow the student's preference. The configured admin
inbox retains its existing address/precedence; a matching admin account supplies
its UI preference, with English fallback for missing/failed lookup.
User-written contact subjects/messages remain original.

## Stage 9 French and appearance corrections

- Save actions use **Enregistrer**, **Enregistré**, **Non enregistré** instead
  of repetitive full sentences. Shared save controls wrap on narrow screens.
- Natural, shorter wording across all 19 namespaces, including descriptions,
  progress/errors, onboarding guidance, credit messages and administration.
- Missing credit-history detail labels were added in both languages.
- Singular/plural forms cover slides, words, students/projects and action counts.
  Multi-counter report summaries use neutral labels.
- Presentation decimals, report word totals and jury-history dates follow UI
  locale for display; their underlying numbers/dates remain unchanged.
- Help tooltips now support keyboard focus, Escape/blur/scroll/resize dismissal,
  viewport bounds and height limits with scrolling for long explanations.
- Financial copy retains exact purchased-credit amounts and the distinct
  payment-confirmation and wallet-crediting steps.

## Verification and known exceptions

Last full validation on 2026-10-08:

- **64 frontend tests + 29 backend tests passed** (93 total).
- TypeScript (`npm run lint`), production build and whitespace checks passed.
- The existing large production-bundle warning remains; no bundling redesign was
  included in translation work.
- Six combinations: EN/FR UI × English/French/Arabic content. The actual Actors
  hook was exercised with a mocked generation API, switching before and during
  generation. Only UI preference writes occurred; storage/data/body stayed
  unchanged and the active task did not restart or abort.
- Existing tests cover unsaved rich text/documents, canonical options/filters,
  credit policies/forms, login errors, notifications and microphone recording.
- 25 isolated page previews × both UI languages × both themes × phone/desktop
  widths = **200 layout measurements**, with no page-width overflow or clipped
  button labels. Representative screenshots were inspected. This does not cover
  every possible modal or arbitrarily long user-content scenario.
- No real generation, translation, email, project/account mutation or credit
  transaction was performed for QA. Later workflow/admin screens used fixtures
  rather than modifying the user's data or permissions.

Intentional exceptions: user/generated text, UML text, brands/technical names,
canonical identifiers, unknown provider errors and untyped legacy notifications
remain original. Admin CSV export keeps its English contract. Document/speech
exports and insertion templates follow content-language semantics. Unreachable
legacy pages are not translation targets. Presentation/Pitch route wrappers
re-export their localized directory pages; App imports ReportBuilder `/index`.

## Graphify: where it sits and how to reuse it

The original code-only graph is outside the child repositories:
`C:\Users\hamma\Documents\Github\SmartPFE\graphify-out\graph.json`.
Sibling files are `graph.html`, `GRAPH_REPORT.md`, `.vocab.txt` and health/cache
data. The workspace helper is `graphify-code.ps1` with `.graphify/finalize.py`.
The installed Graphify version used here is `graphifyy` **0.9.79** in an isolated
Python environment; the Codex skill is under `.codex/skills/graphify/SKILL.md`.

Final code-only refresh: 2,392 nodes, 6,071 simple-view connections, 94 communities.
No model/API calls are made by this extraction/refresh. Agent reasoning still
uses tokens; no project-specific savings percentage was measured. The graph is
a navigation aid, not runtime proof. Dynamic behavior and some syntax require
direct source search. Verify every relevant graph result against source.

Use scoped queries (usually a 1,000–1,500 token budget), inspect returned files,
and refresh after relevant source edits/pulls/branch switches. No semantic
indexing, Git hook, watcher or agent API service was installed.

Portable helper templates and setup instructions are committed in the frontend:
https://github.com/SmartPfe/SmartPfe-Front/tree/main/docs/conversation-context/graphify-setup
Rebuild the graph from the other PC's checkouts. The generated graph/cache and
machine-specific interpreter markers are deliberately not copied into Git: the
old snapshot includes references to local, uncommitted RAG experiment files.

## Continuing on another PC

Clone or pull both repositories and read this file first. Use existing checkouts
when they already exist. Repository environment values are configured separately
using `.env.example`; `.env`, tokens and credentials are not part of this handoff.

Frontend, in its own checkout:

```powershell
npm ci
npm run dev -- --host 127.0.0.1
# http://127.0.0.1:3000
npm run test:i18n
npm run lint
npm run build
```

Backend, in its own checkout after configuring its existing environment:

```powershell
npm ci
npm start
# http://127.0.0.1:5000/api/health
npm test
```

Original PC process IDs, terminal sessions and browser tabs are not portable.
Running processes must be started again on the other PC.

The original backend has unrelated uncommitted `reportStudioRagService.js` work
and `rag-evaluation` scripts/results/reports predating translation. They were
explicitly preserved and excluded from translation commits and this push.
They will not appear on another PC simply by pulling these commits; do not reset
or assume they are part of the reviewed translation implementation.

## Companion records

- Full plan and stage completion history: `docs/conversation-context/interface-translation-plan.md`.
  Earlier historical "pending" statements are superseded by the final Stage 9 record.
- Final audit: frontend `docs/interface-language-audit.md`; a copy is included in
  both repos at `docs/conversation-context/interface-language-audit.md`.
- Original chat-only `runtime-logs/stage9-*` hold preview source, layout results,
  test/build logs, screenshots and resume notes. Their findings are captured here;
  no temporary QA HTML ships with the application.

Suggested first message to a new agent: "Read CONVERSATION_HANDOFF.md and the
final interface-language audit. Stages 2–9 are complete. Preserve the independent
UI/content-language boundary and existing business logic. Query the code-only
Graphify index before source exploration; verify actual source. Do not restart
translation work or mix in unrelated RAG experiments."
