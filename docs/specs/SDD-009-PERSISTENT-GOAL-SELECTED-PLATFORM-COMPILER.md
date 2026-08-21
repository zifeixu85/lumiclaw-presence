# SDD-009 — Persistent Goal, Content Plan and Selected-platform Compiler

> Status: `SPEC_READY`
> Milestone: `M5`
> Proposed progress module ID: `M5-07`（待 Coordinator 登记；本文不改变 canonical progress）
> Owner: LumiClaw Presence 产品/设计 Owner
> Goal objective: 将批准知识与持续目标编译为只覆盖已选 X/小红书账号的可执行 Mission 合同
> Target evidence maturity: `ENGINEERING_VERIFIED`
> Acceptance report: `docs/reports/acceptance/SDD-009-ACCEPTANCE.md`
> Last updated: `2026-08-22`

## 1. User problem and outcome

Owner 已有批准知识后，需要建立一个可持续且重启可恢复的内容运营目标，而不是每次输入临时 Prompt。Owner 选择 7 日或 30 日窗口、目标、账号、市场、Content Locale、时区和节奏后，应看到一份版本化计划；系统只为选中的 X/小红书账号创建 ActivationUnit、Producer/Auditor 任务和本次内容 Brief。

本 SDD 冻结产品语义和 deterministic compiler 输出。由于 7/30 日计划必须由真实 Planner 生成，编译采用两阶段且保持同一 Mission identity：先由 Goal 编译 `MissionIntentBundle` 并停在计划人工门，Planner submission 被导入为 Plan Draft；Owner 批准后再确定性地产生下一代 `MissionExecutionBundle`。本 SDD 不负责真正调模型或运行 AgentTeams；SDD-007 只消费这些 opaque bundle generations。

## 2. Current state

- `main` 的 Campaign、ActivationPlan 和 Mission adapter 可验证 digest 与六角色，但 `ActivationPlan`/`MissionContract.artifactPlatforms` 要求 exact-four X/Bluesky/LinkedIn/XHS。
- 现有 compiler 仅投影角色和平台列表，没有 KnowledgeSnapshot、Goal、AccountOperatingProfile、计划、RoleContext、TaskContract 或 SkillLock digest。
- M2 Governed Shadow 已有固定六角色与 8-task DAG，但两个 Producer 的平台分工写死，输入是 `DEMO_SEED`。
- PR #7 能持久保存选择的平台，但 local campaign materialization 仍创建四账号/四单元/四产物；Campaign brief 同时承担目标和内容模板。
- 当前不存在独立、版本化、重启可恢复的 `OperatingGoal` 或 `ContentPlanRevision`。

这些是可复用工程基础，不构成本 SDD 用户结果。

## 3. Scope

### In scope

- 版本化 `OperatingGoal`：持续目标、7/30 日 horizon、start/end、cadence、selected account IDs、Target Market、Content Locale、IANA Time Zone 和可观察 success signals。
- Goal review/activation/pause/supersede；目标修改产生新 revision。
- 版本化 `ContentPlanRevision`：日期/slot、主题、平台/账号、producer mandate、内容目的、source/claim constraints、当前内容 Brief。
- selected-platform compiler v2：从批准 Snapshot + Goal + Account profiles + Plan 编译 immutable `MissionExecutionBundle`。
- 六成员角色不变，但仅向选中平台投影 ActivationUnit 和 producer work；保证两个独立 Producer 均有实质任务。
- v1 exact-four Campaign/Mission 的只读兼容和显式 adapter；新路径不就地改写旧对象。
- Goal/Plan/Bundle 的 PostgreSQL/API/Web read model、幂等与 digest invalidation。

### Out of scope

- 模型调用、AgentTeams dispatch/worker/restart；SDD-007。
- X/小红书最终 Artifact schema、Audit/OwnerDecision/PublishPackage；SDD-010。
- 自动排期发布、recurring ActionGrant、平台 Connector。
- 把目标指标解释为增长、线索、营收证明。

### Existing behavior that must not change

- 六角色 team topology：Leader、Claim Steward、Planner、Founder Producer、Product Producer、Auditor；Leader orchestration-only。
- 旧 v1 Campaign/Run/Evidence 可读取和验证，既有 digest 不变。
- UI locale、Content Locale、Target Market、IANA Time Zone 使用独立 stable code。
- SDD-008 的批准 Snapshot 和 AccountOperatingProfile 是只读输入，compiler 不回写。

## 4. User journey and UI states

