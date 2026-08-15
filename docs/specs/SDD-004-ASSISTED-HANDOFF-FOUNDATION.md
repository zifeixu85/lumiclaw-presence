# SDD-004 — Multi-platform activation and assisted-handoff foundation

> Status: `SPEC_READY`  
> Milestone: `M3 — Controlled live activation`  
> Progress module IDs: `M3-00`  
> Owner: LumiClaw product/design Owner  
> Goal objective / task reference: one-day, non-executing foundation for truthful multi-platform readiness and handoff  
> Target evidence maturity: `ENGINEERING_VERIFIED`  
> Acceptance report: `docs/reports/acceptance/SDD-004-ACCEPTANCE.md`  
> Last updated: `2026-08-16`

> **Owner Override:** `docs/specs/sdd-004/CHANGE-REQUEST-1-DESKTOP-MANUAL-PUBLISH-ASSISTANT.md`（`SPEC_READY`）governs conflicting current UI, builder and acceptance language. The current product path is desktop `MANUAL_DESKTOP_ASSISTANT`; the three capability layers remain internal/future contracts only.

## 1. User problem and outcome

The Owner needs LumiClaw to prepare platform-native content for more than the original four-platform baseline and to guide safe user-driven publication without pretending that every platform is directly connected. Today the accepted M1 domain supports editable X, Bluesky, LinkedIn and Xiaohongshu artifacts, while M2 ends at a non-executable exact Owner Review.

This SDD introduces a stable, deterministic foundation that can truthfully describe three product capabilities:

1. `PLATFORM_READY`: create, review, copy and download a platform-specific artifact package;
2. `ASSISTED_HANDOFF`: use an official public intent/share entry point when its contract permits, otherwise provide copy/download/open/manual steps;
3. `GOVERNED_DIRECT`: a reserved capability that remains unavailable until a platform-specific official connector passes OAuth, account-capability, ActionGrant, receipt and reconciliation gates.

The visible result is a public-safe fixture that explains the current mode and downgrade for the six candidate platforms X, Bluesky, LinkedIn, Xiaohongshu, Instagram and Threads. It performs no platform action.

## 2. Current state

- `M1-05` is accepted for four editable platform artifacts and native-like previews.
- `M2-04` is engineering-verified for immutable revisions, independent audit and exact non-executable Owner Review; M2 Owner UAT is still pending.
- `M3-01` through `M3-07` are not started. There is no accepted ActionGrant, connector, external platform action, handoff reconciliation or ActionReceipt path on `main`.
- `Postiz` is `POC-GATED`, is not a dependency, and is not part of this SDD.
- Instagram and Threads are `PLANNED`; their presence in the registry must not be described as connected or published.

`M3-00` is permitted to progress before M2 Owner UAT only because it cannot execute an external action, cannot create an ActionGrant and cannot produce `PUBLISHED`.

## 3. Scope

### In scope

- An original LumiClaw activation-platform registry with stable locale-independent codes for the six candidate platforms.
- Stable contracts for capability layer, assisted mode, prefill limits, account confirmation, proof requirements and downgrade reason.
- Pure deterministic handoff builders for:
  - X official Web Intent: text, URL, hashtags and `via`; media remains manual;
  - Threads public text intent: explicitly experimental and feature-probed, with a manual fallback;
  - LinkedIn official share-offsite: URL only; body and media remain copy/download/manual;
  - Instagram: copy/download/open/manual only, with no web-prefill claim.
- Platform-ready package metadata that binds an exact approved revision digest and ordered media digests, and exposes copy/download/open instructions without executing them.
- A non-executing reconciliation-state contract that distinguishes `USER_ACTION_REQUIRED`, `HANDOFF_PENDING`, `HANDOFF_RECONCILED`, `FAILED` and `UNKNOWN_RECONCILIATION_REQUIRED` and never maps handoff creation to `PUBLISHED`.
- Public-safe unit/contract fixtures and a minimal current-style Storybook or Web evidence surface showing capability/downgrade. It is a functional evidence surface, not final UX.
- English/Chinese labels for any new user-visible state.

### Out of scope

- ActionGrant, transactional outbox, Action Operator dispatch, scheduler execution, OAuth, platform credentials or live accounts.
- Automatic browser DOM inspection, injection, form filling, media upload, account switching, button clicking, Cookie/password access, scraping or risk-control bypass.
- A browser extension, mobile native application or production Publish Assistant.
- Real publication, URL verification, native read-back, metrics, comments, replies, likes, follows, DMs or business outcomes.
- Postiz source, dependency, SDK, deployment or runtime call.
- Expanding the accepted M1 Campaign invariant from four active platform revisions to six. Instagram and Threads remain candidate registry entries until a later ArtifactProfile SDD.
- Final visual design; the Owner's UX task remains authoritative for visual convergence.

### Existing behavior that must not change

