import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const project = 'lumiclaw-sdd006-verify';
const webPort = '3166';
const apiPort = '4166';
const apiUrl = `http://127.0.0.1:${apiPort}`;
const evidencePath = path.resolve('.evidence/sdd-006/compose-verification.json');
const fixtureName = 'sdd-006-local-private-fixture.md';
const fixtureBytes = Buffer.from('# 星河公开安全测试资料\n用于验证本机私有初始化，不含客户或私密资料。');
const events = [];
const checks = {};

function docker(args, inherit = false) {
  const command = ['compose', '--project-name', project, ...args];
  const startedAt = new Date().toISOString();
  try {
    const output = execFileSync('docker', command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: {...process.env, LUMICLAW_WEB_PORT: webPort, LUMICLAW_API_PORT: apiPort}
    });
    events.push({command: ['docker', ...command], startedAt, result: 'PASS'});
    return output ?? '';
  } catch (error) {
    events.push({command: ['docker', ...command], startedAt, result: 'FAIL'});
    throw error;
  }
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

async function postJson(route, body) {
  const response = await fetch(`${apiUrl}${route}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  return {status: response.status, body: await response.json()};
}

async function upload(fileName, bytes) {
  const response = await fetch(`${apiUrl}/api/v1/local-materials`, {method: 'POST', headers: {'content-type': 'text/markdown', 'x-lumiclaw-file-name': encodeURIComponent(fileName)}, body: bytes});
  return {status: response.status, body: await response.json()};
}

function postgresScalar(sql) {
  return docker(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At', '-c', sql]).trim();
}

function blobExists(bytes) {
  const digest = createHash('sha256').update(bytes).digest('hex');
  const blobPath = `/var/lib/lumiclaw/blobs/${digest.slice(0, 2)}/${digest.slice(2)}`;
  const output = docker(['exec', '-T', 'api', 'node', '-e', `process.stdout.write(require('node:fs').existsSync(${JSON.stringify(blobPath)}) ? 'true' : 'false')`]).trim();
  return output === 'true';
}

await mkdir(path.dirname(evidencePath), {recursive: true});
let result = 'FAIL';
let failure = null;
try {
  docker(['down', '--volumes', '--remove-orphans']);
  docker(['build', 'api'], true);
  docker(['up', '--no-build', '--detach'], true);
  await waitHealthy();
  checks.freshServicesHealthy = true;

  const profile = await postJson('/api/v1/local-owner-profile', {displayName: 'PG negative-path owner'});
  if (profile.status !== 201) throw new Error('SDD006_NEGATIVE_PROFILE_CREATE_FAILED');
  const prematureBytes = Buffer.from('# upload must fail before path selection');
  const premature = await upload('premature.md', prematureBytes);
  if (premature.status !== 422 || premature.body.code !== 'LOCAL_MATERIAL_PATH_REQUIRED') throw new Error('SDD006_PREMATURE_UPLOAD_DID_NOT_FAIL_CLOSED');
  if (Number(postgresScalar('select count(*) from local_material_manifests')) !== 0 || blobExists(prematureBytes)) throw new Error('SDD006_PREMATURE_UPLOAD_LEFT_PERSISTENCE');
  checks.uploadRequiresSelectedLocalPathWithoutManifestOrBlob = true;

  const selected = await postJson('/api/v1/local-onboarding/materials-path', {});
  if (selected.status !== 200 || selected.body.session?.path !== 'LOCAL_MATERIALS') throw new Error('SDD006_NEGATIVE_PATH_SELECTION_FAILED');
  postgresScalar("alter table local_material_manifests add constraint sdd006_force_failure check (file_name <> 'force-db-failure.md')");
  const failureBytes = Buffer.from('# force database failure after Blob put');
  const failedWrite = await upload('force-db-failure.md', failureBytes);
  postgresScalar('alter table local_material_manifests drop constraint sdd006_force_failure');
  if (failedWrite.status !== 503 || failedWrite.body.code !== 'CONTROL_PLANE_UNAVAILABLE') throw new Error('SDD006_FORCED_DB_FAILURE_NOT_SURFACED');
  if (Number(postgresScalar('select count(*) from local_material_manifests')) !== 0 || blobExists(failureBytes)) throw new Error('SDD006_DB_FAILURE_LEFT_ORPHAN_BLOB');
  checks.databaseWriteFailureCleansNewBlob = true;

  docker(['down', '--volumes', '--remove-orphans']);
  docker(['up', '--no-build', '--detach'], true);
  await waitHealthy();
  execFileSync(process.execPath, ['scripts/verify-sdd006-browser.mjs'], {cwd: process.cwd(), stdio: 'inherit', env: {...process.env, SDD006_WEB_URL: `http://127.0.0.1:${webPort}`}});
  checks.realBilingualBrowserFlow = true;

  const duplicateResults = await Promise.all([upload(fixtureName, fixtureBytes), upload(fixtureName, fixtureBytes)]);
  if (!duplicateResults.every((entry) => entry.status === 201) || duplicateResults[0].body.material?.id !== duplicateResults[1].body.material?.id) throw new Error('SDD006_CONCURRENT_DUPLICATE_RESULT_INCONSISTENT');
  const materialCount = Number(postgresScalar('select count(*) from local_material_manifests'));
  const persistedMaterialIds = JSON.parse(postgresScalar('select material_ids::text from local_onboarding_sessions limit 1'));
  if (materialCount !== 1 || persistedMaterialIds.length !== 1 || persistedMaterialIds[0] !== duplicateResults[0].body.material.id) throw new Error('SDD006_CONCURRENT_DUPLICATE_PERSISTENCE_INCONSISTENT');
  checks.concurrentDuplicateUploadIsIdempotentAndConsistent = true;

  const before = await fetch(`${apiUrl}/api/v1/local-workspace`).then((response) => response.json());
  const beforeDocument = before.campaign?.document;
  if (
    before.profile?.displayName !== 'SDD-006 Owner'
    || before.session?.state !== 'COMPLETED'
    || before.session?.dataMode !== 'LOCAL_PRIVATE'
    || before.materials?.length !== 1
    || before.materials[0]?.fileName !== fixtureName
    || !/^[a-f0-9]{64}$/u.test(before.materials[0]?.digest ?? '')
    || before.handoffs?.[0]?.state !== 'AWAITING_RECONCILIATION'
    || before.campaign?.mode !== 'LOCAL_PRIVATE'
    || beforeDocument?.dataMode !== 'LOCAL_PRIVATE'
    || beforeDocument?.graph?.organization?.displayName !== '星河工作室'
    || beforeDocument?.graph?.brands?.[0]?.name !== '星河'
    || beforeDocument?.graph?.products?.[0]?.name !== '星河翻译助手'
    || beforeDocument?.brief?.name !== '星河产品首发'
    || JSON.stringify(beforeDocument).includes('LumiClaw Presence local launch')
  ) throw new Error('SDD006_PRE_RESTART_LOCAL_PRIVATE_STATE_INVALID');
  checks.preRestartAuthoritativeLocalPrivateGraph = true;

  docker(['restart', 'postgres', 'api']);
  await waitHealthy();
  docker(['down']);
  docker(['up', '--detach']);
  await waitHealthy();
  const reopened = await fetch(`${apiUrl}/api/v1/local-workspace`).then((response) => response.json());
  if (
    reopened.profile?.displayName !== before.profile.displayName
    || reopened.session?.campaignId !== before.session.campaignId
    || reopened.session?.dataMode !== 'LOCAL_PRIVATE'
    || reopened.materials?.length !== 1
    || reopened.materials[0]?.digest !== before.materials[0].digest
    || reopened.materials[0]?.extractedText !== before.materials[0].extractedText
    || reopened.campaign?.document?.graph?.organization?.displayName !== '星河工作室'
    || reopened.campaign?.document?.brief?.name !== '星河产品首发'
    || reopened.handoffs?.[0]?.state !== 'AWAITING_RECONCILIATION'
  ) throw new Error('SDD006_RESTART_REOPEN_INVALID');
  checks.postgresAndBlobRestartReopen = true;

  const readiness = await fetch(`${apiUrl}/api/v1/environment-readiness`).then((response) => response.json());
  if (readiness.secretCollectionAllowed !== false || readiness.items.find((item) => item.service === 'POSTGRESQL')?.state !== 'AVAILABLE' || readiness.items.find((item) => item.service === 'AGENTTEAMS_RUNTIME')?.state !== 'NOT_CONFIGURED') throw new Error('SDD006_READINESS_CONTRACT_INVALID');
  checks.readinessTruthContract = true;
  const forbiddenTables = Number(postgresScalar("select count(*) from information_schema.tables where table_schema='public' and table_name in ('connectors','action_grants','action_outbox')"));
  if (forbiddenTables !== 0) throw new Error('SDD006_FORBIDDEN_ACTION_TABLE_PRESENT');
  checks.noActionCapableTables = true;
  result = 'PASS';
} catch (error) {
  failure = error instanceof Error ? error.message : 'UNKNOWN_SDD006_COMPOSE_FAILURE';
  throw error;
} finally {
  let cleanup = 'PASS';
  try { docker(['down', '--volumes', '--remove-orphans']); } catch { cleanup = 'FAIL'; }
  await writeFile(evidencePath, `${JSON.stringify({schemaVersion: 1, project, result, cleanup, generatedAt: new Date().toISOString(), checks, failure, events}, null, 2)}\n`);
}

console.info(JSON.stringify({status: result, evidence: '.evidence/sdd-006/compose-verification.json'}));
