import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {describe, expect, it} from 'vitest';

const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f';
const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd';
const campaignDigest = 'a'.repeat(64);
const bootstrap = 'public-safe-dummy-bootstrap-transport-0001';
const secretMarker = 'public-safe-dummy-secret-never-output-0001';
const valid = {organizationId, missionId, campaignDigest, bootstrap};

function invoke(input: string) {
  return spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', '--live-stdin-transport-conformance'], {
    cwd: process.cwd(), input, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe']
  });
}

function invokeOperationalFailure(input: string) {
  return spawnSync(process.execPath, ['scripts/run-live-deepseek-uat.mjs'], {
    cwd: process.cwd(), input, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
    env: {...process.env, LUMICLAW_LIVE_API_URL: 'http://127.0.0.1:9'}
  });
}

function expectNoDisclosure(result: ReturnType<typeof invoke>, ...markers: string[]) {
  for (const marker of markers) {
    expect(result.stdout).not.toContain(marker);
    expect(result.stderr).not.toContain(marker);
  }
  expect(result.stdout).not.toMatch(/x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|bearer/iu);
  expect(result.stderr).not.toMatch(/x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|bearer/iu);
}

describe('Live UAT nested child-process stdin transport', () => {
  it('parses all four fields through both child processes and emits only one-way digests', () => {
    const result = invoke(`${JSON.stringify(valid)}\n`);
    expect(result.status).toBe(0);
    expectNoDisclosure(result, bootstrap, secretMarker);
    expect(result.stderr).toBe('');
    const receipt = JSON.parse(result.stdout);
    expect(receipt).toMatchObject({status: 'PASS', mode: 'LIVE_UAT_STDIN_TRANSPORT_CONFORMANCE', fieldCount: 4, nestedChildProcess: true, secretPresent: false});
    expect(receipt.fieldDigests).toEqual({
      organizationId: createHash('sha256').update(organizationId).digest('hex'),
      missionId: createHash('sha256').update(missionId).digest('hex'),
      campaignDigest: createHash('sha256').update(campaignDigest).digest('hex'),
      bootstrap: createHash('sha256').update(bootstrap).digest('hex')
    });
  });

  it('fails closed when one of the four fields is missing', () => {
    const {bootstrap: omitted, ...partial} = valid;
    expect(omitted).toBe(bootstrap);
    const result = invoke(JSON.stringify(partial));
    expect(result.status).not.toBe(0);
    expectNoDisclosure(result, bootstrap, secretMarker);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_UAT_TRANSPORT_INVALID'});
  });

  it('fails closed on malformed JSON without reflecting supplied bytes', () => {
    const result = invoke(`{"organizationId":"${organizationId}","bootstrap":"${bootstrap}","marker":"${secretMarker}"`);
    expect(result.status).not.toBe(0);
    expectNoDisclosure(result, bootstrap, secretMarker);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_UAT_TRANSPORT_INVALID'});
  });

  it('fails closed on an extra field without reflecting its dummy secret', () => {
    const result = invoke(JSON.stringify({...valid, extraSecret: secretMarker}));
    expect(result.status).not.toBe(0);
    expectNoDisclosure(result, bootstrap, secretMarker);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_UAT_TRANSPORT_INVALID'});
  });

  it('returns only a stable redacted code when valid transport reaches an operational failure', () => {
    const result = invokeOperationalFailure(JSON.stringify(valid));
    expect(result.status).not.toBe(0);
    expectNoDisclosure(result, bootstrap, secretMarker);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toEqual({status: 'FAIL', code: 'LIVE_MISSION_OPEN_FAILED', stage: 'MISSION_OPEN', missionId, evidence: '.evidence/sdd-002/deepseek-live-failure.json', secretPresent: false, liveProviderVerified: false});
  });
});
