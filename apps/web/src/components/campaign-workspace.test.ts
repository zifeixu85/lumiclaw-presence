import {createDemoCampaignDocument} from '@lumiclaw/domain';
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
});
