# LumiClaw Presence 实现进度

[English](IMPLEMENTATION-STATUS.md) | [简体中文](IMPLEMENTATION-STATUS.zh-CN.md) | [技术架构](ARCHITECTURE.zh-CN.md) | [路线图](ROADMAP.zh-CN.md)

> **进度真源：** 本文件是中文镜像，规范状态以 `IMPLEMENTATION-STATUS.md` 为准；两份文件的 ID 与状态必须在同一次提交中同步。
> **快照日期：** 2026-08-22
> **当前阶段：** PR #5/#6/#7 收敛；M2 市场本地化与 M5 生产 UX 基础仍在进行中
> **当前实现真相：** M0 与 M1 已验收。M2-01～M2-06 已实现并完成工程验证，包括锁定版本的六成员 AgentTeams Shadow 路径；Owner UAT 仍待完成。`SDD-004` 提供非执行桌面手工发布包基础，证据已就绪。`SDD-005` 只增加 public-safe 的 US/JP/DE 市场上下文合同；`SDD-006` 增加具备 PostgreSQL/Blob 持久化与发布 fail-closed 的生产 UX/本地 Onboarding 候选。Integration Executor 已完成 SDD-004/005/006 组合机器验证；Coordinator 独立复验与 Owner UAT 仍待完成。这些切片都不授权客户数据能力声明、AgentTeams 常驻安装、ActionGrant、Connector、凭据、合规保证、外部平台动作或 `PUBLISHED`。不声明 EvoLink 真实验证、外部用户校准或业务结果。

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
| 已验收模块 | `13 / 42`（`31.0%`） |
| 证据已就绪 | `7 / 42` |
| 被阻塞 | `0 / 42` |
| 当前实现 SDD | `SDD-005` / `M2-07` 与 `SDD-006` / `M5-00` 为收敛候选；`SDD-004` / `M3-00` 已证据就绪 |
| 最早 Owner 阻塞项 | 在接受 M2 或启动任何受控外部动作前，记录 SDD-002 Owner UAT |
| 下一个可执行模块 | Coordinator 独立复验组合基线后记录 Owner UAT；全部真实动作模块继续受 Gate 约束 |

## 里程碑总进度

