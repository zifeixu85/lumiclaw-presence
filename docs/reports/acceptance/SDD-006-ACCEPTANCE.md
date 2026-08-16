# SDD-006 验收报告｜Production UX 1.4 与本地 Onboarding

> SDD：`SDD-006-PRODUCTION-UX-AND-LOCAL-ONBOARDING`
>
> 模块：`M5-00`（本报告不修改 canonical 状态）
>
> 报告状态：`EVIDENCE_READY_CANDIDATE`
>
> Owner UAT：`PENDING`
>
> 生成日期：2026-08-16

## 一、交付结果

SDD-006 已把 Owner 冻结的 UX 1.4 静态原型转化为组件化 Next.js/React 桌面产品路径：首次打开仅需本地显示名称；可选 public-safe 示例或真实 UTF-8 MD/TXT 资料；资料、上下文和人工发布 handoff 由 PostgreSQL/内容寻址 Blob 持久化；桌面 Shell 覆盖今天、Campaign、AI 团队、日历、发布中心、反馈、品牌资料、账号和设置。

所有未接通能力保持诚实：PDF/DOCX、OAuth、live connector/read-back、AgentTeams 常驻 Runtime 均显示 `PLANNED`、`NOT_CONFIGURED` 或 blocked；浏览器不收集模型 API Key；人工发布只产生 `AWAITING_RECONCILIATION`，不产生 `PUBLISHED`。当前只是工程证据候选，不是 Owner 接受、客户 UAT、业务结果或生产就绪声明。

## 二、交付范围

| 范围 | 实现 |
|---|---|
| 本地身份与 Onboarding | display-name-only profile；example/local-material 两条路径；Market/Locale/Platform/Time Zone 分离 |
| 本地资料 | MD/TXT 2 MiB、UTF-8、路径/二进制/类型校验；SHA-256 manifest；PostgreSQL + Blob；delete/restart |
| Production UX 1.4 | token、primitive、desktop layout、feature/route/state 边界；中文默认、英文对齐 |
| Campaign 与 Review | 复用现有 Campaign 真源；批准前显示完整内容；当前 Agent 紧凑显示；历史 trace 可展开；无 Audit 时批准 disabled |
| AI 团队与 Skills | A0–A5 六个稳定角色；职责、Skill、Token、每日完成量、runtime 状态；指标来源 `NO_RUNTIME_OBSERVATION` |
| 发布与账号 | 复制正文、下载 public-safe SVG、打开官方页、Owner 自报完成；全部待对账；OAuth/测试 disabled + `PLANNED` |
| Readiness | Web/API/PostgreSQL/adapter/runtime 的 state/source/checkedAt/reason/remediation 合同；runtime 指向 `SDD_007_REQUIRED` |
| 不在范围 | AgentTeams 安装/监督、Secret broker、平台 OAuth/自动发布/read-back、PDF/DOCX parsing、移动端 |

## 三、实现证据

| 层 | 主要证据 |
|---|---|
| 生命周期 | `docs/specs/sdd-006/{CONSTITUTION,CLARIFICATIONS,PLAN,CHECKLIST,TASKS,ANALYZE}.md` |
| Domain/API | `packages/domain/src/local-presence.ts`、`apps/api/src/server.ts`、`apps/api/src/openapi.ts`、closed-schema/Secret/unsupported negative tests |
| PostgreSQL/Blob | `packages/db/migrations/000007_local_onboarding.cjs`、`packages/db/src/local-presence-repository.ts`、`.evidence/sdd-006/compose-verification.json` |
| Web | `apps/web/src/components/{ui,layout,onboarding,features}/`、`apps/web/src/styles/`、Production routes/messages |
| Browser | `docs/reports/evidence/sdd-006/browser-verification.json` 与六张 PNG；15 项检查、console error 0 |
| Dependency | `docs/reports/evidence/sdd-006/DEPENDENCY-LICENSE-REVIEW.md`、`.evidence/sdd-006/{license-inventory.json,sbom.cdx.json}` |

截图 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `01-first-open.png` | `1f2110e1a51f74a3b2816421a687cdabeb55ff153e098e166d561d7f0606b045` |
| `02-local-material-onboarding.png` | `a62665b2ddf4f0d37b93997f23d7ee2d60e6ab64a264231ecd672e6173936fa9` |
| `03-today-workspace.png` | `07d28c03794e8cddc60c32350579ef5b4d9057d6a233886c04a7a972dcc0f15a` |
| `04-full-content-review-drawer.png` | `7c051ac79446fa5c29c0524cce5fad019e26f8fd47ac5030c25fc7dc0b4d295c` |
| `05-ai-team.png` | `86d1c0970c8c410fff47ed0edcf3f285707b7c9b244b44a38d9a588b8b1217f0` |
| `06-publish-center-awaiting.png` | `ac67e4a73145e32278fa1a175fd8d02266e02aab9817f4de675bf19b5ee0cd71` |
| `browser-verification.json` | `901c8238661d1802b8f3fd81d1d7bc94610d92ff296ae53498934e7d43288b75` |
| `compose-verification.json` | `4f8523d415a5b17f92a08ed8a46eeddfbd11c2a6c07a11ee84dbf77c7ef29543` |

