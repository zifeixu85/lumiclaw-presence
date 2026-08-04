import {execFileSync, spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {writeSync} from 'node:fs';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {LiveUatDiagnosticError, parseLiveFailureEnvelope, updateLiveFailureCleanup} from './live-uat-diagnostics.mjs';
import {serializeLiveUatTransport} from './live-uat-transport.mjs';

const root = process.cwd();
const project = 'lumiclaw-sdd002-live-uat-cr2';
const apiPort = '4129'; const webPort = '3129';
let secretRoot; let composeStarted = false;
let failureCode;
let diagnosticFailureEnvelope; let liveMissionId;

const allowedChildFailureCodes = new Set(['LIVE_UAT_TRANSPORT_INVALID', 'LIVE_UAT_TRANSPORT_FAILED', 'LIVE_UAT_TRANSPORT_DISCLOSURE_BLOCKED', 'LIVE_UAT_RUNNER_RECEIPT_INVALID', 'LIVE_AGENTTEAMS_ENVIRONMENT_FAILED', 'LIVE_FAILURE_RECEIPT_WRITE_FAILED', 'LIVE_UAT_CLEANUP_FAILED']);
function stableError(code) { const error = new Error(code); error.code = code; return error; }
function parseStableChildFailure(stderr) {
  try { const value = JSON.parse(stderr); return value?.status === 'FAIL' && allowedChildFailureCodes.has(value?.code) ? value.code : 'LIVE_AGENTTEAMS_CANARY_FAILED'; }
  catch { return 'LIVE_AGENTTEAMS_CANARY_FAILED'; }
}
function parseChildFailure(stderr, missionId) {
  try { return {envelope: parseLiveFailureEnvelope(stderr, {missionId})}; }
  catch { return {code: parseStableChildFailure(stderr)}; }
}
function childOutput(result) { return {stdout: typeof result.stdout === 'string' ? result.stdout : '', stderr: typeof result.stderr === 'string' ? result.stderr : ''}; }
function containsSensitiveOutput(stdout, stderr, bootstrap) {
  const output = `${stdout}${stderr}`;
  return output.includes(bootstrap) || /x-lumiclaw-runner-bootstrap|x-lumiclaw-runtime-ticket|authorization|\bbearer\b/iu.test(output);
}

function compose(args, environment, stdio = 'inherit') { return execFileSync('docker', ['compose', '-f', 'compose.yml', '-f', 'compose.live-deepseek-uat.yml', '--project-name', project, ...args], {cwd: root, env: environment, stdio, encoding: 'utf8', timeout: 900_000}); }

async function hidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') throw new Error('INTERACTIVE_TTY_REQUIRED_FOR_SECRET_INPUT');
  process.stdout.write(prompt); process.stdin.setRawMode(true); process.stdin.resume(); let value = '';
  return await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') { cleanup(); reject(new Error('SECRET_INPUT_CANCELLED')); return; }
        if (character === '\r' || character === '\n') { cleanup(); process.stdout.write('\n'); resolve(value); return; }
        if (character === '\u007f') value = value.slice(0, -1); else value += character;
      }
    };
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); };
    process.stdin.on('data', onData);
  });
}

