# SDD-012 — Xiaohongshu Governed Media Artifact Integration

> Status: `SPEC_READY`
> Milestone: `M5 — Runnable product candidate`
> Proposed progress module ID: `M5-11`（待 Coordinator 登记；编号不代表执行顺序，本文不修改 canonical progress）
> Owner: LumiClaw Presence 产品/设计 Owner；technical lead 负责 Provider、Secret、存储与恢复证据
> Goal objective: 将小红书 image specs 变成可下载、可追溯、可独立审校并由 Owner 精确批准的真实图片资产，再进入 SDD-010 人工发布包
> Target evidence maturity: `ENGINEERING_VERIFIED`；真实 Provider Canary 与 Owner UAT 必须单独通过
> Acceptance report: `docs/reports/acceptance/SDD-012-ACCEPTANCE.md`（实施阶段创建）
> Last updated: `2026-08-24`（CR2：SDD-007 A5 receipt authority integration）

## 0. Spec Kit lifecycle record

Constitution、Clarifications、Plan、Checklist、Tasks 与 Analyze 位于 `docs/specs/sdd-012/`。原始媒体切片已按 acceptance report 实施；本轮 CR2 只扩展“SDD-007 exact accepted A5 task/output receipt → v4 authoritative Audit/OwnerDecision/ManualPublishPackage”的有界纵向切片。CR2 的 Clarify/Plan/Analyze 与 binary checklist 已冻结在第 16 节并达到 `SPEC_READY`，随后才允许实施 migration 16、domain/repository/API/UI/worker 和验证；不另建一个大 SDD。

## 1. User problem and outcome

SDD-010 已工程验证 X/小红书完整文案、image specs、独立 Audit、exact OwnerDecision 与 manual package，但小红书包仍只含 `image-specs.json`，明确写着 `generatedMedia=false`。现有 M2 media boundary 也只生成 `1200×630 image/svg+xml` 的 public-safe mock；名为 `EvoLinkMediaProvider` 的类在有 Key 时仍固定返回 `EVOLINK_CANARY_NOT_ENABLED`。因此当前产品没有小红书可预览、可下载、可随包交付的真实图片，不能把 SDD-011 描述为可用 dogfood 闭环。

本 SDD 实施后，Owner 能在同一 production SaaS Shell 和 PostgreSQL Control Plane 中：

```text
exact XHS ArtifactRevision 的 ordered image specs
→ 创建 provider-agnostic MediaGenerationJob
→ terminal-only Media Secret Gate
→ 异步 provider task / polling / restart recovery
→ 临时结果立即下载、解码、规格校验，持久化 provider 原始图 Blob
→ deterministic local compositor 按 exact overlayCopy + approved Brand/Knowledge snapshot 组合
→ 组合图重新校验、摘要并持久化为 authoritative delivery Blob
→ 将 exact ordered MediaSet 物化为新的 immutable XHS ArtifactRevision
→ Independent Auditor 审阅文案 + 实际图片
→ Owner 批准 exact combined revision
→ 下载含真实图片字节与 manifest digest 的 ManualPublishPackage
→ 外部状态仍为 UNVERIFIED_EXTERNAL_STATE
```

SDD-012 是 SDD-011 的硬前置：在本规格实施、真实 Provider Canary 和 Owner UAT 通过前，SDD-011 不得录制或声明完整小红书 dogfood happy path。

## 2. Current state and maturity audit

| 已核范围 | 当前可验证事实 | 不得声称 / 必须补齐 |
|---|---|---|
| `packages/governed-shadow/src/media-provider.ts` | `MediaGenerationProvider.generate()` port、content SHA-256、rights/cost envelope、`UNREVIEWED` 和 no-key 错误存在 | 接口是一次性同步返回；没有异步 task、PG job、lease、poll、timeout/retry/UNKNOWN、Blob 持久化、尺寸/真实 MIME 校验或 ArtifactRevision binding |
| `PublicSafeMockMediaProvider` | 可生成 deterministic synthetic SVG，成熟度明确为 `MOCK_CONFORMANCE` | 输出固定为 `1200×630 image/svg+xml`，不是本规格要求的 3:4 PNG/JPEG/WebP，也不能作为 real-provider 或 Owner visual evidence |
| `EvoLinkMediaProvider` | 类名和 no-key fail-closed placeholder 已实现 | 代码没有 HTTP endpoint/model/task polling/download；有 Key 时仍返回 `EVOLINK_CANARY_NOT_ENABLED`。因此 real adapter maturity 是 `NOT_IMPLEMENTED`，live maturity 是 `NOT_RUN_NO_KEY` |
| `packages/governed-shadow/src/types.ts` | `MediaAsset v1` 有 digest/bytes/provider/maturity/rights/cost/approvalState | 类型只允许 SVG、synthetic rights 和两个 branded provider enum；不能作为新核心 domain 合同，provider 名不得继续进入核心语义 |
| `packages/domain/src/artifact-publish.ts` | XHS v3 有 1–18 个连续 image specs、nullable authorized ref、append-only revision/audit/decision/package 与 no-`PUBLISHED` 合同 | Controlled payload 全部 `authorizedMediaRef=null`；包只含 `image-specs.json`，没有图片 bytes/blob refs；任何图片变化尚不能驱动 exact revision invalidation |
| production Web / browser verifier | 真实 API 页面显示标题、正文、话题、image specs、审校与 package | 页面明确显示“仅规格 · 未生成图片”；Story/fixture 不能替代实际 PG/Blob/provider 状态 |

2026-08-24 对 EvoLink 官方一手资料的核验只支持以下 adapter-specific 事实：图片请求使用 `POST https://api.evolink.ai/v1/images/generations`；Wan2.5 文生图是异步 task，创建响应包含 task id、`status` 和 `usage.credits_reserved`；状态使用 `GET /v1/tasks/{task_id}` 查询；官方页面说明生成图片链接通常仅 24 小时有效。官方条款同时说明其是第三方模型 gateway，且不保证生成内容质量或可用性。来源和 checkedAt 已登记在 `docs/research/SOURCE-AND-ASSET-REGISTER.md`。

这些资料不证明当前仓库 adapter 已实现，也不证明 API 稳定、模型质量、输出权利、实际扣费、商业使用许可或小红书合规。首次实现必须通过 Owner-controlled Canary 重新核验 exact request/response、模型、费用与条款；无法核验的字段保持 `UNVERIFIED`。

## 3. Scope

### In scope

- provider-agnostic `MediaGenerationProvider` port 与独立 provider adapter；品牌名只出现在 adapter/config/source register，不能进入核心 Artifact/Media enum 或 digest 语义；
- `CONTROLLED_FAKE` / CI 与 `REAL_PROVIDER_CANARY` 明确分离；fake 必须产生真实可解码的 3:4 PNG bytes，但永远不能冒充 Provider/Owner 证据；
- terminal-only Media Secret Gate，独立于 DeepSeek Model Secret Gate；
- 小红书首期 actual image profile：exact `1080×1440` px（3:4）、`image/png | image/jpeg | image/webp`、每文件 `bytes > 0 && bytes <= 10 MiB`、连续 ordered position、非空 alt text；`10 MiB` 是 LumiClaw 内部安全/交付上限，不是小红书官方限制，合法优化图可以小于 `1 MiB`；
- 首期 provider 只负责生成无关键文字的背景/插画；deterministic local compositor 负责把 exact `overlayCopy`、approved 品牌模板/颜色/Logo、safe area、字体、字号和对比度规则渲染为最终组合图；provider 原始图和组合图分别持久化并保留 lineage；
- 异步 generation job、provider task、费用/权利 receipt、内容寻址 Blob、下载校验、lineage、idempotency、timeout/retry/UNKNOWN/restart recovery；
- 将 exact media set 绑定为新的 immutable XHS ArtifactRevision；图片、顺序、alt text、source prompt/policy/profile 任一变化都产生新 revision 并使旧 Audit/OwnerDecision/Package 失效；
- combined text + actual media 的 Independent Audit、Owner exact approval 与 SDD-010 ManualPublishPackage v4 extension；
- production Web/API/worker/Compose 中的真实图片预览、状态、费用、权利/来源、影响说明和文件/package 下载；
- fresh PG、browser、Compose、tamper、concurrency、restart、rollback、license/security 与 Owner real-provider Canary/UAT。

### Out of scope

- X 或小红书自动发布、OAuth、Cookie 获取/导入、私有 API、DOM/浏览器自动化上传或点击；
- 移动端 App、移动端布局验收或真实小红书账号登录；
- 图片生成即自动 Audit PASS、Owner approval 或法律/版权/文化合规保证；
- 通用 DAM、视频生成、X 媒体扩展、无限平台/模型/provider 扩展；
- 真实平台 `PUBLISHED` receipt、增长/线索/收入或 external calibration；
- 在本规格任务中实现代码、migration、production UI/API、调用 Provider 或制造运行 evidence。

### Existing behavior that must not change

- PostgreSQL 是业务真源；BlobStore 是内容 bytes 真源；provider task、浏览器缓存、临时 URL 与下载目录都不是第二真源；
- Leader orchestration-only；Producer 与 Auditor 是不同 AgentTeams identity；Auditor 只能 `PASS | FAIL | ESCALATE`，不能改稿、重生成、批准或建包；
- PASS 只是 Owner approval 的必要条件；deterministic package builder 不是 Agent；
- `COPY_TEXT`、`DOWNLOAD_PACKAGE`、`OPEN_OFFICIAL_PUBLISH_PAGE` 仍只产生本地 `EXPORTED` event，不能创建 `PUBLISHED`；
- v3 Artifact/Package 历史 digest 保持可读且不可原地重写；新实际媒体路径使用 versioned v4 contracts。

