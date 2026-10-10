# SmartPFE English/French interface plan

Status: Stages 2 through 9 implemented and verified on 2026-10-08 after explicit
user authorization. The planned interface translation migration is complete.
Prepared 2026-10-07 from the current route tree, shared components, Graphify map,
generation-language handling, and backend message/email surfaces.

## Non-negotiable separation

- User clarification: this is a static-interface-text migration. Existing business
  logic, conditions, calculations, permissions, routes, requests, generation
  behavior and data structures are preserved. The new UI preference/translation
  wiring is the only planned functional addition. Any unrelated fix or broader
  backend/API redesign needs its own separately discussed scope.
- `uiLanguage` is a new personal interface preference (`en` or `fr`).
- The existing project generation language, including `basics.language`, retains
  its current meaning and behavior. Do not rename or repurpose it.
- UI language may translate the label and displayed options of the existing
  generation-language selector, but must preserve its stored values.
- Switching UI language must not change project data, generated content,
  generation/translation request payloads, prompts, retrieval language, speech
  language, export content language, or language-mismatch logic.
- Switching UI language must not start generation, translate documents, spend
  credits, discard unsaved edits, interrupt streaming, or reset a session.
- Translate visible enum/status labels while keeping stored enum values, route
  paths, identifiers, technical names, and API contracts stable.
- Personal language preferences work for email and Google accounts and are
  separate from profile/password restrictions. User preference changes must not
  create a misleading "profile updated" notification for password/name edits.

## What the foundation means

One shared translation engine connects three things: English/French dictionaries,
the selected UI language, and React components that request text by stable key.
For example `t('common.saveChanges')` returns "Save changes" or "Enregistrer".
Use i18next/react-i18next; configure English fallback, interpolation, plural
handling, feature namespaces, and development checks for missing keys.
Translation files ship with the app. UI switching does not call an LLM.
Components keep their existing layout and behavior; their text lookups change.

## Stage 2 completion record

- Added i18next/react-i18next with local EN/FR common and settings dictionaries,
  English fallback, development missing-key warnings and locale-format helpers.
- Added independent interface-language provider and selector on workspace/admin
  settings and public/auth screens. Workspace settings is the first fully
  migrated screen; account forms, navigation and other screens await their stages.
- Added User.uiLanguage and protected GET/PUT `/auth/preferences`, including
  Google-account support and no profile/password notification side effects.
- Preference persists on account/device; newer choices and account transitions
  reject stale responses; same-account tabs synchronize; failed saves roll back.
- Supervisor reviewed agent diffs and an independent agent review; corrected
  cross-tab sync and storage-failure handling before completion.
- Checks passed: frontend TypeScript and production build, 7 frontend preference
  regressions, and all 15 backend tests (including 4 preference tests).
- Live browser check: French settings with unchanged English generation
  language; preference survived reload. Original English preference restored
  after the check. Existing project content and app business logic were preserved.
- Graphify refreshed. Local checkpoints are listed below; dev preview remains running.

## Git checkpoints

- Stage 2 frontend: `200539f` — independent UI language foundation, preference controls and refined styling.
- Stage 2 backend: `81dde26` — protected preference endpoints and user schema.
- Stage 3 frontend: `a827926` — shared workspace/admin navigation and controls in EN/FR.
- Stage 4 frontend: `edcfcb3` — landing, authentication, account, onboarding and project settings in EN/FR.
- Stage 5 frontend: `336e7e2` — analysis and planning pages, editor and UML controls in EN/FR.
- Stage 6 frontend: `3a96a54` — report, presentation, pitch and jury interfaces in EN/FR.
- Stage 7 frontend: `78f6155` — credit history and administration in EN/FR.
- Stage 8 frontend/backend: `5a31a0e` / `f514853` — system messages, live notifications and recipient-language emails.
- Stage 9 frontend: `e87b204` — concise French UX, completeness fixes and final regression audit.
- Future completed stages receive local commits after supervisor review and validation.
- Backend RAG evaluation work predating this translation task is excluded from these commits.

## Stage 3 completion record

Completed 2026-10-07 after supervisor review and Luna cross-review. Workspace/admin navigation, breadcrumbs, profile language controls, search (including French aliases), history demo copy, notification controls, shared save controls, credit wallet/badges/request dialog and AI toolbar/banner/dock defaults now translate. Canonical paths, workflow statuses, credit request bodies, calculations, generation inputs and user/project content are unchanged.

