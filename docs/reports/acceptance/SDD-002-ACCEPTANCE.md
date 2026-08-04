# SDD-002 验收报告｜Governed SHADOW Campaign

> SDD：`docs/specs/SDD-002-GOVERNED-SHADOW-CAMPAIGN.md`  
> 进度模块 ID：`M2-01`、`M2-02`、`M2-03`、`M2-04`、`M2-05`、`M2-06`  
> Goal Objective：完成 SDD-002 Live DeepSeek + 中文运行引导扩展：在现有六成员 Governed SHADOW control loop 中实现显式 Mock/Live、server-only Compose secret-file ingress、真实 DeepSeek 领域任务输出与持久化 redacted receipts、业务优先双语/390px 引导、无 Secret 合同与防泄漏门禁，并生成 clean committed Head、公开安全源码 ZIP 与结构化交接；全程保持零 ActionGrant、Connector 与外部平台动作。
> Current Fix Goal：完成 `COORDINATOR_FIX_REQUEST_6`：以公开安全确定性 fixture 贯穿真实 API ticket/model/runtime-event 路径复现第五个模型任务 Independent Auditor 的 `TASK_SUBMIT` 导入失败，确认并最小修复初审生成 schema、语义 normalize 与领域 materialization 的跨边界契约漂移，增加严格脱敏 submission-import outcome 与正确初审、语义拒绝、重放、ETag/ticket 绑定测试，完成全门禁、公开安全 ZIP 与第八次 Coordinator Canary 交接。
> Executor Task：`019fc941-237b-77c3-8c56-3cc42b1bd6c6`  
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-002-governed-shadow-campaign`  
> Branch / Base：`codex/sdd-002-governed-shadow-campaign` / `4377103b3fea493a591af7f069fd697d9601f1ca`  
> Final Head / Commits：初始 closeout `c26cb9e24c062bf6793f1f4a191f4548dd46a63f`；Coordinator 精确计费修正 `4dc33de589dd3509c749490dc3662e561f0e9ac9`；CR2 首次工程 Head `c931b77ff723e3d9a098a8a088e8a6e3ffe7cb79`；stdin transport 修正 `8cbb0a85b73cdc73f48d489b66e200f24e3e3562`；Fix 2 stage diagnostics 候选 `463bf545e74da50a480c38cee7b9eba8b6256a26`；Fix 3 起始 Head `356a9cac79d49cbda05b5fad8855c93363159183`；provider outcome/schema `7d53e91f551c9aef80e318aba609801ddb248013`；Worker broker clean Head `f8750bdc33c699ec8f9b74f73705c9e38d357989`；Fix 4 起始 `5a669de2a68515535b96ea11c6b90ed8c423a7e7`；Fix 5 最终 Head `b85ef2494b631415a0545f03154a285c19ae2786`；Fix 6 初审导入契约提交 `3b45f0dea141554147e995047bd3b9b8d11750d6`；最终 clean Head 由本报告后的 source-package manifest 与结构化 handoff精确记录
> 报告状态：`ENGINEERING_VERIFIED`（CR2 无 Secret 自动门禁完成后可建议 `EVIDENCE_READY`；真实 DeepSeek、Owner UAT 与 Coordinator acceptance 仍为 `PENDING`）
> 证据成熟度：`ENGINEERING_VERIFIED`（真实 AgentTeams + 公开安全 Mock Model Conformance + Live 合同/防泄漏）；第七次 Coordinator Canary 接受 5 个真实 DeepSeek receipt，在 AgentTeams 已提交/检查 initial Audit 后精确失败于 Control Plane `TASK_SUBMIT` 导入，故 `LIVE_PROVIDER_VERIFIED=false`；第八次 Canary 待 Coordinator；EvoLink Canary 未运行
> 生成日期：`2026-08-05`

## 一、交付结果

本分支把已验收 M1 的持久化 Campaign 贯穿到一条可重复的 M2 SHADOW 纵向切片。一个 PostgreSQL Campaign 会编译成恰好六个分权 RoleContext、五个版本锁定 Skill 与八任务因果 DAG；真实固定版本 AgentTeams v1.2.0 Manager/Worker Runtime 创建一个 Leader 与五个 Worker，执行真实 Project/Task/ACK/Submit。Project receipt 绑定官方 source tar SHA-256、六个 Matrix actor、六个内部 Role Identity 与精确 DAG；每个 accepted Submit 还必须绑定同一个 Project、actor、task、attempt、ACK receipt、经认证的 Runtime import channel 和 AgentTeams `check_task` 持久化 summary/observation digest。Mission、Input、SkillLock、Schema、Output 或 receipt 任一不匹配都会隔离。

两个 Producer 的首轮 Task 只提交 X/Xiaohongshu 与 Bluesky/LinkedIn v1；冻结 Flight 把 X v1 的 Beta 能力故意写成 GA。Independent Auditor 的首轮 Task 以 `FAIL`、Evidence Ref 和下一责任角色拒绝，Mission 先持久化为 `REVISION_REQUIRED`。Founder Producer 的 attempt 2 绑定失败 Audit digest、提交 X v2，Mission 进入 `AUDIT_BLOCKED`；Independent Auditor 的 attempt 2 再绑定失败 Audit 与精确 X v2 digest，提交 `PASS` supersession，旧 Audit 由不可变历史投影为 `INVALIDATED`，Mission 才进入 `NEEDS_OWNER_REVIEW`。四个平台最新 PASS Revision 才进入 Owner Review；Review 只记录 `NON_EXECUTABLE_OWNER_REVIEW`，不会创建 ActionGrant、Connector、Schedule due execution 或外部动作。

默认中文、支持英文的 Mission/Review UI 展示完整状态、六成员、DAG、Audit、最多两版 Diff、四个精确 Review 与业务优先 Evidence Drawer。UX-M1-001 已收口：Claim/Evidence 只阻止未来执行，与“未保存内容 / DST fold 未选导致排程草稿按钮禁用”分成两张边界卡，并给出准确可操作原因。真实 Chrome 覆盖 desktop、390px 和 16 个 Storybook 状态。

DeepSeek 官方 Gateway 与 MediaGenerationProvider 边界已实现并通过公开安全 conformance；模型名、cache-hit/cache-miss/output peak 单价和官方来源在实现时核验。Coordinator 独立复核发现初始快照把所有输入错误地按 cache-miss 计价，现已修正为 hit/miss/output 分项公式，并对矛盾或半缺省 usage fail closed；两项细分都缺省时保守按全 cache-miss 计价。

CR2 采用 Coordinator 授权的 Scheme A：网页显式区分“公开安全 Mock 演练”和“真实 DeepSeek 测试运行”。Live Mission 从创建起把 provider mode/model/maturity、Campaign digest、固定 AgentTeams source/build/image digest、任务/失败/下一责任人与 redacted ModelCallSnapshot 持久化到同一 PostgreSQL；刷新不丢状态。Coordinator 在宿主交互式终端启动一次性 Runner，Runner 只绑定一个 Organization/Mission/Campaign digest。Leader 只做确定性编排；其余七个领域 Task 分别通过独立 Worker、角色 prompt/schema 与 API 内的 server-only DeepSeek broker 调用模型，其中 Independent Auditor 与 Producer 使用不同身份、prompt、schema 和 receipt。成功只进入 `AWAITING_OWNER_REVIEW`，不会生成 ActionGrant，也不会把任何草稿称为已发布。

API Key 与 runtime bootstrap 只由启动器无回显读取，写入校验器持有的 0600 临时文件，再以 Compose secret 只读挂载到固定 `/run/secrets/...`；Key 不进入普通容器环境变量、Docker inspect、CLI 参数、Worker/Runner、浏览器 bundle、数据库、Trace、Evidence、日志、Git 或 ZIP。API 只签发 10 分钟、单 Mission/role/task/attempt/action、单次消费的内存 ticket，数据库只保存 redacted receipt。无 Key、无 Runner、中断、过期/复用/错 scope ticket、供应商/结构化输出/digest 失败全部 fail closed，不会切回 Mock。Executor 不接触 Owner Key，因此当前只声明 `ENGINEERING_VERIFIED`；第七次 Coordinator Canary 精确标记为 `TASK_SUBMISSION_IMPORT / 5 ACCEPTED MODEL RECEIPTS / LIVE_PROVIDER_VERIFIED=false`。

Coordinator 在 CR2 首次 clean Head `c931b77ff723e3d9a098a8a088e8a6e3ffe7cb79` 执行真实 Canary 时，Secret ingress、Compose inspect 与精确 Live Mission 创建均通过，但嵌套 Runner 在进入 AgentTeams 前以 Node status 13 失败。根因是一个非 TTY pipe 上连续四次 `readline.question()`：首问缓冲余下 bytes 后 fd 到 EOF，第二个 top-level await 永远不 settle；该失败不构成 Live Provider验证。CR2 Fix 1 改为 launcher 生成一个严格四字段 JSON，environment verifier 与 Runner 各自只用 `readFileSync(0, 'utf8')` 读取 fd 0 一次，所有子 stdout/stderr 均捕获且只重建 allowlisted stable JSON code。真实 child-process 回归覆盖完整、partial、malformed、extra-field与合法输入后的 operational failure 五种输入，bootstrap/dummy secret/header finding 为 0；失败 Canary 的精确 Compose project、仅本次拥有的 AgentTeams runtime objects，以及包含 0600 Secret 文件的私有临时目录均确认已清理。

Coordinator 在 Fix 1 clean Head `8cbb0a85b73cdc73f48d489b66e200f24e3e3562` 的第二次真实 Canary 中确认 stdin/Secret/Compose/六 Worker 均正常，但 Mission 在 `WAITING_RUNTIME`、model receipts 0 时约两分钟后只收到通用 `LIVE_DEEPSEEK_UAT_RUNNER_FAILED`；旧 Runner 把 Mission open、runtime identity、topology、Project create、DAG plan、member binding 和 dispatch 的任一异常都折叠成同一码，清理又删除了 runtime/DB 状态，因此原始具体异常不可恢复，且该尝试仍不构成 Live Provider验证。CR2 Fix 2 新增严格 allowlisted stage/code、进度单调校验与宿主原子 failure receipt；收据在清理前绑定 Base/Head/branch、Mission/Campaign、固定 runtime identity、`projectCreated/dagPlanned/projectDispatched`、model count、zero-action、`secretPresent=false` 和 `liveProviderVerified=false`，两层子进程及 launcher 只重建七字段脱敏 envelope。12 个阶段均走真实 nested child pipe，任意异常文本、bootstrap/ticket/header/raw response 不向上游透传。

在不接触 Owner Key 的 clean 候选 `463bf545e74da50a480c38cee7b9eba8b6256a26` 上，受控真实 AgentTeams 诊断使用明确不可用的短 Secret 文件，并在任何外部 DeepSeek 请求前关闭。固定 source/build/image、精确六成员、Project create、八 Task DAG plan、六 RoleContext actor binding、Control Plane dispatch 与 Leader 确定性任务均通过；第一个领域任务到达 broker 后以 `PROVIDER_REQUEST / LIVE_PROVIDER_REQUEST_FAILED` 失败。持久化 Mission 为 `FAILED`，model receipt 0，ActionGrant/Connector/external action 0，AgentTeams/Compose/0600 临时目录清理均 PASS。这证明候选 pre-dispatch 路径可执行，但不能反推第二次 Canary 的已丢失异常，也不声明真实 Provider请求或 `LIVE_PROVIDER_VERIFIED`。

Coordinator 在 Fix 2 clean Head `356a9cac79d49cbda05b5fad8855c93363159183` 的第三次真实 Canary 中确认所有 pre-dispatch 进度与清理均通过，但首个领域 Task 仍以顶层 `PROVIDER_REQUEST / LIVE_PROVIDER_REQUEST_FAILED` 失败，model receipt 0。宿主收据 SHA-256 为 `2396c679f12bbbf2cc78c1c2c81f211f226c67cd8cd797253162f2db10746248`；它不含 Secret/raw response。当时的 `providerBrokerRequestStarted=true` 只表示宿主已发起 Worker child attempt，不证明 API 已收到请求。Coordinator 随后用隐藏 TTY 独立确认 Owner credential、官方 `/models`、`deepseek-v4-flash`、`json_object`、response identity 与 usage 基本合同均为 HTTP 200；这些 probe 排除了网络出口/Key/model基础问题，但不等于产品首 Task成功，本次仍为 `LIVE_PROVIDER_VERIFIED=false`。

Fix 3 在不接触 Owner Key 的前提下收口了诊断、容器网络与产品合同。首轮 no-Secret真实六成员复现仍得到 broker fallback；源码随即揭示第三次 Canary 的功能根因：Runner把宿主 `http://127.0.0.1:<port>` 原样交给独立 AgentTeams Worker容器，容器内 loopback 指向 Worker自身，`urllib` 从未到达 Control Plane。修正后 Host侧仍只用 loopback；Worker侧只从无 credential/path/query/fragment 的本地 HTTP origin确定性映射到 `http://host.docker.internal:<same-port>`，任意远程 origin fail closed。真实六成员 no-Secret复验随后在 API/PostgreSQL持久化精确 `DEEPSEEK_SECRET_FILE_UNAVAILABLE`，0 model receipt/0 action/cleanup PASS，证明网络路径已修复。