1. `KNOWLEDGE_APPROVED_NEEDS_GOAL` 页面要求 Owner 新建 Goal。
2. Owner 选择 7 或 30 日，填写持续目标、时间窗口、内容节奏、目标市场/语言/时区，并从已建立的 X/XHS 账号中选择至少一个。
3. Review 显示知识 Snapshot、账号 revision、selected platform、计划覆盖、两个 Producer 的 mandate 和非业务结果提示。
4. Owner 提交后 compiler 创建 `MissionIntentBundle generation=1`；它固定六成员 roster、Claim Steward/Planner 任务和后续 selected-platform task templates。SDD-007 运行后，真实 Planner submission 被校验并导入 `ContentPlanRevision(DRAFT)`；本 SDD 的隔离测试可注入 schema-valid controlled submission，但不得作为真实 Agent evidence。
5. Owner 审阅 Planner 生成的计划，调整 slot 或要求重规划；Owner edit 是新 Plan revision，重规划是同一 Mission 的新 planning generation。批准 exact plan digest 后 compiler 产生 `MissionExecutionBundle generation=N+1` 并解锁 selected Producer/Auditor tasks。
6. UI 显示 7/30 日日历、当前内容 Brief、六成员责任、两阶段 bundle lineage、selected-platform task DAG、输入版本和 compile trace。

状态：Goal `DRAFT | ACTIVE | PAUSED | SUPERSEDED`；Plan `DRAFT | NEEDS_OWNER | APPROVED | INVALIDATED`；Bundle `COMPILED | INVALIDATED | BLOCKED`。缺资料、缺 Producer coverage、Snapshot 过期/冲突或账号 revision 失效时显示稳定 blocked code 和恢复动作，不隐式补齐平台。

## 5. Domain and API contracts

### Goal and plan

- immutable `OperatingGoalRevision { goalId, revision, objective, horizonDays: 7|30, startsAt, endsAt, cadence, selectedAccountIds[], targetMarket, contentLocale, timeZone, successSignals[], knowledgeSnapshotId/digest, canonicalDigest }`。
- `successSignals` 只能是观察/学习信号，不得作为承诺性 KPI；例如发布节奏、一致性、Owner 接受率。
- immutable `ContentPlanRevision { planId, goalRevisionId/digest, state, slots[], currentBriefId, sourceBindings[], canonicalDigest }`。
- `ContentPlanSlot { slotId, localDate, localTime?, platformCode, accountProfileRevisionId, producerRole, theme, contentObjective, claimConstraints[], sourceItemIds[], status }`。

### Compiler v2

`compileMissionIntentV2(input)` 必须 deterministic；输入：

- `KnowledgeSnapshot(APPROVED)` ID/digest；
- `OperatingGoalRevision(ACTIVE)` ID/digest；
- 每个 selected account 的 immutable profile revision/digest；
- team profile/version；Planner output schema、ArtifactProfile 与 Skill contract refs/version（由 SDD-010 冻结）；
- stable compiler version。

先输出 immutable `MissionIntentBundle generation=1`：

- `bundleId/version/canonicalDigest/compilerVersion`；
- `inputBindings` 与 invalidation rules；
- exactly six team members；Claim Steward/Planner task contracts；selected-platform ActivationUnit/task templates；
- Planner output schema 要求 7/30 日完整 slots、source/claim/account bindings 与 current brief；
- exactly six `RoleContextView`，按最小必要知识/账号/市场投影；
- pinned `SkillLock`、team profile/runtime compatibility requirement；
- human gates、audit requirements、trace/evidence contract。

Planner submission 只有通过 role/input/schema/skill digest 校验才可导入 immutable `ContentPlanRevision(DRAFT)`。Owner 批准 exact plan digest 后，`continueSelectedPlatformMissionV2(intentBundle, approvedPlan)` 确定性产生 `MissionExecutionBundle generation=N+1`，加入 selected `ActivationUnit[]`、current brief、Producer/Auditor `TaskContract[]`、完整 dependency DAG、expected artifact schema refs 和 input/output digests；未选平台不能从 template materialize。两个 generation 共享 `missionIntentId`，后代显式绑定父 bundle/plan digest，不原地覆盖。

首个 fixture 选择 X Founder Account + XHS Product Account，分别绑定 Founder Producer 与 Product Producer。真实配置无法让两个 Producer 均承担实质 selected-platform work 时返回 `PRODUCER_COVERAGE_REQUIRED`；Owner 可修改 account mandate，但不能创建空 Producer 任务冒充六 Agent 协作。

### Compatibility and API

- v1 exact-four Campaign/Mission 保持只读；v2 Intent/Execution generations 使用独立 schema/table/version discriminator，不原地重写 accepted history。
- 新 Web 只从 Goal/Plan/Bundle read model 渲染；Campaign brief 不再是 Goal 真源。
- API：`POST/GET/PATCH /api/goals`、`POST /api/goals/:id/activate|pause`、`POST/GET /api/content-plans`、`POST /api/content-plans/:id/approve`、`POST /api/missions/compile`、`GET /api/mission-bundles/:id`。
- mutation 需要 owner boundary、idempotency key、`If-Match` 与 exact digest。
- migrations 为 Goal/Plan/Bundle 和 bindings 建独立 append-only/version tables、unique current revision constraint、foreign keys 和 invalidation events。

