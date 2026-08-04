import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {mkdir, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const LIVE_FAILURE_EVIDENCE_RELATIVE_PATH = '.evidence/sdd-002/deepseek-live-failure.json';
export const SDD002_BASE = '4377103b3fea493a591af7f069fd697d9601f1ca';

export const LIVE_STAGE_CODE = Object.freeze({
  MISSION_OPEN: 'LIVE_MISSION_OPEN_FAILED',
  RUNTIME_IDENTITY: 'LIVE_RUNTIME_IDENTITY_FAILED',
  TOPOLOGY: 'LIVE_AGENTTEAMS_TOPOLOGY_INVALID',
  PROJECT_CREATE: 'LIVE_PROJECT_CREATE_FAILED',
  DAG_PLAN: 'LIVE_DAG_PLAN_FAILED',
  MEMBER_BINDING: 'LIVE_MEMBER_BINDING_MISSING',
  PROJECT_DISPATCH: 'LIVE_PROJECT_DISPATCH_REJECTED',
  TASK_PROTOCOL: 'LIVE_TASK_PROTOCOL_FAILED',
  PROVIDER_REQUEST: 'LIVE_PROVIDER_REQUEST_FAILED',
  FINALIZE: 'LIVE_FINALIZE_FAILED',
  AGENTTEAMS_PROVISION: 'LIVE_AGENTTEAMS_ENVIRONMENT_FAILED',
  CLEANUP: 'LIVE_UAT_CLEANUP_FAILED'
});

const stages = new Set(Object.keys(LIVE_STAGE_CODE));
const codes = new Set(Object.values(LIVE_STAGE_CODE));
const digestPattern = /^[a-f0-9]{64}$/u;
const gitHashPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const shaBuildPattern = /^sha256:[a-f0-9]{64}$/u;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const branchPattern = /^[A-Za-z0-9._/-]{1,160}$/u;
const cleanupStates = new Set(['PENDING', 'PASS', 'FAIL', 'NOT_OWNED']);
const exactProviderOutcomes = new Set([
  'DEEPSEEK_SECRET_FILE_UNAVAILABLE',
  'MODEL_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'MODEL_RESPONSE_IDENTITY_INVALID',
  'MODEL_RETURNED_MODEL_MISMATCH',
  'MODEL_FINISH_REASON_INVALID',
  'MODEL_USAGE_INVALID',
  'PROVIDER_RESPONSE_INVALID',
  'MODEL_JSON_MALFORMED',
  'MODEL_SCHEMA_INVALID',
  'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID',
  'LIVE_PROVIDER_BROKER_FAILED'
]);
const providerHttpOutcomePattern = /^PROVIDER_HTTP_(?:4\d\d|5\d\d)$/u;

export class LiveUatDiagnosticError extends Error {
  constructor(envelope) {
    super(envelope.code);
    this.name = 'LiveUatDiagnosticError';
    this.code = envelope.code;
    this.envelope = envelope;
  }
}

export function isLiveStage(value) { return typeof value === 'string' && stages.has(value); }
export function isLiveStageCode(value) { return typeof value === 'string' && codes.has(value); }
export function isProviderOutcomeCode(value) { return typeof value === 'string' && (exactProviderOutcomes.has(value) || providerHttpOutcomePattern.test(value)); }
export function liveStageCode(stage) {
  if (!isLiveStage(stage)) throw new Error('LIVE_DIAGNOSTIC_STAGE_INVALID');
  return LIVE_STAGE_CODE[stage];
}

export function readSourceIdentity(root) {
  const head = git(root, ['rev-parse', 'HEAD']);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!gitHashPattern.test(head) || !branchPattern.test(branch)) throw new Error('LIVE_DIAGNOSTIC_SOURCE_IDENTITY_INVALID');
  return {base: SDD002_BASE, head, branch};
}

export function defaultLiveProgress() {
  return {
    runtimeIdentityVerified: false,
    topologyVerified: false,
    projectCreated: false,
    dagPlanned: false,
    memberBindingsResolved: false,
    projectDispatched: false,
    providerBrokerRequestStarted: false
  };
}

