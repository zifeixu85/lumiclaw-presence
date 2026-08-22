export function classifyMissionWorkerHealth(value) {
  if (value === null || typeof value !== 'object' || value.externalActionAllowed !== false) return null;

  if (value.controlPlane === 'POSTGRESQL' && value.executionMode === 'SHADOW_PREP_ONLY') {
    return 'LEGACY_SHADOW_PREP_ONLY';
  }

  const controlPlane = value.controlPlane;
  const worker = value.worker;
  const authority = value.authority;
  if (
    value.state === 'NOT_CONFIGURED'
    && value.reasonCode === 'RUNTIME_NOT_CONFIGURED'
    && controlPlane !== null
    && typeof controlPlane === 'object'
    && controlPlane.source === 'POSTGRESQL'
    && controlPlane.state === 'READY'
    && worker !== null
    && typeof worker === 'object'
    && worker.state === 'NOT_CONFIGURED'
    && authority !== null
    && typeof authority === 'object'
    && authority.mode === 'NOT_CONFIGURED'
    && (value.executionMode === undefined || value.executionMode === 'SHADOW_PREP_ONLY')
  ) {
    return 'PERSISTENT_CONTROL_PLANE_NOT_CONFIGURED';
  }

  return null;
}

export function assertMissionWorkerHealthContract(value) {
  const contract = classifyMissionWorkerHealth(value);
  if (contract === null) throw new Error('MISSION_WORKER_CONTROL_PLANE_CONTRACT_INVALID');
  return contract;
}
