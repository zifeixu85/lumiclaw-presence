import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const evidenceRoot = path.join(root, '.evidence', 'sdd-002', 'initial-demo');

export const DEMO_CONFIG = Object.freeze({
  schemaVersion: '1.0.0',
  root,
  project: 'lumiclaw-sdd002-initial-demo',
  webPort: 3130,
  apiPort: 4130,
  webBase: 'http://127.0.0.1:3130',
  apiBase: 'http://127.0.0.1:4130',
  evidenceRoot,
  evidenceDisplayRoot: '.evidence/sdd-002/initial-demo',
  chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  providerMode: 'PUBLIC_SAFE_MOCK',
  providerMaturity: 'MOCK_CONFORMANCE',
  fault: 'BETA_TO_GA',
  roleIds: Object.freeze([
    'presence-mission-leader',
    'evidence-claim-steward',
    'campaign-planner',
    'founder-identity-producer',
    'product-account-producer',
    'independent-auditor'
  ])
});

export class InitialDemoError extends Error {
  constructor(code, details = undefined) {
    super(code);
    this.name = 'InitialDemoError';
    this.code = code;
    this.details = details;
  }
}

export function assertExactDemoTargets(candidateRoot, candidateProject, candidateEvidenceRoot) {
  if (path.resolve(candidateRoot) !== DEMO_CONFIG.root) throw new InitialDemoError('INITIAL_DEMO_ROOT_TARGET_INVALID');
  if (candidateProject !== DEMO_CONFIG.project) throw new InitialDemoError('INITIAL_DEMO_PROJECT_TARGET_INVALID');
  const resolvedEvidence = path.resolve(candidateEvidenceRoot);
  if (resolvedEvidence !== DEMO_CONFIG.evidenceRoot || !resolvedEvidence.startsWith(`${DEMO_CONFIG.root}${path.sep}.evidence${path.sep}`)) {
    throw new InitialDemoError('INITIAL_DEMO_EVIDENCE_TARGET_INVALID');
  }
  return DEMO_CONFIG;
}

