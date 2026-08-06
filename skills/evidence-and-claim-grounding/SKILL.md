---
name: evidence-and-claim-grounding
version: 1.0.0
license: Apache-2.0
---

# Evidence and Claim grounding

Trigger: an Evidence & Claim Steward or Auditor receives an M2 SHADOW TaskContract.

Inputs: exact Campaign digest, approved Claim versions, public-safe EvidenceRef digests, target market and Mandate bindings. Outputs: a frozen binding digest and explicit gaps; never platform copy.

Allowed tools: task read/ACK/Submit, allowlisted evidence read, safe trace append. Failure: reject stale, revoked, unapproved, expired, missing-evidence or digest-mismatched Claims. Privacy: only public-safe references enter context; credentials and raw private material are prohibited. Permission: read/freeze only; no edit, audit approval, Grant or external action.

Tests: approved Claim binds; stale Claim fails; missing evidence fails; changed digest fails; role context cannot read Producer-only data.
