# SDD-001 — Campaign Walking Skeleton

> Status: `SPEC_READY`  
> Milestone: `M1 — Campaign walking skeleton`  
> Progress module IDs: `M1-01`, `M1-02`, `M1-03`, `M1-04`, `M1-05`, `M1-06`  
> Owner: A梦  
> Goal objective / task reference: Executor task `019fc6d8-2c5a-76d3-b3ad-ddb96b56f62e`; complete the persisted Campaign walking skeleton, four editable previews, schedule contract, verification, Chinese acceptance report, and structured handoff.  
> Target evidence maturity: `ENGINEERING_VERIFIED`  
> Acceptance report: `docs/reports/acceptance/SDD-001-ACCEPTANCE.md`  
> Last updated: `2026-08-03`

## 0. Spec Kit lifecycle record

GitHub Spec Kit is used as a method without installing `specify` or creating `.specify/`:

1. **Constitution:** `docs/specs/sdd-001/CONSTITUTION.md` indexes the task authorization, `AGENTS.md`, current architecture, roadmap, progress register, dependency policy, and M0 acceptance boundary.
2. **Specify:** Sections 1–4 and 9 define the Owner-visible problem, scope, states, and binary outcomes.
3. **Clarify:** `docs/specs/sdd-001/CLARIFICATIONS.md` resolves repository-grounded ambiguities without requesting credentials or new authority.
4. **Plan:** Sections 5–8, 10, and 12 plus `docs/specs/sdd-001/PLAN.md` define the exact application, data, API, UI, schedule, and rollback design.
5. **Checklist:** `docs/specs/sdd-001/CHECKLIST.md` checks requirements, tenancy, security, i18n, time, license, evidence, and non-claims.
6. **Tasks:** `docs/specs/sdd-001/TASKS.md` orders M1-01 through M1-06 and names file/test checkpoints.
7. **Analyze:** `docs/specs/sdd-001/ANALYZE.md` records the cross-artifact review and the decision to enter `SPEC_READY` before implementation.
8. **Implement / Converge / Accept:** implementation starts only after this spec-ready state. Closeout maps every criterion to evidence and produces the Chinese acceptance report and status handoff.

## 1. User problem and outcome

The immediate user is a non-technical LumiClaw Owner. M0 provides a safe product shell, but it cannot create or preserve business state. Refreshing or restarting cannot reopen a Campaign because no Campaign exists. The four-platform area is a static placeholder, and schedule behavior has no domain or persistence contract.

When this SDD is complete, the Owner can use the same Chinese-default Web journey to:

- create one synthetic/local Campaign from a minimum brand matrix;
- save and reopen the same Campaign from PostgreSQL with the same canonical digest;
- inspect Claim/Evidence gaps, AccountMandate boundaries, and four exact ActivationUnits;
- edit X, Bluesky, LinkedIn, and Xiaohongshu draft content and see distinct native-like approximations;
- save a one-time or bounded recurring Schedule with its IANA zone, local wall time, resolved UTC instant, DST decision, and misfire policy;
- see honest empty, loading, blocked, needs-owner, saved, and recovery states on the five main screens.

This belongs in M1 because M2 AgentTeams SHADOW work must read and write one durable control-plane Campaign rather than an M0 page-only fixture.

## 2. Verified current state

At base `4568277f9dc8e302141b93bb38ded20200fb31a9`:

- the Worktree is clean and `M1-01` is the only canonical `IN_PROGRESS` module;
- `apps/api/src/server.ts` serves `/health` and rejects `/api/v1/campaigns` as `FOUNDATION_ROUTE_NOT_FOUND`;
- `packages/db/migrations/000001_foundation.cjs` contains only `foundation_metadata`;
- `apps/web/src/components/product-shell.tsx` renders five routes and a static three-column four-platform placeholder;
- `apps/web/src/app/globals.css` sets a `55rem` narrow-layout rail and M0 acceptance records `documentElement.scrollWidth=912` at `390 × 844`;
- `packages/runtime-agentteams` proves only an isolated adapter/profile contract, not a live Mission;
- M0 Compose, locale parity, Storybook, dependency/SBOM, secret, status, report, build, persistence, and runtime-profile gates are accepted and must remain intact.

