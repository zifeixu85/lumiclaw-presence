# LumiClaw Presence

[English](README.md) | [简体中文](README.zh-CN.md)

> AI-native global brand operations for multi-brand, multi-market teams.

**Status:** Pre-alpha and documentation-only. The product direction is defined; the first runnable vertical slice is being built. Unless explicitly marked otherwise, the capabilities below are planned.

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
→ exact human approval
→ one official direct publish
→ one honest native handoff
→ real response signal and disposition
→ scoped learning proposal
→ replayed fault denial
~~~

The planned reference paths are:

- a LumiClaw-owned Bluesky connector using the official API;
- a user-driven LinkedIn native handoff until the specific account capability is connected and verified.

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

## Current implementation truth

**Implemented:**

- this public repository;
- the English and Chinese product documentation.

**Planned:**

- the new domain contracts;
- the AgentTeams campaign runtime;
- ActionGrant, ActionReceipt, and capability probing;
- Bluesky direct publishing and LinkedIn native handoff;
- response disposition, scoped learning, and Flight replay;
- a web product surface.

Legacy engineering assets exist in a separate private prototype, but they are not treated as implementation of this product. Reuse will happen file by file with provenance, licensing, semantic-change notes, and new tests.

## Build order

1. Domain schemas, canonical digests, and conformance fixtures.
2. A real AgentTeams SHADOW mission with separated producer and auditor roles.
3. Replay and fault denial.
4. Human decision to single-use ActionGrant to ActionReceipt.
5. One official direct connector and one native handoff.
6. One real response to a reviewed outcome and scoped learning proposal.
7. A second mission that correctly reuses approved learning.
8. Single-agent versus multi-agent evaluation under the same conditions.

## Repository scope

This repository will contain public product code, domain schemas, reusable skills, connector contracts, tests, examples, and technical documentation.

It will not contain private research notes, internal decision records, raw customer material, private messages, credentials, tokens, account data, or private runtime evidence.

## Development and licensing

The implementation baseline is Node.js 20+, ESM, npm workspaces, schema-first contracts, and automated conformance tests.

A root license has not yet been selected. Until a license is added, this is a public source repository but not an open-source release, and code contributions are paused. See [CONTRIBUTING.md](CONTRIBUTING.md).
