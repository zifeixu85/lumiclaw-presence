import {createHash} from 'node:crypto';

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}

export function digest(value) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex'); }

const definitions = {
  PROJECT_COORDINATION: {role: 'presence-mission-leader', keys: ['mission']},
  FREEZE_EVIDENCE: {role: 'evidence-claim-steward', keys: ['claimEvidence']},
  PLAN_CAMPAIGN: {role: 'campaign-planner', keys: ['activationPlan', 'frozenClaimEvidenceDigest']},
  PRODUCE_FOUNDER: {role: 'founder-identity-producer', keys: ['evidenceRefIds', 'sourceRevisions'], platforms: ['X', 'XIAOHONGSHU']},
  PRODUCE_PRODUCT: {role: 'product-account-producer', keys: ['evidenceRefIds', 'sourceRevisions'], platforms: ['BLUESKY', 'LINKEDIN']},
  AUDIT_REVISIONS: {role: 'independent-auditor', keys: ['evidenceRefIds', 'producerSummaries']},
  PRODUCE_FOUNDER_CORRECTION: {role: 'founder-identity-producer', keys: ['deniedRevision', 'failedAudit', 'sourceRevisions'], platforms: ['X']},
  REAUDIT_CORRECTION: {role: 'independent-auditor', keys: ['correctedRevision', 'failedAudit']}
};

export function validateRoleProjectionInput(input) {
  if (!isRecord(input) || !exactKeys(input, ['externalActionAllowed', 'inputDigest', 'inputProjectionDigest', 'inputProjectionSchema', 'kind', 'projectId', 'projection', 'roleContextDigest', 'roleId', 'taskId', 'taskKind'])) throw new Error('ROLE_PROJECTION_TOP_LEVEL_INVALID');
  if (input.kind !== 'LUMICLAW_PUBLIC_SAFE_SHADOW_TASK' || input.externalActionAllowed !== false || !hex(input.inputDigest) || !hex(input.inputProjectionDigest) || !hex(input.roleContextDigest) || typeof input.projectId !== 'string' || typeof input.taskId !== 'string') throw new Error('ROLE_PROJECTION_ENVELOPE_INVALID');
  const definition = definitions[input.taskKind];
  if (!definition || input.roleId !== definition.role || input.inputProjectionSchema !== `lumiclaw.shadow.task-input.${input.taskKind.toLowerCase().replaceAll('_', '-')}.v1`) throw new Error('ROLE_PROJECTION_ROLE_SCHEMA_INVALID');
  if (!isRecord(input.projection) || !exactKeys(input.projection, definition.keys) || digest(input.projection) !== input.inputProjectionDigest) throw new Error('ROLE_PROJECTION_DIGEST_OR_KEYS_INVALID');
  if (!validNestedProjection(input.taskKind, input.projection, definition)) throw new Error('ROLE_PROJECTION_NESTED_SCHEMA_INVALID');
  return true;
}

