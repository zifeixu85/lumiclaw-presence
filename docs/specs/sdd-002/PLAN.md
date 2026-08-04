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