Validation: TypeScript, production build, eight frontend isolation/dictionary checks and 15 backend tests passed. Browser checks covered desktop/mobile profile controls, French and English search terms, preserved workflow locks, revision drawer, credit wallet and notification controls. Live project generation language remains English while UI is French. Graphify refreshed.

Remaining scope: caller-provided page labels, module names and custom progress strings are translated alongside their owning pages in stages 4–7. Persisted notification bodies and arbitrary backend messages remain unchanged until stage 8. No AI content was generated for UI validation. Checkpoints are local commits, not pushed.

## Staged work

Each stage is implemented and reviewed separately when the user requests it.
During intermediate stages, untranslated areas continue to use English; full
French coverage is claimed only after the final audit.

### 1. Inventory and isolation baseline

Create a tracked coverage checklist for every live route and its reachable
components, layouts, hooks, constants, backend messages, and email templates.
Distinguish active pages from legacy wrappers/unreachable code. Identify the
existing generation-language dependencies and record baseline behavior for all
four UI/generation language combinations. Agree French terminology and tone.
Check user-visible strings in handlers and configuration arrays, not just JSX.

Completion: each surface has a stage owner; isolation checks are specified.

### 2. Foundation and personal preference

Configure the translation engine, en/fr dictionaries, fallback, and typed keys
where practical. Define explicit preference precedence: saved account preference
when signed in; explicit device preference before sign-in; English fallback.
Existing users retain English until they choose otherwise. Protect against a
stale account response overriding a newer choice and against account-to-account
preference leakage. Save the preference independently of project context and
support Google users. Add "Interface language / Langue de l’interface" in
workspace settings accessed through the profile dropdown; provide an accessible
pre-login selector on public/auth layouts. Switching is immediate and remembered.
Set the document language and centralize locale-aware date/number/plural helpers.

Completion: switching, refresh, login/logout, account switching and cross-device
account persistence work; generation settings and project content are untouched.

### 3. Shared application shell

Translate workspace and admin navigation, topbar, breadcrumbs, profile menu,
search palette, revision-history drawer, notification controls, settings shell,
theme controls, shared tooltips, dialog controls, save/sync states, credit badges
and wallet/dialog labels. Translate shared AI toolbar/dock/banner controls and
generation/streaming progress text. Include aria labels, titles, placeholders,
empty states, loading text and fallback labels. Keep data shown in drawers intact.

Completion: shared controls update immediately and fit both desktop and mobile.

### 4. Landing, authentication, account and onboarding

Translate landing navigation, marketing copy, feature cards, pricing/credit copy,
FAQ and contact form text; all implemented footer/help text. Translate login,
signup, Google-login wrapper, email verification, forgot/reset password, access
denied/session states, account/security settings, and their validation messages.
Translate onboarding Project Basics, Project Description, Technical Context,
Summary Review and layouts, plus the project-settings version of onboarding.
Translate option labels and helper text without changing stored selections or
user-entered project text. Make interface versus generation language explicit.

Completion: the public-to-workspace journey works entirely in either UI language.

### 5. Analysis and planning workspace

Translate Overview, Problem Statement, Actors, Existing Solutions, Functional
Requirements, Non-Functional Requirements, Product Backlog and UML Preparation.
Include editors/toolbars, suggestion panels, tabs, cards, table headings, filters,
search, sorting, priority/status labels, validation, confirmations, empty/error
states, copy/save/download feedback and generation-language warnings/controls.
Diagram editing controls follow UI language; actual UML content stays governed
by the existing project/content language behavior.

Completion: each listed feature is reviewed independently; no stored values or
generated/user-authored content change when switching UI language.

### 6. Report, presentation and defense workspace

Translate Report Structure, Report Builder, Presentation, Pitch, Jury Simulation
and the embedded Jury Q&A session. Cover document/editor controls, structural
navigation, prompts shown as interface instructions, templates/descriptions,
progress/streaming, suggestion comparisons, history, recording/playback controls,
permissions guidance and feedback, export/copy/download dialogs and messages.
Existing chapter/slide names, report text, speeches, questions, answers and
diagram text remain content. Speech/transcription and exported document scaffolds
continue following their existing content-language semantics, never uiLanguage.

