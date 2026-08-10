import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access, mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {
  DEMO_CONFIG,
  InitialDemoError,
  assertExactDemoTargets,
  assertPublicSafeEvidence,
  validatePreparedMission
} from './initial-demo-contract.mjs';

const command = process.argv[2] ?? 'prepare';
const statePath = path.join(DEMO_CONFIG.evidenceRoot, 'state.json');
const missionEvidencePath = path.join(DEMO_CONFIG.evidenceRoot, 'mission-evidence.json');
const manifestPath = path.join(DEMO_CONFIG.evidenceRoot, 'demo-manifest.json');
let activeStep = 'COMMAND';

try {
  if (command === 'preflight') console.info(JSON.stringify(await preflight(true)));
  else if (command === 'reset') console.info(JSON.stringify(await resetDemo()));
  else if (command === 'stop') console.info(JSON.stringify(stopDemo()));
  else if (command === 'prepare') console.info(JSON.stringify(await prepareDemo()));
  else if (command === 'complete') console.info(JSON.stringify(await completeDemo()));
  else if (command === 'export') console.info(JSON.stringify(await exportEvidence()));
  else if (command === 'status') console.info(JSON.stringify(await statusDemo()));
  else throw new InitialDemoError('INITIAL_DEMO_COMMAND_INVALID');
} catch (error) {
  const code = error instanceof InitialDemoError ? error.code : 'INITIAL_DEMO_COMMAND_FAILED';
  await writeFailureReceipt(code);
  console.error(JSON.stringify({status: 'FAIL', code, step: activeStep, evidence: `${DEMO_CONFIG.evidenceDisplayRoot}/failure.json`}));
  process.exitCode = 1;
}

