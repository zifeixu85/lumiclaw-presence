# SDD-001 tasks

## T01 — Graph contracts and migration (`M1-01`)

- Add `@lumiclaw/domain` graph schemas/types, UUIDv7, validator result codes, positive fixture, and cross-tenant/edge negative fixtures.
- Add M1 migration graph tables and composite organization FKs.
- Tests first: valid graph, missing edge, wrong tenant, wrong Identity/Product/Market/Account/Mandate tuple.
- Checkpoint: domain tests and migration-policy checks pass before Campaign contracts start.

## T02 — Campaign, Claim, artifact, digest, and compiler contracts (`M1-02`)

- Add CampaignBrief, GoalProfile, Claim/Evidence, ActivationPlan/Unit, MissionContract, ArtifactRevision, CapabilitySnapshot, platform artifact, and aggregate schemas.
- Add canonical serialization/digest and Claim/artifact constraint validation.
- Validate server-issued authority on create, every governed Claim even when unreferenced, and Organization/Brand as ArtifactRevision context.
- Add four-platform synthetic fixture and invalid scope/expiry/revocation/Product/Market/tamper cases.
- Add `@lumiclaw/mission-compiler` non-live six-role adapter-input smoke.
- Checkpoint: same content/key permutation has same digest; every governed mutation changes it; compiler imports exact source digest.

## T03 — PostgreSQL repository and REST/OpenAPI (`M1-03`)

- Add snapshot/artifact/capability/idempotency tables and typed repository.
- Add create/list/get/update/mission-contract routes, organization scope, idempotency, strong ETag, version conflict, safe errors, and OpenAPI 3.1.
- Serialize campaign-scoped child ID ownership and reject same-tenant cross-Campaign/cross-type reuse before writes.
- Unit contract tests use an explicit repository double; PostgreSQL integration uses the real migration/repository.
- Checkpoint: create/save/reopen/restart, replay/conflict/cross-tenant/rollback tests pass.

## T04 — Shared five-screen journey and responsive shell (`M1-04`)

- Add same-origin Fastify proxy and client Campaign state controller.
- Add creation/reopen selector, readiness graph/gaps, route-specific M1 panels, stable localized states, conflict/recovery actions.
- Add safe 412 base/local/server rebase, editable 422 validation state, and unknown-result idempotency replay behavior.
- Fix shared shell/nav/grid/document overflow for 390px and keep desktop behavior.
- Add bilingual message parity, reducer/view-model tests, and state Storybook stories.
- Checkpoint: local browser real API flow passes in zh-CN/en, desktop/390px, without console error.

## T05 — Four editable composers and previews (`M1-05`)

- Add platform adapters for X, Bluesky, LinkedIn, and Xiaohongshu using one versioned constraint registry.
- Add field editing, server validation, violation display, account/identity/mode/snapshot/disclaimer, and save/reopen behavior.
- Add Storybook platform/state stories and visual screenshot evidence.
- Checkpoint: one edit per platform changes the right render model/digest and persists after reopen.

## T06 — Persistent schedule model/editor (`M1-06`)

- Add bounded RRULE parser/canonicalizer, IANA resolver, gap/fold candidates, misfire, schedule/version/occurrence schemas and tables.
- Add schedule form and local/zone/UTC preview; require explicit fold choice.
- Treat preview rows as proposals: reject forged occurrence data and content-plus-schedule PUT, then server-rederive every persisted Schedule/Occurrence derived field.
- Repository update retains replaced schedule history, invalidates superseded future previews, and leaves future occurrences `PENDING` without execution authority.
- Tests first: normal zone, invalid zone/rule, New York gap/fold, earlier/later, misfire, uniqueness, edit invalidation, no execution/grant.
- Checkpoint: API/UI/DB schedule tests pass and no mission-worker scheduler exists.

## T07 — M2 SDD `SPEC_READY`

- Author `SDD-002-GOVERNED-SHADOW-CAMPAIGN.md` and lifecycle artifacts.
- Scope only M2-01 through M2-06: live six-member SHADOW, DeepSeek gateway, artifacts/audit/owner review, media boundary, trace/fault denial.
- Analyze dependency on accepted M1 and retain no external action/Grant/Connector.
- Checkpoint: no clarification marker or M2 implementation claim remains.

## T08 — External review, convergence, and acceptance

- Build scanned public-safe source ZIP in `.evidence/sdd-001/source-packages/`; record Base/files/bytes/SHA-256 and exclusions.
- Give ChatGPT Pro the exact bounded review task; save URL, findings, wrong claims, correction rounds, and independently accepted changes.
- Run clean install, full static/build/Storybook, real PostgreSQL/API/Compose, compiler, browser/visual/390px, persistence/recovery, secret/license/SBOM, report/status/message gates.
- Create `docs/reports/acceptance/SDD-001-ACCEPTANCE.md`, Owner UAT, run manifest, commits, and structured handoff.
- Checkpoint: every AC has evidence, progress registers have no diff, no Push/PR/Deploy/action occurred; only then complete the Goal.

## Execution outcome

- T01–T06: completed in dependency order with domain, migration, API, Web, platform, and schedule tests.
- T07: completed as specification only; SDD-002 is `SPEC_READY` with no implementation.
- T08: Executor convergence complete; machine/browser/external-review evidence and Chinese acceptance report are ready.
- Acceptance authority remains external to this task: proposed state is `EVIDENCE_READY`, with Owner UAT and Coordinator review pending.
