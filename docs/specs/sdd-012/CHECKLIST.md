# SDD-012 中文规格 Review Checklist

## 产品与范围

- [x] 用户断点是“只有 image specs / `generatedMedia=false`”，不是重新设计 SDD-010 文案工作区。
- [x] 实际图片 → combined revision → independent Audit → exact Owner approval → binary package 的用户链完整。
- [x] 自动发布、OAuth、Cookie、DOM automation、移动端、法律保证和无限平台扩展明确排除。
- [x] SDD-012 是 SDD-011 硬前置；Proposed `M5-11` 不修改 canonical status。

## Provider、Secret 与费用

- [x] `MediaGenerationProvider` 可替换，EvoLink 名称不进入 core domain/error enum。
- [x] current placeholder 与 real implementation/live maturity 分开写明，没有把 class 名冒充 adapter maturity。
- [x] controlled fake、real Canary、Owner UAT 三种 maturity 分离。
- [x] Model/Media Secret Gate purpose、ticket、readiness 和 canary 独立；Secret 排除面完整。
- [x] task submit intent、provider task、reserved/final/unverified cost、UNKNOWN 和防重复计费可二元测试。
- [x] 官方 endpoint/task/24h temp URL/terms 仅来自当前一手来源，checkedAt 已登记；未核实权利/质量/actual charge 不作事实。

## 图片、资产与治理

- [x] 1080×1440、3:4、PNG/JPEG/WebP、`bytes > 0 && bytes <= 10 MiB`、ordered positions、cover/alt text 是精确合同；10 MiB 仅为内部上限，小于 1 MiB 合法。
- [x] HTTPS/SSRF/redirect/size/magic/MIME/decode/dimension/metadata/digest/atomic Blob gate 完整。
- [x] temp URL 不是资产；content digest 是 Blob identity，business lineage 不因 bytes 去重而合并。
- [x] Provider 只生成无关键标题文字的 raw 背景/插画；exact overlayCopy 由 deterministic local compositor 渲染，只有 final digest 可审校/批准/打包。
- [x] raw/final 分别持久化 lineage；safe area、字号/溢出、缺字/fallback/emoji、Logo 比例和 4.5:1 对比度都有 fail-closed AC。
- [x] compositor/font/template/Logo exact version/digest/license/NOTICE/SBOM gate 完整，不依赖系统/CDN 字体或浏览器 canvas。
- [x] `NO_OVERLAY` 只在 overlayCopy=null 且 Owner exact decision 记录时允许，仍保留 final composition node。
- [x] template/brand color/Logo 绑定 exact approved Brand/Knowledge snapshot；snapshot 变化使 media revision 及下游链失效。
- [x] source prompt/policy/profile/version/checkedAt/expiry、rights/cost/task lineage 完整且 public/private 投影明确。
- [x] media change 必须创建 child ArtifactRevision v4，并失效 Audit/OwnerDecision/Package。
- [x] Producer/Auditor/Owner/deterministic operator 权限边界和 no-`PUBLISHED` 不可破坏。
- [x] ManualPublishPackage v4 包含实际 image files 与 exact manifest，而非 URL/specs/base64-in-PG。

## UI、测试、证据与回滚

- [x] production SaaS Shell 显示 actual preview、running/failure/recovery、费用、权利来源、失效影响与实际下载；Story 不能冒充。
- [x] fresh PG/Blob、Compose、browser、tamper、concurrency、五个 frozen crash stages、composition determinism、license/security、backup/restore/rollback 全覆盖。
- [x] Owner UAT 明确 terminal real Secret、no-Secret、独立 gate、视觉验收、restart 与 package file/digest 核对。
- [x] evidence/public claim/非声明和最高成熟度边界清楚。
- [x] v3 compatibility、populated down refusal、old-app explicit refusal/read-only 规则明确。

结论：`PASS / SPEC_READY`。Implementation 前仍需按已冻结 gate 选择具体 decoder/normalizer/compositor/archive/font/template/Logo assets；这些依赖决定不改变本规格 AC，只能选择满足它的实现。
