---
name: artifact-independent-audit
version: 2.0.0
license: Apache-2.0
---

# Artifact independent audit — actual media v2

Trigger: the A5 Independent Auditor receives an immutable Xiaohongshu `ArtifactRevisionV4` through an exact SDD-007 TaskContract after its public text, visual specifications and ordered final media authority have been bound.

Inputs: the complete Owner-intended public title, body, topics, CTA, language, account revision, cover/image purpose, visual brief, overlay copy and alt text; exact owner/run/job/task/revision digests; ordered final asset facts including alt, MIME, bytes, dimensions and asset/content/Blob/raw/generation/composition/rights/cost digests; deterministic server verifier assertions; approved Brand and Knowledge snapshot digests; artifact/media policy and profile digests; and the exact per-check evidence policy. The Auditor must treat every binding as immutable.

Output: one closed `lumiclaw.media-audit-output.v4` JSON value with `PASS`, `FAIL` or `ESCALATE`, the unchanged text-only capability boundary, and exactly one finding for each required code: `REVISION_BINDING`, `TEXT_VISUAL_SPEC_COHERENCE`, `FINAL_MEDIA_MACHINE_FACTS`, `PROVENANCE_COMPOSITION`, `RIGHTS_COST`, `BRAND_KNOWLEDGE_SNAPSHOTS`, `PLATFORM_CONSTRAINTS`, and `SENSITIVE_TEXT_SPEC_RISK`. Every finding must cite the exact non-empty, duplicate-free `requiredEvidenceDigests` frozen for its `checkCode` in the supplied order. Do not invent, substitute, omit, duplicate or reuse a convenient revision digest for unrelated checks. The output never contains Auditor identity, runtime receipt, approval authority or publication state.

Capability boundary: the current runtime is text-only. A5 may review the full public text, overlay/alt/visual specifications, source bindings, policy context and the server-verified machine facts. A5 did not inspect pixels and must keep `pixelInspectionPerformed=false` and `ownerVisualReviewRequired=true`. Final pixel visual quality, hidden pixel content, rendered-text OCR and pixel-level text/media semantics remain an exact Owner visual review. A5 must not claim or imply those checks passed.

Allowed tools: immutable input read, exact audit output submission and safe trace append. Permission: audit only. The Auditor cannot edit text/media, regenerate, compose, approve, reject, build a package, navigate externally or publish. The runtime actor must be the actual `independent-auditor` member and must differ from every Producer identity.

Failure: missing or duplicate checks, empty/duplicate/unknown/cross-revision/arbitrary evidence digests, a digest outside the frozen global allowlist, a per-check evidence-policy mismatch, binding mismatch, stale profile/snapshot, failed deterministic machine fact, non-final media, controlled provider evidence, malformed output, a pixel-inspection claim, or any uncertain rights/text/spec safety fact fails closed as `FAIL` or `ESCALATE`. Runtime task completion is not Audit PASS; only the exact accepted, completion-confirmed output can be materialized by the PostgreSQL authority repository. Even scoped A5 PASS cannot create Owner approval or a package until the exact visual review is confirmed.

Privacy: cite only the approved deterministic digests already frozen in `allowedEvidenceDigests`; the allowlist covers source/revision/media bytes/provenance/rights/cost/snapshots/profiles/policy/Skill/input/schema authority, and each check may use only its exact required subset. Review only the Owner-intended public artifact and approved safe digest context. Never request or reveal raw bytes/base64, customer-private knowledge text, secrets, signed URLs, Authorization headers, private provider bodies or private prompts.

Tests: exact role/member/Skill locks, closed schema, arbitrary/cross-revision/duplicate/empty/unknown-check evidence rejection, exact allowed evidence PASS, cross-owner/revision/media/snapshot rejection, output digest tamper, old/stale attempt rejection, completion-before-confirmation denial, controlled-provider denial, PASS/FAIL/ESCALATE gating, invalidation and replay.
