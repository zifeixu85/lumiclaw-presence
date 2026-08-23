# SDD-012 小红书受治理媒体资产集成验收报告

- SDD：`SDD-012-XHS-MEDIA-ARTIFACT-INTEGRATION`
- Objective：完整实现并工程验证小红书受治理媒体资产集成，完成中文验收报告、commit、push、Draft PR 与结构化 STATUS_HANDOFF
- Worktree：Coordinator 分配的 SDD-012 唯一 public-source worktree；本报告不记录本机绝对路径
- Branch：`codex/sdd-012-xhs-media-artifact-integration`
- Exact authorized base：`d3f48331629a3a1e567b0ae4347c16d4bc90f16b`
- Proposed module state：`M5-11 = EVIDENCE_READY`，等待 Coordinator 独立核验
- Owner UAT：`UAT-00 / UAT-01 / UAT-02 = PENDING`
- 证据分类：`PUBLIC_SAFE_SYNTHETIC`
- 当前可声明成熟度：`IMPLEMENTED`、`ENGINEERING_VERIFIED`

## 一、交付结果

SDD-012 已实现 provider-neutral 媒体合同、首个 EvoLink adapter、显式分离的 `CONTROLLED_FAKE` / `REAL_PROVIDER` 路径、terminal-only Media Secret gate、PostgreSQL 权威 job/task/lease/receipt/lineage、内容寻址本地 Blob、安全下载、固定资产与确定性中文 compositor、XHS ArtifactRevision v4、独立 Audit、Owner exact approval 以及包含真实 final 图片 bytes 的 ManualPublishPackage v4。

Controlled fake 在 fresh PostgreSQL/Blob/双 Worker/生产 Web 中真实生成并验证三张 1080×1440 PNG；raw 与 final 分离，只有 final 可预览、审校、批准和打包。Provider create 在请求前先持久化 intent；未知结果进入 `UNKNOWN_CHARGE_STATE` 且不重试，有 task id 后只 poll/reconcile 同一任务。五个 crash stage、重启、并发、篡改、快照变化和 populated rollback 均 fail closed。

Coordinator 对旧候选 `21726572a0ec6f750d9f32689ad827e55d4c06fe` 的独立复核提出 `REVISE` 后，本轮 bounded repair 已关闭以下权威边界：v4 repository 不再接受 caller payload 作为事实，而是在同一 transaction/row lock 中重读 v3 parent、final/composition/raw/spec、Blob、snapshot、Audit 与 OwnerDecision 并通过 domain constructor 重建 exact canonical 对象；API/worker 不再以 `MEDIA_*` 环境变量自证 Snapshot 已批准；BrandSnapshot 改为由 owner-scoped approved KnowledgeSnapshot + exact Organization profile 确定性派生并持久化；配置 Key 与 live canary PASS receipt 被严格分离；SecretTicket v2 绑定 issuer/current fingerprint/HMAC/time 并持久化 replay；安全下载的真实 TLS 连接固定到已审查地址。

本任务没有收到 Owner media-provider Secret 或预算，真实 Provider canary 与视觉 UAT 未运行，机器文件明确记录 `NOT_RUN_NO_KEY`。未登录、上传、点击或发布到小红书；external actions = 0。不得据此声明 `ACCEPTED`、production-ready、平台/法律合规、外部用户校准或商业结果。

## 二、交付范围

