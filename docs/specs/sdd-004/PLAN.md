# SDD-004 implementation plan

## Architecture

```text
public-safe fixture OR future unknown API snapshot
                ↓
        fail-closed adapter/policy
                ↓
       ActionCenterViewModel
                ↓
exact review · grant · execution · receipt · reconciliation components
                ↓
route preview + Storybook matrix + render/policy tests
```

The internal ViewModel is independent of React and any backend package. The component tree has no fetch, mutation, Token, platform SDK, or provider dependency. A future integration supplies a loader/handler outside this feature.

## Planned files

- `apps/web/src/features/action-center/action-center-types.ts`: stable UI states, modes, evidence, timeline, intents.
- `apps/web/src/features/action-center/action-center-policy.ts`: exhaustive policies and safe action availability.
- `apps/web/src/features/action-center/action-center-adapter.ts`: `unknown` transport normalization and fail-closed guards.
- `apps/web/src/features/action-center/action-center-fixtures.ts`: deterministic public-safe scenarios.
- `apps/web/src/features/action-center/action-center-copy.ts`: typed catalog projection.
- `apps/web/src/features/action-center/action-center.tsx`: accessible component skeleton.
- adjacent `.test.ts` / `.test.tsx`: policy, adapter, and render contracts.
- `apps/web/src/features/action-center/action-center.stories.tsx`: full matrix and narrow/English stories.
- `apps/web/messages/{zh-CN,en}.json`: exactly aligned `ActionCenter` namespace.
- `apps/web/src/components/product-shell.tsx`: honest read-only review-route foundation preview.
- `apps/web/src/app/globals.css`: only `--action-*` tokens and feature-scoped rules.
- SDD and Chinese acceptance evidence.

Exact paths may be consolidated if tests remain isolated and the adapter/component boundary stays explicit.

## Accessibility plan

- semantic `section`, `header`, `article`, `dl`, ordered timeline, headings, and one state `role=status`/`aria-live=polite`;
- explicit labels and descriptions for confirmation and controls;
- native checkbox/button/link semantics;
- visible `:focus-visible` outline through action tokens;
- DOM order equals keyboard and reading order;
- state code, title, marker text, and explanation accompany color;
- disabled reasons remain readable and associated with controls;
- responsive layout avoids horizontal document overflow and preserves evidence strings with wrapping.

## Visual plan

Use an evidence-first editorial operations console: paper-like surfaces, ledger rules, compact evidence typography, high-contrast signal markers, and restrained motion. Every new value is expressed through `--action-*` variables that alias current tokens. No final logo, platform artwork, illustration, motion system, or brand token is frozen.

## Test and convergence plan

1. Write policy/adapter negatives first.
2. Implement ViewModel and make all eight mappings exhaustive.
3. Add component/render contracts and Storybook stories.
4. Run scoped Vitest, message parity, Web typecheck/build, lint, Storybook static build/browser-safety, secret scan.
5. Run the broader relevant repository test suite if scoped gates pass.
6. Capture a public-safe route/Storybook screenshot when local runtime is practical; otherwise give exact static story paths.
7. Complete every AC row and Owner protocol in the acceptance report.

## Rollback

No data rollback exists. Revert the SDD-004 local commit or remove the route render to return to the accepted M2 Review Desk. Component, stories, messages, tests, and CSS are self-contained.
