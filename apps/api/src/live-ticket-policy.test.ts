import type {ShadowMissionState, TaskContract} from '@lumiclaw/governed-shadow';
import {describe, expect, it} from 'vitest';
import {liveTaskActionPhaseAllowed, type LivePhasedTaskAction} from './live-ticket-policy.js';

const initialKinds = ['PROJECT_COORDINATION', 'FREEZE_EVIDENCE', 'PLAN_CAMPAIGN', 'PRODUCE_FOUNDER', 'PRODUCE_PRODUCT', 'AUDIT_REVISIONS'] as const satisfies readonly TaskContract['kind'][];
const modelInitialKinds = initialKinds.filter((kind) => kind !== 'PROJECT_COORDINATION');
const taskActions = ['TASK_ACK', 'MODEL_GENERATE', 'TASK_SUBMIT'] as const satisfies readonly LivePhasedTaskAction[];
const activePhases = ['RUNNING', 'REVISION_REQUIRED', 'AUDIT_BLOCKED'] as const satisfies readonly ShadowMissionState[];

describe('Live ticket action + Task kind + Mission phase policy', () => {
  it('allows every initial ACK/Submit only in RUNNING and every initial model call except Leader only in RUNNING', () => {
    for (const kind of initialKinds) {
      expect(liveTaskActionPhaseAllowed('TASK_ACK', 'RUNNING', kind), `${kind} ACK`).toBe(true);
      expect(liveTaskActionPhaseAllowed('TASK_SUBMIT', 'RUNNING', kind), `${kind} Submit`).toBe(true);
      expect(liveTaskActionPhaseAllowed('MODEL_GENERATE', 'RUNNING', kind), `${kind} Model`).toBe(kind !== 'PROJECT_COORDINATION');
    }
    expect(modelInitialKinds).toHaveLength(5);
  });

  it('allows correction actions only in REVISION_REQUIRED and re-audit actions only in AUDIT_BLOCKED', () => {
    for (const action of taskActions) {
      expect(liveTaskActionPhaseAllowed(action, 'REVISION_REQUIRED', 'PRODUCE_FOUNDER_CORRECTION'), `correction ${action}`).toBe(true);
      expect(liveTaskActionPhaseAllowed(action, 'AUDIT_BLOCKED', 'REAUDIT_CORRECTION'), `re-audit ${action}`).toBe(true);
    }
  });

  it('rejects every wrong phase for every Task kind and action', () => {
    const expectedPhase = new Map<TaskContract['kind'], ShadowMissionState>([
      ...initialKinds.map((kind) => [kind, 'RUNNING'] as const),
      ['PRODUCE_FOUNDER_CORRECTION', 'REVISION_REQUIRED'],
      ['REAUDIT_CORRECTION', 'AUDIT_BLOCKED']
    ]);
    for (const [kind, phase] of expectedPhase) for (const action of taskActions) for (const candidate of activePhases) {
      if (candidate === phase && !(action === 'MODEL_GENERATE' && kind === 'PROJECT_COORDINATION')) continue;
      expect(liveTaskActionPhaseAllowed(action, candidate, kind), `${kind} ${action} in ${candidate}`).toBe(false);
    }
  });

  it('rejects all terminal, queued, waiting and failure phases without a permissive fallback', () => {
    const forbiddenPhases = ['QUEUED', 'WAITING_RUNTIME', 'WAITING_DEPENDENCY', 'NEEDS_OWNER_REVIEW', 'AWAITING_OWNER_REVIEW', 'FAILED', 'TIMED_OUT', 'CANCELLED', 'UNKNOWN_RECOVERY', 'SHADOW_COMPLETE', 'COMPLETED_SHADOW'] as const satisfies readonly ShadowMissionState[];
    for (const phase of forbiddenPhases) for (const action of taskActions) {
      expect(liveTaskActionPhaseAllowed(action, phase, 'PRODUCE_FOUNDER_CORRECTION'), `${action} in ${phase}`).toBe(false);
      expect(liveTaskActionPhaseAllowed(action, phase, 'REAUDIT_CORRECTION'), `${action} in ${phase}`).toBe(false);
    }
  });
});
