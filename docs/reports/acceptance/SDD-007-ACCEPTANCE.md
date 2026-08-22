# SDD-007 验收报告｜常驻 AgentTeams Runtime、Secret Broker 与恢复

> SDD：`SDD-007-PERSISTENT-AGENTTEAMS-RUNTIME`
>
> 模块：`M5-08`（canonical 已由 Coordinator 置为 `IN_PROGRESS`；本报告不修改 canonical 状态）
>
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-007-persistent-agentteams-runtime`
>
> Branch / Authorized base：`codex/sdd-007-persistent-agentteams-runtime` / `2b5673d0c408060034297328cd2522f4d9578ad1`
>
> Runtime evidence source HEAD：`PENDING_NEW_CLEAN_SOURCE_GATE`（旧 `129501744bd8f5e6c023fc49613d6221143d9d43` 证据已因本轮 runtime/Compose source 变化失效）
>
> Final evidence-report commit / Draft PR：由最终 `STATUS_HANDOFF` 固定
>
> 报告状态：`EVIDENCE_READY_CANDIDATE / OWNER_UAT_PENDING / REAL_PROVIDER_PENDING`
>
> Owner UAT / Coordinator decision：`PENDING`
>
> 生成日期：2026-08-22

## 一、交付结果

本实现把 SDD-009/010 冻结的 `MissionIntentBundle` / `MissionExecutionBundle` 接到 PostgreSQL 权威控制面和真实 AgentTeams v1.2.0 六成员协议。API 只创建/读取控制面，常驻 `mission-worker` 通过 lease 领取任务，宿主 supervisor 作为唯一有 Docker 权限的窄适配器，在被分派的 exact-role Worker 容器内完成 Model Gateway `/generate` 请求、ACK、Submit 和 check。Web/API/CLI 读取同一 PostgreSQL run/job/attempt/event，不存在中央生成后冒充成员或 runtime down 时的 fixture 成功路径。

工程证据达到以下边界：

- 固定官方 AgentTeams v1.2.0 tag 对应 commit `793db242257a569d911b1aa59c1cd554af78511f`、source tar SHA-256 `a4a9d66fabc49e1d08246d9b8b65d2b67742b71b2b43d3dfc0d27e8861f0770c`、Apache-2.0，以及 controller/manager/worker 的 immutable image ID / RepoDigest。readiness 读取实际 `docker inspect` 结果并输出 expected vs actual；常量不能自证 READY。
- controlled-real verifier 已改为只走 production `PersistentMissionWorker.tick`；五个领域成员必须各自从 exact-role Worker 容器发出 Gateway HTTP，Leader provider call 为 0。Gateway 将容器内 `socket.gethostname()` 与 actor header 同 signed request body、`docker inspect .Config.Hostname` 和 pinned binding 核对，只持久 public-safe hostname digest；不依赖 Docker Desktop 可能代理为 loopback 的 `remoteAddress`。最终 observation 按 DAG `assigned_to` 并受 binding role allowlist 约束，从各自 exact Worker store 聚合 6 个 submitted digest，不以 Leader store 代替成员结果。门禁会在 submit→stage 与 finalize→completion confirmation 之间各注入一次 crash，创建新 worker、等待旧 lease 过期，再通过 exact submission observation / completion outbox 收敛。旧 source evidence 不作为最终背书。
- migration `000014` 建立 run/job/attempt/binding/event、heartbeat、ticket、staging batch/item 等权威表。fresh PostgreSQL 覆盖 acquire 后 fenced heartbeat、双 worker lease CAS、ACK/no-intent 单赢家恢复、过期/retry/stale lease ticket fencing、并发 one-use、durable submission intent、跨域 staging 原子提交、completion outbox，以及 confirmation 前不释放后继/终态的 crash recovery。
- Secret 仅从 TTY 隐藏输入进入 `0700` secret root 下的 `0600` regular file/Compose Secret；symlink、unsafe mode 和失败后临时文件残留均被拒绝或补偿。supervisor 使用隔离 `HOME/DOCKER_CONFIG`，不继承宿主 HOME、Shell、云凭证或 provider-key 环境变量。
- readiness 是 PostgreSQL、Model Gateway、mission-worker heartbeat、actual pinned AgentTeams identity/profile 四路合取。controlled fake 且 heartbeat/identity 齐全时最高为 `DEGRADED`；heartbeat 缺失/过期为 `UNREACHABLE`，AI Team projection 也不能以旧 run/binding 冒充 READY。

本报告不声明 `ACCEPTED`。Owner 浏览器/故障恢复 UAT 与真实 DeepSeek Canary 均为 `PENDING`，因此提议最高状态是 `EVIDENCE_READY`。真实外部平台动作数固定为 0。

## 二、交付范围

| 范围 | 已实现 / 明确边界 |
|---|---|
| Runtime domain | versioned run/job/attempt/binding/event、稳定状态与错误码、ETag、Idempotency-Key、lease digest、closed output schema registry。Runtime 不重定义 Persona/Knowledge/Goal/Plan/Artifact/Audit/OwnerDecision。 |
| PostgreSQL authority | migration `000014`、唯一约束、row lock/CAS、heartbeat、append-only event、ticket one-use、staging batch/item、产品 authority 同事务 materialization。 |
| AgentTeams | upstream v1.2.0 controller + manager + exact six Workers；Leader orchestration-only；两个 Producer/Auditor 分离；真实 ACK/Submit/check。没有 fork 或重建 Manager/Worker/Matrix。 |
| Worker-origin model | supervisor 固定 `docker inspect/exec` allowlist；`/generate` 从 assigned exact-role Worker 容器发出；同一 Worker 完成 submit/check round-trip。Web/API/Gateway 无 Docker socket 或 Docker 权限。 |
| Model Gateway | ticket 签名绑定 owner/run/job/task/attempt/attemptNumber/runtimeTask/runtimeActor/phase/model/inputDigest/requestDigest/policy/system/outputSchema/expiry/nonce/workerIdDigest/leaseTokenDigest；issue/consume 均核对 PostgreSQL 当前 lease lineage。 |
| Output authority | 版本化 closed schemas 与 domain parser 共用；未知/额外字段在 provider/authority 前 fail closed；staged candidate 在 finalize 前对产品域不可见。Audit `createdAt` 不接受模型字段，权威时间仅来自可信 worker clock，并以该时间执行 profile expiry 与 canonical binding。 |
| Recovery | acquire 后立即 fenced heartbeat；外部操作有 hard timeout 与 TERM→KILL。ACK 后、intent 前 crash 由同一 attempt 的新 lease 单赢家领取并返回 `envelope:null`，从幂等 ACK 继续。Model 输出在 AgentTeams submit 前写入 immutable submission intent；submit→stage crash 后 observe exact runtime payload/digest，缺失时只重放同一 payload，不再调用 provider。`STAGED` 仅走专用 recovery。finalize 原子提交产品写与 runtime ACCEPTED；durable completion outbox 随后幂等完成 AgentTeams typed internal completion。只有 exact confirmation 事务提交后才释放依赖或写 run 终态。 |
| API/UI | create/read/team/events/readiness；cancel/retry 需要 Idempotency-Key 和 ETag/If-Match；approved knowledge + team authority 已加载时，即使 legacy campaign 为 null，真实 `/ai-team` 仍可见；未批准知识或 team load 失败则 fail closed。AI Team 数据与 combined readiness 来自 PG 四路权威，Token 未观测时为 `null / NO_RUNTIME_OBSERVATION`。 |
| Secret/launcher | terminal-only secret CLI；strict file safety；Compose secret；non-root host UID/GID launcher；固定 loopback control gateway；隔离 supervisor HOME/DOCKER_CONFIG；固定容器和命令面。 |
| 不在范围 | OAuth、账号连接、图片生成、自动发布、ActionGrant/Action Operator、recurring external action、云 Secret 管理、生产级本地主机隔离。 |

## 三、实现证据

### 3.1 Immutable runtime identity

| 身份 | Expected | Actual 验证方式 |
|---|---|---|
| AgentTeams source | tag `v1.2.0` → commit `793db242257a569d911b1aa59c1cd554af78511f` | 下载官方 source tar，校验 SHA-256 `a4a9d66fabc49e1d08246d9b8b65d2b67742b71b2b43d3dfc0d27e8861f0770c` 和 Apache-2.0 LICENSE。 |
| controller | `sha256:c0de550018e51b36138a5990b1e8095eacc9d44cc7cbdb36a697785ba02c9be4` | readiness 对 `agentteams-controller` 执行只读 inspect，返回 actual image ID/RepoDigests 后比较。 |
| manager | `sha256:29429e47118f859191fa133f8d617434019c0f03221b405474be7e467bad87b4` | readiness 对 `agentteams-manager` 执行只读 inspect，逐项比较。 |
| six workers | `sha256:dcdd9103535cfac247267e0f69661820c801396d58e2c8e0c14eefd40b63b7bc` | 对 exact six fixed container names 全部 inspect；任一不同即 `INCOMPATIBLE`。 |
| Team profile | `lumiclaw-presence-six-role-v2@2.0.0` / `7e010640242fe141568239facad73be5a3e2f40314b50bcd1d871818df741ef2` | 实际 workers/team phase、runtime、model、Matrix user、Leader/成员集合和 profile digest 全部比较。 |

已知上游限制：v1.2.0 embedded image 内 `agt version` 输出 `dev`。因此 CLI 字符串只能作为观察值，不能证明版本；本实现使用 official tag commit + source tar digest + 三类 OCI identity + topology/profile 的可复核等价身份。错误 image ID、RepoDigest、profile 或成员映射测试均不能 READY。

### 3.2 PostgreSQL、fencing 与跨域原子性

- `packages/db/migrations/000014_persistent_agentteams_runtime.cjs`：fresh up；有 runtime authority 时 down fail closed；空库 up/down 可回滚。
- `apps/api/src/persistent-runtime-postgres.test.ts`：真实 `CONTENT_PLAN` staging 在 finalize 前 plan authority/head/idempotency 均为 0/不变；多 item materialization 中途 constraint failure 整体回滚；并发恢复后恰好一个 plan/head/output、一个 accepted event，batch `COMMITTED`、attempt/job `ACCEPTED`，provider/driver 不重跑。ACK/no-intent 过期后普通 acquire 为 0、submission recovery 并发仅一个 `envelope:null` 单赢家且不新建 attempt。completion 首次失败/lease 过期时第二 worker 不能领取 downstream、run 保持 `RUNNING`；重启重试并写 exact confirmation 后才单次释放依赖或进入 `HUMAN_GATE/SUCCEEDED_RUNTIME`。
- `apps/model-gateway/src/postgres-fencing.test.ts`：经 `buildModelGateway + PostgresModelGatewayTicketRepository + provider spy` 从 HTTP 边界验证 stale worker digest、旧 lease token digest、expired lease、retry/new attempt 与 task/actor mismatch 时 providerCalls=0；同 ticket 并发仅 providerCalls=1。
- cancel/retry 对 Idempotency-Key 和 ETag/If-Match 做 replay/concurrency；stale ETag 返回 HTTP 412、stable body code `RUN_VERSION_CONFLICT` 和 current ETag。
- worker 对抗测试确认 lease 领取后第一项外部操作前已有 heartbeat；慢 dispatch/ACK 不被第二 worker reclaim；外部进程 hard timeout 后 TERM→KILL、heartbeat 在 `finally` 停止，随后 lease 可由 recovery worker 接管；旧 lease 在 bind/ticket/provider/submit 前被 fence。ACK/no-intent 恢复会重新执行幂等 ACK，并仅签一次 ticket/调用一次 provider/写一次 intent。
- submission intent 与 accepted completion 都是 durable PG lineage：submit 成功后、stage 前 crash 通过 `observeSubmission` 恢复 exact digest，provider 不重跑；finalize 后、complete 前 crash 或 complete timeout 通过 outbox 重试同一 task，PG accepted/product rows 不回滚、不重复，且 confirmation 前 downstream 与 run 成功终态均不可见。

### 3.3 Secret、supervisor 与安全边界

- `scripts/persistent-runtime-secret-cli.mjs`：TTY no-echo、fingerprint-only、root `0700`、file `0600`、`lstat`/realpath containment/`O_NOFOLLOW`、regular-file/dev+ino 检查；拒绝末级 root/file symlink 和 unsafe mode；macOS `/tmp -> /private/tmp` 的祖先规范化不会误报。
- `atomicSecret` 的 write/assert/rename 在 `try/finally` 中仅 unlink 本次精确 temp path；forced rename failure 测试确认无含 Secret 的 temp residue。
- `scripts/run-persistent-runtime-supervisor.mjs` 只继承 `PATH/LANG/LC_ALL/TMPDIR`，不继承 `HOME/SHELL/DOCKER_CONFIG/OPENAI_API_KEY/ANTHROPIC_API_KEY/DEEPSEEK_API_KEY/AWS_*`。它创建 repo 内 `.runtime/sdd007/supervisor-home` 与 `docker-config`，两者 `0700`。
- `scripts/run-persistent-runtime-compose.mjs` 从 Node `process.getuid/getgid` 解析 exact non-root host identity，只允许固定 fake/deepseek 的 up/status/down 命令面；Model Gateway 以该 numeric UID/GID 运行，从而在 Linux 读取 host-owned `0600` Compose Secret，不放宽到 `0644`、不以 root 运行。root/缺失 POSIX identity/wrong UID 均 fail closed；provider Key 环境变量会在启动 Docker 前被拒绝，ambient AWS credentials 不传入子进程。
- control gateway 只允许 `http://127.0.0.1:<允许的高位端口>`；Worker 使用固定同端口 `host.docker.internal`。恶意 URL 在 fetch 前被拒绝，bootstrap header 不外发。
- Compose 的 Web/API/Model Gateway 都不挂 `docker.sock`；只有宿主 supervisor 具有本地 Docker 权限，命令和 exact container names 固定，无用户可控任意 `docker exec`。Compose verifier 的失败 evidence 收集经 Secret 值与 credential-shaped pattern 双重脱敏的 Gateway/migrate/API 日志，避免 Linux 启动失败只剩外层 `compose exit 1`。

