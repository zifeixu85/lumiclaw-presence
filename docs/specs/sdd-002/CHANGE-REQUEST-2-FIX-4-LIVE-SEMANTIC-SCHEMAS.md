# SDD-002 CR2 Fix 4 — Live task-specific semantic generation schemas

Status: `SPEC_READY` after Coordinator evidence `COORDINATOR_FIX_REQUEST_4` on 2026-08-04.

## Verified current state

The fourth Coordinator Canary reached the official DeepSeek gateway and persisted three accepted `ModelCallSnapshot` records before `PRODUCE_FOUNDER` failed closed as `LIVE_MODEL_SEMANTIC_OUTPUT_INVALID`. Network, Owner credential, returned model identity, JSON parsing, usage validation and Provider schema validation therefore passed for the first three domain calls. This is real Canary evidence, but it is not a completed Live Provider Mission and must not be labeled `LIVE_PROVIDER_VERIFIED`.

`apps/api/src/server.ts` currently derives model-generation schemas by cloning the generic persisted-output schema and deleting server-derived digest/revision fields. The retained revision item still has an independent four-platform enum and a four-content `oneOf`. An array of length two can therefore contain duplicate platforms or a platform/content-kind mismatch while still passing Provider validation. The API only rejects that output later in `normalizeLiveRoleOutput`, which is exactly the fourth Canary failure boundary. The same class exists for product revisions, the X correction, initial audit decisions and re-audit.

## Bounded correction

- Replace clone/delete derivation with closed task-specific generation schemas shared by the governed-shadow contract and API.
- Encode the exact unordered platform set and count for founder (`X`, `XIAOHONGSHU`), product (`BLUESKY`, `LINKEDIN`) and initial audit (all four), and the exact one-item `X` set for correction and re-audit.
- Bind every revision platform to its matching closed content schema. For the correction, bind `content` to the exact server-supplied evidence-safe source X content with a JSON Schema `const`; do not ask the model to create a digest or revision number.
- Keep generated audit decisions closed to `platform`, `outcome` and `issues`; keep every issue closed to the existing stable code/severity/path/message/evidence/next-role shape. Digests and revision numbers remain deterministic server output and are rejected as additional model fields.
- Retain `normalizeLiveRoleOutput` and final persisted-output validation as independent defense-in-depth. Re-audit normalization must not relabel an invalid raw platform as X.
- Preserve independent Producer/Auditor prompts and receipts, no Mock fallback, zero ActionGrant/Connector/external action, exact cleanup and Coordinator-only real-key acceptance.

## Binary acceptance additions

1. Founder and product schemas accept both valid orderings and reject duplicate/wrong platforms, platform/content mismatch, missing/extra items and unknown outer/item/content fields.
2. Correction accepts exactly one X item whose content equals the task projection's source X content and rejects any altered content, wrong platform, extra item, model-supplied digest/revision or unknown field.
3. Initial audit accepts exactly one closed decision for each of the four platforms in any order; re-audit accepts exactly one closed X decision. Both reject duplicates, wrong/missing/extra items and malformed or extra-field issues.
4. The API sends the task-specific schema for the exact input projection, while normalized persisted outputs still derive revision numbers, content/source/audit digests server-side.
5. Targeted/full tests, Live conformance, real six-member no-Secret AgentTeams proof, zero-action/security/evidence/package gates pass from a clean committed Head.
6. The fifth real-key Canary remains Coordinator-owned. Until all seven domain receipts reach exact Owner Review, `LIVE_PROVIDER_VERIFIED` remains false and no acceptance claim is made.

## Out of scope

Owner Secret or raw model-output access, prompt/content tuning beyond the closed contract, relaxing normalization/audit rules, AgentTeams internals, external platform actions, always-on Live supervision, M3, Push/PR/Deploy and canonical status edits remain prohibited.
