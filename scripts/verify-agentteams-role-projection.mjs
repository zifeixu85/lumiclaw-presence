import {digest, validateRoleProjectionInput} from './agentteams-role-projection-contract.mjs';

function input(taskKind, roleId, projection) {
  const inputProjectionDigest = digest(projection);
  return {kind: 'LUMICLAW_PUBLIC_SAFE_SHADOW_TASK', projectId: 'project', taskId: `task-${taskKind}`, taskKind, roleId, roleContextDigest: '1'.repeat(64), inputDigest: '2'.repeat(64), inputProjectionSchema: `lumiclaw.shadow.task-input.${taskKind.toLowerCase().replaceAll('_', '-')}.v1`, inputProjectionDigest, projection, externalActionAllowed: false};
}

const valid = [
  input('PROJECT_COORDINATION', 'presence-mission-leader', {mission: {id: 'mission', runtimeProjectId: 'project', executionMode: 'SHADOW_PREP_ONLY'}}),
  input('FREEZE_EVIDENCE', 'evidence-claim-steward', {claimEvidence: {claims: [], evidenceRefs: []}}),
  input('PLAN_CAMPAIGN', 'campaign-planner', {frozenClaimEvidenceDigest: '3'.repeat(64), activationPlan: {units: []}}),
  input('PRODUCE_FOUNDER', 'founder-identity-producer', {sourceRevisions: [{platform: 'X'}, {platform: 'XIAOHONGSHU'}], evidenceRefIds: []}),
  input('PRODUCE_PRODUCT', 'product-account-producer', {sourceRevisions: [{platform: 'BLUESKY'}, {platform: 'LINKEDIN'}], evidenceRefIds: []}),
  input('AUDIT_REVISIONS', 'independent-auditor', {evidenceRefIds: [], producerSummaries: {founder: {}, product: {}}}),
  input('PRODUCE_FOUNDER_CORRECTION', 'founder-identity-producer', {sourceRevisions: [{platform: 'X'}], failedAudit: {}, deniedRevision: {}}),
  input('REAUDIT_CORRECTION', 'independent-auditor', {failedAudit: {}, correctedRevision: {}})
];
for (const candidate of valid) validateRoleProjectionInput(candidate);

const invalid = [
  input('PRODUCE_FOUNDER', 'founder-identity-producer', {sourceRevisions: [{platform: 'X'}, {platform: 'LINKEDIN'}], evidenceRefIds: []}),
  input('PRODUCE_PRODUCT', 'product-account-producer', {sourceRevisions: [{platform: 'BLUESKY'}, {platform: 'X'}], evidenceRefIds: []}),
  input('PROJECT_COORDINATION', 'presence-mission-leader', {mission: {id: 'mission', runtimeProjectId: 'project', executionMode: 'SHADOW_PREP_ONLY'}, claims: []}),
  input('AUDIT_REVISIONS', 'independent-auditor', {evidenceRefIds: [], producerSummaries: {founder: {}, product: {}}, editorState: {}}),
  {...valid[0], inputProjectionDigest: '0'.repeat(64)}
];
let rejected = 0;
for (const candidate of invalid) {
  try { validateRoleProjectionInput(candidate); }
  catch { rejected += 1; }
}
if (rejected !== invalid.length) throw new Error('ROLE_PROJECTION_NEGATIVE_CONFORMANCE_FAILED');
console.info(JSON.stringify({status: 'PASS', validTaskKinds: valid.length, overbroadOrTamperedRejected: rejected}));