API 只返回既有 stable provider/model/semantic code；Runner 在 Worker 非零退出后重新读取精确 Mission，以 failed Task、Mission failure 和 `ModelCallSnapshot.error.code` 一致性导出 `providerOutcomeCode`，任一缺失、冲突、额外或非 allowlist 状态统一关闭为 `LIVE_PROVIDER_BROKER_FAILED`。顶层 stage/code 保持不变，两层 child envelope不透传 body、prompt、model content、response ID、headers、ticket、bootstrap 或任意异常文本。源码检查另发现独立合同缺陷：Gateway会本地验证 `outputSchema`，但此前没把schema发送给DeepSeek；现在 exact schema进入 user message与input digest。公开安全首任务 fixture证明错误shape以 `MODEL_SCHEMA_INVALID`拒绝，精确 `{frozen:true, assessment:<非空>}`接受。schema缺陷已修复，但不是第三次失败的历史根因，因为当次 Worker根本未到达API。

Coordinator 在 Fix 3 clean Head `f8750bdc33c699ec8f9b74f73705c9e38d357989` 的第四次真实 Canary 中证明 Worker/API/DeepSeek/结构化 JSON链路已工作：Project/DAG/member/dispatch通过，前三个领域调用形成 3 个 accepted `ModelCallSnapshot`，随后 `PRODUCE_FOUNDER` 以 `LIVE_MODEL_SEMANTIC_OUTPUT_INVALID` 关闭；failure receipt SHA-256 为 `fb55c27408276fe43111a684229e6a0a47f99edd1538bced7549643e3d70254d`，zero-action与cleanup均 PASS。该证据证明真实 Provider 调用发生，但 Mission未完成七领域 receipt、修订/复审和 Owner Review，因此明确不构成 `LIVE_PROVIDER_VERIFIED`。

Fix 4 的精确根因是 generation schema 与 normalize语义漂移。旧实现从通用持久化输出 schema 克隆后删除 digest/revision字段，仍把四平台 enum 与四种 content `oneOf` 独立表达；重复平台或 `platform=X / content.kind=XIAOHONGSHU` 可先通过 Provider Ajv，再被 normalize拒绝。现在 founder、product、correction、initial audit、re-audit 各用闭合任务 schema：精确无序平台集合、platform/content.kind绑定、闭合 issue shape；correction 的 `content` 直接 `const` 绑定 task projection中的 evidence-safe X源内容。模型不得提交 revision或任何 digest，服务端仍确定性派生；normalize不放宽，re-audit也不再把错误平台重标为X。公开安全矩阵接受8个合法顺序/内容样例并拒绝15个重复、错平台、跨类型、缺项、多项、多字段、source篡改或伪造派生字段样例。

Coordinator 在 Fix 4 Head `5a669de2a68515535b96ea11c6b90ed8c423a7e7` 连续执行第五、同 Head 第六次真实 Canary。两次均接受 `FREEZE_EVIDENCE`、`PLAN_CAMPAIGN`、`PRODUCE_FOUNDER`、`PRODUCE_PRODUCT`、`AUDIT_REVISIONS` 的 5 个真实 ModelCallSnapshot，四个平台 Revision 与四个初审已持久化；随后 `PRODUCE_FOUNDER_CORRECTION` 停在 `ASSIGNED`，`REAUDIT_CORRECTION` 保持 `WAITING_DEPENDENCY`，顶层均为 `TASK_PROTOCOL / LIVE_TASK_PROTOCOL_FAILED`。第五次 Mission 为 `019fcdcf-fae9-741c-8796-482a08aca1cd`、failure receipt SHA-256 `548ae1d0a5898a573114a8ead447166f617056d5aa3307c41d062529a4545f84`；第六次 Mission 为 `019fcdd4-4531-741c-8796-482a08aca1cd`、失败前版本 27。两次 ActionGrant/Connector/external action 均为 0，精确 Compose、AgentTeams 与 Secret临时目录清理均 PASS，但旧 Runner 没有保存具体失败操作与操作前 Runtime状态，因此历史 exact operation 不可恢复。

Fix 5 先核验了“依赖满足后 AgentTeams 会自动 delegate correction，Runner 重复 delegate”的假设；该假设被官方 v1.2.0 源码与真实 Runtime证据共同证伪。`ready_nodes` 只返回依赖已满足的 `pending` 节点且不改变状态；只有 `delegate_task` 创建 assigned TaskMeta并把 DAG节点变为 `delegated`，ACK再把成员 TaskMeta变为 `in_progress`，Submit变为`submitted`，CHECK/typed bridge最终变为`accepted/completed`。公开安全真实六成员/八Task证据中，包括同一 Founder Producer 的 attempt 2 correction 与同一 Auditor 的 attempt 2 re-audit，所有 pre-operation 都是 `pending / no TaskMeta / DELEGATE`；因此不得把未保存的第五/第六次失败追溯成重复 delegate。

已确认并修复的是 Live Runner 的盲序列与不可诊断缺陷。新的闭合状态规划器每次先读取 Leader authoritative Project/DAG，再读取 exact assigned Worker authoritative TaskMeta/spec/result；Worker三者都缺省时仅可精确回退 Leader，部分同步或身份/digest矛盾则 fail closed。它按精确状态选择 `DELEGATE → ACK → IMPORT_ACK → RUN_DOMAIN → SUBMIT → CHECK_IMPORT → ACCEPT → COMPLETE`，并把 Project/task/member/role/attempt/room/dependencies/contract digest及 PostgreSQL receipt逐项绑定；已提交模型 receipt但缺少可恢复的prepared output时拒绝重复调用模型。13个task-protocol outcome均走真实 nested child pipe，只返回allowlisted code与`planStatus/taskStatus`，不会透传bootstrap、ticket、Authorization/Bearer、prompt、模型输出、raw response或任意异常。

首次无 Secret真实复验还精确捕获并修正两个独立 Runtime合同差异：官方AgentTeams时间戳为整秒`YYYY-MM-DDTHH:mm:ssZ`，而JS快照为`.000Z`；现在只接受这两个UTC规范形式并比较同一瞬时，1秒差异仍拒绝。其次，delegate后Leader先持有DAG/TaskMeta，ACK后assigned Worker先持有`in_progress`而Leader副本暂为`assigned`；现按上述复制权威读取，禁止只读Leader造成重复ACK，也禁止只读Worker拒绝合法初次delegate。最终真实Runtime门禁的八个Task（含同成员第二任务）都提供完整八步`stateActions`与binding digest；无Secret六成员路径按预期走到第一个Provider边界并以`DEEPSEEK_SECRET_FILE_UNAVAILABLE`关闭，0 receipt、0 action、精确清理 PASS。

Coordinator 在 Fix 5 clean Head `b85ef2494b631415a0545f03154a285c19ae2786` 的第七次真实 Canary 中，把失败边界缩小到第五个领域模型任务的 Control Plane 导入：Mission `019fce35-225e-741c-8796-482a08aca1cd`；failure receipt SHA-256 `6b9195ffc0e881e69ae7e5be26eadcf9a136f6c42502e1493bd7eeb32687e8f8`；`taskProtocolOutcomeCode=LIVE_TASK_SUBMISSION_IMPORT_FAILED`；AgentTeams `planStatus=delegated/taskStatus=submitted`；model receipts=5。Runner 已成功完成 `CHECK_IMPORT`、校验 checked summary 与 PostgreSQL ACK、构造 exact `RuntimeSubmission`，只在 `runtimeEvent({kind:'TASK_SUBMIT'})` 失败。ActionGrant/Connector/external action 均为 0，Mock fallback=false，所有清理 PASS；没有 raw model output 或 Owner Secret进入证据，本次不构成 `LIVE_PROVIDER_VERIFIED`。

Fix 6 的公开安全生产路径复现确认根因不是 ticket、ETag、Provider transport 或 AgentTeams submit/check，而是 initial Audit 三个边界的契约漂移：旧 task-specific JSON Schema 与 `normalizeLiveRoleOutput` 允许四平台任意 PASS/FAIL/ESCALATE 组合；`materializeAcceptedRuntimeProgress` 则冻结要求 X v1 必须以唯一 `CLAIM_OVERREACH/BLOCKING`、非空 Evidence Ref、`founder-identity-producer` 下一责任人 FAIL，其他三平台必须 PASS，后续 X re-audit必须 PASS。旧代码因此可接受并持久化一个结构闭合但全 PASS 的第五 `ModelCallSnapshot`，直到 `TASK_SUBMIT` 才以 `RUNTIME_FROZEN_FAULT_INVALID` 关闭。

最小修正把同一冻结约束同时编码进生成 JSON Schema 和独立 normalizer，保留 materialization强校验，绝不把坏输出强制改成 FAIL。正确无序初审在第五 snapshot 后通过 production ticket/model/runtime-event导入并持久化四个 Revision/四个 Audit；全 PASS、X空issue/ESCALATE、非X FAIL、重复/缺失/额外/跨平台输出在 Provider语义边界关闭，re-audit只接受 exact X PASS。Revision number、content/revision/audit digest仍由服务端派生。`TASK_SUBMIT` 非2xx另只映射为七类 closed `submissionImportOutcomeCode`，任意 body/details/exception、prompt、model output、ticket、bootstrap、Authorization/Bearer、Secret 均不跨 child/host receipt。

## 二、交付范围

### 已包含

