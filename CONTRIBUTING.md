# Contributing to LumiClaw Presence

Thank you for your interest.

LumiClaw Presence is currently pre-alpha and licensed under [Apache-2.0](LICENSE). Issues and focused contributions that report reproducible bugs, contract gaps, connector edge cases, or documentation problems are welcome. Large or architecture-changing contributions should begin with an SDD discussion.

## Before opening an issue

- Remove credentials, tokens, account IDs, private messages, and customer material.
- State whether the evidence is synthetic, engineering-verified, externally calibrated, or a business result.
- For platform behavior, include the official documentation URL, access date, account type, scopes, and observed response.
- For execution bugs, include the artifact revision, capability snapshot, grant state, receipt state, and a redacted trace.
- For new dependencies or migrated assets, follow the [dependency policy](docs/DEPENDENCY-POLICY.md).

Before implementation work begins, read the [implementation register](IMPLEMENTATION-STATUS.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md), and the relevant SDD. Module state changes and acceptance evidence follow the task protocol in `AGENTS.md`.

## Design boundaries

- Producers and auditors remain independent.
- Human owners retain final authority for governed public actions.
- Operators consume exact, short-lived grants and cannot alter content.
- Unknown platform state is reconciled before retry.
- Learning is scoped, versioned, reviewable, and reversible.
- Platform coverage is less important than an honest, testable contract.

## Pull requests

Every pull request requires applicable tests, claim maturity updates, privacy review, dependency/license disclosure, an acceptance report where required, and a structured status handoff. The coordinator owns canonical English/Chinese implementation-status transitions after independent acceptance.

For the current core team:

- the product/design owner freezes user flow, interaction, visual direction, and Owner UAT decisions;
- the technical lead owns implementation design, tests, migrations, AgentTeams/provider/connector boundaries, and engineering handoff evidence;
- the operations lead owns design-partner missions, campaign inputs, channel operations, feedback disposition, and external-calibration evidence;
- changes use focused `codex/` or contributor branches, a linked issue or SDD, and review before `main`;
- no role may turn synthetic evidence into an external or business claim.

By intentionally submitting a contribution for inclusion, you agree that it is provided under Apache-2.0 as described by Section 5 of the license, unless a separate written agreement applies. Do not submit code or content you do not have the right to contribute.