async function prepareDemo() {
  activeStep = 'PREFLIGHT_TOOLS';
  await preflight(false);
  activeStep = 'RESET';
  await resetDemo();
  activeStep = 'PREFLIGHT_PORTS';
  const preflightResult = await preflight(true);
  activeStep = 'COMPOSE_START';
  compose(['up', '--build', '--detach', '--wait'], 'inherit');
  await waitForApi();

  activeStep = 'DETERMINISTIC_SEED';
  const firstTemplate = await request('/api/v1/campaigns/demo-template', undefined, 200);
  const secondTemplate = await request('/api/v1/campaigns/demo-template', undefined, 200);
  const firstDocument = firstTemplate.body.document;
  const secondDocument = secondTemplate.body.document;
  if (JSON.stringify(firstDocument) !== JSON.stringify(secondDocument) || firstDocument.dataMode !== 'DEMO_SEED' || firstDocument.live !== false || firstDocument.id !== secondDocument.id || firstDocument.organizationId !== secondDocument.organizationId) throw new InitialDemoError('INITIAL_DEMO_SEED_NOT_DETERMINISTIC');
  const organizationId = firstDocument.organizationId;
  const created = await request('/api/v1/campaigns', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-lumiclaw-organization-id': organizationId, 'idempotency-key': 'initial-demo-seed-v1'},
    body: JSON.stringify(firstDocument)
  }, 201);
  if (!/^[a-f0-9]{64}$/u.test(String(created.body.digest)) || created.body.digest !== firstDocument.missionContract.sourceDigest || created.body.document.id !== firstDocument.id || created.body.document.organizationId !== organizationId) throw new InitialDemoError('INITIAL_DEMO_SEED_PERSISTENCE_INVALID');
  const campaignId = created.body.document.id;
  const campaignDigest = created.body.digest;
  const missionContract = await request(`/api/v1/campaigns/${campaignId}/mission-contract`, {headers: organizationHeaders(organizationId)}, 200);
  if (missionContract.body.digest !== campaignDigest || missionContract.body.contract.sourceDigest !== campaignDigest || missionContract.body.contract.externalActionAllowed !== false) throw new InitialDemoError('INITIAL_DEMO_SEED_CONTRACT_INVALID');

  activeStep = 'SHADOW_FLIGHT';
  const started = await request(`/api/v1/campaigns/${campaignId}/shadow-missions`, {
    method: 'POST',
    headers: {...organizationHeaders(organizationId), 'content-type': 'application/json', 'idempotency-key': 'initial-demo-mission-v1', 'if-match': created.etag},
    body: JSON.stringify({sourceDigest: campaignDigest, fault: DEMO_CONFIG.fault, providerMode: DEMO_CONFIG.providerMode, providerModel: 'deepseek-v4-flash'})
  }, 201);
  const flight = await request(`/api/v1/shadow-missions/${started.body.mission.id}/public-safe-flight`, {
    method: 'POST',
    headers: {...organizationHeaders(organizationId), 'idempotency-key': 'initial-demo-flight-v1', 'if-match': started.etag}
  }, 200);
  const prepared = validatePreparedMission(flight.body.mission, 'PREPARED');

  activeStep = 'AUDITOR_FAIL_CLOSED';
  const deniedRevision = flight.body.mission.revisions.find((revision) => revision.id === prepared.deniedRevisionId);
  const denied = await request(`/api/v1/shadow-missions/${prepared.missionId}/owner-reviews`, {
    method: 'POST',
    headers: {...organizationHeaders(organizationId), 'content-type': 'application/json', 'idempotency-key': 'initial-demo-denied-review-v1', 'if-match': flight.etag},
    body: JSON.stringify({revisionId: deniedRevision.id, revisionDigest: deniedRevision.digest, decision: 'READY_FOR_FUTURE_EXECUTION'})
  }, 422);
  if (denied.body.code !== 'REVIEW_AUDIT_PASS_REQUIRED') throw new InitialDemoError('INITIAL_DEMO_DENIED_REVIEW_PROBE_INVALID');

  const state = {
    schemaVersion: DEMO_CONFIG.schemaVersion,
    organizationId,
    campaignId,
    campaignDigest,
    campaignEtag: created.etag,
    missionId: prepared.missionId,
    deniedReview: {status: 422, code: denied.body.code},
    preparedAt: new Date().toISOString()
  };
  assertPublicSafeEvidence(state);
  await writeJsonAtomic(statePath, state);
  activeStep = 'EVIDENCE_EXPORT';
  await exportEvidence(preflightResult);

  activeStep = 'BROWSER_SMOKE';
  const smoke = spawnSync(process.execPath, ['scripts/initial-demo-browser-smoke.mjs'], {cwd: DEMO_CONFIG.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000});
  if (smoke.status !== 0) throw new InitialDemoError('INITIAL_DEMO_BROWSER_SMOKE_FAILED');
  activeStep = 'FINAL_EXPORT';
  const exported = await exportEvidence(preflightResult);
  return {
    status: 'PASS',
    command: 'prepare',
    maturity: DEMO_CONFIG.providerMaturity,
    realAgentTeamsClaim: false,
    state: prepared.state,
    organizationId,
    campaignId,
    campaignDigest,
    missionId: prepared.missionId,
    deniedReview: state.deniedReview,
    noAction: {actionGrants: 0, connectors: 0, externalActions: 0},
    urls: demoUrls(),
    next: 'npm run demo:complete',
    evidence: exported.evidence
  };
}

async function completeDemo() {
  activeStep = 'STATE_OPEN';
  const state = await readState();
  let opened = await request(`/api/v1/shadow-missions/${state.missionId}`, {headers: organizationHeaders(state.organizationId)}, 200);
  let mission = opened.body.mission;
  let etag = opened.etag;
  if (!['SHADOW_COMPLETE', 'COMPLETED_SHADOW'].includes(mission.state)) {
    const prepared = validatePreparedMission(mission, 'PREPARED');
    activeStep = 'OWNER_REVIEW_COMPLETE';
    for (const revision of prepared.activePass.toSorted((left, right) => left.platform.localeCompare(right.platform))) {
      const response = await request(`/api/v1/shadow-missions/${state.missionId}/owner-reviews`, {
        method: 'POST',
        headers: {...organizationHeaders(state.organizationId), 'content-type': 'application/json', 'idempotency-key': `initial-demo-review-${revision.platform.toLowerCase()}-v1`, 'if-match': etag},
        body: JSON.stringify({revisionId: revision.id, revisionDigest: revision.digest, decision: 'READY_FOR_FUTURE_EXECUTION'})
      }, 200);
      mission = response.body.mission;
      etag = response.etag;
    }
  }
  validatePreparedMission(mission, 'COMPLETED');
  activeStep = 'RESTART_REOPEN';
  compose(['restart', 'postgres', 'api']);
  await waitForApi();
  const reopenedCampaign = await request(`/api/v1/campaigns/${state.campaignId}`, {headers: organizationHeaders(state.organizationId)}, 200);
  const reopenedMission = await request(`/api/v1/shadow-missions/${state.missionId}`, {headers: organizationHeaders(state.organizationId)}, 200);
  if (reopenedCampaign.body.digest !== state.campaignDigest) throw new InitialDemoError('INITIAL_DEMO_CAMPAIGN_REOPEN_INVALID');
  const reopenedSummary = validatePreparedMission(reopenedMission.body.mission, 'COMPLETED');
  activeStep = 'COMPLETED_EVIDENCE_EXPORT';
  const exported = await exportEvidence();
  return {status: 'PASS', command: 'complete', state: reopenedSummary.state, reviews: reopenedSummary.reviews, noAction: {actionGrants: 0, connectors: 0, externalActions: 0}, urls: demoUrls(), evidence: exported.evidence};
}

