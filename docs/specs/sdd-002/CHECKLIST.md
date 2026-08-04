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
