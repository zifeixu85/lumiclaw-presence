import {describe, expect, it, beforeAll, afterAll} from 'vitest';
import {
  ActionRepositoryError,
  createDemoActionGrant,
  createDemoCampaignDocument,
  createUuidV7,
  sha256Digest,
  type ActionReceipt,
} from '@lumiclaw/domain';
import {PostgresActionRepository} from './action-repository.js';
import {Pool} from 'pg';

const connectionString = process.env.DATABASE_URL;
const runIntegration = typeof connectionString === 'string' && connectionString.length > 0;

const entropy = Uint8Array.from(Array.from({length: 10}, (_, i) => (42 * 13 + i * 19) & 0xff));

function uuid(offset: number): string {
  return createUuidV7(1_788_300_000_000 + offset, entropy);
}

/**
 * Insert a minimal organisation + campaign row directly so the FK on
 * action_grants → campaigns(organization_id, id) is satisfied.
 * Returns {organizationId, campaignId} for subsequent test use.
 */
async function seedOrgAndCampaign(
  pool: Pool,
  orgId: string,
  offset: number,
  now: Date,
): Promise<{organizationId: string; campaignId: string; scheduleOccurrenceId: string; artifactRevisionId: string}> {
  const campaignId = uuid(offset);
  const schedId = uuid(offset + 200);
  const occId = uuid(offset + 300);
  const artId = uuid(offset + 400);

  // Foundation metadata
  await pool.query(
    `insert into foundation_metadata(key, value) values($1,$2) on conflict do nothing`,
    ['installation_mode', JSON.stringify({mode: 'DEMO_SEED', live: false})],
  );

  // Organization
  await pool.query(
    `insert into organizations(id, schema_version, slug, display_name, data_mode, live)
     values($1,$2,$3,$4,'DEMO_SEED',false) on conflict do nothing`,
    [orgId, 1, `test-org-${offset}`, `Test Org ${offset}`],
  );

  // Campaign
  await pool.query(
    `insert into campaigns(organization_id, id, version, digest, etag, readiness, gap_codes, document, created_at, updated_at)
     values($1,$2,$3,$4,$5,'SAVED','[]'::jsonb,$6,$7,$7)
     on conflict do nothing`,
    [orgId, campaignId, 1, '0'.repeat(64), `"seed-${offset}"`, JSON.stringify({id: campaignId, organizationId: orgId}), now.toISOString()],
  );

  // Publishing schedule
  await pool.query(
    `insert into publishing_schedules(organization_id, id, campaign_id, version, kind, time_zone, local_start, status, payload, created_at, updated_at)
     values($1,$2,$3,$4,'ONCE','Asia/Shanghai',$5,'ACTIVE',$6,$7,$7)
     on conflict do nothing`,
    [orgId, schedId, campaignId, 1, '2026-08-10T09:00:00', JSON.stringify({id: schedId}), now.toISOString()],
  );

  // Schedule occurrence
  await pool.query(
    `insert into schedule_occurrences(organization_id, id, campaign_id, schedule_id, schedule_version, ordinal, scheduled_for, state, payload)
     values($1,$2,$3,$4,$5,$6,$7,'PENDING',$8)
     on conflict do nothing`,
    [orgId, occId, campaignId, schedId, 1, 1, '2026-08-10T01:00:00.000Z', JSON.stringify({id: occId})],
  );

  // Artifact revision (needed for action_grants FK)
  await pool.query(
    `insert into artifact_revisions(organization_id, id, campaign_id, activation_unit_id, platform, revision, digest, payload, created_at)
     values($1,$2,$3,$4,'BLUESKY',1,$5,$6,$7)
     on conflict do nothing`,
    [orgId, artId, campaignId, uuid(offset + 500), '0'.repeat(64), JSON.stringify({id: artId, platform: 'BLUESKY'}), now.toISOString()],
  );

  return {organizationId: orgId, campaignId, scheduleOccurrenceId: occId, artifactRevisionId: artId};
}

