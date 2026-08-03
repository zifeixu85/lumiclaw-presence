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
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
  delay?: (milliseconds: number) => Promise<void>;
};

const RATES: Record<DeepSeekModel, {input: number; output: number}> = {
  'deepseek-v4-flash': {input: 0.14, output: 0.28},
  'deepseek-v4-pro': {input: 0.435, output: 0.87}
};

export class DeepSeekModelProvider implements ModelProvider {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #delay: (milliseconds: number) => Promise<void>;

  constructor(options: GatewayOptions) {
    if (options.apiKey.trim().length === 0) throw new Error('DEEPSEEK_API_KEY_REQUIRED');
    this.#apiKey = options.apiKey; this.#baseUrl = options.baseUrl ?? 'https://api.deepseek.com'; this.#fetch = options.fetchImplementation ?? fetch; this.#now = options.now ?? (() => new Date());
    this.#delay = options.delay ?? (async (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async generateStructured<T>(request: ModelGenerateRequest<T>): Promise<ModelGenerateResult<T>> {
    const started = Date.now(); const config = normalizedConfig(request); const inputDigest = sha256Digest({system: request.system, input: request.input});
    let attempts = 0; let lastError = {code: 'PROVIDER_UNAVAILABLE', retryable: true};
    while (attempts < config.maxAttempts) {
      attempts += 1;
      try {
        const response = await this.#fetch(new URL('/chat/completions', this.#baseUrl), {
          method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${this.#apiKey}`},
          body: JSON.stringify({model: request.model, messages: [{role: 'system', content: request.system}, {role: 'user', content: JSON.stringify(request.input)}], temperature: config.temperature, max_tokens: config.maxTokens, response_format: {type: 'json_object'}}),
          signal: AbortSignal.timeout(config.timeoutMs)
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500; lastError = {code: `PROVIDER_HTTP_${response.status}`, retryable};
          if (retryable && attempts < config.maxAttempts) { await this.#delay(25 * (2 ** (attempts - 1))); continue; }
          return {ok: false, snapshot: snapshot(request, config, inputDigest, null, null, Date.now() - started, attempts, lastError, this.#now())};
        }
        const payload = await response.json() as {choices?: {message?: {content?: string}}[]; usage?: {prompt_tokens?: number; completion_tokens?: number}};
        const raw = payload.choices?.[0]?.message?.content;
        if (typeof raw !== 'string') return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, Date.now() - started, attempts, {code: 'PROVIDER_RESPONSE_INVALID', retryable: false}, this.#now())};
        let value: unknown;
        try { value = JSON.parse(raw); } catch { return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, Date.now() - started, attempts, {code: 'MODEL_JSON_MALFORMED', retryable: false}, this.#now())}; }
        const validate = new Ajv({allErrors: true, strict: false}).compile(request.outputSchema);
        if (!validate(value)) return {ok: false, snapshot: snapshot(request, config, inputDigest, null, payload.usage, Date.now() - started, attempts, {code: 'MODEL_SCHEMA_INVALID', retryable: false}, this.#now())};
        return {ok: true, value: value as T, snapshot: snapshot(request, config, inputDigest, sha256Digest(value), payload.usage, Date.now() - started, attempts, null, this.#now())};
      } catch (error) {
        const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name); lastError = {code: timedOut ? 'MODEL_TIMEOUT' : 'PROVIDER_UNAVAILABLE', retryable: true};
        if (attempts < config.maxAttempts) { await this.#delay(25 * (2 ** (attempts - 1))); continue; }
      }
    }
    return {ok: false, snapshot: snapshot(request, config, inputDigest, null, null, Date.now() - started, attempts, lastError, this.#now())};
  }
}

export class PublicSafeMockModelProvider implements ModelProvider {
  constructor(private readonly fixture: unknown, private readonly now: () => Date = () => new Date()) {}
  async generateStructured<T>(request: ModelGenerateRequest<T>): Promise<ModelGenerateResult<T>> {
    const config = normalizedConfig(request); const inputDigest = sha256Digest({system: request.system, input: request.input});
    const validate = new Ajv({allErrors: true, strict: false}).compile(request.outputSchema);
    if (!validate(this.fixture)) return {ok: false, snapshot: snapshot(request, config, inputDigest, null, {prompt_tokens: 0, completion_tokens: 0}, 0, 1, {code: 'MOCK_SCHEMA_INVALID', retryable: false}, this.now(), 'PUBLIC_SAFE_MOCK')};
    return {ok: true, value: structuredClone(this.fixture) as T, snapshot: snapshot(request, config, inputDigest, sha256Digest(this.fixture), {prompt_tokens: 0, completion_tokens: 0}, 0, 1, null, this.now(), 'PUBLIC_SAFE_MOCK')};
  }
}

function normalizedConfig(request: ModelGenerateRequest<unknown>) {
  const bounded = (value: number | undefined, fallback: number, minimum: number, maximum: number) => Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.trunc(value!))) : fallback;
  return {
    temperature: Number.isFinite(request.temperature) ? Math.min(2, Math.max(0, request.temperature!)) : 0,
    maxTokens: bounded(request.maxTokens, 2_000, 1, 65_536),
    responseFormat: 'json_object' as const,
    timeoutMs: bounded(request.timeoutMs, 30_000, 1, 120_000),
    maxAttempts: bounded(request.maxAttempts, 3, 1, 3)
  };
}

function snapshot(request: ModelGenerateRequest<unknown>, config: ReturnType<typeof normalizedConfig>, inputDigest: string, outputDigest: string | null, usage: {prompt_tokens?: number; completion_tokens?: number} | null | undefined, latencyMs: number, attempts: number, error: ModelCallSnapshot['error'], now: Date, provider: ModelCallSnapshot['provider'] = 'DEEPSEEK'): ModelCallSnapshot {
  const input = usage?.prompt_tokens ?? 0; const output = usage?.completion_tokens ?? 0; const rate = RATES[request.model];
  const tokenUsage = usage === null || usage === undefined ? null : {input, output};
  return {
    schemaVersion: 1, id: id(now, sha256Digest({missionId: request.missionId, taskId: request.taskId, inputDigest, attempts})), missionId: request.missionId, taskId: request.taskId,
    provider, maturity: provider === 'DEEPSEEK' ? 'CANARY' : 'MOCK_CONFORMANCE', model: request.model, config,
    pricing: {source: 'DEEPSEEK_OFFICIAL_2026-08-04', inputCacheMissUsdPerMillion: rate.input, outputUsdPerMillion: rate.output, peakMultiplierNotApplied: true},
    inputDigest, outputDigest, tokenUsage, estimatedCostUsd: tokenUsage === null || provider === 'PUBLIC_SAFE_MOCK' ? provider === 'PUBLIC_SAFE_MOCK' ? 0 : null : Number(((input * rate.input + output * rate.output) / 1_000_000).toFixed(9)),
    latencyMs, attempts, error, secretPresent: false, createdAt: now.toISOString()
  };
}

function id(now: Date, digest: string): string { return createUuidV7(now.getTime(), Uint8Array.from(Array.from({length: 10}, (_, index) => Number.parseInt(digest.slice(index * 2, index * 2 + 2), 16)))); }