## 4. User journey and UI states

1. Owner 打开 exact XHS ArtifactRevision。没有 actual media 时，页面显示 ordered specs、`MEDIA_NOT_GENERATED`、预计 job 数和“生成会创建新 Revision、旧审校/批准/包将失效”的影响说明。
2. 未配置 Media Secret 时，真实生成按钮保持 blocked 并显示终端命令；浏览器没有 Key 输入框。`CONTROLLED_FAKE` 仅在显式工程模式可选并始终带 `CONTROLLED_FAKE / NOT_PROVIDER_EVIDENCE` 标记。
3. Owner 在终端为 `MEDIA_PROVIDER` gate 无回显配置 Secret。页面只显示 configured、fingerprint、updatedAt、capability profile/version/checkedAt/expiry，不显示值。
4. Owner 提交 exact revision 的 media generation。每个 image spec position 创建一个 `n=1` durable job；UI 显示 queued/submitting/provider pending/processing/downloading/verifying、reserved cost、last checked 和安全取消说明。
5. Worker 从同一 provider task 恢复，结果出现后立即流式下载到 project-scoped staging，校验 HTTPS/redirect/大小/magic/MIME/exact 1080×1440 解码尺寸，对 exact downloaded bytes 计算 digest 并原子写入 access-controlled 内容寻址 Blob，作为不可变 provider 原始图。metadata/EXIF 出现不允许字段时 raw asset 进入 quarantine；不得静默改写后仍冒充 exact provider 原图。
6. 系统用 pinned compositor/profile/font assets，把 exact `overlayCopy` 渲染到原始图；模板、品牌色与 Logo 必须来自 exact approved Brand/Knowledge snapshot。排版、缺字、emoji、对比度或 snapshot binding 不合格时 fail closed。组合输出再次解码/hash/Blob 持久化；只有这个最终 digest（或显式 `NO_OVERLAY` 的最终 lineage record）能进入 Audit/approval/package。
7. 所有 positions ready 后，Owner 预览完整 carousel、逐图查看 exact prompt/composition/provenance/rights/cost/alt text，并选择“绑定此组图片”。系统创建 child XHS ArtifactRevision v4，而不是修改原 revision。
8. Independent Auditor 对 combined revision 审校。权威 Audit 必须来自 SDD-007 exact accepted A5 Auditor task/output receipt；浏览器不能提交 Auditor identity 或自报 AgentTeams receipt。受控工程 fixture 只能记录 `evidenceMaturity=CONTROLLED_FIXTURE`、`agentTeamsExecuted=false`、`authoritativeForOperations=false`，不得解锁 Owner approve/package。FAIL/ESCALATE 阻止 Owner approve/package；重新生成某一位置、改 `overlayCopy` 或切换 Brand/Knowledge snapshot 都创建新 asset lineage 和 new combined revision，旧链全部 invalidated。
9. 只有 exact accepted runtime Audit PASS 后 Owner 才能批准 combined revision，并生成包含真实组合图片文件、`media-manifest.json` 和 exact manifest digest 的 ManualPublishPackage。当前 SDD-012 未接 SDD-007 Auditor receipt authority，故真实运营批准与包保持 `BLOCKED/PLANNED`；public-safe controlled evidence archive 不是 ManualPublishPackage。
10. 打开官方发布页仍只进入人工交接。复制、下载、刷新、重启、打开页面或 Owner 自报均保持 `UNVERIFIED_EXTERNAL_STATE`。

必须可见的稳定状态：

- Secret/Provider readiness：`NOT_CONFIGURED | READY | STALE_PROFILE | DEGRADED | UNREACHABLE`；
- Job：`QUEUED | SUBMITTING | PROVIDER_PENDING | PROVIDER_PROCESSING | DOWNLOADING | VERIFYING | COMPOSING | READY_FOR_REVIEW | FAILED | UNKNOWN_CHARGE_STATE | CANCELLED`；
- Composition：`PENDING | COMPOSING | READY | FAILED | STALE`；
- Asset：`UNREVIEWED | RIGHTS_REVIEW_REQUIRED | READY_TO_BIND | REJECTED | SUPERSEDED | QUARANTINED`；
- combined Artifact/Audit/Decision/Package 复用 v3 状态并增加 v4 media binding/invalidation reason。

empty、loading、failure、timeout、unknown、recovery、Owner action 和 success 均使用中文优先、英文 parity 的业务文案；不得用 raw stack、provider body 或 Story 状态代替。

## 5. Domain, storage and API contracts

### 5.1 Provider-agnostic port and adapter boundary

核心包只定义：

```text
MediaGenerationProvider
  submit(exactRequest, secretTicket) -> ProviderTaskAccepted | ProviderSubmissionOutcome
  inspect(providerTaskRef, secretTicket) -> ProviderTaskObservation

MediaResultIngestor
  ingest(providerTaskRef, ephemeralResultRef, expectedSpec) -> RawProviderMediaAsset

DeterministicMediaCompositor
  compose(rawAssetRef, exactCompositionSpec) -> CompositedMediaAsset
```

核心 request 使用 `MediaModelRef`、`MediaCapabilityProfileRef`、`sourcePromptDigest`、尺寸/MIME policy 和 request digest；首期 prompt policy 明确要求“无关键中文标题文字的背景/插画”，关键中文文案只由本地 compositor 渲染。不出现 `EVOLINK_*` 错误码、模型名或 endpoint。Provider adapter 在 `packages/providers`（实施时确认实际路径）把 provider-specific status/error/credits 映射为稳定核心 outcome，并将 raw body、Authorization 与临时 result URL 留在 private adapter 边界。

首个 EvoLink adapter-specific profile（不进入核心 enum）计划固定：

- official `POST /v1/images/generations` + `GET /v1/tasks/{task_id}`；
- text-to-image model 仅在 adapter config/source manifest 固定并于实施时复核；
- `size=1080x1440`、`n=1`、`prompt_extend=false`，避免 provider 自动改写破坏 prompt lineage；
- local Compose 使用 bounded polling，不启用公网 callback/tunnel；
- provider temp URL 只用于立即下载，不作为 asset ref，不出现在浏览器、公开 evidence 或 package。

### 5.2 Secret Gates

`SecretGatePurpose` 至少区分 `MODEL_PROVIDER` 与 `MEDIA_PROVIDER`。每个 gate 有独立 secret slot、fingerprint、scope、one-use ticket issuer、readiness 和 canary maturity：

- DeepSeek Secret 只能签发 Model task ticket；Media Secret 只能签发 media submit/inspect ticket；
- 一个 gate READY 不能让另一个 gate READY；同一个 Secret 值也不能跨 purpose 重用；
- Secret 只由交互式 terminal 无回显读取，经 0600 临时文件/Compose Secret 或等价 broker 进入 adapter；
- Secret 不进入 browser field/network payload/bundle、普通 env、CLI args、Git、logs、prompt/prompt evidence、trace、business tables、PG dump、Blob、package 或 public evidence；
- API 只返回 `configured/fingerprint/updatedAt/purpose/profileMaturity`；没有 set/read secret endpoint。
- 配置 Key 只表示 `SECRET_CONFIGURED/STARTING`，`providerEvidence=false`。`REAL_PROVIDER_CANARY_READY` 只能由 PostgreSQL 中 owner-scoped、fingerprint-matched、未过期的 live canary PASS receipt 派生；读取时必须复核同一 Provider task、真实 raw/final Blob bytes、profile/source/cost/rights lineage。failed/expired/缺 receipt/重启/Blob 缺失均为 `DEGRADED | STALE | NOT_RUN`，不得从 adapter class 或 worker mode 推断成功。
- Media ticket 使用 v2 authority：broker issuer、当前 Secret fingerprint、purpose/scope、issuedAt/expiry、nonce digest、canonical digest 和 HMAC signature 全部绑定；one-use 消费记录持久化于 PostgreSQL，使伪造、未来签发、过期和进程重启 replay fail closed。

SDD-011 的 real DeepSeek 与 real media provider 因此是两个独立 conditional-live gate，互相不能冒充或补足。

### 5.3 Persistent jobs, billing and recovery

