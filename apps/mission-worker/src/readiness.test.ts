import {describe, expect, it} from 'vitest';
import {missionWorkerHealthStatus, notConfiguredMissionWorkerReadiness} from './readiness.js';

describe('mission-worker HTTP readiness priority', () => {
  it('uses NOT_CONFIGURED only when the PostgreSQL control plane is reachable', () => {
    const health = notConfiguredMissionWorkerReadiness(true, 'worker-test');
    expect(health).toMatchObject({state: 'NOT_CONFIGURED', reasonCode: 'RUNTIME_NOT_CONFIGURED', controlPlane: {state: 'READY', source: 'POSTGRESQL'}});
    expect(missionWorkerHealthStatus(health.state)).toBe(200);
  });

  it('surfaces PostgreSQL failure as top-level UNREACHABLE and HTTP 503', () => {
    const health = notConfiguredMissionWorkerReadiness(false, 'worker-test');
    expect(health).toMatchObject({state: 'UNREACHABLE', reasonCode: 'RUNTIME_UNREACHABLE', controlPlane: {state: 'UNREACHABLE', source: 'POSTGRESQL'}, worker: {state: 'NOT_CONFIGURED'}});
    expect(missionWorkerHealthStatus(health.state)).toBe(503);
  });
});