describe.runIf(runIntegration)('action repository (postgres)', () => {
  const pool = new Pool({connectionString: connectionString!, max: 4});
  const repo = new PostgresActionRepository(connectionString!);
  const now = new Date('2026-08-08T12:00:00.000Z');

  afterAll(async () => {
    await repo.close();
    await pool.end();
  });

  // Central seed for all tests
  const testOrg = {organizationId: '', campaignId: '', scheduleOccurrenceId: '', artifactRevisionId: ''};

  const runId = Date.now(); // unique per run — no cleanup needed

  beforeAll(async () => {
    const orgId = uuid(runId % 100000);
    const seeded = await seedOrgAndCampaign(pool, orgId, runId % 10000, now);
    testOrg.organizationId = seeded.organizationId;
    testOrg.campaignId = seeded.campaignId;
    testOrg.scheduleOccurrenceId = seeded.scheduleOccurrenceId;
    testOrg.artifactRevisionId = seeded.artifactRevisionId;
  });

  function makeGrant(offset: number) {
    const template = createDemoCampaignDocument();
    const campaign = structuredClone(template);
    campaign.id = testOrg.campaignId;
    campaign.organizationId = testOrg.organizationId;
    // Use seeded artifact revision ID
    const blueskyRevision = campaign.artifactRevisions.find((r) => r.platform === 'BLUESKY')!;
    blueskyRevision.id = testOrg.artifactRevisionId;
    blueskyRevision.campaignId = campaign.id;
    blueskyRevision.organizationId = testOrg.organizationId;
    campaign.artifactRevisions = [blueskyRevision];
    campaign.scheduleOccurrences = [{
      id: testOrg.scheduleOccurrenceId,
      organizationId: testOrg.organizationId,
      campaignId: testOrg.campaignId,
      scheduleId: uuid(offset + 200),
      scheduleVersion: 1, schemaVersion: 1, ordinal: 1,
      localWallTime: '2026-08-10T09:00:00',
      scheduledForUtc: '2026-08-10T01:00:00.000Z',
      utcOffsetMinutes: 480, state: 'PENDING', misfireReason: null,
    }];
    const {grant, outbox} = createDemoActionGrant(campaign, { platform: 'BLUESKY', executionMode: 'DIRECT', now });
    // Override with unique IDs per test to avoid duplicate key violations
    grant.id = uuid(offset);
    outbox.id = uuid(offset + 1);
    outbox.aggregateId = grant.id;
    return {grant, outbox};
  }

  describe('health', () => {
    it('reports healthy when action_grants table exists', async () => {
      expect(await repo.health()).toBe(true);
    });
  });

  describe('createGrantWithOutbox', () => {
    it('atomically inserts grant + outbox', async () => {
      const {grant, outbox} = makeGrant(10);
      const result = await repo.createGrantWithOutbox(
        grant, outbox, `test-create-${uuid(10)}`, sha256Digest({grant: grant.id, outbox: outbox.id}),
      );
      expect(result.replayed).toBe(false);
      expect(result.grant.id).toBe(grant.id);
      expect(result.outbox.state).toBe('PENDING');
    });

    it('is idempotent — same key replays original result', async () => {
      const {grant, outbox} = makeGrant(11);
      const ik = `test-replay-${uuid(11)}`;
      const reqDigest = sha256Digest({g: grant.id});
      const first = await repo.createGrantWithOutbox(grant, outbox, ik, reqDigest);
      const second = await repo.createGrantWithOutbox(grant, outbox, ik, reqDigest);
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
    });

    it('rejects different body with same key', async () => {
      const {grant, outbox} = makeGrant(12);
      const ik = `test-reuse-${uuid(12)}`;
      await repo.createGrantWithOutbox(grant, outbox, ik, sha256Digest({grant: grant.id, outbox: outbox.id}));
      await expect(
        repo.createGrantWithOutbox(grant, outbox, ik, sha256Digest({x: 1})),
      ).rejects.toThrow('Idempotency key was reused');
    });
  });

  describe('revokeGrant', () => {
    it('transitions ISSUED → REVOKED', async () => {
      const {grant, outbox} = makeGrant(20);
      const created = await repo.createGrantWithOutbox(
        grant, outbox, `test-revoke-${uuid(20)}`, sha256Digest({g: grant.id}),
      );
      const revoked = await repo.revokeGrant(testOrg.organizationId, created.grant.id, 'Owner changed mind');
      expect(revoked.status).toBe('REVOKED');
      expect(revoked.revocationReason).toBe('Owner changed mind');
    });

    it('throws when grant not found', async () => {
      try {
        await repo.revokeGrant(testOrg.organizationId, uuid(99), 'nope');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ActionRepositoryError);
        expect((error as ActionRepositoryError).code).toBe('ACTION_GRANT_NOT_FOUND');
      }
    });
  });

  describe('outbox consumer', () => {
    it('claimNextOutbox picks up a PENDING record', async () => {
      const {grant, outbox} = makeGrant(30);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-claim-${uuid(30)}`, sha256Digest({g: grant.id}),
      );
      const claimed = await repo.claimNextOutbox('operator-1');
      expect(claimed).not.toBeUndefined();
      expect(claimed!.outbox.state).toBe('PROCESSING');
      expect(claimed!.outbox.lockedBy).toBe('operator-1');
      expect(claimed!.grant).toBeDefined();
    });

    it('completeOutbox marks COMPLETED and inserts receipt', async () => {
      const {grant, outbox} = makeGrant(40);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-comp-${uuid(40)}`, sha256Digest({g: grant.id}),
      );
      const claimed = await repo.claimNextOutbox('operator-3');
      const receipt: ActionReceipt = {
        id: uuid(41), organizationId: testOrg.organizationId,
        campaignId: grant.campaignId, actionGrantId: grant.id, schemaVersion: 1,
        platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
        platformUri: 'https://bsky.app/profile/test/post/abc', platformCid: 'bafyrei...',
        handoffSteps: null, unknownReason: null,
        reconciledAt: null, reconciliationMethod: null, createdAt: now.toISOString(), previousReceiptId: null,
        previousReceiptId: null,
      };
      const saved = await repo.completeOutbox(claimed!.outbox.id, receipt);
      expect(saved.state).toBe('PUBLISHED');
      expect(saved.platformUri).toBe('https://bsky.app/profile/test/post/abc');
    });

    it('failOutbox marks FAILED with reason and writes UNKNOWN receipt', async () => {
      const {grant, outbox} = makeGrant(50);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-fail-${uuid(50)}`, sha256Digest({g: grant.id}),
      );
      const claimed = await repo.claimNextOutbox('operator-4');
      const result = await repo.failOutbox(claimed!.outbox.id, 'Bluesky API timeout');
      expect(result.outbox.state).toBe('FAILED');
      expect(result.receipt.state).toBe('UNKNOWN');
      expect(result.receipt.unknownReason).toBe('Bluesky API timeout');
      expect(result.receipt.actionGrantId).toBe(grant.id);
    });
  });

  describe('atomic consumption', () => {
    it('marks grant CONSUMED on completeOutbox', async () => {
      const {grant, outbox} = makeGrant(80);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-atomic-${uuid(80)}`, sha256Digest({g: grant.id}),
      );
      const claimed = await repo.claimNextOutbox('operator-atomic');
      const receipt: ActionReceipt = {
        id: uuid(81), organizationId: testOrg.organizationId,
        campaignId: grant.campaignId, actionGrantId: grant.id, schemaVersion: 1,
        platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
        platformUri: 'https://bsky.app/profile/test/post/atomic', platformCid: 'bafyrei-atomic',
        handoffSteps: null, unknownReason: null,
        reconciledAt: null, reconciliationMethod: null, createdAt: now.toISOString(), previousReceiptId: null,
      };
      await repo.completeOutbox(claimed!.outbox.id, receipt);

      // Verify grant was consumed via raw SQL query
      const grantRow = await pool.query(
        `select status, consumed_at from action_grants where organization_id=$1 and id=$2`,
        [testOrg.organizationId, grant.id],
      );
      expect(grantRow.rows[0].status).toBe('CONSUMED');
      expect(grantRow.rows[0].consumed_at).not.toBeNull();
    });

    it('rejects second consumption of the same grant', async () => {
      const {grant, outbox} = makeGrant(82);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-double-${uuid(82)}`, sha256Digest({g: grant.id}),
      );

      // Create two outbox records pointing to the same grant (simulates a race)
      const outbox2Id = uuid(83);
      await pool.query(
        `insert into outbox(organization_id,id,aggregate_type,aggregate_id,schema_version,payload,state,attempts,created_at)
         values($1,$2,'ACTION_GRANT',$3,1,$4,'PENDING',0,$5)`,
        [testOrg.organizationId, outbox2Id, grant.id,
          JSON.stringify({grant, revision: {}}), now.toISOString()],
      );

      // First consumption succeeds
      const claimed1 = await repo.claimNextOutbox('operator-a');
      const receipt1: ActionReceipt = {
        id: uuid(84), organizationId: testOrg.organizationId,
        campaignId: grant.campaignId, actionGrantId: grant.id, schemaVersion: 1,
        platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
        platformUri: 'https://bsky.app/a', platformCid: 'bafyrei-a',
        handoffSteps: null, unknownReason: null,
        reconciledAt: null, reconciliationMethod: null, createdAt: now.toISOString(), previousReceiptId: null,
      };
      await repo.completeOutbox(claimed1!.outbox.id, receipt1);

      // Second consumption is rejected — grant already CONSUMED
      const claimed2 = await repo.claimNextOutbox('operator-b');
      try {
        const receipt2: ActionReceipt = {
          id: uuid(85), organizationId: testOrg.organizationId,
          actionGrantId: grant.id, schemaVersion: 1,
          platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
          platformUri: 'https://bsky.app/b', platformCid: 'bafyrei-b',
          handoffSteps: null, unknownReason: null,
          reconciledAt: null, reconciliationMethod: null, createdAt: now.toISOString(), previousReceiptId: null,
        };
        await repo.completeOutbox(claimed2!.outbox.id, receipt2);
        expect.unreachable('Second consumption should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ActionRepositoryError);
        expect((error as ActionRepositoryError).code).toBe('ACTION_GRANT_ALREADY_CONSUMED');
      }
    });

    it('only one operator succeeds when two completeOutbox concurrently', async () => {
      const {grant, outbox} = makeGrant(86);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-race-${uuid(86)}`, sha256Digest({g: grant.id}),
      );

      // Simulate a race: two outbox records point to the same grant
      const outbox2Id = uuid(87);
      await pool.query(
        `insert into outbox(organization_id,id,aggregate_type,aggregate_id,schema_version,payload,state,attempts,created_at)
         values($1,$2,'ACTION_GRANT',$3,1,$4,'PENDING',0,$5)`,
        [testOrg.organizationId, outbox2Id, grant.id,
          JSON.stringify({grant, revision: {}}), now.toISOString()],
      );

      // Both operators claim their respective outbox records
      const claimed1 = await repo.claimNextOutbox('operator-race-a');
      const claimed2 = await repo.claimNextOutbox('operator-race-b');
      expect(claimed1).not.toBeUndefined();
      expect(claimed2).not.toBeUndefined();

      // Both operators attempt to complete concurrently — only one may succeed
      const receiptA: ActionReceipt = {
        id: uuid(88), organizationId: testOrg.organizationId,
        campaignId: grant.campaignId, actionGrantId: grant.id, schemaVersion: 1,
        platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
        platformUri: 'https://bsky.app/a', platformCid: 'bafyrei-a',
        handoffSteps: null, unknownReason: null,
        reconciledAt: null, reconciliationMethod: null, createdAt: now.toISOString(), previousReceiptId: null,
      };
      const receiptB: ActionReceipt = {
        id: uuid(89), organizationId: testOrg.organizationId,
        campaignId: grant.campaignId, actionGrantId: grant.id, schemaVersion: 1,
        platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
        platformUri: 'https://bsky.app/b', platformCid: 'bafyrei-b',
        handoffSteps: null, unknownReason: null,
        reconciledAt: null, reconciliationMethod: null, createdAt: now.toISOString(), previousReceiptId: null,
      };

      const results = await Promise.allSettled([
        repo.completeOutbox(claimed1!.outbox.id, receiptA),
        repo.completeOutbox(claimed2!.outbox.id, receiptB),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;
      expect(fulfilled).toBe(1);
      expect(rejected).toBe(1);

      // The rejected promise must carry ACTION_GRANT_ALREADY_CONSUMED
      const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(ActionRepositoryError);
      expect((failure.reason as ActionRepositoryError).code).toBe('ACTION_GRANT_ALREADY_CONSUMED');

      // Database confirms exactly one consumption
      const grantRow = await pool.query(
        `select status, consumed_at from action_grants where organization_id=$1 and id=$2`,
        [testOrg.organizationId, grant.id],
      );
      expect(grantRow.rows[0].status).toBe('CONSUMED');
      expect(grantRow.rows[0].consumed_at).not.toBeNull();
    });
  });

  describe('receipt queries', () => {
    it('getReceiptsByCampaign returns receipts', async () => {
      const {grant, outbox} = makeGrant(60);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-tl-${uuid(60)}`, sha256Digest({g: grant.id}),
      );
      const claimed = await repo.claimNextOutbox('operator-tl');
      const receipt: ActionReceipt = {
        id: uuid(61), organizationId: testOrg.organizationId,
        campaignId: grant.campaignId, actionGrantId: grant.id, schemaVersion: 1,
        platform: 'BLUESKY', executionMode: 'DIRECT', state: 'PUBLISHED',
        platformUri: 'https://bsky.app/tl', platformCid: null,
        handoffSteps: null, unknownReason: null,
        reconciledAt: null, reconciliationMethod: null, createdAt: now.toISOString(), previousReceiptId: null,
      };
      await repo.completeOutbox(claimed!.outbox.id, receipt);
      const receipts = await repo.getReceiptsByCampaign(testOrg.organizationId, testOrg.campaignId);
      expect(receipts.length).toBeGreaterThanOrEqual(1);
    });

    it('getReceipt returns undefined for unknown id', async () => {
      const result = await repo.getReceipt(testOrg.organizationId, uuid(99));
      expect(result).toBeUndefined();
    });
  });

  describe('immutability', () => {
    it('action_receipts rejects UPDATE', async () => {
      const {grant} = makeGrant(70);
      const rid = uuid(71);
      // Insert grant + receipt directly
      await pool.query(
        `insert into action_grants(organization_id,id,campaign_id,schedule_occurrence_id,artifact_revision_id,activation_unit_id,schema_version,platform,execution_mode,status,issued_at,expires_at,grant_digest,channel_account_id,capability_snapshot_id,owner_signature,owner_key_id,owner_decision_id,payload,created_at)
         values($1,$2,$3,$4,$5,$6,1,'BLUESKY','DIRECT','ISSUED',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [testOrg.organizationId, grant.id, grant.campaignId, grant.scheduleOccurrenceId,
          grant.artifactRevisionId, grant.activationUnitId,
          grant.issuedAt, grant.expiresAt, grant.grantDigest,
          grant.channelAccountId, grant.capabilitySnapshotId,
          grant.ownerSignature, grant.ownerKeyId, grant.ownerDecisionId,
          JSON.stringify(grant), now.toISOString()],
      );
      await pool.query(
        `insert into action_receipts(organization_id,id,action_grant_id,schema_version,platform,execution_mode,state,created_at)
         values($1,$2,$3,1,'BLUESKY','DIRECT','PUBLISHED',$4)`,
        [testOrg.organizationId, rid, grant.id, now.toISOString()],
      );
      try {
        await pool.query(
          `update action_receipts set state='FAILED' where organization_id=$1 and id=$2`,
          [testOrg.organizationId, rid],
        );
        expect.unreachable('Immutable trigger should have prevented UPDATE');
      } catch (error) {
        expect(String(error).includes('GOVERNED_HISTORY_IMMUTABLE')).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // P3-11 supplementary tests (PG integration)
  // -----------------------------------------------------------------------

  describe('P3-11 supplementary', () => {
    it('rejects different body with same idempotency key', async () => {
      const {grant, outbox} = makeGrant(90);
      const ik = `test-diff-body-${uuid(90)}`;
      const dg = sha256Digest({g: grant.id});
      const first = await repo.createGrantWithOutbox(grant, outbox, ik, dg);
      expect(first.replayed).toBe(false);
      // Same key, different digest → IDEMPOTENCY_KEY_REUSED
      await expect(
        repo.createGrantWithOutbox(grant, outbox, ik, sha256Digest({x: 'different'})),
      ).rejects.toThrow('Idempotency key was reused');
    });

    it('lease recovery: stalled PROCESSING outbox returns to PENDING', async () => {
      const {grant, outbox} = makeGrant(91);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-lease-recovery-${uuid(91)}`, sha256Digest({g: grant.id}),
      );
      // Claim to make it PROCESSING
      const claimed = await repo.claimNextOutbox('operator-stuck');
      expect(claimed).not.toBeUndefined();
      expect(claimed!.outbox.state).toBe('PROCESSING');

      // Manually set locked_at to 10 min ago (exceeds 5 min lease TTL)
      await pool.query(
        `update outbox set locked_at=$1 where organization_id=$2 and id=$3`,
        [new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          testOrg.organizationId, claimed!.outbox.id],
      );

      // Next claimNextOutbox should recover the stalled record
      const recovered = await repo.claimNextOutbox('operator-recovery');
      expect(recovered).not.toBeUndefined();
      expect(recovered!.outbox.id).toBe(claimed!.outbox.id);
      expect(recovered!.outbox.state).toBe('PROCESSING'); // now claimed again
    });

    it('handoff confirmation creates a new receipt with previousReceiptId chain', async () => {
      const {grant, outbox} = makeGrant(92);
      await repo.createGrantWithOutbox(
        grant, outbox, `test-ho-chain-${uuid(92)}`, sha256Digest({g: grant.id}),
      );
      // Claim + complete with HANDOFF_PENDING
      const claimed = await repo.claimNextOutbox('operator-ho');
      const pending: ActionReceipt = {
        id: uuid(93), organizationId: testOrg.organizationId,
        campaignId: grant.campaignId, actionGrantId: grant.id,
        schemaVersion: 1, platform: 'LINKEDIN', executionMode: 'NATIVE_HANDOFF',
        state: 'HANDOFF_PENDING', platformUri: null, platformCid: null,
        handoffSteps: ['Step 1', 'Step 2'], unknownReason: null,
        reconciledAt: null, reconciliationMethod: null,
        createdAt: now.toISOString(), previousReceiptId: null,
      };
      await repo.completeOutbox(claimed!.outbox.id, pending);

      // Confirm handoff → should create a NEW receipt (append-only)
      const confirmed = await repo.confirmHandoff(
        testOrg.organizationId, pending.id,
        'https://linkedin.com/feed/post/chain-test', 'bafyrei-chain',
      );
      expect(confirmed.id).not.toBe(pending.id);
      expect(confirmed.state).toBe('HANDOFF_CONFIRMED');
      expect(confirmed.previousReceiptId).toBe(pending.id);
      expect(confirmed.platformUri).toBe('https://linkedin.com/feed/post/chain-test');
    });
  });
});
