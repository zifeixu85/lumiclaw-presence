# SDD-001 requirements checklist

## Requirements and scope

- [x] Owner problem, visible outcome, and M1 reason are explicit.
- [x] M1-01 through M1-06 are ordered and no prerequisite is skipped.
- [x] In/out-of-scope and existing M0 behavior are explicit.
- [x] Every acceptance criterion is binary and has a named evidence layer.
- [x] M2 preparation is spec-only and live actions/providers remain excluded.

## Domain, tenancy, API, and history

- [x] Required graph/Campaign/Schedule contracts and exact four ActivationUnits are named.
- [x] Organization scope appears on requests, rows, FKs, fixtures, and negative tests.
- [x] Canonical digest inclusion/exclusion and mutation behavior are specified.
- [x] Claim expiry/revocation/Product/Market/Evidence errors are specified.
- [x] PostgreSQL history, idempotency, ETag/version conflict, OpenAPI, and shared-state client paths are specified.
- [x] No page/localStorage/in-memory success path exists.

## Product, i18n, platform, and time

- [x] Empty/loading/blocked/needs-owner/saved/conflict/recovery/non-live states are defined.
- [x] Chinese default, English deep links, stable codes, and four independent locale/language/market/time fields are preserved.
- [x] Four editable models/previews have distinct required behavior.
- [x] Constraints are versioned server state and preview does not imply capability.
- [x] ONCE/RRULE, IANA, UTC, gap/fold, misfire, and edit invalidation semantics are explicit.
- [x] 390px document overflow is a binary acceptance criterion.

## Security, dependency, evidence, and claims

- [x] No secret, real account/customer/private data, provider call, platform action, or live Agent run is needed.
- [x] No new dependency is planned; any exception has a fail-closed review gate.
- [x] Compose migration/recovery/cleanup remains project-scoped.
- [x] Source ZIP allow/deny scan and ChatGPT Pro untrusted-review flow are specified.
- [x] Chinese report, Owner UAT, rollback, non-claims, proposed states, and structured handoff are required.
- [x] Canonical implementation status files remain read-only.

## Readiness decision

No `[NEEDS CLARIFICATION]` marker remains. The requirements, plan, tests, failure paths, and owner-visible outcomes are executable without new authority or credentials.

## Convergence checklist

- [x] All 16 acceptance criteria map to concrete automated, PostgreSQL/Compose, browser, or documented Owner evidence.
- [x] ChatGPT Pro findings were treated as untrusted input, independently checked, corrected where valid, and reverified.
- [x] PostgreSQL/API idempotency, ETag, tenant isolation, invalid scope, digest reopen, temporal readiness, schedule DST/misfire/invalidation, and recovery have positive and negative coverage.
- [x] Four platform stories and real-browser previews expose persisted context and constraints; `390 × 844` has no document-level overflow.
- [x] Secret/license/SBOM/source-package gates are fail-closed and machine evidence is content-validated before maturity is written.
- [x] Chinese acceptance report includes exact commands, failures/fixes, limitations, rollback, Owner UAT, claims, and status proposal.
- [x] Both canonical implementation progress files remain unchanged.
- [x] M2 Epic SDD remains `SPEC_READY` and no M2 code, provider, AgentTeams Mission, or external action was implemented.

Closeout result: `EVIDENCE_READY`; Coordinator/Owner acceptance remains pending.
