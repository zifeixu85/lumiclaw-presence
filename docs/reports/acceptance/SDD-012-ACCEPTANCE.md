# SDD-012 小红书受治理媒体资产集成验收报告

- SDD：`SDD-012-XHS-MEDIA-ARTIFACT-INTEGRATION`
- Objective：完成小红书 v4 媒体审校与 SDD-007 exact accepted A5 Auditor task/output receipt 的权威接入
- Worktree：Coordinator 分配的 SDD-012 唯一 public-source worktree；本报告不记录本机绝对路径
- Branch：`codex/sdd-012-a5-auditor-receipt-integration`
- Exact authorized base：`a2c37deaca20b1eb31616bb6eb4f56436dcd3db3`
- Proposed module state：`M5-11 = IN_PROGRESS / BLOCKED_PENDING_SDD_007_AUDITOR_RUNTIME`；不得建议 `EVIDENCE_READY`
- Owner UAT：`UAT-00 / UAT-01 / UAT-02 = PENDING`
- 证据分类：`PUBLIC_SAFE_SYNTHETIC`
- 当前可声明成熟度：媒体链、完整 text/spec/machine-fact A5 input、exact evidence authority、receipt/visual/decision/package plumbing 为 `IMPLEMENTED`、`ENGINEERING_VERIFIED`；真实 DeepSeek/real A5 receipt、Owner 四项视觉确认、Owner APPROVE 与运营 ManualPublishPackage 为 `PENDING/BLOCKED`

## 一、交付结果

SDD-012 已实现 provider-neutral 媒体合同、首个 EvoLink adapter、显式分离的 `CONTROLLED_FAKE` / `REAL_PROVIDER` 路径、terminal-only Media Secret gate、PostgreSQL 权威 job/task/lease/receipt/lineage、内容寻址本地 Blob、安全下载、固定资产与确定性中文 compositor、XHS ArtifactRevision v4，以及明确标注的受控 A5 Audit engineering fixture。

Controlled fake 在 fresh PostgreSQL/Blob/双 Worker/生产 Web 中真实生成并验证三张 1080×1440 PNG；raw 与 final 分离，只有 final 可预览并进入 combined revision。Provider create 在请求前先持久化 intent；未知结果进入 `UNKNOWN_CHARGE_STATE` 且不重试，有 task id 后只 poll/reconcile 同一任务。五个 crash stage、重启、并发、篡改、快照变化和 populated rollback 均 fail closed。

Coordinator 前两轮独立复核提出的 repository/snapshot/readiness/ticket/transport 与 Audit authority 问题均已做 bounded repair。v4 Audit route 现在是 closed schema，禁止客户端提交 `auditorIdentityId` 或 runtime receipt；服务端固定 `controlled-a5-media-auditor` / `A5_INDEPENDENT_AUDITOR`，PostgreSQL payload 与专列持久化 `evidenceMaturity=CONTROLLED_FIXTURE`、`agentTeamsExecuted=false`、`authoritativeForOperations=false`、`runtimeReceiptBinding=null`。任意自选 Auditor、缺 `controlledFixture:true` 或伪造 receipt 均拒绝。

CR2 已把 exact ArtifactRevisionV4 编译成独立 A5 TaskContract，并复用 SDD-007 的 run/job/task/attempt/member binding/materialization/completion authority。外部 API 只能提交 `{ revisionDigest }` 请求审校或读取状态；Auditor identity、PASS/FAIL/ESCALATE、runtime receipt 与 `authoritativeForOperations` 都不能由调用者提交。mission-worker/reconciler 只会在同一 PostgreSQL transaction/row lock 中重读 exact accepted、completion-confirmed 的 A5 output，验证角色、Skill locks、revision/media/final bytes/Brand/Knowledge/policy/profile/schema/canonical digests 与 real-provider/runtime gates 后物化不可变 receipt 和 Audit。

A5 gateway 现在实际收到 Owner 预期公开的完整 title/body/topics/CTA/language/account、cover/ordered image specs 的 purpose/visualBrief/overlay/alt、ordered final media alt/MIME/bytes/dimensions/lineage，以及本地 deterministic machine facts。两阶段 `baseReviewContentDigest → evidence policy → inputProjectionDigest` 消除自引用 hash；正文/visualBrief/overlay/alt 任一改变都会重编译 task。每条 finding 只能引用 contract 冻结的 non-empty、duplicate-free、per-check exact evidence digests；任意 64 位伪 digest、cross-revision/duplicate/empty/unknown check 都拒绝。private prompt、signed URL、Secret、raw provider body、raw bytes/base64 不进入 gateway/evidence/log。

能力边界不再声称 A5 看过 pixels：当前是 `TEXT_ONLY_WITH_SERVER_MACHINE_FACTS`，A5 审正文、visual specs、来源/policy 与 server facts；final pixel视觉质量、隐藏内容、渲染文字/OCR、像素级图文语义明确为 `OWNER_VISUAL_REVIEW_REQUIRED`。Web 在三张可放大 final 旁显示完整 exact revision/media digests、全部 findings/evidence/能力边界；Owner 四项 checkbox 初始均 false，只有全 true 才可 `CONFIRMED`。不全勾可追加 `REJECTED` 及结构化 false flags；刷新/重启后新 draft仍全 false且可修正，只有 current CONFIRMED 锁定 surface。

受控 Audit、controlled model output、工程 fake 与单纯 `SUCCEEDED_RUNTIME` 仍不能解锁 Owner `APPROVE` 或 ManualPublishPackage v4。只有 receipt-backed `AGENTTEAMS_RUNTIME / agentTeamsExecuted=true / authoritativeForOperations=true` 的 exact PASS 加 current exact Owner visual CONFIRMED 才进入 Owner decision/package；FAIL/ESCALATE/REJECTED 保持阻断。visual/decision/package API 均是 closed schema，并强制 `If-Match + Idempotency-Key`；PG advisory transaction lock + `media_idempotency_v2` 提供并发/restart replay，OwnerDecision identity绑定 exact visual id/digest，package每次重读 current visual/decision/receipt。由于本轮没有真实 DeepSeek、真实媒体 Provider 或 Owner real-A5 UAT，机器证据不会制造运营权威包，`authoritativePackageGenerated=false`。

