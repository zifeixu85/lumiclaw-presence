# LumiClaw Presence Implementation Status

[English](IMPLEMENTATION-STATUS.md) | [简体中文](IMPLEMENTATION-STATUS.zh-CN.md) | [Architecture](ARCHITECTURE.md) | [Roadmap](ROADMAP.md)

> **Status source of truth:** This file is the canonical implementation progress register. `IMPLEMENTATION-STATUS.zh-CN.md` must mirror the same IDs and states in the same commit.
> **Snapshot:** 2026-08-03
> **Current phase:** M1 — Campaign walking skeleton
> **Current implementation truth:** The M0 local delivery foundation is implemented and accepted: reproducible monorepo, Docker Compose/PostgreSQL/BlobStore, Chinese-default bilingual Web shell, isolated AgentTeams adapter smoke, and quality gates. M1 business domains, live AgentTeams missions, providers, connectors and external actions remain unimplemented.

## Progress contract

Every module uses one state:

- `NOT_STARTED`: no implementation work has begun;
- `IN_PROGRESS`: a bounded SDD and active goal own the work;
- `BLOCKED`: a named dependency or owner decision prevents progress;
- `EVIDENCE_READY`: implementation and automated verification are complete, but required owner/user acceptance is pending;
- `ACCEPTED`: acceptance criteria, required tests, evidence report, and owner/user acceptance are complete;
- `DEFERRED`: intentionally moved out of the active milestone with rationale;
- `SUPERSEDED`: replaced by another module or SDD with a traceable decision.

Progress is the number of `ACCEPTED` modules divided by active modules. It is a delivery count, not an effort estimate. `EVIDENCE_READY` is never counted as accepted.

## Current summary

| Metric | Current value |
|---|---|
| Accepted modules | `7 / 39` (`17.9%`) |
| Evidence ready | `0 / 39` |
| Blocked | `0 / 39` |
| Active implementation SDD | `SDD-001 Campaign Walking Skeleton` — Executor task `019fc6d8-2c5a-76d3-b3ad-ddb96b56f62e` active |
| Earliest owner blocker | None for the next local M1 slice; provider credentials remain deferred to their SDDs |
| Next executable module | `M1-01` Organization, identity, brand, product, market and account graph — `IN_PROGRESS` |

## Milestone progress

| Milestone | State | Accepted | Current module mix | Exit evidence |
|---|---|---:|---|---|
| M0 — Delivery foundation | `ACCEPTED` | `7 / 7` | 7 accepted | [SDD-000 acceptance](docs/reports/acceptance/SDD-000-ACCEPTANCE.md) plus fresh Compose, migrations, CI mapping, isolated AgentTeams smoke and design/i18n evidence |
| M1 — Campaign walking skeleton | `IN_PROGRESS` | `0 / 6` | 1 in progress, 5 not started | Persisted campaign, four editable previews, schedule editor, shared control-plane state |
| M2 — Governed shadow campaign | `NOT_STARTED` | `0 / 6` | 6 not started | Six-member AgentTeams run, DeepSeek gateway, revision/audit, fault denial, trace |
| M3 — Controlled live activation | `NOT_STARTED` | `0 / 7` | 7 not started | Exact grants, persistent scheduler, Bluesky Direct, honest Handoffs, receipts/reconciliation |
| M4 — Response and learning | `NOT_STARTED` | `0 / 4` | 4 not started | Interaction → outcome → scoped learning → next mission, isolated SignalProvider PoC |
| M5 — Runnable candidate | `NOT_STARTED` | `0 / 5` | 5 not started | Fresh install, restore drill, conformance, accessibility, evidence export and demo |
| M6 — External calibration | `NOT_STARTED` | `0 / 4` | 4 not started | Design-partner shadow run, isolation, reliability and external acceptance report |

## Module register

