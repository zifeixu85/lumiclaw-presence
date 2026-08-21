# SDD-007 — Persistent AgentTeams Runtime, Secret Broker and Recovery

> Status: `SPEC_READY`
> Milestone: `M5`
> Proposed progress module ID: `M5-08`（待 Coordinator 登记；本文不改变 canonical progress）
> Owner: LumiClaw Presence technical lead；产品 Owner 参与运行状态 UAT
> Goal objective: 将 immutable MissionExecutionBundle 通过常驻、可恢复的真实六成员 AgentTeams Runtime 执行
> Target evidence maturity: `ENGINEERING_VERIFIED`
> Acceptance report: `docs/reports/acceptance/SDD-007-ACCEPTANCE.md`
> Last updated: `2026-08-22`

## 1. User problem and outcome

现有真实 AgentTeams/DeepSeek 证据依赖一次性 UAT 脚本：人工复制 ID、启动临时 stack、执行后销毁。Owner 需要产品中的 AI Team 真正持续工作，能看到六成员状态、当前任务和渐进 Trace；worker/runtime/model 任一重启后能从 PostgreSQL 恢复，不重复接受输出，也不切换到隐藏 Mock 成功。

本 SDD 是纯 Runtime 合同。它消费 SDD-009/010 已冻结的 opaque `MissionIntentBundle` / `MissionExecutionBundle` generations、TaskContract、SkillLock 和 output schema；不得拥有或重新解释 Persona、Knowledge、Account、Goal、Plan、X/XHS Artifact、Audit、OwnerDecision 或 PublishPackage 业务语义。

## 2. Current state

- M2 Governed Shadow 已验证固定六角色/8-task DAG、真实 AgentTeams ACK/Submit、DeepSeek Gateway、one-use ticket、revision/audit/trace 导入、超时与隔离路径。
- AgentTeams 当前锁定路径已有可复用 team profile/runtime digests；不能重建 Manager/Worker/Matrix。
- live UAT scripts 已实现终端隐藏输入、0600 临时 secret、Compose Secret、gateway-only provider key 和脱敏 receipt。
- 这些脚本以一次性 UAT stack 为单位，要求复制 run/task ID，结束后销毁，不是产品 runtime。
- `apps/mission-worker/src/server.ts` 在 `main` 只有 `/health`，没有 PostgreSQL job polling、lease、heartbeat、dispatch 或 restart recovery。
- PR #7 AI Team 页面只是静态 roster `NOT_CONFIGURED`，没有同一 control-plane run state。

## 3. Scope

### In scope

- 固定版本 AgentTeams runtime/profile/digests、exact six roles 和 Leader orchestration-only enforcement。
- 常驻 `mission-worker` 从 PostgreSQL 领取 Mission Job/Lease，dispatch 到 AgentTeams、处理 ACK/Submit、校验并导入 accepted output。
- PostgreSQL `MissionRun`、`MissionJob`、`AgentTaskAttempt`、`RuntimeBinding`、`RuntimeEvent`、lease/heartbeat/retry/reconciliation。
- terminal-only provider Secret configuration：隐藏输入、Secret Broker、0600/Compose Secret、one-use Model Gateway ticket；Secret 不进入 Web/API/PG/Git/log/prompt/trace。
- 产品 install/start/stop/readiness 与 Runtime version compatibility；API/Web/IM/CLI 读取同一 control plane。
- crash/restart/lease-expiry/duplicate worker/model timeout/invalid output/quarantine/recovery。
- AI Team UI 的真实 roster、task state、blocked/recovery 和渐进脱敏 Trace。

### Out of scope

- 定义/修改 Persona、KnowledgeSnapshot、OperatingGoal、ContentPlan、selected platform、ArtifactProfile、Audit/OwnerDecision、ManualPublishPackage。
- Agent Skill 内容创作规则；只校验 SDD-010 的 SkillLock/contract/digest。
- Action Operator、ActionGrant、平台 API、自动发布、recurring external action。
- 重建或 fork AgentTeams Manager/Worker/Matrix；未证实 gap 前不修改上游 runtime。
- 浏览器录入 Provider Key、云 Secret 管理、multi-provider UI。