稳定错误码：`KNOWLEDGE_SNAPSHOT_NOT_APPROVED`、`KNOWLEDGE_SNAPSHOT_STALE`、`GOAL_TIME_WINDOW_INVALID`、`ACCOUNT_PROFILE_MISSING`、`ACCOUNT_NOT_SELECTED`、`PLATFORM_NOT_SUPPORTED`、`PRODUCER_COVERAGE_REQUIRED`、`PLAN_NOT_APPROVED`、`PLAN_DIGEST_MISMATCH`、`MISSION_INPUT_CHANGED`、`COMPILER_VERSION_UNSUPPORTED`。

## 6. AgentTeams and Skills

本 SDD 冻结但不执行六角色 DAG：

1. Leader 创建任务、检查 ACK/Submit 和推进依赖，不生成领域内容。
2. Claim Steward 读取批准 KnowledgeSnapshot，输出允许/禁止 claim 与 evidence binding。
3. Planner 基于 Goal/账号/claim 生成 7/30 日候选计划和 current brief。
4. Founder Producer 只接收分配给其账号 mandate 的 selected units。
5. Product Producer 同理，且不得复制 Founder Producer 输出。
6. Auditor 接收完整 artifacts + bindings，独立于 Producer；具体 schema 由 SDD-010。

Bundle 内 SkillLock 必须固定 Skill ID/version/digest；Agent 不能发现并运行未锁定 Skill。RoleContextView 不暴露其他账号 Secret、原始 blob path 或未批准 draft。所有接受输出带 task/bundle/input/schema/skill digest。

## 7. Dependencies and reuse decision

| 组件 | 决定 | 版本/许可证 | 边界 |
|---|---|---|---|
| SDD-008 Knowledge/Profile contracts | `INTEGRATE` | accepted commit / Apache-2.0 | 只读 immutable inputs |
| main Campaign/compiler v1 | `INTEGRATE` | base commit / Apache-2.0 | 复用 digest/adapter pattern；保留 v1 reader |
| M2 six-role DAG | `INTEGRATE` | accepted M2 commit / Apache-2.0 | 复用 roles/dependencies，不复用 fixed-four payload |
| Calendar/plan UI | `BUILD` | 本仓 | PostgreSQL read model；无浏览器真源 |
| Generic scheduler | `LATER-REPLACE` | 未选择 | Goal horizon 不是 host cron；本 SDD 不调度 runtime |

无新第三方 runtime 依赖。若引入日历库，必须固定版本、记录 license/NOTICE 并验证 IANA/DST；首版优先现有平台能力。

## 8. Failure, recovery, and rollback

- Snapshot/Goal/Plan/Account 任一绑定改变，既有 Bundle 进入 `INVALIDATED`；不静默重编译或运行。
- selected account 缺档案、平台非 X/XHS、slot 越界/重复、时区无效、30 日计划不完整均阻断。
- Planner 输出非法时保持 Plan `DRAFT/NEEDS_OWNER`；不得用内置模板自动标记 APPROVED。
- 并发 Goal/Plan 编辑通过 row version 拒绝；批准 exact digest 失败不创建 Bundle。
- API/PG 重启从版本表恢复，compile idempotency 相同 input digest 只产生一个 current Bundle。
- v2 rollout 失败可将新 UI feature flag 关闭并继续只读 v1；不得 down migration 删除 Goal/Plan/Bundle。回滚/恢复步骤和备份 digest 必须入报告。

## 9. Acceptance criteria

- [ ] Owner 能建立并恢复 7 日和 30 日 Goal revision，Market/Locale/Time Zone 不互相混用。
- [ ] Approved Plan 有完整 slots、current brief、source/claim bindings 和 exact digest。
- [ ] 只选 X 且该账号明确承载 Founder/Product 双 mandate 时，Execution Bundle 中不存在 XHS/Bluesky/LinkedIn unit/task/artifact；只选 XHS 同理。
- [ ] public-safe fixture 的 X Founder + XHS Product 使两个 Producer 都有不同实质任务，并保持 exactly six roles。
- [ ] 缺第二 Producer coverage 时明确 `PRODUCER_COVERAGE_REQUIRED`，不创建空任务。
- [ ] 未批准/冲突/过期 Snapshot、未批准 Plan、stale account revision 或 digest tamper 均无法编译。
- [ ] 相同 Intent 输入、或相同 Intent + approved Plan 与 compiler version，分别产生 byte-stable canonical generation digest；重试/重启不重复 current generation。
- [ ] 任何已绑定输入变化使 Bundle invalidated，并在 UI 显示原因/恢复动作。
- [ ] legacy exact-four v1 fixtures 仍可读取验证，且不会被 v2 migration 改 digest。
- [ ] 机器证据包含 compiler golden files、selected-platform negative matrix、migration/restart results 和中英文 Web E2E。