export function conformanceProgressForStage(stage) {
  if (!isLiveStage(stage)) throw new Error('LIVE_DIAGNOSTIC_STAGE_INVALID');
  const progress = defaultLiveProgress();
  const ordered = ['RUNTIME_IDENTITY', 'TOPOLOGY', 'PROJECT_CREATE', 'DAG_PLAN', 'MEMBER_BINDING', 'PROJECT_DISPATCH', 'TASK_PROTOCOL', 'PROVIDER_REQUEST', 'FINALIZE'];
  const index = ordered.indexOf(stage);
  if (index >= 1) progress.runtimeIdentityVerified = true;
  if (index >= 2) progress.topologyVerified = true;
  if (index >= 3) progress.projectCreated = true;
  if (index >= 4) progress.dagPlanned = true;
  if (index >= 5) progress.memberBindingsResolved = true;
  if (index >= 6) progress.projectDispatched = true;
  if (index >= 7) progress.providerBrokerRequestStarted = true;
  return progress;
}

export function providerOutcomeFromMission(mission, failedTaskId) {
  if (!isRecord(mission) || mission.state !== 'FAILED' || typeof failedTaskId !== 'string' || failedTaskId.length === 0 || failedTaskId.length > 160) return 'LIVE_PROVIDER_BROKER_FAILED';
  const failure = mission.runtimeStatus?.failure;
  if (!isRecord(failure) || failure.failedTaskId !== failedTaskId || !isProviderOutcomeCode(failure.code)) return 'LIVE_PROVIDER_BROKER_FAILED';
  if (!Array.isArray(mission.modelCalls)) return 'LIVE_PROVIDER_BROKER_FAILED';
  const taskCalls = mission.modelCalls.filter((call) => isRecord(call) && call.taskId === failedTaskId);
  if (taskCalls.length > 1) return 'LIVE_PROVIDER_BROKER_FAILED';
  if (taskCalls.length === 1) {
    const call = taskCalls[0];
    if (call.provider !== 'DEEPSEEK' || call.maturity !== 'CANARY' || call.secretPresent !== false || !isRecord(call.response)) return 'LIVE_PROVIDER_BROKER_FAILED';
    if (call.error === null) {
      if (failure.code !== 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID' || typeof call.outputDigest !== 'string' || !digestPattern.test(call.outputDigest)) return 'LIVE_PROVIDER_BROKER_FAILED';
    } else if (!isRecord(call.error) || !isProviderOutcomeCode(call.error.code) || call.error.code !== failure.code || typeof call.error.retryable !== 'boolean') return 'LIVE_PROVIDER_BROKER_FAILED';
  } else if (!['DEEPSEEK_SECRET_FILE_UNAVAILABLE', 'LIVE_PROVIDER_BROKER_FAILED'].includes(failure.code)) return 'LIVE_PROVIDER_BROKER_FAILED';
  return failure.code;
}

export function createLiveFailureReceipt(input) {
  const receipt = {
    schemaVersion: 1,
    status: 'FAIL',
    maturity: 'LIVE_PROVIDER_CANARY_FAILED',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: structuredClone(input.source),
    organizationId: input.organizationId,
    missionId: input.missionId,
    campaignDigest: input.campaignDigest,
    stage: input.stage,
    code: liveStageCode(input.stage),
    failedTaskId: input.failedTaskId ?? null,
    runtime: {
      name: 'AgentTeams',
      version: 'v1.2.0',
      projectId: input.runtime?.projectId ?? null,
      sourceTarSha256: input.runtime?.sourceTarSha256 ?? null,
      buildDigest: input.runtime?.buildDigest ?? null,
      imageDigestSetDigest: input.runtime?.imageDigestSetDigest ?? null,
      expectedMemberCount: 6,
      expectedTaskCount: 8
    },
    progress: structuredClone(input.progress ?? defaultLiveProgress()),
    providerOutcomeCode: input.providerOutcomeCode ?? null,
    modelReceiptCount: input.modelReceiptCount ?? 0,
    noAction: {actionGrantCount: 0, connectorCount: 0, externalActionCount: 0},
    mockFallback: false,
    secretPresent: false,
    liveProviderVerified: false,
    cleanup: structuredClone(input.cleanup ?? {agentTeams: 'PENDING', controlPlane: 'PENDING', secretDirectory: 'PENDING'})
  };
  if (!isLiveFailureReceipt(receipt)) throw new Error('LIVE_FAILURE_RECEIPT_INVALID');
  return receipt;
}

export function isLiveFailureReceipt(value, expected = {}) {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== ['campaignDigest', 'cleanup', 'code', 'failedTaskId', 'generatedAt', 'liveProviderVerified', 'maturity', 'missionId', 'mockFallback', 'modelReceiptCount', 'noAction', 'organizationId', 'progress', 'providerOutcomeCode', 'runtime', 'schemaVersion', 'secretPresent', 'source', 'stage', 'status'].sort().join(',')) return false;
  if (value.schemaVersion !== 1 || value.status !== 'FAIL' || value.maturity !== 'LIVE_PROVIDER_CANARY_FAILED' || value.mockFallback !== false || value.secretPresent !== false || value.liveProviderVerified !== false) return false;
  if (!isLiveStage(value.stage) || value.code !== LIVE_STAGE_CODE[value.stage] || !isIso(value.generatedAt)) return false;
  if (!uuidPattern.test(String(value.organizationId)) || !uuidPattern.test(String(value.missionId)) || !digestPattern.test(String(value.campaignDigest))) return false;
  if (value.failedTaskId !== null && (typeof value.failedTaskId !== 'string' || value.failedTaskId.length === 0 || value.failedTaskId.length > 160)) return false;
  if (value.providerOutcomeCode !== null && !isProviderOutcomeCode(value.providerOutcomeCode)) return false;
  if (value.providerOutcomeCode !== null && (value.stage !== 'PROVIDER_REQUEST' || value.failedTaskId === null || !value.progress?.providerBrokerRequestStarted)) return false;
  if (!Number.isSafeInteger(value.modelReceiptCount) || value.modelReceiptCount < 0 || value.modelReceiptCount > 7) return false;
  if (!isSource(value.source) || !isRuntime(value.runtime) || !isProgress(value.progress) || !isNoAction(value.noAction) || !isCleanup(value.cleanup)) return false;
  if (value.progress.dagPlanned && !value.progress.projectCreated) return false;
  if (value.progress.memberBindingsResolved && !value.progress.dagPlanned) return false;
  if (value.progress.projectDispatched && !value.progress.memberBindingsResolved) return false;
  if (value.progress.providerBrokerRequestStarted && !value.progress.projectDispatched) return false;
  if (value.modelReceiptCount > 0 && !value.progress.providerBrokerRequestStarted) return false;
  if (expected.organizationId !== undefined && value.organizationId !== expected.organizationId) return false;
  if (expected.missionId !== undefined && value.missionId !== expected.missionId) return false;
  if (expected.campaignDigest !== undefined && value.campaignDigest !== expected.campaignDigest) return false;
  if (expected.stage !== undefined && value.stage !== expected.stage) return false;
  if (expected.code !== undefined && value.code !== expected.code) return false;
  if (expected.providerOutcomeCode !== undefined && value.providerOutcomeCode !== expected.providerOutcomeCode) return false;
  return true;
}

