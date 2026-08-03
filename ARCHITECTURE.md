# LumiClaw Presence Architecture

[English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md) | [README](README.md) | [Roadmap](ROADMAP.md)

> **Status:** Mixed implementation truth. M0/M1 are accepted; this branch adds an SDD-002 M2 Executor evidence candidate with a real pinned six-member AgentTeams SHADOW Mission, provider ports/conformance, immutable revisions, independent audit and non-executable Owner Review. Credentialed provider Canaries, ActionGrants, connectors, external actions and production deployment remain `PLANNED`.

## Architecture goals

LumiClaw Presence is planned as a control and learning layer for global brand operations. The architecture is designed to keep five concerns separate:

- business state and evidence owned by LumiClaw;
- specialized multi-agent work executed through AgentTeams;
- deterministic review, approval, and external-action governance;
- replaceable model, media, signal, and publishing providers;
- editable platform-native artifacts whose preview does not overstate execution capability.

The first reference journey is **Global Campaign Activation & Response** across a founder identity and a product identity. It produces editable variants for X, Bluesky, LinkedIn, and Xiaohongshu, then follows the honest execution path available to each account.

## Planned system topology

~~~mermaid
flowchart LR
    U["Owner / Reviewer"] --> W["web · Next.js 16"]
    W -->|"REST + SSE"| A["api · Fastify 5"]
    A --> DB[("PostgreSQL 17")]
    A --> BS["BlobStore Port"]
    A --> Q["Postgres Jobs + Action Outbox"]

    Q --> MW["mission-worker"]
    Q --> AO["action-operator · no LLM"]

    subgraph ExternalExecution["External execution domain"]
        AT["AgentTeams Runtime"]
    end

    MW --> RA["AgentTeams Runtime Adapter"]
    RA --> AT
    MW --> MP["ModelProvider"]
    MP --> DS["DeepSeek Official API"]
    MW --> MGP["MediaGenerationProvider"]
    MGP --> EV["EvoLink"]
    MW --> SP["SignalProvider"]
    SP --> SIG["Official APIs / gated providers"]

    AO --> SAG["Social Action Gateway"]
    SAG --> BSKY["Bluesky Direct"]
    SAG --> XD["X Direct Canary"]
    SAG --> HO["LinkedIn / Xiaohongshu / X fallback Handoff"]

    DB --> EE["Trace / Ledger / Evidence Export"]
~~~

The Web never stores platform tokens or calls publishing APIs directly. The API is the shared control plane for every client. Long-running and provider work belongs to `mission-worker`; privileged public actions belong to the separate, deterministic `action-operator`.

## Planned technical baseline

| Area | Selected baseline | Boundary |
|---|---|---|
| Runtime | Node.js 24 LTS, TypeScript, ESM, npm workspaces | One versioned monorepo; versions and digests will be locked in code |
| Web | Next.js 16, React 19.2, `next-intl`, TanStack Query, React Hook Form | Chinese-default, English-capable product UI and same-origin entry only; no second mutation path in Server Actions |
| API | Fastify 5 | REST/OpenAPI, SSE, sessions, authorization, validation, and control-plane mutations |
| Database | PostgreSQL 17 | The sole authoritative business store |
| Data access | `pg`, Kysely, `node-pg-migrate` | Reviewable SQL and explicit migrations |
| Contracts | JSON Schema and Ajv | Cross-process contract source and runtime validation |
| Media storage | `BlobStore` port | Content-addressed local filesystem volume by default; BYO S3-compatible endpoint supported later |
| UI system | Tailwind CSS plus accessible headless primitives | LumiClaw owns the visual system and state language |
| Quality | Vitest, Testing Library, Storybook, Playwright, axe, MSW | Unit, contract, state-matrix, accessibility, and end-to-end verification |
| Installation | Docker Compose | First runnable and installable contract |

These selections are plans, not evidence that packages are installed or integrated.

## Process and deployment boundaries

The first Docker Compose contract is planned around four application processes and supporting infrastructure:

| Process | Responsibility | Explicitly excluded |
|---|---|---|
| `web` | Five-screen product journey, editable composer, native-like previews, review UI | Platform secrets, direct publishing, authoritative domain mutations |
| `api` | Organization and campaign APIs, schema validation, revisions, decisions, capability and receipt queries, SSE | Long-running jobs and external platform actions |
| `mission-worker` | Jobs, persistent schedule claiming/recovery, AgentTeams dispatch and recovery, DeepSeek calls, EvoLink tasks, signal ingestion, capability probes, evidence export | Social-account write credentials and approved-action execution |
| `action-operator` | Verify and consume exact ActionGrants, call approved connectors, append receipts and reconciliation records | LLMs, AgentTeams, content editing, broad private context |
| `migrate` | Run and record explicit database migrations once | Serving application traffic |
| `postgres` | Business facts, shared mission state, jobs, outbox, trace, and ledger | Large provider blobs and plaintext secrets; an encrypted local SecretBroker store may use a separately protected schema |
| `agentteams` | Optional Compose profile or externally managed runtime | Product database, secret store, or publishing operator |

