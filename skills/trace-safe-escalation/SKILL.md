---
name: trace-safe-escalation
version: 1.0.0
license: Apache-2.0
---

# Trace-safe escalation

Trigger: every M2 role records a business event, failure, retry, timeout, recovery or escalation.

Inputs: allowlisted identifiers, state codes and digests. Outputs: append-only business label, redacted detail and chained ledger digest.

Allowed tools: safe trace append only for normal agents; runtime reconciliation additionally reads task status. Failure: reject or redact keys named authorization, key, token, secret or cookie; report unknown state rather than infer success. Privacy: no prompt body, provider secret, private evidence or raw Matrix message. Permission: observation only; trace never changes Claim, Revision, Audit, Owner decision, Grant or action.

Tests: secret-name redaction, ledger chain, restart replay, duplicate Submit quarantine and unknown runtime state.
