# Dogfood Content Operations Closed Loop Epic｜可自用内容运营闭环总计划

> 状态：`SPEC_READY`
> 日期：2026-08-22
> Owner：LumiClaw Presence 产品/设计 Owner
> 用户结果：本地知识/人设 → 持续目标与计划 → 真实六成员 AgentTeams → X/小红书内容 → 独立审校 → 人工发布助手
> 实现成熟度：本文仅冻结规格；全部新增能力仍为 `PLANNED`
> 进度纪律：本 docs-only Epic 不修改 `IMPLEMENTATION-STATUS.md` 或中文镜像，不授权任何模块进入 `IN_PROGRESS`

## 一、Epic Contract

### 1. 用户与问题

第一用户是本地安装 LumiClaw Presence 的 Owner。现在仓库已经有可运行页面、持久化 Campaign 骨架、真实六成员 AgentTeams 工程证据和若干发布/本地化基础，但这些能力位于不同分支和证据路径中，尚未形成可自用闭环：本地资料不能成为 Agent 权威上下文，平台选择不能驱动编译，生产 `mission-worker` 不会持续调度真实 AgentTeams，最终内容也没有从独立审校、用户修改和精确批准连续进入 X/小红书人工发布包。

本 Epic 交付后，Owner 能在一套本地 Web 产品和同一 PostgreSQL Control Plane 中完成：

```text
本地显示名称
→ 分步建立创始人人设、企业/产品知识、X/小红书账号运营档案
→ 导入多份 MD/TXT 与自由文字
→ 审阅并批准 Authoritative KnowledgeSnapshot
→ 建立 7 日或 30 日持续目标
→ 只为已选 X/小红书账号编译计划与 MissionExecutionBundle
→ 常驻 mission-worker 驱动固定版本六成员 AgentTeams
→ 生成内容计划和本次 X / 小红书完整产物
→ Independent Auditor 独立 PASS / FAIL / ESCALATE
→ Owner 修改、要求重生成或批准精确 Revision
→ 复制/下载精确 PublishPackage 并打开官方发布页
→ 外部发布结果保持未确认，不因自报完成变成 PUBLISHED
→ 重启后恢复同一 Goal、Mission、Revision、Audit、Decision、Package 与 Trace
```

### 2. Epic 完成定义

只有以下条件全部满足，才可称“可自用内容运营闭环”达到 `ENGINEERING_VERIFIED`；Owner Dogfood UAT 通过前最多是 `EVIDENCE_READY`：

- 本地安装无远端注册，首次只要求显示名称；
- Onboarding 是分步流程，个人/创始人人设、企业/产品知识、X 与小红书账号档案、Market、Content Locale、IANA Time Zone、持续目标和时间窗口均有独立权威字段；
- 支持多份 UTF-8 `.md` / `.txt` 和自由文字；`.pdf` / `.docx` / 语音均明确 `PLANNED`；
- `AuthoritativeKnowledgeSnapshot` 由用户确认后冻结，保存来源、版本、冲突、缺口与 digest；Agent 不能静默改写；
- 一个持久 `OperatingGoal` 能生成 7 日或 30 日 `ContentPlanRevision` 及本次内容；
- 平台选择只编译启用的 X/小红书账号，不再生成 Bluesky/LinkedIn 等无关必选单元；
- 固定版本六成员 AgentTeams 通过常驻产品 Runtime 真实运行，Leader 只编排，Producer 与 Auditor 分离；
- Agent 输入来自已批准 KnowledgeSnapshot、Goal、AccountOperatingProfile 和确定性编译结果，不是内置文案 fixture；
- X 产物是单帖或 Thread 包；小红书产物包含标题、正文、话题与有顺序的配图规格；
- Owner 能查看完整正文、来源绑定、版本差异、Audit 和渐进展开 Trace，能修改、重生成、批准或驳回；
- 任何编辑或重生成都会生成新 Revision，并使旧 Audit、OwnerDecision 和 PublishPackage 失效；
- 当前发布只有复制、下载、打开 allowlisted 官方页；不自动上传、点击、发布，不接收“我已发布”作为 `PUBLISHED` 证据；
- PostgreSQL 是唯一业务真源；浏览器、AgentTeams 内部状态和生成文件均不是第二真源；
- API、数据库、mission-worker 或 AgentTeams 重启后能恢复，不重复任务、不丢失已接受输出、不盲目生成第二份内容；
- Provider Secret 只经终端隐藏输入和 Secret Broker/Compose Secret 注入，不进入浏览器 API、Git、日志、Prompt、Trace 或公开 Evidence；
- public-safe A梦 fixture 能在 fresh install 上完成一次真实 AgentTeams E2E、一次 fail-closed 路径和一段可公开录屏。

