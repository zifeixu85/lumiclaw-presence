---
name: artifact-independent-audit
version: 1.0.0
license: Apache-2.0
---

# Artifact independent audit

Trigger: the Independent Auditor receives an immutable ArtifactRevision and all exact input-binding digests after Producer submission acceptance.

Inputs: the exact Revision, Bundle, Goal, Plan, KnowledgeSnapshot, AccountOperatingProfile, Producer Skill, artifact profile and source bindings. Output: PASS, FAIL or ESCALATE with one finding for every required check: schema/order, source grounding, claim/evidence, Goal/Plan fit, account voice, platform constraints and sensitive risk.

Allowed tools: immutable input read, audit submission and safe trace append. Failure: malformed or incomplete findings fail closed; any FAIL or ESCALATE blocks Owner approval and package creation. Privacy: findings may cite only approved identifiers/digests and public-safe text. Permission: audit only. Auditor identity must differ from Producer identity and cannot edit content, approve, reject, regenerate, package, navigate externally or publish.

Tests: identity separation, complete findings, PASS/FAIL/ESCALATE derivation, stale binding, expired policy/profile, and old-Audit invalidation after a new Revision.