- immutable `MediaGenerationSpec { id, artifactRevisionId/digest, imageSpecPosition, promptTextPrivateRef, sourcePromptDigest, altText, dimensions, allowedMimes, maxBytes, textFreeBackgroundRequired, policyRef, profileRef, createdAt, canonicalDigest }`；exact prompt 保存在 Owner-private immutable control-plane/Blob ref，UI 可读，public evidence/package 默认只包含 digest；首期 `textFreeBackgroundRequired=true`，Secret 扫描必须在提交前 fail closed。
- `MediaGenerationJob { id, specId/digest, generation, requestDigest, state, leaseOwner/tokenHash/expiry, providerAdapterRef, providerTaskId?, providerSubmittedAt?, lastObservedAt?, attemptCount, errorCode?, canonicalDigest }`。
- unique `(artifactRevisionDigest, imageSpecPosition, generation, requestDigest)` 与 provider-submission intent 先于 POST 持久化。两个 worker/双击只能有一个 billable submit owner。
- 官方资料没有证明 create endpoint 支持 idempotency key。若 POST 在 task id 落库前得到网络 timeout/连接中断/不闭合响应，必须进入 `UNKNOWN_CHARGE_STATE`，禁止自动重提；只有 adapter 能证明 `DEFINITELY_NOT_CREATED`，或 Owner 基于费用/任务查询证据明确创建新 generation，才允许下一次计费调用。
- 已有 provider task id 后，poll/restart 始终查询同一 task；GET/下载可 bounded retry，POST 不盲重试。lease expiry 前后先 reconcile，再领取。
- `CostReceipt { billingUnit, reservedAmount?, finalAmount?, currencyAmount?, pricingSourceRef, providerUsageDigest, state: RESERVED|FINAL|UNVERIFIED, checkedAt }`。创建响应的 reserved credits 不得冒充 final charge；没有 provider-confirmed final usage 时显示 `UNVERIFIED`。
- timeout、429/5xx、task failed/cancelled、result expired、download interrupted、provider/model mismatch 使用稳定错误码；raw provider error 只保存在 access-controlled private evidence ref。

### 5.4 Content-addressed raw asset, deterministic composition and provenance

`RawProviderMediaAsset v2` 必须包含：

- `assetId/contentDigest/blobRef`、verified bytes、magic-sniffed MIME、width/height、aspect ratio、ordered position、file name、alt text；
- exact `artifactRevisionId/digest`、`generationSpecId/digest`、parent raw asset（如重新生成）；原始图不能直接成为 media-set candidate；
- `sourcePromptDigest` 及 private exact prompt ref、generation policy/profile ID/version/digest、provider/model adapter snapshot digest、`checkedAt/expiresAt`；
- provider task ref、submitted/completed/downloaded/verified timestamps、provider result expiry observation；
- `RightsReceipt { inputRightsAttestation, providerTermsSourceRef, termsCheckedAt, commercialUseStatus: UNVERIFIED|OWNER_ATTESTED, ownerApprovalRequired: true, canonicalDigest }`；
- exact `CostReceipt` digest、maturity `CONTROLLED_FAKE | REAL_PROVIDER_CANARY | REAL_PROVIDER_OWNER_UAT`、approval state、`assetRole=PROVIDER_RAW`。

Blob key 由 bytes SHA-256 决定；同 digest bytes 可去重，但业务 lineage、position、rights/cost receipt 与 revision binding 不能合并。临时 URL、provider CDN object 或浏览器 object URL 不能成为 `blobRef`。

下载器必须：只接受 adapter-authorized HTTPS result；限制 redirect 次数并阻止 credentials、内网/link-local/loopback；每个 hop 重做 DNS 审查、检测同 host 地址集合漂移，并把实际 TLS socket 的 lookup 固定到已审查地址，同时保留原 hostname/SNI/证书校验，使 DNS rebinding 不能把已授权请求切换到未审查地址；流式限制 `bytes > 0 && bytes <= 10 MiB`；核对 `Content-Length`（若有）、magic、declared MIME、decoder MIME、exact dimensions；拒绝 empty body、SVG/HTML/polyglot/解码炸弹；对 exact downloaded bytes 先 hash/atomic Blob，再扫描 metadata/EXIF。raw Blob 只在 Owner boundary 显示安全解码 preview，不进入 package；不允许 metadata 使其 quarantine。compositor 的 final encoder 必须清除 metadata 并重新 hash。任何 normalizer/decoder 依赖需在实现 SDD 固定版本、license、NOTICE、漏洞和 source-offer 义务；本规格不预选新依赖。

`MediaCompositionSpec v1` 是 immutable、可摘要的 exact contract：

```text
MediaCompositionSpec {
  rawAssetId, rawContentDigest,
  mode: EXACT_OVERLAY | NO_OVERLAY,
  overlayCopy, overlayCopyDigest,
  brandSnapshotRef/digest, knowledgeSnapshotRef/digest,
  templateRef/digest, colorTokens, logoAssetRef/digest?,
  safeArea, typographyProfileRef/digest, compositorProfileRef/digest,
  outputProfileRef/digest, createdAt, canonicalDigest
}
```

- `EXACT_OVERLAY` 必须逐字渲染 XHS image spec 的 exact `overlayCopy`；不得让图片模型生成、改写、翻译或近似替代关键中文标题；provider 原始图若出现会与标题混淆的乱码/关键文字，由视觉 Audit 标记 `FAIL | ESCALATE`；
- 首期画布 fixed `1080×1440`，safe area 为左/右各 `96 px`、上/下各 `120 px`；所有 overlay glyph bounding boxes 和 Logo 必须完全落在 safe area。标题使用 profile-declared `72 px` 起始字号、`1.2` line-height、最多 3 行，可按 deterministic steps 缩至不低于 `48 px`；仍溢出则 `MEDIA_TEXT_OVERFLOW`，严禁裁切、省略或静默改文；
- overlayCopy 与背景的 computed contrast ratio 必须全字形区域至少 `4.5:1`；需要底板/描边时其参数属于 exact template/profile digest。品牌色不得为满足对比度而被静默替换；不满足即 fail closed；
- 字体只允许 repository/vendor-lock 中 exact version + SHA-256 + license 的字体资产和固定顺序 fallback。缺字按该顺序确定性选择；全部缺失时 `MEDIA_GLYPH_MISSING`。首期 overlay 不支持 emoji/color-font，发现 emoji code point 返回 `MEDIA_EMOJI_UNSUPPORTED`；不得交给 OS 字体或 tofu 静默兜底；
- Logo 必须是 exact approved snapshot 授权的 content-addressed asset，保持比例，不拉伸、不超 safe area；模板、品牌色、Logo 若来自知识库，必须同时绑定 exact approved `BrandSnapshot` 与 `AuthoritativeKnowledgeSnapshot`。任一 snapshot 未批准、digest 不匹配、过期或改变都阻止 composition/bind，并使已有 media revision stale；
- 首期没有独立 Brand 服务时，BrandSnapshot 的最小权威映射是 owner-scoped exact `APPROVED` KnowledgeSnapshot 所绑定的唯一 `ORGANIZATION` profile revision；系统以 Organization id/digest、组织名、品牌名、KnowledgeSnapshot id/digest 与其真实 `approvedAt` 确定性派生并持久化 BrandSnapshot。KnowledgeSnapshot 必须由 exact Owner 批准、无 gap，所有 source/profile bindings 与 PostgreSQL authority 一致，source 为 `READY`、document 未 tombstone 且 Blob bytes/digest 可复核。环境变量、请求 payload 或进程启动时间不能自证批准；supersession、source tombstone/缺失、审批状态或 Organization binding 变化均使旧链 stale；
- `NO_OVERLAY` 只允许 image spec 的 `overlayCopy=null` 且 Owner 对 exact spec 显式确认“纯图无文字层”。系统仍创建 composition record，记录 mode、raw digest、snapshot/profile refs 和 Owner decision；最终 bytes 可与 raw bytes 相同，但 raw/final 两个业务 lineage node 不能合并；
- compositor 是无网络、无模型、无 Secret 的 deterministic local operator；同一 raw bytes + composition spec + pinned dependency/font assets 必须跨 retry/restart 得到同一 final bytes/digest。它不能改 Artifact copy、挑图、审校或批准。

`CompositedMediaAsset v2`（`assetRole=DELIVERY_COMPOSITE`）引用 exact raw asset 和 composition spec，保存最终 `contentDigest/blobRef/bytes/MIME/dimensions`、composition timestamps/profile、font/template/logo/snapshot digests、lineage canonical digest。final output 必须重新通过 `bytes > 0 && bytes <= 10 MiB`、magic/MIME/decoder/exact 1080×1440/metadata/digest gates 后才可原子写 Blob。只有其最终 bytes/digest 是 preview、Audit、OwnerDecision、MediaSetBinding 和 package 的资产权威；raw asset 仅供受控 lineage/诊断，默认不进入发布包。

compositor/decoder/normalizer、字体与 Logo 资产在 implementation 开始前必须冻结 exact package/version/digest/license/NOTICE/SBOM/source-offer/security disposition。字体许可证必须明确允许预期的本地渲染与交付图片用途；未知、仅个人使用或不兼容许可证 fail closed。不得依赖未锁定的系统字体、浏览器 canvas 或远程字体 CDN。

### 5.5 Artifact revision and invalidation

SDD-010 v3 历史保持不变。新 `ArtifactRevision v4` 在 payload/input binding 中增加：

```text
MediaSetBinding {
  profileRef,
  items[{position, assetId, contentDigest, mimeType, bytes, width, height,
         altText, rawAssetDigest, generationSpecDigest, compositionSpecDigest,
         brandSnapshotDigest, knowledgeSnapshotDigest, templateDigest,
         rightsReceiptDigest, costReceiptDigest}],
  canonicalDigest
}
```

