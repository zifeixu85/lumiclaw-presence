# LumiClaw Presence 实现进度

[English](IMPLEMENTATION-STATUS.md) | [简体中文](IMPLEMENTATION-STATUS.zh-CN.md) | [技术架构](ARCHITECTURE.zh-CN.md) | [路线图](ROADMAP.zh-CN.md)

> **进度真源：** 本文件是中文镜像，规范状态以 `IMPLEMENTATION-STATUS.md` 为准；两份文件的 ID 与状态必须在同一次提交中同步。
> **快照日期：** 2026-08-03
> **当前阶段：** M1 — Campaign walking skeleton
> **当前实现真相：** M0 本地交付基础已经实现并验收，包括可复现 Monorepo、Docker Compose/PostgreSQL/BlobStore、默认中文的双语 Web Shell、隔离 AgentTeams Adapter Smoke 与质量门禁。M1 业务领域、真实 AgentTeams Mission、Provider、Connector 和外部动作仍未实现。

## 进度状态合同

每个模块只能使用一个状态：

- `NOT_STARTED`：尚未开始实现；
- `IN_PROGRESS`：已有边界明确的 SDD 和活动目标承接；
- `BLOCKED`：被明确依赖或 Owner 决策阻塞；
- `EVIDENCE_READY`：实现和机器验证已完成，但仍等待要求内的 Owner/用户验收；
- `ACCEPTED`：验收标准、测试、证据报告和必要的 Owner/用户验收全部完成；
- `DEFERRED`：已说明原因，主动移出当前里程碑；
- `SUPERSEDED`：已被可追踪的新模块或 SDD 替代。

总进度按 `ACCEPTED` 模块数除以活动模块数计算，只表示交付数量，不表示工作量。`EVIDENCE_READY` 不计入已验收。

## 当前总览

| 指标 | 当前值 |
|---|---|
| 已验收模块 | `7 / 39`（`17.9%`） |
| 证据已就绪 | `0 / 39` |
| 被阻塞 | `0 / 39` |
| 当前实现 SDD | `SDD-001 Campaign Walking Skeleton` — Coordinator 正在分配 |
| 最早 Owner 阻塞项 | 下一个本地 M1 切片无；Provider Credential 继续延后到各自 SDD |
| 下一个可执行模块 | `M1-01` Organization、Identity、Brand、Product、Market 与 Account Graph — `IN_PROGRESS` |

## 里程碑总进度

| 里程碑 | 状态 | 已验收 | 当前模块分布 | Exit Evidence |
|---|---|---:|---|---|
| M0 — Delivery foundation | `ACCEPTED` | `7 / 7` | 7 个已验收 | [SDD-000 验收报告](docs/reports/acceptance/SDD-000-ACCEPTANCE.md)，以及 Compose、Migration、CI 映射、隔离 AgentTeams Smoke、设计与 i18n 证据 |
| M1 — Campaign walking skeleton | `IN_PROGRESS` | `0 / 6` | 1 个进行中、5 个未开始 | 持久化 Campaign、四平台预览、排程编辑器、统一 Control Plane State |
| M2 — Governed shadow campaign | `NOT_STARTED` | `0 / 6` | 6 个未开始 | 六成员 AgentTeams、DeepSeek Gateway、Revision/Audit、故障拒绝与 Trace |
| M3 — Controlled live activation | `NOT_STARTED` | `0 / 7` | 7 个未开始 | 精确 Grant、持久化 Scheduler、Bluesky Direct、诚实 Handoff、Receipt/对账 |
| M4 — Response and learning | `NOT_STARTED` | `0 / 4` | 4 个未开始 | Interaction → Outcome → Scoped Learning → 下一 Mission，隔离 SignalProvider PoC |
| M5 — Runnable candidate | `NOT_STARTED` | `0 / 5` | 5 个未开始 | Fresh Install、恢复演练、Conformance、可访问性、Evidence Export 与 Demo |
| M6 — External calibration | `NOT_STARTED` | `0 / 4` | 4 个未开始 | 设计伙伴 Shadow、隔离、可靠性与外部验收报告 |

## 模块进度表

