# SDD-002 CR2 Fix 2 — Live pre-dispatch stage diagnostics

Status: `SPEC_READY` after Coordinator failure evidence `COORDINATOR_FIX_REQUEST_2` on 2026-08-04.

## Verified boundary

The Coordinator's second real Canary used clean Head `8cbb0a85b73cdc73f48d489b66e200f24e3e3562`. Strict stdin transport, hidden Secret ingress, Compose health/inspect, one persisted Live Mission, exact six-member AgentTeams startup, terminal non-disclosure and exact cleanup all passed. The Mission remained `WAITING_RUNTIME`, with zero model receipts and zero external actions, until the nested Runner exited after roughly two minutes. No `deepseek-live-canary.json` was created. This attempt did not verify DeepSeek and does not prove that a provider request occurred.

The existing Runner can fail at Mission open, runtime identity, topology, Project create, DAG plan, member binding or dispatch, but both child boundaries collapse every nonzero exit into `LIVE_DEEPSEEK_UAT_RUNNER_FAILED`. Cleanup then removes the ephemeral AgentTeams and PostgreSQL state. The reported Web state therefore cannot distinguish a Project that was never created, a DAG that was not planned, or a Project whose dispatch receipt was rejected.

## Bounded correction

- The Runner owns one allowlisted stage state machine: `MISSION_OPEN`, `RUNTIME_IDENTITY`, `TOPOLOGY`, `PROJECT_CREATE`, `DAG_PLAN`, `MEMBER_BINDING`, `PROJECT_DISPATCH`, `TASK_PROTOCOL`, `PROVIDER_REQUEST`, and `FINALIZE`.
- Every failure maps the current stage to one stable code. No arbitrary exception, child stdout/stderr, prompt, model output, response body, bootstrap, ticket, header or bearer value crosses a process boundary.
- Before cleanup, the failing layer atomically writes `.evidence/sdd-002/deepseek-live-failure.json`. It binds the clean Git Head/branch/base, Mission/Campaign identifiers, stage/code, public runtime identity, progress booleans, model-receipt count, zero-action counters, `mockFallback=false`, `secretPresent=false`, and `liveProviderVerified=false`.
- The environment verifier and top launcher parse and reconstruct only the exact allowlisted failure envelope. They validate the persisted receipt, perform their owned cleanup, and update only bounded cleanup status. A malformed or contradictory child envelope fails closed as a generic stable boundary error.
- Public source ZIPs, manifests and normal engineering evidence exclude `.evidence/`; a failed Canary receipt may be returned separately to the Coordinator only after secret/forbidden-marker validation.
- Conformance invokes the real nested child-process transport for every stage and verifies that dummy bootstrap, ticket, Authorization/Bearer and raw-response markers never appear in stdout, stderr or the persisted receipt.
- A no-Owner-Key controlled run may mount an intentionally unavailable provider secret, exercise the exact pinned six-member Project/DAG/dispatch path, and stop at the broker boundary. It is infrastructure diagnosis only, never a real provider or business claim.

## Binary acceptance additions

1. Every allowlisted Runner stage has exactly one stable code and an exact strict envelope/receipt schema.
2. The receipt exists on the host before AgentTeams/Compose cleanup and survives that cleanup.
3. `projectCreated`, `dagPlanned`, and `projectDispatched` distinguish pre-dispatch boundaries without exposing runtime content.
4. Nested child tests cover every stage plus malformed/extra/contradictory envelopes and scan stdout, stderr and receipt bytes for forbidden markers.
5. A controlled no-Secret run either identifies and fixes a concrete pre-dispatch defect or proves the pinned path reaches a fail-closed provider boundary; neither outcome is labeled `LIVE_PROVIDER_VERIFIED`.
6. ActionGrant, Connector and external-action counts remain exactly zero; no Mock fallback, Docker socket, canonical-status edit, deployment or M3 work is introduced.

## Out of scope

Owner Secret access, a third-party provider call, preservation of raw provider responses, AgentTeams Manager/Worker/Matrix modification, an always-on runtime supervisor, publication and external platform execution remain prohibited.
