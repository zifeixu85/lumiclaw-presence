# SDD-012 Clarifications

| ID | Resolution |
|---|---|
| CL-01 | Proposed `M5-11` 是标识符，不代表在 `M5-10` 之后执行；实际顺序是 SDD-012 → SDD-011。 |
| CL-02 | 现有 `EvoLinkMediaProvider` 只有 no-key/disabled placeholder；real adapter 是 `NOT_IMPLEMENTED`，live 是 `NOT_RUN_NO_KEY`。 |
| CL-03 | EvoLink 只是首个 adapter candidate；核心 domain 只保存 provider-neutral adapter/profile refs 与 stable outcomes。 |
| CL-04 | 首期 deliverable profile 是 exact 1080×1440（3:4）、PNG/JPEG/WebP、`bytes > 0 && bytes <= 10 MiB`；10 MiB 是内部上限，不是小红书官方限制，合法优化图可小于 1 MiB。 |
| CL-05 | position 1 是 cover；actual MediaSet item 数量和 positions 必须与 XHS image specs 一一对应。 |
| CL-06 | `CONTROLLED_FAKE` 必须生成可解码 PNG bytes，但永远不是 real-provider/visual acceptance evidence。 |
| CL-07 | exact prompt 保存在 Owner-private immutable ref；public evidence/package 默认只含 prompt digest，Secret-shaped prompt 输入直接拒绝。 |
| CL-08 | provider result URL 是短期 capability，只在 adapter private boundary 立即下载；成功后不作为业务 ref，公开 evidence/package 不保留 raw URL。 |
| CL-09 | 官方资料未证明 create idempotency；无 task id 的 submit unknown 必须停止在 `UNKNOWN_CHARGE_STATE`，不得自动 POST retry。 |
| CL-10 | 有 task id 后的 poll/download/restart 都复用同一 provider task；result 过期需要 Owner 明确创建新 generation。 |
| CL-11 | 创建响应的 `credits_reserved` 只记录 RESERVED；没有 provider-confirmed final usage 时 final cost 为 `UNVERIFIED`。 |
| CL-12 | Provider 条款未在已核页面授予或保证生成内容权利；rights receipt 保持 `UNVERIFIED` 或 Owner attestation，不作法律保证。 |
| CL-13 | 首个 adapter 显式 `prompt_extend=false`；若未来允许 provider rewrite，必须保存 rewritten prompt/provenance 并升级 policy/profile version。 |
| CL-14 | 本地 Compose 首期用 persistent polling；不为 callback 暴露公网 tunnel。 |
| CL-15 | Provider 首期只生成无关键中文标题的背景/插画；exact overlayCopy 由无网络/模型/Secret 的 pinned deterministic local compositor 渲染，final bytes/digest 才能进入 Audit/OwnerDecision/Package。 |
| CL-16 | Raw provider image 与 final composited image 分别保存 content digest/Blob/business lineage；raw 不能被批准或进入 package。 |
| CL-17 | Auditor 与 Producer 分离；Auditor不能编辑、重生成、选择、批准、建包或发布。 |
| CL-18 | Model 与 Media Secret Gate purpose/ticket/readiness/canary 分开，一个 PASS 不能补足另一个。 |
| CL-19 | ManualPublishPackage v4 必须实际包含 binary image files；只有 specs/URL/base64-in-PG 都不合格。 |
| CL-20 | copy/download/open/self-report 仍为 `UNVERIFIED_EXTERNAL_STATE`；当前不存在任何 `PUBLISHED` mutation。 |
| CL-21 | 首期 fixed canvas 1080×1440，safe area 左右 96 px/上下 120 px；标题 72 px 起、1.2 line-height、最多 3 行，按固定步骤最小降至 48 px，仍溢出则 fail closed。 |
| CL-22 | Overlay 全字形区域对比度至少 4.5:1；fixed licensed font fallback 全部缺字时报错，首期 emoji 显式拒绝；不用系统字体、远程字体或浏览器 canvas。 |
| CL-23 | `overlayCopy=null` 只允许显式 Owner `NO_OVERLAY` decision；仍创建 final composition lineage，bytes 可与 raw 相同但业务节点不合并。 |
| CL-24 | 模板、品牌色、Logo 若来自知识库，必须绑定 exact approved BrandSnapshot 与 AuthoritativeKnowledgeSnapshot；任一 digest/approval/expiry 变化使 media revision/Audit/Decision/Package stale。 |
| CL-25 | 图片 bytes/order/alt/raw/overlay/composition/template/font/logo/Brand/Knowledge/prompt/policy/profile/rights/cost binding 任一变化都创建 new combined revision 并失效旧链。 |
| CL-26 | 首期没有独立 Brand 服务时，最小 BrandSnapshot authority 是 PostgreSQL 中 owner-scoped、exact `APPROVED` KnowledgeSnapshot 所绑定的唯一 `ORGANIZATION` profile revision；BrandSnapshot 由 exact Organization id/digest、组织名、品牌名、KnowledgeSnapshot id/digest 与真实 `approvedAt` 确定性派生并持久化。环境变量、请求 payload 或进程启动时间不能自证 `APPROVED`。 |
| CL-27 | 当前媒体治理只接受恰好一个 owner-scoped `APPROVED` KnowledgeSnapshot，且必须由 exact Owner 批准、无 gap、所有 source/profile binding digest 与 PostgreSQL authority 一致、source revision 为 `READY`、source document 未 tombstone、source Blob bytes/digest 可读。supersession、source tombstone/缺失、审批状态或 Organization profile binding 变化均使旧 v4 lineage stale 并阻止 Audit/Approve/Package。 |
| CL-28 | Media Secret 配置只产生 `SECRET_CONFIGURED/STARTING`，不能产生 Provider evidence。只有 PostgreSQL 持久化且未过期的 live canary PASS receipt，并能重读同一 Provider task、真实 raw/final Blob、profile/source/cost/rights lineage，才允许 `REAL_PROVIDER_CANARY_READY/providerEvidence=true`；failed、expired、缺 receipt、fingerprint 变化或 Blob 不可复核均 fail closed。 |
| CL-29 | Media SecretTicket v2 绑定 broker issuer、当前 Secret fingerprint、purpose、scope、issuedAt/expiry、nonce digest、canonical digest 与 HMAC signature；消费记录持久化于 PostgreSQL，伪造 digest/fingerprint、未来签发、过期及进程重启后的 replay 都拒绝。 |
| CL-30 | 下载器对每个 HTTPS hop 重新解析并审查地址集合，检测同 host DNS drift，并让实际 TLS 连接通过自定义 lookup 固定到已审查地址，同时保留原 hostname/SNI/证书校验；因此证据声明是“reviewed-address transport pinning”，不是仅凭独立 DNS 预解析推断阻止 rebinding。 |

无未决产品/架构/权限问题。实现选择 decoder/normalizer/compositor/archive/font/template/Logo 资产时仍需完成 exact version/digest/license/NOTICE/SBOM/security 决定；选择只能满足本规格，不能降低 AC。
