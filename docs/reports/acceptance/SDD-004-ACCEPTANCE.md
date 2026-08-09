# SDD-004 验收报告｜Action Center Frontend Foundation

> SDD：`docs/specs/SDD-004-ACTION-CENTER-FRONTEND-FOUNDATION.md`
> 进度模块 ID：`M3-07`（仅作为未来依赖方；规范状态保持 `NOT_STARTED`）
> Goal Objective：完成 SDD-004 Action Center 前端基础，在不依赖或覆盖 M3-01 后端分支的前提下，实现可抗视觉改版的类型化 ViewModel、状态场景、可访问组件骨架、Storybook/测试和中文交付证据，并向主 Coordinator 返回结构化 handoff。
> Executor Task：`019fe78c-d4f4-7872-8646-0a9f94b34419`
> Worktree：`worktrees/lumiclaw-presence/sdd-004-action-center-frontend-foundation`
> Branch / Base：`codex/sdd-004-action-center-frontend-foundation` / `f13aee3e8dba5b344924bd80ede256ae2c703bde`
> Implementation Commit：`aed136f28e23bba74c2304afcf845bb78a67f525`
> 报告状态：`EVIDENCE_READY`
> 证据成熟度：`ENGINEERING_VERIFIED`，仅限公开安全的 UI foundation/prototype
> 生成日期：`2026-08-10`

## 一、交付结果

SDD-004 已在规范达到 `SPEC_READY` 后，交付一个不依赖 M3-01 实现分支的 Action Center 前端基础。它包含八个穷举状态、每状态唯一下一步和安全策略、接受 `unknown` 的失败关闭 adapter、精确 Owner Review/Grant/Execution/Receipt/UNKNOWN 组件骨架、双语消息、公开安全 fixture、十个 Storybook 场景、键盘与窄屏浏览器证据，以及自动化测试。

Review 路由只渲染 `UI FOUNDATION / NOT_LIVE` 的只读 `GRANT_READY` 预览，不传入动作处理器。组件发出的仅是本地 UI intent；本 SDD 不签发 Grant、不访问平台、不写 Receipt、不重试 UNKNOWN，也没有真实发布路径。`PUBLISHED` 仅是绑定 `example.invalid` 原生引用的合成状态 fixture，不是外部发布证据。

本次没有修改 `IMPLEMENTATION-STATUS.md` 或中文镜像，没有启动 `M3-07`，没有编辑、合并或修复 PR #3 / `origin/dtg-lumiclaw-v2`，也没有 Push、PR 或 Deploy。机器证据已满足 bounded SDD 的 `EVIDENCE_READY`；Owner UAT 与 Coordinator 独立复验仍为 `PENDING`。

## 二、交付范围

### 已包含

- 类型化 `ActionCenterViewModel`、状态策略和模式：`DIRECT`、`HANDOFF`、`PREPARE_ONLY`。
- `GRANT_READY`、`GRANT_ISSUED`、`OWNER_ACTION_REQUIRED`、`PUBLISHED`、`UNKNOWN`、`FAILED`、`EXPIRED`、`REVOKED` 八个稳定状态。
- 每状态的用户可见解释、唯一下一步、重试许可、claim maturity 和允许的 UI intent。
- 精确 Owner Review 摘要、ActionGrant 摘要、Execution Card、Receipt Timeline、UNKNOWN Reconciliation Panel。
- UI locale、内容语言、目标市场与 IANA 排程时区的独立字段和双语标签。
- 公开安全 fixture、十个 Storybook 场景、临时且可替换的 `--action-*` 视觉 token。
- adapter 隔离层、策略/adapter/render 测试、消息 parity、静态构建和真实浏览器检查脚本。

### 未包含或延期

- 真实 ActionGrant 签名、数据库、Outbox、Connector、Scheduler、Operator、凭据或外部发布。
- 冻结的 M3-01 API 合同、真实 Receipt 查询/对账、Handoff 回填写入或失败重试工作流。
- 最终 UI/UX、品牌字体与授权、平台图标资产、完整跨浏览器/辅助技术认证。
- 客户 UAT、平台权限验证、生产就绪、安全/合规保证、增长/线索/收入结果。

