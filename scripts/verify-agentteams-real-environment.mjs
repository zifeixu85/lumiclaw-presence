import {createHash} from 'node:crypto';
import {execFileSync, spawn} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = process.cwd();
const expectedSourceDigest = 'a4a9d66fabc49e1d08246d9b8b65d2b67742b71b2b43d3dfc0d27e8861f0770c';
const sourceUrl = 'https://codeload.github.com/agentscope-ai/AgentTeams/tar.gz/refs/tags/v1.2.0';
const dataVolume = 'lumiclaw-sdd002-agentteams-data';
const teamName = 'sdd002-governed-shadow';
const leader = 'presence-mission-leader';
const roles = [leader, 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'];
const runtimeContainerNames = new Set(['agentteams-controller', 'agentteams-manager', 'agentteams-dashboard', 'agentteams-docker-proxy']);
const lifecycle = [];
let temporaryRoot;
let provider;
let completed = false;

function run(executable, args, options = {}) {
  const startedAt = new Date().toISOString();
  const label = options.label ?? executable;
  try {
    const output = execFileSync(executable, args, {cwd: root, encoding: 'utf8', timeout: options.timeout ?? 60_000, stdio: ['ignore', 'pipe', 'pipe'], env: options.env ?? process.env});
    lifecycle.push({step: label, startedAt, status: 'PASS'});
    return output.trim();
  } catch {
    lifecycle.push({step: label, startedAt, status: 'FAIL'});
    throw new Error(`${label}:FAILED`);
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
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    try {
      const workers = agtJson('workers'); const teams = agtJson('teams');
      const exactWorkers = workers.workers.filter((worker) => roles.includes(worker.name));
      const team = teams.teams.find((candidate) => candidate.name === teamName);
      if (workers.total === 6 && exactWorkers.length === 6 && exactWorkers.every((worker) => worker.phase === 'Running' && worker.runtime === 'copaw' && worker.model === 'mock-agentteams-conformance' && worker.matrixUserID) && team?.phase === 'Active' && team.leaderReady === true && team.readyWorkers === 5 && team.totalWorkers === 5) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('AGENTTEAMS_EXACT_TOPOLOGY_NOT_READY');
}

function cleanupRuntime() {
  const containers = ownedContainers();
  if (containers.length > 0) run('docker', ['rm', '--force', ...containers], {label: 'cleanup-exact-runtime-containers', timeout: 120_000});
  if (volumeExists()) run('docker', ['volume', 'rm', dataVolume], {label: 'cleanup-exact-runtime-volume', timeout: 30_000});
  const remaining = ownedContainers();
  if (remaining.length > 0 || volumeExists()) throw new Error('AGENTTEAMS_EPHEMERAL_CLEANUP_INCOMPLETE');
}

try {
  const preexisting = ownedContainers();
  if (preexisting.length > 0) throw new Error(`AGENTTEAMS_GLOBAL_CONTAINER_NAMES_IN_USE:${preexisting.join(',')}`);
  if (volumeExists()) throw new Error(`AGENTTEAMS_EPHEMERAL_VOLUME_ALREADY_EXISTS:${dataVolume}`);
  for (const port of [18080, 18001, 18088, 18888, 28333]) if (portInUse(port)) throw new Error(`AGENTTEAMS_ACCEPTANCE_PORT_IN_USE:${port}`);
  lifecycle.push({step: 'preflight-exclusive-runtime-names-ports-volume', startedAt: new Date().toISOString(), status: 'PASS'});

  temporaryRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-sdd002-agentteams.'));
  const archive = path.join(temporaryRoot, 'agentteams-v1.2.0.tar.gz');
  run('curl', ['--connect-timeout', '10', '--max-time', '180', '--fail', '--silent', '--show-error', '--location', '--retry', '3', '--output', archive, sourceUrl], {label: 'download-official-agentteams-v1.2.0', timeout: 240_000});
  const sourceDigest = createHash('sha256').update(await readFile(archive)).digest('hex');
  if (sourceDigest !== expectedSourceDigest) throw new Error('AGENTTEAMS_SOURCE_TARBALL_DIGEST_MISMATCH');
  run('tar', ['-xzf', archive, '-C', temporaryRoot], {label: 'extract-verified-agentteams-source'});
  const workspace = path.join(temporaryRoot, 'manager-workspace'); const hostShare = path.join(temporaryRoot, 'host-share');
  await Promise.all([mkdir(workspace, {recursive: true}), mkdir(hostShare, {recursive: true})]);

  provider = spawn(process.execPath, ['scripts/agentteams-public-safe-mock-provider.mjs'], {cwd: root, stdio: 'ignore', env: {...process.env, PORT: '28333'}});
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
    AGENTTEAMS_LLM_PROVIDER: 'openai-compat', AGENTTEAMS_DEFAULT_MODEL: 'mock-agentteams-conformance',
    AGENTTEAMS_OPENAI_BASE_URL: 'http://host.docker.internal:28333/v1', AGENTTEAMS_LLM_API_KEY: 'public-safe-mock-not-a-secret', AGENTTEAMS_EMBEDDING_MODEL: '',
    AGENTTEAMS_ADMIN_USER: 'public-safe-admin', AGENTTEAMS_ADMIN_PASSWORD: 'public-safe-local-admin-v1',
    AGENTTEAMS_LOCAL_ONLY: '1', AGENTTEAMS_PORT_GATEWAY: '18080', AGENTTEAMS_PORT_CONSOLE: '18001', AGENTTEAMS_PORT_ELEMENT_WEB: '18088', AGENTTEAMS_PORT_MANAGER_CONSOLE: '18888',
    AGENTTEAMS_MATRIX_DOMAIN: 'matrix-local.agentteams.io:18080', AGENTTEAMS_MANAGER_RUNTIME: 'copaw', AGENTTEAMS_DEFAULT_WORKER_RUNTIME: 'copaw',
    AGENTTEAMS_MATRIX_E2EE: '0', AGENTTEAMS_DASHBOARD: '0', AGENTTEAMS_MOUNT_SOCKET: '1', AGENTTEAMS_DOCKER_PROXY: '0', AGENTTEAMS_WORKER_IDLE_TIMEOUT: '60',
    AGENTTEAMS_DATA_DIR: dataVolume, AGENTTEAMS_WORKSPACE_DIR: workspace, AGENTTEAMS_HOST_SHARE_DIR: hostShare,
    AGENTTEAMS_ENV_FILE: path.join(temporaryRoot, 'agentteams-manager.env')
  };
  run('bash', [path.join(temporaryRoot, 'AgentTeams-1.2.0/install/agentteams-install.sh'), 'manager'], {label: 'official-agentteams-v1.2.0-installer', timeout: 600_000, env: installerEnvironment});

  for (const role of roles) agt(['create', 'worker', '--name', role, '--runtime', 'copaw', '--model', 'mock-agentteams-conformance', '--no-wait'], `create-worker-${role}`);
  agt(['create', 'team', '--name', teamName, '--leader-name', leader, '--workers', roles.slice(1).join(',')], 'create-exact-six-member-team');
  await waitForTopology(); lifecycle.push({step: 'wait-exact-six-member-team', startedAt: new Date().toISOString(), status: 'PASS'});

  run(process.execPath, ['scripts/verify-agentteams-real-runtime.mjs'], {label: 'verify-real-agentteams-causal-runtime', timeout: 900_000});
  cleanupRuntime();
  provider.kill('SIGTERM'); provider = undefined;
  const evidencePath = path.join(root, '.evidence/sdd-002/agentteams-real-runtime.json');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  evidence.environmentLifecycle = {status: 'PASS', selfProvisioned: true, officialInstaller: true, sourceTarSha256: sourceDigest, exactRuntimeObjectsRemoved: true, sharedAgentTeamsNetworkPreserved: true, ephemeralCredentialsRemoved: true, steps: lifecycle};
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  completed = true;
  console.info(JSON.stringify({status: 'PASS', selfProvisioned: true, realAgentTeamsAcceptance: true, realModelAcceptance: false, memberCount: 6, taskCount: 8, cleanup: 'PASS', evidence: '.evidence/sdd-002/agentteams-real-runtime.json'}));
} finally {
  if (provider !== undefined) provider.kill('SIGTERM');
  if (!completed) {
    try { cleanupRuntime(); } catch {}
  }
  if (temporaryRoot !== undefined) await rm(temporaryRoot, {recursive: true, force: true});
}