### M0 — Delivery foundation

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M0-01 | Product, platform and technical architecture documentation | `ACCEPTED` | Complete | [Accepted baseline report](docs/reports/acceptance/M0-01-ARCHITECTURE-BASELINE-ACCEPTANCE.md) |
| M0-02 | Root license and contribution policy | `ACCEPTED` | Complete | [Accepted Apache-2.0 and dependency-policy report](docs/reports/acceptance/M0-02-LICENSE-AND-DEPENDENCY-POLICY-ACCEPTANCE.md) |
| M0-03 | Node/TypeScript monorepo and locked package baseline | `ACCEPTED` | SDD-000 | [Reproducible install, lockfile, version and license evidence](docs/reports/acceptance/SDD-000-ACCEPTANCE.md) |
| M0-04 | Docker Compose, PostgreSQL migrations and local BlobStore | `ACCEPTED` | M0-03 | [Fresh/failure/recovery/persistence evidence](docs/reports/acceptance/SDD-000-ACCEPTANCE.md) |
| M0-05 | Next.js shell, `next-intl`, design tokens and five-screen routes | `ACCEPTED` | M0-03 | [Bilingual route, browser, Storybook and committed Pencil evidence](docs/reports/acceptance/SDD-000-ACCEPTANCE.md); mobile/visual refinement deferred |
| M0-06 | Isolated AgentTeams runtime profile and adapter smoke | `ACCEPTED` | M0-04 | [Pinned image and controlled adapter evidence](docs/reports/acceptance/SDD-000-ACCEPTANCE.md); no live mission claim |
| M0-07 | CI, secret scan, SBOM and status/report checks | `ACCEPTED` | M0-03 | [Local full-gate evidence](docs/reports/acceptance/SDD-000-ACCEPTANCE.md); remote CI not claimed |

### M1 — Campaign walking skeleton

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M1-01 | Organization, identity, brand, product, market and account graph | `IN_PROGRESS` | M0 accepted; SDD-001 | Schema, migrations, tenant-aware constraints and negative fixtures |
| M1-02 | Campaign, activation, claim and evidence contracts | `NOT_STARTED` | M1-01 | Versioned JSON Schemas, canonical digests and invalid-scope rejection |
| M1-03 | Campaign API, persistence and reopen flow | `NOT_STARTED` | M1-01, M1-02 | REST/OpenAPI, idempotency, ETag/version conflict and database integration tests |
| M1-04 | Five-screen Web shell and readiness journey | `NOT_STARTED` | M0-05, M1-03 | Empty/loading/blocked/owner/recovery states in English and Chinese |
| M1-05 | Four-platform editable composer and native-like previews | `NOT_STARTED` | M1-02, M1-04 | X, Bluesky, LinkedIn and Xiaohongshu fixtures, constraints and visual tests |
| M1-06 | Schedule editor and persistent schedule model | `NOT_STARTED` | M1-03, M1-04 | One-time/RRULE input, IANA time zone, DST and misfire validation; no external action |

### M2 — Governed shadow campaign

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M2-01 | AgentTeams Runtime Adapter and shared mission state | `NOT_STARTED` | M0-06, M1-02 | Project/task lifecycle, ACK/Submit, digest import and restart recovery |
| M2-02 | Six-member AgentTeam and locked Skills | `NOT_STARTED` | M2-01 | Leader plus five domain members, context/permission separation and SkillLock |
| M2-03 | DeepSeek ModelProvider gateway | `NOT_STARTED` | M0-07 | Structured output, model/cost snapshot, timeout/retry and privacy-safe fixtures |
| M2-04 | Artifact revision, independent audit and owner review | `NOT_STARTED` | M1-05, M2-02 | Re-audit invalidation, producer/auditor separation and revision diff E2E |
| M2-05 | Media assets and EvoLink adapter boundary | `NOT_STARTED` | M0-04, M2-03 | Async mock/Canary, content-addressed ingest, rights/cost receipt and no auto-approval |
| M2-06 | Trace, ledger and Flight fault denial | `NOT_STARTED` | M2-02, M2-04 | Claim/constraint fault is blocked with replayable, public-safe evidence |