Completion: all feature controls translate without changing current documents,
active sessions, editor state or generation behavior.

### 7. Credit management and administration

Translate user Credit History and any remaining purchasing/request flows;
admin Dashboard, Users, Projects, Credits, Credit Requests and Admin Settings,
including layouts, forms, tables, filters, pagination, roles/status display labels,
confirmation dialogs, statistics, help text and validation. Amount formatting may
follow UI locale but actual credit quantities/prices and stored states are stable.

Completion: student and admin workflows have complete interface coverage.

### 8. Backend-originated messages and transactional emails

Add stable codes/keys plus interpolation parameters for API validation, errors,
success messages and system notifications. Render these using the UI preference;
never translate arbitrary user/server text with broad string replacement.
Handle real-time notifications as well as fetched history. For legacy stored
notifications, use reliable event metadata/types to map recognized templates;
preserve original text for unknown records. Test compatibility during rollout.
Translate verification, password-reset, credit-request acknowledgement and
credit-ready emails using the recipient's UI preference. Explicitly handle
admin-facing request emails by recipient preference/default. User-written contact
subjects/messages remain intact. Pre-account reset/verification flows use a
validated UI locale with English fallback and must preserve anti-enumeration behavior.

Completion: common failures and system communications no longer leak the wrong
interface language; old records and arbitrary content remain safe and readable.

### 9. Final completeness and regression review

Audit every live route and shared component for remaining visible literal text;
classify legitimate technical/user-content exceptions. Check dictionary key
parity, missing-key fallback, interpolation, plural forms, dates/numbers/relative
time, accessibility and all failure/loading/success states. Review French quality,
consistency, long labels, accents, mobile layouts and both themes. Ensure unsaved
edits and ongoing generation survive language switches.

Verify all four combinations: EN UI/EN generation, EN UI/FR generation,
FR UI/EN generation, FR UI/FR generation. Compare generation request payloads and
project/content data before/after UI switching; confirm zero generation calls
and zero credit use caused by a UI switch. Validate a representative fresh
generation still follows the existing generation setting. Complete build and
appropriate automated/manual regression checks; refresh Graphify after edits.

Completion: every coverage checklist item passes or has a documented exception;
both language preferences remain independent. No deployment is part of this plan.

## Rules throughout implementation

- Supervisor owns translation foundation and integration boundaries; focused
  GPT-6 Luna agents at high effort may own disjoint page families and namespace
  files. A separate review checks diffs and isolation. Start with small batches,
  never parallel edits to shared files, and never implement all stages at once.
- Every agent receives the overall goal, language-separation rules, current stage,
  an explicit file allowlist and a definition of done. Agents may act only inside
  that assignment; they cannot expand scope, delegate, deploy or start the next
  task without supervisor approval. They report modified files, validation,
  uncertainties and any suspected behavior change, then stop. The supervisor
  reviews the actual diff, checks behavior boundaries, requests corrections and
  assigns the next task. User permission is for stage scope, not every routine
  edit inside an already authorized stage.
- Review every diff for behavior changes: no translated string may replace a
  stored enum, comparison operand, route, query parameter or request value.
- Do not insert translation dependencies into effects that trigger generation,
  autosave or content synchronization. Check editor state and derived/memoized
  UI labels refresh without restarting those effects.
- Translate complete sentences with variables, rather than concatenating translated fragments.
- Keep English and French keys aligned and organize dictionaries by feature.
- Add newly discovered user-facing surfaces to the coverage checklist immediately.
- Check source behind graph results; Graphify is an aid for locating code.
- Finish and report one requested stage before moving into the next.

## Read-only agent audit additions (2026-10-07)

- Make the coverage checklist route-based from `src/App.tsx`, including live
  workspace/admin wildcard fallbacks. Verify import references before treating
  sibling page wrappers as legacy; Presentation and Pitch wrappers are reachable.
- Stage 3 owns `WORKSPACE_PHASES` labels/tooltips from `src/lib/constants.ts`;
  its paths and IDs are immutable for this migration.
- Explicit display-only maps are needed for requirement priorities/statuses,
  backlog priorities, admin request status/filter labels, user roles, project
  statuses, credit-history kinds/actions and detail labels. Direct status
  `.toLowerCase()` rendering needs review, not a stored-value change.
