# LumiClaw Presence

[English](README.md) | [简体中文](README.zh-CN.md) | [Architecture](ARCHITECTURE.md) | [Roadmap](ROADMAP.md) | [Implementation status](IMPLEMENTATION-STATUS.md)

> AI-native global brand operations for multi-brand, multi-market teams.

**Status:** Pre-alpha. M0/M1 are accepted and M2 is `EVIDENCE_READY`: the code has passed repeatable engineering verification, including a local real-DeepSeek Canary through a pinned six-member AgentTeams mission. Owner UAT is still pending; connectors, external platform actions, customer outcomes, and production readiness are not claimed.

LumiClaw Presence turns one business objective into coordinated action across identities, brands, products, markets, and public accounts. It executes within approved facts, permissions, and ownership boundaries, then brings real responses back into the next decision.

Our long-term vision is a **Global Presence OS**. Our current category is **AI-native Global Brand Operations**. We enter through **Governed Public Presence Missions**, starting with **Global Campaign Activation & Response**. The reusable technical core is an embedded **Governed Mission Runtime**, not a separate product claim.

## The problem

Modern teams can generate content and schedule posts cheaply. The harder operational problem remains:

- deciding which identity should represent which brand or product;
- coordinating different actions across markets and accounts;
- keeping every material claim tied to current evidence;
- separating production, independent review, human approval, and execution;
- proving what an external platform actually did;
- handling unsupported actions and uncertain states honestly;
- turning real responses into scoped, reviewable learning.

LumiClaw Presence is designed as the control and learning layer for that loop. Connectors, schedulers, models, and inbox providers remain replaceable.

## Product hierarchy

| Layer | Definition |
|---|---|
| Long-term vision | Global Presence OS |
| Current category | AI-native Global Brand Operations |
| Product | LumiClaw Presence |
| First capability surface | Global SocialOps |
| User-visible work unit | Governed Public Presence Mission |
| First purchasable job | Global Campaign Activation & Response |
| Embedded technical core | Governed Mission Runtime |
| Trust module | Presence Agent Flight Simulator |

The vision describes where the product can grow. It is not a claim that an enterprise suite already exists.

## First governed vertical slice

The first Hero follows a **Release-to-Presence-to-Feedback** loop across a founder identity and a product identity:

~~~text
real release or business signal
→ identity, product, market, account, and mandate plan
→ evidence-bound claims
→ specialized AgentTeams members
→ independent production and audit
→ four editable platform-native revisions
→ exact human approval
→ governed direct publish or honest native handoff
→ action receipt and real response signal
→ product feedback, issue, or disposition
→ scoped learning proposal
→ replayed fault denial
~~~

The first composer and review path plans four platform variants with different, explicit execution semantics:

| Platform | Editable artifact and preview | Execution path |
|---|---|---|
| Bluesky | Required | Official Direct must pass, with URI/CID reconciliation |
| LinkedIn | Required | User-driven Native Handoff must pass, with URL reconciliation |
| Xiaohongshu | Required | User-driven content-package Handoff must pass, with URL or approved evidence reconciliation |
| X | Required | Official Direct is a PoC-gated Canary; it falls back to explicit Handoff and cannot block the Hero |

A preview does not imply that a connector exists or that an account currently permits direct action.

Postiz is a separate proof-of-concept candidate, not a dependency of the critical path. We will not fork or copy its source into LumiClaw.

## Core contracts

LumiClaw is intended to own the semantics of:

- Organization, Identity, Brand, Product, and Market;
- ChannelAccount and AccountMandate;
- CampaignMission and ActivationUnit;
- Claim and Evidence;
- ArtifactRevision and independent AuditDecision;
- Human OwnerDecision;
- short-lived, single-use ActionGrant;
- CapabilitySnapshot and ActionReceipt;
- InteractionEvent, OutcomeSignal, and Disposition;
- LearningProposal and scoped ApprovedMemory.

