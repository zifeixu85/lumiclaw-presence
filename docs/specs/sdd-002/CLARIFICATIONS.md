# SDD-002 Clarifications

| ID | Resolution |
|---|---|
| CL-01 | M2 starts only after Coordinator accepts M1; this SDD preparation does not start M2 implementation. |
| CL-02 | Exactly six real AgentTeams members are required; Manager, Owner, and Operator do not count. |
| CL-03 | Presence Mission Leader coordinates only and cannot produce Claim, plan, platform content, or audit. |
| CL-04 | DeepSeek is accessed only through ModelProvider; supported model names are reverified at implementation time. |
| CL-05 | A provider/mock result is not a live AgentTeams or business claim; every evidence layer is labeled. |
| CL-06 | Media generation may be mock/Canary-bounded, but ingest/digest/rights/cost/no-auto-approval contracts are mandatory. |
| CL-07 | Audit PASS still requires human Owner review and cannot create an ActionGrant. |
| CL-08 | Fault denial requires no external action path to exist, not merely a mocked connector returning failure. |
| CL-09 | AgentTeams internal state is never the only copy; restart recovery begins from PostgreSQL and reconciles runtime state. |
| CL-10 | Executor proposes `EVIDENCE_READY`; Coordinator/Owner decide canonical acceptance. |