本任务没有收到 Owner media-provider Secret 或预算，真实 Provider canary 与视觉 UAT 未运行，机器文件明确记录 `NOT_RUN_NO_KEY`。未登录、上传、点击或发布到小红书；external actions = 0。不得据此声明 `ACCEPTED`、production-ready、平台/法律合规、外部用户校准或商业结果。

## 二、交付范围

| 层 | 已实现 | 边界 |
|---|---|---|
| Domain | exact A5 media TaskContract；完整 public artifact/spec/machine facts；无环 input binding；per-check evidence allowlist/policy；text-only capability boundary；Owner visual/decision/package exact contracts | caller 不能自报 runtime truth；A5 未查看 pixels；controlled PASS 或缺 visual CONFIRMED 永不满足 operational approval/package |
| Provider/Blob | controlled fake、EvoLink async adapter、安全 HTTPS download、逐 hop DNS/SSRF/redirect/MIME/magic/dimension/metadata/digest gate、reviewed-address TLS transport pinning、content-addressed Blob | fake 不产生 Provider evidence；临时/signed URL 不进入资产 authority |
| Compositor/assets | sharp decoder/normalizer、opentype glyph paths、固定 Noto Sans SC、96/120 safe area、72→48px、最多三行、4.5:1 contrast、固定 template/Logo | 不使用 browser canvas、系统/CDN font；emoji/缺字/溢出/低对比度 fail closed |
| PostgreSQL/Worker | migration 15 + append-only migration 16；AuditRequest/RuntimeReceipt/VisualReview；exact composite FK；authority_sequence current；同 transaction重读 SDD-007与visual/decision/package；advisory/idempotency locks | accepted history不改写；同 timestamp不靠 createdAt猜 current；old/stale/reassigned/leased/unconfirmed/tampered authority fail closed；collision down稳定阻断 |
| API/Web | request/observe-only A5；visual/decision/package closed schema + ETag/idempotency；完整 findings/evidence/capability；四项显式 Owner visual draft/replacement；中文优先、英文 parity | runtime SUCCEEDED不等于 Audit PASS；浏览器不能提交 identity/outcome/receipt/authority；工程 UI 正向夹具不写 PG、不形成 live claim |
| Package | receipt-backed exact PASS + current Owner visual CONFIRMED + exact APPROVE 后 deterministic v4 binary builder；public-safe engineering archive继续验证真实 final bytes | 本轮未产生 authoritative package；真实 UAT 前保持阻断；old visual/decision/package不可复活 |
| Evidence/CI | golden、矩阵、fresh PostgreSQL 20 checks、double-worker Compose 12 checks、Chromium 45 checks/6 screenshots、兼容/全量、license/SBOM/Secret/rollback | `CONTROLLED_ENGINEERING_AUTHORITY_FIXTURE` 只证明 UI请求状态机；real DeepSeek/real A5/Owner binary decision保持 PENDING |

未修改 canonical `IMPLEMENTATION-STATUS.md`、`ROADMAP.md`、`ARCHITECTURE.md`，未创建第二 worktree，未 merge main，未写入内部资料、Secret、客户资料或私有证据。

## 三、实现证据

权威 public-safe evidence 位于 `docs/reports/evidence/sdd-012/`：

- `media-golden-package.json`：16/16 checks；三张真实 final PNG，受控 Audit 为 `CONTROLLED_FIXTURE / agentTeamsExecuted=false / authoritativeForOperations=false`，OwnerDecision digest 为 null，`authoritativePackageGenerated=false`。public-safe engineering manifest digest `ab5f76e04b422d1424dcf3d23c7652d3bffa1efebc19335919c783924299cf02`，deterministic archive SHA-256 `784aa1c1be5d7067fed60a35f30cdb1a0c0274f99abc841fb3cbf1145360d9db`；raw/prompt private ref 不入 archive。文件 SHA-256 `abf934b4adc87693667879c3ec0a4e69ce256ba77e810b625206d8f0656f4cf3`。
- `postgres-verification.json`：20/20 checks；fresh migration 15/16、server-side A5 request、并发/重放 exactly-once、completion-confirmation 前阻断、SDD-007 exact accepted attempt/member binding/Skill/batch/envelope/completion 重读、controlled provider completion 仍不提升、56 append-only triggers、13 v4 lineage FKs、migration 16 exact A5 composite FKs、direct-SQL forged runtime Audit 被 receipt FK 拒绝、same-timestamp/restart `authority_sequence` current、null-visual 多 REJECT stable down blocker、populated down、backup/restore exact。文件 SHA-256 `a0cfd5044d4f01c190c06da7211f139c1540144148c69cc2eb9d3f7e61544df4`。
- `fault-security-compositor-matrix.json`：30/30 tests；provider-neutral/UNKNOWN、SSRF/DNS drift/逐 hop redirect/reviewed-address transport pinning/MIME/magic/Blob、字体/emoji/缺字/溢出/确定性排版、Secret issuer/signature/fingerprint/future-issued/expiry/replay/purpose/symlink/mode、snapshot/tamper/controlled A5 authority。文件 SHA-256 `757879cc789906389ab4f75231d6f64e8d19bf7e9de62e10019d166e457314e1`。
- `compose-verification.json`：12/12 checks；fresh Compose、双 Worker、migration 15/16、restart、真实 final PNG download；持久化 controlled Audit 后 Owner decisions=0、packages=0。真实 KnowledgeSnapshot supersession 后旧链返回 412 `MEDIA_REVISION_STALE` 并追加 invalidation。final 下载 SHA-256 `98461ea3a622aaa3f6a73119ced708c8cb6f20dc03000e7bbf956e8e09561e12`，文件 SHA-256 `97dc2b9274cf37c5c9d0a0bd8e83b3ef20ebbb1fef2eb127fbb03f92a48b3a92`。
- `browser-verification.json`：45/45 checks、console errors 0、serious/critical axe violations 0、6 张 screenshot；production 路径覆盖 arbitrary Auditor/outcome/fake receipt/authority 拒绝、controlled source/`ESCALATE` 与 A5 `WAITING_A5` 分离、Owner/package 禁用、final-only/keyboard/desktop；显式 `CONTROLLED_ENGINEERING_AUTHORITY_FIXTURE` 仅覆盖四项全 false→REJECTED→刷新仍可新 draft→逐项全 true→CONFIRMED→exact decision/package UI 请求，且 `productionAuthorityPersisted=false / authoritativePackageGenerated=false`。文件 SHA-256 `a106928afc119ed38740b69719279dd851bfab3637df6250706df475d11144a9`。
- `real-provider-canary.json`：`PENDING / NOT_RUN_NO_KEY`；明确未捕获 Secret、signed URL、raw Provider body，external actions = 0。
- `DEPENDENCY-LICENSE-REVIEW.md`：sharp/opentype/font/template/Logo/archive/provider source、许可证、确定性、安全和 NOTICE/SBOM 决策；禁止复制竞品/Postiz/AGPL 源码。
- `run-manifest.json`：13 个公开证据文件（含 6 张截图）、5 个固定资产与 2 个 CI-only inventory/SBOM 文件的 size/SHA-256；文件 SHA-256 `b7bd395b444bf311e1cc1578efefec474ff74dc4b73d994315540e5363f20eec`。manifest 明确 `maturity=ENGINEERING_VERIFIED_RECEIPT_PLUMBING_REAL_A5_PENDING`、本次 controlled evidence 中 `agentTeamsAuditExecuted=false`、`authoritativeAuditReceipt=false`、`authoritativePackageGenerated=false`、real canary `NOT_RUN_NO_KEY`、Owner UAT `PENDING`、external actions `0`。

