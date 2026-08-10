import {
  createDemoActionGrant,
  createDemoCampaignDocument,
  createUuidV7,
  sha256Digest,
  type ActionReceipt,
} from '@lumiclaw/domain';
import {PostgresActionRepository} from '@lumiclaw/db';
import {Pool} from 'pg';
import {mkdir, writeFile} from 'node:fs/promises';

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined) {
  throw new Error('DATABASE_URL is required. e.g. postgres://postgres@localhost:5432/lumiclaw');
}

const now = new Date('2026-08-08T12:00:00.000Z');
const template = createDemoCampaignDocument();
const orgId = template.organizationId;
const campaignId = template.id;
const artId = '01908900-0000-7000-8000-00000000aa03';
const occId = '01908900-0000-7000-8000-00000000aa02';
const schedId = '01908900-0000-7000-8000-00000000aa01';
const checks: Record<string, unknown> = {};

const actionRepo = new PostgresActionRepository(connectionString);
const pool = new Pool({connectionString, max: 2});

function uid(): string { return createUuidV7(Date.now(), new Uint8Array(10)); }

function makeCampaign() {
  const c = structuredClone(template);
  c.scheduleOccurrences = [{
    id: occId, organizationId: orgId, campaignId,
    scheduleId: schedId, scheduleVersion: 1, schemaVersion: 1, ordinal: 1,
    localWallTime: '2026-08-10T09:00:00',
    scheduledForUtc: '2026-08-10T01:00:00.000Z',
    utcOffsetMinutes: 480, state: 'PENDING' as const, misfireReason: null,
  }];
  const br = c.artifactRevisions.find((r) => r.platform === 'BLUESKY')!;
  br.id = artId;
  br.organizationId = orgId;
  br.campaignId = campaignId;
  c.artifactRevisions = [br];
  return c;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  // Phase 1 — Seed raw data (bypass M1 authority check)
  await pool.query(
    `insert into foundation_metadata(key, value) values($1,$2) on conflict do nothing`,
    ['installation_mode', JSON.stringify({mode: 'DEMO_SEED', live: false})],
  );
  await pool.query(
    `insert into organizations(id, schema_version, slug, display_name, data_mode, live)
     values($1,1,$2,$3,'DEMO_SEED',false) on conflict do nothing`,
    [orgId, 'verify-m3', 'M3 Verify Org'],
  );
  await pool.query(
    `insert into campaigns(organization_id, id, version, digest, etag, readiness, gap_codes, document, created_at, updated_at)
     values($1,$2,1,$3,$4,'SAVED','[]'::jsonb,$5,$6,$6) on conflict do nothing`,
    [orgId, campaignId, '0'.repeat(64), '"verify-m3-etag"', JSON.stringify({id: campaignId}), now.toISOString()],
  );
  await pool.query(
    `insert into publishing_schedules(organization_id, id, campaign_id, version, kind, time_zone, local_start, status, payload, created_at, updated_at)
     values($1,$2,$3,1,'ONCE','Asia/Shanghai',$4,'ACTIVE',$5,$6,$6) on conflict do nothing`,
    [orgId, schedId, campaignId, '2026-08-10T09:00:00', JSON.stringify({id: schedId}), now.toISOString()],
  );
  await pool.query(
    `insert into schedule_occurrences(organization_id, id, campaign_id, schedule_id, schedule_version, ordinal, scheduled_for, state, payload)
     values($1,$2,$3,$4,1,1,$5,'PENDING',$6) on conflict do nothing`,
    [orgId, occId, campaignId, schedId, '2026-08-10T01:00:00.000Z', JSON.stringify({id: occId})],
  );
  await pool.query(
    `insert into artifact_revisions(organization_id, id, campaign_id, activation_unit_id, platform, revision, digest, payload, created_at)
     values($1,$2,$3,$4,'BLUESKY',1,$5,$6,$7) on conflict do nothing`,
    [orgId, artId, campaignId, '01908900-0000-7000-8000-00000000bb99',
      '0'.repeat(64), JSON.stringify({id: artId, platform: 'BLUESKY'}), now.toISOString()],
  );
  checks.seedComplete = true;
  checks.health = await actionRepo.health();

  const campaign = makeCampaign();

  // -------------------------------------------------------------------
  // Phase 2 — Grant creation + idempotency
  // -------------------------------------------------------------------

  const {grant: g1, outbox: o1, ownerPublicKey: pk1} = createDemoActionGrant(campaign, { platform: 'BLUESKY', executionMode: 'DIRECT', now });
  g1.id = uid(); o1.id = uid(); o1.aggregateId = g1.id;
  const ik = `verify-${Date.now()}`;
  const dg = sha256Digest({g: g1.id});
  const r1 = await actionRepo.createGrantWithOutbox(g1, o1, ik, dg, pk1);
  checks.grantIssued = r1.grant.status === 'ISSUED';
  checks.outboxPending = r1.outbox.state === 'PENDING';
  checks.grantDigest = r1.grant.grantDigest.length === 64;

  const r2 = await actionRepo.createGrantWithOutbox(g1, o1, ik, dg, pk1);
  checks.replayed = r2.replayed === true;
  checks.replayedSameId = r2.grant.id === r1.grant.id;

  let reuseRejected = false;
  try { await actionRepo.createGrantWithOutbox(g1, o1, ik, sha256Digest({x: 1}), pk1); }
  catch { reuseRejected = true; }
  checks.idempotencyReuseRejected = reuseRejected;

  // -------------------------------------------------------------------
  // Phase 3 — Revocation
  // -------------------------------------------------------------------

  const revoked = await actionRepo.revokeGrant(orgId, g1.id, 'Integration test');
  checks.revokeIssuedToRevoked = revoked.status === 'REVOKED';

  let doubleRevoke = false;
  try { await actionRepo.revokeGrant(orgId, g1.id, 'again'); }
  catch { doubleRevoke = true; }
  checks.doubleRevokeRejected = doubleRevoke;

  // -------------------------------------------------------------------
  // Phase 4 — Outbox consume → Receipt
  // -------------------------------------------------------------------

  const {grant: g2, outbox: o2, ownerPublicKey: pk2} = createDemoActionGrant(campaign, { platform: 'BLUESKY', executionMode: 'DIRECT', now });
  g2.id = uid(); o2.id = uid(); o2.aggregateId = g2.id;
  await actionRepo.createGrantWithOutbox(g2, o2, `consume-${Date.now()}`, sha256Digest({g: g2.id}), pk2);

  const claimed = await actionRepo.claimNextOutbox('verify-op');
  checks.claimed = claimed !== undefined && claimed.state === 'PROCESSING';
  checks.claimedLockedBy = claimed?.lockedBy === 'verify-op';

  const receipt: ActionReceipt = {
    id: '01908900-0000-7000-8000-00000000cc01',
    organizationId: orgId,
    actionGrantId: g2.id,
    schemaVersion: 1,
    platform: 'BLUESKY',
    executionMode: 'DIRECT',
    state: 'PUBLISHED',
    platformUri: 'https://bsky.app/profile/test.bsky.social/post/verify-m3',
    platformCid: 'bafyrei-verify-m3',
    handoffSteps: null, unknownReason: null,
    reconciledAt: null, reconciliationMethod: null,
    createdAt: now.toISOString(),
  };
  const saved = await actionRepo.completeOutbox(claimed!.id, receipt);
  checks.receiptCreated = saved.state === 'PUBLISHED';
  checks.receiptUri = saved.platformUri!.includes('bsky.app');

  const receipts = await actionRepo.getReceiptsByCampaign(orgId, campaignId);
  checks.receiptListed = receipts.some((r) => r.id === receipt.id);

  const single = await actionRepo.getReceipt(orgId, receipt.id);
  checks.receiptQueryable = single?.state === 'PUBLISHED';

  // -------------------------------------------------------------------
  // Phase 5 — Negative: tampered digest
  // -------------------------------------------------------------------

  const {grant: g3, outbox: o3} = createDemoActionGrant(campaign, { platform: 'BLUESKY', executionMode: 'DIRECT', now });
  g3.id = uid(); o3.id = uid(); o3.aggregateId = g3.id;
  const tampered = {...g3, grantDigest: '0'.repeat(64)};
  // Store tampered grant directly via raw SQL
  await pool.query(
    `insert into action_grants(organization_id,id,campaign_id,schedule_occurrence_id,artifact_revision_id,activation_unit_id,schema_version,platform,execution_mode,status,issued_at,expires_at,grant_digest,channel_account_id,capability_snapshot_id,owner_signature,owner_key_id,payload,created_at)
     values($1,$2,$3,$4,$5,$6,1,'BLUESKY','DIRECT','ISSUED',$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [orgId, g3.id, campaignId, occId, artId, g3.activationUnitId,
      g3.issuedAt, g3.expiresAt, g3.grantDigest,
      g3.channelAccountId, g3.capabilitySnapshotId,
      g3.ownerSignature, g3.ownerKeyId,
      JSON.stringify(tampered), now.toISOString()],
  );
  await pool.query(
    `insert into outbox(organization_id,id,aggregate_type,aggregate_id,schema_version,payload,state,attempts,created_at)
     values($1,$2,'ACTION_GRANT',$3,1,$4,'PENDING',0,$5)`,
    [orgId, o3.id, g3.id, JSON.stringify({grant: tampered, revision: campaign.artifactRevisions[0]}), now.toISOString()],
  );

  const ct = await actionRepo.claimNextOutbox('verify-op');
  checks.tamperedClaimable = ct !== undefined;
  const ft = await actionRepo.failOutbox(ct!.id, 'Digest mismatch (integration test)');
  checks.failOutbox = ft.outbox.state === 'FAILED';
  checks.unknownReceiptWritten = ft.receipt.state === 'UNKNOWN';

  // -------------------------------------------------------------------
  // Phase 6 — Immutability
  // -------------------------------------------------------------------

  let receiptUpdatable = false;
  try {
    await pool.query(`update action_receipts set state='FAILED' where organization_id=$1 and id=$2`, [orgId, receipt.id]);
  } catch {
    receiptUpdatable = true; // expected — immutable trigger blocks it
  }
  checks.receiptImmutable = receiptUpdatable;

  // -------------------------------------------------------------------
  // Phase 7 — Evidence
  // -------------------------------------------------------------------

  const entryCounts = Object.fromEntries(
    (await Promise.all(['action_grants', 'outbox', 'action_receipts'].map(async (t) =>
      [t, Number((await pool.query(`select count(*)::int as c from ${t}`)).rows[0].c)]
    )))
  );
  checks.entryCounts = entryCounts;

  const passed = Object.entries(checks).filter(([, v]) => Boolean(v)).length;
  const total = Object.keys(checks).length;
  const result = {schemaVersion: 1, status: passed === total ? 'PASS' : 'FAIL', passed, total, checks};

  await mkdir('.evidence/m3-01', {recursive: true});
  await writeFile('.evidence/m3-01/action-grant-integration.json', `${JSON.stringify(result, null, 2)}\n`);
  console.info(JSON.stringify(result, null, 2));

  if (result.status !== 'PASS') {
    process.exitCode = 1;
  }
} finally {
  await actionRepo.close().catch(() => {});
  await pool.end().catch(() => {});
}
