import {describe, expect, it} from 'vitest';
import {DeepSeekModelProvider, PublicSafeMockModelProvider, type ModelGenerateRequest} from './model-provider.js';

const request: ModelGenerateRequest<{copy: string}> = {missionId: 'mission', taskId: 'task', model: 'deepseek-v4-flash', system: 'Return safe JSON.', input: {brief: 'synthetic'}, outputSchema: {type: 'object', additionalProperties: false, required: ['copy'], properties: {copy: {type: 'string'}}}, maxAttempts: 3, timeoutMs: 50};

describe('DeepSeek ModelProvider conformance', () => {
  it('validates structured output and records exact config/cost without a secret', async () => {
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', fetchImplementation: async () => new Response(JSON.stringify({choices: [{message: {content: '{"copy":"safe"}'}}], usage: {prompt_tokens: 100, completion_tokens: 50}}), {status: 200, headers: {'content-type': 'application/json'}})});
    const result = await provider.generateStructured(request); expect(result.ok).toBe(true); expect(result.snapshot).toMatchObject({provider: 'DEEPSEEK', model: 'deepseek-v4-flash', estimatedCostUsd: 0.000028, attempts: 1, secretPresent: false, error: null}); expect(JSON.stringify(result.snapshot)).not.toContain('fixture-credential');
  });
  it('retries only 429/5xx and never switches model', async () => {
    const seen: string[] = []; let count = 0; const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', delay: async () => {}, fetchImplementation: async (_url, init) => { seen.push(JSON.parse(String(init?.body)).model); count += 1; return count < 3 ? new Response('{}', {status: count === 1 ? 429 : 503}) : new Response(JSON.stringify({choices: [{message: {content: '{"copy":"ok"}'}}], usage: {prompt_tokens: 0, completion_tokens: 0}}), {status: 200}); }});
    const result = await provider.generateStructured(request); expect(result.ok).toBe(true); expect(result.snapshot.attempts).toBe(3); expect(seen).toEqual(['deepseek-v4-flash', 'deepseek-v4-flash', 'deepseek-v4-flash']);
  });
  it.each([['malformed', '{'], ['schema', '{"wrong":true}']])('fails explicit %s output', async (_label, content) => {
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', fetchImplementation: async () => new Response(JSON.stringify({choices: [{message: {content}}]}), {status: 200})}); const result = await provider.generateStructured(request); expect(result.ok).toBe(false); expect(result.snapshot.error?.code).toMatch(/^MODEL_(JSON_MALFORMED|SCHEMA_INVALID)$/u);
  });
  it('fails timeout explicitly after bounded attempts', async () => {
    const timeout = Object.assign(new Error('timeout'), {name: 'TimeoutError'}); const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', delay: async () => {}, fetchImplementation: async () => { throw timeout; }}); const result = await provider.generateStructured(request); expect(result.ok).toBe(false); expect(result.snapshot).toMatchObject({attempts: 3, error: {code: 'MODEL_TIMEOUT', retryable: true}});
  });
  it('caps caller-supplied retry, timeout, token and temperature config', async () => {
    const timeout = Object.assign(new Error('timeout'), {name: 'TimeoutError'}); let calls = 0;
    const provider = new DeepSeekModelProvider({apiKey: 'fixture-credential', delay: async () => {}, fetchImplementation: async () => { calls += 1; throw timeout; }});
    const result = await provider.generateStructured({...request, maxAttempts: 99, timeoutMs: 999_999, maxTokens: 999_999, temperature: 99});
    expect(result.ok).toBe(false); expect(calls).toBe(3); expect(result.snapshot.config).toEqual({temperature: 2, maxTokens: 65_536, responseFormat: 'json_object', timeoutMs: 120_000, maxAttempts: 3});
  });
  it('runs a clearly labeled no-key public-safe mock', async () => { const result = await new PublicSafeMockModelProvider({copy: 'fixture'}).generateStructured(request); expect(result.ok).toBe(true); expect(result.snapshot).toMatchObject({provider: 'PUBLIC_SAFE_MOCK', maturity: 'MOCK_CONFORMANCE', estimatedCostUsd: 0}); });
});
