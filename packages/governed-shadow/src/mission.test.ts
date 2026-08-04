import {createDemoCampaignDocument, sha256Digest} from '@lumiclaw/domain';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import {
  AGENTTEAMS_V120_BUILD_DIGEST, acceptRuntimeSubmission, acknowledgeRuntimeTask, cancelMission, compareLatestTwo, createShadowMission, materializeAcceptedRuntimeMission, materializeAcceptedRuntimeProgress,
  missionPublicEvidence, reconcileMission, recordRuntimeProjectDispatch, reviewRevision, runPublicSafeFlight, runtimeDagDigest,
  runtimeMemberSetDigest, runtimeProjectDispatchReceiptDigest, runtimeTaskAckReceiptDigest, runtimeTaskSubmissionReceiptDigest
} from './mission.js';
import {MemoryShadowMissionRepository} from './repository.js';
import type {RuntimeSubmission, ShadowMission, TaskContract} from './types.js';

const now = new Date('2026-08-04T01:00:00.000Z');
const campaign = createDemoCampaignDocument();
const source = () => ({campaign, campaignVersion: 1, campaignDigest: campaign.missionContract.sourceDigest, now});

function dispatch(value: ShadowMission): ShadowMission {
  const memberBindings = value.roleContexts.map((context) => ({roleId: context.roleId, roleIdentityId: context.identityId, runtimeActorId: `@${context.roleId}:runtime.test`}));
  const base = {schemaVersion: 1 as const, projectId: value.runtimeProjectId, runtimeVersion: 'v1.2.0' as const, buildDigest: AGENTTEAMS_V120_BUILD_DIGEST, memberBindings, memberSetDigest: runtimeMemberSetDigest(memberBindings), dagDigest: runtimeDagDigest(value), dispatchedAt: now.toISOString()};
  return recordRuntimeProjectDispatch(value, {...base, receiptDigest: runtimeProjectDispatchReceiptDigest(base)}, now);
}

function acknowledge(value: ShadowMission, task: TaskContract): ShadowMission {
  const binding = value.runtimeProjectDispatch!.memberBindings.find((item) => item.roleId === task.roleId)!;
  const base = {schemaVersion: 1 as const, projectId: value.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId: binding.runtimeActorId, attempt: task.attempt, runtimeState: 'in_progress' as const, acknowledgedAt: now.toISOString()};
  return acknowledgeRuntimeTask(value, {...base, receiptDigest: runtimeTaskAckReceiptDigest(base)}, now);
}

