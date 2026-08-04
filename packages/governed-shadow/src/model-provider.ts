import {createUuidV7, sha256Digest} from '@lumiclaw/domain';
import {Ajv} from 'ajv';
import type {ModelCallSnapshot} from './types.js';

export const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type DeepSeekModel = typeof DEEPSEEK_MODELS[number];
export type ModelGenerateRequest<T> = {
  missionId: string;
  taskId: string;
  model: DeepSeekModel;
  system: string;
  input: unknown;
  outputSchema: Record<string, unknown> & {readonly __outputType?: T};
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
};
export type ModelGenerateResult<T> = {ok: true; value: T; snapshot: ModelCallSnapshot} | {ok: false; snapshot: ModelCallSnapshot};

export interface ModelProvider {
  generateStructured<T>(request: ModelGenerateRequest<T>): Promise<ModelGenerateResult<T>>;
}

type GatewayOptions = {
  apiKey: string;
  executionClass: 'MOCK_CONFORMANCE' | 'CANARY';
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
  delay?: (milliseconds: number) => Promise<void>;
};

const RATES: Record<DeepSeekModel, {inputCacheHit: number; inputCacheMiss: number; output: number}> = {
  'deepseek-v4-flash': {inputCacheHit: 0.0028, inputCacheMiss: 0.14, output: 0.28},
  'deepseek-v4-pro': {inputCacheHit: 0.003625, inputCacheMiss: 0.435, output: 0.87}
};

export class DeepSeekModelProvider implements ModelProvider {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #delay: (milliseconds: number) => Promise<void>;
  readonly #executionClass: 'MOCK_CONFORMANCE' | 'CANARY';

