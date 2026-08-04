import {createDemoCampaignDocument, createUuidV7, sha256Digest} from '@lumiclaw/domain';
import {AGENTTEAMS_V120_BUILD_DIGEST, runtimeDagDigest, runtimeMemberSetDigest, runtimeProjectDispatchReceiptDigest, runtimeTaskAckReceiptDigest, runtimeTaskSubmissionReceiptDigest, type ShadowMission, type TaskContract} from '@lumiclaw/governed-shadow';
import {afterEach, describe, expect, it} from 'vitest';
import {buildApi} from './server.js';

const apps = [] as ReturnType<typeof buildApi>[];
const now = () => new Date('2026-08-03T12:00:00.000Z');
const runtimeImportTestToken = 'public-safe-runtime-import-test-token-v1';

function projectReceipt(mission: ShadowMission) {
  const memberBindings = mission.roleContexts.map((context) => ({roleId: context.roleId, roleIdentityId: context.identityId, runtimeActorId: `@${context.roleId}:runtime.test`}));
  const base = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, runtimeVersion: 'v1.2.0' as const, buildDigest: AGENTTEAMS_V120_BUILD_DIGEST, memberBindings, memberSetDigest: runtimeMemberSetDigest(memberBindings), dagDigest: runtimeDagDigest(mission), dispatchedAt: now().toISOString()};
  return {...base, receiptDigest: runtimeProjectDispatchReceiptDigest(base)};
}

function ackReceipt(mission: ShadowMission, task: TaskContract) {
  const runtimeActorId = mission.runtimeProjectDispatch!.memberBindings.find((item) => item.roleId === task.roleId)!.runtimeActorId;
  const base = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId, attempt: task.attempt, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest!, runtimeState: 'in_progress' as const, acknowledgedAt: now().toISOString()};
  return {...base, receiptDigest: runtimeTaskAckReceiptDigest(base)};
}

function taskSubmission(mission: ShadowMission, task: TaskContract, payload: unknown) {
  const current = mission.tasks.find((item) => item.id === task.id)!; const outputDigest = sha256Digest(payload);
  const resultDigest = sha256Digest({schemaVersion: 1, taskId: task.id, roleId: task.roleId, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest, payload, outputDigest, maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false});
  const base = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId: current.runtimeAck!.runtimeActorId, attempt: task.attempt, ackReceiptDigest: current.runtimeAck!.receiptDigest, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest!, runtimeState: 'submitted' as const, submittedAt: now().toISOString(), resultDigest, resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY' as const, runtimeObservationId: sha256Digest({taskId: task.id, resultDigest, inputProjectionDigest: task.inputProjectionDigest, source: 'test-persisted-summary'})};
  return {schemaVersion: 1 as const, missionId: mission.id, taskId: task.id, roleId: task.roleId, roleIdentityId: task.roleIdentityId, inputDigest: task.inputDigest, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest!, skillLockDigest: task.skillLockDigest, outputSchema: task.outputSchema, outputSchemaVersion: 1 as const, payload, outputDigest, runtimeResultMaturity: 'MOCK_CONFORMANCE' as const, runtimeReceipt: {...base, receiptDigest: runtimeTaskSubmissionReceiptDigest(base)}};
}

afterEach(async () => { await Promise.all(apps.splice(0).map(async (app) => app.close())); });

