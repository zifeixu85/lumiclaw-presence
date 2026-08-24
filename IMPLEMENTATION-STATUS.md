# LumiClaw Presence Implementation Status

[English](IMPLEMENTATION-STATUS.md) | [简体中文](IMPLEMENTATION-STATUS.zh-CN.md) | [Architecture](ARCHITECTURE.md) | [Roadmap](ROADMAP.md)

> **Status source of truth:** This file is the canonical implementation progress register. `IMPLEMENTATION-STATUS.zh-CN.md` must mirror the same IDs and states in the same commit.
> **Snapshot:** 2026-08-24
> **Current phase:** M5 local dogfood chain; the SDD-012 A5 receipt-authority plumbing is merged, and `M5-11` remains active for real-provider, real-A5 and Owner UAT convergence before `SDD-011` full dogfood/recovery/recording
> **Current implementation truth:** M0 and M1 are accepted. M2-01 through M2-07 are implemented and engineering-verified, including the pinned six-member AgentTeams shadow path and the sourced market-context foundation; their Owner UAT is pending. `SDD-004` through `SDD-010` now provide engineering-verified non-executing manual-package, market-context, production UX/onboarding, guided knowledge, persistent Goal/Plan/selected-platform compilation, governed X/Xiaohongshu artifact/audit/package foundations, and a persistent local AgentTeams control plane. `SDD-007` was independently reverified and merged at PR #18; its fixed-version six-member runtime, terminal-only Secret broker, PostgreSQL jobs/leases, dispatch and recovery are `EVIDENCE_READY`, not accepted. The independently verified SDD-012 media foundation was merged in PR #22. PR #24 then added exact accepted/completion-confirmed A5 task/output receipt validation, closed request-only audit APIs, append-only Owner visual review, exact OwnerDecision/package bindings and migration-16 rollback guards. This plumbing is engineering-verified, but the machine evidence intentionally contains no real DeepSeek run, real accepted A5 receipt, real media-provider canary or operational package; controlled fixtures remain non-authoritative. M5-11 therefore stays `IN_PROGRESS` until the terminal-only real-provider/real-A5 path and required Owner visual/binary UAT pass. No current slice authorizes automated publication, platform credentials in the browser, `PUBLISHED`, external-user results, business outcomes or legal-compliance guarantees.

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
| Accepted modules | `13 / 48` (`27.1%`) |
| Evidence ready | `13 / 48` |
| Blocked | `0 / 48` |
| Active implementation SDD | `SDD-012` / `M5-11`: real-provider, real-A5 receipt and Owner visual/binary UAT convergence for governed Xiaohongshu media |
| Earliest owner blocker | Owner must supply the model/media-provider secrets only through the terminal, approve a bounded test budget, and execute the documented real-A5 plus visual/binary UAT; SDD-007 recovery/browser UAT also remains pending |
| Next executable module | Execute the conditional-live `SDD-012` / `M5-11` UAT with a real accepted A5 receipt; `SDD-011` / `M5-10` dogfood and recording remains gated |

## Milestone progress