### 3. 明确不在本 Epic 内

- X 或小红书自动发布、OAuth 写入、Cookie 导入、逆向接口、浏览器自动化上传/点击；
- 把打开官方页、复制内容或 Owner 自报完成记录为 `PUBLISHED`；
- Bluesky、LinkedIn、Instagram、Threads 的本轮业务产物；其历史合同保持兼容，但不会被本轮平台选择强制编译；
- PDF/DOCX/音频解析、向量数据库、通用 RAG、自动网页抓取；
- 完整社媒 Inbox、自动回复、自动私信、Lead、CRM、增长或营收证明；
- 通用 Agent 平台、重建 AgentTeams Manager/Worker/Matrix 或把 SDD-007 变成产品语义总包；
- 外部用户校准、生产就绪、法律/文化合规保证。

## 二、单一真源与数据所有权

### 1. 权威写入关系

| 数据 | 唯一权威位置 | 可派生/缓存位置 | 禁止的第二真源 |
|---|---|---|---|
| 原始资料 | BlobStore content digest + PostgreSQL `source_document_revisions` | 提取文本缓存 | 浏览器 localStorage、AgentTeams workspace |
| 人设/企业/产品/账号输入 | PostgreSQL versioned profile tables | Onboarding Draft View | React fixture、Prompt 文本 |
| 权威知识 | immutable `knowledge_snapshots` + item/source bindings | RoleContextView | Agent memory、Market fixture 自动覆盖 |
| 持续目标 | PostgreSQL `operating_goals` / revisions | UI form draft | Campaign brief、组件状态 |
| 计划与编译 | immutable `content_plan_revisions`、`mission_intent_bundles`、`mission_execution_bundles` | Agent task projection | AgentTeams DAG 文件 |
| Mission/Task 状态 | PostgreSQL MissionRun/TaskAttempt/Event | SSE/read model | AgentTeams 内部 task state 单独判定成功 |
| 产物/审校/批准 | immutable Revision/AuditDecision/OwnerDecision | Preview render model | UI draft、Agent 自报 |
| PublishPackage | exact approved digest + ordered export refs | 下载目录 | 剪贴板、打开的官方页面 |

浏览器只提交 Draft mutation 并读取 Control Plane；AgentTeams 只执行已编译的任务；`mission-worker` 只领取 PostgreSQL Job/Lease；任何接受的 Agent 输出必须先校验角色、输入、Skill、Schema 和 digest，再进入 PostgreSQL。

### 2. 必须分开的领域概念

- UI Locale、Content Locale、Target Market、IANA Time Zone；
- SourceDocument、提取结果、Owner 确认的 KnowledgeItem、Approved KnowledgeSnapshot；
- Onboarding Session、OperatingGoal、Campaign/Mission；
- selected platform、AccountOperatingProfile、平台 ArtifactProfile、账号连接能力；
- Agent 任务完成、Audit PASS、Owner 批准、PublishPackage 生成、外部平台发布；
- public-safe fixture、Owner 私有资料、真实 Agent run、客户或业务结果。

## 三、代码实读 Gap Matrix