### 3.4 UI、可访问性与回归

- `apps/web/src/components/features/team-feature.tsx` 展示 PG 六成员、jobs、attempts、events、heartbeat、runtime/profile/bundle/run/task/digest；Token 固定未伪造，accepted count 仅来自 PG observation。
- zh-CN/en message parity 为 980 keys；默认中文和英文 Storybook runtime/unreachable stories均构建。
- Web 自动化保留 axe serious/critical 0、键盘 tab/focus trap/Escape/focus restore、AI Team tab Arrow/Home/End 合同、reduced-motion 与 desktop gate；SDD-008/009/010 API、PostgreSQL、UI 与构建回归保持绿色。Owner 的真实浏览器运行状态确认仍为 `PENDING`。
- ProductionWorkspace 路由测试使用 approved knowledge、真实六成员 projection、`campaign=null`，确认 `/ai-team` 在 campaign guard 前渲染；未批准知识与 team authority load failure 均不显示成员。API/UI 测试确认停止或过期 mission-worker heartbeat 后 combined readiness 为 `UNREACHABLE`，旧 PG binding 不能保留 READY。

### 3.5 机器证据与 SHA-256

| Evidence | 内容 | SHA-256 |
|---|---|---|
| `.evidence/sdd-007/postgres.json` | fresh PG、lease heartbeat/CAS、ACK/no-intent recovery、ticket fencing、durable intent、staged atomic recovery、completion-gated dependency/run terminal state、ETag/idempotency | `PENDING_FINAL_RERUN_SHA256` |
| `.evidence/sdd-007/compose.json` | controlled-fake missing-heartbeat `UNREACHABLE`、Web/API/CLI parity、Gateway/API/PostgreSQL restart、Secret/Docker scope、exact cleanup | `PENDING_FINAL_RERUN_SHA256` |
| `.evidence/sdd-007/browser/browser-verification.json` | Chromium zh-CN/en、axe、keyboard、1024 desktop/800 desktop gate、无 console error | `PENDING_FINAL_RERUN_SHA256` |
| `.evidence/sdd-007/agentteams-persistent-driver.json` | new clean source HEAD、actual vs expected identity、production worker path、Leader 0 call、submit→stage 与 completion crash recovery | `PENDING_NEW_CLEAN_SOURCE_GATE_SHA256` |
| `.evidence/sdd-002/agentteams-real-runtime.json` | 同一 new clean source HEAD、official installer、source/license/image identity、真实 runtime lifecycle 与 exact cleanup | `PENDING_NEW_CLEAN_SOURCE_GATE_SHA256` |
| 本报告 | 18 条二元 AC、Owner UAT、限制、Rollback | 在最终 `STATUS_HANDOFF` 固定 |

