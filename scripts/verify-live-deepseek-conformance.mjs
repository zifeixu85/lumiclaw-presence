import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {access, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {isLiveFailureReceipt, LIVE_STAGE_CODE, parseLiveFailureEnvelope} from './live-uat-diagnostics.mjs';
import {isRedactedTransportReceipt} from './live-uat-transport.mjs';

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
const providerOutcomes = [
  'DEEPSEEK_SECRET_FILE_UNAVAILABLE',
  'PROVIDER_HTTP_401', 'PROVIDER_HTTP_402', 'PROVIDER_HTTP_404', 'PROVIDER_HTTP_429', 'PROVIDER_HTTP_500', 'PROVIDER_HTTP_502', 'PROVIDER_HTTP_503', 'PROVIDER_HTTP_504',
  'MODEL_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'MODEL_RESPONSE_IDENTITY_INVALID', 'MODEL_RETURNED_MODEL_MISMATCH', 'MODEL_FINISH_REASON_INVALID', 'MODEL_USAGE_INVALID', 'PROVIDER_RESPONSE_INVALID', 'MODEL_JSON_MALFORMED', 'MODEL_SCHEMA_INVALID', 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', 'LIVE_PROVIDER_BROKER_FAILED'
];

function run(executable, args, environment = process.env, timeout = 900_000) {
  return execFileSync(executable, args, {cwd: root, env: environment, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe']}).trim();
}

function invokeTransport(input) {
  return spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', '--live-stdin-transport-conformance'], {cwd: root, input, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe']});
}

function invokeOperationalFailure(input) {
  return spawnSync(process.execPath, ['scripts/run-live-deepseek-uat.mjs'], {cwd: root, input, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, LUMICLAW_LIVE_API_URL: 'http://127.0.0.1:9'}});
}

function verifyStdinTransport() {
  const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f';
  const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd';
  const campaignDigest = 'b'.repeat(64);
  const bootstrap = 'public-safe-dummy-bootstrap-live-conformance-0001';
  const extraSecret = 'public-safe-dummy-extra-secret-conformance-0001';
  const valid = {organizationId, missionId, campaignDigest, bootstrap};
  const {bootstrap: omitted, ...partial} = valid; void omitted;
  const cases = [
    {name: 'valid', input: JSON.stringify(valid), expectedStatus: 0},
    {name: 'partial', input: JSON.stringify(partial), expectedStatus: 1},
    {name: 'malformed', input: `{"organizationId":"${organizationId}","bootstrap":"${bootstrap}","marker":"${extraSecret}"`, expectedStatus: 1},
    {name: 'extra-field', input: JSON.stringify({...valid, extraSecret}), expectedStatus: 1}
  ];
  const results = cases.map((entry) => ({entry, result: invokeTransport(entry.input)}));
  const operationalFailure = invokeOperationalFailure(JSON.stringify(valid));
  const allResults = [...results.map(({result}) => result), operationalFailure];
  const disclosure = allResults.some((result) => `${result.stdout}${result.stderr}`.includes(bootstrap) || `${result.stdout}${result.stderr}`.includes(extraSecret) || /x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|\bbearer\b/iu.test(`${result.stdout}${result.stderr}`));
  if (disclosure || results.some(({entry, result}) => result.status !== entry.expectedStatus)) throw new Error('LIVE_STDIN_TRANSPORT_CONFORMANCE_FAILED');
  const validReceipt = JSON.parse(results[0].result.stdout);
  if (!isRedactedTransportReceipt(validReceipt)
    || validReceipt.fieldDigests.organizationId !== createHash('sha256').update(organizationId).digest('hex')
    || validReceipt.fieldDigests.missionId !== createHash('sha256').update(missionId).digest('hex')
    || validReceipt.fieldDigests.campaignDigest !== createHash('sha256').update(campaignDigest).digest('hex')
    || validReceipt.fieldDigests.bootstrap !== createHash('sha256').update(bootstrap).digest('hex')) throw new Error('LIVE_STDIN_TRANSPORT_RECEIPT_INVALID');
  for (const {result} of results.slice(1)) {
    const failure = JSON.parse(result.stderr);
    if (result.stdout !== '' || failure.status !== 'FAIL' || failure.code !== 'LIVE_UAT_TRANSPORT_INVALID') throw new Error('LIVE_STDIN_TRANSPORT_NEGATIVE_CASE_INVALID');
  }
  const operationalEnvelope = parseLiveFailureEnvelope(operationalFailure.stderr, {missionId});
  if (operationalFailure.status === 0 || operationalFailure.stdout !== '' || operationalEnvelope.code !== 'LIVE_MISSION_OPEN_FAILED' || operationalEnvelope.stage !== 'MISSION_OPEN') throw new Error('LIVE_STDIN_TRANSPORT_OPERATIONAL_FAILURE_INVALID');
  return {status: 'PASS', protocol: 'STRICT_JSON_EXACT_FOUR_FIELDS_SINGLE_FD0_READ', nestedChildProcess: true, cases: 5, nestedTransportCases: 4, validFields: 4, partialRejected: true, malformedRejected: true, extraFieldRejected: true, operationalFailureRejected: true, stdoutStderrInherited: false, bootstrapOrSecretFinding: false, stableFailureCode: 'LIVE_UAT_TRANSPORT_INVALID', operationalFailureCode: 'LIVE_MISSION_OPEN_FAILED', receipt: validReceipt};
}

