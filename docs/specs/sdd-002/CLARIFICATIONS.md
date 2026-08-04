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
| CL-18 | CR2 Fix 3 may expose one nullable allowlisted `providerOutcomeCode` derived from the exact persisted Task failure before cleanup; raw HTTP/model/security material remains forbidden. |
| CL-19 | The exact role output schema must be present in the DeepSeek prompt and input digest. Local validation against a schema that the model never received is not a valid structured-output contract. |
| CL-20 | A Coordinator local loopback Control Plane URL is host-only; the Runner derives a Worker-only `host.docker.internal` origin from a strict HTTP loopback URL. Arbitrary remote origins, credentials, paths, query strings and fragments fail closed. |
| CL-21 | CR2 Fix 4 replaces clone/delete generation schemas with closed task-specific schemas that encode exact unordered platform sets and platform/content-kind binding before a Provider result can reach normalization. |
| CL-22 | The correction generation schema binds content to the exact source X content in the server-owned task projection; revision numbers and all digests remain deterministic server derivations and are invalid model fields. |
| CL-23 | CR2 Fix 5 treats AgentTeams persisted Task state as an observed input: only `pending` may be delegated, while an exact already-`delegated` dependent Task proceeds to ACK without re-delegation. The `assigned` label is limited to a successful delegate response. |
| CL-24 | Runtime recovery never repeats domain/model work from state alone. `in_progress`, `submitted` or `completed` may reconcile only when exact Project/Task/member/attempt/contract and PostgreSQL ACK/submission/accepted-output receipts agree; contradictions fail closed with no Mock fallback. |
| CL-25 | CR2 Fix 6 treats the frozen initial-audit and re-audit business invariants as Provider semantic-contract inputs, not only post-import materialization checks. A structurally valid but invariant-invalid model response fails before `TASK_SUBMIT` and is never coerced. |
| CL-26 | Live submission-import diagnostics may expose only one nullable allowlisted category derived from a stable API status/code pair. Raw response/details, arbitrary code text, ticket, prompt/model material, headers, bootstrap and Secret remain excluded. |
| CL-27 | CR2 Fix 7 treats the frozen Founder phrase as a task-output semantic invariant shared by generation, normalization and materialization. A Provider response may not defer this check until the independent Auditor `TASK_SUBMIT`; invalid text fails before AgentTeams submission and is never rewritten. |
| CL-28 | The eighth Canary proves only the late allowlisted domain-invariant category after five receipts. Public-safe reproduction may prove a defect class, but without raw output it must not claim that omission or paraphrase was the historical response. |
