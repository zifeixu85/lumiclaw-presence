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
| Compiler | deterministic compiler v2、两阶段 generation、exactly six roles、selected-platform filtering、Planner role/input/schema/Skill lock、Producer coverage | v1 exact-four 代码和历史 digest 不改写 |
| PostgreSQL | 8 个 v2 权威/头指针/绑定/状态/幂等表，复合 owner FK、immutable trigger、安全 down | populated down 必须先导出并取得 Owner 决定 |
| API/OpenAPI | Goal create/revise/activate/pause；Intent compile；Plan import/revise/approve；Bundle reopen；closed schemas | mutation 强制 owner boundary、Idempotency-Key、If-Match 与 exact digest |
| Web | 真实 Goal form、Intent、受控 fixture、Plan review/edit/approve、Execution trace、blocked/recovery；zh-CN/en | 不显示成工程表格，不收 Secret，不声称真实 AgentTeams run |
| Evidence/CI | golden、negative/property、Compose/PostgreSQL/restart、Chromium/keyboard/axe/desktop、依赖/license/SBOM 门禁 | fixture 与截图均为 public-safe synthetic |

未修改 `IMPLEMENTATION-STATUS.md`、`ROADMAP.md` 或 `ARCHITECTURE.md`。未在 `/public` checkout 或内部私有仓库写入文件，未创建第二 worktree。

## 三、实现证据

权威 machine evidence 位于 `docs/reports/evidence/sdd-009/`：

- `golden-digests.json`：7 日、30 日、X-only、XHS-only、X+XHS、两位 Producer 的不同 input/mandate digest、未选平台 negative matrix、v1 compatibility。
- `compose-verification.json`：fresh Compose、migration 12、append-only/immutability、owner isolation、幂等、并发、tamper、restart 和 selected-platform 结果，共 17 项检查。
- `browser-verification.json`：zh-CN/en、键盘链路、Goal/Intent/Plan/Execution/invalidation、desktop gate，共 24 项检查；console error 为 0，serious/critical axe violation 为 0。
- `migration-manifest.json`：8 个表、empty down PASS、populated down 稳定阻断码、authority update/delete 稳定阻断码。
- `api-contract-results.json`：幂等重试、幂等键复用、并发 one-winner、digest tamper、未选平台负矩阵与权威 ID/digest。
- `restart-transcript.json`：API restart 与 PostgreSQL+API restart 前后 Goal/Plan/Intent/Execution ID、revision、digest 和 row counts 完全一致。
- `run-manifest.json`：证据文件 SHA-256、运行时、base/branch 与诚实 claims。
- `DEPENDENCY-LICENSE-REVIEW.md`：lockfile、inventory、CycloneDX、production/full audit 与 dev-only advisory 边界。
- `01-goal-form-zh.png` 至 `07-desktop-gate.png`：public-safe 可视证据。

固定 v1 exact-four regression digest：`95ff9637ffbbc531f6f02f731b7428c2534731f27847b0f9e0fe7160ef481d8b`。compiler v2 为独立 schema/generation/table，不原地改写 v1。

关键安全性质：Leader 只有编排任务；Founder Producer 与 Product Producer 分别获得实质且不同的 selected-account work；Auditor 独立；覆盖不足稳定返回 `PRODUCER_COVERAGE_REQUIRED`；未批准/过期/篡改输入均 fail closed；`externalActionAllowed=false`、`agentTeamsExecuted=false`。

## 四、自动化验证

| 命令 | 结果 |
|---|---|
| `npm test -- packages/domain/src/goal-plan.test.ts packages/mission-compiler/src/index.test.ts` | PASS：2 files / 23 tests；含 40-case property loop |
| `npm test -- apps/api/src/goal-plan-api.test.ts` | PASS：完整 API exact-digest 链路、同键状态重放、换键失败关闭 |
| `npm run verify:sdd009:compose` | PASS：fresh image + PostgreSQL + Chromium；17 Compose / 24 browser checks |
| `npm run evidence:sdd009:golden` | PASS：重新生成与 committed golden byte-for-byte 一致 |
| `npm run verify:sdd009:dependencies` | PASS：1,020 packages、710 CycloneDX components、disallowed 0 |
| `npm audit --omit=dev --audit-level=high --json` | PASS：production 0 total/high/critical |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS；全量 Vitest |
| `npm run check:messages` | PASS：zh-CN/en 846 keys parity |
| `npm run check:status` | PASS；未改 canonical progress |
| `npm run check:secrets` | PASS |
| `npm run build` | PASS；全部 runtime workspaces 与 Next production build |
| `npm run storybook:build` | PASS；Storybook 与 browser-safety gate |
| `npm run verify` | PASS；完整 static/build/Storybook gate |

