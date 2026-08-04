import {createUuidV7, sha256Digest, type CampaignDocument, type MissionRoleId, type PlatformArtifact} from '@lumiclaw/domain';
import type {
  AuditDecision, AuditIssue, GovernedArtifactRevision, LedgerEntry, MediaAsset, MissionTraceEvent, ModelCallSnapshot, OwnerReview,
  RoleContext, RuntimeMemberBinding, RuntimeProjectDispatchReceipt, RuntimeSubmission, RuntimeTaskAckReceipt,
  RuntimeTaskSubmissionReceipt, ShadowMission, SkillLock, StartShadowMissionInput, TaskContract
} from './types.js';

const ROLE_IDS = [
  'presence-mission-leader', 'evidence-claim-steward', 'campaign-planner',
  'founder-identity-producer', 'product-account-producer', 'independent-auditor'
] as const satisfies readonly MissionRoleId[];

export const AGENTTEAMS_V120_BUILD_DIGEST = 'sha256:a4a9d66fabc49e1d08246d9b8b65d2b67742b71b2b43d3dfc0d27e8861f0770c';

const ROLE_DEFINITIONS = {
  'presence-mission-leader': {responsibility: 'Coordinate the AgentTeams Project/DAG and release or escalate tasks.', permissions: ['ORCHESTRATE'], tools: ['TASK_READ', 'TRACE_APPEND'], visible: ['MISSION'], prohibited: ['claim', 'plan', 'platform artifact', 'audit', 'approval'], orchestrationOnly: true},
  'evidence-claim-steward': {responsibility: 'Freeze approved Claim/Evidence bindings and identify gaps.', permissions: ['READ_EVIDENCE'], tools: ['TASK_READ', 'TASK_ACK', 'TASK_SUBMIT', 'EVIDENCE_READ', 'TRACE_APPEND'], visible: ['MISSION', 'FROZEN_EVIDENCE'], prohibited: ['platform artifact', 'audit', 'approval'], orchestrationOnly: false},
  'campaign-planner': {responsibility: 'Allocate the persisted ActivationPlan without authoring platform copy.', permissions: ['PLAN'], tools: ['TASK_READ', 'TASK_ACK', 'TASK_SUBMIT', 'EVIDENCE_READ', 'TRACE_APPEND'], visible: ['MISSION', 'FROZEN_EVIDENCE', 'PLAN'], prohibited: ['platform artifact', 'audit', 'approval'], orchestrationOnly: false},
  'founder-identity-producer': {responsibility: 'Produce immutable X and Xiaohongshu revisions for founder voice.', permissions: ['PRODUCE_FOUNDER'], tools: ['TASK_READ', 'TASK_ACK', 'TASK_SUBMIT', 'EVIDENCE_READ', 'MODEL_GENERATE', 'TRACE_APPEND'], visible: ['MISSION', 'FROZEN_EVIDENCE', 'PLAN', 'FOUNDER_UNITS'], prohibited: ['audit', 'approval', 'external action'], orchestrationOnly: false},
  'product-account-producer': {responsibility: 'Produce immutable Bluesky and LinkedIn revisions for product voice.', permissions: ['PRODUCE_PRODUCT'], tools: ['TASK_READ', 'TASK_ACK', 'TASK_SUBMIT', 'EVIDENCE_READ', 'MODEL_GENERATE', 'TRACE_APPEND'], visible: ['MISSION', 'FROZEN_EVIDENCE', 'PLAN', 'PRODUCT_UNITS'], prohibited: ['audit', 'approval', 'external action'], orchestrationOnly: false},
  'independent-auditor': {responsibility: 'Independently audit immutable revisions against frozen bindings.', permissions: ['AUDIT'], tools: ['TASK_READ', 'TASK_ACK', 'TASK_SUBMIT', 'EVIDENCE_READ', 'REVISION_READ', 'AUDIT_SUBMIT', 'TRACE_APPEND'], visible: ['MISSION', 'FROZEN_EVIDENCE', 'REVISIONS', 'AUDIT_BINDINGS'], prohibited: ['edit revision', 'owner approval', 'ActionGrant', 'external action'], orchestrationOnly: false}
} as const;

const SKILLS = [
  {name: 'evidence-and-claim-grounding', digest: '8ffe3b79cb0f47122c4cf49a9d5823d1260049d471055d29b11af9369e2dfc03'},
  {name: 'campaign-strategy', digest: 'f36e36065a2db1c5ec53f064a06bf3717c96204c6ab7bfa370a06e5542ca0615'},
  {name: 'account-native-expression', digest: 'e0203cce699775fd00a35b07cd62d078d51c0f65c751d20e69a69cb9d6e623a9'},
  {name: 'independent-action-audit', digest: '2fa2e0018d33559c1283b2b53fd3989c226fac00e783e1a0f77113b7c17bf951'},
  {name: 'trace-safe-escalation', digest: '2231d266f0805abb1ea459333147b4c5ff94e082e1b72e558f87128ef77f458d'}
] as const;

const ROLE_SKILLS: Record<MissionRoleId, number[]> = {
  'presence-mission-leader': [4], 'evidence-claim-steward': [0, 4], 'campaign-planner': [1, 4],
  'founder-identity-producer': [0, 2, 4], 'product-account-producer': [0, 2, 4], 'independent-auditor': [0, 3, 4]
};

export class ShadowContractError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) { super(message); this.name = 'ShadowContractError'; }
}

export function createShadowMission(input: StartShadowMissionInput): ShadowMission {
  if (input.campaign.missionContract.sourceDigest !== input.campaignDigest) throw new ShadowContractError('MISSION_SOURCE_DIGEST_MISMATCH', 'Campaign MissionContract digest does not match the persisted source digest.');
  if (input.campaign.live || input.campaign.missionContract.externalActionAllowed) throw new ShadowContractError('SHADOW_BOUNDARY_VIOLATION', 'A SHADOW Mission must be NOT_LIVE with no external action.');
  const missionId = stableId(input.now, input.campaignDigest, 1);
  const locks = SKILLS.map((skill, index) => ({id: stableId(input.now, input.campaignDigest, 10 + index), name: skill.name, version: '1.0.0', digest: skill.digest, source: `skills/${skill.name}/SKILL.md`})) as unknown as ShadowMission['skillLocks'];
  const roleContexts = ROLE_IDS.map((roleId, index) => roleContext(missionId, roleId, stableId(input.now, input.campaignDigest, 30 + index), locks)) as ShadowMission['roleContexts'];
  const tasks = taskContracts(missionId, input.campaignDigest, roleContexts, locks, input.now);
  const createdAt = input.now.toISOString();
  const mission: ShadowMission = {
    schemaVersion: 1, id: missionId, organizationId: input.campaign.organizationId, campaignId: input.campaign.id,
    sourceCampaignVersion: input.campaignVersion, sourceCampaignDigest: input.campaignDigest,
    runtime: 'agentteams', runtimeVersion: 'v1.2.0', runtimeProjectId: `presence-${missionId}`, runtimeProjectDispatch: null,
    executionMode: 'SHADOW_PREP_ONLY', dataMode: 'DEMO_SEED', live: false, externalActionAllowed: false,
    actionGrantCount: 0, connectorCount: 0, externalActionCount: 0, state: 'QUEUED', version: 1, etag: '', createdAt, updatedAt: createdAt,
    roleContexts, skillLocks: locks, tasks, revisions: [], audits: [], reviews: [], modelCalls: [], mediaAssets: [], trace: [], ledger: [],
    recovery: {status: 'NOT_REQUIRED', recoveredAt: null, duplicateSubmissionsRejected: 0},
    fault: {kind: 'BETA_TO_GA', frozenClaimStatement: input.campaign.claims.find((claim) => claim.status === 'APPROVED')?.statement ?? '', injectedPath: '/content/posts/0', deniedRevisionId: null, correctedRevisionId: null}
  };
  appendEvent(mission, 'MISSION', 'SHADOW Mission 已排队', {runtime: 'agentteams', runtimeVersion: 'v1.2.0', externalActionAllowed: false}, 'CONTROL_PLANE', input.campaignDigest, sha256Digest({missionId, state: 'QUEUED'}), input.now);
  return seal(mission, input.now);
}

