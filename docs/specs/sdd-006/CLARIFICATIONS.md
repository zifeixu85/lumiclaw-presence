# SDD-006 Clarifications

| ID | Question | Resolution |
|---|---|---|
| CL-01 | What identifies the first local user? | One validated local display name. No email, password, remote account, or browser secret field exists. |
| CL-02 | What persists onboarding? | PostgreSQL stores profile/session/material manifests; the local content-addressed blob store retains accepted bytes and digest-verifies reads. |
| CL-03 | Which uploads are supported? | UTF-8 `.md` and `.txt` up to the documented limit. PDF/DOCX remain disabled with `PLANNED` copy and fail closed at the API. |
| CL-04 | Is the sample a customer result? | No. Every sample metric, content, account, and organization is labeled `PUBLIC_SAFE_EXAMPLE`. |
| CL-05 | Can manual publishing finish as published? | No. Copy/download/open records at most `AWAITING_RECONCILIATION`; only future read-back evidence can reconcile publication. |
| CL-06 | Is AgentTeams installed or managed here? | No. The UI consumes a safe readiness contract; runtime installation, secrets, dispatch, restart, and recovery belong to SDD-007. |
| CL-07 | Can account buttons imply a live connector? | No. OAuth, live probe/test, upload automation, and read-back controls are disabled and labeled `PLANNED`. |
| CL-08 | How are six Agents shown? | The global AI Team page shows six stable roles; task pages show only the active Agent and an expandable trace. |
| CL-09 | Is mobile supported? | No. Widths below 1024px render an explicit desktop gate. |
| CL-10 | Who accepts M5-00? | Owner UAT plus Coordinator review. The Executor supplies evidence and proposes at most `EVIDENCE_READY`. |
