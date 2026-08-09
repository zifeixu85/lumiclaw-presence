# SDD-004 requirements checklist

## Requirements and scope

- [x] Eight required states are named exactly.
- [x] Every state has explanation, unique next step, retry policy, maturity, and mode.
- [x] Exact review, Grant, execution, Receipt, and reconciliation components are specified.
- [x] Backend, connector, scheduler, database, signing, real action, and final visual design are excluded.
- [x] M3-07 canonical state remains unchanged.

## Safety and truth

- [x] UNKNOWN cannot blind retry.
- [x] Handoff without evidence cannot be PUBLISHED.
- [x] Dangerous intent requires exact-summary confirmation and an authorized handler.
- [x] Expired/revoked Grant is terminal.
- [x] Synthetic fixture maturity is distinct from live-action maturity.
- [x] Route preview is NOT_LIVE and has no mutation handler.

## Architecture and compatibility

- [x] UI ViewModel is independent of backend DTOs.
- [x] Adapter accepts unknown and fails closed.
- [x] PR #3 remains read-only reference with no imports or Git integration.
- [x] Existing M1/M2 review and no-action semantics remain.
- [x] No package/lockfile change is planned.

## i18n, time, privacy, and license

- [x] zh-CN default and en parity are binary acceptance gates.
- [x] State values remain stable codes, not translated labels.
- [x] UI locale, content language, market, and IANA time zone are separate.
- [x] Fixtures contain no secret, real account, customer, or private evidence.
- [x] Only existing Apache-2.0-compatible locked dependencies are used.

## Accessibility and visual replacement

- [x] Keyboard path, semantic regions, labels, focus, and non-color cues are specified.
- [x] Narrow-screen evidence wrapping is covered.
- [x] Temporary visuals use feature tokens.
- [x] Final tokens/assets remain design-thread input.

## Verification and evidence

- [x] Normal, business-rule failure, security/danger, dependency ambiguity, and rollback paths are testable.
- [x] Storybook covers every state.
- [x] Exact command/result reporting is required.
- [x] Chinese acceptance report and Owner protocol are required.
- [x] Machine evidence cannot claim Owner acceptance or M3 completion.

All specification checklist items are resolved. Implementation may begin after Analyze confirms consistency.
