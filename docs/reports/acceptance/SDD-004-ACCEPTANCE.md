# SDD-004 验收报告｜桌面手动发布助手基础

> 默认语言：简体中文
> SDD：`docs/specs/SDD-004-ASSISTED-HANDOFF-FOUNDATION.md`
> Owner Override：`docs/specs/sdd-004/CHANGE-REQUEST-1-DESKTOP-MANUAL-PUBLISH-ASSISTANT.md`（CR1，`SPEC_READY`，冲突处优先）
> 进度模块 ID：`M3-00`
> Goal Objective：实现并工程验证 SDD-004 M3-00 非执行多平台激活与 Assisted Handoff 基础，形成 Draft PR 和结构化回传
> 执行任务：本 Codex Executor；未使用 ChatGPT Pro
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-004-assisted-handoff-foundation`
> Branch / PR Base：`codex/sdd-004-assisted-handoff-foundation` / `9e241da98be00c56204894c67b7599d37ff10505`
> Executor 起始提交：`2a3b0091f3a5a8a6297871f7f720071db03c98e5`
> Implementation / Evidence Head reviewed by Coordinator：`6424438002b5b1ec13a2762694b2fb6a03d691ac`
> 报告状态：`EVIDENCE_READY`（Coordinator 独立复验通过；Owner UAT `PENDING`）
> 证据成熟度：`ENGINEERING_VERIFIED`（本地可重复工程证据；Owner UAT `PENDING`）
> 生成日期：`2026-08-16`

## 一、交付结果

本切片建立了原创、纯 TypeScript、零执行的六平台 activation registry 与桌面手动发布 package 合同。X、Bluesky、LinkedIn、小红书、Instagram、Threads 共享唯一 current path：`MANUAL_DESKTOP_ASSISTANT`。Owner 确认精确 account 后，四个 builder 只返回 `COPY_TEXT / COPY_OR_DOWNLOAD_MEDIA / OPEN_OFFICIAL_PUBLISH_PAGE / MANUAL_COMPLETE` 数据；官方入口使用 HTTPS allowlist，不携带正文、链接、hashtags、via 或 media 预填 query，builder 不导航、不上传、不点击。

Package 绑定 exact approved revision digest、ordered media digest/filename、platform、account、capability identity 与 expiry。当前状态只允许 `USER_ACTION_REQUIRED → HANDOFF_OPENED → AWAITING_RECONCILIATION`；明确失败为 `FAILED`，外部事实不确定为 `UNKNOWN_RECONCILIATION_REQUIRED`。当前 state contract 没有 `PUBLISHED` 或 `HANDOFF_RECONCILED`，UNKNOWN 没有 resend。

隔离 Storybook 证据面以中文优先展示“去发布”单一路径、六平台差异、预期账号、精确版本、四个手工动作、等待核对和三种 fail-closed 示例。它没有链接、按钮、表单、URL/截图回填或真实平台调用，不修改 Owner 核心页面。

## 二、交付范围

### 已包含

- 六平台稳定 registry、内部未来 capability layer code、current `MANUAL_DESKTOP_ASSISTANT` 与 Direct/prefill 全 false；
- X、Threads、LinkedIn、Instagram 的纯 deterministic manual-package builders 与 official-page allowlist；
- exact input/package digest、ordered media、account confirmation、capability/expiry/mismatch fail-closed；
- 当前非执行 outcome contract、UNKNOWN reconcile-only/no-resend；
- CR1 审计轨迹与父 SDD 治理指针；
- 隔离 Story/组件、zh-CN/en message parity、语义化 `details/summary` 键盘基础和 deterministic DOM 测试；
- table-driven unit/contract/regression tests，包含 accepted M1 exact-four Campaign invariant；
- public-safe 本地 screenshot 与 Storybook browser-safety bundle evidence。

### 未包含或延期

- ActionGrant、Outbox、Operator、OAuth、Secret、真实账号、真实发布、平台 read-back、API/DB/worker/migration；
- URL/截图回填、“我已发布=成功”或任何当前 `HANDOFF_RECONCILED` path；
- `PLANNED` 的定时只读账号同步、Revision 自动匹配与非唯一匹配处理实现；
- 移动端、Native Share、响应式手机发布路径；
- Direct/一键发布/自动发布 current UI；
- Instagram/Threads ArtifactProfile；二者仍为 candidate/`PLANNED`；
- Owner 核心页面、AI 团队一级导航、六 Agent/Skills/定时任务下一阶段 UI；
- Postiz/AGPL source、SDK、dependency、deployment 或 runtime call。

## 三、实现证据

| 范围 | 文件 / 对象 | Evidence |
|---|---|---|
| Domain / Contract | `packages/domain/src/activation.ts`、`index.ts` | 六平台 registry、capability snapshot、exact binding、四 builders、manual actions、fail-closed/outcome state；纯数据，无 API/DB/外部调用。 |
| Contract / Regression tests | `packages/domain/src/activation.test.ts` | 28 项 SDD-004/CR1 table-driven tests；定向组合共 70 项 PASS；全套 338 项 PASS。 |
| UI / i18n | `desktop-manual-publish-assistant.tsx`、fixture、Story、DOM test、messages、scoped CSS | 6 platform rows；中文/英文；无 `<a>`/`href`/`form`/`input`/`button`/handler；message parity 129 keys。 |
| UI Screenshot | `.evidence/sdd-004/desktop-manual-publish-assistant-zh.png` | public-safe 1440×1400 PNG；SHA-256 `f7e93ae59eef9735f767cd7f3af696d4868880c8084e344c75df45526df6dc24`；本地 ignored evidence，不含真实账号/Secret。 |
| Storybook safety | `npm run storybook:build` | 4 story bundles；新增 bundle 24,636 bytes（首次 build）；forbidden `[]`；真实 Chrome headless 仅访问 localhost static Story。 |
| Spec / Owner override | 父 SDD + `docs/specs/sdd-004/CHANGE-REQUEST-1-DESKTOP-MANUAL-PUBLISH-ASSISTANT.md` | CR1 `SPEC_READY`；记录 2026-08-16 Owner Override、被替代段落/AC、current path/state/UAT/非声明。 |
| Security / Privacy / License | `git diff`、secret scan、dependency inventory/SBOM | 无 package/lockfile 变更；无 Postiz/AGPL 引入；272 files secret scan PASS；inventory 958 packages、SBOM 671 components。 |

## 四、自动化验证

环境：macOS arm64；Node `24.16.0`；npm `11.13.0`；无平台账号、Secret、OAuth 或外部动作。

| 检查 | 命令或协议 | 期望 | 实际 | 结果 |
|---|---|---|---|---|
| Install | `npm ci` | 锁文件可复现且不改 lockfile | 801 packages installed；runtime check PASS；lockfile 无 diff | `PASS` |
| Target domain + regression | `npm run typecheck --workspace @lumiclaw/domain && npx vitest run packages/domain/src/activation.test.ts packages/domain/src/campaign.test.ts packages/domain/src/campaign-envelope.test.ts` | 新合同 + exact-four 回归 | 3 files、63 tests PASS | `PASS` |
| Target CR1 + Web | `npm run check:messages && npx vitest run packages/domain/src/activation.test.ts apps/web/src/components/desktop-manual-publish-assistant.test.ts packages/domain/src/campaign.test.ts packages/domain/src/campaign-envelope.test.ts apps/web/src/components/campaign-workspace.test.ts && npm run typecheck --workspace @lumiclaw/web` | CR1 DOM/合同/回归/i18n | 5 files、70 tests PASS；129 message keys；Web typecheck PASS | `PASS` |
| Lint | `npm run lint` | 零 lint error | PASS | `PASS` |
| All workspace typecheck | `npm run typecheck` | 所有 workspace 类型通过 | 11 workspace scripts PASS | `PASS` |
| Full tests | `npm run test` | 全仓回归通过 | 33 files、338 tests PASS | `PASS` |
| Status parity | `npm run check:status` | canonical 文件保持一致且 M3-00 未被 Executor 改状态 | 40 modules PASS；status files 无 diff | `PASS` |
| Message parity | `npm run check:messages` | zh-CN/en 完全同 key | 129 keys、2 locales PASS | `PASS` |
| Runtime build | `npm run build` | 所有 workspace + Next production build | TypeScript workspaces PASS；Next 13 static/dynamic routes build PASS | `PASS` |
| Storybook / browser safety | `npm run storybook:build` | Story build；bundle 无 Node crypto/Buffer/Secret/runtime path | build PASS；4 bundles；forbidden `[]` | `PASS` |
| Deterministic DOM | `desktop-manual-publish-assistant.test.ts` via Vitest | 6 platform、单一路径、无 executable element/current success | zh-CN/en 共 3 tests PASS | `PASS` |
| Screenshot | localhost static Story + Chrome headless `--screenshot` | public-safe 1440×1400 desktop evidence | `.evidence/sdd-004/desktop-manual-publish-assistant-zh.png` generated and visually inspected | `PASS` |
| Secret scan | `npm run check:secrets` | 无 credential/secret fixture | 272 files PASS | `PASS` |
| Dependency / license | `npm run verify:dependencies` | inventory + CycloneDX SBOM | 958 packages；license inventory PASS；671 components；lock SHA-256 `13dd6326d1a26ac87ce6c6b10441d8391ed08d6e0878a8320ae8af05e2a4d5c6` | `PASS` |
| Production dependency audit | `npm audit --omit=dev --json` | 生产依赖无已知 audit finding | 0 vulnerabilities | `PASS` |
| Diff whitespace | `git diff --check` | 无 whitespace error | PASS | `PASS` |
| Full repository gate | `npm run verify` | static + build + Storybook full gate | PASS；含 338 tests、129 messages、40 modules、272-file secret scan、Compose policy、controlled AgentTeams profile、958-package inventory、671-component SBOM、all workspace/Next build 与 4 Story bundles | `PASS` |
| Acceptance report shape | `node scripts/check-acceptance-report.mjs docs/reports/acceptance/SDD-004-ACCEPTANCE.md 10` | headings/10 AC/required terms 完整 | 10 criteria PASS | `PASS` |

`npm ci` 的完整 dev tree 报告 3 个 high finding，均来自锁定 Storybook dev-only 链 `@storybook/nextjs-vite → vite-plugin-storybook-nextjs → image-size`，`fixAvailable=false`；本 SDD 未新增/升级依赖，production audit 为 0。此项记录为 Known limitations，不把 inventory/SBOM PASS 扩写为无风险声明。

## 五、验收标准结果

CR1 在冲突处优先于父 SDD；下表保留父 SDD `AC-01`～`AC-10` ID 并明确校准结果。

| Criterion ID | 结果 | Evidence | 说明 |
|---|---|---|---|
| AC-01 | `PASS` | registry unit table | 六平台各一 entry；stable layer/mode/prefill/proof/fallback fields；current path 均为 manual desktop，三层只留内部。 |
| AC-02 | `PASS (CR1 OVERRIDE)` | 4 builder table + target allowlist tests | 原 text/share query prefill 被 Owner 移除；当前 X/Threads/LinkedIn/Instagram 只返回 non-prefilled official page + four manual actions。 |
| AC-03 | `PASS (CR1 OVERRIDE)` | registry assertions + builder target query assertions | 六平台 prefill text/link/media 全 false；URL query 不含 text/url/hashtags/via；copy/download/manual 仍可用。 |
| AC-04 | `PASS` | fail-closed `it.each` | expired、wrong platform/account/capability/mode、missing confirmation 使用稳定 code 阻断。 |
| AC-05 | `PASS` | digest/order/mutation/verify tests | exact revision + ordered media + platform/account/capability/expiry 进入 input/package digest；mutation 改变或破坏 identity。 |
| AC-06 | `PASS (CR1 OVERRIDE)` | outcome state tests | 当前无 `PUBLISHED`、无 `HANDOFF_RECONCILED`；手工完成只到 awaiting；UNKNOWN 仅 reconcile，无 resend。 |
| AC-07 | `PASS` | exact-four test + 338 full tests | M1 Campaign 仍严格为 X/Bluesky/LinkedIn/小红书四 active units/revisions；schema/API 回归不变。 |
| AC-08 | `PASS (CR1 OVERRIDE)` | isolated Story + DOM + screenshot | 只展示桌面“去发布”单一路径、六平台限制/状态；无三级模式、URL input、导航、credential 或 live call。 |
| AC-09 | `PASS` | i18n/typecheck/lint/test/build/secret/dependency rows | 所有门禁 PASS；报告收敛后已再次运行完整 `npm run verify` 与 report-shape check。 |
| AC-10 | `PASS` | diff/lock/secret/bundle scans | 无 Postiz/AGPL source/dependency、DOM automation、credential、live account 或 external platform action。 |

CR1-AC-01～CR1-AC-07 均由上述 AC-01～AC-10 组合覆盖。Owner UAT 未完成，因此不能宣称 `ACCEPTED`。

## 六、Owner 参与验收

### UAT-01｜桌面“去发布”单一路径只读验收

- **为什么需要 Owner 验证：**确认普通用户只看见 Owner Freeze 后的桌面手动发布助手，不把内部 capability codes、未来执行能力或等待对账误解为发布成功。
- **前置条件：**Node/npm 已按仓库版本安装；当前 branch 已 checkout；执行 `npm ci && npm run storybook`；浏览器打开 Storybook → `M3 / Desktop Manual Publish Assistant / Chinese Desktop`。只使用 public-safe Story fixture。
- **安全 / 数据说明：**Story 没有链接、按钮、表单、URL input、network handler、账号连接或平台调用；所有账号/digest 均为合成值。
- **操作步骤：**
  1. 在桌面浏览器打开 Chinese Desktop Story，确认标题只有“去发布”，没有三级能力选择、Direct、一键发布或自动发布入口。
  2. 展开 X、Threads、LinkedIn、Instagram；检查目标平台、预期账号与精确版本均可读。
  3. 确认每个平台使用同一四步：复制正文、复制/下载图片、打开官方发布页、人工完成；平台差异只体现在手工限制。
  4. 确认页面没有 URL/截图回填框，没有“我已发布=成功”，人工完成后只写“等待系统核对，发布结果仍未确认”。
  5. 查看小红书 UNKNOWN 示例，确认只写“先核对，系统不会重新发布”。
  6. 用 Tab 聚焦 platform card 与技术详情的原生 `summary`，按 Enter/Space 展开收起，确认状态文字仍可读。
  7. 检查 expired/wrong-account/wrong-capability 三个阻断示例；确认没有继续发布动作。
- **期望可见结果：**中文优先、唯一桌面 manual path、account/revision 清楚、四个动作清楚、awaiting/UNKNOWN 诚实，无 current published/reconciled 或未来能力入口。
- **失败信号：**出现三档选择、Direct/一键/自动发布、正文/media 网页预填、URL/截图回填、移动端 path、`PUBLISHED`、无证据成功或 UNKNOWN 重发。
- **需要返回的证据：**一张 public-safe desktop screenshot；书面 `UAT-01 PASS`，或 exact failed step + requested wording。
- **清理 / 回滚：**终端 `Ctrl-C` 停止 Storybook；无外部状态或账号状态需要清理。
- **Owner 结果：**`PENDING`

## 七、ChatGPT Pro 双代理记录

`N/A`。本 SDD 未使用 ChatGPT Pro、未上传 source ZIP、无外部对话 URL。Source ZIP size / SHA-256：`N/A`。

## 八、失败、限制与非声明

- **已知失败：**无未处理代码/测试失败；Owner UAT `PENDING`。
- **Known limitations：**Story 是功能性隔离 evidence surface，不是 Owner 最终视觉；当前 component 故意 desktop-only；官方页面路径属于可过期 capability contract；dev-only Storybook 链有 3 个无可用修复的 high audit finding，production audit 为 0；完整 Compose/live provider 不适用于本纯函数零执行切片，未运行。
- **后续必须闭合的授权合同：**UX 1.1 要求公开行动批准显式绑定正文、媒体、账号、时间与 Revision，任一变化都使批准失效。M3-00 package 已绑定 revision/media/account/capability/expiry，但没有单独的 `ownerDecisionId` 或计划发布时间；由于本切片零执行，此项不阻塞 `EVIDENCE_READY`，但后续审批/ActionGrant SDD 必须显式实现并测试，不能从现有 input digest 推断已满足。
- **Owner Freeze 后续依赖：**AI 团队一级导航、六 Agent 中文名/头像/职责/Skills/Token/每日完成量/状态、Skills 与定时任务由后续 UX/SDD 实现，本切片不改 Owner 核心页面。
- **仍为 `PLANNED` 的 Claim：**只读定时同步与 Revision 匹配、非唯一匹配 UX、任何 reconciled state、Instagram/Threads ArtifactProfiles、Direct/一键发布、移动端/Native Share、真实连接账号。
- **明确 `NOT_CLAIMED` 的结果：**任何已发布、客户 UAT、真实平台对账、reach、follower、lead、revenue、合规保证。
- **成熟度断言：**`IMPLEMENTED` + Executor 本地 `ENGINEERING_VERIFIED`；不是 `EXTERNAL_CALIBRATED` 或 `BUSINESS_VERIFIED`。

## 九、回滚与恢复

Rollback 是纯 Git 代码回滚：Coordinator 可 `git revert <SDD-004 implementation commit>`，移除 `activation.ts`/tests、隔离 Story/fixture/component/DOM test、scoped CSS、双语 message、CR1 与本报告，并恢复 `index.ts`/Vitest JSX transform 的增量。没有数据库 migration、row、Blob、credential、OAuth、Secret、平台动作或外部状态需要补偿。

Package 若校验失败不会返回成功 package；capability 过期/错账号/错 identity 必须刷新或重新确认，不能绕过。UNKNOWN 没有 resend 恢复路径，只能等待未来独立 SDD 实现的只读 reconcile。

## 十、执行任务状态交接

Executor 未修改 `IMPLEMENTATION-STATUS.md`、中文镜像、`ROADMAP.md`、`ARCHITECTURE.md` 或 M3-01～M3-07；Coordinator 在独立复验后只把 M3-00 与 SDD-004 更新为 `EVIDENCE_READY`。

| Module ID | 当前规范状态 | 建议新状态 | 原因 / Evidence |
|---|---|---|---|
| M3-00 | `IN_PROGRESS` | `EVIDENCE_READY`（Coordinator 已更新） | CR1 domain/UI/tests/build/security evidence 经独立复验；Owner UAT `PENDING`，不得 `ACCEPTED`。 |

同时报告：

- Worktree / Branch：见报告头；
- PR Base / Executor 起始提交：`9e241da98be00c56204894c67b7599d37ff10505` / `2a3b0091f3a5a8a6297871f7f720071db03c98e5`；
- changed files：domain contract/tests/export；isolated Web fixture/component/story/DOM test/CSS/messages；Vitest JSX transform；父 SDD pointer、CR1、本报告；
- Commit / Push / Draft PR：最终结构化 handoff 填写 full hash 与 URL；
- Blocker：Owner UAT；真实 action 仍受 M2 Owner UAT + future ActionGrant SDD 阻断；
- 下一候选步骤：Owner 执行 UAT-01；UX 1.1 正式前端落地与 AI 团队一级导航需独立 SDD；真实执行不得从 M3-00 直接开始。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS`（完整 `npm run verify` 与 SDD-004 report shape 均通过）
- Coordinator 独立复验：`PASS`（2026-08-16；精确 checkout `6424438002b5b1ec13a2762694b2fb6a03d691ac`；targeted 70/70、full 338/338、`npm run verify`、report shape、diff/status/message parity、公开安全截图 digest 均通过）
- 是否需要 Owner 验收：`YES`
- Owner 决定：`PENDING`
- 最终模块状态：`EVIDENCE_READY`；Owner UAT 前不得标 `ACCEPTED`
- 下一 Module / SDD：需由 Coordinator 另行建立；优先依据已冻结 UX 1.1 拆分正式前端收敛与 AI 团队一级导航，M3-01～M3-07 保持 `NOT_STARTED`。