No M1 business table, JSON Schema, Campaign repository, OpenAPI resource, Schedule/Occurrence, editable platform draft, or M1 acceptance report exists.

## 3. Scope

### In scope

- versioned schemas/types and negative fixtures for Organization, Identity, Brand, Product, Market, ChannelAccount, AccountMandate;
- CampaignBrief, GoalProfile, Claim/Evidence, ActivationPlan/ActivationUnit, MissionContract, ArtifactRevision, CapabilitySnapshot, PublishingSchedule, and ScheduleOccurrence minimum contracts;
- RFC 8785-style project canonical serialization (lexicographically sorted object keys, JSON array order preserved, JSON scalar encoding) and SHA-256 digest;
- PostgreSQL migration and tenant-aware repository for the complete aggregate, immutable snapshot/revision history, idempotency records, schedules, and occurrences;
- `/api/v1` REST plus OpenAPI for create/list/get/update Campaign and schedule-as-part-of-Campaign persistence;
- explicit organization scope header, POST/PUT idempotency, strong ETag, optimistic version conflict, invalid scope/Claim/Product/Market rejection;
- five-screen Web data journey using the same API, Chinese default and English deep links;
- four editable platform drafts and distinct, native-like, constrained previews;
- one-time and bounded RRULE input, IANA zone resolution, DST gap/fold validation, explicit misfire policy, and edit invalidation;
- deterministic MissionContract compiler/AgentTeams adapter-input smoke only; no AgentTeams Project, LLM, provider, or domain-agent execution;
- M2 Governed SHADOW Campaign Epic SDD at `SPEC_READY` without M2 implementation;
- public-safe evidence ZIP, ChatGPT Pro review record, complete local verification, Owner UAT protocol, and Chinese acceptance report.

### Out of scope

- real or de-identified customer/partner input; every committed/default record remains `DEMO_SEED / NOT_LIVE`;
- authentication/SSO/RBAC/RLS claims beyond explicit organization-scoped M1 constraints and negative tests;
- live six-member AgentTeams Mission, DeepSeek/EvoLink/TikHub/Apify/RapidAPI calls, provider credentials, or provider fallback;
- AuditDecision, OwnerDecision, ActionGrant, ActionAttempt, ActionReceipt, real schedule execution, scheduler lease loop, connector, publish, comment, reply, DM, scrape, or native-platform automation;
- Postiz/AGPL source or dependency;
- production readiness, customer UAT, legal compliance, growth, lead, revenue, or external platform capability claims;
- canonical progress-register edits by the Executor, Push, PR, Deploy, external database migration, or online configuration.

### Existing behavior that must not change

- M0 health, Compose failure/recovery/persistence, AgentTeams isolation, Chinese-default routing, English deep links, message/status/report/secret/license/SBOM gates;
- product/category/vision language and maturity discipline;
- the separate `web`, `api`, `mission-worker`, and no-LLM `action-operator` boundaries;
- no Web Server Action or page-only mutation path that bypasses Fastify/PostgreSQL;
- no secret, private evidence, real account, or private customer material in source, fixture, prompt, ZIP, log, or report.

## 4. User journey and UI state contract

### Journey