固定资产：Noto Sans SC 2.004/OFL-1.1 SHA-256 `faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`；template SHA-256 `933763ac0008ba01254c44a2f8b73fa654ac3e36a872b02b47fa30ab79e6e5ea`；Logo SHA-256 `377c131af75bc8f108f6ef369f5e957f32f5d77a78238518e0ab178d1ac63c5f`。

## 四、自动化验证

| 命令 | 结果 |
|---|---|
| `npm test -- --run apps/api/src/media-audit-authority-api.test.ts packages/domain/src/media-artifact.test.ts packages/domain/src/media-audit-runtime.test.ts packages/mission-compiler/src/persistent-runtime.test.ts apps/mission-worker/src/worker.test.ts` | PASS：5 files / 39 tests；完整 review input、无环 evidence policy、arbitrary/cross/duplicate evidence、privacy、text-only capability、closed mutation、worker gateway projection 与 exact task identity |
| `npx vitest run packages/domain/src/media-artifact.test.ts packages/providers/src/media-integration.test.ts scripts/media-provider-secret-cli.test.ts apps/api/src/media-readiness-api.test.ts --configLoader=runner` | PASS：4 files / 33 tests；ticket authority、pinned transport、configure/failed/expired/persisted-pass readiness |
| `npx vitest run apps/web/src/lib/media-readiness.test.ts apps/api/src/media-readiness-api.test.ts scripts/media-provider-secret-cli.test.ts --configLoader=runner` | PASS：3 files / 13 tests；Web/API/CLI 区分 configure-only、failed、expired、persisted PASS，Web 不从 configured/mode 推断 Provider evidence |
| `npm run evidence:sdd012:media` | PASS：16 checks；3 张 1080×1440 final PNG；deterministic public-safe engineering archive；`authoritativePackageGenerated=false` |
| `npm run verify:sdd012:matrices` | PASS：30/30 fault/security/compositor/Secret/tamper tests |
| `npm run verify:sdd012:postgres` | PASS：20/20 checks；migration 16、并发/restart idempotency、SDD-007 exact completion authority、visual replacement/current gate、direct SQL FKs/append-only、null-visual 多 REJECT stable down blocker、backup/restore |
| `npm run verify:sdd012:compose` | PASS：12 Compose checks、45 Chromium checks、6 screenshots；production PG decisions/packages=0，工程 UI fixture 覆盖 REJECTED replacement、四项 CONFIRMED、exact headers/decision/package，且不持久化、不提升 public/live claims |
| `npm run verify:sdd012:compatibility` | PASS：10 files / 71 tests；SDD-008/009/010/007 contracts 回归 |
| `SDD007_POSTGRES_ADMIN_URL=<fresh-postgres-17.10> npm run verify:sdd007:postgres` | PASS：migration 16→15→14 populated path 由 14 稳定阻断且无部分移除；empty path 仅移除 16–14 并保留 migration 13 及更早 schema |
| `SDD008_SKIP_BUILD=1 npm run verify:sdd008:compose` | PASS：19 checks、23 Chromium checks/6 screenshots；isolated SDD-008 guard 与 main first-later SDD-009 guard 分别精确验证 |
| `SDD009_SKIP_BUILD=1 npm run verify:sdd009:compose` | PASS：22 checks、30 Chromium checks/8 screenshots；rollback 深度 5 与 legacy authority 兼容 |
| `SDD010_SKIP_BUILD=1 npm run verify:sdd010:compose` | PASS：17 checks、22 Chromium checks/8 screenshots；rollback 深度 4 与 v3 authority 兼容 |
| `DATABASE_URL=<fresh-postgres> npm run verify:shadow-postgres` | PASS：补齐 BlobStore workspace build 后，既有 normalized SHADOW authority/restart/replay/immutable-history gate 全绿 |
| `npm run verify:sdd012:dependencies` | PASS：1,024 packages、716 CycloneDX components、disallowed license 0；lock SHA-256 `f90fef9074b4894bd8495e55ffd00a29d81660edb2fec49885fa8eded36b3f37` |
| `npm audit --omit=dev --audit-level=high --json` | PASS：0 total/high/critical |
| `npm audit --audit-level=high --json` | REVIEWED：3 个既有 Storybook-only dev high，production 0 |
| `npm run lint -- --no-warn-ignored` | PASS：0 error / 0 warning |
| `npm run typecheck` | PASS：14 workspaces |
| `npm test` | PASS：71 passed / 6 skipped files；559 passed / 6 skipped tests；connected tests 已在专项 fresh PostgreSQL/Compose gate 中运行 |
| `npm run check:messages` | PASS：zh-CN/en 1,034 keys parity |
| `npm run check:secrets` | PASS：616 files，无 Secret 命中 |
| `npm run verify` | PASS：lint、14 workspaces typecheck、71 passed/6 skipped test files、559 passed/6 skipped tests、全部报告/Secret/状态/依赖门禁、production Next.js build、Storybook build/browser-safety |