export function runPublicSafeFlight(missionValue: ShadowMission, campaign: CampaignDocument, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  assertCampaignBinding(mission, campaign);
  if (!['QUEUED', 'UNKNOWN_RECOVERY', 'RUNNING'].includes(mission.state)) throw new ShadowContractError('MISSION_STATE_CONFLICT', `Cannot run a flight from ${mission.state}.`);
  mission.state = 'RUNNING';
  appendEvent(mission, 'PROJECT', 'AgentTeams Project/DAG 已导入', {projectId: mission.runtimeProjectId, memberCount: 6, taskCount: mission.tasks.length}, 'presence-mission-leader', mission.sourceCampaignDigest, sha256Digest(mission.tasks), now);
  const ordered = ['PROJECT_COORDINATION', 'FREEZE_EVIDENCE', 'PLAN_CAMPAIGN', 'PRODUCE_FOUNDER', 'PRODUCE_PRODUCT'] as const;
  for (const kind of ordered) completeTask(mission, kind, now);

  const byPlatform = new Map(campaign.artifactRevisions.map((revision) => [revision.platform, revision]));
  for (const unit of campaign.activationPlan.units) {
    const source = byPlatform.get(unit.platform);
    if (source === undefined) throw new ShadowContractError('PLATFORM_SOURCE_REVISION_MISSING', unit.platform);
    const producerRoleId = unit.platform === 'X' || unit.platform === 'XIAOHONGSHU' ? 'founder-identity-producer' : 'product-account-producer';
    const revision = revisionFromSource(mission, campaign, source.content, source.id, unit.id, unit.platform, producerRoleId, 1, null, now);
    if (unit.platform === 'X') revision.content = injectGaFault(revision.content);
    revision.digest = revisionDigest(revision);
    mission.revisions.push(revision);
    appendEvent(mission, 'REVISION', `${unit.platform} Revision v1 已接收`, {platform: unit.platform, revisionId: revision.id, immutable: true}, producerRoleId, source.id, revision.digest, now);
  }
  completeTask(mission, 'AUDIT_REVISIONS', now);
  for (const revision of mission.revisions) {
    const fault = revision.platform === 'X' && revision.revision === 1;
    const decision = createAudit(mission, campaign, revision, fault ? 'FAIL' : 'PASS', now);
    mission.audits.push(decision);
    appendEvent(mission, 'AUDIT', fault ? '冻结 Claim 故障已拒绝' : `${revision.platform} 审核通过`, {revisionId: revision.id, outcome: decision.outcome, nextRole: fault ? 'founder-identity-producer' : null}, 'independent-auditor', revision.digest, decision.digest, now);
    if (fault) mission.fault.deniedRevisionId = revision.id;
  }
  mission.state = 'REVISION_REQUIRED';
  completeTask(mission, 'PRODUCE_FOUNDER_CORRECTION', new Date(now.getTime() + 1000));
  const denied = mission.revisions.find((item) => item.id === mission.fault.deniedRevisionId)!;
  const source = byPlatform.get('X')!;
  const corrected = revisionFromSource(mission, campaign, source.content, source.id, denied.activationUnitId, 'X', 'founder-identity-producer', 2, denied.id, new Date(now.getTime() + 1000));
  mission.revisions.push(corrected);
  mission.fault.correctedRevisionId = corrected.id;
  const oldAudit = mission.audits.find((item) => item.revisionId === denied.id)!;
  oldAudit.status = 'INVALIDATED'; oldAudit.invalidatedByRevisionId = corrected.id; oldAudit.digest = auditDigest(oldAudit);
  appendEvent(mission, 'REVISION', 'X Revision v2 修正后已接收，旧 Audit 失效', {revisionId: corrected.id, parentRevisionId: denied.id, invalidatedAuditId: oldAudit.id}, 'founder-identity-producer', denied.digest, corrected.digest, new Date(now.getTime() + 1000));
  completeTask(mission, 'REAUDIT_CORRECTION', new Date(now.getTime() + 2000));
  const correctedAudit = createAudit(mission, campaign, corrected, 'PASS', new Date(now.getTime() + 2000), undefined, oldAudit.id);
  mission.audits.push(correctedAudit);
  appendEvent(mission, 'AUDIT', '修正版已由独立 Auditor 重新审核', {revisionId: corrected.id, outcome: 'PASS'}, 'independent-auditor', corrected.digest, correctedAudit.digest, new Date(now.getTime() + 2000));
  mission.state = 'NEEDS_OWNER_REVIEW';
  appendEvent(mission, 'MISSION', '四平台精确 Revision 等待 Owner Review', {reviewableRevisionCount: 4, createsActionGrant: false, externalActionCount: 0}, 'CONTROL_PLANE', correctedAudit.digest, sha256Digest({state: 'NEEDS_OWNER_REVIEW'}), new Date(now.getTime() + 3000));
  return seal(mission, new Date(now.getTime() + 3000));
}

export function attachProviderEvidence(
  missionValue: ShadowMission,
  evidence: {modelCall: ModelCallSnapshot; mediaAsset: MediaAsset},
  now = new Date()
): ShadowMission {
  const mission = structuredClone(missionValue);
  const task = mission.tasks.find((item) => item.id === evidence.modelCall.taskId);
  if (evidence.modelCall.missionId !== mission.id || task === undefined || !['founder-identity-producer', 'product-account-producer'].includes(task.roleId)) {
    throw new ShadowContractError('MODEL_CALL_BINDING_MISMATCH', 'Model call evidence must bind an exact Producer task in this Mission.');
  }
  if (evidence.modelCall.provider !== 'PUBLIC_SAFE_MOCK' || evidence.modelCall.maturity !== 'MOCK_CONFORMANCE' || evidence.modelCall.secretPresent) {
    throw new ShadowContractError('MODEL_CALL_MATURITY_MISMATCH', 'The public-safe Flight accepts only redacted MOCK_CONFORMANCE model evidence.');
  }
  if (evidence.mediaAsset.organizationId !== mission.organizationId || evidence.mediaAsset.missionId !== mission.id || evidence.mediaAsset.provider !== 'PUBLIC_SAFE_MOCK' || evidence.mediaAsset.maturity !== 'MOCK_CONFORMANCE' || evidence.mediaAsset.approvalState !== 'UNREVIEWED') {
    throw new ShadowContractError('MEDIA_ASSET_BINDING_MISMATCH', 'Media evidence must be content-addressed, unreviewed, and bound to this Mission tenant.');
  }
  if (mission.modelCalls.some((item) => item.id === evidence.modelCall.id) || mission.mediaAssets.some((item) => item.id === evidence.mediaAsset.id || item.contentDigest === evidence.mediaAsset.contentDigest)) {
    throw new ShadowContractError('PROVIDER_EVIDENCE_DUPLICATE', 'Provider evidence is append-only and cannot be attached twice.');
  }
  mission.modelCalls.push(structuredClone(evidence.modelCall));
  mission.mediaAssets.push(structuredClone(evidence.mediaAsset));
  appendEvent(mission, 'MODEL', '结构化模型收据已记录（公开安全 Mock）', {provider: evidence.modelCall.provider, maturity: evidence.modelCall.maturity, taskId: evidence.modelCall.taskId, secretPresent: false}, task.roleId, evidence.modelCall.inputDigest, evidence.modelCall.outputDigest ?? sha256Digest(evidence.modelCall.error), now);
  appendEvent(mission, 'MEDIA', '媒体素材收据已记录（未审核）', {provider: evidence.mediaAsset.provider, maturity: evidence.mediaAsset.maturity, assetId: evidence.mediaAsset.id, approvalState: evidence.mediaAsset.approvalState}, task.roleId, evidence.mediaAsset.contentDigest, sha256Digest(evidence.mediaAsset.rights), new Date(now.getTime() + 1));
  return seal(mission, new Date(now.getTime() + 1));
}

