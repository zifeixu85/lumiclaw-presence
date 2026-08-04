import {createHash} from 'node:crypto';

export const LIVE_TASK_PROTOCOL_ACTION = Object.freeze({
  DELEGATE: 'DELEGATE',
  ACK: 'ACK',
  IMPORT_ACK: 'IMPORT_ACK',
  RUN_DOMAIN: 'RUN_DOMAIN',
  SUBMIT: 'SUBMIT',
  CHECK_IMPORT: 'CHECK_IMPORT',
  ACCEPT: 'ACCEPT',
  COMPLETE: 'COMPLETE'
});

export const LIVE_TASK_PROTOCOL_OUTCOMES = Object.freeze([
  'LIVE_TASK_INSPECT_FAILED',
  'LIVE_TASK_BINDING_INVALID',
  'LIVE_TASK_STATE_INVALID',
  'LIVE_TASK_DELEGATE_FAILED',
  'LIVE_TASK_DELEGATE_RECONCILE_FAILED',
  'LIVE_TASK_ACK_FAILED',
  'LIVE_TASK_ACK_IMPORT_FAILED',
  'LIVE_TASK_DOMAIN_RESUME_UNSAFE',
  'LIVE_TASK_SUBMIT_FAILED',
  'LIVE_TASK_CHECK_FAILED',
  'LIVE_TASK_SUBMISSION_IMPORT_FAILED',
  'LIVE_TASK_ACCEPT_FAILED',
  'LIVE_TASK_REPLAY_CONFLICT'
]);

const outcomeSet = new Set(LIVE_TASK_PROTOCOL_OUTCOMES);
const planStates = new Set(['pending', 'delegated', 'completed']);
const taskStates = new Set(['assigned', 'in_progress', 'submitted']);
const digestPattern = /^[a-f0-9]{64}$/u;
const diagnosticStatusByOutcome = Object.freeze({
  LIVE_TASK_INSPECT_FAILED: {planStatus: null, taskStatus: null},
  LIVE_TASK_BINDING_INVALID: {planStatus: null, taskStatus: null},
  LIVE_TASK_STATE_INVALID: {planStatus: 'delegated', taskStatus: null},
  LIVE_TASK_DELEGATE_FAILED: {planStatus: 'pending', taskStatus: null},
  LIVE_TASK_DELEGATE_RECONCILE_FAILED: {planStatus: 'delegated', taskStatus: 'assigned'},
  LIVE_TASK_ACK_FAILED: {planStatus: 'delegated', taskStatus: 'assigned'},
  LIVE_TASK_ACK_IMPORT_FAILED: {planStatus: 'delegated', taskStatus: 'in_progress'},
  LIVE_TASK_DOMAIN_RESUME_UNSAFE: {planStatus: 'delegated', taskStatus: 'in_progress'},
  LIVE_TASK_SUBMIT_FAILED: {planStatus: 'delegated', taskStatus: 'in_progress'},
  LIVE_TASK_CHECK_FAILED: {planStatus: 'delegated', taskStatus: 'submitted'},
  LIVE_TASK_SUBMISSION_IMPORT_FAILED: {planStatus: 'delegated', taskStatus: 'submitted'},
  LIVE_TASK_ACCEPT_FAILED: {planStatus: 'delegated', taskStatus: 'submitted'},
  LIVE_TASK_REPLAY_CONFLICT: {planStatus: 'delegated', taskStatus: 'in_progress'}
});

export class LiveTaskProtocolError extends Error {
  constructor(code, status = {planStatus: null, taskStatus: null}) {
    super(code);
    this.name = 'LiveTaskProtocolError';
    this.code = code;
    this.status = Object.freeze({...status});
  }
}

export function isLiveTaskProtocolOutcome(value) {
  return typeof value === 'string' && outcomeSet.has(value);
}

export function isLiveTaskProtocolStatus(value) {
  return isRecord(value)
    && Object.keys(value).sort().join(',') === 'planStatus,taskStatus'
    && (value.planStatus === null || planStates.has(value.planStatus))
    && (value.taskStatus === null || taskStates.has(value.taskStatus));
}

export function taskProtocolDiagnosticStatus(outcome) {
  if (!isLiveTaskProtocolOutcome(outcome)) throw new LiveTaskProtocolError('LIVE_TASK_STATE_INVALID');
  return Object.freeze({...diagnosticStatusByOutcome[outcome]});
}

export function taskContractDigest(contract) {
  return sha256(contract);
}

export function safeTaskProtocolStatus(snapshot) {
  const planStatus = planStates.has(snapshot?.task?.plan?.status) ? snapshot.task.plan.status : null;
  const taskStatus = taskStates.has(snapshot?.task?.meta?.status) ? snapshot.task.meta.status : null;
  return {planStatus, taskStatus};
}

