# SDD-004 — Action Center Frontend Foundation

> Status: `SPEC_READY`
> Milestone: preparatory work for future `M3-07`; this SDD does not start M3
> Progress module IDs: `M3-07` reference only; canonical state remains `NOT_STARTED`
> Owner: LumiClaw Presence Owner / product-design lead
> Goal objective / task reference: build a redesign-resistant, public-safe Action Center ViewModel, state matrix, accessible component skeleton, stories, tests, and Chinese delivery evidence without depending on the M3-01 branch
> Target evidence maturity: `ENGINEERING_VERIFIED` for the UI foundation only
> Acceptance report: `docs/reports/acceptance/SDD-004-ACCEPTANCE.md`
> Last updated: `2026-08-10`

## 0. Spec Kit lifecycle record

GitHub Spec Kit is used as a method; no CLI or generated `.specify/` files are introduced.

1. **Constitution:** `docs/specs/sdd-004/CONSTITUTION.md` indexes the task authorization and repository rules.
2. **Specify:** Sections 1–4 and 9 define the user problem, bounded outcome, states, and binary acceptance.
3. **Clarify:** `docs/specs/sdd-004/CLARIFICATIONS.md` resolves scope, maturity, backend, retry, Handoff, locale, and design ambiguities.
4. **Plan:** Sections 5–8, 10, and 12 plus `docs/specs/sdd-004/PLAN.md` define the implementation boundary.
5. **Checklist:** `docs/specs/sdd-004/CHECKLIST.md` checks safety, claims, i18n, accessibility, privacy, and evidence.
6. **Tasks:** `docs/specs/sdd-004/TASKS.md` orders the code and verification checkpoints.
7. **Analyze:** `docs/specs/sdd-004/ANALYZE.md` records the cross-artifact review and the decision to enter `SPEC_READY` before code.
8. **Implement / Converge:** implementation, tests, Storybook, build, route evidence, and the Chinese acceptance report follow only after this gate.

## 1. User problem and outcome

The immediate user is the non-technical Owner who must understand exactly what was reviewed, what authority exists, what action mode applies, what happened, and what they must do next. The current accepted M1/M2 Web surfaces stop at non-executable Owner Review. Future M3 contracts and final visual design are not frozen, so binding a UI directly to one proposed backend shape or one final aesthetic would create avoidable rework and unsafe state claims.

When this SDD is complete, the Owner can inspect a public-safe Action Center foundation that:

- presents one typed, locale-independent state model for eight required action states;
- keeps exact Owner Review, Grant, execution, Receipt, and reconciliation evidence visually separate;
- exposes exactly one next step and an explicit retry policy for every state;
- makes Direct, Handoff, and Prepare Only modes unmistakable;
- never treats a prepared Handoff or an ambiguous connector result as `PUBLISHED`;
- never offers blind retry from `UNKNOWN`;
- remains keyboard-readable and screen-reader understandable without relying on color;
- can replace fixtures with a future API adapter without making PR #3 fields a public Web contract;
- can accept a future visual-system token package without changing state policy or component semantics.

This is a bounded preparatory SDD. It advances the frontend dependency for future M3-07 but does not satisfy M3-01–M3-06 dependencies, perform an external action, or change the canonical `M3-07` state.

## 2. Verified current state

At base `f13aee3e8dba5b344924bd80ede256ae2c703bde`:

- `IMPLEMENTATION-STATUS.md` keeps M3-01 through M3-07 at `NOT_STARTED`; M2 remains `EVIDENCE_READY` pending Owner UAT.
- `apps/web/src/components/shadow-mission-workspace.tsx` explicitly models Owner Review as non-executable and proves zero ActionGrant, Connector, and external action.
- `apps/web/src/components/campaign-workspace.tsx` routes `review` to the M2 Review Desk and has no Action Center, Grant, Receipt timeline, or reconciliation component.
- `apps/web/messages/zh-CN.json` and `en.json` pass exact catalog parity; `zh-CN` remains the default UI locale.
- Storybook 10.5.5 and `@storybook/addon-a11y` are already installed; the repository has an existing browser-safety bundle check.
- CSS tokens already implement an evidence-first editorial baseline, but final UI/UX design is not frozen.
- remote-tracking `origin/dtg-lumiclaw-v2` / PR #3 proposes ActionGrant and Receipt shapes, but its own freeze document records unresolved Grant-list, consumption, Handoff confirmation, reconciliation, retry, SSE filtering, and failure-semantics questions. It is untrusted reference material only.

