# SDD-001 implementation plan

## Architecture

- Add repository-owned `@lumiclaw/domain` for schemas, validation, canonical digest, IDs, fixtures, platform constraints, and time contracts.
- Extend `@lumiclaw/db` with the M1 migration, typed Kysely database, and transaction-backed Campaign repository.
- Extend Fastify with `/api/v1` Campaign resources and a static schema-derived OpenAPI document. The server owns validation, idempotency, ETag, and tenant checks.
- Add a repository-owned `@lumiclaw/mission-compiler` which converts one persisted aggregate into a non-live AgentTeams adapter input.
- Keep Next as UI only. A thin same-origin route proxy forwards requests to Fastify; client state always reloads authoritative responses.
- Extend the five-screen shell with one M1 Campaign workspace, shared state vocabulary, four distinct preview adapters, and schedule editor.
- Keep mission-worker/action-operator health-only; M1 creates no due-run loop or external action.

## Data design

- M1 table names are explicit and organization-scoped. Composite FKs prevent cross-organization graph edges.
- Campaign head is mutable only for current version/digest pointers. `campaign_snapshots`, `artifact_revisions`, and schedule versions preserve history.
- Idempotency is transactionally stored with the mutation result.
- Schedule save resolves the wall time before commit and creates only preview occurrences in `NEEDS_REVIEW`.
- No secret/ref/token/private payload column is introduced.

## API and error design

- Required tenant header is validated before store access.
- JSON Schema validation and business validation return stable codes with safe field paths.
- POST/PUT require idempotency; PUT requires exact strong ETag.
- Cross-tenant lookup returns not-found to avoid resource disclosure.
- PostgreSQL unavailable is `503 CONTROL_PLANE_UNAVAILABLE`, not an empty/success response.

## UI and responsive design

- Client begins in loading, then renders empty, saved, blocked/needs-owner, conflict, or recovery from the API result.
- Creation uses synthetic defaults with editable organization/brand/product/objective/CTA labels; no actual account identifiers are requested.
- Setup shows graph/Claim gaps; Mission shows rail/editor/preview; Review says M2 governance is not implemented; Learn says no response exists.
- The navigation rail wraps into a width-contained horizontal list. Every grid uses `minmax(0,1fr)`, controls use `min-width:0`, and long digests/codes wrap.
- Storybook covers state matrix and each platform. Browser evidence covers desktop and 390px.

## Verification checkpoints

1. M1-01 graph schema/fixtures/migration tests.
2. M1-02 Campaign/Claim/artifact/canonical/compiler contract tests.
3. M1-03 PostgreSQL/API/OpenAPI/idempotency/ETag/tenant integration.
4. M1-04 five-screen state/i18n/responsive Web build and component tests.
5. M1-05 four editable preview/constraint/reopen/Storybook evidence.
6. M1-06 schedule/RRULE/IANA/DST/misfire/invalidation persistence tests.
7. M2 spec-ready analysis, Pro review/corrections, full gates, Compose/browser persistence, evidence package/report/handoff.

## Rollback

- Revert logical M1 commits with `git revert`, preserving history.
- Run M1 down migration only on the exact local test project if data rollback is explicitly needed.
- Ordinary `docker compose down` keeps data for reopen evidence.
- Verification cleanup uses one exact project name and never prune/global deletion.