export function reviewRevision(missionValue: ShadowMission, campaign: CampaignDocument, revisionId: string, revisionDigestValue: string, decision: OwnerReview['decision'], now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  assertCampaignBinding(mission, campaign);
  if (mission.state !== 'NEEDS_OWNER_REVIEW') throw new ShadowContractError('MISSION_STATE_CONFLICT', `Owner Review is not allowed from ${mission.state}.`);
  const revision = mission.revisions.find((item) => item.id === revisionId);
  if (revision === undefined || revision.digest !== revisionDigestValue) throw new ShadowContractError('REVIEW_REVISION_DIGEST_MISMATCH', 'Owner Review must bind the exact immutable Revision digest.');
  const audit = mission.audits.find((item) => item.revisionId === revision.id && item.status === 'ACTIVE');
  if (audit?.outcome !== 'PASS') throw new ShadowContractError('REVIEW_AUDIT_PASS_REQUIRED', 'Only a Revision with an active PASS decision can reach Owner Review.');
  if (mission.reviews.some((item) => item.revisionId === revisionId)) throw new ShadowContractError('OWNER_REVIEW_DUPLICATE', 'An exact Revision can only be reviewed once.');
  const unit = campaign.activationPlan.units.find((item) => item.id === revision.activationUnitId)!;
  const review: OwnerReview = {schemaVersion: 1, id: stableId(now, revision.digest, 80), organizationId: mission.organizationId, campaignId: mission.campaignId, missionId: mission.id, revisionId, revisionDigest: revision.digest, channelAccountId: unit.channelAccountId, actionIntent: 'PREPARE_ONLY', decision, authority: 'NON_EXECUTABLE_OWNER_REVIEW', createsActionGrant: false, externalActionAllowed: false, createdAt: now.toISOString()};
  mission.reviews.push(review);
  appendEvent(mission, 'OWNER_REVIEW', decision === 'READY_FOR_FUTURE_EXECUTION' ? 'Owner 已记录非执行性 Review' : 'Owner 已请求修改', {revisionId, authority: review.authority, createsActionGrant: false}, 'OWNER', revision.digest, sha256Digest(review), now);
  const reviewable = latestPassingRevisions(mission);
  const allReviewed = reviewable.length === 4 && reviewable.every((item) => mission.reviews.some((reviewItem) => reviewItem.revisionId === item.id));
  const allReady = allReviewed && reviewable.every((item) => mission.reviews.some((reviewItem) => reviewItem.revisionId === item.id && reviewItem.decision === 'READY_FOR_FUTURE_EXECUTION'));
  if (allReady) {
    mission.state = 'SHADOW_COMPLETE';
    appendEvent(mission, 'MISSION', 'SHADOW Mission 已完成（无外部动作）', {actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}, 'CONTROL_PLANE', sha256Digest(mission.reviews), sha256Digest({state: 'SHADOW_COMPLETE'}), now);
  } else if (allReviewed) {
    mission.state = 'REVISION_REQUIRED';
    appendEvent(mission, 'MISSION', 'Owner Review 已完成，存在需要修改的 Revision', {changesRequested: mission.reviews.filter((item) => item.decision === 'CHANGES_REQUESTED').length, externalActionCount: 0}, 'CONTROL_PLANE', sha256Digest(mission.reviews), sha256Digest({state: 'REVISION_REQUIRED'}), now);
  }
  return seal(mission, now);
}

export function compareLatestTwo(mission: ShadowMission, platform: string): {from: GovernedArtifactRevision; to: GovernedArtifactRevision; changes: string[]} | null {
  const revisions = mission.revisions.filter((item) => item.platform === platform).sort((a, b) => b.revision - a.revision).slice(0, 2);
  if (revisions.length < 2) return null;
  const [to, from] = revisions as [GovernedArtifactRevision, GovernedArtifactRevision];
  const changes: string[] = [];
  const a = JSON.stringify(from.content); const b = JSON.stringify(to.content);
  if (a !== b) changes.push('平台内容已修正为冻结 Claim 支持的表述');
  if (from.digest !== to.digest) changes.push('Revision digest 已变更，旧 Audit 不再有效');
  return {from, to, changes};
}

export function acceptRuntimeSubmission(missionValue: ShadowMission, submission: RuntimeSubmission, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  const task = mission.tasks.find((item) => item.id === submission.taskId);
  const errors: string[] = [];
  if (mission.runtimeProjectDispatch === null) errors.push('PROJECT_NOT_DISPATCHED');
  if (submission.missionId !== mission.id) errors.push('MISSION_ID_MISMATCH');
  if (task === undefined) errors.push('TASK_ID_UNKNOWN');
  if (task !== undefined) {
    if (task.state !== 'ACKNOWLEDGED' || task.runtimeAck === null) errors.push('TASK_NOT_ACKNOWLEDGED');
    if (submission.roleId !== task.roleId || submission.roleIdentityId !== task.roleIdentityId) errors.push('ROLE_IDENTITY_MISMATCH');
    if (submission.inputDigest !== task.inputDigest) errors.push('INPUT_DIGEST_MISMATCH');
    if (submission.skillLockDigest !== task.skillLockDigest) errors.push('SKILL_DIGEST_MISMATCH');
    if (submission.outputSchema !== task.outputSchema || submission.outputSchemaVersion !== task.outputSchemaVersion) errors.push('OUTPUT_SCHEMA_MISMATCH');
    if (!task.prerequisiteTaskIds.every((id) => mission.tasks.find((item) => item.id === id)?.state === 'ACCEPTED')) errors.push('TASK_PREREQUISITE_NOT_ACCEPTED');
    if (!validateSubmissionPayload(task, submission.payload)) errors.push('OUTPUT_PAYLOAD_SCHEMA_INVALID');
    validateRuntimeSubmissionReceipt(mission, task, submission, errors);
  }
  if (submission.outputDigest !== sha256Digest(submission.payload)) errors.push('OUTPUT_DIGEST_MISMATCH');
  if (task?.acceptedOutputDigest !== null && task?.acceptedOutputDigest !== undefined) {
    mission.recovery.duplicateSubmissionsRejected += 1;
    errors.push(task.acceptedOutputDigest === submission.outputDigest ? 'DUPLICATE_ACCEPTED_SUBMISSION' : 'ACCEPTED_OUTPUT_CONFLICT');
  }
  if (errors.length > 0) {
    appendEvent(mission, 'QUARANTINE', 'Runtime Submit 已隔离', {taskId: submission.taskId, errors: errors.join(',')}, 'CONTROL_PLANE', sha256Digest(submission), sha256Digest(errors), now);
    return seal(mission, now);
  }
  task!.state = 'ACCEPTED'; task!.submittedAt = submission.runtimeReceipt.submittedAt; task!.runtimeSubmission = structuredClone(submission.runtimeReceipt); task!.acceptedOutputDigest = submission.outputDigest;
  task!.acceptedPayload = structuredClone(submission.payload);
  appendEvent(mission, 'SUBMIT', 'Runtime Submit 凭据/digest/schema 验证通过', {taskId: task!.id, roleId: task!.roleId, attempt: task!.attempt, receiptDigest: submission.runtimeReceipt.receiptDigest}, task!.roleId, task!.inputDigest, submission.outputDigest, now);
  for (const dependent of mission.tasks.filter((candidate) => candidate.state === 'WAITING_DEPENDENCY' && candidate.prerequisiteTaskIds.includes(task!.id))) {
    if (dependent.prerequisiteTaskIds.every((id) => mission.tasks.find((candidate) => candidate.id === id)?.state === 'ACCEPTED')) dependent.state = 'ASSIGNED';
  }
  return seal(mission, now);
}

