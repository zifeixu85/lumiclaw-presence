# SDD-004 Clarifications

| Question | Resolution | Source / reason |
|---|---|---|
| Does preparatory work start M3-07? | No. The spec references M3-07 but makes no canonical progress transition. | Coordinator authorization and unmet M3-02–M3-06 dependencies. |
| Is PR #3 a frozen API contract? | No. It is inspected read-only and treated as untrusted proposed input. | Its own freeze document records unresolved Grant, Handoff, reconciliation, retry, and SSE questions. |
| What contract is stable in this SDD? | Only the UI-owned `ActionCenterViewModel`, state policy, and UI intent vocabulary. | Keeps backend and visual replacement costs bounded. |
| What does `PUBLISHED` mean? | Native Direct evidence exists, or Handoff has returned evidence that a future frozen policy accepts. Handoff preparation alone never qualifies. | Product truth and M3 exit rules. |
| Can `UNKNOWN` retry? | No. It can only reconcile the original attempt. | Duplicate prevention / fail-closed architecture. |
| Can `FAILED` retry? | Only by requesting a newly reviewed controlled attempt; never replaying the old Grant. | Distinguishes definitive failure from ambiguous outcome. |
| How are claim maturity labels used in stories? | Stories label the UI behavior `IMPLEMENTED`; a global boundary states that external execution is `PLANNED / NOT_CLAIMED`. | Avoids treating a synthetic state fixture as an external result. |
| Which execution modes exist in UI? | `DIRECT`, `HANDOFF`, and `PREPARE_ONLY`; transport-specific names are normalized by the adapter. | Stable user semantics independent of providers. |
| Does a UI action call the API? | No. Components emit typed UI intents; route integration has no mutation handler. Storybook may use inert callbacks. | No M3 backend authority is granted. |
| How are locales handled? | State codes remain stable; `zh-CN` is default; `en` keys match exactly. UI locale is not content language, market, or schedule time zone. | Existing i18n architecture. |
| Is final visual design part of acceptance? | No. Acceptance covers hierarchy, readability, accessibility, and replaceable tokens. | Independent design thread owns the freeze. |
| Are screenshots allowed? | Only newly generated screenshots of public-safe committed fixtures. No internal/customer/platform-account screenshot. | Privacy and evidence rules. |
| Is Owner UAT required to complete the Executor goal? | The Executor supplies a precise protocol; Owner result may remain `PENDING`. Coordinator decides acceptance. | Executor cannot fabricate Owner participation. |

No unresolved question changes product direction, permissions, backend semantics, or external state. The SDD can enter `SPEC_READY`.
