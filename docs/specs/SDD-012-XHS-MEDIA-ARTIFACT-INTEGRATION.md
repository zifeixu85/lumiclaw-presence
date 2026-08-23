# SDD-012 — Xiaohongshu Governed Media Artifact Integration

> Status: `SPEC_READY`
> Milestone: `M5 — Runnable product candidate`
> Proposed progress module ID: `M5-11`（待 Coordinator 登记；编号不代表执行顺序，本文不修改 canonical progress）
> Owner: LumiClaw Presence 产品/设计 Owner；technical lead 负责 Provider、Secret、存储与恢复证据
> Goal objective: 将小红书 image specs 变成可下载、可追溯、可独立审校并由 Owner 精确批准的真实图片资产，再进入 SDD-010 人工发布包
> Target evidence maturity: `ENGINEERING_VERIFIED`；真实 Provider Canary 与 Owner UAT 必须单独通过
> Acceptance report: `docs/reports/acceptance/SDD-012-ACCEPTANCE.md`（实施阶段创建）
> Last updated: `2026-08-24`

## 0. Spec Kit lifecycle record

Constitution、Clarifications、Plan、Checklist、Tasks 与 Analyze 位于 `docs/specs/sdd-012/`。本任务只完成 Specify/Clarify/Plan/Analyze 并将规格冻结为 `SPEC_READY`；不创建 migration、production API/UI、Provider 调用或运行证据。

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
8. Independent Auditor 对 combined revision 审校。FAIL/ESCALATE 阻止 Owner approve/package；重新生成某一位置、改 `overlayCopy` 或切换 Brand/Knowledge snapshot 都创建新 asset lineage 和 new combined revision，旧链全部 invalidated。
9. exact Audit PASS 后 Owner 批准 combined revision，生成包含真实组合图片文件、`media-manifest.json` 和 exact manifest digest 的 ManualPublishPackage；可下载单图或完整包。
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

下载器必须：只接受 adapter-authorized HTTPS result；限制 redirect 次数并阻止 credentials、内网/link-local/loopback 与 DNS rebinding；流式限制 `bytes > 0 && bytes <= 10 MiB`；核对 `Content-Length`（若有）、magic、declared MIME、decoder MIME、exact dimensions；拒绝 empty body、SVG/HTML/polyglot/解码炸弹；对 exact downloaded bytes 先 hash/atomic Blob，再扫描 metadata/EXIF。raw Blob 只在 Owner boundary 显示安全解码 preview，不进入 package；不允许 metadata 使其 quarantine。compositor 的 final encoder 必须清除 metadata 并重新 hash。任何 normalizer/decoder 依赖需在实现 SDD 固定版本、license、NOTICE、漏洞和 source-offer 义务；本规格不预选新依赖。

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

### 5.6 ManualPublishPackage v4

只有当前 combined ArtifactRevision 的 exact Audit `PASS` + Owner `APPROVE` 可创建包。XHS v4 包至少按以下顺序包含：

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
13. Producer 与 Independent Auditor identity/Skill/context/permission 分离；Auditor不能修改、重生成、排版、批准或生成 package；Leader 没有领域媒体输出。
14. `FAIL | ESCALATE` 或 rights/profile/snapshot stale 不能 Owner approve/package；只有 exact combined revision 的 active PASS + Owner APPROVE 可建包。
15. XHS ManualPublishPackage 含真实 final `image-NN` files、`media-manifest.json` 和绑定全部 binary/text/composition/snapshot digests 的 exact manifest；逐文件下载/解压/打开后 bytes/dimensions/MIME/digest 与 Blob/manifest 一致。
16. copy/download/open official page/refresh/restart/Owner self-report 全部保持 `UNVERIFIED_EXTERNAL_STATE`，系统不存在 auto-upload/click/`PUBLISHED` mutation。
17. production SaaS Shell 的 zh-CN/en 页面从真实 PG/API/Blob 显示 final preview、raw/final lineage、overlay/snapshot binding、generation/composition failure/recovery、费用、版权来源、profile expiry、重新生成/重排版影响和下载；Story/fixture screenshot 不计为 runtime evidence。
18. fresh PostgreSQL + fresh Blob volume + Compose 可完成 controlled fake normal/fail-closed matrix；real Provider UAT 必须由 Owner 在 terminal 输入 Secret，并与 no-Secret path 分开标记。
19. license/SBOM/audit、官方 source register、provider terms/data/retention review、decoder/normalizer/compositor/font/Logo NOTICE/source-offer review通过；这不是法律合规保证。
20. rollback/restore 在独立 volume 保留 v3/v4 revisions、jobs、receipts、raw/final Blob inventory/digests；旧版本不能把 v4 误报为无媒体成功。
21. Chinese acceptance report、machine-readable run manifest、tamper/concurrency/restart/compositor matrix、browser screenshots、redacted real canary、Owner binary UAT 与 structured handoff 完整；Owner UAT 前最多 `EVIDENCE_READY`。

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

1. 由独立 Auditor 对最终 combined revision 执行一次 FAIL/恢复/PASS，确认 Auditor 没有编辑/批准/生成按钮。
2. Owner 批准 exact PASS revision，下载单图与完整 package。
3. 核对 package 文件顺序、`manifest.json` / `media-manifest.json` / `image-specs.json`、每个 final `image-NN` 实际可打开；本地计算/验证 digest、MIME、`bytes > 0 && bytes <= 10 MiB`、1080×1440、overlay/snapshot/composition digests 与 Blob inventory 一致，确认 package 不依赖 provider 临时 URL。
4. 打开 allowlisted 小红书官方发布入口但不登录/上传/点击发布；返回产品确认仍 `UNVERIFIED_EXTERNAL_STATE`。
5. 重启 API/PG/Web，重开同一 revision/package；核对 ID/digest/preview/download 不变。

失败信号：FAIL 可批准、raw/final/overlay/template/Brand/Knowledge 变化不失效旧决定、Auditor=Producer、package 只有 specs/临时 URL 或缺 final bytes、文件 tamper 仍导出、打开页变 `PUBLISHED`、重启后换 job/revision/digest。返回 screenshots、package verifier JSON/SHA-256、revision lineage、`UAT-02 PASS|FAIL`。测试下载包由 Owner 手动删除；停止精确 Compose project，移除临时 Secret，保留 PG/Blob evidence；删除 volume 需另行明确授权。

## 12. Evidence and claims

本 specs-only PR 唯一有效声明是 `SPEC_READY`。实施并通过机器门禁后最多声明：

> `ENGINEERING_VERIFIED`：LumiClaw Presence 能把 exact 小红书 image specs 经可替换真实媒体 Provider 异步生成无字 raw 图并立即内容寻址持久化，再由 deterministic local compositor 按 exact overlayCopy 与 approved Brand/Knowledge snapshot 形成 final 图，绑定为新的 combined ArtifactRevision，独立审校并由 Owner 精确批准，最后导出含实际 final 图片的人工发布包；Secret、重复计费、重启和篡改路径已 fail closed 验证。

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
- implementation 最高 proposed state：machine gates完成但 Owner UAT pending 时 `EVIDENCE_READY`；只有 Coordinator 独立验证和 Owner binary PASS 后才可接受；
- 下游唯一顺序：SDD-012 implementation/UAT → SDD-011 dogfood/install/recording；
- specs Executor closeout 必须包含 Worktree/Branch/Base/Full SHA/PR、changed files、规格决策、AC、验证、风险、Owner UAT、下一 implementation task 和 STATUS_HANDOFF；成功交接后才完成 Goal。