CI 新增 `sdd012-governed-xhs-media` job：exact Chromium、golden/matrix/compatibility、fresh PostgreSQL、double-worker Compose、dependency/SBOM、run manifest 和公开证据上传。远端 Draft PR checks 由 Coordinator/PR 独立核验。

## 五、验收标准结果

| AC | 结果 | 证据与说明 |
|---|---|---|
| AC-01 | PASS | Core contract/stable error/provider-neutral enum 不含 EvoLink；real adapter 与 controlled fake maturity 分离。 |
| AC-02 | PASS | 真实 adapter 已实现但 `real-provider-canary.json` 仍为 `NOT_RUN_NO_KEY`；不会由 class 名推断 live PASS。 |
| AC-03 | PASS | terminal 无回显 gate、0700/0600、symlink/mode、issuer/HMAC/current fingerprint/canonical digest/issuedAt/expiry/purpose/scope 与 PostgreSQL restart replay 测试通过；Model/Media 隔离，Web/API/证据/package 无 Key。 |
| AC-04 | PASS | controlled fake 与 production journey 均产出连续三图、cover=1、非空 alt、exact 1080×1440、PNG、0 < bytes <= 10MiB。 |
| AC-05 | PASS | intent/task/cost/rights/profile/source/prompt policy lineage 持久化；临时 Provider URL 不作为 authority。 |
| AC-06 | PASS | HTTPS/credential/SSRF/private IP/DNS drift/redirect/empty/size/MIME/magic/decoder/dimension/metadata/digest/Blob gate 与 tamper fail closed；actual TLS lookup 固定到逐 hop 已审查地址，保留 hostname/SNI/证书校验。 |
| AC-07 | PASS | provider raw 无关键标题；固定本地 compositor 生成 final；raw/final 分别有 Blob/digest/lineage，只有 final 可进入治理。受控 evidence archive 只收录 final；权威运营包仍被 Audit authority gate 阻止。 |
| AC-08 | PASS | Brand/Knowledge/template/color/Logo/font/compositor/output profile 进入 digest；Brand 由 approved KnowledgeSnapshot + exact Organization profile 权威派生/持久化，不接受 env/request 自证；真实 supersession/source tombstone 使旧链 stale；NO_OVERLAY 需要 Owner exact decision。 |
| AC-09 | PASS | 同一 raw/spec/assets 的 final 与 public-safe engineering archive digest 确定；96/120 safe area、72→48、三行、4.5:1；emoji/缺字/溢出 fail closed，无系统/CDN font。 |
| AC-10 | PASS | generation key 并发、双 Worker最多一个 billable submission；intent 先持久化，未知 POST 不重试；有 task id 仅 poll/reconcile 同一 task。 |
| AC-11 | PASS | `SUBMITTING`、`PROVIDER_PENDING`、`DOWNLOADING`、raw Blob-before-DB、final Blob-before-DB 五阶段恢复或 review，无重复计费/资产丢失。 |
| AC-12 | PASS | repository 在 row lock transaction 内从 v3 parent + authoritative final/composition/raw/spec/Blob/snapshots 重建 ordered MediaSet/child v4；media/composition/snapshot/source 等变化使旧 Audit/Decision/Package stale。 |
| AC-13 | ENGINEERING_VERIFIED | exact ArtifactRevisionV4 编译独立 A5 task；完整公开正文/spec/final machine facts与per-check evidence policy实际进入Gateway；无环 base/final digest；任一内容变化改变task；privacy payload拒绝。API只能request/observe，receipt由SDD-007 PG accepted + completion-confirmed output派生。真实 A5 尚未运行。 |
| AC-14 | ENGINEERING_VERIFIED | repository同transaction/row locks重读attempt/member/Skill/batch/envelope/completion/canary；arbitrary/cross-owner/evidence digest/controlled provider/unconfirmed/tampered/old authority fail closed。text-only runtime不能声称pixel PASS；exact runtime PASS后仍需Owner visual review。 |
| AC-15 | ENGINEERING_VERIFIED / UAT_PENDING | visual/decision/package closed mutation具备ETag/idempotency、并发/restart replay；Owner四项checklist绑定exact revision/media/audit，OwnerDecision identity含visual id/digest；package重读current authority和ordered final bytes。controlled/no-Secret只跑显式工程夹具，未生成运营包。 |
| AC-16 | PASS | copy/download/open/refresh/restart 仍是 `UNVERIFIED_EXTERNAL_STATE`；OpenAPI 无 auto-upload/click/`PUBLISHED` mutation，external actions=0。 |
| AC-17 | PASS | production PG/API/Blob Shell 展示可放大final、完整revision/media digests、全部findings/evidence/capability boundary与受控阻断；Chromium覆盖四项false→REJECTED→刷新后新draft→逐项全true→CONFIRMED→APPROVE/package工程UI请求。工程夹具不写PG、不改变public/live claims；中英/keyboard/axe/desktop全绿。 |
| AC-18 | PENDING | fresh PG/Blob/Compose controlled fake 门禁 PASS；配置 Key 只得到 `SECRET_CONFIGURED/STARTING`，failed/expired receipt 为 `DEGRADED/STALE`，只有持久化且可复核的未过期 live PASS receipt 才 READY；Owner terminal real Provider UAT 因无 Secret/预算保持 `NOT_RUN_NO_KEY`。 |
| AC-19 | PASS | dependency license/SBOM/audit、source register、provider terms/data/retention、sharp/opentype/font/template/Logo/NOTICE review 完成；不构成法律保证。 |
| AC-20 | PASS | 独立 volume backup/restore exact、v3/v4 lineage保留；migration16 rollback显式拒绝null-visual多REJECT collision并保留schema/authority；007/008/009/010/012 legacy down depths校准；同timestamp/restart current由authority_sequence决定。 |
| AC-21 | ENGINEERING_VERIFIED / BLOCKED | CR2 规格、migration 16、fresh-PG receipt authority、API/PG/Web parity、fault/tamper/concurrency/restart、controlled-Audit screenshots、compatibility/license/SBOM/Secret evidence 已准备；real DeepSeek/real A5/真实媒体 Provider、Owner UAT-00/01/02 仍 PENDING，因此 M5-11 不升级。 |

