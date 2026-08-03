import {describe, expect, it} from 'vitest';
import {canonicalize, sha256Digest} from './canonical.js';
import {createDemoCampaignDocument} from './campaign-fixture.js';
import {digestCampaign, validateCampaignDocument} from './campaign.js';

const now = new Date('2026-08-03T12:00:00.000Z');

describe('campaign contracts v1', () => {
  it('canonicalizes object keys and governed changes deterministically', () => {
    expect(canonicalize({b: 2, a: {d: 4, c: 3}})).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(sha256Digest({b: 2, a: 1})).toBe(sha256Digest({a: 1, b: 2}));
    const document = createDemoCampaignDocument();
    const before = digestCampaign(document);
    document.brief.callToAction += ' Updated.';
    expect(digestCampaign(document)).not.toBe(before);
  });

  it('accepts the complete four-platform Campaign fixture', () => {
    const document = createDemoCampaignDocument();
    expect(validateCampaignDocument(document, now)).toEqual({ok: true});
    expect(document.missionContract.sourceDigest).toBe(digestCampaign(document));
  });

  it.each([
    ['CLAIM_EXPIRED', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.claims[0]!.effectiveUntil = '2026-08-03T00:00:00.000Z'; }],
    ['CLAIM_REVOKED', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.claims[0]!.status = 'REVOKED'; }],
    ['CLAIM_PRODUCT_SCOPE_INVALID', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.claims[0]!.subjectId = document.graph.identities[0]!.id; }],
    ['CLAIM_MARKET_SCOPE_INVALID', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.claims[0]!.marketIds = [document.graph.markets[0]!.id]; const xhs = document.activationPlan.units.find((unit) => unit.platform === 'XIAOHONGSHU')!; expect(xhs.marketId).toBe(document.graph.markets[1]!.id); }],
    ['ACTIVATION_MANDATE_SCOPE_INVALID', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.activationPlan.units[0].accountMandateId = document.activationPlan.units[1].accountMandateId; }],
    ['CAMPAIGN_DUPLICATE_ID', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.claims[1]!.id = document.claims[0]!.id; }],
    ['SCHEMA_INVALID', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.artifactRevisions[0]!.claimIds = []; }],
    ['ARTIFACT_ACTIVATION_SCOPE_INVALID', (document: ReturnType<typeof createDemoCampaignDocument>) => { document.artifactRevisions[0]!.activationUnitId = document.artifactRevisions[1]!.activationUnitId; document.artifactRevisions[0]!.platform = document.artifactRevisions[1]!.platform; document.artifactRevisions[0]!.content = structuredClone(document.artifactRevisions[1]!.content); document.artifactRevisions[0]!.capabilitySnapshotId = document.artifactRevisions[1]!.capabilitySnapshotId; }],
    ['ARTIFACT_TEXT_LIMIT_EXCEEDED', (document: ReturnType<typeof createDemoCampaignDocument>) => { const x = document.artifactRevisions.find((item) => item.platform === 'X')!; if (x.content.kind === 'X') x.content.posts = ['x'.repeat(281)]; }]
  ])('rejects %s', (code, mutate) => {
    const document = createDemoCampaignDocument();
    mutate(document);
    document.missionContract.sourceDigest = digestCampaign(document);
    const result = validateCampaignDocument(document, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((item) => item.code)).toContain(code);
  });

  it('rejects source digest tampering independently of schema shape', () => {
    const document = createDemoCampaignDocument();
    document.missionContract.sourceDigest = 'f'.repeat(64);
    const result = validateCampaignDocument(document, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((item) => item.code)).toContain('MISSION_SOURCE_DIGEST_MISMATCH');
  });

  it('rejects malformed nested artifact and capability objects as schema errors', () => {
    const malformedArtifact = createDemoCampaignDocument() as unknown as {artifactRevisions: unknown[]};
    malformedArtifact.artifactRevisions[0] = {};
    const artifactResult = validateCampaignDocument(malformedArtifact, now);
    expect(artifactResult.ok).toBe(false);
    if (!artifactResult.ok) expect(artifactResult.issues.every((item) => item.code === 'SCHEMA_INVALID')).toBe(true);

    const malformedCapability = createDemoCampaignDocument() as unknown as {capabilitySnapshots: unknown[]};
    malformedCapability.capabilitySnapshots[0] = {id: 'not-a-domain-id'};
    const capabilityResult = validateCampaignDocument(malformedCapability, now);
    expect(capabilityResult.ok).toBe(false);
    if (!capabilityResult.ok) expect(capabilityResult.issues.every((item) => item.code === 'SCHEMA_INVALID')).toBe(true);
  });
});