- AgentTeams v1.2.0 Runtime Adapter 的 Project/DAG/Task/ACK/Submit、版本/digest/schema/角色校验、timeout/cancel/restart/reconcile、重复与错误隔离。
- 单命令真实 Runtime 自举：下载并校验官方 v1.2.0 source tar，运行官方 installer，创建精确六成员 Team，执行八 Task、重启与清理；不依赖隐藏的人工预置成功路径。
- 同一 PostgreSQL Control Plane 中的 Campaign、Mission、AgentRun、AgentTask、SkillLock、Revision、AuditDecision、OwnerReview、Trace、Ledger、ModelCall 与 MediaAsset；Mission JSON 只保留 envelope，十类历史只从 normalized rows 重放，并验证 ETag、Trace sequence、Ledger digest chain 与 Runtime receipt binding。
- 恰好六个真实 Runtime 成员：Presence Mission Leader、Evidence & Claim Steward、Campaign Planner、Founder Identity Producer、Product Account Producer、Independent Auditor；Leader 只编排，Producer 与 Auditor 身份/Context/权限/提交分离。每个 Worker 只接收 RoleContext 对应的 allowlisted projection，Verifier 与 Provider 明确拒绝完整 Campaign/通用 upstream 输入。
- 五个 Apache-2.0 公共 Skill：版本、源码与 digest 固定；无 legacy/竞品源码迁移。
- DeepSeek 官方 `ModelProvider` Gateway：`deepseek-v4-flash` / `deepseek-v4-pro` allowlist、结构化 JSON Schema、config/model/input/output/cost/latency/error 快照、官方 cache-hit/cache-miss/output peak rate、有界 timeout/retry、429/5xx、4xx、usage 一致性、无静默换模、Secret/Prompt redaction。
- 五类领域生成合同使用 `TASK_SPECIFIC_CLOSED_V1`：founder/product精确无序平台集合，correction精确 X 与 source content动态 `const`，initial Audit精确 X `CLAIM_OVERREACH` FAIL / 其余三平台 PASS，re-audit精确 X PASS；revision/digest仅由服务端派生，坏模型输出不被强制修正。
- CR2 Live Mission 合同：`PUBLIC_SAFE_MOCK` / `LIVE_DEEPSEEK_UAT` 显式选择；`WAITING_RUNTIME / RUNNING / FAILED / AWAITING_OWNER_REVIEW / COMPLETED_SHADOW` 为 PostgreSQL 状态，记录固定 runtime expectation、下一责任人与失败原因，不使用前端内存假进度。
- Coordinator-started 单 Mission Runner：官方固定版本 AgentTeams 六成员/八 Task；Leader 无模型调用，七个领域 Task 各有独立 DeepSeek receipt；Auditor 使用独立角色 prompt/schema，首审 FAIL、Producer 修订与复审 PASS 保持因果分权。
- 可恢复 AgentTeams Task协议：先inspect Leader Project/DAG与assigned Worker Task材料，精确规划`DELEGATE/ACK/IMPORT_ACK/RUN_DOMAIN/SUBMIT/CHECK_IMPORT/ACCEPT/COMPLETE`；同一成员的第二个依赖Task、复制延迟、UTC时间戳、重启/重放与全部identity/digest绑定均fail closed，13类脱敏task outcome可在清理后诊断。
- Worker broker reachability：宿主 Control Plane调用保持 `127.0.0.1`；仅 Worker请求使用从严格本地HTTP origin导出的 `host.docker.internal`，不接受任意远程broker、credential、path/query/fragment，也不向Worker提供Owner Key或Docker socket。
- Runner stdin transport：exact four-field JSON、每层 fd 0 单次读取、captured child pipes、redacted digest receipt 与 stable failure code；不再使用非 TTY `readline.question()`，不继承 raw stdout/stderr。
- Live failure diagnostics：`MISSION_OPEN / RUNTIME_IDENTITY / TOPOLOGY / PROJECT_CREATE / DAG_PLAN / MEMBER_BINDING / PROJECT_DISPATCH / TASK_PROTOCOL / PROVIDER_REQUEST / FINALIZE / AGENTTEAMS_PROVISION / CLEANUP` 各有唯一 stable code；`TASK_SUBMIT` 导入再只允许 ticket、ETag、request contract、quarantine、domain invariant、persistence unavailable、unclassified 七类 `submissionImportOutcomeCode`；`.evidence/sdd-002/deepseek-live-failure.json` 在清理前原子持久化、清理后只更新 allowlisted cleanup状态，并从 public source ZIP/run manifest排除。
- Task-level Provider diagnostics：失败后只重开精确 Mission；`providerOutcomeCode` 必须来自 strict allowlist，并与 failed Task 和 redacted snapshot 一致。HTTP 401/402/404/429/500/502/503/504、timeout/unavailable、response identity/model/finish/usage/response/JSON/schema/semantic、broker 与 success 均有 API/真实 child-process 合同；未知或矛盾状态一律归并为 `LIVE_PROVIDER_BROKER_FAILED`。
- 无 Owner Secret 的真实 AgentTeams 诊断：`npm run verify:live-agentteams-no-secret` 以固定六成员完整走到已持久化 Project dispatch，再在 server-only broker 的 unavailable-secret 检查处关闭；绝不访问 DeepSeek、绝不回退 Mock、绝不声明真实模型调用。
- Server-only Secret broker：Key/Bootstrap 只从 Compose secret file 读取；短期、单 scope、单次 ticket 只存内存 hash；Runner/Worker 只得到 task ticket，永远拿不到 Owner Key；无 Key/Runner/Provider/schema/digest 失败均 fail closed 且无 Mock fallback。
- `MediaGenerationProvider` 与 EvoLink Canary 边界：公开安全 Mock、Content-addressed ingest、synthetic rights/cost receipt、`UNREVIEWED`、不自动批准。
- 四平台 immutable Revision、独立 Audit、编辑后旧 Audit 失效、最多两版 Diff、精确非执行 Owner Review。
- 冻结 Beta→GA Claim fault、FAIL/next role/evidence、修订重审、可重放公开安全 Trace/Ledger/Evidence 与零动作证明。
- 默认 `zh-CN`、支持 `en` 的 Mission/Review 高保真真实 API 状态；显式模式/模型/成熟度、Coordinator 公开交接标识、六角色当前职责、等待/失败/下一责任人、“本地 UAT/非线上常驻/未发布”边界、折叠技术 receipt；desktop、390px、Storybook 真实 Blink Runtime。
- fresh Compose、PostgreSQL/API、真实 AgentTeams、Provider、Secret/License/SBOM/Build 与公开安全源码包门禁。

### 未包含或延期

- DeepSeek真实Canary：第四次到达官方Provider并接受3个receipt后失败；第五/第六次均接受5个receipt后在correction Task协议关闭；第七次接受5个receipt并把边界精确缩小到 initial Audit的 Control Plane `TASK_SUBMIT` 导入，仍为`LIVE_PROVIDER_VERIFIED=false`；第八次必须由Coordinator用本地Secret独立执行并记录redacted evidence。EvoLink真实Canary为`NOT_RUN_NO_KEY`。两者都没有把Key放进Prompt、Git、ZIP、Trace、Evidence或报告。
- Scheme B“网页/API 顺序直调后冒充六成员运行”明确禁止；Scheme C“带 Docker 权限的线上常驻 supervisor”延期到独立 SDD，不在本轮实现。
- M3 ActionGrant、ActionOutbox、Schedule due execution、Action Operator 执行、Connector、平台 API、Direct/Handoff、Receipt 或任何发布/评论/回复/DM/抓取。
- 真实客户、真实账号、私有资料、客户 UAT、External Calibration、业务效果、增长、线索、收入、合规或生产就绪声明。
- AgentTeams Manager/Worker/Matrix 内部改造。v1.2.0 Projectflow 缺少公开 checked-result accept 操作，只在官方 CHECK `effective=true` 后通过该固定版本的 typed `FileSystemTaskStore` 更新 DAG/Task 状态；未修改上游源码或镜像。
- Push、PR、Deploy、线上数据库 Migration、线上配置或真实用户数据。

## 三、实现证据

| 范围 | 文件 / 对象 | Evidence |
|---|---|---|
| SDD 生命周期 | `docs/specs/SDD-002-*`、`docs/specs/sdd-002/` | Spec Ready 复核无冲突；Constitution → Specify → Clarify → Plan → Checklist → Tasks → Analyze → Implement/Converge；未扩大到 M3。 |
| Domain / Database | `packages/governed-shadow/`、migration `000005_governed_shadow_campaign.cjs`、`000006_live_deepseek_uat.cjs` | 六角色/五 Skill/DAG、不可变 Revision/Audit/Review、provider/media、Trace/Ledger；Live provider/runtime/failure/receipt 持久化；normalized history divergence 拒绝；`.evidence/sdd-002/shadow-postgres.json`。 |
| API / Worker | `apps/api/src/server.ts`、`live-runtime-security.ts`、`openapi.ts`、`apps/mission-worker/` | Campaign→Mission、Runtime event import、public-safe flight、exact review；Secret-file DeepSeek broker、scope ticket issuer、Live fail endpoint；API/Worker 共用 PostgreSQL，无隐藏成功路径；`.evidence/sdd-002/api-integration.json`。 |
| Runtime Adapter | `packages/runtime-agentteams/src/shadow-adapter.ts`、`scripts/verify-agentteams-real-environment.mjs`、`scripts/verify-agentteams-real-runtime.mjs`、`scripts/run-live-deepseek-uat.mjs`、`scripts/live-agentteams-task-protocol.mjs`及其测试、`scripts/live-uat-transport.mjs`、`scripts/live-uat-diagnostics.mjs`、`scripts/live-submission-import-outcome.mjs`及其测试 | 官方 installer自举、真实 Project/DAG/ACK/Submit、authenticated import、八 Task三阶段因果状态、RoleContext projection、restart、digest/schema/duplicate quarantine、同一 Campaign/Mission/Project binding与精确清理；Live Task先inspect并按`DELEGATE/ACK/IMPORT_ACK/RUN_DOMAIN/SUBMIT/CHECK_IMPORT/ACCEPT/COMPLETE`恢复；strict JSON stdin、12-stage/20-provider/13-task/7-submission-import allowlist、host failure receipt与nested child non-disclosure；`.evidence/sdd-002/agentteams-real-runtime.json`、`live-agentteams-no-secret-diagnostic.json`，真实 Canary待 Coordinator生成 `deepseek-live-canary.json`。 |
| Role / Skills | `infra/agentteams/team-profile.json`、`skills/*/SKILL.md` | 恰好六身份、Leader orchestration-only、Auditor only AUDIT、两个 Producer 平台分工、五 Skill version/digest lock。 |
| Provider / Media | `packages/governed-shadow/src/model-provider.ts`、`packages/governed-shadow/src/live-model-generation-schema.test.ts`、`packages/governed-shadow/src/media-provider.ts`、`infra/providers/` | DeepSeek official gateway/mock transport conformance；exact task-specific closed role schema进入 Provider message/input digest，8 valid / 18 invalid semantic generation cases；initial Audit冻结X FAIL/其余PASS、re-audit X PASS先于materialization验证；flash/pro cache hit/miss/output精确计费与usage consistency fail-closed；Live receipt记录provider/model/usage/cost/latency/schema/digest/error且redacted；EvoLink no-key boundary；`.evidence/sdd-002/provider-conformance.json`。 |
| UI / i18n | `shadow-mission-workspace.tsx`、stories、`campaign-workspace.tsx`、双语 message、CSS | Mock/Live、固定模型/成熟度、持久化 wait/failure/next owner、公开 Runner 交接标识、六角色/receipt、未发布/非线上常驻；Mission/Review 状态矩阵、Evidence Drawer、Diff/Review、UX-M1-001、390px；`.evidence/sdd-002/browser-verification.json` 与五张截图。 |
| No action | domain/API/Compose/action-operator health contract | `externalActionAllowed=false`，Grant/Connector/Action/table/route 均为 0；M3 类型与执行路径未引入。 |
| Security / License | `compose.live-deepseek-uat.yml`、`start-live-deepseek-uat.mjs`、`live-uat-transport.mjs`/tests、`live-uat-diagnostics.mjs`/tests、`live-task-protocol-diagnostics.test.ts`、`live-submission-import-outcome.test.ts`、`check-compose-policy.mjs`、Storybook client-bundle safety、`secret-scan.mjs`、dependency inventory、CycloneDX SBOM | 交互式无回显→0600 临时文件→Compose read-only secret；四字段 JSON只经captured stdin pipe，raw child output不继承；strict loopback→Worker broker origin；12 stage/20 provider/13 task/7 submission-import exact schema，dummy bootstrap/ticket/Authorization/Bearer/raw response finding 0；inspect/env/log/bundle/source无值泄漏；无Docker socket；local failure receipt不进入public ZIP/manifest；license/provenance、npm audit、SBOM与final manifest。 |

## 四、自动化验证

执行环境：Darwin arm64；Node.js `v24.16.0`、npm `11.13.0`、Docker `29.4.0`、Docker Compose `v5.1.2`、Git `2.54.0`。所有命令均从报告头指定 Worktree 执行；专用 Compose project/容器/volume 使用 `lumiclaw-sdd002-*`，不停止、不复用 `lumiclaw-sdd001-owner`。