这些 `.evidence/` 文件是 ignored local/public-safe 机器证据，由 CI artifact 或 handoff digest 引用，不把私有 transcript 或 Secret 提交到 Git。

## 四、自动化验证

| 精确命令 | 结果 |
|---|---|
| `npm run lint` | `PASS`，0 error / 0 warning。 |
| `npm run typecheck` | `PASS`，全部 workspace。 |
| `npx vitest run apps/web/src/components/production-workspace.test.ts apps/api/src/runtime-readiness.test.ts apps/mission-worker/src/readiness.test.ts apps/mission-worker/src/worker.test.ts apps/mission-worker/src/output-authority.test.ts packages/domain/src/runtime-output-schemas.test.ts packages/runtime-agentteams/src/persistent-driver.test.ts scripts/verify-sdd007-agentteams-driver.test.ts --configLoader=runner` | `PASS`，8 files / 31 tests；真实无 campaign AI Team、missing/stale heartbeat、DB-down health、立即 heartbeat/lease fencing、hard timeout cleanup、ACK/no-intent 单次 provider、durable submit/completion recovery、Leader 0 call、trusted audit clock 与 real-gate source/crash合同。 |
| `npx vitest run scripts/persistent-runtime-secret-cli.test.ts scripts/run-persistent-runtime-supervisor.test.ts scripts/run-persistent-runtime-compose.test.ts scripts/mission-worker-health-contract.test.ts apps/web/src/components/production-workspace.test.ts apps/api/src/knowledge-onboarding-api.test.ts apps/api/src/goal-plan-api.test.ts --configLoader=runner` | `PASS`，7 files / 24 tests；symlink/mode/temp cleanup、isolated HOME/DOCKER_CONFIG、credential env/恶意 URL、host UID/GID/wrong UID、legacy/new health、首开 team projection、source-delete stale 负测。 |
| `npx vitest run scripts/persistent-runtime-cli.test.ts --configLoader=runner` | `PASS`，1 file / 3 tests；只读 exact loopback API、PG run/task/digests、无 Secret/Token 伪造。 |
| `npx vitest run apps/api/src/persistent-runtime-postgres.test.ts apps/api/src/runtime-mutation-api.test.ts apps/model-gateway/src/server.test.ts apps/mission-worker/src/worker.test.ts packages/mission-compiler/src/persistent-runtime.test.ts scripts/persistent-runtime-secret-cli.test.ts scripts/run-persistent-runtime-supervisor.test.ts --configLoader=runner` | `PASS`（无 PG env 时 PG suite 按合同 skip；fresh PG 由下一项强制执行）。 |
| `SDD007_POSTGRES_ADMIN_URL=<fresh-scoped-postgres-17.10-admin-url> npm run verify:sdd007:postgres` | `PASS`；随机 fresh authority/gateway/rollback DB，ACK/no-intent 与 completion-confirmation 对抗通过，结束强制 drop；PostgreSQL 17.10。 |
| `SDD007_COMPOSE_NO_BUILD=1 npm run verify:sdd007:compose` | `PASS`；独立 project fresh startup；因该场景不启动 supervisor/mission-worker，controlled fake 必须 `UNREACHABLE / MISSION_WORKER_HEARTBEAT_MISSING` 而非 READY；Web/API/CLI 同 PG，Gateway/API/PostgreSQL stop/restart，host UID/GID `0600` Secret read、Secret 不进 API/log/PG dump，Docker socket=false，external action=0，project/volume/temp Secret cleanup PASS。 |
| `npm run storybook:build && npm run verify:sdd007:browser` | `PASS`；Chromium zh-CN/en、14 项 runtime/blocked/Token/Trace/keyboard/desktop 断言、axe serious/critical 0、console error 0、3 张截图。 |
| `npm run verify:sdd007:agentteams-real` | `PENDING_NEW_CLEAN_SOURCE_GATE`；必须从本轮 source commit 的 clean HEAD 执行，且内外层 evidence HEAD 一致；验证 production worker path、五次 exact-role Worker-origin Gateway call、Leader 0 call、submit→stage 与 finalize→completion 两次 crash/restart recovery 及 exact cleanup。旧 `12950174…` 证据失效。 |
| `SDD008_SKIP_BUILD=1 npm run verify:sdd008:compose` | `PASS`；23 browser checks / 6 screenshots，18 Compose checks；fresh/legacy migration、restart、concurrency、Blob/source-delete/history/rollback，zh-CN/en 与 axe。 |
| `SDD009_SKIP_BUILD=1 npm run verify:sdd009:compose` | `PASS`；30 browser checks / 8 screenshots，22 Compose checks；fresh PG regression、S1/S2 draft/supersession outbox、same-Mission replan、append-only、业务 read recovery、idempotency/concurrency。 |
| `SDD010_SKIP_BUILD=1 npm run verify:sdd010:compose` | `PASS`；22 browser checks / 8 screenshots，17 Compose checks；Artifact/Audit/OwnerDecision/Package authority、restart、append-only、no published success，重新生成明确要求新 MissionRun。 |
| `npm run check:messages` | `PASS`，zh-CN/en 980 keys。 |
| `npm test` | `PASS`，63 passed / 4 skipped files；501 passed / 4 skipped tests。 |
| `npm run check:secrets && npm run check:compose && npm run check:sdd007-runtime-manifest` | `PASS`；Secret、Docker socket/port/secret scope、pinned manifests。 |
| `npm run check:report:sdd007` | `PASS`，18 条 AC 与必需章节/术语。 |
| `npm run verify` | `PASS`，从头执行 static、63 passed / 4 skipped files、501 passed / 4 skipped tests、980 i18n keys、47 status modules、18 条 SDD-007 AC、558-file Secret scan、Compose/runtime manifests、711-component SBOM、production build与 Storybook safety；未从失败步骤续跑。真实 AgentTeams 证据仍单独受 clean committed source 门禁。 |

