# LumiClaw Presence Roadmap

[English](ROADMAP.md) | [简体中文](ROADMAP.zh-CN.md)

This roadmap describes product outcomes, not a promise that every planned capability already exists. See the [README](README.md) for current implementation truth.

## How we are building

We are building one continuous campaign journey and making it progressively real:

~~~text
campaign setup
→ activation plan
→ AgentTeams shadow work
→ independent audit
→ exact owner approval
→ governed direct action or native handoff
→ reconciled receipt
→ response disposition
→ scoped learning
→ next mission reuse
~~~

Each milestone is a user-visible vertical slice. Product UI, domain contracts, AgentTeams execution, governance, tests, and evidence ship together. Seeded, shadow, controlled-real, and live states are always labeled.

## Current build sequence

### M0 — Delivery foundation · NOW

- Freeze the first real campaign input and owner baseline.
- Establish the application shell, SDD workflow, CI, dependency policy, and license decision.
- Verify the pinned AgentTeams runtime and create a new mission smoke test.
- Produce a clickable version of the complete five-screen journey.

Exit: the repository installs, tests, and opens a labeled product shell; the first vertical-slice spec is ready.

### M1 — Campaign walking skeleton · NEXT

- Create, save, and reopen a real CampaignBrief.
- Model identity, product, market, account mandate, claims, evidence, and activation units.
- Show missing evidence, account boundaries, and a useful activation plan.
- Use one shared mission state across Web, API/CLI, and the AgentTeams adapter.

Exit: a real LumiClaw campaign can reach readiness without hidden demo-only state.

### M2 — Governed shadow campaign

- Run one mission leader and five domain specialists in AgentTeams; the leader orchestrates but does not produce domain artifacts.
- Produce distinct founder and product-account artifacts.
- Keep producers and the independent auditor separate.
- Show revision diffs, audit evidence, owner review, shared state, and trace.
- Inject one claim fault and prove that no external action can occur.

Exit: one valid artifact reaches owner review and one invalid artifact is blocked and revised.

### M3 — Controlled live activation

- Turn an exact OwnerDecision into a short-lived, single-use ActionGrant.
- Persist an outbox attempt before execution.
- Publish through the official Bluesky path and reconcile the native record.
- Provide an honest LinkedIn native handoff and URL reconciliation.
- Distinguish published, user-action-required, failed, and unknown states.

Exit: one direct action and one native handoff complete with truthful receipts and no unauthorized or duplicate action.

### M4 — Response and learning loop

- Normalize one real or controlled-real interaction.
- Let the owner decide its outcome and disposition.
- Review, accept, reject, scope, and roll back a LearningProposal.
- Show exactly which approved learning a second mission reused.

Exit: Mission 1 → response → learning decision → Mission 2 is reproducible without cross-account or cross-market leakage.

### M5 — Runnable product candidate

- Integrate the complete five-screen Web journey.
- Cover empty, blocked, expired, revoked, unknown, recovery, and success states.
- Compare single-agent, minimum-team, and full-team runs under the same conditions.
- Provide a fresh-install path, CI, conformance tests, evidence export, and a public-safe example.

Exit: a new machine can run one normal loop and one fail-closed loop from the documented setup.

### M6 — External calibration and hardening

- Run a design partner's own campaign in shadow mode.
- Validate setup time, owner comprehension, isolation, recovery, and non-copywriting value.
- Improve reliability from observed use rather than expanding platform count.

Exit: external calibration is claimed only when the partner used their own goal, material, and decision protocol.

## Product horizons

| Horizon | Product outcome |
|---|---|
| Founder Brand Matrix | One owner runs governed campaigns across identities, products, markets, and accounts. |
| Design Partner Operations | Teams and agencies repeat the mission with workspace, role, client-isolation, and template support. |
| Global Brand Operations Control Plane | Brand, regional, and agency teams coordinate policy, approvals, execution providers, portfolios, and bounded autonomy. |
| Global Presence OS | An extensible mission and governance layer spans more public and semi-public presence surfaces. |

The later horizons are direction, not implementation claims.

## What LumiClaw owns

LumiClaw owns the business semantics and evidence chain: Brand Graph, Campaign Mission, Claim/Evidence, role context, artifact revisions, independent audit, owner decisions, grants, receipts, outcomes, scoped learning, and Flight conformance.

We integrate replaceable infrastructure where appropriate: AgentTeams, Web and database frameworks, official platform SDKs, storage, queues, secret managers, and observability backends. Postiz remains a separately deployed, proof-of-concept adapter candidate; it is not part of the critical path and its source is not copied into this repository.

## Specification-driven delivery

Every milestone is implemented through one Epic SDD and child specs small enough to finish and verify in roughly half a day to three days. A spec must define the user outcome, journey and UI states, domain/API contracts, AgentTeams roles and skills, permissions, dependencies and licenses, failure and rollback behavior, pass/fail acceptance criteria, test plan, and evidence maturity.

Use [the SDD template](docs/specs/SPEC-TEMPLATE.md). A date does not complete a milestone; its exit criteria do.