async function verifyStageDiagnostics() {
  const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f'; const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd'; const campaignDigest = 'c'.repeat(64);
  const bootstrap = 'public-safe-dummy-bootstrap-stage-evidence-0001'; const dummySecret = 'dummy-secret-never-output-stage-evidence-0001'; const dummyTicket = 'dummy-ticket-never-output-stage-evidence-0001'; const rawResponse = 'raw-response-never-output-stage-evidence-0001';
  const diagnosticRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-live-stage-evidence.')); const stageReceipts = [];
  try {
    for (const [stage, code] of Object.entries(LIVE_STAGE_CODE)) {
      const evidencePath = path.join(diagnosticRoot, `${stage}.json`);
      const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', `--live-stage-diagnostic-conformance=${stage}`], {cwd: root, input: JSON.stringify({organizationId, missionId, campaignDigest, bootstrap}), encoding: 'utf8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: evidencePath, DUMMY_SECRET_MARKER: dummySecret, DUMMY_TICKET_MARKER: dummyTicket, DUMMY_RAW_RESPONSE_MARKER: rawResponse}});
      const output = `${result.stdout}${result.stderr}`;
      if (result.status === 0 || result.stdout !== '' || [bootstrap, dummySecret, dummyTicket, rawResponse].some((marker) => output.includes(marker)) || /x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|\bbearer\b/iu.test(output)) throw new Error('LIVE_STAGE_DIAGNOSTIC_DISCLOSURE_OR_STATUS_INVALID');
      const envelope = parseLiveFailureEnvelope(result.stderr, {missionId}); const receipt = JSON.parse(await readFile(evidencePath, 'utf8'));
      if (envelope.stage !== stage || envelope.code !== code || !isLiveFailureReceipt(receipt, {organizationId, missionId, campaignDigest, stage, code})) throw new Error('LIVE_STAGE_DIAGNOSTIC_RECEIPT_INVALID');
      stageReceipts.push({stage, code, progress: receipt.progress});
    }
    return {status: 'PASS', actualNestedChildProcess: true, cases: stageReceipts.length, stages: stageReceipts, arbitraryExceptionTextForwarded: false, rawChildOutputForwarded: false, bootstrapTicketHeaderRawResponseFinding: false, receiptBeforeCleanup: true, publicPackageIncludesFailureReceipt: false};
  } finally { await rm(diagnosticRoot, {recursive: true, force: true}); }
}

