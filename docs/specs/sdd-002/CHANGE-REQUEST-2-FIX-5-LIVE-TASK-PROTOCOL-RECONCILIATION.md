# SDD-002 CR2 Fix 5 — Live AgentTeams task protocol reconciliation

Status: `SPEC_READY` after Coordinator evidence `COORDINATOR_FIX_REQUEST_5` on 2026-08-04.

## Verified current state

The fifth and same-Head sixth Coordinator Canaries both reached the exact six-member AgentTeams Project and persisted five accepted DeepSeek `ModelCallSnapshot` records. Both then failed closed at `TASK_PROTOCOL`, before the sixth provider request, while `PRODUCE_FOUNDER_CORRECTION` was assigned to `founder-identity-producer` for that member's second Task and `REAUDIT_CORRECTION` remained dependency-blocked. The sixth Mission was `FAILED` at version 27 with four revisions, four audits, five model receipts and zero ActionGrant, Connector or external action. Both owned environments cleaned successfully. This repeated boundary is not a transient and is not `LIVE_PROVIDER_VERIFIED`.

Source comparison finds one bounded protocol divergence. `scripts/run-live-deepseek-uat.mjs` calls `delegate_task` unconditionally for every DAG node, then requires an assigned response before ACK. `scripts/verify-agentteams-real-runtime.mjs`, which already completes the same six-member/eight-Task graph with a public-safe provider, first reads the persisted AgentTeams Task, delegates only a `pending` Task and accepts a `delegated` Task before ACK. The hypothesis is that completing the initial audit makes the dependent correction ready and AgentTeams has already moved it to `delegated`; a second delegation is then rejected. This remains a hypothesis until a real public-safe Runtime observation records the exact pre-operation state and failed/suppressed operation.

## Bounded correction

- Add a shared, closed Live task-protocol planner that validates the exact Project, Task, member, attempt and contract digest before selecting an operation.
- Inspect persisted AgentTeams Task state before every operation. Delegate only exact `pending`; use exact existing `delegated` assignment without a second delegate; ACK only `delegated`; submit only after the exact in-progress ACK and domain result; check the persisted submitted result before Control Plane import; accept only the checked submitted Task.
- Treat `assigned` only as the `delegate_task` response vocabulary and require the following persisted state to reconcile to `delegated`. Unknown, contradictory, wrong-project, wrong-member, wrong-Task, wrong-attempt or wrong-digest state fails closed.
- Reconcile only states for which both AgentTeams and PostgreSQL carry sufficient exact receipts. An already accepted Control Plane Task plus a matching completed Runtime Task may be skipped deterministically; incomplete `in_progress`, `submitted` or `completed` combinations without all exact receipts fail closed instead of repeating model/domain work.
- Add an allowlisted task-protocol substage/outcome to the local host failure receipt only if needed to distinguish inspect, delegate, ACK, submit, check, accept and reconcile failures. No arbitrary exception, raw child output, prompt, model content, bootstrap, ticket, header or response identifier may be exported.
- Preserve mandatory real ACK/Submit/Check semantics, existing typed completion bridge, pinned Runtime digests, Producer/Auditor separation, no Mock fallback in Live mode, zero actions and exact owned cleanup. AgentTeams source/images are not modified.

## Binary acceptance additions

1. A real AgentTeams v1.2.0 public-safe six-member/eight-Task run records `founder-identity-producer` completing both `PRODUCE_FOUNDER` and `PRODUCE_FOUNDER_CORRECTION`; the correction pre-operation state and selected action are explicit and no duplicate delegate occurs.
2. Exact `pending` selects delegate then ACK; exact `delegated` selects ACK without delegate. Every selection binds Project ID, Task ID, role/member identity, attempt and contract digest.
3. `in_progress`, `submitted` and `completed` are either reconciled only from exact matching PostgreSQL/runtime receipts or rejected with an allowlisted stable outcome. Unknown/invalid states and contradictions always fail closed.
4. Wrong Project/Task/member/attempt/digest, duplicate/replayed transition and raw-error/secret-marker cases are rejected without leaking forbidden values.
5. The real public-safe flow reaches correction, re-audit and exact Owner Review with mandatory ACK/Submit/Check evidence, while ActionGrant, Connector and external action remain zero.
6. Targeted/full tests, provider conformance, PostgreSQL, browser, Compose, real AgentTeams, no-Secret Live, security, cleanup, evidence manifest and clean-Head source package pass.
7. The seventh real-key Canary remains Coordinator-owned. Until seven accepted domain receipts reach `AWAITING_OWNER_REVIEW`, `LIVE_PROVIDER_VERIFIED` remains false and no acceptance claim is made.

## Out of scope

Owner Secret or raw model output, weakening domain/Provider schema validation, synthesizing Task acceptance, changing AgentTeams Manager/Worker/Matrix internals, adding Docker socket access, external platform actions, M3, Push/PR/Deploy and canonical status edits remain prohibited.
