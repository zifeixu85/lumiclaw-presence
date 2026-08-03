# SDD-002 — Governed SHADOW Campaign

> Status: `SPEC_READY`  
> Milestone: `M2 — Governed shadow campaign`  
> Progress module IDs: `M2-01`, `M2-02`, `M2-03`, `M2-04`, `M2-05`, `M2-06`  
> Owner: A梦  
> Goal objective / task reference: Run one persisted M1 Campaign through a real six-member AgentTeams SHADOW Mission, produce digest-validated four-platform revisions, independently audit them, expose Owner review and trace, and prove one fault is denied without any external action.  
> Target evidence maturity: `ENGINEERING_VERIFIED`  
> Acceptance report: `docs/reports/acceptance/SDD-002-ACCEPTANCE.md`  
> Last updated: `2026-08-03`

## 0. Spec Kit lifecycle record

Constitution, Clarifications, Plan, Checklist, Tasks, and Analyze are recorded in `docs/specs/sdd-002/`. Implementation may start only in a new Coordinator-assigned Executor task after M1 acceptance. Spec Kit CLI remains uninstalled.

## 1. User problem and outcome

M1 gives the Owner a durable Campaign, four editable drafts, evidence gaps, and non-executing schedule state. It does not prove specialized AgentTeams collaboration, independent production/audit, model routing, revision review, trace, or fault denial.

M2 lets the Owner start one explicitly `SHADOW` Mission, watch business progress rather than raw Matrix internals, inspect four returned platform revisions and evidence, see an independent Auditor block an invalid Claim/constraint, compare a corrected revision, and reach exact Owner review. No public action, ActionGrant, connector, handoff, or schedule execution exists.

## 2. Entry state and dependencies

Entry requires Coordinator acceptance of M1-01 through M1-06 and a persisted Campaign whose digest, four ActivationUnits, Claims/Evidence, Mandates, CapabilitySnapshots, ArtifactRevisions, and MissionContract pass M1 validation.

M0 provides the isolated AgentTeams v1.2.0 profile/adapter boundary. M1 provides shared PostgreSQL state and deterministic adapter input. M2 must not read a hidden Campaign copy from AgentTeams or the Web.

## 3. Scope

### In scope

- Runtime Adapter project/task lifecycle, dependency DAG, ACK/Submit, digest import, timeout, restart recovery, and controlled cancellation;
- exactly six real AgentTeams members: orchestration-only Presence Mission Leader, Evidence & Claim Steward, Campaign Planner, Founder Identity Producer, Product Account Producer, and Independent Auditor;
- versioned Skill contracts/locks and role-scoped context/permissions;
- DeepSeek official ModelProvider gateway with exact model/config/cost/privacy snapshot, schema validation, bounded retry, timeout, and public-safe mock/manual Canary separation;
- four returned ArtifactRevisions, media-asset/provider boundary with no auto-approval, independent AuditDecision, revision diff, and Owner review;
- shared PostgreSQL mission/task/artifact/audit/trace/ledger state consumed by Web/API/runtime adapter;
- one Flight fault such as stale Claim or `Beta → GA`, yielding Auditor `FAIL | ESCALATE`, no Owner approval and no external action;
- Chinese-default/English Mission/Review UI states and a public-safe evidence export.

### Out of scope

- ActionGrant, outbox, action-operator execution, due Schedule claiming, connector, Direct, Handoff, receipt, reconciliation, response, learning, or any public platform action;
- real social-account credentials or customer/private data;
- guaranteed model quality, customer UAT, business result, production readiness, or compliance claim;
- changing AgentTeams Manager/Worker/Matrix internals;
- canonical progress edits by the Executor.

### Existing behavior that must not change

- M1 Campaign/API/digest/ETag/idempotency/tenant/schedule/preview behavior remains authoritative;
- Web, API, AgentTeams Adapter and future clients share PostgreSQL state;
- Leader does not produce domain artifacts; Producers and Auditor are separate; Auditor cannot edit/approve/publish; Owner review is not an execution credential;
- no secret enters prompt, fixture, trace, evidence export, or Git.

## 4. User journey and states

1. Reopen one M1 Campaign and start `SHADOW` with its exact digest.
2. Observe six role/task states and dependency progress through the Web evidence drawer.
3. Evidence Steward freezes Claim/Evidence; Planner produces the ActivationPlan task result; the two Producers create four platform revisions.
4. Auditor independently returns structured `PASS | FAIL | ESCALATE` with cited Claim/constraint paths.
5. A valid revision becomes `NEEDS_OWNER_REVIEW`; an injected invalid revision is blocked and cannot become approved/actionable.
6. Producer submits a new immutable revision; the Owner compares at most two revisions and records review intent without issuing a Grant.

