import {createDemoCampaignDocument} from '@lumiclaw/domain';
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
});