- Onboarding option dictionaries must preserve underlying development-type,
  methodology and complexity values. Product/technology names remain technical
  labels where appropriate.
- Include ProtectedRoute messages, PlantUmlRenderer download title, mobile menu
  and password-visibility accessibility labels, OTP fill tooltips, and static
  Landing demo-chat text in the coverage checklist.
- Page owners include strings in hooks/event handlers and configuration arrays,
  not merely page JSX. Backend/system-text work remains separately bounded;
  arbitrary server or user-authored strings are never blindly translated.
- Isolation audit: existing generation-language choices include English, French
  and Arabic. Preserve all three content choices despite adding only EN/FR UI;
  extend regression checks with Arabic project content.
- `FormControls.tsx` currently uses visible strings as some option values and
  `OptionCards` compares/persists `option.label`. Split display labels from the
  same canonical values explicitly; do not translate the stored/comparison values.
- Protect report chapter language metadata, project-derived Pitch/Presentation
  targets, all existing generation/translation payloads and language-mismatch
  checks. UI locale is never a substitute for these fields.
- Pitch PDF includes app-provided headings alongside actual slide speech. Define
  headings as export scaffold using the existing content language, while keeping
  speech verbatim; export dialogs remain interface-language UI.
- Locale-only persistence may make a preference API call, but must make no
  generation/translation calls or credit-consuming requests. The separation
  test excludes the explicitly intended preference save from its no-request rule.

## Stage 4 completion record

Completed 2026-10-07, local frontend checkpoint `edcfcb3`, after supervisor diff review and Luna cross-review. Landing marketing/demo/pricing/FAQ/contact/footer copy, auth layouts and all five auth pages, Google wrapper, account/security settings, four onboarding steps, reusable onboarding controls and project settings now use EN/FR dictionaries. ProtectedRoute has no text surface; existing redirects remain unchanged.

Onboarding controls separate translated display labels from canonical saved values. Report/content language values remain exactly English, French and Arabic. Known enum labels translate only for display; custom strings, technology names, project content, authentication requests and project/generation payloads retain their existing behavior. Local validation/fallback messages resolve in the current UI language; arbitrary server messages remain verbatim for stage 8.

Validation: TypeScript, production build and all 12 regression tests passed. Tests cover dictionary/interpolation parity (including nested landing arrays), actual canonical onboarding selections, Google display re-render without auth reinitialization, initial Google SDK preference precedence, and live signup validation without auth requests, alongside preference isolation/race tests. Live browser checks covered landing, login/signup, verification, forgot/reset layouts (no submission), account, all four onboarding steps and project settings. French UI preserved existing English content/report language. Backend health is 200; no account was created, password changed, project saved or AI content generated for these checks. Existing unrelated backend RAG work was excluded. Graphify refreshed to 2,171 nodes / 5,335 connections / 104 communities without model calls.

Google SDK uses the documented initial client-script hl and renderButton locale. Fresh French loads display French. Live locale changes send the correct iframe hl without reinitializing authentication, but local Google iframe validation reports "The given origin is not allowed for the given client ID." Under this existing localhost OAuth restriction, the outer fallback label can retain the initial SDK language until page reload. Production Google sign-in and live iframe localization need verification on an OAuth-authorized origin; no OAuth configuration or auth flow was changed.

The production build still reports the existing large-bundle warning. This checkpoint is local, not pushed or deployed. Stage 5 remains pending user authorization.

## Stage 5 completion record

Completed 2026-10-07; frontend local checkpoint `336e7e2` after resumed implementation, supervisor review and independent Luna cross-reviews. Translated Overview, Problem Statement, Actors, Existing Solutions, Functional Requirements, Non-Functional Requirements, Product Backlog and UML Preparation, including their reachable local editor/table controls, options, tooltips, placeholders, accessible labels, empty states, local validation/fallback messages and progress. Three feature namespaces (analysis/design/planning) cover both English and French. Shared PlantUML render/download controls translate without changing diagram markup or file names.

Display labels preserve canonical actor types/icons, requirement priorities/statuses, UML relationship types, filtering values and all stored/generation language values. Custom module/category/epic labels, user/generated content, saved seed defaults, payloads and original autosave/generation effect dependencies remain unchanged. Error keys distinguish local fallback/validation from arbitrary server/task messages, which stay raw. Optional task display metadata lets the floating dock refresh titles and interpolated language/diagram names without restarting, aborting or changing a running task. Rich-text placeholder decorations update without recreating the editor or changing the document/history.

