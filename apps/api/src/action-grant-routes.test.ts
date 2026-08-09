import {beforeAll, describe, expect, it, afterAll} from 'vitest';
import {buildApi} from './server.js';
import type {FastifyInstance} from 'fastify';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCampaign(app: FastifyInstance): Promise<{orgId: string; id: string; etag: string}> {
  const tpl = await app.inject({method: 'GET', url: '/api/v1/campaigns/demo-template'});
  const doc = JSON.parse(tpl.body).document;
  const orgId = doc.organizationId;
  const h = mkHeaders(orgId);
  const res = await app.inject({
    method: 'POST', url: '/api/v1/campaigns',
    headers: {...h, 'idempotency-key': `seed-${Date.now()}`}, body: doc,
  });
  const body = JSON.parse(res.body);
  return {orgId, id: body.document.id, etag: body.etag};
}

function mkHeaders(orgId: string, extra: Record<string, string> = {}): Record<string, string> {
  return {'content-type': 'application/json', 'x-lumiclaw-organization-id': orgId, ...extra};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('action grant routes', () => {
  let app: FastifyInstance;
  let campaign: {orgId: string; id: string; etag: string};

  beforeAll(async () => {
    app = buildApi();
    campaign = await seedCampaign(app);
  });

  afterAll(async () => app.close());

  function h(extra: Record<string, string> = {}): Record<string, string> {
    return {'x-lumiclaw-organization-id': campaign.orgId, ...extra};
  }

  // -----------------------------------------------------------------------
  // POST /action-grants
  // -----------------------------------------------------------------------

  describe('POST /api/v1/campaigns/:campaignId/action-grants', () => {
    it('creates an ActionGrant → 201', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h({'idempotency-key': `p1-${Date.now()}`, 'if-match': campaign.etag}),
      });
      expect(res.statusCode).toBe(201);
      const b = JSON.parse(res.body);
      expect(b.code).toBe('ACTION_GRANT_ISSUED');
      expect(b.grant.status).toBe('ISSUED');
      expect(b.grant.platform).toBe('BLUESKY');
      expect(b.grant.executionMode).toBe('DIRECT');
      expect(b.outbox.state).toBe('PENDING');
    });

    it('returns 428 when Organization-Id missing', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: {'if-match': campaign.etag, 'idempotency-key': `o-${Date.now()}`},
      });
      expect(res.statusCode).toBe(428);
    });

    it('returns 428 when Idempotency-Key missing', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h({'if-match': campaign.etag}),
      });
      expect(res.statusCode).toBe(428);
    });

    it('returns 428 when If-Match missing', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h({'idempotency-key': `im-${Date.now()}`}),
      });
      expect(res.statusCode).toBe(428);
    });

    it('returns 404 for unknown campaign', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/campaigns/00000000-0000-0000-0000-000000000099/action-grants',
        headers: h({'idempotency-key': `nf-${Date.now()}`, 'if-match': '"na"'}),
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 412 on ETag mismatch', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h({'idempotency-key': `em-${Date.now()}`, 'if-match': '"wrong"'}),
      });
      expect(res.statusCode).toBe(412);
    });

    it('idempotency replays on same key', async () => {
      const key = `rp-${Date.now()}`;
      const r1 = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h({'idempotency-key': key, 'if-match': campaign.etag}),
      });
      expect(r1.statusCode).toBe(201);
      const r2 = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h({'idempotency-key': key, 'if-match': campaign.etag}),
      });
      expect(r2.statusCode).toBe(200);
      expect(r2.headers['idempotency-replayed']).toBe('true');
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /action-grants/:grantId
  // -----------------------------------------------------------------------

  describe('DELETE /api/v1/campaigns/:campaignId/action-grants/:grantId', () => {
    it('revokes ISSUED → REVOKED', async () => {
      const create = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h({'idempotency-key': `rv-${Date.now()}`, 'if-match': campaign.etag}),
      });
      const gid = JSON.parse(create.body).grant.id;
      const del = await app.inject({
        method: 'DELETE', url: `/api/v1/campaigns/${campaign.id}/action-grants/${gid}`,
        headers: h(),
      });
      expect(del.statusCode).toBe(200);
      expect(JSON.parse(del.body).code).toBe('ACTION_GRANT_REVOKED');
    });

    it('returns 404 for unknown grant', async () => {
      const res = await app.inject({
        method: 'DELETE', url: `/api/v1/campaigns/${campaign.id}/action-grants/00000000-0000-0000-0000-000000000099`,
        headers: h(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // GET /action-grants
  // -----------------------------------------------------------------------

  describe('GET /api/v1/campaigns/:campaignId/action-grants', () => {
    it('lists action grants', async () => {
      const res = await app.inject({
        method: 'GET', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: h(),
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).code).toBe('ACTION_GRANT_LIST');
    });
  });

  // -----------------------------------------------------------------------
  // GET /receipts
  // -----------------------------------------------------------------------

  describe('GET /api/v1/campaigns/:campaignId/receipts', () => {
    it('lists receipts', async () => {
      const res = await app.inject({
        method: 'GET', url: `/api/v1/campaigns/${campaign.id}/receipts`,
        headers: h(),
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).code).toBe('RECEIPT_LIST');
    });

    it('returns 404 for unknown campaign', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/v1/campaigns/00000000-0000-0000-0000-000000000099/receipts',
        headers: h(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // GET /receipts/:receiptId
  // -----------------------------------------------------------------------

  describe('GET /api/v1/campaigns/:campaignId/receipts/:receiptId', () => {
    it('returns 404 for unknown receipt', async () => {
      const res = await app.inject({
        method: 'GET', url: `/api/v1/campaigns/${campaign.id}/receipts/00000000-0000-0000-0000-000000000099`,
        headers: h(),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