Replacing an external publisher must not erase these business objects or their evidence chain.

## Safety and governance

- A producer cannot audit or approve its own work.
- An auditor can pass, fail, or escalate; it cannot silently edit an artifact.
- A human owner approves an exact revision, account, action, and time window.
- A deterministic operator cannot alter an approved payload or widen its grant.
- Platform capability is probed per account.
- A queue ID or HTTP 200 is not proof of publication.
- Unknown external state requires reconciliation, not blind retry.
- Observations may create a learning proposal; they cannot silently rewrite approved truth or shared skills.
- Secrets and private account data never enter prompts, public fixtures, or committed evidence.

## Presence Agent Flight Simulator

The planned trust module will replay frozen historical inputs, inject faults, and produce a scoped readiness report before permissions expand:

~~~text
Frozen Input
→ Historical Replay
→ Fault Injection
→ Readiness Report
→ Autonomy Envelope
→ Shadow
→ Canary
→ Scoped Permission Expansion
~~~

Passing a replay is engineering evidence, not legal, cultural, platform, or business certification.

## Product boundary

LumiClaw Presence is intended to own governed global brand actions and learning. It does not aim to replace:

- a full CRM, sales pipeline, or revenue forecasting system;
- paid media buying;
- company-wide strategy, pricing, or product management;
- unrestricted automated comments, follows, or direct messages;
- human legal or compliance judgment;
- accountable business owners.

We do not claim guaranteed reach, follower growth, leads, or revenue.

## Planned technical architecture

The selected reference stack is Node.js 24 LTS and TypeScript, with Next.js 16 and `next-intl` for a Chinese-default, English-capable `web`, Fastify 5 for `api`, PostgreSQL 17 with Kysely for authoritative state, and Docker Compose as the first installation contract.

The application is split into `web`, `api`, `mission-worker`, and a deterministic `action-operator`. AgentTeams runs in a separate execution domain through a Runtime Adapter; it is not the product database, secret store, or publishing operator. DeepSeek, EvoLink, and public-signal sources sit behind `ModelProvider`, `MediaGenerationProvider`, and `SignalProvider` ports. Publishing uses separate `PublishConnector` and `NativeHandoffAdapter` contracts.

Publishing schedules are persisted in PostgreSQL with IANA time zones and explicit missed-run behavior. The initial `mission-worker` claims due occurrences through leases and restart-safe jobs; host crontab and in-memory timers are not the schedule source of truth. A recurring schedule never creates a perpetual publishing grant.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the planned service boundaries, provider ports, four-platform preview contract, and delivery gates.

## Current implementation truth

**Engineering-verified candidate on the current branch (pending Coordinator verification and Owner acceptance):**

- the accepted M0 Node/npm workspace, Docker Compose/PostgreSQL/BlobStore foundation, bilingual Next.js shell, quality gates, and isolated AgentTeams v1.2.0 adapter smoke;
- tenant-aware Organization, Identity, Brand, Product, Market, ChannelAccount, and AccountMandate contracts and migrations;
- versioned CampaignBrief, GoalProfile, Claim/Evidence, ActivationPlan/ActivationUnit, ArtifactRevision, CapabilitySnapshot, and six-role MissionContract contracts with canonical digests;
- a Fastify REST/OpenAPI control API with PostgreSQL create/save/reopen, Idempotency-Key, ETag conflicts, snapshots, and tenant isolation;
- Chinese-default and English five-screen M1 states plus editable, distinct previews for X, Bluesky, LinkedIn, and Xiaohongshu;
- PostgreSQL PublishingSchedule/ScheduleOccurrence state with constrained RRULE, IANA time zones, DST gap/fold, misfire, and edit invalidation contracts;
- a pinned AgentTeams v1.2.0 Runtime Adapter and a repeatable real Manager/Worker/Project/DAG/Task/ACK/Submit run with exactly six separated members, including an orchestration-only Leader and independent Auditor;
- PostgreSQL-owned Mission, RoleContext, five version-locked Skills, accepted Runtime payloads, immutable four-platform revisions, independent AuditDecision history, exact non-executable Owner Review, restart reconciliation, quarantine, trace, ledger, and public-safe evidence;
- DeepSeek official `ModelProvider` and replaceable `MediaGenerationProvider` boundaries with structured-output, timeout/retry/rate-limit/error, redaction, cost/latency and content-addressed rights-receipt conformance; public-safe mocks remain explicitly labeled `MOCK_CONFORMANCE`;
- a local Owner-controlled DeepSeek Canary that completed the real six-member/eight-task AgentTeams path with seven redacted accepted model receipts, five immutable revisions, five audit decisions, `AWAITING_OWNER_REVIEW`, and zero external actions; this is engineering verification, not customer or business validation;
- Chinese-default and English Mission/Review flows, 390px coverage, 14 browser-rendered Storybook states, and distinct actionable UX-M1-001 disabled reasons;
- no due-action executor, connector, external platform action, executable OwnerDecision, ActionGrant, ActionReceipt, real provider claim, or real customer data.

