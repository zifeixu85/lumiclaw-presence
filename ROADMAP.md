# LumiClaw Presence Roadmap

[English](ROADMAP.md) | [简体中文](ROADMAP.zh-CN.md) | [Architecture](ARCHITECTURE.md) | [Implementation status](IMPLEMENTATION-STATUS.md)

This roadmap describes product outcomes, not a promise that every planned capability already exists. See the [implementation register](IMPLEMENTATION-STATUS.md) for module-level delivery state, the [README](README.md) for current implementation truth, and [architecture](ARCHITECTURE.md) for the planned technical boundaries.

## How we are building

We are building one continuous campaign journey and making it progressively real:

~~~text
campaign setup
→ activation plan
→ AgentTeams shadow work
→ independent audit
→ four editable platform revisions
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
- Establish a Node.js 24 and TypeScript workspace with planned Next.js 16 `web`, Fastify 5 `api`, `mission-worker`, and deterministic `action-operator` boundaries.
- Establish the Docker Compose skeleton, PostgreSQL 17 migration path, content-addressed local blob storage, SDD workflow, CI, dependency policy, and license decision.
- Establish the `next-intl` English-default and Chinese UI shell, typed message parity, locale routing, design tokens, and five-screen route skeleton.
- Make the bilingual implementation register, per-SDD goal, and acceptance-report workflow executable in CI.
- Verify a pinned, isolated AgentTeams external runtime profile and create a new mission smoke test without treating its internal state as product state.
- Produce clickable low/high-fidelity routes for the complete five-screen journey and all four platform composers.

Exit: the repository installs through the documented Compose path, migrations and tests pass, a labeled product shell opens, and the first vertical-slice spec is ready.

### M1 — Campaign walking skeleton · NEXT

- Create, save, and reopen a real CampaignBrief using PostgreSQL as the authoritative state.
- Model identity, product, market, account mandate, claims, evidence, and four activation units.
- Show missing evidence, account boundaries, and a useful activation plan.
- Use one shared mission state across Web, API/CLI, and the AgentTeams adapter.
- Deliver editable X, Bluesky, LinkedIn, and Xiaohongshu artifacts with native-like previews and capability/constraint fixtures.
- Save one-time or constrained recurring schedules with an IANA time zone, DST/misfire validation, and no external action yet.

Exit: a real LumiClaw campaign can reach readiness and reopen its four editable platform revisions without hidden demo-only state.

### M2 — Governed shadow campaign

- Run one mission leader and five domain specialists in AgentTeams; the leader orchestrates but does not produce domain artifacts.
- Route model work through the `ModelProvider` port and the planned DeepSeek V4 gateway.
- Produce distinct founder and product-account artifacts across all four platform variants.
- Keep producers and the independent auditor separate.
- Bring uploaded or `MediaGenerationProvider`-derived media into immutable revisions without auto-approval.
- Show revision diffs, audit evidence, owner review, shared state, and trace in the LumiClaw control plane.
- Inject one claim or platform-constraint fault and prove that no external action can occur.

Exit: the six-member team returns digest-validated artifacts; one valid revision reaches owner review and one invalid revision is blocked and revised.

### M3 — Controlled live activation

- Turn an exact OwnerDecision into a short-lived, single-use ActionGrant.
- Persist the grant and outbox transition atomically before the separate, no-LLM `action-operator` executes.
- Claim due schedule occurrences through PostgreSQL leases, recover after restart, and prove that recurring schedules never hold perpetual grants.
- Publish through the official Bluesky path and reconcile the native record.
- Provide an honest LinkedIn native handoff and URL reconciliation.
- Provide an honest Xiaohongshu content-package handoff and URL or approved-evidence reconciliation.
- Run the official X Direct PoC; enable only a scoped Canary if OAuth, scope, budget, idempotency, failure, and read-back gates all pass, otherwise downgrade to X Handoff.
- Distinguish published, handoff-reconciled, user-action-required, failed, and unknown states.

Exit: Bluesky Direct, LinkedIn Handoff, and Xiaohongshu Handoff complete with truthful receipts and no unauthorized or duplicate action. X Direct is optional and cannot block this exit.

### M4 — Response and learning loop

- Normalize one real or controlled-real interaction.
- Let the owner decide its outcome and disposition.
- Review, accept, reject, scope, and roll back a LearningProposal.
- Show exactly which approved learning a second mission reused.
- Complete at least one isolated, non-critical `SignalProvider` PoC with purpose, provenance, terms, quarantine, schema, and retention gates.

Exit: Mission 1 → response → learning decision → Mission 2 is reproducible without cross-account or cross-market leakage; third-party signal data cannot bypass evidence review.

### M5 — Runnable product candidate

- Integrate the complete five-screen Web journey.
- Cover empty, blocked, expired, revoked, unknown, recovery, and success states across the four platform previews and action modes.
- Compare single-agent, minimum-team, and full-team runs under the same conditions.
- Provide fresh Docker installation, backup/restore rehearsal, CI, provider and connector conformance tests, evidence export, accessibility/visual checks, and a public-safe example.

Exit: a new machine can run one normal loop and one fail-closed loop from the documented Compose setup without hidden services on the developer's machine.

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

We integrate replaceable infrastructure where appropriate: AgentTeams as an external execution domain; DeepSeek behind `ModelProvider`; EvoLink behind `MediaGenerationProvider`; public sources behind `SignalProvider`; official actions behind `PublishConnector`; and user-driven completion behind `NativeHandoffAdapter`. Web and database frameworks, storage, secret managers, and observability backends remain infrastructure choices. Postiz remains a separately deployed, proof-of-concept adapter candidate; it is not part of the critical path and its source is not copied into this repository.

## Specification-driven delivery

Every milestone is implemented through one Epic SDD and child specs small enough to finish and verify in roughly half a day to three days. Each bounded SDD runs in a separate Codex task and one explicit goal. A spec must define the user outcome, journey and UI states, domain/API contracts, AgentTeams roles and skills, permissions, dependencies and licenses, failure and rollback behavior, pass/fail acceptance criteria, test plan, owner-participated verification, and evidence maturity.

Before starting, read and update the [implementation register](IMPLEMENTATION-STATUS.md). At closeout, create an acceptance report from [the report template](docs/reports/ACCEPTANCE-REPORT-TEMPLATE.md), then use `EVIDENCE_READY` until required owner acceptance is recorded. Use [the SDD template](docs/specs/SPEC-TEMPLATE.md). A date or chat response does not complete a milestone; its exit criteria do.