1. Open `/`; the route remains Chinese and visibly `DEMO_SEED / NOT_LIVE`.
2. The Web requests the Campaign list through its same-origin proxy to Fastify.
3. If empty, enter Organization/Brand/Product/Campaign objective/CTA and create the local synthetic Campaign.
4. Reopen the returned Campaign ID and inspect the four Identity × Product × Market × Account assignments.
5. Inspect Claim status/evidence and any actionable data gap.
6. Open Mission Workspace, select each platform, edit its permitted fields, and observe its distinct preview and constraints.
7. Save with the current ETag; the Web displays the new version/digest. A stale tab receives a visible conflict and never overwrites the later save.
8. Create a one-time or bounded recurrence Schedule. Review wall time, IANA zone, UTC instant, DST classification, and misfire policy before save.
9. Refresh and restart the stack; reopen the same Campaign and confirm the digest/content/schedule remain.
10. Navigate Setup, Mission, Review, and Learn. M2+ actions remain blocked or needs-owner with a truthful explanation.

### Required visible states

| Stable state | Trigger | Owner-visible behavior | Safe next action |
|---|---|---|---|
| `CAMPAIGN_EMPTY` | list is empty | no fake Campaign success | create a synthetic/local Campaign |
| `CAMPAIGN_LOADING` | request pending | bounded skeleton with truth label | wait or cancel navigation |
| `CAMPAIGN_SAVED` | persisted aggregate loaded | version, shortened digest, gaps, and last save shown | continue setup/edit |
| `CAMPAIGN_BLOCKED` | invalid/stale Claim or scope | exact blocking code and affected item | repair Claim/scope |
| `CAMPAIGN_NEEDS_OWNER` | missing evidence, fold choice, or M2 action | what needs a human decision is named | provide the named decision |
| `CAMPAIGN_CONFLICT` | `If-Match` mismatch | no overwrite; latest version/digest shown | reload, compare, and reapply |
| `CAMPAIGN_RECOVERY` | API unavailable/unknown result | no success claim and no blind duplicate create/save | reconnect and reopen by ID/idempotency key |
| `CAMPAIGN_NOT_LIVE` | Review/Learn before M2+ | no approval/publish/response state is invented | continue only within M1 edit/save |

The five screens consume the same aggregate and state vocabulary. Query parameters or Storybook fixtures may select deterministic visual states for review, but they cannot create a success path absent from the API.

At `390px`, `documentElement.scrollWidth <= 390` for the tested flow. Navigation may scroll within its own bounded container, but the document may not inherit the former `55rem` minimum width. Editor controls, preview content, digest, and error text must wrap.

## 5. Domain, canonical, API, and database contracts

### 5.1 Identity and scope

IDs are lowercase UUIDv7 strings. Every business row carries `organization_id`. Requests require `X-LumiClaw-Organization-Id`; route/body/object organization IDs must match it. This is an explicit M1 scope boundary, not a production authentication claim.

Minimum graph edges:

```text
Organization
├─ Identity (organization)
├─ Brand (organization)
├─ Product → Brand
├─ Market (organization)
├─ ChannelAccount → Identity + Platform
└─ AccountMandate → ChannelAccount + Identity + Product + Market
```

An ActivationUnit is valid only when its Identity, Product, Market, ChannelAccount, and AccountMandate belong to one Organization and the Mandate binds those exact IDs. The M1 fixture contains four units for X, Bluesky, LinkedIn, and Xiaohongshu.

### 5.2 Claim/Evidence

A Claim contains version, subject type/id, Market IDs, stable statement, `effectiveFrom`, `effectiveUntil`, `DRAFT | APPROVED | STALE | REVOKED`, and EvidenceRef IDs. A public artifact may reference only a Claim whose organization, Product/Brand subject, Market, status, and effective window match the ActivationUnit at validation time. Invalid scope, stale/revoked/expired Claim, missing EvidenceRef, or Product/Market mismatch fails with stable codes.

Committed fixtures use synthetic sources such as `https://example.invalid/evidence/...`; they do not represent customer evidence.

### 5.3 Campaign aggregate

The versioned M1 aggregate contains:

