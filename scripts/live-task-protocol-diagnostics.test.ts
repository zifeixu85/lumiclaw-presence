import {readFileSync, rmSync} from 'node:fs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterAll, describe, expect, it} from 'vitest';
import {LIVE_TASK_PROTOCOL_OUTCOMES, taskProtocolDiagnosticStatus} from './live-agentteams-task-protocol.mjs';
import {parseLiveFailureEnvelope} from './live-uat-diagnostics.mjs';

const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f';
const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd';
const campaignDigest = 'e'.repeat(64);
const bootstrap = 'public-safe-task-protocol-bootstrap-0001';
const failedTaskId = 'public-safe-task-protocol-task';
const forbidden = ['dummy-secret-task-protocol-0001', 'dummy-ticket-task-protocol-0001', 'raw-response-task-protocol-0001'];
const tempRoot = mkdtempSync(path.join(tmpdir(), 'lumiclaw-task-protocol-diagnostic-test.'));

afterAll(() => rmSync(tempRoot, {recursive: true, force: true}));

function invoke(code: string) {
  const evidencePath = path.join(tempRoot, `${code}.json`);
  const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', `--live-task-protocol-outcome-diagnostic-conformance=${code}`], {
    cwd: process.cwd(), input: JSON.stringify({organizationId, missionId, campaignDigest, bootstrap}), encoding: 'utf8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'],
    env: {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: evidencePath, DUMMY_SECRET_MARKER: forbidden[0], DUMMY_TICKET_MARKER: forbidden[1], DUMMY_RAW_RESPONSE_MARKER: forbidden[2]}
  });
  return {result, evidencePath};
}

function expectNoDisclosure(text: string) {
  for (const marker of [bootstrap, ...forbidden]) expect(text).not.toContain(marker);
  expect(text).not.toMatch(/authorization|\bbearer\b|x-lumiclaw-runtime-ticket|raw.provider.response|responseId|Traceback|Exception/iu);
}

describe('Live AgentTeams task-protocol diagnostics', () => {
  it.each(LIVE_TASK_PROTOCOL_OUTCOMES)('propagates %s through actual nested child pipes without raw material', (taskProtocolOutcomeCode) => {
    const {result, evidencePath} = invoke(taskProtocolOutcomeCode);
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expectNoDisclosure(`${result.stdout}${result.stderr}`);
    const envelope = parseLiveFailureEnvelope(result.stderr, {missionId});
    expect(envelope).toEqual({
      status: 'FAIL', code: 'LIVE_TASK_PROTOCOL_FAILED', stage: 'TASK_PROTOCOL', providerOutcomeCode: null,
      taskProtocolOutcomeCode, taskProtocolStatus: taskProtocolDiagnosticStatus(taskProtocolOutcomeCode), missionId,
      evidence: '.evidence/sdd-002/deepseek-live-failure.json', secretPresent: false, liveProviderVerified: false
    });
    const rawReceipt = readFileSync(evidencePath, 'utf8'); expectNoDisclosure(rawReceipt);
    expect(JSON.parse(rawReceipt)).toMatchObject({
      taskProtocolOutcomeCode, taskProtocolStatus: taskProtocolDiagnosticStatus(taskProtocolOutcomeCode), failedTaskId,
      modelReceiptCount: 0, mockFallback: false, secretPresent: false, liveProviderVerified: false,
      noAction: {actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}
    });
  });

  it('rejects a non-allowlisted diagnostic code without reflecting it', () => {
    const {result} = invoke('RAW_TASK_EXCEPTION_WITH_SECRET');
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expectNoDisclosure(`${result.stdout}${result.stderr}`);
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_UAT_RUNNER_RECEIPT_INVALID'});
  });
});