export function validatePreparedMission(mission, expectedPhase) {
  if (!isRecord(mission)) throw new InitialDemoError('INITIAL_DEMO_MISSION_INVALID');
  if (mission.providerMode !== DEMO_CONFIG.providerMode || mission.providerMaturity !== DEMO_CONFIG.providerMaturity) throw new InitialDemoError('INITIAL_DEMO_MATURITY_INVALID');
  if (mission.externalActionAllowed !== false || mission.actionGrantCount !== 0 || mission.connectorCount !== 0 || mission.externalActionCount !== 0) throw new InitialDemoError('INITIAL_DEMO_EXTERNAL_ACTION_BOUNDARY_INVALID');

  const roles = array(mission.roleContexts, 'INITIAL_DEMO_ROLE_TOPOLOGY_INVALID');
  const roleIds = roles.map((role) => isRecord(role) ? role.roleId : undefined);
  if (roleIds.length !== DEMO_CONFIG.roleIds.length || roleIds.some((roleId) => typeof roleId !== 'string') || new Set(roleIds).size !== DEMO_CONFIG.roleIds.length || DEMO_CONFIG.roleIds.some((roleId) => !roleIds.includes(roleId))) throw new InitialDemoError('INITIAL_DEMO_ROLE_TOPOLOGY_INVALID');
  const tasks = array(mission.tasks, 'INITIAL_DEMO_TASK_TOPOLOGY_INVALID');
  const skillLocks = array(mission.skillLocks, 'INITIAL_DEMO_SKILL_TOPOLOGY_INVALID');
  if (tasks.length !== 8) throw new InitialDemoError('INITIAL_DEMO_TASK_TOPOLOGY_INVALID');
  if (skillLocks.length !== 5) throw new InitialDemoError('INITIAL_DEMO_SKILL_TOPOLOGY_INVALID');

  const revisions = array(mission.revisions, 'INITIAL_DEMO_REVISION_SET_INVALID');
  const audits = array(mission.audits, 'INITIAL_DEMO_AUDIT_SET_INVALID');
  const reviews = array(mission.reviews, 'INITIAL_DEMO_REVIEW_SET_INVALID');
  if (revisions.length !== 5 || audits.length !== 5) throw new InitialDemoError('INITIAL_DEMO_REVISION_AUDIT_COUNT_INVALID');
  const deniedRevisionId = isRecord(mission.fault) && typeof mission.fault.deniedRevisionId === 'string' ? mission.fault.deniedRevisionId : undefined;
  const correctedRevisionId = isRecord(mission.fault) && typeof mission.fault.correctedRevisionId === 'string' ? mission.fault.correctedRevisionId : undefined;
  const deniedRevision = revisions.find((revision) => isRecord(revision) && revision.id === deniedRevisionId);
  const failedAudit = audits.find((audit) => isRecord(audit) && audit.revisionId === deniedRevisionId && audit.outcome === 'FAIL' && audit.status === 'INVALIDATED');
  const blockingIssue = isRecord(failedAudit) && Array.isArray(failedAudit.issues)
    ? failedAudit.issues.find((issue) => isRecord(issue) && issue.code === 'CLAIM_OVERREACH' && issue.nextResponsibleRoleId === 'founder-identity-producer' && Array.isArray(issue.evidenceRefIds) && issue.evidenceRefIds.length > 0)
    : undefined;
  if (deniedRevision === undefined || correctedRevisionId === undefined || blockingIssue === undefined) throw new InitialDemoError('INITIAL_DEMO_AUDITOR_FAULT_INVALID');

  const activePassAudits = audits.filter((audit) => isRecord(audit) && audit.status === 'ACTIVE' && audit.outcome === 'PASS');
  const activePassRevisionIds = new Set(activePassAudits.map((audit) => audit.revisionId));
  const activePassRevisions = revisions.filter((revision) => isRecord(revision) && activePassRevisionIds.has(revision.id));
  if (activePassAudits.length !== 4 || activePassRevisions.length !== 4 || new Set(activePassRevisions.map((revision) => revision.platform)).size !== 4 || !activePassRevisionIds.has(correctedRevisionId)) throw new InitialDemoError('INITIAL_DEMO_ACTIVE_PASS_SET_INVALID');

  if (expectedPhase === 'PREPARED') {
    if (!['NEEDS_OWNER_REVIEW', 'AWAITING_OWNER_REVIEW'].includes(String(mission.state)) || reviews.length !== 0) throw new InitialDemoError('INITIAL_DEMO_PREPARED_STATE_INVALID');
  } else if (expectedPhase === 'COMPLETED') {
    if (!['SHADOW_COMPLETE', 'COMPLETED_SHADOW'].includes(String(mission.state)) || reviews.length !== 4) throw new InitialDemoError('INITIAL_DEMO_COMPLETED_STATE_INVALID');
    if (reviews.some((review) => !isRecord(review) || review.authority !== 'NON_EXECUTABLE_OWNER_REVIEW' || review.createsActionGrant !== false || !activePassRevisionIds.has(review.revisionId))) throw new InitialDemoError('INITIAL_DEMO_REVIEW_SET_INVALID');
  } else throw new InitialDemoError('INITIAL_DEMO_EXPECTED_PHASE_INVALID');

  return {
    state: mission.state,
    missionId: mission.id,
    roles: roles.length,
    tasks: tasks.length,
    skillLocks: skillLocks.length,
    revisions: revisions.length,
    audits: audits.length,
    activePassRevisions: activePassRevisions.length,
    reviews: reviews.length,
    deniedRevisionId,
    correctedRevisionId,
    actionGrantCount: 0,
    connectorCount: 0,
    externalActionCount: 0,
    activePass: activePassRevisions.map((revision) => ({id: revision.id, platform: revision.platform, revision: revision.revision, digest: revision.digest}))
  };
}

export function assertPublicSafeEvidence(value) {
  scanEvidence(value, '$');
  return true;
}

function scanEvidence(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanEvidence(item, `${location}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'secretPresent') {
        if (child !== false) throw new InitialDemoError('INITIAL_DEMO_EVIDENCE_SECRET_FLAG_INVALID', location);
      } else if (/authorization|cookie|api.?key|runtime.?ticket|access.?token|refresh.?token|password|raw.?prompt/iu.test(key)) {
        throw new InitialDemoError('INITIAL_DEMO_EVIDENCE_FORBIDDEN_KEY', `${location}.${key}`);
      }
      scanEvidence(child, `${location}.${key}`);
    }
    return;
  }
  if (typeof value !== 'string') return;
  if (/\bBearer\s+|DEEPSEEK_API_KEY|LUMICLAW_RUNTIME_BROKER_BOOTSTRAP|x-lumiclaw-runtime-ticket|\/Users\/|\/home\/|[A-Z]:\\Users\\/iu.test(value)) {
    throw new InitialDemoError('INITIAL_DEMO_EVIDENCE_FORBIDDEN_VALUE', location);
  }
}

function array(value, code) {
  if (!Array.isArray(value)) throw new InitialDemoError(code);
  return value;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