Required states: empty/prerequisite-blocked, queued, running, waiting dependency, needs-owner, failed, timed-out, cancelled, unknown/recovery, audit-blocked, revision-required, and shadow-complete. All remain visibly `SHADOW / NOT_LIVE`.

## 5. Domain, API, state, and runtime contracts

- Persist `missions`, `agent_runs`, `agent_tasks`, `skill_locks`, `trace_events`, `ledger_entries`, `audit_decisions`, model calls, media jobs/assets, and immutable artifact revisions with `organization_id` and source/input/output digests.
- Mission state changes use version/ETag/idempotency and append-only events. AgentTeams state is imported and validated before it affects the control plane.
- Each TaskContract binds role, input digest, prerequisite task IDs, SkillLock digest, output schema/version, timeout, and allowed tools/data.
- Returned submissions whose mission/task/input/skill/output digest or schema mismatches are rejected and quarantined.
- `AuditDecision` binds revision, Claim/Evidence/Mandate/Capability/Policy versions and can only `PASS | FAIL | ESCALATE`; it cannot modify the revision.
- M2 Owner review binds exact revision/digest/account/action intent but is explicitly non-executable until M3 introduces Policy/ActionGrant.
- Web defaults to business progress. Raw/model/runtime trace is progressively disclosed, allowlisted, redacted, and never the sole state source.

## 6. AgentTeams and Skills

| Role | Required output | Prohibited |
|---|---|---|
| Presence Mission Leader | Project/DAG coordination, release/escalation events | Claim, plan, platform artifact, audit, approval |
| Evidence & Claim Steward | frozen Claim/Evidence view and gaps | platform content, audit/approval |
| Campaign Planner | ActivationPlan/task allocation | platform artifact, audit/approval |
| Founder Identity Producer | X and Xiaohongshu revisions | audit/approval/action |
| Product Account Producer | Bluesky and LinkedIn revisions | audit/approval/action |
| Independent Auditor | structured decision and cited issues | editing, approval, action |

Required locked Skills: evidence-and-claim-grounding, campaign-strategy, account-native-expression, independent-action-audit, and trace-safe-escalation. Every Skill defines version, inputs/outputs, trigger, tools, failure, privacy, permission, and tests.

## 7. Dependencies

- `INTEGRATE`: pinned AgentTeams v1.2.0 runtime through the accepted adapter/profile; no fork or internal orchestration rebuild.
- `INTEGRATE`: DeepSeek official API behind `ModelProvider`; exact supported model names must be reverified at implementation time and never enter core domain enums.
- `POC-GATED`: EvoLink MediaGenerationProvider; M2 can pass with public-safe mock/Canary separation, content-addressed ingest, cost/rights receipt, and no auto-approval.
- `BUILD`: Mission/Task/Skill/Audit/trace contracts and gateways under Apache-2.0.

Each added dependency/provider requires exact version/source/license/provenance, secret/data boundary, replacement port, SBOM, and conformance tests.

## 8. Failure, recovery, and rollback

- stale Campaign/Claim/Capability or changed source digest blocks dispatch;
- AgentTeams unavailable/version mismatch/unsafe profile returns failed or unknown, never fake completion;
- task timeout/worker loss preserves task attempt and allows bounded recovery without duplicate accepted submission;
- model timeout/malformed schema/unknown response is explicit and cannot silently switch models;
- returned digest/schema/role mismatch is quarantined;
- Producer/Auditor identity collision or permission violation fails closed;
- artifact edit invalidates prior audit and requires a new revision/re-audit;
- restart reconstructs mission/task state from PostgreSQL and reconciles AgentTeams status;
- cancellation stops unreleased tasks and never deletes accepted history;
- rollback reverts local code/migrations only in project-scoped test data; no external action exists to compensate.

## 9. Binary acceptance criteria