| 检查 | 命令或协议 | 期望 | 实际 | 结果 |
|---|---|---|---|---|
| Unit / Schema / Permission | `npm test` | 正反合同、六角色、权限、runtime/provider/media/audit/review/UI 全通过 | 29 个 test files、270 个 tests 全通过；Fix 6新增真实API顺序下第五snapshot正确初审导入、全PASS语义拒绝、stale ETag、错scope/复用ticket，以及7类submission-import child诊断；Fix 5同成员第二Task与恢复矩阵、既有分权/redaction合同保留 | `PASS` |
| Lint / Type | `npm run lint && npm run typecheck` | 所有 workspace 无错误 | 全部 workspace 无错误 | `PASS` |
| PostgreSQL Mission | 临时 PostgreSQL + migrate + `npm run verify:shadow-postgres` | restart/idempotency/normalized history/revision/audit/no-action | `status=PASS`；Mission envelope 历史数组均为 0；6 run/8 task/5 skill/5 revision/5 audit/1 exact OwnerReview/32 trace/32 ledger；六张历史表 mutation 全拒绝；幂等只存不可变 metadata，Replay 重构 current normalized authority，版本推进后的旧 checkpoint 被拒绝；forbidden table 0 | `PASS` |
| Campaign/API | `npm run verify:campaign-api` | M1+M2 create/replay/scope/ETag/flight/review/restart/down-up/cleanup | `result=PASS`、`cleanup=PASS`；四个 exact review，state `SHADOW_COMPLETE`，forbidden action table 0 | `PASS` |
| AgentTeams images | `npm run verify:agentteams-images` | 固定 v1.2.0 tag/source/image digest 与受控 smoke | `result=PASS`、`cleanup=PASS` | `PASS` |
| 真实 AgentTeams | `npm run verify:agentteams-real` | 官方 source/installer 自举，真实六成员、八 Task Project/DAG/ACK/Submit/restart，与同一 PG Mission 链接并清理 | `status=PASS`、`realAgentTeamsAcceptance=true`、`realModelAcceptance=false`；8 个Task（含Founder Producer与Auditor各自attempt 2）均证明`DELEGATE/ACK/IMPORT_ACK/RUN_DOMAIN/SUBMIT/CHECK_IMPORT/ACCEPT/COMPLETE`、精确binding digest与CHECK persisted summary；状态依次为`REVISION_REQUIRED → AUDIT_BLOCKED → NEEDS_OWNER_REVIEW`；错身份/digest/复制矛盾/重放拒绝；cleanup PASS | `PASS` |
| Provider / Media | `npm run verify:providers` | structured/429/5xx/4xx/timeout/schema/no-switch/redaction/exact cost/media rights/no approval | `status=PASS`；DeepSeek/EvoLink外部 Canary `NOT_RUN_NO_KEY`；Mock `MOCK_CONFORMANCE`；exact schema进入message/input digest；`TASK_SPECIFIC_CLOSED_V1` 8合法/18非法生成样例；flash `(20×0.0028 + 80×0.14 + 50×0.28)/1e6 = 0.000025256 USD`，pro `(20×0.003625 + 80×0.435 + 50×0.87)/1e6 = 0.0000783725 USD`；另有8个合法Role projection与15个越权/篡改输入；Secret absent | `PASS` |
| Live 合同 / Secret 防泄漏 | `npm run verify:live-conformance` | 无 Key/错 scope/复用/过期/Leader调用模型/schema/task状态漂移 fail closed；Secret不在普通env/inspect/log/stdin child output；固定secret mount；无Docker socket/Mock fallback | 10 files / 167 定向 tests `PASS`；5 stdin + 12 nested stage + 20 provider-outcome + 13 task-outcome + 7 submission-import真实child cases；第五初审production API import与语义拒绝覆盖；raw bootstrap/dummy secret/ticket/header/raw response/response ID finding 0；隔离project inspect与精确清理 PASS | `PASS` |
| 无 Owner Secret 真实 AgentTeams 诊断 | `npm run verify:live-agentteams-no-secret` | 固定六成员走过 Project/DAG/member/dispatch；在任何外部 Provider request 前因 Secret unavailable fail closed；host receipt、PG failure、zero-action、清理精确 | final clean Head 诊断须为 `PASS`：stage `PROVIDER_REQUEST`、outcome `DEEPSEEK_SECRET_FILE_UNAVAILABLE`、`projectCreated/dagPlanned/projectDispatched=true`、model receipts 0、`liveProviderVerified=false`、external action 0；AgentTeams/Compose/临时目录 cleanup PASS；由 `live-agentteams-no-secret-diagnostic.json` 绑定 | `PASS / NOT A LIVE MODEL CLAIM` |
| Browser / Storybook | current Compose API + production Web + Storybook + `npm run verify:browser` | 16 状态、显式 Mock/Live/model/maturity/Coordinator 引导、真实 Blink、zh/en、390px、UX-M1-001、四 Review | `status=PASS`；16 stories；Mock/Live 与未发布/零动作/Coordinator 边界断言；desktop/mobile document width 等于 viewport；reviewed=4；5 张 screenshot；console error/warning 均为 0 | `PASS` |
| Fresh Compose / Recovery | `npm run verify:compose` | broken migration/DB unavailable fail closed，fresh health，DB/blob restart/down-up，Live migration/no action，cleanup | current-source `result=PASS`、`cleanup=PASS`；6 migrations；forbidden action table 0 | `PASS` |
| Build / Storybook / Static | `npm run verify` | lint/type/test/messages/status/report/secret/compose/profile/license/SBOM/build/Storybook | lint零warning；29 files/270 tests；99双语keys；39 status modules且canonical状态diff=0；243个tracked文件Secret scan；958个inventory packages；Next production build与Storybook browser-safety全通过 | `PASS` |
| Security / License / SBOM | `npm audit --audit-level=high --json`；`npm run verify:dependencies`；`npm run check:secrets` | 0 high/critical；无 disallowed license/Secret | Next `16.2.12` 升级到 `16.3.0` 后 audit 为 0；958 个 inventory packages、disallowed license 0、CycloneDX SBOM 已生成 | `PASS` |
| Source ZIP / Evidence | `npm run evidence:package-source && npm run evidence:manifest` | clean committed Head；文件/bytes/SHA-256/Secret/path/CRC/content-to-Git scan；必要evidence全PASS | Fix 6 final包从新clean Head重建，manifest绑定正确初审语义、第五TASK_SUBMIT导入、7类submission-import outcome、完整八Task stateActions与fail-closed mutations；local failure receipt明确排除，精确files/bytes/SHA-256由handoff记录 | `PASS` |
| DeepSeek Live Canary | `npm run uat:live-deepseek`（仅 Coordinator本地交互式执行） | 真Key不进入参数/history/env/inspect；固定六成员/八Task、7 receipts、`AWAITING_OWNER_REVIEW`、zero-action；redacted evidence | 前三次receipts=0；第四次3个；第五/第六次5个后correction Task协议关闭；第七次5个后，AgentTeams initial Audit已submit/check，精确在Control Plane `TASK_SUBMIT`导入关闭，outcome=`LIVE_TASK_SUBMISSION_IMPORT_FAILED`，zero-action/cleanup PASS。Fix 6已公开安全复现并修复初审schema/normalize/materialization漂移；第八次仍由Coordinator执行 | `PENDING / SEVEN FAILED ATTEMPTS / SEVENTH EXACT AT INITIAL-AUDIT IMPORT / NOT LIVE_PROVIDER_VERIFIED` |

GitHub Actions 未 Push，因此远端 CI run 为 `NOT_CLAIMED`；这里只声明本地 CI-equivalent 门禁。

## 五、验收标准结果

| Criterion ID | 结果 | Evidence | 说明 |
|---|---|---|---|
| AC-01 | `PASS` | `agentteams-real-runtime.json`、team profile、真实容器/Project | 固定 v1.2.0；恰好 1 Leader + 5 Worker；八个因果 Task；Leader projection 只有 Mission/Project 编排，无 Campaign 或领域 Artifact。 |
| AC-02 | `PASS` | RoleContext/SkillLock/permission tests、真实 Submit | 六个 identity/context；五 SkillLock；Producer/Auditor 提交与权限分开；Auditor不能编辑、Owner review、Grant 或外部动作。 |
| AC-03 | `PASS` | Adapter/API/domain/task-protocol tests、real runtime evidence | Project dispatch绑定官方source digest、六actor/identity与DAG；八Task逐个先inspect，完整证明`DELEGATE/ACK/IMPORT_ACK/RUN_DOMAIN/SUBMIT/CHECK_IMPORT/ACCEPT/COMPLETE`；Task receipt绑定Project/actor/attempt/前序ACK/CHECK/observation，复制延迟、错配、抢跑、未认证、未知状态与重放均隔离。 |
| AC-04 | `PASS / LIVE PENDING` | `provider-conformance.json`、provider/live-security/outcome/schema tests、manifest negative mutations；`deepseek-live-canary.json`待Coordinator | 官方模型/peak价格/URL核验；flash/pro精确cost与usage一致性；initial Audit冻结X FAIL/其他PASS及re-audit X PASS在schema、normalize、materialization三层一致；structured receipt与strict provider/task/submission-import outcome、无换模/Secret。第七次真实Canary有5个accepted receipts但Mission未完成，故`LIVE_PROVIDER_VERIFIED=false`。 |
| AC-05 | `PASS` | DB/API/real runtime evidence、UI | 同一 PostgreSQL Campaign/Mission 导入 X/Bluesky/LinkedIn/小红书 5 个 immutable Revision（四平台 + X v2），M1 UI 合同可 Review。 |
| AC-06 | `PASS` | fault/audit/trace evidence | 首轮 Auditor Task 后，X v1 Beta→GA 以 active `FAIL` 持久化，包含 `CLAIM_OVERREACH`、Evidence Ref 与下一责任 Producer；修正前不存在 X v2；Grant/Occurrence execution/Action 均 0。 |
| AC-07 | `PASS` | Revision/Audit/OwnerReview tests、browser | X v2 新 digest；旧 Audit `INVALIDATED`；独立 Auditor 重审 PASS；四个平台 exact Revision 进入非执行 Owner Review。 |
| AC-08 | `PASS` | real runtime restart、PG/API restart、duplicate/divergence negative | Leader 与 API restart 恢复；accepted output 不重复；Mission envelope 不承载历史，normalized rows 重构精确 ETag；aggregate scalar poison 被忽略、normalized row 篡改被拒绝，不存在 AgentTeams-only business success。 |
| AC-09 | `PASS` | 16 Storybook state + product browser evidence | zh/en 覆盖显式 Mock/Live 选择、Live waiting、empty/blocked/queued/running/waiting/needs-owner/failure/timeout/cancelled/unknown/recovery/audit-blocked/revision/complete；模型/成熟度/Coordinator/下一责任人/未发布边界清楚，Trace 渐进披露，390px 无 document overflow。 |
| AC-10 | `PASS / LIVE PENDING` | unit/DB/API/runtime/provider/browser/Compose/secret/license/SBOM/build evidence | 所有无 Secret 可执行门禁在最终 Closeout 完整回填；真实 Runtime、Mock Provider 与待执行 Live Provider 三种成熟度严格分开。只有 Coordinator 的 redacted Canary 可把 Live 提升为 `LIVE_PROVIDER_VERIFIED`。 |
| AC-11 | `PASS` | code/table/route scan、Compose/API/real runtime noAction | 无 Connector、Schedule execution、ActionGrant、platform credential/action、客户资料、业务或生产声明；action tables/routes/count 均 0。 |
| AC-12 | `PASS / EXTERNAL GATES PENDING` | 本报告、Pro URL、clean source ZIP/manifest、结构化 handoff | Executor 文档、公开安全包、既有 Pro `PASS_EVIDENCE_READY` 与 CR2 结构化 handoff完成；Live Canary、Owner UAT、Coordinator acceptance 仍 `PENDING`，因此只建议工程 `EVIDENCE_READY`、不宣告 `ACCEPTED`。Canonical status 文件保持 Coordinator-owned。 |

## 六、Owner 参与验收

### UAT-00｜Coordinator 独立 DeepSeek Live Gate（Owner UAT 前置）

