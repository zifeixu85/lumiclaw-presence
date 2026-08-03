import {describe, expect, it} from 'vitest';
import {createCampaignEnvelope, advanceCampaignEnvelope} from './campaign-envelope.js';
import {createDemoCampaignDocument} from './campaign-fixture.js';

describe('campaign envelope versioning', () => {
  it('creates a stable ETag and exposes the synthetic evidence gap', () => {
    const envelope = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    expect(envelope.etag).toBe(`"campaign-${envelope.document.id}-v1-${envelope.digest}"`);
    expect(envelope.readiness).toBe('NEEDS_OWNER');
    expect(envelope.gapCodes[0]).toMatch(/^CLAIM_EVIDENCE_REQUIRED:/u);
  });

  it('increments only a changed platform ArtifactRevision', () => {
    const current = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    const incoming = structuredClone(current.document);
    const x = incoming.artifactRevisions.find((item) => item.platform === 'X')!;
    if (x.content.kind === 'X') x.content.posts[0] = 'A changed synthetic X draft.';
    const next = advanceCampaignEnvelope(current, incoming, new Date('2026-08-03T13:00:00.000Z'));
    expect(next.version).toBe(2);
    expect(next.digest).not.toBe(current.digest);
    expect(next.document.artifactRevisions.find((item) => item.platform === 'X')?.revision).toBe(2);
    expect(next.document.artifactRevisions.find((item) => item.platform === 'BLUESKY')?.revision).toBe(1);
  });
});