专项 Compose 脚本会从干净 volume 建栈、验证 migration/down 边界、跑真实 Chromium、直接检查 PostgreSQL 权威行与约束、重启服务并清理 stack。它已纳入 `package.json` 和 CI；CI 固定安装与仓库 Playwright 版本一致的 Chromium，并上传 public evidence。

## 五、验收标准结果

| AC | 结果 | 证据与说明 |
|---|---|---|
| AC-01 | PASS | 7/30-day schema、date window 与 Web form/E2E 均覆盖；Market、Content Locale、IANA Time Zone 是独立 stable code。 |
| AC-02 | PASS | Planner submission closed schema 要求完整 slots/current brief/source/claim bindings；Owner edit 形成新 immutable revision，批准 exact digest。 |
| AC-03 | PASS | X-only 与 XHS-only golden/negative matrix 验证其他三平台在 unit/task/bundle 中不存在。 |
| AC-04 | PASS | X Founder + XHS Product fixture 始终 exactly six roles；两个 Producer 的 task/input/mandate digest 与内容目标不同。 |
| AC-05 | PASS | 缺任一 Producer mandate 返回 `PRODUCER_COVERAGE_REQUIRED`；Leader 无 producer output contract。 |
| AC-06 | PASS | unapproved/stale Snapshot、unapproved Plan、stale account binding、role/input/schema/Skill/digest tamper 均阻断。 |
| AC-07 | PASS | Intent 与 Execution deterministic golden；重试、并发与 API/PostgreSQL 重启不复制 generation，ID/digest 稳定。 |
| AC-08 | PASS | Knowledge/Goal/Plan/Account 输入变化写 append-only invalidation event；Web 显示稳定原因与 `REVIEW_AND_COMPILE_NEW_GENERATION`，不静默重编译。 |
| AC-09 | PASS | v1 exact-four fixture 仍读取/验证，固定 digest regression 不变；migration 使用独立 v2 表。 |
| AC-10 | PASS | machine evidence 包含 golden、selected-platform negative matrix、migration/restart、zh-CN/en Chromium、键盘、axe、desktop screenshots。 |
| AC-11 | PASS | PostgreSQL/API 对 owner isolation、closed schema、If-Match、exact digest、幂等重放/键复用、并发 one-winner、immutable authority、安全 rollback 均有验证。 |
| AC-12 | PENDING | Owner 参与 UAT 尚未执行；工程证据只支持 `EVIDENCE_READY`，Coordinator/Owner 决定前不得标为 `ACCEPTED`。 |

## 六、Owner 参与验收

状态：`PENDING`。以下步骤必须由 Owner 在本地执行并返回 PASS/FAIL、截图和最终 bundle manifest/digest；日志本身不能替代 Owner 决定。

前置条件：Docker Desktop 可用；Node/npm 与仓库 `.nvmrc`/`packageManager` 一致；使用 public-safe SDD-008 已批准 Snapshot、X Founder 与 XHS Product profiles；不需要 provider key、Cookie、OAuth token 或真实账号。

1. 在本 worktree 执行 `npm ci`，再执行 `npm run verify:sdd009:compose`。预期最后输出 `PASS` 且 17 Compose/24 browser checks 全为 true；若 health、migration、Chromium 或 axe gate 失败即停止。
2. 打开脚本输出的本地 Web URL，确认默认 zh-CN；从已批准知识页进入「持续目标」。建立 7 日 X+XHS Goal，逐项检查 Owner、目标、窗口、节奏、success signals、Market、Content Locale、IANA Time Zone 与账号选择。预期四类语义独立；若 locale 改动自动改变 market/time zone 则 FAIL。
3. 创建并激活 Goal，刷新页面。预期同一 Goal ID/revision/digest 恢复。查看 Intent generation：必须恰好六角色、Leader orchestration-only、selected platforms 仅 X/XHS，Planner 状态明确为未运行。
4. 导入界面提供的受控 Planner fixture。预期 UI 明示 `CONTROLLED_FIXTURE`、`AgentTeams 未运行`，7 个 slot 覆盖完整窗口。修改一个 slot 主题，预期 Plan revision 与 digest 改变、旧 revision 保留；批准时绑定调整后的 exact digest。
5. 打开 Execution generation。预期共享 missionIntentId，绑定 Intent/Plan/input version；恰好六角色；Founder Producer 与 Product Producer 有不同平台/账号/目标任务；DAG 和 trace 可见；无 Artifact、ActionGrant、Connector 或 external action。
6. 建立 X-only 双 mandate Goal。预期 Execution 中完全不存在 XIAOHONGSHU/BLUESKY/LINKEDIN。建立 XHS-only 双 mandate Goal时反向验证。
7. 临时创建缺 Product mandate 的 public-safe 测试配置。预期稳定显示 `PRODUCER_COVERAGE_REQUIRED`，Leader 不补写；恢复 mandate 后显式新编译，不得复用 blocked 输出。
8. 对当前输入产生新 Goal revision或批准新 Snapshot。预期旧 Bundle 显示 `INVALIDATED`、稳定原因和恢复动作，不继续执行且不静默重编译。
9. 记录 Goal/Plan/Intent/Execution ID 与 SHA-256 digest；分别重启 API、PostgreSQL+API，刷新页面。预期全部 ID/revision/digest 不变。
10. 切换 en，确认 Goal/Intent/Plan/Execution/invalidation 页面内容对等。用键盘遍历关键控件；在 1440×1000 与 800×900 检查无水平溢出或被遮挡操作。