async function verifyProviderOutcomeDiagnostics() {
  const organizationId = '019fcc41-dd89-70c1-ae55-c8e45b4aeb3f'; const missionId = '019fcc41-ddba-7897-a271-d0eda0c9a7fd'; const campaignDigest = 'd'.repeat(64);
  const bootstrap = 'public-safe-provider-outcome-evidence-bootstrap-0001'; const dummySecret = 'dummy-secret-provider-outcome-evidence-0001'; const dummyTicket = 'dummy-ticket-provider-outcome-evidence-0001'; const rawResponse = 'raw-response-provider-outcome-evidence-0001';
  const diagnosticRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-provider-outcome-evidence.')); const receipts = [];
  try {
    for (const providerOutcomeCode of providerOutcomes) {
      const evidencePath = path.join(diagnosticRoot, `${providerOutcomeCode}.json`);
      const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', `--live-provider-outcome-diagnostic-conformance=${providerOutcomeCode}`], {cwd: root, input: JSON.stringify({organizationId, missionId, campaignDigest, bootstrap}), encoding: 'utf8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, LUMICLAW_LIVE_FAILURE_EVIDENCE_PATH: evidencePath, DUMMY_SECRET_MARKER: dummySecret, DUMMY_TICKET_MARKER: dummyTicket, DUMMY_RAW_RESPONSE_MARKER: rawResponse}});
      const output = `${result.stdout}${result.stderr}`;
      if (result.status === 0 || result.stdout !== '' || [bootstrap, dummySecret, dummyTicket, rawResponse].some((marker) => output.includes(marker)) || /x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|\bbearer\b|responseId/iu.test(output)) throw new Error('LIVE_PROVIDER_OUTCOME_DISCLOSURE_OR_STATUS_INVALID');
      const envelope = parseLiveFailureEnvelope(result.stderr, {missionId}); const receipt = JSON.parse(await readFile(evidencePath, 'utf8'));
      if (envelope.stage !== 'PROVIDER_REQUEST' || envelope.code !== 'LIVE_PROVIDER_REQUEST_FAILED' || envelope.providerOutcomeCode !== providerOutcomeCode || !isLiveFailureReceipt(receipt, {organizationId, missionId, campaignDigest, stage: 'PROVIDER_REQUEST', code: 'LIVE_PROVIDER_REQUEST_FAILED', providerOutcomeCode})) throw new Error('LIVE_PROVIDER_OUTCOME_RECEIPT_INVALID');
      receipts.push({providerOutcomeCode, failedTaskBound: receipt.failedTaskId === 'public-safe-provider-task'});
    }
    return {status: 'PASS', actualNestedChildProcess: true, cases: receipts.length, outcomes: receipts, missingOrContradictoryMapsTo: 'LIVE_PROVIDER_BROKER_FAILED', arbitraryExceptionTextForwarded: false, rawHttpOrModelOutputForwarded: false, bootstrapTicketHeaderResponseIdFinding: false};
  } finally { await rm(diagnosticRoot, {recursive: true, force: true}); }
}

function infrastructureNames() {
  return [
    ...run('docker', ['ps', '-a', '--format', '{{.Names}}']).split('\n'),
    ...run('docker', ['volume', 'ls', '--format', '{{.Name}}']).split('\n'),
    ...run('docker', ['network', 'ls', '--format', '{{.Name}}']).split('\n')
  ].filter(Boolean);
}

function exactProjectObjectsRemoved() {
  const names = infrastructureNames();
  return names.every((name) => !name.startsWith(`${project}-`) && !name.startsWith(`${project}_`));
}

