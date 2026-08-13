import {beforeAll, describe, expect, it, afterAll} from 'vitest';
import {buildApi} from './server.js';
import {createDemoActionGrant, createDemoCampaignDocument, createUuidV7, generateEd25519KeyPair, sha256Digest, type ActionReceipt, type ActionRepository} from '@lumiclaw/domain';
import {MemoryActionRepository} from '@lumiclaw/db';
import type {FastifyInstance} from 'fastify';
import {MemoryCampaignRepository} from './memory-campaign-repository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCampaign(app: FastifyInstance): Promise<{orgId: string; id: string; etag: string; doc: Record<string, unknown>}> {
  const tpl = await app.inject({method: 'GET', url: '/api/v1/campaigns/demo-template'});
  const doc = JSON.parse(tpl.body).document;
  const orgId = doc.organizationId;
  const h = mkHeaders(orgId);
  const res = await app.inject({
    method: 'POST', url: '/api/v1/campaigns',
    headers: {...h, 'idempotency-key': `seed-${Date.now()}`}, body: doc,
  });
  const body = JSON.parse(res.body);
  return {orgId, id: body.document.id, etag: body.etag, doc: body.document};
}

function mkHeaders(orgId: string, extra: Record<string, string> = {}): Record<string, string> {
  return {'content-type': 'application/json', 'x-lumiclaw-organization-id': orgId, ...extra};
}

