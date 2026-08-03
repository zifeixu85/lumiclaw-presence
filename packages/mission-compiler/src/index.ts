import {digestCampaign, validateCampaignDocument, type CampaignDocument, type MissionRoleId} from '@lumiclaw/domain';

export type MissionAdapterInput = {
  schemaVersion: 1;
  campaignId: string;
  organizationId: string;
  sourceDigest: string;
  live: false;
  executionMode: 'SHADOW_PREP_ONLY';
  externalActionAllowed: false;
  roles: {id: MissionRoleId; orchestrationOnly: boolean; permissions: ('ORCHESTRATE' | 'EVIDENCE' | 'PLAN' | 'PRODUCE' | 'AUDIT')[]}[];
  artifacts: {activationUnitId: string; platform: string}[];
};

export function compileMissionAdapterInput(document: CampaignDocument, now = new Date()): MissionAdapterInput {
  const validation = validateCampaignDocument(document, now);
  if (!validation.ok) throw new Error(JSON.stringify({code: 'MISSION_INPUT_INVALID', issues: validation.issues}));
  const sourceDigest = digestCampaign(document);
  if (sourceDigest !== document.missionContract.sourceDigest) throw new Error('MISSION_SOURCE_DIGEST_MISMATCH');
  const permissions = new Map<MissionRoleId, MissionAdapterInput['roles'][number]['permissions']>([
    ['presence-mission-leader', ['ORCHESTRATE']], ['evidence-claim-steward', ['EVIDENCE']], ['campaign-planner', ['PLAN']],
    ['founder-identity-producer', ['PRODUCE']], ['product-account-producer', ['PRODUCE']], ['independent-auditor', ['AUDIT']]
  ]);
  return {
    schemaVersion: 1, campaignId: document.id, organizationId: document.organizationId, sourceDigest,
    live: false, executionMode: 'SHADOW_PREP_ONLY', externalActionAllowed: false,
    roles: document.missionContract.roleIds.map((id) => ({id, orchestrationOnly: id === 'presence-mission-leader', permissions: permissions.get(id)!})),
    artifacts: document.activationPlan.units.map((unit) => ({activationUnitId: unit.id, platform: unit.platform}))
  };
}