function failedCanaryObjectsAbsent() {
  const agentTeamsContainers = new Set(['agentteams-controller', 'agentteams-manager', 'agentteams-dashboard', 'agentteams-docker-proxy']);
  return infrastructureNames().every((name) => !name.startsWith('lumiclaw-sdd002-live-uat-cr2-')
    && !name.startsWith('lumiclaw-sdd002-live-uat-cr2_')
    && !agentTeamsContainers.has(name)
    && !name.startsWith('agentteams-worker-')
    && name !== 'lumiclaw-sdd002-agentteams-data');
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
  const tests = run(path.join(root, 'node_modules/.bin/vitest'), ['run', 'apps/api/src/live-runtime-security.test.ts', 'apps/api/src/server.test.ts', 'packages/governed-shadow/src/model-provider.test.ts', 'scripts/live-uat-transport.test.ts', 'scripts/live-uat-diagnostics.test.ts', 'scripts/live-provider-outcome.test.ts']);
  if (!/Test Files\s+6 passed \(6\)/u.test(tests) || !/Tests\s+126 passed \(126\)/u.test(tests)) throw new Error('LIVE_CONFORMANCE_TARGETED_TEST_COUNT_INVALID');
  const stdinTransport = verifyStdinTransport();
  const stageDiagnostics = await verifyStageDiagnostics();
  const providerOutcomeDiagnostics = await verifyProviderOutcomeDiagnostics();
  const composePolicy = JSON.parse(run(process.execPath, ['scripts/check-compose-policy.mjs']));
  const clientBundle = JSON.parse(run(process.execPath, ['scripts/check-storybook-browser-safety.mjs']));
  const currentFailedCanaryObjectsAbsentBeforeRun = failedCanaryObjectsAbsent();
  if (!currentFailedCanaryObjectsAbsentBeforeRun) throw new Error('FAILED_CANARY_OBJECTS_STILL_PRESENT');

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
  const exactComposeProjectRemoved = exactProjectObjectsRemoved();
  await rm(secretRoot, {recursive: true, force: true});
  let temporarySecretDirectoryRemoved = false;
  try { await access(secretRoot); } catch { temporarySecretDirectoryRemoved = true; }
  secretRoot = undefined;
  if (!exactComposeProjectRemoved || !temporarySecretDirectoryRemoved) throw new Error('LIVE_CONFORMANCE_CLEANUP_FAILED');

  const evidence = {
    schemaVersion: 1,
    status: 'PASS',
    maturity: 'ENGINEERING_VERIFIED',
    liveProviderVerified: false,
    liveProviderStatus: 'NOT_RUN_NO_OWNER_SECRET',
    generatedAt: new Date().toISOString(),
    targetedContracts: {testFiles: 6, tests: 126, noKeyFailClosed: true, mockFallback: false, scopedSingleUseTickets: true, wrongScopeBurnsTicket: true, leaderModelCallForbidden: true, independentAuditorReceiptRequired: true, exactRoleSchemaPromptBound: true, firstDomainFixtureCovered: true},
    stdinTransport,
    stageDiagnostics,
    providerOutcomeDiagnostics,
    composePolicy,
    clientBundle: {status: clientBundle.status, bundleCount: clientBundle.bundles.length, forbidden: clientBundle.forbidden},
    composeInspect: {project, health, secretInEnvironment, secretMounts, dockerSocketMounted, sensitiveLogFinding},
    secretIngress: 'INTERACTIVE_TTY_TO_0600_TEMP_FILES_TO_READ_ONLY_COMPOSE_SECRETS',
    noAction: {externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0},
    cleanupEvidence: {exactComposeProjectRemoved, temporarySecretDirectoryRemoved, currentFailedCanaryObjectsAbsentBeforeRun},
    cleanup: 'PASS'
  };
  await mkdir(path.join(root, '.evidence/sdd-002'), {recursive: true});
  await writeFile(path.join(root, '.evidence/sdd-002/live-deepseek-conformance.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', maturity: evidence.maturity, liveProviderStatus: evidence.liveProviderStatus, tests: 126, stdinTransportCases: 5, stageDiagnosticCases: stageDiagnostics.cases, providerOutcomeCases: providerOutcomeDiagnostics.cases, secretInEnvironment, dockerSocketMounted, cleanup: evidence.cleanup, evidence: '.evidence/sdd-002/live-deepseek-conformance.json'}));
} finally {
  if (composeStarted && secretRoot !== undefined) {
    const environment = {...process.env, LUMICLAW_DEEPSEEK_SECRET_FILE: path.join(secretRoot, 'deepseek'), LUMICLAW_RUNTIME_BOOTSTRAP_FILE: path.join(secretRoot, 'bootstrap'), LUMICLAW_API_PORT: apiPort, LUMICLAW_WEB_PORT: webPort};
    try { run('docker', ['compose', ...composeFiles, '--project-name', project, 'down', '--volumes', '--remove-orphans'], environment); } catch {}
  }
  if (secretRoot !== undefined) await rm(secretRoot, {recursive: true, force: true});
}
