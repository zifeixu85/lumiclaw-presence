import {createHash} from 'node:crypto';
import {execFileSync, spawn, spawnSync} from 'node:child_process';
import {readFileSync, writeSync} from 'node:fs';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createLiveFailureEnvelope, createLiveFailureReceipt, defaultLiveProgress, isLiveStage, LiveUatDiagnosticError, parseLiveFailureEnvelope, readLiveFailureReceipt, readSourceIdentity, updateLiveFailureCleanup, writeLiveFailureReceipt} from './live-uat-diagnostics.mjs';
import {isLiveTaskProtocolOutcome} from './live-agentteams-task-protocol.mjs';
import {isRedactedTransportReceipt, LiveUatTransportError, parseLiveUatTransport, serializeLiveUatTransport} from './live-uat-transport.mjs';

const root = process.cwd();
const expectedSourceDigest = 'a4a9d66fabc49e1d08246d9b8b65d2b67742b71b2b43d3dfc0d27e8861f0770c';
const sourceUrl = 'https://codeload.github.com/agentscope-ai/AgentTeams/tar.gz/refs/tags/v1.2.0';
const dataVolume = 'lumiclaw-sdd002-agentteams-data';
const teamName = 'sdd002-governed-shadow';
const leader = 'presence-mission-leader';
const roles = [leader, 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'];
const runtimeContainerNames = new Set(['agentteams-controller', 'agentteams-manager', 'agentteams-dashboard', 'agentteams-docker-proxy']);
const lifecycle = [];
const liveUat = process.argv.includes('--live-deepseek-uat');
const transportConformance = process.argv.includes('--live-stdin-transport-conformance');
const diagnosticStageConformance = process.argv.find((value) => value.startsWith('--live-stage-diagnostic-conformance='))?.split('=', 2)[1];
const diagnosticProviderOutcomeConformance = process.argv.find((value) => value.startsWith('--live-provider-outcome-diagnostic-conformance='))?.split('=', 2)[1];
const diagnosticTaskProtocolOutcomeConformance = process.argv.find((value) => value.startsWith('--live-task-protocol-outcome-diagnostic-conformance='))?.split('=', 2)[1];
const runtimeModel = liveUat ? 'lumiclaw-deepseek-broker-v1' : 'mock-agentteams-conformance';
let temporaryRoot;
let provider;
let completed = false;
let liveRunnerInput;
let liveRunnerReceipt;
let liveFailureCode;
let liveFailureEnvelope;
let runtimeOwnershipStarted = false;

function stableError(code) { const error = new Error(code); error.code = code; return error; }
function emitStableFailure(code) { writeSync(2, `${JSON.stringify({status: 'FAIL', code})}\n`); }
function emitDiagnosticFailure(envelope) { writeSync(2, `${JSON.stringify(envelope)}\n`); }
function childOutput(result) { return {stdout: typeof result.stdout === 'string' ? result.stdout : '', stderr: typeof result.stderr === 'string' ? result.stderr : ''}; }
function containsSensitiveOutput(stdout, stderr, bootstrap) {
  const output = `${stdout}${stderr}`;
  return output.includes(bootstrap) || /x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|\bbearer\b/iu.test(output);
}
async function readCanonicalLiveRunnerInput() {
  const parsed = parseLiveUatTransport(readFileSync(0, 'utf8'));
  return {parsed, serialized: serializeLiveUatTransport(parsed)};
}
async function spawnLiveRunner(serialized, parsed, options = {}) {
  const transportOnly = options.transportConformance === true; const diagnosticStage = options.diagnosticStage; const diagnosticProviderOutcome = options.diagnosticProviderOutcome; const diagnosticTaskProtocolOutcome = options.diagnosticTaskProtocolOutcome;
  const diagnostic = diagnosticStage !== undefined || diagnosticProviderOutcome !== undefined || diagnosticTaskProtocolOutcome !== undefined;
  const result = spawnSync(process.execPath, ['scripts/run-live-deepseek-uat.mjs', ...(transportOnly ? ['--transport-conformance'] : []), ...(diagnosticStage === undefined ? [] : [`--diagnostic-stage-conformance=${diagnosticStage}`]), ...(diagnosticProviderOutcome === undefined ? [] : [`--provider-outcome-diagnostic-conformance=${diagnosticProviderOutcome}`]), ...(diagnosticTaskProtocolOutcome === undefined ? [] : [`--task-protocol-outcome-diagnostic-conformance=${diagnosticTaskProtocolOutcome}`])], {
    cwd: root, input: serialized, encoding: 'utf8', timeout: transportOnly || diagnostic ? 10_000 : 1_200_000, stdio: ['pipe', 'pipe', 'pipe'],
    env: diagnostic ? {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: process.env.LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH} : process.env
  });
  const {stdout, stderr} = childOutput(result);
  if (containsSensitiveOutput(stdout, stderr, parsed.bootstrap)) throw stableError('LIVE_UAT_TRANSPORT_DISCLOSURE_BLOCKED');
  if (result.status !== 0) {
    let envelope;
    try {
      envelope = parseLiveFailureEnvelope(stderr, {missionId: parsed.missionId});
      await readLiveFailureReceipt(root, {organizationId: parsed.organizationId, missionId: parsed.missionId, campaignDigest: parsed.campaignDigest, stage: envelope.stage, code: envelope.code, providerOutcomeCode: envelope.providerOutcomeCode, taskProtocolOutcomeCode: envelope.taskProtocolOutcomeCode}, {targetPath: diagnostic ? process.env.LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH : undefined});
    } catch { throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID'); }
    throw new LiveUatDiagnosticError(envelope);
  }
  let receipt;
  try { receipt = JSON.parse(stdout); } catch { throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID'); }
  if (transportOnly && !isRedactedTransportReceipt(receipt)) throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID');
  if (!transportOnly && (receipt?.status !== 'PASS'
    || receipt?.maturity !== 'LIVE_PROVIDER_VERIFIED'
    || receipt?.missionId !== parsed.missionId
    || receipt?.state !== 'AWAITING_OWNER_REVIEW'
    || receipt?.modelReceipts !== 7
    || receipt?.ownerReviewRequired !== true
    || receipt?.externalActionCount !== 0
    || receipt?.evidence !== '.evidence/sdd-002/deepseek-live-canary.json')) throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID');
  return receipt;
}

function run(executable, args, options = {}) {
  const startedAt = new Date().toISOString();
  const label = options.label ?? executable;
  try {
    const output = execFileSync(executable, args, {cwd: root, encoding: 'utf8', timeout: options.timeout ?? 60_000, stdio: ['ignore', 'pipe', 'pipe'], env: options.env ?? process.env});
    lifecycle.push({step: label, startedAt, status: 'PASS'});
    return output.trim();
  } catch (error) {
    lifecycle.push({step: label, startedAt, status: 'FAIL'});
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
    const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout).trim() : '';
    throw new Error(`${label}:FAILED:${stderr || stdout || (error instanceof Error ? error.message : 'unknown failure')}`);
  }
}

function listContainers() {
  return run('docker', ['ps', '-a', '--format', '{{.Names}}'], {label: 'preflight-list-containers'}).split('\n').filter(Boolean);
}

function ownedContainers() {
  return listContainers().filter((name) => runtimeContainerNames.has(name) || name.startsWith('agentteams-worker-'));
}

function volumeExists() {
  return run('docker', ['volume', 'ls', '--format', '{{.Name}}'], {label: 'preflight-list-volumes'}).split('\n').includes(dataVolume);
}

function portInUse(port) {
  try { return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim().length > 0; }
  catch { return false; }
}

async function waitForProvider() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { if ((await fetch('http://127.0.0.1:28333/health')).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('PUBLIC_SAFE_PROVIDER_NOT_READY');
}

function agt(args, label, timeout = 120_000) {
  return run('docker', ['exec', 'agentteams-controller', 'agt', ...args], {label, timeout});
}

function agtJson(resource) {
  return JSON.parse(agt(['get', resource, '-o', 'json'], `wait-${resource}`, 30_000));
}

async function waitForTopology() {
  // A cold six-worker CoPaw bootstrap can exceed five minutes while Matrix
  // serially provisions rooms. The acceptance still fails closed at ten.
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    try {
      const workers = agtJson('workers'); const teams = agtJson('teams');
      const exactWorkers = workers.workers.filter((worker) => roles.includes(worker.name));
      const team = teams.teams.find((candidate) => candidate.name === teamName);
      if (workers.total === 6 && exactWorkers.length === 6 && exactWorkers.every((worker) => worker.phase === 'Running' && worker.runtime === 'copaw' && worker.model === runtimeModel && worker.matrixUserID) && team?.phase === 'Active' && team.leaderReady === true && team.readyWorkers === 5 && team.totalWorkers === 5) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('AGENTTEAMS_EXACT_TOPOLOGY_NOT_READY');
}

function cleanupRuntime() {
  const containers = ownedContainers();
  if (containers.length > 0) run('docker', ['rm', '--force', ...containers], {label: 'cleanup-exact-runtime-containers', timeout: 300_000});
  if (volumeExists()) run('docker', ['volume', 'rm', dataVolume], {label: 'cleanup-exact-runtime-volume', timeout: 30_000});
  const remaining = ownedContainers();
  if (remaining.length > 0 || volumeExists()) throw new Error('AGENTTEAMS_EPHEMERAL_CLEANUP_INCOMPLETE');
}

if (transportConformance) {
  try {
    const input = await readCanonicalLiveRunnerInput();
    const receipt = await spawnLiveRunner(input.serialized, input.parsed, {transportConformance: true});
    writeSync(1, `${JSON.stringify(receipt)}\n`);
  } catch (error) {
    emitStableFailure(error instanceof LiveUatTransportError ? error.code : 'LIVE_UAT_TRANSPORT_FAILED');
    process.exitCode = 1;
  }
} else if (diagnosticStageConformance !== undefined || diagnosticProviderOutcomeConformance !== undefined || diagnosticTaskProtocolOutcomeConformance !== undefined) {
  try {
    if (diagnosticStageConformance !== undefined && !isLiveStage(diagnosticStageConformance)) throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID');
    if (diagnosticTaskProtocolOutcomeConformance !== undefined && !isLiveTaskProtocolOutcome(diagnosticTaskProtocolOutcomeConformance)) throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID');
    const input = await readCanonicalLiveRunnerInput();
    await spawnLiveRunner(input.serialized, input.parsed, {diagnosticStage: diagnosticStageConformance, diagnosticProviderOutcome: diagnosticProviderOutcomeConformance, diagnosticTaskProtocolOutcome: diagnosticTaskProtocolOutcomeConformance});
    throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID');
  } catch (error) {
    if (error instanceof LiveUatDiagnosticError) emitDiagnosticFailure(error.envelope);
    else emitStableFailure(error instanceof LiveUatTransportError ? error.code : (typeof error?.code === 'string' ? error.code : 'LIVE_UAT_TRANSPORT_FAILED'));
    process.exitCode = 1;
  }
} else try {
  if (liveUat) liveRunnerInput = await readCanonicalLiveRunnerInput();
  const preexisting = ownedContainers();
  if (preexisting.length > 0) throw new Error(`AGENTTEAMS_GLOBAL_CONTAINER_NAMES_IN_USE:${preexisting.join(',')}`);
  if (volumeExists()) throw new Error(`AGENTTEAMS_EPHEMERAL_VOLUME_ALREADY_EXISTS:${dataVolume}`);
  for (const port of [18080, 18001, 18088, 18888, 28333]) if (portInUse(port)) throw new Error(`AGENTTEAMS_ACCEPTANCE_PORT_IN_USE:${port}`);
  lifecycle.push({step: 'preflight-exclusive-runtime-names-ports-volume', startedAt: new Date().toISOString(), status: 'PASS'});
  runtimeOwnershipStarted = true;

  temporaryRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-sdd002-agentteams.'));
  const archive = path.join(temporaryRoot, 'agentteams-v1.2.0.tar.gz');
  run('curl', ['--connect-timeout', '10', '--max-time', '180', '--fail', '--silent', '--show-error', '--location', '--retry', '3', '--output', archive, sourceUrl], {label: 'download-official-agentteams-v1.2.0', timeout: 240_000});
  const sourceDigest = createHash('sha256').update(await readFile(archive)).digest('hex');
  if (sourceDigest !== expectedSourceDigest) throw new Error('AGENTTEAMS_SOURCE_TARBALL_DIGEST_MISMATCH');
  run('tar', ['-xzf', archive, '-C', temporaryRoot], {label: 'extract-verified-agentteams-source'});
  const workspace = path.join(temporaryRoot, 'manager-workspace'); const hostShare = path.join(temporaryRoot, 'host-share');
  await Promise.all([mkdir(workspace, {recursive: true}), mkdir(hostShare, {recursive: true})]);

  provider = spawn(process.execPath, ['scripts/agentteams-public-safe-mock-provider.mjs'], {cwd: root, stdio: 'ignore', env: {...process.env, PORT: '28333', MODEL_NAME: runtimeModel}});
  await waitForProvider(); lifecycle.push({step: 'start-public-safe-model-provider', startedAt: new Date().toISOString(), status: 'PASS'});
  const manifest = JSON.parse(await readFile(path.join(root, 'infra/agentteams/image-manifest.json'), 'utf8'));
  const imageByComponent = new Map(manifest.images.map((image) => [image.component, `${image.repository}:${image.tag}`]));
  const installerEnvironment = {
    ...process.env,
    AGENTTEAMS_NON_INTERACTIVE: '1', AGENTTEAMS_LANGUAGE: 'en', AGENTTEAMS_VERSION: 'v1.2.0',
    AGENTTEAMS_REGISTRY: 'higress-registry.cn-hangzhou.cr.aliyuncs.com',
    AGENTTEAMS_INSTALL_EMBEDDED_IMAGE: imageByComponent.get('embedded-controller'),
    AGENTTEAMS_INSTALL_MANAGER_COPAW_IMAGE: imageByComponent.get('manager-copaw'),
    AGENTTEAMS_INSTALL_COPAW_WORKER_IMAGE: imageByComponent.get('worker'),
    AGENTTEAMS_LLM_PROVIDER: 'openai-compat', AGENTTEAMS_DEFAULT_MODEL: runtimeModel,
    AGENTTEAMS_OPENAI_BASE_URL: 'http://host.docker.internal:28333/v1', AGENTTEAMS_LLM_API_KEY: 'public-safe-mock-not-a-secret', AGENTTEAMS_EMBEDDING_MODEL: '',
    AGENTTEAMS_ADMIN_USER: 'public-safe-admin', AGENTTEAMS_ADMIN_PASSWORD: 'public-safe-local-admin-v1',
    AGENTTEAMS_LOCAL_ONLY: '1', AGENTTEAMS_PORT_GATEWAY: '18080', AGENTTEAMS_PORT_CONSOLE: '18001', AGENTTEAMS_PORT_ELEMENT_WEB: '18088', AGENTTEAMS_PORT_MANAGER_CONSOLE: '18888',
    AGENTTEAMS_MATRIX_DOMAIN: 'matrix-local.agentteams.io:18080', AGENTTEAMS_MANAGER_RUNTIME: 'copaw', AGENTTEAMS_DEFAULT_WORKER_RUNTIME: 'copaw',
    AGENTTEAMS_MATRIX_E2EE: '0', AGENTTEAMS_DASHBOARD: '0', AGENTTEAMS_MOUNT_SOCKET: '1', AGENTTEAMS_DOCKER_PROXY: '0', AGENTTEAMS_WORKER_IDLE_TIMEOUT: '60',
    AGENTTEAMS_DATA_DIR: dataVolume, AGENTTEAMS_WORKSPACE_DIR: workspace, AGENTTEAMS_HOST_SHARE_DIR: hostShare,
    AGENTTEAMS_ENV_FILE: path.join(temporaryRoot, 'agentteams-manager.env')
  };
  run('bash', [path.join(temporaryRoot, 'AgentTeams-1.2.0/install/agentteams-install.sh'), 'manager'], {label: 'official-agentteams-v1.2.0-installer', timeout: 600_000, env: installerEnvironment});

  for (const role of roles) agt(['create', 'worker', '--name', role, '--runtime', 'copaw', '--model', runtimeModel, '--no-wait'], `create-worker-${role}`);
  agt(['create', 'team', '--name', teamName, '--leader-name', leader, '--workers', roles.slice(1).join(',')], 'create-exact-six-member-team');
  await waitForTopology(); lifecycle.push({step: 'wait-exact-six-member-team', startedAt: new Date().toISOString(), status: 'PASS'});

  if (liveUat) {
    if (liveRunnerInput === undefined) throw stableError('LIVE_UAT_TRANSPORT_INVALID');
    liveRunnerReceipt = await spawnLiveRunner(liveRunnerInput.serialized, liveRunnerInput.parsed);
    lifecycle.push({step: 'run-live-deepseek-exact-mission', startedAt: new Date().toISOString(), status: 'PASS'});
  } else run(process.execPath, ['scripts/verify-agentteams-real-runtime.mjs'], {label: 'verify-real-agentteams-causal-runtime', timeout: 900_000});
  cleanupRuntime();
  runtimeOwnershipStarted = false;
  provider.kill('SIGTERM'); provider = undefined;
  const evidencePath = path.join(root, liveUat ? '.evidence/sdd-002/deepseek-live-canary.json' : '.evidence/sdd-002/agentteams-real-runtime.json');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  evidence.environmentLifecycle = {status: 'PASS', selfProvisioned: true, officialInstaller: true, sourceTarSha256: sourceDigest, exactRuntimeObjectsRemoved: true, sharedAgentTeamsNetworkPreserved: true, ephemeralCredentialsRemoved: true, steps: lifecycle};
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  completed = true;
  console.info(JSON.stringify({
    status: 'PASS',
    selfProvisioned: true,
    realAgentTeamsAcceptance: true,
    realModelAcceptance: liveUat,
    memberCount: 6,
    taskCount: 8,
    ...(liveUat ? {
      maturity: liveRunnerReceipt.maturity,
      missionId: liveRunnerReceipt.missionId,
      state: liveRunnerReceipt.state,
      modelReceipts: liveRunnerReceipt.modelReceipts,
      ownerReviewRequired: liveRunnerReceipt.ownerReviewRequired,
      externalActionCount: liveRunnerReceipt.externalActionCount
    } : {}),
    cleanup: 'PASS',
    evidence: liveUat ? '.evidence/sdd-002/deepseek-live-canary.json' : '.evidence/sdd-002/agentteams-real-runtime.json'
  }));
} catch (error) {
  if (liveUat) {
    if (error instanceof LiveUatDiagnosticError) liveFailureEnvelope = error.envelope;
    else {
      liveFailureCode = error instanceof LiveUatTransportError ? error.code : (typeof error?.code === 'string' ? error.code : 'LIVE_AGENTTEAMS_ENVIRONMENT_FAILED');
      if (liveRunnerInput !== undefined && liveFailureCode === 'LIVE_AGENTTEAMS_ENVIRONMENT_FAILED') {
        try {
          const receipt = createLiveFailureReceipt({source: readSourceIdentity(root), ...liveRunnerInput.parsed, stage: 'AGENTTEAMS_PROVISION', progress: defaultLiveProgress()});
          await writeLiveFailureReceipt(root, receipt); liveFailureEnvelope = createLiveFailureEnvelope(receipt); liveFailureCode = undefined;
        } catch { liveFailureCode = 'LIVE_FAILURE_RECEIPT_WRITE_FAILED'; }
      }
    }
    process.exitCode = 1;
  } else throw error;
} finally {
  if (provider !== undefined) provider.kill('SIGTERM');
  if (!completed && runtimeOwnershipStarted) {
    try { cleanupRuntime(); runtimeOwnershipStarted = false; }
    catch { if (liveUat) { liveFailureCode = 'LIVE_UAT_CLEANUP_FAILED'; liveFailureEnvelope = undefined; } }
  }
  if (temporaryRoot !== undefined) {
    try { await rm(temporaryRoot, {recursive: true, force: true}); }
    catch (error) { if (liveUat) { liveFailureCode = 'LIVE_UAT_CLEANUP_FAILED'; process.exitCode = 1; } else throw error; }
  }
  if (liveUat && liveFailureEnvelope !== undefined && liveFailureCode === undefined) {
    try {
      await updateLiveFailureCleanup(root, {agentTeams: 'PASS'}, {missionId: liveFailureEnvelope.missionId, stage: liveFailureEnvelope.stage, code: liveFailureEnvelope.code});
    } catch { liveFailureCode = 'LIVE_FAILURE_RECEIPT_WRITE_FAILED'; liveFailureEnvelope = undefined; process.exitCode = 1; }
  }
}
if (liveUat && liveFailureEnvelope !== undefined) emitDiagnosticFailure(liveFailureEnvelope);
else if (liveUat && liveFailureCode !== undefined) emitStableFailure(liveFailureCode);
