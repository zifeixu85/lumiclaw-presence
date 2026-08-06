import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const project = 'lumiclaw-sdd002-api';
const apiUrl = 'http://127.0.0.1:4123';
const evidenceDir = path.join(root, '.evidence/sdd-002');
const checks = {};
const events = [];

function docker(args, inherit = false) {
  const command = ['docker', 'compose', '--project-name', project, ...args];
  const output = execFileSync('docker', command.slice(1), {cwd: root, encoding: 'utf8', stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], env: {...process.env, LUMICLAW_API_PORT: '4123', LUMICLAW_WEB_PORT: '3123'}});
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
  const impossibleDate = structuredClone(document);
  impossibleDate.brief.targetWindowStart = '2026-02-31T00:00:00Z';
  const impossibleDateResponse = await request('/api/v1/campaigns', {method: 'POST', headers: {...headers, 'idempotency-key': 'integration-invalid-calendar-date'}, body: JSON.stringify(impossibleDate)}, 422);
  if (impossibleDateResponse.body.code !== 'CAMPAIGN_VALIDATION_FAILED') throw new Error('Impossible RFC 3339 calendar date did not fail at the domain boundary.');
  checks.impossibleCalendarDateRejected = true;
  const created = await request('/api/v1/campaigns', {method: 'POST', headers, body: JSON.stringify(document)}, 201);
  checks.created = {id: created.body.document.id, version: created.body.version, digest: created.body.digest};
  const replay = await request('/api/v1/campaigns', {method: 'POST', headers, body: JSON.stringify(document)}, 200);
  if (replay.body.digest !== created.body.digest || replay.headers.get('idempotency-replayed') !== 'true') throw new Error('Create replay did not return the original result.');
  checks.createIdempotencyReplay = true;
  const changedCreate = structuredClone(document); changedCreate.brief.name = 'Different request body';
  await request('/api/v1/campaigns', {method: 'POST', headers, body: JSON.stringify(changedCreate)}, 409);
  checks.idempotencyKeyReuseRejected = true;
  const collidingCampaign = structuredClone(document);
  collidingCampaign.id = '018f0000-0000-7000-8000-000000000123';
  collidingCampaign.artifactRevisions.forEach((item) => { item.campaignId = collidingCampaign.id; });
  const collision = await request('/api/v1/campaigns', {method: 'POST', headers: {...headers, 'idempotency-key': 'integration-child-conflict'}, body: JSON.stringify(collidingCampaign)}, 422);
  if (collision.body.code !== 'CAMPAIGN_CHILD_ID_CONFLICT') throw new Error('Cross-Campaign child ID collision did not fail closed.');
  checks.crossCampaignChildIdRejected = true;
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
  const forgedSchedule = structuredClone(scheduleUpdate);
  forgedSchedule.scheduleOccurrences[0].scheduledForUtc = '2026-11-01T10:00:00.000Z';
  await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-forged-schedule', 'if-match': contentSaved.headers.get('etag')}, body: JSON.stringify(forgedSchedule)}, 422);
  checks.forgedOccurrenceRejected = true;
  const [saved, concurrentReplay] = await Promise.all([
    request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00002', 'if-match': contentSaved.headers.get('etag')}, body: JSON.stringify(scheduleUpdate)}, 200),
    request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00002', 'if-match': contentSaved.headers.get('etag')}, body: JSON.stringify(scheduleUpdate)}, 200)
  ]);
  if (saved.body.digest !== concurrentReplay.body.digest || new Set([saved.headers.get('idempotency-replayed'), concurrentReplay.headers.get('idempotency-replayed')]).size !== 2) throw new Error('Concurrent idempotent update did not serialize and replay the first result.');
  if (saved.body.version !== 3 || saved.body.document.publishingSchedules[0].status !== 'ACTIVE' || saved.body.document.publishingSchedules[0].id === schedulePreview.body.schedule.id) throw new Error('Schedule was not re-derived by the server against the exact saved artifact revision.');
  checks.saved = {version: saved.body.version, digest: saved.body.digest};
  await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-stale-00001', 'if-match': created.headers.get('etag')}, body: JSON.stringify(scheduleUpdate)}, 412);
  checks.staleEtagRejected = true;
  const editAfterSchedule = structuredClone(saved.body.document);
  editAfterSchedule.artifactRevisions.find((item) => item.platform === 'X').content.posts[0] = 'Persisted edit invalidates the schedule.';
  const invalidated = await request(`/api/v1/campaigns/${document.id}`, {method: 'PUT', headers: {...headers, 'idempotency-key': 'integration-save-00003', 'if-match': saved.headers.get('etag')}, body: JSON.stringify(editAfterSchedule)}, 200);
  if (invalidated.body.document.publishingSchedules[0].status !== 'INVALIDATED' || invalidated.body.document.scheduleOccurrences.some((item) => item.state === 'PENDING')) throw new Error('Content edit did not invalidate the schedule contract.');
  checks.schedule = {dstGapRejected: true, invalidZoneRejected: true, occurrences: schedulePreview.body.occurrences.length, serverDerivedOnSave: true, activePersistedBeforeEdit: true, invalidatedOnEdit: true};
  checks.concurrentIdempotencyReplay = true;
  const mission = await request(`/api/v1/campaigns/${document.id}/mission-contract`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (mission.body.digest !== invalidated.body.digest || mission.body.contract.sourceDigest !== invalidated.body.digest) throw new Error('Mission contract does not import the persisted digest.');
  checks.missionDigest = mission.body.digest;
  const shadowStarted = await request(`/api/v1/campaigns/${document.id}/shadow-missions`, {method: 'POST', headers: {...headers, 'idempotency-key': 'integration-shadow-start', 'if-match': invalidated.headers.get('etag')}, body: JSON.stringify({sourceDigest: invalidated.body.digest, fault: 'BETA_TO_GA'})}, 201);
  if (shadowStarted.body.mission.roleContexts.length !== 6 || shadowStarted.body.mission.tasks.length !== 8 || shadowStarted.body.mission.skillLocks.length !== 5 || shadowStarted.body.mission.externalActionAllowed !== false) throw new Error('SHADOW Mission did not compile to the exact six-role/eight-Task/five-skill no-action contract.');
  const shadowId = shadowStarted.body.mission.id;
  const flightHeaders = {'x-lumiclaw-organization-id': organizationId, 'idempotency-key': 'integration-shadow-flight', 'if-match': shadowStarted.headers.get('etag')};
  const shadowFlight = await request(`/api/v1/shadow-missions/${shadowId}/public-safe-flight`, {method: 'POST', headers: flightHeaders}, 200);
  const flightMission = shadowFlight.body.mission;
  if (shadowFlight.body.maturity !== 'MOCK_CONFORMANCE' || shadowFlight.body.realAgentTeamsClaim !== false || flightMission.revisions.length !== 5 || flightMission.audits.length !== 5 || flightMission.modelCalls.length !== 1 || flightMission.mediaAssets.length !== 1) throw new Error('Public-safe Flight maturity or provider/revision/audit evidence is incomplete.');
  if (flightMission.modelCalls[0].provider !== 'PUBLIC_SAFE_MOCK' || flightMission.modelCalls[0].secretPresent !== false || flightMission.mediaAssets[0].approvalState !== 'UNREVIEWED') throw new Error('Provider conformance evidence was mislabeled or auto-approved.');
  const failedAudit = flightMission.audits.find((item) => item.outcome === 'FAIL');
  if (failedAudit === undefined || failedAudit.status !== 'INVALIDATED' || failedAudit.issues[0]?.code !== 'CLAIM_OVERREACH') throw new Error('Frozen Claim fault was not independently rejected and invalidated after correction.');
  const shadowFlightReplay = await request(`/api/v1/shadow-missions/${shadowId}/public-safe-flight`, {method: 'POST', headers: flightHeaders}, 200);
  if (shadowFlightReplay.headers.get('idempotency-replayed') !== 'true' || shadowFlightReplay.body.mission.etag !== flightMission.etag) throw new Error('Flight idempotency did not replay the exact persisted response.');
  checks.shadowFlight = {roles: 6, tasks: 8, skills: 5, revisions: 5, audits: 5, modelCalls: 1, mediaAssets: 1, replayed: true};
  const deniedRevision = flightMission.revisions.find((item) => item.id === flightMission.fault.deniedRevisionId);
  const deniedReview = await request(`/api/v1/shadow-missions/${shadowId}/owner-reviews`, {method: 'POST', headers: {...headers, 'idempotency-key': 'integration-denied-review', 'if-match': shadowFlight.headers.get('etag')}, body: JSON.stringify({revisionId: deniedRevision.id, revisionDigest: deniedRevision.digest, decision: 'READY_FOR_FUTURE_EXECUTION'})}, 422);
  if (deniedReview.body.code !== 'REVIEW_AUDIT_PASS_REQUIRED') throw new Error('Failed Revision unexpectedly reached Owner Review.');
  const activePassIds = new Set(flightMission.audits.filter((item) => item.status === 'ACTIVE' && item.outcome === 'PASS').map((item) => item.revisionId));
  const reviewable = flightMission.revisions.filter((item) => activePassIds.has(item.id));
  if (reviewable.length !== 4 || new Set(reviewable.map((item) => item.platform)).size !== 4) throw new Error('Owner Review set is not the exact latest four-platform PASS set.');
  let reviewEtag = shadowFlight.headers.get('etag'); let finalReview = null; let finalReviewHeaders = null; let finalReviewBody = null;
  for (const [index, revision] of reviewable.entries()) {
    const reviewBody = {revisionId: revision.id, revisionDigest: revision.digest, decision: 'READY_FOR_FUTURE_EXECUTION'};
    const reviewHeaders = {...headers, 'idempotency-key': `integration-exact-review-${index + 1}`, 'if-match': reviewEtag};
    finalReview = await request(`/api/v1/shadow-missions/${shadowId}/owner-reviews`, {method: 'POST', headers: reviewHeaders, body: JSON.stringify(reviewBody)}, 200);
    reviewEtag = finalReview.headers.get('etag'); finalReviewHeaders = reviewHeaders; finalReviewBody = reviewBody;
  }
  if (finalReview.body.mission.state !== 'SHADOW_COMPLETE' || finalReview.body.mission.reviews.length !== 4 || finalReview.body.mission.actionGrantCount !== 0 || finalReview.body.mission.connectorCount !== 0 || finalReview.body.mission.externalActionCount !== 0) throw new Error('Exact four-platform Owner Review did not close SHADOW without action authority.');
  const finalReviewReplay = await request(`/api/v1/shadow-missions/${shadowId}/owner-reviews`, {method: 'POST', headers: finalReviewHeaders, body: JSON.stringify(finalReviewBody)}, 200);
  if (finalReviewReplay.headers.get('idempotency-replayed') !== 'true' || finalReviewReplay.body.mission.etag !== finalReview.body.mission.etag) throw new Error('Owner Review idempotency did not replay the exact response.');
  const publicEvidence = await request(`/api/v1/shadow-missions/${shadowId}/evidence`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (publicEvidence.body.evidence.maturity !== 'MOCK_CONFORMANCE' || publicEvidence.body.evidence.realAgentTeamsAcceptance !== false || publicEvidence.body.evidence.noAction.externalActionCount !== 0 || publicEvidence.body.evidence.ledgerHead === null) throw new Error('Public evidence export lacks mock truth-label, no-action proof, or replay ledger head.');
  checks.ownerReviewAndNoAction = {failedRevisionBlocked: true, exactPassRevisionsReviewed: 4, state: 'SHADOW_COMPLETE', actionGrants: 0, connectors: 0, externalActions: 0};
  docker(['restart', 'postgres', 'api']);
  await waitForApi();
  docker(['down']);
  docker(['up', '--detach', 'api']);
  await waitForApi();
  const reopened = await request(`/api/v1/campaigns/${document.id}`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (reopened.body.digest !== invalidated.body.digest || reopened.body.document.artifactRevisions.find((item) => item.platform === 'X').content.posts[0] !== 'Persisted edit invalidates the schedule.') throw new Error('Restart/down-up reopen lost Campaign state.');
  const reopenedShadow = await request(`/api/v1/shadow-missions/${shadowId}`, {headers: {'x-lumiclaw-organization-id': organizationId}}, 200);
  if (reopenedShadow.body.mission.state !== 'SHADOW_COMPLETE' || reopenedShadow.body.mission.reviews.length !== 4) throw new Error('Restart/down-up reopen lost governed SHADOW state.');
  checks.restartAndDownUpPersistence = true;
  const countSql = "SELECT (SELECT count(*) FROM campaigns),(SELECT count(*) FROM campaign_snapshots),(SELECT count(*) FROM artifact_revisions),(SELECT count(*) FROM idempotency_records),(SELECT count(*) FROM publishing_schedules),(SELECT count(*) FROM schedule_occurrences),(SELECT count(*) FROM missions),(SELECT count(*) FROM agent_runs),(SELECT count(*) FROM agent_tasks),(SELECT count(*) FROM skill_locks),(SELECT count(*) FROM governed_artifact_revisions),(SELECT count(*) FROM audit_decisions),(SELECT count(*) FROM owner_reviews),(SELECT count(*) FROM model_calls),(SELECT count(*) FROM media_assets),(SELECT count(*) FROM shadow_idempotency),(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('action_grants','connectors','action_outbox'))";
  const counts = docker(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At', '-F', ',', '-c', countSql]).trim().split(',').map(Number);
  if (counts[0] !== 1 || counts[1] !== 4 || counts[2] !== 6 || counts[3] !== 4 || counts[4] !== 1 || counts[5] !== 2 || counts[6] !== 1 || counts[7] !== 6 || counts[8] !== 8 || counts[9] !== 5 || counts[10] !== 5 || counts[11] !== 5 || counts[12] !== 4 || counts[13] !== 1 || counts[14] !== 1 || counts[15] !== 6 || counts[16] !== 0) throw new Error(`Unexpected persisted counts: ${counts.join(',')}`);
  checks.persistedCounts = {campaigns: counts[0], snapshots: counts[1], artifactRevisions: counts[2], idempotencyRecords: counts[3], publishingSchedules: counts[4], scheduleOccurrences: counts[5], missions: counts[6], agentRuns: counts[7], agentTasks: counts[8], skillLocks: counts[9], governedRevisions: counts[10], auditDecisions: counts[11], ownerReviews: counts[12], modelCalls: counts[13], mediaAssets: counts[14], shadowIdempotency: counts[15], forbiddenActionTables: counts[16]};
  result = 'PASS';
} catch (error) {
  primaryError = error instanceof Error ? error.message : 'UNKNOWN_API_INTEGRATION_ERROR';
  try {
    checks.failureDiagnostics = {apiLogs: docker(['logs', '--no-color', '--tail', '120', 'api'])};
    console.error(checks.failureDiagnostics.apiLogs);
  } catch {}
  throw error;
} finally {
  try { docker(['down', '--volumes', '--remove-orphans']); cleanup = 'PASS'; } catch {}
  await writeFile(path.join(evidenceDir, 'api-integration.json'), `${JSON.stringify({schemaVersion: '1.0.0', sdd: 'SDD-002', project, result, cleanup, generatedAt: new Date().toISOString(), checks, primaryError, events}, null, 2)}\n`);
}

console.info(JSON.stringify({status: result, cleanup, evidence: '.evidence/sdd-002/api-integration.json'}));