- `CampaignBrief`: name, objective, CTA, content language, target launch window;
- `GoalProfile`: primary `LAUNCH_MOMENTUM`, supporting `MARKET_LEARNING`, measurement notes without business-result claims;
- graph snapshot and Claim/Evidence set;
- `ActivationPlan` with exactly four platform units;
- `MissionContract` containing source digest, schema versions, role topology IDs, artifact requirements, and `executionMode=SHADOW_PREP_ONLY`;
- latest immutable `ArtifactRevision` for every platform;
- CapabilitySnapshot/ContentConstraintSet captured from public-safe M1 fixtures;
- PublishingSchedule/ScheduleOccurrence preview state;
- server envelope: aggregate version, created/updated time, canonical digest, readiness/gap codes.

Canonical payload excludes server envelope fields (`version`, `digest`, ETag, timestamps, request IDs) and sorts object keys recursively while preserving arrays. SHA-256 is lowercase hex. Reopening unchanged content returns the same digest. Any governed content, account, market, Claim, artifact, or schedule change changes the digest.

### 5.4 Platform artifacts and constraints

| Platform | Editable minimum | Preview minimum | Execution mode fixture |
|---|---|---|---|
| X | post/thread items, media refs, alt text | feed/thread, author, media grid, weighted counter | `PREPARE_ONLY` |
| Bluesky | text/thread items, facets/links, embed ref, alt text | feed/thread, handle, embed/facet indication | `DIRECT_PLANNED_NOT_CONNECTED` |
| LinkedIn | commentary, author kind, link card/media refs | person/company header, see-more, card/media | `NATIVE_HANDOFF_PLANNED` |
| Xiaohongshu | title, body, topics, cover, carousel/poster refs | phone note card/detail, cover, topics | `NATIVE_HANDOFF_PLANNED` |

Constraints come from the referenced versioned CapabilitySnapshot, never React constants. Save revalidates them on the server. Preview always shows target account/identity, snapshot capture time, execution mode, violations, and the native-rendering disclaimer.

### 5.5 Schedule semantics

`PublishingSchedule` is versioned PostgreSQL state:

- kind `ONCE | RRULE`;
- `localStart` as a timezone-less wall-clock string;
- IANA `timeZone`;
- resolved `scheduledFor` UTC instant;
- fold disambiguation `EARLIER | LATER | REJECT`;
- misfire `SKIP | RUN_ONCE | RESCHEDULE`;
- for recurrence, canonical `FREQ=DAILY|WEEKLY`, `INTERVAL=1..30`, optional weekly `BYDAY`, and exactly one bounded `COUNT=1..90` or `UNTIL` no more than 365 days from start;
- state `ENABLED | PAUSED | CANCELLED`, revision, `approvalState=NOT_REVIEWED`, and invalidation reason.

Zero matching UTC instants is `SCHEDULE_DST_GAP`. Two matching instants is `SCHEDULE_DST_FOLD` unless the Owner selects `EARLIER` or `LATER`; both candidate UTC instants are returned for review. M1 creates immutable/versioned Occurrence previews in `NEEDS_REVIEW`; it does not claim due rows, lease them, grant action, or call the Operator. Editing content/account/time/recurrence cancels superseded future previews and resets review/grant references to absent.

### 5.6 REST and OpenAPI

All responses include `mode=DEMO_SEED`, `live=false`, and a stable `code` where applicable.

| Method/path | Required control | Result |
|---|---|---|
| `GET /api/v1/openapi.json` | none | OpenAPI 3.1 document generated from the M1 schema registry |
| `GET /api/v1/campaigns` | organization header | summaries from PostgreSQL only |
| `POST /api/v1/campaigns` | organization header + `Idempotency-Key` | validate/create aggregate, `201`, `Location`, strong ETag |
| `GET /api/v1/campaigns/{id}` | organization header | exact aggregate, strong ETag; cross-tenant looks not found |
| `PUT /api/v1/campaigns/{id}` | organization header + idempotency + strong `If-Match` | validate/save new snapshot/revisions/schedules, `200`, new ETag |
| `GET /api/v1/campaigns/{id}/mission-contract` | organization header | same persisted source digest for future CLI/AgentTeams adapter |

