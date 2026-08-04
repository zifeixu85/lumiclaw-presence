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
| CL-11 | CR2 Live is a Coordinator-started local UAT runner bound to one Mission; an always-on Web-triggered supervisor is deferred to another SDD. |
| CL-12 | CR2 Key and bootstrap ingress are Compose secret files only; Workers/runner never receive the Key, and runtime tickets are short-lived, scoped and non-persistent. |
| CL-13 | Leader coordination is deterministic. Only the seven domain Task attempts call the provider, with an independent Auditor prompt/schema and receipt. |
| CL-14 | CR2 Fix 1 replaces the four-question non-TTY protocol with one strict four-field JSON document read once from fd 0 at each transport boundary; raw child output is never inherited. |
| CL-15 | Live transport failures disclose only allowlisted stable codes. Bootstrap/ticket values remain in memory and captured pipes only, and never enter arguments, environment, logs, evidence or error text. |
| CL-16 | CR2 Fix 2 persists an allowlisted stage failure receipt on the host before ephemeral cleanup; it contains only clean-Head/Mission/runtime/progress/no-action metadata and is excluded from public source/evidence packages. |
| CL-17 | A no-Owner-Key controlled run may prove Project/DAG/dispatch and then stop at the unavailable provider broker. It is infrastructure diagnosis, not `LIVE_PROVIDER_VERIFIED`, and cannot silently fall back to Mock. |
