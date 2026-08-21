# SDD-006 implementation plan

## Gap map

| Surface | Baseline | SDD-006 convergence |
|---|---|---|
| Local identity | No first-open identity | Persisted singleton local profile with display name only |
| Onboarding | Campaign fixture is developer-led | Two owner-visible paths: labeled public-safe example or real local MD/TXT |
| Materials | Blob primitive exists, no product flow | Digest-verified upload, manifest, extraction, reopen/restart, delete and safe failures |
| Context | Campaign domain separates concepts, UI is setup-oriented | Four explicit selectors backed by stable Market/Locale/Platform/Time Zone codes |
| Workspace | Five-screen engineering skeleton | Owner-frozen desktop SaaS shell and global production routes |
| Review | M2 artifact review exists but is visually narrow | Full content before decision, compact active Agent, expandable trace |
| Publish | External action deliberately absent | Manual assistant with copy/download/official-page handoff and reconciliation-only state |
| Team/Skills | Runtime roles exist, no global operations UI | Six-role roster with metric provenance and inspectable repository-owned Skill content |
| Environment/accounts | Health endpoints only | Safe readiness contract and honest disabled connector/OAuth/read-back surfaces |
| Accessibility/evidence | Storybook baseline | Dialog focus semantics, keyboard/axe, desktop gate, browser screenshots and bilingual parity |

## Route map

`/{locale}` is Today. Global routes are `/campaigns`, `/ai-team`, `/calendar`, `/publish`, `/feedback`, `/knowledge`, `/accounts`, and `/settings`. Existing `/setup`, `/mission`, `/review`, and `/learn` remain compatible entry points and consume the same Fastify/PostgreSQL control plane. No route owns hidden business success state.

## State map

`NO_PROFILE -> MATERIAL_CHOICE -> CONTEXT_READY -> COMPLETED` is persisted server-side. The example path creates/reopens the public-safe Organization/Campaign source; the upload path requires at least one `READY` MD/TXT material before completion. Materials transition `RECEIVED -> READY | REJECTED | UNSUPPORTED | FAILED`. Manual publication transitions only `READY_FOR_HANDOFF -> AWAITING_RECONCILIATION`; `PUBLISHED` is intentionally absent. Readiness uses `AVAILABLE | UNAVAILABLE | NOT_CONFIGURED | UNKNOWN`, each with source and remediation.

## Component boundaries

- `styles/`: Tailwind entry, design tokens, base/layout rules.
- `components/ui/`: reviewed Button, Badge, Dialog/Drawer primitives.
- `components/layout/`: desktop gate, sidebar, context header.
- `components/onboarding/`: profile, path, material, and context steps.
- `components/features/`: Today, Campaign, Review, Publish, AI Team, Skills, Calendar, Knowledge, Accounts, Settings.
- `lib/`: stable route/state/API/view-model boundaries and bilingual typed copy.

## Verification and rollback

Domain/API negative tests precede UI integration. PostgreSQL/Compose restart proves persistence; browser tests prove first open, example/upload paths, review, publishing state, keyboard/focus, desktop gate, and screenshots. Static, build, Storybook, axe, i18n, secret, dependency/license/SBOM, audit, and full verify close the slice. Rollback is `git revert` of the SDD-006 commit plus the exact local migration down only when explicitly required; blob cleanup is project-scoped and never global.