| 范围 | 当前可复用事实 | 当前缺口 / 不能声称 | Epic 吸收位置 |
|---|---|---|---|
| M0/M1 `main` | Node/Next/Fastify/PostgreSQL/BlobStore/`next-intl` 基线；Campaign、Claim/Evidence、四平台预览、持久 Schedule 合同 | `CampaignDocument`、`ActivationPlan`、Capability 和 MissionContract 均硬编码 exact-four；`EvidenceRef.publicSafe` 和 `dataMode` 仍偏 fixture | SDD-008/009 做兼容迁移与 selected-platform v2，不删除旧 v1 读取能力 |
| Mission compiler | `compileMissionAdapterInput()` 校验 Campaign digest、六角色和 ActivationUnit | 只输出浅层角色/平台列表；没有 KnowledgeSnapshot、Goal、AccountOperatingProfile、计划、RoleContext digest 或平台选择裁剪 | SDD-009 |
| M2 Governed Shadow | 固定六角色、8-task DAG、SkillLock、真实 AgentTeams ACK/Submit、DeepSeek Gateway、不可变 Revision、独立 Audit、Owner Review、Trace/Ledger、恢复/隔离证据 | `dataMode=DEMO_SEED`；Producer 固定 X+小红书 / Bluesky+LinkedIn；输出 Schema 固定四平台；一次性 UAT Runner；Owner Review 非执行且 Web 未接完整真实 Mission | SDD-009/010 冻结产品合同；SDD-007 只负责常驻运行与恢复 |
| `mission-worker` on `main` | 有独立进程与 PostgreSQL repository health boundary | 只有 `/health`；不领取 Mission Job、不 dispatch、不 heartbeat、不恢复 | SDD-007 |
| DeepSeek live UAT scripts | 终端隐藏输入、0600 临时 secret、Compose Secret、one-use ticket、AgentTeams real task protocol 和脱敏 receipts 可复用 | 交互式一次性脚本会启动/销毁 UAT stack，要求人工复制 ID；不是产品常驻 Runtime，也不能处理 restart/upgrade | SDD-007；保留安全模式，重构为安装/配置与 Worker 协议 |
| PR #7 / SDD-006 | 本地显示名称、无远端注册、MD/TXT ingest、Blob/PG 持久化、LOCAL_PRIVATE Campaign、双语生产 Shell、AI Team/Publish/Knowledge 页面和 fail-closed 发布 UI | Onboarding 把人设/企业/产品/账号档案压成 8 个通用字段；没有 AuthoritativeKnowledgeSnapshot、来源冲突决定或独立 Goal；平台选择仍创建固定四平台；AI Team 只有静态 roster；内容是初始化模板，不是 Agent 结果 | SDD-008 吸收本地资料与 UX 基础；SDD-009/010 替换固定四平台/模板；SDD-007 接真实运行 |
| PR #6 / SDD-005 | US/JP/DE public-safe Market Pack、deterministic resolver、来源/冲突/角色投影、Skill contract | 只有 public-safe fixture；无 PostgreSQL/API/真实企业资料/真实 AgentTeams binding | SDD-008 可把 resolver 作为可选来源；本 Epic 不把它当用户权威知识 |
| PR #5 / SDD-004 CR1 | 六平台注册表、exact digest、ordered media、allowlisted official-page、manual package 和无 `PUBLISHED` 状态合同 | 纯函数/隔离 Story；没有 X/小红书完整 ArtifactProfile、数据库/API、Audit/OwnerDecision 集成；六平台 current path 超出本轮选定范围 | SDD-010 复用安全合同，只实例化已选 X/小红书产品路径 |
| PR #3/#4 / SDD-003 | PostgreSQL ActionGrant、Outbox、无模型 Operator、UNKNOWN/append-only/restart controlled-fake 证据 | 尚未合入 `main`，且当前 Epic 不执行自动外部动作；引入会扩大授权面 | 不作为本 Epic 依赖；未来 Direct/受控外部动作时再吸收 |
| Web | 生产 Shell、Campaign、AI Team、Publish、Knowledge 页面结构可复用 | 页面状态没有贯通真实 Goal→Mission→Agent→Audit→Package；复制/下载仅审阅导出 | 每个 SDD 只接自己的权威状态；SDD-011 做最终连续 E2E |

