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
  if (definition.platforms) {
    if (!Array.isArray(input.projection.sourceRevisions)) throw new Error('ROLE_PROJECTION_SOURCE_REVISIONS_MISSING');
    const platforms = input.projection.sourceRevisions.map((revision) => revision?.platform).sort();
    if (platforms.length !== definition.platforms.length || platforms.some((platform, index) => platform !== [...definition.platforms].sort()[index])) throw new Error('ROLE_PROJECTION_CROSS_ROLE_PLATFORM_LEAK');
  }
  if (input.taskKind === 'PROJECT_COORDINATION' && (!isRecord(input.projection.mission) || !exactKeys(input.projection.mission, ['executionMode', 'id', 'runtimeProjectId']))) throw new Error('ROLE_PROJECTION_LEADER_SCOPE_INVALID');
  if (input.taskKind === 'FREEZE_EVIDENCE' && (!isRecord(input.projection.claimEvidence) || !exactKeys(input.projection.claimEvidence, ['claims', 'evidenceRefs']))) throw new Error('ROLE_PROJECTION_EVIDENCE_SCOPE_INVALID');
  if (input.taskKind === 'AUDIT_REVISIONS' && (!isRecord(input.projection.producerSummaries) || !exactKeys(input.projection.producerSummaries, ['founder', 'product']))) throw new Error('ROLE_PROJECTION_AUDITOR_SCOPE_INVALID');
  if (input.taskKind === 'PRODUCE_FOUNDER_CORRECTION' && (!isRecord(input.projection.failedAudit) || !isRecord(input.projection.deniedRevision))) throw new Error('ROLE_PROJECTION_CORRECTION_SCOPE_INVALID');
  if (input.taskKind === 'REAUDIT_CORRECTION' && (!isRecord(input.projection.failedAudit) || !isRecord(input.projection.correctedRevision))) throw new Error('ROLE_PROJECTION_REAUDIT_SCOPE_INVALID');
  return true;
}

function exactKeys(value, expected) { const actual = Object.keys(value).sort(); const wanted = [...expected].sort(); return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]); }
function hex(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value); }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
