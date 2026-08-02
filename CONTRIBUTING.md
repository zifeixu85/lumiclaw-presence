# Contributing to LumiClaw Presence

Thank you for your interest.

LumiClaw Presence is currently pre-alpha, and its root license has not yet been selected. Code contributions are temporarily paused until a license and contributor terms are published. Issues that report reproducible bugs, contract gaps, connector edge cases, or documentation problems are welcome.

## Before opening an issue

- Remove credentials, tokens, account IDs, private messages, and customer material.
- State whether the evidence is synthetic, engineering-verified, externally calibrated, or a business result.
- For platform behavior, include the official documentation URL, access date, account type, scopes, and observed response.
- For execution bugs, include the artifact revision, capability snapshot, grant state, receipt state, and a redacted trace.

Before implementation work begins, read the [implementation register](IMPLEMENTATION-STATUS.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md), and the relevant SDD. Module state changes and acceptance evidence follow the task protocol in `AGENTS.md`.

## Design boundaries

- Producers and auditors remain independent.
- Human owners retain final authority for governed public actions.
- Operators consume exact, short-lived grants and cannot alter content.
- Unknown platform state is reconciled before retry.
- Learning is scoped, versioned, reviewable, and reversible.
- Platform coverage is less important than an honest, testable contract.

## Pull requests

Please wait until the root license and contribution policy are added before submitting code. Once contributions open, every pull request will require tests, claim maturity updates, privacy review, dependency/license disclosure, an acceptance report where required, and synchronized English/Chinese implementation status.
