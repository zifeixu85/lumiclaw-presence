# SDD-000 Dependency Register

> Scope: local and CI delivery foundation only. This register is not a production security or legal-compliance claim.

## Runtime and application dependencies

| Component | Identity | License | Classification | Boundary / replacement | Decision |
|---|---|---|---|---|---|
| Node.js / npm | `24.16.0` / `11.13.0` | MIT / Artistic-2.0 | INTEGRATE | application runtime and package manager | Exact engine and package-manager checks fail closed. |
| TypeScript / ESLint | `5.9.3` / `9.39.5` | Apache-2.0 / MIT | INTEGRATE | build-time only | Pinned to the common supported range of the Next 16 lint and Storybook toolchains; no peer override is accepted. |
| Next.js / React | `16.2.12` / `19.2.8` | MIT | INTEGRATE | `apps/web` only | M0 shell only; no production exposure claim. |
| next-intl | `4.13.4` | MIT | INTEGRATE | UI locale routing/messages only | Domain codes, content language, market and time zone remain separate. |
| Fastify | `5.11.0` | MIT | INTEGRATE | API health skeleton | Replaceable HTTP boundary; no M1 API. |
| pg / Kysely / node-pg-migrate | `8.22.0` / `0.29.4` / `9.0.0` | MIT | INTEGRATE | PostgreSQL access and migration | Only the project-scoped local test database is targeted. |
| Ajv | `8.20.0` | MIT | INTEGRATE | AgentTeams profile/capability schema validation | No runtime orchestration behavior is copied. |
| Vitest / Storybook | `4.1.10` / `10.5.5` | MIT | INTEGRATE | test and review tooling | Development-only; Storybook is not a production application route. |
| CycloneDX npm | `6.0.0` | Apache-2.0 | INTEGRATE | CI SBOM generator | Generated SBOM is evidence, not a vulnerability-free claim. |

## Container and external-runtime dependencies

| Component | Immutable identity | License | Classification | Boundary / obligations |
|---|---|---|---|---|
| Node base image | `node:24.16.0-bookworm-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203` | upstream image notices | INTEGRATE | Build/runtime base; retain image and included-package notices. |
| PostgreSQL | `postgres:17-alpine@sha256:dc17045ccfd343b49600570ea734b9c4991cf1c3f3302e67df51e3b402dd55c4` | PostgreSQL plus image notices | INTEGRATE | Internal named-volume service with no host port. |
| AgentTeams manager/worker | `v1.2.0` plus digests in `infra/agentteams/image-manifest.json` | Apache-2.0 | INTEGRATE | Isolated profile and CLI/adapter contract smoke only; no host share, Docker socket, public port or real secret. |
| Sharp/libvips | Sharp `0.34.5`; platform libvips `1.2.4` | Apache-2.0 and LGPL-3.0-or-later | LATER-REPLACE | Optional Next image path. Preserve LGPL notices/source-relocation rights when distributing images. M0 provides no uploads or image optimizer workflow. Re-review before a release image. |
| axe-core / lightningcss | `4.12.1` / `1.33.0` | MPL-2.0 | INTEGRATE | Storybook accessibility review and transitive CSS build tooling. Preserve MPL notices and corresponding-source rights for modified covered files; M0 does not modify or copy upstream source. |

## Security and maintenance observations

- `npm audit` on 2026-08-03 reports three high findings through Next 16.2.12: bundled `postcss@8.4.31` and optional `sharp@0.34.5`. npm offers no safe same-major automated fix and incorrectly proposes a downgrade to Next 9.3.3.
- M0 accepts these only as a local, visibly non-live engineering baseline: no customer input, uploaded CSS/image, production deployment or external account is allowed. A production release remains blocked until an upstream Next 16 fix or a separately reviewed patch is available.
- No npm override or forced install is counted as remediation: Next 16.2.12 loads its own pinned copies, so the audit finding remains explicitly open instead of being hidden by dependency-tree coercion.
- Install output also reports deprecated transitive tooling (`prebuild-install`, `glob@10`, `tsconfck`). These are transitive and require upstream replacement review; none is represented as actively maintained by LumiClaw.

## Generated evidence

- Exact direct versions and container identities: `docs/dependencies/VERSION-MANIFEST.json`
- Committed license summary: `docs/dependencies/LICENSE-INVENTORY.json`
- Full transitive inventory: `.evidence/sdd-000/license-inventory.json`
- CycloneDX SBOM: `.evidence/sdd-000/sbom.cdx.json`
- Exact dependency graph: `package-lock.json`
