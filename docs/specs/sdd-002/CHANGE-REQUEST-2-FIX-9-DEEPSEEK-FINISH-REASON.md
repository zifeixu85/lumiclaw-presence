# SDD-002 CR2 Fix 9 — DeepSeek finish-reason and deterministic structured mode

Status: `SPEC_READY`  
Date: `2026-08-05`  
Baseline: `41c2daaa7237a98e494ab70c3cbe7d7283be5b3b`

## Context

The eleventh Coordinator Canary proved Fix 8 in the real path: the Mission accepted five DeepSeek receipts, materialized four revisions and four audits, entered `REVISION_REQUIRED`, and imported the correction ACK. The sixth model request then failed closed as `PROVIDER_REQUEST / MODEL_FINISH_REASON_INVALID`. The receipt SHA-256 is `2cdab0c182d45fe8276b50ec579802626e4699b906e03654024569e24dbd1908`; ActionGrant, Connector and external-action counts remained zero and all owned cleanup passed. Because the old gateway collapsed every non-`stop` value, the historical exact finish reason is unrecoverable and is not inferred.

DeepSeek's official V4 Chat Completion contract, verified on 2026-08-05, defines `stop`, `length`, `content_filter`, `tool_calls` and `insufficient_system_resource`. It also defines `thinking.type` with default `enabled`; `disabled` selects non-thinking mode. JSON Output warns that `length` may contain partial content. The current gateway neither sends an explicit thinking mode nor distinguishes those stable finish reasons.

## Bounded change

1. Replace the generic non-stop outcome with a closed mapping:
   - `length` → `MODEL_OUTPUT_TRUNCATED`, non-retryable and never parsed;
   - `content_filter` → `MODEL_CONTENT_FILTERED`, non-retryable;
   - `tool_calls` → `MODEL_TOOL_CALL_FORBIDDEN`, non-retryable because this product exposes no Provider tools;
   - `insufficient_system_resource` → `MODEL_INFERENCE_RESOURCE_UNAVAILABLE`, retryable only within the existing `maxAttempts` bound using the identical canonical request;
   - null or unknown → `MODEL_FINISH_REASON_INVALID`, non-retryable.
2. Send `thinking: {type: 'disabled'}` for every structured DeepSeek request. Record `thinkingMode: 'disabled'` in the immutable config snapshot and bind the normalized config into `inputDigest` alongside system, input and output schema.
3. Preserve `maxTokens=4000` in the live domain path, the exact model, temperature/schema, timeout, attempt cap and no-switch rule. Partial JSON is never parsed or submitted.
4. Propagate only the new stable outcome codes through the existing ModelCallSnapshot, API failure, nested child envelope, evidence and manifest allowlists. Raw body/content, response ID, headers, ticket, bootstrap and Secret remain forbidden.

## Binary acceptance

1. A baseline red test demonstrates that the current gateway omits explicit non-thinking configuration and collapses all four official non-stop reasons.
2. Every official finish reason has an exact result: `stop` validates normally; length/filter/tool outcomes fail once and never parse partial content; resource interruption retries at most `maxAttempts`; null/unknown retain the generic invalid outcome.
3. A resource-interruption fixture followed by `stop` succeeds on attempt 2; exhaustion fails on the configured final attempt. Every captured request has the identical model, messages, thinking mode, max tokens, response format and canonical body.
4. `thinkingMode: disabled` is present in the request body and ModelCallSnapshot config, and changing that normalized config changes the bound input digest. No hidden default is accepted.
5. Provider/API/nested child diagnostics propagate each new code exactly and reject arbitrary/raw markers. The live path keeps `maxTokens=4000`, no Mock fallback and zero actions.
6. Fix 8 phase policy, exact six-member/eight-Task Runtime, independent Auditor and immutable revision/audit/review semantics remain green.
7. All required automated gates, Chinese acceptance report, clean committed Head, public-safe source ZIP and manifest pass. The twelfth real-key Canary remains Coordinator-owned; `LIVE_PROVIDER_VERIFIED` and `ACCEPTED` remain false until it passes.

## Out of scope / do not touch

- No reconstruction of the eleventh raw finish reason or model output.
- No Owner Secret access, real Provider call by Executor, tool calling, partial JSON acceptance, schema weakening, model switch or unbounded retry.
- No arbitrary `maxTokens` increase without a separate reproducible proof.
- No AgentTeams internal modification, ActionGrant, Connector, platform action, M3, Push, PR or Deploy.

## Rollback

Revert the Fix 9 commits. This restores the generic finish-reason behavior and implicit Provider thinking default; it does not change database migrations or create external compensation work because all M2 flows remain SHADOW/no-action.

## Official sources

- `https://api-docs.deepseek.com/api/create-chat-completion`
- `https://api-docs.deepseek.com/guides/thinking_mode`
- `https://api-docs.deepseek.com/quick_start/pricing`
