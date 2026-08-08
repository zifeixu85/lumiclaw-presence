# SDD-000 — Delivery Foundation

> Status: `SPEC_READY`
> Milestone: `M0 — Delivery foundation`
> Progress module IDs: `M0-03`, `M0-04`, `M0-05`, `M0-06`, `M0-07`
> Owner: A梦
> Goal objective / task reference: 完成 SDD-000 Delivery Foundation（M0-03 至 M0-07）的规范、实现、测试、中文验收报告与状态交接。
> Target evidence maturity: `ENGINEERING_VERIFIED`
> Acceptance report: `docs/reports/acceptance/SDD-000-ACCEPTANCE.md`
> Last updated: `2026-08-03`

## 0. Spec Kit lifecycle record

This SDD uses GitHub Spec Kit as a method, without installing `specify` or creating `.specify/`:

1. **Constitution:** `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `docs/DEPENDENCY-POLICY.md`, the implementation register, and the task authorization are authoritative. They are indexed in `docs/specs/sdd-000/CONSTITUTION.md` rather than copied.
2. **Specify:** Sections 1–4 and 9 define the user-visible problem, scope, states, and binary outcomes without relying on implementation claims.
3. **Clarify:** Section 2 and `docs/specs/sdd-000/CLARIFICATIONS.md` resolve ambiguities from repository evidence. No new product authority is assumed.
4. **Plan:** Sections 5–8, 10, and 12 plus `docs/specs/sdd-000/PLAN.md` define the implementation and verification strategy.
5. **Checklist:** `docs/specs/sdd-000/CHECKLIST.md` checks completeness, security, privacy, i18n, license, failure, rollback, and evidence.
6. **Tasks:** `docs/specs/sdd-000/TASKS.md` lists ordered, test-first tasks with file surfaces and checkpoints.
7. **Analyze:** `docs/specs/sdd-000/ANALYZE.md` records the pre-implementation cross-artifact consistency review and the decision to enter `SPEC_READY`.
8. **Implement / Converge / Accept:** implementation may start only after this commit state; closeout requires criterion-by-criterion evidence and the Chinese acceptance report.

`specify` CLI is deliberately not installed in SDD-000. The methodology is sufficient, while installing generated project files would add a second rule surface without a demonstrated need.

## 1. User problem and outcome

The immediate users are the Owner and a new contributor. Today the public repository is documentation-only. A contributor cannot install a pinned application stack, start a safe local product shell, inspect migration or blob behavior, or run a repeatable quality gate.

When this SDD is complete:

- a contributor on Node.js 24 can run one reproducible npm-workspace install;
- a contributor can start a loopback-only Compose foundation backed by PostgreSQL 17 and a content-addressed local blob volume;
- the Owner can open a visibly non-live, Chinese-default product shell and traverse five main product routes, switch to English, and review the design system in Storybook and Pencil;
- an engineer can validate a pinned, isolated AgentTeams v1.2.0 runtime profile and adapter contract without exposing a host share, Docker socket, public worker port, real API key, or customer data;
- CI can independently reject type, lint, test, build, secret, license/SBOM, locale-parity, progress-parity, and acceptance-report regressions.

This belongs in M0 because every later domain, Mission, connector, and governed action depends on a reproducible, inspectable, safe delivery surface.

## 2. Current state and clarifications

Verified start state at base `5acc7cd508f07fdeabe74e39e366158bf58463f6`:

- the repository is clean and documentation-only;
- `M0-03` is the only canonical `IN_PROGRESS` module; the Executor is not authorized to change canonical module states;
- local tools are Node.js `24.16.0`, npm `11.13.0`, Docker `29.4.0`, Compose `5.1.2`, Git `2.54.0`, macOS arm64;
- a locally cached `postgres:17-alpine` image reports PostgreSQL `17.10` and digest `sha256:dc17045ccfd343b49600570ea734b9c4991cf1c3f3302e67df51e3b402dd55c4`;
- locally cached AgentTeams images are tagged `v1.2.0` and pinned by digest, but the existing running environment is high privilege and prohibited for this SDD;
- no credential or real platform action is required or allowed.

Clarifications that govern implementation:

- **M0 is a foundation, not M1 business behavior.** Seed UI is route/state scaffolding only. No Campaign CRUD, schedule execution, public action, real account, or provider call is added.
- **`DEMO_SEED / NOT_LIVE` is mandatory.** It appears visibly in the product shell and fixture metadata.
- **Database migration is local-test-only.** Docker creates an ephemeral development/test database; no real or external database is targeted.
- **BlobStore is a real content-addressed primitive.** It verifies a digest, idempotent write, read, traversal rejection, and volume persistence, but does not yet attach blobs to business objects.
- **AgentTeams smoke is bounded.** M0 verifies immutable image identity, isolation policy, capability/version probing, team-profile contract compilation, and adapter success/failure semantics. A live LLM-backed six-member Mission remains M2. The report must not describe a fixture/contract smoke as a real AgentTeam run.
- **Pencil is an encrypted design artifact.** It is created and exported only through Pencil tooling; source code does not parse or rewrite `.pen`.
- **Owner UAT remains required.** Passing machine checks justifies `EVIDENCE_READY`; it does not let the Executor declare canonical `ACCEPTED`.

## 3. Scope

### In scope

- root Node/npm/TypeScript/ESM workspace, exact package pins, lockfile, version manifest, dependency register, license inventory, and CycloneDX SBOM;
- `web`, `api`, `mission-worker`, and no-LLM `action-operator` application skeletons with distinct health identities;
- PostgreSQL 17 Compose service, explicit `node-pg-migrate` migration, migration ledger, healthcheck, fresh-volume, persistence, and failure-contract verification;
- content-addressed local filesystem `BlobStore` port and implementation;
- Next.js 16 / React 19.2 / `next-intl` shell with `zh-CN` default, `en`, typed locale/message contracts, five routes, design tokens, state vocabulary, and a four-platform Composer preview baseline;
- Storybook baseline and Pencil review artifact/export;
- isolated AgentTeams v1.2.0 profile policy, pinned image manifest, adapter, runtime capability report schema, offline/controlled smoke, and negative isolation tests;
- local and GitHub CI gates for lint, typecheck, unit, contract, integration, build, Storybook, secret scan, SBOM/license, bilingual messages, bilingual status IDs/states, and acceptance report structure;
- Chinese acceptance report, machine-readable evidence manifests, exact Owner UAT, recovery, rollback, and structured status handoff.

### Out of scope

- M1 domain schemas, Campaign persistence or editing, Schedule/Occurrence behavior, business API, live AgentTeams Mission, LLM/model/media/signal provider calls;
- ActionGrant, ActionReceipt, connector, publish, native handoff, real platform account, OAuth, API key, customer material, private runtime evidence;
- hidden production defaults, internet deployment, Push, PR, Deploy, or canonical implementation-status state changes;
- legacy prototype source migration;
- full visual identity, production analytics, complete accessibility certification, or production security claim.

### Existing behavior that must not change

- Apache-2.0 license, contribution/dependency policy, product and architecture boundaries, claim maturity language, and bilingual canonical documentation remain authoritative;
- English and Chinese implementation-register module IDs/states remain byte-for-semantic mirrors and retain their existing states;
- no public fixture or committed output contains credentials, customer data, private messages, account identifiers, or private runtime evidence.

## 4. User journey and UI states

### Owner review journey

1. Start the documented local stack.
2. Open `/`; it resolves to the default Chinese shell without a visible locale prefix.
3. Confirm a persistent `DEMO_SEED / NOT_LIVE` label and the current goal/next-step explanation.
4. Traverse Campaigns, Setup & Readiness, Mission Workspace, Review & Action Center, and Response & Learn.
5. In Mission Workspace, inspect four channel rows and a bounded Composer/preview placeholder. No channel is presented as connected or published.
6. Switch to English; the equivalent shareable English route opens with the same route key and state meaning.
7. Open Storybook and the exported Pencil overview to compare route/state/design-token baselines.
8. Review the runtime capability and machine evidence reports without exposing secrets.

### Required visible states

- **empty:** no live Campaign exists; action is “start M1 setup” rather than synthetic success;
- **loading/running:** skeleton and progress copy are available in both locales;
- **blocked:** unsupported/not-connected capability explains why no external action can occur;
- **owner action:** review cards state the one safe next step;
- **failure:** stable error code plus localized explanation; no translated enum is persisted;
- **unknown/recovery:** shell copy says the state is not confirmed and retry is not automatic;
- **complete:** M0 foundation readiness, never Campaign/business success.

## 5. Domain, process, and storage contracts

### Process health contract

Each application exposes or emits a stable identity and health result:

```json
{"service":"api|mission-worker|action-operator|web","status":"ok","mode":"DEMO_SEED","live":false}
```

- `api` uses Fastify and serves `/health` only in M0;
- worker/operator are separate Node processes with HTTP health endpoints for Compose only;
- operator dependencies exclude AgentTeams and model packages;
- none of the processes accepts a platform credential.

### Database contract

- schema history is managed by `node-pg-migrate` and recorded in PostgreSQL;
- initial migration creates only foundation metadata needed to prove the path, not M1 business tables;
- migration failure exits non-zero and prevents dependent application services from becoming healthy;
- normal `docker compose down` preserves named volumes.

### BlobStore contract

```ts
type BlobRef = { algorithm: "sha256"; digest: string; size: number };
interface BlobStore {
  put(input: Uint8Array): Promise<BlobRef>;
  get(ref: BlobRef): Promise<Uint8Array>;
  has(ref: BlobRef): Promise<boolean>;
}
```

- path is derived only from a validated lowercase SHA-256 digest;
- repeated identical input resolves to the same file and does not corrupt content;
- read recomputes/validates digest;
- traversal or malformed digest fails closed;
- atomic temp-write/rename and a dedicated volume preserve recovery semantics.

### i18n and route contract

- locales are the literal codes `zh-CN` and `en`, with `zh-CN` default;
- message keys are inferred from the default catalog and statically augmented for `next-intl`;
- a deterministic parity script rejects missing, extra, or structurally mismatched keys;
- route IDs are stable codes: `campaigns`, `setup`, `mission`, `review`, `learn`;
- localized labels never become stored domain states.

### Evidence contract

Machine reports under `.evidence/sdd-000/` are generated, public-safe, and gitignored except for curated schema/examples. The acceptance report records exact commands, versions, results, and digests; it never promotes generated fixtures to customer or production evidence.

## 6. AgentTeams and Skills

M0 does not execute the Hero Mission. It establishes the replaceable runtime boundary:

- `RuntimeProfile`: runtime version, immutable manager/worker image refs, endpoint mode, network exposure, mounts, capabilities, limits, healthcheck, and secret references;
- `TeamProfile`: six stable role IDs, with the Leader marked `orchestrationOnly` and independent Auditor separate from Producers;
- `RuntimeAdapter`: `probe()`, `validateProfile()`, and `smokeTeamProfile()`; M2 may add create/dispatch/ACK/submit operations without changing M0 isolation fields;
- `RuntimeCapabilityReport`: `SUCCESS | FAILED | UNKNOWN`, exact probe mode, image digests, version/build identity when observable, and explicit limitations.

M0 smoke requirements:

- AgentTeams image references are exactly v1.2.0 plus digest;
- no `/var/run/docker.sock`, `/host-share`, host home, `.env`, or secret file mount;
- no Worker or Controller host port; any optional developer gateway is loopback-only;
- read-only filesystem where the image permits it, dedicated tmpfs/volume where writes are required, dropped capabilities, `no-new-privileges`, memory/PID/CPU limits, private network, and healthcheck;
- a controlled adapter fixture proves successful capability parsing, and negative fixtures prove unreachable dependency, version mismatch, unsafe mount, public HostPort, and missing health/limit rejection;
- the report says `ADAPTER_CONTRACT_SMOKE`, not `LIVE_AGENTTEAM_RUN`.

No new reusable Agent Skill is created in M0. The six role identifiers are topology contracts only; their Skills are M2 deliverables.

## 7. Dependencies and reuse decision

All versions are exact in `package-lock.json` and `docs/dependencies/VERSION-MANIFEST.json`. Planned initial pins:

| Classification | Component | Version / identity | License | Boundary |
|---|---|---|---|---|
| INTEGRATE | Node.js / npm | 24.16.0 / 11.13.0 | MIT / Artistic-2.0 | build/runtime baseline |
| INTEGRATE | TypeScript | 5.9.3 | Apache-2.0 | compile only; common supported range for Next 16 lint and Storybook tooling |
| INTEGRATE | Next.js / React | 16.2.12 / 19.2.8 | MIT | web only |
| INTEGRATE | next-intl | 4.13.4 | MIT | web UI locale only |
| INTEGRATE | Fastify | 5.11.0 | MIT | API health skeleton |
| INTEGRATE | pg / Kysely / node-pg-migrate | 8.22.0 / 0.29.4 / 9.0.0 | MIT | database and migration boundary |
| INTEGRATE | Ajv | 8.20.0 | MIT | runtime evidence/profile schema validation |
| INTEGRATE | Vitest / Storybook | 4.1.10 / 10.5.5 | MIT | test/review tooling |
| INTEGRATE | PostgreSQL image | 17.10, pinned digest | PostgreSQL | local authoritative test DB |
| INTEGRATE | AgentTeams | v1.2.0 manager/worker images, pinned digests | Apache-2.0 | isolated external runtime profile |
| BUILD | BlobStore, parity/status/report/secret scripts | repository source | Apache-2.0 | owned deterministic foundation |
| POC-GATED | Spec Kit CLI | not installed | MIT | methodology only |

The dependency inventory records source, classification, transitive licenses, replacement boundary, and current known limitations. No legacy or competitor source is copied.

## 8. Failure, recovery, and rollback

- wrong Node/npm version: preflight fails with a stable message before install/test claims;
- lockfile drift or undeclared dependency: `npm ci`/lockfile checks fail;
- migration SQL failure or PostgreSQL unavailable: migration exits non-zero; application health is not reported as ready;
- partial blob write: final digest path is absent or valid; temp artifact is recoverable/cleanable;
- corrupt blob: read fails digest verification;
- locale key drift: CI fails and reports exact path/key;
- default/English route build failure: build/route smoke fails;
- AgentTeams endpoint unavailable or version/build identity unknown: report is `FAILED` or `UNKNOWN`, never success by inference;
- unsafe runtime mount/host port/secret: validation fails closed before runtime start;
- Docker restart: database marker and blob digest survive restart/down-up with named volumes;
- Docker cleanup: project-scoped test volumes can be explicitly removed only by the test cleanup command; normal stop preserves them;
- code rollback: revert the local SDD commit; data rollback uses the explicit down migration on test data only. Owner UAT uses no real data or external action.

## 9. Binary acceptance criteria

| ID | Pass condition |
|---|---|
| AC-01 | On Node 24.16.0/npm 11.13.0, `npm ci` from a clean checkout completes without lockfile mutation; a wrong major-version fixture fails preflight. |
| AC-02 | Version manifest, dependency register, transitive license inventory, and CycloneDX SBOM are generated; unapproved or unknown licenses cause a non-zero gate. |
| AC-03 | `docker compose config` contains postgres, one-shot migrate, web, api, mission-worker, and action-operator with pinned base images, health/dependency gates, named volumes, and loopback-only published application ports. |
| AC-04 | A fresh project-scoped database volume runs migration exactly once, records the migration, and all four application services become healthy. |
| AC-05 | A database probe record and a known blob digest survive application/container restart and `docker compose down` followed by `up`; normal teardown does not delete volumes. |
| AC-06 | An intentionally broken migration or unavailable PostgreSQL exits non-zero and dependent application services do not report ready; cleanup restores a fresh successful start. |
| AC-07 | BlobStore tests cover deterministic address, idempotent write/read, malformed/traversal rejection, corruption detection, atomicity, and missing-object behavior. |
| AC-08 | `/` renders Chinese by default, `/en` renders English, locale switch preserves the current route ID, and both outputs visibly show `DEMO_SEED / NOT_LIVE`. |
| AC-09 | All five route IDs build and render; each page states the current goal/status/evidence/one next Owner action; Mission includes four channels without implying connection or publication. |
| AC-10 | Type augmentation and parity checks reject a missing, extra, or structurally mismatched message key; no translated label is used as a route or persisted-state code. |
| AC-11 | Design tokens are consumed by the Web shell; Storybook builds a reviewable shell/state story; Pencil file plus PNG/PDF overview is created through Pencil tooling and documented. |
| AC-12 | AgentTeams v1.2.0 manager/worker image digests are recorded; isolation validation rejects host share, Docker socket, public HostPort, secret mount, absent healthcheck, or absent resource/PID limits. |
| AC-13 | Runtime adapter smoke emits a schema-valid capability report for controlled success and distinguishes version mismatch, unreachable dependency, and unknown build identity without claiming a live Mission. |
| AC-14 | Lint, typecheck, unit, contract, integration, web build, Storybook build, secret/privacy, SBOM/license, bilingual message, bilingual status ID/state, and acceptance-report gates all pass locally and are represented in CI. |
| AC-15 | Secret scan detects seeded API-key/private-key/cookie fixtures while the repository scan passes and includes no `.env`, account data, customer material, or private runtime evidence. |
| AC-16 | Status check proves English/Chinese implementation-register ID/state parity without changing any canonical state; report check rejects missing SDD, criteria, test, UAT, limitation, rollback, or handoff sections. |
| AC-17 | The Chinese acceptance report maps every AC to evidence, includes exact environment/commands/results, all ChatGPT Pro URLs and ZIP hashes/corrections, rollback, non-claims, and independently executable Owner UAT. |
| AC-18 | Owner UAT can traverse the Chinese/English five-screen shell and review Storybook/Pencil/runtime evidence with synthetic data only; no API key, external platform action, or destructive cleanup is required. |

## 10. Test plan

- **unit:** BlobStore, locale catalog traversal, route/state metadata, runtime profile validator, secret/status/report parsers;
- **contract:** process health shape, runtime capability report, TeamProfile role separation, migration manifest;
- **integration:** PostgreSQL fresh migration/failure/restart/persistence; blob volume persistence; Compose health dependency;
- **web:** server-rendered route smoke for both locales, navigation/locale preservation, semantic landmarks, DEMO/NOT_LIVE markers;
- **design:** Storybook static build, Pencil layout snapshot, exported overview review;
- **security/privacy/license:** secret positive/negative fixtures, tracked-file scan, Docker isolation lint, SBOM, license allowlist, dependency manifest diff;
- **recovery:** corrupt/missing blob, database unavailable/broken migration, restart/down-up persistence, unsafe/unreachable AgentTeams profile;
- **full gate:** `npm run verify` plus project-scoped Docker verification script.

Real provider/connector tests, external account tests, and customer UAT are not run.

## 11. Evidence and claims

Required evidence:

- `.evidence/sdd-000/run-manifest.json` and curated command logs/digests referenced by the acceptance report;
- version manifest, dependency register, license inventory, CycloneDX SBOM;
- Compose verification report and migration/blob persistence report;
- i18n parity, status parity, report-structure, and secret-scan reports;
- runtime profile/capability report explicitly labeled controlled/offline/isolated;
- Storybook build and Pencil PNG/PDF exports;
- Chinese `docs/reports/acceptance/SDD-000-ACCEPTANCE.md`.

Valid claim after machine verification: `ENGINEERING_VERIFIED — a pinned M0 delivery foundation can be installed and locally verified under the recorded environment.`

Still `PLANNED`: M1 business state, live AgentTeams Mission, models/providers, ActionGrant/Receipt, connectors, platform publishing, response/learning, production deployment.

Explicitly `NOT_CLAIMED`: production readiness, enterprise security, customer UAT, public platform capability, external action, growth, lead, revenue, compliance, or legal assurance.

## 12. Delivery plan

The critical path is:

```text
M0-03 workspace/locks
→ M0-04 database/blob/compose
→ M0-06 isolated runtime profile
→ M0-07 integrated gates
        ↘ M0-05 web/design can proceed after M0-03
