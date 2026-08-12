# SDD-003 验收报告：PostgreSQL ActionGrant Governed Execution Foundation

> 模块：M3-01
> 状态：EVIDENCE_READY
> 能力：IMPLEMENTED、ENGINEERING_VERIFIED
> Owner 验收：PENDING
> 日期：2026-08-12

## 交付结论

M3-01 已完成受治理 PostgreSQL ActionGrant 基础。OwnerDecision、ActionGrant 与 Outbox 在事务中持久化；Decision digest 来自数据库中的权威 ArtifactRevision 与 CapabilitySnapshot。API 与无 LLM action-operator 使用不同最小权限角色。lease 过期恢复为每条 UNKNOWN Receipt 独立生成应用层 UUIDv7，重复轮询不新增 Receipt。

本轮只使用 CONTROLLED_FAKE Connector，externalActions=0。真实平台执行、客户 UAT、外部校准与业务结果均为 NOT_CLAIMED。

## 自动化证据

| 命令 | 退出码 | 结果 |
|---|---:|---|
| npm.cmd run verify:m3-fresh-postgres | 0 | migration 2/2；roles 4/4；ActionGrant 25/25；PG 19/19；cross-process PASS |
| npm.cmd run verify:m3-sdd003 | 0 | domain 32/32；repository contracts 41/41；全 workspace typecheck；fresh PG PASS |
| npm.cmd run check:status | 0 | 39 个模块中英文状态一致 |

完整 stdout、stderr、逐步命令和退出码：.evidence/sdd-003/fresh-postgres-transcript.log。结构化结果：fresh-postgres.json、cross-process.json。

覆盖项包括幂等冲突、并发 claim、撤销与 claim 竞态、过期 Grant、失败 Receipt、handoff、对账、Receipt 不可变、lease 过期 UNKNOWN、不盲重试、API/operator 最小权限、API A 到 operator 到 API B 重启、SSE 与重复执行防护。

## Owner 验收

前置：Node 24、npm 11、Docker Compose v2；不得配置真实平台凭据。

1. 运行 npm.cmd run verify:m3-sdd003。
2. 确认退出码 0，最终 JSON 的 status、database、migrations、crossProcessRestart、appendOnly、sse 均为 PASS。
3. 确认 externalActions=0、connectorMode=CONTROLLED_FAKE。
4. 检查 transcript 中 migration 双跑、权限负向失败、25/25 与 19/19。
5. 返回 transcript、commit SHA 与明确 PASS/FAIL。

失败信号：非零退出、NOT_RUN/skip 被当作 PASS、UNKNOWN 重发、跨组织可见、Receipt 可修改、真实外部请求或证据缺失。

## 限制、回滚与交接

仅完成工程级受控 fake 验证；M3-02 至 M3-07 保持 NOT_STARTED。依赖安装输出已有 3 个 high severity 审计提示，本 SDD 未新增依赖，需按依赖政策另行处理。

回滚时停止 action-operator 并禁止新 Grant，保留所有治理历史；已迁移数据库使用 forward-fix，不得删除 Receipt 或把 UNKNOWN 改回 PENDING。

建议 M3-01 保持 EVIDENCE_READY，Owner 验收后才可改为 ACCEPTED。最终本地及远端 SHA 在提交、SHA 复验和推送后提供。
