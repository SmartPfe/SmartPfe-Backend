# SmartPFE backend context

Read CONVERSATION_HANDOFF.md before broad exploration. The EN/FR interface
migration is complete through Stage 9; the handoff contains checkpoints,
validation, architecture and the user's requirements. Do not restart it.

User.uiLanguage en/fr is independent of project/generation English/French/Arabic.
Preserve original API message/code/status/data, content-language request fields,
business logic, credit economics/permissions/idempotency and user/generated text.
Known interface message metadata is additive. Unknown errors/content remain raw.
Emails follow the recipient's UI preference while delivery contracts stay intact.

Use the existing checkout and preserve unrelated uncommitted changes. Existing
reportStudioRagService.js and rag-evaluation experiments were excluded from the
translation commits; do not reset or accidentally stage them.

When a parent code-only Graphify index exists, query it with a small budget first,
then verify source. Portable setup templates are in the frontend repository at
docs/conversation-context/graphify-setup. Do not add semantic indexing or watchers.

Backend check: npm test. Follow the user's current scope for commits and pushes;
historical permission is not deployment authorization.
