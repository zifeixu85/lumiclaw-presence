import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const project = 'lumiclaw-sdd001-api';
const apiUrl = 'http://127.0.0.1:4121';
const evidenceDir = path.join(root, '.evidence/sdd-001');
const checks = {};
const events = [];

function docker(args, inherit = false) {
  const command = ['docker', 'compose', '--project-name', project, ...args];
  const output = execFileSync('docker', command.slice(1), {cwd: root, encoding: 'utf8', stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], env: {...process.env, LUMICLAW_API_PORT: '4121', LUMICLAW_WEB_PORT: '3121'}});
  events.push({command, result: 'PASS'});
  return output ?? '';
}

async function waitForApi(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('API did not become healthy.');
}

async function request(url, init, expected) {
  const response = await fetch(`${apiUrl}${url}`, init);
  const body = await response.json();
  if (response.status !== expected) throw new Error(`${init?.method ?? 'GET'} ${url}: expected ${expected}, got ${response.status} ${JSON.stringify(body)}`);
  return {body, headers: response.headers};
}

await mkdir(evidenceDir, {recursive: true});
let result = 'FAIL';
let primaryError = null;
let cleanup = 'FAIL';
try {
  docker(['down', '--volumes', '--remove-orphans']);
  docker(['up', '--build', '--detach', 'api'], true);
  await waitForApi();
  const template = await request('/api/v1/campaigns/demo-template', undefined, 200);
  const document = template.body.document;
  const organizationId = document.organizationId;
  const headers = {'content-type': 'application/json', 'x-lumiclaw-organization-id': organizationId, 'idempotency-key': 'integration-create-0001'};
  const created = await request('/api/v1/campaigns', {method: 'POST', headers, body: JSON.stringify(document)}, 201);
  checks.created = {id: created.body.document.id, version: created.body.version, digest: created.body.digest};
  const replay = await request('/api/v1/campaigns', {method: 'POST', headers, body: JSON.stringify(document)}, 200);
  if (replay.body.digest !== created.body.digest || replay.headers.get('idempotency-replayed') !== 'true') throw new Error('Create replay did not return the original result.');
  checks.createIdempotencyReplay = true;
  const changedCreate = structuredClone(document); changedCreate.brief.name = 'Different request body';
  await request('/api/v1/campaigns', {method: 'POST', headers, body: JSON.stringify(changedCreate)}, 409);
  checks.idempotencyKeyReuseRejected = true;
  const wrongTenant = '018f0000-0000-7000-8000-000000000099';
  await request(`/api/v1/campaigns/${document.id}`, {headers: {'x-lumiclaw-organization-id': wrongTenant}}, 404);
  checks.crossTenantHidden = true;
  const invalid = structuredClone(created.body.document); invalid.claims[0].subjectId = invalid.graph.identities[0].id;
  await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-invalid-0001', 'if-match': created.headers.get('etag')}, body: JSON.stringify(invalid)}, 422);
  checks.invalidProductScopeRejected = true;
  const update = structuredClone(created.body.document);
  const x = update.artifactRevisions.find((item) => item.platform === 'X');
  x.content.posts[0] = 'Persisted X integration edit.';
  const saved = await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00001', 'if-match': created.headers.get('etag')}, body: JSON.stringify(update)}, 200);
  if (saved.body.version !== 2 || saved.body.digest === created.body.digest) throw new Error('Save did not advance version/digest.');
  checks.saved = {version: saved.body.version, digest: saved.body.digest};
  await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-stale-00001', 'if-match': created.headers.get('etag')}, body: JSON.stringify(update)}, 412);
  checks.staleEtagRejected = true;
  const mission = await request(`/api/v1/campaigns/${document.id}/mission-contract`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (mission.body.digest !== saved.body.digest || mission.body.contract.sourceDigest !== saved.body.digest) throw new Error('Mission contract does not import the persisted digest.');
  checks.missionDigest = mission.body.digest;
  docker(['restart', 'postgres', 'api']);
  await waitForApi();
  docker(['down']);
  docker(['up', '--detach', 'api']);
  await waitForApi();
  const reopened = await request(`/api/v1/campaigns/${document.id}`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (reopened.body.digest !== saved.body.digest || reopened.body.document.artifactRevisions.find((item) => item.platform === 'X').content.posts[0] !== 'Persisted X integration edit.') throw new Error('Restart/down-up reopen lost Campaign state.');
  checks.restartAndDownUpPersistence = true;
  const counts = docker(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At', '-F', ',', '-c', 'SELECT (SELECT count(*) FROM campaigns),(SELECT count(*) FROM campaign_snapshots),(SELECT count(*) FROM artifact_revisions),(SELECT count(*) FROM idempotency_records)']).trim().split(',').map(Number);
  if (counts[0] !== 1 || counts[1] !== 2 || counts[2] !== 5 || counts[3] !== 2) throw new Error(`Unexpected persisted counts: ${counts.join(',')}`);
  checks.persistedCounts = {campaigns: counts[0], snapshots: counts[1], artifactRevisions: counts[2], idempotencyRecords: counts[3]};
  result = 'PASS';
} catch (error) {
  primaryError = error instanceof Error ? error.message : 'UNKNOWN_API_INTEGRATION_ERROR';
  throw error;
} finally {
  try { docker(['down', '--volumes', '--remove-orphans']); cleanup = 'PASS'; } catch {}
  await writeFile(path.join(evidenceDir, 'api-integration.json'), `${JSON.stringify({schemaVersion: '1.0.0', sdd: 'SDD-001', project, result, cleanup, generatedAt: new Date().toISOString(), checks, primaryError, events}, null, 2)}\n`);
}

console.info(JSON.stringify({status: result, cleanup, evidence: '.evidence/sdd-001/api-integration.json'}));