Idempotency records bind organization, method, route, key, request digest, status, response body, and expiry. Same key/same digest replays the stored response. Same key/different digest returns `409 IDEMPOTENCY_KEY_REUSED`. Missing key returns `428 IDEMPOTENCY_KEY_REQUIRED`. Missing/stale If-Match returns `428 ETAG_REQUIRED` or `412 CAMPAIGN_VERSION_CONFLICT` with current ETag/version/digest. Database and unknown errors do not return success.

### 5.7 PostgreSQL tables and history

Migration `000002_campaign_walking_skeleton.cjs` adds organization graph tables, Campaign aggregate/snapshot, Claims/Evidence, artifacts/revisions, CapabilitySnapshots, schedules/occurrences, and idempotency records. Composite organization foreign keys prevent cross-tenant references. Unique constraints include `(organization_id,id)`, `(organization_id,campaign_id,version)`, artifact revision identity, `(organization_id,schedule_id,version)`, and occurrence `(organization_id,schedule_id,scheduled_for)`.

Mutable aggregate heads point to append-only snapshots/revisions. The down migration removes only M1 tables in reverse dependency order and is authorized only for project-scoped local test data.

## 6. AgentTeams and compiler boundary

M1 creates no live AgentTeam and no reusable Agent Skill. A deterministic compiler smoke reads the persisted Campaign and emits one adapter input:

- exact Campaign/source digest;
- six stable role IDs from the accepted TeamProfile;
- Leader marked orchestration-only;
- separate Evidence Steward, Planner, two Producers, and Auditor;
- four artifact requirements and no action permission;
- `live=false`, `executionMode=SHADOW_PREP_ONLY`.

The smoke proves Web/API/future adapter refer to one persisted contract. It does not create a Project, Task, ACK, Submit, model call, artifact, audit, approval, or public action. Those are M2.

## 7. Dependencies and reuse decision

No new external runtime dependency is required. M1 directly reuses accepted exact pins for Fastify, `pg`, Kysely, Next/React/next-intl, Ajv, Vitest, Storybook, and PostgreSQL. New workspace packages are repository-owned Apache-2.0 source.

| Classification | Component | Version/license | Boundary/replacement |
|---|---|---|---|
| BUILD | `@lumiclaw/domain` | repository / Apache-2.0 | schema registry, validation, canonical digest, schedule parser |
| BUILD | `@lumiclaw/mission-compiler` | repository / Apache-2.0 | deterministic M1 adapter input only |
| INTEGRATE | Fastify / Kysely / pg / Ajv / Next / next-intl / Storybook | accepted M0 exact pins / permissive licenses | existing adapters and package boundaries |
| POC-GATED | Spec Kit CLI, Postiz, real Providers/Connectors | not added | no M1 invocation or data access |

The lockfile may change only for workspace links and existing accepted dependency reachability. Any unavoidable new package requires an exact pin, source/license/provenance/replacement entry, SBOM update, `npm ci` lock check, and recorded rationale before merge.

## 8. Failure, recovery, and rollback

- schema/scope/Claim/artifact/schedule error: reject before transaction commit with stable code and field details;
- organization header/body mismatch or cross-tenant ID: reject/not-found without leaking the other tenant;
- stale ETag or duplicate idempotency key with another body: no overwrite/no second create;
- PostgreSQL unavailable or transaction error: `503 CONTROL_PLANE_UNAVAILABLE`; UI enters recovery and never claims save success;
- response lost after commit: replay the same idempotency key and reopen by returned/known Campaign ID;
- DST gap/fold/invalid IANA/RRULE: reject or require explicit Owner selection before save;
- schedule edit: append version, cancel superseded future occurrence previews, remove any review/action reference, no external action;
- Web/API restart: all aggregate content is recovered from PostgreSQL, not process memory;
- code rollback: local `git revert` of M1 commits; no history rewrite;
- data rollback: project-scoped M1 down migration or fresh test-volume recreation only, never an external/production database;
- ordinary stop: `docker compose down` preserves volumes; verification cleanup names the exact SDD project and removes only its resources.

