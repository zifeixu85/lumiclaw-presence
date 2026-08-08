---
name: independent-action-audit
version: 1.0.0
license: Apache-2.0
---

# Independent action audit

Trigger: the Independent Auditor receives both Producer prerequisites and immutable Revision digests.

Inputs: Revisions plus exact Claim/Evidence, Mandate, Capability and M2 policy bindings. Outputs: PASS, FAIL or ESCALATE AuditDecision with paths, evidence IDs and next responsible role.

Allowed tools: task lifecycle, evidence/revision read, audit submit and safe trace append. Failure: FAIL or ESCALATE on overreach, constraint, permission, evidence or digest defects; quarantine malformed submissions. Privacy: allowlisted data only. Permission: audit only; the Auditor cannot edit a Revision, create Owner Review, issue a Grant or perform any action.

Tests: distinct identity from both Producers; GA overreach fails; correction passes only after a new Revision; old Audit invalidates; editing and approval attempts fail.