Supervisor review corrected hidden keyed errors in Actors/Existing Solutions, live language-key normalization, actor icon display labels and a dictionary interpolation mismatch. TypeScript, production build, whitespace check and all 24 tests passed (19 top-level checks plus five page subtests). New coverage includes actual rich-text document/placeholder preservation with no edit callback on locale switch, a running task with one unchanged runner, a loaded Actors hook with zero new save/generation requests, actual requirement option callbacks retaining canonical values, five actual page components switching locale with mocked GET responses and no new requests, and visible local Actors validation.

Live browser checks covered translated Overview, Problem Statement and Actors; switching EN/FR retained existing English editor content, roadmap progress (8%, 1/12) and credits (20). Existing workflow guards correctly redirected attempts to open later locked pages; their planning components were verified using mocked data, without changing user content to unlock them. No AI generation/translation was invoked for verification. Browser-only page mount behavior remains the pre-existing behavior. The preview remains running at http://127.0.0.1:3000; backend health was verified and backend/RAG work was excluded from this frontend checkpoint.

Graphify refreshed code-only: 2,199 nodes, 5,389 connections and 95 communities; no model calls. Existing large production-bundle warning remains. Screenshot: runtime-logs/stage5-french-overview.png. Checkpoint is local, not pushed/deployed. Stage 6 (report, presentation and defense interface) remains pending authorization. Arbitrary backend messages and email surfaces remain stage 8, and final comprehensive locale/content combinations remain stage 9.

## Stage 6 completion record

Completed 2026-10-07; frontend local checkpoint `3a96a54`, after supervisor implementation/review and independent Luna cross-reviews. Report Structure, Report Builder, Presentation, Pitch, Jury Simulation and embedded Jury Q&A now use EN/FR static interface copy. New outline/report/delivery/jury namespaces include controls, toolbars, accessible labels, tooltips, placeholders, counts/status/detail/readiness display labels, streaming/progress, local validation/fallback errors, and supported recording/permission messages. Canonical AI action IDs (including Regenerate Selection), pinned-tool storage values, report detail levels, statuses, durations, readiness enums and voice/generation targets are preserved. Arbitrary API messages and generated/user-authored chapter titles, HTML/Markdown/LaTeX, slide text, speeches, questions, answers, evaluation feedback and tips stay raw.

The planned Pitch PDF scaffold uses a pure EN/FR/AR content-language mapping: document headings follow the project generation language, per-slide headings follow slide.language when set, unknown languages fall back to English. Existing speech/tips/titles remain verbatim; the export UI/iframe title uses interface language. PDF static empty-title labels and duration units also follow content language. Export layout/print flow is preserved. No interface preference enters generation, transcription, document-save or export-content language selection.

All 38 checks passed, alongside TypeScript, production build and whitespace checks. Added tests cover actual Stage 6 page components changing locale with no new requests; loaded report paragraphs/editor nodes, slide values, notes and speech preserved across switches; nested outline titles retained with all English/French/Arabic generation choices; content-language-only Pitch export copy; and a mocked active Jury Q&A microphone recording that keeps its stream/question/recorder running during locale switching without session requests. Independent review confirmed existing effect/callback/autosave dependencies, API payloads and media lifecycle unchanged. Review corrections included a complete action display map, finite readiness display labels, and export content-language fallback/minute labels.

The existing live project still locks later workflow pages. Visual QA used the actual Report Builder component with isolated mock data and GET-only fixture responses, showing French controls around English content without changing the real project. Temporary stage6-qa.html was removed from the frontend before checkpoint; its source is saved in runtime-logs/stage6-qa-preview.html for reproducibility (copy into frontend root only for a future local test). Screenshot: runtime-logs/stage6-french-report-preview.png. No actual AI generation, recording, password/account edit or user document edit was performed for verification; microphone lifecycle was simulated in automated tests. Live app remains running at http://127.0.0.1:3000 and backend health is 200.

Graphify refreshed code-only to 2,225 nodes / 5,422 connections / 91 communities, without model calls. Existing production-bundle warning remains. Frontend working tree is clean; backend/RAG changes were excluded. Checkpoint is local, not pushed/deployed. Stage 7 (credit management and administration) is pending user authorization; arbitrary backend-originated messages and emails remain stage 8, with final comprehensive audit in stage 9.


