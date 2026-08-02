# LumiClaw Presence Agent Working Rules

## Product identity

- Product: LumiClaw Presence
- Current category: AI-native Global Brand Operations
- Long-term vision: Global Presence OS
- First capability surface: Global SocialOps
- First vertical slice: Global Campaign Activation & Response

The long-term vision is PLANNED. Do not describe it as an implemented enterprise suite.

## Claim discipline

Use one of these states for every material capability claim:

- IMPLEMENTED
- ENGINEERING_VERIFIED
- EXTERNAL_CALIBRATED
- BUSINESS_VERIFIED
- PLANNED
- NOT_CLAIMED

Synthetic or de-identified fixtures are never customer UAT. A successful run is not a business outcome.

## Architecture rules

- AgentTeams is the multi-agent runtime for the reference path.
- Every reference mission uses at least three real members with distinct responsibilities.
- Producer and independent auditor must be separate.
- The auditor may pass, fail, or escalate; it may not silently edit or approve.
- A human owner approves exact revisions and external actions.
- A deterministic operator is not counted as an AgentTeams member.
- External execution requires a short-lived, scoped, single-use ActionGrant.
- Unknown external state must be reconciled before retry.
- Platform capability is probed per account.
- Observations may create a LearningProposal but may not silently change approved facts, policy, memory, or shared skills.
- Web, CLI, API, MCP, and messaging clients share one control-plane state.

## Security and privacy

- Never commit credentials, tokens, cookies, customer data, private messages, or private runtime evidence.
- Secrets never enter prompts or public fixtures.
- High-risk public actions fail closed and require visible human gates.
- Do not implement private scraping or platform-policy bypass as a default connector.
- Public examples must be synthetic or explicitly approved and de-identified.

## Dependencies and licensing

- Do not copy competitor or upstream source without an explicit dependency and license decision.
- Postiz is POC-GATED. Do not fork it, copy its providers, or share its internal database or queues.
- HTTP isolation reduces architectural coupling; it is not a legal safe harbor.
- The root license is not yet selected. Do not label the repository MIT, Apache-2.0, AGPL, or production-ready until the owner decides.

## Engineering

- Baseline: Node.js 20+, ESM, npm workspaces.
- Prefer schema-first contracts, canonical serialization, stable digests, and negative fixtures.
- Migrate legacy code file by file with source commit/digest, semantic changes, license status, and regression tests.
- Do not migrate generated output, private evidence, credentials, or legacy Work App product semantics.
- Do not count a connector/operator role as one of the required agents.
