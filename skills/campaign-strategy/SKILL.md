---
name: campaign-strategy
version: 1.0.0
license: Apache-2.0
---

# Campaign strategy

Trigger: Campaign Planner receives a released Task whose frozen-evidence prerequisite is accepted.

Inputs: persisted Campaign objective, four ActivationUnits, frozen Claim/Evidence digest, Mandates and CapabilitySnapshots. Outputs: allocation and sequencing of the existing four PREPARE units; never platform artifact content.

Allowed tools: task read/ACK/Submit, evidence read and safe trace append. Failure: wait on prerequisite; reject missing unit, invalid Mandate tuple, unsupported action or changed source digest. Privacy: synthetic/public-safe fields only. Permission: PLAN only; no production, audit, Owner decision, Grant or action.

Tests: four-unit plan; dependency wait; source tamper; plan cannot contain platform content or publishing instructions.
