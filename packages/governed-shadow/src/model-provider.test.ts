import {describe, expect, it} from 'vitest';
import {DeepSeekModelProvider, PublicSafeMockModelProvider, type ModelGenerateRequest} from './model-provider.js';

const request: ModelGenerateRequest<{copy: string}> = {missionId: 'mission', taskId: 'task', model: 'deepseek-v4-flash', system: 'Return safe JSON.', input: {brief: 'synthetic'}, outputSchema: {type: 'object', additionalProperties: false, required: ['copy'], properties: {copy: {type: 'string'}}}, maxAttempts: 3, timeoutMs: 50};
const response = (content = '{"copy":"safe"}', overrides: Record<string, unknown> = {}) => ({id: 'chatcmpl-fixture', model: 'deepseek-v4-flash', system_fingerprint: 'fixture-fingerprint', choices: [{finish_reason: 'stop', message: {content}}], usage: {prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 20, prompt_cache_miss_tokens: 80, completion_tokens_details: {reasoning_tokens: 10}}, ...overrides});

describe('DeepSeek ModelProvider conformance', () => {
  it('validates structured output and records exact config/cost without a secret', async () => {
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response(JSON.stringify(response()), {status: 200, headers: {'content-type': 'application/json'}})});
    const result = await provider.generateStructured(request); expect(result.ok).toBe(true); expect(result.snapshot).toMatchObject({provider: 'DEEPSEEK', maturity: 'MOCK_CONFORMANCE', model: 'deepseek-v4-flash', response: {id: 'chatcmpl-fixture', actualModel: 'deepseek-v4-flash', systemFingerprint: 'fixture-fingerprint', finishReason: 'stop'}, pricing: {source: 'DEEPSEEK_OFFICIAL_2026-08-04', inputCacheHitUsdPerMillion: 0.0028, inputCacheMissUsdPerMillion: 0.14, outputUsdPerMillion: 0.28, peakMultiplierNotApplied: true}, tokenUsage: {input: 100, output: 50, cacheHit: 20, cacheMiss: 80, reasoning: 10}, estimatedCostUsd: 0.000025256, attempts: 1, secretPresent: false, error: null}); expect(JSON.stringify(result.snapshot)).not.toContain('fixture-credential');
  });
  it('records the exact pro cache-hit/miss/output cost snapshot', async () => {
    const proRequest = {...request, model: 'deepseek-v4-pro' as const};
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response(JSON.stringify(response(undefined, {model: 'deepseek-v4-pro'})), {status: 200})});
    const result = await provider.generateStructured(proRequest);
    expect(result.ok).toBe(true); expect(result.snapshot).toMatchObject({pricing: {inputCacheHitUsdPerMillion: 0.003625, inputCacheMissUsdPerMillion: 0.435, outputUsdPerMillion: 0.87}, tokenUsage: {input: 100, output: 50, cacheHit: 20, cacheMiss: 80}, estimatedCostUsd: 0.0000783725});
  });
  it('prices all prompt tokens as cache misses when the optional breakdown is wholly absent', async () => {
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response(JSON.stringify(response(undefined, {usage: {prompt_tokens: 100, completion_tokens: 50}})), {status: 200})});
    const result = await provider.generateStructured(request);
    expect(result.ok).toBe(true); expect(result.snapshot).toMatchObject({tokenUsage: {input: 100, output: 50, cacheHit: 0, cacheMiss: 100}, estimatedCostUsd: 0.000028});
  });
  it('retries only 429/5xx and never switches model', async () => {
    const seen: string[] = []; let count = 0; const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', delay: async () => {}, fetchImplementation: async (_url, init) => { seen.push(JSON.parse(String(init?.body)).model); count += 1; return count < 3 ? new Response('{}', {status: count === 1 ? 429 : 503}) : new Response(JSON.stringify(response('{"copy":"ok"}', {usage: {prompt_tokens: 0, completion_tokens: 0}})), {status: 200}); }});
    const result = await provider.generateStructured(request); expect(result.ok).toBe(true); expect(result.snapshot.attempts).toBe(3); expect(seen).toEqual(['deepseek-v4-flash', 'deepseek-v4-flash', 'deepseek-v4-flash']);
  });
  it.each([['malformed', '{'], ['schema', '{"wrong":true}']])('fails explicit %s output', async (_label, content) => {
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response(JSON.stringify(response(content)), {status: 200})}); const result = await provider.generateStructured(request); expect(result.ok).toBe(false); expect(result.snapshot.error?.code).toMatch(/^MODEL_(JSON_MALFORMED|SCHEMA_INVALID)$/u);
  });
  it('fails timeout explicitly after bounded attempts', async () => {
    const timeout = Object.assign(new Error('timeout'), {name: 'TimeoutError'}); const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', delay: async () => {}, fetchImplementation: async () => { throw timeout; }}); const result = await provider.generateStructured(request); expect(result.ok).toBe(false); expect(result.snapshot).toMatchObject({attempts: 3, error: {code: 'MODEL_TIMEOUT', retryable: true}});
  });
  it('caps caller-supplied retry, timeout, token and temperature config', async () => {
    const timeout = Object.assign(new Error('timeout'), {name: 'TimeoutError'}); let calls = 0;
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', delay: async () => {}, fetchImplementation: async () => { calls += 1; throw timeout; }});
    const result = await provider.generateStructured({...request, maxAttempts: 99, timeoutMs: 999_999, maxTokens: 999_999, temperature: 99});
    expect(result.ok).toBe(false); expect(calls).toBe(3); expect(result.snapshot.config).toEqual({temperature: 2, maxTokens: 65_536, responseFormat: 'json_object', timeoutMs: 120_000, maxAttempts: 3});
  });
  it('runs a clearly labeled no-key public-safe mock', async () => { const result = await new PublicSafeMockModelProvider({copy: 'fixture'}).generateStructured(request); expect(result.ok).toBe(true); expect(result.snapshot).toMatchObject({provider: 'PUBLIC_SAFE_MOCK', maturity: 'MOCK_CONFORMANCE', estimatedCostUsd: 0}); });
  it.each([
    ['MODEL_RETURNED_MODEL_MISMATCH', response(undefined, {model: 'deepseek-v4-pro'})],
    ['MODEL_FINISH_REASON_INVALID', response(undefined, {choices: [{finish_reason: 'length', message: {content: '{"copy":"partial"}'}}]})],
    ['MODEL_FINISH_REASON_INVALID', response(undefined, {choices: [{finish_reason: 'content_filter', message: {content: '{"copy":"partial"}'}}]})],
    ['MODEL_FINISH_REASON_INVALID', response(undefined, {choices: [{finish_reason: null, message: {content: '{"copy":"partial"}'}}]})],
    ['MODEL_RESPONSE_IDENTITY_INVALID', response(undefined, {id: undefined})],
    ['MODEL_RESPONSE_IDENTITY_INVALID', response(undefined, {model: undefined})],
    ['MODEL_USAGE_INVALID', response(undefined, {usage: {prompt_tokens: -1, completion_tokens: 2}})]
  ])('rejects response provenance defect %s', async (code, payload) => {
    const result = await new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response(JSON.stringify(payload), {status: 200})}).generateStructured(request);
    expect(result.ok).toBe(false); expect(result.snapshot.error?.code).toBe(code);
  });
  it.each([
    ['contradictory breakdown', {prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 20, prompt_cache_miss_tokens: 79}],
    ['cache hit without miss', {prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 20}],
    ['cache miss without hit', {prompt_tokens: 100, completion_tokens: 50, prompt_cache_miss_tokens: 80}]
  ])('rejects %s instead of silently underestimating cost', async (_label, usage) => {
    const payload = response(undefined, {usage});
    const result = await new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response(JSON.stringify(payload), {status: 200})}).generateStructured(request);
    expect(result.ok).toBe(false); expect(result.snapshot).toMatchObject({tokenUsage: null, estimatedCostUsd: null, error: {code: 'MODEL_USAGE_INVALID', retryable: false}});
  });
  it('allows CANARY only through the official non-injected transport', () => {
    expect(() => new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'CANARY', baseUrl: 'https://example.invalid'})).toThrow('DEEPSEEK_CANARY_REQUIRES_OFFICIAL_LIVE_TRANSPORT');
    expect(() => new DeepSeekModelProvider({apiKey: 'fixture-credential', executionClass: 'CANARY', fetchImplementation: async () => new Response('{}')})).toThrow('DEEPSEEK_CANARY_REQUIRES_OFFICIAL_LIVE_TRANSPORT');
  });
});