The default path uses PostgreSQL jobs, leases, heartbeats, `FOR UPDATE SKIP LOCKED`, and an action outbox. Redis is not part of the initial authoritative path. AgentTeams remains a separate execution domain and must not become the only copy of an artifact, task event, or trace.

## Internationalization and time semantics

The planned Web shell uses `next-intl` with Next.js App Router. Initial UI locales are `zh-CN` (default) and `en`, with locale-aware routes, a persisted user or organization preference, typed message catalogs, and CI parity checks. API and domain contracts return stable codes plus parameters; translated labels are never persisted as enums, audit states, or receipt semantics.

Four concepts remain independent:

- UI locale: how the operator sees LumiClaw;
- content language: the language of a campaign artifact;
- target market: the market whose policy, narrative, and audience apply;
- schedule time zone: the IANA zone used to compute an occurrence.

Locale-aware date and number display must not change the persisted instant. Schedule entry always displays the selected IANA zone and the resolved UTC instant before approval.

## Persistent scheduling, not ephemeral cron

Scheduling is planned as governed business state. The initial implementation does not depend on host crontab or an in-memory `node-cron` timer. PostgreSQL stores `publishing_schedules`, immutable or versioned `schedule_occurrences`, `next_run_at` as `timestamptz`, the IANA time zone, and either a one-time instant or a constrained RFC 5545 recurrence rule.

The `mission-worker` initially runs the scheduler loop and claims due occurrences with row locks, a lease, heartbeat, and duplicate-prevention key. A hosted deployment may later split this loop into a dedicated scheduler process without changing the schedule or occurrence contracts. Every schedule declares an explicit misfire policy—`SKIP`, `RUN_ONCE`, or `RESCHEDULE`—so downtime never causes an unbounded catch-up burst.

~~~text
Schedule
→ due Occurrence
→ exact ArtifactRevision and AuditDecision
→ exact OwnerDecision
→ time-bounded, single-use ActionGrant
→ Action Operator
→ ActionReceipt or reconciliation
~~~

A recurring schedule never owns a perpetual grant. In the first governed path, each occurrence requires an exact approved revision and a fresh grant. Editing content, target account, execution time, or recurrence invalidates affected approval/grant state. M1 delivers the persistent model and editor without external action; M3 adds due-occurrence execution, restart recovery, and receipt reconciliation.

## Control-plane state and governed actions

PostgreSQL is planned as the single authoritative business database. Immutable revisions and append-only decisions, grants, receipts, trace, and ledger entries preserve the evidence chain. Larger source payloads, media, and evidence exports go through the `BlobStore` port.

The governed edit and action path is:

~~~text
Local Draft
→ explicit Save Revision
→ immutable ArtifactRevision
→ independent AuditDecision
→ exact OwnerDecision
→ signed, short-lived, single-use ActionGrant
→ deterministic Action Operator
→ append-only ActionReceipt
→ reconciliation when external state is unknown
~~~

Editing text, media, order, cover, alt text, or CTA changes the digest. An edit after audit requires re-audit; an edit after approval invalidates the previous decision and any unconsumed grant. A queue ID or provider HTTP success is never treated as native publication proof.

## AgentTeams execution domain

The Hero path plans to compile each mission into a six-member AgentTeams team:

1. Presence Mission Leader;
2. Evidence & Claim Steward;
3. Campaign Planner;
4. Founder Identity Producer;
5. Product Account Producer;
6. Independent Auditor.

The Leader coordinates but does not create domain artifacts. Producers and the Auditor remain separate, and an AgentTeams completion cannot issue an ActionGrant. The Runtime Adapter translates LumiClaw's `MissionContract`, `RoleContext`, `TaskContract`, and `SkillLock` into AgentTeams work, then validates returned artifact and input digests before persisting them in the control plane.

AgentTeams may run through an external endpoint or an optional pinned Compose profile. Its internal Matrix, object storage, workers, and runtime state are not LumiClaw's product data plane.

The SDD-002 candidate pins AgentTeams v1.2.0 source and image digests, creates exactly one Leader plus five Workers, and exercises real Project/DAG/Task/ACK/Submit operations. The adapter accepts only the Mission's exact role identity, input digest, SkillLock digest and output schema; conflicting or duplicate accepted output is quarantined. Accepted payloads are materialized only through the API into the same PostgreSQL Mission that references the persisted M1 Campaign. AgentTeams can be restarted and reconciled, but it never becomes a second business source of truth. A bounded upstream v1.2.0 gap—no public checked-result acceptance operation—is handled by its versioned public task store API after the official effective-result check; no AgentTeams Manager, Worker or Matrix source/image is modified.

## Provider ports

Read-side intelligence and write-side actions use different interfaces so that a data provider cannot silently gain publishing authority.