## 三、实现证据

| 范围 | 文件 / Evidence | 结论 |
|---|---|---|
| SDD 生命周期 | `docs/specs/SDD-004-ACTION-CENTER-FRONTEND-FOUNDATION.md`、`docs/specs/sdd-004/` | Constitution → Specify → Clarify → Plan → Checklist → Tasks → Analyze 已在实现前完成，主 SDD 为 `SPEC_READY`。 |
| ViewModel / policy | `apps/web/src/features/action-center/action-center-types.ts`、`action-center-policy.ts` | 八状态穷举；唯一下一步、模式、成熟度、重试与危险 intent 规则集中定义。 |
| Adapter / fixture | `action-center-adapter.ts`、`action-center-fixtures.ts` | 输入为 `unknown`；不导入 PR #3 类型；矛盾/缺失字段失败关闭；所有 fixture 为 `PUBLIC_SAFE_FIXTURE / NOT_LIVE`。 |
| 可访问组件 | `action-center.tsx` | 语义 section/heading/status、原生 checkbox/button、`aria-live`、描述关联、可见焦点、非颜色状态标记。 |
| 双语 / locale | `action-center-copy.ts`、`apps/web/messages/{zh-CN,en}.json` | 默认中文；两语言各 200 个 parity key；稳定状态码不翻译；四个地域/语言概念分离。 |
| 视觉 / route | `globals.css`、`product-shell.tsx` | “evidence-first editorial operations console” 临时基线，全部经 `--action-*` token；Review 路由无 handler。 |
| Storybook | `action-center.stories.tsx` | 八状态、交互式确认、英文窄屏共十个公开安全场景，a11y error gate 启用。 |
| 浏览器证据 | `.evidence/sdd-004/browser/browser-verification.json` | 十个场景均 `externalActionAllowed=false`；UNKNOWN 无 retry；Handoff 缺证据不为 PUBLISHED；键盘确认与 focus-visible 通过；console error 为 0。 |

忽略目录中的本机截图证据：

- `.evidence/sdd-004/browser/unknown-reconciliation-desktop.png`（336,763 bytes）
- `.evidence/sdd-004/browser/published-evidence-desktop.png`（273,756 bytes）
- `.evidence/sdd-004/browser/unknown-reconciliation-en-390.png`（713,836 bytes）

这些截图和 JSON 是可再生证据，未提交进公开源码；本任务没有源码 ZIP，故源码包大小与 SHA-256 均为 `N/A`。

## 四、自动化验证

执行环境：Node.js `v24.16.0`；npm `11.13.0`。所有命令从唯一指定 Worktree 执行。

| 检查 | 精确命令 | 实际结果 | 结果 |
|---|---|---|---|
| 安装 | `npm ci` | 801 packages installed，814 audited；lockfile 未变化；报告既有 4 个 high vulnerability 和 3 个 transitive deprecation。 | `PASS_WITH_RECORDED_LIMITATION` |
| Web typecheck | `npm run typecheck --workspace @lumiclaw/web` | 无类型错误。 | `PASS` |
| Action Center unit | `npm exec vitest run apps/web/src/features/action-center/action-center-policy.test.ts apps/web/src/features/action-center/action-center-adapter.test.ts apps/web/src/features/action-center/action-center-render.test.ts` | 3 files / 15 tests 全通过。 | `PASS` |
| Scoped lint | `npm exec eslint apps/web/src/features/action-center apps/web/src/components/product-shell.tsx scripts/verify-action-center-browser.mjs` | 无 lint error。 | `PASS` |
| 全仓 lint | `npm run lint` | 全部 workspace 通过。 | `PASS` |
| 全仓 typecheck | `npm run typecheck` | 全部 workspace 通过。 | `PASS` |
| 全仓 tests | `npm test` | 33 files / 318 tests 全通过。 | `PASS` |
| Messages | `npm run check:messages` | `zh-CN` / `en` 精确 parity，200 keys。 | `PASS` |
| Build | `npm run build` | workspace package build、Next compile/typecheck、13 个静态页面全部通过。 | `PASS` |
| Storybook | `npm run storybook:build` | Storybook 10.5.5 静态构建与 browser-safety 检查通过；仅有非阻断 chunk-size warning。 | `PASS` |
| Browser | 启动 `apps/web/storybook-static` 本地静态服务后运行 `node scripts/verify-action-center-browser.mjs` | 10 stories；390px 英文 UNKNOWN 无横向溢出；Tab/Space/Tab 确认、按钮 enable/focus、focus-visible 通过；0 console error。 | `PASS` |
| Secret / privacy | `npm run check:secrets` | 273 个仓库文件通过。 | `PASS` |
| Status parity | `npm run check:status` | 39 个 module 一致；M3-07 未修改。 | `PASS` |
| Diff hygiene | `git diff --check` | 无 whitespace error。 | `PASS` |

