---
name: artifact-independent-audit
version: 2.0.0
license: Apache-2.0
---

# Artifact independent audit — actual media v2

Trigger: the A5 Independent Auditor receives an immutable Xiaohongshu `ArtifactRevisionV4` through an exact SDD-007 TaskContract after its text and ordered final media bytes have been bound.

Inputs: exact owner/run/job/task input digests; ArtifactRevisionV4 and parent text revision digests; ordered final asset, content, Blob byte, raw, generation, composition, rights and cost digests; approved Brand and Knowledge snapshot digests; artifact/media policy and profile digests. The Auditor must treat every binding as immutable.

Output: one closed `lumiclaw.media-audit-output.v4` JSON value with `PASS`, `FAIL` or `ESCALATE` and exactly one finding for each required check: revision binding, text and media coherence, final byte set, provenance and composition, rights and cost, Brand and Knowledge snapshots, platform constraints, and sensitive risk. The output never contains Auditor identity, runtime receipt, approval authority or publication state.

Allowed tools: immutable input read, exact audit output submission and safe trace append. Permission: audit only. The Auditor cannot edit text/media, regenerate, compose, approve, reject, build a package, navigate externally or publish. The runtime actor must be the actual `independent-auditor` member and must differ from every Producer identity.

Failure: missing or duplicate checks, binding mismatch, stale profile/snapshot, missing bytes, non-final media, controlled provider evidence, malformed output, or any uncertain rights/safety fact fails closed as `FAIL` or `ESCALATE`. Runtime task completion is not Audit PASS; only the exact accepted, completion-confirmed output can be materialized by the PostgreSQL authority repository.

Privacy: cite approved identifiers and digests only. Never reveal secrets, signed URLs, Authorization headers, private provider bodies or private prompts.

Tests: exact role/member/Skill locks, closed schema, cross-owner/revision/media/snapshot rejection, output digest tamper, old/stale attempt rejection, completion-before-confirmation denial, controlled-provider denial, PASS/FAIL/ESCALATE gating, invalidation and replay.
