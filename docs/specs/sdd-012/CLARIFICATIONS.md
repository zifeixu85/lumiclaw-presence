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

无未决产品/架构/权限问题。实现选择 decoder/normalizer/compositor/archive/font/template/Logo 资产时仍需完成 exact version/digest/license/NOTICE/SBOM/security 决定；选择只能满足本规格，不能降低 AC。