function validNestedProjection(taskKind, projection, definition) {
  if (taskKind === 'PROJECT_COORDINATION') {
    return closed(projection.mission, ['executionMode', 'id', 'runtimeProjectId'])
      && projection.mission.executionMode === 'SHADOW_PREP_ONLY'
      && nonEmptyString(projection.mission.id)
      && nonEmptyString(projection.mission.runtimeProjectId);
  }
  if (taskKind === 'FREEZE_EVIDENCE') {
    return closed(projection.claimEvidence, ['claims', 'evidenceRefs'])
      && arrayOf(projection.claimEvidence.claims, validClaim)
      && arrayOf(projection.claimEvidence.evidenceRefs, validEvidenceRef);
  }
  if (taskKind === 'PLAN_CAMPAIGN') return hex(projection.frozenClaimEvidenceDigest) && validActivationPlan(projection.activationPlan);
  if (taskKind === 'PRODUCE_FOUNDER' || taskKind === 'PRODUCE_PRODUCT') {
    return stringArray(projection.evidenceRefIds) && validSourceRevisions(projection.sourceRevisions, definition.platforms);
  }
  if (taskKind === 'AUDIT_REVISIONS') {
    return stringArray(projection.evidenceRefIds)
      && closed(projection.producerSummaries, ['founder', 'product'])
      && validProducerSummary(projection.producerSummaries.founder, ['X', 'XIAOHONGSHU'])
      && validProducerSummary(projection.producerSummaries.product, ['BLUESKY', 'LINKEDIN']);
  }
  if (taskKind === 'PRODUCE_FOUNDER_CORRECTION') {
    return validSourceRevisions(projection.sourceRevisions, ['X'])
      && closed(projection.failedAudit, ['digest', 'id', 'issues'])
      && nonEmptyString(projection.failedAudit.id)
      && hex(projection.failedAudit.digest)
      && arrayOf(projection.failedAudit.issues, validAuditIssue)
      && closed(projection.deniedRevision, ['digest', 'id'])
      && nonEmptyString(projection.deniedRevision.id)
      && hex(projection.deniedRevision.digest);
  }
  if (taskKind === 'REAUDIT_CORRECTION') {
    return closed(projection.failedAudit, ['digest', 'id'])
      && nonEmptyString(projection.failedAudit.id)
      && hex(projection.failedAudit.digest)
      && closed(projection.correctedRevision, ['content', 'digest', 'id'])
      && nonEmptyString(projection.correctedRevision.id)
      && hex(projection.correctedRevision.digest)
      && validPlatformArtifact(projection.correctedRevision.content, 'X');
  }
  return false;
}

function validClaim(value) {
  return closed(value, ['effectiveFrom', 'effectiveUntil', 'evidenceRefIds', 'id', 'marketIds', 'organizationId', 'schemaVersion', 'statement', 'status', 'subjectId', 'subjectType', 'version'])
    && nonEmptyString(value.id) && nonEmptyString(value.organizationId) && value.schemaVersion === 1
    && Number.isInteger(value.version) && value.version >= 1 && value.subjectType === 'PRODUCT'
    && nonEmptyString(value.subjectId) && stringArray(value.marketIds) && nonEmptyString(value.statement)
    && nonEmptyString(value.effectiveFrom) && nonEmptyString(value.effectiveUntil)
    && ['DRAFT', 'APPROVED', 'STALE', 'REVOKED'].includes(value.status) && stringArray(value.evidenceRefIds);
}

function validEvidenceRef(value) {
  return closed(value, ['capturedAt', 'contentDigest', 'id', 'label', 'organizationId', 'publicSafe', 'schemaVersion', 'sourceUrl'])
    && nonEmptyString(value.id) && nonEmptyString(value.organizationId) && value.schemaVersion === 1
    && nonEmptyString(value.label) && nonEmptyString(value.sourceUrl) && nonEmptyString(value.capturedAt)
    && hex(value.contentDigest) && value.publicSafe === true;
}

function validActivationPlan(value) {
  if (!(closed(value, ['schemaVersion', 'summary', 'units']) && value.schemaVersion === 1
    && nonEmptyString(value.summary) && Array.isArray(value.units) && value.units.length === 4
    && value.units.every(validActivationUnit))) return false;
  return exactStringSet(value.units.map((unit) => unit.platform), ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']);
}

function validActivationUnit(value) {
  return closed(value, ['accountMandateId', 'channelAccountId', 'id', 'identityId', 'marketId', 'organizationId', 'plannedAction', 'platform', 'productId', 'schemaVersion'])
    && ['id', 'organizationId', 'identityId', 'productId', 'marketId', 'channelAccountId', 'accountMandateId'].every((key) => nonEmptyString(value[key]))
    && value.schemaVersion === 1 && ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].includes(value.platform) && value.plannedAction === 'PREPARE';
}

