import {readFileSync, rmSync} from 'node:fs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterAll, describe, expect, it} from 'vitest';
import {conformanceProgressForStage, createLiveFailureEnvelope, createLiveFailureReceipt, isLiveFailureReceipt, LIVE_STAGE_CODE, parseLiveFailureEnvelope, readSourceIdentity} from './live-uat-diagnostics.mjs';

const root = process.cwd();
const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f';
const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd';
const campaignDigest = 'c'.repeat(64);
const bootstrap = 'public-safe-dummy-bootstrap-stage-conformance-0001';
const dummySecret = 'dummy-secret-never-output-stage-conformance-0001';
const dummyTicket = 'dummy-runtime-ticket-never-output-stage-0001';
const rawResponse = 'raw-provider-response-never-output-stage-0001';
const tempRoot = mkdtempSync(path.join(tmpdir(), 'lumiclaw-live-stage-test.'));
const valid = {organizationId, missionId, campaignDigest, bootstrap};

afterAll(() => rmSync(tempRoot, {recursive: true, force: true}));

function invokeStage(stage: string) {
  const evidencePath = path.join(tempRoot, `${stage}.json`);
  const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', `--live-stage-diagnostic-conformance=${stage}`], {
    cwd: root,
    input: JSON.stringify(valid),
    encoding: 'utf8',
    timeout: 15_000,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: evidencePath, DUMMY_SECRET_MARKER: dummySecret, DUMMY_TICKET_MARKER: dummyTicket, DUMMY_RAW_RESPONSE_MARKER: rawResponse}
  });
  return {result, evidencePath};
}

function expectNoDisclosure(value: string) {
  for (const marker of [bootstrap, dummySecret, dummyTicket, rawResponse]) expect(value).not.toContain(marker);
  expect(value).not.toMatch(/x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|\bbearer\b|raw.provider.response/iu);
}

describe('Live UAT allowlisted stage diagnostics', () => {
  it.each(Object.entries(LIVE_STAGE_CODE))('propagates %s as only %s through the actual nested child pipe', (stage, code) => {
    const {result, evidencePath} = invokeStage(stage);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expectNoDisclosure(`${result.stdout}${result.stderr}`);
    const envelope = parseLiveFailureEnvelope(result.stderr, {missionId});
    expect(envelope).toEqual({status: 'FAIL', code, stage, providerOutcomeCode: null, taskProtocolOutcomeCode: null, taskProtocolStatus: {planStatus: null, taskStatus: null}, missionId, evidence: '.evidence/sdd-002/deepseek-live-failure.json', secretPresent: false, liveProviderVerified: false});
    const rawReceipt = readFileSync(evidencePath, 'utf8');
    expectNoDisclosure(rawReceipt);
    const receipt = JSON.parse(rawReceipt);
    expect(isLiveFailureReceipt(receipt, {organizationId, missionId, campaignDigest, stage, code})).toBe(true);
    expect(receipt.progress).toEqual(conformanceProgressForStage(stage));
    expect(receipt.noAction).toEqual({actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(receipt.secretPresent).toBe(false);
    expect(receipt.liveProviderVerified).toBe(false);
    expect(receipt.providerOutcomeCode).toBeNull();
    expect(receipt.taskProtocolOutcomeCode).toBeNull();
    expect(receipt.taskProtocolStatus).toEqual({planStatus: null, taskStatus: null});
  });

  it('rejects a contradictory progress receipt and a mismatched envelope code', () => {
    const receipt = createLiveFailureReceipt({source: readSourceIdentity(root), organizationId, missionId, campaignDigest, stage: 'DAG_PLAN', progress: conformanceProgressForStage('DAG_PLAN')});
    expect(isLiveFailureReceipt({...receipt, progress: {...receipt.progress, projectCreated: false, dagPlanned: true}})).toBe(false);
    const envelope = createLiveFailureEnvelope(receipt);
    expect(() => parseLiveFailureEnvelope(JSON.stringify({...envelope, code: 'LIVE_PROJECT_CREATE_FAILED'}), {missionId})).toThrow('LIVE_FAILURE_ENVELOPE_INVALID');
  });

  it('rejects raw security/provider material supplied as an extra stdin field without reflecting it', () => {
    const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', '--live-stage-diagnostic-conformance=PROJECT_CREATE'], {
      cwd: root,
      input: JSON.stringify({...valid, dummySecret, dummyTicket, authorization: 'Bearer-public-safe-dummy', rawResponse}),
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: path.join(tempRoot, 'invalid.json')}
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expectNoDisclosure(`${result.stdout}${result.stderr}`);
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_UAT_TRANSPORT_INVALID'});
  });
});