- **为什么必须由 Coordinator 执行：**Executor不接触Owner Secret；第七次Coordinator真实调用只完成5/7 receipts，并在initial Audit `TASK_SUBMIT`导入关闭；只有第八次本地真实调用和redacted evidence能把`LIVE_PROVIDER_VERIFIED`从`false`改为`PASS`。Mock、fixture、Provider conformance或真实AgentTeams+Mock均不能替代。
- **前置条件：**checkout 本报告最终 clean Head；Docker Desktop 运行；Node `24.16.0` / npm `11.13.0`；本地持有有效 DeepSeek 测试 Key；固定端口 `3129/4129`、AgentTeams `18080/18001/18088/18888/28333` 及全局 AgentTeams 容器名均空闲；不得停止或复用 `lumiclaw-sdd001-owner`。先确认 `git status --short` 为空并运行 `npm ci`。
- **Secret 输入边界：**只运行无 Secret 参数的 `npm run uat:live-deepseek`。启动器在 TTY 中无回显读取 Key，自动生成独立 runtime bootstrap，创建 0600 临时文件，再只把文件路径传给 Compose secret mount。不要 `export` Key，不要写 `.env`，不要把 Key 粘到命令参数、聊天、报告、截图或网页；不要把 Key 发送给 Executor、Pro 或子代理。
- **操作步骤：**
  1. 在最终 Worktree 的交互式终端运行 `npm run uat:live-deepseek`；在隐藏提示输入 Key。确认输出 `CONTROL_PLANE_READY`、Web `http://127.0.0.1:3129/zh-CN/mission`、`secretInContainerEnvironment=false`，并列出恰好两个 `/run/secrets/...` target。
  2. 打开 Web，使用公开 synthetic fixture 创建并保存 Campaign；选择“真实 DeepSeek 测试运行”。确认状态为“等待本地 Runner”，显示 `deepseek-v4-flash`、`LIVE_PROVIDER_CANARY`、“本地真实模型 UAT，需要 Coordinator 启动 Runner”“不是线上常驻服务”“未发布”。
  3. 从页面复制三个公开标识：Organization ID、Live Mission ID、Campaign digest，依次粘回终端提示；不要粘贴 Key。启动器会在内存中生成严格四字段 JSON并经captured stdin pipe交给Runner，不应显示runtime bootstrap、ticket或request header。Runner应自举官方AgentTeams v1.2.0精确六成员并只领取该Mission；失败只显示strict allowlisted envelope，可含`status/code/stage/providerOutcomeCode/taskProtocolOutcomeCode/taskProtocolStatus/missionId/evidence/secretPresent=false/liveProviderVerified=false`，不得出现任意异常文本。
  4. 等待终端输出 `status=PASS`、`maturity=LIVE_PROVIDER_VERIFIED`、`memberCount=6`、`taskCount=8`、`modelReceipts=7`、state `AWAITING_OWNER_REVIEW`、`externalActionCount=0`。不要在此时把 Runtime 日志或 Secret 文件打包。
  5. 刷新 Mission 页面，展开技术证据：Leader 应标注“只编排、不调用模型”；七个领域 Task 各有 provider/model/token/cost/latency/schema/digest/redacted receipt；Producer 与 Auditor receipt/角色不同。打开 Review，确认四平台草稿、首审 FAIL、修订、旧审计失效与复审 PASS；完成四个 exact、不可执行 Owner Review。
  6. 成功时保存只读 redacted `.evidence/sdd-002/deepseek-live-canary.json` 与必要页面截图/console 摘要；回到终端按 Enter，让启动器只清理精确 project `lumiclaw-sdd002-live-uat-cr2`、其 volumes、临时 Secret 文件和精确 AgentTeams runtime。失败时不要继续 Owner Review；等待启动器自动清理后，保存 `.evidence/sdd-002/deepseek-live-failure.json` 的只读副本或 SHA-256。该收据必须显示 `agentTeams/controlPlane/secretDirectory=PASS`，且不得加入 public source ZIP/run manifest。
- **期望可见结果：**网页刷新不丢进度；真实模型只参与七个领域 Task；Auditor 独立；Mission 只到 Owner Review/`COMPLETED_SHADOW`，所有内容未发布；ActionGrant/Connector/External action 均为 0；证据 `secretPresent=false` 且不含 Key、Authorization、Bearer 或 raw ticket。
- **失败信号：**无 Key 仍运行、Runner 领取别的 Mission、Campaign/runtime digest 不匹配仍继续、Leader 有 ModelCallSnapshot、七个 receipt 不齐、Auditor复用 Producer 输出自审、任何失败切回 Mock、网页刷新归零、Key 出现在 `docker inspect` 的 `Config.Env`/日志/证据/客户端、出现 Docker socket、ActionGrant/Connector/发布暗示。任一出现都必须保持 `FAILED` 并停止 Owner UAT，不得变通。
- **需要返回的证据：**成功时返回 clean Head、三个公开 ID、redacted Canary JSON 的 SHA-256、终端 PASS 摘要、Mission/Review/七 receipt/零动作截图、API/浏览器 console error摘要、`docker inspect`的Secret target与`secretInContainerEnvironment=false`结论，以及书面`UAT-00 PASS`。失败时返回 clean Head、三个公开 ID、strict allowlisted envelope、`deepseek-live-failure.json`的SHA-256与其中stage/code/providerOutcomeCode/taskProtocolOutcomeCode/submissionImportOutcomeCode/taskProtocolStatus/progress/modelReceiptCount/noAction/cleanup字段；绝不返回Key、Secret文件、Authorization header、ticket、prompt、raw model output、response ID、HTTP body或raw child stdout/stderr。
- **清理 / 回滚：**启动器正常结束会自动执行精确 Compose/runtime 清理并删除临时文件。中断时同样 fail closed 并 best-effort 清理；如需人工核对，只允许对精确 project 执行 `docker compose -f compose.yml -f compose.live-deepseek-uat.yml --project-name lumiclaw-sdd002-live-uat-cr2 down --volumes --remove-orphans`，但该命令需要本轮启动器仍持有的临时 secret-file path，通常应直接让启动器完成清理；不得全局 prune。
- **Coordinator 结果：**第一次`FAIL / stdin transport defect`；第二次`FAIL / old generic pre-dispatch code, receipts=0`；第三次`FAIL / Worker loopback broker, receipts=0`；第四次`FAIL / LIVE_MODEL_SEMANTIC_OUTPUT_INVALID at PRODUCE_FOUNDER, receipts=3`；第五/第六次均`FAIL / TASK_PROTOCOL at PRODUCE_FOUNDER_CORRECTION, receipts=5`；第七次`FAIL / LIVE_TASK_SUBMISSION_IMPORT_FAILED at initial AUDIT TASK_SUBMIT, receipts=5`，failure receipt SHA-256=`6b9195ffc0e881e69ae7e5be26eadcf9a136f6c42502e1493bd7eeb32687e8f8`。Fix 6后第八次重试`PENDING / LIVE_PROVIDER_VERIFIED=false`；失败仍只返回allowlisted receipt，不返回raw output。

### UAT-01｜真实六成员 SHADOW Mission、故障拒绝与精确 Review

- **为什么需要 Owner 验证：**机器能证明合同与 Runtime，但只有 Owner 能判断 Mission/Audit/Review 的业务语言、责任交接与“不可执行”边界是否足够清楚。
- **前置条件：**UAT-00 已由 Coordinator 返回 `PASS`；由 Coordinator checkout 最终本地 Commit；Docker Desktop 运行；Node `24.16.0` / npm `11.13.0`；不要在 Owner 浏览器输入任何 API Key；不要停止现有其他 project。Owner 可使用 UAT-00 保留到按 Enter 前的 Live Mission，或另选未占用端口执行公开安全 Mock。
- **安全 / 数据说明：**只使用仓库 synthetic fixture；不填写真实公司、客户、账号、Claim、Evidence URL 或私密材料；整个流程不会连接平台或创建 ActionGrant。
- **操作步骤：**
  1. 在 Worktree 运行 `npm ci`，再运行 `LUMICLAW_WEB_PORT=3126 LUMICLAW_API_PORT=4126 docker compose --project-name lumiclaw-sdd002-owner up --build --detach --wait`。
  2. 打开 `http://127.0.0.1:3126/zh-CN`，确认 `GOVERNED SHADOW / NOT_LIVE`、`external action FALSE`、Grant/Connector/Action 均为 0。
  3. 创建并保存 synthetic Campaign；进入 Mission，启动公开安全 SHADOW Flight。确认显示六成员，Leader 标注“只编排”，两个 Producer 与 Independent Auditor 分开。
  4. 打开 X fault：确认 v1 的 Beta→GA 主张为 `FAIL`，显示 Evidence、`CLAIM_OVERREACH` 与下一责任角色；确认没有“批准/发布/执行”按钮。
  5. 打开 X v1→v2 Diff，确认旧 Audit 为 `INVALIDATED`、v2 有独立 `PASS`；依次对四个平台最新 PASS Revision 记录 `READY_FOR_FUTURE_EXECUTION` Review。
  6. 刷新页面并重启该 project 的 `postgres api web`，以同一 Campaign/Mission 重开；确认四个 Review、Revision/Audit/Trace 仍存在，Grant/Connector/Action 仍为 0。
- **期望可见结果：**Owner 能说明六个成员的责任；故障先拒绝、由准确 Producer 修正、独立 Auditor 重审；Review 绑定 exact digest 且明确不可执行；重启后证据不丢。
- **失败信号：**成员不是六个、Leader 产生平台内容或模型 receipt、Auditor 改稿或批准、FAIL 未带 Evidence/下一角色、旧 Audit 仍 active、可 Review FAILED revision、出现 ActionGrant/Connector/“已发布”、刷新后状态丢失。
- **需要返回的证据：**Mission 六成员截图、X FAIL+Evidence 截图、X Diff/invalidated+PASS 截图、四 Review+零动作截图、Campaign/Mission/Project ID，以及书面 `UAT-01 PASS` 或失败 AC ID。
- **清理 / 回滚：**`docker compose --project-name lumiclaw-sdd002-owner down` 保留 fixture；若 Owner 明确不要保留，才加 `--volumes --remove-orphans`。不得全局 prune，不得操作 `lumiclaw-sdd001-owner`。
- **Owner 结果：**`PENDING`

### UAT-02｜双语、390px、Trace Drawer 与 UX-M1-001

- **为什么需要 Owner 验证：**信息层级、禁用原因、移动端可理解性与双语自然度属于用户判断，不能只由 DOM 断言替代。
- **前置条件：**UAT-01 Mission 已存在；Chrome/Edge 可切换 desktop 与 `390 × 844`。
- **安全 / 数据说明：**只读本地 fixture；不要输入 Key、真实资料或平台凭据。
- **操作步骤：**
  1. 在 desktop 打开 `/zh-CN/mission` 与 `/zh-CN/review`，从业务摘要逐步展开 Trace/Evidence Drawer；确认默认不强迫用户先读技术事件。
  2. 找到 UX-M1-001 两张边界卡：一张说明 Claim/Evidence 只阻止未来执行；另一张说明排程草稿只因“未保存内容”或“DST fold 未选”禁用。
  3. 制造未保存内容与 DST overlap 两种情况，分别核对按钮旁原因包含明确下一步：“先保存再绑定 exact Revision”或“选择 EARLIER/LATER”。
  4. 打开 `/en/mission`、`/en/review`，确认 stable state code 未被翻译为持久化值，且没有 raw key。
  5. 切换 `390 × 844`，检查 Mission、Audit、Diff、Review、Drawer；document 不应横向滚动，所有关键按钮与零动作边界可见。
- **期望可见结果：**Owner 能在不读原始 Trace 的情况下理解当前状态与下一责任人；两类禁用原因不会互相误导；中英文与 390px 均可完成 Review。
- **失败信号：**Claim gap 被说成排程草稿禁用原因、按钮无可操作原因、Trace 技术字段压过业务结果、英文 raw key、390px document overflow、Review/zero-action boundary 被遮挡。
- **需要返回的证据：**中文 desktop、英文、390px、两张 UX-M1-001 边界与两种禁用原因截图，console error 摘要，以及书面 `UAT-02 PASS` 或失败 AC ID。
- **清理 / 回滚：**同 UAT-01；只清理精确 `lumiclaw-sdd002-owner` project。
- **Owner 结果：**`PENDING`

