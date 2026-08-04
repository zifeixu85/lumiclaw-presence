import {readFileSync, rmSync} from 'node:fs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterAll, describe, expect, it} from 'vitest';
import {isProviderOutcomeCode, parseLiveFailureEnvelope, providerOutcomeFromMission} from './live-uat-diagnostics.mjs';

const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f';
const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd';
const campaignDigest = 'd'.repeat(64);
const bootstrap = 'public-safe-provider-outcome-bootstrap-0001';
const failedTaskId = 'public-safe-provider-task';
const forbidden = ['dummy-secret-provider-outcome-0001', 'dummy-ticket-provider-outcome-0001', 'raw-response-provider-outcome-0001'];
const outcomes = [
  'DEEPSEEK_SECRET_FILE_UNAVAILABLE',
  'PROVIDER_HTTP_401', 'PROVIDER_HTTP_402', 'PROVIDER_HTTP_404', 'PROVIDER_HTTP_429',
  'PROVIDER_HTTP_500', 'PROVIDER_HTTP_502', 'PROVIDER_HTTP_503', 'PROVIDER_HTTP_504',
  'MODEL_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'MODEL_RESPONSE_IDENTITY_INVALID', 'MODEL_RETURNED_MODEL_MISMATCH',
  'MODEL_OUTPUT_TRUNCATED', 'MODEL_CONTENT_FILTERED', 'MODEL_TOOL_CALL_FORBIDDEN', 'MODEL_INFERENCE_RESOURCE_UNAVAILABLE', 'MODEL_FINISH_REASON_INVALID', 'MODEL_USAGE_INVALID', 'PROVIDER_RESPONSE_INVALID', 'MODEL_JSON_MALFORMED',
  'MODEL_SCHEMA_INVALID', 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', 'LIVE_PROVIDER_BROKER_FAILED'
] as const;
const tempRoot = mkdtempSync(path.join(tmpdir(), 'lumiclaw-provider-outcome-test.'));

afterAll(() => rmSync(tempRoot, {recursive: true, force: true}));

function missionFor(code: string) {
  const noSnapshot = ['DEEPSEEK_SECRET_FILE_UNAVAILABLE', 'LIVE_PROVIDER_BROKER_FAILED'].includes(code);
  const semantic = code === 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID';
  return {
    state: 'FAILED',
    runtimeStatus: {failure: {code, failedTaskId, retryable: false}},
    modelCalls: noSnapshot ? [] : [{taskId: failedTaskId, provider: 'DEEPSEEK', maturity: 'CANARY', secretPresent: false, response: {id: null}, outputDigest: semantic ? 'a'.repeat(64) : null, error: semantic ? null : {code, retryable: false}}]
  };
}

function invoke(code: string) {
  const evidencePath = path.join(tempRoot, `${code}.json`);
  const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', `--live-provider-outcome-diagnostic-conformance=${code}`], {
    cwd: process.cwd(), input: JSON.stringify({organizationId, missionId, campaignDigest, bootstrap}), encoding: 'utf8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'],
    env: {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: evidencePath, DUMMY_SECRET_MARKER: forbidden[0], DUMMY_TICKET_MARKER: forbidden[1], DUMMY_RAW_RESPONSE_MARKER: forbidden[2]}
  });
  return {result, evidencePath};
}

function expectNoDisclosure(text: string) {
  for (const marker of [bootstrap, ...forbidden]) expect(text).not.toContain(marker);
  expect(text).not.toMatch(/authorization|\bbearer\b|x-lumiclaw-runtime-ticket|raw.provider.response|responseId/iu);
}

describe('Live provider outcome diagnostics', () => {
  it.each(outcomes)('allows and extracts exact persisted outcome %s', (code) => {
    expect(isProviderOutcomeCode(code)).toBe(true);
    expect(providerOutcomeFromMission(missionFor(code), failedTaskId)).toBe(code);
  });

  it.each(outcomes)('propagates %s through actual nested child pipes without raw material', (providerOutcomeCode) => {
    const {result, evidencePath} = invoke(providerOutcomeCode);
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expectNoDisclosure(`${result.stdout}${result.stderr}`);
    const envelope = parseLiveFailureEnvelope(result.stderr, {missionId});
    expect(envelope).toMatchObject({status: 'FAIL', stage: 'PROVIDER_REQUEST', code: 'LIVE_PROVIDER_REQUEST_FAILED', providerOutcomeCode, secretPresent: false, liveProviderVerified: false});
    const rawReceipt = readFileSync(evidencePath, 'utf8'); expectNoDisclosure(rawReceipt);
    expect(JSON.parse(rawReceipt)).toMatchObject({providerOutcomeCode, failedTaskId, modelReceiptCount: 0, noAction: {actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}});
  });

  it('maps missing, contradictory, forged and non-allowlisted Mission state to the broker outcome', () => {
    const valid = missionFor('MODEL_SCHEMA_INVALID');
    expect(providerOutcomeFromMission({...valid, state: 'RUNNING'}, failedTaskId)).toBe('LIVE_PROVIDER_BROKER_FAILED');
    expect(providerOutcomeFromMission({...valid, runtimeStatus: {failure: {...valid.runtimeStatus.failure, failedTaskId: 'other'}}}, failedTaskId)).toBe('LIVE_PROVIDER_BROKER_FAILED');
    expect(providerOutcomeFromMission({...valid, runtimeStatus: {failure: {...valid.runtimeStatus.failure, code: 'RAW_PROVIDER_MESSAGE'}}}, failedTaskId)).toBe('LIVE_PROVIDER_BROKER_FAILED');
    expect(providerOutcomeFromMission({...valid, modelCalls: [{...valid.modelCalls[0], error: {code: 'MODEL_TIMEOUT', retryable: true}}]}, failedTaskId)).toBe('LIVE_PROVIDER_BROKER_FAILED');
  });

  it('rejects a non-allowlisted diagnostic code without reflecting input', () => {
    const {result} = invoke('RAW_RESPONSE_WITH_SECRET');
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expectNoDisclosure(`${result.stdout}${result.stderr}`);
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_UAT_RUNNER_RECEIPT_INVALID'});
  });
});
