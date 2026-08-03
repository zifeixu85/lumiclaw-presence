import {createDemoCampaignDocument, createUuidV7} from '@lumiclaw/domain';
import {afterEach, describe, expect, it} from 'vitest';
import {buildApi} from './server.js';

const apps = [] as ReturnType<typeof buildApi>[];
const now = () => new Date('2026-08-03T12:00:00.000Z');

afterEach(async () => { await Promise.all(apps.splice(0).map(async (app) => app.close())); });

describe('M1 Campaign API contract', () => {
  it('returns explicit PostgreSQL/non-live health and OpenAPI', async () => {
    const app = buildApi({now}); apps.push(app);
    expect((await app.inject({method: 'GET', url: '/health'})).json()).toEqual({service: 'api', status: 'ok', mode: 'DEMO_SEED', live: false, controlPlane: 'POSTGRESQL'});
    const openapi = await app.inject({method: 'GET', url: '/api/v1/openapi.json'});
    expect(openapi.json().openapi).toBe('3.1.0');
    expect(openapi.json().paths['/api/v1/campaigns']).toBeDefined();
    expect(openapi.json().components.schemas.CampaignDocument.properties.graph.additionalProperties).toBe(false);
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
  });
});
