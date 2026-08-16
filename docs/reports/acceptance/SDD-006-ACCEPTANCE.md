# SDD-006 验收报告｜Production UX 1.4 与本地 Onboarding

> SDD：`SDD-006-PRODUCTION-UX-AND-LOCAL-ONBOARDING`
>
> 模块：`M5-00`（本报告不修改 canonical 状态）
>
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-006-production-ux-onboarding`
>
> Branch / Base：`codex/sdd-006-production-ux-onboarding` / `f36af992965d9614ed5071b075435f70d76d3a37`
>
> 报告状态：`EVIDENCE_READY_CANDIDATE`
>
> Owner UAT / Coordinator decision：`PENDING`
> 生成日期：2026-08-16

## 一、交付结果

本修订先关闭了 Coordinator 第一轮对 PR #7 指出的四个 P1：

1. 真实资料路径不再调用或引用 public-safe Campaign。Owner 对照服务端提取文本确认 Organization、Brand、Product、Campaign 与目标字段后，API 创建独立、持久化、`LOCAL_PRIVATE` 的权威 Campaign；Web 的 Campaign、发布、知识与 Shell 均消费实际 `dataMode`。
2. PostgreSQL 上传在同一 row-lock/transaction 线性化边界内验证 owner/session/path；路径错误不会写 Blob 或 manifest，事务后续失败会删除本次新 Blob，并发重复摘要只保留一个 manifest/material ID，完成态不会回退。
3. Coordinator 指出的硬编码英文已进入 `next-intl`；中文默认、英文消息 375 keys 对齐。真实 Chromium 同时覆盖 `zh-CN` 与 `en`，中文页对旧英文短语有显式回归断言。
4. AI 团队一级页面落地“工作概览 / AI 员工 / 团队技能 / 定时任务”四页签，以 `?view=` 保存和恢复状态；六名 Agent、仓库 Skills、0 权威 runtime 观测与无持久定时任务均如实展示。

第二轮复核的两个 P1 也已逐项关闭：

5. 未取得 `INDEPENDENT_AUDIT_PASS` 与精确 `EXACT_EXTERNAL_ACTION_OWNER_DECISION` 时，发布授权固定为 `BLOCKED / MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED`。复制正文与下载素材仅为本地审阅导出，不创建 handoff；打开官方页与“人工完成”均 disabled；直接 POST API 返回 409，Memory 与 PostgreSQL 均不能写入 handoff。
6. Onboarding 完成后，Campaign 已引用的事实资料受到不可删除保护；Memory 与 PostgreSQL 在 session row-lock 边界返回 `LOCAL_MATERIAL_BOUND_TO_CAMPAIGN`。负测确认 manifest、Blob、session material IDs 与 Campaign EvidenceRef 均保持不变。后续删除必须另建 retract/invalidate 流程。

这不是“安装后即可添加真实账号并运行 AgentTeams”的完整产品交付。OAuth/live connector/read-back 与 persistent AgentTeams runtime 仍未实现；Owner UAT 未完成，因此本报告不声明 `ACCEPTED`。

## 二、交付范围

| 范围 | 已实现 / 诚实边界 |
|---|---|
| 首次打开 | 只输入本地显示名称；没有邮箱、密码、远端注册或浏览器 API Key 输入。 |
| 两条 Onboarding | public-safe 示例仍独立可用；真实 MD/TXT 路径创建自己的 `LOCAL_PRIVATE` Organization/Brand/Product/Campaign。 |
| 本地资料 | UTF-8 MD/TXT、2 MiB 上限、SHA-256、服务端提取、PostgreSQL manifest + 内容寻址 Blob、Onboarding 前删除、重复/并发/重启恢复；完成并绑定 Campaign 后 fail-closed，不提供静默删除。PDF/DOCX 明确 `PLANNED`。 |
| 上下文 | Market / Locale / Platform / IANA Time Zone 分别确认与保存。 |
| 桌面 Shell | 今天、Campaign、日历、发布中心、反馈、品牌资料、账号、设置及 AI 团队四页签；小于 1024px 显示 desktop gate。 |
| Review | 批准前全文、紧凑当前 Agent、可展开 trace、Esc/focus restore；缺少独立 runtime Audit 时批准 disabled。 |
| AI 团队 | A0–A5 职责、Skills、Token、每日完成量和状态；指标来源固定显示 `NO_RUNTIME_OBSERVATION`。 |
| 发布授权 | 本 SDD 没有权威独立 Audit 与精确 OwnerDecision，因此只有复制审阅稿、下载审阅素材；打开官方页、自报完成与 API handoff 创建均 fail-closed。历史合法 handoff 只读；不产生 `PUBLISHED`。 |
| Readiness / 账号 | Web/API/PostgreSQL/adapter/runtime 确定性合同；账号添加/测试 disabled；runtime 为 `NOT_CONFIGURED / SDD_007_REQUIRED`。 |
| 延后 | AgentTeams 安装/常驻/Secret broker/dispatch/recovery（SDD-007）；平台 OAuth、live probe、自动发布、read-back 与账号对账（后续 connector SDD）。 |

## 三、实现证据

- Domain/API：`packages/domain/src/local-campaign.ts`、`apps/api/src/server.ts`、`apps/api/src/openapi.ts`。
- PostgreSQL/Blob：`packages/db/migrations/000008_local_private_campaign.cjs`、`packages/db/src/local-presence-repository.ts`、`.evidence/sdd-006/compose-verification.json`。
- Web：`apps/web/src/components/{onboarding,layout,features,ui}`、`apps/web/messages/{zh-CN,en}.json`。
- Browser：`docs/reports/evidence/sdd-006/browser-verification.json`；33 项断言、14 张 canonical public-safe PNG、console error 0、双语 axe serious/critical 0。
- 依赖：`docs/reports/evidence/sdd-006/DEPENDENCY-LICENSE-REVIEW.md`、`.evidence/sdd-006/{license-inventory.json,sbom.cdx.json}`；本次 REVISE 未改变 `package.json` 或 lockfile。

最终证据 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `01-first-open.png` | `522226932b77b070b3407ac7edb613ce8ac6bdf65d548417558cacc43437514a` |
| `02-local-private-onboarding-confirmed.png` | `f36e58282f7962b73921a8ca3b31c5740f35b8bc9726b546f1fa49186aef03ec` |
| `03-local-private-today-workspace.png` | `459f16e74e84d3cd9515364dc91b8e4cfdc6b3a504c2df60a008122cc7f27820` |
| `04-local-private-knowledge-graph.png` | `340d383dc1f8f9edaeeb3568ba3fce7c4a6f08c2295b746652c2a0a7c41d370e` |
| `05-full-content-review-drawer.png` | `b81872de798e02c8db4df03895c485e450771128c568665fe604d1c046ef6909` |
| `06-ai-team-work-overview.png` | `2c0b8746867a568988737103c7c94c651d3c4961a9e542ace0da0c9d9948b2d6` |
| `07-ai-team-employees.png` | `ea326b4ef42870d73686cf7dac48d56cc29aafa7db6fde76f577edcd5157a1ba` |
| `08-ai-team-skills.png` | `5cc00848c1980cba91f22504f592082632526b2ecabdaa409e7999e2ec08d2f6` |
| `09-ai-team-scheduled-tasks.png` | `704ccb8866f135fb1a83263494c77da1ae20c5773543936500c5e53ba26741dc` |
| `10-publish-center-blocked.png` | `a283a7516edffb3ef4580bc82ce45fab259fcba0512e09d22297faf3da4cf5d9` |
| `11-en-today-workspace.png` | `81020359b0f33a3e6419326a6634935044e8c54a9a6419756a290179f8868586` |
| `12-en-ai-team-overview.png` | `ab4fd35067e4039668435ebb65174d37f3ba5aebabdb2383f0956481d3d79664` |
| `13-en-publish-center-blocked.png` | `0408d77dcaa36969ba3ab78cfe7fb112f7aee7b4d974a59443ca42ac450a6461` |
| `14-desktop-gate.png` | `f84d4a3b5d900743d84a621528a654551f47fbc3d9ad96d6e8f318f5390269e5` |
| `browser-verification.json` | `aa86cd83553b1eccb5e01d363477cb1a0092fdd1055412777a3bdfc2f5369976` |
| `.evidence/sdd-006/compose-verification.json` | `1db4f353ada65f2bc65d8d5eaf1f07bbe9045e6b510b3487a72d24ed2bb434ea` |

## 四、自动化验证

| 精确命令 | 结果 |
|---|---|
| `npm run lint` | `PASS`，0 error / 0 warning。 |
| `npm run typecheck` | `PASS`，12 workspace typecheck。 |
| `npm test -- apps/api/src/memory-local-presence-repository.test.ts packages/domain/src/local-campaign.test.ts apps/api/src/local-presence-api.test.ts apps/web/src/components/production-workspace.test.ts` | `PASS`，4 files / 10 tests。 |
| `npm test` | `PASS`，36 files / 322 tests。 |
| `npm run check:messages` | `PASS`，zh-CN/en 375 keys。 |
| `npm run check:status` | `PASS`，40 modules；未改 canonical 状态。 |
| `npm run check:secrets` | `PASS`，326 files。 |
| `npm run verify:sdd006:compose` | `PASS`，11 Compose/PG checks + 33 browser checks + 14 screenshots；cleanup PASS。 |
| `npm run verify:compose` | `PASS`，既有 fresh/broken migration、PG/Blob restart、非 live 与 operator 回归。 |
| `npm run verify:sdd006:dependencies` | `PASS`，1020 packages、disallowed/unknown 0；CycloneDX 1.6 / 710 components。 |
| `npm audit --omit=dev --audit-level=high` | `PASS`，0 production vulnerability。 |
| `npm run verify` | `PASS`（最终报告写入后执行），完整 static + production build + Storybook browser-safety。 |

`verify:sdd006:compose` 的真实 PostgreSQL 负测包括：未选择 `LOCAL_MATERIALS` 时 422 且 manifest/blob 均不存在；人为 DB constraint 让 Blob put 后 insert 失败，API 503 且新 Blob 被清理；两个并发重复上传返回同一 material ID、DB 仅一条 manifest、session material IDs 仅一个且 `COMPLETED` 不回退；完成态删除返回 409 且 manifest/Blob/session/Campaign EvidenceRef 不变；未审校 Revision 直接创建 handoff 返回 409 且数据库为 0 条。首次执行前 Docker/OrbStack 未运行，执行 `orbctl start` 恢复任务环境；修复浏览器断言后以上表格记录的是最终干净重跑结果。

## 五、验收标准结果

| AC | 结果 | 证据与边界 |
|---|---|---|
| AC-01 | `PASS` | fresh DB 仅一个 display-name input；profile/session PostgreSQL reopen。 |
| AC-02 | `PASS` | 示例路径仍创建并清楚标记 `PUBLIC_SAFE_EXAMPLE`，无外部动作。 |
| AC-03 | `PASS` | MD/TXT 实际提取、digest/Blob/PG restart；错误路径、DB 失败、重复并发、类型/UTF-8 负测；绑定 Campaign 后删除以稳定码 fail-closed 且四类权威引用不变；PDF/DOCX disabled + `PLANNED`。 |
| AC-04 | `PASS` | 冻结 Shell、初始化、Campaign、Review、发布授权、AI 团队主流程为真实 React 与权威/明确 planned 状态；本 SDD 无权威发布授权时诚实 blocked，不把后续 connector/runtime 称为已实现。 |
| AC-05 | `PASS` | 全文先于批准；单一当前 Agent + 展开 trace；批准 disabled；Chromium Esc/focus restore/axe。 |
| AC-06 | `PASS` | 缺独立 Audit 与精确 OwnerDecision 时 UI/API/Memory/PG 全部拒绝新 handoff；复制/下载只作审阅导出；历史合法回执至多只读 `AWAITING_RECONCILIATION`；账号/runtime 控件 disabled 并给 remediation。 |
| AC-07 | `PASS` | Browser 无 Key input，secret-shaped body 422，Secret scan 通过。 |
| AC-08 | `PASS` | 精确 pinned 版本、许可证、SBOM；共享 token/primitive，不新增无用依赖。 |
| AC-09 | `PASS` | 375-key parity；真实 zh/en 关键页含双语发布门槛；中文旧英文短语回归断言；keyboard/focus、axe、desktop gate、14 张截图、build/Storybook。 |
| AC-10 | `PASS` | 36 files / 322 tests 与通用 Compose、AgentTeams adapter/profile、Campaign/schedule 回归保持绿色。 |

## 六、Owner 参与验收

Owner UAT 仍为 `PENDING`，建议状态最多 `EVIDENCE_READY`。前置：Docker 可用；使用本报告 Worktree；只准备 public-safe MD/TXT。

1. `docker compose --project-name lumiclaw-sdd006-owner-uat up --build --detach`，打开 <http://127.0.0.1:3100>。预期只有显示名称；出现 email/password/API Key 即失败。
2. 先验证 public-safe 示例：应进入完整 Shell 并显示示例标签，不连接账号。记录 Today/Campaign 截图。
3. 清理该 UAT project volume 后重启，选择真实本地资料，上传 public-safe MD/TXT；对照“查看提取文本”填写并确认 Organization/Brand/Product/Campaign 与四个上下文。预期工作区、品牌资料、Campaign 都显示你填写的名称与 `LOCAL_PRIVATE`，不得出现 LumiClaw 示例 Campaign。
4. 重启 PostgreSQL/API/全栈。预期同一 Campaign 与材料仍在。资料消失、Campaign 变成示例或状态退回 Onboarding 即失败。
5. Campaign → 完整内容：预期阅读全文、当前 Agent 与 trace；缺少 Audit receipt 时批准 disabled；Tab 留在抽屉，Esc 关闭并恢复焦点。完成 Onboarding 后尝试删除已绑定事实资料时，预期 API 返回 `LOCAL_MATERIAL_BOUND_TO_CAMPAIGN`，重开后资料与 Campaign EvidenceRef 均仍存在。
6. AI 团队：逐个打开四页签，刷新 `?view=employees|skills|schedules`。预期状态可恢复；A0–A5 恰好六名；Skills 为仓库来源；定时任务显示 `PLANNED / NO_RUNTIME_OBSERVATION`。
7. 发布中心执行复制/下载：预期仅显示审阅导出完成且不创建 handoff；“打开官方页”和“人工完成”应 disabled，并显示缺 `INDEPENDENT_AUDIT_PASS` / `EXACT_EXTERNAL_ACTION_OWNER_DECISION`。直接 POST handoff API 应返回 409；按钮可用、新 handoff、`AWAITING_RECONCILIATION` 或 `PUBLISHED` 都算失败。
8. 账号/设置：预期添加/测试 disabled，Runtime `NOT_CONFIGURED / SDD_007_REQUIRED`，无 Key 输入；切换 English 检查关键页，再缩到 800px 验证 desktop gate。

Owner 返回：步骤 1–8 的 PASS/FAIL、失败步骤、截图/短录屏路径、视觉/交互决定。清理：`docker compose --project-name lumiclaw-sdd006-owner-uat down --volumes --remove-orphans`。不得提交真实企业资料。

## 七、ChatGPT Pro 双代理记录

本 SDD 未获授权也未使用 ChatGPT Pro 外部工程协作；外部 URL/ZIP/补丁均为 `N/A`。

## 八、失败、限制与非声明

Known limitations：

- Persistent AgentTeams、terminal Secret broker、固定版本安装、mission-worker dispatch、restart/upgrade/recovery 属于 SDD-007；当前只有 readiness/adapter 接入边界。
- 真实账号添加/能力探测/OAuth/live connector/read-back 尚未实现；全部 disabled/`PLANNED`，需要后续 connector SDD。
- PDF/DOCX parser、license/security review 未完成，界面不接受这两类文件。
- 日历、反馈、AI 定时任务在没有权威业务状态时展示空/blocked/planned，不制造运行或结果。
- 本 SDD 没有独立 Audit/精确 OwnerDecision 权威链，因此新人工发布、自报完成、打开官方页与 handoff API 均 blocked；未来具备授权后的 handoff 仍需 read-back 对账，不能凭打开页面或自报完成成为 `PUBLISHED`。
- 本地 Owner 当前为单机单 profile；非 hosted auth、多租户或 production-ready 声明。
- development audit 仍继承既有 Storybook 工具链 3 个 high 警告；`npm audit --omit=dev` 为 0。本 SDD 不执行破坏性 `npm audit fix --force`。
- 不声明 `ACCEPTED`、客户 UAT、真实 Agent run、增长、线索、收入、法律合规或“完整安装后即可运营”。

## 九、回滚与恢复

Rollback：未合并时关闭 Draft PR；合并后用一个 revert commit 回滚 SDD-006 修订，不使用 `git reset --hard`。Migration `000008_local_private_campaign.cjs` 是 additive check-constraint 扩展；down 前若存在 `LOCAL_PRIVATE` Organization，需先由 Owner 决定数据导出/删除，不能盲目回滚约束。

仅清理本任务 project：

```bash
docker compose --project-name lumiclaw-sdd006-verify down --volumes --remove-orphans
docker compose --project-name lumiclaw-sdd006-owner-uat down --volumes --remove-orphans
```

## 十、执行任务状态交接

- Objective：修复 PR #7 第一轮四个 P1 与第二轮“发布授权绕过 / Campaign 证据可删除 / 交付证据不一致”，并在同一分支提供可重复工程证据。
- Goal status：`COMPLETE`（工程实现、报告、提交、push、remote/CI 核验及 Coordinator `STATUS_HANDOFF` 全部完成后生效；不代表 Owner UAT 或 `ACCEPTED`）。
- Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-006-production-ux-onboarding`
- Branch / Base：`codex/sdd-006-production-ux-onboarding` / `f36af992965d9614ed5071b075435f70d76d3a37`
- Coordinator 第二轮复核输入 HEAD：`2faad2fb05d843822289265dbea88d6b5d7cf1fd`
- 已验证修复实现与证据 commit：`e8c6f9ad9a9abf956e963bdae793f8b61689f485`
- Final remote full HEAD：见同一 [zifeixu85/lumiclaw-presence PR #7](https://github.com/zifeixu85/lumiclaw-presence/pull/7) 的当前 head ref 与主动 `STATUS_HANDOFF`；Git commit 无法在自身内容中嵌入自身 SHA，本字段不使用 `PENDING` 占位。
- Draft PR：[PR #7](https://github.com/zifeixu85/lumiclaw-presence/pull/7)
- 建议 maturity/canonical state：`M5-00 → EVIDENCE_READY` 候选；Owner UAT 和 Coordinator 复验前不得 `ACCEPTED`，Executor 不修改 canonical module。
- 下一候选：SDD-007；之后仍需账号/connector SDD 才能添加真实账号并对账。

## 十一、Coordinator 验收决定

`PENDING`。Coordinator 需在最终 remote full SHA 上复核第一轮四个 P1、第二轮两个 P1、changed files、CI、AC/证据 digest 与 Owner UAT，再决定 canonical state。
