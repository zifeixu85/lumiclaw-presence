# SDD-006 验收报告｜Production UX 1.4 与本地 Onboarding

> SDD：`SDD-006-PRODUCTION-UX-AND-LOCAL-ONBOARDING`
>
> 模块：`M5-00`（本报告不修改 canonical 状态）
>
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-006-production-ux-onboarding`
>
> Branch / Base：`codex/sdd-006-production-ux-onboarding` / `f36af992965d9614ed5071b075435f70d76d3a37`
>
> 报告状态：`EVIDENCE_READY_CANDIDATE / OWNER_VISUAL_UAT_PENDING`
>
> Owner UAT / Coordinator decision：`PENDING`
> 生成日期：2026-08-16

## 一、交付结果

本修订先关闭了 Coordinator 第一轮对 PR #7 指出的四个 P1：

1. 真实资料路径不再调用或引用 public-safe Campaign。Owner 对照服务端提取文本确认 Organization、Brand、Product、Campaign 与目标字段后，API 创建独立、持久化、`LOCAL_PRIVATE` 的权威 Campaign；Web 的 Campaign、发布、知识与 Shell 均消费实际 `dataMode`。
2. PostgreSQL 上传在同一 row-lock/transaction 线性化边界内验证 owner/session/path；路径错误不会写 Blob 或 manifest，事务后续失败会删除本次新 Blob，并发重复摘要只保留一个 manifest/material ID，完成态不会回退。
3. Coordinator 指出的硬编码英文已进入 `next-intl`；中文默认、英文消息 573 keys 对齐。真实 Chromium 同时覆盖 `zh-CN` 与 `en`，中文页对旧英文短语有显式回归断言。
4. AI 团队一级页面落地“工作概览 / AI 员工 / 团队技能 / 定时任务”四页签，以 `?view=` 保存和恢复状态；六名 Agent、仓库 Skills、0 权威 runtime 观测与无持久定时任务均如实展示。

第二轮复核的两个 P1 也已逐项关闭：

5. 未取得 `INDEPENDENT_AUDIT_PASS` 与精确 `EXACT_EXTERNAL_ACTION_OWNER_DECISION` 时，发布授权固定为 `BLOCKED / MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED`。复制正文与下载素材仅为本地审阅导出，不创建 handoff；打开官方页与“人工完成”均 disabled；直接 POST API 返回 409，Memory 与 PostgreSQL 均不能写入 handoff。
6. Onboarding 完成后，Campaign 已引用的事实资料受到不可删除保护；Memory 与 PostgreSQL 在 session row-lock 边界返回 `LOCAL_MATERIAL_BOUND_TO_CAMPAIGN`。负测确认 manifest、Blob、session material IDs 与 Campaign EvidenceRef 均保持不变。后续删除必须另建 retract/invalidate 流程。

第三轮复核发现的完成态重入旁路已关闭：

7. `COMPLETED` session 不能再通过 `materials-path`、`example`、`context`、重复 `complete` 或 post-completion ingest 降级或改变材料集合。API 预检层和 Memory/PostgreSQL repository 权威层均返回 `409 LOCAL_ONBOARDING_ALREADY_COMPLETED`；PostgreSQL mutation 在同一 session row lock 下判定。fresh-PG 对抗链按“完成 → 五类重入/新增全部 409 → 再删除仍 409”执行，并证明 manifest、Blob、完整 session、Campaign digest 与 EvidenceRef 全不变。

2026-08-16 Owner 视觉 UAT 对 `f19174a777c52f9f0d45b1513f9b89894a1f24d9` 给出 `FAIL → REVISE`：旧展示层虽然工程合同正确，但首屏被内部状态码、警告和大面积空白主导，未忠实还原冻结 UX 1.4。本轮在不改 Domain/API/PostgreSQL/Blob/发布安全合同的前提下重构生产展示层：

8. 全局 Shell 回到 224px 深蓝黑分组侧栏、暖白内容面、薄荷绿主强调和珊瑚色风险语义；恢复 Workspace switcher、Owner footer、breadcrumb、搜索、AI 团队状态、模式与语言入口。
9. Today 恢复三类 Owner 待办、持续 Goal、紧凑协作条和周时间线；AI Team 恢复四页签、六头像、协作看板、队列和来源明确的指标；Campaign/Review/Publish 恢复冻结层级与三栏内容工作区。
10. `LOCAL_PRIVATE` 不显示原型模拟的活跃 Agent、Token、每日完成量、发布成功或已连接账号；内部 stable codes 收进折叠技术详情。未连接账号使用用户语言，发布仍要求独立 Audit 与精确 OwnerDecision。
11. 页面进入为 180ms ease-out，Drawer/Overlay 为 240/220ms；Radix modal 显式 `aria-modal`，并覆盖 focus trap、scroll lock、Esc、focus restore、键盘 tabs、reduced-motion 和 1024/1440 无横向溢出。

这不是“安装后即可添加真实账号并运行 AgentTeams”的完整产品交付。OAuth/live connector/read-back 与 persistent AgentTeams runtime 仍未实现；Owner UAT 未完成，因此本报告不声明 `ACCEPTED`。

## 二、交付范围

| 范围 | 已实现 / 诚实边界 |
|---|---|
| 首次打开 | 只输入本地显示名称；没有邮箱、密码、远端注册或浏览器 API Key 输入。 |
| 两条 Onboarding | public-safe 示例仍独立可用；真实 MD/TXT 路径创建自己的 `LOCAL_PRIVATE` Organization/Brand/Product/Campaign。 |
| 本地资料 | UTF-8 MD/TXT、2 MiB 上限、SHA-256、服务端提取、PostgreSQL manifest + 内容寻址 Blob、Onboarding 前删除、重复/并发/重启恢复；完成后所有旧初始化 mutation、继续 ingest 与删除均 fail-closed。资料更新需未来权威 Campaign update/invalidation 流程。PDF/DOCX 明确 `PLANNED`。 |
| 上下文 | Market / Locale / Platform / IANA Time Zone 分别确认与保存。 |
| 桌面 Shell | 冻结 UX 1.4 的品牌区、Workspace switcher、分组导航、Owner footer、breadcrumb/search/team/mode/locale 顶栏；今天、Campaign、日历、发布中心、反馈、品牌资料、账号、设置及 AI 团队四页签；小于 1024px 显示 desktop gate。 |
| Today | 三类 Owner 待办、持续 Goal、单一紧凑协作条和周时间线；环境诊断不占主列；`LOCAL_PRIVATE` 不制造业务进度或运行态。 |
| Review | 批准前全文、媒体与平台预览、紧凑当前责任、可展开 trace、Esc/focus restore；缺少独立 runtime Audit 时批准 disabled。 |
| AI 团队 | A0–A5 专业头像、职责与 Skills；配置数和权威观测数分开，Token/每日完成量无观测时显示“未观测”，稳定码只在技术详情。 |
| 发布授权 | 本 SDD 没有权威独立 Audit 与精确 OwnerDecision，因此只有复制审阅稿、下载审阅素材；打开官方页、自报完成与 API handoff 创建均 fail-closed。历史合法 handoff 只读；不产生 `PUBLISHED`。 |
| Readiness / 账号 | Web/API/PostgreSQL/adapter/runtime 确定性合同；账号添加/测试 disabled；runtime 为 `NOT_CONFIGURED / SDD_007_REQUIRED`。 |
| 延后 | AgentTeams 安装/常驻/Secret broker/dispatch/recovery（SDD-007）；平台 OAuth、live probe、自动发布、read-back 与账号对账（后续 connector SDD）。 |

## 三、实现证据

- Domain/API：`packages/domain/src/local-campaign.ts`、`apps/api/src/server.ts`、`apps/api/src/openapi.ts`。
- PostgreSQL/Blob：`packages/db/migrations/000008_local_private_campaign.cjs`、`packages/db/src/local-presence-repository.ts`、`.evidence/sdd-006/compose-verification.json`。
- Web：`apps/web/src/components/{onboarding,layout,features,ui}`、`apps/web/src/styles/{tokens,base,workspace}.css`、`apps/web/messages/{zh-CN,en}.json`、`apps/web/public/ux/`。
- Browser：`docs/reports/evidence/sdd-006/browser-verification.json`；49 项断言、17 张 public-safe PNG（其中 16 张为 1440×900）、console error 0、双语 axe serious/critical 0。
- 视觉映射：`docs/reports/evidence/sdd-006/UX-1.4-PROTOTYPE-PRODUCTION-MAP.md`；冻结原型 → 生产 route/state/token/component 边界。
- 逐屏对照：`docs/reports/evidence/sdd-006/UX-1.4-VISUAL-COMPARISON.md`；Today、AI Team、Campaign、Review、Publish 五组 1920×600 并排图与自查。
- 依赖：`docs/reports/evidence/sdd-006/DEPENDENCY-LICENSE-REVIEW.md`、`.evidence/sdd-006/{license-inventory.json,sbom.cdx.json}`；本次 REVISE 未改变 `package.json` 或 lockfile。

最终证据 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `01-first-open.png` | `7dd18289d7b5df1b83fbaa25d9a40f398c6efcb7de1a68d562e363161d0527da` |
| `02-onboarding-path-choice.png` | `f968a55339f8e360bfa67fb4d6eee0c78e1ea79b6f139e30ce66b4604f23ba97` |
| `03-local-private-context-confirmation.png` | `853787694f2833fc3ddb094a82026641c03292b49a95c05584d681ee0ac1d8ba` |
| `04-today.png` | `9ec78d6199e164265edd72d16fe90590820269e8399b66b6c8408c3912078efd` |
| `05-campaign.png` | `aeda3795f73543fe2d35bf52155c572b86a1f656b8a9a638eb665e61ad307913` |
| `06-full-content-review-drawer.png` | `7d406e408e9e3e45008b480becd07aff5c65a63841f4265ff9b926472b83f9d1` |
| `07-ai-team-overview.png` | `dfc1308bf06679c0d802d9e65e06b2a19ab398f0421c20fc07b838e8b45254a1` |
| `08-ai-employees.png` | `03b0de972167d578e0743e9c9b106787e139c9866a5fcda6669b4411a56ddb2e` |
| `09-team-skills.png` | `fc1006eee9a6baabc18672985fa59ded1c9f5ffe8d6bc1d0ec9c4c8ff981e650` |
| `10-scheduled-tasks.png` | `1cd19342ab27ea6f812902188be0ae66b5c2855d9d4b30349a57468c056ae3e0` |
| `11-publish-center.png` | `a7bee2c74f57356f9355ce90a2154f37f1d27cc9fbe3209febac23acd83ed8aa` |
| `12-brand-knowledge.png` | `fbdfc3652d2829c863058ae2762e8dfcec81515aceea67f8b974b5bd6d98dca7` |
| `13-settings-readiness.png` | `d1a8c2bfa42a0dcf3a56cc90897a36f48ed2b5c738930c9cd9a3ae8d0f849e9c` |
| `14-en-today.png` | `8620bc58b023a4362d9b361d29fec119e08cd25531055f8a45bb6a4665488ac6` |
| `15-en-ai-team.png` | `51819271b5e292620e171e762ae19eefca0ddfc5d87232e4ebd561ae7cafd25f` |
| `16-en-publish-center.png` | `4e094dab5ffab55f488ec349b42fa90bf6ce39bc4577be00b4165fe3f408ef3d` |
| `17-desktop-gate.png` | `8bbe5694ad491364b1352fe3e99b0517e0e0807ec5d9ba8eda38f8225d0c4f47` |
| `comparisons/today-prototype-production.png` | `4705d2e45d147ad47dee03eadbceabca5ee07de7fe2d62c78ba9b9376b2cbdd6` |
| `comparisons/ai-team-prototype-production.png` | `84aedaa8b106477ed323d181134446326579949f675d43c76959843a0df70a77` |
| `comparisons/campaign-prototype-production.png` | `18784324c971545feee9321d4addcf04e241e3ec4bc15f7a55c155bac9507d7c` |
| `comparisons/review-prototype-production.png` | `1d3c164facbaf3130507aeaf2a593705b813fc2b3e5c66318f4e239437294a7d` |
| `comparisons/publish-prototype-production.png` | `70c0648a79783aa0c29653fc47b401543a5fa5bd214475a9cd4615af4349c126` |
| `browser-verification.json` | `43287b214e75c7b4e6d06e0326cdff09fdb4677fc42384dd234fc4256c86e077` |
| `.evidence/sdd-006/compose-verification.json` | `f141c6c40c2cf90c8e86d30d3bff2a9f35d6c41d93a93514306463f5a00f5d9b` |

## 四、自动化验证

| 精确命令 | 结果 |
|---|---|
| `npm run lint` | `PASS`，0 error / 0 warning。 |
| `npm run typecheck` | `PASS`，12 workspace typecheck。 |
| `npm test -- apps/api/src/memory-local-presence-repository.test.ts apps/api/src/local-presence-api.test.ts apps/api/src/server.test.ts packages/domain/src/local-campaign.test.ts` | `PASS`，4 files / 56 tests；含 API/Memory 完成态 mutation 对抗链。 |
| `npm test -- --run apps/api/src/local-presence-api.test.ts apps/api/src/memory-local-presence-repository.test.ts apps/web/src/components/production-workspace.test.ts apps/web/src/components/campaign-workspace.test.ts` | `PASS`，4 files / 12 tests。 |
| `npm test` | `PASS`，36 files / 322 tests。 |
| `npm run check:messages` | `PASS`，zh-CN/en 573 keys。 |
| `npm run check:status` | `PASS`，40 modules；未改 canonical 状态。 |
| `npm run check:secrets` | `PASS`，364 files。 |
| `npm run verify:sdd006:compose` | `PASS`，12 Compose/PG checks + 49 browser checks + 17 screenshots；cleanup PASS。 |
| `npm run verify:compose` | `PASS`，既有 fresh/broken migration、PG/Blob restart、非 live 与 operator 回归。 |
| `npm run verify:sdd006:dependencies` | `PASS`，1020 packages、disallowed/unknown 0；CycloneDX 1.6 / 710 components。 |
| `npm audit --omit=dev --audit-level=high` | `PASS`，0 production vulnerability。 |
| `npm run verify` | `PASS`（最终报告写入后执行），完整 static + production build + Storybook browser-safety。 |

`verify:sdd006:compose` 的真实 PostgreSQL 负测包括：未选择 `LOCAL_MATERIALS` 时 422 且 manifest/blob 均不存在；人为 DB constraint 让 Blob put 后 insert 失败，API 503 且新 Blob 被清理；完成前两个并发重复上传返回同一 material ID、DB 仅一条 manifest、session material IDs 仅一个；完成后 API 的 path/example/context/complete/ingest 与容器内直接调用 PostgreSQL repository 的对应五类 mutation 全部返回 `LOCAL_ONBOARDING_ALREADY_COMPLETED`，新 Blob 不存在，完整 session/Campaign digest/EvidenceRef 不变；随后删除仍返回 `LOCAL_MATERIAL_BOUND_TO_CAMPAIGN` 且 manifest/Blob/session/Campaign EvidenceRef 不变；未审校 Revision 直接创建 handoff 返回 409 且数据库为 0 条。首次执行前 Docker/OrbStack 未运行，执行 `orbctl start` 恢复任务环境；第一次镜像解包因本机 Docker 存储不足失败，只清理了 5.708GB 可回收 build cache（未删除容器、镜像、volume 或数据库），最终从 fresh volume 干净重跑通过。

## 五、验收标准结果

| AC | 结果 | 证据与边界 |
|---|---|---|
| AC-01 | `PASS` | fresh DB 仅一个 display-name input；profile/session PostgreSQL reopen。 |
| AC-02 | `PASS` | 示例路径仍创建并清楚标记 `PUBLIC_SAFE_EXAMPLE`，无外部动作。 |
| AC-03 | `PASS` | MD/TXT 实际提取、digest/Blob/PG restart；错误路径、DB 失败、完成前重复并发、类型/UTF-8 负测；完成后五类初始化/ingest mutation 与删除分别以稳定码 fail-closed，manifest/Blob/session/Campaign digest/EvidenceRef 不变；PDF/DOCX disabled + `PLANNED`。 |
| AC-04 | `PASS` | 冻结 Shell、Today、初始化、Campaign、Review、发布授权、AI 团队主流程为真实 React 与权威/明确 planned 状态；五组原型/生产并排证据显示导航、层级、密度、色彩和组件已回到 UX 1.4；不把后续 connector/runtime 称为已实现。 |
| AC-05 | `PASS` | 全文先于批准；单一当前 Agent + 展开 trace；批准 disabled；Chromium Esc/focus restore/axe。 |
| AC-06 | `PASS` | 缺独立 Audit 与精确 OwnerDecision 时 UI/API/Memory/PG 全部拒绝新 handoff；复制/下载只作审阅导出；历史合法回执至多只读 `AWAITING_RECONCILIATION`；账号/runtime 控件 disabled 并给 remediation。 |
| AC-07 | `PASS` | Browser 无 Key input，secret-shaped body 422，Secret scan 通过。 |
| AC-08 | `PASS` | 精确 pinned 版本、许可证、SBOM；共享 token/primitive，不新增无用依赖。 |
| AC-09 | `PASS` | 573-key parity；真实 zh/en 关键页含双语发布门槛；普通页 stable-code headline 与私有/演示标签回归断言；keyboard/focus、reduced-motion、axe、1024/1440 overflow、desktop gate、17 张截图、build/Storybook。 |
| AC-10 | `PASS` | 36 files / 322 tests 与通用 Compose、AgentTeams adapter/profile、Campaign/schedule 回归保持绿色。 |

## 六、Owner 参与验收

Owner UAT 仍为 `PENDING`，建议状态最多 `EVIDENCE_READY`。前置：Docker 可用；使用本报告 Worktree；只准备 public-safe MD/TXT。

1. `docker compose --project-name lumiclaw-sdd006-owner-uat up --build --detach`，打开 <http://127.0.0.1:3100>。在 1440×900 下预期先看到深蓝黑步骤侧栏与暖白表单，只有显示名称；出现 email/password/API Key 即失败。
2. 检查 Onboarding 路径选择、资料确认与完成反馈。预期步骤、卡片、字段层级和焦点清楚；MD/TXT 真实上传；`DEMO_SEED` 与 `LOCAL_PRIVATE` 的技术码只在折叠详情。
3. 先验证 public-safe 示例：应进入冻结层级的完整 Shell 并清楚显示“演示数据”，不连接账号。记录 Today/Campaign 截图；模拟业务结果与真实观测混在一起即失败。
4. 清理该 UAT project volume 后重启，选择真实本地资料，上传 public-safe MD/TXT；对照“查看提取文本”填写并确认 Organization/Brand/Product/Campaign 与四个上下文。预期工作区、品牌资料、Campaign 都显示你填写的名称与“本机资料”，不得出现 LumiClaw 示例 Campaign。
5. 在 Today、Campaign、完整内容 Drawer、AI Team 四页签、Publish、Brand、Settings 逐屏与 `UX-1.4-VISUAL-COMPARISON.md` 对照。重点确认导航、任务优先级、密度、色彩、头像、媒体预览、状态解释和无大面积工程警告；返回视觉 PASS/FAIL 与具体屏幕。
6. 重启 PostgreSQL/API/全栈。预期同一 Campaign 与材料仍在。资料消失、Campaign 变成示例或状态退回 Onboarding 即失败。
7. Campaign → 完整内容：预期阅读全文、媒体/平台预览、单一当前责任与 trace；缺少 Audit receipt 时批准 disabled；Tab 留在抽屉，Esc 关闭并恢复焦点。完成 Onboarding 后依次调用 `materials-path`、`example`、`context`、重复 `complete` 与上传新 MD/TXT，均应返回 `409 LOCAL_ONBOARDING_ALREADY_COMPLETED`；随后删除已绑定资料仍应返回 `409 LOCAL_MATERIAL_BOUND_TO_CAMPAIGN`。
8. AI Team 逐个打开四页签并刷新 `?view=employees|skills|schedules`。预期状态可恢复；A0–A5 恰好六名；Skills 为仓库来源；本机无 runtime 时主界面显示“角色已配置 / 暂无权威运行观测”，不得显示模拟 active/Token/完成量。
9. 发布中心执行复制/下载：预期仅显示审阅导出反馈且不创建 handoff；目标账号未接通时显示“尚未连接”，普通页面不显示 placeholder code；“打开官方页”和“人工完成”disabled。账号添加/测试也 disabled；稳定码仅在 Settings/技术详情。切换 English 后检查 Today/AI Team/Publish，再缩到 800px 验证 desktop gate。

Owner 返回：步骤 1–9 的 PASS/FAIL、失败步骤、1440×900 截图或短录屏路径，以及明确的视觉/交互决定。清理：`docker compose --project-name lumiclaw-sdd006-owner-uat down --volumes --remove-orphans`。不得提交真实企业资料。

## 七、ChatGPT Pro 双代理记录

本 SDD 未获授权也未使用 ChatGPT Pro 外部工程协作；外部 URL/ZIP/补丁均为 `N/A`。

## 八、失败、限制与非声明

Known limitations：

- Persistent AgentTeams、terminal Secret broker、固定版本安装、mission-worker dispatch、restart/upgrade/recovery 属于 SDD-007；当前只有 readiness/adapter 接入边界。
- 真实账号添加/能力探测/OAuth/live connector/read-back 尚未实现；全部 disabled/`PLANNED`，需要后续 connector SDD。
- PDF/DOCX parser、license/security review 未完成，界面不接受这两类文件。
- 完成 Onboarding 后不能通过旧初始化接口追加、替换或删除资料；资料演进需要未来具备 Campaign revision、Evidence invalidation/retract 与重新审校的权威流程。
- 日历、反馈、AI 定时任务在没有权威业务状态时展示空/blocked/planned，不制造运行或结果。
- 本 SDD 没有独立 Audit/精确 OwnerDecision 权威链，因此新人工发布、自报完成、打开官方页与 handoff API 均 blocked；未来具备授权后的 handoff 仍需 read-back 对账，不能凭打开页面或自报完成成为 `PUBLISHED`。
- 本地 Owner 当前为单机单 profile；非 hosted auth、多租户或 production-ready 声明。
- development audit 仍继承既有 Storybook 工具链 3 个 high 警告；`npm audit --omit=dev` 为 0。本 SDD 不执行破坏性 `npm audit fix --force`。
- Owner 已对输入 HEAD `f19174a7…` 的旧展示层给出视觉 UAT FAIL；本轮只完成 Executor 自查、自动视觉/交互证据与 Coordinator 复核候选，新的 Owner 视觉 UAT 尚未执行。
- 不声明 `ACCEPTED`、客户 UAT、真实 Agent run、增长、线索、收入、法律合规或“完整安装后即可运营”。

## 九、回滚与恢复

Rollback：未合并时关闭 Draft PR；合并后用一个 revert commit 回滚 SDD-006 修订，不使用 `git reset --hard`。Migration `000008_local_private_campaign.cjs` 是 additive check-constraint 扩展；down 前若存在 `LOCAL_PRIVATE` Organization，需先由 Owner 决定数据导出/删除，不能盲目回滚约束。

仅清理本任务 project：

```bash
docker compose --project-name lumiclaw-sdd006-verify down --volumes --remove-orphans
docker compose --project-name lumiclaw-sdd006-owner-uat down --volumes --remove-orphans
```

## 十、执行任务状态交接

- Objective：在保留已通过的 SDD-006 Domain/API/PostgreSQL/Blob/Onboarding/发布 fail-closed 合同前提下，把 `f19174a7…` 被 Owner 否决的工程控制台式展示层重构回冻结 UX 1.4，并提供逐屏、动效、可访问性与全量工程证据。
- Goal status：`COMPLETE`（工程实现、报告、提交、push、remote/CI 核验及 Coordinator `STATUS_HANDOFF` 全部完成后生效；不代表 Owner UAT 或 `ACCEPTED`）。
- Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-006-production-ux-onboarding`
- Branch / Base：`codex/sdd-006-production-ux-onboarding` / `f36af992965d9614ed5071b075435f70d76d3a37`
- Coordinator 第二轮复核输入 HEAD：`2faad2fb05d843822289265dbea88d6b5d7cf1fd`
- 已验证修复实现与证据 commit：`e8c6f9ad9a9abf956e963bdae793f8b61689f485`
- Coordinator 第三轮复核输入 HEAD：`85f6113bbd4d81a1feac87e52d58149cfcd9e9da`
- 第三轮已验证修复实现与证据 commit：`1fa71e09f09468408d0a8087a0dae9da997bd9a9`
- Owner 视觉 REVISE 输入 HEAD：`f19174a777c52f9f0d45b1513f9b89894a1f24d9`
- Final remote full HEAD：见同一 [zifeixu85/lumiclaw-presence PR #7](https://github.com/zifeixu85/lumiclaw-presence/pull/7) 的当前 head ref 与主动 `STATUS_HANDOFF`；Git commit 无法在自身内容中嵌入自身 SHA，本字段不使用 `PENDING` 占位。
- Draft PR：[PR #7](https://github.com/zifeixu85/lumiclaw-presence/pull/7)
- 建议 maturity/canonical state：`M5-00 → EVIDENCE_READY` 候选；Owner UAT 和 Coordinator 复验前不得 `ACCEPTED`，Executor 不修改 canonical module。
- 下一候选：SDD-007；之后仍需账号/connector SDD 才能添加真实账号并对账。

## 十一、Coordinator 验收决定

`PENDING`。Coordinator 需在最终 remote full SHA 上复核视觉 REVISE、既有安全回归、changed files、CI、AC/证据 digest；Owner 再执行步骤 1–9 的视觉 UAT 后，才可决定 canonical state。本报告不声明 `ACCEPTED`。