### Existing behavior that must not change

- AgentTeams 是 competition path 的真实 collaboration runtime；至少六成员，Producer/Auditor 分离。
- Model Gateway 是唯一 provider egress；Agent/worker 不直接看到 provider key。
- accepted domain output 必须经过现有 schema/role/input/digest validation 才进入 control plane。
- Web/CLI/IM 没有隐藏成功路径，统一读 PostgreSQL state。

## 4. User journey and UI states

1. 管理员在终端运行本地配置命令，TTY 隐藏输入 Provider Key；命令只显示 key fingerprint/配置状态，不回显值。
2. `docker compose` 或正式本地 launcher 启动 PostgreSQL/API/Web/mission-worker/AgentTeams/Model Gateway；readiness 明确区分 `NOT_CONFIGURED | STARTING | READY | DEGRADED | INCOMPATIBLE | UNREACHABLE`。
3. Owner 在 Web 启动已编译 Intent generation；API 只创建 `MissionRun`/jobs，不直接调用模型。Planner output 被产品域校验/保存为 Plan Draft 后 Run 停在 `HUMAN_GATE`；Owner 批准计划触发下一代 Execution Bundle，Runtime 只按新 generation 继续。
4. mission-worker 领取 lease，按 Bundle DAG dispatch；AI Team 页面显示 Leader、五个 domain members、ACK、running、submitted、blocked/failed 和依赖关系。
5. Model Gateway 用绑定 run/task/attempt/phase 的 one-use ticket 调 provider；返回只进入 caller task。
6. schema-valid submission 由 worker 导入为 accepted output ref；invalid submission quarantine。所有任务完成后 Run 进入等待产品 gate 的状态，不由 runtime 宣称业务批准。
7. 任一组件重启时页面显示 `RECOVERING/UNKNOWN`；reconciler 比对 PostgreSQL job/attempt、AgentTeams task和 accepted output，再 resume、retry 或 quarantine。

页面必须展示真实 `runtimeVersion/teamProfileDigest/bundleDigest/runId/taskId/attempt/lastHeartbeat` 和脱敏 Trace。Runtime 不可达时不得生成成功 artifact、fixture fallback 或绿色完成态。

## 5. Domain and API contracts

### Persistent runtime state

- `MissionRun { id, bundleId/digest, runtimeRequirement, state, createdBy, currentGeneration, startedAt, finishedAt?, lastReconciledAt? }`。
- `MissionJob { id, runId, taskContractId, dependencyIds[], state, availableAt, leaseOwner?, leaseTokenHash?, leaseExpiresAt?, attemptCount, acceptedOutputRef? }`。
- `AgentTaskAttempt { id, jobId, attemptNumber, agentRole, runtimeTaskId?, inputDigest, skillLockDigest, schemaRef, state, ackAt?, submittedAt?, outputDigest?, errorCode? }`。
- `RuntimeBinding { runId, runtimeInstanceId, teamProfileVersion/digest, runtimeVersion/digest, state }`。
- append-only `RuntimeEvent { runId, jobId?, attemptId?, type, stableCode, publicPayload, privateEvidenceRef?, occurredAt }`。

Run stable states：`QUEUED | DISPATCHING | RUNNING | HUMAN_GATE | BLOCKED | RECOVERING | SUCCEEDED_RUNTIME | FAILED_RUNTIME | CANCELLED`。`HUMAN_GATE` 只保存当前 generation completion 与下一代未授权状态；Runtime 不理解计划或批准语义。`SUCCEEDED_RUNTIME` 只表示所有 TaskContract 有 accepted outputs；不等于 Audit PASS、Owner approved、published 或业务成功。

Job/Attempt transitions 使用数据库事务、unique `(runId, taskContractId, generation)`、lease compare-and-swap 和 accepted output digest constraint。相同 submission/task/input digest 只能接受一次；后到 duplicate 记录为 reconciliation event。

