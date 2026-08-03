# SDD-001 Clarifications

| ID | Question | Resolution | Evidence / effect |
|---|---|---|---|
| CL-01 | May the Executor advance M1 status rows? | No. | Coordinator owns both registers; handoff proposes states only. |
| CL-02 | Is the Campaign “real”? | It is real persisted product state but contains synthetic/local data and remains `DEMO_SEED / NOT_LIVE`. | No customer/external calibration claim. |
| CL-03 | What is the tenant boundary before full auth/RLS? | Every row and request is organization-scoped; header/body/graph mismatches fail. | Engineering constraint, not production auth. |
| CL-04 | What is canonical digest scope? | Governed Campaign content and references only; envelope version/digest/timestamps/request metadata are excluded. | Unchanged reopen is stable; any governed edit changes digest. |
| CL-05 | Is API idempotency optional locally? | No for POST/PUT. | Same key/body replays; key reuse with another body fails. |
| CL-06 | Does an update overwrite history? | No. | Campaign head advances while aggregate snapshots and ArtifactRevisions append. |
| CL-07 | How many ActivationUnits are required? | Exactly four M1 Hero units: X, Bluesky, LinkedIn, Xiaohongshu. | Each matches one exact Mandate tuple. |
| CL-08 | Are platform limits current official facts? | No. | Public-safe versioned fixtures demonstrate constraint behavior and carry source/capture/expiry/non-live labels. |
| CL-09 | Does M1 execute schedules? | No. | It stores schedule versions and preview occurrences as `PENDING`, `MISSED`, `NEEDS_OWNER`, or `INVALIDATED`; no loop/grant/outbox/operator. |
| CL-10 | How are DST folds handled? | An ambiguous wall time requires explicit `EARLIER` or `LATER`; both UTC candidates are displayed. | No silent default. |
| CL-11 | What does the AgentTeams smoke prove? | The future adapter input imports the same persisted MissionContract digest and preserves six role boundaries. | No Project, Task, Agent, model, artifact, audit, or live-run claim. |
| CL-12 | Is Web allowed to proxy mutations? | A thin same-origin HTTP proxy may forward to Fastify; it may not own validation or persistence. | One control-plane mutation path remains. |
| CL-13 | Must the former 390px bug be fixed? | Yes for all M1 flows and shared shell elements touched by them. | Document width must not exceed viewport in the evidence flow. |
| CL-14 | Is Owner UAT required for canonical acceptance? | Yes. | Machine completion proposes `EVIDENCE_READY`; Coordinator records Owner decision. |
| CL-15 | Is Spec Kit CLI installed? | No. | Direct lifecycle artifacts satisfy the project method without a new dependency/rule surface. |