## 六、Owner 参与验收

状态：`UAT-00 / UAT-01 / UAT-02 = PENDING`。Owner 必须在 Coordinator 冻结的 exact Head 上执行，返回每项明确 `PASS|FAIL`；任何 Secret 都只能在交互式 terminal 输入，不得进入聊天、网页、参数、`.env`、截图或报告。

### UAT-00｜无 Secret 与独立 Gate

1. 前置：fresh project-scoped Compose，移除 Media Secret 和 DeepSeek Secret；打开 XHS 媒体面板。预期 Media=`NOT_CONFIGURED`、无 Key 输入框、controlled fake 明示非 Provider evidence。
2. 只配置 DeepSeek gate。预期 Model 可按其合同变化，Media 仍 blocked。清除后只用 `npm run media:secret:configure` 配 Media gate，预期 Media 仅为 `SECRET_CONFIGURED/STARTING`、`providerEvidence=false`，Model 仍 blocked；未执行 live canary 前绝不能 READY。
3. 失败信号：gate 互相变 READY、仅配置 Key 就变 `REAL_PROVIDER_CANARY_READY`、浏览器/API 可读写 Key、无 Key 被记作 real Provider success。返回 readiness 截图、redacted terminal status 与 `UAT-00 PASS|FAIL`。

### UAT-01｜真实 Provider Canary 与视觉决定

1. 前置：public-safe 三图 revision、Owner 自持有效 Key 和批准预算。交互式运行无 Secret 参数的 configure/canary；配置后先确认 `SECRET_CONFIGURED/STARTING`，成功 canary 后才确认显示 fingerprint、持久化 receipt digest、同一 provider task、profile/source/cost/rights、checkedAt/expiry，并变为 `REAL_PROVIDER_CANARY_READY`。
2. Web 选择 real Provider，确认预计 3 个 `n=1` jobs 与 reserved/final/unverified cost；运行中重启 mission-worker，确认继续同一 task，没有重复 task/费用。
3. 逐图核对 final preview、raw/final lineage、1080×1440、顺序、exact 中文 overlay、safe area、字体/缺字/emoji、Logo、品牌色/4.5:1、alt、prompt lineage、Brand/Knowledge、rights/profile/cost；逐图返回 `VISUAL_ACCEPT | RECOMPOSE | REGENERATE | REJECT`。NO_OVERLAY 必须同时核对 exact Owner decision。
4. 对一图 recompose：预期无新 Provider task/费用但有新 final/revision；再 regenerate：预期新 raw/final lineage 且旧 Audit/Decision/Package invalidated。
5. 失败信号：重复计费、signed URL 成为 asset、raw 被批准、视觉/快照变化不失效、Secret 泄漏。返回 redacted canary manifest、task/cost/rights digests、三组 raw/final Blob metadata、restart/concurrency 与 `UAT-01 PASS|FAIL`。

### UAT-02｜独立审校、精确批准与实际包

当前状态：代码接入完成，但 `real DeepSeek + real media Provider + real A5 + Owner decision` 尚未运行，因此 `BLOCKED_PENDING_SDD_007_AUDITOR_RUNTIME`。以下步骤全部只在 terminal 执行；不得把 Secret 放进参数、环境变量、`.env`、shell history、聊天、截图或报告。

1. 在 exact Head 执行 `npm ci`、`npm run verify`、`npm run media:secret:status`、`npm run runtime:secret:status`。预期所有门禁绿色，两个 status 只显示 fingerprint/readiness，不显示 Secret。没有 Owner 自持的有效媒体 Key、DeepSeek Key、预算或 upstream exact six-member AgentTeams 时停止并返回 `UAT-02 BLOCKED_PREREQUISITE`。
2. Owner 分别用 `npm run media:secret:configure` 与 `npm run runtime:secret:configure` 在 TTY 无回显输入 Secret；执行 `npm run build`、`npm run runtime:compose:deepseek`、启动 exact six upstream members/controller/manager，再在独立终端执行 `npm run runtime:supervisor`。第三个终端执行 `npm run runtime:compose:status:deepseek`、`npm run runtime:status` 和 `curl --fail http://127.0.0.1:4100/api/v1/runtime/readiness`；只有 runtime/model/media 三类 receipt 都是当前、未过期、真实 Provider 成熟度时继续。
3. 完成 UAT-01 的真实三图 v4 后，在 shell 设置公开安全标识 `REVISION_ID`、`REVISION_DIGEST`；不得设置任何 Secret。执行：

   ```sh
   curl --fail-with-body --request POST "http://127.0.0.1:4100/api/v1/media-revisions/${REVISION_ID}/audit-requests" \
     --header 'content-type: application/json' \
     --header "if-match: \"media-revision-${REVISION_DIGEST}\"" \
     --header "idempotency-key: owner-uat-a5-${REVISION_ID}" \
     --data "{\"revisionDigest\":\"${REVISION_DIGEST}\"}" \
     --output /tmp/lumiclaw-a5-request.json
   ```

   预期只返回 server-compiled request/run/job/task/contract digests。把 body 加入 `result`、`auditorIdentityId`、`runtimeReceipt` 或 `authoritativeForOperations` 的四次负测必须各自返回 422；不得出现可导入 receipt 或设置 PASS 的 API。
