# SDD-002 Change Request 3 — Initial demo convergence

> Status: `SPEC_READY`
> Milestone boundary: M1/M2 SHADOW demo convergence for the 2026-08-16 preliminary submission
> Goal: make the already verified M1/M2 public-safe path stable, resettable, repeatable, recordable, and evidence-bound without adding business semantics
> Progress modules: no canonical state transition; M1 remains accepted and M2 remains `EVIDENCE_READY` pending independent Owner UAT
> Acceptance addendum: `docs/reports/acceptance/SDD-002-INITIAL-DEMO-CONVERGENCE-ACCEPTANCE.md`
> Last updated: `2026-08-11`

## 1. Specify — user problem and visible outcome

The preliminary-round presenter currently has individually verified M1/M2 commands and UI paths, but no single bounded operating surface that proves the exact source, checks local prerequisites, resets only its own demo state, seeds the same Hero Campaign, prepares the governed SHADOW fault/revision path, verifies the browser, exports redacted evidence, and leaves clear recording URLs.

After this Change Request, a presenter can:

1. run one documented command that preflights and resets an exact local Compose project, starts the existing product, persists the deterministic synthetic Hero seed, creates one `PUBLIC_SAFE_MOCK` Mission, and runs the existing SHADOW fault Flight;
2. see six roles, eight tasks, four latest PASS revisions, the invalidated Auditor `CLAIM_OVERREACH` failure, the corrected revision, and zero ActionGrant/Connector/external actions in the existing Mission and Review screens;
3. run a separate exact completion command that records four non-executable Owner Reviews and reaches the existing `SHADOW_COMPLETE` state;
4. rerun a real-browser smoke in Chinese, English, desktop, and 390px views without mutating the product path;
5. inspect a public-safe, allowlisted evidence bundle and repeat or reset the demo without manual database edits.

The outcome is implementation/demo convergence only. It does not upgrade M2 maturity, substitute for Owner UAT, or claim a real AgentTeams/DeepSeek run.

## 2. Current verified state

- `createDemoCampaignDocument()` already returns a deterministic, synthetic `DEMO_SEED / NOT_LIVE` Campaign with stable IDs, digest inputs, four ActivationUnits, four editable platform revisions, and `externalActionAllowed=false`.
- The API already persists the Campaign, creates a six-role/eight-task/five-Skill `PUBLIC_SAFE_MOCK` Mission, runs `public-safe-flight`, rejects review of the denied revision, records exact non-executable Owner Reviews, and returns allowlisted Mission evidence.
- `runPublicSafeFlight()` already contains the frozen Beta-to-GA fault, independent Auditor FAIL, corrected X revision, invalidated prior audit, and independent PASS re-audit.
- Existing real-browser verification proves the product UI and state matrix, but it is a broad engineering gate that creates its own state and requires Storybook; it is not a presenter-focused smoke against a prepared Demo.
- Existing Compose verification projects are isolated. No current script owns an explicit preliminary-round Demo project and reset contract.

## 3. Scope

### In scope

- one closed demo configuration with exact project name, loopback Web/API ports, source identity, evidence directory, and allowed lifecycle commands;
- environment preflight for Node/npm, Docker/Compose, product Compose config, required loopback ports, source/worktree visibility, and local Chrome used by browser smoke;
- idempotent reset/stop limited to the exact demo Compose project, its named volumes/orphans, and the exact ignored demo evidence directory;
- deterministic Hero seed verification and persistence through the existing API;
- existing `PUBLIC_SAFE_MOCK` SHADOW Flight orchestration, exact denied-revision review probe, optional four-review completion, restart/reopen verification, and zero-action assertions;
- read-only real-Chrome smoke of `/mission`, `/review`, `/en/mission`, and 390px Mission/Review states, with public-safe screenshots;
- allowlisted/redacted JSON evidence export and a demo run manifest that binds Git Head/dirty state, seed/mission digests, maturity labels, scenario results, no-action counts, and browser results;
- bilingual README quick start, a detailed Chinese runbook/recording storyboard, and a Chinese acceptance addendum;
- unit, integration, browser, build, dependency, and secret checks proportional to the changes.

### Out of scope

- any new domain object, state, migration, API route, OpenAPI surface, runtime role, Skill, Claim/Audit/Review semantic, or visual redesign;
- live DeepSeek, real AgentTeams runtime execution, EvoLink, real account/credential/Secret, networked platform action, or customer/private input;
- ActionGrant, ActionReceipt, Connector, Action Operator execution, due Schedule/Occurrence execution, Scheduler, Handoff, reconciliation, response, or learning;
- M3 interface refactoring, hosted supervision, production authentication, deployment, push, merge, or canonical progress edits;
- upgrading `MOCK_CONFORMANCE` to real-runtime/provider evidence or marking M2 `ACCEPTED`.

