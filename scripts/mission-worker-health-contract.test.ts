import {describe, expect, it} from 'vitest';
import {assertMissionWorkerHealthContract, classifyMissionWorkerHealth} from './mission-worker-health-contract.mjs';

describe('legacy Compose mission-worker health contract', () => {
  it('preserves the legacy PostgreSQL shadow-preparation contract', () => {
    expect(classifyMissionWorkerHealth({
      controlPlane: 'POSTGRESQL',
      executionMode: 'SHADOW_PREP_ONLY',
      externalActionAllowed: false
    })).toBe('LEGACY_SHADOW_PREP_ONLY');
  });

  it('accepts the honest persistent-runtime not-configured projection', () => {
    expect(classifyMissionWorkerHealth({
      state: 'NOT_CONFIGURED',
      reasonCode: 'RUNTIME_NOT_CONFIGURED',
      controlPlane: {state: 'READY', source: 'POSTGRESQL'},
      worker: {state: 'NOT_CONFIGURED'},
      authority: {mode: 'NOT_CONFIGURED'},
      externalActionAllowed: false
    })).toBe('PERSISTENT_CONTROL_PLANE_NOT_CONFIGURED');
  });

  it('rejects fake readiness, unreachable control plane, external action, and dishonest legacy claims', () => {
    for (const value of [
      {state: 'READY', controlPlane: {state: 'READY', source: 'POSTGRESQL'}, externalActionAllowed: false},
      {state: 'NOT_CONFIGURED', reasonCode: 'RUNTIME_NOT_CONFIGURED', controlPlane: {state: 'UNREACHABLE', source: 'POSTGRESQL'}, worker: {state: 'NOT_CONFIGURED'}, authority: {mode: 'NOT_CONFIGURED'}, externalActionAllowed: false},
      {controlPlane: 'POSTGRESQL', executionMode: 'SHADOW_PREP_ONLY', externalActionAllowed: true},
      {state: 'NOT_CONFIGURED', reasonCode: 'RUNTIME_NOT_CONFIGURED', controlPlane: {state: 'READY', source: 'POSTGRESQL'}, worker: {state: 'NOT_CONFIGURED'}, authority: {mode: 'NOT_CONFIGURED'}, executionMode: 'LIVE', externalActionAllowed: false}
    ]) expect(() => assertMissionWorkerHealthContract(value)).toThrow('MISSION_WORKER_CONTROL_PLANE_CONTRACT_INVALID');
  });
});
