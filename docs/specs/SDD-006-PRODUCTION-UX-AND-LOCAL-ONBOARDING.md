# SDD-006 — Production UX 1.4 and local onboarding

> Status: `SPEC_READY`
> Milestone: `M5`
> Progress module IDs: `M5-00`
> Owner: Product/design Owner
> Goal objective / task reference: implement the Owner-frozen desktop UX as a real local-first product journey without claiming unfinished runtime or platform actions
> Target evidence maturity: `ENGINEERING_VERIFIED`
> Acceptance report: `docs/reports/acceptance/SDD-006-ACCEPTANCE.md`
> Last updated: `2026-08-16`

## 1. User problem and outcome

A non-technical local owner can install LumiClaw Presence, open the Web application, enter only a local display name, choose public-safe example material or import their own material, and reach an understandable desktop workspace. The resulting implementation replaces the current functional skeleton with the Owner-frozen UX 1.4 interaction system while keeping every unfinished integration visibly honest.

This SDD is an executable foundation slice of the runnable-candidate milestone. It may render existing M1/M2 state and explicitly labeled planned M3/M4 states, but it may not claim those later capabilities are implemented.

## 2. Current state

- The public repository has an accepted Next.js/`next-intl` shell, Campaign API and persisted campaign flow.
- The current Web is a functional skeleton; the final interaction/visual system is not implemented.
- UX 1.4 truth is the Owner-reviewed prototype and decision package under the internal project `deliverables/presence-ux-exploration-20260815/`.
- AgentTeams is verified as an isolated pinned runtime profile and shadow adapter. It is not yet a persistent end-user installation/runtime managed by the product.
- No local user-registration contract, production material-ingest onboarding, Shadcn component layer or Tailwind CSS layer currently exists.

## 3. Scope

### In scope

- Desktop-only local welcome flow: one display name, no email/password/remote account registration.
- Persist the local owner profile in the product control plane; browser-only local storage is not authoritative.
- Onboarding branch A: public-safe deterministic example organization, products, markets and sample material.
- Onboarding branch B: real local material intake with an explicit support matrix, safe size/type validation, upload progress, extraction outcome and retry/delete controls. MD/TXT must be usable; PDF/DOCX support may only be marked implemented if independently parsed and tested in this SDD.
- Translate UX 1.4 from static prototype into componentized React/Next.js surfaces: global desktop shell, initialization, brand/material workspace, Campaign journey, content review, publishing center, AI team, Skills and scheduled-task visibility.
- AI team global navigation with the six stable functional members A0–A5, read-only responsibility/Skill/runtime details and honest metrics provenance.
- Current desktop manual publish-assistant journey only. Opening a platform or reporting manual completion never becomes `PUBLISHED` without reconciliation.
- Account setup/testing surface using existing authoritative capability contracts where available; unsupported OAuth, read-back or live action must remain disabled and labeled `PLANNED`.
- A real local environment-readiness surface for API, PostgreSQL, Web and AgentTeams adapter/runtime status. The UI consumes a defined status contract; it does not invent green states.
- Introduce Tailwind CSS and a reviewed Shadcn/ui-style component layer compatible with the current Next/React stack. Components are repository-owned, accessible and themed through shared tokens; avoid one-off page CSS and static-prototype copy/paste.
- Chinese-default UI with English message parity for all shipped strings.

### Out of scope

- Installing, downloading, upgrading or supervising the persistent AgentTeams runtime.
- Receiving or storing model-provider API keys in the browser, database, repository, logs or committed `.env` files.
- Real platform OAuth, browser DOM automation, automatic upload/click/publish, automatic direct publishing or URL/screenshot proof upload.
- Mobile/responsive product design below the documented desktop support gate.
- Read-only social reconciliation, hotspot discovery, automatic preparation, business outcome claims, customer UAT or legal/cultural compliance claims.
- Copying prototype JavaScript/CSS wholesale or importing competitor/Postiz source.

### Existing behavior that must not change