### Worker and gateway protocol

- Worker poll → acquire bounded lease → heartbeat → ensure runtime binding → create/dispatch task → wait/consume ACK/Submit → validate envelope/digests → persist accepted/quarantine → release/advance dependencies。
- lease expiry 后另一 worker 可 reclaim，但必须先 reconcile runtimeTaskId 和 accepted output；不能盲目再发。
- Model ticket 绑定 `runId/taskId/attemptId/phase/model/policyDigest/expiry/nonce`，一次使用；重试必须新 attempt/ticket。
- provider response 中 finish reason、usage、provider request ID 只以脱敏 evidence 保存；raw secret/header 不记录。

### API, readiness and migrations

- `POST /api/mission-runs`（exact Bundle digest）、`GET /api/mission-runs/:id`、`POST /api/mission-runs/:id/cancel|retry-blocked`
- `GET /api/mission-runs/:id/team`、`GET /api/mission-runs/:id/events`（SSE 可为 read projection，不是状态真源）
- `GET /api/runtime/readiness`；Secret 配置只返回 `configured/fingerprint/updatedAt`，没有 set-key API。
- worker private endpoints 必须 service-authenticated；AgentTeams submit envelope 绑定 task/attempt nonce。

迁移建立 runs/jobs/attempts/bindings/events/leases 和 unique/index/foreign-key constraints；不得把 AgentTeams 内部 DB 当业务真源。错误码包括 `RUNTIME_NOT_CONFIGURED`、`RUNTIME_VERSION_INCOMPATIBLE`、`RUNTIME_UNREACHABLE`、`JOB_LEASE_LOST`、`RUNTIME_TASK_UNKNOWN`、`TASK_ACK_TIMEOUT`、`TASK_SUBMIT_TIMEOUT`、`MODEL_PROVIDER_FAILED`、`MODEL_TICKET_REPLAYED`、`SUBMISSION_SCHEMA_INVALID`、`SUBMISSION_INPUT_MISMATCH`、`DUPLICATE_SUBMISSION`、`RECOVERY_REVIEW_REQUIRED`。

## 6. AgentTeams and Skills

- 固定 `AgentTeams v1.2.0`（实现前以 lock/source manifest 再核 exact tag/commit/digest）与已验证 team profile；license Apache-2.0。
- exactly six members：Presence Mission Leader、Claim Steward、Market & Account Planner、Founder Producer、Product Producer、Independent Auditor。
- Leader 只能 orchestrate、派发、检查 protocol 和推进依赖；任何领域 artifact submission 由 Leader 发出均 quarantine。
- Producer 不能调用 Auditor Skill；Auditor 不能调用 producer expression Skill；所有 Skill 来自 Bundle SkillLock。
- Agent workspace 是短期执行缓存，不保存 business truth；任务 input 只有最小 RoleContext projection/digests。
- accepted task output 通过 repository adapter 交还对应产品域；Runtime 只理解 envelope/schema ref，不复制 X/XHS 领域逻辑。
- Provider/model 是可替换 `ModelGateway` adapter；首个 dogfood 使用 DeepSeek，但不在 domain object 中持久化 Secret。

## 7. Dependencies and reuse decision

| 组件 | 决定 | 版本/来源/许可证 | 调用/Secret/替换边界 |
|---|---|---|---|
| AgentTeams | `INTEGRATE` | 目标 v1.2.0；实现前固定 tag/commit/image digest；Apache-2.0 | compose network + task protocol；不 fork；`AgentRuntime` 接口可替换 |
| M2 live task/gateway protocol | `INTEGRATE` | accepted commit / Apache-2.0 | 复用 ACK/Submit、one-use ticket、import validators |
| mission-worker | `BUILD` | 本仓 Apache-2.0 | PG job/lease/reconciler；不拥有产品 schema |
| DeepSeek adapter | `INTEGRATE` | 官方 HTTPS API；terms/source 在 register | Secret 仅 Model Gateway；通过 gateway interface 替换 |
| OS keychain | `POC-GATED` | 平台能力，license N/A | 首版可用 0600 + Compose Secret；不能成为跨平台必需依赖 |
| host cron/node-cron | `LATER-REPLACE` | 不采用 | PostgreSQL job/lease 是真源 |