结论：现有实现不是“全假”，但它证明的是分散的工程合同，不是可自用产品闭环。Epic 的工作重点是建立连续、持久、selected-platform、真实 AgentTeams 驱动的业务链，而不是重写 UI 或再次构造一套 Demo fixture。

## 四、最少必要 Bounded SDD

| 实现顺序 | SDD | 建议 Module ownership（待 Coordinator 登记） | 预计 | 依赖 | 可见交付 |
|---:|---|---|---:|---|---|
| 1 | [SDD-008 Guided Persona/Knowledge/Account Onboarding](SDD-008-GUIDED-PERSONA-KNOWLEDGE-ACCOUNT-ONBOARDING.md) | `M5-06` | 2–3 天 | `main` + PR #7 收敛决定 | 分步资料/人设/账号录入并批准 KnowledgeSnapshot |
| 2 | [SDD-009 Persistent Goal and Selected-platform Compiler](SDD-009-PERSISTENT-GOAL-SELECTED-PLATFORM-COMPILER.md) | `M5-07` | 2–3 天 | SDD-008 | 7/30 日 Goal/Plan，且只编译 X/小红书 |
| 3 | [SDD-010 X/XHS Artifact, Audit and Manual PublishPackage](SDD-010-X-XHS-ARTIFACT-AUDIT-MANUAL-PUBLISH-PACKAGE.md) | `M5-09` | 2–3 天 | SDD-009；吸收 PR #5 | X Thread / 小红书完整产物、审校、修改/重生成/批准和安全包 |
| 4 | [SDD-007 Persistent AgentTeams Runtime](SDD-007-PERSISTENT-AGENTTEAMS-RUNTIME.md) | `M5-08` | 2–3 天 | SDD-009、SDD-010 的冻结 contracts | 常驻六成员 Runtime、终端 Secret Broker、dispatch/restart/recovery |
| 5 | [SDD-011 Full Dogfood E2E Gate](SDD-011-DOGFOOD-E2E-INSTALL-RECORDING-GATE.md) | `M5-10` | 2–3 天 | SDD-007～010 | fresh install、升级/回滚、正常+失败闭环、Owner UAT 和录屏 |

编号不代表实现先后。`SDD-007` 保留为纯 Runtime 规格，刻意在产品合同冻结后实施，防止它吸收 Onboarding、Goal、平台产物或发布语义。

Coordinator 在实现前应以独立 PR 同步中英文进度表，添加上述 Module ID，并只把当时唯一可执行模块置为 `IN_PROGRESS`。本规格 PR 不提前改变分母、里程碑状态或当前 SDD。

## 五、依赖与集成顺序

```text
PR #7 中可复用的本地资料/生产 UX
              ↓
SDD-008 KnowledgeSnapshot v1
              ↓
SDD-009 OperatingGoal + Plan + selected-platform compiler v2
              ↓
SDD-010 X/XHS ArtifactProfile + Audit + OwnerDecision + PublishPackage
              ↓
SDD-007 opaque MissionExecutionBundle runtime + terminal broker + recovery
              ↓
SDD-011 fresh install / upgrade / rollback / real AgentTeams dogfood / recording
```

PR #6 的市场 resolver 可在 SDD-008 中作为“公共建议来源”接入，但永远低于 Owner 批准的知识；其未合并不得阻塞首个 X/小红书中文/英文 Dogfood。PR #5 的安全 package builder 是 SDD-010 的直接输入。PR #3/#4 的 ActionGrant path 不在当前人工发布闭环关键路径。

## 六、跨 SDD 不可破坏条件

