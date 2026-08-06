import {createDemoCampaignDocument, createPublishingSchedule} from '@lumiclaw/domain';
import {describe, expect, it} from 'vitest';
import {rebaseCampaignDraft} from '../lib/campaign-rebase';
import {platformPreviewModel} from '../lib/platform-preview-model';

describe('four-platform native-like preview contract', () => {
  it('renders four distinct structures from the persisted ArtifactRevision model', () => {
    const document = createDemoCampaignDocument();
    const models = document.artifactRevisions.map((revision) => platformPreviewModel(revision.content));
    expect(models.map((model) => model.className).sort()).toEqual(['preview-bluesky', 'preview-linkedin', 'preview-x', 'preview-xhs']);
    expect(new Set(models.map((model) => model.primaryText)).size).toBe(4);
    expect(JSON.stringify(models)).not.toMatch(/PUBLISHED|LIVE_SUCCESS/u);
  });

  it('three-way rebases non-overlapping edits and keeps an explicit local choice on conflicts', () => {
    const base = createDemoCampaignDocument();
    const local = structuredClone(base);
    const server = structuredClone(base);
    local.brief.objective = 'Local owner objective';
    server.brief.callToAction = 'Server-side call to action';
    const clean = rebaseCampaignDraft(base, local, server);
    expect(clean.document.brief.objective).toBe('Local owner objective');
    expect(clean.document.brief.callToAction).toBe('Server-side call to action');
    expect(clean.conflictPaths).toEqual([]);

    server.brief.objective = 'Concurrent server objective';
    const conflicted = rebaseCampaignDraft(base, local, server);
    expect(conflicted.document.brief.objective).toBe('Local owner objective');
    expect(conflicted.conflictPaths).toContain('/brief/objective');
  });

  it('drops a local schedule proposal after a 412 so it cannot bind stale revisions', () => {
    const base = createDemoCampaignDocument();
    const local = structuredClone(base);
    const proposal = createPublishingSchedule({organizationId: local.organizationId, campaignId: local.id, artifactRevisions: local.artifactRevisions, localStart: '2026-11-01T01:30', timeZone: 'America/New_York', foldPreference: 'LATER', misfirePolicy: 'HOLD_FOR_OWNER'}, new Date('2026-08-03T12:00:00.000Z'));
    local.publishingSchedules.push(proposal.schedule);
    local.scheduleOccurrences.push(...proposal.occurrences);
    const server = structuredClone(base);
    server.brief.callToAction = 'Concurrent server edit';
    const rebased = rebaseCampaignDraft(base, local, server);
    expect(rebased.document.publishingSchedules).toEqual(server.publishingSchedules);
    expect(rebased.document.scheduleOccurrences).toEqual(server.scheduleOccurrences);
    expect(rebased.conflictPaths).toContain('/publishingSchedules/stale-preview');
  });

  it('recomputes a conflict merge from the latest local draft instead of applying a cached result', () => {
    const base = createDemoCampaignDocument();
    const server = structuredClone(base);
    server.brief.callToAction = 'Concurrent server call to action';
    const localAtRefresh = structuredClone(base);
    localAtRefresh.brief.objective = 'Local objective at refresh';
    const cached = rebaseCampaignDraft(base, localAtRefresh, server);
    const latestLocal = structuredClone(localAtRefresh);
    const x = latestLocal.artifactRevisions.find((item) => item.platform === 'X')!;
    if (x.content.kind === 'X') x.content.posts[0] = 'Edit made after the conflict refresh.';
    const recomputed = rebaseCampaignDraft(base, latestLocal, server);
    expect(JSON.stringify(cached.document)).not.toContain('Edit made after the conflict refresh.');
    expect(JSON.stringify(recomputed.document)).toContain('Edit made after the conflict refresh.');
    expect(recomputed.document.brief.callToAction).toBe('Concurrent server call to action');
  });
});