- XHS v4 的 item positions 必须与 image specs 一一对应、连续、数量相等；position 1 是 cover；全部是 1080×1440 和 allowed MIME；
- materialize media set 时创建 child ArtifactRevision，并把 copy、source、Goal/Plan/exact approved Brand/Knowledge/Account/Skill/Profile 与 media set 全部纳入 canonical digest；
- final asset bytes、raw asset、position、alt text、overlayCopy、composition/template/font/logo/brand/knowledge snapshot、prompt/policy/profile、rights/cost binding 任一改变都需要 new composition 或 new generation，并创建 new ArtifactRevision；
- `MEDIA_CHANGED | MEDIA_ORDER_CHANGED | MEDIA_COMPOSITION_CHANGED | MEDIA_BRAND_SNAPSHOT_CHANGED | MEDIA_KNOWLEDGE_SNAPSHOT_CHANGED | MEDIA_RIGHTS_CHANGED | MEDIA_POLICY_CHANGED | MEDIA_TAMPER_DETECTED` invalidation 传播到旧 Audit、OwnerDecision、Package；历史保留；
- Auditor identity 必须与 Producer 不同；Auditor 输入包含实际 decoded previews、provenance/rights/cost 与 exact combined digest，但无 Secret/raw provider response；Auditor 不能产生或选择资产。
- v4 controlled audit route 使用 closed schema，只接受 exact `revisionDigest + controlledFixture=true + result`；服务端固定 `controlled-a5-media-auditor` / `A5_INDEPENDENT_AUDITOR`，持久化 `CONTROLLED_FIXTURE`、`agentTeamsExecuted=false`、`authoritativeForOperations=false` 与 `runtimeReceiptBinding=null`。任意客户端 `auditorIdentityId`、缺 marker 或伪造 runtime receipt 均拒绝。
- 当前没有接入 SDD-007 exact accepted Auditor task/output receipt；因此 controlled PASS 不能创建 `APPROVE` OwnerDecision 或 ManualPublishPackage v4。后续接 runtime 时，repository 必须在同一 transaction/row lock 中重读 exact owner/run/job/task/attempt、A5 role、Skill locks、input revision/media/snapshot digests、accepted output schema/canonical digest，不能把请求字段当 authority。

### 5.6 ManualPublishPackage v4

只有当前 combined ArtifactRevision 的 exact accepted SDD-007 runtime Audit `PASS` + Owner `APPROVE` 可创建包；`CONTROLLED_FIXTURE PASS` 永不满足此条件。当前 runtime binding 未实现，权威 XHS v4 包保持 `BLOCKED/PLANNED`。未来解锁后，包至少按以下顺序包含：

1. `manifest.json`；
2. `title.txt`；
3. `body.md`；
4. `topics.txt`；
5. `image-specs.json`（`generatedMedia=true` + exact media-set digest）；
6. `media-manifest.json`（ordered final file metadata、alt text、raw/final asset、composition/overlayCopy、Brand/Knowledge snapshot、template/font/logo、rights/cost/prompt/policy/profile digests）；
7. `image-01.<ext>` … `image-NN.<ext>` actual composited bytes。

Binary file entry 使用 `blobRef + contentDigest + bytes + mimeType`，不把 bytes base64 放进 PostgreSQL。下载时逐文件从 BlobStore 读取并复核 digest/size/MIME；任一缺失或 tamper 使 package `INVALIDATED`，不得导出部分“成功”包。`manifestDigest` 绑定 ordered text/binary file digest、combined revision、Audit、OwnerDecision、official URL ref 与 `UNVERIFIED_EXTERNAL_STATE`。copy/download/open 不生成 external receipt 或 `PUBLISHED`。

### 5.7 API and compatibility

实施阶段计划的 routes（exact version/OpenAPI 在实现 SDD 冻结）：

- terminal-only CLI：media secret configure/status/remove（remove 不删除历史资产）；
- `GET /api/media/readiness`；
- `POST /api/artifacts/:revisionId/media-generations`、`GET /api/media-jobs/:id`、`POST /api/media-jobs/:id/cancel|regenerate`；
- `GET /api/media-assets/:id/preview|download`（owner boundary、digest/ETag、安全 headers）；
- `POST /api/artifacts/:revisionId/media-bindings` 创建 v4 child revision；
- SDD-010 artifact/audit/decision/package routes 继续使用 exact digest/If-Match/idempotency。

稳定核心错误码包括：`MEDIA_SECRET_NOT_CONFIGURED`、`MEDIA_PROVIDER_PROFILE_STALE`、`MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE`、`MEDIA_PROVIDER_TASK_FAILED`、`MEDIA_PROVIDER_TASK_UNKNOWN`、`MEDIA_RESULT_EXPIRED`、`MEDIA_DOWNLOAD_FAILED`、`MEDIA_RESULT_EMPTY`、`MEDIA_RESULT_TOO_LARGE`、`MEDIA_MIME_INVALID`、`MEDIA_DIMENSIONS_INVALID`、`MEDIA_DIGEST_MISMATCH`、`MEDIA_TEXT_OVERFLOW`、`MEDIA_GLYPH_MISSING`、`MEDIA_EMOJI_UNSUPPORTED`、`MEDIA_CONTRAST_INVALID`、`MEDIA_BRAND_BINDING_STALE`、`MEDIA_COMPOSITION_NONDETERMINISTIC`、`MEDIA_RIGHTS_REVIEW_REQUIRED`、`MEDIA_SET_INCOMPLETE`、`MEDIA_REVISION_STALE`、`MEDIA_AUDITOR_INDEPENDENCE_REQUIRED`、`MEDIA_PACKAGE_TAMPERED`。Provider brand/error text 不进入这些 core codes。

## 6. AgentTeams and Skill/permission boundaries

- existing six-member topology 不变；SDD-012 不增加“Media Operator”冒充第七个业务 Agent；
- XHS Producer 产出/修订 exact image specs 与 source prompt proposal；deterministic compiler 生成 `MediaGenerationSpec`；provider adapter/ingestor 是非 Agent operator；
- Independent Auditor 只读 combined revision、actual previews、source/rights/cost/policy evidence，输出 findings；它不能编辑 prompt/image、触发 regenerate、批准、建包或发布；
- Owner 选择/绑定 candidate media、决定重新生成并批准 exact combined revision；
- Leader 只推进 dependencies，不能生成 prompt/asset/audit；
- `xiaohongshu-content-expression` 与 `artifact-independent-audit` 需要新 version/digest 来声明 actual-media input/output；旧 SkillLock 历史不变；共享 Skill 修改仍需 tests/maintainer review；
- AgentTeams output 不携带 Secret、provider temp URL 或 raw bytes；accepted output 只引用 exact control-plane spec/asset digests。

## 7. Dependencies and execution order

| Dependency | Decision | Current evidence / required gate |
|---|---|---|
| `M5-08` / SDD-007 runtime + terminal broker | `INTEGRATE` | 当前 `EVIDENCE_READY`；复用 PG job/lease/recovery 与 terminal-only pattern，但新增独立 `MEDIA_PROVIDER` gate，不能复用 Model ticket/Secret |
| `M5-09` / SDD-010 artifact/audit/package | `INTEGRATE` | 当前 `EVIDENCE_READY`；以 versioned v4 扩展 actual media，不改 v3 history |
| existing BlobStore | `INTEGRATE` | content-addressed local volume 已接受；必须验证 binary atomic ingest/reopen/backup inventory |
| real media provider adapter | `POC-GATED → INTEGRATE only after Canary` | 首候选 EvoLink；官方 endpoint/task docs已登记，但仓库 adapter 未实现、live 未运行；adapter 可替换 |
| image decoder/normalizer/compositor | `BUILD or INTEGRATE after review` | 实现前固定 exact package/version/digest/license/SBOM/NOTICE/security；必须满足跨 restart deterministic bytes，并复核现有 Sharp/libvips `LATER-REPLACE` 决定 |
| CJK fonts / template / Logo assets | `INTEGRATE only after license + snapshot gate` | exact font/version/digest/license 与 fallback 顺序纳入 compositor profile；模板、品牌色、Logo 绑定 approved Brand/Knowledge snapshots，不用系统/CDN 字体或未授权 Logo |
| archive/package streaming | `INTEGRATE existing or BUILD` | 必须支持 binary digest verification；不得为此复制第三方源码 |

依赖顺序固定为：

```text
M5-08 EVIDENCE_READY + M5-09 EVIDENCE_READY
→ SDD-012 implementation / no-Secret evidence
→ Owner terminal real-media Canary + visual/UAT + restart/package verification
→ Coordinator independent verification and proposed M5-11 state
→ SDD-011 fresh install / full dogfood / recording
```

SDD-011 可以使用 DeepSeek 与 media provider 两个不同 Secret Gate；只有各自的真实 evidence 才能满足对应 gate。一个 gate 的 PASS、无 Secret CI 或 controlled fake 均不能替代另一个。

## 8. Failure, recovery and rollback