### Existing behavior that must not change

- PostgreSQL remains authoritative and the Demo uses the same REST/Web control plane as ordinary local use.
- The public-safe Flight remains `MOCK_CONFORMANCE`, `realAgentTeamsClaim=false`, synthetic, and non-live.
- Leader remains orchestration-only; Producers and Auditor remain separate; the failed revision remains unreviewable; Owner Review remains non-executable.
- Reset never stops, deletes, prunes, or reuses another Compose project, container, image, volume, network, worktree, or evidence directory.
- No Secret, raw prompt/model output, Authorization value, runtime ticket, private evidence, or absolute personal worktree path enters committed fixtures or exported public-safe evidence.

## 4. User journey and states

```text
preflight
→ exact demo reset
→ Compose build/start/wait
→ deterministic Hero seed (persisted once)
→ PUBLIC_SAFE_MOCK Mission
→ existing fault Flight
→ denied-revision review probe returns REVIEW_AUDIT_PASS_REQUIRED
→ redacted evidence export
→ real-browser smoke
→ recording URLs and next command
```

The prepared recording state is the existing `NEEDS_OWNER_REVIEW` state. A separate completion command records exactly four existing non-executable Owner Reviews and verifies `SHADOW_COMPLETE` after restart/reopen.

Failures print stable codes. Digest, topology, audit, reviewability, maturity, no-action, or browser mismatches fail closed. Rerunning preparation resets only the exact demo project and recreates the same seed. Reset is idempotent after interruption.

## 5. Contracts and compatibility

No domain, database, or API contract changes are authorized. New code is a host-side demo/verification layer over current public routes.

- Compose project: `lumiclaw-sdd002-initial-demo`;
- Web: `http://127.0.0.1:3130`;
- API: `http://127.0.0.1:4130`;
- evidence root: `.evidence/sdd-002/initial-demo`;
- provider mode/maturity: `PUBLIC_SAFE_MOCK` / `MOCK_CONFORMANCE`;
- fault: `BETA_TO_GA`;
- expected topology: six roles, eight tasks, five SkillLocks;
- forbidden capability counts: ActionGrant 0, Connector 0, external action 0.

The exported JSON is an allowlist projection, not a raw database/API dump. It contains stable result codes, public synthetic IDs/digests, exact counts, maturity labels, no-action proof, Git identity, command/result summaries, browser dimensions, screenshot paths, and timestamps.

## 6. AgentTeams and governance boundary

The Demo does not invoke or emulate real AgentTeams. It demonstrates the implemented control-plane and public-safe Flight semantics and states `realAgentTeamsClaim=false`. The existing six role identities and eight Task contracts are asserted rather than recreated. The runner may probe the failed revision's unreviewability but may not rewrite it, coerce a PASS, or create authority.

## 7. Dependencies and reuse

- `INTEGRATE`: existing Node/npm, Docker Compose, Fastify API, PostgreSQL, Next.js Web, domain fixture, public-safe Flight, and Mission evidence API.
- `INTEGRATE`: locally installed Google Chrome through the existing DevTools-protocol pattern; no browser dependency is added.
- `BUILD`: small ESM host scripts and tests using Node standard library only.
- No package, lockfile, container image, service, migration, or external network provider is added.

## 8. Failure, rollback, privacy, and safety

- Destructive commands resolve to the exact project/evidence targets. Arbitrary project names, paths, globs, `$HOME`, repository roots, and global Docker prune are impossible inputs.
- The Demo accepts no provider keys, account identifiers, prompts, or customer material.
- Evidence export applies explicit field projection and forbidden-marker scanning; scan failure prevents PASS.
- Unexpected review success, nonzero action count, missing Auditor issue, or wrong maturity is a hard failure.
- Rollback is an ordinary `git revert`; runtime rollback is exact demo reset. There is no external compensation.

## 9. Binary acceptance criteria

