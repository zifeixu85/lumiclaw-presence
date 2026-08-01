# LumiClaw Presence

[English](README.md) | [简体中文](README.zh-CN.md)

> Governed multi-agent infrastructure for global market presence.

**Status:** Early development. The product direction is defined; the first runnable vertical slice is being built.

LumiClaw Presence helps founders and small teams operate public accounts across markets without handing uncontrolled authority to AI. It turns a business goal, verified company facts, market signals, account context, and explicit permissions into a bounded mission for a team of specialized agents.

The product is not another cross-posting tool. Publishing is one governed action inside a larger loop: research, strategy, native market expression, independent review, owner approval, execution receipts, inbound signal qualification, handoff, and scoped learning.

## What LumiClaw Presence does

- Translates one primary business goal into a bounded `PresenceMission`.
- Separates evidence research, strategy, production, independent audit, and external action.
- Produces market- and account-native variants from a shared, evidence-backed content kernel.
- Binds every external action to an exact artifact version, account, action, and time window.
- Organizes comments, mentions, permitted messages, and metrics into reviewable business signals.
- Turns high-value signals into traceable handoff packages for people or downstream systems.
- Proposes scoped learning without silently changing approved facts, policy, or shared skills.

## Who it is for

The initial focus is founders and small teams that:

- are building a company, product, or professional identity for a global market;
- have real progress or expertise to communicate regularly;
- operate at least one public account;
- still review important public expression themselves;
- do not yet have a complete global social or GTM operations team.

## Mission flow

```text
Business goal
→ identity, market, audience, and account context
→ verified facts and public signals
→ testable strategy hypothesis
→ Presence Mission and specialized agent team
→ content kernel, market narrative, and account variants
→ independent audit
→ exact owner approval
→ publish, draft, or explicit handoff
→ action receipt and inbound interactions
→ outcome signal or lead signal
→ handoff and scoped learning proposal
```

## Core design principles

### Goal-driven, not post-driven

A mission starts from one primary operating goal. The goal changes the team topology, skills, context, metrics, signal rules, and learning scope.

### Real separation of duties

The producer cannot approve its own work. The auditor cannot publish. The action operator cannot alter an approved artifact. A human owner remains the final authority for governed actions.

### Evidence and exact authorization

Material claims retain provenance. Approval is attached to an exact artifact digest, target account, action, and validity window. Execution returns an external receipt or fails closed.

### Capability-aware connectors

Platform support is probed per account. Unsupported actions downgrade explicitly to a draft, export, notification, or user-driven handoff.

### Scoped, reviewable learning

Observations may create a `LearningProposal`; they do not silently become long-term truth. Accepted learning is versioned, scoped, reviewable, and reversible.

## Product boundary

LumiClaw Presence owns:

- presence goals, campaigns, and mission definitions;
- the public market and account signals required by a mission;
- market- and account-native expression;
- review, approval, action grants, and action receipts;
- owned-account interaction signal organization;
- lead-signal preparation and handoff;
- evidence-bound learning proposals.

It does not aim to replace:

- a full CRM, sales pipeline, or revenue forecasting system;
- paid media buying;
- company-wide strategy, pricing, or product management;
- unrestricted automated comments, follows, or direct messages;
- human legal or compliance judgment;
- accountable business owners.

## First planned product slice

The first vertical slice is a **Weekly Global Update** mission: a founder provides one real product update and one primary goal; the agent team researches relevant signals, develops a testable strategy, creates native variants for selected accounts, performs an independent audit, requests exact approval, executes only supported actions, and organizes resulting interactions into signals and learning proposals.

This slice will be implemented and verified incrementally. Planned capabilities are not presented as completed features.

## Repository scope

This repository will contain the public product implementation, domain schemas, reusable skills, connector contracts, tests, examples, and public technical documentation.

It will not contain private research notes, internal decision records, raw customer material, private runtime evidence, credentials, tokens, or account data.

## Roadmap

1. Define the minimum domain contracts and conformance tests.
2. Build one governed mission with at least three distinct agent responsibilities.
3. Complete one real, capability-aware account action with an exact receipt.
4. Turn one permitted inbound interaction into a reviewed signal and handoff.
5. Apply one human-approved, scoped learning proposal in the next mission.
6. Compare single-agent, minimum-team, and dynamic-team performance under the same conditions.

## Development and licensing

Development setup and contribution guidance will be added with the first runnable slice.

A repository license has not yet been selected. Licensing and contribution terms will be finalized before the first public release.