4. 用 `curl --fail http://127.0.0.1:4100/api/v1/media --output /tmp/lumiclaw-media-workspace.json` 轮询；先看到 `WAITING_A5/QUEUED/RUNNING/RECOVERING`，不能因 run=`SUCCEEDED_RUNTIME` 提前出现 Audit PASS。停止并重启 supervisor 一次；预期恢复同一 request/run/job/task，最多一个 accepted attempt/receipt/Audit，不重复调用模型或生成 product row。
5. 完成后用 `jq` 对 request、runtime Audit 与 receipt binding 核对 exact revision/media/snapshot/input/output/contract digests，确认 `auditorRole=A5_INDEPENDENT_AUDITOR`、actual member role 是 `independent-auditor`、maturity 为 `AGENTTEAMS_RUNTIME`、`agentTeamsExecuted=true`、`authoritativeForOperations=true`。任何 controlled provider、旧 attempt、未 completion-confirmed、Leader/Producer actor 或 digest 不一致都必须保持 `BLOCKED` 且没有 runtime Audit。
6. 若 exact result 为 `FAIL` 或 `ESCALATE`，Owner APPROVE、visual CONFIRMED与package必须保持阻断；修复媒体/快照后必须产生新 revision/request digest。若 result 为 `PASS`，先核对 output capability 必须仍是 `TEXT_ONLY_WITH_SERVER_MACHINE_FACTS / pixelInspectionPerformed=false / ownerVisualReviewRequired=true`，并逐条检查8个finding的message与evidenceDigests；任意finding用未知/重复/cross-revision digest或声称像素已审，返回 `UAT-02 FAIL`。
7. 只打开本机 `http://127.0.0.1:3100/zh-CN/publish`（不要打开小红书）。在exact三图可放大预览旁确认页面显示完整revision digest与每张media digest。视觉质量、隐藏内容、渲染文字/OCR、图文语义四项初始必须全部未选且CONFIRMED disabled。先保留至少一项未选并点击REJECTED，刷新页面；预期显示旧REJECTED authority，但一个全false的新PENDING draft仍可编辑。逐张人工核对后分别勾选四项；少一项CONFIRMED仍disabled，四项全true后才可提交。保存后记录：

   ```sh
   curl --fail http://127.0.0.1:4100/api/v1/media --output /tmp/lumiclaw-media-after-visual.json
   export AUDIT_ID="$(jq -r --arg revision "$REVISION_ID" '[.workspace.audits[]|select(.artifactRevisionId==$revision and .evidenceMaturity=="AGENTTEAMS_RUNTIME")][-1].id' /tmp/lumiclaw-media-after-visual.json)"
   export AUDIT_DIGEST="$(jq -r --arg id "$AUDIT_ID" '.workspace.audits[]|select(.id==$id)|.canonicalDigest' /tmp/lumiclaw-media-after-visual.json)"
   export VISUAL_ID="$(jq -r --arg audit "$AUDIT_ID" '[.workspace.visualReviews[]|select(.auditDecisionId==$audit)][-1].id' /tmp/lumiclaw-media-after-visual.json)"
   export VISUAL_DIGEST="$(jq -r --arg id "$VISUAL_ID" '.workspace.visualReviews[]|select(.id==$id)|.canonicalDigest' /tmp/lumiclaw-media-after-visual.json)"
   jq --arg id "$VISUAL_ID" '.workspace.visualReviews[]|select(.id==$id)|{id,artifactRevisionDigest,mediaSetDigest,auditDecisionDigest,result,checklist,reviewedMediaDigests,canonicalDigest}' /tmp/lumiclaw-media-after-visual.json
   ```

   预期current visual=`CONFIRMED`、四项全true、reviewedMediaDigests与ordered final一致；旧REJECTED仍在history但不再是current。若刷新后REJECTED使界面永久锁死、旧false自动变true、或A5 PASS自动生成visual authority，则失败。
8. Owner确实决定APPROVE后，用closed body、exact visual ETag和新idempotency key调用Owner decision；extra `ownerIdentity/runtimeReceipt/authority/createdAt`负测必须422，缺header必须428，wrong ETag必须412：

   ```sh
   curl --fail-with-body --request POST "http://127.0.0.1:4100/api/v1/media-revisions/${REVISION_ID}/owner-decisions" \
     --header 'content-type: application/json' \
     --header "if-match: \"media-visual-review-${VISUAL_DIGEST}\"" \
     --header "idempotency-key: owner-uat-decision-${REVISION_ID}" \
     --data "{\"revisionDigest\":\"${REVISION_DIGEST}\",\"auditDecisionId\":\"${AUDIT_ID}\",\"auditDecisionDigest\":\"${AUDIT_DIGEST}\",\"visualReviewId\":\"${VISUAL_ID}\",\"visualReviewDigest\":\"${VISUAL_DIGEST}\",\"result\":\"APPROVE\"}" \
     --dump-header /tmp/lumiclaw-owner-decision.headers \
     --output /tmp/lumiclaw-owner-decision.json
   export OWNER_DECISION_ID="$(jq -r '.decision.id' /tmp/lumiclaw-owner-decision.json)"
   export OWNER_DECISION_DIGEST="$(jq -r '.decision.canonicalDigest' /tmp/lumiclaw-owner-decision.json)"
   ```

   同key同body重放必须200且`Idempotency-Replayed: true`；同key改body必须409。OwnerDecision必须绑定exact visual id/digest。