export function planLiveTaskProtocol(input) {
  const {snapshot, binding, controlTask} = input;
  const status = safeTaskProtocolStatus(snapshot);
  try {
    validateBinding(snapshot, binding, controlTask);
    const planStatus = snapshot.task.plan.status;
    const taskMeta = snapshot.task.meta;
    const result = snapshot.task.result;

    if (planStatus === 'pending') {
      if (taskMeta !== null || snapshot.task.spec !== null || result !== null) conflict(status);
      if (controlTask.state !== 'ASSIGNED' || controlTask.runtimeAck !== null || controlTask.runtimeSubmission !== null || controlTask.acceptedOutputDigest !== null) conflict(status);
      return decision('DELEGATE', status, binding);
    }

    if (planStatus === 'completed') {
      validateDelegatedMaterial(snapshot, binding, status);
      if (taskMeta.status !== 'submitted' || result === null || controlTask.state !== 'ACCEPTED') conflict(status);
      validateAcceptedControlTask(controlTask, binding, result, status);
      return decision('COMPLETE', status, binding);
    }

    if (planStatus !== 'delegated') stateInvalid(status);
    validateDelegatedMaterial(snapshot, binding, status);

    if (taskMeta.status === 'assigned') {
      if (result !== null || controlTask.state !== 'ASSIGNED' || controlTask.runtimeAck !== null || controlTask.runtimeSubmission !== null || controlTask.acceptedOutputDigest !== null) conflict(status);
      return decision('ACK', status, binding);
    }

    if (taskMeta.status === 'in_progress') {
      if (result !== null || !isIso(taskMeta.acknowledged_at)) stateInvalid(status);
      if (controlTask.state === 'ASSIGNED' && controlTask.runtimeAck === null) return decision('IMPORT_ACK', status, binding);
      validateControlAck(controlTask, binding, taskMeta, status);
      const modelCallCount = input.modelCallCount ?? 0;
      if (!Number.isSafeInteger(modelCallCount) || modelCallCount < 0 || modelCallCount > 1) conflict(status);
      if (modelCallCount === 0 && input.preparedOutputDigest === undefined) return decision('RUN_DOMAIN', status, binding);
      if (modelCallCount === 1 && isDigest(input.preparedOutputDigest) && input.modelOutputDigest === input.preparedOutputDigest) return decision('SUBMIT', status, binding);
      if (controlTask.roleId === 'presence-mission-leader' && modelCallCount === 0 && isDigest(input.preparedOutputDigest)) return decision('SUBMIT', status, binding);
      throw new LiveTaskProtocolError('LIVE_TASK_DOMAIN_RESUME_UNSAFE', status);
    }

    if (taskMeta.status === 'submitted') {
      if (result === null || !isIso(taskMeta.acknowledged_at) || !isIso(taskMeta.submitted_at)) stateInvalid(status);
      if (controlTask.state === 'ACKNOWLEDGED') {
        validateControlAck(controlTask, binding, taskMeta, status);
        if (controlTask.runtimeSubmission !== null || controlTask.acceptedOutputDigest !== null) conflict(status);
        return decision('CHECK_IMPORT', status, binding);
      }
      if (controlTask.state === 'ACCEPTED') {
        validateAcceptedControlTask(controlTask, binding, result, status);
        return decision('ACCEPT', status, binding);
      }
      conflict(status);
    }

    stateInvalid(status);
  } catch (error) {
    if (error instanceof LiveTaskProtocolError) throw error;
    throw new LiveTaskProtocolError('LIVE_TASK_BINDING_INVALID', status);
  }
}

function validateBinding(snapshot, binding, controlTask) {
  if (!isRecord(snapshot) || !isRecord(snapshot.project) || !isRecord(snapshot.task) || !isRecord(snapshot.task.plan)) invalid();
  if (!isRecord(binding) || !isRecord(binding.contract) || !isDigest(binding.contractDigest)) invalid();
  const expectedContractDigest = taskContractDigest(binding.contract);
  if (binding.contractDigest !== expectedContractDigest) invalid();
  if (snapshot.project.project_id !== binding.projectId || snapshot.project.status !== 'active') invalid();
  const plan = snapshot.task.plan;
  if (plan.task_id !== binding.taskId || plan.assigned_to !== binding.roleId || !sameArray(plan.depends_on, binding.dependsOn) || !planStates.has(plan.status)) invalid();
  if (!isRecord(controlTask)
    || controlTask.id !== binding.taskId
    || controlTask.roleId !== binding.roleId
    || controlTask.roleIdentityId !== binding.roleIdentityId
    || controlTask.attempt !== binding.attempt
    || controlTask.inputDigest !== binding.contract.inputDigest
    || controlTask.inputProjectionSchema !== binding.contract.inputProjectionSchema
    || controlTask.inputProjectionDigest !== binding.contract.inputProjectionDigest
    || controlTask.skillLockDigest !== binding.contract.skillLockDigest
    || controlTask.outputSchema !== binding.contract.outputSchema
    || controlTask.outputSchemaVersion !== binding.contract.outputSchemaVersion) invalid();
}

