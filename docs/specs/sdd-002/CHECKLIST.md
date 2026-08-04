# SDD-002 requirements checklist

- [x] Entry dependency and M2-only scope are explicit.
- [x] Six roles, Leader prohibition, Producer/Auditor separation, Skills, context, tools, and permissions are testable.
- [x] Runtime Project/DAG/ACK/Submit/digest/restart/duplicate behavior is specified.
- [x] PostgreSQL remains the sole control-plane state and Web/runtime consume it.
- [x] DeepSeek schema/model/cost/privacy/error boundary is specified without assuming a key now.
- [x] Artifact/audit/revision invalidation/Owner review and media no-auto-approval are binary.
- [x] Flight fault/no-action evidence is mandatory.
- [x] Chinese/English business-first UI states, trace drawer, 390px, recovery, and UAT are covered.
- [x] M3 Grant/scheduler/operator/connector/action and business/customer/production claims are excluded.
- [x] Failure, recovery, rollback, dependency/license, secret, evidence, report, handoff, and Coordinator-owned progress are complete.

No unresolved clarification remains. M1 acceptance and Coordinator assignment satisfied the entry gate; the dedicated M2 Executor implemented the bounded slice without changing these requirements. Machine evidence supports an `EVIDENCE_READY` recommendation only; Owner UAT and Coordinator acceptance remain external gates.

## Change Request 2 checklist

- [x] Coordinator authorized only the bounded host-runner architecture; fake sequential Live and privileged always-on supervisor are excluded.
- [x] Persisted state, exact Mission/runtime binding, secret-file ingress, scoped tickets and model-task responsibilities are binary.
- [x] Mock/no-key engineering gates are separated from Coordinator-only live Canary evidence.
- [x] Zero ActionGrant/connector/external action, canonical-status ownership and M3 exclusion remain unchanged.

## CR2 Fix 1 checklist

- [x] Coordinator failure is reproduced as Node exit 13 at the second non-TTY `readline.question()`.
- [x] Exact four-field JSON, one-read stdin, captured child output and stable-code boundaries are specified.
- [x] Partial/malformed/extra input, marker non-disclosure and cleanup are binary acceptance conditions.
- [x] Owner Key, provider semantics, AgentTeams internals, canonical status and M3 remain out of scope.

## CR2 Fix 2 checklist

- [x] Coordinator evidence freezes the failure before Control Plane dispatch and explicitly rejects any Live Provider claim.
- [x] Stage/code/progress/receipt fields are allowlisted and exclude all raw child/provider/security material.
- [x] Host receipt persistence precedes cleanup, while normal public packages continue to exclude local `.evidence` state.
- [x] No-Secret controlled diagnosis, nested child stage tests, cleanup and zero-action conditions are binary.

## CR2 Fix 3 checklist

- [x] Third Canary and independent official probes freeze the failure after Project dispatch and before an accepted ModelCallSnapshot.
- [x] Existing stable provider/model/semantic codes, Task binding and forbidden raw fields are explicitly bounded.
- [x] The missing role-schema prompt binding is a verified concrete contract defect, not an assumed provider outage.
- [x] Worker broker URL is derived only from local HTTP loopback and reaches the Compose API from the actual AgentTeams container network.
- [x] HTTP/model/schema/semantic/broker/success fixtures, child non-disclosure, cleanup and zero-action are binary acceptance conditions.

## CR2 Fix 4 checklist

- [x] Fourth Canary evidence freezes the failure after three accepted model receipts at `PRODUCE_FOUNDER`; it is explicitly not a completed Live Provider verification.
- [x] Exact task-specific unordered platform sets, platform/content binding, correction source equality and closed audit issue shape are binary.
- [x] Server-derived revision/digest fields, normalize/audit strictness, Producer/Auditor separation and zero-action boundaries remain unchanged.
- [x] Positive order permutations and duplicate/wrong/mismatch/missing/extra/unknown-field negatives are required before the fifth Canary.

