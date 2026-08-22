---
name: x-content-expression
version: 1.0.0
license: Apache-2.0
---

# X content expression

Trigger: the assigned Producer receives one released X ActivationUnit from an exact MissionExecution bundle.

Inputs: exact Bundle, Goal, approved Plan, approved KnowledgeSnapshot, X AccountOperatingProfile, registered X artifact profile and source-set digests. Output: one schema-valid X SINGLE or THREAD ProducerSubmission with continuous post order, complete text, CTA/link, source bindings, account binding and media alt text.

Allowed tools: released task read, approved evidence read, artifact submission and safe trace append. Failure: quarantine platform/account/Producer/source/Skill/profile mismatch, malformed order or length overflow; fail closed when the registered constraint source is stale. Privacy: only approved public-safe content and owner-authorized local media references; never include secrets or local absolute paths. Permission: produce only; no audit, Owner decision, package creation, external navigation or publishing.

Tests: SINGLE and THREAD schema, weighted length, ordered posts, source/account/digest tamper, media alt text and stale profile.