function validateDelegatedMaterial(snapshot, binding, status) {
  const meta = snapshot.task.meta;
  if (!isRecord(meta)
    || meta.task_id !== binding.taskId
    || meta.project_id !== binding.projectId
    || meta.assigned_to !== binding.roleId
    || meta.room_id !== binding.roomId
    || !sameArray(meta.depends_on, binding.dependsOn)
    || !taskStates.has(meta.status)
    || !isIso(meta.assigned_at)
    || typeof snapshot.task.spec !== 'string') invalid(status);
  let spec;
  try { spec = JSON.parse(snapshot.task.spec); } catch { invalid(status); }
  if (taskContractDigest(spec) !== binding.contractDigest) invalid(status);
}

function validateControlAck(controlTask, binding, taskMeta, status) {
  const ack = controlTask.runtimeAck;
  if (controlTask.state !== 'ACKNOWLEDGED'
    || !isRecord(ack)
    || ack.projectId !== binding.projectId
    || ack.taskId !== binding.taskId
    || ack.roleId !== binding.roleId
    || ack.runtimeActorId !== binding.runtimeActorId
    || ack.attempt !== binding.attempt
    || ack.inputProjectionSchema !== binding.contract.inputProjectionSchema
    || ack.inputProjectionDigest !== binding.contract.inputProjectionDigest
    || ack.runtimeState !== 'in_progress'
    || ack.acknowledgedAt !== taskMeta.acknowledged_at
    || !isDigest(ack.receiptDigest)) conflict(status);
}

function validateAcceptedControlTask(controlTask, binding, result, status) {
  const submission = controlTask.runtimeSubmission;
  if (!isRecord(result) || !isRecord(submission) || controlTask.runtimeAck === null || !isDigest(controlTask.acceptedOutputDigest)) conflict(status);
  validateControlAck({...controlTask, state: 'ACKNOWLEDGED'}, binding, {acknowledged_at: controlTask.runtimeAck.acknowledgedAt}, status);
  let runtimeResult;
  try { runtimeResult = JSON.parse(result.summary); } catch { conflict(status); }
  if (!isRecord(runtimeResult)
    || runtimeResult.taskId !== binding.taskId
    || runtimeResult.roleId !== binding.roleId
    || runtimeResult.inputProjectionSchema !== binding.contract.inputProjectionSchema
    || runtimeResult.inputProjectionDigest !== binding.contract.inputProjectionDigest
    || runtimeResult.outputDigest !== controlTask.acceptedOutputDigest
    || sha256(runtimeResult.payload) !== runtimeResult.outputDigest
    || submission.projectId !== binding.projectId
    || submission.taskId !== binding.taskId
    || submission.roleId !== binding.roleId
    || submission.runtimeActorId !== binding.runtimeActorId
    || submission.attempt !== binding.attempt
    || submission.ackReceiptDigest !== controlTask.runtimeAck.receiptDigest
    || submission.inputProjectionSchema !== binding.contract.inputProjectionSchema
    || submission.inputProjectionDigest !== binding.contract.inputProjectionDigest
    || submission.runtimeState !== 'submitted'
    || !isDigest(submission.resultDigest)
    || !isDigest(submission.receiptDigest)) conflict(status);
}

function decision(action, status, binding) {
  return Object.freeze({
    action: LIVE_TASK_PROTOCOL_ACTION[action],
    status: Object.freeze({...status}),
    bindingDigest: sha256({projectId: binding.projectId, taskId: binding.taskId, roleId: binding.roleId, runtimeActorId: binding.runtimeActorId, attempt: binding.attempt, contractDigest: binding.contractDigest})
  });
}

function invalid(status = {planStatus: null, taskStatus: null}) { throw new LiveTaskProtocolError('LIVE_TASK_BINDING_INVALID', status); }
function conflict(status) { throw new LiveTaskProtocolError('LIVE_TASK_REPLAY_CONFLICT', status); }
function stateInvalid(status) { throw new LiveTaskProtocolError('LIVE_TASK_STATE_INVALID', status); }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isDigest(value) { return typeof value === 'string' && digestPattern.test(value); }
function isIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function sameArray(left, right) { return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]); }
function sha256(value) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex'); }
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])])); return value; }