| 层 | 已实现 | 边界 |
|---|---|---|
| Domain | `lumiclaw.media-artifact.v2`、SecretTicket v2、exact XHS profile、submission intent/UNKNOWN、cost/rights、raw/final/composition、snapshot invalidation、v4 revision/audit/decision/package | core stable code 不含 Provider 品牌；Owner `NO_OVERLAY` 才允许 `overlayCopy=null` |
| Provider/Blob | controlled fake、EvoLink async adapter、安全 HTTPS download、逐 hop DNS/SSRF/redirect/MIME/magic/dimension/metadata/digest gate、reviewed-address TLS transport pinning、content-addressed Blob | fake 不产生 Provider evidence；临时/signed URL 不进入资产 authority |
| Compositor/assets | sharp decoder/normalizer、opentype glyph paths、固定 Noto Sans SC、96/120 safe area、72→48px、最多三行、4.5:1 contrast、固定 template/Logo | 不使用 browser canvas、系统/CDN font；emoji/缺字/溢出/低对比度 fail closed |
| PostgreSQL/Worker | migration 15；append-only spec/intent/task/cost/rights/raw/composition/final/v4 governance/package/invalidation；owner Knowledge/Brand authority；canary receipt；ticket replay；lease/staging/recovery | exact composite FKs；repository 重建 canonical truth；UNKNOWN 不重投；populated down 要求 export + Owner decision |
| API/Web | receipt-backed readiness、generation/poll、final-only preview/download、v4 binding、Audit/Owner/package；中文优先、英文 parity 的 production SaaS Shell | 配置 Key 最多 `STARTING`；浏览器无 Key 输入；raw 不可 preview；无 publish-success mutation |
| Package | deterministic ZIP，真实 `image-NN.png`、`media-manifest.json`、`manifest.json`、逐文件 digest | exact PASS + exact APPROVE 才生成；始终 `UNVERIFIED_EXTERNAL_STATE` |
| Evidence/CI | golden、29 项矩阵、fresh PostgreSQL、backup/restore、double-worker Compose、Chromium/keyboard/axe/desktop、license/SBOM/audit、run manifest | public-safe synthetic；real canary 与 Owner visual decision 保持 PENDING |

未修改 canonical `IMPLEMENTATION-STATUS.md`、`ROADMAP.md`、`ARCHITECTURE.md`，未创建第二 worktree，未 merge main，未写入内部资料、Secret、客户资料或私有证据。

## 三、实现证据

权威 public-safe evidence 位于 `docs/reports/evidence/sdd-012/`：

- `media-golden-package.json`：14/14 checks；三张真实 final PNG，manifest digest `6a920bf910b05858b2d5a7e1d7c38abbf0e32420e6a9148e254a4a3c7e1fccc1`，deterministic ZIP SHA-256 `30c5c750e660ecd57680489f6ac4db4cae9ae2ca4e278ae21f70c94c202a8911`；raw/prompt private ref 不入包。
- `postgres-verification.json`：12/12 checks；fresh PostgreSQL direct repository adversarial 覆盖 cross-owner、same Producer auditor、FAIL→APPROVE、cross-revision/cross-audit、nested/canonical tamper、missing/tampered Blob、stale invalidation、真实 Knowledge supersession、source tombstone、canary no/failed/pass/expired/restart 与 ticket restart replay；另有 5 intents/jobs、4 provider tasks、4 raw/final、1 UNKNOWN（task=0、attempt=1）、53 append-only triggers、11 v4 governance exact FKs、五个 frozen stage、populated down 拒绝与 custom-format backup/restore exact。文件 SHA-256 `c22b45d98cb4bdb53c44083fc3f5b17ca019ffdf53884f9f8926ad79b71367e6`。
- `fault-security-compositor-matrix.json`：29/29 tests；provider-neutral/UNKNOWN、SSRF/DNS drift/逐 hop redirect/reviewed-address transport pinning/MIME/magic/Blob、字体/emoji/缺字/溢出/确定性排版、Secret issuer/signature/fingerprint/future-issued/expiry/replay/purpose/symlink/mode、snapshot/tamper/package。文件 SHA-256 `d6104f2236f26ad7b9c6da6a9db9998d3b7cd08b79526294f4af8ede5a1ffb8f`。
- `compose-verification.json`：13/13 checks；fresh Compose、双 Worker、migration 15、restart、真实 ZIP/file digest/PNG magic；将 PostgreSQL `knowledge_snapshots` 的旧 snapshot 改为 `SUPERSEDED` 并批准 domain-canonical digest 可复核的新 snapshot 后，旧链返回 412 `MEDIA_REVISION_STALE` 并追加 invalidation。下载 ZIP SHA-256 `3a5cdb20e4f98d20ace77d8b9eca5e2aeb26977ddeac8e6371c9f3bfd0e66e1e`，文件 SHA-256 `204408dd8dffbd57d5ea91bfc215b0e365b14567361c75169d4fa59a7656dbf5`。
- `browser-verification.json`：19/19 checks、console errors 0、serious/critical axe violations 0、4 张 production screenshot；覆盖 no-Secret/controlled fake 标识、final-only preview、raw/final lineage、费用/版权/snapshot、v4/Audit/approval/package、zh-CN/en、键盘、1024 和 800 desktop gate。另有 Web readiness presentation unit 覆盖 configure-only/failed/expired/persisted PASS。文件 SHA-256 `91532beb664c11b8ee0f7e779c3fe5f9ca1e7868285c5ccd13e2cb3ba4e216d3`。
- `real-provider-canary.json`：`PENDING / NOT_RUN_NO_KEY`；明确未捕获 Secret、signed URL、raw Provider body，external actions = 0。
- `DEPENDENCY-LICENSE-REVIEW.md`：sharp/opentype/font/template/Logo/archive/provider source、许可证、确定性、安全和 NOTICE/SBOM 决策；禁止复制竞品/Postiz/AGPL 源码。
- `run-manifest.json`：11 个公开证据文件、5 个固定资产与 2 个 CI-only inventory/SBOM 文件的 size/SHA-256；当前文件 SHA-256 为 `719594b00e9a47d027d7f2532c04721d7adb26806b44e8a704342a38b1d72bc0`。manifest 明确 `providerEvidence=false`、real canary `NOT_RUN_NO_KEY`、Owner UAT `PENDING`、external actions `0`。

