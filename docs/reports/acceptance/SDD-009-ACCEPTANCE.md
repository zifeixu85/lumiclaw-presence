# SDD-009 持久 Goal、内容计划与 selected-platform compiler 验收报告

- SDD：`SDD-009-PERSISTENT-GOAL-SELECTED-PLATFORM-COMPILER`
- Objective：将批准知识与持续目标编译为只覆盖已选 X/小红书账号的可执行 Mission 合同
- Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-009-persistent-goal-selected-platform-compiler`
- Branch：`codex/sdd-009-persistent-goal-selected-platform-compiler`
- Exact authorized base：`99376d48c5c97462865293a5d287e4e697547b29`
- Proposed module state：`M5-07 = EVIDENCE_READY`，仅供 Coordinator 审核
- Owner UAT：`PENDING`
- 证据分类：`PUBLIC_SAFE_SYNTHETIC`
- 当前可声明成熟度：`IMPLEMENTED`、`ENGINEERING_VERIFIED`

## 一、交付结果

本 SDD 已实现真实可写、可恢复的 Goal → MissionIntent → Planner submission → versioned Plan → exact digest approval → MissionExecution 两阶段链路。PostgreSQL 是 Goal/Plan/Bundle 的权威状态，刷新 API/Web 或重启 API/PostgreSQL 后，权威 ID、revision 与 SHA-256 digest 保持不变。

Owner 可以在 zh-CN 默认、en 对等的本地界面中建立 7/30 日持续运营 Goal，独立选择 Target Market、Content Locale、IANA Time Zone、节奏、观察型 success signals 与已批准的 X/小红书账号；随后查看 Intent 输入锁、导入明确标注为受控 fixture 的 Planner submission、编辑 slot 形成新 revision、批准 exact Plan digest，并查看只覆盖 selected platform 的六角色 Execution DAG、输入版本与 invalidation trace。

实现不调用模型、不派发 AgentTeams、不创建 Artifact、不发布、不执行 Connector，也不把 success signals 解释为增长、线索或收入结果。Owner UAT 尚未完成，因此本报告不提出 `ACCEPTED`，模块建议状态最多为 `EVIDENCE_READY`。

## 二、交付范围

| 层 | 已实现 | 边界 |
|---|---|---|
| Domain | append-only `OperatingGoalRevision`、`ContentPlanRevision`、Mission bundle v2、稳定错误码、exact ETag/digest | 仅 7/30 日；平台仅 X/XIAOHONGSHU |
| Compiler | deterministic compiler v2、同 Mission 单调 generation lineage、exactly six roles、selected-platform filtering、Planner role/input/schema/Skill lock、Producer coverage | v1 exact-four 代码和历史 digest 不改写 |
| PostgreSQL | 11 个 v2 权威/头指针/绑定/状态/幂等/context/outbox/receipt 表，复合 owner FK、immutable trigger、安全 down | populated down 必须先导出并取得 Owner 决定 |
| API/OpenAPI | Goal create/revise/activate/pause；Intent compile；Plan import/revise/approve；Bundle reopen；closed schemas | mutation 强制 owner boundary、Idempotency-Key、If-Match 与 exact digest |
| Web | 真实 Goal form、Intent、受控 fixture、Plan review/edit/approve、Execution trace、blocked/recovery；zh-CN/en | 不显示成工程表格，不收 Secret，不声称真实 AgentTeams run |
| Evidence/CI | golden、negative/property、Compose/PostgreSQL/restart、Chromium/keyboard/axe/desktop、依赖/license/SBOM 门禁 | fixture 与截图均为 public-safe synthetic |

未修改 `IMPLEMENTATION-STATUS.md`、`ROADMAP.md` 或 `ARCHITECTURE.md`。未在 `/public` checkout 或内部私有仓库写入文件，未创建第二 worktree。

## 三、实现证据

权威 machine evidence 位于 `docs/reports/evidence/sdd-009/`：

- `golden-digests.json`：7 日、30 日、X-only、XHS-only、X+XHS、两位 Producer 的不同 input/mandate digest、未选平台 negative matrix、v1 compatibility。
- `compose-verification.json`：fresh Compose、migration 12、SDD-008 context binding 安全升级、append-only/immutability、owner isolation、幂等、并发、tamper、restart、binding-scoped invalidation、crash recovery 和 selected-platform 结果，共 22 项检查。
- `browser-verification.json`：zh-CN/en、中文六角色主标签、键盘链路、Goal/Intent/Plan/Execution/invalidation/recompile、desktop gate，共 30 项检查；console error 为 0，serious/critical axe violation 为 0。
- `postgres-regression.json`：隔离的新鲜 PostgreSQL 上执行既有 SDD-008 Snapshot metadata 安全物化、两 Goal/两 Mission、S1 → draft S2 → approve S2、首次 outbox delivery 注入失败、repository restart/retry 与同 Mission 新 generation，共 11 项断言；最终 outbox 1、receipt 1、pending 0。
- `migration-manifest.json`：11 个表、empty down PASS、populated down 稳定阻断码、authority update/delete 稳定阻断码、transactional snapshot supersession outbox。
- `api-contract-results.json`：幂等重试、幂等键复用、并发 one-winner、digest tamper、未选平台负矩阵与权威 ID/digest。
- `restart-transcript.json`：API restart 与 PostgreSQL+API restart 前后 Goal/Plan/Intent/Execution ID、revision、digest 和 row counts 完全一致。
- `run-manifest.json`：证据文件 SHA-256、运行时、base/branch 与诚实 claims。
- `DEPENDENCY-LICENSE-REVIEW.md`：lockfile、inventory、CycloneDX、production/full audit 与 dev-only advisory 边界。
- `01-goal-form-zh.png` 至 `07-desktop-gate.png`（含 `05b-recompiled-execution-zh.png`）：8 张 public-safe 可视证据。

固定 v1 exact-four regression digest：`95ff9637ffbbc531f6f02f731b7428c2534731f27847b0f9e0fe7160ef481d8b`。compiler v2 为独立 schema/generation/table，不原地改写 v1。

关键安全性质：Leader 只有编排任务；Founder Producer 与 Product Producer 分别获得实质且不同的 selected-account work；Auditor 独立；覆盖不足稳定返回 `PRODUCER_COVERAGE_REQUIRED`；未批准/过期/篡改输入均 fail closed；`externalActionAllowed=false`、`agentTeamsExecuted=false`。

独立审查提出的 P1 已关闭：本地日期采用 UTC calendar round-trip exact 验证，`2026-02-30` 与 `2025-02-29` 被拒绝而 `2028-02-29` 有效，Plan slot 共用同一 validator；Goal/Plan/Snapshot/Account invalidation 只匹配 bundle 记录的 exact binding，不再 owner-wide；未批准 Knowledge draft 不产生 invalidation，且 session 权威指针继续指向 S1；Snapshot approval 与 durable supersession outbox 在同一 PostgreSQL transaction 提交，API 的 Mission 读写路径在 pending delivery 窗口先 reconcile，失败则不返回可执行成功状态；Intent/Plan/Execution 在同一 missionIntentId 下追加单调 generation/revision，旧历史只读且保留 invalidation。

SDD-008 `KnowledgeSnapshot` canonical payload 没有新增字段或改变排序。冻结 payload regression digest 为 `31eae2f34fe21b2aa6ea604988c23950318bc5db55edf4ab500aeeb365204c10`；SDD-009 所需 Market/Locale/Time Zone 使用独立 `knowledge_snapshot_context_bindings_v2` 版本化合同，不改写既有 Snapshot digest。升级前已批准且尚无 v2 context row 的 S1，仅在 session 当前指针、Snapshot ID/digest 与 `APPROVED` 状态精确一致时幂等物化独立 binding；所有 Knowledge mutation 都在改变 draft context 前先执行该安全物化，否则稳定 fail closed。

## 四、自动化验证

| 命令 | 结果 |
|---|---|
| `npx vitest run packages/domain/src/goal-plan.test.ts packages/mission-compiler/src/index.test.ts` | PASS：exact date、7/30-day、lineage、selected-platform 与 40-case property loop |
| `npx vitest run apps/api/src/goal-plan-api.test.ts apps/api/src/memory-goal-plan-repository.test.ts` | PASS：完整 API exact-digest/replanning/outbox 链路与两 Mission scoped invalidation |
| `SDD009_POSTGRES_URL=… npx vitest run apps/api/src/goal-plan-postgres-regression.test.ts --configLoader=runner` | PASS：fresh PostgreSQL injected failure/restart、两 Goal/两 Mission、S1/S2 与 same-Mission lineage |
| `npm run verify:sdd009:compose` | PASS：fresh image + PostgreSQL + Chromium；22 Compose / 30 browser checks / 8 screenshots |
| `npm run evidence:sdd009:golden` | PASS：重新生成与 committed golden byte-for-byte 一致 |
| `npm run verify:sdd009:dependencies` | PASS：1,020 packages、710 CycloneDX components、disallowed 0 |
| `npm audit --omit=dev --audit-level=high --json` | PASS：production 0 total/high/critical |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS；全量 Vitest 45 passed + 1 skipped files / 408 passed + 1 skipped tests，PostgreSQL 条件式专项在 Compose 中另行 PASS |
| `npm run check:messages` | PASS：zh-CN/en 893 keys parity |
| `npm run check:status` | PASS；未改 canonical progress |
| `npm run check:secrets` | PASS |
| `npm run build` | PASS；全部 runtime workspaces 与 Next production build |
| `npm run storybook:build` | PASS；Storybook 与 browser-safety gate |
| `npm run verify` | PASS；完整 static/build/Storybook gate |

专项 Compose 脚本会从干净 volume 建栈、验证 migration/down 边界、跑真实 Chromium、直接检查 PostgreSQL 权威行与约束、重启服务并清理 stack。它已纳入 `package.json` 和 CI；CI 固定安装与仓库 Playwright 版本一致的 Chromium，并上传 public evidence。

## 五、验收标准结果

| AC | 结果 | 证据与说明 |
|---|---|---|
| AC-01 | PASS | 7/30-day schema、exact calendar date（含闰年正反例）、Plan slot 共用 validator 与 Web form/E2E 均覆盖；Market、Content Locale、IANA Time Zone 是独立 stable code。 |
| AC-02 | PASS | Planner submission closed schema 要求完整 slots/current brief/source/claim bindings；Owner edit 形成新 immutable revision，批准 exact digest。 |
| AC-03 | PASS | X-only 与 XHS-only golden/negative matrix 验证其他三平台在 unit/task/bundle 中不存在。 |
| AC-04 | PASS | X Founder + XHS Product fixture 始终 exactly six roles；两个 Producer 的 task/input/mandate digest 与内容目标不同。 |
| AC-05 | PASS | 缺任一 Producer mandate 返回 `PRODUCER_COVERAGE_REQUIRED`；Leader 无 producer output contract。 |
| AC-06 | PASS | unapproved/stale Snapshot、unapproved Plan、stale account binding、role/input/schema/Skill/digest tamper 均阻断。 |
| AC-07 | PASS | Intent 与 Execution deterministic golden；同一 Goal/Mission identity 的新输入追加单调 Intent generation、Plan revision、Execution generation；重试、并发与 API/PostgreSQL 重启不复制，历史 ID/digest 稳定。 |
| AC-08 | PASS | Goal/Plan invalidation 按 exact goalId/planId+missionIntentId，Snapshot/Account 按记录的旧 revision binding；draft edit 不失效 S1，approve S2 才触发 durable outbox；Web 显示稳定原因与 `REVIEW_AND_COMPILE_NEW_GENERATION`，且真实恢复为新 generation。 |
| AC-09 | PASS | v1 exact-four fixture 与固定 digest 不变；SDD-008 frozen Snapshot digest 不变；context metadata、outbox 与 compiler generation 使用独立 v2 合同/表。 |
| AC-10 | PASS | machine evidence 包含 golden、selected-platform negative matrix、migration/restart/crash recovery、zh-CN/en Chromium、中文六角色、键盘、axe、desktop 与 recompile screenshots。 |
| AC-11 | PASS | Memory 与 fresh PostgreSQL/API 对 owner isolation、binding scope、closed schema、If-Match、exact digest、幂等重放/键复用、并发 one-winner、immutable authority、outbox exactly-once effect、安全 rollback 均有验证。 |
| AC-12 | PENDING | Owner 参与 UAT 尚未执行；工程证据只支持 `EVIDENCE_READY`，Coordinator/Owner 决定前不得标为 `ACCEPTED`。 |

## 六、Owner 参与验收

状态：`PENDING`。以下步骤必须由 Owner 在本地执行并返回 PASS/FAIL、截图和最终 bundle manifest/digest；日志本身不能替代 Owner 决定。

前置条件：Docker Desktop 可用；Node/npm 与仓库 `.nvmrc`/`packageManager` 一致；使用 public-safe SDD-008 已批准 Snapshot、X Founder 与 XHS Product profiles；不需要 provider key、Cookie、OAuth token 或真实账号。

1. 在本 worktree 执行 `npm ci`，再执行 `npm run verify:sdd009:compose`。预期最后输出 `PASS` 且 22 Compose/30 browser checks 全为 true，并生成 8 张截图；若 health、migration、PostgreSQL regression、Chromium 或 axe gate 失败即停止。
2. 打开脚本输出的本地 Web URL，确认默认 zh-CN；从已批准知识页进入「持续目标」。建立 7 日 X+XHS Goal，逐项检查 Owner、目标、窗口、节奏、success signals、Market、Content Locale、IANA Time Zone 与账号选择。预期四类语义独立；若 locale 改动自动改变 market/time zone 则 FAIL。
3. 创建并激活 Goal，刷新页面。预期同一 Goal ID/revision/digest 恢复。查看 Intent generation：必须恰好六角色、Leader orchestration-only、selected platforms 仅 X/XHS，Planner 状态明确为未运行。
4. 导入界面提供的受控 Planner fixture。预期 UI 明示 `CONTROLLED_FIXTURE`、`AgentTeams 未运行`，7 个 slot 覆盖完整窗口。修改一个 slot 主题，预期 Plan revision 与 digest 改变、旧 revision 保留；批准时绑定调整后的 exact digest。
5. 打开 Execution generation。预期共享 missionIntentId，绑定 Intent/Plan/input version；恰好六角色；Founder Producer 与 Product Producer 有不同平台/账号/目标任务；DAG 和 trace 可见；无 Artifact、ActionGrant、Connector 或 external action。
6. 建立 X-only 双 mandate Goal。预期 Execution 中完全不存在 XIAOHONGSHU/BLUESKY/LINKEDIN。建立 XHS-only 双 mandate Goal时反向验证。
7. 临时创建缺 Product mandate 的 public-safe 测试配置。预期稳定显示 `PRODUCER_COVERAGE_REQUIRED`，Leader 不补写；恢复 mandate 后显式新编译，不得复用 blocked 输出。
8. 先编辑 Knowledge 形成 S2 draft，但不要批准。预期 session 仍显示 S1 的 current approved ID/digest，S1 RoleContext、旧 Goal compile 与既有 S1 Bundle 均保持有效，draft 内容绝不进入 bundle。再批准 S2；预期仅 S1 exact binding 的 Bundle 失效，其他 Goal/Mission 不受影响。
9. 对 Goal A 或 Plan A 形成新 revision。预期仅 A 的相关 Bundle 显示 `INVALIDATED`，Goal/Mission B 仍有效；点击恢复动作，激活调整后的 Goal，重新编译/导入/批准。预期 missionIntentId 不变，Intent/Plan/Execution generation/revision 单调增加、digest 不同、旧历史仍可读。
10. 执行专项脚本的 injected outbox failure 场景。预期首次 Snapshot approval API 返回 fail-closed，重启/retry 后旧 Bundle 必为 `INVALIDATED`；`postgres-regression.json` 显示 outbox 1、receipt 1、pending 0，重复读取不增加 invalidation event。
11. 记录 Goal/Plan/Intent/Execution ID 与 SHA-256 digest；分别重启 API、PostgreSQL+API，刷新页面。预期全部 ID/revision/digest 不变。
12. 切换 en，确认 Goal/Intent/Plan/Execution/invalidation 页面内容对等。zh-CN 下六个角色主标签必须为任务协调、事实核验、市场策划、创始人内容、产品内容、独立审校 Agent，英文名称只作为 stable code 的次级技术信息。用键盘遍历关键控件；在 1440×1000 与 800×900 检查无水平溢出或被遮挡操作。

失败标志：强制补齐四平台；空 Producer task；Leader 生成领域内容；刷新丢失；旧输入变化后 Bundle 仍可用；fixture 被标为 AgentTeams run；success signals 被描述成增长/线索/收入；出现 Secret 输入；重启后 digest 变化。

Owner 返回：步骤 2/4/5/8/9/10/11 的截图或 machine evidence、最终 `run-manifest.json`、Goal/Plan/Execution digest、明确 `PASS` 或 `FAIL` 与备注。清理仅运行专项脚本的 Compose down；业务历史只可暂停/保留，不删除权威 revision。

## 七、ChatGPT Pro 双代理记录

本 SDD 未授权、未调用 ChatGPT Pro，也未接收外部工程师补丁。所有实现和验证均在唯一授权 worktree 内完成；因此无外部补丁需要隔离应用或二次来源审计。

## 八、失败、限制与非声明

Known limitations：

- 本 SDD 不调模型、不运行 AgentTeams runtime；Planner fixture 只证明 schema、审批和 compiler 工程链路。
- 本 SDD 不实现 Artifact/Audit/发布、Runtime/Secret broker、Connector、ActionGrant 或任何外部动作。
- success signals 是观察/学习信号，不是增长、关注者、线索、营收或业务成效证据。
- Owner UAT 与任何真实外部用户校准均为 `PENDING`；无 `EXTERNAL_CALIBRATED` 或 `BUSINESS_VERIFIED` 声明。
- full `npm audit` 有 3 个既有 dev-only high advisory，路径为 Storybook → `image-size<=2.0.2` 的非生产图片 parser DoS，`fixAvailable=false`；production audit 为 0。Storybook 只处理仓库自有 public-safe 静态资产，后续应在上游兼容修复发布后独立升级。
- 不声称 production ready、法律合规保证、平台发布成功、内容质量或业务结果。

独立审查与专项验证中发现并修复了 invalid calendar normalization、owner-wide invalidation、draft 过早失效、旧 Snapshot 不可绑定、replanning unique conflict、Snapshot approval/outbox crash window、Web PATCH proxy 405、idempotency request 中瞬时时间导致 digest 漂移、中文主标签与按钮对比度问题。最终证据中 console error 为 0、serious/critical axe violation 为 0。

## 九、回滚与恢复

Rollback 原则是先停止新写入、导出权威数据、保留 append-only 历史，再由 Owner 决定是否禁用新 UI/API。不得直接删除有数据的 v2 表。

1. 禁用 `/goals` 导航与 v2 mutation 路由，继续保持 v1 exact-four 只读能力；不要改写 v1 objects。
2. 使用 `pg_dump` 导出 `operating_goal_*`、`content_plan_*_v2`、`mission_bundle_*_v2`、`goal_plan_idempotency_records_v2`、`knowledge_snapshot_context_bindings_v2`、`knowledge_snapshot_supersession_*_v2`，记录备份文件 SHA-256、PostgreSQL version 与行数。
3. 验证备份可恢复并取得明确 Owner destructive decision。无数据时 migration down 可安全通过；有权威数据时 down 稳定失败：`SDD009_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED`。
4. authority 表的直接 UPDATE/DELETE 稳定失败：`SDD009_APPEND_ONLY_AUTHORITY`。需要修正时必须追加新 revision/invalidation event，不手工改历史行。
5. 如只回滚应用代码，保留 migration 12 和数据表；恢复本分支后由 read model 重新读取，ID/digest 不变。

## 十、执行任务状态交接

- Objective：已实现并完成工程验证；Goal 在 commit/push/Draft PR/STATUS_HANDOFF 前保持 active。
- Worktree/Branch/Base：见报告顶部；无第二 worktree。
- 用户可见结果：Goal desk、Intent、Plan revision/approval、Execution DAG/trace、blocked/recovery、zh-CN/en parity。
- 数据状态：append-only PostgreSQL authority；migration 12；Snapshot supersession transactional outbox；restart/retry stable。
- 安全/隐私：public-safe synthetic fixtures；Secret scan PASS；owner-bound mutation；无真实账号或客户资料。
- 建议状态：`M5-07 = EVIDENCE_READY`；Owner UAT 后由 Coordinator 独立核验并决定是否 `ACCEPTED`。
- 下一候选：SDD-010 冻结并实现 Artifact/Skill/Audit 合同；之后 SDD-007 才消费 opaque bundle generations 实现 runtime。

最终 full HEAD、Draft PR URL、commit 列表与完整 changed-file/test handoff 由 Executor 在本报告所属提交推送后主动发送给 Coordinator；报告不使用自引用 commit hash。

## 十一、Coordinator 验收决定

`PENDING`。

Coordinator 需要独立检查 exact base/head、代码 diff、migration/down、专项证据 SHA-256、full `npm run verify`、Draft PR、Owner UAT 返回，并同时更新中英文 canonical progress mirror。Executor 不修改 canonical 状态、不宣称 `ACCEPTED`。