### M0 — Delivery foundation

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M0-01 | 产品、平台与技术架构文档 | `ACCEPTED` | 已完成 | [已验收架构基线报告](docs/reports/acceptance/M0-01-ARCHITECTURE-BASELINE-ACCEPTANCE.md) |
| M0-02 | 根 License 与贡献政策 | `ACCEPTED` | 已完成 | [已验收 Apache-2.0 与依赖政策报告](docs/reports/acceptance/M0-02-LICENSE-AND-DEPENDENCY-POLICY-ACCEPTANCE.md) |
| M0-03 | Node/TypeScript Monorepo 与锁定依赖基线 | `ACCEPTED` | SDD-000 | [可复现安装、Lockfile、版本与许可证证据](docs/reports/acceptance/SDD-000-ACCEPTANCE.md) |
| M0-04 | Docker Compose、PostgreSQL Migration 与 Local BlobStore | `ACCEPTED` | M0-03 | [Fresh、故障、恢复与持久化证据](docs/reports/acceptance/SDD-000-ACCEPTANCE.md) |
| M0-05 | Next.js Shell、`next-intl`、设计 Token 与五主屏 Route | `ACCEPTED` | M0-03 | [双语 Route、浏览器、Storybook 与已提交 Pencil 证据](docs/reports/acceptance/SDD-000-ACCEPTANCE.md)；移动端与统一视觉延期 |
| M0-06 | 隔离 AgentTeams Runtime Profile 与 Adapter Smoke | `ACCEPTED` | M0-04 | [锁定镜像与受控 Adapter 证据](docs/reports/acceptance/SDD-000-ACCEPTANCE.md)；不声明 Live Mission |
| M0-07 | CI、Secret Scan、SBOM 与进度/报告检查 | `ACCEPTED` | M0-03 | [本地完整门禁证据](docs/reports/acceptance/SDD-000-ACCEPTANCE.md)；不声明远端 CI |

### M1 — Campaign walking skeleton

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M1-01 | Organization、Identity、Brand、Product、Market 与 Account Graph | `IN_PROGRESS` | M0 验收；SDD-001 | Schema、Migration、租户约束与负向 Fixture |
| M1-02 | Campaign、Activation、Claim 与 Evidence 合同 | `NOT_STARTED` | M1-01 | 版本化 JSON Schema、Canonical Digest 与错误 Scope 拒绝 |
| M1-03 | Campaign API、持久化与重新打开 | `NOT_STARTED` | M1-01、M1-02 | REST/OpenAPI、幂等、ETag/版本冲突与数据库集成测试 |
| M1-04 | 五主屏 Web Shell 与 Readiness Journey | `NOT_STARTED` | M0-05、M1-03 | 中英文 Empty/Loading/Blocked/Owner/Recovery 状态 |
| M1-05 | 四平台可编辑 Composer 与原生近似 Preview | `NOT_STARTED` | M1-02、M1-04 | X、Bluesky、LinkedIn、小红书 Fixture、约束与视觉测试 |
| M1-06 | 排程编辑器与持久化 Schedule Model | `NOT_STARTED` | M1-03、M1-04 | 一次性/RRULE、IANA 时区、DST 与 Misfire 校验；不执行外部动作 |

### M2 — Governed shadow campaign

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M2-01 | AgentTeams Runtime Adapter 与 Shared Mission State | `NOT_STARTED` | M0-06、M1-02 | Project/Task 生命周期、ACK/Submit、Digest 导入与重启恢复 |
| M2-02 | 六成员 AgentTeam 与锁定 Skill | `NOT_STARTED` | M2-01 | Leader + 五领域成员、Context/权限分离与 SkillLock |
| M2-03 | DeepSeek ModelProvider Gateway | `NOT_STARTED` | M0-07 | 结构化输出、模型/费用快照、超时重试与隐私安全 Fixture |
| M2-04 | Artifact Revision、Independent Audit 与 Owner Review | `NOT_STARTED` | M1-05、M2-02 | Re-audit 失效、Producer/Auditor 分权与 Revision Diff E2E |
| M2-05 | Media Asset 与 EvoLink Adapter 边界 | `NOT_STARTED` | M0-04、M2-03 | 异步 Mock/Canary、内容寻址入库、权利/费用回执与不自动批准 |
| M2-06 | Trace、Ledger 与 Flight 故障拒绝 | `NOT_STARTED` | M2-02、M2-04 | Claim/Constraint 故障被阻断，并生成可重放、公开安全证据 |

