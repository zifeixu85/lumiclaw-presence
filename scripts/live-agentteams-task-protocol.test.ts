import {describe, expect, it} from 'vitest';
import {LiveTaskProtocolError, planLiveTaskProtocol, safeTaskProtocolStatus, taskContractDigest} from './live-agentteams-task-protocol.mjs';

const marker = 'dummy-secret-ticket-authorization-bearer-raw-response-never-leak';
const now = '2026-08-04T00:00:00.000Z';

function fixture(overrides: Record<string, unknown> = {}) {
  const contract = {
    schemaVersion: 1, projectId: 'project-1', taskId: 'correction-task', roleId: 'founder-identity-producer', roleIdentityId: 'identity-founder',
    inputDigest: '1'.repeat(64), inputProjectionSchema: 'lumiclaw.shadow.task-input.produce-founder-correction.v1', inputProjectionDigest: '2'.repeat(64),
    skillLockDigest: '3'.repeat(64), outputSchema: 'lumiclaw.shadow.produce_founder_correction.v1', outputSchemaVersion: 1,
    executionMode: 'SHADOW_PREP_ONLY', externalActionAllowed: false
  };
  const binding = {projectId: contract.projectId, taskId: contract.taskId, roleId: contract.roleId, roleIdentityId: contract.roleIdentityId, runtimeActorId: '@founder:runtime.test', attempt: 2, dependsOn: ['audit-task'], roomId: '!room:runtime.test', contract, contractDigest: taskContractDigest(contract)};
  const task = {id: contract.taskId, roleId: contract.roleId, roleIdentityId: contract.roleIdentityId, attempt: 2, inputDigest: contract.inputDigest, inputProjectionSchema: contract.inputProjectionSchema, inputProjectionDigest: contract.inputProjectionDigest, skillLockDigest: contract.skillLockDigest, outputSchema: contract.outputSchema, outputSchemaVersion: 1, state: 'ASSIGNED', runtimeAck: null, runtimeSubmission: null, acceptedOutputDigest: null};
  const snapshot = {project: {project_id: contract.projectId, status: 'active'}, task: {plan: {task_id: contract.taskId, title: 'Correct X', assigned_to: contract.roleId, depends_on: ['audit-task'], status: 'pending'}, meta: null, spec: null, result: null}};
  return {snapshot, binding, controlTask: task, ...overrides};
}

function delegated(metaStatus: string, result: unknown = null) {
  const base = fixture();
  return {...base.snapshot, task: {...base.snapshot.task, plan: {...base.snapshot.task.plan, status: 'delegated'}, meta: {task_id: base.binding.taskId, project_id: base.binding.projectId, task_title: 'Correct X', assigned_to: base.binding.roleId, room_id: base.binding.roomId, status: metaStatus, depends_on: base.binding.dependsOn, assigned_at: now, acknowledged_at: metaStatus === 'assigned' ? null : now, submitted_at: metaStatus === 'submitted' ? now : null}, spec: JSON.stringify(base.binding.contract), result}};
}

function ackedTask() {
  const base = fixture();
  const ack = {schemaVersion: 1, projectId: base.binding.projectId, taskId: base.binding.taskId, roleId: base.binding.roleId, runtimeActorId: base.binding.runtimeActorId, attempt: 2, inputProjectionSchema: base.binding.contract.inputProjectionSchema, inputProjectionDigest: base.binding.contract.inputProjectionDigest, runtimeState: 'in_progress', acknowledgedAt: now, receiptDigest: '4'.repeat(64)};
  return {...base.controlTask, state: 'ACKNOWLEDGED', runtimeAck: ack};
}

