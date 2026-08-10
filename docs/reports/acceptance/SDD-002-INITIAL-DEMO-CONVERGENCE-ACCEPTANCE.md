# SDD-002 Initial Demo Convergence 验收补充报告

> Change Request：`docs/specs/sdd-002/CHANGE-REQUEST-3-INITIAL-DEMO-CONVERGENCE.md`
> Executor 状态：`EVIDENCE_READY`，等待 Coordinator 独立复核与 Owner UAT
> M2 canonical 状态：保持 `EVIDENCE_READY`，不得由本报告升级为 `ACCEPTED`
> 日期：`2026-08-11`

## 一、Objective 与边界

本次工作把既有 M1/M2 合成数据 SHADOW 路径收敛为稳定、可重置、可复验、可录屏的初赛 Demo，不增加业务语义。实现只复用现有 Campaign REST、PostgreSQL、`PUBLIC_SAFE_MOCK` Flight、Mission/Review 页面与非执行 Owner Review。

- Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-002-initial-demo-convergence-cr`
- Branch：`codex/sdd-002-initial-demo-convergence-cr`
- Base：`origin/main@f13aee3e8dba5b344924bd80ede256ae2c703bde`
- 固定 Compose project：`lumiclaw-sdd002-initial-demo`
- 固定端口：Web `3130`、API `4130`，均只绑定本机回环
- Evidence：`.evidence/sdd-002/initial-demo`，被 Git 忽略
- 成熟度：`DEMO_SEED / PUBLIC_SAFE_MOCK / MOCK_CONFORMANCE`
- 明确非声明：真实 AgentTeams/DeepSeek、真实账号、Secret、Connector、ActionGrant/Receipt、Scheduler、外部动作、客户结果、生产就绪。

未修改 migration、API/OpenAPI、M3 接口、视觉语义或 canonical `IMPLEMENTATION-STATUS`。

## 二、实现内容

1. `run-initial-demo.mjs` 提供 preflight、精确 reset/stop、准备、完成、状态与脱敏导出；失败只输出稳定 code/step。
2. 准备流程两次读取并比对确定性 Hero template，经现有 API 保存 Campaign，运行公开安全 Flight，并对被拒 Revision 发起负向 Review probe。
3. 合同验证固定六角色、八 Tasks、五 SkillLocks、五 Revision/Audit、四个 active PASS、`CLAIM_OVERREACH`、下一责任角色与全程零动作。
4. 完成流程只记录四个现有 PASS Revision 的 `NON_EXECUTABLE_OWNER_REVIEW`，随后重启 PostgreSQL/API 并复开同一状态。
5. Chrome DevTools smoke 只读检查中文/英文、桌面/390px Mission/Review、diff、失效、按钮状态、零动作、横向溢出与 console error。
6. Workflow verifier 连续两次准备并比对 Organization/Campaign/digest，用无关 sentinel volume 验证 reset 边界，完成后精确清理。
7. 双语 README 与中文 Runbook 给出准备、录屏、完成、证据、失败、清理、回滚和 Owner 回传步骤。
8. 可修复的生产依赖 `nanoid` 通过 root override 固定为 `3.3.18`；未加入新运行时依赖。

## 三、二进制验收结果

| CR3 criterion | 结果 | Evidence |
|---|---|---|
| 1. 固定环境 preflight | PASS | Node `24.16.0`、npm `11.13.0`、Docker `29.4.0`、Compose `v5.1.2`、Chrome、端口与 Compose config 通过 |
| 2. 精确且幂等 reset | PASS | 两轮准备后 reset；无关 sentinel volume 保留；Demo container/volume 均剩余 0 |
| 3. 确定性 seed 与准备态 | PASS | 两轮均为固定 Organization/Campaign，digest `4542d0d00fded182990c00cfc07a2c0876ffc6904e11854ffae7466a87663aa6`，状态均 `NEEDS_OWNER_REVIEW` |
| 4. Mission 拓扑/审计 | PASS | 6 roles / 8 tasks / 5 SkillLocks / 5 revisions / 5 audits / 4 active PASS |
| 5. Auditor fail-closed | PASS | `422 / REVIEW_AUDIT_PASS_REQUIRED`；FAIL 为 `CLAIM_OVERREACH / INVALIDATED`，下一角色 `founder-identity-producer` |
| 6. 完成与重启复开 | PASS | `SHADOW_COMPLETE`、4 reviews；PostgreSQL/API restart 后复开；ActionGrant/Connector/external action 全 0 |
| 7. 浏览器 smoke | PASS | 6 个页面/视口、4 张截图；中文/英文、1440/390px；console error 0、无 overflow |
| 8. 脱敏 evidence | PASS | allowlist 投影、SHA-256、Secret scan；`realAgentTeamsClaim=false`，无 Prompt/Header/Ticket/个人路径 |
| 9. README/Runbook | PASS | 前置、命令、预期、录屏、失败信号、证据、清理、回滚与 Owner 协议齐备 |
| 10. 工程与安全门禁 | PARTIAL | `npm run verify`、生产依赖 audit、SBOM/许可证/Secret 均 PASS；全 dev audit 因 Storybook 链无修复公告仍 exit 1，见第五节 |
| 11. 报告/状态纪律 | PASS（Executor） | 本补充报告与结构化回传已准备；M2 不升级，Owner UAT 与 Coordinator 接受仍为外部门禁 |

## 四、命令与结果

| 命令 | 结果 |
|---|---|
| `npx vitest run scripts/initial-demo-contract.test.ts` | PASS，1 file / 4 tests；实现前同一命令先以缺少模块红灯失败 |
| `npm run demo:preflight` | PASS，固定版本/工具/端口/项目/成熟度 |
| `npm run demo` | PASS，`NEEDS_OWNER_REVIEW`、负向 Review 422、零动作、浏览器与 evidence |
| `npm run demo:complete` | PASS，`SHADOW_COMPLETE`、4 reviews、重启复开、零动作 |
| `npm run demo:smoke` | PASS，6 pages / 4 screenshots / 0 console errors |
| `npm run verify:initial-demo` | PASS，`deterministicSeed=true`、`completedAndReopened=true`、`exactReset=true` |
| `npm run verify:campaign-api` | PASS，现有 Campaign/SHADOW PostgreSQL/API 路径与 cleanup |
| `npm run verify` | PASS；lint/typecheck；31 test files / 307 tests；message/status/report/secret/compose/runtime-profile；dependency inventory/SBOM；Next build；Storybook build与浏览器 bundle safety |
| `npm audit --omit=dev --audit-level=high` | PASS，生产依赖 0 vulnerability |
| `npm audit --audit-level=high` | FAIL，3 个 High、0 Critical；同源 Storybook dev-only `image-size<=2.0.2`，npm `fixAvailable=false` |
| `git diff --check` | PASS |
| protected-file `git diff --exit-code` | PASS；canonical status、API、migration/DB、action-operator、mission-worker、governed-shadow、runtime-agentteams 零 diff |

`npm run verify:initial-demo` 生成的公开安全 workflow evidence 记录：

- seed 两轮 identity/digest 一致；
- 完成态 `SHADOW_COMPLETE`、4 reviews、6 browser pages、4 screenshots；
- ActionGrant/Connector/external action 全 0；
- reset 后 Demo container/volume 全 0，无关 sentinel 保留；
- manifest、Mission 与 browser evidence 均有 SHA-256 绑定。

运行证据位于被忽略目录，不提交图片、运行 ID 或本机状态。提交后的 clean-Head 复验将覆盖旧 evidence，并由结构化 handoff 回传最终 Head/dirty truth。

## 五、Limitations / blockers

1. **全 dev dependency audit 未全绿。** 2026-08-11 的 npm registry 对 `image-size@2.0.2` 报告 High denial-of-service；它只经 `@storybook/nextjs-vite → vite-plugin-storybook-nextjs` 出现在本地 Storybook 开发/构建链，`npm audit` 明确 `fixAvailable=false`。生产依赖 audit 为 0；本次不 vendoring、不 Fork、不绕过公告，也不谎报 PASS。上游发布安全版本后需单独升级并重新跑 Storybook/全量 audit。
2. Demo 依赖 macOS 默认 Chrome 路径和固定回环端口；其他环境需独立 CR，当前不开放可变 destructive target。
3. 浏览器截图和 workflow JSON 是本地公开安全运行证据，默认不提交；它们不等于客户 UAT 或业务结果。
4. `PUBLIC_SAFE_MOCK` 只证明控制面、治理状态与 Demo 可复验，不证明真实 AgentTeams/Provider 模型质量。
5. Owner UAT 尚未发生；聊天结论和机器 PASS 均不能把 M2 标成 `ACCEPTED`。

## 六、Owner verification

前置：Docker Desktop、固定 Node/npm、默认路径 Chrome、3130/4130 端口空闲，只使用合成数据。

1. 执行 `npm ci && npm run demo:preflight && npm run demo`；最后一行应为 PASS、`NEEDS_OWNER_REVIEW`、Mock maturity、负向 422 与零动作。
2. 打开 `http://127.0.0.1:3130/mission`，确认 `DEMO_SEED / NOT_LIVE`、六角色、Leader 仅编排、八 Tasks、零动作。
3. 打开 `http://127.0.0.1:3130/review`，确认 `CLAIM_OVERREACH`、Evidence、下一责任角色、`已失效`、v1→v2 diff 与四个 PASS Revision。
4. 检查 `/en/mission`、`/en/review` 与 390px 截图；不得有横向溢出或 console error。
5. 执行 `npm run demo:complete`，刷新确认 `SHADOW_COMPLETE`、四个“已记录（不可执行）”与仍为零的动作计数。
6. 检查 manifest/Mission/browser evidence 的成熟度、哈希和禁止字段，再执行 `npm run demo:reset`；Demo URL 应停止，其他项目不受影响。

请回传 `DEMO UAT PASS`，或 CR3 criterion 编号、失败步骤、页面截图、终端最后一行 JSON 与 `failure.json`。不得回传 Secret、环境变量、原始模型内容、客户资料或未脱敏日志。

## 七、Proposed maturity/state 与下一步

- CR3 实现建议：`ENGINEERING_VERIFIED / EVIDENCE_READY`，附 Storybook dev-audit 已知限制；等待 Coordinator 独立复验。
- M1/M2 canonical：不修改；M2 保持 `EVIDENCE_READY`。
- Owner UAT：`PENDING`，必须由独立验收任务按第六节给出二元决定。
- 下一候选步骤：Coordinator 在 clean commit 上复跑 `npm run verify:initial-demo` 与保护文件 no-diff，随后安排 Owner 录屏/UAT；上游 `image-size` 发布修复后再关闭全 dev audit 条件。