## 五、验收标准结果

| AC | 二元结果 | 证据与边界 |
|---|---|---|
| AC-01 | `PASS` | terminal-only configure 隐藏输入，只输出 configured/fingerprint；浏览器/API 无 Secret set/read 字段。 |
| AC-02 | `PASS` | actual inspect 同时核对 controller、manager、exact six workers image ID/RepoDigest、source/profile/topology；任一错误为 `INCOMPATIBLE`。 |
| AC-03 | `PENDING_FINAL_GATE` | verifier 已改为 production `PersistentMissionWorker.tick`；clean source 后必须由 exact six members 完成 ACK/Submit/check，Leader provider call=0，两个 Producer 与 Auditor actor 分离。 |
| AC-04 | `PENDING_FINAL_GATE` | clean-source real gate 必须证明 provider HTTP 从 assigned exact-role Worker 容器固定 `docker exec` 发出；容器内 hostname/actor 与 inspect + signed body + pinned binding 一致，同一 Worker submit/check，最终 6 个 digest 也从各自 binding-allowlisted Worker store 观测，mission-worker direct provider call=0。 |
| AC-05 | `PASS` | AI Team Web/API/CLI 同读 PostgreSQL；六成员、job/attempt/event/readiness/digests 可见；Token 为 null + `NO_RUNTIME_OBSERVATION`。 |
| AC-06 | `PASS` | acquire 后立即 fenced heartbeat；driver hard timeout TERM→KILL 并在 finally 停止 heartbeat；普通 acquire 排除已 dispatch/submitted 路径；fresh PG 双 worker与旧 lease不能重复 bind/provider/submit/accepted output。ACK/no-intent 只由 submission recovery 单赢家接管同一 attempt，worker 仅一次 provider call。 |
| AC-07 | `PASS` | external submit 前持久 immutable output intent；submit→stage crash 通过 exact observe 恢复且 provider 不重跑。staged candidate 对产品 authority/head/idempotency 不可见，产品写与 runtime ACCEPTED 同事务；accepted 后 completion outbox 可跨 crash/timeout 幂等确认，confirmation 前不释放 downstream 或 run 成功终态。 |
| AC-08 | `PASS` | ticket 全量绑定 lineage/request/policy/schema/current lease identity；stale owner/token、expired/retry/task/actor mismatch providerCalls=0，并发 one-use providerCalls=1。 |
| AC-09 | `PASS` | versioned closed output registry 与 domain parser 一致；未知/额外字段在 provider/authority 前 fail closed；模型不能提供 Audit `createdAt`，trusted clock 参与 canonical digest 与 profile expiry，backdate/expired profile 稳定拒绝。 |
| AC-10 | `PASS` | readiness 为 PG + Gateway + fresh heartbeat + actual pinned identity 四路合取；controlled fake 且其余三路正常时最高 `DEGRADED`，missing/stale heartbeat 为 `UNREACHABLE`；AI Team projection 不能以旧 binding 维持 READY。 |
| AC-11 | `PASS` | cancel/retry 要求 Idempotency-Key + If-Match；并发/replay/stale ETag 负测，412 body code 与 current ETag 稳定。 |
| AC-12 | `PASS` | worker/runtime/gateway unavailable、hung driver timeout、lost lease、invalid output、ticket replay/expiry 全部 blocked/quarantine/recovering；Leader production path 为确定性 orchestration receipt，不签 ticket、不调用 provider，无 verifier-only 假绿。 |
| AC-13 | `PASS` | TTY/file/Compose secret、symlink/O_NOFOLLOW/mode/temp cleanup；Secret 不进入 Web/API/PG/Git/log/prompt/trace/evidence。 |
| AC-14 | `PASS` | supervisor strict env、隔离 HOME/DOCKER_CONFIG、fixed loopback gateway/fixed containers；Web/API/Gateway 无 Docker 权限/socket。 |
| AC-15 | `PASS` | Runtime Skill aggregate 按 bundle.skillLocks 原顺序去重 subset，最多 12；拒绝越界，不修改冻结 SDD-009 类型。 |
| AC-16 | `PASS` | `SUCCEEDED_RUNTIME`/accepted output 不改变 Audit、OwnerDecision、Publish 或 Business state；真实外部动作=0。 |
| AC-17 | `PASS` | `campaign=null` 的真实 ProductionWorkspace `/ai-team` 在 approved knowledge + loaded team 时可见，未批准/team load failure fail closed；zh-CN/en、axe/keyboard/focus/desktop gate 与 SDD-008/009/010 回归绿色。 |
| AC-18 | `PASS` | migration、runtime/source/image/profile/Skill、PG recovery/fencing、secret scan、license、known gaps、Owner UAT 和 Rollback 均进入报告/机器证据；Owner decision 仍 `PENDING`。 |

