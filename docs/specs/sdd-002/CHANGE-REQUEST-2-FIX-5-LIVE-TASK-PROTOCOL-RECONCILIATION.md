# SDD-002 CR2 Fix 5 — Live AgentTeams task protocol reconciliation

Status: `SPEC_READY` after Coordinator evidence `COORDINATOR_FIX_REQUEST_5` on 2026-08-04.

## Verified current state

The fifth and same-Head sixth Coordinator Canaries both reached the exact six-member AgentTeams Project and persisted five accepted DeepSeek `ModelCallSnapshot` records. Both then failed closed at `TASK_PROTOCOL`, before the sixth provider request, while `PRODUCE_FOUNDER_CORRECTION` was assigned to `founder-identity-producer` for that member's second Task and `REAUDIT_CORRECTION` remained dependency-blocked. The sixth Mission was `FAILED` at version 27 with four revisions, four audits, five model receipts and zero ActionGrant, Connector or external action. Both owned environments cleaned successfully. This repeated boundary is not a transient and is not `LIVE_PROVIDER_VERIFIED`.

Source comparison found one bounded protocol divergence. `scripts/run-live-deepseek-uat.mjs` called `delegate_task` unconditionally for every DAG node, then required an assigned response before ACK. `scripts/verify-agentteams-real-runtime.mjs`, which already completes the same six-member/eight-Task graph with a public-safe provider, was state-aware. The initial hypothesis was that completing the audit auto-delegated the dependent correction, making the Live Runner's second delegate fail.

That hypothesis is now disproved, not promoted to a root-cause claim. Inspection of the pinned v1.2.0 source shows that `ready_nodes` returns only dependency-ready `pending` nodes and does not mutate or delegate them; only `delegate_task` changes the DAG node to `delegated` and creates assigned Task metadata. A real public-safe six-member/eight-Task execution on candidate `07516646248750ebdfe5e0ed13f8548cc3a328bf` recorded all eight initial pre-operation snapshots as `planStatus=pending`, `taskStatus=null`, `selectedAction=DELEGATE`, including `PRODUCE_FOUNDER_CORRECTION` attempt 2 on the same Producer and `REAUDIT_CORRECTION` attempt 2 on the same Auditor. Both completed real ACK/Submit/Check/Accept with zero actions and exact cleanup.

The historical fifth/sixth Canary operation cannot be reconstructed because the old runner exported only the generic stage code and cleanup removed its Runtime/DB state. The confirmed implementation defect is therefore the blind, non-resumable transition sequence plus loss of operation/state diagnostics—not the unproven auto-delegate scenario. The correction preserves the passing pending path, supports exact delegated/advanced reconciliation, and makes a further failure identify one allowlisted operation outcome plus the observed safe state pair in a single attempt.

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

## Engineering verification result

- Pinned AgentTeams source semantics: `pending` remains pending until explicit delegate; ACK changes Task metadata to `in_progress`; submit changes it to `submitted`; the checked-result bridge completes the DAG node.
- Real public-safe runtime: exact 6 members / 8 Tasks; the same Producer and Auditor each completed attempt 1 and dependent attempt 2; all eight pre-operations were recorded and no runtime auto-delegation was observed.
- State planner: `pending → DELEGATE`, exact `delegated/assigned → ACK`, exact `delegated/in_progress → IMPORT_ACK or RUN_DOMAIN/SUBMIT`, exact `delegated/submitted → CHECK_IMPORT or ACCEPT`, exact `completed/submitted → COMPLETE`; contradictions, wrong bindings and unsafe model replay fail closed.
- Diagnostics: 13 task-protocol outcomes traverse the real environment-verifier/Runner child pipe and persist only stable outcome, safe `planStatus/taskStatus`, exact failed Task binding, zero-action and cleanup fields. Forbidden marker finding is zero.
- Maturity remains `ENGINEERING_VERIFIED`; the seventh real-key Canary and `LIVE_PROVIDER_VERIFIED` are external Coordinator gates.

## Out of scope

Owner Secret or raw model output, weakening domain/Provider schema validation, synthesizing Task acceptance, changing AgentTeams Manager/Worker/Matrix internals, adding Docker socket access, external platform actions, M3, Push/PR/Deploy and canonical status edits remain prohibited.