- `zh-CN` remains the default UI locale and stable codes remain untranslated in persisted/API state.
- PostgreSQL remains authoritative for business state.
- Producer and Auditor remain separate; Owner approval and external-action boundaries remain fail closed.
- Exact revision/account/media/time changes invalidate approval; UNKNOWN is not guessed or blindly retried.
- Existing public APIs, Campaign persistence, schedules and M2 evidence contracts remain backward compatible.

## 4. User journey and UI states

1. First open: system preflight shows service readiness and explains terminal-only provider configuration without exposing secret values.
2. Local identity: user enters a display name and continues; no registration copy or remote identity claim.
3. Material choice: use the example workspace or upload own files. Each file shows queued, extracting, ready, unsupported, rejected and failed states.
4. Initialization: confirm organization, product, Market, Locale, Platform and Time Zone as separate fields. Example-derived facts are visibly labeled.
5. Workspace: enter the Owner-frozen SaaS shell with meaningful empty/loading/blocked/recovery states.
6. Campaign: create or reopen a Campaign, inspect sources and market context, generate/review content through current verified control-plane capabilities.
7. Review: show the actual content before approval, only the active Agent in compact progress, and a drill-down trace of historical Agent steps.
8. Publish: copy/download remain review exports until an independent Audit PASS and exact external-action OwnerDecision authorize the exact Revision. Without both authorities, opening the official platform and reporting manual completion fail closed; an authorized manual completion could move only to an awaiting-reconciliation state.
9. Account setup/test: show configured identity/capability and deterministic connection-test result; do not ask for secrets in browser.
10. Recovery: refresh/restart reopens authoritative profile, onboarding progress, uploads and Campaign state without a hidden client-only success path.

## 5. Domain and API contracts

- Add versioned local-owner-profile and onboarding-session contracts with stable states and organization scope.
- Add a material-ingest manifest containing privacy-safe metadata, digest, type, size, extraction state and failure code. Raw customer material must never enter public fixtures or evidence.
- Define environment-readiness response fields for service name, state, checked time, safe reason code and remediation hint. Never return secret values.
- Reuse existing Organization/Campaign/Market/Account/Revision/Audit/Schedule contracts rather than creating UI-only duplicates.
- If new persistence is required, use an additive PostgreSQL migration with tenant/local-owner isolation and restart tests.

## 6. AgentTeams and Skills

- Render the six existing AgentTeam roles using the stable codes and Owner-approved functional Chinese names.
- Agent activity and metrics must come from the shared control plane or be visibly marked public-safe example data.
- This SDD may expose runtime readiness and configuration instructions but may not provision the runtime or collect provider secrets.
- The persistent local AgentTeams installer/supervisor, terminal secret broker and mission-worker integration require a separate `SDD-007` and independent security/recovery acceptance.

## 7. Dependencies and reuse decision

- Tailwind CSS: `INTEGRATE`; pin a Next 16/React 19 compatible release, record MIT license/source and lockfile delta.
- Shadcn/ui: `BUILD-FROM-REVIEWED-UPSTREAM-PATTERN`; add only needed repository-owned components, preserve license/attribution obligations and review transitive Radix/Lucide dependencies.
- Existing `next-intl`, Next.js, Fastify, PostgreSQL and local BlobStore: `INTEGRATE` through existing boundaries.
- Document parsing libraries, if used: `INTEGRATE` only after pinned-version, license, attack-surface and server-only invocation review.
- AgentTeams: existing pinned external runtime remains `INTEGRATE`; persistent user installation is `PLANNED` under SDD-007.

## 8. Failure, recovery, and rollback

- Invalid display name or unsupported/oversized files fail with stable codes and do not create a completed onboarding state.
- Parser failure preserves the source manifest and offers retry/delete without silently treating content as known.
- API/PostgreSQL/AgentTeams unavailable states are distinct and actionable; Web must not display fabricated readiness.
- Refresh and container restart recover persisted progress. Concurrent update conflicts remain explicit.
- A safe example workspace is isolated from real imported material and can be reset without deleting unrelated local data.
- Rollback is by reverting SDD commits and additive migrations; uploaded local blobs created by UAT require a documented cleanup command.

## 9. Acceptance criteria