1. A real pinned AgentTeams v1.2.0 SHADOW run contains exactly six members with the frozen responsibilities and no Leader-produced domain artifact.
2. Producers and Auditor use distinct identities, contexts, SkillLocks, permissions, and submissions; Auditor cannot edit, approve, or act.
3. Runtime Adapter persists Project/Task/ACK/Submit/recovery events and validates mission/task/input/skill/output digests before accepting artifacts.
4. DeepSeek gateway validates structured output and records exact model/config/input/output/cost/latency/error snapshots without secrets; timeout/malformed/provider-unavailable cases fail explicitly.
5. Four immutable platform revisions import into the same PostgreSQL Campaign and remain editable/reviewable through M1 UI contracts.
6. An injected Claim/constraint fault produces `FAIL | ESCALATE`, names evidence and next responsible role, and creates no approval, Grant, occurrence execution, or external action.
7. A corrected new revision invalidates the old audit, is independently re-audited, and one valid exact revision reaches Owner review.
8. Restart/reconnect recovers mission/task/trace state without duplicate accepted submissions or hidden AgentTeams-only state.
9. Chinese/English Mission and Review screens cover queued/running/blocked/needs-owner/failure/unknown/recovery/complete states with business-first copy and progressive trace disclosure.
10. Unit/contract/DB/API/runtime/model/UI/Flight/fresh-Compose/secret/license/SBOM/build/Storybook/browser gates pass and generate public-safe machine evidence.
11. No connector, schedule execution, ActionGrant, platform credential/action, customer data, business result, or production claim exists.
12. Chinese acceptance report, Owner UAT, Pro record/source ZIP, rollback, limitations, proposed module states, and structured handoff are complete while canonical status remains Coordinator-owned.

## 10. Test plan

- unit/schema: Mission/Task/SkillLock/Artifact/Audit/trace contracts and digest tamper cases;
- role/permission: six identities, Leader prohibition, producer/auditor separation, scoped context leakage;
- adapter/runtime: create/DAG/ACK/Submit/version/unavailable/timeout/restart/duplicate/mismatch;
- model contract: success, schema error, 429/5xx/timeout/unknown, no silent model switch, secret redaction;
- DB/API: mission/task/event/revision/audit append-only history, ETag/idempotency/tenant isolation;
- Flight: stale Claim or Beta→GA denial, corrected revision and re-audit;
- Web/browser: state matrix, revision compare, audit reason/next role, trace drawer, zh-CN/en, 390px;
- fresh Compose/evidence: restart/recovery/public-safe export/secret/license/SBOM/full build.

## 11. Evidence and claims

Required evidence includes runtime manifest/digests, Mission/Task/role/SkillLock report, redacted trace/ledger, model gateway conformance, valid/invalid revision and AuditDecision, fault/no-action proof, browser screenshots, command manifest, and Chinese acceptance report.

Valid claim after verification: `ENGINEERING_VERIFIED — one persisted Campaign completed a real six-member AgentTeams SHADOW production-and-independent-audit path, including one fault denial, without external action.`

Still `PLANNED`: M3 grants/scheduler/operator/connectors/actions; response/learning; hosted production. `NOT_CLAIMED`: customer UAT, external calibration, business outcome, compliance, production readiness.

## 12. Delivery plan

```text
M2-01 runtime adapter/shared state
→ M2-02 six members + locked Skills
→ M2-03 DeepSeek gateway
→ M2-04 artifacts/audit/owner review
→ M2-05 media boundary
→ M2-06 trace/ledger/fault denial
→ convergence/evidence/UAT
```

## 13. Alternatives

- single agent or Leader-generated artifacts: rejected; violates real role separation;
- AgentTeams database/UI as product state: rejected; breaks one control plane;
- Auditor edits the artifact: rejected; destroys independent evidence;
- treat model output as approved: rejected; schema/evidence/audit/Owner gates remain;
- implement M3 action path concurrently: rejected; M2 must prove shadow denial first;
- copy legacy/competitor runtime/provider source: rejected without file-level provenance/license/semantic/test review.

## 14. Owner-participated acceptance

Owner UAT uses synthetic/local Campaign data and no platform credential:

1. Reopen the accepted M1 Campaign and start SHADOW.
2. Confirm six understandable responsibilities and business progress.
3. Inspect four returned revisions and the separate Auditor decision.
4. Inspect the injected fault, cited evidence, responsible next role, and absence of external action.
5. Compare corrected revision and confirm exact Owner review does not claim publication.
6. Restart/reopen and confirm the same mission/revision/audit trace remains.

Expected: the Owner can explain who did what, why one item was blocked, what changed, and why nothing could publish. Failure: hidden/duplicate state, Leader copywriting, self-audit, missing evidence, secret/raw private prompt, fake approval/action, lost restart state. Return screenshots plus binary `UAT PASS`/criterion IDs. Cleanup uses ordinary project-scoped Compose stop.

## 15. Closeout

The future Executor creates `docs/reports/acceptance/SDD-002-ACCEPTANCE.md`, proposes M2-01 through M2-06 states, and returns the standard structured handoff. Coordinator alone integrates, records Owner acceptance, updates progress, and selects M3.

