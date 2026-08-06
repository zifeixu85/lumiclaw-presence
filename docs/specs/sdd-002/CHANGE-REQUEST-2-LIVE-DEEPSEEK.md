# SDD-002 Change Request 2 — Live DeepSeek local UAT

Status: `SPEC_READY` after Coordinator decision `COORDINATOR_DECISION_CR2` on 2026-08-04.

## Bounded outcome

Add an explicit `PUBLIC_SAFE_MOCK` versus `LIVE_DEEPSEEK_UAT` choice to the existing governed SHADOW Mission. The Live choice is a local, Coordinator-started Canary: one exact persisted Mission is executed by the pinned six-member AgentTeams runtime, domain model tasks call DeepSeek through a server-only broker, and the redacted task receipts are persisted in the single PostgreSQL Control Plane. It is not an always-on production runtime and never creates an ActionGrant, connector, schedule execution, publication, comment, reply, DM, scrape, or other external platform action.

## Clarified architecture boundary

- The existing deterministic `public-safe-flight` remains an honestly labeled Mock path.
- A sequential Web/API DeepSeek call followed by deterministic materialization is forbidden because it is not a real six-member AgentTeams run.
- The API and Web receive no Docker socket. A host-side UAT runner is started explicitly by the Coordinator and binds one Mission ID, one Campaign digest, the pinned AgentTeams source/build digest and exact image digests.
- A future always-on Web-triggered AgentTeams supervisor is deferred to a separate SDD.
- The API reads the Owner API key only from `/run/secrets/deepseek_api_key`. AgentTeams Workers and the host runner never receive it.
- The API reads a separate UAT bootstrap credential only from `/run/secrets/lumiclaw_runtime_broker_bootstrap`. It exchanges that credential for short-lived, single-Mission, single-role, single-task, single-attempt, single-action tickets. Only ticket hashes exist in API memory; ticket values are never persisted or logged. A restart invalidates every ticket and fails closed.

## Persisted state contract

Live Missions use the recoverable states `QUEUED`, `WAITING_RUNTIME`, `RUNNING`, `FAILED`, `AWAITING_OWNER_REVIEW`, and `COMPLETED_SHADOW`. Refresh/reopen reads these states, task states, failure code, responsibility and redacted receipts from PostgreSQL. No front-end timer or in-memory progress is authoritative.

The Mission records `providerMode`, `providerModel`, provider maturity, expected Campaign digest and fixed runtime source/build/image digests. It never records a secret or raw bearer ticket. Missing key, absent runner, interrupted runner, provider error, invalid structured output, receipt mismatch or expired ticket produces a visible fail-closed state and never falls back to Mock.

## Model task assignment

`PROJECT_COORDINATION` is deterministic and Leader-only; the Leader has no model call. The five domain roles call the model for `FREEZE_EVIDENCE`, `PLAN_CAMPAIGN`, `PRODUCE_FOUNDER`, `PRODUCE_PRODUCT`, `AUDIT_REVISIONS`, `PRODUCE_FOUNDER_CORRECTION`, and `REAUDIT_CORRECTION`. Each call uses its own closed role projection, role prompt and output schema. Producer and Independent Auditor receipts are distinct and bound to the exact Task/attempt/input/output digests.

## Acceptance additions

1. Mock and Live are explicit in API and zh-CN/en UI; neither can be mislabeled.
2. Live progress survives refresh and provides Chinese next action/responsibility on wait or failure.
3. No-key, stopped-runner, expired/reused/wrong-scope ticket, provider failure, schema failure, digest mismatch and interrupted-runner tests fail closed without Mock fallback.
4. Compose inspect, client bundle, log/trace/evidence, source package and secret scan reveal no key or bearer value.
5. Coordinator can inject secrets interactively without placing them in command arguments or shell history, then run one exact-Mission Canary and retain only redacted evidence.
6. The resulting four platform revisions, independent fault rejection, correction, re-audit and exact non-executable Owner Review are visible; every external-action counter remains zero.

## Maturity and non-claims

Code, contract tests, secret ingress, redaction, Mock conformance and browser behavior may reach `ENGINEERING_VERIFIED`. A real call is `LIVE_PROVIDER_VERIFIED` only after the Coordinator independently supplies a local secret and records redacted Canary evidence. This change does not claim production runtime readiness, business outcome, customer UAT, platform publication, or M3 capability.