固定资产：Noto Sans SC 2.004/OFL-1.1 SHA-256 `faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`；template SHA-256 `933763ac0008ba01254c44a2f8b73fa654ac3e36a872b02b47fa30ab79e6e5ea`；Logo SHA-256 `377c131af75bc8f108f6ef369f5e957f32f5d77a78238518e0ab178d1ac63c5f`。

## 四、自动化验证

| 命令 | 结果 |
|---|---|
| `npx vitest run packages/domain/src/media-artifact.test.ts packages/providers/src/media-integration.test.ts scripts/media-provider-secret-cli.test.ts apps/api/src/media-readiness-api.test.ts --configLoader=runner` | PASS：4 files / 33 tests；ticket authority、pinned transport、configure/failed/expired/persisted-pass readiness |
| `npx vitest run apps/web/src/lib/media-readiness.test.ts apps/api/src/media-readiness-api.test.ts scripts/media-provider-secret-cli.test.ts --configLoader=runner` | PASS：3 files / 13 tests；Web/API/CLI 区分 configure-only、failed、expired、persisted PASS，Web 不从 configured/mode 推断 Provider evidence |
| `npm run evidence:sdd012:media` | PASS：14 checks；3 张 1080×1440 final PNG；deterministic manifest/ZIP |
| `npm run verify:sdd012:matrices` | PASS：3 files / 29 tests；fault/security/compositor/Secret/tamper matrix |
| `npm run verify:sdd012:postgres` | PASS：12 checks；fresh PostgreSQL 17 direct repository adversarial、五 crash stages、UNKNOWN、canary/replay、snapshot/source freshness、append-only/FK、backup/restore |
| `npm run verify:sdd012:compose` | PASS：13 Compose checks、19 Chromium checks、4 screenshots；真实 KnowledgeSnapshot supersession 后失效状态 412 |
| `npm run verify:sdd012:compatibility` | PASS：10 files / 71 tests；SDD-008/009/010/007 contracts 回归 |
| `DATABASE_URL=<fresh-postgres> npm run verify:shadow-postgres` | PASS：补齐 BlobStore workspace build 后，既有 normalized SHADOW authority/restart/replay/immutable-history gate 全绿 |
| `npm run verify:sdd012:dependencies` | PASS：1,024 packages、716 CycloneDX components、disallowed license 0；lock SHA-256 `f90fef9074b4894bd8495e55ffd00a29d81660edb2fec49885fa8eded36b3f37` |
| `npm audit --omit=dev --audit-level=high --json` | PASS：0 total/high/critical |
| `npm audit --audit-level=high --json` | REVIEWED：3 个既有 Storybook-only dev high，production 0 |
| `npm run lint -- --no-warn-ignored` | PASS：0 error / 0 warning |
| `npm run typecheck` | PASS：14 workspaces |
| `npm test` | PASS：68 passed / 6 skipped files；544 passed / 6 skipped tests；connected tests 已在专项 fresh PostgreSQL/Compose gate 中运行 |
| `npm run check:messages` | PASS：zh-CN/en 1,008 keys parity |
| `npm run check:secrets` | PASS：607 files，无 Secret 命中 |
| `npm run verify` | PASS：static、544 tests、全部报告/Secret/状态/依赖门禁、production Next.js build、Storybook build/browser-safety |

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
| AC-07 | PASS | provider raw 无关键标题；固定本地 compositor 生成 final；raw/final 分别有 Blob/digest/lineage，只有 final 可进入治理与包。 |
| AC-08 | PASS | Brand/Knowledge/template/color/Logo/font/compositor/output profile 进入 digest；Brand 由 approved KnowledgeSnapshot + exact Organization profile 权威派生/持久化，不接受 env/request 自证；真实 supersession/source tombstone 使旧链 stale；NO_OVERLAY 需要 Owner exact decision。 |
| AC-09 | PASS | 同一 raw/spec/assets 的 final/ZIP digest 确定；96/120 safe area、72→48、三行、4.5:1；emoji/缺字/溢出 fail closed，无系统/CDN font。 |
| AC-10 | PASS | generation key 并发、双 Worker最多一个 billable submission；intent 先持久化，未知 POST 不重试；有 task id 仅 poll/reconcile 同一 task。 |
| AC-11 | PASS | `SUBMITTING`、`PROVIDER_PENDING`、`DOWNLOADING`、raw Blob-before-DB、final Blob-before-DB 五阶段恢复或 review，无重复计费/资产丢失。 |
| AC-12 | PASS | repository 在 row lock transaction 内从 v3 parent + authoritative final/composition/raw/spec/Blob/snapshots 重建 ordered MediaSet/child v4；media/composition/snapshot/source 等变化使旧 Audit/Decision/Package stale。 |
| AC-13 | PASS | Producer 与 Independent Auditor identity/权限分离；Auditor 无修改、重生成、排版、批准、package 权限；Leader 不生成媒体领域产物。 |
| AC-14 | PASS | direct repository caller 的 cross-owner、same Producer auditor、FAIL→APPROVE、cross-revision/cross-audit、nested/canonical tamper 均拒绝；只有权威 active PASS + exact Owner APPROVE 可建包。 |
| AC-15 | PASS | repository 重读 v4 revision/audit/decision/final Blob 并确定性重建包；ZIP 含真实 `image-01..03.png`、media manifest、lineage/text manifest；missing/tampered Blob 或 payload/manifest tamper 均拒绝。 |
| AC-16 | PASS | copy/download/open/refresh/restart 仍是 `UNVERIFIED_EXTERNAL_STATE`；OpenAPI 无 auto-upload/click/`PUBLISHED` mutation，external actions=0。 |
| AC-17 | PASS | production PG/API/Blob Shell 展示 actual final preview、raw/final lineage、overlay/snapshot、cost/rights/profile 和治理门禁；zh-CN/en、keyboard/axe/desktop checks 全绿。 |
| AC-18 | PENDING | fresh PG/Blob/Compose controlled fake 门禁 PASS；配置 Key 只得到 `SECRET_CONFIGURED/STARTING`，failed/expired receipt 为 `DEGRADED/STALE`，只有持久化且可复核的未过期 live PASS receipt 才 READY；Owner terminal real Provider UAT 因无 Secret/预算保持 `NOT_RUN_NO_KEY`。 |
| AC-19 | PASS | dependency license/SBOM/audit、source register、provider terms/data/retention、sharp/opentype/font/template/Logo/NOTICE review 完成；不构成法律保证。 |
| AC-20 | PASS | 独立 volume backup/restore exact、v3/v4 lineage保留、populated down 拒绝、旧 contracts 兼容回归通过；旧 app 不得误报 v4 无媒体成功。 |
| AC-21 | PENDING | acceptance、run manifest、fresh-PG direct repository authority、fault/security/compositor、tamper/concurrency/restart、screenshots、`NOT_RUN_NO_KEY` canary 与 structured handoff 已准备；Owner binary UAT 尚未执行。 |

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

