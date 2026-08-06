import {digest, validateRoleProjectionInput} from './agentteams-role-projection-contract.mjs';

function input(taskKind, roleId, projection) {
  const inputProjectionDigest = digest(projection);
  return {kind: 'LUMICLAW_PUBLIC_SAFE_SHADOW_TASK', projectId: 'project', taskId: `task-${taskKind}`, taskKind, roleId, roleContextDigest: '1'.repeat(64), inputDigest: '2'.repeat(64), inputProjectionSchema: `lumiclaw.shadow.task-input.${taskKind.toLowerCase().replaceAll('_', '-')}.v1`, inputProjectionDigest, projection, externalActionAllowed: false};
}

const evidenceRef = {id: 'evidence-1', organizationId: 'org', schemaVersion: 1, label: 'Public evidence', sourceUrl: 'https://example.test/evidence', capturedAt: '2026-08-03T00:00:00.000Z', contentDigest: '3'.repeat(64), publicSafe: true};
const claim = {id: 'claim-1', organizationId: 'org', schemaVersion: 1, version: 1, subjectType: 'PRODUCT', subjectId: 'product', marketIds: ['market'], statement: 'Approved public-safe claim.', effectiveFrom: '2026-08-01T00:00:00.000Z', effectiveUntil: '2027-01-01T00:00:00.000Z', status: 'APPROVED', evidenceRefIds: [evidenceRef.id]};
const platformContent = {
  X: {kind: 'X', posts: ['X copy'], altText: 'X alt'},
  BLUESKY: {kind: 'BLUESKY', posts: ['Bluesky copy'], embedUrl: 'https://example.test', altText: 'Bluesky alt'},
  LINKEDIN: {kind: 'LINKEDIN', commentary: 'LinkedIn copy', authorKind: 'COMPANY', linkTitle: 'Example', linkUrl: 'https://example.test'},
  XIAOHONGSHU: {kind: 'XIAOHONGSHU', title: 'Title', body: 'Body', topics: ['topic'], coverLabel: 'Cover'}
};
const unit = (platform, index) => ({id: `unit-${index}`, organizationId: 'org', schemaVersion: 1, identityId: 'identity', productId: 'product', marketId: 'market', channelAccountId: `account-${index}`, accountMandateId: `mandate-${index}`, platform, plannedAction: 'PREPARE'});
const activationPlan = {schemaVersion: 1, summary: 'Four public-safe activation units.', units: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].map(unit)};
const sourceRevision = (platform, index) => ({id: `source-${index}`, organizationId: 'org', campaignId: 'campaign', activationUnitId: `unit-${index}`, schemaVersion: 1, revision: 1, platform, capabilitySnapshotId: `capability-${index}`, claimIds: [claim.id], content: structuredClone(platformContent[platform]), createdAt: '2026-08-03T00:00:00.000Z'});
const runtimeRevision = (platform, index) => ({platform, revision: 1, sourceRevisionDigest: digest(sourceRevision(platform, index)), contentDigest: digest(platformContent[platform]), content: structuredClone(platformContent[platform])});
const issue = {code: 'CLAIM_OVERREACH', severity: 'BLOCKING', path: '/content/posts/0', message: 'Claim exceeds frozen evidence.', evidenceRefIds: [evidenceRef.id], nextResponsibleRoleId: 'founder-identity-producer'};

const founderSources = [sourceRevision('X', 0), sourceRevision('XIAOHONGSHU', 3)];
const productSources = [sourceRevision('BLUESKY', 1), sourceRevision('LINKEDIN', 2)];
const founderSummary = {revisions: [runtimeRevision('X', 0), runtimeRevision('XIAOHONGSHU', 3)]};
const productSummary = {revisions: [runtimeRevision('BLUESKY', 1), runtimeRevision('LINKEDIN', 2)]};

const valid = [
  input('PROJECT_COORDINATION', 'presence-mission-leader', {mission: {id: 'mission', runtimeProjectId: 'project', executionMode: 'SHADOW_PREP_ONLY'}}),
  input('FREEZE_EVIDENCE', 'evidence-claim-steward', {claimEvidence: {claims: [claim], evidenceRefs: [evidenceRef]}}),
  input('PLAN_CAMPAIGN', 'campaign-planner', {frozenClaimEvidenceDigest: '3'.repeat(64), activationPlan}),
  input('PRODUCE_FOUNDER', 'founder-identity-producer', {sourceRevisions: founderSources, evidenceRefIds: [evidenceRef.id]}),
  input('PRODUCE_PRODUCT', 'product-account-producer', {sourceRevisions: productSources, evidenceRefIds: [evidenceRef.id]}),
  input('AUDIT_REVISIONS', 'independent-auditor', {evidenceRefIds: [evidenceRef.id], producerSummaries: {founder: founderSummary, product: productSummary}}),
  input('PRODUCE_FOUNDER_CORRECTION', 'founder-identity-producer', {sourceRevisions: [founderSources[0]], failedAudit: {id: 'audit', digest: '4'.repeat(64), issues: [issue]}, deniedRevision: {id: 'revision-x-v1', digest: '5'.repeat(64)}}),
  input('REAUDIT_CORRECTION', 'independent-auditor', {failedAudit: {id: 'audit', digest: '4'.repeat(64)}, correctedRevision: {id: 'revision-x-v2', digest: '6'.repeat(64), content: platformContent.X}})
];
for (const candidate of valid) validateRoleProjectionInput(candidate);