### UAT-03｜Mock Conformance 与 Live Canary 成熟度只读复核

- **为什么需要 Owner 验证：**Owner 需要确认成熟度标签没有把 Mock Model 说成真实模型，也没有把真实 AgentTeams 工程运行说成业务成功。
- **前置条件：**Coordinator 提供最终 `.evidence/sdd-002/agentteams-real-runtime.json`、`provider-conformance.json`、run manifest，以及仅在 UAT-00 成功后生成的 `deepseek-live-canary.json` 只读副本。
- **安全 / 数据说明：**不要提供 DeepSeek/EvoLink Key；只读 redacted evidence，不要向 Owner 浏览器输入 Secret。
- **操作步骤：**
  1. 核对 Runtime 为 AgentTeams v1.2.0，`realAgentTeamsAcceptance=true`、member count 6、Project/task count 8、restart recovered、self-provisioned/cleanup PASS。
  2. 核对同一证据写明 `realModelAcceptance=false`、model maturity `MOCK_CONFORMANCE`。
  3. 核对 Provider conformance 中 DeepSeek/EvoLink 外部 Canary 是 `NOT_RUN_NO_KEY`，该文件不能作为真实调用证据；再核对 UAT-00 的独立 Canary 文件（若 PASS）为 `LIVE_PROVIDER_VERIFIED`、七个 redacted receipt、`secretPresent=false`。EvoLink 仍未运行。
  4. 核对三类成熟度互不替代：真实 AgentTeams + Mock Model、DeepSeek Mock Conformance、Coordinator 单次 Live Provider Canary；三者 no-action 均为 0/false。
- **期望可见结果：**Owner 书面确认 Runtime、Mock Conformance 与 Live Canary 是三条不同成熟度；真实 DeepSeek 只声明本地单次 UAT，不声明生产、客户或业务结果。
- **失败信号：**任何字段暗示 Mock 是真实 DeepSeek/EvoLink、单次 Canary 是线上常驻/生产、存在 Secret、外部动作不为 0、版本/digest 不清楚。
- **需要返回的证据：**对 Runtime/Mock/Live 三个成熟度与 no-action 字段的书面确认，或失败字段路径。
- **清理 / 回滚：**只读，无需清理。
- **Owner 结果：**`PENDING`

## 七、ChatGPT Pro 双代理记录

- 对话链接：<https://chatgpt.com/c/6a71005f-4fa0-83ea-902c-fb3ace4b8a68>。
- 首轮 WIP 包：Base `4377103b3fea493a591af7f069fd697d9601f1ca`，205 files，`947,625` bytes，SHA-256 `fb61b048ae412a561fd88d0b43215caa30da844749a80b9853c0411bf99b9dde`；路径/content secret scan `PASS`。
- Pro 首轮结论：`FAIL_NOT_EVIDENCE_READY`。八项主要问题是：API complete path 绕过 Adapter；fixture evidence 成熟度标签过高；Auditor/修正版被脚本直接构造；accepted output 可被不同 digest 覆盖；Runtime observe 失败被错误标成 reconciled；PG restart 只读 aggregate JSON；没有真实六成员 Project/Task/ACK/Submit；Compose/browser/SBOM/report 仍接 SDD-001。
- Codex 独立修正：新增 Runtime event import 与 exact accepted Payload materializer；真实 AgentTeams 动态 Project/Task ID 与同一 PG Mission/Campaign 绑定；Independent Auditor 真实 Worker Submit；accepted duplicate/conflict quarantine；observe failure 保持 `UNKNOWN_RECOVERY`；aggregate 与 normalized child history 双向校验；真实六成员 verifier；全部 SDD-002 evidence/package/report 路径与门禁。
- 二轮候选包：Head `1051e062ae9cc5189bc9c8b2a1637b3afa4e8e65`，212 files，`1,000,413` bytes，SHA-256 `1b917690ebeb72efa182dc66fc7bdacbae3dc50d9612b729e12c002ea1ab2e5f`；secret/path scan `PASS`。
- Pro 二轮结论：`FAIL_NOT_EVIDENCE_READY`。五个聚焦问题是 host 预构造领域 payload、Auditor decision 预定义、PostgreSQL aggregate 仍可充当权威历史，以及 API receipt 缺少真实 Project/ACK/attempt/actor/result 来源绑定，相关 evidence gate 只证明结构而没有证明来源。
- Codex 二轮独立修正：删去 verifier 的 host `payloadByRole`；六个 Worker 容器分别调用公开安全 Provider，Auditor 从两个 Producer 的 AgentTeams persisted summary 计算 decisions；引入 Project/member/DAG、Task ACK、Task Submit/result receipt digest 因果链；Mission JSON 变为无历史 envelope，读取只从 normalized rows 重放并校验 ETag/Trace/Ledger/receipt；新增 aggregate poison 与 normalized tamper 正反证据。
- Pro 三轮结论：`FAIL_NOT_EVIDENCE_READY`，无 P0，五个 P1：初版与修正版仍在同一次 Producer/Auditor 输出中、PostgreSQL 幂等 replay 未验证 normalized authority、Runtime receipt/API import 仍可能由普通调用者伪造、最终 manifest/CI 未强制因果来源且真实 verifier 依赖预置环境、所有 Worker 收到完整 Campaign 而非 RoleContext projection。
- Codex 三轮独立修正：将 DAG 改为八 Task/三阶段持久化，首审 active FAIL 后才释放 Producer attempt 2，再释放 Auditor attempt 2；PG idempotent replay 重构并验证 normalized state，新增 row tamper replay negative；Runtime import 增加 ephemeral adapter authentication，receipt 固定 `AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY` 与 observation digest；manifest/CI 改为 SDD-002 并强制 8 Task/三状态/自举清理证据；新增官方 source digest + installer 的单命令环境自举；每个 Worker 只接收职责投影且 Provider 拒绝完整 Campaign/upstream。
- 第四轮候选包：Head `6a6aed1fac65d8e6e623373ced286587732d0368`，213 files，`1,019,194` bytes，SHA-256 `7491b577831db7b45d5216a958992a4a98a8d4e7768c41a94d6e0bae024a700e`；ZIP CRC/path/symlink/secret/license scan 均 `PASS`。
- Pro 第四轮结论：`FAIL_NOT_EVIDENCE_READY`，无 P0，五个 P1：最终 manifest 对 malformed/contradictory evidence 仍可能 fail-open；幂等 replay 仍持有 mutable Mission snapshot；Campaign 在时间上变为 blocked 后仍可 create/dispatch Mission；Role projection 没有贯穿 Task/ACK/Submit/observation 且 Provider 可接受跨角色嵌套数据；DeepSeek response model/finish/usage 不一致或截断仍可接受，注入 fake fetch 还可能被标为 Canary。
- Codex 四轮独立修正：幂等表只保留不可变 version/ETag/status metadata，从 normalized current state 重构 replay 并拒绝已推进 checkpoint；Mission create/Project dispatch 重读 current Campaign readiness/version/digest；闭合 Role projection schema/digest 贯穿 Task/ACK/Submit/result/observation，Mock Provider 增加 8 正例与 5 个越权/篡改负例；DeepSeek snapshot 绑定返回 ID/model/fingerprint/finish/usage，拒绝 model mismatch、length/content-filter/null finish/malformed usage，且 `CANARY` 只能访问官方 origin、注入 transport 只能是 `MOCK_CONFORMANCE`；final manifest 强制 source/runtime/provider/PG/no-action 一致性并自测 10 个负向 mutation。
- 第五轮候选包：Head `235c71d5817804d71e72864e854a336dc0b0ded0`，215 files，`1,029,625` bytes，SHA-256 `9958eddf726d8bb623523a7db601b2fd8dfdf0a349144a1c35153df6fe5ece27`；ZIP CRC/path/symlink/secret/license scan 均 `PASS`。
- Pro 第五轮结论：`FAIL_NOT_EVIDENCE_READY`，无 P0，一个 P1：Role projection 的 envelope/第一层 key 已闭合，但八类 projection 内部对象仍未递归闭合；Leader mission ID、Planner plan、Producer source revision、Auditor summary、Audit issue 或 corrected content 可夹带嵌套跨角色/客户对象并重新计算合法 digest。
- Codex 五轮独立修正：为八类 Task 的 Claim、EvidenceRef、ActivationPlan/Unit、ArtifactRevision、四种平台内容、Producer summary/runtime revision、AuditIssue、failed/denied/corrected binding 增加递归 exact-key/type/enum/digest 校验；门禁保持 8 个真实合法 projection，通过 13 个负例（其中 8 个为 Leader/Steward/Planner/Producer/Auditor/Correction/Re-audit 嵌套攻击）全部拒绝。
- 第六轮候选包：Head `67b705ba12202485282ba221c03305f94868eb53`，215 files，`1,032,849` bytes，SHA-256 `81f86218af2d70b41ab1f96a9616da80937e69494b3c2ac48045764ca11b4a37`；ZIP CRC/path/symlink/secret/license scan 均 `PASS`。
- Pro 第六轮结论：`FAIL_NOT_EVIDENCE_READY`，无 P0，两个 P1：Planner 只要求四个 allowlisted unit、未要求四平台各一个；最终 manifest 对缺失 immutable map、任意 projection keys、过薄 license/SBOM、非 Git 内容 ZIP 仍存在 vacuous/self-attested pass。
- Codex 六轮独立修正：Planner 对四平台执行 exact multiset；增加 four-X 与 duplicate-LinkedIn/missing-Xiaohongshu 重算 digest 负例；PG verifier 写入一条 exact OwnerReview 并证明六张历史表不可变；license 与当前 lockfile 的 958 项 exact inventory 绑定；SBOM 与独立重生成的 component/dependency identities 绑定；ZIP 使用固定路径，独立校验 CRC/path/symlink/file set，并把 216 个文件逐字节与 Git blob 比对；manifest 的 fail-closed mutations 从 10 个增至 21 个；公开 metadata 不再记录本机绝对 worktree。
- 第七轮候选包：Head `c31d49461d985b8d9f518646ad8ee9024ff16a62`，216 files，`1,036,431` bytes，SHA-256 `5a08c129d2758a5a05c22ce602ad4a092923e55e3f18c1f1c50dc5b80d62ff88`；本地 package/CRC/path/symlink/content-to-Git/secret/license 与 19-file/21-mutation manifest 均 `PASS`。
- Pro 第七轮结论：`FAIL_NOT_EVIDENCE_READY`，无 P0，两个 P1：Runtime image identity 只逐项检查且长度相同，三个重复的合法 component 可替代精确 embedded-controller/manager/worker 集合；`agentteams-capability-report.json` 只被哈希，空对象仍可能进入 `ENGINEERING_VERIFIED` manifest，未证明 exact role/permission/Skill/profile。
- Codex 七轮独立修正：Runtime manifest 强制三个 component 精确一对一且 repository/tag/digest/platform 全匹配；生产 profile validator 强制 manager/worker 与六角色逐角色 permission/SkillLock；capability report 绑定 current runtime/team profile SHA-256、完整六角色、五 Skill、SHADOW/no-action/mock maturity；manifest 对 capability 做语义验证，内置负向 mutation 增至 38 个，并补 PNG signature/IHDR/精确尺寸门禁。
- 第八轮候选包：Head `7730cb56b6cb7102c7d0f39e92348c7c2a57ffe2`，216 files，`1,040,925` bytes，SHA-256 `1720d8b54d65345f04552b1104a67d573e276115229a8f665c4a52b97346d0cd`；ZIP CRC/path/symlink/content-to-Git/secret/license、19-file manifest 与 38 个 mutation 均 `PASS`。
- Pro 第八轮正式结论：`PASS_EVIDENCE_READY`，`P0=0`、`P1=0`。Pro 独立复现 duplicate/missing/extra runtime component、wrong platform/repository/tag/digest、空/错 capability/role/permission/Skill/profile SHA/SHADOW boundary 与 ASCII/错误尺寸 PNG；全部不能产生 `ENGINEERING_VERIFIED`。不能重跑本地 Docker/PostgreSQL/AgentTeams/Chrome 与 Owner/Coordinator 决策列为 non-blocking limitation，不当作工程失败。
- 修正不是直接采纳 Pro 代码；每项由本地 unit/API/PG/真实 Runtime/浏览器/Compose 证据独立验证。Pro 不能访问本地 Docker/浏览器，也不替代 Coordinator/Owner。
- Coordinator 独立复核在初始 final Head `c26cb9e24c062bf6793f1f4a191f4548dd46a63f` 发现一个阻断 AC-04 的精确计费缺陷：pricing 类型/快照没有 cache-hit 单价，公式按全部 prompt cache-miss 计费，单测把错误的 `0.000028` 固化为通过。最小修正提交 `4dc33de589dd3509c749490dc3662e561f0e9ac9` 增加两模型官方 hit/miss/output rate、严格 usage 一致性、flash/pro 正例和矛盾/半缺省负例；Provider evidence 与 final manifest 继续独立约束该修正。Coordinator/Owner 最终接受决定仍为 `PENDING`。
- Coordinator 在 CR2 Head `c931b77ff723e3d9a098a8a088e8a6e3ffe7cb79` 首次真实 Live 尝试确认 Compose secrets/inspect/Mission 均通过，但发现 launcher→environment verifier→Runner 的四行 stdin 被连续 `readline.question()` 错误消费，Runner status 13 且没有进入 AgentTeams。CR2 Fix 1 使用 exact four-field JSON、每进程一次 fd 0 read、captured stdout/stderr 与 stable redacted codes；新增 5 个实际 child-process case，并把 transport/cleanup 语义加入 Live evidence 与 final manifest。该失败尝试不声明 `LIVE_PROVIDER_VERIFIED`。
- Coordinator 在 Fix 1 Head `8cbb0a85b73cdc73f48d489b66e200f24e3e3562` 第二次尝试确认 Secret/Compose/严格 stdin/恰好六 Worker与清理通过，但 Mission 仍在 `WAITING_RUNTIME`、model receipts 0 时只返回通用 Runner failure。由于旧代码同时丢弃阶段和 raw cause，并在清理时删除 DB/runtime state，具体异常不可恢复。Fix 2 对 12 个阶段建立 exact code、host receipt、两层 strict envelope、cleanup 回填与 forbidden-marker child tests；不通过记录原始日志来“修复”安全问题。
- Executor 在不接触 Owner Secret 的 clean `463bf545e74da50a480c38cee7b9eba8b6256a26` 运行真实六成员受控诊断：Project/DAG/member/dispatch 全通过，随后 unavailable-secret broker 在外部 Provider request 前关闭，收据为 `PROVIDER_REQUEST / LIVE_PROVIDER_REQUEST_FAILED`、model receipts 0、zero-action/cleanup PASS。原第二次 Canary 的具体 transient functional cause 未稳定复现，因此不声称修复了未经证实的 AgentTeams缺陷；下一次 Coordinator重试会给出可诊断阶段。
- Coordinator 在 Fix 2 Head `356a9cac79d49cbda05b5fad8855c93363159183` 的第三次真实尝试走过 runtime/project/DAG/member/dispatch 后失败；model receipts 0、zero-action与 cleanup PASS。Fix 3 no-Secret真实复现证明旧 Worker把宿主loopback当容器loopback，未到达API；严格 Worker broker origin映射后，同一六成员路径到达API并得到 `DEEPSEEK_SECRET_FILE_UNAVAILABLE`。同时20类 task-level outcome各自通过nested child pipe，任意 body/prompt/model content/response ID/header/ticket/bootstrap/raw异常不透传。
- Coordinator 在 Fix 3 Head `f8750bdc33c699ec8f9b74f73705c9e38d357989` 的第四次真实尝试首次形成3个accepted DeepSeek receipt，随后 `PRODUCE_FOUNDER` 以 `LIVE_MODEL_SEMANTIC_OUTPUT_INVALID` 关闭；zero-action与cleanup PASS。Fix 4确认clone/delete schema没有表达 exact platform set与platform/content.kind，现用五类closed task schema、动态correction source const与8 valid/15 invalid conformance收口；不读取或保存raw模型输出。
- Coordinator 在 Fix 4 Head `5a669de2a68515535b96ea11c6b90ed8c423a7e7` 的第五与第六次真实尝试都接受5个DeepSeek receipt，随后correction保持`ASSIGNED`、re-audit保持`WAITING_DEPENDENCY`并以`TASK_PROTOCOL`关闭；zero-action与cleanup PASS。Fix 5没有向Pro、子代理或Executor传递Owner Secret，也没有新增外部Pro URL；工作由本地官方AgentTeams源码、真实六成员/八Task Runtime、无Secret Control Plane路径和全门禁独立核验。auto-delegate假设被证伪；历史exact operation因旧诊断缺失不可恢复，现有13类task outcome让第七次尝试可在不泄漏raw材料的情况下精确区分状态/操作失败。
- Coordinator 在 Fix 5 Head `b85ef2494b631415a0545f03154a285c19ae2786` 的第七次真实尝试接受5个DeepSeek receipt，并证明 initial Auditor 的 AgentTeams Submit/CHECK 与 RuntimeSubmission构造已完成，只在 Control Plane `TASK_SUBMIT`导入失败。Fix 6不接触Owner Secret/raw output，也没有新增Pro URL；公开安全确定性Provider通过同一production API ticket/model/runtime-event路径复现并修复跨边界初审语义漂移，7类submission-import诊断只传稳定分类。第八次真实验证仍完全由Coordinator执行。