1. Independent Auditor 对最终 combined revision 执行 FAIL→修复→PASS；确认 Auditor 无编辑/批准/package 控件。Owner 只批准 exact PASS revision。
2. 下载单图和完整 ZIP；解压核对顺序、`manifest.json`、`media-manifest.json`、`image-specs.json`、三张可打开 final 图，并本地验证 SHA-256/MIME/bytes/1080×1440/composition/snapshot 与 Blob inventory。
3. 打开 allowlisted 小红书官方入口但不登录、不上传、不点击发布；预期仍为 `UNVERIFIED_EXTERNAL_STATE`。重启 API/PG/Web 后 ID/digest/preview/package 不变。
4. 失败信号：FAIL 可批准、Auditor=Producer、包缺真实 bytes/依赖临时 URL、tamper 仍导出、打开页变 PUBLISHED、重启后 task/revision/digest 改变。返回截图、package verifier JSON/SHA-256、revision lineage 与 `UAT-02 PASS|FAIL`。

清理：测试下载包由 Owner 手动删除；移除临时 Media Secret；停止精确 Compose project。PG/Blob evidence 默认保留，删除 volume 必须另行明确授权。

## 七、ChatGPT Pro 双代理记录

本 SDD 未授权、未调用 ChatGPT Pro，未接收外部工程师补丁，也没有使用子代理。所有实现与验证均在唯一授权 worktree 内完成。