```

The detailed tasks and file paths are in `docs/specs/sdd-000/TASKS.md`. One SDD owns these tightly coupled foundation modules; it does not start M1. Coordinator alone changes canonical progress states.

## 13. Alternatives and decision log

- **Install Spec Kit CLI now:** rejected; method artifacts are sufficient and generated rule surfaces add churn. Reopen only if a pinned CLI dry-run produces a reviewed, non-overwriting diff with clear value.
- **Use pnpm/Turborepo:** rejected; npm workspaces are frozen and adequate for the current scale.
- **Use an in-memory database or SQLite:** rejected; it would not test the frozen PostgreSQL migration/health/persistence contract.
- **Bundle MinIO:** rejected; the product uses a local content-addressed blob volume and does not add a second object-store service.
- **Reuse the running AgentTeams environment:** rejected because it exposes host share/Docker socket/public worker ports and has weaker health/resource defaults.
- **Call a controlled adapter fixture a live Team:** rejected as a claim-discipline violation. Live six-member Mission evidence belongs to M2.
- **Make five polished feature pages:** rejected; M0 provides a coherent product/navigation/state contract while business behavior remains empty/seed-only.

## 14. Owner-participated acceptance

### UAT-01 — Chinese/English product journey

- **Why useful:** only the Owner can confirm that the shell explains business meaning and the one safe next step without relying on engineering logs.
- **Prerequisites:** Docker Desktop, no provider credentials, repository at the delivered commit.
- **Steps:**
  1. Run the documented start command.
  2. Open the loopback Web URL.
  3. Confirm Chinese is the default and `DEMO_SEED / NOT_LIVE` is always visible.
  4. Traverse all five screens and record whether each answers goal, current status, evidence basis, and next action.
  5. Switch to English and confirm the corresponding route remains selected.
  6. Open the documented Storybook and Pencil exports.
- **Expected:** no page implies connected accounts, Agent execution, approval, publication, response, or business result; both locales have the same meaning and complete navigation.
- **Failure signs:** wrong locale, missing route, untranslated/raw key, live-success wording, broken layout/navigation, or missing design evidence.
- **Evidence to return:** screenshots or a written binary decision for UAT-01.
- **Cleanup:** stop the project with the non-destructive command; keep volumes unless intentionally running the project-scoped cleanup step.

### UAT-02 — Foundation evidence review

- **Why useful:** lets the Owner confirm the delivery is independently understandable without exposing secrets or executing an external action.
- **Prerequisites:** generated acceptance report and evidence bundle.
- **Steps:**
  1. Open the acceptance report.
  2. Check the exact version/base/branch/commit and every AC row.
  3. Review the Compose, persistence, AgentTeams isolation/capability, dependency/license, and secret-scan summaries.
  4. Confirm limitations distinguish adapter smoke from live AgentTeams and local verification from production readiness.
- **Expected:** each criterion has a pass/fail result and local evidence path; there are no unstated keys, accounts, production actions, or canonical status edits.
- **Failure signs:** missing command output, ambiguous maturity, unsafe mount/port, secret value, real account data, or unsupported success claim.
- **Evidence to return:** written `PASS` or the criterion IDs that failed.
- **Cleanup:** none; review is read-only.

## 15. Task closeout

- Acceptance report: `docs/reports/acceptance/SDD-000-ACCEPTANCE.md`.
- Proposed module states after machine verification: `M0-03` through `M0-07` → `EVIDENCE_READY`; Coordinator decides canonical transitions and whether M0-06 needs additional live-runtime evidence.
- Goal remains active until implementation, full verification, Chinese acceptance report, local commit, and structured handoff are complete. Owner UAT may remain `PENDING`; in that case the result is `EVIDENCE_READY`, not canonical `ACCEPTED`.
- Next candidate only after Coordinator acceptance: `SDD-001 Campaign Walking Skeleton`, beginning with the exact module selected by the Coordinator.