## Stage 7 completion record

Completed 2026-10-07; local frontend checkpoint `78f6155` after supervised Luna implementation and cross-review. Credit History and admin Dashboard, Users, Projects, Credits, Credit Requests and Settings now use EN/FR interface dictionaries. Includes forms, tables, filters, status/role/action/policy/group labels, confirmation dialogs, drawers, chart tooltips, accessible labels, local validation/fallback messages, dates and displayed amounts. Known canonical option values translate only for display; unknown/custom labels, server errors, administrator notes, reasons, package labels and project/user content stay raw. Verified backend growth-chart month abbreviations use a finite display mapping; credit dates use ISO keys without changing grouping. CSV export retains its existing content.

Amounts, prices, wallet calculations, statuses, filters, roles, enforcement modes, timezone option values, permissions, API payloads and mutation/effect behavior remain unchanged. Locale changes preserve unsaved policy selection. UI language remains separate from English/French/Arabic generation language and generated documents.

All 48 regression checks, TypeScript, production build and whitespace check passed. Added actual page locale-switch tests with no extra requests, canonical credit filter query checks, raw request note/package/amount/currency preservation, and unsaved timezone selection preservation without writes. Supervisor corrections covered specific transaction action labels, keyed error state, chart/helper labels and locale formatting. Existing production bundle warning remains.

Live read-only credit history verified French labels/dates and the unchanged 20-credit wallet. Admin visual verification used isolated mock data with writes disabled; no real deposits, request actions, permission changes or project edits were performed. Screenshots: runtime-logs/stage7-french-credit-history.png and stage7-french-admin-preview.png. Temporary frontend QA file removed; its source saved at runtime-logs/stage7-qa-preview.html. App remains running at http://127.0.0.1:3000 and backend health is 200. Graphify refreshed code-only to 2,235 nodes / 5,449 connections / 91 communities without model calls. Frontend working tree clean; unrelated backend/RAG work excluded. Checkpoint local, not pushed or deployed. Stage 8 (backend/system messages and emails) awaits authorization.


## Recovery and Stage 8 completion record

On 2026-10-08, confirmed Stage 7 had completed before the quota interruption: frontend checkpoint `78f6155` existed, working tree was clean, and the 48 frontend regression checks plus TypeScript passed again. No incomplete Stage 7 source writes were present. Restarted frontend/backend after the PC restart and opened the live app beside the chat. Existing project still has French interface, English generation language, 20 credits and 8% progress (1/12).

Stage 8 completed 2026-10-08 after supervised Luna implementation and independent cross-reviews. Local checkpoints: frontend `5a31a0e`, backend `f514853`. Added explicit server message keys/parameters alongside unchanged original API messages/codes/statuses and response data for known auth, profile, project, contact, admin, notification, credit and AI validation/fallback responses. Known generation-service validation errors carry metadata on Error instances; report SSE status/error events also retain original fields plus metadata. Unknown provider/server text remains raw. The frontend API boundary retains original message text for existing comparisons and business consumers; interface components keep descriptors and resolve translations during render. Background tasks retain their original error field and add optional display metadata without runner/effect dependency changes. Auth, profile, contact, credits/admin, planning/analysis, reports/delivery and jury displays update known errors with the UI language.

System notification model/creation adds optional titleKey/messageKey/messageParams. Fetched history and SSE toasts render keys live without refetch/reconnect or read-state changes. New project/profile/password/registration/credit events carry exact template keys and raw interpolation values. Legacy generation_complete records with a known canonical feature translate using reliable event metadata. Unknown/legacy untyped records retain original text; the real account's old Project created event has no reliable event identifier and remains English. No broad text matching or notification backfill was performed. User/project names, custom notes/reasons and unknown content remain verbatim.

Reset, verification, credit-request acknowledgment, credit-ready and admin-request emails use validated recipient uiLanguage with English fallback. Existing recipient preference wins; pre-account flows can use validated X-UI-Language fallback, and newly created email/Google accounts initialize only that UI preference from the header. UI language never enters generation/project content payloads. Configured admin inbox delivery address/precedence is preserved; matching admin recipient preference is read separately and lookup failures fall back to English. SMTP transport, recipients, reset links/tokens, verification codes, credit amounts/currency, receipts, idempotency guards and development fallback return shapes remain unchanged. User-written contact subjects/messages remain intact.

