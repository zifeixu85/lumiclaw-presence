# LumiClaw Presence

[English](README.md) | [简体中文](README.zh-CN.md) | [Architecture](ARCHITECTURE.md) | [Roadmap](ROADMAP.md) | [Implementation status](IMPLEMENTATION-STATUS.md)

> AI-native global brand operations for multi-brand, multi-market teams.

**Status:** Pre-alpha and documentation-only. The product direction and reference architecture are defined; the first runnable vertical slice is planned next. Unless explicitly marked otherwise, the capabilities below are planned.

LumiClaw Presence turns one business objective into coordinated action across identities, brands, products, markets, and public accounts. It executes within approved facts, permissions, and ownership boundaries, then brings real responses back into the next decision.

Our long-term vision is a **Global Presence OS**. Our first product surface is **Global SocialOps**, starting with one purchasable job: **Global Campaign Activation & Response**.

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
| First purchasable job | Global Campaign Activation & Response |
| Governance runtime | Presence Governance & Execution Runtime |
| Trust module | Presence Agent Flight Simulator |

The vision describes where the product can grow. It is not a claim that an enterprise suite already exists.

## First planned vertical slice

The first slice will run one real LumiClaw campaign across a founder identity and a product identity:

~~~text
real campaign objective
→ identity, product, market, account, and mandate plan
→ evidence-bound claims
→ specialized AgentTeams members
→ independent production and audit
→ four editable platform-native revisions
→ exact human approval
→ governed direct publish or honest native handoff
→ real response signal and disposition
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

The selected reference stack is Node.js 24 LTS and TypeScript, with Next.js 16 and `next-intl` for an English-default, Chinese-capable `web`, Fastify 5 for `api`, PostgreSQL 17 with Kysely for authoritative state, and Docker Compose as the first installation contract.

The application is split into `web`, `api`, `mission-worker`, and a deterministic `action-operator`. AgentTeams runs in a separate execution domain through a Runtime Adapter; it is not the product database, secret store, or publishing operator. DeepSeek, EvoLink, and public-signal sources sit behind `ModelProvider`, `MediaGenerationProvider`, and `SignalProvider` ports. Publishing uses separate `PublishConnector` and `NativeHandoffAdapter` contracts.

Publishing schedules are persisted in PostgreSQL with IANA time zones and explicit missed-run behavior. The initial `mission-worker` claims due occurrences through leases and restart-safe jobs; host crontab and in-memory timers are not the schedule source of truth. A recurring schedule never creates a perpetual publishing grant.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the planned service boundaries, provider ports, four-platform preview contract, and delivery gates.

## Current implementation truth

**Implemented:**

- this public repository;
- the English and Chinese product, architecture, and roadmap documentation.
- the bilingual module-level implementation register and per-SDD acceptance-report template.

**Planned:**

- the new domain contracts;
- the Node.js 24 / Next.js 16 / Fastify 5 / PostgreSQL 17 application baseline;
- `next-intl` locale routing, English/Chinese typed catalogs, and persistent schedule/occurrence contracts;
- Docker Compose services for `web`, `api`, `mission-worker`, and `action-operator`;
- the AgentTeams campaign runtime;
- ActionGrant, ActionReceipt, and capability probing;
- four editable platform previews;
- Bluesky Direct, LinkedIn and Xiaohongshu Handoffs, and the gated X Direct Canary;
- DeepSeek, EvoLink, and isolated SignalProvider adapters;
- response disposition, scoped learning, and Flight replay;
- a web product surface.

Legacy engineering assets exist in a separate private prototype, but they are not treated as implementation of this product. Reuse will happen file by file with provenance, licensing, semantic-change notes, and new tests.

## Build order

1. SDD-000 delivery foundation: license decision, Node workspace, Docker Compose, PostgreSQL migrations, `next-intl`, design shell, CI, and isolated AgentTeams smoke.
2. Campaign walking skeleton with four editable previews, persistent schedule editor, and capability/constraint fixtures.
3. A real six-member AgentTeams SHADOW mission with separated producers and auditor, routed through DeepSeek.
4. Replay, fault denial, and human decision to single-use ActionGrant to ActionReceipt.
5. Bluesky Direct plus LinkedIn and Xiaohongshu Handoffs; X Direct only if its Canary gate passes.
6. One real response to a reviewed outcome and scoped learning proposal, plus one isolated SignalProvider PoC.
7. A second mission that correctly reuses approved learning.
8. Fresh-install, recovery, provider-conformance, and single-agent versus multi-agent verification.

The milestone outcomes and exit criteria are maintained in the [public roadmap](ROADMAP.md); module state, blockers, evidence, and the next executable task live in the [implementation register](IMPLEMENTATION-STATUS.md).

## Repository scope

This repository will contain public product code, domain schemas, reusable skills, connector contracts, tests, examples, and technical documentation.

It will not contain private research notes, internal decision records, raw customer material, private messages, credentials, tokens, account data, or private runtime evidence.

## Development and licensing

The planned implementation baseline is Node.js 24 LTS, TypeScript, ESM, npm workspaces, schema-first contracts, and automated conformance tests.

A root license has not yet been selected. Until a license is added, this is a public source repository but not an open-source release, and code contributions are paused. See [CONTRIBUTING.md](CONTRIBUTING.md).