## 10. Test plan

- Schema/unit：Goal/Plan transitions、horizon/date/time-zone、canonicalization、selected filtering、RoleContext minimization。
- Compiler golden：Intent→controlled Planner submission→approved Plan→Execution lineage；X-only dual-mandate、XHS-only dual-mandate、X+XHS fixture、7/30-day、two-producer coverage、deterministic digest。
- Negative/property：随机未选平台永不出现在输出；stale/tampered binding、unknown enum、duplicate slot、unapproved input。
- DB/API：migration、idempotency、ETag、invalidation event、owner isolation、restart。
- Compatibility：固定 v1 exact-four manifests 的 read/digest regression。
- Web E2E：Goal form、plan review/edit/approve、blocked/recovery、zh-CN/en label parity。
- Agent contract：Bundle schema 能被 pinned team profile 验证，但不在本 SDD 调模型。
- Secret/privacy scan：Goal/plan/bundle/trace 无 provider key、原始私有 blob 路径。

## 11. Evidence and claims

证据包括 compiler version manifest、input/output golden digest、migration manifest、API/Web E2E、restart/idempotency log、v1 compatibility report、negative matrix 和 Owner decision。

通过后仅可声明：`ENGINEERING_VERIFIED` 的持久 Goal/Plan 可确定性编译为 selected X/XHS 六角色 Mission 合同。不得声明真实 AgentTeams 已持续运行、内容质量、平台发布或业务结果；这些分别由 SDD-007/010/011 证明。

## 12. Delivery plan

1. 0.5 天：冻结 v2 schema、v1 compatibility、error/invalidation matrix。
2. 1 天：Goal/Plan/Bundle migrations、repository/API、compiler golden tests。
3. 0.5–1 天：Web goal/plan states、selected-platform trace、zh-CN/en。
4. 0.5 天：restart/compatibility/Owner UAT/acceptance report。

Critical path：SDD-008 accepted contract → v2 schema → compiler → Web/UAT。`M5-07` 只有 Coordinator 可改变；Owner UAT 前最多 `EVIDENCE_READY`。

## 13. Alternatives and decision log

- 拒绝修改 v1 exact-four schema 原地兼容：会改变已接受历史 digest；选择 versioned v2 + reader adapter。
- 拒绝让平台选择仅影响 UI：它必须进入 compiler input 和 output digest。
- 拒绝减少到四角色：比赛与产品治理要求至少六成员，Producer/Auditor 分离。
- 拒绝让 Leader 生成补位内容：缺 Producer coverage 应阻断并要求 Owner 调整 mandate。
- 拒绝以 Campaign brief 同时作为 Goal 和 Plan：三者版本/生命周期不同。

## 14. Owner-participated acceptance

Prerequisites：SDD-008 public-safe A梦 Snapshot、X Founder 与 XHS Product profiles；不需要 provider key。

1. 建立 7 日 Goal，选择 X+XHS，检查时区/语言/市场分别显示。
2. 查看 Intent generation 与受控 Planner submission，审阅 7 日 plan；修改一个 slot，确认新 revision/digest，并批准 exact plan。
3. 打开 Execution generation trace，确认它绑定 Intent/Plan digest、恰好六角色、两个 Producer 有不同工作，且只有 X/XHS。
4. 用承载双 mandate 的账号新建 X-only test goal，确认不存在 XHS/Bluesky/LinkedIn task。
5. 临时去掉 Product mandate，确认 `PRODUCER_COVERAGE_REQUIRED`，恢复后重编译。
6. 修改 Knowledge draft，确认旧 approved Snapshot 仍可绑定；批准新 Snapshot 后旧 Bundle invalidated。
7. 重启 API/PG，确认 Goal/Plan/Bundle ID 和 digest 不变。

Expected：计划和 Bundle 可见、版本化、selected-platform、可解释。Failure signs：四平台仍被强制、Leader 补写、刷新丢失、旧输入改变却继续运行。Owner 返回 screenshots、bundle manifest/digest、PASS/FAIL；清理只暂停测试 Goal，不删除历史。

## 15. Task closeout

- 中文验收报告：`docs/reports/acceptance/SDD-009-ACCEPTANCE.md`。
- Proposed module：`M5-07`；当前只有 spec `SPEC_READY`。
- 下游：SDD-010 冻结 Artifact/Skill 合同；其后 SDD-007 才可实现 runtime。
- Closeout 必须报告 Worktree/Branch/Commit、changed files、migration、tests、evidence、Owner UAT、rollback、proposed state、blockers 与 STATUS_HANDOFF；Goal 最后完成。
