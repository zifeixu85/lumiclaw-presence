# SDD-002 初赛 SHADOW Demo 与录屏 Runbook

> 适用范围：2026-08-16 初赛的 M1/M2 已实现路径收敛。
> 证据成熟度：`DEMO_SEED / PUBLIC_SAFE_MOCK / MOCK_CONFORMANCE`。
> 非声明：不运行真实 AgentTeams/DeepSeek，不连接真实账号，不执行外部动作，不替代 Owner UAT，不把 M2 标为 `ACCEPTED`。

## 1. 运行结果

`npm run demo` 会在固定本地环境完成以下操作：

1. 校验 Node/npm、Docker/Compose、Chrome、Compose 配置与回环端口；
2. 只重置 `lumiclaw-sdd002-initial-demo` 及 `.evidence/sdd-002/initial-demo`；
3. 启动现有 Web/API/PostgreSQL 路径并保存确定性 Hero Campaign；
4. 运行现有公开安全 SHADOW Flight，保留 Auditor 拒绝、修订与复审证据；
5. 证明被拒 Revision 不能被 Owner Review；
6. 用真实 Chrome 检查中英文、桌面与 390px 页面；
7. 把 Demo 留在 `NEEDS_OWNER_REVIEW`，方便录制人工确认门。

全程必须保持：六角色、八 Tasks、五个 SkillLocks、五个 Revision、五个 Audit、四个当前 PASS Revision、`ActionGrant=0`、`Connector=0`、`External action=0`、`executionAllowed=FALSE`。

## 2. 前置条件

- 当前目录是本仓库工作树；
- Node.js `24.16.0`、npm `11.13.0`；
- Docker Desktop 正常，`docker info` 可用；
- Google Chrome 安装在 macOS 默认路径；
- `127.0.0.1:3130` 与 `127.0.0.1:4130` 未被占用；
- 只使用仓库自带合成数据，不输入 Key、Token、账号、客户或私有资料。

先执行：

~~~bash
npm ci
npm run demo:preflight
~~~

预期：最后一行 JSON 为 `status=PASS`，版本、Chrome、端口均通过，project 为 `lumiclaw-sdd002-initial-demo`，成熟度为 `MOCK_CONFORMANCE`，`realAgentTeamsClaim=false`。

## 3. 准备录屏状态

~~~bash
npm run demo
~~~

首次构建可能需要数分钟。成功时最后一行必须同时包含：

- `status=PASS`、`state=NEEDS_OWNER_REVIEW`；
- `deniedReview.status=422`、`deniedReview.code=REVIEW_AUDIT_PASS_REQUIRED`；
- 三个动作计数均为 `0`；
- 四个录制 URL；
- manifest、Mission evidence、browser smoke 三个证据路径。

录制前可做只读复验：

~~~bash
npm run demo:status
npm run demo:smoke
npm run demo:evidence
~~~

这些命令不得改变 Revision、Audit 或 Review 语义；`demo:smoke` 可在准备态或完成态运行。

## 4. 建议录屏顺序

1. 打开 <http://127.0.0.1:3130/mission>，先拍顶部 `DEMO_SEED / NOT_LIVE`，再向下展示六个分工角色、Leader 的 `ORCHESTRATION ONLY`、八个 Task 和零动作证明。
2. 打开 <http://127.0.0.1:3130/review>，展示 `CLAIM_OVERREACH`、`已失效`、Evidence、下一责任角色、v1→v2 diff 与四个 PASS Revision。
3. 明确口播：四个绿色按钮只是 `NON_EXECUTABLE_OWNER_REVIEW`，不等于 ActionGrant，不触发排程、Connector 或发布。
4. 切换 <http://127.0.0.1:3130/en/mission> 和 <http://127.0.0.1:3130/en/review>，只需证明同一持久化状态和英文可用。
5. 回终端展示 `demo:status` 和脱敏 evidence 路径，不展示 Docker Secret、环境变量或原始日志。
6. 执行 `npm run demo:complete`，刷新 Mission/Review，展示 `SHADOW_COMPLETE`、四个已记录的不可执行确认和仍为零的动作计数。

建议先完整走一次再录；不要在录制过程中修改数据库、切换真实 Provider 或手工调用 API。