function runtimeSubmission(value: ShadowMission, task: TaskContract, payload: unknown): RuntimeSubmission {
  const liveTask = value.tasks.find((item) => item.id === task.id)!; const outputDigest = sha256Digest(payload);
  const resultDigest = sha256Digest({schemaVersion: 1, taskId: task.id, roleId: task.roleId, payload, outputDigest, maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false});
  const base = {schemaVersion: 1 as const, projectId: value.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId: liveTask.runtimeAck!.runtimeActorId, attempt: task.attempt, ackReceiptDigest: liveTask.runtimeAck!.receiptDigest, runtimeState: 'submitted' as const, submittedAt: now.toISOString(), resultDigest, resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY' as const, runtimeObservationId: sha256Digest({taskId: task.id, resultDigest, source: 'test-persisted-summary'})};
  return {schemaVersion: 1, missionId: value.id, taskId: task.id, roleId: task.roleId, roleIdentityId: task.roleIdentityId, inputDigest: task.inputDigest, skillLockDigest: task.skillLockDigest, outputSchema: task.outputSchema, outputSchemaVersion: 1, payload, outputDigest, runtimeResultMaturity: 'MOCK_CONFORMANCE', runtimeReceipt: {...base, receiptDigest: runtimeTaskSubmissionReceiptDigest(base)}};
}

describe('M2 governed SHADOW Mission', () => {
  it('compiles exactly six separated contexts, five SkillLocks and a dependency DAG', () => {
    const mission = createShadowMission(source());
    expect(mission.roleContexts).toHaveLength(6); expect(new Set(mission.roleContexts.map((item) => item.identityId)).size).toBe(6); expect(mission.skillLocks).toHaveLength(5); expect(mission.tasks).toHaveLength(8);
    expect(mission.roleContexts.find((item) => item.roleId === 'presence-mission-leader')).toMatchObject({orchestrationOnly: true, permissions: ['ORCHESTRATE']});
    expect(mission.roleContexts.find((item) => item.roleId === 'independent-auditor')).toMatchObject({permissions: ['AUDIT']});
    expect(mission.tasks.find((item) => item.roleId === 'independent-auditor')?.prerequisiteTaskIds).toHaveLength(2);
    expect(mission.externalActionAllowed).toBe(false); expect(mission.actionGrantCount).toBe(0);
  });

  it('locks the exact bytes of all five versioned Skill sources', async () => {
    const mission = createShadowMission(source());
    for (const lock of mission.skillLocks) {
      const bytes = await readFile(new URL(`../../../${lock.source}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(lock.digest);
    }
  });

  it('runs the frozen fault, imports four platforms plus one correction, re-audits and reaches exact Owner Review', () => {
    const mission = runPublicSafeFlight(createShadowMission(source()), campaign, now);
    expect(new Set(mission.revisions.map((item) => item.platform))).toEqual(new Set(['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']));
    expect(mission.revisions).toHaveLength(5); expect(mission.revisions.every((item) => item.immutable)).toBe(true);
    const rejected = mission.audits.find((item) => item.outcome === 'FAIL')!; expect(rejected.issues[0]).toMatchObject({code: 'CLAIM_OVERREACH', nextResponsibleRoleId: 'founder-identity-producer'}); expect(rejected.status).toBe('INVALIDATED');
    const corrected = mission.revisions.find((item) => item.id === mission.fault.correctedRevisionId)!; expect(mission.audits.find((item) => item.revisionId === corrected.id)).toMatchObject({outcome: 'PASS', status: 'ACTIVE'});
    expect(compareLatestTwo(mission, 'X')?.changes).toHaveLength(2); expect(mission.state).toBe('NEEDS_OWNER_REVIEW');
    expect(mission).toMatchObject({externalActionCount: 0, connectorCount: 0, actionGrantCount: 0});
  });

  it('binds four exact non-executable Owner Reviews and completes without a Grant', () => {
    let mission = runPublicSafeFlight(createShadowMission(source()), campaign, now);
    const current = ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].map((platform) => mission.revisions.filter((item) => item.platform === platform && mission.audits.some((audit) => audit.revisionId === item.id && audit.outcome === 'PASS' && audit.status === 'ACTIVE')).sort((a, b) => b.revision - a.revision)[0]!);
    for (const revision of current) mission = reviewRevision(mission, campaign, revision.id, revision.digest, 'READY_FOR_FUTURE_EXECUTION', now);
    expect(mission.state).toBe('SHADOW_COMPLETE'); expect(mission.reviews).toHaveLength(4); expect(mission.reviews.every((item) => item.authority === 'NON_EXECUTABLE_OWNER_REVIEW' && !item.createsActionGrant)).toBe(true); expect(mission.externalActionCount).toBe(0);
  });

  it('blocks Owner Review after Mission cancellation even for a previously passing Revision', () => {
    const mission = runPublicSafeFlight(createShadowMission(source()), campaign, now); const corrected = mission.revisions.find((item) => item.id === mission.fault.correctedRevisionId)!;
    expect(() => reviewRevision(cancelMission(mission, now), campaign, corrected.id, corrected.digest, 'READY_FOR_FUTURE_EXECUTION', now)).toThrowError(expect.objectContaining({code: 'MISSION_STATE_CONFLICT'}));
  });

  it('materializes an eight-Task reject, correction, and independent re-audit chain from accepted Runtime submissions', () => {
    let mission = dispatch(createShadowMission(source()));
    const sourceByPlatform = new Map(campaign.artifactRevisions.map((revision) => [revision.platform, revision]));
    const x = sourceByPlatform.get('X')!; const xFault = {...structuredClone(x.content), posts: ['LumiClaw Presence is generally available in every market today.']};
    const draft = (platform: 'X' | 'BLUESKY' | 'LINKEDIN' | 'XIAOHONGSHU', revision: number, content: typeof x.content | (typeof campaign.artifactRevisions)[number]['content']) => ({platform, revision, sourceRevisionDigest: sha256Digest(sourceByPlatform.get(platform)!), contentDigest: sha256Digest(content), content});
    const founder = {revisions: [draft('X', 1, xFault), draft('XIAOHONGSHU', 1, structuredClone(sourceByPlatform.get('XIAOHONGSHU')!.content))]};
    const product = {revisions: [draft('BLUESKY', 1, structuredClone(sourceByPlatform.get('BLUESKY')!.content)), draft('LINKEDIN', 1, structuredClone(sourceByPlatform.get('LINKEDIN')!.content))]};
    const auditIssue = {code: 'CLAIM_OVERREACH' as const, severity: 'BLOCKING' as const, path: '/content/posts/0', message: 'Runtime Auditor rejected the unsupported availability Claim.', evidenceRefIds: campaign.evidenceRefs.map((item) => item.id), nextResponsibleRoleId: 'founder-identity-producer' as const};
    const decisions = {decisions: [...founder.revisions, ...product.revisions].map((item) => ({platform: item.platform, revision: item.revision, revisionContentDigest: item.contentDigest, outcome: item.platform === 'X' && item.revision === 1 ? 'FAIL' as const : 'PASS' as const, issues: item.platform === 'X' && item.revision === 1 ? [auditIssue] : []}))};
    const submit = (kind: TaskContract['kind'], payload: unknown) => {
      const task = mission.tasks.find((item) => item.kind === kind)!; mission = acknowledge(mission, task);
      mission = acceptRuntimeSubmission(mission, runtimeSubmission(mission, task, payload), now);
      expect(mission.tasks.find((item) => item.id === task.id)?.state).toBe('ACCEPTED');
    };
    submit('PROJECT_COORDINATION', {projectId: mission.runtimeProjectId, externalActionAllowed: false});
    submit('FREEZE_EVIDENCE', {frozen: true, claimEvidenceDigest: sha256Digest({claims: campaign.claims, evidence: campaign.evidenceRefs})});
    submit('PLAN_CAMPAIGN', {activationPlanDigest: sha256Digest(campaign.activationPlan)});
    submit('PRODUCE_FOUNDER', founder);
    submit('PRODUCE_PRODUCT', product);
    submit('AUDIT_REVISIONS', decisions);
    mission = materializeAcceptedRuntimeProgress(mission, campaign, now);
    expect(mission).toMatchObject({state: 'REVISION_REQUIRED'}); expect(mission.revisions).toHaveLength(4); expect(mission.audits).toHaveLength(4);
    const failedAudit = mission.audits.find((item) => item.outcome === 'FAIL')!; expect(failedAudit.status).toBe('ACTIVE');
    const correctedDraft = draft('X', 2, structuredClone(x.content));
    submit('PRODUCE_FOUNDER_CORRECTION', {revisions: [correctedDraft], failedAuditDigest: failedAudit.digest});
    mission = materializeAcceptedRuntimeProgress(mission, campaign, now);
    expect(mission).toMatchObject({state: 'AUDIT_BLOCKED'}); expect(mission.revisions).toHaveLength(5); expect(mission.audits).toHaveLength(4);
    submit('REAUDIT_CORRECTION', {decisions: [{platform: 'X', revision: 2, revisionContentDigest: correctedDraft.contentDigest, outcome: 'PASS', issues: []}], failedAuditDigest: failedAudit.digest});
    mission = materializeAcceptedRuntimeProgress(mission, campaign, now);
    mission = materializeAcceptedRuntimeMission(mission, campaign, now);
    expect(mission).toMatchObject({state: 'NEEDS_OWNER_REVIEW', actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}); expect(mission.revisions).toHaveLength(5); expect(mission.audits).toHaveLength(5);
    expect(mission.revisions.filter((item) => item.producerRoleId === 'founder-identity-producer')).toHaveLength(3); expect(mission.audits.every((item) => item.auditorRoleId === 'independent-auditor')).toBe(true);
    expect(mission.audits.find((item) => item.outcome === 'FAIL')).toMatchObject({status: 'INVALIDATED', issues: [{code: 'CLAIM_OVERREACH'}]});
    expect((mission.revisions.find((item) => item.platform === 'X' && item.revision === 1)?.content as {posts: string[]}).posts.join(' ')).toContain('generally available');
    expect(mission.revisions.find((item) => item.platform === 'X' && item.revision === 2)?.content).toEqual(sourceByPlatform.get('X')!.content);
  });

  it('quarantines digest/schema/identity mismatch and duplicate accepted Submit', () => {
    let mission = dispatch(createShadowMission(source())); const task = mission.tasks[1]!; mission = acknowledge(mission, task); const payload = {frozen: true, claimEvidenceDigest: 'c'.repeat(64)};
    const base = runtimeSubmission(mission, task, payload);
    const accepted = acceptRuntimeSubmission(mission, base, now); expect(accepted.tasks[1]!.state).toBe('ACCEPTED');
    const duplicate = acceptRuntimeSubmission(accepted, base, now); expect(duplicate.recovery.duplicateSubmissionsRejected).toBe(1); expect(duplicate.trace.at(-1)?.kind).toBe('QUARANTINE');
    const tampered = acceptRuntimeSubmission(mission, {...base, roleIdentityId: mission.roleContexts[5]!.identityId, outputDigest: 'f'.repeat(64)}, now); expect(tampered.trace.at(-1)?.detail.errors).toContain('ROLE_IDENTITY_MISMATCH'); expect(tampered.trace.at(-1)?.detail.errors).toContain('OUTPUT_DIGEST_MISMATCH');
  });

  it('binds exactly one AgentTeams Project dispatch', () => {
    const initial = createShadowMission(source()); const dispatched = dispatch(initial);
    expect(() => dispatch(dispatched)).toThrowError(expect.objectContaining({code: 'RUNTIME_PROJECT_ALREADY_DISPATCHED'}));
  });

  it('rejects contract-shaped Submit before exact Project dispatch and ACK receipts', () => {
    const initial = createShadowMission(source()); const task = initial.tasks[1]!; const payload = {frozen: true, claimEvidenceDigest: 'c'.repeat(64)};
    const fakeResultDigest = sha256Digest({schemaVersion: 1, taskId: task.id, roleId: task.roleId, payload, outputDigest: sha256Digest(payload), maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false});
    const fakeReceipt = {schemaVersion: 1 as const, projectId: initial.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId: '@forged:runtime.test', attempt: 1, ackReceiptDigest: '0'.repeat(64), runtimeState: 'submitted' as const, submittedAt: now.toISOString(), resultDigest: fakeResultDigest, resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY' as const, runtimeObservationId: '0'.repeat(64), receiptDigest: '0'.repeat(64)};
    const shaped = {schemaVersion: 1 as const, missionId: initial.id, taskId: task.id, roleId: task.roleId, roleIdentityId: task.roleIdentityId, inputDigest: task.inputDigest, skillLockDigest: task.skillLockDigest, outputSchema: task.outputSchema, outputSchemaVersion: 1 as const, payload, outputDigest: sha256Digest(payload), runtimeResultMaturity: 'MOCK_CONFORMANCE' as const, runtimeReceipt: fakeReceipt};
    const beforeDispatch = acceptRuntimeSubmission(initial, shaped, now); expect(beforeDispatch.trace.at(-1)?.detail.errors).toContain('PROJECT_NOT_DISPATCHED'); expect(beforeDispatch.trace.at(-1)?.detail.errors).toContain('TASK_NOT_ACKNOWLEDGED');
    const afterDispatch = acceptRuntimeSubmission(dispatch(initial), shaped, now); expect(afterDispatch.trace.at(-1)?.detail.errors).toContain('TASK_NOT_ACKNOWLEDGED'); expect(afterDispatch.tasks[1]!.state).not.toBe('ACCEPTED');
  });

  it('reconciles from PostgreSQL-owned state without duplicating submissions', () => {
    const mission = createShadowMission(source()); mission.tasks[0]!.state = 'UNKNOWN'; mission.tasks[0]!.acceptedOutputDigest = 'd'.repeat(64);
    const recovered = reconcileMission(mission, [mission.tasks[0]!.id], now); expect(recovered.recovery.status).toBe('RECONCILED'); expect(recovered.tasks[0]!.state).toBe('ACCEPTED'); expect(recovered.trace.some((item) => item.kind === 'RECOVERY')).toBe(true);
    const missingReceipt = createShadowMission(source()); missingReceipt.tasks[0]!.state = 'UNKNOWN';
    const unresolved = reconcileMission(missingReceipt, [missingReceipt.tasks[0]!.id], now); expect(unresolved.recovery.status).toBe('UNKNOWN'); expect(unresolved.state).toBe('UNKNOWN_RECOVERY');
  });

  it('does not turn four CHANGES_REQUESTED reviews into completion during reconcile', () => {
    let mission = runPublicSafeFlight(createShadowMission(source()), campaign, now);
    for (const revision of ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].map((platform) => mission.revisions.filter((item) => item.platform === platform && mission.audits.some((audit) => audit.revisionId === item.id && audit.outcome === 'PASS' && audit.status === 'ACTIVE')).sort((a, b) => b.revision - a.revision)[0]!)) {
      mission = reviewRevision(mission, campaign, revision.id, revision.digest, 'CHANGES_REQUESTED', now);
    }
    expect(mission.reviews).toHaveLength(4); expect(mission.state).toBe('REVISION_REQUIRED'); expect(reconcileMission(mission, [], now).state).toBe('REVISION_REQUIRED');
  });

  it('exports allowlisted replay evidence and chained ledger with no action path', () => {
    const mission = runPublicSafeFlight(createShadowMission(source()), campaign, now); const evidence = missionPublicEvidence(mission) as {noAction: unknown; roles: unknown[]};
    expect(evidence.roles).toHaveLength(6); expect(evidence.noAction).toEqual({externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(mission.ledger.every((entry, index) => index === 0 ? entry.previousEntryDigest === null : entry.previousEntryDigest === mission.ledger[index - 1]!.entryDigest)).toBe(true);
  });

  it('keeps idempotency request-digest exact', async () => {
    const repository = new MemoryShadowMissionRepository(); const first = await repository.create(source(), 'shadow-start-001', sha256Digest({source: campaign.missionContract.sourceDigest}));
    const replay = await repository.create(source(), 'shadow-start-001', sha256Digest({source: campaign.missionContract.sourceDigest})); expect(replay.replayed).toBe(true); expect(replay.mission.id).toBe(first.mission.id);
    await expect(repository.create(source(), 'shadow-start-001', sha256Digest({source: 'different'}))).rejects.toMatchObject({code: 'IDEMPOTENCY_KEY_REUSED'});
  });
});
