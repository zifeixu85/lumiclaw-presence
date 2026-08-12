# SDD-003 测试交付流程

> 范围：M3-01 PostgreSQL ActionGrant Governed Execution Foundation
> 外部动作：`0`
> Connector：`CONTROLLED_FAKE`
> 当前模块状态：`NOT_STARTED`；修复后自动化门禁与 Coordinator 独立复核仍待完成，Owner 验收尚未开放。

## 1. 前置条件

1. Windows PowerShell 或兼容终端。
2. Node.js `24.16.0`、npm `11.13.0`。
3. Docker Engine/Desktop 与 Docker Compose v2 可用。
4. 仓库根目录无包含凭据的文件；不得使用任何真实社交平台账号或 Token。
5. verifier 只使用 Compose 内部网络，不暴露 PostgreSQL 主机端口。

先执行：

```powershell
node --version
npm.cmd --version
docker version
docker compose version
git status --short
```

预期：版本符合仓库要求；Docker Server 可用。工作树如有修改，先记录，不要清理他人的修改。

## 2. 快速无数据库检查

```powershell
npm.cmd test -- --run packages/domain/src/action-grant.test.ts apps/action-operator/src/outbox-consumer.test.ts apps/api/src/action-grant-routes.test.ts apps/api/src/receipt-routes.test.ts
npm.cmd run typecheck
```

预期：命令退出码均为 `0`。失败时保留完整 stdout/stderr。

## 3. Fresh PostgreSQL 与跨进程验证

推荐直接运行一键门禁。它使用固定的 verifier 专用 Compose project 和内部网络，从空 volume 开始，依次执行两次 migration、19 项 PG tests、25 项 ActionGrant verifier、API A/独立 Operator/API B restart/SSE verifier，最后只清理 verifier volume：

```powershell
npm.cmd run verify:m3-fresh-postgres
```

预期输出 `status=PASS`、`cleanup=PASS`、`database=fresh`、`crossProcess=PASS`、`externalActions=0`、`connectorMode=CONTROLLED_FAKE`，证据位于 `.evidence/sdd-003/fresh-postgres.json` 和 `.evidence/sdd-003/cross-process.json`。

如需逐步诊断，再使用以下手工流程。确保从空 volume 开始，不要对开发数据库执行清库。

```powershell
docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml down --volumes --remove-orphans
docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml up -d postgres
docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml run --rm migrate
docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml run --rm migrate
```

预期：第一次应用全部 migration；第二次无新增 migration 且成功。失败信号包括 `000018` 失败、约束/trigger 创建失败或非零退出。

通过 verifier 容器显式提供 API、operator 与 admin PostgreSQL URL 后执行，不得回退内存仓库：

```powershell
docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml run --rm verifier npm run verify:m3-action-grant
docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml run --rm verifier npm run verify:m3-cross-process
```

预期：PostgreSQL repository 19/19、ActionGrant 25/25 和跨进程 verifier 全部 PASS。不得把跳过 PG tests 当作 PASS；输出必须证明三个 PostgreSQL URL 已生效。

## 4. SDD-003 总门禁

```powershell
npm.cmd run verify:m3-sdd003
```

预期：退出码 `0`，末尾 JSON 至少包含：

```json
{
  "status": "PASS",
  "database": "fresh",
  "migrations": "PASS",
  "domain": "PASS",
  "repositoryContract": "PASS",
  "externalActions": 0,
  "connectorMode": "CONTROLLED_FAKE"
}
```

`postClaimRevoke`、`lateCompletionFencing`、`crossCampaignOccurrence`、`dispatchStateMatrix`、`outboxArtifactTamper` 与 `crossProcessRestart` 必须分别为 `PASS`；任何 `NOT_RUN` 均禁止 Coordinator 推进模块状态。

## 5. 必须人工核对的数据库负向项

在 verifier 创建的测试数据库上核对测试日志确实覆盖：

1. OwnerDecision `UPDATE` 与 `DELETE` 均因 `GOVERNED_HISTORY_IMMUTABLE` 失败。
2. ActionReceipt `UPDATE` 与 `DELETE` 均失败。
3. 同一 predecessor 并发确认/对账只有一个 successor。
4. 同一 Grant 只有一个初始 Receipt 和一个 Outbox Attempt。
5. claim 前 revoke 后 Connector 调用数为 0。
6. claim 后 revoke 返回 `ACTION_ALREADY_EXECUTING`。
7. lease 过期产生 UNKNOWN，重启后不会再次 dispatch。
8. 同组织异 Campaign、异组织的读取、撤销、handoff、reconcile、SSE 均隔离。
9. API 重启使用同一 signer，旧 Grant 可继续验证和查询。
10. 所有测试 URL 都是公开安全 fixture；没有真实外部请求。

任何一项没有测试名称、断言或数据库证据，都应记为 `NOT COVERED`，不能根据代码推断 PASS。

## 6. 全仓门禁

```powershell
npm.cmd run verify:static
npm.cmd run build
```

预期：均为退出码 `0`。若失败与 SDD-003 无关，也应在验收报告记录，不得隐藏。

## 7. 证据交付

交付给复审同学：

- 当前 commit SHA 与 `git status --short`。
- 本流程所有命令的完整输出。
- `verify:m3-sdd003` 最终 JSON。
- Fresh PG migration 列表与 PG test 汇总。
- 撤销竞态、UNKNOWN、不重发、append-only、scope/SSE 的具体测试名和结果。
- 明确声明 `externalActions=0`、真实平台能力 `NOT_CLAIMED`。

## 8. 清理

只删除 verifier 专用 Compose 项目：

```powershell
docker compose --project-name lumiclaw-sdd003-verify -f compose.yml -f compose.sdd003-verify.yml down --volumes --remove-orphans
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

不得删除共享开发数据库、非 verifier volume 或他人的工作树文件。