## 六、Owner 参与验收

Owner UAT 为 `PENDING`，因此 Coordinator 最多可决定 `EVIDENCE_READY`。Prerequisites：

- 使用本报告 exact Worktree/Branch/交付 commit；Node.js 24.16.0、npm 11.13.0、Docker Desktop；
- 只使用 public-safe Bundle，不得录入真实客户资料；
- upstream official v1.2.0 已按 frozen manifest provision controller、manager 和 exact six role Workers；Compose alone 不会创建它们；
- real-provider 路径需要 Owner 自己持有的有效 DeepSeek key，只在 TTY 输入；不要把 Secret 发送到聊天、仓库、`.env`、shell history、issue、截图或日志。

编号步骤：

1. 在 Worktree 执行 `npm ci && npm run verify`。预期全部门禁绿色；任何 lint/typecheck/test/report/secret/compose/build 失败即停止。
2. controlled-fake 工程预检执行 `npm run runtime:secret:prepare-fake`；真实 DeepSeek UAT 改执行 `npm run runtime:secret:configure`。预期不回显值，只显示 configured/fingerprint；发现完整 key 即失败并立即 rotate。
3. 执行 `npm run build`，再按 provider 选择 `npm run runtime:compose:fake` 或 `npm run runtime:compose:deepseek`，并执行 `npm run runtime:compose:status`（DeepSeek 使用 `runtime:compose:status:deepseek`）。预期 PostgreSQL/migrate/Gateway/API/Web healthy；Gateway container user 等于 launcher 解析的非 root host UID/GID。仅 Compose 后若有人声称 AgentTeams/mission-worker 已运行即失败。
4. 确认 exact six upstream Worker + controller + manager 已运行，然后在独立前台终端执行 `npm run runtime:supervisor`。它必须使用 repo 内 isolated HOME/DOCKER_CONFIG，不能读取宿主登录态。
5. 在第三个终端执行 `npm run runtime:secret:status`、`npm run runtime:status`、`curl --fail http://127.0.0.1:4100/api/v1/runtime/readiness` 和 `curl --fail http://127.0.0.1:4401/health`。读取 CLI 只允许 exact loopback API origin，输出 PG 权威 run/task/digests 且无 Secret。controlled fake 预期 `DEGRADED`；real provider 只有四路全部通过才可 `READY`。错误 digest/profile、missing heartbeat、`INCOMPATIBLE/UNREACHABLE` 都是失败。
6. 打开 <http://127.0.0.1:3100> 和 `/en`，进入 AI Team；用键盘 Tab 与方向/Home/End 切换页签。预期六角色、run/task/attempt/heartbeat/digest、渐进 Trace 来自 PG；中英文完整，无 serious/critical axe 问题；小于 1024px 出现 desktop gate。
7. 启动一个 public-safe Mission，观察 ACK/running/submitted/accepted。预期 Leader 只编排，两个 Producer 与 Auditor 是不同 actor，Gateway call 从 assigned Worker 发出；Token 未观测保持“未观测”。
8. 运行中停止 supervisor，再启动同一命令；随后分别短暂停 AgentTeams 与 Model Gateway。预期同一 run/task/revision 恢复或进入明确 `RECOVERING/BLOCKED`，不重复 provider、artifact/head/accepted event，不出现 fixture 成功。
9. 对照 Web/API/CLI 的 run/task/attempt/digest 与 `.evidence/sdd-007/*.json`，执行 `npm run check:secrets`。任何 ID 不一致、Secret/Authorization header、raw provider body 或 duplicate product row 都是失败。
10. Owner 返回 public-safe sanitized 截图/录屏、readiness body、RunManifest、run/task/output digests、故障恢复观察、secret scan 结果以及二元 `PASS` 或 `FAIL`。不要返回 key、raw prompt、客户资料或 private provider transcript。

