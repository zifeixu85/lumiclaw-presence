# SDD-002 CR2 Fix 8 — Live ticket phase policy

Status: `SPEC_READY` after Coordinator evidence `COORDINATOR_FIX_REQUEST_8` on 2026-08-05.

## Verified current state

The ninth and tenth Coordinator Canaries on clean Head `be3f3af0143409df055e36e1d90fdade39c5fb23` independently reached the same correction-phase boundary. Both persisted five accepted DeepSeek `ModelCallSnapshot` records, four immutable revisions and four independent audit decisions, then stopped with `TASK_PROTOCOL / LIVE_TASK_PROTOCOL_FAILED / LIVE_TASK_ACK_IMPORT_FAILED` while the exact correction AgentTeams Task was `delegated / in_progress`. The receipts retained ActionGrant, Connector and external-action counts of zero, no Mock fallback and complete owned cleanup. The tenth receipt SHA-256 is `8ccd9aa8676c640b10052396543705c8392f47ac3a44c46a25bc6cab27120c98`; no Secret or raw Provider output is available or required.

Source inspection proves the deterministic policy gap. The Live Runner performs the real AgentTeams ACK first. Its next `IMPORT_ACK` step requests a scoped Control Plane `TASK_ACK` ticket. `liveTicketActionAllowed` permits `TASK_ACK` and `MODEL_GENERATE` only while the Mission is `RUNNING`, but accepted initial-audit materialization intentionally moves the Mission to `REVISION_REQUIRED` and assigns `PRODUCE_FOUNDER_CORRECTION`. The correction ACK therefore succeeds in AgentTeams and its Control Plane ticket request deterministically returns `LIVE_RUNTIME_ACTION_NOT_READY`. Accepted correction materialization then moves the Mission to `AUDIT_BLOCKED`, so `REAUDIT_CORRECTION` has the same blocked ACK/model policy.

This is a phase-policy defect, not an AgentTeams transient and not a reason to weaken Task bindings or fall back to Mock.

## Bounded correction

- Replace the coarse Mission-state condition with an explicit allowlist over Live ticket action, Task kind and Mission phase.
- Initial Task kinds may receive `TASK_ACK` and `MODEL_GENERATE` only in `RUNNING`; `PRODUCE_FOUNDER_CORRECTION` may receive them only in `REVISION_REQUIRED`; `REAUDIT_CORRECTION` may receive them only in `AUDIT_BLOCKED`.
- Preserve the existing Task-state split: `TASK_ACK` requires exact `ASSIGNED`, and `MODEL_GENERATE` requires exact `ACKNOWLEDGED` plus a non-Leader role.
- Preserve exact Mission/Campaign/runtime identity, Task/role/attempt/input projection binding and single-use/expiry behavior in `LiveRuntimeTicketStore`. No Task may borrow a later phase, action or Task kind.
- Keep `TASK_SUBMIT` phase-aware as already implemented and keep `PROJECT_DISPATCH`, `FINALIZE` and `FAIL` boundaries unchanged.
- The existing public-safe `LIVE_RUNTIME_ACTION_NOT_READY` is sufficient for ticket-policy denial. Do not expose ticket bytes, raw response bodies or arbitrary exception text.

## Binary acceptance additions

1. A baseline-compatible production API test reaches exact `PRODUCE_FOUNDER_CORRECTION / ASSIGNED / REVISION_REQUIRED` and proves old `TASK_ACK` ticket issuance returns `409 LIVE_RUNTIME_ACTION_NOT_READY` after five accepted model receipts and four persisted revisions/audits.
2. A production API test reaches exact `REAUDIT_CORRECTION / ASSIGNED / AUDIT_BLOCKED` and proves the same old `TASK_ACK` policy denial after accepted correction materialization.
3. After the fix, correction `TASK_ACK` and `MODEL_GENERATE` tickets work only in `REVISION_REQUIRED`; re-audit `TASK_ACK` and `MODEL_GENERATE` tickets work only in `AUDIT_BLOCKED`.
4. All six initial domain Task kinds remain `RUNNING`-only for `TASK_ACK`; all five initial model-calling Task kinds remain `RUNNING`-only for `MODEL_GENERATE`. Leader `MODEL_GENERATE` remains forbidden in every phase.
5. Wrong action, wrong Task kind, wrong phase, wrong role/attempt/input digest, stale/consumed ticket and replayed transition fail closed without overbroad authorization or raw disclosure.
6. The public-safe production API flow completes correction and independent re-audit through exact ACK/model/Submit materialization, records seven accepted model snapshots and five revisions/audits, and reaches `AWAITING_OWNER_REVIEW` with all action counts zero.
7. Focused/full tests, Provider/Live conformance, PostgreSQL, public-safe real AgentTeams six/eight, no-Secret Live, browser/Compose/build/security/evidence and clean-Head source package pass.
8. The eleventh real-key Canary remains Coordinator-owned. `LIVE_PROVIDER_VERIFIED` and `ACCEPTED` remain false until that independent run passes.

## Out of scope

Owner Secret, raw Provider/model/prompt/header/ticket/bootstrap access, AgentTeams Manager/Worker/Matrix changes, long-lived authorization, Mock fallback, platform actions, M3, Push/PR/Deploy and canonical status edits remain prohibited.