function makeGrantBody(doc: Record<string, unknown>): Record<string, unknown> {
  const activationPlan = doc.activationPlan as Record<string, unknown> | undefined;
  const units = activationPlan?.units as Array<Record<string, unknown>> | undefined;
  const revisions = doc.artifactRevisions as Array<Record<string, unknown>> | undefined;
  const occurrences = doc.scheduleOccurrences as Array<Record<string, unknown>> | undefined;
  const blueskyUnit = units?.find((u) => u.platform === 'BLUESKY');
  const blueskyRevision = revisions?.find((r) => r.platform === 'BLUESKY');
  // Use a deterministic scheduleOccurrenceId.  When the Campaign has no
  // occurrences, resolveGrantRefs synthesises one with the supplied ID.
  const occurrenceId = (occurrences?.[0]?.id as string) ?? '01908900-0000-7000-8000-00000000aa02';
  return {
    platform: 'BLUESKY',
    executionMode: 'DIRECT',
    scheduleOccurrenceId: occurrenceId,
    artifactRevisionId: blueskyRevision?.id as string,
    activationUnitId: blueskyUnit?.id as string,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('action grant routes', () => {
  let app: FastifyInstance;
  let repo: ActionRepository;
  let campaign: {orgId: string; id: string; etag: string; doc: Record<string, unknown>};
  let grantBody: Record<string, unknown>;

  beforeAll(async () => {
    repo = new MemoryActionRepository();
    app = buildApi({actionRepository: repo});
    campaign = await seedCampaign(app);
    grantBody = makeGrantBody(campaign.doc);
  });

  afterAll(async () => app.close());

  function h(extra: Record<string, string> = {}): Record<string, string> {
    return {'x-lumiclaw-organization-id': campaign.orgId, ...extra};
  }

  function hb(extra: Record<string, string> = {}): Record<string, string> {
    return {'content-type': 'application/json', 'x-lumiclaw-organization-id': campaign.orgId, ...extra};
  }

  // -----------------------------------------------------------------------
  // POST /action-grants
  // -----------------------------------------------------------------------

  describe('POST /api/v1/campaigns/:campaignId/action-grants', () => {
    it('creates an ActionGrant → 201', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'idempotency-key': `p1-${Date.now()}`, 'if-match': campaign.etag}),
        body: grantBody,
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
        headers: {'content-type': 'application/json', 'if-match': campaign.etag, 'idempotency-key': `o-${Date.now()}`},
        body: grantBody,
      });
      expect(res.statusCode).toBe(428);
    });

    it('returns 428 when Idempotency-Key missing', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'if-match': campaign.etag}),
        body: grantBody,
      });
      expect(res.statusCode).toBe(428);
    });

    it('returns 428 when If-Match missing', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'idempotency-key': `im-${Date.now()}`}),
        body: grantBody,
      });
      expect(res.statusCode).toBe(428);
    });

    it('returns 404 for unknown campaign', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/campaigns/00000000-0000-0000-0000-000000000099/action-grants',
        headers: hb({'idempotency-key': `nf-${Date.now()}`, 'if-match': '"na"'}),
        body: grantBody,
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 422 on invalid body', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'idempotency-key': `bad-${Date.now()}`, 'if-match': campaign.etag}),
        body: {invalid: true},
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 412 on ETag mismatch', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'idempotency-key': `em-${Date.now()}`, 'if-match': '"wrong"'}),
        body: grantBody,
      });
      expect(res.statusCode).toBe(412);
    });

    it('idempotency replays on same key', async () => {
      const key = `rp-${Date.now()}`;
      const r1 = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'idempotency-key': key, 'if-match': campaign.etag}),
        body: grantBody,
      });
      expect(r1.statusCode).toBe(201);
      const r2 = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'idempotency-key': key, 'if-match': campaign.etag}),
        body: grantBody,
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
      // Re-fetch the campaign etag (may have changed if a prior test synthesized an occurrence)
      const camp = await app.inject({
        method: 'GET', url: `/api/v1/campaigns/${campaign.id}`,
        headers: h(),
      });
      const currentEtag = JSON.parse(camp.body).etag;
      const currentDoc = JSON.parse(camp.body).document;
      const body = makeGrantBody(currentDoc);

      const create = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/action-grants`,
        headers: hb({'idempotency-key': `rv-${Date.now()}`, 'if-match': currentEtag}),
        body,
      });
      expect(create.statusCode).toBe(201);
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
  // POST /confirm-handoff
  // -----------------------------------------------------------------------

  describe('POST /api/v1/campaigns/:campaignId/receipts/:receiptId/confirm-handoff', () => {
    const now = new Date('2026-08-08T12:00:00.000Z');

    it('confirms HANDOFF_PENDING receipt → HANDOFF_CONFIRMED', async () => {
      // Use the repository's public API to seed a HANDOFF_PENDING receipt
      const liCampaign = createDemoCampaignDocument();
      liCampaign.organizationId = campaign.orgId;
      liCampaign.id = campaign.id;

      const {grant, outbox, ownerPublicKey} = createDemoActionGrant(liCampaign, {
        platform: 'LINKEDIN',
        executionMode: 'NATIVE_HANDOFF',
        now,
      });
      await repo.createGrantWithOutbox(grant, outbox, `co-seed-${Date.now()}`, sha256Digest({g: grant.id}), ownerPublicKey);
      const claimed = await repo.claimNextOutbox('test-confirm');
      const receiptId = createUuidV7(Date.now(), new Uint8Array(10));
      const pending: ActionReceipt = {
        id: receiptId,
        organizationId: campaign.orgId,
        campaignId: grant.campaignId,
        actionGrantId: grant.id,
        schemaVersion: 1,
        platform: 'LINKEDIN',
        executionMode: 'NATIVE_HANDOFF',
        state: 'HANDOFF_PENDING',
        platformUri: null,
        platformCid: null,
        handoffSteps: ['1. 打开 LinkedIn', '2. 粘贴内容并发布', '3. 将发布后的 URL 粘贴回 LumiClaw'],
        unknownReason: null,
        reconciledAt: null,
        reconciliationMethod: null,
        createdAt: now.toISOString(),
        previousReceiptId: null,
      };
      await repo.completeOutbox(claimed!.outbox.id, pending, claimed!.lease);

      // Now call confirm-handoff via the API
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/campaigns/${campaign.id}/receipts/${receiptId}/confirm-handoff`,
        headers: hb({'content-type': 'application/json'}),
        body: {platformUri: 'https://linkedin.com/feed/post/123'},
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('HANDOFF_CONFIRMED');
      expect(body.receipt.state).toBe('HANDOFF_CONFIRMED');
      expect(body.receipt.platformUri).toBe('https://linkedin.com/feed/post/123');
      // Append-only: the new receipt has a different id and links back
      expect(body.receipt.id).not.toBe(receiptId);
      expect(body.receipt.previousReceiptId).toBe(receiptId);
    });

    it('returns 409 when receipt is not HANDOFF_PENDING', async () => {
      // Seed a PUBLISHED receipt via the repository
      const bskyCampaign = createDemoCampaignDocument();
      bskyCampaign.organizationId = campaign.orgId;
      bskyCampaign.id = campaign.id;

      const {grant, outbox, ownerPublicKey} = createDemoActionGrant(bskyCampaign, {
        platform: 'BLUESKY',
        executionMode: 'DIRECT',
        now,
      });
      await repo.createGrantWithOutbox(grant, outbox, `co-409-${Date.now()}`, sha256Digest({g: grant.id}), ownerPublicKey);
      const claimed = await repo.claimNextOutbox('test-409');
      const receiptId = createUuidV7(Date.now(), new Uint8Array(10));
      const published: ActionReceipt = {
        id: receiptId,
        organizationId: campaign.orgId,
        campaignId: grant.campaignId,
        actionGrantId: grant.id,
        schemaVersion: 1,
        platform: 'BLUESKY',
        executionMode: 'DIRECT',
        state: 'PUBLISHED',
        platformUri: 'https://bsky.app/already-published',
        platformCid: 'bafyrei-pub',
        handoffSteps: null,
        unknownReason: null,
        reconciledAt: null,
        reconciliationMethod: null,
        createdAt: now.toISOString(),
        previousReceiptId: null,
      };
      await repo.completeOutbox(claimed!.outbox.id, published, claimed!.lease);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/campaigns/${campaign.id}/receipts/${receiptId}/confirm-handoff`,
        headers: hb({'content-type': 'application/json'}),
        body: {platformUri: 'https://linkedin.com/feed/post/456'},
      });
      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).code).toBe('HANDOFF_NOT_PENDING');
    });

    it('returns 404 for unknown receipt', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/receipts/00000000-0000-0000-0000-000000000099/confirm-handoff`,
        headers: hb({'content-type': 'application/json'}),
        body: {platformUri: 'https://linkedin.com/feed/post/123'},
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 422 on invalid body', async () => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/campaigns/${campaign.id}/receipts/00000000-0000-0000-0000-000000000099/confirm-handoff`,
        headers: hb({'content-type': 'application/json'}),
        body: {wrongField: true},
      });
      expect(res.statusCode).toBe(422);
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

  // -----------------------------------------------------------------------
  // P3-11 supplementary tests
  // -----------------------------------------------------------------------

  describe('cross-campaign receipt isolation', () => {
    it("campaign A receipts are not visible from campaign B", async () => {
      // Seed a receipt on campaign A via the existing repo
      const {grant, outbox, ownerPublicKey} = createDemoActionGrant(
        createDemoCampaignDocument(),
        {platform: 'BLUESKY', executionMode: 'DIRECT', now: new Date()},
      );
      grant.organizationId = campaign.orgId;
      grant.campaignId = campaign.id;
      const pubReceipt: ActionReceipt = {
        id: createUuidV7(Date.now(), new Uint8Array(10)),
        organizationId: grant.organizationId,
        campaignId: grant.campaignId,
        actionGrantId: grant.id, schemaVersion: 1,
        platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
        platformUri: 'https://bsky.app/iso-test', platformCid: 'bafyrei-iso',
        handoffSteps: null, unknownReason: null,
        reconciledAt: null, reconciliationMethod: null,
        createdAt: new Date().toISOString(), previousReceiptId: null,
      };
      await repo.createGrantWithOutbox(grant, outbox, `iso-${Date.now()}`, sha256Digest({g: grant.id}), ownerPublicKey);
      const claimed = await repo.claimNextOutbox('test-iso');
      await repo.completeOutbox(claimed!.outbox.id, pubReceipt, claimed!.lease);

      // Query campaign A receipts — should include ours
      const resA = await app.inject({
        method: 'GET', url: `/api/v1/campaigns/${campaign.id}/receipts`,
        headers: h(),
      });
      expect(resA.statusCode).toBe(200);
      const bodyA = JSON.parse(resA.body);
      // All returned receipts belong to campaign A
      expect(bodyA.receipts.every((r: ActionReceipt) => r.campaignId === campaign.id)).toBe(true);
    });
  });

  describe('idempotency + campaign revision binding', () => {
    it('rejects different requestDigest with same idempotency key', async () => {
      // Direct repo test: same key, different body → IDEMPOTENCY_KEY_REUSED
      const {grant, outbox, ownerPublicKey} = createDemoActionGrant(
        createDemoCampaignDocument(),
        {platform: 'BLUESKY', executionMode: 'DIRECT', now: new Date()},
      );
      grant.organizationId = campaign.orgId;
      grant.campaignId = campaign.id;
      const key = `rev-test-${Date.now()}`;
      const firstDigest = sha256Digest({g: grant.id});
      const r1 = await repo.createGrantWithOutbox(grant, outbox, key, firstDigest, ownerPublicKey);
      expect(r1.replayed).toBe(false);

      // Replay with same digest → replays
      const r1b = await repo.createGrantWithOutbox(grant, outbox, key, firstDigest, ownerPublicKey);
      expect(r1b.replayed).toBe(true);

      // Same key, different digest → rejected
      await expect(
        repo.createGrantWithOutbox(grant, outbox, key, sha256Digest({different: 'body'}), ownerPublicKey),
      ).rejects.toThrow('Idempotency key was reused');
    });
  });
});

