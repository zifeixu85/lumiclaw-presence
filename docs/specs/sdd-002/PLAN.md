# SDD-002 implementation plan

- Extend the accepted Runtime Adapter with Project/DAG/Task/ACK/Submit/recovery operations and immutable runtime identity evidence.
- Add Mission/Task/Run/SkillLock/Trace/Ledger/Audit persistence and APIs under the same organization/Campaign scope.
- Author five locked domain Skills plus orchestration behavior; compile six separate RoleContext views and permissions.
- Add DeepSeek gateway with exact schema/model/config/cost/error snapshots and no secret logging.
- Import four returned immutable revisions, run independent audit, expose revision compare/Owner review, and invalidate audit after edits.
- Add content-addressed media boundary and optional provider mock/Canary without auto-approval.
- Inject one frozen fault and prove audit denial/no action through machine evidence and Web.
- Verify timeout/restart/duplicate/digest mismatch/recovery, then build public-safe report/UAT/handoff.

Rollback uses local Git reverts and project-scoped test migrations. Cancellation and retry preserve append-only history. No external compensation exists because M2 has no external action.

## Change Request 2 plan

- Persist the explicit provider mode/model and the recoverable local-UAT state machine in the existing PostgreSQL Mission aggregate.
- Mount DeepSeek and runner-bootstrap values as Compose secret files and expose a redacting, fail-closed provider broker.
- Exchange the bootstrap credential for in-memory single-use Project/ACK/model/Submit/finalize tickets bound to one Mission, role, Task and attempt.
- Extend the pinned host acceptance runner so it executes only the supplied Mission/digest/runtime identities and sends role-scoped model calls through the broker.
- Persist every domain ModelCallSnapshot, runtime receipt and failure code; keep Leader deterministic and Producer/Auditor independent.
- Add business-first zh-CN guidance with en parity, 390px behavior and folded technical evidence.
- Verify Mock, no-secret and adversarial contracts automatically; reserve the real-key Canary and `LIVE_PROVIDER_VERIFIED` label for Coordinator execution.

## CR2 Fix 1 plan

- Replace line-oriented nested Runner input with one exact JSON document and a shared fail-closed parser.
- Capture both child layers; reconstruct safe success output and stable failure codes instead of forwarding raw stdout/stderr.
- Exercise the production nested child-process route for valid, partial, malformed and extra-field input, including stdout/stderr marker scans.
- Bind transport results and cleanup into Live conformance, the Chinese acceptance report, final manifest and clean-Head source package.
- Rerun the affected unit/type/full/Live/AgentTeams gates before returning the Canary to the Coordinator.

## CR2 Fix 2 plan

- Introduce one shared allowlist for Runner stages, stable codes, strict failure envelopes and atomic host receipts.
- Set the stage before each Mission/runtime/topology/Project/DAG/member/dispatch/task/provider/finalize boundary and persist bounded progress booleans on failure.
- Validate and reconstruct the failure at both nested child boundaries; never forward raw child output or arbitrary exception text.
- Exercise every stable stage through the production nested stdin path, including forbidden-marker and contradictory-receipt negatives.
- Run the pinned six-member environment without an Owner Secret and require it to reach a diagnosed fail-closed boundary; minimally correct any concrete pre-dispatch defect found.
- Rebuild Live conformance, the Chinese report, full gates, clean commit and source package before returning an exact Coordinator retry protocol.

## CR2 Fix 3 plan

- Add one shared provider-outcome allowlist and strict Task-bound extraction from the persisted Mission/ModelCallSnapshot after Worker HTTP failure.
- Extend the failure receipt and nested envelope with only the nullable allowlisted outcome; reject contradictions and all raw output.
- Include the exact closed role schema in the DeepSeek request and its input digest, then reproduce the first domain Task with fixture transports.
- Cover HTTP/provider/model/schema/semantic/broker/success cases at provider, API and actual child-process layers.
- Keep host Control Plane calls on loopback while deriving a strict container-reachable Worker broker origin; verify it with the real six-member no-Secret run rather than a synthetic networking claim.
- Rerun full Live/AgentTeams/PostgreSQL/Compose/browser/security/evidence gates, update the Chinese report, commit cleanly and return a one-attempt Coordinator retry protocol.

## CR2 Fix 4 plan

- Replace the generic clone/delete generation schema with closed task-specific revision and audit schemas.
- Require each exact unordered platform set and bind each platform to its own content schema; bind correction content dynamically to the exact source X projection.
- Keep normalize and persisted-output validation as independent gates, including a strict X re-audit boundary.
- Exercise accepted order permutations plus duplicate/wrong/mismatched/missing/extra/unknown-field negatives for founder, product, correction, audit and re-audit.
- Rerun full Live/AgentTeams/PostgreSQL/Compose/browser/security/evidence gates, update the Chinese report, commit cleanly and return the fifth Coordinator Canary protocol.

## CR2 Fix 5 plan

- Record the exact AgentTeams pre-operation Task state for every DAG node in a real public-safe six-member/eight-Task run, with special evidence for the same member's second dependent correction Task.
- Extract a closed task-protocol state planner shared by the Live Runner and tests; bind every decision to Project, Task, role/member, attempt and contract digest.
- Delegate only `pending`, accept exact already-`delegated` before ACK, and preserve real ACK/Submit/Check plus the existing typed checked-result completion bridge.
- Reconcile advanced states only from matching Runtime and PostgreSQL receipts; reject unknown, stale, wrong-scope or replayed combinations with stable redacted outcomes.
- Exercise transition, identity, digest, replay, forbidden-marker and cleanup negatives, then rerun real AgentTeams, Live no-Secret, provider, PostgreSQL, browser, Compose, full security/evidence gates.
- Update the Chinese report, commit cleanly, rebuild the public-safe ZIP/manifest and return a seventh Coordinator Canary protocol without claiming the real-key result.

## CR2 Fix 6 plan

- Reproduce the fifth-domain-call initial-audit import with a deterministic public-safe Provider through the production API ticket/model/runtime-event path and exact task order.
- Align initial-audit and re-audit generation schemas, semantic normalization and persisted materialization around the frozen FAIL → correction → PASS invariant without coercion.
- Classify submission-import failure using only a closed status/code mapping and propagate one nullable redacted outcome through nested child diagnostics.
- Cover successful fifth-receipt import, semantic-invalid output, ticket/ETag/digest/schema/replay and forbidden-marker cases.
- Rerun public-safe real AgentTeams six/eight, no-Secret Live, Provider/PostgreSQL/API/browser/Compose/security/evidence gates; update the Chinese report and clean-Head source package.
- Return an eighth Coordinator Canary protocol while leaving real-key verification and acceptance external.

## CR2 Fix 7 plan

- Enumerate every public-safe Founder X phrase placement admitted by the current generation schema and compare it with the downstream frozen-fault materializer predicate.
- Add a production API fixture that demonstrates the baseline gap through deterministic Leader, four prior domain submissions, fifth independent Auditor model snapshot and exact `TASK_SUBMIT` import.
- Introduce one shared frozen-phrase predicate, encode its case-insensitive exact phrase in the Founder generation schema, and enforce the predicate independently in normalization and materialization without rewriting model content.
- Exercise accepted case/order variants plus omission, paraphrase, split, wrong-field/platform, Unicode and structural negatives; retain existing exact Audit, ticket/ETag/digest/schema/replay and redaction coverage.
- Rerun Provider/PostgreSQL/API/public-safe real AgentTeams/no-Secret Live/browser/Compose/security/evidence gates; update the Chinese report and clean-Head package.
- Return a ninth Coordinator Canary protocol while leaving real-key verification and acceptance external.
