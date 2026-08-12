# SDD-003 — PostgreSQL ActionGrant Governed Execution Foundation

> Status: `SPEC_READY`
> Milestone: `M3`
> Progress module IDs: `M3-01`
> Owner: LumiClaw Presence Owner
> Goal objective: engineering-verify the governed PostgreSQL ActionGrant foundation
> Target evidence maturity: `ENGINEERING_VERIFIED`
> Acceptance report: `docs/reports/acceptance/SDD-003-ACCEPTANCE.md`
> Last updated: `2026-08-12`

## 1. User problem and outcome

The Owner needs a deterministic boundary between an exact approval and an external action. The current branch has a partial M3 ActionGrant path, but fresh-PostgreSQL, authoritative-scope, concurrency, crash-recovery, restart, and isolation evidence is incomplete. Completion provides a production-shaped API/Operator/PostgreSQL path exercised only with a controlled fake connector and zero real external actions.

## 2. Current state

- M0 and M1 are `ACCEPTED`; M2 is `EVIDENCE_READY` pending Owner UAT.
- ActionGrant domain types, API routes, repositories, operator, receipts, handoff, reconciliation, and partial verification exist.
- Existing evidence does not prove a fresh PostgreSQL or cross-process governed execution chain.
- Live platform execution remains `NOT_CLAIMED`.

## 3. Scope

### In scope

- Immutable exact OwnerDecision; signed, short-lived, single-use ActionGrant.
- Atomic Decision + Grant + Outbox + idempotency persistence.
- PostgreSQL-authoritative Decision, CapabilitySnapshot, ArtifactRevision, ScheduleOccurrence, account, and Campaign scope.
- Separate no-LLM operator using a controlled fake connector.
- Deterministic revoke/claim semantics; UNKNOWN with no blind retry.
- Append-only Receipt, Handoff and Reconciliation successors.
- Organization/Campaign isolation; stable signer; API/Operator restart; cross-process SSE.
- Repeatable fresh PostgreSQL verification.

### Out of scope

- Real Bluesky publishing (`M3-03`), real LinkedIn/Xiaohongshu handoff (`M3-04`, `M3-05`), X Canary (`M3-06`).
- Persistent scheduler loop (`M3-02`) and final Receipt UI (`M3-07`).
- `BUSINESS_VERIFIED`, `EXTERNAL_CALIBRATED`, or any real external-action claim.

### Existing behavior that must not change

- PostgreSQL is authoritative; agents never hold social write credentials.
- M2 Owner Review remains non-executable; governance history remains append-only.

## 4. User journey and UI states

Exact audited revision and occurrence → exact OwnerDecision → signed ActionGrant → atomic Outbox → operator claim → controlled connector → append-only Receipt.

| Backend state | Owner-visible meaning |
|---|---|
| `ISSUED/PENDING` | Authorized, not started; revocation guarantees zero dispatch. |
| `EXECUTING/PROCESSING` | Execution started; revocation cannot promise zero side effects. |
| `CONSUMED/COMPLETED` | Terminal Receipt persisted. |
| `REVOKED/CANCELLED` | Revoked before claim; connector calls = 0. |
| `EXPIRED` | Expired before claim; cannot execute. |
| `UNKNOWN` | Neither success nor failure is proven; reconciliation required and resend forbidden. |

This SDD exposes API codes and evidence output, not a final UI.

## 5. Domain and API contracts

OwnerDecision is immutable and binds organization, campaign, occurrence, revision ID/digest, audit ID/digest, activation unit, channel account, platform, execution mode, capability ID/digest, actor, and time. Editing any bound input requires a new Decision; the old row is retained.

| From | Operation | To | Rule |
|---|---|---|---|
| `ISSUED` | revoke wins lock | `REVOKED` | Outbox cancelled; zero dispatch |
| `ISSUED` | expiry before claim | `EXPIRED` | terminal, zero dispatch |
| `ISSUED` | claim wins lock | `EXECUTING` | Outbox processing |
| `EXECUTING` | definite result | `CONSUMED` | append Receipt |
| `EXECUTING` | ambiguous result/lease expiry | non-replayable | append UNKNOWN |
| `EXECUTING` | revoke | rejected | `ACTION_ALREADY_EXECUTING` |

Outbox failures before dispatch are definite and never UNKNOWN. Once dispatch may have begun, ambiguity produces UNKNOWN and never returns to PENDING. Memory and PostgreSQL repositories must use the same safety semantics.

Receipt rules: initial rows have no predecessor; HANDOFF_PENDING and UNKNOWN may each receive exactly one valid successor; UPDATE/DELETE and multiple successors are rejected; no Grant may have conflicting successful outcomes.

## 6. AgentTeams and Skills

AgentTeams is not part of execution. The six-member M2 team cannot issue Grants. The deterministic operator is not an AgentTeams member, has no LLM, and receives only exact execution scope. Human Owner approval remains mandatory.

## 7. Dependencies and reuse decision

