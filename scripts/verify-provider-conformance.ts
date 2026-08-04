import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {
  DeepSeekModelProvider,
  EvoLinkMediaProvider,
  PublicSafeMockMediaProvider,
  PublicSafeMockModelProvider,
  verifyContentAddressedIngest,
  type ModelGenerateRequest
} from '../packages/governed-shadow/src/index.js';

const root = process.cwd();
const request: ModelGenerateRequest<{copy: string}> = {
  missionId: 'public-safe-provider-conformance',
  taskId: 'producer-task',
  model: 'deepseek-v4-flash',
  system: 'Return one public-safe JSON object. Do not perform an external action.',
  input: {brief: 'synthetic fixture'},
  outputSchema: {type: 'object', additionalProperties: false, required: ['copy'], properties: {copy: {type: 'string'}}},
  temperature: 0,
  maxTokens: 512,
  timeoutMs: 50,
  maxAttempts: 3
};
const fixtureCredential = 'public-safe-conformance-credential';
const usageBreakdownPolicy = 'BOTH_OR_NONE_EXACT_SUM; ABSENT_MEANS_ALL_CACHE_MISS';
const expectedPricing = {
  flash: {source: 'DEEPSEEK_OFFICIAL_2026-08-04', inputCacheHitUsdPerMillion: 0.0028, inputCacheMissUsdPerMillion: 0.14, outputUsdPerMillion: 0.28, peakMultiplierNotApplied: true},
  pro: {source: 'DEEPSEEK_OFFICIAL_2026-08-04', inputCacheHitUsdPerMillion: 0.003625, inputCacheMissUsdPerMillion: 0.435, outputUsdPerMillion: 0.87, peakMultiplierNotApplied: true}
} as const;
const observedModels: string[] = [];
let responseCount = 0;
const gateway = new DeepSeekModelProvider({
  apiKey: fixtureCredential,
  executionClass: 'MOCK_CONFORMANCE',
  delay: async () => {},
  now: () => new Date('2026-08-04T00:00:00.000Z'),
  fetchImplementation: async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {model: string};
    observedModels.push(body.model);
    responseCount += 1;
    if (responseCount === 1) return new Response('{}', {status: 429});
    if (responseCount === 2) return new Response('{}', {status: 503});
    return new Response(JSON.stringify({id: 'chatcmpl-public-safe-conformance', model: request.model, system_fingerprint: 'public-safe-fixture', choices: [{finish_reason: 'stop', message: {content: '{"copy":"public-safe structured fixture"}'}}], usage: {prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 20, prompt_cache_miss_tokens: 80, completion_tokens_details: {reasoning_tokens: 10}}}), {status: 200, headers: {'content-type': 'application/json'}});
  }
});
const retryResult = await gateway.generateStructured(request);
if (!retryResult.ok || retryResult.snapshot.attempts !== 3 || observedModels.some((model) => model !== request.model) || JSON.stringify(retryResult.snapshot).includes(fixtureCredential)) throw new Error('DEEPSEEK_GATEWAY_RETRY_OR_REDACTION_CONFORMANCE_FAILED');
if (retryResult.snapshot.estimatedCostUsd !== 0.000025256 || JSON.stringify(retryResult.snapshot.pricing) !== JSON.stringify(expectedPricing.flash)) throw new Error('DEEPSEEK_FLASH_EXACT_COST_CONFORMANCE_FAILED');

const proRequest = {...request, taskId: 'producer-task-pro', model: 'deepseek-v4-pro' as const};
const proResult = await new DeepSeekModelProvider({
  apiKey: fixtureCredential,
  executionClass: 'MOCK_CONFORMANCE',
  now: () => new Date('2026-08-04T00:00:00.000Z'),
  fetchImplementation: async () => new Response(JSON.stringify({id: 'chatcmpl-public-safe-pro-conformance', model: proRequest.model, system_fingerprint: 'public-safe-fixture', choices: [{finish_reason: 'stop', message: {content: '{"copy":"public-safe pro fixture"}'}}], usage: {prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 20, prompt_cache_miss_tokens: 80}}), {status: 200})
}).generateStructured(proRequest);
if (!proResult.ok || proResult.snapshot.estimatedCostUsd !== 0.0000783725 || JSON.stringify(proResult.snapshot.pricing) !== JSON.stringify(expectedPricing.pro)) throw new Error('DEEPSEEK_PRO_EXACT_COST_CONFORMANCE_FAILED');