两次失败也保留为证据：在 workspace package 尚未先构建时，单独执行 `npm run build --workspace @lumiclaw/web` 和首次 `npm run storybook:build` 都无法解析 `@lumiclaw/i18n`。这是仓库既有 build-order 要求；随后按正式根命令 `npm run build` 构建内部 packages 后，Next build 与 Storybook 均通过。报告不把前两次隔离命令描述为成功。

## 五、验收标准结果

| Criterion ID | 结果 | Evidence / 说明 |
|---|---|---|
| AC-01 | `PASS` | `ActionCenterState`、policy 和 fixtures 穷举八个要求状态；测试会拒绝遗漏。 |
| AC-02 | `PASS` | 每状态有 explanation、单一 `nextStep`、retry policy、claim maturity、execution mode。 |
| AC-03 | `PASS` | Owner Review section 显示 revision/version/digest/account/action/evidence/expiry。 |
| AC-04 | `PASS` | Grant section 区分 absent、issued、expired、revoked；文案不声称签名或持久化。 |
| AC-05 | `PASS` | Execution Card 独立显示 UI locale、content language、target market、IANA time zone。 |
| AC-06 | `PASS` | 八状态均有排序、语义化 Receipt Timeline。 |
| AC-07 | `PASS` | UNKNOWN 固定禁止重复动作，显示 Reconciliation Panel，策略与 DOM 均无 retry intent。 |
| AC-08 | `PASS` | adapter/render test 证明 Handoff 无 native evidence 时保持 OWNER_ACTION_REQUIRED。 |
| AC-09 | `PASS` | route 无 handler 时始终禁用；交互 story 必须 checkbox 确认后才启用 intent button。 |
| AC-10 | `PASS` | EXPIRED/REVOKED 无 execute/retry；FAILED 仅允许申请新的受控尝试。 |
| AC-11 | `PASS` | unsupported、ambiguous、issued-with-unsupported-mode 等输入失败关闭到 UNKNOWN，不抛乐观成功。 |
| AC-12 | `PASS` | zh-CN 默认；en parity 为 200 keys；状态码保持稳定英文 code。 |
| AC-13 | `PASS` | Storybook 有八状态、Interactive Grant、English UNKNOWN 390px 共十个场景。 |
| AC-14 | `PASS` | 语义、键盘、可见焦点、非颜色状态 cue 已实现；a11y build gate 与浏览器证据通过。 |
| AC-15 | `PASS` | Action Center 不 import PR #3 类型；adapter 的公开输入仅为 `unknown`。 |
| AC-16 | `PASS` | fixture/bundle safety check 与 secret scan 通过；无真实账号、Token、客户或内部截图。 |
| AC-17 | `PASS` | scoped test/lint/typecheck、全仓 test/build、messages、Storybook 均通过；隔离失败已精确记录。 |
| AC-18 | `PASS` | route 与 stories 均显示 `UI FOUNDATION / NOT_LIVE`；status 无变化，无外部动作、Push、PR、Deploy。 |

