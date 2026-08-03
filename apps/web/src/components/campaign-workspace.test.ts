import {createDemoCampaignDocument} from '@lumiclaw/domain';
import {describe, expect, it} from 'vitest';
import {platformPreviewModel} from '../lib/platform-preview-model';

describe('four-platform native-like preview contract', () => {
  it('renders four distinct structures from the persisted ArtifactRevision model', () => {
    const document = createDemoCampaignDocument();
    const models = document.artifactRevisions.map((revision) => platformPreviewModel(revision.content));
    expect(models.map((model) => model.className).sort()).toEqual(['preview-bluesky', 'preview-linkedin', 'preview-x', 'preview-xhs']);
    expect(new Set(models.map((model) => model.primaryText)).size).toBe(4);
    expect(JSON.stringify(models)).not.toMatch(/PUBLISHED|LIVE_SUCCESS/u);
  });
});
