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
