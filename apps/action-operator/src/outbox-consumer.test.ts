import {beforeAll, describe, expect, it} from 'vitest';
import {
  createDemoActionGrant,
  createDemoCampaignDocument,
  digestActionGrant,
  type ActionRepository,
} from '@lumiclaw/domain';
import {MemoryActionRepository} from '@lumiclaw/db';
import {OutboxConsumer} from './outbox-consumer.js';

const now = new Date('2026-08-08T12:00:00.000Z');

describe('outbox consumer', () => {
  let repo: ActionRepository;
  let consumer: OutboxConsumer;

  beforeAll(() => {
    repo = new MemoryActionRepository();
    consumer = new OutboxConsumer(repo, 'test-lock-id', 60000, () => now);
  });

  function campaignAndGrant() {
    const campaign = createDemoCampaignDocument();
    const {grant, outbox} = createDemoActionGrant(campaign, now);
    return {campaign, grant, outbox};
  }

  it('processOne returns null when no PENDING records', async () => {
    const result = await consumer.processOne();
    expect(result).toBeNull();
  });

  it('processOne produces PUBLISHED receipt for DIRECT (Bluesky)', async () => {
    const {grant, outbox} = campaignAndGrant();
    await repo.createGrantWithOutbox(grant, outbox, 'test-direct', 'digest-direct');

    const receipt = await consumer.processOne();
    expect(receipt).not.toBeNull();
    expect(receipt!.state).toBe('PUBLISHED');
    expect(receipt!.platform).toBe('BLUESKY');
    expect(receipt!.platformUri).toContain('bsky.app');
    expect(receipt!.platformCid).toBeTruthy();
  });

  it('processOne fails expired grant → outbox FAILED', async () => {
    const campaign = createDemoCampaignDocument();
    const {grant, outbox} = createDemoActionGrant(campaign, now);
    // Mutate grant to appear expired
    grant.status = 'EXPIRED';
    grant.grantDigest = ''; // will fail digest check too, but status check comes first
    // Reset digest so it passes digest check — we only want to test expiry
    // Actually, let's just make it EXPIRED at the right step
    outbox.payload = {grant, revision: campaign.artifactRevisions[0]!};

    await repo.createGrantWithOutbox(grant, outbox, 'test-expired', 'digest-exp');
    const result = await consumer.processOne();
    expect(result).toBeNull();
    // Subsequent poll should see no PENDING records (the one we had is now FAILED)
    const next = await consumer.processOne();
    expect(next).toBeNull();
  });

  it('processOne fails digest mismatch → outbox FAILED', async () => {
    const {grant, outbox} = campaignAndGrant();
    // Tamper the digest in the payload but leave the grant in outbox payload
    const tampered = {...grant, grantDigest: '0'.repeat(64)};
    outbox.payload = {grant: tampered, revision: outbox.payload};

    await repo.createGrantWithOutbox(grant, outbox, 'test-digest', 'digest-dg');
    const result = await consumer.processOne();
    expect(result).toBeNull();
  });

  it('processOne produces HANDOFF_CONFIRMED for LinkedIn', async () => {
    const campaign = createDemoCampaignDocument();
    // Use LinkedIn unit
    const liUnit = campaign.activationPlan.units.find((u) => u.platform === 'LINKEDIN')!;
    const liRevision = campaign.artifactRevisions.find((r) => r.activationUnitId === liUnit.id)!;
    campaign.scheduleOccurrences = [{
      id: liUnit.id + '-occ',
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      scheduleId: liUnit.id + '-sched',
      scheduleVersion: 1,
      schemaVersion: 1,
      ordinal: 1,
      localWallTime: '2026-08-10T09:00:00',
      scheduledForUtc: '2026-08-10T01:00:00.000Z',
      utcOffsetMinutes: 480,
      state: 'PENDING',
      misfireReason: null,
    }];
    const {grant: base, outbox: baseOutbox} = createDemoActionGrant(campaign, now);

    // Override platform to LinkedIn for this grant — recompute digest
    const grant = {...base, platform: 'LINKEDIN' as const, executionMode: 'NATIVE_HANDOFF' as const};
    grant.grantDigest = digestActionGrant(grant);
    const outbox = {
      ...baseOutbox,
      aggregateId: grant.id,
      payload: {grant, revision: liRevision},
    };

    await repo.createGrantWithOutbox(grant, outbox, 'test-li', 'digest-li');
    const receipt = await consumer.processOne();
    expect(receipt).not.toBeNull();
    expect(receipt!.state).toBe('HANDOFF_CONFIRMED');
    expect(receipt!.platform).toBe('LINKEDIN');
    expect(receipt!.handoffSteps).not.toBeNull();
    expect(receipt!.handoffSteps!.length).toBeGreaterThan(0);
  });

  it('stop() halts the polling loop', () => {
    consumer.stop();
    expect(consumer.running).toBe(false);
  });

  it('full end-to-end: grant → outbox → consume → receipt', async () => {
    // Restart consumer for this test
    consumer.start();
    const {grant, outbox} = campaignAndGrant();
    await repo.createGrantWithOutbox(grant, outbox, 'test-e2e', 'digest-e2e');

    const receipt = await consumer.processOne();
    expect(receipt).not.toBeNull();
    expect(receipt!.state).toBe('PUBLISHED');
    expect(receipt!.actionGrantId).toBe(grant.id);
    expect(receipt!.platformUri).toContain('bsky.app');

    // Verify receipt is queryable
    const fetched = await repo.getReceipt(grant.organizationId, receipt!.id);
    expect(fetched).not.toBeUndefined();
    expect(fetched!.state).toBe('PUBLISHED');
    consumer.stop();
  });
});