失败标志：强制补齐四平台；空 Producer task；Leader 生成领域内容；刷新丢失；旧输入变化后 Bundle 仍可用；fixture 被标为 AgentTeams run；success signals 被描述成增长/线索/收入；出现 Secret 输入；重启后 digest 变化。

Owner 返回：步骤 2/4/5/8/9 的截图、最终 `run-manifest.json`、Goal/Plan/Execution digest、明确 `PASS` 或 `FAIL` 与备注。清理仅运行专项脚本的 Compose down；业务历史只可暂停/保留，不删除权威 revision。

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

专项验证中发现并修复了 Web PATCH proxy 405、idempotency request 中瞬时时间导致 digest 漂移、浏览器证据视口定位和暗色 eyebrow 对比度问题。最终证据中 console error 为 0、serious/critical axe violation 为 0。

## 九、回滚与恢复

Rollback 原则是先停止新写入、导出权威数据、保留 append-only 历史，再由 Owner 决定是否禁用新 UI/API。不得直接删除有数据的 v2 表。

1. 禁用 `/goals` 导航与 v2 mutation 路由，继续保持 v1 exact-four 只读能力；不要改写 v1 objects。
2. 使用 `pg_dump` 导出 `operating_goal_*`、`content_plan_*_v2`、`mission_bundle_*_v2`、`goal_plan_idempotency_records_v2`，记录备份文件 SHA-256、PostgreSQL version 与行数。
3. 验证备份可恢复并取得明确 Owner destructive decision。无数据时 migration down 可安全通过；有权威数据时 down 稳定失败：`SDD009_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED`。
4. authority 表的直接 UPDATE/DELETE 稳定失败：`SDD009_APPEND_ONLY_AUTHORITY`。需要修正时必须追加新 revision/invalidation event，不手工改历史行。
5. 如只回滚应用代码，保留 migration 12 和数据表；恢复本分支后由 read model 重新读取，ID/digest 不变。

## 十、执行任务状态交接

- Objective：已实现并完成工程验证；Goal 在 commit/push/Draft PR/STATUS_HANDOFF 前保持 active。
- Worktree/Branch/Base：见报告顶部；无第二 worktree。
- 用户可见结果：Goal desk、Intent、Plan revision/approval、Execution DAG/trace、blocked/recovery、zh-CN/en parity。
- 数据状态：append-only PostgreSQL authority；migration 12；restart stable。
- 安全/隐私：public-safe synthetic fixtures；Secret scan PASS；owner-bound mutation；无真实账号或客户资料。
- 建议状态：`M5-07 = EVIDENCE_READY`；Owner UAT 后由 Coordinator 独立核验并决定是否 `ACCEPTED`。
- 下一候选：SDD-010 冻结并实现 Artifact/Skill/Audit 合同；之后 SDD-007 才消费 opaque bundle generations 实现 runtime。

最终 full HEAD、Draft PR URL、commit 列表与完整 changed-file/test handoff 由 Executor 在本报告所属提交推送后主动发送给 Coordinator；报告不使用自引用 commit hash。

## 十一、Coordinator 验收决定

`PENDING`。

Coordinator 需要独立检查 exact base/head、代码 diff、migration/down、专项证据 SHA-256、full `npm run verify`、Draft PR、Owner UAT 返回，并同时更新中英文 canonical progress mirror。Executor 不修改 canonical 状态、不宣称 `ACCEPTED`。
