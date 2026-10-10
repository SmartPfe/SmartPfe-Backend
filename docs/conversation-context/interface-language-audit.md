# Interface translation: final audit

Completed 2026-10-08. English/French interface language remains independent of
the existing English/French/Arabic project and generation language.

## Coverage

| Surface | Review |
| --- | --- |
| Landing and shared public navigation | French copy, contact states, help, pricing, language control |
| Login, signup, verification, forgot/reset password | Labels, validation, server messages, Google wrapper, accessibility |
| Onboarding steps 1–4 and project settings | Canonical option values, guidance, summary, save states |
| Workspace overview, problem statement, actors, solutions | Copy, editor controls, suggestions, loaded/user content |
| Functional/non-functional requirements, backlog, UML | Tables, forms, filters, priorities, diagrams, progress/errors |
| Report structure and builder | Navigation, chapter tools, compilation controls, document preservation |
| Presentation, speech, jury simulation and Q&A | Slide/editor controls, pace, history dates, recording/session preservation |
| Workspace settings, account and credit history | Interface/content-language distinction, account forms, detail drawers |
| Admin dashboard, users, projects, credits, requests and settings | Roles/status display maps, financial confirmations, filters, unsaved settings |
| Shared navigation, search, save, notifications, wallet and AI controls | Immediate display updates, keyboard labels, known backend metadata |
| Transactional emails | Existing recipient-specific EN/FR regression checks pass; no email delivery during QA |

The route review starts from `src/App.tsx`, including workspace/admin wildcard
fallbacks and redirects. `Presentation.tsx` and `Pitch.tsx` re-export their
localized directory pages; ReportBuilder is explicitly imported from `/index`.

## Corrections

- Shortened French save buttons to **Enregistrer**, with **Enregistré** and
  **Non enregistré** status badges. Save controls wrap on narrow screens.
- Polished natural French across the 19 namespaces: clearer descriptions,
  concise actions, less implementation jargon, and preserved essential guidance.
- Added three missing credit-history detail labels in both languages.
- Added singular/plural variants for slide, word, student/project and action
  counts. Multiple report counters use neutral field labels.
- Localized visible presentation decimals, report word totals and jury-history
  dates without changing stored numeric/date values.
- Help controls now support keyboard focus and Escape dismissal. Their panels
  fit the viewport, scroll when necessary, and close on page scroll/resize.
- Retained exact purchased-credit amounts and separate payment-confirmation /
  wallet-crediting steps in financial confirmation copy.

## Verification

- 64 frontend tests, including dictionary key/placeholder parity, exact plural
  forms, detail-drawer labels and accessible help controls.
- Six UI/content combinations: EN/FR interface × English/French/Arabic content.
  Mocked actual Actors hook generation starts only on explicit action; a locale
  switch sends only the preference update, keeps project storage unchanged,
  preserves the original generation body and does not restart/abort the task.
- Existing tests preserve rich text, report/slides/speech, unsaved edits,
  canonical filter/option values, financial data and microphone recording.
- 29 backend tests pass, including preference isolation, credit permissions,
  message compatibility and per-recipient email locale.
- TypeScript and production build pass. The existing large-bundle warning is
  unchanged and outside the translation scope.
- Browser fixture: 25 representative page components × EN/FR × light/dark ×
  390×844 / 1366×900 = 200 layout measurements, with no page-width overflow or
  clipped button text. Screenshots inspected for representative editor, report,
  presentation, tooltip and admin layouts. Fixture does not exercise every
  possible modal/data-length combination.
- Live French problem-statement page retains its existing English editor text
  and 20 credits. No real generation, translation, email, project edit or credit
  transaction was performed for QA.

## Deliberate exceptions

- User/generated text, chapter/slide titles, UML text, project names, notes,
  technical identifiers, brands and canonical enum/request values stay intact.
- Unknown server/provider errors and legacy notifications lacking reliable event
  metadata retain their original text; there is no broad string matching.
- English admin CSV headers/date format remain the existing export contract.
  Report and speech exports continue following content language.
- Unreachable legacy page implementations and content insertion templates are
  not interface translation targets.
- Workflow locks remain enforced. Later pages and admin scenarios use isolated
  fixtures/mocks rather than modifying the user's project or permissions.

The reusable preview source, layout results and screenshots are saved in the
chat workspace `runtime-logs/stage9-*`; no temporary preview file ships in the
application. Graphify is refreshed code-only. Checkpoint is local, with no push
or deployment and no backend/RAG changes in this stage.