export function materializeAcceptedRuntimeProgress(missionValue: ShadowMission, campaign: CampaignDocument, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  assertCampaignBinding(mission, campaign);
  const initialAuditor = mission.tasks.find((task) => task.kind === 'AUDIT_REVISIONS')!;
  const correctionProducer = mission.tasks.find((task) => task.kind === 'PRODUCE_FOUNDER_CORRECTION')!;
  const correctionAuditor = mission.tasks.find((task) => task.kind === 'REAUDIT_CORRECTION')!;
  const sourceByPlatform = new Map(campaign.artifactRevisions.map((revision) => [revision.platform, revision]));

  if (initialAuditor.state === 'ACCEPTED' && mission.revisions.length === 0) {
    const drafts = [...runtimeRevisions(runtimePayloadByKind(mission, 'PRODUCE_FOUNDER')), ...runtimeRevisions(runtimePayloadByKind(mission, 'PRODUCE_PRODUCT'))];
    const expectedDraftKeys = new Set(['X:1', 'XIAOHONGSHU:1', 'BLUESKY:1', 'LINKEDIN:1']);
    if (drafts.length !== 4 || drafts.some((draft) => !expectedDraftKeys.delete(`${draft.platform}:${draft.revision}`)) || expectedDraftKeys.size !== 0) throw new ShadowContractError('RUNTIME_REVISION_SET_INVALID', 'Initial Producer submissions must contain exactly four platform v1 revisions.');
    for (const draft of drafts.sort((left, right) => left.platform.localeCompare(right.platform))) {
      const source = sourceByPlatform.get(draft.platform); const unit = campaign.activationPlan.units.find((candidate) => candidate.platform === draft.platform);
      if (source === undefined || unit === undefined || draft.sourceRevisionDigest !== sha256Digest(source)) throw new ShadowContractError('RUNTIME_SOURCE_REVISION_MISMATCH', `Runtime ${draft.platform} output is not bound to the persisted M1 Revision.`);
      const producerRoleId = draft.platform === 'X' || draft.platform === 'XIAOHONGSHU' ? 'founder-identity-producer' : 'product-account-producer';
      const createdAt = new Date(now.getTime() + mission.revisions.length * 1000);
      const revision = revisionFromSource(mission, campaign, draft.content, source.id, unit.id, draft.platform, producerRoleId, 1, null, createdAt);
      mission.revisions.push(revision);
      appendEvent(mission, 'REVISION', `${draft.platform} Revision v1 已从 digest 验证的 Runtime Submit 导入`, {platform: draft.platform, revisionId: revision.id, immutable: true}, producerRoleId, draft.contentDigest, revision.digest, createdAt);
    }
    const decisions = runtimeDecisions(runtimePayloadByKind(mission, 'AUDIT_REVISIONS'));
    if (decisions.length !== 4) throw new ShadowContractError('RUNTIME_AUDIT_SET_INVALID', 'Initial Auditor must submit one decision for every v1 Revision.');
    for (const decision of decisions) {
      const revision = mission.revisions.find((candidate) => candidate.platform === decision.platform && candidate.revision === 1);
      if (revision === undefined || decision.revisionContentDigest !== sha256Digest(revision.content)) throw new ShadowContractError('RUNTIME_AUDIT_REVISION_MISMATCH', `${decision.platform} v1`);
      const auditAt = new Date(now.getTime() + 10_000 + mission.audits.length * 1000);
      const audit = createAudit(mission, campaign, revision, decision.outcome, auditAt, decision.issues);
      mission.audits.push(audit);
      appendEvent(mission, 'AUDIT', decision.outcome === 'PASS' ? `${revision.platform} v1 Runtime Audit 通过` : '冻结 Claim 故障由独立 Runtime Auditor 拒绝', {revisionId: revision.id, outcome: decision.outcome, nextRole: decision.issues[0]?.nextResponsibleRoleId ?? null}, 'independent-auditor', revision.digest, audit.digest, auditAt);
    }
    const denied = mission.revisions.find((revision) => revision.platform === 'X' && revision.revision === 1)!;
    const deniedAudit = mission.audits.find((audit) => audit.revisionId === denied.id)!;
    const faultIssue = deniedAudit.issues.find((issue) => issue.code === 'CLAIM_OVERREACH' && issue.evidenceRefIds.length > 0 && issue.nextResponsibleRoleId === 'founder-identity-producer');
    const deniedText = denied.content.kind === 'X' ? denied.content.posts.join('\n').toLowerCase() : '';
    if (!deniedText.includes('generally available') || deniedAudit.outcome !== 'FAIL' || faultIssue === undefined) throw new ShadowContractError('RUNTIME_FROZEN_FAULT_INVALID', 'X v1 must persist as an active evidence-bound FAIL before correction.');
    mission.fault.deniedRevisionId = denied.id;
    mission.state = 'REVISION_REQUIRED';
    correctionProducer.inputDigest = sha256Digest({sourceDigest: mission.sourceCampaignDigest, failedAuditId: deniedAudit.id, failedAuditDigest: deniedAudit.digest, deniedRevisionDigest: denied.digest, phase: correctionProducer.kind});
    appendEvent(mission, 'MISSION', 'X v1 已被独立 Auditor 拒绝，等待准确 Producer 修订', {failedAuditId: deniedAudit.id, nextRole: 'founder-identity-producer', revisionCount: 4}, 'CONTROL_PLANE', deniedAudit.digest, correctionProducer.inputDigest, new Date(now.getTime() + 15_000));
    return seal(mission, new Date(now.getTime() + 15_000));
  }

  if (correctionProducer.state === 'ACCEPTED' && mission.fault.correctedRevisionId === null) {
    const denied = mission.revisions.find((revision) => revision.id === mission.fault.deniedRevisionId)!;
    const failedAudit = mission.audits.find((audit) => audit.revisionId === denied.id && audit.status === 'ACTIVE')!;
    const payload = runtimePayloadByKind(mission, 'PRODUCE_FOUNDER_CORRECTION'); const drafts = runtimeRevisions(payload);
    if (payload.failedAuditDigest !== failedAudit.digest || drafts.length !== 1 || drafts[0]?.platform !== 'X' || drafts[0].revision !== 2) throw new ShadowContractError('RUNTIME_CORRECTION_BINDING_INVALID', 'Correction Submit must bind the active failed Audit digest and contain only X v2.');
    const draft = drafts[0]; const source = sourceByPlatform.get('X')!; const unit = campaign.activationPlan.units.find((candidate) => candidate.platform === 'X')!;
    if (draft.sourceRevisionDigest !== sha256Digest(source) || sha256Digest(draft.content) !== sha256Digest(source.content)) throw new ShadowContractError('RUNTIME_CORRECTION_SOURCE_INVALID', 'X v2 must restore the exact persisted M1 source content.');
    const corrected = revisionFromSource(mission, campaign, draft.content, source.id, unit.id, 'X', 'founder-identity-producer', 2, denied.id, now);
    mission.revisions.push(corrected); mission.fault.correctedRevisionId = corrected.id; mission.state = 'AUDIT_BLOCKED';
    correctionAuditor.inputDigest = sha256Digest({sourceDigest: mission.sourceCampaignDigest, failedAuditId: failedAudit.id, failedAuditDigest: failedAudit.digest, correctedRevisionId: corrected.id, correctedRevisionDigest: corrected.digest, phase: correctionAuditor.kind});
    appendEvent(mission, 'REVISION', 'X Revision v2 已绑定失败 Audit 修正并持久化，等待独立重审', {revisionId: corrected.id, parentRevisionId: denied.id, failedAuditId: failedAudit.id}, 'founder-identity-producer', failedAudit.digest, corrected.digest, now);
    return seal(mission, now);
  }

  if (correctionAuditor.state === 'ACCEPTED' && mission.state === 'AUDIT_BLOCKED') {
    const denied = mission.revisions.find((revision) => revision.id === mission.fault.deniedRevisionId)!;
    const corrected = mission.revisions.find((revision) => revision.id === mission.fault.correctedRevisionId)!;
    const failedAudit = mission.audits.find((audit) => audit.revisionId === denied.id && audit.status === 'ACTIVE')!;
    const payload = runtimePayloadByKind(mission, 'REAUDIT_CORRECTION'); const decisions = runtimeDecisions(payload);
    if (payload.failedAuditDigest !== failedAudit.digest || decisions.length !== 1 || decisions[0]?.platform !== 'X' || decisions[0].revision !== 2 || decisions[0].outcome !== 'PASS' || decisions[0].revisionContentDigest !== sha256Digest(corrected.content)) throw new ShadowContractError('RUNTIME_REAUDIT_BINDING_INVALID', 'Re-audit must bind the exact X v2 and prior failed Audit digest.');
    const correctedAudit = createAudit(mission, campaign, corrected, 'PASS', now, decisions[0].issues, failedAudit.id);
    mission.audits.push(correctedAudit);
    failedAudit.status = 'INVALIDATED'; failedAudit.invalidatedByRevisionId = corrected.id; failedAudit.digest = auditDigest(failedAudit);
    mission.state = 'NEEDS_OWNER_REVIEW';
    appendEvent(mission, 'AUDIT', 'X v2 已由独立 Auditor 重审通过，旧 Audit 由不可变 supersession 失效', {revisionId: corrected.id, supersededAuditId: correctedAudit.supersedesAuditId, outcome: 'PASS'}, 'independent-auditor', corrected.digest, correctedAudit.digest, now);
    appendEvent(mission, 'MISSION', '真实 AgentTeams 因果修订链完成；四平台精确 Revision 等待 Owner Review', {reviewableRevisionCount: 4, createsActionGrant: false, externalActionCount: 0}, 'CONTROL_PLANE', correctedAudit.digest, sha256Digest({state: 'NEEDS_OWNER_REVIEW'}), new Date(now.getTime() + 1000));
    return seal(mission, new Date(now.getTime() + 1000));
  }
  return mission;
}