1. PostgreSQL 单真源：AgentTeams、Web 和文件导出均只能保存引用或派生状态。
2. 相同已批准输入产生相同 MissionExecutionBundle、RoleContextView、SkillLock 和 digest；模型文字可不同。
3. Leader 永远 orchestration-only；Auditor 永远不改稿、不批准、不发布。
4. Source/Knowledge/Goal/Plan/Revision/Audit/Decision/Package 均版本化；编辑不覆盖历史。
5. selected platform 是编译输入。未选择的平台不能生成 ActivationUnit、Producer task、Artifact、Audit 或 Package。
6. 首个 public-safe fixture 恰好启用 X Founder Account 和 Xiaohongshu Product Account，使两个 Producer 都承担真实且不同的任务。
7. 真实用户若缺少 Founder/Product 两种生产责任覆盖，Compiler 必须显示 `PRODUCER_COVERAGE_REQUIRED` 或要求 Owner 明确调整账号 Mandate，不能安排空角色冒充协作。
8. `OPEN_OFFICIAL_PUBLISH_PAGE` 只能使用有版本/来源/过期时间的 HTTPS allowlist；内容和媒体不得进入 URL query。
9. 当前没有 `PUBLISHED` mutation。未来若增加，只能由独立 Connector/Read-back/Reconciliation SDD 定义。
10. Provider Key 不通过 Web、API body、数据库业务表、环境变量、Issue、日志或 Trace 传递。
11. public-safe fixture 和真实 Agent run 分别标记；真实 Agent run 不等于客户或业务验证。
12. 计划生成不存在循环依赖：Goal 先编译 Intent generation，真实 Planner 输出成为 Plan Draft；Owner 批准 exact Plan 后再确定性 materialize Execution generation。两个 generation 共享 Mission identity，Runtime 只执行 opaque contracts。

## 七、GitHub 去重与吸收关系

2026-08-22 检查结果：仓库没有 GitHub Issue；开放 Draft PR 为 #3～#7，没有等价的“本地知识 → selected X/XHS → 常驻 AgentTeams → 审校 → 人工发布包 → E2E”总 Epic 或五个 bounded SDD。

| 现有项 | 关系 | 处理 |
|---|---|---|
| PR #7 / SDD-006 | 部分重叠：本地 Onboarding、UX、MD/TXT、静态 AI Team/Publish | SDD-008/011 吸收其已验证基础，不重做视觉 Shell；以 Follow-up 关闭其明确剩余 Gap |
| PR #6 / SDD-005 | 部分重叠：公共 Market knowledge | 作为可选 public layer，不能替代 AuthoritativeKnowledgeSnapshot |
| PR #5 / SDD-004 CR1 | 部分重叠：manual package safety | SDD-010 直接复用并收窄为 selected X/XHS 的生产产品合同 |
| PR #3/#4 / SDD-003 | 邻接但非等价：自动外部动作授权内核 | 当前 manual-only Epic 不吸收，不作为阻塞依赖 |

这些 PR 基于同一旧 `main` 并各自修改过 canonical status，不能互相假定已合并。Coordinator 必须在实现分支开始前冻结一个 convergence base，解决 status、migration number、domain type 和 Web 冲突；不得让任何 Executor自行把其他 Draft PR 视为已存在于 `main`。

## 八、Epic 级验收与负测矩阵

### 正常路径

- fresh install → 显示名称 → 多份 MD/TXT/自由文字 → 分步档案 → KnowledgeSnapshot APPROVED；
- 7 日 Goal → selected X/XHS plan → 六成员 AgentTeams → Audit → Owner edit/regenerate/approve → 两个平台 PublishPackage；
- 重启 Web/API/PostgreSQL/mission-worker/AgentTeams 后恢复到同一业务状态；
- 包可复制/下载/打开官方页，外部结果仍 `UNVERIFIED_EXTERNAL_STATE`。

### 必过负测

- PDF/DOCX/语音上传返回 `SOURCE_TYPE_PLANNED`；
- 未批准、过期、冲突或 digest mismatch 的 KnowledgeSnapshot 不能编译；
- 只选 X 时不会出现小红书或其他平台任务；public fixture 缺第二 Producer coverage 时明确阻断；
- Agent 输出引用未授权资料、错误账号或未选平台时 quarantine；
- Auditor FAIL 时没有 Owner approve/package；
- Owner 编辑或重生成后旧 Audit/Decision/Package 全部失效；
- runtime/model timeout、worker crash、lease expiry、API restart 不产生重复 accepted output；
- Runtime 不可达进入可恢复 blocked/unknown，不切到隐藏 Mock 成功；
- Browser Secret 字段、环境变量泄漏、日志/Trace Secret-shaped 值全部失败；
- 打开官方页、自报完成或刷新页面均不能生成 `PUBLISHED`；
- 升级失败能回到已备份版本和原业务状态，不删除 Blob 或 append-only history。

