import {describe, expect, it} from 'vitest';
import {EvoLinkMediaProvider, PublicSafeMockMediaProvider, verifyContentAddressedIngest} from './media-provider.js';

describe('M2 MediaGenerationProvider boundary', () => {
  it('content-addresses a synthetic receipt without auto-approval', async () => { const result = await new PublicSafeMockMediaProvider(() => new Date('2026-08-04T00:00:00Z')).generate({organizationId: 'org', missionId: 'mission', prompt: 'Public-safe launch direction', rightsConfirmedSynthetic: true}); expect(verifyContentAddressedIngest(result.asset, result.content)).toBe(true); expect(result.asset).toMatchObject({provider: 'PUBLIC_SAFE_MOCK', approvalState: 'UNREVIEWED', rights: {commercialUseReviewed: false, ownerApprovalRequired: true}, costReceipt: {amount: 0}}); });
  it('rejects media generation without explicit synthetic-rights confirmation', async () => { await expect(new PublicSafeMockMediaProvider().generate({organizationId: 'org', missionId: 'mission', prompt: 'fixture', rightsConfirmedSynthetic: false} as never)).rejects.toMatchObject({code: 'MEDIA_SYNTHETIC_RIGHTS_REQUIRED'}); });
  it('does not block local acceptance when EvoLink key is absent', async () => { await expect(new EvoLinkMediaProvider(undefined).generate({organizationId: 'org', missionId: 'mission', prompt: 'fixture', rightsConfirmedSynthetic: true})).rejects.toMatchObject({code: 'EVOLINK_CANARY_KEY_REQUIRED', retryable: false}); });
});