export function materializeAcceptedRuntimeMission(missionValue: ShadowMission, campaign: CampaignDocument, now = new Date()): ShadowMission {
  const mission = materializeAcceptedRuntimeProgress(missionValue, campaign, now);
  if (!mission.tasks.every((task) => task.state === 'ACCEPTED' && task.acceptedPayload !== undefined) || mission.state !== 'NEEDS_OWNER_REVIEW' || mission.revisions.length !== 5 || mission.audits.length !== 5) throw new ShadowContractError('RUNTIME_TASKS_NOT_ACCEPTED', 'All eight causal Task submissions and three persisted materialization phases must complete before finalization.');
  return mission;
}

export function acknowledgeRuntimeTask(missionValue: ShadowMission, receipt: RuntimeTaskAckReceipt, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  if (mission.runtimeProjectDispatch === null) throw new ShadowContractError('PROJECT_NOT_DISPATCHED', 'Task ACK requires an accepted AgentTeams Project dispatch.');
  const task = mission.tasks.find((item) => item.id === receipt.taskId);
  if (task === undefined) throw new ShadowContractError('TASK_NOT_FOUND', receipt.taskId);
  if (task.roleId !== receipt.roleId) throw new ShadowContractError('ACK_ROLE_MISMATCH', `${receipt.roleId} cannot ACK ${task.roleId}.`);
  const binding = mission.runtimeProjectDispatch.memberBindings.find((item) => item.roleId === task.roleId);
  if (receipt.projectId !== mission.runtimeProjectId || binding?.runtimeActorId !== receipt.runtimeActorId || receipt.attempt !== task.attempt || receipt.runtimeState !== 'in_progress') throw new ShadowContractError('ACK_RUNTIME_BINDING_MISMATCH', 'Task ACK does not bind the exact Project, member, attempt, and runtime state.');
  if (!isIsoInstant(receipt.acknowledgedAt) || receipt.receiptDigest !== runtimeTaskAckReceiptDigest(receipt)) throw new ShadowContractError('ACK_RECEIPT_DIGEST_MISMATCH', 'Task ACK receipt digest or timestamp is invalid.');
  if (!task.prerequisiteTaskIds.every((id) => mission.tasks.find((item) => item.id === id)?.state === 'ACCEPTED')) {
    throw new ShadowContractError('TASK_PREREQUISITE_NOT_ACCEPTED', `Task ${receipt.taskId} is not ready.`);
  }
  if (!['ASSIGNED', 'ACKNOWLEDGED'].includes(task.state)) throw new ShadowContractError('TASK_STATE_NOT_ACKABLE', `Task ${receipt.taskId} is ${task.state}.`);
  if (task.state === 'ASSIGNED') {
    task.state = 'ACKNOWLEDGED';
    task.ackedAt = receipt.acknowledgedAt;
    task.runtimeAck = structuredClone(receipt);
    appendEvent(mission, 'ACK', `${receipt.roleId} 已 ACK runtime Task`, {taskId: receipt.taskId, attempt: task.attempt, runtimeActorDigest: sha256Digest(receipt.runtimeActorId), receiptDigest: receipt.receiptDigest}, receipt.roleId, task.inputDigest, receipt.receiptDigest, now);
  } else if (task.runtimeAck?.receiptDigest !== receipt.receiptDigest) {
    throw new ShadowContractError('ACK_RECEIPT_CONFLICT', 'A Task attempt cannot bind two different ACK receipts.');
  }
  return seal(mission, now);
}

export function recordRuntimeProjectDispatch(missionValue: ShadowMission, receipt: RuntimeProjectDispatchReceipt, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  if (mission.state !== 'QUEUED') throw new ShadowContractError('RUNTIME_PROJECT_ALREADY_DISPATCHED', 'A Mission can bind exactly one AgentTeams Project dispatch. Restart recovery must reconcile that Project instead of dispatching another.');
  const bindings = [...receipt.memberBindings].sort((left, right) => left.roleId.localeCompare(right.roleId));
  const expectedRoles = [...ROLE_IDS].sort();
  if (receipt.projectId !== mission.runtimeProjectId || receipt.runtimeVersion !== mission.runtimeVersion || receipt.buildDigest !== AGENTTEAMS_V120_BUILD_DIGEST) throw new ShadowContractError('RUNTIME_PROJECT_BINDING_MISMATCH', 'Project dispatch does not bind the exact Mission Project/version/build.');
  if (bindings.length !== 6 || bindings.some((binding, index) => binding.roleId !== expectedRoles[index] || binding.roleIdentityId !== mission.roleContexts.find((context) => context.roleId === binding.roleId)?.identityId) || new Set(bindings.map((binding) => binding.runtimeActorId)).size !== 6) throw new ShadowContractError('RUNTIME_MEMBER_BINDING_INVALID', 'Project dispatch must bind exactly six distinct runtime members to the six RoleContexts.');
  if (receipt.memberSetDigest !== runtimeMemberSetDigest(receipt.memberBindings) || receipt.dagDigest !== runtimeDagDigest(mission) || !isIsoInstant(receipt.dispatchedAt) || receipt.receiptDigest !== runtimeProjectDispatchReceiptDigest(receipt)) throw new ShadowContractError('RUNTIME_PROJECT_RECEIPT_INVALID', 'Project member/DAG/timestamp/receipt digest validation failed.');
  mission.runtimeProjectDispatch = structuredClone(receipt);
  mission.state = 'RUNNING';
  appendEvent(mission, 'PROJECT', 'AgentTeams v1.2.0 Project/DAG 已派发并验证运行时成员凭据', {projectId: mission.runtimeProjectId, memberCount: 6, taskCount: mission.tasks.length, buildDigest: receipt.buildDigest, receiptDigest: receipt.receiptDigest, externalActionAllowed: false}, 'presence-mission-leader', mission.sourceCampaignDigest, receipt.dagDigest, now);
  return seal(mission, now);
}

export function runtimeMemberSetDigest(bindings: RuntimeMemberBinding[]): string {
  return sha256Digest([...bindings].sort((left, right) => left.roleId.localeCompare(right.roleId)));
}

export function runtimeDagDigest(mission: ShadowMission): string {
  return sha256Digest(mission.tasks.map((task) => ({taskId: task.id, assignedTo: task.roleId, dependsOn: task.prerequisiteTaskIds})));
}

export function runtimeProjectDispatchReceiptDigest(receipt: Omit<RuntimeProjectDispatchReceipt, 'receiptDigest'> | RuntimeProjectDispatchReceipt): string {
  return sha256Digest({
    schemaVersion: receipt.schemaVersion,
    projectId: receipt.projectId,
    runtimeVersion: receipt.runtimeVersion,
    buildDigest: receipt.buildDigest,
    memberBindings: [...receipt.memberBindings].sort((left, right) => left.roleId.localeCompare(right.roleId)),
    memberSetDigest: receipt.memberSetDigest,
    dagDigest: receipt.dagDigest,
    dispatchedAt: receipt.dispatchedAt
  });
}

export function runtimeTaskAckReceiptDigest(receipt: Omit<RuntimeTaskAckReceipt, 'receiptDigest'> | RuntimeTaskAckReceipt): string {
  return sha256Digest({
    schemaVersion: receipt.schemaVersion,
    projectId: receipt.projectId,
    taskId: receipt.taskId,
    roleId: receipt.roleId,
    runtimeActorId: receipt.runtimeActorId,
    attempt: receipt.attempt,
    runtimeState: receipt.runtimeState,
    acknowledgedAt: receipt.acknowledgedAt
  });
}