No M1 failure invokes a provider, platform, scheduler execution, AgentTeams Mission, or Operator.

## 9. Binary acceptance criteria

| ID | Pass/fail statement |
|---|---|
| AC-01 | Versioned schemas and TypeScript contracts exist for the required graph and Campaign objects; valid fixtures pass and missing, malformed, tampered, cross-tenant, expired/revoked Claim, Product mismatch, and Market mismatch fixtures fail with stable codes. |
| AC-02 | Canonical serialization is deterministic across object-key order; any governed field change changes the SHA-256 digest; create → save → restart/reopen unchanged content preserves the digest. |
| AC-03 | PostgreSQL migration creates tenant-aware M1 tables with composite scope constraints, append-only snapshot/revision history, idempotency, Schedule/Occurrence uniqueness, and a project-scoped down path. |
| AC-04 | REST/OpenAPI create/list/get/update/mission-contract paths operate only through the PostgreSQL store and require the specified organization/idempotency/ETag controls. |
| AC-05 | Same idempotency key/body replays the same create/update result; reused key/different body, missing key, stale/missing ETag, and cross-tenant access fail without duplicate or overwrite. |
| AC-06 | Five Web screens consume the same API state and visibly cover empty, loading, blocked, needs-owner, saved, conflict, and recovery/non-live states in both locales without raw message keys or live claims. |
| AC-07 | X, Bluesky, LinkedIn, and Xiaohongshu each have editable models, distinct native-like previews, server-validated versioned constraint fixtures, account/identity/mode/snapshot/disclaimer display, and saved revisions that reopen unchanged. |
| AC-08 | One-time and constrained RRULE schedules persist IANA zone, local wall time, UTC resolution, misfire and version; invalid IANA/RRULE, DST gap, unresolved fold, and edit invalidation tests pass; every M1 occurrence is `NEEDS_REVIEW` and no due action is executed. |
| AC-09 | The deterministic compiler smoke imports the persisted Campaign/source digest into an adapter input with six separated role IDs and no action permission while `live=false`; no AgentTeams Project/model/provider call occurs. |
| AC-10 | At a real `390 × 844` browser viewport, document width is at most viewport width for create, reopen, composer, constraint error, and schedule states; desktop remains usable and browser console has no application warning/error. |
| AC-11 | `npm ci` leaves the lockfile unchanged; lint, typecheck, unit/contract, messages/status/report/secret/license/SBOM, production build, Storybook, PostgreSQL integration, and Compose fresh/failure/recovery/persistence gates pass. |
| AC-12 | Fresh Compose creates and reopens a Campaign after restart/down-up; database unavailable and broken migration still fail closed; verification performs only exact project-scoped cleanup. |
| AC-13 | `SDD-002 Governed SHADOW Campaign` and its Constitution/Clarifications/Plan/Checklist/Tasks/Analyze artifacts are `SPEC_READY`, scoped only to M2 and contain no M2 implementation claim. |
| AC-14 | The Chinese acceptance report records exact commands/results, evidence, Pro URLs/ZIP/corrections, limitations/non-claims, rollback, Owner UAT, proposed states, and structured handoff; Executor leaves both progress registers unchanged. |
| AC-15 | A public-safe source ZIP records Base, branch, file count, bytes and SHA-256, passes filename/content secret scan, excludes prohibited runtime/private/generated material, and only its reviewed public-safe contents reach ChatGPT Pro. |
| AC-16 | No committed/runtime path can publish, comment, reply, DM, scrape, call a real Provider, execute a due occurrence, create an ActionGrant, or report a business/customer/production outcome. |