const nonRetryable = await new DeepSeekModelProvider({apiKey: fixtureCredential, executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response('{}', {status: 400})}).generateStructured(request);
if (nonRetryable.ok || nonRetryable.snapshot.attempts !== 1 || nonRetryable.snapshot.error?.code !== 'PROVIDER_HTTP_400') throw new Error('DEEPSEEK_GATEWAY_NON_RETRYABLE_CONFORMANCE_FAILED');
const timeoutError = Object.assign(new Error('fixture timeout'), {name: 'TimeoutError'});
const timedOut = await new DeepSeekModelProvider({apiKey: fixtureCredential, executionClass: 'MOCK_CONFORMANCE', delay: async () => {}, fetchImplementation: async () => { throw timeoutError; }}).generateStructured(request);
if (timedOut.ok || timedOut.snapshot.attempts !== 3 || timedOut.snapshot.error?.code !== 'MODEL_TIMEOUT') throw new Error('DEEPSEEK_GATEWAY_TIMEOUT_CONFORMANCE_FAILED');
const identityCases = [
  ['MODEL_RETURNED_MODEL_MISMATCH', {id: 'fixture', model: 'deepseek-v4-pro', choices: [{finish_reason: 'stop', message: {content: '{"copy":"fixture"}'}}], usage: {prompt_tokens: 1, completion_tokens: 1}}],
  ['MODEL_FINISH_REASON_INVALID', {id: 'fixture', model: request.model, choices: [{finish_reason: 'length', message: {content: '{"copy":"partial"}'}}], usage: {prompt_tokens: 1, completion_tokens: 1}}],
  ['MODEL_RESPONSE_IDENTITY_INVALID', {model: request.model, choices: [{finish_reason: 'stop', message: {content: '{"copy":"fixture"}'}}], usage: {prompt_tokens: 1, completion_tokens: 1}}],
  ['MODEL_USAGE_INVALID', {id: 'fixture', model: request.model, choices: [{finish_reason: 'stop', message: {content: '{"copy":"fixture"}'}}], usage: {prompt_tokens: 100, completion_tokens: 1, prompt_cache_hit_tokens: 20, prompt_cache_miss_tokens: 79}}]
] as const;
const identityRejections: string[] = [];
for (const [expectedCode, payload] of identityCases) {
  const rejected = await new DeepSeekModelProvider({apiKey: fixtureCredential, executionClass: 'MOCK_CONFORMANCE', fetchImplementation: async () => new Response(JSON.stringify(payload), {status: 200})}).generateStructured(request);
  if (rejected.ok || rejected.snapshot.error?.code !== expectedCode) throw new Error(`DEEPSEEK_RESPONSE_IDENTITY_CONFORMANCE_FAILED:${expectedCode}`);
  identityRejections.push(expectedCode);
}

const mockModel = await new PublicSafeMockModelProvider({copy: 'public-safe mock'}, () => new Date('2026-08-04T00:00:00.000Z')).generateStructured(request);
if (!mockModel.ok || mockModel.snapshot.provider !== 'PUBLIC_SAFE_MOCK' || mockModel.snapshot.maturity !== 'MOCK_CONFORMANCE') throw new Error('PUBLIC_SAFE_MODEL_CONFORMANCE_FAILED');
const media = await new PublicSafeMockMediaProvider(() => new Date('2026-08-04T00:00:00.000Z')).generate({organizationId: 'public-safe-org', missionId: request.missionId, prompt: 'Synthetic governed SHADOW fixture', rightsConfirmedSynthetic: true});
if (!verifyContentAddressedIngest(media.asset, media.content) || media.asset.approvalState !== 'UNREVIEWED' || media.asset.rights.ownerApprovalRequired !== true) throw new Error('PUBLIC_SAFE_MEDIA_CONFORMANCE_FAILED');
let evoLinkStatus = 'UNEXPECTED';
try {
  await new EvoLinkMediaProvider(undefined).generate({organizationId: 'public-safe-org', missionId: request.missionId, prompt: 'fixture', rightsConfirmedSynthetic: true});
} catch (error) {
  evoLinkStatus = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN_ERROR';
}
if (evoLinkStatus !== 'EVOLINK_CANARY_KEY_REQUIRED') throw new Error('EVOLINK_NO_KEY_BOUNDARY_FAILED');

const evidence = {
  schemaVersion: 1,
  status: 'PASS',
  generatedAt: new Date().toISOString(),
  deepSeek: {
    officialBaseUrl: 'https://api.deepseek.com',
    verifiedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    sources: [
      'https://api-docs.deepseek.com/api/list-models',
      'https://api-docs.deepseek.com/quick_start/pricing',
      'https://api-docs.deepseek.com/quick_start/rate_limit',
      'https://api-docs.deepseek.com/news/news260424/'
    ],
    canary: 'NOT_RUN_NO_KEY',
    conformance: {
      structuredOutput: true,
      retries429And5xx: true,
      nonRetryable4xxAttempts: nonRetryable.snapshot.attempts,
      timeoutAttempts: timedOut.snapshot.attempts,
      observedModels,
      silentModelSwitch: false,
      actualReturnedModel: retryResult.snapshot.response.actualModel,
      finishReason: retryResult.snapshot.response.finishReason,
      responseIdentityCaptured: retryResult.snapshot.response.id !== null,
      executionClass: retryResult.snapshot.maturity,
      responseIdentityRejections: identityRejections,
      usageBreakdownConsistencyRejected: true,
      usageBreakdownPolicy,
      snapshotSecretPresent: retryResult.snapshot.secretPresent,
      costSnapshotUsd: retryResult.snapshot.estimatedCostUsd,
      costSnapshotsUsd: {flash: retryResult.snapshot.estimatedCostUsd, pro: proResult.snapshot.estimatedCostUsd},
      pricingSnapshots: {flash: retryResult.snapshot.pricing, pro: proResult.snapshot.pricing},
      config: retryResult.snapshot.config
    }
  },
  publicSafeMock: {maturity: mockModel.snapshot.maturity, realModelClaim: false, modelSnapshot: mockModel.snapshot},
  media: {maturity: media.asset.maturity, contentDigest: media.asset.contentDigest, bytes: media.asset.bytes, rights: media.asset.rights, costReceipt: media.asset.costReceipt, approvalState: media.asset.approvalState},
  evoLink: {canary: 'NOT_RUN_NO_KEY', noKeyBoundary: evoLinkStatus, blockingLocalAcceptance: false},
  noAction: {externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}
};
await mkdir(path.join(root, '.evidence/sdd-002'), {recursive: true});
await writeFile(path.join(root, '.evidence/sdd-002/provider-conformance.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.info(JSON.stringify({status: 'PASS', deepSeekCanary: evidence.deepSeek.canary, mockMaturity: evidence.publicSafeMock.maturity, evoLinkCanary: evidence.evoLink.canary, evidence: '.evidence/sdd-002/provider-conformance.json'}));