## 八、失败、限制与非声明

Known limitations：

- real EvoLink path 已实现但没有 Owner Key/预算，故 live availability、费用、rights receipt 和视觉质量均未验证；`CONTROLLED_FAKE` 绝不冒充 real provider。
- 当前只支持 exact XHS image profile 与 manual publish package；不实现 OAuth、Cookie/DOM automation、上传、点击发布、回读或 `PUBLISHED`。
- Provider rights/terms 只形成版本化 source snapshot 与 Owner review gate；不保证版权、商用权、平台或法律合规。
- pinned asset/font/template/Logo 或 Brand/Knowledge snapshot 更新必须形成新 lineage；不能静默继承旧 Audit/Decision/Package。
- 首期 BrandSnapshot 是持久化的最小权威映射：exact approved KnowledgeSnapshot 内唯一 Organization profile 的 id/digest、组织名、品牌名与真实批准时间；尚未建设独立 Brand 服务。若后续引入独立 Brand authority，必须迁移并使旧 lineage stale，不能把本映射升级为更广泛的品牌治理声明。
- live canary receipt 默认有有效期且绑定当前 Media Secret fingerprint；Key rotation、receipt 过期或 raw/final Blob 不可复核都会降为 `STALE/DEGRADED`。本轮只以 public-safe synthetic fresh-PG receipt 验证状态机，未产生真实 Provider evidence。
- full npm audit 的 3 个 high advisory 位于既有 Storybook-only 开发链，production audit 为 0；兼容修复发布后需独立升级。
- Owner UAT、外部用户校准、真实账号运营与业务结果均 PENDING；无 `EXTERNAL_CALIBRATED`、`BUSINESS_VERIFIED`、production-ready、增长/线索/收入声明。

