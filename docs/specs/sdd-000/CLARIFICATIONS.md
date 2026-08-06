# SDD-000 Clarifications

| ID | Question | Resolution | Evidence / effect |
|---|---|---|---|
| CL-01 | May this Executor change canonical progress states? | No. | Coordinator owns both implementation registers. Checks are read-only. |
| CL-02 | Does M0 implement Campaign business behavior? | No. | UI is explicit `DEMO_SEED / NOT_LIVE`; only route/state scaffolding is allowed. |
| CL-03 | Is a real database migration allowed? | Only a project-scoped local Docker test database. | No external/production database or real user data. |
| CL-04 | Does M0 require provider credentials? | No. | Provider/model/platform calls are excluded. Secret interfaces are not populated. |
| CL-05 | Can the existing AgentTeams environment be reused? | No. | It has prohibited host-share/socket/public-worker-port characteristics. |
| CL-06 | What does AgentTeams smoke prove? | Image identity, isolation policy, capability/version parsing, TeamProfile topology contract, and adapter failure semantics. | It must not be reported as a live LLM AgentTeam Mission. |
| CL-07 | Is Spec Kit CLI required? | No. | Use lifecycle artifacts directly; avoid a second generated rule surface. |
| CL-08 | How is Pencil handled? | Only through Pencil MCP, with exported review artifacts. | Never parse or create `.pen` through ordinary filesystem writes. |
| CL-09 | What state follows machine success? | Proposed `EVIDENCE_READY`. | Owner/Coordinator acceptance is still pending. |
| CL-10 | What is the default UI locale? | `zh-CN`; `en` is the second shareable locale. | Locale, content language, market, and timezone remain separate concepts. |