## 10. Test plan

| Layer | Required tests/evidence |
|---|---|
| Schema/unit | graph/Campaign fixtures, canonical serialization/digest, UUIDv7, Claim scope/time, platform constraints, IANA/RRULE/DST gap/fold |
| Repository/DB | migration up/down, composite tenant FKs, create/reopen/update/history, transaction rollback, idempotency, occurrence uniqueness/edit invalidation |
| API contract | OpenAPI, organization scope, create/list/get/update/mission contract, ETag, 428/409/412/422/503 responses |
| Compiler | persisted source digest, six role IDs, orchestration-only Leader, no action/live permission |
| Web/component | state reducer, forms, four preview render models, constraint display, locale keys, Storybook state/platform stories |
| Browser | real local create/edit/save/reopen/schedule flow, zh-CN default, `/en` deep link, 390px/desktop widths, console, screenshots |
| Compose | fresh migration, broken migration, DB unavailable, health, restart/down-up persistence, M0 blob persistence, exact cleanup |
| Security/license | tracked filename/content scan, positive secret fixture, dependency inventory/license/SBOM, source ZIP allowlist/denylist |
| Full gate | `npm run verify` plus M1 integration/Compose/evidence scripts from a clean install |

All default/test content is synthetic. Real external calls are prohibited, not skipped successes.

## 11. Evidence and claims

Required machine evidence under ignored `.evidence/sdd-001/`:

- `domain-contracts.json`, `api-integration.json`, `compose-verification.json`;
- `browser-verification.json` and public-safe screenshot/image hashes;
- `source-package-manifest.json`, `secret-scan.json`, dependency inventory/SBOM;
- `mission-compiler-smoke.json`, full `run-manifest.json`;
- Chinese `docs/reports/acceptance/SDD-001-ACCEPTANCE.md`.

Valid claim after all machine verification: `ENGINEERING_VERIFIED — the local M1 Campaign walking skeleton persists and reopens one synthetic Campaign with four editable preview revisions and a non-executing persistent schedule contract.`

Still `PLANNED`: live AgentTeams, Model/Media/Signal Providers, audit/approval/grants, due schedule execution, connectors, Direct/Handoff, receipt/reconciliation, response/learning, hosted/production operation.

Explicitly `NOT_CLAIMED`: customer UAT, external calibration, live platform/account capability, production readiness, security/compliance certification, growth, lead, revenue, or any external action.

## 12. Delivery plan and dependency order

```text
M1-01 graph/schema/migration
→ M1-02 Campaign/Claim/artifact/digest/compiler contracts
→ M1-03 PostgreSQL repository + REST/OpenAPI + reopen
→ M1-04 five-screen shared-state journey + responsive recovery
→ M1-05 four editors/previews/constraints
→ M1-06 schedule/occurrence/editor/DST/misfire
→ M2 SDD SPEC_READY + convergence/evidence
```

The detailed file surfaces and test-first checkpoints are in `docs/specs/sdd-001/TASKS.md`. Executor does not alter canonical statuses; final handoff proposes `EVIDENCE_READY` until required Owner UAT and Coordinator review are recorded.

## 13. Alternatives and decision log

- **Store the Campaign in Next/browser/localStorage:** rejected because it creates a Web-only state and breaks restart/API/AgentTeams consistency.
- **Use SQLite/in-memory state:** rejected because PostgreSQL is the frozen authority and tenant/transaction/history behavior must be tested now.
- **Add a generic social-publishing SaaS/SDK:** rejected; M1 saves/previews only and Postiz remains POC-gated.
- **Use host cron, `node-cron`, or an in-memory timer:** rejected; Schedule/Occurrence are business state and execution is M3.
- **Implement a live six-member Mission in M1:** rejected; M1 owns compiler/import smoke only and M2 owns AgentTeams/DeepSeek/Audit.
- **Hard-code platform limits in React:** rejected; versioned server-validated CapabilitySnapshot/ConstraintSet is the source.
- **Treat organization header as production auth:** rejected; it is an explicit M1 scope/conformance boundary. Hosted authentication/RLS remains later work.
- **Add RRULE/timezone packages immediately:** rejected; the bounded rule and IANA gap/fold classification can be implemented/tested with platform `Intl`. Reopen if the contract expands beyond DAILY/WEEKLY or interoperability evidence shows a conformance gap.