- 无 Media Secret、profile 过期或 adapter incompatible：真实 job 不创建；不回退 fake；已有 local assets 可只读；
- POST 明确拒绝且证明未创建 task：保持 FAILED，可由 Owner 显式 retry generation；POST outcome 未知：`UNKNOWN_CHARGE_STATE`，不自动重提；
- 已有 task id：重启/lease reclaim 查询同一 task；provider pending 超时后状态是 blocked/unknown，不创建第二个 task；
- provider completed 但下载失败：在结果有效期内只重试同一 URL/task 的下载；过期后显示 `MEDIA_RESULT_EXPIRED`，Owner 明确决定新 generation；
- Blob 写入后 DB commit 前 crash：按 staging digest/atomic rename/reconciliation 复用同一 bytes，不重新调用 provider；
- duplicate worker/click：unique generation key + lease/CAS 确保最多一个 provider submit；后到者读取同一 job；
- invalid MIME/empty/size/dimensions/redirect/private IP/digest/decoder：quarantine bytes，禁止预览绑定、Audit/approve/package；
- overlay overflow/缺字/emoji/对比度/Logo/snapshot binding/compositor nondeterminism：保留 raw asset 与失败 receipt，final asset 不进入 READY；本地修复 composition spec 不得重新计费调用 provider；
- media/overlay/template/font/logo/Brand 或 Knowledge snapshot change during Audit/approve/package：If-Match/digest 返回 stale，并 append invalidation；
- rights/terms profile 过期：新 approval/package fail closed；不静默宣称既有权利无效，要求 Owner review；
- rollback：停止新 media dispatch，保留 jobs/raw+final assets/composition specs/Blob/append-only lineage；旧 app 可继续 v3 read-only 或对 v4 显式 `SCHEMA_VERSION_UNSUPPORTED`，不得误读为无媒体；populated migration down 必须拒绝。恢复/forward-fix 在独立 volume 验证，不删除 Owner assets；
- 没有外部平台动作，无发布补偿。Provider 费用属于 generation side effect，只能通过 receipt/reconciliation 管理，不能用盲重试“修复”。

## 9. Binary acceptance criteria

1. Core domain/API schemas 和 stable codes 不含 `EvoLink` 名称；real adapter 与 `CONTROLLED_FAKE` 是两个显式 maturity path，fake 不能产生 real-provider PASS。
2. current placeholder maturity audit 与代码一致：real adapter 实施前为 `NOT_IMPLEMENTED / NOT_RUN_NO_KEY`，不得从 class 名推断已实现。
3. Media Secret 只能在 terminal 无回显配置；browser/API/PG dump/Git/log/prompt/trace/evidence/package/普通 env/args 中找不到 Secret；DeepSeek 与 Media gate/ticket 不能交叉使用。
4. 每个 public-safe XHS image spec 产生一个 exact `1080×1440`、3:4、`bytes > 0 && bytes <= 10 MiB`、PNG/JPEG/WebP、可解码并实际可下载的 final composited file，positions 与 alt text 完整连续；`10 MiB` 仅为内部上限，合法文件可小于 `1 MiB`。
5. provider task id、submission intent、reserved/final/unverified cost、rights receipt、checkedAt/expiry、prompt/policy/profile/source lineage 持久化；provider temp URL 不作为 asset authority。
6. result 在有效期内立即下载并经 HTTPS/SSRF/redirect/empty/size/magic/MIME/decoder/dimension/metadata/digest gate 后，把 raw provider bytes 原子写入 content-addressed Blob；任一 tamper fail closed。
7. 首期 provider prompt 生成无关键中文标题文字的背景/插画；pinned deterministic local compositor 将 exact `overlayCopy`、template/color/Logo/safe area/font/size/contrast policy 渲染成 final bytes。raw/final 分别有 digest/Blob/lineage；只有 final digest 可被 Audit、Owner approval 与 package 引用。
8. exact Brand/Knowledge snapshots、template、colors、Logo、fonts 和 compositor profile 均进入 composition/revision digest；snapshot 改变使旧 media revision/Audit/Decision/Package invalidated。`overlayCopy=null` 只有在 exact `NO_OVERLAY` Owner decision 被记录时可跳过文字层。
9. golden tests 证明同一 raw bytes + composition spec + pinned assets 在 retry/restart 得到相同 final digest；overflow、缺字、emoji、fallback、safe-area、Logo 比例和全字形区域对比度 `<4.5:1` 全部 fail closed，不剪裁、不静默替字/换品牌色。
10. 相同 generation key 的双击、并发 API 与双 worker 最多产生一个 billable provider submission；POST unknown 不自动 retry；已有 task id 的 restart 只 reconcile/poll 同一 task。
11. worker/API/PG/adapter/compositor 在 `SUBMITTING`、`PROVIDER_PENDING`、`DOWNLOADING`、raw Blob-before-DB-commit、composite Blob-before-DB-commit 五个 frozen stage 重启后恢复或进入明确 review，既不丢 asset 也不重复计费。
12. actual ordered media set 只通过新 child XHS ArtifactRevision v4 绑定；final/raw asset、bytes/order/alt/overlay/composition/brand/knowledge/template/font/logo/prompt/policy/profile/rights/cost 任一变化使旧 Audit、OwnerDecision 与 Package invalidated。
13. Producer 与 Independent Auditor identity/Skill/context/permission 分离；受控 fixture 必须固定服务端 A5 identity 并明示未执行 AgentTeams，真实权威 Audit 必须绑定 SDD-007 exact accepted A5 task/output receipt；Auditor不能修改、重生成、排版、批准或生成 package；Leader 没有领域媒体输出。
14. `FAIL | ESCALATE`、controlled fixture PASS、伪造 runtime receipt 或 rights/profile/snapshot stale 均不能 Owner approve/package；只有 repository 重读并验证的 exact combined revision active runtime PASS + Owner APPROVE 可建包。
15. runtime Audit authority 解锁后，XHS ManualPublishPackage 含真实 final `image-NN` files、`media-manifest.json` 和绑定全部 binary/text/composition/snapshot digests 的 exact manifest；逐文件下载/解压/打开后 bytes/dimensions/MIME/digest 与 Blob/manifest 一致。当前 public-safe engineering archive 只能验证真实 final bytes/manifest/tamper 结构，不得称为权威发布包。
16. copy/download/open official page/refresh/restart/Owner self-report 全部保持 `UNVERIFIED_EXTERNAL_STATE`，系统不存在 auto-upload/click/`PUBLISHED` mutation。
17. production SaaS Shell 的 zh-CN/en 页面从真实 PG/API/Blob 显示 final preview、raw/final lineage、overlay/snapshot binding、generation/composition failure/recovery、费用、版权来源、profile expiry、重新生成/重排版影响和下载；Story/fixture screenshot 不计为 runtime evidence。
18. fresh PostgreSQL + fresh Blob volume + Compose 可完成 controlled fake normal/fail-closed matrix；real Provider UAT 必须由 Owner 在 terminal 输入 Secret，并与 no-Secret path 分开标记。
19. license/SBOM/audit、官方 source register、provider terms/data/retention review、decoder/normalizer/compositor/font/Logo NOTICE/source-offer review通过；这不是法律合规保证。
20. rollback/restore 在独立 volume 保留 v3/v4 revisions、jobs、receipts、raw/final Blob inventory/digests；旧版本不能把 v4 误报为无媒体成功。
21. Chinese acceptance report、machine-readable run manifest、tamper/concurrency/restart/compositor matrix、browser screenshots、controlled Audit maturity、权威 runtime Audit/package blocker、redacted real canary、Owner binary UAT 与 structured handoff 完整；未接 runtime authority 时必须标为 `BLOCKED/PLANNED`，不得用 controlled fixture 升级成熟度。

## 10. Test and evidence plan

- Schema/unit：provider-agnostic port、job/raw/composited asset/media-set/package v4、composition/snapshot canonical digest、dimension/MIME/alt/order、rights/cost/profile expiry、stable code；
- Provider controlled fake：deterministic 1080×1440 PNG positive；HTML/SVG/polyglot/wrong magic/MIME/bytes/dimensions/oversize/redirect/private-IP/DNS-rebind/metadata negatives；
- Adapter contract：create accepted/pending/processing/completed/failed、credits reserved vs final unknown、401/402/403/429/5xx/timeout/malformed/model/task mismatch、24h result expiry；CI 只用 official-contract fixtures，不声称 live；
- Compositor：exact overlayCopy、safe area、72→48 px deterministic fitting、3-line overflow denial、missing CJK glyph/fixed fallback/emoji denial、contrast 4.5:1、Logo aspect/snapshot auth、NO_OVERLAY decision、golden final digest across retry/restart；
- PostgreSQL/worker：fresh migration、lease/heartbeat、double worker、unique submit、unknown charge、poll retry、five-stage crash/restart、raw/final Blob orphan reconciliation、idempotency/ETag/tenant boundary；
- Artifact/governance：combined revision lineage、raw/final/composition/Brand/Knowledge snapshot mutation invalidation、Producer/Auditor separation、FAIL/ESCALATE/rights/snapshot stale denial、exact Owner approval；
- Package：real binary files/ordering/digests, missing/tampered Blob, partial archive failure, reopen/download verification, no `PUBLISHED`；
- API/Web/browser：running Compose + fresh PG/Blob，zh-CN/en，actual preview/individual/package download，keyboard/axe/console/no overflow at supported desktop viewport；本轮不要求 mobile；
- Secret/security：no Secret path/value in browser bundle/network、OpenAPI、PG dump、Docker inspect env、process args、logs、prompt/trace/evidence/Git/package；ticket wrong purpose/scope/expiry/replay；
- License/supply chain：dependency inventory、SBOM、npm audit、decoder/normalizer/compositor/CJK font/template/Logo license/NOTICE/source-offer、provider source/terms checkedAt；
- Real Owner Canary：terminal Media Secret、one public-safe three-image XHS revision、actual spend receipt、visual review、restart、package bytes；不登录或自动操作小红书；
- Rollback/restore：backup DB + Blob inventory，upgrade/forward-fix，独立 volume restore，old-app read-only/refusal，exact digest comparison。