export function runtimeTaskSubmissionReceiptDigest(receipt: Omit<RuntimeTaskSubmissionReceipt, 'receiptDigest'> | RuntimeTaskSubmissionReceipt): string {
  return sha256Digest({
    schemaVersion: receipt.schemaVersion,
    projectId: receipt.projectId,
    taskId: receipt.taskId,
    roleId: receipt.roleId,
    runtimeActorId: receipt.runtimeActorId,
    attempt: receipt.attempt,
    ackReceiptDigest: receipt.ackReceiptDigest,
    runtimeState: receipt.runtimeState,
    submittedAt: receipt.submittedAt,
    resultDigest: receipt.resultDigest,
    resultSource: receipt.resultSource,
    runtimeObservationId: receipt.runtimeObservationId
  });
}

function validateRuntimeSubmissionReceipt(mission: ShadowMission, task: TaskContract, submission: RuntimeSubmission, errors: string[]): void {
  const receipt = submission.runtimeReceipt;
  const ack = task.runtimeAck;
  const binding = mission.runtimeProjectDispatch?.memberBindings.find((item) => item.roleId === task.roleId);
  if (ack === null || receipt.projectId !== mission.runtimeProjectId || receipt.taskId !== task.id || receipt.roleId !== task.roleId || receipt.runtimeActorId !== binding?.runtimeActorId || receipt.attempt !== task.attempt || receipt.ackReceiptDigest !== ack?.receiptDigest || receipt.runtimeState !== 'submitted' || receipt.resultSource !== 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY' || !digestString(receipt.runtimeObservationId)) errors.push('RUNTIME_SUBMISSION_BINDING_MISMATCH');
  if (!isIsoInstant(receipt.submittedAt) || (ack !== null && Date.parse(receipt.submittedAt) < Date.parse(ack.acknowledgedAt))) errors.push('RUNTIME_SUBMISSION_TIMESTAMP_INVALID');
  const expectedResultDigest = sha256Digest({schemaVersion: 1, taskId: task.id, roleId: task.roleId, payload: submission.payload, outputDigest: submission.outputDigest, maturity: submission.runtimeResultMaturity, externalActionAllowed: false});
  if (receipt.resultDigest !== expectedResultDigest) errors.push('RUNTIME_RESULT_DIGEST_MISMATCH');
  if (receipt.receiptDigest !== runtimeTaskSubmissionReceiptDigest(receipt)) errors.push('RUNTIME_SUBMISSION_RECEIPT_DIGEST_MISMATCH');
}

function isIsoInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function reconcileMission(missionValue: ShadowMission, acceptedRuntimeTaskIds: string[], now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  mission.state = 'UNKNOWN_RECOVERY';
  appendEvent(mission, 'RECOVERY', '从 PostgreSQL 恢复并开始 runtime reconcile', {runtimeAcceptedTasks: acceptedRuntimeTaskIds.length}, 'CONTROL_PLANE', mission.sourceCampaignDigest, sha256Digest(acceptedRuntimeTaskIds), now);
  for (const task of mission.tasks) if (acceptedRuntimeTaskIds.includes(task.id) && task.state === 'UNKNOWN' && task.acceptedOutputDigest !== null) task.state = 'ACCEPTED';
  if (mission.tasks.some((task) => task.state === 'UNKNOWN')) {
    mission.recovery = {...mission.recovery, status: 'UNKNOWN', recoveredAt: now.toISOString()};
    return seal(mission, now);
  }
  mission.recovery = {...mission.recovery, status: 'RECONCILED', recoveredAt: now.toISOString()};
  const reviewable = latestPassingRevisions(mission);
  const allReviewed = reviewable.length === 4 && reviewable.every((revision) => mission.reviews.some((review) => review.revisionId === revision.id && review.revisionDigest === revision.digest));
  const allReady = allReviewed && reviewable.every((revision) => mission.reviews.some((review) => review.revisionId === revision.id && review.decision === 'READY_FOR_FUTURE_EXECUTION'));
  mission.state = allReady ? 'SHADOW_COMPLETE' : allReviewed ? 'REVISION_REQUIRED' : mission.revisions.length > 0 ? 'NEEDS_OWNER_REVIEW' : 'QUEUED';
  return seal(mission, now);
}

export function markRecoveryUnknown(missionValue: ShadowMission, reason: string, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  mission.state = 'UNKNOWN_RECOVERY';
  mission.recovery = {...mission.recovery, status: 'UNKNOWN', recoveredAt: now.toISOString()};
  appendEvent(mission, 'RECOVERY', 'Runtime reconcile 不可用，保持未知并禁止推断成功', {reason}, 'CONTROL_PLANE', mission.sourceCampaignDigest, sha256Digest({reason, state: 'UNKNOWN_RECOVERY'}), now);
  return seal(mission, now);
}

export function cancelMission(missionValue: ShadowMission, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue);
  for (const task of mission.tasks) if (!['ACCEPTED', 'REJECTED'].includes(task.state)) task.state = 'CANCELLED';
  mission.state = 'CANCELLED';
  appendEvent(mission, 'CANCEL', '未释放 Task 已取消；历史保留', {acceptedHistoryPreserved: true, externalActionCount: 0}, 'CONTROL_PLANE', mission.etag, sha256Digest({state: 'CANCELLED'}), now);
  return seal(mission, now);
}

export function markTimedOut(missionValue: ShadowMission, taskId: string, now = new Date()): ShadowMission {
  const mission = structuredClone(missionValue); const task = mission.tasks.find((item) => item.id === taskId);
  if (task === undefined) throw new ShadowContractError('TASK_NOT_FOUND', taskId);
  task.state = 'TIMED_OUT'; mission.state = 'TIMED_OUT';
  appendEvent(mission, 'TASK', 'Task 超时并保持 fail-closed', {taskId, retryAllowed: true}, 'CONTROL_PLANE', task.inputDigest, sha256Digest({taskId, state: 'TIMED_OUT'}), now);
  return seal(mission, now);
}

export function missionPublicEvidence(mission: ShadowMission): object {
  return {
    schemaVersion: 1, maturity: 'MOCK_CONFORMANCE', realAgentTeamsAcceptance: false, missionId: mission.id, campaignId: mission.campaignId,
    runtime: {name: mission.runtime, version: mission.runtimeVersion, memberCount: mission.roleContexts.length, assertion: 'CONTROL_PLANE_CONTRACT_ONLY'},
    state: mission.state, sourceCampaignDigest: mission.sourceCampaignDigest,
    roles: mission.roleContexts.map(({roleId, identityId, responsibility, permissions, orchestrationOnly, contextDigest}) => ({roleId, identityId, responsibility, permissions, orchestrationOnly, contextDigest})),
    tasks: mission.tasks.map(({id, roleId, state, inputDigest, acceptedOutputDigest, prerequisiteTaskIds}) => ({id, roleId, state, inputDigest, acceptedOutputDigest, prerequisiteTaskIds})),
    revisions: mission.revisions.map(({id, platform, revision, digest, producerRoleId, immutable}) => ({id, platform, revision, digest, producerRoleId, immutable})),
    audits: mission.audits.map(({id, revisionId, outcome, status, digest, issues}) => ({id, revisionId, outcome, status, digest, issues})),
    modelCalls: mission.modelCalls.map(({id, taskId, provider, maturity, model, inputDigest, outputDigest, estimatedCostUsd, latencyMs, attempts, error, secretPresent}) => ({id, taskId, provider, maturity, model, inputDigest, outputDigest, estimatedCostUsd, latencyMs, attempts, error, secretPresent})),
    mediaAssets: mission.mediaAssets.map(({id, contentDigest, provider, maturity, rights, costReceipt, approvalState}) => ({id, contentDigest, provider, maturity, rights, costReceipt, approvalState})),
    noAction: {externalActionAllowed: false, actionGrantCount: mission.actionGrantCount, connectorCount: mission.connectorCount, externalActionCount: mission.externalActionCount},
    trace: mission.trace, ledgerHead: mission.ledger.at(-1)?.entryDigest ?? null
  };
}