## 八、失败、限制与非声明

- **已发现并修复：**Pro 首轮八项、二轮五项、三轮五项、四轮五项、五轮一个递归投影缺口、六轮两个 evidence-contract 缺口与七轮两个 runtime/capability manifest 缺口均已在源码与独立门禁中定向收口；Runtime quarantine 的幂等重放保持 422/`accepted=false`；Mission 只允许一个 Project dispatch，restart 必须 reconcile；普通 public API 调用者不能导入 Runtime success；旧幂等 checkpoint 不会返回 mutable Mission snapshot；最终 manifest 不接受空集、自证、重复 runtime component、空 capability report 或非 Git ZIP。
- **已发现并修复：**`npm audit` 曾从 Next `16.2.12` 的 transitive `postcss/sharp` 报告 3 个 high；升级到 Next `16.3.0` 后 audit 为 0，生产 build/API/Browser/Compose 重新验证。
- **已发现并修复：**最终真实浏览器门禁捕获 Storybook `/favicon.ico` 404；为 preview 注入内联公共安全 SVG icon，并把 CDP 错误证据扩展为具体 URL。重跑后 console error/warning 均为 0。
- **已发现并修复：**Coordinator 发现 DeepSeek cost snapshot 忽略 `prompt_cache_hit_tokens` 的官方低价且 usage 细分可自相矛盾。现分别按 cache hit/miss/output 计费；两细分同时存在时必须精确等于 `prompt_tokens`，只出现一项时 fail closed，两项均缺省时全部按 miss 计价，避免静默低估。Provider 单测新增 flash/pro/缺省正例与三类不一致负例；final manifest 对错误费用、缺 hit 单价和缺一致性证据做 mutation 拒绝。
- **已发现并修复：**Coordinator 首次 Live UAT 暴露四次非 TTY `readline.question()` 的 EOF/unsettled top-level await 缺陷及 bootstrap 终端暴露风险。现在 launcher/environment/Runner 只传一个严格四字段 JSON；fd 0 每层只读一次，子输出全部捕获，错误只允许 stable JSON code。完整/partial/malformed/extra-field child-process tests 与 Live conformance 均证明 bootstrap/dummy secret/header 不在 stdout/stderr；失败尝试的 exact Compose/AgentTeams/temp objects 已清理。
- **已发现并修复：**第二次 Canary 暴露三层通用错误折叠和清理后证据丢失。现在 12 阶段各有唯一 code；host receipt 在清理前原子落盘，严格绑定 clean Head/Mission/runtime/progress/no-action，环境与 launcher完成各自清理后只回填三项 cleanup。35 个定向合同及 12 个实际 nested stage cases 证明 bootstrap/ticket/Authorization/Bearer/raw response/任意异常文本不会透传；failure receipt 从 public ZIP/manifest 排除。
- **已发现并修复：**第三次 Canary 的真正功能根因是 Worker容器把宿主 `127.0.0.1` 当成自身loopback，因而从未到达API。Fix 3只把strict本地Host origin映射为Worker侧 `host.docker.internal`；no-Secret真实六成员复验精确到达API并持久化 `DEEPSEEK_SECRET_FILE_UNAVAILABLE`。API非2xx时Runner再重开exact Mission，从failed Task/Mission/snapshot一致性提取allowlisted outcome；HTTP 401/402/404/429/500/502/503/504、timeout/unavailable、identity/model/finish/usage/response/JSON/schema/semantic/broker/success均有API/child测试，冲突/未知统一关闭为 `LIVE_PROVIDER_BROKER_FAILED`。
- **已发现并修复：**`DeepSeekModelProvider`此前只在本地验证 `request.outputSchema`，却没有把 schema发给模型，system prompt 所称 supplied role schema实际缺失，input digest也未绑定schema。现在 user message含 exact `{input,outputSchema}`、digest绑定同一 schema；首个 `FREEZE_EVIDENCE` fixture的错误 JSON shape以 `MODEL_SCHEMA_INVALID`拒绝，精确 `{frozen:true, assessment:<非空>}`成功。第三次失败的历史 task-level code已不可恢复，因此这是确定的产品合同缺陷修复，不是对历史 root cause的无证据断言。
- **已发现并修复：**第四次 Canary 证明旧 generation schema会接受 normalize拒绝的Founder输出。根因是从通用持久化schema删除派生字段后，platform enum与content oneOf仍独立，且数组长度不等于exact platform set。Fix 4为Founder/Product/Correction/Audit/Re-audit分别生成闭合schema，以`contains`+精确长度表达无序集合，以platform const分支绑定content.kind，并把Correction content动态绑定到source const；revision/digest为禁止的额外字段。Normalize和最终持久化校验未放宽，re-audit错误平台不能被重标为X。
- **已发现并修复：**第五/第六次 Canary 重复暴露同一成员接管第二个依赖Task时的盲Task协议与诊断缺口。官方源码与真实Runtime证明correction操作前为`pending/null/DELEGATE`，证伪“Runtime自动delegate导致重复delegate”；旧收据无法恢复实际失败操作，故不做历史猜测。新Runner先inspect Leader DAG与assigned Worker材料，按八步闭合状态机执行，并绑定project/task/member/role/attempt/dependency/contract digest与PG receipt；13类task outcome携带严格`planStatus/taskStatus`，未知/矛盾/重放/不安全模型恢复全部fail closed。
- **已发现并修复：**Fix 5无Secret真实路径捕获两个Runtime集成缺陷：官方整秒UTC时间戳与JS毫秒UTC快照此前被误判，现只接受两种规范形式并按同一instant比较；Leader与Worker Task副本在delegate/ACK边界短暂不同步，现Leader负责Project/DAG、assigned Worker负责TaskMeta/spec/result，仅Worker三者全缺省时精确回退Leader，部分副本禁止回退。最终八Task的完整八步stateActions与同成员attempt 2均由真实AgentTeams验证。
- **已发现并修复：**第七次 Canary 把第五模型任务的失败精确定位到 initial Audit `TASK_SUBMIT`导入。公开安全生产路径复现证明旧 generation schema/normalize允许全PASS或其他任意初审组合，而materialization冻结要求X `CLAIM_OVERREACH/BLOCKING` FAIL、合法Evidence Ref与Founder下一责任人，其他三平台PASS；这使坏输出先成为第五ModelCallSnapshot、再在导入时失败。Fix 6使schema、normalize、materialization同义且无强制修正；正确初审导入成功，全PASS及其他语义变体在Provider边界fail closed。
- **已发现并修复：**旧顶层诊断只能报告`LIVE_TASK_SUBMISSION_IMPORT_FAILED`。Fix 6增加7类closed `submissionImportOutcomeCode`，只由HTTP status与allowlisted API code映射；未知/任意异常统一`LIVE_SUBMISSION_IMPORT_UNCLASSIFIED`。7个真实nested child cases证明bootstrap/dummy Secret/ticket/Authorization/Bearer/raw response/response ID/details/Traceback/Exception均不出现在stdout/stderr或host receipt。
- **已发现并修复：**最终manifest负向自测把re-audit的`bindingDigest`替换为另一个合法SHA-256时未被旧`exactTaskSet`拒绝，证明旧门禁只验证了摘要格式、没有独立重算。真实Runtime evidence现额外记录public-safe `projectId/runtimeActorId/contractDigest`，manifest用`projectId/taskId/roleId/runtimeActorId/attempt/contractDigest`独立重算并比较；合法格式的伪binding digest也会fail closed。
- **Known limitations：**真实 AgentTeams v1.2.0 CLI 的 controller 显示 `dev`，源 tag commit、source tar SHA-256 与三个 OCI image digest 是验收身份；不能仅用 CLI label 证明版本。
- **Known limitations：**AgentTeams v1.2.0 Projectflow 没有公开 accept checked task result 操作；最小 bridge 见交付范围，不修改上游，实现只适用于固定版本并由 source/image digest 约束。验收命令会占用全局 AgentTeams 容器名与 18080/18001/18088/18888/28333 端口，若已被占用会 fail closed，不会停止或复用现有环境。
- **Known limitations：**真实 AgentTeams Worker 调用的是本地公开安全 deterministic OpenAI-compatible Mock；它证明 Runtime 协作与控制面集成，不证明 DeepSeek 模型质量。
- **Known limitations：**DeepSeek Live代码、无Secret合同与安全ingress已工程验证；第七次Coordinator Canary接受5个receipt，但在7个领域Task完成前于initial Audit导入失败，故`LIVE_PROVIDER_VERIFIED=false`。只有Coordinator第八次带本地Secret完成7 receipts、修订/复审与exact Owner Review才能关闭外部门禁。EvoLink live Canary未运行；Mock/fixture不能替代。
- **Known limitations：**第二次历史异常因旧通用码不可恢复；第三次已由no-Secret路径重现并修复Worker loopback；第四次不保留raw模型文本；第五/第六次也因旧task诊断没有保存具体AgentTeams operation/pre-state，历史exact root cause不可恢复。第七次边界已由strict receipt精确定位并由公开安全fixture复现，但Executor没有也不需要恢复真实raw model output。第八次若失败，必须按新的allowlisted stage/providerOutcome/taskProtocolOutcome/submissionImportOutcome/status诊断，不得猜测或回退Mock。
- **Known limitations：**Scheme A 是本地、Coordinator-started、单 Mission UAT Runner，不是线上常驻 Runtime。它占用固定 UAT Web/API/AgentTeams 端口与全局 AgentTeams 容器名；若冲突会 fail closed。Runner/Worker无 Docker socket和 Owner Key，产品 API/Web也无 Docker socket。未来常驻 supervisor 属于独立 SDD。
- **Known limitations：**API 内存 ticket 在 API 重启后全部失效；正在运行的 Live Mission会保持/进入失败恢复状态，需要 Coordinator重新创建受控尝试，不会自动换 Project、重用 ticket或切回 Mock。
- **Known limitations：**本地 tenant scope 是 organization header + repository/FK validation，不是生产 authentication/authorization/RLS。
- **Known limitations：**没有 Push，GitHub Actions 远端 run 未发生；ChatGPT Pro 只能看公开安全 ZIP；Owner UAT 与 Coordinator 独立复验仍为 `PENDING`。
- **仍为 `PLANNED`：**M3 的 due occurrence、ActionGrant、Action Operator、Connector、Direct/Handoff/Receipt；M4 Response/Learning；hosted production。
- **明确 `NOT_CLAIMED`：**真实模型/媒体质量、真实平台连接或动作、客户 UAT、外部校准、业务结果、增长、线索、收入、安全/法律/合规认证或生产就绪。
- **外部动作审计：**没有 platform request、发布、评论、回复、DM、抓取、Secret、客户资料、Push、PR、Deploy、线上 migration 或线上配置。Executor未运行真实 Provider Canary；后续 Coordinator Canary只调用 DeepSeek模型 API，不调用任何平台 API，仍保持外部平台动作 0。

