import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const project = 'lumiclaw-sdd006-verify';
const webPort = '3166'; const apiPort = '4166';
const evidencePath = path.resolve('.evidence/sdd-006/compose-verification.json');
const events = []; const checks = {};

function docker(args, inherit = false) {
  const command = ['compose', '--project-name', project, ...args];
  const startedAt = new Date().toISOString();
  try { const output = execFileSync('docker', command, {cwd: process.cwd(), encoding: 'utf8', stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], env: {...process.env, LUMICLAW_WEB_PORT: webPort, LUMICLAW_API_PORT: apiPort}}); events.push({command: ['docker', ...command], startedAt, result: 'PASS'}); return output ?? ''; }
  catch (error) { events.push({command: ['docker', ...command], startedAt, result: 'FAIL'}); throw error; }
}

async function waitHealthy(timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const output = docker(['ps', '--format', 'json']).trim();
    const rows = output === '' ? [] : output.startsWith('[') ? JSON.parse(output) : output.split('\n').map((line) => JSON.parse(line));
    const health = new Map(rows.map((row) => [row.Service, row.Health || row.State]));
    if (['postgres', 'api', 'mission-worker', 'action-operator', 'web'].every((service) => health.get(service) === 'healthy')) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('SDD006_COMPOSE_HEALTH_TIMEOUT');
}

await mkdir(path.dirname(evidencePath), {recursive: true});
let result = 'FAIL'; let failure = null;
try {
  docker(['down', '--volumes', '--remove-orphans']);
  docker(['build', 'api'], true);
  docker(['up', '--no-build', '--detach'], true);
  await waitHealthy(); checks.freshServicesHealthy = true;
  execFileSync(process.execPath, ['scripts/verify-sdd006-browser.mjs'], {cwd: process.cwd(), stdio: 'inherit', env: {...process.env, SDD006_WEB_URL: `http://127.0.0.1:${webPort}`}});
  checks.realBrowserFlow = true;

  const before = await fetch(`http://127.0.0.1:${apiPort}/api/v1/local-workspace`).then((response) => response.json());
  if (before.profile?.displayName !== 'SDD-006 Owner' || before.session?.state !== 'COMPLETED' || before.materials?.[0]?.fileName !== 'sdd-006-public-safe-brief.md' || !/^[a-f0-9]{64}$/u.test(before.materials?.[0]?.digest ?? '') || before.handoffs?.[0]?.state !== 'AWAITING_RECONCILIATION') throw new Error('SDD006_PRE_RESTART_STATE_INVALID');
  checks.preRestartAuthoritativeState = true;
  docker(['restart', 'postgres', 'api']);
  await waitHealthy();
  docker(['down']); docker(['up', '--detach']);
  await waitHealthy();
  const reopened = await fetch(`http://127.0.0.1:${apiPort}/api/v1/local-workspace`).then((response) => response.json());
  if (reopened.profile?.displayName !== before.profile.displayName || reopened.session?.campaignId !== before.session.campaignId || reopened.materials?.[0]?.digest !== before.materials[0].digest || reopened.materials?.[0]?.extractedText !== before.materials[0].extractedText || reopened.handoffs?.[0]?.state !== 'AWAITING_RECONCILIATION') throw new Error('SDD006_RESTART_REOPEN_INVALID');
  checks.postgresAndBlobRestartReopen = true;
  const readiness = await fetch(`http://127.0.0.1:${apiPort}/api/v1/environment-readiness`).then((response) => response.json());
  if (readiness.secretCollectionAllowed !== false || readiness.items.find((item) => item.service === 'POSTGRESQL')?.state !== 'AVAILABLE' || readiness.items.find((item) => item.service === 'AGENTTEAMS_RUNTIME')?.state !== 'NOT_CONFIGURED') throw new Error('SDD006_READINESS_CONTRACT_INVALID');
  checks.readinessTruthContract = true;
  const forbiddenTables = Number.parseInt(docker(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At', '-c', "select count(*) from information_schema.tables where table_schema='public' and table_name in ('connectors','action_grants','action_outbox')"]).trim(), 10);
  if (forbiddenTables !== 0) throw new Error('SDD006_FORBIDDEN_ACTION_TABLE_PRESENT');
  checks.noActionCapableTables = true;
  result = 'PASS';
} catch (error) { failure = error instanceof Error ? error.message : 'UNKNOWN_SDD006_COMPOSE_FAILURE'; throw error; }
finally {
  let cleanup = 'PASS'; try { docker(['down', '--volumes', '--remove-orphans']); } catch { cleanup = 'FAIL'; }
  await writeFile(evidencePath, `${JSON.stringify({schemaVersion: 1, project, result, cleanup, generatedAt: new Date().toISOString(), checks, failure, events}, null, 2)}\n`);
}

console.info(JSON.stringify({status: result, evidence: '.evidence/sdd-006/compose-verification.json'}));
