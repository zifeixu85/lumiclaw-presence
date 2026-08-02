# SDD-NNN — Title

> Status: `PROPOSED | SPEC_READY | IN_PROGRESS | EVIDENCE_READY | ACCEPTED | BLOCKED`  
> Milestone: `M0–M6`  
> Progress module IDs: `M?-??`
> Owner:  
> Goal objective / task reference:
> Target evidence maturity: `IMPLEMENTED | ENGINEERING_VERIFIED | EXTERNAL_CALIBRATED`  
> Acceptance report: `docs/reports/acceptance/SDD-NNN-ACCEPTANCE.md`
> Last updated: `YYYY-MM-DD`

## 1. User problem and outcome

- Who is the user or owner?
- What do they do today?
- What visible result will be different when this spec is complete?
- Why does this belong in the current milestone?

## 2. Current state

Reference verified files, routes, schemas, runtime behavior, and evidence. Separate implemented facts from planned behavior.

## 3. Scope

### In scope

-

### Out of scope

-

### Existing behavior that must not change

-

## 4. User journey and UI states

Describe the happy path, empty state, loading/running state, blocked state, owner-action state, failure state, unknown/reconciliation state, recovery path, and completion state.

## 5. Domain and API contracts

List affected objects, schemas, versions, state transitions, APIs/events, canonical digests, migrations, public/private fields, and compatibility rules.

Where relevant, define stable error/message codes, locale-independent persisted values, content language, target market, IANA time zone, recurrence, occurrence identity, DST and misfire semantics. Never persist translated labels as domain enums.

## 6. AgentTeams and Skills

- Team members and distinct responsibilities
- Task DAG and context passed between tasks
- Required Skill contracts and versions
- Tool access and permission boundaries
- Human gates and deterministic operator boundaries
- Shared-state and trace requirements

## 7. Dependencies and reuse decision

For every external component, record:

- classification: `BUILD | INTEGRATE | POC-GATED | LATER-REPLACE`;
- project and pinned version;
- license and source;
- invocation boundary;
- secrets and data boundary;
- replacement interface and migration cost.

## 8. Failure, recovery, and rollback

Cover invalid input, authorization failure, stale capability, agent/model timeout, partial task failure, connector timeout, unknown external state, restart recovery, duplicate prevention, revocation, and data rollback where applicable.

For scheduled work, also cover clock/time-zone interpretation, DST gaps and folds, downtime misfires, lease expiry, duplicate workers, edited schedules, revoked approval, and recovery without mass catch-up or blind external action.

## 9. Acceptance criteria

Use binary pass/fail statements. Include at least:

- one normal path;
- one business-rule failure;
- one permission or security failure;
- one external dependency failure;
- one recovery or rollback path;
- one user-visible verification;
- one machine-readable evidence artifact.

## 10. Test plan

- Schema/unit tests
- State-machine and policy integration tests
- AgentTeams runtime test
- Connector mock/sandbox test
- Web E2E test
- English/Chinese message parity and locale-routing test
- Schedule/DST/misfire/restart test, when applicable
- Dogfood or external protocol, when authorized
- Secret/privacy scan

## 11. Evidence and claims

List the Run Manifest, Evidence Summary, screenshots or video, trace/ledger, test commands, and the exact public claim that becomes valid. State what remains `PLANNED` or `NOT_CLAIMED`.

## 12. Delivery plan

Split work into child specs or issues of roughly half a day to three days. Show dependencies, parallel work, estimated effort, and the critical path.

Name the exact progress-register modules. The first implementation commit moves them to `IN_PROGRESS`; the final evidence commit moves them only to the state justified by the acceptance report.

## 13. Alternatives and decision log

Record alternatives considered, why they were rejected, and the evidence that would reopen the decision.

## 14. Owner-participated acceptance

For each check the owner can safely perform, specify:

- why owner verification is useful;
- prerequisites and test data;
- numbered steps;
- exact visible result;
- failure signs;
- evidence to return;
- cleanup or rollback.

If owner action is not useful or safe, state why and provide a read-only evidence-review protocol.

## 15. Task closeout

- Acceptance report path and status
- Progress modules and final states
- Remaining blockers and non-claims
- Next executable module / SDD
- Goal completion decision