export function createLiveFailureEnvelope(receipt) {
  if (!isLiveFailureReceipt(receipt)) throw new Error('LIVE_FAILURE_RECEIPT_INVALID');
  return {
    status: 'FAIL',
    code: receipt.code,
    stage: receipt.stage,
    providerOutcomeCode: receipt.providerOutcomeCode,
    missionId: receipt.missionId,
    evidence: LIVE_FAILURE_EVIDENCE_RELATIVE_PATH,
    secretPresent: false,
    liveProviderVerified: false
  };
}

export function parseLiveFailureEnvelope(raw, expected = {}) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') === 0 || Buffer.byteLength(raw, 'utf8') > 2048) throw new Error('LIVE_FAILURE_ENVELOPE_INVALID');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('LIVE_FAILURE_ENVELOPE_INVALID'); }
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== ['code', 'evidence', 'liveProviderVerified', 'missionId', 'providerOutcomeCode', 'secretPresent', 'stage', 'status'].sort().join(',')) throw new Error('LIVE_FAILURE_ENVELOPE_INVALID');
  if (value.status !== 'FAIL' || !isLiveStage(value.stage) || value.code !== LIVE_STAGE_CODE[value.stage] || (value.providerOutcomeCode !== null && !isProviderOutcomeCode(value.providerOutcomeCode)) || (value.providerOutcomeCode !== null && value.stage !== 'PROVIDER_REQUEST') || !uuidPattern.test(String(value.missionId)) || value.evidence !== LIVE_FAILURE_EVIDENCE_RELATIVE_PATH || value.secretPresent !== false || value.liveProviderVerified !== false) throw new Error('LIVE_FAILURE_ENVELOPE_INVALID');
  if (expected.missionId !== undefined && value.missionId !== expected.missionId) throw new Error('LIVE_FAILURE_ENVELOPE_INVALID');
  return value;
}

