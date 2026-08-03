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
  const contentUpdate = structuredClone(created.body.document);
  const x = contentUpdate.artifactRevisions.find((item) => item.platform === 'X');
  x.content.posts[0] = 'Persisted X integration edit.';
  const contentSaved = await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00001', 'if-match': created.headers.get('etag')}, body: JSON.stringify(contentUpdate)}, 200);
  if (contentSaved.body.version !== 2 || contentSaved.body.digest === created.body.digest) throw new Error('Content save did not advance version/digest.');
  await request(`/api/v1/campaigns/${document.id}/schedule-preview`, {method: 'POST', headers: {'content-type': 'application/json', 'x-lumiclaw-organization-id': organizationId}, body: JSON.stringify({localStart: '2026-03-08T02:30', timeZone: 'America/New_York', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'})}, 422);
  await request(`/api/v1/campaigns/${document.id}/schedule-preview`, {method: 'POST', headers: {'content-type': 'application/json', 'x-lumiclaw-organization-id': organizationId}, body: JSON.stringify({localStart: '2026-09-01T09:00', timeZone: 'Invalid/Zone', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'})}, 422);
  const schedulePreview = await request(`/api/v1/campaigns/${document.id}/schedule-preview`, {method: 'POST', headers: {'content-type': 'application/json', 'x-lumiclaw-organization-id': organizationId}, body: JSON.stringify({localStart: '2026-11-01T01:30', timeZone: 'America/New_York', rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=2', foldPreference: 'LATER', misfirePolicy: 'HOLD_FOR_OWNER'})}, 200);
  const scheduleUpdate = structuredClone(contentSaved.body.document);
  scheduleUpdate.publishingSchedules.push(schedulePreview.body.schedule);
  scheduleUpdate.scheduleOccurrences.push(...schedulePreview.body.occurrences);
  const [saved, concurrentReplay] = await Promise.all([
    request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00002', 'if-match': contentSaved.headers.get('etag')}, body: JSON.stringify(scheduleUpdate)}, 200),
    request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00002', 'if-match': contentSaved.headers.get('etag')}, body: JSON.stringify(scheduleUpdate)}, 200)
  ]);
  if (saved.body.digest !== concurrentReplay.body.digest || new Set([saved.headers.get('idempotency-replayed'), concurrentReplay.headers.get('idempotency-replayed')]).size !== 2) throw new Error('Concurrent idempotent update did not serialize and replay the first result.');
  if (saved.body.version !== 3 || saved.body.document.publishingSchedules[0].status !== 'ACTIVE') throw new Error('Schedule did not persist against the exact saved artifact revision.');
  checks.saved = {version: saved.body.version, digest: saved.body.digest};
  await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-stale-00001', 'if-match': created.headers.get('etag')}, body: JSON.stringify(scheduleUpdate)}, 412);
  checks.staleEtagRejected = true;
  const editAfterSchedule = structuredClone(saved.body.document);
  editAfterSchedule.artifactRevisions.find((item) => item.platform === 'X').content.posts[0] = 'Persisted edit invalidates the schedule.';
  const invalidated = await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00003', 'if-match': saved.headers.get('etag')}, body: JSON.stringify(editAfterSchedule)}, 200);
  if (invalidated.body.document.publishingSchedules[0].status !== 'INVALIDATED' || invalidated.body.document.scheduleOccurrences.some((item) => item.state === 'PENDING')) throw new Error('Content edit did not invalidate the schedule contract.');
  checks.schedule = {dstGapRejected: true, invalidZoneRejected: true, occurrences: schedulePreview.body.occurrences.length, activePersistedBeforeEdit: true, invalidatedOnEdit: true};
  checks.concurrentIdempotencyReplay = true;
  const mission = await request(`/api/v1/campaigns/${document.id}/mission-contract`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (mission.body.digest !== invalidated.body.digest || mission.body.contract.sourceDigest !== invalidated.body.digest) throw new Error('Mission contract does not import the persisted digest.');
  checks.missionDigest = mission.body.digest;
  docker(['restart', 'postgres', 'api']);
  await waitForApi();
  docker(['down']);
  docker(['up', '--detach', 'api']);
  await waitForApi();
  const reopened = await request(`/api/v1/campaigns/${document.id}`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (reopened.body.digest !== invalidated.body.digest || reopened.body.document.artifactRevisions.find((item) => item.platform === 'X').content.posts[0] !== 'Persisted edit invalidates the schedule.') throw new Error('Restart/down-up reopen lost Campaign state.');
  checks.restartAndDownUpPersistence = true;
  const counts = docker(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At', '-F', ',', '-c', 'SELECT (SELECT count(*) FROM campaigns),(SELECT count(*) FROM campaign_snapshots),(SELECT count(*) FROM artifact_revisions),(SELECT count(*) FROM idempotency_records),(SELECT count(*) FROM publishing_schedules),(SELECT count(*) FROM schedule_occurrences)']).trim().split(',').map(Number);
  if (counts[0] !== 1 || counts[1] !== 4 || counts[2] !== 6 || counts[3] !== 4 || counts[4] !== 1 || counts[5] !== 2) throw new Error(`Unexpected persisted counts: ${counts.join(',')}`);
  checks.persistedCounts = {campaigns: counts[0], snapshots: counts[1], artifactRevisions: counts[2], idempotencyRecords: counts[3], publishingSchedules: counts[4], scheduleOccurrences: counts[5]};
  result = 'PASS';
} catch (error) {
  primaryError = error instanceof Error ? error.message : 'UNKNOWN_API_INTEGRATION_ERROR';
  throw error;
} finally {
  try { docker(['down', '--volumes', '--remove-orphans']); cleanup = 'PASS'; } catch {}
  await writeFile(path.join(evidenceDir, 'api-integration.json'), `${JSON.stringify({schemaVersion: '1.0.0', sdd: 'SDD-001', project, result, cleanup, generatedAt: new Date().toISOString(), checks, primaryError, events}, null, 2)}\n`);
}

console.info(JSON.stringify({status: result, cleanup, evidence: '.evidence/sdd-001/api-integration.json'}));