## CR2 Fix 5 checklist

- [x] Fifth and sixth Canary evidence freezes one repeated failure after five accepted model receipts and before the correction provider call; it is explicitly not a transient or Live Provider verification.
- [x] Pinned source and real Runtime evidence record correction as `pending/null/DELEGATE` and disprove the proposed auto-delegation cause; the old suppressed operation is explicitly left unrecoverable rather than guessed.
- [x] Pending/delegated/advanced/unknown transitions, exact Project/Task/member/attempt/digest binding, duplicate replay and stable redaction are binary.
- [x] Real six-member/eight-Task correction/re-audit, zero action, exact cleanup, full gates and Coordinator-only seventh Canary are mandatory.

## CR2 Fix 6 checklist

- [x] Public-safe reproduction executes the deterministic Leader plus FREEZE, PLAN, both Producers and independent initial Auditor through the same API ticket/model/runtime-event route.
- [x] Correct initial audit imports after the fifth model snapshot and persists exact X FAIL / other-platform PASS decisions before correction.
- [x] Structurally closed but frozen-invariant-invalid initial audit and re-audit outputs fail at the semantic Provider boundary without coercion.
- [x] Duplicate/replay, stale ETag, ticket scope, Task/role/attempt/digest/schema and persistence boundaries fail closed.
- [x] Only an allowlisted submission-import category may cross child/host diagnostics; forbidden raw/security/model markers remain absent.
- [x] Public-safe real AgentTeams six/eight, no-Secret Live, full verification, report, manifest and clean-Head ZIP pass with all action counts zero.
- [x] The eighth real-key Canary remains Coordinator-owned and is not represented as `LIVE_PROVIDER_VERIFIED` or `ACCEPTED`.

## CR2 Fix 7 checklist

- [x] Baseline-compatible production API reproduction reaches five model snapshots and proves the upstream-valid/downstream-invalid Founder phrase difference without using raw Canary output.
- [x] Founder generation schema requires the exact frozen phrase in an X post with the same ASCII case-insensitive semantics as normalization and materialization.
- [x] Omission, paraphrase, reversal, punctuation, cross-post split, alt-text/Xiaohongshu-only placement, Unicode lookalikes and unknown fields fail before AgentTeams submission without coercion.
- [x] Exact phrase/order/case positives and the independent X FAIL → correction → re-audit chain remain valid; all digests/revision numbers remain server-derived.
- [x] Public-safe real AgentTeams six/eight, no-Secret Live, full verification, report, manifest and clean-Head ZIP pass with ActionGrant/Connector/external action all zero.
- [x] The ninth real-key Canary remains Coordinator-owned and is not represented as `LIVE_PROVIDER_VERIFIED` or `ACCEPTED`.

## CR2 Fix 8 checklist

- [x] Baseline production API proves correction ACK-ticket denial only after exact initial Audit materializes four revisions/audits in `REVISION_REQUIRED`.
- [x] Baseline source and production API prove the same coarse-state denial applies to re-audit after exact correction materializes revision 2 in `AUDIT_BLOCKED`; the fixed production flow traverses that boundary.
- [x] ACK/model tickets are authorized only for the exact initial/correction/re-audit Task-kind and Mission-phase tuple, with all earlier bindings unchanged.
- [x] Wrong action, Task kind, phase, role, attempt, input digest, stale/consumed ticket, replay and initial-task later-phase access fail closed.
- [x] Exact public-safe seven-model-call flow reaches `AWAITING_OWNER_REVIEW` with five revisions/audits and ActionGrant/Connector/external action all zero.
- [x] Public-safe real AgentTeams six/eight, no-Secret Live, full verification, report, manifest and clean-Head ZIP pass.
- [x] The eleventh real-key Canary remains Coordinator-owned and is not represented as `LIVE_PROVIDER_VERIFIED` or `ACCEPTED`.