## 四、自动化验证

| 命令 | 结果 |
|---|---|
| `npm run lint` | `PASS`，0 error / 0 warning |
| `npm run typecheck` | `PASS`，12 workspace typecheck |
| `npm test` | `PASS`，35 test files / 320 tests |
| `npm run check:messages` | `PASS`，zh-CN/en 212 keys |
| `npm run check:status` | `PASS`，40 module；未改 canonical 状态 |
| `npm run check:secrets` | `PASS`，308 tracked/source files；最终报告与依赖证据写入后再执行收口扫描 |
| `npm run verify:sdd006:compose` | `PASS`；fresh health、真实浏览器、PG/Blob restart、full stack restart、readiness、forbidden action tables=0、cleanup PASS |
| `npm run verify:compose` | `PASS`；既有 broken migration、fresh volume、PG/Blob persistence、locale/non-live、dormant operator 与 cleanup 回归；共享镜像只构建一次 |
| `npm run verify:sdd006:dependencies` | `PASS`；1020 packages、disallowed 0、CycloneDX 1.6 / 710 components |
| `npm audit --omit=dev --audit-level=high` | `PASS`，0 vulnerability |
| `npm run build` | `PASS`；Next 16.3.0 production build，29 个静态页面路径，standalone assets 完成 |
| `npm run storybook:build` | `PASS`；Production Workspace story 与 browser bundle safety，forbidden 0 |
| `npm run verify` | `PASS`；完整 static + production build + Storybook 门禁 |

## 五、验收标准结果

| AC | 结果 | 证据与边界 |
|---|---|---|
| AC-01 | `PASS` | fresh DB 首屏只有一个 display-name input；无 email/password/key；profile 与 reopen 由 PG 权威保存。 |
| AC-02 | `PASS` | API 建立 visibly labeled `PUBLIC_SAFE_EXAMPLE` Organization/Campaign；外部动作 false；Shell 可用。 |
| AC-03 | `PASS` | 真实 MD 上传、SHA-256、提取、Blob/PG restart reopen；空/超限/二进制/无效 UTF-8/不支持类型负测；PDF/DOCX `PLANNED`。 |
| AC-04 | `PASS` | React route/component/state map 覆盖冻结主流程；真源、example、planned/blocked 状态均可区分。 |
| AC-05 | `PASS` | 抽屉显示完整正文后才出现 disabled approval；当前 Agent 紧凑显示；trace 可展开；真实 Chromium focus trap/Esc/restore。 |
| AC-06 | `PASS` | 四类人工动作只写 `AWAITING_RECONCILIATION`；PUBLISHED 不存在；账号与 runtime unavailable 控件 disabled + remediation。 |
| AC-07 | `PASS` | browser Secret 字段递归拒绝；Web 无 Key input；API/日志/fixture 无 Secret；Secret scan 通过。 |
| AC-08 | `PASS` | 精确 pinned Tailwind/Radix/Lucide/test deps；license inventory/SBOM/audit；repository-owned primitive 与 token 层。 |
| AC-09 | `PASS` | i18n、axe A/AA、keyboard/focus、800px desktop gate、六张截图、lint/typecheck/unit/build/Storybook 与全量门禁通过。 |
| AC-10 | `PASS` | 全量 320 tests、40-module status parity、adapter profile `SUCCESS`；Campaign/schedule/M2 回归未放宽。 |

## 六、Owner 参与验收

Owner UAT 当前 `PENDING`，因此建议状态最多 `EVIDENCE_READY`，不得标为 `ACCEPTED`。

前置：Docker/OrbStack 已启动；位于本报告 Worktree；没有需要保留的 SDD-006 UAT volume。执行：