实施 evidence 至少包含 `MediaRunManifest`、provider capability/source snapshot、redacted task/cost/rights receipts、Blob inventory、revision/audit/decision/package lineage、secret scan、fault matrix、browser screenshots 和 Owner returned decision。所有 real-provider evidence 必须省略 Secret、raw Authorization、signed result URL、raw provider body 和 private prompt text。

## 11. Owner-participated acceptance

### UAT-00｜无 Secret 与独立 Gate

前置：fresh project-scoped Compose、无 DeepSeek/Media Secret。Owner 在 Web 打开 XHS revision，确认 Media 是 `NOT_CONFIGURED`，没有 Key 输入框；controlled fake 明确标记非 Provider evidence。随后只配置 DeepSeek gate，确认 Media 仍 blocked；清除并只配置 Media gate，确认 Model gate 仍 blocked。失败信号：任一 gate 互相变 READY、页面/API 能写/读 Key、无 Key 自动 fake success。返回 readiness 截图、redacted gate status 与 `UAT-00 PASS|FAIL`。

### UAT-01｜真实 Provider Canary 与视觉验收

前置：Coordinator 冻结 implementation Head、public-safe 三图 XHS revision、Docker/terminal、Owner 自持有效 media-provider Key 与可接受的测试费用；不要在聊天、网页、命令参数、`.env`、截图或报告粘贴 Key。

1. 在交互式 terminal 运行无 Secret 参数的 media configure/canary 命令，无回显输入 Key；确认只显示 fingerprint/profile/source checkedAt/expiry。
2. Web 选择 real Provider 并确认预计提交 3 个 `n=1` jobs、费用以 reserved/final/unverified 区分；启动后记录公开 job IDs/digests。
3. 观察 pending/processing/downloading/verifying；在第二个 job 处理中重启 mission-worker，确认恢复同一 provider task，不创建重复 task/费用。
4. 三图完成后逐图打开 final actual preview，并查看 raw provider 图与 final 组合图 lineage；核对 1080×1440、顺序、exact 中文 `overlayCopy`、safe area、字体/缺字/emoji、Logo 比例、品牌色/对比度、构图、无明显破损/隐私内容、alt text、source prompt、Brand/Knowledge snapshot、rights/terms source 与 cost receipt；给出逐图 `VISUAL_ACCEPT | RECOMPOSE | REGENERATE | REJECT`。若 exact spec 为 `overlayCopy=null`，同时核对 `NO_OVERLAY` Owner decision 已显式记录。
5. 先对一张调整 exact overlayCopy 并选择 recompose，确认不新建 provider task/费用但产生 new final asset/combined revision；再选择 regenerate，阅读失效与潜在费用影响后执行，确认 new raw/final lineage，旧 Audit/Decision/Package invalidated。
6. 返回 redacted canary manifest、provider task/cost receipt digest、三组 raw/final Blob digest/size/MIME/dimensions、composition/profile/snapshot digests、restart/concurrency 结论与 `UAT-01 PASS|FAIL`。不得返回 Secret、signed URL、raw body 或 private prompt。

### UAT-02｜独立审校、精确批准与实际包核对

1. 先确认 Web 的 `CONTROLLED_FIXTURE PASS` 明示 `AgentTeams 未执行` 且 Owner/package 按钮禁用；直接 API approve/package 也必须返回 runtime authority required。待 SDD-007 exact accepted A5 task/output receipt integration 完成后，再由真实独立 Auditor 对最终 combined revision 执行一次 FAIL/恢复/PASS，确认 Auditor 没有编辑/批准/生成按钮。
2. 当前步骤 blocked；runtime authority 接入并验证后，Owner 才可批准 exact authoritative PASS revision，下载单图与完整 package。
3. 核对 package 文件顺序、`manifest.json` / `media-manifest.json` / `image-specs.json`、每个 final `image-NN` 实际可打开；本地计算/验证 digest、MIME、`bytes > 0 && bytes <= 10 MiB`、1080×1440、overlay/snapshot/composition digests 与 Blob inventory 一致，确认 package 不依赖 provider 临时 URL。
4. 打开 allowlisted 小红书官方发布入口但不登录/上传/点击发布；返回产品确认仍 `UNVERIFIED_EXTERNAL_STATE`。
5. 重启 API/PG/Web，重开同一 revision/package；核对 ID/digest/preview/download 不变。

失败信号：FAIL 可批准、raw/final/overlay/template/Brand/Knowledge 变化不失效旧决定、Auditor=Producer、package 只有 specs/临时 URL 或缺 final bytes、文件 tamper 仍导出、打开页变 `PUBLISHED`、重启后换 job/revision/digest。返回 screenshots、package verifier JSON/SHA-256、revision lineage、`UAT-02 PASS|FAIL`。测试下载包由 Owner 手动删除；停止精确 Compose project，移除临时 Secret，保留 PG/Blob evidence；删除 volume 需另行明确授权。

## 12. Evidence and claims

本 specs-only PR 唯一有效声明是 `SPEC_READY`。当前 implementation 在未接 SDD-007 exact accepted A5 Audit receipt authority 时，最多声明：

> `ENGINEERING_VERIFIED`（仅媒体资产链）：LumiClaw Presence 能把 exact 小红书 image specs 经可替换真实媒体 Provider 异步生成无字 raw 图并立即内容寻址持久化，再由 deterministic local compositor 按 exact overlayCopy 与 approved Brand/Knowledge snapshot 形成 final 图，绑定为新的 combined ArtifactRevision；受控 A5 fixture 明示 `AgentTeams 未执行`，且不能解锁 Owner APPROVE 或 ManualPublishPackage。Secret、重复计费、重启、篡改与权限提升路径已 fail closed 验证。权威独立审校、批准与运营包仍为 `PLANNED/BLOCKED`。

Owner real-provider Canary 只证明一次本地工程路径和视觉决定，不是 external calibration、生产可靠性或商业/法律结果。仍为 `NOT_CLAIMED`：自动发布、OAuth、Cookie/DOM automation、移动端、平台合规保证、版权/商用权保证、病毒式增长、线索/收入、无限 provider/platform 支持。

## 13. Delivery plan and implementation task slicing

SDD-012 是一个 bounded 2–3 日 implementation SDD；建议由同一 Executor 完成以避免 job/asset/revision/package transaction boundary 被拆散：

1. `T01 contracts/red tests`：v2 media job/raw/final/composition/secret-purpose、v4 revision/package、provider-neutral errors、source/profile/snapshot register；
2. `T02 persistence/worker/compositor`：migration、raw/final Blob ingest、lease/idempotency/UNKNOWN/restart/tamper/downloader security、deterministic composition；
3. `T03 adapter/secret/assets`：separate Media gate、controlled fake、首个 real adapter、cost/rights/profile receipts、exact fonts/templates/Logo license review；
4. `T04 governance/UI/package`：combined revision、Brand/Knowledge snapshot invalidation、audit/approval、production Shell raw/final preview/download/binary package；
5. `T05 convergence`：fresh PG/Compose/browser/security/license/rollback、Owner Canary/UAT、中文 acceptance、STATUS_HANDOFF。

如果实现选择新 decoder/normalizer/compositor/archive/font/template dependency，必须先在同一 implementation SDD 中完成依赖审查；若许可证、确定性或安全边界不清，任务停止为 blocked，不以浏览器 canvas、系统字体或跳过 bytes 验证来降级验收。

## 14. Alternatives and decisions

- 拒绝把 provider 名/模型写进 core domain enum：会锁死替换并污染历史 digest；使用 adapter ref/source snapshot。
- 拒绝复用 DeepSeek Secret Gate：purpose/scope/费用/故障不同，互相冒充会破坏 UAT 证据。
- 拒绝把 provider URL 当 asset：官方说明链接短期有效，必须立即下载/hash/Blob 持久化。
- 拒绝自动 retry unknown POST：官方资料未证明 create idempotency，可能重复计费；unknown 要 reconciliation/Owner 决定。
- 拒绝 provider 默认 prompt rewrite：exact prompt lineage 要求首个 adapter 显式关闭；未来开启需保存 provider rewritten prompt 并创建新 policy/profile version。
- 拒绝让图片模型直接生成关键中文标题：模型文字不可确定且易出现乱码；provider 只生成无字背景/插画，exact overlayCopy 由 pinned local compositor 渲染，最终组合 bytes 才是批准对象。
- 拒绝浏览器 canvas、远程/系统字体或未批准品牌资产：它们不能给出稳定 digest/许可证/snapshot binding；所有 compositor/font/template/Logo 输入必须锁定并可追溯。
- 拒绝在 v3 row 上填入图片：会改变已接受 digest；使用 v4 child revision 与失效链。
- 拒绝只把图片塞进 ZIP 而不纳入 Audit/Decision digest：会让批准对象与发布对象不同。
- 拒绝 Storybook/controlled SVG 作为 dogfood：首期 fake 也必须是真实 PNG bytes，real UAT 仍需独立 Provider Canary。
- 拒绝 callback/tunnel 作为本地首期：官方 callback 要公网 HTTPS，增加暴露面；使用 persistent polling。
- 拒绝自动上传/点击：manual package 已满足本轮责任边界，平台动作需独立 SDD。

## 15. Task closeout

