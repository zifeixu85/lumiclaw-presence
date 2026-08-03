# SDD-002 Dependency Register

> Scope: the governed SHADOW Campaign vertical slice plus the retained M1/M0 foundation. This register is not a production security, legal-compliance, real-model, or external-action claim.

## Runtime and application dependencies

| Component | Identity | License | Classification | Boundary / replacement | Decision |
|---|---|---|---|---|---|
| Node.js / npm | `24.16.0` / `11.13.0` | MIT / Artistic-2.0 | INTEGRATE | application runtime and package manager | Exact engine and package-manager checks fail closed. |
| TypeScript / ESLint | `5.9.3` / `9.39.5` | Apache-2.0 / MIT | INTEGRATE | build-time only | Pinned to the common supported range of the Next 16 lint and Storybook toolchains; no peer override is accepted. |
| Next.js / React | `16.3.0` / `19.2.8` | MIT | INTEGRATE | `apps/web` only | M1 persistent workspace plus M2 Mission/Review state matrix; no production exposure claim. Next was advanced from `16.2.12` after its transitive high findings, then rebuilt and browser/Compose verified. |
| next-intl | `4.13.4` | MIT | INTEGRATE | UI locale routing/messages only | Domain codes, content language, market and time zone remain separate. |
| Fastify | `5.11.0` | MIT | INTEGRATE | Campaign and governed-SHADOW REST/OpenAPI control boundary | Replaceable HTTP boundary; no external platform endpoint or hidden success path. |
| pg / Kysely / node-pg-migrate | `8.22.0` / `0.29.4` / `9.0.0` | MIT | INTEGRATE | Shared PostgreSQL Campaign, Mission, immutable revision, audit, trace, provider-receipt and idempotency state | Only project-scoped local test databases are targeted. |
| Ajv | `8.20.0` | MIT | INTEGRATE | Domain, Campaign and AgentTeams envelope validation | Task payload schemas and digests are additionally checked by the governed-shadow package; no AgentTeams internals are copied. |
| Vitest / Storybook | `4.1.10` / `10.5.5` | MIT | INTEGRATE | test and review tooling | Development-only; Storybook is not a production application route. |
| CycloneDX npm | `6.0.0` | Apache-2.0 | INTEGRATE | CI SBOM generator | Generated SBOM is evidence, not a vulnerability-free claim. |

## Container and external-runtime dependencies

| Component | Immutable identity | License | Classification | Boundary / obligations |
|---|---|---|---|---|
| Node base image | `node:24.16.0-bookworm-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203` | upstream image notices | INTEGRATE | Build/runtime base; retain image and included-package notices. |
| PostgreSQL | `postgres:17-alpine@sha256:dc17045ccfd343b49600570ea734b9c4991cf1c3f3302e67df51e3b402dd55c4` | PostgreSQL plus image notices | INTEGRATE | Internal named-volume service with no host port. |
| AgentTeams embedded/controller, CoPaw manager/worker | official `v1.2.0` tag commit plus three immutable arm64 digests in `infra/agentteams/image-manifest.json` | Apache-2.0 | INTEGRATE | Real isolated six-member runtime acceptance uses a dedicated ignored workspace/volume and an explicitly labeled local mock model. LumiClaw does not modify Manager/Worker/Matrix internals. No real-model claim follows from this runtime test. |
| DeepSeek official API | base `https://api.deepseek.com`; models and sources in `infra/providers/provider-manifest.json` | external service terms | EXTERNAL_GATEWAY | Secret-bearing calls stay behind `DeepSeekModelProvider`; structured output, fixed model, retry/429/5xx, cost/latency/error receipts and redaction are contract-tested. Real Canary is `NOT_RUN_NO_KEY` and is not required for local acceptance. |
| Public-safe Model/Media providers | repository-owned deterministic implementations | Apache-2.0 project source | LOCAL_CONFORMANCE | Fully runnable without keys, always labeled `MOCK_CONFORMANCE`; cannot be reported as DeepSeek, EvoLink, or real AgentTeams model output. |
| EvoLink media candidate | no package or endpoint selected | N/A | POC-GATED | Optional Canary only. Missing key does not block local acceptance; every asset remains content-addressed, rights/cost receipted, and `UNREVIEWED`. |
| Sharp/libvips | Sharp `0.35.3`; platform libvips packages recorded in the transitive inventory | Apache-2.0 and LGPL-3.0-or-later | LATER-REPLACE | Optional Next image path. Preserve LGPL notices/source-relocation rights when distributing images. M2 provides no untrusted upload or production image-optimizer workflow. Re-review before a release image. |
| axe-core / lightningcss | `4.12.1` / `1.33.0` | MPL-2.0 | INTEGRATE | Storybook accessibility review and transitive CSS build tooling. Preserve MPL notices and corresponding-source rights for modified covered files; M0 does not modify or copy upstream source. |

## Security and maintenance observations

- The inherited three high findings observed on 2026-08-03 through Next `16.2.12` (`postcss@8.4.31`, optional `sharp@0.34.5`) were not hidden with an override or forced install. The direct Next pin was upgraded to `16.3.0`, which resolves to `postcss@8.5.23` and `sharp@0.35.3`.
- `npm audit --audit-level=high --json` on 2026-08-04 reports `0` info/low/moderate/high/critical findings. This is a point-in-time dependency observation, not a production security certification; `.evidence/sdd-002/npm-audit.json` records the exact result.
- M2 remains local and visibly non-live: no customer input, untrusted uploaded CSS/image, production deployment or external account is allowed. A production release still requires fresh audit, image/package provenance review and the later security gates.
- Install output also reports deprecated transitive tooling (`prebuild-install`, `glob@10`, `tsconfck`). These are transitive and require upstream replacement review; none is represented as actively maintained by LumiClaw.

## Generated evidence

- Exact direct versions and container identities: `docs/dependencies/VERSION-MANIFEST.json`
- Committed license summary: `docs/dependencies/LICENSE-INVENTORY.json`
- Full transitive inventory: `.evidence/sdd-002/license-inventory.json`
- CycloneDX SBOM: `.evidence/sdd-002/sbom.cdx.json`
- AgentTeams real-runtime evidence: `.evidence/sdd-002/agentteams-real-runtime.json`
- Provider conformance evidence: `.evidence/sdd-002/provider-conformance.json`
- Exact dependency graph: `package-lock.json`

## Provenance decisions

- SDD-002 application, provider-mock, verifier, Skill and UI source is original LumiClaw work under this repository's Apache-2.0 license.
- AgentTeams is consumed only as the official tagged source for inspection and immutable official runtime images. No upstream Manager, Worker, Matrix or installer source is copied into the application packages or modified.
- No Postiz/AGPL source or dependency is used. No file from `/Users/ameng/Workspace/lumiclaw-solution-compiler` was migrated for SDD-002.