No local branch import, cherry-pick, rebase, merge, modification, Push, PR, Deploy, connector, credential, operator, outbox, scheduler, or database work is authorized by this SDD.

## 3. Scope

### In scope

- a typed internal `ActionCenterViewModel` and exhaustive state policy for `GRANT_READY`, `GRANT_ISSUED`, `OWNER_ACTION_REQUIRED`, `PUBLISHED`, `UNKNOWN`, `FAILED`, `EXPIRED`, and `REVOKED`;
- a stable UI execution-mode vocabulary: `DIRECT`, `HANDOFF`, `PREPARE_ONLY`;
- one visible explanation, one next action, explicit retry permission, claim maturity, and mode per state;
- exact Owner Review summary, Grant summary, Execution Card, Receipt Timeline, and UNKNOWN Reconciliation Panel;
- a fail-closed experimental adapter that accepts `unknown`, normalizes only recognized fields, and produces the internal ViewModel;
- deterministic public-safe fixtures and Storybook stories for the full state matrix;
- `zh-CN` default copy with exact `en` key parity;
- separate display of UI locale, campaign content language, target market, and schedule IANA time zone;
- semantic landmarks, headings, labels, live/status roles, keyboard-operable controls, visible focus, and non-color state cues;
- unit and render-contract tests for state policy, dangerous operations, UNKNOWN, Handoff evidence, adapter isolation, and message parity;
- a restrained temporary visual baseline implemented only through replaceable Action Center CSS variables;
- one honest route-level foundation preview plus Storybook verification paths;
- Chinese acceptance evidence and local commit.

### Out of scope

- real signing, persistence, ActionGrant issuance, Outbox, ActionAttempt, Receipt write, SSE connection, connector, scheduler, reconciliation mutation, or platform action;
- secrets, OAuth, Token, cookie, real account, real URL, customer data, private screenshot, or private runtime evidence;
- changing domain/backend state semantics or fixing PR #3;
- treating PR #3 types or endpoints as a frozen public contract;
- final UI brand, final typography, final responsive layout, platform artwork, illustration, animation, or production visual-regression baseline;
- changing `M3-07` or any other canonical module state;
- production readiness, external calibration, customer UAT, a successful publication, growth, leads, or revenue claims;
- Push, PR, Deploy, or edits to the teammate branch.

### Existing behavior that must not change

- five stable product routes and Chinese-default locale behavior;
- existing M1/M2 Campaign, SHADOW, exact Owner Review, and no-action boundaries;
- Web/API/worker/operator process separation;
- persisted stable codes rather than translated state labels;
- public fixtures remain synthetic and `NOT_LIVE`;
- existing lint, typecheck, tests, message/status/report/secret checks, build, and Storybook behavior.

## 4. User journey and UI state contract

### Journey

1. The Owner opens Review & Action Center and first sees an explicit `UI FOUNDATION / NOT_LIVE` boundary.
2. The Owner reads the exact reviewed revision, digest, account, intended action, approval/evidence reference, and expiry without opening technical logs.
3. The Owner reads the execution mode before any action control.
4. In `GRANT_READY`, a dangerous action stays disabled until the exact-summary confirmation is checked and an authorized handler exists.
5. In `GRANT_ISSUED`, the Owner sees the short-lived scope and waits for the deterministic operator; there is no duplicate issue/retry control.
6. In `OWNER_ACTION_REQUIRED`, the Owner follows a Native Handoff package and must return evidence before publication can be claimed.
7. In `UNKNOWN`, the Owner sees the fixed no-blind-retry explanation and can start reconciliation only.
8. In `FAILED`, the UI may offer a new controlled-attempt request only when the adapter marks a confirmed failure as retryable; it never repeats the previous action silently.
9. `EXPIRED` and `REVOKED` are terminal for that Grant and send the Owner back to review/authorization.
10. `PUBLISHED` requires native Direct proof or reconciled Handoff evidence and exposes the Receipt evidence for inspection.

### Required state matrix

The committed fixture for every row is labeled `IMPLEMENTED` only as a UI behavior. External execution behind every row remains `PLANNED` or `NOT_CLAIMED`.

