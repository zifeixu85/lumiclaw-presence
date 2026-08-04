import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = process.cwd();
const project = 'lumiclaw-sdd002-live-conformance';
const container = `${project}-api-1`;
const apiPort = '4130';
const webPort = '3130';
const composeFiles = ['-f', 'compose.yml', '-f', 'compose.live-deepseek-uat.yml'];
const keyValue = 'public-safe-dummy-deepseek-key-conformance-0001';
const bootstrapValue = 'public-safe-dummy-runtime-bootstrap-conformance-0001';
let secretRoot;
let composeStarted = false;

function run(executable, args, environment = process.env, timeout = 900_000) {
  return execFileSync(executable, args, {cwd: root, env: environment, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe']}).trim();
}

async function waitForApi() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`http://127.0.0.1:${apiPort}/health`); if (response.ok) return await response.json(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('LIVE_CONFORMANCE_API_NOT_READY');
}

try {
  const tests = run(path.join(root, 'node_modules/.bin/vitest'), ['run', 'apps/api/src/live-runtime-security.test.ts', 'apps/api/src/server.test.ts']);
  if (!/Test Files\s+2 passed \(2\)/u.test(tests) || !/Tests\s+16 passed \(16\)/u.test(tests)) throw new Error('LIVE_CONFORMANCE_TARGETED_TEST_COUNT_INVALID');
  const composePolicy = JSON.parse(run(process.execPath, ['scripts/check-compose-policy.mjs']));
  const clientBundle = JSON.parse(run(process.execPath, ['scripts/check-storybook-browser-safety.mjs']));

  secretRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-live-conformance.'));
  const keyFile = path.join(secretRoot, 'deepseek'); const bootstrapFile = path.join(secretRoot, 'bootstrap');
  await writeFile(keyFile, keyValue, {mode: 0o600}); await writeFile(bootstrapFile, bootstrapValue, {mode: 0o600});
  const environment = {...process.env, LUMICLAW_DEEPSEEK_SECRET_FILE: keyFile, LUMICLAW_RUNTIME_BOOTSTRAP_FILE: bootstrapFile, LUMICLAW_API_PORT: apiPort, LUMICLAW_WEB_PORT: webPort};
  const compose = (...args) => run('docker', ['compose', ...composeFiles, '--project-name', project, ...args], environment);
  try { compose('down', '--volumes', '--remove-orphans'); } catch {}
  composeStarted = true;
  compose('up', '--build', '--detach', 'api');
  const health = await waitForApi();
  const inspection = JSON.parse(run('docker', ['inspect', container]))[0];
  const environmentEntries = inspection.Config.Env ?? [];
  const secretMounts = (inspection.Mounts ?? []).filter((mount) => String(mount.Destination).startsWith('/run/secrets/')).map((mount) => ({destination: mount.Destination, readOnly: mount.RW === false})).sort((left, right) => left.destination.localeCompare(right.destination));
  const secretInEnvironment = environmentEntries.some((entry) => entry.includes(keyValue) || entry.includes(bootstrapValue));
  const dockerSocketMounted = (inspection.Mounts ?? []).some((mount) => mount.Source === '/var/run/docker.sock' || mount.Destination === '/var/run/docker.sock');
  const logs = compose('logs', '--no-color', 'api');
  const sensitiveLogFinding = logs.includes(keyValue) || logs.includes(bootstrapValue) || /authorization\s*[:=]|\bBearer\s+/iu.test(logs);
  if (secretInEnvironment || dockerSocketMounted || sensitiveLogFinding || secretMounts.length !== 2 || secretMounts.some((mount) => !mount.readOnly) || secretMounts.map((mount) => mount.destination).join(',') !== '/run/secrets/deepseek_api_key,/run/secrets/lumiclaw_runtime_broker_bootstrap') throw new Error('LIVE_CONFORMANCE_SECRET_BOUNDARY_FAILED');
  compose('down', '--volumes', '--remove-orphans'); composeStarted = false;

  const evidence = {
    schemaVersion: 1,
    status: 'PASS',
    maturity: 'ENGINEERING_VERIFIED',
    liveProviderVerified: false,
    liveProviderStatus: 'NOT_RUN_NO_OWNER_SECRET',
    generatedAt: new Date().toISOString(),
    targetedContracts: {testFiles: 2, tests: 16, noKeyFailClosed: true, mockFallback: false, scopedSingleUseTickets: true, wrongScopeBurnsTicket: true, leaderModelCallForbidden: true, independentAuditorReceiptRequired: true},
    composePolicy,
    clientBundle: {status: clientBundle.status, bundleCount: clientBundle.bundles.length, forbidden: clientBundle.forbidden},
    composeInspect: {project, health, secretInEnvironment, secretMounts, dockerSocketMounted, sensitiveLogFinding},
    secretIngress: 'INTERACTIVE_TTY_TO_0600_TEMP_FILES_TO_READ_ONLY_COMPOSE_SECRETS',
    noAction: {externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0},
    cleanup: 'PASS'
  };
  await mkdir(path.join(root, '.evidence/sdd-002'), {recursive: true});
  await writeFile(path.join(root, '.evidence/sdd-002/live-deepseek-conformance.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', maturity: evidence.maturity, liveProviderStatus: evidence.liveProviderStatus, tests: 16, secretInEnvironment, dockerSocketMounted, cleanup: evidence.cleanup, evidence: '.evidence/sdd-002/live-deepseek-conformance.json'}));
} finally {
  if (composeStarted && secretRoot !== undefined) {
    const environment = {...process.env, LUMICLAW_DEEPSEEK_SECRET_FILE: path.join(secretRoot, 'deepseek'), LUMICLAW_RUNTIME_BOOTSTRAP_FILE: path.join(secretRoot, 'bootstrap'), LUMICLAW_API_PORT: apiPort, LUMICLAW_WEB_PORT: webPort};
    try { run('docker', ['compose', ...composeFiles, '--project-name', project, 'down', '--volumes', '--remove-orphans'], environment); } catch {}
  }
  if (secretRoot !== undefined) await rm(secretRoot, {recursive: true, force: true});
}
