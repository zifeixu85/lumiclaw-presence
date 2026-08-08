# SDD-000 tasks

## T01 — Workspace and exact dependency identity (`M0-03`)

- Add root workspace, Node/npm pins, TypeScript/ESM configs, ignore rules, and four app/package manifests.
- Add version/dependency manifests and license/SBOM scripts.
- Tests first: environment preflight and manifest/schema validation.
- Checkpoint: clean `npm ci`, lint/typecheck/unit, no lockfile drift.

## T02 — Blob and migration contracts (`M0-04`)

- Add content-addressed BlobStore package and negative tests.
- Add PostgreSQL package, explicit initial migration, migration register, and database smoke.
- Tests first: digest/traversal/corruption; migration success/failure.
- Checkpoint: local package/integration tests pass.

## T03 — Four process skeleton and Compose (`M0-04`)

- Add Fastify API health and separate mission-worker/action-operator health processes.
- Add multi-stage Node image, pinned PostgreSQL, one-shot migrate, named volumes, private networks, healthchecks, limits, and non-root runtime.
- Add fresh-volume, failure, restart, and persistence verification scripts using a unique project name.
- Checkpoint: exact Compose report is generated and cleanup is project-scoped.

## T04 — Chinese-default product shell and design baseline (`M0-05`)

- Add Next.js/React/next-intl app, typed catalogs, locale routing, stable route metadata, five screens, design tokens, four-channel Composer baseline, and required state copy.
- Add message-parity/route tests and Storybook shell/state stories.
- Use Pencil tooling to create the encrypted review file and export PNG/PDF; document review path.
- Checkpoint: both locales, all routes, Next build, Storybook build, and Pencil layout review pass.

## T05 — AgentTeams isolated profile and adapter smoke (`M0-06`)

- Add pinned image manifest, RuntimeProfile/TeamProfile/capability schemas, validator, adapter, controlled fixtures, and profile Compose file.
- Add negative tests for socket/share/host port/secret/limit/health/version/dependency failures.
- Run isolated image/version/capability probes available without credentials; label unavailable build identity as `UNKNOWN`.
- Checkpoint: generated report states exactly what was and was not executed.

## T06 — Integrated quality gates (`M0-07`)

- Add lint/typecheck/unit/contract/integration/build/Storybook, secret, SBOM/license, message, bilingual status, report-structure, and Compose policy checks.
- Add GitHub Actions workflow using Node 24 and PostgreSQL service or project Compose path without credentials.
- Seed negative fixtures outside tracked secret-like values or generate them at test runtime.
- Checkpoint: `npm run verify` and Docker verification pass from a clean install.

## T07 — Converge, evidence, and closeout

- Ask separate ChatGPT Pro conversations to review delivery/Compose and Web/runtime/CI surfaces from a scanned ZIP; save URLs, hashes, findings, and correction rounds.
- Independently review/apply only justified changes, rerun the complete matrix, and inspect the final diff.
- Generate `docs/reports/acceptance/SDD-000-ACCEPTANCE.md`, Owner steps, evidence manifest, changed-file list, commit, and structured handoff.
- Checkpoint: every AC has exact evidence; no Push/PR/Deploy or canonical status edit; only then mark the Goal complete.