## 14. Owner-participated acceptance

### UAT-01 — Create, save, reopen, and understand readiness

- **Why useful:** only the Owner can decide whether the brand matrix, Claim gap, ActivationPlan, and safe next step are more useful than a generic copy generator.
- **Prerequisites:** delivered local commit, Docker Desktop, exact Node/npm, no API key; use the provided synthetic `DEMO_SEED` content only.
- **Steps:**
  1. Start the documented project-scoped Compose stack.
  2. Open `http://127.0.0.1:3100/`; confirm Chinese and the non-live truth marker.
  3. Create the supplied local Campaign and record its ID, version, and displayed digest.
  4. Open Setup and confirm four ActivationUnits clearly bind speaker/product/market/account and expose the Claim/Evidence gap.
  5. Refresh, then stop/start the stack without deleting volumes; reopen the Campaign.
  6. Confirm objective, CTA, four units, and digest are unchanged.
- **Expected:** the Owner can explain what each account represents, what evidence is missing, and the one safe next step; no page implies an Agent run or platform action.
- **Failure signs:** lost Campaign, changed digest without edit, unclear identity/account, hidden Claim gap, fake live state, raw error/key, or external request.
- **Evidence to return:** create/reopen screenshots and written `UAT-01 PASS` or failed criterion IDs.
- **Cleanup:** `docker compose down` preserves the project volumes; do not use global prune.

### UAT-02 — Four-platform editing, schedule, and mobile recovery

- **Why useful:** validates that platform differences and time semantics are understandable without engineering logs.
- **Prerequisites:** UAT-01 Campaign, browser with desktop and `390 × 844` responsive mode.
- **Steps:**
  1. Open Mission Workspace and edit one visible field on each platform.
  2. Confirm each preview changes differently and displays account, execution mode, capability time, violations, and disclaimer.
  3. Save; reload and confirm all four edits persist.
  4. Add a one-time schedule in `Asia/Singapore`; confirm local and UTC display.
  5. Try documented New York DST gap and fold fixtures; confirm gap rejection and explicit earlier/later selection for fold.
  6. Repeat create/reopen/composer/schedule checks at `390 × 844`; inspect for document-level horizontal scrolling.
  7. Switch to English and confirm the same route/state/Campaign remains.
- **Expected:** distinct editable previews, persistent edits, honest non-executing schedule, explicit DST handling, no severe horizontal overflow or console error.
- **Failure signs:** identical generic previews, saved data loss, platform constraint hidden, schedule shown as published/running, silent fold choice, wrong locale/route, document width above viewport, or console application error.
- **Evidence to return:** four-platform desktop screenshot, schedule/DST screenshot, mobile screenshot, `/en/mission` screenshot, written `UAT-02 PASS` or failed criterion IDs.
- **Cleanup:** ordinary `docker compose down`; do not delete volumes unless intentionally resetting only this local fixture.

## 15. Task closeout

- Acceptance report: `docs/reports/acceptance/SDD-001-ACCEPTANCE.md`.
- Proposed module states after machine verification: `M1-01` through `M1-06` → `EVIDENCE_READY`; Coordinator/Owner decide canonical `ACCEPTED` transitions.
- The Goal remains active until implementation, full verification, Chinese report, local commits, source ZIP/Pro record, Owner protocol, and structured handoff are complete.
- Next candidate after Coordinator acceptance: implement `SDD-002 Governed SHADOW Campaign`; no M2 code starts in this task.

