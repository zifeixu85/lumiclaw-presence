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
  const h = {'content-type': 'application/json', 'x-lumiclaw-organization-id': orgId};
  const res = await app.inject({
    method: 'POST', url: '/api/v1/campaigns',
    headers: {...h, 'idempotency-key': `seed-${Date.now()}`}, body: doc,
  });
  const body = JSON.parse(res.body);
  return {orgId, id: body.document.id, etag: body.etag};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('receipt SSE + reconciliation', () => {
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
  // SSE
  // -----------------------------------------------------------------------

  describe('GET /api/v1/campaigns/:campaignId/receipts/stream', () => {
    it('returns 428 when Organization-Id missing', async () => {
      const res = await app.inject({
        method: 'GET', url: `/api/v1/campaigns/${campaign.id}/receipts/stream`,
      });
      expect(res.statusCode).toBe(428);
    });

    it('returns 404 for unknown campaign', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/v1/campaigns/00000000-0000-0000-0000-000000000099/receipts/stream',
        headers: h(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // Reconciliation
  // -----------------------------------------------------------------------

  describe('POST /api/v1/campaigns/:campaignId/receipts/:receiptId/reconcile', () => {
    it('returns 404 for unknown receipt', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/receipts/00000000-0000-0000-0000-000000000099/reconcile`,
        headers: {'content-type': 'application/json', ...h()},
        body: {method: 'OWNER_MANUAL', notes: 'test'},
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 422 when body is invalid', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/receipts/00000000-0000-0000-0000-000000000099/reconcile`,
        headers: {'content-type': 'application/json', ...h()},
        body: {bad: 'field'},
      });
      expect(res.statusCode).toBe(422);
    });
  });
});