- The accepted four-platform Campaign fixture, schema, validation, persistence and preview paths remain compatible.
- M2 Owner Review remains non-executable and produces zero ActionGrant, Connector and external action.
- X, LinkedIn and Xiaohongshu existing claims remain truthful; Bluesky Direct and every real connector remain unimplemented.

## 4. User journey and UI states

1. The user views a platform activation summary for an exact approved revision.
2. The surface states whether the platform is only content-ready, supports an official assisted entry point, requires a manual package, or has a future direct path.
3. Before any handoff, the surface requires the user to confirm the intended account; it never infers the current browser session account.
4. The user may copy approved text, download approved ordered media and inspect the official/open target. The deterministic builder returns data only; tests never navigate.
5. The state remains `USER_ACTION_REQUIRED` or `HANDOFF_PENDING` until later evidence reconciliation. Missing or unsafe proof cannot become `HANDOFF_RECONCILED` or `PUBLISHED`.
6. An expired/wrong capability fails closed. An unknown external result offers reconciliation, not blind resend.

The evidence fixture must show normal, manual fallback, expired capability, wrong-account/capability and unknown-reconciliation states. Loading animation and final visual motion are deferred to the UX SDD.

## 5. Domain and API contracts

The implementation owns pure domain/library contracts only; no new external-action API endpoint is authorized.

Required stable concepts:

- `ActivationPlatformCode`: `X | BLUESKY | LINKEDIN | XIAOHONGSHU | INSTAGRAM | THREADS`;
- `ActivationLayer`: `PLATFORM_READY | ASSISTED_HANDOFF | GOVERNED_DIRECT`;
- `HandoffMode`: `OFFICIAL_INTENT | OFFICIAL_URL_SHARE | MANUAL_PACKAGE | NATIVE_HANDOFF | DIRECT`;
- capability fields including `canPrefillText`, `canPrefillLink`, `canPrefillMedia`, `requiresAccountConfirmation`, `proofTypes`, `featureProbe`, `fallbackMode` and a stable downgrade code;
- `ApprovedActivationInput`: organization/campaign/revision/platform/account identifiers, exact approved revision digest, ordered media digests, capability snapshot identity and expiry;
- `HandoffPackage`: immutable input digest, copy payload, ordered media references, safe open target and user steps;
- `HandoffOutcomeState`: user-action, pending, reconciled, failed and unknown-reconciliation-required only.

Builders must use standards-based URL encoding, enforce HTTPS allowlisted hosts and reject stale or mismatched platform/account/capability input. Translated labels are UI-only and never persisted as enum values.

## 6. AgentTeams and Skills

No new AgentTeams member, model call or live Skill execution is required. Platform content Skills and publishing connectors remain separate:

- ArtifactProfile/Skill controls content structure, media specifications, constraints and audit input.
- Handoff/Connector controls account capability, official entry point, external execution and receipt semantics.

An Agent or AgentTeams completion cannot invoke a handoff, confirm an account, issue an ActionGrant or mark an external outcome.

## 7. Dependencies and reuse decision

| Component | Decision | Boundary |
|---|---|---|
| LumiClaw registry/builders | `BUILD` | Original Apache-2.0 pure TypeScript; no upstream connector code copied |
| Official public intent/share URLs | `INTEGRATE` as documented URL contracts | Pure URL generation only; feature probe/fallback where required; no DOM automation |
| Postiz | `POC-GATED` | Not imported, called, deployed or copied in SDD-004 |
| Browser extension/native mobile share | `LATER-REPLACE` | Design input only; not built in this SDD |

The implementation must record official source URLs in code comments or documentation without copying copyrighted provider implementations.

## 8. Failure, recovery, and rollback

- Invalid URL/text/media/platform input fails before a package is returned.
- Capability expiry, platform mismatch, account mismatch or missing account confirmation returns a stable blocked result.
- Threads intent probe failure downgrades to `MANUAL_PACKAGE` without implying loss of approved content.
- X media, LinkedIn text/media and Instagram text/media are never represented as web-prefilled when official contracts do not support that behavior.
- `UNKNOWN_RECONCILIATION_REQUIRED` has no automatic resend transition.
- Rollback is code-only: remove the new package/component and restore the previous build manifest. This SDD adds no migration, database row, credential or external side effect.

## 9. Acceptance criteria

| ID | Binary criterion |
|---|---|
| AC-01 | One registry entry exists for each of the six candidate platforms, with stable codes and truthful layer/mode/prefill/proof/fallback fields. |
| AC-02 | X, Threads, LinkedIn and Instagram deterministic builders produce the documented safe mode and correctly encoded/allowlisted targets for valid fixtures. |
| AC-03 | X media, Threads media, LinkedIn body/media and all Instagram media/text web-prefill claims are false; manual package steps remain available. |
| AC-04 | An expired capability, platform mismatch, account mismatch or absent required account confirmation fails closed with a stable code. |
| AC-05 | A package binds the exact approved revision digest and ordered media digests; mutation changes/rejects the package identity. |
| AC-06 | Package creation cannot produce `PUBLISHED`; missing proof cannot produce `HANDOFF_RECONCILED`; unknown state exposes reconciliation and no blind resend. |
| AC-07 | Existing accepted four-platform Campaign/domain/API tests remain green without changing the exact-four active Campaign invariant. |
| AC-08 | A public-safe Storybook/Web fixture visibly explains at least four platform modes/downgrades and contains no navigation, credential or live platform call. |
| AC-09 | English/Chinese message parity, typecheck, lint, unit/contract tests, build, secret scan and dependency/license inventory pass. |
| AC-10 | No Postiz/AGPL source or dependency, DOM automation, credential handling, live account or external platform action is introduced. |