## 5. 完成、重启复开与重复运行

~~~bash
npm run demo:complete
~~~

命令会记录四个当前 PASS Revision 的不可执行 Owner Review，重启 PostgreSQL/API，再从同一权威状态复开。预期为 `state=SHADOW_COMPLETE`、`reviews=4`，动作计数仍全部为零。对已完成状态重复运行此命令也应保持成功。

需要从头重录时直接运行 `npm run demo`；准备命令会先做精确 reset，再重建相同 Organization/Campaign ID 与 Campaign digest。整链路工程复验命令为：

~~~bash
npm run verify:initial-demo
~~~

它连续准备两次，比对确定性 seed，完成并重启复开，再验证 reset 没有删除一个无关 sentinel volume。命令结束后 Demo 栈会被清理。

## 6. Evidence

运行态证据均在被 Git 忽略的 `.evidence/sdd-002/initial-demo/`：

| 文件 | 内容 |
|---|---|
| `demo-manifest.json` | Git Head/dirty、project/端口、成熟度、场景、零动作、文件 SHA-256 |
| `mission-evidence.json` | 公开安全身份、拓扑、Revision/Audit、拒绝码、Review 与 trace 计数 |
| `browser-smoke.json` | 六个页面/视口检查、console/overflow、截图相对路径 |
| `mission-zh-*.png` / `review-zh-*.png` | 桌面与 390px 公开安全截图 |
| `workflow-verification.json` | 两轮 seed 一致性、完成/复开、reset 隔离和运行证据哈希 |
| `failure.json` | 失败阶段与稳定错误码；不包含原始异常或 Secret |

导出采用字段 allowlist，不是数据库或 API 原始 dump。`source.dirty=true` 只是如实说明运行源包含未提交变更，不是失败。

## 7. 失败信号与处置

以下任一情况都不能录作 PASS：

- preflight 的版本、Docker、Compose、Chrome 或端口检查失败；
- 页面不是 `DEMO_SEED / NOT_LIVE` 或把 Mock 表述为真实 Runtime/Provider；
- 角色/Task/SkillLock/Revision/Audit 数量不符；
- 缺少 `CLAIM_OVERREACH`、Evidence、下一责任角色、失效标记或 diff；
- 被拒 Revision 的 Review 没有返回 `422 / REVIEW_AUDIT_PASS_REQUIRED`；
- 出现任何 ActionGrant、Connector、外部动作或 `executionAllowed=TRUE`；
- 刷新/重启后状态丢失，页面横向溢出，或浏览器 console error 非零；
- evidence 出现 Authorization、Cookie、Key、Ticket、Token、Prompt、个人绝对路径或私有数据；
- reset 影响其他 Compose project/resource。

先查看终端最后一行与 `.evidence/sdd-002/initial-demo/failure.json` 的 `code/step`。不要用全局 `docker system prune`、`docker volume prune`、手工删库或扩大 reset 目标来“修复”Demo。端口占用时先识别占用者并由其 Owner 处理。

## 8. 停止、清理与回滚

临时停止但保留数据库与 evidence：

~~~bash
npm run demo:stop
~~~

删除且只删除本 Demo 的容器、网络、named volumes 与 evidence：

~~~bash
npm run demo:reset
~~~

代码回滚使用当前分支上的普通 `git revert <commit>`，不重写历史。此 Change Request 没有 migration、外部动作或线上状态，因此不需要外部补偿。

## 9. Owner 独立验证与回传

Owner 应在 Executor 提交之后、独立验收任务中执行：

1. `npm ci && npm run demo:preflight && npm run demo`；
2. 按第 4 节检查中文 Mission/Review；
3. 检查英文与浏览器 390px 截图；
4. 执行 `npm run demo:complete`，刷新确认 `SHADOW_COMPLETE` 与四个不可执行 Review；
5. 检查 manifest/evidence 哈希、`consoleErrorCount=0` 与全程零动作；
6. 执行 `npm run demo:reset`，确认 Demo URL 停止且其他项目未受影响。

请回传：`DEMO UAT PASS`，或失败的 CR3 criterion 编号、失败步骤、页面截图、终端最后一行 JSON，以及 `failure.json`。不要回传 Secret、环境变量、原始模型内容、客户资料或未脱敏日志。