## 六、Owner 参与验收

Owner UAT 状态：`PENDING`。以下两项必须由 Owner 作二元决定；机器验证不能替代。

### UAT-01｜只读状态理解与事实边界

- **前置条件：**checkout 到交付 commit；Node/npm 版本见上；运行 `npm run build && npm run storybook:build`，再用本地静态服务器打开 `apps/web/storybook-static/iframe.html?id=sdd-004-action-center-state-matrix--grant-ready&viewMode=story`。不配置任何账号或 Token。
- **步骤：**
  1. 依次查看 `grant-ready`、`owner-action-required`、`unknown-reconciliation-only`、`published-with-native-evidence`、`expired-terminal`、`revoked-terminal`。
  2. 对每个场景说出当前事实、唯一下一步、是否允许重试、Direct/Handoff/Prepare Only 模式。
  3. 确认 Handoff 缺回填证据时仍是 `OWNER_ACTION_REQUIRED`；确认 UNKNOWN 只有对账而没有 retry；确认合成 PUBLISHED 明示 NOT_LIVE。
- **期望可见结果：**无需技术日志即可区分准确 Review、权限、执行方式、Receipt 和对账；任何状态都不暗示真实发布。
- **失败信号：**出现第二个竞争下一步、UNKNOWN 可重试、Handoff 无证据却显示 PUBLISHED、模式/成熟度不清楚、truth marker 不可见。
- **需要返回的证据：**story ID、截图和书面 `UAT-01 PASS`，或逐条失败状态/文案。
- **清理 / Rollback：**停止本地静态服务器；没有数据、Grant 或平台动作需要清理。

### UAT-02｜键盘、焦点与窄屏

- **前置条件：**打开 `...--interactive-grant-confirmation` 和 `...--english-unknown-narrow` 两个 Storybook story。
- **步骤：**
  1. 只用 Tab/Shift+Tab 定位精确范围 checkbox 和按钮；未确认前验证按钮禁用。
  2. 按 Space 勾选，再按 Tab；验证按钮启用且焦点环可见，但不要触发任何外部动作（story callback 为本地空函数）。
  3. 在 390px 查看英文 UNKNOWN，确认关键证据无横向裁切、状态不只靠颜色、按钮只有 reconciliation。
- **期望可见结果：**焦点顺序清楚、确认门正确、UNKNOWN 无 retry，390px 无 horizontal overflow。
- **失败信号：**焦点丢失/不可见、未确认即启用、颜色是唯一状态线索、内容溢出或按钮表示重复动作。
- **需要返回的证据：**浏览器/viewport、两个 story ID、截图或短视频和书面 `UAT-02 PASS/FAIL`。
- **清理 / Rollback：**停止本地服务器；不需要外部清理。

## 七、ChatGPT Pro 双代理记录

- 本 SDD 未授权或使用 ChatGPT Pro 双代理，状态为 `N/A`。
- 对话 URL：`N/A`。
- 上传源码 ZIP：`N/A`；大小：`N/A`；SHA-256：`N/A`。
- 外部代码或结论：无；因此没有外部修正项。

## 八、失败、限制与非声明