初始实现验证中发现并关闭：production badge axe 对比度、BrandSnapshot 变化后 package 下载缺少实时失效检查、Compose verifier 把既有 412 contract 误期望为 422、PostgreSQL image bootstrap 短暂 accept 后 restart 的 readiness 竞态、clean CI checkout 缺少 TypeScript project-reference declarations，以及 migration 15 加入后旧 SDD verifier 的 down-count 兼容缺口。

本轮 Coordinator `REVISE` 后发现并关闭：v4 repository 信任 caller JSON/canonical digest、API/worker 以 env 自证 Snapshot `APPROVED`、配置 Secret 即误报 real canary READY、ticket 未绑定 issuer/current fingerprint/signature/issuedAt/restart replay、下载 transport 未固定到已审查 IP，以及 CLI/worker Media Secret fingerprint 公式字段不一致。

## 九、回滚与恢复

Rollback 原则：停止新 media dispatch，保留 append-only jobs/intents/tasks/receipts/raw/final/composition/v4 revisions/audits/decisions/packages/Blob inventory，先导出再 forward-fix；不得删除 Owner 资产或把 v4 误报为无媒体成功。

1. 禁用 media generation/audit/approval/package mutation 与 UI入口，保留 v3/v4 历史只读和 final download（若 snapshot/rights active）。
2. `pg_dump --format=custom` 导出 migration 15 authority，记录表行数、Blob inventory/digests 与 backup SHA-256；在独立 volume 恢复并比较 exact counts/digests。
3. populated migration down 稳定拒绝 `SDD012_DOWN_BLOCKED_EXPORT_MEDIA_AND_OWNER_DECISION_REQUIRED`；只有完成 export 且取得 Owner destructive decision 后才能设计独立清理迁移。
4. authority UPDATE/DELETE 稳定拒绝 `SDD012_APPEND_ONLY_MEDIA_AUTHORITY`；修复只追加 receipt/revision/invalidation。
5. 恢复本分支应用后 worker 只 reconcile 已有 task；`UNKNOWN_CHARGE_STATE` 保持人工 review，绝不通过 create retry“修复”。

## 十、执行任务状态交接

- Goal：实现、专项机器验证与 public acceptance evidence 已完成；在 commit/push/Draft PR/STATUS_HANDOFF 成功前保持 active。
- Worktree/Branch/Base：见报告顶部；唯一 worktree，无 main merge。
- 用户可见结果：中文优先/英文 parity 的受治理媒体面板、真实 final preview、raw/final lineage、费用/版权/snapshot、重新生成影响、Audit/Owner/package gate 与实际图片 ZIP。
- 数据与恢复：migration 15、PostgreSQL append-only authority、Blob staging、双 Worker lease、五阶段恢复、backup/restore、populated down fail closed。
- 安全/隐私：public-safe synthetic；Secret scan PASS；无客户数据、Key、signed URL、private prompt/raw body、真实账号或平台动作。
- 建议成熟度：`M5-11 = EVIDENCE_READY`；Owner UAT 和 Coordinator 独立验证前不得 `ACCEPTED`。
- 下一候选：Owner 执行 UAT-00/01/02；通过后由 Coordinator 决定 M5-11，随后继续 SDD-011 dogfood/install/recording gate。

最终 full HEAD、Draft PR URL、commit、完整 changed files/tests/evidence digest 会由 Executor 在提交推送后主动回传 Coordinator；本报告不写自引用 commit hash。

## 十一、Coordinator 验收决定

`PENDING`。

Coordinator 需要独立核对 base/head、diff、migration/rollback、adapter/Secret boundary、raw/final/composition/snapshot lineage、binary package、所有专项 evidence、full `npm run verify`、Draft PR checks 与 Owner UAT。仅 Coordinator 可同步 canonical progress；Executor 不修改 canonical 状态、不 merge main、不宣称 `ACCEPTED`。
