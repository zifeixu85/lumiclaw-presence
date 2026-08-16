import {describe, expect, it} from 'vitest';
import {MemoryLocalPresenceRepository} from './memory-local-presence-repository.js';

describe('memory local presence repository', () => {
  it('reopens an uploaded UTF-8 material and completes the local path only after context', async () => {
    const repository = new MemoryLocalPresenceRepository();
    const now = new Date('2026-08-16T00:00:00.000Z');
    const profile = await repository.createProfile('Owner', now);
    await repository.selectLocalMaterials(profile.id, now);
    const material = await repository.ingestMaterial({ownerProfileId: profile.id, fileName: 'product.md', declaredMediaType: 'text/markdown', bytes: new TextEncoder().encode('# Product\nLocal facts')}, now);
    expect((await repository.listMaterials(profile.id))[0]).toEqual(material);
    await expect(repository.completeLocalOnboarding(profile.id, 'org', 'campaign', now)).rejects.toMatchObject({code: 'LOCAL_ONBOARDING_NOT_READY'});
    await repository.setContext(profile.id, {marketCode: 'US', contentLocale: 'en-US', platform: 'LINKEDIN', timeZone: 'America/Los_Angeles'}, now);
    const complete = await repository.completeLocalOnboarding(profile.id, 'org', 'campaign', now);
    expect(complete).toMatchObject({state: 'COMPLETED', dataMode: 'LOCAL_PRIVATE', materialIds: [material.id]});
    const duplicate = await repository.ingestMaterial({ownerProfileId: profile.id, fileName: 'same-digest.md', declaredMediaType: 'text/markdown', bytes: new TextEncoder().encode('# Product\nLocal facts')}, now);
    expect(duplicate.id).toBe(material.id);
    const second = await repository.ingestMaterial({ownerProfileId: profile.id, fileName: 'second.txt', declaredMediaType: 'text/plain', bytes: new TextEncoder().encode('Additional local facts')}, now);
    expect(await repository.getSession(profile.id)).toMatchObject({state: 'COMPLETED', materialIds: [material.id, second.id]});
    expect(await repository.getProfile()).toMatchObject({displayName: 'Owner', state: 'ONBOARDING_COMPLETE'});
  });

  it('records all desktop handoff actions as awaiting reconciliation and never published', async () => {
    const repository = new MemoryLocalPresenceRepository();
    const now = new Date('2026-08-16T00:00:00.000Z');
    const profile = await repository.createProfile('Owner', now);
    const handoff = await repository.recordManualHandoff({ownerProfileId: profile.id, campaignId: 'campaign', artifactRevisionId: 'revision', platform: 'LINKEDIN', action: 'OWNER_REPORTED_COMPLETE'}, now);
    expect(handoff).toMatchObject({state: 'AWAITING_RECONCILIATION', evidenceReceiptId: null});
    expect(JSON.stringify(handoff)).not.toContain('PUBLISHED');
  });
});
