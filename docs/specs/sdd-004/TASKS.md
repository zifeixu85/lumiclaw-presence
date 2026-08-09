# SDD-004 implementation tasks

| ID | Task | Depends on | Test / checkpoint |
|---|---|---|---|
| T01 | Freeze Constitution, main SDD, Clarifications, Plan, Checklist, Tasks, and Analyze as `SPEC_READY` | none | cross-artifact Analyze PASS |
| T02 | Define typed ViewModel, exhaustive state policy, unique actions, retry/mode/maturity rules | T01 | policy unit tests cover eight states |
| T03 | Implement `unknown` experimental adapter and conservative Handoff/UNKNOWN mapping | T02 | adapter negative tests and no PR #3 import |
| T04 | Add deterministic synthetic fixtures for all states | T02–T03 | secret/PII-safe fixture assertions |
| T05 | Add aligned `ActionCenter` zh-CN/en messages and typed copy projection | T02 | catalog parity and default-locale tests |
| T06 | Implement accessible exact-review, Grant, execution, Receipt, and reconciliation components | T02–T05 | render-contract tests |
| T07 | Add exact-summary dangerous-action confirmation gate and typed inert intents | T06 | confirmation/handler/terminal-state tests |
| T08 | Add replaceable feature tokens and responsive feature-scoped CSS | T06 | Web/Storybook build; narrow story review |
| T09 | Add route-level read-only NOT_LIVE preview | T04–T08 | no handler; no network mutation; route build |
| T10 | Add full Storybook state matrix, English, narrow, and a11y parameters | T04–T08 | static Storybook + browser-safety PASS |
| T11 | Run scoped and broader proportional verification; correct defects | T02–T10 | exact command/result log |
| T12 | Create Chinese acceptance report, Owner protocol, evidence paths, limitations, and rollback | T11 | report checker PASS |
| T13 | Review diff/status, commit locally, complete goal only after structured handoff is ready | T12 | clean worktree; no Push/PR/Deploy |

Tasks must run in order where dependencies exist. No task may edit canonical progress or the teammate branch.
