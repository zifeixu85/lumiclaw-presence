import {createDemoCampaignDocument, sha256Digest} from '@lumiclaw/domain';
import {createShadowMission, runtimeTaskSubmissionReceiptDigest, type RuntimeSubmission, type ShadowMission, type TaskContract} from '@lumiclaw/governed-shadow';
import {describe, expect, it} from 'vitest';
import {AgentTeamsV120ShadowAdapter, InMemoryAgentTeamsV120Transport} from './shadow-adapter.js';

const campaign = createDemoCampaignDocument(); const now = () => new Date('2026-08-04T02:00:00.000Z');
const mission = () => createShadowMission({campaign, campaignVersion: 1, campaignDigest: campaign.missionContract.sourceDigest, now: now()});
const members = (value = mission()) => value.roleContexts.map((context) => ({name: context.roleId, roleIdentityId: context.identityId, runtimeActorId: `@${context.roleId}:runtime.test`, runtime: 'copaw' as const, state: 'READY' as const}));

function submission(value: ShadowMission, task: TaskContract, payload: unknown): RuntimeSubmission {
  const current = value.tasks.find((item) => item.id === task.id)!; const outputDigest = sha256Digest(payload);
  const resultDigest = sha256Digest({schemaVersion: 1, taskId: task.id, roleId: task.roleId, payload, outputDigest, maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false});
  const base = {schemaVersion: 1 as const, projectId: value.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId: current.runtimeAck!.runtimeActorId, attempt: task.attempt, ackReceiptDigest: current.runtimeAck!.receiptDigest, runtimeState: 'submitted' as const, submittedAt: now().toISOString(), resultDigest};
  return {schemaVersion: 1, missionId: value.id, taskId: task.id, roleId: task.roleId, roleIdentityId: task.roleIdentityId, inputDigest: task.inputDigest, skillLockDigest: task.skillLockDigest, outputSchema: task.outputSchema, outputSchemaVersion: 1, payload, outputDigest, runtimeResultMaturity: 'MOCK_CONFORMANCE', runtimeReceipt: {...base, receiptDigest: runtimeTaskSubmissionReceiptDigest(base)}};
}

describe('AgentTeams v1.2.0 SHADOW Runtime Adapter', () => {
  it('creates one Project, six-member DAG and observes runtime state', async () => {
    const value = mission(); const result = await new AgentTeamsV120ShadowAdapter(new InMemoryAgentTeamsV120Transport(members(value)), now).dispatch(value);
    expect(result.accepted).toBe(true); expect(result.runtime).toMatchObject({state: 'ready'}); expect(Object.keys(result.runtime!.taskStates)).toHaveLength(6); expect(result.mission.runtimeProjectDispatch?.memberBindings).toHaveLength(6);
  });

  it('fails closed for version, member count and identity collision', async () => {
    const value = mission(); const bad = members(value).slice(0, 5); bad[1]!.roleIdentityId = bad[0]!.roleIdentityId; bad[1]!.runtimeActorId = bad[0]!.runtimeActorId;
    const result = await new AgentTeamsV120ShadowAdapter(new InMemoryAgentTeamsV120Transport(bad, `sha256:${'b'.repeat(64)}`, 'v1.1.0'), now).dispatch(value);
    expect(result.accepted).toBe(false); expect(result.codes).toEqual(expect.arrayContaining(['RUNTIME_VERSION_MISMATCH', 'MEMBER_COUNT_NOT_EXACTLY_SIX', 'MEMBER_IDENTITY_COLLISION']));
  });

  it('enforces dispatch/ACK dependencies and quarantines mismatched Submit', async () => {
    const initial = mission(); const adapter = new AgentTeamsV120ShadowAdapter(new InMemoryAgentTeamsV120Transport(members(initial)), now); const dispatched = await adapter.dispatch(initial);
    const planner = dispatched.mission.tasks.find((task) => task.roleId === 'campaign-planner')!; expect((await adapter.acknowledge(dispatched.mission, planner.id, planner.roleId)).codes).toContain('TASK_PREREQUISITE_NOT_ACCEPTED');
    const evidence = dispatched.mission.tasks.find((task) => task.roleId === 'evidence-claim-steward')!; const acknowledged = await adapter.acknowledge(dispatched.mission, evidence.id, evidence.roleId); const payload = {frozen: true};
    const forged = submission(acknowledged.mission, evidence, payload); forged.inputDigest = '0'.repeat(64);
    const result = await adapter.importSubmission(acknowledged.mission, forged); expect(result.accepted).toBe(false); expect(result.codes).toEqual(expect.arrayContaining(['INPUT_DIGEST_MISMATCH', 'OUTPUT_PAYLOAD_SCHEMA_INVALID']));
  });

  it('accepts only a receipt-bound payload matching the task output schema and rejects later Submit', async () => {
    const initial = mission(); const adapter = new AgentTeamsV120ShadowAdapter(new InMemoryAgentTeamsV120Transport(members(initial)), now); const dispatched = await adapter.dispatch(initial);
    const evidence = dispatched.mission.tasks.find((task) => task.roleId === 'evidence-claim-steward')!; const acknowledged = await adapter.acknowledge(dispatched.mission, evidence.id, evidence.roleId); const payload = {frozen: true, claimEvidenceDigest: 'c'.repeat(64)}; const exact = submission(acknowledged.mission, evidence, payload);
    const accepted = await adapter.importSubmission(acknowledged.mission, exact); expect(accepted.accepted).toBe(true); expect(accepted.mission.tasks.find((task) => task.id === evidence.id)?.state).toBe('ACCEPTED');
    const duplicate = await adapter.importSubmission(accepted.mission, exact); expect(duplicate.accepted).toBe(false); expect(duplicate.codes).toContain('DUPLICATE_ACCEPTED_SUBMISSION');
  });

  it('recovers unavailable runtime as unknown and never invents success', async () => {
    const value = mission(); const transport = new InMemoryAgentTeamsV120Transport(members(value)); const result = await new AgentTeamsV120ShadowAdapter(transport, now).recover(value);
    expect(result.accepted).toBe(false); expect(result.codes).toContain('RUNTIME_RECONCILE_UNAVAILABLE'); expect(result.mission.recovery.status).toBe('UNKNOWN'); expect(result.mission.state).toBe('UNKNOWN_RECOVERY');
  });
});
