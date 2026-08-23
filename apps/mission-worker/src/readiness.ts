import type {RuntimeReadinessState} from '@lumiclaw/domain';

export function notConfiguredMissionWorkerReadiness(postgresql: boolean, workerId: string) {
  const controlPlane = {state: postgresql ? 'READY' as const : 'UNREACHABLE' as const, source: 'POSTGRESQL' as const};
  return {
    service: 'mission-worker',
    state: postgresql ? 'NOT_CONFIGURED' as const : 'UNREACHABLE' as const,
    reasonCode: postgresql ? 'RUNTIME_NOT_CONFIGURED' as const : 'RUNTIME_UNREACHABLE' as const,
    controlPlane,
    worker: {state: 'NOT_CONFIGURED' as const, workerId, heartbeatAt: null, lastTick: 'NOT_CONFIGURED' as const},
    gateway: {state: 'NOT_CONFIGURED' as const, providerMode: 'UNKNOWN', controlledFake: false, configured: false, fingerprint: null, updatedAt: null},
    agentTeams: {state: 'NOT_CONFIGURED' as const, memberCount: 0, version: 'UNOBSERVED', sourceCommit: 'UNOBSERVED', sourceTarSha256: 'UNOBSERVED', teamProfileVersion: 'UNOBSERVED', teamProfileDigest: 'UNOBSERVED', imageDigests: [], pinnedIdentityVerified: false, identityEvidence: null},
    authority: {mode: 'NOT_CONFIGURED' as const, dockerSocketMounted: false, fixedCommandSurface: true, webDockerAuthority: false, apiDockerAuthority: false, gatewayDockerAuthority: false},
    externalActionAllowed: false,
    secretPresentInResponse: false
  };
}

export function missionWorkerHealthStatus(state: RuntimeReadinessState): 200 | 503 {
  return state === 'UNREACHABLE' ? 503 : 200;
}