| State | Owner-visible explanation | Unique next step | Retry allowed | Claim maturity shown by fixture | Permitted mode |
|---|---|---|---:|---|---|
| `GRANT_READY` | Exact review is ready, but no executable authority exists yet | verify exact summary and request issuance | no | `IMPLEMENTED` · UI fixture | Direct / Handoff / Prepare Only |
| `GRANT_ISSUED` | A short-lived exact Grant exists; duplicate issuance is unsafe | monitor the existing Grant window | no | `IMPLEMENTED` · UI fixture | Direct / Handoff |
| `OWNER_ACTION_REQUIRED` | The system prepared a Handoff; the Owner must complete native steps and return evidence | complete Handoff and record evidence | no | `IMPLEMENTED` · UI fixture | Handoff |
| `PUBLISHED` | Native evidence confirms the exact action | inspect the native record and Receipt | no | `IMPLEMENTED` · UI fixture | Direct, or reconciled Handoff only |
| `UNKNOWN` | The platform outcome is not confirmed; the system will not repeat the action | reconcile the original attempt | no | `IMPLEMENTED` · UI fixture | Direct / Handoff |
| `FAILED` | A definitive failure is known and no publication was claimed | request a newly reviewed controlled attempt | yes, only as a new decision | `IMPLEMENTED` · UI fixture | Direct / Handoff / Prepare Only |
| `EXPIRED` | The Grant window closed and that Grant cannot execute | return to exact review and authorize anew | no | `IMPLEMENTED` · UI fixture | Direct / Handoff |
| `REVOKED` | The Owner revoked this Grant and it remains non-consumable | inspect the reason and return to review if needed | no | `IMPLEMENTED` · UI fixture | Direct / Handoff |

State is never communicated by color alone. Each state has a stable code, text label, icon/marker text, mode label, timeline event, and explicit next-step heading.

## 5. ViewModel and adapter contracts

### 5.1 Stable internal ViewModel

The React component consumes a UI-owned model rather than a backend DTO. The model contains:

- `state`, `mode`, `claimMaturity`, `environmentLabel`, `isLive`;
- `review`: revision ID/version/digest, account, action, audit/owner evidence, expiry;
- optional `grant`: ID/digest/status/issued/expiry/revocation reason;
- `execution`: platform, action label, content language, target market, schedule time zone;
- `receiptTimeline`: ordered evidence events and optional public-safe native reference;
- `nextAction`: one stable action code, label, danger/confirmation flags, enabled reason;
- `retryAllowed` and a required explanation;
- optional `reconciliation` with permitted evidence paths and an explicit `blindRetryAllowed: false`.

Translated labels are copy parameters, never state values. UI locale is supplied separately by the rendering context.

### 5.2 Experimental transport adapter

The future API boundary is deliberately one-way:

```text
unknown transport snapshot
→ narrow runtime guards / conservative normalization
→ ActionCenterViewModel
→ presentational components
```

Rules:

- the adapter accepts `unknown`; no component imports a PR #3 domain type;
- proposed fields such as `grant.status`, `receipt.state`, `platformUri`, or `handoffSteps` are read only as optional candidate signals;
- missing, contradictory, or unsupported transport fields map to `UNKNOWN`, `OWNER_ACTION_REQUIRED`, or `PREPARE_ONLY`, never optimistic success;
- `NATIVE_HANDOFF + PUBLISHED` without returned native evidence is downgraded to `OWNER_ACTION_REQUIRED`;
- `UNKNOWN` always sets `retryAllowed=false` and `blindRetryAllowed=false`;
- only a future frozen API SDD may promote the adapter input into a versioned public contract.

### 5.3 Action safety

- component callbacks emit UI intents only; this SDD supplies no network mutation implementation;
- route integration passes no mutation handler, so dangerous controls remain disabled;
- Storybook may provide an inert local callback solely to verify the confirmation gate;
- `GRANT_READY` issuance requires an exact-summary checkbox before its intent can be emitted;
- `UNKNOWN` exposes reconciliation, never a retry intent;
- `EXPIRED` and `REVOKED` cannot emit execute/retry intents;
- `FAILED` can emit only `REQUEST_NEW_CONTROLLED_ATTEMPT`, not replay the old Grant.

## 6. AgentTeams and Skills

No AgentTeams member, task, Skill, model, connector, deterministic operator, or external tool is added. Existing M2 six-member and no-action semantics remain unchanged. `frontend-design` guides the temporary visual baseline only; it does not override the Owner's future design freeze or architecture rules.

## 7. Dependencies and reuse decision

