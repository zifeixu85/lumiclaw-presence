# SDD-000 requirements checklist

## Requirements quality

- [x] User and visible outcome are stated.
- [x] Scope and out-of-scope are explicit.
- [x] Every acceptance criterion is binary.
- [x] Normal, business/contract failure, permission/security failure, dependency failure, recovery/rollback, visible review, and machine evidence are covered.
- [x] M0 and M1 boundaries are unambiguous.

## Architecture and security

- [x] Four application process boundaries remain distinct.
- [x] PostgreSQL and blob persistence contracts are testable.
- [x] Migration failure blocks readiness.
- [x] AgentTeams host share, Docker socket, public HostPort, real secret, and missing limits/health are explicitly rejected.
- [x] Adapter smoke is not mislabeled as a live AgentTeam run.
- [x] No real credential, account, customer, provider, connector, or public action is needed.

## Product and i18n

- [x] `zh-CN` default and `en` shareable routes are specified.
- [x] Message parity and typing have positive and negative tests.
- [x] Five route IDs and required visible states are defined.
- [x] `DEMO_SEED / NOT_LIVE` prevents demo/live confusion.
- [x] Storybook and Pencil evidence are specified.

## Dependency, license, and evidence

- [x] Direct dependencies and images have intended exact versions/digests and license classes.
- [x] Transitive inventory/SBOM and unknown-license failure are specified.
- [x] Spec Kit CLI non-install decision is recorded.
- [x] Exact commands/environment/results and generated evidence location are required.
- [x] Chinese acceptance report, Owner UAT, rollback, non-claims, and structured handoff are required.
- [x] Canonical status files are read-only to the Executor.

## Readiness decision

No unresolved `[NEEDS CLARIFICATION]` marker remains. The SDD is complete enough to implement without requesting new product direction, credentials, or external-action authority.