停止/cleanup：

1. 先在 supervisor 终端按 Ctrl-C，阻止新 dispatch；
2. controlled fake 执行 `npm run runtime:compose:stop`；
3. DeepSeek overlay 执行 `npm run runtime:compose:stop:deepseek`；
4. 保留 PostgreSQL/Blob append-only evidence 和 sanitized manifest；Secret 删除/rotate 只由 Owner 在备份证据后执行。验证器的临时 AgentTeams 容器只能由其 exact-name cleanup 删除。

## 七、ChatGPT Pro 双代理记录

本恢复任务未授权或使用 ChatGPT Pro 双代理，没有外部工程师补丁、凭证或私有材料进入 Worktree。实现与证据由 Codex Executor 在指定分支完成，Coordinator 独立复核。若未来使用 ChatGPT Pro，必须按项目双代理协议在隔离范围应用并重新 source review、secret scan 与全门禁。

## 八、失败、限制与非声明

Known limitations：

1. `agt version` 在 v1.2.0 embedded image 内报告 `dev`；身份依赖 official tag commit/source tar SHA-256 + OCI image IDs/RepoDigests + profile/topology，不把 CLI 字符串当版本证明。
2. AgentTeams v1.2.0 有 typed ACK/Submit/check，但没有 public accept action。PG materialization commit 后，适配器使用 bounded typed internal task-state primitive 标记 runtime completion；这是已记录的上游 gap，不是产品 authority，也不修改上游。
3. persistent overlay 继承 base Compose 的 PostgreSQL trust auth，但 HostPort 仅绑定 loopback。这只覆盖单用户本机 competition boundary；不声称抵抗同机恶意进程、其他本地用户或生产多租户攻击。
4. supervisor 是本地 privileged adapter；Docker 权限未进入 Web/API/Gateway，也无 docker.sock mount。当前固定 inspect/exec allowlist 不是远程或多用户 sandbox。
5. 产品 compose 不 provision AgentTeams，也不自动启动 host supervisor；必须严格按 prepare → compose → exact upstream topology → supervisor → status → stop/cleanup 顺序。一次性 real verifier 会 cleanup，不是常驻 launcher。
6. controlled-real 只证明真实 AgentTeams 成员协议和 Worker-origin HTTP，provider 是明确标注的 controlled fake；真实 DeepSeek、Owner fault UAT 仍 `PENDING`。
7. 本 SDD 不实现 OAuth、自动发布、图片生成、ActionGrant/Operator 或外部平台动作；external action count=0。
8. 没有客户 UAT、业务增长、线索、营收、生产就绪或法律合规保证。Runtime `SUCCEEDED_RUNTIME` 只表示全部 TaskContract output 已由 PG 接受且对应 AgentTeams completion confirmation 已提交。
9. Worker-origin hostname/actor challenge 是 verifier 控制下 exact `docker exec`、container inspect identity、ticket/body/actor 合取的工程证据，不是敌对 host 安全证明；拥有宿主 Docker authority 的 supervisor/进程理论上可伪造 header。`remoteAddress` 仅记录 Docker transport classification。

