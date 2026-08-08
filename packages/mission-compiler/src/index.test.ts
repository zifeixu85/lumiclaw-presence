import {createDemoCampaignDocument} from '@lumiclaw/domain';
import {describe, expect, it} from 'vitest';
import {compileMissionAdapterInput} from './index.js';

describe('M1 mission compiler smoke', () => {
  it('imports one persisted digest into six separated non-live adapter roles', () => {
    const input = compileMissionAdapterInput(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    expect(input.live).toBe(false);
    expect(input.externalActionAllowed).toBe(false);
    expect(input.roles).toHaveLength(6);
    expect(input.roles.find((role) => role.id === 'presence-mission-leader')).toEqual(expect.objectContaining({orchestrationOnly: true, permissions: ['ORCHESTRATE']}));
    expect(input.roles.find((role) => role.id === 'independent-auditor')?.permissions).toEqual(['AUDIT']);
    expect(input.artifacts.map((item) => item.platform)).toEqual(['X', 'XIAOHONGSHU', 'BLUESKY', 'LINKEDIN']);
  });
});
