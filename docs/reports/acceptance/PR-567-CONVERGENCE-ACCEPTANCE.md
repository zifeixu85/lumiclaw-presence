# PR #5/#6/#7 收敛验收报告

> 范围：SDD-004 / M3-00、SDD-005 / M2-07、SDD-006 / M5-00
>
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/pr567-convergence`
>
> Branch / Base：`codex/pr567-convergence` / `9e241da98be00c56204894c67b7599d37ff10505`
>
> 合并顺序：PR #5 `9791045d300f4c6777abc92bcaf6af992df89519` → PR #6 `7edfb87257310d5342b24f2ec0265f2d0596302a` → PR #7 `3fda075ad7f22513cfc909d43ee70c586dbb6e0b`
>
> 报告状态：`EVIDENCE_READY_CANDIDATE / OWNER_UAT_PENDING`
>
> 成熟度边界：不声明 `ACCEPTED`、`EXTERNAL_CALIBRATED`、`BUSINESS_VERIFIED`、真实发布或已连接账号
>
> 日期：2026-08-22

## 一、独立复核结论

三条源 PR 没有 GitHub review-thread 对象或未解决的正式 review；旧的 flat Coordinator comments 主要集中在 PR #7。PR #7 最终 Head 已包含对资料路径、完成态重入、未授权发布、生产视觉与 Onboarding 反馈的修订，但旧 Owner 视觉 UAT 只对 `f19174a777c52f9f0d45b1513f9b89894a1f24d9` 给出过 `FAIL → REVISE`，最终 Head 没有新的 Owner PASS。因此本收敛可以作为可合并技术基线候选，不能代替 Owner UAT。

独立复核没有发现仍未关闭的 P0。发现并关闭四类组合级问题：

1. PR #5 的 SDD 元数据存在尾随空格；PR #6 的 Spec Kit 文档存在额外 EOF 空行。两份源验收报告把各自 `git diff --check` 记为 PASS，与精确源 Head 不一致。本分支清理后，基于 main 的组合 diff 为 0 whitespace error；历史报告保留为源分支记录，本报告给出纠正事实。
2. PR #6 的 `verify:static` 改动会把既有 SDD-002 report gate 替换为 SDD-005 gate。组合脚本已同时保留 SDD-002、SDD-004、SDD-005、SDD-006 四份报告门禁。
3. 三条分支同时修改全局 CSS、domain export、Vitest JSX 配置和状态文件。收敛保留 PR #7 的生产 `tokens/base/workspace` 视觉路径，把 PR #5/#6 的隔离证据样式放入 `apps/web/src/styles/evidence.css`；domain exports、React plugin、automatic JSX transform、42 个 module ID 与双语状态镜像均被保留，没有用 ours/theirs 丢实现。
4. PR #7 完成 Onboarding 时原先按“读取材料 → 创建 Campaign → 最后锁定 session”执行。并发上传可在窗口内插入一份材料，使 session material IDs 与 Campaign EvidenceRefs 永久不一致。新增 PostgreSQL migration `000010_onboarding_completion_reservation.cjs` 和 `COMPLETION_PENDING` reservation：在建 Campaign 前，以 session row lock 冻结 exact material IDs 与 Campaign document digest；同 digest 可恢复重试，上传、删除、重选路径和不同 digest 均 fail closed。API/Memory/真实 PostgreSQL 均有回归。

## 二、组合实现边界

| 能力 | 当前真实状态 |
|---|---|
| SDD-004 手动发布基础 | 六平台 registry 与桌面只读 manual package evidence 已实现；没有 ActionGrant、Operator、导航、上传、read-back 或 `PUBLISHED`。 |
| SDD-005 市场本地化 | 只实现 public-safe US/JP/DE 三市场、来源/版本/冲突/Producer-Auditor context 合同；不是客户校准、文化正确性或合规保证。 |
| SDD-006 生产 UX / Onboarding | 中文默认、英文第二语言、真实 MD/TXT、本地 PostgreSQL/Blob、`LOCAL_PRIVATE` Campaign、生产桌面 Shell 与发布 fail-closed 已实现；PDF/DOCX、OAuth、常驻 AgentTeams runtime、账号连接和真实发布仍未实现。 |
| 组合关系 | PR #7 生产 UX 为主表面；PR #5/#6 保持隔离 Storybook evidence surface，不冒充已接入真实发布流程或已完成市场表达生成。 |

PR #5 已记录的审批合同缺口仍存在：manual package 绑定 revision/media/account/capability/expiry，但没有独立 `ownerDecisionId` 或计划发布时间；后续 ActionGrant SDD 必须显式实现，不能从 package digest 推断授权。

## 三、精确验证结果

| 命令 | 结果 |
|---|---|
| `npm ci` | PASS；843 packages installed、856 audited；lockfile 无变化；完整 dev tree 有 3 个既有 high finding。 |
| `npx vitest run packages/domain/src/activation.test.ts apps/web/src/components/desktop-manual-publish-assistant.test.ts packages/domain/src/campaign.test.ts packages/domain/src/campaign-envelope.test.ts apps/web/src/components/campaign-workspace.test.ts` | PASS；5 files / 70 tests。 |
| `npx vitest run packages/domain/src/market-localization.test.ts apps/web/src/components/market-localization-evidence.test.ts` | PASS；2 files / 14 tests。 |
| `npx vitest run apps/api/src/local-presence-api.test.ts apps/api/src/memory-local-presence-repository.test.ts apps/api/src/server.test.ts apps/web/src/components/production-workspace.test.ts apps/web/src/components/campaign-workspace.test.ts packages/domain/src/local-campaign.test.ts packages/domain/src/local-presence.test.ts packages/blob-store/src/index.test.ts` | PASS；8 files / 73 tests。 |
| `npm test` | PASS；40 files / 368 tests / 0 skipped。 |
| `npm run lint` | PASS；0 error。 |
| `npm run typecheck` | PASS；12 workspace scripts。 |
| `npm run verify` | PASS；含 lint/typecheck、368 tests、612 bilingual keys、42 module parity、3-market deterministic fixture、四份 report gate、397-file secret scan、Compose policy、controlled AgentTeams profile、1020-package inventory、CycloneDX 1.6 / 710 components、Next 29 static/dynamic pages、6 Storybook evidence bundles、browser-safety forbidden `[]`。 |
| `npm run verify:sdd006:compose` | PASS；fresh volume/migration、14 PostgreSQL/Blob checks、55 real-Chromium bilingual checks、17 screenshots、cleanup PASS；关键门禁 0 skip。 |
| `npm run verify:compose` | PASS；通用 fresh/broken migration、service health、restart persistence、non-live/operator 回归。 |
| `node scripts/capture-pr567-convergence-evidence.mjs` | PASS；real Chrome、3 checks、2 public-safe Storybook screenshots、console error 0。 |
| `npm audit --omit=dev --audit-level=high` | PASS；production vulnerabilities 0。 |
| `git diff 9e241da98be00c56204894c67b7599d37ff10505 --check` | PASS；0 whitespace error。 |

一次补充执行 `npm run verify:shadow-postgres` 因没有 `DATABASE_URL` 按合同返回 `DATABASE_URL_REQUIRED`；随后在只读 API 容器调用 wrapper 又因 wrapper 会重复写 build 目录被 EROFS 拒绝，直接脚本完成数据库断言后只在写容器内 `.evidence` 时被只读目录拒绝。这些尝试不计作 PASS，也不构成产品代码失败；本轮 fresh-PG 要求由两条已通过的 Compose 门禁覆盖。

## 四、证据

- 组合 Storybook evidence：[browser-verification.json](../evidence/pr-567-convergence/browser-verification.json)
  - `01-manual-publish-assistant.png`：SHA-256 `b373ed51b4d8afb5e62958af5a9aeb6b35f6a0d5f72184d743fda33265c4c312`
  - `02-market-localization-jp-conflict.png`：SHA-256 `1f9b5e2d592b9d7bb4e4ea98d90f0d4a005a8d8356a21ac4d72a88ce77071f2d`
- 生产 Chromium evidence：[SDD-006 browser verification](../evidence/sdd-006/browser-verification.json)，55 checks / 17 screenshots；中文 Today、英文 Today/AI Team/Publish、800px desktop gate 均在同一最终组合代码上重建。
- fresh-PG machine evidence：`.evidence/sdd-006/compose-verification.json`，14 checks；本地 ignored，不含客户数据或 Secret。
- 通用 Compose machine evidence：`.evidence/sdd-002/compose-verification.json`；本地 ignored。
- 所有截图和测试 fixture 均为 public-safe 合成数据，不是 customer UAT。

## 五、Owner UAT 清单

### 前置与启动

1. 确认 Docker daemon 可用，并 checkout 本报告 Branch 的最终 Head。
2. 在本报告 Worktree 运行：
   `docker compose --project-name lumiclaw-pr567-owner-uat up --build --detach`
3. 等待 `docker compose --project-name lumiclaw-pr567-owner-uat ps` 中 `postgres/api/mission-worker/action-operator/web` 全部 healthy；打开 <http://127.0.0.1:3100>。
4. 只上传 public-safe、无客户/联系人/Secret 的 UTF-8 `.md` 或 `.txt`。

### 编号验收步骤

1. **首次打开与双语。** 1440×900 打开根路径。预期默认中文、深色侧栏/暖白内容面、只有本地显示名称，不出现 email/password/API Key；右上可切到 English 并切回。失败信号：默认英文、内部 stable code 主导首屏、Secret 输入或横向滚动。
2. **公开示例路径。** 输入显示名称并选择公开示例。预期进入完整生产 Shell，清楚标记演示数据，Today/Campaign/AI Team/Publish 可访问但不宣称账号已连接、Agent 正在运行或内容已发布。返回 Today 与 Campaign 两张截图。
3. **本机资料路径。** 仅对这个 disposable UAT project 执行 `docker compose --project-name lumiclaw-pr567-owner-uat down --volumes` 后重新启动；选择本机资料，上传一份 public-safe MD/TXT，核对提取文本，填写 Organization/Brand/Product/Campaign；Market、Locale、Preferred Platform 各选择至少两项，默认排程时区选择一个。预期进入 `LOCAL_PRIVATE` Campaign，不泄漏 LumiClaw 示例 Campaign。
4. **持久化与证据绑定。** 记录 Campaign 名称与材料 digest，执行 `docker compose --project-name lumiclaw-pr567-owner-uat restart postgres api web`。预期重开后 profile、材料、上下文、Campaign、EvidenceRef 不变；任何丢失、退回 Onboarding 或示例替换均为 FAIL。
5. **生产 UX 主路径。** 依次查看 Today、Campaign、完整内容 Drawer、AI Team 四页签、Publish、Brand、Settings。预期 A0–A5 恰好六名、指标来源诚实、runtime `NOT_CONFIGURED`、账号控件 disabled、发布批准/打开官方页/人工完成在缺 Audit 与精确 OwnerDecision 时 blocked；Esc 关闭 Drawer 并恢复焦点。
6. **双语与桌面 gate。** 在 `/en` 检查 Today、AI Team、Publish；1024px 不得横向溢出；800px 应显示 desktop gate，不显示不可用的压缩工作区。
7. **SDD-004 隔离证据。** 另一个终端运行 `npm run storybook`，打开 Storybook → `M3 / Desktop Manual Publish Assistant / Chinese Desktop`。预期 6 个平台、唯一“去发布”手工路径、无链接/按钮/输入/网页预填/成功声明；人工完成只到等待核对。
8. **SDD-005 隔离证据。** Storybook → `M2 / SDD-005 Market Localization Evidence / Japan Conflict Blocked`。预期只有 US/JP/DE 三市场；JP 显示 `BLOCKED_BY_CONFLICT`；Producer 与 Auditor context 分离；页面明确 `PUBLIC_SAFE_FIXTURE / OWNER UAT PENDING`，不称文化/合规正确。

### Owner 返回证据

- 一行二元决定：`PR-567 OWNER UAT PASS` 或 `PR-567 OWNER UAT FAIL → REVISE`。
- 若 PASS：提供步骤 2、3、5、7、8 的 public-safe 截图，并确认步骤 4 重启恢复、步骤 6 双语/desktop gate 通过。
- 若 FAIL：提供失败步骤号、URL、视口、可见现象、console/network 错误和期望修改；不要发送客户资料或 Secret。

### 清理

- 停止 Storybook：终端 `Ctrl-C`。
- disposable UAT 数据清理：`docker compose --project-name lumiclaw-pr567-owner-uat down --volumes --remove-orphans`。该命令会删除此命名 UAT project 的 PostgreSQL/Blob volume，不得用于真实数据 project。

Owner 结果：`PENDING`。

## 六、推荐合并决策与回滚

推荐状态：`TECHNICAL PASS / EVIDENCE_READY_CANDIDATE`。Coordinator 应在远端 CI 与 clean checkout 独立复验后，只合并 convergence PR；PR #5/#6/#7 保持打开直到 Coordinator 记录 superseded/integrated 处置。由于 PR #7 的视觉门禁明确要求 Owner 参与，Owner UAT PASS 前不建议最终合入 main，也不得把 M2-07/M5-00 或任何相关模块写成 `ACCEPTED`。

代码回滚由 Coordinator 对 convergence merge commit 执行 `git revert`，不得 reset main。若 migration `000010` 已应用，先停止写入并备份；只在确认不存在 `COMPLETION_PENDING` session 后执行受控 migration down 或恢复备份。对于本报告命名的 disposable UAT project，可直接 `down --volumes` 清理。回滚不会补发、撤回或触发任何外部平台动作，因为本基线没有这类执行路径。

## 七、剩余限制

- Owner UAT 与 Coordinator 最终 acceptance 均为 `PENDING`。
- SDD-004 没有独立 OwnerDecision/计划发布时间、ActionGrant、Operator 或 read-back。
- SDD-005 只有 exact-three public-safe fixture，不是外部市场校准。
- SDD-006 不含 PDF/DOCX、OAuth、真实账号、persistent AgentTeams runtime 或 connector。
- completion reservation 可恢复同一 document digest 的进程中断；若数据库已经存在与 deterministic idempotency key 冲突的异常 Campaign 历史，会返回 `LOCAL_CAMPAIGN_INITIALIZATION_CONFLICT`，需要人工诊断，绝不自动删除或覆盖历史。
- dev-only Storybook 依赖链仍报告 3 个 high finding且当前无自动修复；production audit 为 0。本收敛未新增依赖。