## 九、回滚与恢复

Rollback 原则是停止写入、保留证据、forward-fix：

1. Ctrl-C 停止 supervisor，确认 mission-worker heartbeat 过期，不再领取新 lease；
2. 用第六节的 exact Compose project/overlay `down`，不使用全局容器/volume 删除命令；
3. 在变更或应用回退前执行 `pg_dump --format=custom --no-owner --file=<OWNER_CONTROLLED_PATH>/sdd007-runtime.backup <DATABASE_URL>`，再对备份计算 `shasum -a 256` 并记录到私有 Owner evidence；URL/Secret 不进入报告；
4. migration `000014` 在存在 runtime authority 数据时 down 会以 `SDD007_DOWN_BLOCKED_EXPORT_RUNTIME_EVIDENCE_FIRST` fail closed。旧应用只读保留新表；禁止 destructive down 删除 runtime/product authority；
5. lease expiry 后新 worker 先按现有 runtimeTaskId/accepted output reconcile；`STAGED` 从同一 batch finalize，不重跑模型、不重建 revision；
6. 若 identity/profile mismatch，保持 `INCOMPATIBLE/BLOCKED`，恢复 exact pinned image/profile 后再运行；不得改常量绕过；
7. 若怀疑 Secret 暴露，先停 Gateway/supervisor，由 Owner rotate provider key，再清理 exact secret file；保留 sanitized PG/Blob evidence，不提交 private dump。