| Port | First planned provider | Contract boundary |
|---|---|---|
| `ModelProvider` | DeepSeek official API | Structured reasoning and tool calls; schema validation, role routing, cost and model snapshots remain in LumiClaw |
| `MediaGenerationProvider` | EvoLink | Asynchronous image/video tasks; results are downloaded, hashed, stored, reviewed, and never auto-approved |
| `SignalProvider` | Official APIs first; TikHub, Apify, or a specific RapidAPI provider only behind separate PoC gates | Read-only public signals; purpose, provenance, terms, retention, quarantine, PII, and schema checks are required |
| `PublishConnector` | Bluesky; X only after its Direct PoC gate | Exact approved external actions with account capability and native receipt semantics |
| `NativeHandoffAdapter` | LinkedIn, Xiaohongshu, and X fallback | User-driven native completion with URL or approved evidence reconciliation |

The planned DeepSeek routes are `deepseek-v4-flash` for lower-risk transformation and summarization, and `deepseek-v4-pro` for planning, evidence stewardship, audit, and higher-risk revision. EvoLink is replaceable and never becomes the media asset source of truth. A `SignalProvider` can only produce a claim candidate; it cannot turn third-party data into an approved public claim by itself.

In the SDD-002 candidate, the DeepSeek official gateway and media-provider boundary are implemented and conformance-tested. Model/config/cost/latency/error snapshots, structured-schema validation, bounded retry for 429/5xx, timeout, redaction and no-silent-model-switch behavior are persisted contracts. Media ingest is content-addressed and requires synthetic-rights/cost receipts while remaining unapproved. No credential was supplied, so DeepSeek and EvoLink live Canaries are `NOT_RUN_NO_KEY`; public-safe fixtures are `MOCK_CONFORMANCE`, not real-provider evidence.

## Four-platform editable composer

All four platform artifacts are planned as editable, independently auditable revisions. Each preview must display its target identity/account, capability snapshot and capture time, execution mode, constraint failures, and a notice that native rendering may change.

| Platform | Planned editable preview | Planned execution semantics | Hero gate |
|---|---|---|---|
| Bluesky | Feed/thread, facets, embeds, handle, text and media | Official API Direct with native URI/CID reconciliation | **Direct must pass** |
| LinkedIn | Person/company identity, “see more,” link card and media | User-driven Native Handoff with URL reconciliation | **Handoff must pass** |
| Xiaohongshu | Note card, title/body/topics, cover, carousel or video poster | Download/copy package, native-app completion, URL or safe screenshot reconciliation | **Handoff must pass** |
| X | Feed/thread, media grid, weighted text constraints and alt text | Official Direct only after OAuth, scope, budget, failure, idempotency, and read-back gates; otherwise explicit Handoff | Preview must pass; Direct is a **PoC-gated Canary** and cannot block the Hero |

Preview availability does not imply that a connector exists, that an account has the required scope, or that server-side automation is permitted. Unsupported or expired capability must visibly downgrade. This phase excludes automated X replies, likes, follows, repost campaigns, and DMs, and excludes cookie, private-API, or browser-automation publishing for Xiaohongshu.

## Planned design workflow

`DESIGN.md` and the UI state contract will be the shared specification. Pencil is the planned high-fidelity visual source for foundations, components, the five product screens, four platform previews, and the Hero state matrix. Open Design may be used for two bounded interactive HTML spikes—the multi-platform composer and Audit → Approval → Receipt—but neither tool's export becomes production code. Next.js/React remains the implementation source; Storybook and Playwright verify the same state contract, screenshots, interaction paths, and accessibility.

## Planned repository shape

~~~text
apps/
  web/
  api/
  mission-worker/
  action-operator/
packages/
  i18n/
  domain/
  db/
  mission-compiler/
  runtime-agentteams/
  governance/
  execution/
  providers/
  observability/
skills/
conformance/
examples/
  lumiclaw-global-campaign/
infra/
  compose/
docs/
  architecture/
  design/
  reports/
  specs/
scripts/
test/
~~~

This is a target layout. Directories will be added only when a milestone has an implementable specification and verification criteria.

## Delivery gates

The architecture becomes evidence through milestone exits, not through this document:

- M0 establishes the Compose skeleton, database migration path, `next-intl` English/Chinese shell, design contract, progress register, and platform routes;
- M1 delivers the campaign walking skeleton, persistent schedule editor, and four editable previews with capability fixtures;
- M2 connects DeepSeek and the six-member AgentTeams shadow mission with independent audit;
- M3 must pass persistent occurrence recovery, Bluesky Direct plus LinkedIn and Xiaohongshu Handoffs; X Direct remains a gated Canary;
- M4 closes one response/learning loop and isolates at least one non-critical `SignalProvider` PoC;
- M5 proves a fresh Docker install, backup/restore, provider conformance, evidence export, and complete state matrix;
- M6 calibrates shadow use with a real design partner before broader autonomy or tenancy claims.

See the [roadmap](ROADMAP.md) for the full exit criteria and sequencing.
