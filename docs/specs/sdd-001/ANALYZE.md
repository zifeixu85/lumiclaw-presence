# SDD-001 pre-implementation analysis

## Cross-artifact consistency

| Check | Result | Notes |
|---|---|---|
| Coordinator scope and module order | PASS | Exactly M1-01 → M1-06; M2 is spec preparation only. |
| Progress authority | PASS | Executor never changes either implementation register. |
| M0 compatibility | PASS | Existing Compose/i18n/runtime/security gates remain and are extended, not bypassed. |
| Product outcome vs claims | PASS | Persisted synthetic Campaign is real product state but visibly `DEMO_SEED / NOT_LIVE`. |
| Tenant and graph integrity | PASS | Organization header, row keys, composite FKs, aggregate validation, and negative fixtures align. |
| Canonical/version/history | PASS | Digest exclusions, immutable history, ETag, and idempotency have distinct testable semantics. |
| Single control plane | PASS | Fastify/PostgreSQL is authoritative; Web proxy/compiler are consumers only. |
| Four-platform boundary | PASS | Editable previews and constraints exist without connector/capability/publish claims. |
| Schedule boundary | PASS | Model/editor/occurrence preview only; M3 execution contracts are not pulled forward. |
| AgentTeams boundary | PASS | Compiler smoke preserves topology/import digest and explicitly performs no live runtime work. |
| i18n/time/responsive | PASS | Four concepts are separate; gap/fold and 390px behavior are binary. |
| Failure/recovery/rollback | PASS | Business/security/dependency/conflict/restart/unknown/project-scoped rollback paths are named. |
| Dependency/license/privacy | PASS | No new external dependency planned; ZIP/secret/license gates fail closed. |
| Acceptance/evidence/UAT | PASS | 16 binary ACs, machine reports, Chinese report, two Owner protocols, non-claims, and handoff align. |

## Retained implementation risks

1. M1 is a large vertical slice. File-level tasks stay dependency-ordered; a later module cannot weaken an earlier contract to make UI work.
2. Fastify unit tests need a repository double while authoritative claims require real PostgreSQL integration. Evidence must label the layer and cannot promote the double.
3. Built-in `Intl` has platform time-zone data. Tests pin expected gap/fold cases and record the Node/ICU version; a cross-runtime conformance gap reopens the time library decision.
4. M0 README text is stale relative to accepted implementation status. This SDD may update current implementation truth but must not rewrite product direction or status rows.
5. Storybook screenshots are not enough for persistence. Browser verification must operate against real local API/PostgreSQL and then restart/reopen.
6. ChatGPT Pro can review only the scanned public-safe archive and cannot verify local Docker/browser results. Its claims remain untrusted until reproduced.

## Decision

No unresolved product direction, credential, permission, dependency, or testability conflict blocks implementation. Constitution, Specify, Clarifications, Plan, Checklist, Tasks, and this analysis agree. SDD-001 is `SPEC_READY` as of 2026-08-03; implementation may begin in the assigned Worktree.

## Post-implementation convergence analysis

| Check | Result | Evidence / convergence decision |
|---|---|---|
| Dependency order | PASS | M1-01 through M1-06 were implemented and locally committed in order; M2 remains spec-only. |
| Server authority | PASS | Client aggregate writes use strict schemas; Evidence, Capability, Activation scope, approved Claim fields, artifact revisions, and schedule authority are validated or derived server-side. |
| Persistence integrity | PASS | PostgreSQL reopen verifies stored document/digest/ETag consistency and re-evaluates time-bound readiness; corrupt state fails closed. |
| Concurrency and history | PASS | Transaction advisory locking serializes idempotency keys; stale ETags fail; artifact/schedule history is append-only and replaced occurrences are invalidated. |
| Schedule truth | PASS | UTC candidates are deterministically recomputed from local time/IANA zone/fold; forged fields and duplicate RRULE keys fail; no due execution path exists. |
| Product surface | PASS | Four distinct editors/previews expose persisted identity/account/capability/mode/constraints; approved Claims are visibly immutable; zh-CN/en share one Campaign. |
| Recovery | PASS | Fresh/broken migration, database outage, restart/down-up, Campaign/blob persistence, and exact project cleanup pass; PostgreSQL idle-client disconnect no longer terminates API. |
| Responsive/browser | PASS | Real local Web/API/PostgreSQL flow reopens v4; CDP `390 × 844` measurement reports document/body `390` with only the navigation rail locally scrollable; console warning/error count is zero. |
| External review | PASS WITH CORRECTIONS | ChatGPT Pro returned `CHANGES_REQUIRED`; every P1 was independently reproduced or rejected with evidence, remediated, and re-run locally. Pro is not an acceptance authority. |
| Claims and status | PASS | Evidence maturity is `ENGINEERING_VERIFIED`; Owner UAT/Coordinator acceptance, production, external actions, customers, growth, leads, and revenue remain unclaimed. Both progress registers have zero diff. |

## Convergence decision

The implementation and evidence now satisfy the 16 binary SDD criteria at the Executor layer. SDD-001 advances to `EVIDENCE_READY`, not `ACCEPTED`. Owner UAT and Coordinator independent verification remain required; no M2 implementation may start in this task.
