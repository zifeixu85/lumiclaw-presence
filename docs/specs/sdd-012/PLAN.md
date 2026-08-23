# SDD-012 implementation plan

> 本文件是未来 implementation Executor 的计划，不授权当前 specs task 开始实现。

## Critical path

```text
M5-08 runtime/Secret broker + M5-09 artifact/audit/package（均 EVIDENCE_READY）
→ provider-neutral media contracts + red tests
→ PG job/lease/UNKNOWN + Blob ingest/recovery
→ separate Media Secret Gate + controlled fake + real adapter
→ raw provider Blob + deterministic local composition + licensed Brand/Knowledge snapshot assets
→ combined ArtifactRevision v4 + audit/invalidation/package binary files
→ production Shell/API/browser
→ fresh Compose/security/license/rollback
→ Owner real Canary + visual/package UAT
→ SDD-011
```

## Implementation phases

1. 冻结 v2 MediaGenerationSpec/Job/RawAsset/CompositionSpec/CompositedAsset/Receipt 与 v4 Artifact/Package schemas、stable codes、source/profile/snapshot manifests；先写 tamper/concurrency/unknown/compositor red tests。
2. 增加 append-only migrations、repository、worker lease/reconcile、project-scoped staging 与 atomic raw/final content-addressed Blob ingest；覆盖五个 frozen crash stages。
3. 从 SDD-007 pattern 扩展独立 `MEDIA_PROVIDER` terminal gate/ticket；实现 deterministic 1080×1440 PNG fake 与首个 real provider adapter/polling，prompt policy 只生成无字背景/插画。
4. 冻结 compositor/decoder/normalizer/font/template/Logo exact dependencies、digests 与 licenses；实现 exact overlayCopy、safe area、字号/溢出、glyph/fallback/emoji、Logo、4.5:1 对比度和 `NO_OVERLAY` rules。
5. 将 complete ordered final MediaSet materialize 为 child XHS v4 revision；接 Brand/Knowledge snapshot invalidation、independent Audit、Owner exact decision、binary package streaming。
6. 接 production SaaS Shell zh-CN/en raw/final preview、composition/status/cost/rights/source/regeneration/recomposition impact/download；不用 Story/fixture 证明 runtime。
7. 跑 fresh PG/Blob/Compose、browser、SSRF/MIME/digest/composition/snapshot tamper、double worker、restart、license/SBOM/audit、backup/restore/rollback。
8. Owner 在 terminal 输入 media Secret，完成真实三图 Canary、raw/final 视觉验收、restart 与 package final file/digest 核对；产出中文 acceptance 与 STATUS_HANDOFF。

## Rollback principle

停止新 media dispatch、保留 jobs/raw+final assets/composition specs/Blob/append-only lineage；旧 app 对 v4 只读或显式拒绝，不得误报无媒体成功。populated migration down fail closed；使用独立 volume restore/forward-fix，不删除 Owner asset。
