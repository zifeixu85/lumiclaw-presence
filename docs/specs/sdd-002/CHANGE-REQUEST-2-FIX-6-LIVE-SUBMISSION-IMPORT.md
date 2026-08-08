# SDD-002 CR2 Fix 6 — Live initial-audit submission import

Status: `SPEC_READY` after Coordinator evidence `COORDINATOR_FIX_REQUEST_6` on 2026-08-05.

## Verified current state

The seventh Coordinator Canary on clean Head `b85ef2494b631415a0545f03154a285c19ae2786` reached the pinned six-member AgentTeams Project, completed Project/DAG/member dispatch, persisted five DeepSeek `ModelCallSnapshot` records and submitted the fifth domain Task (`AUDIT_REVISIONS`) in AgentTeams. `check_task` was effective, the checked summary and PostgreSQL ACK were validated, and the Runner constructed the exact `RuntimeSubmission`. The Control Plane then rejected `TASK_SUBMIT`; the exported receipt contained `LIVE_TASK_SUBMISSION_IMPORT_FAILED`, `planStatus=delegated`, `taskStatus=submitted`, five model receipts, zero ActionGrant/Connector/external action and complete cleanup. This is not a Provider transport or AgentTeams submit/check failure and is not `LIVE_PROVIDER_VERIFIED`.

The current Provider schema and `normalizeLiveRoleOutput` accept an initial audit with any PASS/FAIL/ESCALATE combination and any closed issue list for the four exact platforms. The next boundary, `materializeAcceptedRuntimeProgress`, requires the frozen Flight fault to be an X `FAIL` with a blocking `CLAIM_OVERREACH` issue, evidence references and `founder-identity-producer` as the next owner. It also requires the later X re-audit to PASS. A schema-valid and normalize-valid response can therefore be persisted as the fifth model snapshot and accepted into a `RuntimeSubmission`, then fail only during materialization with `RUNTIME_FROZEN_FAULT_INVALID`. That cross-boundary contract drift is reproducible without an Owner Secret through the same API runtime-event route.

## Bounded correction

- Add a public-safe deterministic API regression that executes the real task order: deterministic Leader submission, four accepted domain model submissions, the fifth independent Auditor model call, and its exact `TASK_SUBMIT` import.
- Make the task-specific Provider schema and semantic normalizer encode every initial-audit invariant enforced by materialization: X must FAIL with the frozen `CLAIM_OVERREACH` issue, evidence references and exact next role; the other three platforms must PASS without issues. Re-audit must return an exact X PASS without issues.
- Keep revision numbers, revision/content/audit digests and materialization server-derived. Invalid model output fails at the semantic Provider boundary; it is never coerced into a valid audit and never imported.
- Add one nullable, closed `submissionImportOutcomeCode` to local Live failure diagnostics. Derive it only from an HTTP status and an allowlisted Control Plane code, grouping ticket, ETag, request-contract, quarantine, domain-invariant and persistence/unavailable failures. Never retain or export the response body, details, exception text, ticket, prompt, model output, headers, bootstrap or Secret.
- Preserve independent Auditor execution, mandatory FAIL → Founder correction → independent re-audit, immutable revision/audit history, no Mock fallback, zero external-action capability and exact owned cleanup.

## Binary acceptance additions

1. A deterministic public-safe Live API flow records the fifth model snapshot for the independent initial Auditor and imports its exact `RuntimeSubmission`; the Mission materializes four immutable revisions/audits and enters `REVISION_REQUIRED` with X FAIL and the other platforms PASS.
2. A Provider response that is structurally closed but violates the frozen initial-audit or re-audit semantic contract is rejected before `TASK_SUBMIT` as `LIVE_MODEL_SEMANTIC_OUTPUT_INVALID`; no audit is coerced or silently accepted.
3. Duplicate/idempotent submission import is deterministic, while stale ETag, wrong/consumed ticket, wrong Task/role/attempt/digest/schema and semantic-invalid payloads fail closed.
4. A rejected `TASK_SUBMIT` exposes at most one allowlisted `submissionImportOutcomeCode`; nested child output and the host receipt contain no arbitrary API body/details, raw model material, ticket/bootstrap/Authorization/Bearer/Secret markers or exception text.
5. The public-safe real AgentTeams v1.2.0 six-member/eight-Task flow still completes correction and re-audit with mandatory ACK/Submit/Check. ActionGrant, Connector and external action remain zero.
6. Targeted/full tests, Provider conformance, PostgreSQL/API, browser/390px, Compose, real AgentTeams/no-Secret Live, security, evidence manifest and clean-Head source package pass.
7. The eighth real-key Canary remains Coordinator-owned. Until all seven domain receipts reach `AWAITING_OWNER_REVIEW`, `LIVE_PROVIDER_VERIFIED` and `ACCEPTED` remain false.

## Out of scope

Owner Secret/raw model output recovery, weakening downstream audit invariants, synthesizing Task acceptance, modifying AgentTeams Manager/Worker/Matrix, external platform actions, M3, Push/PR/Deploy and canonical status edits remain prohibited.