| Component | Decision | Boundary |
|---|---|---|
| React 19.2 / Next.js 16 | `INTEGRATE` existing locked dependencies | presentational client component and existing route only |
| next-intl message catalogs | `INTEGRATE` existing locked dependency | `zh-CN` / `en` keys; no translated domain state |
| Storybook 10.5.5 + a11y addon | `INTEGRATE` existing locked dependencies | public-safe state scenarios and static build |
| Vitest 4.1.10 | `INTEGRATE` existing locked dependency | pure policy/adapter/render-contract tests |
| Action Center ViewModel/policy/components | `BUILD / OWN` | UI-owned stable semantics |
| PR #3 candidate API | `POC-GATED reference only` | read-only inspection; no dependency, import, or merge |
| final design tokens/assets | `LATER-REPLACE` | Owner/design thread will supply a frozen package |

No package or lockfile change is planned.

## 8. Failure, recovery, and rollback

- invalid/unknown transport input fails to an honest `UNKNOWN` or `PREPARE_ONLY` ViewModel;
- missing review identity/digest disables dangerous actions;
- contradictory Grant/Receipt state never upgrades to `PUBLISHED`;
- incomplete Handoff remains `OWNER_ACTION_REQUIRED`;
- `UNKNOWN` reconciliation failure remains `UNKNOWN` and does not reveal a retry button;
- terminal Grant states remain terminal in the UI;
- missing callback keeps all mutation-shaped controls disabled while preserving read-only inspection;
- locale copy failure is caught by message parity/typecheck before build;
- route rollback removes the Action Center render without changing data, migrations, or M2 state;
- full rollback reverts the local SDD-004 commit; there is no database or external-action cleanup.

## 9. Acceptance criteria

| ID | Binary criterion |
|---|---|
| AC-01 | The internal type and fixture matrix exhaustively cover all eight required stable states. |
| AC-02 | Every state renders one explanation, one unique next step, retry permission, claim maturity, and Direct/Handoff/Prepare Only mode. |
| AC-03 | The exact Owner Review summary renders revision/version/digest/account/action/evidence/expiry. |
| AC-04 | The Grant summary renders absent, issued, expired, and revoked authority honestly without implying signing or persistence. |
| AC-05 | The Execution Card separately renders UI locale, content language, target market, and IANA schedule time zone. |
| AC-06 | Receipt Timeline renders ordered, semantic evidence events for all fixture states. |
| AC-07 | `UNKNOWN` renders the fixed no-repeat explanation, a reconciliation panel, and no retry intent. |
| AC-08 | A Handoff snapshot without returned native evidence cannot map or render as `PUBLISHED`. |
| AC-09 | Dangerous issuance intent remains unavailable until exact-summary confirmation and an explicit handler are both present. |
| AC-10 | `EXPIRED` and `REVOKED` expose no execute or retry intent; `FAILED` can request only a newly controlled attempt. |
| AC-11 | Contradictory or unsupported API-like input fails closed through the adapter without throwing optimistic UI success. |
| AC-12 | `zh-CN` remains default, `en` has exact message-key parity, and stable state codes are untranslated. |
| AC-13 | Storybook contains public-safe stories for all eight states plus a narrow/English verification scenario. |
| AC-14 | Semantic headings/regions/status labels, keyboard-operable controls, visible focus, and non-color state cues are present; Storybook a11y build gate passes. |
| AC-15 | No component imports PR #3 types and no public contract is copied from the untrusted branch. |
| AC-16 | Fixtures and built story bundles contain no credential, real account, customer data, internal screenshot, or private evidence. |
| AC-17 | scoped unit tests, message parity, lint, typecheck, Web build, and Storybook static build pass, or exact pre-existing blockers are recorded. |
| AC-18 | The route preview is visibly `UI FOUNDATION / NOT_LIVE`; no M3 status changes, external action, Push, PR, or Deploy occur. |

## 10. Test plan

- policy unit tests: exhaustive state mapping, unique next action, retry matrix, mode/maturity presence;
- adapter tests: candidate PR #3-like shapes, unsupported input, UNKNOWN, explicit failure, Handoff without evidence, Handoff with evidence;
- dangerous-action tests: confirmation + handler gate, terminal state denial, no blind retry;
- render-contract tests: semantic regions/headings/status, disabled route controls, UNKNOWN copy, independent locale/content/market/time-zone labels;
- i18n: existing parity checker plus route/default-locale tests;
- Storybook: eight state stories, English and narrow stories, a11y addon, static build, browser-safety scan;
- Web: scoped `typecheck`, lint, Next build, route smoke/screenshot if the local runtime permits;
- repository: relevant full Vitest and secret scan; broader gates in proportion to change risk.

## 11. Evidence and claims

Evidence will include exact test commands/results, Storybook story IDs/static path, optional route screenshot, changed-file list, and `docs/reports/acceptance/SDD-004-ACCEPTANCE.md`.

