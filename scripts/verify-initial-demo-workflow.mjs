import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {DEMO_CONFIG, assertExactDemoTargets, assertPublicSafeEvidence} from './initial-demo-contract.mjs';

const sentinelVolume = 'lumiclaw-sdd002-initial-demo-sentinel';
const workflowEvidencePath = path.join(DEMO_CONFIG.evidenceRoot, 'workflow-verification.json');
const results = {};
let sentinelCreated = false;

assertExactDemoTargets(DEMO_CONFIG.root, DEMO_CONFIG.project, DEMO_CONFIG.evidenceRoot);

try {
  step('SENTINEL_CREATE');
  if (docker(['volume', 'inspect', sentinelVolume], true) !== undefined) throw new Error('INITIAL_DEMO_SENTINEL_ALREADY_EXISTS');
  docker(['volume', 'create', '--label', 'com.lumiclaw.sdd002.sentinel=true', sentinelVolume]);
  sentinelCreated = true;

  step('FIRST_PREPARE');
  const first = runInitial('prepare');
  assertSentinelExists();

  step('SECOND_PREPARE');
  const second = runInitial('prepare');
  assertSentinelExists();
  if (first.organizationId !== second.organizationId || first.campaignId !== second.campaignId || first.campaignDigest !== second.campaignDigest) throw new Error('INITIAL_DEMO_REPEATABILITY_FAILED');
  results.repeatability = {
    organizationId: second.organizationId,
    campaignId: second.campaignId,
    campaignDigest: second.campaignDigest,
    firstState: first.state,
    secondState: second.state
  };

  step('COMPLETE_AND_REOPEN');
  const completed = runInitial('complete');
  const smoke = runScript('scripts/initial-demo-browser-smoke.mjs');
  const status = runInitial('status');
  if (completed.state !== 'SHADOW_COMPLETE' || status.state !== 'SHADOW_COMPLETE' || status.reviews !== 4 || status.actionGrantCount !== 0 || status.connectorCount !== 0 || status.externalActionCount !== 0) throw new Error('INITIAL_DEMO_COMPLETION_FAILED');
  results.completed = {state: completed.state, reviews: status.reviews, browserPages: smoke.pages, browserScreenshots: smoke.screenshots, noAction: completed.noAction};

  step('CAPTURE_HASHES');
  results.evidence = {
    manifestSha256: await sha256(path.join(DEMO_CONFIG.evidenceRoot, 'demo-manifest.json')),
    missionSha256: await sha256(path.join(DEMO_CONFIG.evidenceRoot, 'mission-evidence.json')),
    browserSha256: await sha256(path.join(DEMO_CONFIG.evidenceRoot, 'browser-smoke.json'))
  };

  step('EXACT_RESET');
  const reset = runInitial('reset');
  assertSentinelExists();
  if (docker(['ps', '--filter', `label=com.docker.compose.project=${DEMO_CONFIG.project}`, '--format', '{{.ID}}']).trim() !== '') throw new Error('INITIAL_DEMO_RESET_CONTAINER_LEAK');
  if (docker(['volume', 'ls', '--filter', `label=com.docker.compose.project=${DEMO_CONFIG.project}`, '--quiet']).trim() !== '') throw new Error('INITIAL_DEMO_RESET_VOLUME_LEAK');
  results.reset = {project: reset.project, scope: reset.scope, unrelatedSentinelPreserved: true, demoContainersRemaining: 0, demoVolumesRemaining: 0};

  const evidence = {
    schemaVersion: DEMO_CONFIG.schemaVersion,
    status: 'PASS',
    generatedAt: new Date().toISOString(),
    source: sourceIdentity(),
    maturity: DEMO_CONFIG.providerMaturity,
    realAgentTeamsClaim: false,
    externalActionAllowed: false,
    results
  };
  assertPublicSafeEvidence(evidence);
  await mkdir(DEMO_CONFIG.evidenceRoot, {recursive: true});
  await writeFile(workflowEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {mode: 0o600});
  console.info(JSON.stringify({status: 'PASS', deterministicSeed: true, completedAndReopened: true, exactReset: true, evidence: `${DEMO_CONFIG.evidenceDisplayRoot}/workflow-verification.json`}));
} catch (error) {
  try { runInitial('reset'); } catch {}
  throw error;
} finally {
  if (sentinelCreated) docker(['volume', 'rm', sentinelVolume]);
}

function runInitial(command) {
  return run(process.execPath, ['scripts/run-initial-demo.mjs', command]);
}

function runScript(script) {
  return run(process.execPath, [script]);
}

function run(file, args) {
  const output = execFileSync(file, args, {
    cwd: DEMO_CONFIG.root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 1_200_000,
    maxBuffer: 32 * 1024 * 1024
  });
  const document = output.trim().split('\n').toReversed().map((line) => {
    try { return JSON.parse(line); } catch { return undefined; }
  }).find((candidate) => candidate?.status === 'PASS');
  if (document === undefined) throw new Error('INITIAL_DEMO_COMMAND_OUTPUT_INVALID');
  return document;
}

function docker(args, allowFailure = false) {
  try {
    return execFileSync('docker', args, {cwd: DEMO_CONFIG.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000});
  } catch (error) {
    if (allowFailure) return undefined;
    throw error;
  }
}

function assertSentinelExists() {
  if (docker(['volume', 'inspect', '--format', '{{.Name}}', sentinelVolume]).trim() !== sentinelVolume) throw new Error('INITIAL_DEMO_RESET_ESCAPED_SCOPE');
}

function sourceIdentity() {
  return {
    head: dockerCommand('git', ['rev-parse', 'HEAD']),
    dirty: dockerCommand('git', ['status', '--short']).length > 0
  };
}

function dockerCommand(file, args) {
  return execFileSync(file, args, {cwd: DEMO_CONFIG.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000}).trim();
}

async function sha256(target) {
  return createHash('sha256').update(await readFile(target)).digest('hex');
}

function step(name) {
  console.info(`INITIAL_DEMO_VERIFY:${name}`);
}