不得复制 AgentTeams 源码或重建 Manager/Worker/Matrix；若发现 gap，先提交最小可复现证据和 bounded upstream/contribution decision。

## 8. Failure, recovery, and rollback

- 未配置 Secret、runtime digest 不符或 team profile incompatible：Run 保持 `BLOCKED`，没有 mock fallback。
- AgentTeams/runtime 创建 task 后 worker crash：lease reclaim 先按 runtimeTaskId/attempt reconcile；存在 submission 则导入/隔离，不盲目重发。
- PG commit 后 ACK 丢失、Submit 重复、ticket replay、provider timeout/429/5xx、invalid finish reason 均有稳定 state/retry policy；只有可证明无 accepted output 才新 attempt。
- schema/input/role/skill digest mismatch quarantine 并要求 review；不会自动修补 submission。
- Runtime 返回 unknown：Run `RECOVERING`，超过 bounded reconciliation 进入 `RECOVERY_REVIEW_REQUIRED`，不宣称失败或成功。
- 取消只阻止新 dispatch 并记录 event；已发 provider 请求按 reconciliation 处理，不能删除历史。
- rollback：停止 mission-worker/runtime dispatch，保留 PG/Blob append-only state；应用版本回退后可 read-only。新 migration 不做 destructive down；恢复使用验收报告中的 exact backup digest。

## 9. Acceptance criteria

- [ ] terminal 命令隐藏录入 DeepSeek key，只输出 fingerprint/configured；浏览器/API schema 无 Secret set/read 字段。
- [ ] 固定 runtime/profile/digest 启动并报告 READY；version mismatch 显式 INCOMPATIBLE。
- [ ] 一个真实 Bundle 通过 exactly six AgentTeams members 执行，Leader 无领域输出，两个 Producer/Auditor 分离。
- [ ] AI Team UI 状态来自 PG run/job/attempt/event，与 CLI/API 读取一致。
- [ ] `mission-worker` 使用 lease/heartbeat/idempotency；双 worker 不重复 accepted output。
- [ ] 分别 kill worker、AgentTeams、Model Gateway、API 后可恢复，run/task IDs 和 accepted output digest 不被盲目复制。
- [ ] runtime down、model timeout/invalid key、invalid submission、duplicate/replayed ticket 均 fail closed，无 fixture success。
- [ ] Secret 不出现在 browser network、API/PG dump、Git diff、process args、logs、prompt、trace、evidence/package。
- [ ] `SUCCEEDED_RUNTIME` 不自动改变 Audit/OwnerDecision/Publish/Business 状态。
- [ ] machine evidence 包含 runtime/image/profile digests、real AgentTeams task transcript、fault matrix、reconciliation ledger 和 secret scan。

## 10. Test plan

- Unit/schema：run/job/attempt transitions、lease CAS、ticket claims/replay、envelope/digest validators、public event redaction。
- PostgreSQL integration：migration、double worker、lease expiry、idempotency、accepted output uniqueness、restart。
- Runtime controlled-real：固定 AgentTeams profile，六角色 ACK/Submit，Leader/domain boundary，producer/auditor separation。
- Model adapter：controlled fake CI；DeepSeek real canary/manual evidence必须明确 `REAL_PROVIDER`，失败不 fallback。
- Fault injection：kill before/after dispatch、ACK、submit、PG commit；runtime unknown；gateway timeout/429/5xx；duplicate submission。
- Web/API E2E：readiness、start/cancel/retry-blocked、AI Team live state、SSE reconnect、zh-CN/en。
- Security：TTY no-echo、file mode、Compose secret scope、process/env/log/trace/DB/browser scan、expired/replayed ticket。
- Compatibility/license：AgentTeams exact version/source/digest/NOTICE；Bundle v2 compatibility matrix。