**Planned:**

- ActionGrant, ActionReceipt, and capability probing;
- Bluesky Direct, LinkedIn and Xiaohongshu Handoffs, and the gated X Direct Canary;
- the EvoLink live Canary and isolated SignalProvider adapters;
- response disposition and scoped learning;
- hosted authentication, multi-tenant RLS, and a production web surface.

Legacy engineering assets exist in a separate private prototype, but they are not treated as implementation of this product. Reuse will happen file by file with provenance, licensing, semantic-change notes, and new tests.

## Build order

1. SDD-000 delivery foundation: license decision, Node workspace, Docker Compose, PostgreSQL migrations, `next-intl`, design shell, CI, and isolated AgentTeams smoke.
2. Campaign walking skeleton with four editable previews, persistent schedule editor, and capability/constraint fixtures.
3. A real six-member AgentTeams SHADOW mission with separated producers and auditor, routed through DeepSeek. **Engineering evidence ready.**
4. A Release-to-Presence-to-Feedback Hero: exact approval, single-use ActionGrant, ActionReceipt, and honest failure downgrade.
5. One official Direct path plus explicit native handoffs; X Direct only if its Canary gate passes.
6. One real response converted into a reviewed GitHub Issue, outcome, or scoped learning proposal, plus one isolated SignalProvider PoC.
7. A second mission that correctly reuses approved learning.
8. Fresh-install, recovery, provider-conformance, and single-agent versus multi-agent verification.

The milestone outcomes and exit criteria are maintained in the [public roadmap](ROADMAP.md); module state, blockers, evidence, and the next executable task live in the [implementation register](IMPLEMENTATION-STATUS.md).

## Run locally

Prerequisites: Docker Desktop, Node.js `24.16.0`, and npm `11.13.0`.

~~~bash
npm ci
npm run verify
docker compose up --build
~~~

Open <http://127.0.0.1:3100>. The default locale is Simplified Chinese; English is available under `/en`. The normal Compose path uses synthetic data and performs no external social action. Live-provider UAT has a separate Owner-only protocol and must never place a key in Git, `.env`, shell history, issues, or logs.

## Repository scope

This repository will contain public product code, domain schemas, reusable skills, connector contracts, tests, examples, and technical documentation.

It will not contain private research notes, internal decision records, raw customer material, private messages, credentials, tokens, account data, or private runtime evidence.

## Development and licensing

The planned implementation baseline is Node.js 24 LTS, TypeScript, ESM, npm workspaces, schema-first contracts, and automated conformance tests.

LumiClaw Presence is licensed under [Apache License 2.0](LICENSE). Dependencies, assets, providers, containers, and migrated legacy files follow the [dependency policy](docs/DEPENDENCY-POLICY.md). The project remains pre-alpha and is not production-ready. See [CONTRIBUTING.md](CONTRIBUTING.md).
