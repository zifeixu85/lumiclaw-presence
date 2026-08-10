import {describe, expect, it} from 'vitest';
import {sha256Digest} from './canonical.js';
import {
  createDemoActionGrant,
  digestActionGrant,
  isGrantConsumable,
  isGrantConsumed,
  validateActionGrant,
} from './action-grant.js';
import {createDemoCampaignDocument} from './campaign-fixture.js';
import type {ActionGrant} from './action-grant.js';
import type {CampaignDocument} from './campaign-types.js';

const now = new Date('2026-08-08T12:00:00.000Z');

function cloneGrant(grant: ActionGrant): ActionGrant {
  return structuredClone(grant);
}

describe('action grant contracts v1', () => {
  // -----------------------------------------------------------------------
  // Positive cases
  // -----------------------------------------------------------------------

  it('accepts a valid ActionGrant against the demo Campaign', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    const result = validateActionGrant(grant, campaign, now);
    expect(result).toEqual({ok: true});
  });

  it('produces a deterministic canonical digest', () => {
    const campaign = createDemoCampaignDocument();
    const {grant: a} = createDemoActionGrant(campaign, now);
    const {grant: b} = createDemoActionGrant(campaign, now);
    // Same input → same digest
    expect(digestActionGrant(a)).toBe(digestActionGrant(b));
    // Digest is 64 hex chars
    expect(digestActionGrant(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes digest when a governed field is mutated', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    const before = digestActionGrant(grant);
    const tampered = cloneGrant(grant);
    tampered.artifactRevisionId = campaign.artifactRevisions[1]!.id;
    expect(digestActionGrant(tampered)).not.toBe(before);
  });

  it('isGrantConsumable returns true for ISSUED grant within window', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    expect(isGrantConsumable(grant, now)).toBe(true);
  });

  it('isGrantConsumable returns false for CONSUMED grant', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    const consumed = cloneGrant(grant);
    consumed.status = 'CONSUMED';
    consumed.consumedAt = now.toISOString();
    expect(isGrantConsumable(consumed, now)).toBe(false);
  });

  it('isGrantConsumable returns false for REVOKED grant', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    const revoked = cloneGrant(grant);
    revoked.status = 'REVOKED';
    revoked.revocationReason = 'Owner changed their mind';
    expect(isGrantConsumable(revoked, now)).toBe(false);
  });

  it('isGrantConsumable returns false for EXPIRED grant', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    const expired = cloneGrant(grant);
    expired.status = 'EXPIRED';
    expect(isGrantConsumable(expired, now)).toBe(false);
  });

  it('isGrantConsumed returns true only for CONSUMED status', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    expect(isGrantConsumed(grant)).toBe(false);
    const consumed = cloneGrant(grant);
    consumed.status = 'CONSUMED';
    expect(isGrantConsumed(consumed)).toBe(true);
  });

  it('createDemoActionGrant produces internally consistent grant + outbox', () => {
    const campaign = createDemoCampaignDocument();
    const {grant, outbox} = createDemoActionGrant(campaign, now);
    // Outbox points to the grant
    expect(outbox.aggregateType).toBe('ACTION_GRANT');
    expect(outbox.aggregateId).toBe(grant.id);
    expect(outbox.state).toBe('PENDING');
    expect(outbox.attempts).toBe(0);
    // Grant self-consistent
    expect(grant.platform).toBe('BLUESKY');
    expect(grant.executionMode).toBe('DIRECT');
    expect(grant.status).toBe('ISSUED');
    expect(grant.grantDigest).toBe(digestActionGrant(grant));
    // Expiry 15 min after issue
    const issued = Date.parse(grant.issuedAt);
    const expires = Date.parse(grant.expiresAt);
    expect(expires - issued).toBe(15 * 60 * 1000);
    // Bound references are populated
    expect(grant.channelAccountId).toBeTruthy();
    expect(grant.capabilitySnapshotId).toBeTruthy();
    const channelAccount = campaign.graph.channelAccounts.find(
      (a) => a.id === grant.channelAccountId,
    );
    expect(channelAccount).toBeDefined();
    expect(channelAccount!.platform).toBe('BLUESKY');
    const capability = campaign.capabilitySnapshots.find(
      (c) => c.id === grant.capabilitySnapshotId,
    );
    expect(capability).toBeDefined();
    expect(capability!.platform).toBe('BLUESKY');
    expect(capability!.channelAccountId).toBe(grant.channelAccountId);
  });

  // -----------------------------------------------------------------------
  // Negative cases — it.each
  // -----------------------------------------------------------------------

  it.each([
    [
      'ACTION_GRANT_SCOPE_INVALID — organizationId mismatch',
      (grant: ActionGrant) => {
        grant.organizationId = '01908900-0000-7000-8000-000000000001';
      },
    ],
    [
      'ACTION_GRANT_SCOPE_INVALID — campaignId mismatch',
      (grant: ActionGrant) => {
        grant.campaignId = '01908900-0000-7000-8000-000000000002';
      },
    ],
    [
      'ACTION_GRANT_DIGEST_MISMATCH — tampered grantDigest',
      (grant: ActionGrant) => {
        grant.grantDigest = 'f'.repeat(64);
      },
    ],
    [
      'ACTION_GRANT_EXPIRED — status EXPIRED',
      (grant: ActionGrant) => {
        grant.status = 'EXPIRED';
      },
    ],
    [
      'ACTION_GRANT_EXPIRED — expiresAt in the past',
      (grant: ActionGrant) => {
        grant.expiresAt = '2026-08-07T00:00:00.000Z';
      },
    ],
    [
      'ACTION_GRANT_REVOKED — status REVOKED',
      (grant: ActionGrant) => {
        grant.status = 'REVOKED';
        grant.revocationReason = 'test';
      },
    ],
    [
      'ACTION_GRANT_ALREADY_CONSUMED — status CONSUMED',
      (grant: ActionGrant) => {
        grant.status = 'CONSUMED';
        grant.consumedAt = now.toISOString();
      },
    ],
    [
      'ACTION_GRANT_OCCURRENCE_NOT_FOUND — bogus occurrenceId',
      (grant: ActionGrant) => {
        grant.scheduleOccurrenceId = '01908900-ffff-7000-8000-000000000099';
      },
    ],
    [
      'ACTION_GRANT_REVISION_NOT_FOUND — bogus revisionId',
      (grant: ActionGrant) => {
        grant.artifactRevisionId = '01908900-ffff-7000-8000-000000000099';
      },
    ],
    [
      'ACTION_GRANT_SCOPE_INVALID — platform/revision mismatch',
      (grant: ActionGrant, _campaign: CampaignDocument) => {
        grant.platform = 'LINKEDIN';
        // grantDigest must be recomputed after mutation
        grant.grantDigest = digestActionGrant(grant);
      },
    ],
    [
      'ACTION_GRANT_SCOPE_INVALID — activationUnit/revision mismatch',
      (grant: ActionGrant, campaign: CampaignDocument) => {
        const linkedInUnit = campaign.activationPlan.units.find(
          (u) => u.platform === 'LINKEDIN',
        )!;
        grant.activationUnitId = linkedInUnit.id;
        grant.grantDigest = digestActionGrant(grant);
      },
    ],
    [
      'ACTION_GRANT_CHANNEL_ACCOUNT_NOT_FOUND — bogus channelAccountId',
      (grant: ActionGrant) => {
        grant.channelAccountId = '01908900-ffff-7000-8000-000000000099';
        grant.grantDigest = digestActionGrant(grant);
      },
    ],
    [
      'ACTION_GRANT_CAPABILITY_NOT_FOUND — bogus capabilitySnapshotId',
      (grant: ActionGrant) => {
        grant.capabilitySnapshotId = '01908900-ffff-7000-8000-000000000099';
        grant.grantDigest = digestActionGrant(grant);
      },
    ],
    [
      'ACTION_GRANT_CAPABILITY_PLATFORM_MISMATCH — capability platform != grant platform',
      (grant: ActionGrant, campaign: CampaignDocument) => {
        const liCapability = campaign.capabilitySnapshots.find(
          (c) => c.platform === 'LINKEDIN',
        )!;
        grant.capabilitySnapshotId = liCapability.id;
        grant.grantDigest = digestActionGrant(grant);
      },
    ],
    [
      'ACTION_GRANT_CAPABILITY_ACCOUNT_MISMATCH — capability account != grant account',
      (grant: ActionGrant, campaign: CampaignDocument) => {
        const liCapability = campaign.capabilitySnapshots.find(
          (c) => c.platform === 'LINKEDIN',
        )!;
        // Point capability to a different channel account
        grant.capabilitySnapshotId = liCapability.id;
        // Keep grant.channelAccountId as Bluesky
        grant.grantDigest = digestActionGrant(grant);
      },
    ],
  ])('rejects %s', (_label, mutate) => {
    const campaign = createDemoCampaignDocument();
    const {grant: original} = createDemoActionGrant(campaign, now);
    const grant = cloneGrant(original);
    mutate(grant, campaign);
    // Recompute digest for mutations that affect body fields
    // (other mutations already set it explicitly or break it)
    const result = validateActionGrant(grant, campaign, now);
    expect(result.ok).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Boundary / compound cases
  // -----------------------------------------------------------------------

  it('accepts grant exactly 1 ms before expiry', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    const expiresMs = Date.parse(grant.expiresAt);
    const oneMsBefore = new Date(expiresMs - 1);
    expect(isGrantConsumable(grant, oneMsBefore)).toBe(true);
    const result = validateActionGrant(grant, campaign, oneMsBefore);
    expect(result).toEqual({ok: true});
  });

  it('rejects grant exactly at expiry', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    const expiresMs = Date.parse(grant.expiresAt);
    const atExpiry = new Date(expiresMs);
    expect(isGrantConsumable(grant, atExpiry)).toBe(false);
  });

  it('reports multiple errors at once', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    grant.status = 'CONSUMED';
    grant.consumedAt = now.toISOString();
    grant.grantDigest = '0'.repeat(64);
    const result = validateActionGrant(grant, campaign, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain('ACTION_GRANT_ALREADY_CONSUMED');
      expect(codes).toContain('ACTION_GRANT_DIGEST_MISMATCH');
    }
  });

  it('accepts a valid grant at a later wall-clock time within the window', () => {
    const campaign = createDemoCampaignDocument();
    const {grant} = createDemoActionGrant(campaign, now);
    // 10 minutes after issue but still before expiry
    const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);
    expect(isGrantConsumable(grant, tenMinutesLater)).toBe(true);
    const result = validateActionGrant(grant, campaign, tenMinutesLater);
    expect(result).toEqual({ok: true});
  });
});
