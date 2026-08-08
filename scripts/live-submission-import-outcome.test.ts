import {readFileSync, rmSync} from 'node:fs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterAll, describe, expect, it} from 'vitest';
import {parseLiveFailureEnvelope} from './live-uat-diagnostics.mjs';
import {classifyLiveSubmissionImportOutcome, LIVE_SUBMISSION_IMPORT_OUTCOMES} from './live-submission-import-outcome.mjs';

const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f';
const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd';
const campaignDigest = 'f'.repeat(64);
const bootstrap = 'public-safe-submission-import-bootstrap-0001';
const failedTaskId = 'public-safe-task-protocol-task';
const forbidden = ['dummy-secret-submission-import-0001', 'dummy-ticket-submission-import-0001', 'raw-response-submission-import-0001'];
const tempRoot = mkdtempSync(path.join(tmpdir(), 'lumiclaw-submission-import-diagnostic-test.'));

afterAll(() => rmSync(tempRoot, {recursive: true, force: true}));

function invoke(code: string) {
  const evidencePath = path.join(tempRoot, `${code}.json`);
  const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', `--live-submission-import-outcome-diagnostic-conformance=${code}`], {
    cwd: process.cwd(), input: JSON.stringify({organizationId, missionId, campaignDigest, bootstrap}), encoding: 'utf8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'],
    env: {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: evidencePath, DUMMY_SECRET_MARKER: forbidden[0], DUMMY_TICKET_MARKER: forbidden[1], DUMMY_RAW_RESPONSE_MARKER: forbidden[2]}
  });
  return {result, evidencePath};
}

function expectNoDisclosure(text: string) {
  for (const marker of [bootstrap, ...forbidden]) expect(text).not.toContain(marker);
  expect(text).not.toMatch(/authorization|\bbearer\b|x-lumiclaw-runtime-ticket|raw.provider.response|responseId|details|Traceback|Exception/iu);
}

describe('Live submission-import outcome diagnostics', () => {
  it('maps only allowlisted API status/code pairs and reduces arbitrary codes to a stable category', () => {
    expect(classifyLiveSubmissionImportOutcome(403, 'LIVE_RUNTIME_TICKET_REUSED')).toBe('LIVE_SUBMISSION_TICKET_REJECTED');
    expect(classifyLiveSubmissionImportOutcome(412, 'MISSION_VERSION_CONFLICT')).toBe('LIVE_SUBMISSION_ETAG_CONFLICT');
    expect(classifyLiveSubmissionImportOutcome(422, 'RUNTIME_EVENT_SCHEMA_INVALID')).toBe('LIVE_SUBMISSION_REQUEST_CONTRACT_INVALID');
    expect(classifyLiveSubmissionImportOutcome(422, 'RUNTIME_SUBMISSION_QUARANTINED')).toBe('LIVE_SUBMISSION_QUARANTINED');
    expect(classifyLiveSubmissionImportOutcome(422, 'RUNTIME_FROZEN_FAULT_INVALID')).toBe('LIVE_SUBMISSION_DOMAIN_INVARIANT_INVALID');
    expect(classifyLiveSubmissionImportOutcome(503, 'CONTROL_PLANE_UNAVAILABLE')).toBe('LIVE_SUBMISSION_PERSISTENCE_UNAVAILABLE');
    expect(classifyLiveSubmissionImportOutcome(418, forbidden.join(':'))).toBe('LIVE_SUBMISSION_IMPORT_UNCLASSIFIED');
  });

  it.each(LIVE_SUBMISSION_IMPORT_OUTCOMES)('propagates %s through actual nested child pipes without raw material', (submissionImportOutcomeCode) => {
    const {result, evidencePath} = invoke(submissionImportOutcomeCode);
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expectNoDisclosure(`${result.stdout}${result.stderr}`);
    const envelope = parseLiveFailureEnvelope(result.stderr, {missionId});
    expect(envelope).toEqual({
      status: 'FAIL', code: 'LIVE_TASK_PROTOCOL_FAILED', stage: 'TASK_PROTOCOL', providerOutcomeCode: null,
      taskProtocolOutcomeCode: 'LIVE_TASK_SUBMISSION_IMPORT_FAILED', submissionImportOutcomeCode,
      taskProtocolStatus: {planStatus: 'delegated', taskStatus: 'submitted'}, missionId,
      evidence: '.evidence/sdd-002/deepseek-live-failure.json', secretPresent: false, liveProviderVerified: false
    });
    const rawReceipt = readFileSync(evidencePath, 'utf8'); expectNoDisclosure(rawReceipt);
    expect(JSON.parse(rawReceipt)).toMatchObject({
      taskProtocolOutcomeCode: 'LIVE_TASK_SUBMISSION_IMPORT_FAILED', submissionImportOutcomeCode,
      taskProtocolStatus: {planStatus: 'delegated', taskStatus: 'submitted'}, failedTaskId,
      noAction: {actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}, mockFallback: false, secretPresent: false, liveProviderVerified: false
    });
  });

  it('rejects a non-allowlisted code without reflecting it', () => {
    const {result} = invoke('RAW_SUBMISSION_IMPORT_EXCEPTION_WITH_SECRET');
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expectNoDisclosure(`${result.stdout}${result.stderr}`);
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_UAT_RUNNER_RECEIPT_INVALID'});
  });
});