- 本规格状态：`SPEC_READY`；未进入 implementation；
- Proposed module：`M5-11`，canonical `IMPLEMENTATION-STATUS.md` 与中文镜像本轮零改动；
- implementation acceptance report：`docs/reports/acceptance/SDD-012-ACCEPTANCE.md`；
- implementation 最高 proposed state：在 SDD-007 exact accepted A5 Audit receipt authority 未接入时为 `BLOCKED_PENDING_SDD_007_AUDITOR_RUNTIME`，不得用 controlled fixture 建议 `EVIDENCE_READY`；runtime authority、机器门禁与 Owner binary PASS 全部完成后才可接受；
- 下游唯一顺序：SDD-007 Auditor receipt authority integration → SDD-012 authoritative package/UAT → SDD-011 dogfood/install/recording；
- specs Executor closeout 必须包含 Worktree/Branch/Base/Full SHA/PR、changed files、规格决策、AC、验证、风险、Owner UAT、下一 implementation task 和 STATUS_HANDOFF；成功交接后才完成 Goal。

## 16. CR2 — SDD-007 exact accepted A5 Auditor receipt authority integration

### 16.1 冻结事实与任务边界

- PR #22 后 migration 15 的受控 A5 row 是不可提升的历史事实：`CONTROLLED_FIXTURE / agentTeamsExecuted=false / authoritativeForOperations=false / runtimeReceiptBinding=null`。它永远不能解锁 Owner `APPROVE` 或 ManualPublishPackage。
- 本轮只接通 exact `ArtifactRevisionV4` 的独立 A5 Audit task、SDD-007 accepted output/completion receipt、Owner exact decision 与 deterministic binary package。OAuth、自动发布、DOM automation、真实小红书动作、SDD-011 录屏、真实媒体 Provider Canary 均不在本轮；外部平台动作计数必须为 `0`。
- M5-11 继续是 `IN_PROGRESS / BLOCKED_PENDING_SDD_007_AUDITOR_RUNTIME`。机器 plumbing、controlled provider 或 no-Secret 门禁不能把它升级为 `EVIDENCE_READY/ACCEPTED`；real DeepSeek + real A5 + Owner UAT 仍是明确的 `PENDING`。
- canonical `IMPLEMENTATION-STATUS.md`、`ROADMAP.md`、`ARCHITECTURE.md` 本轮禁止修改。

### 16.2 权威模型与 TaskContract

每个 v4 revision 最多有一个 active runtime AuditRequest generation。server-side compiler 生成独立 `A5MediaAuditTaskContractV1`，并作为 SDD-007 `mission_runs_v1 / mission_jobs_v1` 的 exact contract authority 持久化；它不是浏览器提交的 receipt。合同至少冻结：

- owner、source execution run/bundle、audit run/job/task、generation；
- `roleId=independent-auditor`、`auditorRole=A5_INDEPENDENT_AUDITOR`、actual AgentTeams actor 只在 runtime binding/attempt 后确定；
- exact `artifactRevisionId/digest`、`mediaSetDigest`、ordered final asset/content/blob byte digests、Brand/Knowledge snapshot id/digest；
- media policy/profile、artifact policy/profile、exact A5 SkillLock 数组与 `skillLockDigest`；旧 SkillLock 历史不修改，actual-media auditor 使用新的 version/digest；
- input projection schema/digest、output schema ref/digest 与整个 TaskContract canonical digest；
- `externalActionAllowed=false`，Auditor 无编辑、重生成、批准、建包或平台动作权限。

Audit run 是 accepted six-member MissionExecution 的有界 A5 sub-run：复制 exact runtime requirement/team profile 并保留 source run/bundle lineage，只排队一个 A5 domain task；Leader/Producer 不能接管。mission-worker 对该 task 从 contract 生成 input projection，模型输出只允许 closed `MediaAuditOutputV4 { revision/media/snapshot/input bindings, result, findings }`；output 不得自报 Auditor identity、authority 或 runtime receipt。输出先作为 SDD-007 `PROTOCOL` materialization candidate 被 exact accepted，再由 completion-confirmed receipt 派生 media Audit。

### 16.3 API 与状态机

外部 API 只提供：

```text
POST /api/v1/media-revisions/:revisionId/audit-requests
body = { revisionDigest }

GET /api/v1/media-workspace
  -> auditRequests + derived audits/decisions/packages
```

请求 schema 必须 exact；`auditorIdentityId`、`result`、`findings`、`runtimeReceipt`、`agentTeamsExecuted`、`authoritativeForOperations` 任一出现均拒绝。原 controlled fixture endpoint 保留且继续只能记录受控证据。外部 API 不提供“导入/确认 runtime receipt”或“设置 PASS”入口。

同一 PostgreSQL control plane 驱动可见流程：

```text
WAITING_A5 → QUEUED/RUNNING/RECOVERING → PASS | FAIL | ESCALATE
→ Owner exact decision → package
```

`mission_runs_v1.state=SUCCEEDED_RUNTIME` 只表示 runtime output accepted/completion confirmed，不等于 Audit PASS。Web 中文优先并有英文 parity；当前 A5 actor/attempt 紧凑显示，run/job/task/attempt/Skill/schema/digest trace 放在可展开区域。按钮从 PG projection 派生，不能从浏览器缓存或 caller-owned nested truth 推断。

### 16.4 receipt transaction 与 fail-closed 重读

`materializeCompletedRuntimeAudit()` 只能由 worker/reconciler 调用，并在一个 transaction 中按固定顺序 row-lock/re-read：

1. active v4 revision、governance snapshots、ordered media-set、raw/final lineage 与 exact Blob bytes；
2. AuditRequest 与 source run；
3. audit run/job、accepted attempt、最新 attempt number、清空后的 job lease、actual runtime task/actor；
4. runtime binding 的 exact member role、team/runtime profile/version/digest；
5. committed materialization batch、opaque envelope/candidate、accepted ref/output digest；
6. exact `RUNTIME_COMPLETION_CONFIRMED` event；
7. real media/provider maturity 与 runtime/model provider maturity gates。

repository 必须重新计算 TaskContract、SkillLock、input projection、output schema、output payload/candidate/batch/receipt/audit canonical digest，并逐字段比较 DB columns 与 JSON payload。下列任一情况 fail closed 且不插入权威 Audit：caller-owned nested truth、controlled output/provider、Leader/Producer actor、A5 role/member/Skill mismatch、cross-owner/run/revision/media/snapshot、旧 attempt、reassigned actor、未 completion-confirmed、active/stale/expired lease、非 COMMITTED batch、schema/ref/input/output/canonical digest tamper、controlled/engineering fake、重复 receipt 或 invalidated revision。

只有 envelope 同时满足 `evidenceMaturity=AGENTTEAMS_RUNTIME`、`agentTeamsExecuted=true`、`controlledProvider=false`，runtime binding/requirement 完整、exact A5 completion confirmed，且 exact media lineage 达到 real-provider 门槛时，receipt 才可标 `authoritativeForOperations=true`。`PASS` 允许 Owner 对同一 revision 做 exact `APPROVE`；`FAIL/ESCALATE` 只能形成可见阻断。controlled/no-Secret 路径可以验证等待、执行、恢复、拒绝和 exactly-once plumbing，但不能构造一份看似 real DeepSeek 的运营 authority。

### 16.5 migration 16 与 accepted history

- migration 16 只追加 AuditRequest/RuntimeReceipt authority tables、必要的 runtime composite unique keys/FKs、以及 v4 audit 的“controlled 原形或 exact receipt-backed runtime 原形”约束；migration 15 既有 controlled rows、digests、payload 与 append-only trigger 不改写。
- runtime receipt 必须用 owner-scoped composite FK 绑定 exact revision、run/job/task/accepted attempt、binding、committed batch/output digest/batch digest 与 completion event/type；audit runtime row再以 `(owner, revision, receiptDigest)` composite FK 绑定 receipt。没有 receipt 的 runtime audit 不能 direct SQL 插入。
- controlled 与 runtime audit 使用不同 partial unique authority；同一 revision 的 controlled fixture 不妨碍随后追加一个 authoritative runtime audit，但 Owner decision/package 只认 runtime audit。
- 新 request/receipt 都 append-only；accepted runtime/materialization history 继续由 SDD-007 guard 保护。populated down migration 必须拒绝并给出 forward-fix/导出提示。

### 16.6 CR2 binary acceptance checklist