  constructor(options: GatewayOptions) {
    if (options.apiKey.trim().length === 0) throw new Error('DEEPSEEK_API_KEY_REQUIRED');
    this.#apiKey = options.apiKey; this.#baseUrl = options.baseUrl ?? 'https://api.deepseek.com'; this.#executionClass = options.executionClass;
    if (this.#executionClass === 'CANARY' && (new URL(this.#baseUrl).origin !== 'https://api.deepseek.com' || options.fetchImplementation !== undefined)) throw new Error('DEEPSEEK_CANARY_REQUIRES_OFFICIAL_LIVE_TRANSPORT');
    if (this.#executionClass === 'MOCK_CONFORMANCE' && options.fetchImplementation === undefined) throw new Error('DEEPSEEK_MOCK_CONFORMANCE_REQUIRES_INJECTED_TRANSPORT');
    this.#fetch = options.fetchImplementation ?? fetch; this.#now = options.now ?? (() => new Date());
    this.#delay = options.delay ?? (async (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async generateStructured<T>(request: ModelGenerateRequest<T>): Promise<ModelGenerateResult<T>> {
    const started = Date.now(); const config = normalizedConfig(request); const inputDigest = sha256Digest({system: request.system, input: request.input, outputSchema: request.outputSchema, config});
    const providerRequestBody = JSON.stringify({model: request.model, messages: [{role: 'system', content: `${request.system}\nThe user payload contains input and outputSchema. Return one JSON object that satisfies outputSchema exactly, including required fields and no additional fields.`}, {role: 'user', content: JSON.stringify({input: request.input, outputSchema: request.outputSchema})}], temperature: config.temperature, max_tokens: config.maxTokens, response_format: {type: config.responseFormat}, thinking: {type: config.thinkingMode}});
    let attempts = 0; let lastError = {code: 'PROVIDER_UNAVAILABLE', retryable: true};
    while (attempts < config.maxAttempts) {
      attempts += 1;
      try {
        const response = await this.#fetch(new URL('/chat/completions', this.#baseUrl), {
          method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${this.#apiKey}`},
          body: providerRequestBody,
          signal: AbortSignal.timeout(config.timeoutMs)
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500; lastError = {code: `PROVIDER_HTTP_${response.status}`, retryable};
          if (retryable && attempts < config.maxAttempts) { await this.#delay(25 * (2 ** (attempts - 1))); continue; }
          return {ok: false, snapshot: snapshot(request, config, inputDigest, null, null, null, Date.now() - started, attempts, lastError, this.#now(), 'DEEPSEEK', this.#executionClass)};
        }
        const payload = await response.json() as DeepSeekResponse;
        const responseIdentity = {id: typeof payload.id === 'string' ? payload.id : null, actualModel: typeof payload.model === 'string' ? payload.model : null, systemFingerprint: typeof payload.system_fingerprint === 'string' ? payload.system_fingerprint : null, finishReason: typeof payload.choices?.[0]?.finish_reason === 'string' ? payload.choices[0].finish_reason : null};
        if (responseIdentity.id === null || responseIdentity.actualModel === null) return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, responseIdentity, Date.now() - started, attempts, {code: 'MODEL_RESPONSE_IDENTITY_INVALID', retryable: false}, this.#now(), 'DEEPSEEK', this.#executionClass)};
        if (responseIdentity.actualModel !== request.model) return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, responseIdentity, Date.now() - started, attempts, {code: 'MODEL_RETURNED_MODEL_MISMATCH', retryable: false}, this.#now(), 'DEEPSEEK', this.#executionClass)};
        const finishError = finishReasonError(responseIdentity.finishReason);
        if (finishError !== null) {
          lastError = finishError;
          if (finishError.retryable && attempts < config.maxAttempts) { await this.#delay(25 * (2 ** (attempts - 1))); continue; }
          return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, responseIdentity, Date.now() - started, attempts, finishError, this.#now(), 'DEEPSEEK', this.#executionClass)};
        }
        if (!validUsage(payload.usage)) return {ok: false, snapshot: snapshot(request, config, inputDigest, null, null, responseIdentity, Date.now() - started, attempts, {code: 'MODEL_USAGE_INVALID', retryable: false}, this.#now(), 'DEEPSEEK', this.#executionClass)};
        const raw = payload.choices?.[0]?.message?.content;
        if (typeof raw !== 'string') return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, responseIdentity, Date.now() - started, attempts, {code: 'PROVIDER_RESPONSE_INVALID', retryable: false}, this.#now(), 'DEEPSEEK', this.#executionClass)};
        let value: unknown;
        try { value = JSON.parse(raw); } catch { return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, responseIdentity, Date.now() - started, attempts, {code: 'MODEL_JSON_MALFORMED', retryable: false}, this.#now(), 'DEEPSEEK', this.#executionClass)}; }
        const validate = new Ajv({allErrors: true, strict: false}).compile(request.outputSchema);
        if (!validate(value)) return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, responseIdentity, Date.now() - started, attempts, {code: 'MODEL_SCHEMA_INVALID', retryable: false}, this.#now(), 'DEEPSEEK', this.#executionClass)};
        return {ok: true, value: value as T, snapshot: snapshot(request, config, inputDigest, sha256Digest(value), payload.usage, responseIdentity, Date.now() - started, attempts, null, this.#now(), 'DEEPSEEK', this.#executionClass)};
      } catch (error) {
        const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name); lastError = {code: timedOut ? 'MODEL_TIMEOUT' : 'PROVIDER_UNAVAILABLE', retryable: true};
        if (attempts < config.maxAttempts) { await this.#delay(25 * (2 ** (attempts - 1))); continue; }
      }
    }
    return {ok: false, snapshot: snapshot(request, config, inputDigest, null, null, null, Date.now() - started, attempts, lastError, this.#now(), 'DEEPSEEK', this.#executionClass)};
  }
}

export class PublicSafeMockModelProvider implements ModelProvider {
  constructor(private readonly fixture: unknown, private readonly now: () => Date = () => new Date()) {}
  async generateStructured<T>(request: ModelGenerateRequest<T>): Promise<ModelGenerateResult<T>> {
    const config = normalizedConfig(request); const inputDigest = sha256Digest({system: request.system, input: request.input, outputSchema: request.outputSchema, config});
    const validate = new Ajv({allErrors: true, strict: false}).compile(request.outputSchema);
    const mockResponse = {id: `public-safe-${request.taskId}`, actualModel: request.model, systemFingerprint: null, finishReason: 'stop'};
    if (!validate(this.fixture)) return {ok: false, snapshot: snapshot(request, config, inputDigest, null, {prompt_tokens: 0, completion_tokens: 0}, mockResponse, 0, 1, {code: 'MOCK_SCHEMA_INVALID', retryable: false}, this.now(), 'PUBLIC_SAFE_MOCK', 'MOCK_CONFORMANCE')};
    return {ok: true, value: structuredClone(this.fixture) as T, snapshot: snapshot(request, config, inputDigest, sha256Digest(this.fixture), {prompt_tokens: 0, completion_tokens: 0}, mockResponse, 0, 1, null, this.now(), 'PUBLIC_SAFE_MOCK', 'MOCK_CONFORMANCE')};
  }
}

function normalizedConfig(request: ModelGenerateRequest<unknown>) {
  const bounded = (value: number | undefined, fallback: number, minimum: number, maximum: number) => Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.trunc(value!))) : fallback;
  return {
    temperature: Number.isFinite(request.temperature) ? Math.min(2, Math.max(0, request.temperature!)) : 0,
    maxTokens: bounded(request.maxTokens, 2_000, 1, 65_536),
    responseFormat: 'json_object' as const,
    thinkingMode: 'disabled' as const,
    timeoutMs: bounded(request.timeoutMs, 30_000, 1, 120_000),
    maxAttempts: bounded(request.maxAttempts, 3, 1, 3)
  };
}

type DeepSeekUsage = {prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number; completion_tokens_details?: {reasoning_tokens?: number}};
type DeepSeekResponse = {id?: string; model?: string; system_fingerprint?: string | null; choices?: {finish_reason?: string | null; message?: {content?: string}}[]; usage?: DeepSeekUsage};

function finishReasonError(finishReason: string | null): NonNullable<ModelCallSnapshot['error']> | null {
  switch (finishReason) {
    case 'stop': return null;
    case 'length': return {code: 'MODEL_OUTPUT_TRUNCATED', retryable: false};
    case 'content_filter': return {code: 'MODEL_CONTENT_FILTERED', retryable: false};
    case 'tool_calls': return {code: 'MODEL_TOOL_CALL_FORBIDDEN', retryable: false};
    case 'insufficient_system_resource': return {code: 'MODEL_INFERENCE_RESOURCE_UNAVAILABLE', retryable: true};
    default: return {code: 'MODEL_FINISH_REASON_INVALID', retryable: false};
  }
}

function validUsage(usage: DeepSeekUsage | undefined): usage is DeepSeekUsage & {prompt_tokens: number; completion_tokens: number} {
  if (usage === undefined || !nonnegativeInteger(usage.prompt_tokens) || !nonnegativeInteger(usage.completion_tokens)) return false;
  if (![usage.prompt_cache_hit_tokens, usage.prompt_cache_miss_tokens, usage.completion_tokens_details?.reasoning_tokens].every((value) => value === undefined || nonnegativeInteger(value))) return false;
  const hitPresent = usage.prompt_cache_hit_tokens !== undefined;
  const missPresent = usage.prompt_cache_miss_tokens !== undefined;
  if (hitPresent !== missPresent) return false;
  return !hitPresent || usage.prompt_cache_hit_tokens! + usage.prompt_cache_miss_tokens! === usage.prompt_tokens;
}

function nonnegativeInteger(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }

function snapshot(request: ModelGenerateRequest<unknown>, config: ReturnType<typeof normalizedConfig>, inputDigest: string, outputDigest: string | null, usage: DeepSeekUsage | null | undefined, response: ModelCallSnapshot['response'] | null, latencyMs: number, attempts: number, error: ModelCallSnapshot['error'], now: Date, provider: ModelCallSnapshot['provider'], maturity: ModelCallSnapshot['maturity']): ModelCallSnapshot {
  const candidateUsage = usage ?? undefined;
  const pricedUsage = validUsage(candidateUsage) ? candidateUsage : null;
  const input = pricedUsage?.prompt_tokens ?? 0; const output = pricedUsage?.completion_tokens ?? 0; const rate = RATES[request.model];
  const hasCacheBreakdown = pricedUsage?.prompt_cache_hit_tokens !== undefined && pricedUsage.prompt_cache_miss_tokens !== undefined;
  const cacheHit = hasCacheBreakdown ? pricedUsage.prompt_cache_hit_tokens! : 0;
  const cacheMiss = hasCacheBreakdown ? pricedUsage.prompt_cache_miss_tokens! : input;
  const tokenUsage = pricedUsage === null ? null : {input, output, cacheHit, cacheMiss, reasoning: pricedUsage.completion_tokens_details?.reasoning_tokens ?? 0};
  return {
    schemaVersion: 1, id: id(now, sha256Digest({missionId: request.missionId, taskId: request.taskId, inputDigest, attempts})), missionId: request.missionId, taskId: request.taskId,
    provider, maturity, model: request.model, response: response ?? {id: null, actualModel: null, systemFingerprint: null, finishReason: null}, config,
    pricing: {source: 'DEEPSEEK_OFFICIAL_2026-08-04', inputCacheHitUsdPerMillion: rate.inputCacheHit, inputCacheMissUsdPerMillion: rate.inputCacheMiss, outputUsdPerMillion: rate.output, peakMultiplierNotApplied: true},
    inputDigest, outputDigest, tokenUsage, estimatedCostUsd: tokenUsage === null || provider === 'PUBLIC_SAFE_MOCK' ? provider === 'PUBLIC_SAFE_MOCK' ? 0 : null : Number(((cacheHit * rate.inputCacheHit + cacheMiss * rate.inputCacheMiss + output * rate.output) / 1_000_000).toFixed(12)),
    latencyMs, attempts, error, secretPresent: false, createdAt: now.toISOString()
  };
}

function id(now: Date, digest: string): string { return createUuidV7(now.getTime(), Uint8Array.from(Array.from({length: 10}, (_, index) => Number.parseInt(digest.slice(index * 2, index * 2 + 2), 16)))); }