- AC-01: A fresh local database opens a desktop welcome route and creates/reopens a local owner using only a display name.
- AC-02: The example path creates a public-safe, visibly labeled usable workspace and reaches the frozen shell without external calls.
- AC-03: Real MD/TXT import is validated, persisted by digest, extracted and visible after restart; unsupported and oversized files fail closed. PDF/DOCX are either fully tested or honestly disabled.
- AC-04: The UX 1.4 global shell, initialization, Campaign, review, publishing center and AI team routes are real React components connected to authoritative or explicitly labeled fixture/planned states.
- AC-05: Review shows content before approval, current-Agent progress and expandable historical trace; it never requires blind approval of a version number.
- AC-06: Manual publishing cannot transition to `PUBLISHED`; unavailable account/runtime capabilities are disabled with truthful remediation.
- AC-07: No browser API accepts, stores or logs provider secrets; secret scan and negative tests pass.
- AC-08: Tailwind/component dependencies are pinned, licensed, SBOM-visible and used through reusable primitives rather than page-local duplication.
- AC-09: Chinese/English message parity, keyboard/focus behavior, desktop width gate, axe checks, visual evidence, lint, typecheck, tests and production build pass.
- AC-10: Existing Campaign, schedule, M2 AgentTeams adapter and governance regression suites remain green.

## 10. Test plan

- Unit/schema tests for profile, onboarding, material validation/extraction and readiness contracts.
- PostgreSQL/API integration and container-restart persistence tests.
- Browser E2E for first open, example path, real MD/TXT path, failure/recovery, Campaign review and manual publish state.
- Storybook and visual screenshots at the Owner-supported desktop widths.
- Automated accessibility including keyboard, focus trap/restore and axe.
- English/Chinese message parity and locale-routing tests.
- Dependency/license/SBOM/audit, secret/privacy scan and full repository verification.
- AgentTeams existing isolated runtime smoke regression; no live external action.

## 11. Evidence and claims

Required evidence: Chinese acceptance report, exact commands/results, public-safe screenshots, browser test artifact, changed files, dependency/license decision, migration/restart evidence and zero-external-action assertion.

Allowed final claim after independent verification: `The local desktop onboarding and UX 1.4 workspace are implemented and engineering-verified with a public-safe example path and safe local text/Markdown intake.`

Persistent AgentTeams installation/supervision, PDF/DOCX parsing unless proven, real account OAuth, live publishing, reconciliation and business results remain `PLANNED` or `NOT_CLAIMED`.

## 12. Delivery plan

1. Component foundation and route/state map.
2. Local profile, onboarding and material-ingest contracts.
3. Frozen shell and core journeys.
4. Real API/state integration and truthful planned/blocked surfaces.
5. Accessibility, visual and restart verification.
6. Acceptance report, Draft PR and structured handoff.

The Executor owns only `M5-00`. It may not change other canonical module states. Machine completion with Owner visual UAT pending is at most `EVIDENCE_READY`.

## 13. Alternatives and decision log

- Static HTML replacement was rejected because it cannot preserve authoritative state, accessibility or maintainability.
- A browser-only demo login was rejected because refresh/restart would create a hidden client-only truth.
- Bundling AgentTeams installation and provider-secret management into this UI SDD was rejected because it crosses privileged lifecycle, secret and recovery boundaries; SDD-007 will own that vertical slice.
- Mobile and one-click publish were rejected for this competition slice by the Owner UX freeze.

## 14. Owner-participated acceptance

The acceptance report must give the Owner a clean-install URL and test data, then ask them to verify: display-name entry; example and real MD/TXT onboarding; navigation/layout; content-before-approval; active Agent and trace; account/runtime blocked states; manual publish semantics; refresh/restart recovery; and keyboard behavior. Each step must state expected result, failure signs, screenshot/video evidence and cleanup.

## 15. Task closeout

- Create `docs/reports/acceptance/SDD-006-ACCEPTANCE.md` in Chinese.
- Return exact worktree, branch, full commit, Draft PR, changed files, dependency changes, tests, screenshots, limitations, rollback and Owner UAT steps.
- The Coordinator independently reviews the handoff and is the only role authorized to integrate and advance canonical status.
- Next infrastructure candidate: SDD-007 persistent local AgentTeams bootstrap and long-running runtime.