1. arbitrary Auditor/outcome/findings/receipt/authority API 字段被拒绝；API 只能 request/observe。
2. controlled fixture、controlled model output、engineering fake、runtime `SUCCEEDED_RUNTIME` 均不能提升为 authoritative Audit、Owner APPROVE 或 package。
3. cross-owner/role/member/Skill/revision/media/final bytes/snapshot/policy/profile/input/output schema/output/canonical digest 均 fail closed。
4. stale/reassigned/expired/旧 attempt、completion confirmation 前、非 accepted/非 committed batch 均阻断。
5. duplicate/concurrent worker、API retry、进程 restart 对同一 request/output 只产生一个 request、receipt 与 runtime Audit；replay/tamper 拒绝。
6. exact authoritative `FAIL/ESCALATE` 可观察但不能 Owner APPROVE/package；只有 exact authoritative PASS 可以进入 Owner exact decision。
7. media/snapshot/policy invalidation 会烧毁旧 request/receipt/decision/package 的运营资格；重新请求必须编译新 digest。
8. direct SQL composite FK、shape checks、partial unique 与 append-only trigger 通过正反测试；populated rollback fail closed。
9. PostgreSQL/API/Web 对 WAITING/RUNNING/RECOVERING/PASS/FAIL/ESCALATE/Owner/package 同源；zh-CN/en parity，当前 A5 compact、trace expandable；runtime success 文案不冒充 Audit PASS。
10. deterministic v4 package 含 title/body/topics、sanitized image specs、media lineage、真实 ordered final binary files 和 exact manifests；缺失/篡改 Blob 或 receipt 后读取/下载 fail closed，外部状态始终 `UNVERIFIED_EXTERNAL_STATE`。
11. fresh PostgreSQL、Compose、Chromium、compatibility/full verify、license/SBOM/Secret/rollback evidence 与中文 acceptance 增量完整；真实外部平台动作 `0`。
12. terminal-only Owner UAT 明确区分 no-Secret plumbing 与 real DeepSeek/real A5；在后者和 Owner binary decision 完成前 proposed state 保持 `IN_PROGRESS / BLOCKED_PENDING_SDD_007_AUDITOR_RUNTIME`。

### 16.7 CR2 implementation tasks and analyze result

- `CR2-T01 contracts/schema`：A5 task/input/output/Skill locks、request/receipt/audit union、stable errors 与 red tests。
- `CR2-T02 persistence`：migration 16、server-side compiler、same-transaction receipt materialization、composite FK/append-only/idempotency/invalidation。
- `CR2-T03 runtime/API`：mission-worker input/output authority、completion reconciler、request/observe-only API，禁止客户端 authority。
- `CR2-T04 Web/package`：中英文 PG state rail、A5 actor/trace、exact Owner gate、deterministic binary package。
- `CR2-T05 convergence`：对抗矩阵、fresh PG/Compose/Chromium、full verify、安全/许可证/SBOM/rollback、acceptance、Draft PR 与 STATUS_HANDOFF。

Analyze 结论：复用 SDD-007 已接受的 run/job/attempt/binding/materialization/completion authority；不新增第二套可伪造 runtime receipt，不回写 terminal source run，不让浏览器承载 nested authority，不把 runtime `SUCCEEDED_RUNTIME` 当 Audit PASS。以上任务依赖闭合、范围有界，CR2 状态为 `SPEC_READY`。

### 16.8 CR2 review findings — 可审输入、证据语义与诚实能力边界

P0 复核确认：A5 不能只收到 digest/ID/bytes/MIME 后声称完成“媒体审校”。`A5MediaAuditTaskContractV1` 的输入采用无环两阶段 canonical binding：

1. `baseReviewInputProjection` 冻结 Owner 预期公开的完整 XHS artifact：title/body/topics/CTA/language/account、cover 和 ordered image specs 的 purpose/aspect ratio/visual brief/overlay copy/alt、公开 source bindings；再加 ordered final media 的 alt/MIME/bytes/dimensions/final/content/Blob/raw/generation/composition/rights/cost digests与本地 deterministic verifier machine facts。该投影不含自身 digest，形成 `baseReviewContentDigest`。
2. repository 仅从已有 authority digests 派生全局 `allowedEvidenceDigests` 与每个 check 的 exact ordered `requiredEvidenceDigests`；再把 `baseReviewContentDigest + allowedEvidenceDigests + evidencePolicy` 交给最终 A5 gateway projection，形成 `inputProjectionDigest`。policy 不引用最终 `inputProjectionDigest`，因此不存在自引用 hash 环。
3. title/body/topics/CTA、visualBrief、overlayCopy、alt、media facts 或 evidence policy 的任一修改/重排都会改变 base/final input、authority/contract/task identity；worker gateway 必须收到与 contract 完全相同的 projection，tamper/reorder fail closed。
4. 每条 finding 的 `evidenceDigests` 必须非空、无重复、全部属于 allowlist，并与该 check 的 exact `requiredEvidenceDigests` 顺序一致。任意 64 位伪 digest、cross-revision digest、未知 check、空数组、重复或“所有检查只引用 revision digest”均拒绝；evidenceDigests 保留在 closed schema 与 canonical output 中。

当前 DeepSeek runtime 是 text-only，能力边界固定为 `TEXT_ONLY_WITH_SERVER_MACHINE_FACTS / pixelInspectionPerformed=false / ownerVisualReviewRequired=true`。server verifier只证明 bytes/digest/MIME/dimensions/order/composition lineage；A5 可审公开正文、overlay/alt/visual brief、来源、policy 与 machine facts，但没有实际查看 pixels。`FINAL_PIXEL_VISUAL_QUALITY`、`HIDDEN_PIXEL_CONTENT`、`RENDERED_TEXT_OCR`、`PIXEL_TEXT_MEDIA_SEMANTICS` 必须由 Owner 对 exact final 大图完成；A5 不得对这些项输出或暗示无条件 PASS。

模型输入和 evidence/log 明确排除 private prompt、raw provider body、signed URL、Secret/Authorization、客户私有知识全文、raw bytes/base64。只发送本次待公开 artifact 与 approved safe digest context；最大投影边界固定，secret/signed-url/base64 pattern fail closed。

### 16.9 CR2 review findings — Owner visual authority、exact mutation 与 current lineage

receipt-backed A5 PASS 仍不足以批准：Owner 必须在 final 三图的可放大预览旁查看完整 exact revision/media digests，并分别确认四个 boolean checklist：视觉质量、隐藏内容、渲染文字/OCR、像素级图文语义。四项全 true 才能追加 `CONFIRMED`；任一 false 只能追加 `REJECTED`，false 项就是结构化 failure flags。按钮不得一次点击把四项硬编码为 true，也不得把 Audit PASS 伪装成 Owner visual review。

VisualReview 是 exact owner/revision/media-set/audit/checklist/result-bound append-only authority。首次 `REJECTED` 后 UI 必须显示 current failed authority，同时开启一个全 false 的新 `PENDING` draft；刷新/进程重启后仍可逐项重新确认，旧 false 不会自动提升。只有 current `CONFIRMED` 锁定 surface。PostgreSQL `authority_sequence`（secondary `id`）而不是 caller/fixture `createdAt` 决定 current visual review 和 Owner decision；workspace 按该顺序投影，repository current gate 与 Web current 必须一致。

OwnerDecision `APPROVE` identity/canonical binding 必须包含 exact `visualReviewId/digest`；package 每次创建、重放、读取/下载都重读 current exact decision→visual review→audit receipt。old/replaced/tampered visual review、old decision、stale package、revision/media/snapshot invalidation均失去运营资格。`REJECT` 可以不绑定 visual review，但绝不形成 approve/package authority。

Visual review、Owner decision、package 三个 mutation 使用 closed request schema，拒绝 extra caller-owned `ownerIdentity/runtimeReceipt/authority/createdAt`；强制 exact `If-Match` 与 8–128 字节 `Idempotency-Key`。PG 在 transaction 内使用 `(owner, route, key)` advisory lock + `media_idempotency_v2` request digest，并对同 revision authority加锁：same key/same body restart replay 返回 200，same key/different body fail closed；不同 key 的同一 deterministic authority收敛为一行；并发只允许 one-created/one-replayed，不泄漏 `23505/500`。响应返回 `ETag` 与 `Idempotency-Replayed`。

Migration 16 为 visual/decision 增加 append-only sequence、exact composite FK 和 rollback guard；workspace history不改写。down preflight除 request/receipt/runtime audit/visual authority外，还显式检查同 owner/revision 多条 owner decisions（包括 `visual_review_id IS NULL` 的 REJECT replacement）。无法恢复 migration 15 one-per-revision invariant 时必须稳定抛出 `SDD012_A5_RECEIPT_DOWN_BLOCKED_EXPORT_AND_FORWARD_FIX_REQUIRED`，不得落到非稳定 unique violation。migration 16 加入后 legacy verifier rollback 深度冻结为 SDD-007=3、SDD-008=6、SDD-009=5、SDD-010=4、SDD-012=1；各自必须命中预期 fail-closed migration 且不部分拆除 authority。

### 16.10 Revised convergence criteria

- Gateway red/green：完整公开正文/spec/machine facts/evidence policy存在；正文/visualBrief/overlay/alt 变化改变 task；privacy payload不进入 request/evidence/log；text-only pixel claim被拒绝。
- Evidence red/green：arbitrary/cross-revision/duplicate/empty/unknown-check digest 拒绝，exact per-check policy PASS。
- API/PG：extra/missing/wrong ETag/short key/same-key different body/concurrent duplicate/restart replay/table count=1/package file count exact；direct SQL composite FK和append-only拒绝。
- Current lineage：同 timestamp或回拨 timestamp下，workspace current 仍由 `authority_sequence` 决定；old review/decision/package current gate fail closed。
- Chromium：初始四项 false、CONFIRMED disabled；不全勾可 REJECT；刷新后新 draft仍全 false且可编辑；逐项全勾才 CONFIRMED；旧 REJECTED stale、current CONFIRMED 后才可 Owner APPROVE/package。工程正向仅允许显式 `CONTROLLED_ENGINEERING_AUTHORITY_FIXTURE`，不得持久化为 production authority或进入 real/public claim。
- real DeepSeek、real A5、real media Provider 与 Owner UAT 继续 PENDING；M5-11 proposed state不变，真实外部平台动作必须为 0。