async function exportEvidence(preflightResult = undefined) {
  const state = await readState();
  const opened = await request(`/api/v1/shadow-missions/${state.missionId}`, {headers: organizationHeaders(state.organizationId)}, 200);
  const phase = opened.body.mission.reviews.length === 4 ? 'COMPLETED' : 'PREPARED';
  const summary = validatePreparedMission(opened.body.mission, phase);
  const publicEvidence = await request(`/api/v1/shadow-missions/${state.missionId}/evidence`, {headers: organizationHeaders(state.organizationId)}, 200);
  const failedAudit = opened.body.mission.audits.find((audit) => audit.revisionId === summary.deniedRevisionId && audit.outcome === 'FAIL');
  const issue = failedAudit.issues.find((candidate) => candidate.code === 'CLAIM_OVERREACH');
  const source = sourceIdentity();
  const evidence = {
    schemaVersion: DEMO_CONFIG.schemaVersion,
    status: 'PASS',
    generatedAt: new Date().toISOString(),
    source,
    truth: {dataMode: 'DEMO_SEED', live: false, providerMode: DEMO_CONFIG.providerMode, maturity: DEMO_CONFIG.providerMaturity, realAgentTeamsClaim: false, externalBusinessClaim: false},
    identity: {organizationId: state.organizationId, campaignId: state.campaignId, campaignDigest: state.campaignDigest, missionId: state.missionId},
    topology: {roles: summary.roles, tasks: summary.tasks, skillLocks: summary.skillLocks, leaderOrchestrationOnly: true, independentAuditor: true},
    revisionsAndAudit: {revisions: summary.revisions, audits: summary.audits, activePassRevisions: summary.activePassRevisions, deniedRevisionId: summary.deniedRevisionId, correctedRevisionId: summary.correctedRevisionId, fault: {outcome: failedAudit.outcome, status: failedAudit.status, issueCode: issue.code, nextResponsibleRoleId: issue.nextResponsibleRoleId, evidenceRefCount: issue.evidenceRefIds.length}, deniedReview: state.deniedReview},
    ownerReview: {state: summary.state, count: summary.reviews, authority: 'NON_EXECUTABLE_OWNER_REVIEW', createsActionGrant: false},
    noAction: {externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0},
    replay: {ledgerHeadPresent: typeof publicEvidence.body.evidence.ledgerHead === 'string', traceEventCount: Array.isArray(opened.body.mission.trace) ? opened.body.mission.trace.length : 0},
    urls: demoUrls()
  };
  assertPublicSafeEvidence(evidence);
  await writeJsonAtomic(missionEvidencePath, evidence);
  const browserPath = path.join(DEMO_CONFIG.evidenceRoot, 'browser-smoke.json');
  const browser = await optionalJson(browserPath);
  if (browser !== undefined) assertPublicSafeEvidence(browser);
  const manifest = {
    schemaVersion: DEMO_CONFIG.schemaVersion,
    status: 'PASS',
    generatedAt: new Date().toISOString(),
    source,
    project: DEMO_CONFIG.project,
    ports: {web: DEMO_CONFIG.webPort, api: DEMO_CONFIG.apiPort, loopbackOnly: true},
    preflight: preflightResult ?? {status: 'PASS', reusedFromPreparation: true},
    scenario: {prepared: true, completed: summary.reviews === 4, auditorFailClosed: state.deniedReview},
    maturity: {dataMode: 'DEMO_SEED', provider: DEMO_CONFIG.providerMode, evidence: DEMO_CONFIG.providerMaturity, realAgentTeamsClaim: false},
    noAction: evidence.noAction,
    files: {
      missionEvidence: `${DEMO_CONFIG.evidenceDisplayRoot}/mission-evidence.json`,
      missionEvidenceSha256: await sha256File(missionEvidencePath),
      browserEvidence: browser === undefined ? null : `${DEMO_CONFIG.evidenceDisplayRoot}/browser-smoke.json`,
      browserEvidenceSha256: browser === undefined ? null : await sha256File(browserPath),
      screenshots: browser?.screenshots ?? []
    },
    urls: demoUrls(),
    commands: {prepare: 'npm run demo', complete: 'npm run demo:complete', smoke: 'npm run demo:smoke', export: 'npm run demo:evidence', reset: 'npm run demo:reset'}
  };
  assertPublicSafeEvidence(manifest);
  await writeJsonAtomic(manifestPath, manifest);
  return {status: 'PASS', command: 'export', state: summary.state, evidence: {manifest: `${DEMO_CONFIG.evidenceDisplayRoot}/demo-manifest.json`, mission: `${DEMO_CONFIG.evidenceDisplayRoot}/mission-evidence.json`, browser: manifest.files.browserEvidence}};
}