1. `npm run demo:preflight` passes on the pinned toolchain and emits a public-safe result; missing dependency, unavailable Docker, invalid Compose, occupied port, or missing Chrome fails with a stable code.
2. `npm run demo:reset` is idempotent and removes only the exact demo project and evidence root; a sentinel Compose resource remains unchanged in a negative test.
3. `npm run demo` starts the exact project, persists the deterministic Hero seed, verifies two template reads have identical IDs/digest, and leaves one reviewable Mock Mission.
4. The prepared Mission has exactly six roles, eight tasks, five SkillLocks, five revisions, five audits, one invalidated `CLAIM_OVERREACH` FAIL assigned to the Founder Producer, four latest active PASS revisions, and no reviews.
5. Review of the denied revision returns exact `422 / REVIEW_AUDIT_PASS_REQUIRED`.
6. `npm run demo:complete` records exactly four PASS revisions, reaches `SHADOW_COMPLETE`, survives API/PostgreSQL restart/reopen, and keeps all action counts zero.
7. `npm run demo:smoke` uses real Chrome for zh-CN/en and desktop/390px Mission/Review, sees topology, failure/invalidation/diff, four reviewable or reviewed revisions, no-action proof, no overflow, and zero console errors.
8. Evidence is allowlisted, scans clean, labels seed/mock/no-action/real-AgentTeams-nonclaim correctly, contains no Secret/prompt/header/ticket/private path, and binds Git Head plus dirty truth without maturity upgrade.
9. README/runbook provide prerequisites, preparation/recording/completion/reset commands, expected results, failure signs, evidence, and cleanup without manual database editing.
10. Targeted tests, `npm run verify`, `npm audit --audit-level=high`, dependencies/SBOM, and secret scans pass. Canonical status, migrations, API/OpenAPI, M3 interfaces, and visual semantics have no diff.
11. The Chinese acceptance addendum and structured handoff are complete; M2 remains `EVIDENCE_READY` pending independent Owner UAT and Coordinator acceptance.

## 10. Test plan

- unit: config/target validation, version parsing, ports, evidence allowlist/forbidden markers;
- integration: reset isolation, seed determinism, fault Flight, denied review, four-review completion, restart/reopen, no-action;
- browser: real Chrome desktop/390px, zh-CN/en, Mission/Review, screenshots, console/overflow;
- regression: existing campaign API/Shadow paths, lint/typecheck/build/Storybook;
- safety: tracked-source and export scans, dependency/license/SBOM, `npm audit`;
- documentation: report checks and no-diff checks for protected sources.

## 11. Evidence and claim discipline

Valid claim after verification:

> `ENGINEERING_VERIFIED — the existing synthetic M1/M2 public-safe SHADOW path can be reset, prepared, browser-smoked, completed, and exported repeatably through one bounded local Demo runbook, including an Auditor fail-closed proof and zero external actions.`

The run remains `DEMO_SEED`, `PUBLIC_SAFE_MOCK`, `MOCK_CONFORMANCE`, and `realAgentTeamsClaim=false`. It is not real AgentTeams/provider evidence and not Owner/customer/business acceptance.

## 12. Delivery tasks and critical path

```text
closed demo contract + unit tests
→ preflight/reset/start/seed/fault orchestration
→ completion/reopen/no-action verification
→ read-only Chrome smoke + redacted export
→ README/runbook + acceptance addendum
→ full gates + clean local commit + structured handoff
```

No progress-register module is started or transitioned by the Executor.

## 13. Alternatives rejected

- demo-only API or database seed route: creates a second mutation path;
- direct SQL seeding: bypasses API validation;
- real DeepSeek/AgentTeams recording default: adds risk and maturity confusion;
- Storybook-only recording: does not prove persisted product state;
- global Docker cleanup or user-selected targets: unsafe;
- automatic Owner Review during preparation: hides the most legible recording gate.

## 14. Owner verification protocol

Prerequisites: Docker Desktop; Node `24.16.0`; npm `11.13.0`; Google Chrome; required loopback ports free; synthetic data only.

1. Run `npm ci`, then `npm run demo`.
2. Confirm PASS, exact URLs, `MOCK_CONFORMANCE`, `realAgentTeamsClaim=false`, and zero action counts.
3. Open Chinese Mission and confirm six roles, eight tasks, `NOT_LIVE`, and no publishing capability.
4. Open Review and confirm X v1 `CLAIM_OVERREACH`, Evidence, next role, invalidated audit, v1→v2 diff, and four PASS revisions.
5. Run `npm run demo:complete`; refresh and confirm four non-executable decisions plus `SHADOW_COMPLETE`, still with zero actions.
6. Check English and 390px paths; inspect evidence hashes/screenshots/console summary; return `DEMO UAT PASS` or failed criterion IDs.
7. Run `npm run demo:reset`; confirm Demo URLs stop and unrelated Compose projects are unchanged.

Failure signs include wrong topology, missing Auditor evidence/next role, denied review success, any action capability, Mock represented as real runtime/provider, forbidden material, lost refresh state, browser overflow/error, or cross-project reset.

## 15. Analyze — consistency decision

Specify, Clarifications, Plan, Checklist, Tasks, existing SDD-002 contracts, and implementation agree on one host-side convergence layer. Every criterion is observable through existing API/UI or bounded tooling. No migration, API, domain, provider, runtime, M3, visual, credential, external-action, or canonical-progress change is required. Prepared and completed states are existing states; fault denial uses an exact rejected review, not a fake connector. Reset is exact and recoverable; maturity remains truthful. No unresolved clarification blocks implementation, so this Change Request is `SPEC_READY`.