9. 以exact decision ETag创建package并重放一次；201 created、200 replay都必须同一id/manifest，PG package/files count保持1套：

   ```sh
   curl --fail-with-body --request POST 'http://127.0.0.1:4100/api/v1/media-publish-packages' \
     --header 'content-type: application/json' \
     --header "if-match: \"media-owner-decision-${OWNER_DECISION_DIGEST}\"" \
     --header "idempotency-key: owner-uat-package-${REVISION_ID}" \
     --data "{\"revisionId\":\"${REVISION_ID}\",\"revisionDigest\":\"${REVISION_DIGEST}\",\"auditDecisionId\":\"${AUDIT_ID}\",\"auditDecisionDigest\":\"${AUDIT_DIGEST}\",\"ownerDecisionId\":\"${OWNER_DECISION_ID}\",\"ownerDecisionDigest\":\"${OWNER_DECISION_DIGEST}\"}" \
     --dump-header /tmp/lumiclaw-package.headers \
     --output /tmp/lumiclaw-package.json
   export PACKAGE_ID="$(jq -r '.package.id' /tmp/lumiclaw-package.json)"
   curl --fail "http://127.0.0.1:4100/api/v1/media-publish-packages/${PACKAGE_ID}/download" --output /tmp/lumiclaw-xhs-v4.zip
   unzip -t /tmp/lumiclaw-xhs-v4.zip
   shasum -a 256 /tmp/lumiclaw-xhs-v4.zip
   ```

   逐项核对title/body/topics、sanitized image specs、ordered final PNG bytes、manifest digests、1080×1440与Blob inventory；篡改或追加replacement visual/decision后旧package必须拒绝读取/下载。
10. 全程不打开、不登录、不上传、不点击小红书，不运行OAuth/DOM automation；预期external actions=`0`、状态仍`UNVERIFIED_EXTERNAL_STATE`。返回sanitized request/run/job/task/attempt/receipt/audit/visual/decision/package digests、package SHA-256、restart观察及`UAT-02 PASS|FAIL`，不返回Secret、raw prompt、Authorization、provider raw body或客户资料。

失败信号：controlled fixture 可批准/打包、请求可自报 Auditor/outcome/receipt、runtime success 自动变 PASS、FAIL/ESCALATE 可批准、Auditor=Leader/Producer、旧 attempt/stale lease 可物化、包缺真实 bytes或依赖临时 URL、tamper 仍导出、出现外部平台动作、重启后 authority digest 改变。

清理：测试下载包由 Owner 手动删除；移除临时 Media Secret；停止精确 Compose project。PG/Blob evidence 默认保留，删除 volume 必须另行明确授权。

## 七、ChatGPT Pro 双代理记录

本 SDD 未授权、未调用 ChatGPT Pro，未接收外部工程师补丁，也没有使用子代理。所有实现与验证均在唯一授权 worktree 内完成。

## 八、失败、限制与非声明

Known limitations：

- real EvoLink path 已实现但没有 Owner Key/预算，故 live availability、费用、rights receipt 和视觉质量均未验证；`CONTROLLED_FAKE` 绝不冒充 real provider。
- 当前只支持 exact XHS image profile、final 单图下载与 public-safe engineering archive。A5 runtime当前是text-only：完整公开正文/spec与server machine facts可审，但真实pixel视觉质量、隐藏内容、渲染文字/OCR、像素图文语义不在A5能力内，必须由Owner四项显式确认。SDD-007 receipt/visual/decision/package plumbing已接入，但real DeepSeek/real A5/Owner binary UAT未执行，故Owner APPROVE与ManualPublishPackage仍为`PENDING/BLOCKED`。不实现OAuth、Cookie/DOM automation、上传、点击发布、回读或`PUBLISHED`。
- Provider rights/terms 只形成版本化 source snapshot 与 Owner review gate；不保证版权、商用权、平台或法律合规。
- pinned asset/font/template/Logo 或 Brand/Knowledge snapshot 更新必须形成新 lineage；不能静默继承旧 Audit/Decision/Package。
- 首期 BrandSnapshot 是持久化的最小权威映射：exact approved KnowledgeSnapshot 内唯一 Organization profile 的 id/digest、组织名、品牌名与真实批准时间；尚未建设独立 Brand 服务。若后续引入独立 Brand authority，必须迁移并使旧 lineage stale，不能把本映射升级为更广泛的品牌治理声明。
- live canary receipt 默认有有效期且绑定当前 Media Secret fingerprint；Key rotation、receipt 过期或 raw/final Blob 不可复核都会降为 `STALE/DEGRADED`。本轮只以 public-safe synthetic fresh-PG receipt 验证状态机，未产生真实 Provider evidence。
- full npm audit 的 3 个 high advisory 位于既有 Storybook-only 开发链，production audit 为 0；兼容修复发布后需独立升级。
- Owner UAT、外部用户校准、真实账号运营与业务结果均 PENDING；无 `EXTERNAL_CALIBRATED`、`BUSINESS_VERIFIED`、production-ready、增长/线索/收入声明。

初始实现验证中发现并关闭：production badge axe 对比度、BrandSnapshot 变化后 package 下载缺少实时失效检查、Compose verifier 把既有 412 contract 误期望为 422、PostgreSQL image bootstrap 短暂 accept 后 restart 的 readiness 竞态、clean CI checkout 缺少 TypeScript project-reference declarations，以及 migration 15 加入后旧 SDD verifier 的 down-count 兼容缺口。

本轮 Coordinator `REVISE` 后发现并关闭：v4 repository 信任 caller JSON/canonical digest、API/worker 以 env 自证 Snapshot `APPROVED`、配置 Secret 即误报 real canary READY、ticket 未绑定 issuer/current fingerprint/signature/issuedAt/restart replay、下载 transport 未固定到已审查 IP，以及 CLI/worker Media Secret fingerprint 公式字段不一致。