## 九、Claim Discipline

本 docs-only PR 的唯一有效声明是：`SPEC_READY`。实现后允许的最高工程声明为：

> LumiClaw Presence 可以在本地使用 Owner 批准的知识和账号档案，把一个 7/30 日内容运营目标编译为 selected X/小红书六成员 AgentTeams Mission，生成并独立审校内容，再输出精确的人工发布包；fresh install、restart 和 fail-closed 路径已工程验证。

在真实外部用户完成协议前不得写 `EXTERNAL_CALIBRATED`；在原生平台有可复核证据前不得写 `PUBLISHED`；不得声称自动发布、增长、线索、收入、合规或生产就绪。

## 十、内部真源精确 Delta 计划（本 PR 不修改）

### `docs/current/08-PRODUCT-MILESTONES-AND-SDD-ROADMAP-CN.md`

- 在“近期顺序”中把“页面/Onboarding/Runtime 分散增量”收敛为本 Epic 的五步依赖链；
- 在 M5 Runnable Candidate 中新增 `M5-06`～`M5-10` 的用户结果和退出证据；
- 将当前 Dogfood platform scope 明确为 selected X + Xiaohongshu，历史四平台 Hero 保留为先前证据，不再作为本轮强制编译集合；
- 补充“Owner Dogfood UAT ≠ external calibration”的成熟度说明；
- 更新 SDD 索引和 next executable module，但只在 Coordinator 完成 canonical status parity 后进行。

### `docs/current/09-TECHNICAL-ARCHITECTURE-AND-PLATFORM-PLAN-CN.md`

- 新增 SourceDocumentRevision → AuthoritativeKnowledgeSnapshot → OperatingGoal → ContentPlanRevision → MissionExecutionBundle 数据链；
- 把 Campaign v1 exact-four 与 selected-platform v2 的兼容/迁移策略写清；
- 明确 terminal-only Secret Broker、persistent mission job/lease/heartbeat/recovery 和 AgentTeams opaque runtime boundary；
- 将 X/XHS manual PublishPackage 的无 `PUBLISHED` 状态、allowlist、download/copy/open 边界列入当前选定方案；
- 增加 fresh install/upgrade/backup/forward-fix rollback 与 recording evidence contract。

### `docs/current/04-AGENT-INFRA-ARCHITECTURE-CN.md`

- 将 RoleContext 输入扩展为 approved KnowledgeSnapshot/Goal/Plan/AccountOperatingProfile digests；
- 把固定四平台 Producer 投影改为 selected ActivationUnit 投影，同时保留六角色及 Producer/Auditor 分离；
- 增加 MissionExecutionBundle、MissionRun、AgentTaskAttempt 的 Control Plane/AgentTeams 责任边界；
- 明确 SDD-007 只实现 Runtime lifecycle/secret/dispatch/recovery，不拥有 Persona、Knowledge、Goal、Plan、ArtifactProfile 或 PublishPackage 语义；
- 更新证据链到 OwnerDecision → Manual PublishPackage → `UNVERIFIED_EXTERNAL_STATE`，自动 ActionGrant/Connector 仍为后续路径。

## 十一、开始实施前的 Coordinator Gate

1. 决定 PR #5/#6/#7 的 merge/cherry-pick/convergence 顺序并记录 exact base；
2. 核对 migration 编号冲突，禁止复用已发布编号；
3. 在中英文进度表同一提交登记 `M5-06`～`M5-10`，只把 SDD-008 置为 `IN_PROGRESS`；
4. 为每个 SDD 创建独立 worktree、Codex Executor task 和 Goal；
5. 每个 SDD 完成后独立复验、中文验收报告、Owner UAT 决策和 status parity，再启动依赖项；
6. SDD-011 前冻结 public-safe A梦 fixture、DeepSeek terminal secret prerequisite、录屏脚本和不得外发的 Evidence 字段。
