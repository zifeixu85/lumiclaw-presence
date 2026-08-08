import type {ShadowMissionState, TaskContract} from '@lumiclaw/governed-shadow';

export type LivePhasedTaskAction = 'TASK_ACK' | 'MODEL_GENERATE' | 'TASK_SUBMIT';
export type LiveTaskKind = TaskContract['kind'];

const phaseByTaskKind: Readonly<Record<LiveTaskKind, ShadowMissionState>> = Object.freeze({
  PROJECT_COORDINATION: 'RUNNING',
  FREEZE_EVIDENCE: 'RUNNING',
  PLAN_CAMPAIGN: 'RUNNING',
  PRODUCE_FOUNDER: 'RUNNING',
  PRODUCE_PRODUCT: 'RUNNING',
  AUDIT_REVISIONS: 'RUNNING',
  PRODUCE_FOUNDER_CORRECTION: 'REVISION_REQUIRED',
  REAUDIT_CORRECTION: 'AUDIT_BLOCKED'
});

export function liveTaskActionPhaseAllowed(action: LivePhasedTaskAction, missionState: ShadowMissionState, taskKind: LiveTaskKind): boolean {
  if (phaseByTaskKind[taskKind] !== missionState) return false;
  return action !== 'MODEL_GENERATE' || taskKind !== 'PROJECT_COORDINATION';
}
