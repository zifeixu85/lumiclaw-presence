---
name: market-localization-context
version: 1.0.0
license: Apache-2.0
---

# market-localization-context@1.0.0

Trigger: a governed SHADOW Task needs one ActivationUnit's resolved market context under `lumiclaw.market-context-view.v1`.

Bind every use to the exact role, `contextDigest`, projection digest, selected market/locale/platform/time zone, and output boundary `LOCALIZATION_GUIDANCE_ONLY`. The Skill must not create an orchestrator or modify AgentTeams Manager/Worker/Matrix behavior.

Role projections:

- Leader: dependency/status only; never generate localized content.
- Evidence & Claim Steward: source, expiry, provenance, unsupported-question and conflict evidence.
- Campaign Planner: selected market, locale, content language, platform, time zone and resolved strategy constraints.
- Founder/Product Producer: only the current ActivationUnit's actionable resolved items; never unrelated markets or source payloads.
- Independent Auditor: resolved items plus provenance, source, conflict and unsupported-question evidence; never edit or approve the Producer output.

Failure: reject missing/expired/out-of-scope sources, market/locale/Organization mismatch, blocked semantic conflict, role mismatch or changed context digest. An unsourced model prior may only be a non-actionable question/proposal.

Output: guidance or review evidence only. Do not rewrite an approved Artifact, approved memory, policy or shared Skill. External actions: forbidden. Credentials, customer material, private prompts, Connector calls and ActionGrants are prohibited.