### M3 — Controlled live activation

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M3-01 | Signed ActionGrant, transactional outbox and no-LLM operator | `NOT_STARTED` | M2-04 | Replay/expiry/revocation/digest failures close; unique attempt enforced |
| M3-02 | Persistent scheduler execution and occurrence recovery | `NOT_STARTED` | M1-06, M3-01 | Due occurrence leasing, restart recovery, DST/misfire tests and no perpetual grant |
| M3-03 | Bluesky official Direct connector | `NOT_STARTED` | M3-01 | Native URI/CID read-back, duplicate prevention and unknown reconciliation |
| M3-04 | LinkedIn Native Handoff | `NOT_STARTED` | M3-01 | Exact preview/package, steps and URL reconciliation; never false `PUBLISHED` |
| M3-05 | Xiaohongshu content-package Handoff | `NOT_STARTED` | M1-05, M3-01 | Copy/download package, native completion and URL/safe-screenshot reconciliation |
| M3-06 | X official Direct Canary or explicit fallback | `NOT_STARTED` | M3-01, owner credentials | OAuth/scope/budget/failure/read-back gates or a truthful Handoff result |
| M3-07 | Receipt timeline and reconciliation UX | `NOT_STARTED` | M3-02–M3-06 | Published/handoff/failed/unknown states, no blind retry and owner-readable evidence |

### M4 — Response and learning

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M4-01 | Interaction ingestion and normalization | `NOT_STARTED` | M3-03 | One real or controlled-real interaction with privacy-safe raw/normalized split |
| M4-02 | Outcome and disposition decision | `NOT_STARTED` | M4-01 | Owner decision, no automatic lead inflation and auditable state transition |
| M4-03 | LearningProposal, scoped memory and next-mission reuse | `NOT_STARTED` | M4-02 | Accept/reject/rollback, scope isolation and exact reuse evidence |
| M4-04 | Isolated third-party SignalProvider PoC | `NOT_STARTED` | M0-07 | One concrete provider passes purpose/terms/quarantine/schema/PII/retention gates |

### M5 — Runnable candidate

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M5-01 | Fresh Docker install and upgrade path | `NOT_STARTED` | M0–M4 | New machine runs normal and fail-closed paths without hidden developer services |
| M5-02 | Backup, restore and unknown-action recovery drill | `NOT_STARTED` | M5-01 | Empty-database restore, Blob digest verification and no automatic resend |
| M5-03 | Complete UI state matrix, i18n and accessibility | `NOT_STARTED` | M1–M4 | English/Chinese parity, visual regression, keyboard navigation and axe checks |
| M5-04 | Provider and connector conformance suite | `NOT_STARTED` | M3, M4-04 | Success/failure/timeout/unknown/duplicate/capability cases with public-safe fixtures |
| M5-05 | Agent ablation, evidence export and stable Hero demo | `NOT_STARTED` | M5-01–M5-04 | Same-condition comparison, allowlist export and repeatable demo runbook |

### M6 — External calibration

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M6-01 | Design-partner shadow campaign | `NOT_STARTED` | M5 accepted | Partner uses their own goal/material and completes the defined decision protocol |
| M6-02 | Tenant, role and data-isolation hardening | `NOT_STARTED` | M6-01 | Cross-tenant negative tests, retention/deletion and delegated review boundaries |
| M6-03 | Reliability, observability and cost hardening | `NOT_STARTED` | M5-04, M6-01 | SLO baseline, recovery evidence, provider/model cost and failure distribution |
| M6-04 | External acceptance and claims report | `NOT_STARTED` | M6-01–M6-03 | Signed/recorded result, allowed claims, rejected claims and next decision |

## Mandatory task protocol

Each new milestone or bounded SDD runs in a separate Codex task coordinated by the primary project task:

1. Read `AGENTS.md`, this register, `ARCHITECTURE.md`, `ROADMAP.md`, and the relevant SDD before changing code.
2. The coordinator selects exact module IDs, verifies dependencies, creates the executor task, and assigns one goal for the SDD.
3. Before dispatch, the coordinator updates only the currently executable module to `IN_PROGRESS` in both language files.
4. Implement only the SDD scope; record discoveries that change scope instead of silently expanding it.
5. Run the acceptance matrix and create a Chinese `docs/reports/acceptance/SDD-NNN-ACCEPTANCE.md` from the report template.
6. List which checks the owner can perform, with prerequisites, exact steps, expected results, and evidence to return.
7. Set `EVIDENCE_READY` when machine verification is complete but owner acceptance remains. Set `ACCEPTED` only after all required acceptance is recorded.
8. The executor returns a structured status handoff. The coordinator independently verifies it, integrates approved work, and updates this register, the Chinese mirror, evidence links, blockers and next module.

The current source task is never allowed to declare completion only in chat while leaving this register stale.
