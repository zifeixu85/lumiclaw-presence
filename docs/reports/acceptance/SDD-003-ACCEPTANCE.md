# SDD-003 验收报告：PostgreSQL ActionGrant 受治理执行基础

> SDD：`docs/specs/SDD-003-POSTGRESQL-ACTION-GRANT-FOUNDATION.md`
> 进度模块：`M3-01`
> 起始提交：`749e0c7f87b162902da8529a9017804091b72c68`
> 工作分支：`backup/pre-sdd003-review-fixes`
> 报告状态：`DRAFT`
> 证据成熟度：`IMPLEMENTED`；最终 `ENGINEERING_VERIFIED` 待 Coordinator 独立复核
> 生成日期：`2026-08-12`

## 一、交付结果

本轮关闭复审指出的执行安全阻断：claim 与 revoke 在 PostgreSQL 事务中线性化；Operator 只从权威 OwnerDecision、ArtifactRevision、CapabilitySnapshot 读取执行材料并校验 digest；Occurrence 按 organization、campaign、occurrence 精确绑定；pre-dispatch definite failure 与 post-dispatch UNKNOWN 分流；completion 受 locked_by、attempt、lease token fencing；API 角色仅能追加合法 successor Receipt。

当前不声明 `EVIDENCE_READY`，不开放 Owner 验收。M3 与 M3-01 canonical 状态保持 `NOT_STARTED`，由 Coordinator 独立复核后决定转换。

## 二、交付范围

已包含：数据库复合约束与执行租约、Repository 状态机、无 LLM Operator 权威读取、真实 API/operator 角色 E2E、五项对抗性 PostgreSQL 测试、跨进程 tamper 断言、fresh-PG 与 GitHub Actions 门禁。

未包含：真实社交平台 Connector、真实凭据、客户 UAT、外部校准、业务结果，以及 M3-02 至 M3-07。

## 三、实现证据

| 范围 | 文件 / 对象 | Evidence |
|---|---|---|
| Domain / Database | `action-grant.ts`、migration 000019、Postgres/Memory Repository | lease token、dispatch boundary、复合 FK、权威 execution context |
| Operator | `outbox-consumer.ts` | tamper/digest/scope 校验失败时 connector 调用数为 0 |
| Security | migration 000019、action-grant verifier | API successor Receipt 与 Operator initial Receipt 分权；合法 SQL 负向探针返回 42501 |
| CI / Evidence | `m3-sdd003.yml`、fresh/aggregate verifier | 精确子项读取，任一 NOT_RUN/FAIL 均不能聚合 PASS |

## 四、自动化验证

| 检查 | 命令 | 当前结果 |
|---|---|---|
| 全仓测试 | `npm.cmd test -- --run` | PASS：378 passed，25 skipped（无 DATABASE_URL 的 PG suite 跳过） |
| Typecheck | `npm.cmd run typecheck` | PASS：全 workspace |
| Lint | `npm.cmd run lint` | PASS：0 error；既有 warning 另行记录 |
| 状态镜像 | `npm.cmd run check:status` | PASS：39 modules |
| Fresh PostgreSQL | `npm.cmd run verify:m3-fresh-postgres` | PASS：25/25 PostgreSQL tests；角色、跨进程及五项精确证据均 PASS |
| SDD 聚合门禁 | `npm.cmd run verify:m3-sdd003` | PASS：domain 32/32、repository contracts 43/43、typecheck、fresh-PG 及八个精确字段 |

## 五、复审五项入口

| 项目 | 精确测试 / 断言 |
|---|---|
| post-claim revoke | `barrier-controlled PostgreSQL claim wins and fences concurrent revoke` |
| UNKNOWN 后迟到 completion fencing | `UNKNOWN fences a late completion carrying the former execution lease` |
| 同组织跨 Campaign occurrence | `same-organization cross-Campaign occurrence binding is rejected atomically` |
| pre-dispatch / UNKNOWN / reprocess | `enforces pre-dispatch definite failure UNKNOWN and reprocess state matrix` |
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

工作树当前未提交、未推送；最终 commit SHA 需在提交后补充。当前无已知代码 blocker，仍等待 Coordinator 独立复核。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS`
- Coordinator 独立复验：`PENDING`
- Owner 验收：`NOT OPEN`
- 最终模块状态：`NOT_STARTED`（canonical 当前值）
- 下一模块：`PENDING COORDINATOR DECISION`