async function statusDemo() {
  const state = await readState();
  const opened = await request(`/api/v1/shadow-missions/${state.missionId}`, {headers: organizationHeaders(state.organizationId)}, 200);
  const phase = opened.body.mission.reviews.length === 4 ? 'COMPLETED' : 'PREPARED';
  return {status: 'PASS', command: 'status', ...validatePreparedMission(opened.body.mission, phase), urls: demoUrls()};
}

async function preflight(checkPorts) {
  assertExactDemoTargets(DEMO_CONFIG.root, DEMO_CONFIG.project, DEMO_CONFIG.evidenceRoot);
  const packageDocument = JSON.parse(await readFile(path.join(DEMO_CONFIG.root, 'package.json'), 'utf8'));
  if (packageDocument.name !== 'lumiclaw-presence') throw new InitialDemoError('INITIAL_DEMO_REPOSITORY_INVALID');
  const nodeVersion = exec(process.execPath, ['--version']).replace(/^v/u, '');
  const npmVersion = exec('npm', ['--version']);
  if (nodeVersion !== packageDocument.engines.node) throw new InitialDemoError('INITIAL_DEMO_NODE_VERSION_MISMATCH');
  if (npmVersion !== packageDocument.engines.npm) throw new InitialDemoError('INITIAL_DEMO_NPM_VERSION_MISMATCH');
  exec('docker', ['info', '--format', '{{.ServerVersion}}']);
  const dockerVersion = exec('docker', ['--version']);
  const composeVersion = exec('docker', ['compose', 'version']);
  compose(['config', '--quiet']);
  try { await access(DEMO_CONFIG.chromePath); } catch { throw new InitialDemoError('INITIAL_DEMO_CHROME_UNAVAILABLE'); }
  if (checkPorts) {
    await assertPortAvailable(DEMO_CONFIG.webPort);
    await assertPortAvailable(DEMO_CONFIG.apiPort);
  }
  const result = {status: 'PASS', command: 'preflight', source: sourceIdentity(), node: nodeVersion, npm: npmVersion, docker: dockerVersion, compose: composeVersion, chrome: 'AVAILABLE', ports: checkPorts ? 'AVAILABLE' : 'CHECK_DEFERRED_UNTIL_RESET', project: DEMO_CONFIG.project, maturity: DEMO_CONFIG.providerMaturity, realAgentTeamsClaim: false};
  assertPublicSafeEvidence(result);
  return result;
}

async function resetDemo() {
  activeStep = 'RESET';
  assertExactDemoTargets(DEMO_CONFIG.root, DEMO_CONFIG.project, DEMO_CONFIG.evidenceRoot);
  compose(['down', '--volumes', '--remove-orphans']);
  await rm(DEMO_CONFIG.evidenceRoot, {recursive: true, force: true});
  return {status: 'PASS', command: 'reset', project: DEMO_CONFIG.project, removedVolumes: true, evidenceReset: DEMO_CONFIG.evidenceDisplayRoot, scope: 'EXACT_PROJECT_ONLY'};
}