### M3 — Controlled live activation

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M3-01 | 签名 ActionGrant、Transactional Outbox 与无 LLM Operator | `NOT_STARTED` | M2-04 | Replay/Expiry/Revocation/Digest 失败关闭；唯一 Attempt 约束 |
| M3-02 | 持久化 Scheduler 执行与 Occurrence 恢复 | `NOT_STARTED` | M1-06、M3-01 | 到期租约、重启恢复、DST/Misfire 测试且不存在永久 Grant |
| M3-03 | Bluesky 官方 Direct Connector | `NOT_STARTED` | M3-01 | 原生 URI/CID 读回、重复预防与 Unknown Reconciliation |
| M3-04 | LinkedIn Native Handoff | `NOT_STARTED` | M3-01 | 精确 Preview/Package、步骤与 URL 对账；绝不虚假 `PUBLISHED` |
| M3-05 | 小红书内容包 Handoff | `NOT_STARTED` | M1-05、M3-01 | 复制/下载发布包、原生完成与 URL/安全截图对账 |
| M3-06 | X 官方 Direct Canary 或显式降级 | `NOT_STARTED` | M3-01、Owner Credential | OAuth/Scope/预算/故障/读回 Gate，或诚实 Handoff 结果 |
| M3-07 | Receipt Timeline 与 Reconciliation UX | `NOT_STARTED` | M3-02–M3-06 | Published/Handoff/Failed/Unknown 状态、不盲目重试及 Owner 可读证据 |

### M4 — Response and learning

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M4-01 | Interaction 接入与规范化 | `NOT_STARTED` | M3-03 | 一条真实或受控真实 Interaction，Raw/Normalized 隐私分离 |
| M4-02 | Outcome 与 Disposition 决定 | `NOT_STARTED` | M4-01 | Owner 决定、不自动夸大 Lead、可审计状态转换 |
| M4-03 | LearningProposal、Scoped Memory 与下一 Mission 复用 | `NOT_STARTED` | M4-02 | 接受/拒绝/回滚、Scope 隔离与精确复用证据 |
| M4-04 | 隔离的第三方 SignalProvider PoC | `NOT_STARTED` | M0-07 | 一个具体 Provider 通过 Purpose/Terms/Quarantine/Schema/PII/Retention Gate |

### M5 — Runnable candidate

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M5-01 | Fresh Docker Install 与升级路径 | `NOT_STARTED` | M0–M4 | 新机器无需隐藏开发服务即可运行正常和失败关闭路径 |
| M5-02 | Backup、Restore 与 Unknown Action 恢复演练 | `NOT_STARTED` | M5-01 | 空库恢复、Blob Digest 验证且不自动重发 |
| M5-03 | 完整 UI 状态矩阵、i18n 与可访问性 | `NOT_STARTED` | M1–M4 | 中英文一致、视觉回归、键盘导航与 axe 检查 |
| M5-04 | Provider 与 Connector Conformance | `NOT_STARTED` | M3、M4-04 | Success/Failure/Timeout/Unknown/Duplicate/Capability 的公开安全 Fixture |
| M5-05 | Agent 消融、Evidence Export 与稳定 Hero Demo | `NOT_STARTED` | M5-01–M5-04 | 同条件比较、Allowlist Export 与可重复 Demo Runbook |

### M6 — External calibration

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M6-01 | 设计伙伴 Shadow Campaign | `NOT_STARTED` | M5 验收 | 伙伴用自己的 Goal/Material 完成定义内决策协议 |
| M6-02 | Tenant、Role 与数据隔离加固 | `NOT_STARTED` | M6-01 | 跨租户负向测试、Retention/Deletion 与委派 Review 边界 |
| M6-03 | 可靠性、可观测与成本加固 | `NOT_STARTED` | M5-04、M6-01 | SLO 基线、恢复证据、Provider/Model 成本与故障分布 |
| M6-04 | 外部验收与 Claim Report | `NOT_STARTED` | M6-01–M6-03 | 已签署/记录结果、允许 Claim、拒绝 Claim 与下一决策 |

## 强制任务流程

每个新里程碑或边界明确的 SDD 使用一个独立 Codex 任务，由项目主任务担任 Coordinator：

1. 修改代码前读取 `AGENTS.md`、本进度表、`ARCHITECTURE.zh-CN.md`、`ROADMAP.zh-CN.md` 与相关 SDD。
2. Coordinator 选择精确模块 ID、核验依赖、创建 Executor 任务并分配一个 Goal。
3. 派发前由 Coordinator 只把当前可执行模块在中英文进度表同步更新为 `IN_PROGRESS`。
4. 只实现 SDD 范围；改变范围的发现必须记录，不能静默扩张。
5. 运行验收矩阵，并从报告模板生成中文 `docs/reports/acceptance/SDD-NNN-ACCEPTANCE.md`。
6. 列出 Owner 可参与的验收项，包括前置条件、精确步骤、预期结果和需要返回的证据。
7. 机器验证完成但仍等待 Owner 验收时设为 `EVIDENCE_READY`；只有要求内验收全部记录后才能设为 `ACCEPTED`。
8. Executor 返回结构化 Status Handoff；Coordinator 独立复验、集成通过的交付，再更新中英文进度表、Evidence、Blocker 与下一模块。

不允许只在聊天中宣布任务完成，却让本进度表保持过期。