## 十、执行任务状态交接

| 字段 | 值 |
|---|---|
| Worktree | `/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-007-persistent-agentteams-runtime` |
| Branch | `codex/sdd-007-persistent-agentteams-runtime` |
| Authorized base | `2b5673d0c408060034297328cd2522f4d9578ad1` |
| Full HEAD / Draft PR | 最终提交、push、Draft PR 后由结构化 `STATUS_HANDOFF` 填报 |
| Runtime evidence source HEAD | `PENDING_NEW_CLEAN_SOURCE_GATE`（旧证据明确失效） |
| Migration | `000014_persistent_agentteams_runtime.cjs` |
| Runtime/source/license | AgentTeams v1.2.0 / `793db242257a569d911b1aa59c1cd554af78511f` / source tar SHA-256 `a4a9…0770c` / Apache-2.0 |
| Provider evidence | controlled fake `ENGINEERING_VERIFIED`；real DeepSeek `PENDING` |
| External actions | 0 |
| Owner UAT | `PENDING` |
| Proposed state | `M5-08 EVIDENCE_READY`，不得由 Executor 改 canonical，不得 `ACCEPTED` |
| Next gate | Coordinator 独立复核 PR/证据；Owner 完成 real-provider + recovery + browser 二元 UAT |

交付文件清单、最终测试结果、证据 digests、full HEAD、PR URL、security/license/limits/rollback 将在 push 后以完整 `STATUS_HANDOFF` 主动回传 Coordinator task `019fcafe-556c-7001-aa09-f0f45c334f21`。在该回传成功前 Executor Goal 不 complete。

## 十一、Coordinator 验收决定

`PENDING`。Coordinator 应独立确认：

- branch/base/worktree 与 changed files 无越界，canonical progress 文件未改；
- fresh PostgreSQL、ticket fencing、staged materialization exactly-once、ETag/idempotency；
- actual-vs-expected AgentTeams identity、真实六成员 protocol 和 Worker-origin HTTP；
- Secret/supervisor/Compose/Docker/PostgreSQL trust 边界；
- zh-CN/en、axe、keyboard、desktop gate 与 SDD-008/009/010 回归；
- final `npm run verify` 从头绿色、Draft PR 为 draft、Owner UAT/real DeepSeek 仍诚实标为 `PENDING`。

只有 Owner 返回第六节二元 `PASS` 且 Coordinator 完成独立复核后，canonical 状态才可考虑 `ACCEPTED`；本 Executor 不作该决定。