function validSourceRevisions(value, expectedPlatforms) {
  if (!Array.isArray(value) || value.length !== expectedPlatforms.length || !value.every(validArtifactRevision)) return false;
  const actual = value.map((revision) => revision.platform).sort();
  const expected = [...expectedPlatforms].sort();
  return actual.every((platform, index) => platform === expected[index]);
}

function validArtifactRevision(value) {
  return closed(value, ['activationUnitId', 'campaignId', 'capabilitySnapshotId', 'claimIds', 'content', 'createdAt', 'id', 'organizationId', 'platform', 'revision', 'schemaVersion'])
    && ['id', 'organizationId', 'campaignId', 'activationUnitId', 'capabilitySnapshotId', 'createdAt'].every((key) => nonEmptyString(value[key]))
    && value.schemaVersion === 1 && Number.isInteger(value.revision) && value.revision >= 1
    && stringArray(value.claimIds) && validPlatformArtifact(value.content, value.platform);
}

function validPlatformArtifact(value, platform) {
  if (!isRecord(value) || value.kind !== platform) return false;
  if (platform === 'X') return closed(value, ['altText', 'kind', 'posts']) && stringArray(value.posts) && typeof value.altText === 'string';
  if (platform === 'BLUESKY') return closed(value, ['altText', 'embedUrl', 'kind', 'posts']) && stringArray(value.posts) && typeof value.embedUrl === 'string' && typeof value.altText === 'string';
  if (platform === 'LINKEDIN') return closed(value, ['authorKind', 'commentary', 'kind', 'linkTitle', 'linkUrl']) && typeof value.commentary === 'string' && ['PERSON', 'COMPANY'].includes(value.authorKind) && typeof value.linkTitle === 'string' && typeof value.linkUrl === 'string';
  if (platform === 'XIAOHONGSHU') return closed(value, ['body', 'coverLabel', 'kind', 'title', 'topics']) && typeof value.title === 'string' && typeof value.body === 'string' && stringArray(value.topics) && typeof value.coverLabel === 'string';
  return false;
}

function validProducerSummary(value, expectedPlatforms) {
  if (!closed(value, ['revisions']) || !Array.isArray(value.revisions) || value.revisions.length !== expectedPlatforms.length) return false;
  if (!value.revisions.every((revision) => closed(revision, ['content', 'contentDigest', 'platform', 'revision', 'sourceRevisionDigest'])
    && Number.isInteger(revision.revision) && revision.revision === 1 && hex(revision.sourceRevisionDigest)
    && hex(revision.contentDigest) && validPlatformArtifact(revision.content, revision.platform)
    && digest(revision.content) === revision.contentDigest)) return false;
  const actual = value.revisions.map((revision) => revision.platform).sort();
  const expected = [...expectedPlatforms].sort();
  return actual.every((platform, index) => platform === expected[index]);
}

function validAuditIssue(value) {
  return closed(value, ['code', 'evidenceRefIds', 'message', 'nextResponsibleRoleId', 'path', 'severity'])
    && ['CLAIM_OVERREACH', 'CAPABILITY_CONSTRAINT', 'EVIDENCE_MISSING', 'ROLE_PERMISSION', 'DIGEST_MISMATCH'].includes(value.code)
    && ['BLOCKING', 'ESCALATE'].includes(value.severity) && typeof value.path === 'string' && typeof value.message === 'string'
    && stringArray(value.evidenceRefIds)
    && ['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'].includes(value.nextResponsibleRoleId);
}

function arrayOf(value, validator) { return Array.isArray(value) && value.every(validator); }
function stringArray(value) { return Array.isArray(value) && value.every(nonEmptyString); }
function nonEmptyString(value) { return typeof value === 'string' && value.length > 0; }
function closed(value, keys) { return isRecord(value) && exactKeys(value, keys); }
function exactKeys(value, expected) { const actual = Object.keys(value).sort(); const wanted = [...expected].sort(); return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]); }
function exactStringSet(actual, expected) { const values = [...actual].sort(); const wanted = [...expected].sort(); return values.length === wanted.length && values.every((value, index) => value === wanted[index]); }
function hex(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value); }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