1. 运行 `docker compose --project-name lumiclaw-sdd006-owner-uat up --build --detach`，打开 <http://127.0.0.1:3100>。预期只看到本地显示名称；出现邮箱、密码、API Key 或远端注册即失败。证据：首次打开截图。
2. 输入一个不含客户信息的名称，选择 public-safe 示例。预期进入完整桌面 Shell，示例标签可见，无外部调用。证据：Today/Campaign 截图。
3. 清理该 project volume 后重新启动，选择本地资料路径，上传 public-safe `.md`/`.txt`。预期显示 digest/READY，PDF/DOCX 只显示 `PLANNED`；重启后资料仍在。失败信号：资料消失、解析失败却显示 READY。证据：上传前后与重启后截图。
4. 在 Campaign → 批准前完整内容打开任一版本。预期先看到全文、当前 Agent、可展开 trace；无 Audit receipt 时批准 disabled；Tab 循环留在抽屉，Esc 关闭并回到触发按钮。证据：截图或短录屏。
5. 打开 AI 团队。预期 A0–A5 恰好六个稳定角色，Token/今日完成量为 0 时明确写 `NO_RUNTIME_OBSERVATION`，不是业务零结果。证据：团队截图。
6. 打开发布中心并执行复制/下载/打开页/“我已人工完成”。核对实际登录账号由 Owner 自己完成。预期只出现 `AWAITING_RECONCILIATION`；出现 `PUBLISHED` 即失败。证据：操作后与刷新后截图。
7. 打开账号与设置。预期 OAuth/live test disabled；API/PostgreSQL 显示真实 probe；Runtime 为 `NOT_CONFIGURED / SDD_007_REQUIRED`；无 Key 输入。证据：两页截图。
8. 将窗口缩至 800px。预期显示“请使用桌面浏览器继续”，不提供伪移动端。完成后执行清理命令：`docker compose --project-name lumiclaw-sdd006-owner-uat down --volumes --remove-orphans`。

Owner 应返回：步骤 1–8 的 `PASS/FAIL`、失败步骤、截图/录屏路径、是否接受视觉/交互，以及是否同意从 `EVIDENCE_READY` 推进。原始真实资料不得提交到仓库或 PR。

## 七、ChatGPT Pro 双代理记录

本 SDD 未获授权也未使用 ChatGPT Pro 外部工程协作；URL/ZIP/外部代码均为 `N/A`。全部实现、审阅与验证在指定 Codex Executor Worktree 内完成，不存在需要信任的外部补丁。

## 八、失败、限制与非声明

Known limitations：

- AgentTeams persistent runtime、terminal Secret broker、固定版本安装/升级/恢复和 mission-worker dispatch 属于 SDD-007；当前 readiness 只证明合同与 adapter build boundary。
- PDF/DOCX 没有 parser，明确 `PLANNED`；没有 OAuth、connector、自动发布、read-back 或 proof upload。
- 人工发布不能证明平台已发布；没有 read-back 证据时永远待对账。
- 当前 local owner 是单机单 profile，Hosted Authentication 与多租户 RLS 不在本 SDD。
- 全 development audit 有既有 Storybook 工具链 3 个 high 警告；生产依赖 audit 0。本 SDD 不使用 destructive `npm audit fix --force`。
- 本报告不声明 `ACCEPTED`、真实 Agent run、客户 UAT、业务结果、增长、线索、收入、法律合规或 production-ready。

已发现并修复的浏览器缺陷：关闭抽屉时带虚构动画名的 Overlay 滞留拦截侧栏点击；nested status span 覆盖了 focus restore target。现已移除不确定 animation Presence，并把 pointer target 收敛到最近可聚焦 trigger；真实 Chromium 与 nested-child 单测均通过。

## 九、回滚与恢复

Rollback：在未合并时关闭 Draft PR/删除分支即可；合并后以一个 revert commit 回滚本 SDD commit，不执行 `git reset --hard`。Migration `000007_local_onboarding.cjs` 为 additive；代码回滚不会自动删除 UAT 数据。

仅清理 SDD-006 验证/UAT project：

```bash
docker compose --project-name lumiclaw-sdd006-verify down --volumes --remove-orphans
docker compose --project-name lumiclaw-sdd006-owner-uat down --volumes --remove-orphans
```

不要删除默认项目或其他 worktree 的 volume。若需清除默认本地 profile/material，必须由 Owner 明确确认目标 project 后再删除对应 PostgreSQL/Blob named volume。

## 十、执行任务状态交接

- Objective：完整实现 Production UX 1.4 与本地 Onboarding，并生成可重复工程证据。
- Goal status：`IN_PROGRESS`，等待最终 `npm run verify`、commit/push/Draft PR 与 Coordinator handoff。
- Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-006-production-ux-onboarding`
- Branch：`codex/sdd-006-production-ux-onboarding`
- Base：`f36af992965d9614ed5071b075435f70d76d3a37`
- Full HEAD：`PENDING_COMMIT`（最终值记录在 Draft PR 与结构化 STATUS_HANDOFF）
- 建议 maturity/canonical state：`M5-00 → EVIDENCE_READY` 候选；Owner UAT 和 Coordinator 独立复验前不得 `ACCEPTED`。
- 下一候选：SDD-007 persistent local AgentTeams bootstrap/runtime/terminal Secret broker/restart-upgrade recovery。

## 十一、Coordinator 验收决定

`PENDING`。Coordinator 需在最终 commit 上独立复验边界、diff、AC、证据 digest、全门禁、remote SHA 和 Owner UAT；只有 Coordinator 可更新 canonical progress。Executor 不修改 M3/M4、SDD-004/005 或其他模块状态。