Coordinator 第二轮 `REVISE` 后发现并关闭：浏览器/API 可自选 `auditorIdentityId` 与 PASS、Audit 缺少 evidence maturity/runtime receipt authority，以及受控 PASS 可错误解锁 Owner APPROVE/运营包。bounded repair 没有扩入 SDD-007 runtime，而是把真实 A5 Audit 与权威包明确保留为 fail-closed dependency。

本次 CR2 关闭该依赖的代码接缝：新增 exact A5 TaskContract/Skill/input-output schema、migration 16 request/receipt authority、same-transaction SDD-007 control-plane 重读、worker completion reconciler、request-only API、PG 同源中英状态 rail 与 receipt-backed package gate。机器测试刻意只让 controlled provider 走到 completion-confirmed 后仍阻断，没有篡造 real DeepSeek 或 authoritative PASS；因此运营 maturity 和 Owner UAT 保持 PENDING。

本轮后续P0/P1复核继续关闭：A5 digests-only输入、任意64位evidence digest、text-only伪造pixel PASS、Owner visual一键全true、REJECTED后UI永久锁死、OwnerDecision未绑定visual identity、visual/decision/package缺closed schema/ETag/idempotency、workspace以createdAt猜current、migration16 legacy down深度与null-visual多REJECT rollback collision。工程正向浏览器路径使用显式`CONTROLLED_ENGINEERING_AUTHORITY_FIXTURE`，只拦截UI请求并断言body/header/state machine，不写production PG、不生成public/live authority；生产repository正向路径由fresh PG test真实执行。

最终 Compose 复核的第一次启动在执行测试前因 Docker VM `no space left on device` 明确失败；仅清理未使用 build cache 后，重新构建 exact working tree 镜像，并从空 `lumiclaw-sdd012-verify` project 重跑到 12/12 Compose + 45/45 Chromium PASS。该基础设施失败没有被记录为产品 PASS，也不替代后续 exact-HEAD remote CI。

## 九、回滚与恢复

Rollback 原则：停止新 media dispatch，保留 append-only jobs/intents/tasks/receipts/raw/final/composition/v4 revisions/audits/decisions/packages/Blob inventory，先导出再 forward-fix；不得删除 Owner 资产或把 v4 误报为无媒体成功。

1. 禁用 media generation/controlled-audit/approval/package mutation 与 UI入口，保留 v3/v4 历史只读和 final download（若 snapshot/rights active）。当前权威 approval/package 本就处于阻断状态。
2. `pg_dump --format=custom` 导出 migration 15/16 authority，记录 AuditRequest/RuntimeReceipt/Audit/Decision/Package 行数、Blob inventory/digests 与 backup SHA-256；在独立 volume 恢复并比较 exact counts/digests。
3. migration 16 在 request/receipt/runtime Audit/visual authority非空，或同owner/revision存在多条OwnerDecision（包括visual=null REJECT replacement）而无法恢复migration15 one-per invariant时，稳定拒绝`SDD012_A5_RECEIPT_DOWN_BLOCKED_EXPORT_AND_FORWARD_FIX_REQUIRED`并保持schema/authority未部分拆除。migration15原populated-down保护继续存在；007/008/009/010 verifier已按migration16校准rollback深度。只能先导出、停止写入并forward-fix，禁止删除accepted runtime/media history。
4. authority UPDATE/DELETE 稳定拒绝 `SDD012_APPEND_ONLY_MEDIA_AUTHORITY`；修复只追加 receipt/revision/invalidation。
5. 恢复本分支应用后 worker 只 reconcile 已有 task；`UNKNOWN_CHARGE_STATE` 保持人工 review，绝不通过 create retry“修复”。

## 十、执行任务状态交接

- Goal：实现、专项机器验证与 public acceptance evidence 已完成；在 commit/push/Draft PR/STATUS_HANDOFF 成功前保持 active。
- Worktree/Branch/Base：见报告顶部；唯一 worktree，无 main merge。
- 用户可见结果：中文优先/英文parity的受治理媒体面板、三图可放大preview与完整revision/media digests、全部A5 findings/evidence/capability boundary、四项Owner visual draft/replacement，以及清楚显示`CONTROLLED_FIXTURE / AgentTeams=false`阻断状态。
- 数据与恢复：migration15/16、PostgreSQL append-only AuditRequest/RuntimeReceipt/VisualReview authority、authority_sequence current、OwnerDecision visual binding、durable idempotency、SDD-007 accepted history复用、backup/restore与collision down fail closed。
- 安全/隐私：public-safe synthetic；Secret scan PASS；无客户数据、Key、signed URL、private prompt/raw body、真实账号或平台动作。
- 建议成熟度：`M5-11 = IN_PROGRESS / BLOCKED_PENDING_SDD_007_AUDITOR_RUNTIME`；CR2 engineering plumbing 可复核，但不得建议模块 `EVIDENCE_READY` 或 `ACCEPTED`。
- 下一候选：Coordinator 独立复核 CR2 后，由 Owner 按 terminal-only UAT-02 运行 real DeepSeek + real A5 + real media lineage 并作 binary decision。Owner UAT-00/01 和 real-provider/视觉 UAT 也仍 PENDING；在这些边界关闭前不进入 SDD-011。

最终 full HEAD、Draft PR URL、commit、完整 changed files/tests/evidence digest 会由 Executor 在提交推送后主动回传 Coordinator；本报告不写自引用 commit hash。

## 十一、Coordinator 验收决定

`PENDING`。

Coordinator 需要独立核对 base/head、diff、migration/rollback、adapter/Secret boundary、raw/final/composition/snapshot lineage、closed Audit schema、固定 controlled A5 maturity、fixture→approval/package fail-closed、engineering archive 与所有专项 evidence、full `npm run verify`、Draft PR checks。权威 binary package 与 Owner UAT 当前明确 blocked/pending；仅 Coordinator 可同步 canonical progress，Executor 不修改 canonical 状态、不 merge main、不宣称 `EVIDENCE_READY` 或 `ACCEPTED`。