function roleContext(missionId: string, roleId: MissionRoleId, identityId: string, locks: SkillLock[]): RoleContext {
  const definition = ROLE_DEFINITIONS[roleId]; const skillLockIds = ROLE_SKILLS[roleId].map((index) => locks[index]!.id);
  const context = {schemaVersion: 1 as const, missionId, roleId, identityId, responsibility: definition.responsibility, permissions: [...definition.permissions], allowedTools: [...definition.tools], visibleData: [...definition.visible], prohibitedOutputs: [...definition.prohibited], orchestrationOnly: definition.orchestrationOnly, skillLockIds};
  return {...context, contextDigest: sha256Digest(context)} as RoleContext;
}

function taskContracts(missionId: string, sourceDigest: string, contexts: RoleContext[], locks: SkillLock[], now: Date): ShadowMission['tasks'] {
  const ids = Array.from({length: 8}, (_, index) => stableId(now, sourceDigest, 50 + index));
  const definitions = [
    ['presence-mission-leader', 'PROJECT_COORDINATION', [], 1],
    ['evidence-claim-steward', 'FREEZE_EVIDENCE', [], 1],
    ['campaign-planner', 'PLAN_CAMPAIGN', [ids[1]!], 1],
    ['founder-identity-producer', 'PRODUCE_FOUNDER', [ids[2]!], 1],
    ['product-account-producer', 'PRODUCE_PRODUCT', [ids[2]!], 1],
    ['independent-auditor', 'AUDIT_REVISIONS', [ids[3]!, ids[4]!], 1],
    ['founder-identity-producer', 'PRODUCE_FOUNDER_CORRECTION', [ids[5]!], 2],
    ['independent-auditor', 'REAUDIT_CORRECTION', [ids[6]!], 2]
  ] as const;
  return definitions.map(([roleId, kind, prereqs, attempt], index) => {
    const context = contexts.find((candidate) => candidate.roleId === roleId)!;
    return {schemaVersion: 1, id: ids[index]!, missionId, roleId, roleIdentityId: context.identityId, kind, inputDigest: sha256Digest({sourceDigest, contextDigest: context.contextDigest, prerequisites: prereqs, phase: kind}), prerequisiteTaskIds: [...prereqs], skillLockDigest: sha256Digest(context.skillLockIds.map((id) => locks.find((lock) => lock.id === id)!.digest)), outputSchema: `lumiclaw.shadow.${kind.toLowerCase()}.v1`, outputSchemaVersion: 1, timeoutMs: 120_000, allowedTools: context.allowedTools, state: prereqs.length > 0 ? 'WAITING_DEPENDENCY' : 'ASSIGNED', attempt, ackedAt: null, runtimeAck: null, submittedAt: null, runtimeSubmission: null, acceptedOutputDigest: null};
  });
}

function completeTask(mission: ShadowMission, kind: TaskContract['kind'], now: Date): void {
  const task = mission.tasks.find((item) => item.kind === kind)!; const roleId = task.roleId;
  task.state = 'ACKNOWLEDGED'; task.ackedAt = now.toISOString();
  appendEvent(mission, 'ACK', `${roleId} 已 ACK`, {taskId: task.id, attempt: task.attempt}, roleId, task.inputDigest, sha256Digest({ack: task.id}), now);
  task.state = 'ACCEPTED'; task.submittedAt = now.toISOString(); task.acceptedOutputDigest = sha256Digest({taskId: task.id, roleId, publicSafe: true});
  appendEvent(mission, 'SUBMIT', `${roleId} Submit 已验收`, {taskId: task.id, schema: task.outputSchema}, roleId, task.inputDigest, task.acceptedOutputDigest, now);
  for (const dependent of mission.tasks.filter((candidate) => candidate.prerequisiteTaskIds.includes(task.id))) if (dependent.prerequisiteTaskIds.every((id) => mission.tasks.find((item) => item.id === id)?.state === 'ACCEPTED')) dependent.state = 'ASSIGNED';
}

function validateSubmissionPayload(task: TaskContract, payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  switch (task.kind) {
    case 'PROJECT_COORDINATION': return typeof payload.projectId === 'string' && payload.projectId.length > 0 && payload.externalActionAllowed === false;
    case 'FREEZE_EVIDENCE': return payload.frozen === true && digestString(payload.claimEvidenceDigest);
    case 'PLAN_CAMPAIGN': return digestString(payload.activationPlanDigest);
    case 'PRODUCE_FOUNDER': { const revisions = runtimeRevisions(payload); return Array.isArray(payload.revisions) && payload.revisions.length === 2 && revisions.length === 2 && revisions.every((draft) => ['X', 'XIAOHONGSHU'].includes(draft.platform) && draft.revision === 1); }
    case 'PRODUCE_PRODUCT': { const revisions = runtimeRevisions(payload); return Array.isArray(payload.revisions) && payload.revisions.length === 2 && revisions.length === 2 && revisions.every((draft) => ['BLUESKY', 'LINKEDIN'].includes(draft.platform)); }
    case 'AUDIT_REVISIONS': { const decisions = runtimeDecisions(payload); return Array.isArray(payload.decisions) && payload.decisions.length === 4 && decisions.length === 4 && decisions.every((decision) => decision.revision === 1); }
    case 'PRODUCE_FOUNDER_CORRECTION': { const revisions = runtimeRevisions(payload); return Array.isArray(payload.revisions) && payload.revisions.length === 1 && revisions.length === 1 && revisions[0]?.platform === 'X' && revisions[0]?.revision === 2 && digestString(payload.failedAuditDigest); }
    case 'REAUDIT_CORRECTION': { const decisions = runtimeDecisions(payload); return Array.isArray(payload.decisions) && payload.decisions.length === 1 && decisions.length === 1 && decisions[0]?.platform === 'X' && decisions[0]?.revision === 2 && digestString(payload.failedAuditDigest); }
  }
}

type RuntimeRevisionDraft = {platform: GovernedArtifactRevision['platform']; revision: number; sourceRevisionDigest: string; contentDigest: string; content: PlatformArtifact};
type RuntimeAuditDraft = {platform: GovernedArtifactRevision['platform']; revision: number; revisionContentDigest: string; outcome: 'PASS' | 'FAIL' | 'ESCALATE'; issues: AuditIssue[]};

function runtimePayloadByKind(mission: ShadowMission, kind: TaskContract['kind']): Record<string, unknown> {
  const payload = mission.tasks.find((task) => task.kind === kind)?.acceptedPayload;
  if (!isRecord(payload)) throw new ShadowContractError('RUNTIME_ACCEPTED_PAYLOAD_MISSING', kind);
  return payload;
}

function runtimeRevisions(payload: Record<string, unknown>): RuntimeRevisionDraft[] {
  if (!Array.isArray(payload.revisions)) return [];
  return payload.revisions.flatMap((value) => {
    if (!isRecord(value) || !isPlatform(value.platform) || !Number.isInteger(value.revision) || Number(value.revision) < 1 || !digestString(value.sourceRevisionDigest) || !digestString(value.contentDigest) || !isPlatformArtifact(value.content, value.platform) || value.contentDigest !== sha256Digest(value.content)) return [];
    return [{platform: value.platform, revision: Number(value.revision), sourceRevisionDigest: value.sourceRevisionDigest, contentDigest: value.contentDigest, content: structuredClone(value.content)} as RuntimeRevisionDraft];
  });
}

function runtimeDecisions(payload: Record<string, unknown>): RuntimeAuditDraft[] {
  if (!Array.isArray(payload.decisions)) return [];
  return payload.decisions.flatMap((value) => {
    if (!isRecord(value) || !isPlatform(value.platform) || !Number.isInteger(value.revision) || Number(value.revision) < 1 || !digestString(value.revisionContentDigest) || !['PASS', 'FAIL', 'ESCALATE'].includes(String(value.outcome)) || !Array.isArray(value.issues)) return [];
    const issues = value.issues.flatMap((issue) => isRuntimeAuditIssue(issue) ? [structuredClone(issue)] : []);
    if (issues.length !== value.issues.length || (value.outcome === 'PASS' && issues.length !== 0) || (value.outcome !== 'PASS' && issues.length === 0)) return [];
    return [{platform: value.platform, revision: Number(value.revision), revisionContentDigest: value.revisionContentDigest, outcome: value.outcome, issues} as RuntimeAuditDraft];
  });
}