- **Known limitations：**单独构建 Web/Storybook 前需要先构建 workspace 内部 packages；正式根构建通过，但这个仓库级 build-order friction 未在本 SDD 改动。
- **Known limitations：**`npm ci` 报告既有 4 个 high vulnerability，并有 `prebuild-install@7.1.3`、`tsconfck@3.1.6`、`glob@10.5.0` deprecation；本 SDD 没有依赖或 lockfile 变更，也未运行破坏性的 `npm audit fix`。
- **Known limitations：**浏览器自动化覆盖 Chrome CDP、Storybook 和 390/1280px；未完成 Safari/Firefox、屏幕阅读器或正式 WCAG 认证。
- **Known limitations：**视觉是 frontend-design Skill 指导的临时 evidence-first 基线，不是 Owner 冻结的最终 UI。设计线程仍需交付颜色/表面/状态 token、字体与授权、间距/圆角/阴影、状态图标、focus/contrast、breakpoint/density、平台安全资产与授权、motion/reduced-motion、最终文案和视觉回归基线。
- **接口限制：**只读参考 PR #3 中候选 Grant 状态 `ISSUED/CONSUMED/EXPIRED/REVOKED`、Receipt 结果 `PUBLISHED/HANDOFF_CONFIRMED/FAILED/UNKNOWN`、execution `DIRECT/NATIVE_HANDOFF`，以及 `platformUri`、`platformCid`、`handoffSteps`、`unknownReason`、`reconciledAt`。这些没有被冻结、导入或复制为公共合同；adapter 接收 `unknown` 并保守归一化。
- **接口待决：**列表 endpoint/proxy、Grant consumed 更新、Handoff 过早确认、PostgreSQL reconciliation、retry/error semantics 和 SSE campaign filtering 尚未由 Coordinator 接受，不能据此实现真实集成。
- **仍为 `PLANNED`：**冻结 API adapter、真实 Grant/Receipt/reconciliation、Connector/Operator/Scheduler、最终 UI/UX、M3-07。
- **明确 `NOT_CLAIMED`：**真实发布、生产就绪、平台权限、客户 UAT、外部校准、业务结果、增长、线索或收入。

## 九、回滚与恢复

- **代码 Rollback：**在本地分支对 `aed136f28e23bba74c2304afcf845bb78a67f525` 和后续报告 commit 使用常规 `git revert <commit>`；不使用 `reset --hard`。
- **局部 Rollback：**移除 `product-shell.tsx` 的 Action Center render 即可恢复原 Review 路由；组件、fixtures 和 stories 没有持久化副作用。
- **证据恢复：**重新运行根 build、Storybook build，启动本地静态服务器，再运行 `node scripts/verify-action-center-browser.mjs`；`.evidence/sdd-004/browser/` 会重建。
- **外部清理：**没有数据库、凭据、Grant、Receipt、平台动作、Push、PR 或 Deploy，因此没有外部回滚操作。

## 十、执行任务状态交接

Executor 未修改两份 canonical Implementation Status。该 bounded SDD 的建议结果是 `EVIDENCE_READY`；它不是 progress module 状态。

| Module ID | 当前规范状态 | 建议状态 | 原因 |
|---|---|---|---|
| M3-07 | `NOT_STARTED` | `NOT_STARTED` | M3 前置依赖和冻结接口尚未满足；本次只交付可替换的前端基础，不构成模块启动或验收。 |

状态交接摘要：

- Worktree / Branch / Base：见报告头。
- Changed Files：Action Center feature 10 个实现/测试/story 文件，双语 messages、全局 action token、Review route，SDD-004 主规范与 7 个生命周期文件，浏览器验证脚本和本报告。
- Commits：实现 `aed136f28e23bba74c2304afcf845bb78a67f525`；验收报告 commit 由最终 `STATUS_HANDOFF` 给出。
- Push / PR / Deploy：全部 `NO`。
- Owner UAT required：`YES`；当前 `PENDING`。
- 下一步：Coordinator 独立复验并决定是否接受 SDD-004；设计线程冻结 tokens/assets；待 M3 依赖与 API 语义冻结后另立集成 SDD。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS_WITH_RECORDED_LIMITATIONS`
- Executor 建议 SDD 结果：`EVIDENCE_READY`
- 证据成熟度：`ENGINEERING_VERIFIED` for UI foundation only
- Coordinator 独立复验：`PENDING`
- 是否需要 Owner 验收：`YES`
- Owner 决定：`PENDING`
- 最终模块状态建议：`M3-07 NOT_STARTED`
- 下一候选步骤：Coordinator 复验本地 commits 与忽略证据；Owner/设计线程评审信息层级和 tokens；不在此分支连接 PR #3。