| Milestone | State | Accepted | Current module mix | Exit evidence |
|---|---|---:|---|---|
| M0 — Delivery foundation | `ACCEPTED` | `7 / 7` | 7 accepted | [SDD-000 acceptance](docs/reports/acceptance/SDD-000-ACCEPTANCE.md) plus fresh Compose, migrations, CI mapping, isolated AgentTeams smoke and design/i18n evidence |
| M1 — Campaign walking skeleton | `ACCEPTED` | `6 / 6` | 6 accepted | [SDD-001 acceptance](docs/reports/acceptance/SDD-001-ACCEPTANCE.md): persisted campaign, four editable previews, schedule editor, shared control-plane state; final visual/interaction refinement remains planned |
| M2 — Governed shadow campaign | `IN_PROGRESS` | `0 / 7` | 7 evidence ready | Six-member AgentTeams run, DeepSeek gateway/Canary, revision/audit, fault denial, trace, sourced market context; Owner UAT pending |
| M3 — Controlled live activation | `IN_PROGRESS` | `0 / 8` | 1 non-executing foundation evidence ready; 7 not started | Exact grants, persistent scheduler, Bluesky Direct, honest Handoffs, receipts/reconciliation |
| M4 — Response and learning | `NOT_STARTED` | `0 / 4` | 4 not started | Interaction → outcome → scoped learning → next mission, isolated SignalProvider PoC |
| M5 — Runnable candidate | `IN_PROGRESS` | `0 / 12` | 5 evidence ready, 1 in progress, 6 not started | Knowledge, Goal, governed X/XHS artifacts and persistent AgentTeams runtime are evidence ready; actual Xiaohongshu media is active, followed by fresh install, recovery and narrated dogfood evidence |
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
| M1-01 | Organization, identity, brand, product, market and account graph | `ACCEPTED` | M0 accepted; SDD-001 | [Schema, migrations, tenant-aware constraints and negative fixtures](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-02 | Campaign, activation, claim and evidence contracts | `ACCEPTED` | M1-01 | [Versioned schemas, canonical digests and invalid-scope rejection](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-03 | Campaign API, persistence and reopen flow | `ACCEPTED` | M1-01, M1-02 | [REST/OpenAPI, idempotency, ETag/version conflict and database integration](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-04 | Five-screen Web shell and readiness journey | `ACCEPTED` | M0-05, M1-03 | [English/Chinese real-state journey and Owner-accepted functional-shell boundary](docs/reports/acceptance/SDD-001-ACCEPTANCE.md); `UX-M1-001` deferred to interaction convergence |
| M1-05 | Four-platform editable composer and native-like previews | `ACCEPTED` | M1-02, M1-04 | [X, Bluesky, LinkedIn and Xiaohongshu fixtures, constraints and real browser evidence](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-06 | Schedule editor and persistent schedule model | `ACCEPTED` | M1-03, M1-04 | [One-time/RRULE, IANA time zone, DST/misfire and invalidation evidence](docs/reports/acceptance/SDD-001-ACCEPTANCE.md); no external action |

### M2 — Governed shadow campaign

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M2-01 | AgentTeams Runtime Adapter and shared mission state | `EVIDENCE_READY` | M0-06, M1-02; SDD-002 | Real Project/task lifecycle, ACK/Submit, digest import, reconciliation and restart evidence; Owner UAT pending |
| M2-02 | Six-member AgentTeam and locked Skills | `EVIDENCE_READY` | M2-01 | Exact Leader plus five domain members, separated context/permissions, and five locked Skills verified |
| M2-03 | DeepSeek ModelProvider gateway | `EVIDENCE_READY` | M0-07 | Structured output, cost/config snapshots, bounded retry/finish-reason policy, redaction, and local live Canary verified |
| M2-04 | Artifact revision, independent audit and owner review | `EVIDENCE_READY` | M1-05, M2-02 | Immutable revision, initial FAIL, correction, independent re-audit, and exact non-executable review verified |
| M2-05 | Media assets and EvoLink adapter boundary | `EVIDENCE_READY` | M0-04, M2-03 | Content-addressed ingest, rights/cost receipt, and no-auto-approval contract verified; EvoLink live Canary pending |
| M2-06 | Trace, ledger and Flight fault denial | `EVIDENCE_READY` | M2-02, M2-04 | Frozen claim fault denial, replay, immutable trace/ledger, and zero external action verified |
| M2-07 | Market localization knowledge packs and scoped Agent context | `EVIDENCE_READY` | M1-02, M2-02; SDD-005 | Sourced US/JP/DE public-safe packs, Organization override fixture, deterministic context/digest, Producer/Auditor projections and isolated evidence; Owner UAT pending |

### M3 — Controlled live activation

| ID | Module | State | Dependency | Required evidence / acceptance |
|---|---|---|---|---|
| M3-00 | Multi-platform activation capability and assisted-handoff foundation | `EVIDENCE_READY` | M1-05, M2-04; SDD-004 | Six-platform truthful registry, deterministic desktop manual packages, exact package digest, no false `PUBLISHED`, zero external action; Owner UAT pending |
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
| M5-00 | Production UX 1.4 and local onboarding foundation | `EVIDENCE_READY` | M0-05, M1-03–M1-06, M2-02, M2-04; SDD-006 | Local display-name entry, example/real-material onboarding, authoritative desktop shell, truthful runtime/account/manual-publish states and accessibility are engineering verified; Owner visual UAT pending |
| M5-01 | Fresh Docker install and upgrade path | `NOT_STARTED` | M0–M4 | New machine runs normal and fail-closed paths without hidden developer services |
| M5-02 | Backup, restore and unknown-action recovery drill | `NOT_STARTED` | M5-01 | Empty-database restore, Blob digest verification and no automatic resend |
| M5-03 | Complete UI state matrix, i18n and accessibility | `NOT_STARTED` | M1–M4 | English/Chinese parity, visual regression, keyboard navigation and axe checks |
| M5-04 | Provider and connector conformance suite | `NOT_STARTED` | M3, M4-04 | Success/failure/timeout/unknown/duplicate/capability cases with public-safe fixtures |
| M5-05 | Agent ablation, evidence export and stable Hero demo | `NOT_STARTED` | M5-01–M5-04 | Same-condition comparison, allowlist export and repeatable demo runbook |
| M5-06 | Guided persona, knowledge and account onboarding | `EVIDENCE_READY` | M5-00, M2-07; SDD-008 | Versioned founder persona, organization/product facts, X/XHS account operating profiles, multi-source MD/TXT/free-text intake, explicit conflict resolution and approved KnowledgeSnapshot; engineering verification complete, Owner UAT pending |
| M5-07 | Persistent Goal, Agent-generated plan and selected-platform compiler | `EVIDENCE_READY` | M5-06; SDD-009 | Persistent 7/30-day Goal, versioned controlled Planner submission plus exact Owner approval, scoped invalidation/recovery, and deterministic Mission bundles only for selected X/XHS accounts; Owner UAT pending |
| M5-08 | Persistent local AgentTeams runtime and Secret broker | `EVIDENCE_READY` | M5-07, M5-09; SDD-007 | Fixed-version six-member runtime, terminal-only Secret broker, PostgreSQL jobs/leases, dispatch, restart and recovery are independently engineering-verified and merged in PR #18; real DeepSeek and Owner UAT pending |
| M5-09 | X/XHS artifacts, independent audit and manual PublishPackage | `EVIDENCE_READY` | M5-07, M3-00; SDD-010 | Versioned X post/thread and Xiaohongshu image-note artifacts, independent audit, exact OwnerDecision invalidation and safe copy/download/open package; independently verified and merged in PR #16, Owner UAT pending |
| M5-10 | Full dogfood install, recovery and recording gate | `NOT_STARTED` | M5-06–M5-09, M5-11; SDD-011 | Fresh install/upgrade/rollback, public-safe Owner dogfood normal and fail-closed loops, restart recovery and reproducible narrated demo evidence |
| M5-11 | Xiaohongshu governed media artifact integration | `IN_PROGRESS` | M5-08, M5-09; SDD-012 | PR #22 merged the media foundation; PR #24 merged exact A5 receipt-authority validation, closed audit requests, append-only Owner visual review and exact OwnerDecision/package gates. Controlled fixtures remain non-authoritative; a real DeepSeek-backed accepted A5 receipt, real media-provider canary, operational package and Owner visual/binary UAT remain required |

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