function isRuntimeAuditIssue(value: unknown): value is AuditIssue {
  return isRecord(value) && ['CLAIM_OVERREACH', 'CAPABILITY_CONSTRAINT', 'EVIDENCE_MISSING', 'ROLE_PERMISSION', 'DIGEST_MISMATCH'].includes(String(value.code)) && ['BLOCKING', 'ESCALATE'].includes(String(value.severity)) && typeof value.path === 'string' && typeof value.message === 'string' && Array.isArray(value.evidenceRefIds) && value.evidenceRefIds.every((id) => typeof id === 'string') && ROLE_IDS.includes(value.nextResponsibleRoleId as MissionRoleId);
}

function isPlatform(value: unknown): value is GovernedArtifactRevision['platform'] { return ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].includes(String(value)); }
function digestString(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value); }
function isPlatformArtifact(value: unknown, platform: GovernedArtifactRevision['platform']): value is PlatformArtifact {
  if (!isRecord(value) || value.kind !== platform) return false;
  const strings = (candidate: unknown) => Array.isArray(candidate) && candidate.length > 0 && candidate.every((item) => typeof item === 'string');
  if (platform === 'X') return strings(value.posts) && typeof value.altText === 'string';
  if (platform === 'BLUESKY') return strings(value.posts) && typeof value.embedUrl === 'string' && typeof value.altText === 'string';
  if (platform === 'LINKEDIN') return typeof value.commentary === 'string' && ['PERSON', 'COMPANY'].includes(String(value.authorKind)) && typeof value.linkTitle === 'string' && typeof value.linkUrl === 'string';
  return typeof value.title === 'string' && typeof value.body === 'string' && strings(value.topics) && typeof value.coverLabel === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function revisionFromSource(mission: ShadowMission, campaign: CampaignDocument, content: PlatformArtifact, sourceId: string, activationUnitId: string, platform: GovernedArtifactRevision['platform'], producerRoleId: GovernedArtifactRevision['producerRoleId'], revision: number, parentRevisionId: string | null, now: Date): GovernedArtifactRevision {
  const role = mission.roleContexts.find((item) => item.roleId === producerRoleId)!; const capability = campaign.capabilitySnapshots.find((item) => item.platform === platform)!;
  const value = {schemaVersion: 1 as const, id: stableId(now, `${mission.id}:${platform}:${revision}`, 60 + revision), organizationId: mission.organizationId, campaignId: mission.campaignId, missionId: mission.id, activationUnitId, producerRoleId, producerIdentityId: role.identityId, platform, revision, parentRevisionId, sourceCampaignDigest: mission.sourceCampaignDigest, claimBindingDigest: sha256Digest(campaign.claims.filter((item) => item.status === 'APPROVED')), capabilityBindingDigest: sha256Digest(capability), content: structuredClone(content), digest: '', createdAt: now.toISOString(), immutable: true as const};
  return {...value, digest: revisionDigest(value)};
}

function createAudit(mission: ShadowMission, campaign: CampaignDocument, revision: GovernedArtifactRevision, outcome: AuditDecision['outcome'], now: Date, providedIssues?: AuditIssue[], supersedesAuditId: string | null = null): AuditDecision {
  const auditor = mission.roleContexts.find((item) => item.roleId === 'independent-auditor')!;
  const issues = providedIssues ?? (outcome === 'FAIL' ? [{code: 'CLAIM_OVERREACH' as const, severity: 'BLOCKING' as const, path: mission.fault.injectedPath, message: '“Generally available” exceeds the frozen approved product-direction Claim.', evidenceRefIds: campaign.evidenceRefs.map((item) => item.id), nextResponsibleRoleId: 'founder-identity-producer' as const}] : []);
  const value = {schemaVersion: 1 as const, id: stableId(now, `${revision.digest}:audit`, 70), organizationId: mission.organizationId, campaignId: mission.campaignId, missionId: mission.id, revisionId: revision.id, revisionDigest: revision.digest, auditorRoleId: 'independent-auditor' as const, auditorIdentityId: auditor.identityId, outcome, issues, bindings: {claimEvidenceDigest: sha256Digest({claims: campaign.claims, evidence: campaign.evidenceRefs}), mandateDigest: sha256Digest(campaign.graph.accountMandates), capabilityDigest: revision.capabilityBindingDigest, policyVersion: 'm2-shadow-policy@1.0.0' as const}, status: 'ACTIVE' as const, invalidatedByRevisionId: null, supersedesAuditId, createdAt: now.toISOString(), digest: ''};
  return {...value, digest: auditDigest(value)};
}

function injectGaFault(content: PlatformArtifact): PlatformArtifact {
  if (content.kind !== 'X') return content;
  return {...content, posts: ['LumiClaw Presence is generally available in every market today.']};
}

function latestPassingRevisions(mission: ShadowMission): GovernedArtifactRevision[] {
  return ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].flatMap((platform) => mission.revisions.filter((item) => item.platform === platform && mission.audits.some((audit) => audit.revisionId === item.id && audit.status === 'ACTIVE' && audit.outcome === 'PASS')).sort((a, b) => b.revision - a.revision).slice(0, 1));
}

function assertCampaignBinding(mission: ShadowMission, campaign: CampaignDocument): void {
  if (campaign.id !== mission.campaignId || campaign.organizationId !== mission.organizationId || campaign.missionContract.sourceDigest !== mission.sourceCampaignDigest) throw new ShadowContractError('MISSION_CAMPAIGN_BINDING_MISMATCH', 'Mission recovery/run requires the exact persisted Campaign digest.');
}

function appendEvent(mission: ShadowMission, kind: MissionTraceEvent['kind'], businessLabel: string, detail: MissionTraceEvent['detail'], actorRoleId: LedgerEntry['actorRoleId'], inputDigest: string, outputDigest: string, now: Date): void {
  const sequence = mission.trace.length + 1; const createdAt = now.toISOString();
  mission.trace.push({schemaVersion: 1, id: stableId(now, `${mission.id}:trace:${sequence}`, 90 + sequence), missionId: mission.id, sequence, kind, businessLabel, detail: redactDetail(detail), safe: true, createdAt});
  const previousEntryDigest = mission.ledger.at(-1)?.entryDigest ?? null;
  const base = {schemaVersion: 1 as const, id: stableId(now, `${mission.id}:ledger:${sequence}`, 140 + sequence), missionId: mission.id, sequence, action: kind, actorRoleId, inputDigest, outputDigest, previousEntryDigest, createdAt};
  mission.ledger.push({...base, entryDigest: sha256Digest(base)});
}

function redactDetail(detail: MissionTraceEvent['detail']): MissionTraceEvent['detail'] {
  return Object.fromEntries(Object.entries(detail).map(([key, value]) => /key|token|secret|cookie|authorization/iu.test(key) ? [key, '[REDACTED]'] : [key, value]));
}

function seal(mission: ShadowMission, now: Date): ShadowMission {
  mission.roleContexts.sort((left, right) => left.roleId.localeCompare(right.roleId));
  mission.skillLocks.sort((left, right) => left.id.localeCompare(right.id));
  mission.tasks.sort((left, right) => left.id.localeCompare(right.id));
  mission.revisions.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  mission.audits.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  mission.reviews.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  mission.modelCalls.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  mission.mediaAssets.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  mission.trace.sort((left, right) => left.sequence - right.sequence);
  mission.ledger.sort((left, right) => left.sequence - right.sequence);
  mission.updatedAt = now.toISOString(); mission.version += 1; mission.etag = `\"mission-${mission.id}-v${mission.version}-${sha256Digest({...mission, etag: ''}).slice(0, 16)}\"`; return mission;
}
function revisionDigest(value: Omit<GovernedArtifactRevision, 'digest'> | GovernedArtifactRevision): string { const copy = {...value, digest: ''}; return sha256Digest(copy); }
function auditDigest(value: Omit<AuditDecision, 'digest'> | AuditDecision): string { const copy = {...value, digest: ''}; return sha256Digest(copy); }
function stableId(now: Date, seed: string, offset: number): string { const hex = sha256Digest(`${seed}:${offset}`); return createUuidV7(now.getTime() + offset, Uint8Array.from(Array.from({length: 10}, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)))); }