try {
  const apiKey = await hidden('DeepSeek test API Key（不回显、不进环境变量）: ');
  const bootstrap = randomBytes(32).toString('base64url');
  if (apiKey.trim().length < 20) throw new Error('LIVE_UAT_SECRET_INPUT_INVALID');
  secretRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-live-uat-secrets.'));
  const keyFile = path.join(secretRoot, 'deepseek'); const bootstrapFile = path.join(secretRoot, 'bootstrap');
  await writeFile(keyFile, apiKey.trim(), {mode: 0o600}); await writeFile(bootstrapFile, bootstrap.trim(), {mode: 0o600});
  const environment = {...process.env, LUMICLAW_DEEPSEEK_SECRET_FILE: keyFile, LUMICLAW_RUNTIME_BOOTSTRAP_FILE: bootstrapFile, LUMICLAW_API_PORT: apiPort, LUMICLAW_WEB_PORT: webPort};
  compose(['down', '--volumes', '--remove-orphans'], environment, 'ignore');
  composeStarted = true; compose(['up', '--build', '--detach'], environment);
  const inspection = JSON.parse(execFileSync('docker', ['inspect', `${project}-api-1`], {encoding: 'utf8'}))[0];
  const leakedEnvironment = inspection.Config.Env.some((entry) => entry.includes(apiKey.trim()) || entry.includes(bootstrap.trim()));
  const secretTargets = inspection.Mounts.filter((mount) => String(mount.Destination).startsWith('/run/secrets/')).map((mount) => mount.Destination).sort();
  if (leakedEnvironment || secretTargets.join(',') !== '/run/secrets/deepseek_api_key,/run/secrets/lumiclaw_runtime_broker_bootstrap') throw new Error('COMPOSE_SECRET_INSPECT_BOUNDARY_FAILED');
  console.info(JSON.stringify({status: 'CONTROL_PLANE_READY', web: `http://127.0.0.1:${webPort}/zh-CN/mission`, api: `http://127.0.0.1:${apiPort}`, composeProject: project, secretInContainerEnvironment: false, secretTargets}));
  const rl = createInterface({input: process.stdin, output: process.stdout});
  console.info('请在网页选择“真实 DeepSeek 测试运行”，然后复制下列三个公开标识。');
  const organizationId = (await rl.question('Organization ID: ')).trim(); const missionId = (await rl.question('Live Mission ID: ')).trim(); const campaignDigest = (await rl.question('Campaign digest: ')).trim(); liveMissionId = missionId;
  rl.close();
  const runnerInput = serializeLiveUatTransport({organizationId, missionId, campaignDigest, bootstrap: bootstrap.trim()});
  const result = spawnSync(process.execPath, ['scripts/verify-agentteams-real-environment.mjs', '--live-deepseek-uat'], {cwd: root, env: {...process.env, LUMICLAW_LIVE_API_URL: `http://127.0.0.1:${apiPort}`}, input: runnerInput, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 1_800_000});
  const {stdout, stderr} = childOutput(result);
  if (containsSensitiveOutput(stdout, stderr, bootstrap)) throw stableError('LIVE_UAT_TRANSPORT_DISCLOSURE_BLOCKED');
  if (result.status !== 0) {
    const failure = parseChildFailure(stderr, missionId);
    if (failure.envelope !== undefined) throw new LiveUatDiagnosticError(failure.envelope);
    throw stableError(failure.code);
  }
  let childReceipt;
  try { childReceipt = JSON.parse(stdout); } catch { throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID'); }
  if (childReceipt?.status !== 'PASS'
    || childReceipt?.cleanup !== 'PASS'
    || childReceipt?.realAgentTeamsAcceptance !== true
    || childReceipt?.realModelAcceptance !== true
    || childReceipt?.maturity !== 'LIVE_PROVIDER_VERIFIED'
    || childReceipt?.missionId !== missionId
    || childReceipt?.state !== 'AWAITING_OWNER_REVIEW'
    || childReceipt?.modelReceipts !== 7
    || childReceipt?.ownerReviewRequired !== true
    || childReceipt?.externalActionCount !== 0) throw stableError('LIVE_UAT_RUNNER_RECEIPT_INVALID');
  console.info(JSON.stringify({
    status: childReceipt.status,
    maturity: childReceipt.maturity,
    missionId: childReceipt.missionId,
    state: childReceipt.state,
    realAgentTeamsAcceptance: childReceipt.realAgentTeamsAcceptance,
    realModelAcceptance: childReceipt.realModelAcceptance,
    memberCount: childReceipt.memberCount,
    taskCount: childReceipt.taskCount,
    modelReceipts: childReceipt.modelReceipts,
    ownerReviewRequired: childReceipt.ownerReviewRequired,
    externalActionCount: childReceipt.externalActionCount,
    cleanup: childReceipt.cleanup,
    evidence: childReceipt.evidence
  }));
  const cleanupPrompt = createInterface({input: process.stdin, output: process.stdout});
  await cleanupPrompt.question(`Live Canary 已完成。请在 http://127.0.0.1:${webPort}/zh-CN/review 完成精确 Owner Review；保存所需 redacted 证据后按 Enter 清理本地 UAT：`); cleanupPrompt.close();
  compose(['down', '--volumes', '--remove-orphans'], environment); composeStarted = false;
} catch (error) {
  if (error instanceof LiveUatDiagnosticError) diagnosticFailureEnvelope = error.envelope;
  else failureCode = typeof error?.code === 'string' && allowedChildFailureCodes.has(error.code) ? error.code : 'LIVE_UAT_LAUNCHER_FAILED';
} finally {
  if (composeStarted && secretRoot !== undefined) {
    const environment = {...process.env, LUMICLAW_DEEPSEEK_SECRET_FILE: path.join(secretRoot, 'deepseek'), LUMICLAW_RUNTIME_BOOTSTRAP_FILE: path.join(secretRoot, 'bootstrap'), LUMICLAW_API_PORT: apiPort, LUMICLAW_WEB_PORT: webPort};
    try { compose(['down', '--volumes', '--remove-orphans'], environment, 'ignore'); } catch { failureCode = 'LIVE_UAT_CLEANUP_FAILED'; diagnosticFailureEnvelope = undefined; }
  }
  if (secretRoot !== undefined) {
    try { await rm(secretRoot, {recursive: true, force: true}); } catch { failureCode = 'LIVE_UAT_CLEANUP_FAILED'; diagnosticFailureEnvelope = undefined; }
  }
  if (diagnosticFailureEnvelope !== undefined && failureCode === undefined && liveMissionId !== undefined) {
    try { await updateLiveFailureCleanup(root, {controlPlane: 'PASS', secretDirectory: 'PASS'}, {missionId: liveMissionId, stage: diagnosticFailureEnvelope.stage, code: diagnosticFailureEnvelope.code}); }
    catch { failureCode = 'LIVE_FAILURE_RECEIPT_WRITE_FAILED'; diagnosticFailureEnvelope = undefined; }
  }
}
if (diagnosticFailureEnvelope !== undefined) { writeSync(2, `${JSON.stringify(diagnosticFailureEnvelope)}\n`); process.exitCode = 1; }
else if (failureCode !== undefined) { writeSync(2, `${JSON.stringify({status: 'FAIL', code: failureCode})}\n`); process.exitCode = 1; }
