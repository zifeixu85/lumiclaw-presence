import {describe, expect, it} from 'vitest';
import {
  probeRuntime,
  validateRuntimeProfile,
  validateTeamProfile,
  type RuntimeProfile,
  type TeamProfile
} from './index.js';

const safeProfile: RuntimeProfile = {
  id: 'm0-isolated-agentteams',
  runtime: 'agentteams',
  version: 'v1.2.0',
  endpointMode: 'isolated-profile',
  images: [
    {
      component: 'manager',
      tag: 'v1.2.0',
      repository: 'example.invalid/agentteams-manager',
      digest: `sha256:${'a'.repeat(64)}`
    },
    {
      component: 'worker',
      tag: 'v1.2.0',
      repository: 'example.invalid/agentteams-worker',
      digest: `sha256:${'b'.repeat(64)}`
    }
  ],
  publishedPorts: [],
  mounts: [{type: 'tmpfs', target: '/tmp', readOnly: false}],
  secretRefs: [],
  security: {
    capDrop: ['ALL'],
    noNewPrivileges: true,
    readOnlyRootFilesystem: true,
    pidsLimit: 64,
    memoryBytes: 268_435_456,
    cpus: 0.5,
    privateNetwork: true,
    healthcheck: true
  }
};

const teamProfile: TeamProfile = {
  id: 'hero-topology-contract',
  runtimeVersion: 'v1.2.0',
  executionMode: 'SHADOW_PREP_ONLY',
  externalActionAllowed: false,
  modelMaturity: 'MOCK_CONFORMANCE',
  roles: [
    {id: 'presence-mission-leader', responsibility: 'orchestration', orchestrationOnly: true, permissions: ['ORCHESTRATE'], skillLocks: ['trace-safe-escalation@1.0.0']},
    {id: 'evidence-claim-steward', responsibility: 'evidence', orchestrationOnly: false, permissions: ['READ_EVIDENCE'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'trace-safe-escalation@1.0.0']},
    {id: 'campaign-planner', responsibility: 'plan', orchestrationOnly: false, permissions: ['PLAN'], skillLocks: ['campaign-strategy@1.0.0', 'trace-safe-escalation@1.0.0']},
    {id: 'founder-identity-producer', responsibility: 'founder', orchestrationOnly: false, permissions: ['PRODUCE_FOUNDER'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'account-native-expression@1.0.0', 'trace-safe-escalation@1.0.0']},
    {id: 'product-account-producer', responsibility: 'product', orchestrationOnly: false, permissions: ['PRODUCE_PRODUCT'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'account-native-expression@1.0.0', 'trace-safe-escalation@1.0.0']},
    {id: 'independent-auditor', responsibility: 'audit', orchestrationOnly: false, permissions: ['AUDIT'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'independent-action-audit@1.0.0', 'trace-safe-escalation@1.0.0']}
  ]
};

describe('AgentTeams M0 isolation contract', () => {
  it('accepts an isolated pinned profile and six-role topology', () => {
    expect(validateRuntimeProfile(safeProfile)).toEqual([]);
    expect(validateTeamProfile(teamProfile)).toEqual([]);
  });

  it.each([
    ['/var/run/docker.sock', 'UNSAFE_MOUNT:/var/run/docker.sock'],
    ['/host-share', 'UNSAFE_MOUNT:/host-share'],
    ['/Users/owner', 'UNSAFE_MOUNT:/Users/owner']
  ])('rejects unsafe mount %s', (target, code) => {
    const unsafe = structuredClone(safeProfile);
    unsafe.mounts.push({type: 'volume', target, readOnly: false});
    expect(validateRuntimeProfile(unsafe)).toContain(code);
  });

  it('rejects public or internal runtime host ports', () => {
    const unsafe = structuredClone(safeProfile);
    unsafe.publishedPorts.push({container: 8088, hostIp: '127.0.0.1'});
    expect(validateRuntimeProfile(unsafe)).toContain('RUNTIME_INTERNAL_PORT_PUBLISHED:8088');
  });

  it('rejects secrets and missing safety limits', () => {
    const unsafe = structuredClone(safeProfile);
    unsafe.secretRefs = ['provider-key'];
    (unsafe.security as {healthcheck: boolean}).healthcheck = false;
    unsafe.security.pidsLimit = 0;
    expect(validateRuntimeProfile(unsafe)).toEqual(
      expect.arrayContaining(['HEALTHCHECK_MISSING', 'PIDS_LIMIT_MISSING', 'REAL_SECRET_REFERENCE_NOT_ALLOWED_IN_M0'])
    );
  });

  it('distinguishes controlled success from a live team run', async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({controller: 'v1.2.0', kubeMode: 'fixture'}), {
        status: 200,
        headers: {'content-type': 'application/json'}
      });
    const result = await probeRuntime(safeProfile, 'http://fixture.invalid', 'CONTROLLED_FIXTURE', fakeFetch);
    expect(result).toMatchObject({status: 'SUCCESS', liveAgentTeamRun: false, kind: 'ADAPTER_CONTRACT_SMOKE'});
  });

  it('labels dev controller identity as unknown', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({controller: 'dev'}), {status: 200});
    const result = await probeRuntime(safeProfile, 'http://fixture.invalid', 'CONTROLLED_FIXTURE', fakeFetch);
    expect(result).toMatchObject({status: 'UNKNOWN', buildIdentity: null, liveAgentTeamRun: false});
  });

  it('fails closed when the controller version differs from the pinned profile', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({controller: 'v1.1.0'}), {status: 200});
    const result = await probeRuntime(safeProfile, 'http://fixture.invalid', 'CONTROLLED_FIXTURE', fakeFetch);
    expect(result).toMatchObject({
      status: 'FAILED',
      controllerVersion: 'v1.1.0',
      liveAgentTeamRun: false,
      limitations: ['RUNTIME_VERSION_MISMATCH', 'NO_LIVE_AGENTTEAM_RUN']
    });
  });

  it('fails an unreachable runtime dependency', async () => {
    const failingFetch = async () => {
      throw new TypeError('unreachable');
    };
    const result = await probeRuntime(safeProfile, 'http://fixture.invalid', 'CONTROLLED_FIXTURE', failingFetch);
    expect(result).toMatchObject({status: 'FAILED', limitations: ['RUNTIME_DEPENDENCY_UNREACHABLE']});
  });
});