function stopDemo() {
  activeStep = 'STOP';
  assertExactDemoTargets(DEMO_CONFIG.root, DEMO_CONFIG.project, DEMO_CONFIG.evidenceRoot);
  compose(['down']);
  return {status: 'PASS', command: 'stop', project: DEMO_CONFIG.project, volumesRemoved: false, evidenceRemoved: false};
}

function compose(args, stdio = 'pipe') {
  const environment = {...process.env, LUMICLAW_WEB_PORT: String(DEMO_CONFIG.webPort), LUMICLAW_API_PORT: String(DEMO_CONFIG.apiPort)};
  try {
    return execFileSync('docker', ['compose', '--project-name', DEMO_CONFIG.project, ...args], {cwd: DEMO_CONFIG.root, env: environment, encoding: 'utf8', stdio: stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'pipe'], timeout: 900_000});
  } catch { throw new InitialDemoError('INITIAL_DEMO_COMPOSE_COMMAND_FAILED'); }
}

async function request(route, init, expected) {
  let response;
  try { response = await fetch(`${DEMO_CONFIG.apiBase}${route}`, init); }
  catch { throw new InitialDemoError('INITIAL_DEMO_CONTROL_PLANE_UNAVAILABLE'); }
  let body;
  try { body = await response.json(); }
  catch { throw new InitialDemoError('INITIAL_DEMO_CONTROL_PLANE_RESPONSE_INVALID'); }
  if (response.status !== expected) throw new InitialDemoError('INITIAL_DEMO_CONTROL_PLANE_STATUS_INVALID');
  return {body, status: response.status, etag: response.headers.get('etag')};
}

async function waitForApi() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${DEMO_CONFIG.apiBase}/health`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new InitialDemoError('INITIAL_DEMO_CONTROL_PLANE_UNAVAILABLE');
}

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => reject(new InitialDemoError('INITIAL_DEMO_PORT_OCCUPIED', port)));
    server.listen({host: '127.0.0.1', port}, () => server.close(resolve));
  });
}

function sourceIdentity() {
  return {head: exec('git', ['rev-parse', 'HEAD']), dirty: exec('git', ['status', '--short']).length > 0};
}

function exec(file, args) {
  try { return execFileSync(file, args, {cwd: DEMO_CONFIG.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000}).trim(); }
  catch { throw new InitialDemoError('INITIAL_DEMO_PREFLIGHT_COMMAND_FAILED'); }
}

async function readState() {
  try {
    const value = JSON.parse(await readFile(statePath, 'utf8'));
    assertPublicSafeEvidence(value);
    return value;
  } catch (error) {
    if (error instanceof InitialDemoError) throw error;
    throw new InitialDemoError('INITIAL_DEMO_STATE_UNAVAILABLE');
  }
}

async function optionalJson(target) {
  try { return JSON.parse(await readFile(target, 'utf8')); }
  catch { return undefined; }
}

async function writeJsonAtomic(target, value) {
  assertPublicSafeEvidence(value);
  await mkdir(path.dirname(target), {recursive: true});
  const temporary = `${target}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  await rename(temporary, target);
}

async function sha256File(target) {
  return createHash('sha256').update(await readFile(target)).digest('hex');
}

async function writeFailureReceipt(code) {
  try {
    const receipt = {schemaVersion: DEMO_CONFIG.schemaVersion, status: 'FAIL', code, step: activeStep, generatedAt: new Date().toISOString(), source: sourceIdentity(), project: DEMO_CONFIG.project, maturity: DEMO_CONFIG.providerMaturity, realAgentTeamsClaim: false, externalActionAllowed: false};
    assertPublicSafeEvidence(receipt);
    await writeJsonAtomic(path.join(DEMO_CONFIG.evidenceRoot, 'failure.json'), receipt);
  } catch {}
}

function organizationHeaders(organizationId) {
  return {'x-lumiclaw-organization-id': organizationId};
}

function demoUrls() {
  return {missionZh: `${DEMO_CONFIG.webBase}/mission`, reviewZh: `${DEMO_CONFIG.webBase}/review`, missionEn: `${DEMO_CONFIG.webBase}/en/mission`, reviewEn: `${DEMO_CONFIG.webBase}/en/review`};
}