| Component | Decision | Boundary |
|---|---|---|
| PostgreSQL 17 | `INTEGRATE` | authoritative state and locks |
| Existing `pg`/Kysely baseline | `INTEGRATE` | repository boundary |
| Node crypto Ed25519 | `BUILD` on platform primitive | signing and verification |
| Controlled fake connector | `BUILD` | deterministic tests; no network action |

No new third-party dependency is introduced.

## 8. Failure, recovery, and rollback

- Invalid signature, digest, Decision, Capability, Revision, Occurrence, account, platform, mode, expiry, or tenant scope fails closed before dispatch.
- Claim and revoke serialize on the Grant row. Revoke wins before claim or returns `ACTION_ALREADY_EXECUTING`.
- Stale PROCESSING becomes UNKNOWN and never PENDING.
- Crash before dispatch is definite non-execution; crash after dispatch begins is UNKNOWN.
- Reconciliation appends a successor and never reactivates a Grant.
- Rollback stops the operator and new issuance while retaining all governed history; migrations are forward-fixed rather than deleting evidence.

## 9. Acceptance criteria

- **AC-01:** Fresh PostgreSQL applies all migrations and passes all M3 PG tests.
- **AC-02:** Decision, Grant, Outbox, and idempotency are atomic; injected failure leaves no partial rows.
- **AC-03:** Operator validates authoritative PostgreSQL scope; tampered Outbox snapshots cannot authorize dispatch.
- **AC-04:** Same-key concurrent issuance creates one business set; different keys create unique Decision, Grant, Outbox IDs and digests.
- **AC-05:** Pre-claim revoke yields zero calls; post-claim revoke returns `ACTION_ALREADY_EXECUTING`; dispatch is at most once.
- **AC-06:** Ambiguous dispatch/expired lease yields UNKNOWN and restart does not resend.
- **AC-07:** Memory and PostgreSQL repository contracts agree on safety semantics.
- **AC-08:** Receipt UPDATE/DELETE fail and concurrent successor creation has one winner.
- **AC-09:** Organization/Campaign isolation covers Grant/Receipt reads, revoke, handoff, reconciliation, SSE subscription and delivery.
- **AC-10:** API A issues through PG, independent operator consumes, restarted API B reads the same evidence, and SSE stays in scope.
- **AC-11:** Missing/mismatched signer and insufficient database roles fail closed.
- **AC-12:** Machine evidence reports `externalActions: 0` and `connectorMode: CONTROLLED_FAKE`.
- **AC-13:** The Chinese report records commands, results, evidence, limits, rollback, and Owner checks.

## 10. Test plan

- Domain state/signature/scope/capability/URL tests.
- Shared Memory/PostgreSQL repository contract tests.
- Empty-database migrations, triggers, constraints, and repeat fresh run.
- Barrier-controlled issuance and revoke/claim races.
- Fault injection before dispatch, after connector acceptance, before/after Receipt commit.
- PostgreSQL + API A + operator + API B/restart + SSE + controlled fake connector.
- Database-role, immutable-history, and secret-scan tests.

## 11. Evidence and claims

Passing permits `IMPLEMENTED` and `ENGINEERING_VERIFIED` only for the controlled fake connector PostgreSQL foundation. Real publishing/handoff, customer UAT, external calibration, and business outcomes remain `NOT_CLAIMED`.

The aggregate JSON reports database freshness, migrations, domain, repository contract, concurrency, revocation race, crash recovery, cross-process restart, scope isolation, append-only, SSE, external action count, and connector mode.

## 12. Delivery plan

1. Freeze contracts and progress state.
2. Harden schema and authoritative reads.
3. Align repository semantics.
4. Add concurrency and fault tests.
5. Add fresh-PG and cross-process verification.
6. Run gates and produce the Chinese report.

Only M3-01 is active; M3-02 through M3-07 remain `NOT_STARTED`.

## 13. Alternatives and decision log

- Outbox JSON is transport data and cannot be authoritative.
- Ambiguous PROCESSING must not reset to PENDING.
- Post-claim revoke cannot truthfully promise zero side effects.
- No Redis/second queue is added before measured need.

## 14. Owner-participated acceptance

Owner acceptance is read-only evidence review because connectors are controlled fakes:

1. Run the aggregate verifier using the report prerequisites.
2. Confirm `PASS`, `database: fresh`, `externalActions: 0`, and `connectorMode: CONTROLLED_FAKE`.
3. Review revoke-before/after-claim, UNKNOWN/reconciliation, isolation, restart, and immutable-history evidence.
4. Return the transcript and explicit PASS/FAIL.

Failure signs include real network action, UNKNOWN resend, cross-scope visibility, mutable history, or missing evidence. Cleanup removes only verifier-owned containers and temporary test data.

## 15. Task closeout

- Report: `docs/reports/acceptance/SDD-003-ACCEPTANCE.md`.
- Final proposal is `EVIDENCE_READY` only after automated evidence passes; `ACCEPTED` requires Owner acceptance.
- M3-02 through M3-07 and all real external actions remain non-claims.
