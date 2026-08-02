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
- The current reference Hero uses one orchestration-only Presence Mission Leader plus five domain members. The Leader may not generate domain artifacts or substitute for the Claim Steward, Planner, Producers, or Auditor.
- Producer and independent auditor must be separate.
- The auditor may pass, fail, or escalate; it may not silently edit or approve.
- A human owner approves exact revisions and external actions.
- A deterministic operator is not counted as an AgentTeams member.
- The action operator is a separate no-LLM process with its own database role and secret scope; mission workers and agents never hold social-account write credentials.
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
- X direct publishing is POC-GATED and uses only official OAuth/API paths. Automated likes, follows, unsolicited DMs, and unapproved AI replies are out of scope.
- Xiaohongshu uses editable content packages and user-driven native handoff unless an official, account-compatible publish capability is verified. Do not use cookies, reverse-engineered APIs, or browser automation to simulate server-side publishing.
- TikHub, Apify, and RapidAPI integrations are read-only SignalProvider candidates. Audit each concrete endpoint, actor, or provider before use; never treat provider output as approved evidence automatically.
- Public examples must be synthetic or explicitly approved and de-identified.

## Dependencies and licensing

- Do not copy competitor or upstream source without an explicit dependency and license decision.
- Postiz is POC-GATED. Do not fork it, copy its providers, or share its internal database or queues.
- HTTP isolation reduces architectural coupling; it is not a legal safe harbor.
- The root license is not yet selected. Do not label the repository MIT, Apache-2.0, AGPL, or production-ready until the owner decides.

## Engineering

- Baseline: Node.js 24 LTS, TypeScript/ESM, npm workspaces, Next.js 16/React 19.2, Fastify 5, PostgreSQL 17, Kysely, and JSON Schema/Ajv.
- Docker Compose is the first local and single-host self-host contract. PostgreSQL is the only authoritative business database; do not introduce Redis or a second object-store service before a measured need.
- The initial application processes are `web`, `api`, `mission-worker`, and a separate `action-operator`. AgentTeams remains an external/profile runtime domain behind an adapter.
- Platform previews are editable, native-like approximations driven by versioned CapabilitySnapshot constraints. Preview support does not imply direct-publish capability.
- DeepSeek Official is the default ModelProvider and EvoLink is a replaceable MediaGenerationProvider; provider names must not leak into core domain semantics.
- Milestone order and exit criteria live in `ROADMAP.md`; new vertical slices use `docs/specs/SPEC-TEMPLATE.md`.
- Prefer schema-first contracts, canonical serialization, stable digests, and negative fixtures.
- Migrate legacy code file by file with source commit/digest, semantic changes, license status, and regression tests.
- Do not migrate generated output, private evidence, credentials, or legacy Work App product semantics.
- Do not count a connector/operator role as one of the required agents.
