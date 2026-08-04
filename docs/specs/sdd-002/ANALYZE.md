# SDD-002 pre-implementation analysis

| Check | Result | Notes |
|---|---|---|
| M1 dependency | PASS | Entry requires accepted persisted Campaign/digest/preview/schedule contracts. |
| Module scope | PASS | Exactly M2-01 through M2-06; M3 actions excluded. |
| Team topology | PASS | Six real members, orchestration-only Leader, separate domain outputs and Auditor. |
| Shared state | PASS | PostgreSQL remains authoritative; adapter imports/exports validated digests. |
| Model/provider boundary | PASS | DeepSeek and optional media provider are ports with conformance, secrets, and maturity labels. |
| Governance | PASS | Independent audit and exact Owner review exist without Grant/action authority. |
| Fault/no-action | PASS | Invalid Claim/constraint must be denied and no execution path is present. |
| Failure/recovery | PASS | timeout, unknown, restart, duplicate, mismatch, cancellation, and rollback are testable. |
| UI/evidence/UAT | PASS | Business-first bilingual states, trace drawer, public-safe evidence, and Owner protocol align. |

## Decision

No unresolved requirement or architecture conflict remains. This Epic is `SPEC_READY` for a new Coordinator-assigned M2 Executor after M1 is accepted. This file is a planning artifact only and makes no M2 implementation claim.

## Executor convergence analysis — 2026-08-04

The Coordinator-assigned branch entered implementation after M1 acceptance. No Clarify change or M3 scope expansion was required. The implementation preserves one PostgreSQL control plane, uses the pinned AgentTeams v1.2.0 external runtime without modifying Manager/Worker/Matrix, and isolates the only bounded upstream gap to checked-result acceptance in the versioned public task store API.

The real runtime proof uses six AgentTeams members and real Project/DAG/Task/ACK/Submit, while model output remains explicitly public-safe `MOCK_CONFORMANCE`; DeepSeek and EvoLink live Canaries are `NOT_RUN_NO_KEY`. Owner Review is non-executable and creates no ActionGrant. The final acceptance report and evidence manifest are the authoritative convergence record. Executor completion can recommend `M2-01` through `M2-06` as `EVIDENCE_READY`; only the Coordinator may update canonical progress, and Owner UAT is still required for `ACCEPTED`.

## External-review convergence analysis — 2026-08-04

ChatGPT Pro's second source review correctly identified that contract-shaped API events alone were weaker than a causal Runtime receipt chain, that the verifier still prepared domain payloads outside the Worker, and that the Mission aggregate JSON could remain an accidental history authority. These were implementation gaps, not SDD requirement conflicts, so no Clarify amendment or M3 scope expansion was needed.

The bounded correction binds one Project dispatch receipt to the exact pinned build, six distinct Matrix actor IDs, six RoleContext identities and the persisted DAG digest. Every accepted Submit now requires the exact Project, actor, task, attempt and ACK receipt, plus a persisted AgentTeams `check_task` result digest; forged pre-dispatch, pre-ACK, wrong-actor, wrong-attempt, wrong-schema and digest-mismatched events fail closed. Each real Worker container invokes the public-safe ModelProvider for its own role result, and the Independent Auditor derives its decisions from the two Producer results read back from AgentTeams persisted task summaries. The deterministic provider remains honestly labeled `MOCK_CONFORMANCE`.

PostgreSQL Mission JSON now stores an envelope with all ten history collections empty. Reads reconstruct RoleContext, SkillLock, Task, Revision, Audit, Review, Trace, Ledger, ModelCall and MediaAsset exclusively from normalized tables, then verify the exact Mission ETag, Trace sequence, Ledger digest chain and runtime receipt bindings. Poisoning a duplicate scalar in the envelope is ignored in favor of authoritative columns; tampering a normalized Task row is rejected as `CONTROL_PLANE_HISTORY_DIVERGED`. This preserves one Control Plane and removes the previous aggregate-success ambiguity.

## Fourth external-review convergence analysis — 2026-08-04

ChatGPT Pro's fourth source review found five remaining P1 fail-closed gaps: the final manifest trusted malformed or contradictory evidence; idempotency retained a mutable Mission response snapshot; a Campaign that became time-blocked could still create or dispatch a Mission; Task/ACK/Submit/provider traffic did not cryptographically bind the role-specific input projection; and DeepSeek conformance did not prove returned model identity, finish reason, usage integrity or a truthful mock-versus-Canary execution class. These were implementation gaps within the existing SDD, not requirement conflicts, so no Clarify amendment or M3 expansion was needed.

The bounded correction removes response payloads from idempotency storage, makes its remaining metadata immutable, rebuilds replay responses from current normalized state, and rejects a replay after the recorded version advances. Mission creation and authenticated Project dispatch now reload and validate the Campaign's current readiness, version and digest. Every Task is assigned an exact closed role projection whose schema and digest are carried by Task, ACK, Submit, result and observation receipts; both the real verifier and public-safe provider reject overbroad, cross-role and tampered inputs. DeepSeek evidence now binds response ID, actual model, system fingerprint, finish reason and detailed usage, rejects model mismatch/truncation/filter/null-finish/malformed usage, and allows injected transports only for explicit `MOCK_CONFORMANCE`; real `CANARY` requires the official origin. The final evidence manifest independently revalidates task topology, source/image identities, digest uniqueness, no-action counts, provider maturity, PostgreSQL idempotency semantics, clean source ZIP metadata and ten negative mutations.

The fifth external review correctly narrowed one remaining P1: the first role-projection correction closed envelope and immediate projection keys but did not recursively close nested domain objects. A crafted Leader mission ID, Planner activation plan, source revision, Producer summary, Audit issue or corrected content could therefore carry an arbitrary nested cross-role object while preserving a newly computed projection digest. The final bounded correction adds equivalent closed-schema validation for every nested Claim, EvidenceRef, ActivationPlan/Unit, ArtifactRevision, platform content, Producer summary/runtime revision and Audit issue used by all eight Task projections. The conformance verifier now accepts eight exact valid projections and rejects thirteen adversarial projections, including eight recursive nested attacks. This remains an M2 input-boundary correction and does not alter AgentTeams internals or introduce M3 behavior.
