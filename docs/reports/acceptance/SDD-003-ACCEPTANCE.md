# SDD-003 验收报告：PostgreSQL ActionGrant 受治理执行基础

> SDD：`docs/specs/SDD-003-POSTGRESQL-ACTION-GRANT-FOUNDATION.md`
> 进度模块：`M3-01`
> 起始提交：`749e0c7f87b162902da8529a9017804091b72c68`
> 工作分支：`backup/pre-sdd003-review-fixes`
> 报告状态：`DRAFT`
> 证据成熟度：`IMPLEMENTED`；最终 `ENGINEERING_VERIFIED` 待 Coordinator 独立复核
> 生成日期：`2026-08-12`

## 一、交付结果

当前候选工作树（分支 `backup/pre-sdd003-review-fixes`，SHA 待提交后记录）已对独立复审的四项技术阻断完成机器验证：Receipt predecessor 的存在性、组织/Campaign/Grant scope、单 successor 与状态矩阵由 migration `000020_receipt_predecessor_boundary` 和真实 API-role 42501 探针闭合；Memory/PostgreSQL expired-lease 的 pre/post-dispatch 终态一致；`npm run verify:m3-sdd003` 使用 PATH 中的跨平台 npm launcher 并进入 CI；四项 PostgreSQL 对抗测试由稳定 ID、原始 Vitest reporter 和 SHA-256 evidence binding 逐项证明。该结论为 ENGINEERING_VERIFIED 候选，不是 Owner acceptance、真实 Connector 或业务结果。

当前不声明 `EVIDENCE_READY`，不开放 Owner 验收。M3 与 M3-01 canonical 状态保持 `NOT_STARTED`，由 Coordinator 独立复核后决定转换。

## 二、交付范围

已包含：数据库复合约束与执行租约、Repository 状态机、无 LLM Operator 权威读取、真实 API/operator 角色 E2E、五项对抗性 PostgreSQL 测试、跨进程 tamper 断言、fresh-PG 与 GitHub Actions 门禁。

未包含：真实社交平台 Connector、真实凭据、客户 UAT、外部校准、业务结果，以及 M3-02 至 M3-07。

## 三、实现证据

| 范围 | 文件 / 对象 | Evidence |
|---|---|---|
| Domain / Database | `action-grant.ts`、migration 000019、migration 000020、Postgres/Memory Repository | lease token、dispatch boundary、复合 FK、权威 execution context、predecessor 边界与 42501 探针 |
| Operator | `outbox-consumer.ts` | tamper/digest/scope 校验失败时 connector 调用数为 0 |
| Repository parity | `memory-action-repository.ts`、Memory expired-lease contract tests | pre/post-dispatch 过期租约终态与 PostgreSQL 一致，绝不复归 PENDING |
| Security | migration 000019/000020、action-grant verifier | API successor Receipt 与 Operator initial Receipt 分权；合法 SQL 负向探针返回 42501 |
| CI / Evidence | `m3-sdd003.yml`、portable aggregate runner、fresh/aggregate verifier | 精确子项读取，任一 NOT_RUN/FAIL 均不能聚合 PASS；四个命名 PG 测试绑定 `postgres-repository-vitest.json`、`named-postgres-tests.json`、`aggregate.json` |

## 四、自动化验证

| 检查 | 命令 | 当前结果 |
|---|---|---|
| 全仓测试 | `npm.cmd test -- --run` | PASS：395 passed，25 skipped（无 DATABASE_URL 的 PG suite 跳过） |
| Typecheck | `npm.cmd run typecheck` | PASS：全 workspace |
| Lint | `npm.cmd run lint` | PASS：0 error；11 项既有 warning |
| 状态镜像 | `npm.cmd run check:status` | PASS：39 modules |
| Fresh PostgreSQL | `npm.cmd run verify:m3-fresh-postgres` | PASS：reporter 25 passed / 0 failed / 0 pending；三项真实 API-role 42501 predecessor 探针及 Handoff/Reconciliation 正向路径 PASS |
| SDD 聚合门禁 | `npm.cmd run verify:m3-sdd003` | PASS：domain、repositoryContract、typecheck、freshPostgres、evidenceIntegrity 五个步骤全部 PASS |

## 五、复审五项入口

| 项目 | 精确测试 / 断言 |
|---|---|
| post-claim revoke | `[M3_PG_POST_CLAIM_REVOKE] barrier-controlled PostgreSQL claim wins and fences concurrent revoke` |
| UNKNOWN 后迟到 completion fencing | `[M3_PG_LATE_COMPLETION_FENCING] UNKNOWN fences a late completion carrying the former execution lease` |
| 同组织跨 Campaign occurrence | `[M3_PG_CROSS_CAMPAIGN_SCOPE] same-organization cross-Campaign occurrence binding is rejected atomically` |
| pre-dispatch / UNKNOWN / reprocess | `[M3_PG_DISPATCH_STATE_MATRIX] enforces pre-dispatch definite failure UNKNOWN and reprocess state matrix` |
| Outbox Artifact tamper | `PostgreSQL Outbox Artifact tamper yields connectorCalls=0` |

## 六、Owner 参与验收

当前为 `PENDING`，且在 Coordinator 将模块推进到可验收状态前不得执行。届时 Owner 只读运行 `npm.cmd run verify:m3-sdd003`，确认退出码 0、五个精确字段均为 PASS、`externalActions=0`、`connectorMode=CONTROLLED_FAKE`，并返回 commit SHA、最终 JSON 与明确 PASS/FAIL。失败信号包括任一 NOT_RUN/FAIL、真实外部请求、UNKNOWN 被重发或 connectorCalls 非 0。清理仅限 verifier Compose project：`docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml down --volumes --remove-orphans`。

## 七、外部复核记录

复审结论为 `BLOCK / REVISE`，要求关闭本文第五节五项及角色、CI、证据聚合和 canonical 状态问题。本报告不虚构外部 PASS；Coordinator 独立复核仍为 `PENDING`。

## 八、限制与非声明

- `IMPLEMENTED`：本轮代码和测试路径。
- `ENGINEERING_VERIFIED`：Executor 机器门禁已通过；canonical claim 仍须 Coordinator 独立复核后决定。
- `NOT_CLAIMED`：真实平台发布、外部校准、客户 UAT、业务结果。
- npm 安装报告的既有高危依赖提示不由本 SDD 新增，仍需依赖治理流程处理。

## 九、回滚与恢复

停止 action-operator 并停止签发新 Grant；已迁移数据库采用 forward-fix。不得删除不可变 Receipt/Decision，也不得把 UNKNOWN 改回 PENDING。代码可回退到备份提交 `749e0c7f87b162902da8529a9017804091b72c68`，但数据库回退前必须先确认没有 migration 000019 后生成的执行记录。

## 十、执行任务状态交接

| Module ID | 当前 canonical 状态 | 建议新状态 | 原因 |
|---|---|---|---|
| M3-01 | `NOT_STARTED` | `NOT_STARTED` | Executor 不推进 canonical 状态；等待 Coordinator 独立复核 |

本报告生成时修复尚未提交；提交 SHA 与远端状态由最终交接记录提供。上述四项独立复审技术 blocker 已在当前候选工作树上取得机器验证证据；是否关闭 review blocker、是否集成以及任何 canonical 状态转换仍由 Coordinator 独立决定。Owner acceptance 仍未开放。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS`
- Coordinator 独立复验：`PENDING`
- Owner 验收：`NOT OPEN`
- 最终模块状态：`NOT_STARTED`（canonical 当前值）
- 下一模块：`PENDING COORDINATOR DECISION`