## 10. Test plan

- Registry/schema/unit tests for all six platform entries.
- Table-driven URL encoding and allowlist tests for X, Threads, LinkedIn and Instagram manual-open behavior.
- Negative tests for expired/wrong capability, absent account confirmation and input digest mutation.
- State-machine tests proving no package-to-`PUBLISHED` path and no resend from unknown.
- Regression tests for the accepted M1 exact-four Campaign fixture and M2 zero-action boundary.
- Storybook build and a browser-safe screenshot or DOM assertion for the evidence surface.
- `npm run lint`, `npm run typecheck`, targeted `vitest`, `npm run check:messages`, `npm run check:secrets`, `npm run verify:dependencies`, relevant builds, and `git diff --check`.

Full Compose/live provider tests are not required for this pure, non-executing slice, but the acceptance report must state that limitation.

## 11. Evidence and claims

Required evidence:

- exact branch/worktree/commit and changed-file list;
- targeted tests with exact pass counts;
- build/static-gate results;
- public-safe Storybook/Web screenshot or deterministic DOM evidence;
- dependency/license result proving no Postiz/AGPL addition;
- Chinese acceptance report with limitations and rollback.

Allowed claim after engineering verification: “LumiClaw has an engineering-verified, non-executing capability and assisted-handoff foundation for six candidate platforms, including truthful official-intent/manual downgrade contracts.”

Still `PLANNED` or `NOT_CLAIMED`: six connected accounts, automatic publishing, Instagram/Threads ArtifactProfiles, live handoff reconciliation, Direct connectors, Postiz integration, customer use, reach, leads or revenue.

## 12. Delivery plan

This bounded one-day slice owns only `M3-00`.

1. Foundation contract and registry — 2–3 hours.
2. Four deterministic assisted builders and safety tests — 2–3 hours.
3. Minimal evidence surface, i18n and browser-safe proof — 1–2 hours.
4. Verification, Chinese acceptance report, commit/push and Draft PR — 1–2 hours.

The critical path is domain contract → negative tests → evidence surface → verification. Final visual convergence may follow the UX Owner Review and must not rewrite these stable safety codes silently.

## 13. Alternatives and decision log

- Add Instagram/Threads directly to the accepted M1 Campaign schema now: rejected because it would rewrite the exact-four accepted invariant before ArtifactProfiles, fixtures and UX are ready.
- Start `M3-04` before `M3-01`: rejected because the current module includes exact reconciliation and depends on ActionGrant.
- Build one browser DOM automation extension: rejected for account, policy, fragility and false-success risk.
- Make Postiz the one-day critical path: rejected; it remains a separately evaluated `POC-GATED` execution provider.
- Use only manual copy/paste for every platform: rejected because official intent/share contracts can reduce work where they are truthful, but every intent retains a manual fallback.

## 14. Owner-participated acceptance

### UAT-01 — Read-only capability and downgrade review

- **Why:** The Owner must verify that business labels explain what happens without implying automatic publication.
- **Prerequisites:** a local Storybook/Web evidence URL from the Executor; only public-safe fixture data.
- **Steps:**
  1. Open the provided evidence surface.
  2. Inspect X, Threads, LinkedIn and Instagram rows/cards.
  3. Confirm each row states what can be copied, downloaded, prefilled and what remains manual.
  4. Inspect expired/unknown examples and confirm there is no “publish again” or completed state.
- **Expected:** the Owner can distinguish platform-ready, assisted and future direct capability and sees account confirmation before handoff.
- **Failure signs:** any automatic-publish claim, media-prefill claim outside the documented contract, missing fallback, or `PUBLISHED` before proof.
- **Evidence to return:** one screenshot plus `PASS` or exact requested wording changes.
- **Cleanup:** stop the local evidence server; no external state exists.

Until UAT-01 is recorded, `M3-00` may be at most `EVIDENCE_READY`.

## 15. Task closeout

- Create `docs/reports/acceptance/SDD-004-ACCEPTANCE.md` in Chinese.
- Executor proposes but does not independently set final canonical maturity.
- Coordinator independently verifies, reviews scope/licensing and decides whether the Draft PR is ready for Owner UAT.
- M2 Owner UAT and a frozen ActionGrant SDD remain blockers for real external action work.
- The structured handoff must include worktree, branch, full commit SHA, push/PR state, changed files, exact tests, evidence, limits, rollback and next candidate step.