function submittedFixture(accepted = false, completed = false) {
  const base = fixture(); const payload = {revisions: [{platform: 'X'}]}; const outputDigest = taskContractDigest(payload);
  const runtimeResult = {schemaVersion: 1, taskId: base.binding.taskId, roleId: base.binding.roleId, inputProjectionSchema: base.binding.contract.inputProjectionSchema, inputProjectionDigest: base.binding.contract.inputProjectionDigest, payload, outputDigest, maturity: 'CANARY', externalActionAllowed: false};
  const result = {status: 'SUCCESS', summary: JSON.stringify(runtimeResult), deliverables: [], notes: []};
  let controlTask = ackedTask();
  if (accepted) controlTask = {...controlTask, state: 'ACCEPTED', acceptedOutputDigest: outputDigest, runtimeSubmission: {schemaVersion: 1, projectId: base.binding.projectId, taskId: base.binding.taskId, roleId: base.binding.roleId, runtimeActorId: base.binding.runtimeActorId, attempt: 2, ackReceiptDigest: controlTask.runtimeAck!.receiptDigest, inputProjectionSchema: base.binding.contract.inputProjectionSchema, inputProjectionDigest: base.binding.contract.inputProjectionDigest, runtimeState: 'submitted', submittedAt: now, resultDigest: '5'.repeat(64), resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY', runtimeObservationId: '6'.repeat(64), receiptDigest: '7'.repeat(64)}};
  const snapshot = delegated('submitted', result);
  if (completed) snapshot.task.plan.status = 'completed';
  return {...base, snapshot, controlTask, runtimeResult};
}

describe('Live AgentTeams exact task protocol planner', () => {
  it('delegates only pending and accepts the same member second dependent task when already delegated', () => {
    const pending = fixture();
    expect(planLiveTaskProtocol(pending)).toMatchObject({action: 'DELEGATE', status: {planStatus: 'pending', taskStatus: null}});
    const secondTask = {...pending, snapshot: delegated('assigned')};
    expect(planLiveTaskProtocol(secondTask)).toMatchObject({action: 'ACK', status: {planStatus: 'delegated', taskStatus: 'assigned'}});
  });

  it('plans exact ACK import, domain execution and in-memory submit without replaying an accepted model call', () => {
    const base = fixture();
    expect(planLiveTaskProtocol({...base, snapshot: delegated('in_progress')})).toMatchObject({action: 'IMPORT_ACK'});
    const controlTask = ackedTask();
    expect(planLiveTaskProtocol({...base, snapshot: delegated('in_progress'), controlTask, modelCallCount: 0})).toMatchObject({action: 'RUN_DOMAIN'});
    expect(planLiveTaskProtocol({...base, snapshot: delegated('in_progress'), controlTask, modelCallCount: 1, modelOutputDigest: '8'.repeat(64), preparedOutputDigest: '8'.repeat(64)})).toMatchObject({action: 'SUBMIT'});
    expect(() => planLiveTaskProtocol({...base, snapshot: delegated('in_progress'), controlTask, modelCallCount: 1})).toThrowError(expect.objectContaining({code: 'LIVE_TASK_DOMAIN_RESUME_UNSAFE'}));
  });

  it('reconciles submitted and accepted results without skipping real Check or completion', () => {
    const submitted = submittedFixture(false, false);
    expect(planLiveTaskProtocol(submitted)).toMatchObject({action: 'CHECK_IMPORT'});
    const accepted = submittedFixture(true, false);
    expect(planLiveTaskProtocol(accepted)).toMatchObject({action: 'ACCEPT'});
    const completed = submittedFixture(true, true);
    expect(planLiveTaskProtocol(completed)).toMatchObject({action: 'COMPLETE'});
  });

  it.each([
    ['project', (value: ReturnType<typeof fixture>) => { value.snapshot.project.project_id = 'wrong'; }],
    ['task', (value: ReturnType<typeof fixture>) => { value.snapshot.task.plan.task_id = 'wrong'; }],
    ['member', (value: ReturnType<typeof fixture>) => { value.snapshot.task.plan.assigned_to = 'independent-auditor'; }],
    ['attempt', (value: ReturnType<typeof fixture>) => { value.controlTask.attempt = 3; }],
    ['digest', (value: ReturnType<typeof fixture>) => { value.binding.contractDigest = '9'.repeat(64); }]
  ])('rejects wrong %s binding', (_name, mutate) => {
    const value = fixture(); mutate(value);
    expect(() => planLiveTaskProtocol(value)).toThrowError(expect.objectContaining({code: 'LIVE_TASK_BINDING_INVALID'}));
  });

  it('rejects invalid/unknown states and duplicate or contradictory transitions', () => {
    const unknown = fixture(); unknown.snapshot.task.plan.status = 'blocked';
    expect(safeTaskProtocolStatus(unknown.snapshot)).toEqual({planStatus: null, taskStatus: null});
    expect(() => planLiveTaskProtocol(unknown)).toThrowError(expect.objectContaining({code: 'LIVE_TASK_BINDING_INVALID'}));
    const replay = fixture(); replay.controlTask.state = 'ACCEPTED'; replay.controlTask.acceptedOutputDigest = 'a'.repeat(64);
    expect(() => planLiveTaskProtocol(replay)).toThrowError(expect.objectContaining({code: 'LIVE_TASK_REPLAY_CONFLICT'}));
    const duplicateModel = {...fixture(), snapshot: delegated('in_progress'), controlTask: ackedTask(), modelCallCount: 2};
    expect(() => planLiveTaskProtocol(duplicateModel)).toThrowError(expect.objectContaining({code: 'LIVE_TASK_REPLAY_CONFLICT'}));
  });

  it('exposes only allowlisted code and state when a forbidden marker is present in untrusted data', () => {
    const value = fixture(); value.snapshot.task.plan.assigned_to = marker;
    try { planLiveTaskProtocol(value); throw new Error('expected failure'); }
    catch (error) {
      expect(error).toBeInstanceOf(LiveTaskProtocolError);
      expect(JSON.stringify({code: (error as LiveTaskProtocolError).code, status: (error as LiveTaskProtocolError).status})).not.toContain(marker);
    }
  });
});