export async function writeLiveFailureReceipt(root, receipt, options = {}) {
  if (!isLiveFailureReceipt(receipt)) throw new Error('LIVE_FAILURE_RECEIPT_INVALID');
  const target = options.targetPath ?? path.join(root, LIVE_FAILURE_EVIDENCE_RELATIVE_PATH);
  await mkdir(path.dirname(target), {recursive: true});
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
  await rename(temporary, target);
  return target;
}

export async function readLiveFailureReceipt(root, expected = {}, options = {}) {
  const target = options.targetPath ?? path.join(root, LIVE_FAILURE_EVIDENCE_RELATIVE_PATH);
  let value;
  try { value = JSON.parse(await readFile(target, 'utf8')); } catch { throw new Error('LIVE_FAILURE_RECEIPT_INVALID'); }
  if (!isLiveFailureReceipt(value, expected)) throw new Error('LIVE_FAILURE_RECEIPT_INVALID');
  return value;
}

export async function updateLiveFailureCleanup(root, patch, expected = {}, options = {}) {
  const receipt = await readLiveFailureReceipt(root, expected, options);
  const next = {...receipt, cleanup: {...receipt.cleanup, ...patch}};
  if (!isLiveFailureReceipt(next, expected)) throw new Error('LIVE_FAILURE_RECEIPT_INVALID');
  await writeLiveFailureReceipt(root, next, options);
  return next;
}

function git(root, args) { return execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000}).trim(); }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function nullable(value, pattern) { return value === null || (typeof value === 'string' && pattern.test(value)); }
function isSource(value) { return isRecord(value) && Object.keys(value).sort().join(',') === 'base,branch,head' && value.base === SDD002_BASE && gitHashPattern.test(String(value.head)) && branchPattern.test(String(value.branch)); }
function isRuntime(value) {
  return isRecord(value)
    && Object.keys(value).sort().join(',') === ['buildDigest', 'expectedMemberCount', 'expectedTaskCount', 'imageDigestSetDigest', 'name', 'projectId', 'sourceTarSha256', 'version'].sort().join(',')
    && value.name === 'AgentTeams' && value.version === 'v1.2.0' && value.expectedMemberCount === 6 && value.expectedTaskCount === 8
    && (value.projectId === null || (typeof value.projectId === 'string' && value.projectId.length > 0 && value.projectId.length <= 160))
    && nullable(value.sourceTarSha256, digestPattern) && nullable(value.buildDigest, shaBuildPattern) && nullable(value.imageDigestSetDigest, digestPattern);
}
function isProgress(value) { return isRecord(value) && Object.keys(value).sort().join(',') === ['dagPlanned', 'memberBindingsResolved', 'projectCreated', 'projectDispatched', 'providerBrokerRequestStarted', 'runtimeIdentityVerified', 'topologyVerified'].sort().join(',') && Object.values(value).every((item) => typeof item === 'boolean'); }
function isNoAction(value) { return isRecord(value) && Object.keys(value).sort().join(',') === 'actionGrantCount,connectorCount,externalActionCount' && Object.values(value).every((item) => item === 0); }
function isCleanup(value) { return isRecord(value) && Object.keys(value).sort().join(',') === 'agentTeams,controlPlane,secretDirectory' && Object.values(value).every((item) => cleanupStates.has(item)); }