| 里程碑 | 状态 | 已验收 | 当前模块分布 | Exit Evidence |
|---|---|---:|---|---|
| M0 — Delivery foundation | `ACCEPTED` | `7 / 7` | 7 个已验收 | [SDD-000 验收报告](docs/reports/acceptance/SDD-000-ACCEPTANCE.md)，以及 Compose、Migration、CI 映射、隔离 AgentTeams Smoke、设计与 i18n 证据 |
| M1 — Campaign walking skeleton | `ACCEPTED` | `6 / 6` | 6 个已验收 | [SDD-001 验收报告](docs/reports/acceptance/SDD-001-ACCEPTANCE.md)：持久化 Campaign、四平台预览、排程编辑器、统一 Control Plane State；最终视觉与交互收敛仍在规划中 |
| M2 — Governed shadow campaign | `IN_PROGRESS` | `0 / 7` | 6 个证据已就绪；1 个市场本地化基础进行中 | 六成员 AgentTeams、DeepSeek Gateway/Canary、Revision/Audit、故障拒绝、Trace 与带来源市场上下文；Owner UAT 待完成 |
| M3 — Controlled live activation | `IN_PROGRESS` | `0 / 8` | 1 个非执行基础模块证据已就绪；7 个未开始 | 精确 Grant、持久化 Scheduler、Bluesky Direct、诚实 Handoff、Receipt/对账 |
| M4 — Response and learning | `NOT_STARTED` | `0 / 4` | 4 个未开始 | Interaction → Outcome → Scoped Learning → 下一 Mission，隔离 SignalProvider PoC |
| M5 — Runnable candidate | `IN_PROGRESS` | `0 / 6` | 1 个开发中、5 个未开始 | 本地 Onboarding/生产 UX 基础，然后完成 Fresh Install、恢复演练、Conformance、可访问性、Evidence Export 与 Demo |
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
| M1-01 | Organization、Identity、Brand、Product、Market 与 Account Graph | `ACCEPTED` | M0 验收；SDD-001 | [Schema、Migration、租户约束与负向 Fixture](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-02 | Campaign、Activation、Claim 与 Evidence 合同 | `ACCEPTED` | M1-01 | [版本化 Schema、Canonical Digest 与错误 Scope 拒绝](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-03 | Campaign API、持久化与重新打开 | `ACCEPTED` | M1-01、M1-02 | [REST/OpenAPI、幂等、ETag/版本冲突与数据库集成测试](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-04 | 五主屏 Web Shell 与 Readiness Journey | `ACCEPTED` | M0-05、M1-03 | [中英文真实状态流程与 Owner 接受的功能壳边界](docs/reports/acceptance/SDD-001-ACCEPTANCE.md)；`UX-M1-001` 延后到交互收敛 |
| M1-05 | 四平台可编辑 Composer 与原生近似 Preview | `ACCEPTED` | M1-02、M1-04 | [X、Bluesky、LinkedIn、小红书 Fixture、约束与真实浏览器证据](docs/reports/acceptance/SDD-001-ACCEPTANCE.md) |
| M1-06 | 排程编辑器与持久化 Schedule Model | `ACCEPTED` | M1-03、M1-04 | [一次性/RRULE、IANA 时区、DST/Misfire 与失效证据](docs/reports/acceptance/SDD-001-ACCEPTANCE.md)；不执行外部动作 |

### M2 — Governed shadow campaign

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M2-01 | AgentTeams Runtime Adapter 与 Shared Mission State | `EVIDENCE_READY` | M0-06、M1-02；SDD-002 | 真实 Project/Task 生命周期、ACK/Submit、Digest 导入、对账与重启证据已完成；Owner UAT 待完成 |
| M2-02 | 六成员 AgentTeam 与锁定 Skill | `EVIDENCE_READY` | M2-01 | 精确 Leader + 五领域成员、Context/权限分离与五个锁定 Skill 已验证 |
| M2-03 | DeepSeek ModelProvider Gateway | `EVIDENCE_READY` | M0-07 | 结构化输出、费用/config 快照、有界重试/Finish Reason、脱敏与本地真实 Canary 已验证 |
| M2-04 | Artifact Revision、Independent Audit 与 Owner Review | `EVIDENCE_READY` | M1-05、M2-02 | 不可变 Revision、初审 FAIL、修订、独立复审与精确不可执行 Review 已验证 |
| M2-05 | Media Asset 与 EvoLink Adapter 边界 | `EVIDENCE_READY` | M0-04、M2-03 | Content-addressed Ingest、权利/费用 Receipt 与不自动批准合同已验证；EvoLink 真实 Canary 待完成 |
| M2-06 | Trace、Ledger 与 Flight 故障拒绝 | `EVIDENCE_READY` | M2-02、M2-04 | 冻结 Claim 故障拒绝、Replay、不可变 Trace/Ledger 与零外部动作已验证 |
| M2-07 | 市场本地化知识包与作用域 Agent 上下文 | `EVIDENCE_READY` | M1-02、M2-02；SDD-005 | 带来源 US/JP/DE public-safe 市场包、Organization 覆盖 Fixture、确定性 Context/Digest、Producer/Auditor 投影与隔离证据；Owner UAT 待完成 |

### M3 — Controlled live activation

| ID | 模块 | 状态 | 依赖 | 必须提交的证据 / 验收 |
|---|---|---|---|---|
| M3-00 | 多平台激活能力与 Assisted Handoff 基础 | `EVIDENCE_READY` | M1-05、M2-04；SDD-004 | 六平台诚实 Registry、确定性桌面手工发布包、精确发布包 Digest、不虚假 `PUBLISHED`、零外部动作；Owner UAT 待完成 |
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
| M5-00 | Production UX 1.4 与本地 Onboarding 基础 | `EVIDENCE_READY` | M0-05、M1-03–M1-06、M2-02、M2-04；SDD-006 | 本地用户名进入、示例/真实资料 Onboarding、权威桌面工作区、诚实的 Runtime/账号/人工发布状态与可访问性已工程验证；Owner 视觉 UAT 待完成 |
| M5-01 | Fresh Docker Install 与升级路径 | `NOT_STARTED` | M0–M4 | 新机器无需隐藏开发服务即可运行正常和失败关闭路径 |
| M5-02 | Backup、Restore 与 Unknown Action 恢复演练 | `NOT_STARTED` | M5-01 | 空库恢复、Blob Digest 验证且不自动重发 |
| M5-03 | 完整 UI 状态矩阵、i18n 与可访问性 | `NOT_STARTED` | M1–M4 | 中英文一致、视觉回归、键盘导航与 axe 检查 |
| M5-04 | Provider 与 Connector Conformance | `NOT_STARTED` | M3、M4-04 | Success/Failure/Timeout/Unknown/Duplicate/Capability 的公开安全 Fixture |
| M5-05 | Agent 消融、Evidence Export 与稳定 Hero Demo | `NOT_STARTED` | M5-01–M5-04 | 同条件比较、Allowlist Export 与可重复 Demo Runbook |
| M5-06 | 分步人设、知识与账号档案 Onboarding | `IN_PROGRESS` | M5-00、M2-07；SDD-008 | 版本化创始人人设、企业/产品事实、X/小红书账号运营档案、多来源 MD/TXT/自由文字接入、显式冲突决定与已批准 KnowledgeSnapshot |
| M5-07 | 持久 Goal、Agent 生成计划与已选平台编译器 | `NOT_STARTED` | M5-06；SDD-009 | 持久 7/30 日 Goal、真实 Planner 草案与 Owner 批准，并只为已选 X/小红书账号确定性编译 Mission Bundle |
| M5-08 | 常驻本地 AgentTeams Runtime 与 Secret Broker | `NOT_STARTED` | M5-07、M5-09；SDD-007 | 固定版本六成员 Runtime、仅终端 Secret Broker、PostgreSQL Job/Lease、Dispatch、重启与恢复，且无隐藏 Mock 成功 |
| M5-09 | X/小红书产物、独立审校与人工 PublishPackage | `NOT_STARTED` | M5-07、M3-00；SDD-010 | 版本化 X 单帖/线程与小红书图文产物、独立审校、精确 OwnerDecision 失效及安全复制/下载/打开发布包 |
| M5-10 | 完整 Dogfood 安装、恢复与录屏门禁 | `NOT_STARTED` | M5-06–M5-09；SDD-011 | Fresh Install/升级/回滚、public-safe Owner Dogfood 正常与失败关闭闭环、重启恢复及可复现带讲解 Demo 证据 |

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
