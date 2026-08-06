import {randomBytes} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {access, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {LIVE_FAILURE_EVIDENCE_RELATIVE_PATH, parseLiveFailureEnvelope, readLiveFailureReceipt, updateLiveFailureCleanup} from './live-uat-diagnostics.mjs';
import {serializeLiveUatTransport} from './live-uat-transport.mjs';

const root = process.cwd();
const project = 'lumiclaw-sdd002-live-no-secret-diagnostic';
const apiPort = '4131'; const webPort = '3131';
const composeFiles = ['-f', 'compose.yml', '-f', 'compose.live-deepseek-uat.yml'];
let secretRoot; let composeStarted = false; let envelope; let receipt; let missionAfterFailure; let cleanup = {agentTeams: false, controlPlane: false, secretDirectory: false};

function run(executable, args, environment = process.env, timeout = 900_000) { return execFileSync(executable, args, {cwd: root, env: environment, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe']}).trim(); }
async function request(api, pathname, init, expected = 200) {
  const response = await fetch(`${api}${pathname}`, init); const body = await response.json();
  if (response.status !== expected) throw new Error('LIVE_NO_SECRET_CONTROL_PLANE_RESPONSE_INVALID');
  return {body, etag: response.headers.get('etag')};
}
async function waitForApi(api) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) { try { if ((await fetch(`${api}/health`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 500)); }
  throw new Error('LIVE_NO_SECRET_CONTROL_PLANE_NOT_READY');
}
function infrastructureNames() {
  return [
    ...run('docker', ['ps', '-a', '--format', '{{.Names}}']).split('\n'),
    ...run('docker', ['volume', 'ls', '--format', '{{.Name}}']).split('\n'),
    ...run('docker', ['network', 'ls', '--format', '{{.Name}}']).split('\n')
  ].filter(Boolean);
}
function exactProjectRemoved() { return infrastructureNames().every((name) => !name.startsWith(`${project}-`) && !name.startsWith(`${project}_`)); }
function agentTeamsRemoved() {
  const exact = new Set(['agentteams-controller', 'agentteams-manager', 'agentteams-dashboard', 'agentteams-docker-proxy']);
  return infrastructureNames().every((name) => !exact.has(name) && !name.startsWith('agentteams-worker-') && name !== 'lumiclaw-sdd002-agentteams-data');
}

const bootstrap = randomBytes(32).toString('base64url');
try {
  if (!agentTeamsRemoved()) throw new Error('LIVE_NO_SECRET_AGENTTEAMS_NAMES_IN_USE');
  secretRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-live-no-secret.'));
  const unavailableKeyFile = path.join(secretRoot, 'deepseek-unavailable'); const bootstrapFile = path.join(secretRoot, 'bootstrap');
  await writeFile(unavailableKeyFile, 'unavailable\n', {mode: 0o600}); await writeFile(bootstrapFile, bootstrap, {mode: 0o600});
  const environment = {...process.env, LUMICLAW_DEEPSEEK_SECRET_FILE: unavailableKeyFile, LUMICLAW_RUNTIME_BOOTSTRAP_FILE: bootstrapFile, LUMICLAW_API_PORT: apiPort, LUMICLAW_WEB_PORT: webPort};
  const compose = (...args) => run('docker', ['compose', ...composeFiles, '--project-name', project, ...args], environment);
  try { compose('down', '--volumes', '--remove-orphans'); } catch {}
  composeStarted = true; compose('up', '--build', '--detach', 'api');
  const api = `http://127.0.0.1:${apiPort}`; await waitForApi(api);
  const inspection = JSON.parse(run('docker', ['inspect', `${project}-api-1`]))[0];
  if (inspection.Config.Env.some((entry) => entry.includes(bootstrap)) || inspection.Mounts.some((mount) => mount.Source === '/var/run/docker.sock' || mount.Destination === '/var/run/docker.sock')) throw new Error('LIVE_NO_SECRET_INSPECT_BOUNDARY_FAILED');

  const template = await request(api, '/api/v1/campaigns/demo-template'); const campaign = template.body.document; const headers = {'x-lumiclaw-organization-id': campaign.organizationId};
  const created = await request(api, '/api/v1/campaigns', {method: 'POST', headers: {...headers, 'content-type': 'application/json', 'idempotency-key': 'live-no-secret-campaign'}, body: JSON.stringify(campaign)}, 201);
  const started = await request(api, `/api/v1/campaigns/${campaign.id}/shadow-missions`, {method: 'POST', headers: {...headers, 'content-type': 'application/json', 'idempotency-key': 'live-no-secret-mission', 'if-match': created.etag}, body: JSON.stringify({sourceDigest: created.body.digest, fault: 'BETA_TO_GA', providerMode: 'LIVE_DEEPSEEK_UAT', providerModel: 'deepseek-v4-flash'})}, 201);
  const mission = started.body.mission; const input = serializeLiveUatTransport({organizationId: campaign.organizationId, missionId: mission.id, campaignDigest: created.body.digest, bootstrap});
  const child = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', '--live-deepseek-uat'], {cwd: root, env: {...process.env, LUMICLAW_LIVE_API_URL: api}, input, encoding: 'utf8', timeout: 1_800_000, stdio: ['pipe', 'pipe', 'pipe']});
  const output = `${child.stdout}${child.stderr}`;
  if (child.status === 0 || child.stdout !== '' || output.includes(bootstrap) || /x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|\bbearer\b/iu.test(output)) throw new Error('LIVE_NO_SECRET_CHILD_BOUNDARY_INVALID');
  envelope = parseLiveFailureEnvelope(child.stderr, {missionId: mission.id});
  receipt = await readLiveFailureReceipt(root, {organizationId: campaign.organizationId, missionId: mission.id, campaignDigest: created.body.digest, stage: envelope.stage, code: envelope.code, providerOutcomeCode: 'DEEPSEEK_SECRET_FILE_UNAVAILABLE'});
  if (envelope.stage !== 'PROVIDER_REQUEST' || envelope.code !== 'LIVE_PROVIDER_REQUEST_FAILED' || envelope.providerOutcomeCode !== 'DEEPSEEK_SECRET_FILE_UNAVAILABLE' || !receipt.progress.projectCreated || !receipt.progress.dagPlanned || !receipt.progress.memberBindingsResolved || !receipt.progress.projectDispatched || !receipt.progress.providerBrokerRequestStarted || receipt.modelReceiptCount !== 0 || receipt.cleanup.agentTeams !== 'PASS') throw new Error('LIVE_NO_SECRET_EXPECTED_PROVIDER_BOUNDARY_NOT_REACHED');
  cleanup.agentTeams = agentTeamsRemoved(); if (!cleanup.agentTeams) throw new Error('LIVE_NO_SECRET_AGENTTEAMS_CLEANUP_FAILED');
  missionAfterFailure = (await request(api, `/api/v1/shadow-missions/${mission.id}`, {headers})).body.mission;
  if (missionAfterFailure.state !== 'FAILED' || missionAfterFailure.runtimeStatus.failure?.code !== 'DEEPSEEK_SECRET_FILE_UNAVAILABLE' || missionAfterFailure.modelCalls.length !== 0 || missionAfterFailure.actionGrantCount !== 0 || missionAfterFailure.connectorCount !== 0 || missionAfterFailure.externalActionCount !== 0) throw new Error('LIVE_NO_SECRET_FAILED_MISSION_STATE_INVALID');

  compose('down', '--volumes', '--remove-orphans'); composeStarted = false; cleanup.controlPlane = exactProjectRemoved();
  await rm(secretRoot, {recursive: true, force: true});
  try { await access(secretRoot); } catch { cleanup.secretDirectory = true; }
  secretRoot = undefined;
  if (!cleanup.controlPlane || !cleanup.secretDirectory) throw new Error('LIVE_NO_SECRET_OWNED_CLEANUP_FAILED');
  receipt = await updateLiveFailureCleanup(root, {controlPlane: 'PASS', secretDirectory: 'PASS'}, {missionId: envelope.missionId, stage: envelope.stage, code: envelope.code});

  const evidence = {
    schemaVersion: 1, status: 'PASS', maturity: 'ENGINEERING_VERIFIED_NO_OWNER_SECRET', generatedAt: new Date().toISOString(),
    source: receipt.source, missionId: receipt.missionId, campaignDigest: receipt.campaignDigest,
    runtime: {...receipt.runtime, exactMemberCount: 6, exactTaskCount: 8},
    diagnosedBoundary: {stage: receipt.stage, code: receipt.code, providerOutcomeCode: receipt.providerOutcomeCode, progress: receipt.progress, modelReceiptCount: 0, ownerSecretPresent: false, externalProviderRequestOccurred: false, liveProviderVerified: false, mockFallback: false},
    networkBoundary: {hostApiLoopback: true, workerBrokerOrigin: 'host.docker.internal', arbitraryRemoteBrokerAllowed: false},
    persistedMission: {state: missionAfterFailure.state, failureCode: missionAfterFailure.runtimeStatus.failure.code, externalActionCount: missionAfterFailure.externalActionCount},
    noAction: receipt.noAction, nonDisclosure: {bootstrapFinding: false, ticketFinding: false, authorizationFinding: false, rawProviderResponseFinding: false},
    cleanup: {agentTeams: 'PASS', controlPlane: 'PASS', secretDirectory: 'PASS'}, failureReceipt: LIVE_FAILURE_EVIDENCE_RELATIVE_PATH
  };
  await mkdir(path.join(root, '.evidence/sdd-002'), {recursive: true}); await writeFile(path.join(root, '.evidence/sdd-002/live-agentteams-no-secret-diagnostic.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', maturity: evidence.maturity, stage: receipt.stage, code: receipt.code, providerOutcomeCode: receipt.providerOutcomeCode, projectCreated: true, dagPlanned: true, projectDispatched: true, modelReceipts: 0, liveProviderVerified: false, externalActionCount: 0, cleanup: 'PASS', evidence: '.evidence/sdd-002/live-agentteams-no-secret-diagnostic.json'}));
} finally {
  if (composeStarted && secretRoot !== undefined) {
    const environment = {...process.env, LUMICLAW_DEEPSEEK_SECRET_FILE: path.join(secretRoot, 'deepseek-unavailable'), LUMICLAW_RUNTIME_BOOTSTRAP_FILE: path.join(secretRoot, 'bootstrap'), LUMICLAW_API_PORT: apiPort, LUMICLAW_WEB_PORT: webPort};
    try { run('docker', ['compose', ...composeFiles, '--project-name', project, 'down', '--volumes', '--remove-orphans'], environment); } catch {}
  }
  if (secretRoot !== undefined) await rm(secretRoot, {recursive: true, force: true});
}