## 九、回滚与恢复

- **代码 Rollback：**Coordinator 可在本地分支对 SDD-002 提交执行普通 `git revert <commit>`；不重写历史、不使用 `reset --hard`。
- **普通停止/恢复：**仅对明确 SDD-002 project 执行 `docker compose --project-name <exact-name> down` 可保留 named volumes；再次 `up --detach --wait` 从 PostgreSQL 重开 Campaign/Mission。
- **测试数据 Rollback：**只有确认不要保留 synthetic fixture 时才对精确 project 执行 `down --volumes --remove-orphans`；不得全局 prune，不得操作 `lumiclaw-sdd001-owner`。
- **Migration Rollback：**先对本地测试 DB 回退 `000006_live_deepseek_uat.cjs`，再按需回退 `000005_governed_shadow_campaign.cjs`；会删除/降级 Live provider/runtime 状态与 Mission/Task/Revision/Audit/Review/Trace/Ledger/Provider evidence。只允许精确 SDD-002 本地测试 DB，必须先保留所需 redacted evidence，不授权线上 DB。
- **Live UAT 恢复：**无 Key、Runner中断、Provider/schema/digest失败会持久化 `FAILED` 和下一责任人，绝不 Mock fallback。Provider失败从精确Mission导出allowlisted`providerOutcomeCode`；Task协议失败只导出allowlisted`taskProtocolOutcomeCode`与`planStatus/taskStatus`；`TASK_SUBMIT`导入失败另只允许七类`submissionImportOutcomeCode`；host receipt原子写入后再清理精确Compose/AgentTeams/0600临时Secret目录并回填cleanup。Coordinator只返回脱敏字段/SHA，不返回raw日志/body。不得用全局Docker prune。
- **Runtime 恢复：**每个Task都从PostgreSQL authority、同一runtime Project和Leader/assigned Worker副本reconcile；只允许闭合八步状态动作，不安全的已调用模型恢复会`LIVE_TASK_DOMAIN_RESUME_UNSAFE`而非重复调用。API/AgentTeams不可用或observe失败保持`UNKNOWN_RECOVERY`；不得凭AgentTeams completion推断业务成功，不得换Project/Key盲重试。
- **幂等/冲突恢复：**未知响应使用原 Idempotency-Key；重复 accepted output 被隔离，不能覆盖 digest；Project 只能 dispatch 一次；ETag stale 返回 412/409，不静默覆盖。
- **外部补偿：**M2 没有外部动作，因此没有 Connector reconciliation 或平台补偿；如出现任何外部副作用即为 AC-11 失败而不是可接受状态。

## 十、执行任务状态交接

Executor 未修改 `IMPLEMENTATION-STATUS.md` 或 `IMPLEMENTATION-STATUS.zh-CN.md`。两份 canonical progress 由 Coordinator 独立验收后更新。

| Module ID | 当前规范状态 | 建议新状态 | 原因 / Evidence |
|---|---|---|---|
| M2-01 | `IN_PROGRESS` | `EVIDENCE_READY` | v1.2.0 Adapter、Project/DAG/ACK/Submit、digest/schema、timeout/cancel/restart/reconcile、PG shared state通过；八Task真实状态动作、Leader/Worker复制权威、UTC时间戳与同成员attempt 2均有真实runtime证据。 |
| M2-02 | `NOT_STARTED` | `EVIDENCE_READY` | 恰好六成员、Leader only orchestrate、五 SkillLock、RoleContext/permission/identity/submission 分权通过。 |
| M2-03 | `NOT_STARTED` | `EVIDENCE_READY`（工程）/ `LIVE_PROVIDER_VERIFIED PENDING` | DeepSeek official gateway/conformance、flash/pro精确计费、initial Audit与re-audit closed schema/normalize/materialization一致、Live broker/secret/ticket/redaction/七领域任务合同通过；第七次接受5个receipt后在initial Audit导入关闭，第八次仍待Coordinator独立执行；无静默换模/Secret。 |
| M2-04 | `NOT_STARTED` | `EVIDENCE_READY` | 四平台 immutable Revision、独立 Audit、失效/重审、Diff、exact non-executable Review 通过。 |
| M2-05 | `NOT_STARTED` | `EVIDENCE_READY` | Media port、EvoLink no-key boundary、content-addressed ingest、rights/cost、UNREVIEWED 通过。 |
| M2-06 | `NOT_STARTED` | `EVIDENCE_READY` | Trace/Ledger/Evidence Drawer、冻结 fault、FAIL/next role/re-audit/replay/no-action 通过。 |

状态交接摘要：

- Worktree / Branch / Base / Goal：见报告头；全程只使用 Coordinator 指定 Worktree 与一个 Goal。
- Changed Files：CR2主要集中于`packages/governed-shadow`、migration 000006、API Live security/server/OpenAPI、Mission/Review UI、Compose secrets、Coordinator launcher与AgentTeams verifiers；Fix 2增加stage diagnostics；Fix 3增加provider outcome、Worker broker origin与no-Secret诊断；Fix 4增加closed generation schema；Fix 5增加可恢复AgentTeams task planner；Fix 6更新initial Audit/re-audit生成schema与API normalizer，增加production API第五snapshot导入回归、`live-submission-import-outcome.mjs`及真实child diagnostics，并更新Live Runner/environment verifier/conformance/manifest与SDD lifecycle；保留既有M2实现。
- Commits / Final Head：初始 closeout 与 Coordinator 修正提交见报告头；本报告提交后的 exact final Head 由 source-package manifest 与结构化 handoff 记录；最终必须 clean committed，未 Push。
- Status files：相对 Base diff 必须为 0。
- Pro / source ZIP：<https://chatgpt.com/c/6a71005f-4fa0-83ea-902c-fb3ace4b8a68>；第八轮 candidate `PASS_EVIDENCE_READY`；初始 closeout ZIP 216 files / 1,041,580 bytes / SHA-256 `cc218e25860e1236c3b2bdd0900524bac5bad1099699686750bfa63672fab5a2`；Coordinator 修正后的 final clean-Head ZIP hash 在 handoff 记录。
- Push / PR / Deploy / external action：全部 `NO`。
- Blocker：无本地工程 blocker；第七次Coordinator Canary有5个accepted ModelCallSnapshot但未完成Mission，`LIVE_PROVIDER_VERIFIED=false`。第八次必须由Coordinator用Owner本地Secret独立执行；失败只回传strict allowlisted provider/task/submission-import receipt与status，PASS后恢复Owner UAT。Executor不接触Key/raw output，fixture不能替代。
- 下一候选步骤：Coordinator在最终clean Head执行UAT-00第八次重试并回传redacted canary或strict failure receipt；PASS后再执行Owner UAT-01～03与独立复核，最后决定canonical status。本任务不自动开始M3。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS / ENGINEERING_VERIFIED`（无 Secret门禁）
- Live Provider验证：`PENDING / SEVEN FAILED COORDINATOR ATTEMPTS / SEVENTH REACHED 5 ACCEPTED RECEIPTS AND EXACT INITIAL-AUDIT IMPORT BOUNDARY / NOT VERIFIED`
- Coordinator 独立复验：`PENDING`（先 UAT-00）
- 是否需要 Owner 验收：`YES`
- Owner 决定：`PENDING`
- 最终模块状态：建议 `M2-01`～`M2-06 EVIDENCE_READY`，尚未 `ACCEPTED`
- 下一 Module / SDD：`PENDING COORDINATOR DECISION`；本 Executor 不开始 M3。