Validation: 53 frontend checks and 29 backend checks passed; TypeScript, production build and whitespace checks passed. New tests cover live login error localization with one authentication request, API metadata/raw-message preservation and unchanged Arabic content/action payload, notification history and mocked SSE toast locale switching with one connection and no read mutations, email EN/FR/invalid locale and escaping/fallback behavior, recipient-specific admin/student mail, registration UI preference validation, reset anti-enumeration message compatibility and no-write validation errors. All mail delivery and account/credit mutations in tests were mocked; no real email, AI generation, deposit, password edit or project edit was performed. Cross-review corrected an unintended uiLanguage field in the credit-history user response. Existing test mocks now cover recipient preference lookups, eliminating database buffer timeouts. Existing production large-bundle warning remains.

Updated backend health is 200; live app at http://127.0.0.1:3000. Screenshot: runtime-logs/stage8-french-notifications.png (actual notification components with isolated test records). Temporary frontend QA file removed; reproducible source saved at runtime-logs/stage8-qa-preview.html. Graphify refreshed code-only to 2,391 nodes / 6,063 connections / 104 communities, without model calls. Frontend clean; backend contains only the original unrelated RAG/evaluation changes, excluded from commits. Checkpoints local, not pushed/deployed. Stage 9 final comprehensive audit awaits authorization.

## Stage 9 completion record

Completed 2026-10-08. Frontend local checkpoint `e87b204`. Supervised Luna copy passes and independent read-only review covered all active routes/shared surfaces; supervisor verified actual source, reviewed changes and closed review findings. No backend source changes were made; pre-existing backend RAG/evaluation work remains excluded.

Polished natural, concise French across all 19 namespaces. Save button is now "Enregistrer", with "Enregistré" / "Non enregistré" status badges; shared controls wrap on narrow screens. Removed redundant wording and technical implementation jargon where it did not help the user. Financial confirmations retain exact purchased-credit amounts and the separate payment-confirmation / wallet-crediting steps. Added the three missing credit-history detail labels in EN/FR, proper singular/plural count forms, neutral report counter labels, and display-only decimal/date/word-total localization. Help tooltips now have keyboard labels/focus, Escape dismissal, viewport bounds/height caps and close on page scroll/resize. Project/generation preferences, canonical enums, routes, request bodies, business logic, content and exports remain unchanged.

Validation: all 64 frontend and 29 backend checks pass (93 total), plus TypeScript, production build and whitespace checks. The existing large-bundle build warning remains. Six combinations (EN/FR interface × English/French/Arabic content) exercise the actual Actors hook with a mocked generation API, switching both before and during generation; only UI preference writes occur, project storage/data and original generation body remain unchanged, and no task is restarted or aborted. Existing regressions cover unsaved rich text/documents, financial filters/forms, recording, authentication and notifications. No real generation, translation, email, account/project mutation or credit transaction was performed for verification.

Isolated browser fixture measured 25 representative components at 390×844 and 1366×900, both languages and themes (200 cases): no page-width overflow or clipped buttons; representative screenshots inspected. This is not exhaustive coverage of every possible modal/data-length combination. Live French problem-statement page retains its original English editor text and 20 credits. Preview source saved to `runtime-logs/stage9-qa-preview.html`, then removed from frontend; layout results saved to `runtime-logs/stage9-layout-checks.json`. Screenshots: `stage9-before-save.png`, `stage9-french-save-final.png`, `stage9-french-mobile-dark.png`. Final frontend test/build logs also saved in runtime-logs.

Documented exceptions: user/generated text, technical names/identifiers and enum values remain original; unknown provider errors and legacy notifications without reliable event metadata remain raw; admin CSV export keeps its English format; editor insertion templates and document/speech export scaffolds follow content-language semantics; unreachable legacy pages are not translation targets. Workflow locks are preserved; locked/admin screens use isolated fixtures/mocks. Full route coverage and audit details are committed in frontend `docs/interface-language-audit.md`.

Frontend is clean. Checkpoint is local, not pushed/deployed. App is running at http://127.0.0.1:3000, backend health 200, main browser tab retained. Graphify refreshed code-only: 2,392 nodes / 6,071 connections / 94 communities, no model calls. No further planned translation stage remains.