Allowed closeout claim:

> `ENGINEERING_VERIFIED`: a public-safe, bilingual Action Center UI foundation has an exhaustive state ViewModel, fail-closed adapter, accessible component skeleton, state stories, and automated tests.

Still `PLANNED`: frozen backend integration, Grant mutation, scheduler/operator/connector execution, real Receipt/reconciliation, final UI/UX, and M3-07 implementation.

Explicitly `NOT_CLAIMED`: real publication, production readiness, customer UAT, platform permission, external calibration, growth, leads, or revenue.

## 12. Delivery plan

1. Freeze SDD-004 artifacts through Analyze and mark the SDD `SPEC_READY` without changing canonical progress.
2. Build the internal types/policy and negative tests.
3. Build the experimental adapter and public-safe fixtures with fail-closed tests.
4. Add bilingual copy and the accessible component skeleton.
5. Add replaceable CSS tokens, route preview, and Storybook matrix.
6. Run scoped tests and convergence checks; correct defects without expanding scope.
7. Create the Chinese acceptance report, record Owner protocol and limitations, commit locally, and return a structured handoff.

Critical path: policy → adapter/fixtures → components/copy → stories/integration → tests/build/evidence. No child task may depend on PR #3 code.

## 13. Alternatives and decision log

- **Import PR #3 domain types now:** rejected because the branch records unresolved semantics and is not frozen. Reopen only after a Coordinator-accepted versioned API SDD.
- **Build an API-mirroring component:** rejected because visual and transport change would be coupled. The internal ViewModel is the replaceable boundary.
- **Render optimistic `PUBLISHED` after Handoff preparation:** rejected because it violates the product truth boundary. Reopen only with native URL or approved evidence semantics.
- **Retry UNKNOWN automatically:** rejected because duplicate public action is a high-risk failure. Reopen only through a new governed reconciliation/authorization SDD.
- **Freeze final visual design in this SDD:** rejected because the independent design thread owns that decision. This task defines tokens and semantics only.
- **Add a component/testing library:** rejected for this bounded foundation; existing React, Vitest, Storybook, and server rendering are sufficient. Reopen if interaction coverage cannot be expressed safely.

## 14. Owner-participated acceptance

Owner acceptance is useful for comprehension and interaction language, not for proving any platform action.

### UAT-01 — Read-only state comprehension

- Prerequisite: local Storybook static build or dev server; only committed synthetic fixtures.
- Steps: open the Action Center stories; inspect `GRANT_READY`, `OWNER_ACTION_REQUIRED`, `UNKNOWN`, `PUBLISHED`, `EXPIRED`, and `REVOKED`; state the one next step for each.
- Expected: the Owner can identify reviewed scope, mode, current truth, one next action, and whether retry is permitted without opening technical logs.
- Failure signs: any state looks published without evidence; UNKNOWN presents retry; Handoff looks complete before evidence; mode or next action is ambiguous.
- Evidence to return: story IDs plus screenshots or a written `PASS/FAIL` with exact confusing copy.
- Cleanup: stop the local server; no data or platform cleanup exists.

### UAT-02 — Keyboard and responsive review

- Prerequisite: same public-safe Storybook build.
- Steps: use Tab/Shift+Tab/Space/Enter through `GRANT_READY` confirmation and controls; repeat UNKNOWN at narrow viewport.
- Expected: focus is visible, reading/control order is logical, the dangerous button remains disabled before confirmation, and UNKNOWN has reconciliation but no retry.
- Failure signs: focus loss, color-only status, clipped critical evidence, unlabeled control, or unexpected intent emission.
- Evidence to return: viewport, browser, story ID, screenshot/video, and `PASS/FAIL`.
- Cleanup: stop the local server.

Owner UAT remains `PENDING` at Executor closeout unless the Owner performs this protocol. Machine evidence alone does not make M3-07 `ACCEPTED` or `EVIDENCE_READY`.

## 15. Task closeout

- Chinese acceptance report: `docs/reports/acceptance/SDD-004-ACCEPTANCE.md`.
- Canonical progress: no change; `M3-07` remains `NOT_STARTED`.
- SDD result may reach `EVIDENCE_READY` for this bounded foundation after machine verification; Owner/Coordinator acceptance remains separate.
- Goal completes only after implementation, report, verification, local commit, and structured handoff are complete.
- Next candidate step: Coordinator independently reviews the commit; the design thread supplies frozen tokens/assets; future M3 work integrates a frozen API after M3 dependencies are satisfied.
