# SDD-000 Implementation plan

## Architecture

- A single npm workspace owns four apps and foundation packages.
- All Node production code is TypeScript/ESM compiled to `dist`; Next.js owns only UI rendering.
- PostgreSQL is the only database. Migration is an explicit one-shot Compose dependency.
- Blob bytes live in a dedicated content-addressed local volume behind a small port.
- Web uses stable route/state metadata and typed catalogs; API/worker/operator expose only M0 health identities.
- AgentTeams remains an external/profile runtime. M0 owns a fail-closed profile validator and capability report, not AgentTeams orchestration internals.
- CI runs the same repository scripts as local verification and never uses a real provider key.

## Data and security boundaries

- Container ports: Web/API loopback only; worker/operator health remains inside Compose networks; AgentTeams worker/controller ports are not published.
- Networks: public-edge for Web/API ingress as needed, private data/runtime networks for PostgreSQL/blob/AgentTeams.
- Secrets: no real secret is defined; `.env*` is ignored except a documented placeholder-free example if needed.
- Evidence: generated raw logs are gitignored; curated reports are allowlisted and scanned.
- Runtime: `no-new-privileges`, dropped capabilities, explicit healthchecks and CPU/memory/PID limits; no Docker socket/host-share/host-home mount.

## Migration and rollback

- Initial up migration creates a foundation metadata table and migration record; down removes only those test objects.
- Integration tests use a unique Compose project name and project-scoped volumes.
- Normal stop preserves volumes. Test cleanup names its exact project and never targets a broad Docker scope.
- Code rollback is a Git revert of the local delivery commit; no public Push/PR/Deploy occurs.

## Verification checkpoints

1. workspace preflight/install/license gate;
2. app/package unit and type gates;
3. Web build/Storybook/i18n route review;
4. Compose fresh migration, failure, restart, database/blob persistence;
5. AgentTeams isolation/profile/adapter report;
6. full CI-equivalent gate and Chinese acceptance report.
