# SDD-002 CR2 Fix 7 — Founder frozen-fault contract alignment

Status: `SPEC_READY` after Coordinator evidence `COORDINATOR_FIX_REQUEST_7` and the public-safe source-inspection hint on 2026-08-05.

## Verified current state

The eighth Coordinator Canary on clean Head `e0444b438790e053f065af04e0c9c865ad6c81cc` again completed the pinned six-member AgentTeams Project/DAG/member dispatch, persisted five DeepSeek `ModelCallSnapshot` records, and completed AgentTeams submit/check for the independent `AUDIT_REVISIONS` Task. Control Plane `TASK_SUBMIT` rejected the import with `LIVE_SUBMISSION_DOMAIN_INVARIANT_INVALID`; the strict receipt retained five model receipts, zero ActionGrant/Connector/external action and complete owned cleanup. No raw model output is available or required, so this event does not prove which legal-looking value the Provider returned and is not `LIVE_PROVIDER_VERIFIED`.

Public-safe source comparison proves a remaining cross-boundary contract gap independent of that unavailable response. `liveModelGenerationSchema(PRODUCE_FOUNDER)` accepts any closed X content with one or more string posts, and `normalizeLiveRoleOutput` accepts the same shape. `materializeAcceptedRuntimeProgress` later requires the persisted X v1 text to contain the frozen phrase `generally available` before the already-closed independent X FAIL can materialize. A Founder output that omits, paraphrases, splits or places the phrase outside an X post can therefore be Provider-schema-valid and normalize-valid, then fail only at the fifth Auditor import as `RUNTIME_FROZEN_FAULT_INVALID`.

This is a reproducible implementation defect class. It must not be represented as the raw historical eighth-Canary cause.

## Bounded correction

- Add a public-safe deterministic production-API regression that sends a Founder output admitted by the current generation boundary but lacking the frozen phrase, continues through the exact five model snapshots and independent Auditor `TASK_SUBMIT`, and proves the old late `RUNTIME_FROZEN_FAULT_INVALID` boundary.
- Define one governed frozen-fault phrase invariant and apply it consistently to the Founder task-specific generation schema, semantic normalizer and final materializer. The schema must require one X post to contain the exact two-word phrase with the same ASCII case-insensitive semantics as the domain check.
- Reject omission, paraphrase, word-order changes, inter-word punctuation, splitting across posts, placement only in `altText` or Xiaohongshu content, Unicode lookalikes and unknown fields. Accept the phrase embedded in a longer X post and ordinary ASCII case variants.
- Keep the independent Auditor's exact X FAIL plus evidence-bound `CLAIM_OVERREACH` issue unchanged. Do not weaken materialization, invent/coerce model text, or ask the model for revision numbers or digests.
- Keep the existing allowlisted `LIVE_SUBMISSION_DOMAIN_INVARIANT_INVALID` diagnostic. This Fix adds no raw-output diagnostic and no new external or privileged action path.

## Binary acceptance additions

1. A baseline-compatible public-safe production-API fixture proves the old legal-output difference reaches five model snapshots and fails at independent Auditor `TASK_SUBMIT` with `RUNTIME_FROZEN_FAULT_INVALID`.
2. After the fix, every enumerated phrase omission/paraphrase/placement mutation is rejected during the Founder model boundary as `LIVE_MODEL_SEMANTIC_OUTPUT_INVALID`; Auditor generation/import is never reached and no payload is coerced.
3. Founder generation accepts both exact platform orderings and ASCII case variants of the frozen phrase, while rejecting duplicate/wrong platforms, platform/content mismatch, missing/extra items and unknown fields as before.
4. Generation schema, normalization and materialization use one explicit frozen-fault invariant. Table/property-style tests prove there is no known Founder value accepted upstream and rejected by that downstream phrase condition.
5. Correct public-safe initial Audit import still records five model snapshots, four immutable revisions/audits, exact X FAIL and other-platform PASS decisions, then enters `REVISION_REQUIRED` with every action count zero.
6. Focused/full tests, Provider conformance, PostgreSQL production import, public-safe real AgentTeams six/eight, no-Secret Live, browser/build/security/evidence and clean-Head source package pass.
7. The ninth real-key Canary remains Coordinator-owned. `LIVE_PROVIDER_VERIFIED` and `ACCEPTED` remain false until that independent run completes all seven domain receipts and exact Owner Review.

## Out of scope

Owner Secret or raw model/prompt/header/ticket/bootstrap access, reconstructing or claiming the eighth response, content quality tuning beyond the frozen invariant, weakening downstream audit/materialization, AgentTeams internals, external platform actions, M3, Push/PR/Deploy and canonical status edits remain prohibited.