const nestedFounderSource = structuredClone(founderSources); nestedFounderSource[0].productSources = productSources;
const nestedProductSource = structuredClone(productSources); nestedProductSource[0].founderSources = founderSources;
const nestedAuditorSummary = structuredClone(founderSummary); nestedAuditorSummary.wholeCampaign = {customerData: 'leak'};
const nestedPlan = structuredClone(activationPlan); nestedPlan.wholeCampaign = {customerData: 'leak'};
const duplicateXPlan = {...activationPlan, units: ['X', 'X', 'X', 'X'].map(unit)};
const missingXiaohongshuPlan = {...activationPlan, units: ['X', 'BLUESKY', 'LINKEDIN', 'LINKEDIN'].map(unit)};
const invalid = [
  input('PRODUCE_FOUNDER', 'founder-identity-producer', {sourceRevisions: [sourceRevision('X', 0), sourceRevision('LINKEDIN', 2)], evidenceRefIds: [evidenceRef.id]}),
  input('PRODUCE_PRODUCT', 'product-account-producer', {sourceRevisions: [sourceRevision('BLUESKY', 1), sourceRevision('X', 0)], evidenceRefIds: [evidenceRef.id]}),
  input('PROJECT_COORDINATION', 'presence-mission-leader', {mission: {id: 'mission', runtimeProjectId: 'project', executionMode: 'SHADOW_PREP_ONLY'}, claims: []}),
  input('AUDIT_REVISIONS', 'independent-auditor', {evidenceRefIds: [evidenceRef.id], producerSummaries: {founder: founderSummary, product: productSummary}, editorState: {}}),
  {...valid[0], inputProjectionDigest: '0'.repeat(64)},
  input('PROJECT_COORDINATION', 'presence-mission-leader', {mission: {id: {wholeCampaign: {customerData: 'leak'}}, runtimeProjectId: 'project', executionMode: 'SHADOW_PREP_ONLY'}}),
  input('PLAN_CAMPAIGN', 'campaign-planner', {frozenClaimEvidenceDigest: '3'.repeat(64), activationPlan: nestedPlan}),
  input('PRODUCE_FOUNDER', 'founder-identity-producer', {sourceRevisions: nestedFounderSource, evidenceRefIds: [evidenceRef.id]}),
  input('PRODUCE_PRODUCT', 'product-account-producer', {sourceRevisions: nestedProductSource, evidenceRefIds: [evidenceRef.id]}),
  input('AUDIT_REVISIONS', 'independent-auditor', {evidenceRefIds: [evidenceRef.id], producerSummaries: {founder: nestedAuditorSummary, product: productSummary}}),
  input('FREEZE_EVIDENCE', 'evidence-claim-steward', {claimEvidence: {claims: [{...claim, editorState: {wholeCampaign: true}}], evidenceRefs: [evidenceRef]}}),
  input('PRODUCE_FOUNDER_CORRECTION', 'founder-identity-producer', {sourceRevisions: [founderSources[0]], failedAudit: {id: 'audit', digest: '4'.repeat(64), issues: [{...issue, customerData: 'leak'}]}, deniedRevision: {id: 'revision-x-v1', digest: '5'.repeat(64)}}),
  input('REAUDIT_CORRECTION', 'independent-auditor', {failedAudit: {id: 'audit', digest: '4'.repeat(64)}, correctedRevision: {id: 'revision-x-v2', digest: '6'.repeat(64), content: {...platformContent.X, wholeCampaign: {customerData: 'leak'}}}}),
  input('PLAN_CAMPAIGN', 'campaign-planner', {frozenClaimEvidenceDigest: '3'.repeat(64), activationPlan: duplicateXPlan}),
  input('PLAN_CAMPAIGN', 'campaign-planner', {frozenClaimEvidenceDigest: '3'.repeat(64), activationPlan: missingXiaohongshuPlan})
];
let rejected = 0;
for (const candidate of invalid) {
  try { validateRoleProjectionInput(candidate); }
  catch { rejected += 1; }
}
if (rejected !== invalid.length) throw new Error('ROLE_PROJECTION_NEGATIVE_CONFORMANCE_FAILED');
console.info(JSON.stringify({status: 'PASS', validTaskKinds: valid.length, overbroadOrTamperedRejected: rejected, recursiveNestedAttacksRejected: 8, semanticPlatformSetAttacksRejected: 2}));
