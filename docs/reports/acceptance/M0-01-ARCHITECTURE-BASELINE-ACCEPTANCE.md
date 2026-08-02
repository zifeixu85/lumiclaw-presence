# M0-01 Acceptance Report — Architecture and Delivery Baseline

> SDD: Pre-SDD documentation baseline; successor is `SDD-000 Delivery Foundation`
> Progress module IDs: `M0-01`
> Goal objective: Freeze the technical, i18n, scheduling, progress, SDD, and acceptance baseline before implementation
> Commit / build identity: the Git commit that first adds this report
> Report status: `EVIDENCE_READY`
> Evidence maturity: `IMPLEMENTED` documentation; product runtime remains `PLANNED`
> Generated: `2026-08-03`

## 1. Delivered outcome

A contributor can now determine the selected product architecture, bilingual UI contract, persistent scheduling model, milestone/module sequence, mandatory SDD workflow, and acceptance rules from the public repository. No product service or dependency is claimed as implemented.

## 2. Scope delivered

### Included

- English and Chinese README, architecture, roadmap, and implementation status;
- Next.js 16 plus planned `next-intl` English/Chinese UI contract;
- PostgreSQL-backed schedule/occurrence design and explicit cron decision;
- 39-module M0–M6 progress register with evidence and blockers;
- SDD and acceptance-report templates;
- mandatory per-task goal, status, evidence, and owner-acceptance protocol.

### Excluded or deferred

- package installation, source code, database migrations, Docker services, or runtime tests;
- root license decision;
- `SDD-000` and all implementation modules;
- platform credentials or live external actions.

## 3. Implementation evidence

| Area | Files / objects | Evidence |
|---|---|---|
| Product / navigation | `README.md`, `README.zh-CN.md` | Both languages link architecture, roadmap, and progress truth |
| Architecture | `ARCHITECTURE.md`, `ARCHITECTURE.zh-CN.md` | Service, provider, i18n, schedule, grant, and milestone boundaries |
| Delivery | `ROADMAP.md`, `ROADMAP.zh-CN.md` | M0–M6 vertical delivery order |
| Progress | `IMPLEMENTATION-STATUS.md`, Chinese mirror | 39 matching IDs and states |
| SDD / acceptance | `docs/specs/SPEC-TEMPLATE.md`, report template | Binary acceptance, owner UAT, failure and rollback requirements |
| Agent rules | `AGENTS.md` | Mandatory task-start and closeout contract |

## 4. Automated verification

| Check | Command or protocol | Expected | Actual | Result |
|---|---|---|---|---|
| Progress parity | Parse both status tables and compare IDs/states | 39/39 IDs; no mismatch | 39/39; no mismatch | `PASS` |
| Markdown links | Resolve repository-relative Markdown links | No missing target | No missing target | `PASS` |
| Patch hygiene | `git diff --check` plus trailing-space scan for new files | No new whitespace error | No error | `PASS` |
| Secret/privacy | Review changed public Markdown for credential-shaped content and private raw data | No credential or private payload | None found | `PASS` |
| Runtime / E2E | Not applicable to a documentation-only baseline | Explicitly not claimed | Not run | `N/A` |

## 5. Acceptance criteria result

| Criterion ID | Result | Evidence | Notes |
|---|---|---|---|
| AC-01 | `PASS` | Bilingual README/Architecture/Roadmap | Current stack and product boundary are navigable |
| AC-02 | `PASS` | Architecture i18n section | `en`, `zh-CN`, content language, market, and time zone are separated |
| AC-03 | `PASS` | Architecture scheduling section | PostgreSQL occurrence model replaces ephemeral cron truth |
| AC-04 | `PASS` | Bilingual progress register | 39 module IDs/states match |
| AC-05 | `PASS` | AGENTS, SDD and report templates | Goal, SDD, evidence, owner acceptance, and closeout are mandatory |
| AC-06 | `PENDING_OWNER` | UAT-01 below | Owner confirms the baseline is suitable for implementation |

## 6. Owner-participated acceptance

### UAT-01 — Approve the implementation baseline

- **Why the owner should verify this:** These decisions constrain every following implementation task and define what may be called complete.
- **Prerequisites:** Open the repository locally or on GitHub; no API key or Docker service is required.
- **Safety/data note:** This is read-only review and performs no external action.
- **Steps:**
  1. Open `IMPLEMENTATION-STATUS.zh-CN.md` and confirm the M0–M6 sequence and next task `SDD-000`.
  2. Open `ARCHITECTURE.zh-CN.md`; review “国际化与时间语义” and “持久化排程，而不是临时 Cron.”
  3. Confirm that UI language is independent from content language/market/time zone.
  4. Confirm that M1 creates schedules without publishing and M3 adds governed scheduled execution.
  5. Open `AGENTS.md`; confirm each SDD uses a separate task/goal, updates the progress register, creates an acceptance report, and gives you exact UAT steps.
  6. Record either `ACCEPTED` or the exact section and requested change.
- **Expected visible result:** The four documents agree on the stack, sequencing, schedule safety, bilingual scope, and acceptance workflow.
- **Failure signs:** Conflicting module states, a promise that code already exists, an ephemeral cron path, or no way for the owner to verify a phase.
- **Evidence to return:** A written `M0-01 ACCEPTED` decision, or a list of requested changes.
- **Cleanup / rollback:** None; review is read-only. Rejection keeps `M0-01` at `EVIDENCE_READY` or moves it to `BLOCKED` with reason.
- **Owner result:** `PENDING`

## 7. Failures, limitations and non-claims

- Known blocker: root license remains an owner decision (`M0-02`).
- Accepted limitation: the schedule design is unimplemented and unbenchmarked.
- `next-intl`, PostgreSQL schema, Docker processes, AgentTeams, providers, and connectors remain `PLANNED`.
- No customer UAT, business outcome, live post, or production readiness is claimed.

## 8. Rollback and recovery

The baseline is documentation-only and recoverable through Git revert. Any architecture change must update the decision log, both language documents, the progress register, and affected SDD acceptance criteria in the same change.

## 9. Progress register update

| Module ID | Previous state | New state | Reason / evidence |
|---|---|---|---|
| M0-01 | `NOT_STARTED` | `EVIDENCE_READY` | Bilingual architecture, roadmap, status, rules, templates, and machine checks are ready; owner acceptance remains |

## 10. Acceptance decision

- Automated acceptance: `PASS`
- Owner acceptance required: `YES`
- Owner decision: `PENDING`
- Final module state: `EVIDENCE_READY`
- Next module / SDD: `SDD-000 Delivery Foundation`; `M0-03` is the first executable implementation module after `SPEC_READY`