## 11. Evidence and claims

验收证据：RunManifest、exact commits/images/runtime/team/Skill digests、real DeepSeek/AgentTeams sanitized transcript、Task ACK/Submit/accepted output refs、fault/recovery ledger、restart screenshots、secret scan、test commands/results 和 Owner decision。

通过后可声明：固定版本六成员 AgentTeams 能由常驻 mission-worker 从 PostgreSQL Bundle 执行，并在故障/重启后无重复接受地恢复。不得声明内容已获 Owner 认可、已发布、带来增长/线索/营收、生产就绪或 AgentTeams 替代业务真源。

## 12. Delivery plan

1. 0.5 天：固定 AgentTeams/runtime/profile/license/digest 与 Bundle compatibility；冻结 state/error matrix。
2. 1 天：PG migrations、worker poll/lease/heartbeat/dispatch/import/reconciler 和 integration tests。
3. 0.5 天：terminal broker/compose readiness、AI Team/API projection、Secret tests。
4. 0.5–1 天：real canary、fault injection、restart/rollback、Owner UAT、中文验收报告。

Critical path：SDD-009 Bundle + SDD-010 output contracts 冻结 → runtime persistence → secret/gateway → recovery/live UAT。`M5-08` 首次实现前才可 `IN_PROGRESS`；Owner UAT 前最多 `EVIDENCE_READY`。

## 13. Alternatives and decision log

- 拒绝把知识/Goal/Artifact schema放入 runtime：会造成数据库、前端和 Agent 多真源。
- 拒绝一次性 UAT script 作为产品路径：无法恢复、不可持续，UI 也没有同一 state。
- 拒绝 in-memory queue/host cron：重启丢状态且难以去重；使用 PG job/lease。
- 拒绝浏览器/API 输入 Provider Key：扩大 Secret 暴露面；使用 terminal-only broker。
- 拒绝 runtime down 时 fixture/mock success：证据不可区分且违反 fail-closed。
- 拒绝重建 AgentTeams；只有 verified gap 和 bounded contribution decision 才重开。

## 14. Owner-participated acceptance

Prerequisites：accepted SDD-009/010 contracts、public-safe A梦 Bundle、Docker、终端和有效 DeepSeek key；不得录入真实客户资料。

1. 在终端运行配置命令，输入 key，确认不回显，只显示 fingerprint。
2. 启动 stack，Web 确认 Runtime READY、exact version/digest 与六成员 roster。
3. 启动 Mission，观察 ACK/running/submitted、两个 Producer 和独立 Auditor 的渐进 Trace。
4. 运行中停止 mission-worker，重启后确认恢复同一 run，accepted output 不重复。
5. 再停止 AgentTeams/Model Gateway，确认 `RECOVERING/BLOCKED`；恢复后继续或明确要求 review，无 mock success。
6. 对照 API/CLI/Web 的 run/task IDs/digests；运行 secret scan。

Expected：真实 AgentTeams 产生 schema-valid outputs，状态和恢复可见。Failure signs：key 出现在页面/log、Leader 写内容、Auditor=Producer、重启重复产物、runtime down 仍成功。Owner 返回 sanitized screenshots/video、RunManifest、run/task/digest 和 PASS/FAIL；cleanup 停 stack并删除临时 secret file，保留 PG evidence，key rotation由 Owner执行。

## 15. Task closeout

- 中文验收报告：`docs/reports/acceptance/SDD-007-ACCEPTANCE.md`。
- Proposed module：`M5-08`；当前只有 spec `SPEC_READY`。
- 下游：SDD-011 fresh install/upgrade/full dogfood/recording gate。
- Closeout 必须报告 Worktree/Branch/Commit、changed files、migrations、runtime/version/license、tests、real canary、fault evidence、UAT、rollback、proposed state、blockers 和 STATUS_HANDOFF；Goal 最后完成。