describe('M1 Campaign API contract', () => {
  it('returns explicit PostgreSQL/non-live health and OpenAPI', async () => {
    const app = buildApi({now}); apps.push(app);
    expect((await app.inject({method: 'GET', url: '/health'})).json()).toEqual({service: 'api', status: 'ok', mode: 'DEMO_SEED', live: false, controlPlane: 'POSTGRESQL'});
    const openapi = await app.inject({method: 'GET', url: '/api/v1/openapi.json'});
    expect(openapi.json().openapi).toBe('3.1.0');
    expect(openapi.json().paths['/api/v1/campaigns']).toBeDefined();
    expect(openapi.json().paths['/api/v1/campaigns/{campaignId}/shadow-missions']).toBeDefined();
    expect(openapi.json().paths['/api/v1/shadow-missions/{missionId}/runtime-events']).toBeDefined();
    expect(openapi.json().components.schemas.CampaignDocument.properties.graph.additionalProperties).toBe(false);
  });

  it('queues, runs, reopens and exactly reviews a governed SHADOW Mission without action authority', async () => {
    const app = buildApi({now}); apps.push(app); const document = createDemoCampaignDocument();
    const baseHeaders = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'campaign-for-shadow'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: baseHeaders, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...baseHeaders, 'idempotency-key': 'shadow-start-0001', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA'}});
    expect(started.statusCode).toBe(201); expect(started.json().mission).toMatchObject({runtimeVersion: 'v1.2.0', state: 'QUEUED', externalActionAllowed: false}); expect(started.json().mission.roleContexts).toHaveLength(6);
    const missionId = started.json().mission.id;
    const flight = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/public-safe-flight`, headers: {...baseHeaders, 'idempotency-key': 'flight-run-00001', 'if-match': started.headers.etag!}});
    expect(flight.statusCode).toBe(200); expect(flight.json()).toMatchObject({maturity: 'MOCK_CONFORMANCE', realAgentTeamsClaim: false}); expect(flight.json().mission).toMatchObject({state: 'NEEDS_OWNER_REVIEW', actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(flight.json().mission.modelCalls).toHaveLength(1); expect(flight.json().mission.modelCalls[0]).toMatchObject({provider: 'PUBLIC_SAFE_MOCK', maturity: 'MOCK_CONFORMANCE', secretPresent: false});
    expect(flight.json().mission.mediaAssets).toHaveLength(1); expect(flight.json().mission.mediaAssets[0]).toMatchObject({provider: 'PUBLIC_SAFE_MOCK', approvalState: 'UNREVIEWED'});
    const flightReplay = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/public-safe-flight`, headers: {...baseHeaders, 'idempotency-key': 'flight-run-00001', 'if-match': started.headers.etag!}});
    expect(flightReplay.statusCode).toBe(200); expect(flightReplay.headers['idempotency-replayed']).toBe('true'); expect(flightReplay.json().mission.etag).toBe(flight.json().mission.etag);
    const denied = flight.json().mission.revisions.find((item: {id: string}) => item.id === flight.json().mission.fault.deniedRevisionId);
    const deniedReview = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/owner-reviews`, headers: {...baseHeaders, 'idempotency-key': 'denied-review-01', 'if-match': flight.headers.etag!}, payload: {revisionId: denied.id, revisionDigest: denied.digest, decision: 'READY_FOR_FUTURE_EXECUTION'}});
    expect(deniedReview.statusCode).toBe(422); expect(deniedReview.json().code).toBe('REVIEW_AUDIT_PASS_REQUIRED');
    const corrected = flight.json().mission.revisions.find((item: {id: string}) => item.id === flight.json().mission.fault.correctedRevisionId);
    const reviewed = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/owner-reviews`, headers: {...baseHeaders, 'idempotency-key': 'exact-review-001', 'if-match': flight.headers.etag!}, payload: {revisionId: corrected.id, revisionDigest: corrected.digest, decision: 'READY_FOR_FUTURE_EXECUTION'}});
    expect(reviewed.statusCode).toBe(200); expect(reviewed.json()).toMatchObject({createsActionGrant: false, externalActionAllowed: false}); expect(reviewed.json().mission.reviews[0]).toMatchObject({authority: 'NON_EXECUTABLE_OWNER_REVIEW', createsActionGrant: false});
    const reviewReplay = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/owner-reviews`, headers: {...baseHeaders, 'idempotency-key': 'exact-review-001', 'if-match': flight.headers.etag!}, payload: {revisionId: corrected.id, revisionDigest: corrected.digest, decision: 'READY_FOR_FUTURE_EXECUTION'}});
    expect(reviewReplay.statusCode).toBe(200); expect(reviewReplay.headers['idempotency-replayed']).toBe('true'); expect(reviewReplay.json().mission.etag).toBe(reviewed.json().mission.etag);
    const evidence = await app.inject({method: 'GET', url: `/api/v1/shadow-missions/${missionId}/evidence`, headers: baseHeaders});
    expect(evidence.json().evidence.noAction).toEqual({externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
  });

  it('persists adapter Project/ACK/Submit events and quarantines duplicate accepted Runtime output', async () => {
    const app = buildApi({now, runtimeImportToken: runtimeImportTestToken}); apps.push(app); const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-import-token': runtimeImportTestToken, 'idempotency-key': 'runtime-campaign'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': 'runtime-start-001', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA'}});
    const missionId = started.json().mission.id; const route = `/api/v1/shadow-missions/${missionId}/runtime-events`;
    const initialTask = started.json().mission.tasks.find((item: {roleId: string}) => item.roleId === 'presence-mission-leader'); const initialPayload = {projectId: started.json().mission.runtimeProjectId, externalActionAllowed: false}; const initialOutputDigest = sha256Digest(initialPayload);
    const forgedResultDigest = sha256Digest({schemaVersion: 1, taskId: initialTask.id, roleId: initialTask.roleId, inputProjectionSchema: initialTask.inputProjectionSchema, inputProjectionDigest: initialTask.inputProjectionDigest, payload: initialPayload, outputDigest: initialOutputDigest, maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false});
    const forgedBeforeDispatch = {schemaVersion: 1, missionId, taskId: initialTask.id, roleId: initialTask.roleId, roleIdentityId: initialTask.roleIdentityId, inputDigest: initialTask.inputDigest, inputProjectionSchema: initialTask.inputProjectionSchema, inputProjectionDigest: initialTask.inputProjectionDigest, skillLockDigest: initialTask.skillLockDigest, outputSchema: initialTask.outputSchema, outputSchemaVersion: 1, payload: initialPayload, outputDigest: initialOutputDigest, runtimeResultMaturity: 'MOCK_CONFORMANCE', runtimeReceipt: {schemaVersion: 1, projectId: started.json().mission.runtimeProjectId, taskId: initialTask.id, roleId: initialTask.roleId, runtimeActorId: '@presence-mission-leader:runtime.test', attempt: 1, ackReceiptDigest: '0'.repeat(64), inputProjectionSchema: initialTask.inputProjectionSchema, inputProjectionDigest: initialTask.inputProjectionDigest, runtimeState: 'submitted', submittedAt: now().toISOString(), resultDigest: forgedResultDigest, resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY', runtimeObservationId: '0'.repeat(64), receiptDigest: '0'.repeat(64)}};
    const dispatchReceipt = projectReceipt(started.json().mission as ShadowMission);
    const unauthenticated = await app.inject({method: 'POST', url: route, headers: {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'runtime-no-auth-01', 'if-match': started.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: dispatchReceipt}});
    expect(unauthenticated.statusCode).toBe(403); expect(unauthenticated.json().code).toBe('RUNTIME_IMPORT_AUTH_REQUIRED');
    const rejectedBeforeDispatch = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-forged-01', 'if-match': started.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission: forgedBeforeDispatch}}); expect(rejectedBeforeDispatch.statusCode).toBe(422); expect(rejectedBeforeDispatch.json().mission.trace.at(-1).detail.errors).toContain('PROJECT_NOT_DISPATCHED');
    const dispatched = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-project-1', 'if-match': rejectedBeforeDispatch.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: dispatchReceipt}});
    expect(dispatched.statusCode).toBe(200); expect(dispatched.json().mission.state).toBe('RUNNING');
    const task = dispatched.json().mission.tasks.find((item: {roleId: string}) => item.roleId === 'presence-mission-leader');
    const rejectedBeforeAck = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-forged-02', 'if-match': dispatched.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission: forgedBeforeDispatch}}); expect(rejectedBeforeAck.statusCode).toBe(422); expect(rejectedBeforeAck.json().mission.trace.at(-1).detail.errors).toContain('TASK_NOT_ACKNOWLEDGED');
    const exactAckReceipt = ackReceipt(dispatched.json().mission as ShadowMission, task as TaskContract);
    const ack = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-ack-0001', 'if-match': rejectedBeforeAck.headers.etag!}, payload: {kind: 'TASK_ACK', receipt: exactAckReceipt}});
    expect(ack.statusCode).toBe(200); expect(ack.json().mission.tasks.find((item: {id: string}) => item.id === task.id).state).toBe('ACKNOWLEDGED');
    const payload = {projectId: ack.json().mission.runtimeProjectId, externalActionAllowed: false};
    const submission = taskSubmission(ack.json().mission as ShadowMission, task as TaskContract, payload);
    const submitted = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-submit-01', 'if-match': ack.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission}});
    expect(submitted.statusCode).toBe(200); expect(submitted.json().mission.tasks.find((item: {id: string}) => item.id === task.id).state).toBe('ACCEPTED');
    const duplicate = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-submit-02', 'if-match': submitted.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission}});
    expect(duplicate.statusCode).toBe(422); expect(duplicate.json()).toMatchObject({code: 'RUNTIME_SUBMISSION_QUARANTINED', accepted: false}); expect(duplicate.json().mission.trace.at(-1).detail.errors).toContain('DUPLICATE_ACCEPTED_SUBMISSION');
    const duplicateReplay = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-submit-02', 'if-match': submitted.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission}});
    expect(duplicateReplay.statusCode).toBe(422); expect(duplicateReplay.headers['idempotency-replayed']).toBe('true'); expect(duplicateReplay.json()).toMatchObject({code: 'RUNTIME_SUBMISSION_QUARANTINED_REPLAYED', accepted: false, realAgentTeamsClaim: false});
    const secondDispatch = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-project-2', 'if-match': duplicate.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: {...dispatchReceipt, buildDigest: `sha256:${'b'.repeat(64)}`}}});
    expect(secondDispatch.statusCode).toBe(409); expect(secondDispatch.json()).toMatchObject({code: 'RUNTIME_PROJECT_ALREADY_DISPATCHED'});
  });

  it('creates, replays, reopens, saves, and returns the same mission source digest', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'create-campaign-001'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    expect(created.statusCode).toBe(201);
    const first = created.json();
    const replay = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    expect(replay.statusCode).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    const reopened = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}`, headers: {'x-lumiclaw-organization-id': document.organizationId}});
    expect(reopened.json().digest).toBe(first.digest);
    const updatedDocument = reopened.json().document;
    const x = updatedDocument.artifactRevisions.find((item: {platform: string}) => item.platform === 'X');
    x.content.posts[0] = 'Updated synthetic X copy.';
    const saved = await app.inject({method: 'PUT', url: `/api/v1/campaigns/${document.id}`, headers: {...headers, 'idempotency-key': 'save-campaign-0001', 'if-match': reopened.headers.etag!}, payload: updatedDocument});
    expect(saved.statusCode).toBe(200);
    expect(saved.json().version).toBe(2);
    expect(saved.json().document.artifactRevisions.find((item: {platform: string}) => item.platform === 'X').revision).toBe(2);
    const mission = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}/mission-contract`, headers: {'x-lumiclaw-organization-id': document.organizationId}});
    expect(mission.json().digest).toBe(saved.json().digest);
    expect(mission.json().contract.sourceDigest).toBe(saved.json().digest);
  });

  it('fails closed for missing controls, key reuse, stale ETag, and cross-tenant scope', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument();
    expect((await app.inject({method: 'GET', url: '/api/v1/campaigns'})).statusCode).toBe(428);
    const orgHeaders = {'x-lumiclaw-organization-id': document.organizationId};
    expect((await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: orgHeaders, payload: document})).statusCode).toBe(428);
    const headers = {...orgHeaders, 'idempotency-key': 'fixed-key-0001'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const changed = structuredClone(document); changed.brief.name = 'Different body'; changed.missionContract.sourceDigest = 'f'.repeat(64);
    expect((await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: changed})).statusCode).toBe(409);
    expect((await app.inject({method: 'PUT', url: `/api/v1/campaigns/${document.id}`, headers: {...headers, 'idempotency-key': 'save-key-00001', 'if-match': '"stale"'}, payload: document})).statusCode).toBe(412);
    expect((await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}`, headers: {'x-lumiclaw-organization-id': document.graph.identities[0]!.id}})).statusCode).toBe(404);
    expect(created.headers.etag).toMatch(/^"campaign-/u);
  });

  it('returns a domain rejection rather than availability failure for malformed nested contracts', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument() as unknown as {organizationId: string; artifactRevisions: unknown[]};
    document.artifactRevisions[0] = {};
    const response = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'malformed-campaign'}, payload: document});
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('CAMPAIGN_VALIDATION_FAILED');
  });

  it('rejects forged initial approval, capability, artifact metadata, and invalid timestamps', async () => {
    const app = buildApi({now}); apps.push(app);
    const cases = [
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.claims[1]!.status = 'APPROVED'; document.claims[1]!.version = 99; document.claims[1]!.evidenceRefIds = [document.evidenceRefs[0]!.id]; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.capabilitySnapshots[0]!.constraints.posts!.maxLength = 99_999; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.artifactRevisions[0]!.revision = 99; document.artifactRevisions[0]!.createdAt = '2026-08-03T01:00:00.000Z'; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.evidenceRefs[0]!.capturedAt = 'not-a-date'; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.brief.targetWindowStart = '2026-02-31T00:00:00Z'; }
    ];
    for (const [index, mutate] of cases.entries()) {
      const document = createDemoCampaignDocument(); mutate(document);
      const response = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': `forged-create-${index}`}, payload: document});
      expect(response.statusCode).toBe(422);
      expect(response.json().code).toBe(index >= cases.length - 2 ? 'CAMPAIGN_VALIDATION_FAILED' : 'CAMPAIGN_AUTHORITY_FIELD_CHANGED');
    }
  });

  it('rejects campaign-scoped child IDs already owned by another Campaign in the tenant', async () => {
    const app = buildApi({now}); apps.push(app);
    const first = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': first.organizationId, 'idempotency-key': 'first-child-owner'};
    expect((await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: first})).statusCode).toBe(201);
    const second = structuredClone(first);
    second.id = createUuidV7(1_788_100_100_000, new Uint8Array(10).fill(77));
    second.artifactRevisions.forEach((item) => { item.campaignId = second.id; });
    const response = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {...headers, 'idempotency-key': 'second-child-owner'}, payload: second});
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('CAMPAIGN_CHILD_ID_CONFLICT');
  });

  it('previews persistent schedule rows while rejecting DST gaps and never enabling execution', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'create-for-schedule'};
    await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const preview = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/schedule-preview`, headers, payload: {localStart: '2026-11-01T01:30', timeZone: 'America/New_York', rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=2', foldPreference: 'LATER', misfirePolicy: 'SKIP'}});
    expect(preview.statusCode).toBe(200);
    expect(preview.json().executionAllowed).toBe(false);
    expect(preview.json().occurrences).toHaveLength(2);
    const gap = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/schedule-preview`, headers, payload: {localStart: '2026-03-08T02:30', timeZone: 'America/New_York', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'}});
    expect(gap.statusCode).toBe(422);
    expect(gap.json().code).toBe('DST_GAP');
    const forged = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/schedule-preview`, headers, payload: {localStart: '2026-09-01T09:00', timeZone: 'UTC', foldPreference: 'EARLIER', misfirePolicy: 'SKIP', organizationId: document.graph.identities[0]!.id}});
    expect(forged.statusCode).toBe(422);
    expect(forged.json().details[0].code).toBe('SCHEMA_INVALID');
  });

  it('re-derives time-bound readiness on reopen without changing the stored digest', async () => {
    let instant = new Date('2026-08-03T12:00:00.000Z');
    const clock = () => instant;
    const app = buildApi({now: clock}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'time-readiness-001'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const digest = created.json().digest;
    instant = new Date('2027-02-01T00:00:00.000Z');
    const reopened = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}`, headers});
    expect(reopened.json().readiness).toBe('BLOCKED');
    expect(reopened.json().gapCodes).toContain('CLAIM_EXPIRED');
    expect(reopened.json().digest).toBe(digest);
    const list = await app.inject({method: 'GET', url: '/api/v1/campaigns', headers});
    expect(list.json().campaigns[0].readiness).toBe('BLOCKED');
    const mission = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}/mission-contract`, headers});
    expect(mission.statusCode).toBe(409);
    expect(mission.json().code).toBe('CAMPAIGN_BLOCKED');
    expect(mission.json().digest).toBe(digest);
    const blockedStart = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': 'blocked-shadow-start', 'if-match': created.headers.etag!}, payload: {sourceDigest: digest, fault: 'BETA_TO_GA'}});
    expect(blockedStart.statusCode).toBe(409);
    expect(blockedStart.json()).toMatchObject({code: 'CAMPAIGN_BLOCKED', digest, gapCodes: expect.arrayContaining(['CLAIM_EXPIRED'])});
  });

  it('re-checks Campaign freshness immediately before authenticated Project dispatch', async () => {
    let instant = new Date('2026-08-03T12:00:00.000Z');
    const clock = () => instant;
    const app = buildApi({now: clock, runtimeImportToken: runtimeImportTestToken}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-import-token': runtimeImportTestToken, 'idempotency-key': 'dispatch-freshness-campaign'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': 'dispatch-freshness-start', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA'}});
    expect(started.statusCode).toBe(201);
    instant = new Date('2027-02-01T00:00:00.000Z');
    const blockedDispatch = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${started.json().mission.id}/runtime-events`, headers: {...headers, 'idempotency-key': 'dispatch-after-expiry', 'if-match': started.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: projectReceipt(started.json().mission)}});
    expect(blockedDispatch.statusCode).toBe(409);
    expect(blockedDispatch.json()).toMatchObject({code: 'CAMPAIGN_BLOCKED', gapCodes: expect.arrayContaining(['CLAIM_EXPIRED'])});
  });
});