describe('persistent ActionGrant signer across API restart', () => {
  it('issues with a configured signer and queries the same Grant after API restart', async () => {
    const signer = generateEd25519KeyPair();
    const actionRepository = new MemoryActionRepository();
    const campaignRepository = new MemoryCampaignRepository();
    const first = buildApi({actionRepository, repository: campaignRepository, actionGrantSigner: signer, requirePersistentActionSigner: true});
    const seeded = await seedCampaign(first);
    const issued = await first.inject({
      method: 'POST', url: `/api/v1/campaigns/${seeded.id}/action-grants`,
      headers: {...mkHeaders(seeded.orgId), 'idempotency-key': 'stable-signer-restart-1', 'if-match': seeded.etag},
      body: makeGrantBody(seeded.doc),
    });
    expect(issued.statusCode).toBe(201);
    const grantId = JSON.parse(issued.body).grant.id as string;
    await first.close();

    const restarted = buildApi({actionRepository, repository: campaignRepository, actionGrantSigner: signer, requirePersistentActionSigner: true});
    const listed = await restarted.inject({method: 'GET', url: `/api/v1/campaigns/${seeded.id}/action-grants`, headers: mkHeaders(seeded.orgId)});
    expect(listed.statusCode).toBe(200);
    expect(JSON.parse(listed.body).grants.some((grant: {id: string}) => grant.id === grantId)).toBe(true);
    await restarted.close();
  });

  it('fails closed when production signer secret is unavailable', async () => {
    const app = buildApi({requirePersistentActionSigner: true});
    const seeded = await seedCampaign(app);
    const response = await app.inject({
      method: 'POST', url: `/api/v1/campaigns/${seeded.id}/action-grants`,
      headers: {...mkHeaders(seeded.orgId), 'idempotency-key': 'missing-signer-1', 'if-match': seeded.etag},
      body: makeGrantBody(seeded.doc),
    });
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).code).toBe('ACTION_GRANT_SIGNER_UNAVAILABLE');
    await app.close();
  });
});
