import {describe, expect, it} from 'vitest';
import {createLocalPrivateCampaignDocument, validateCampaignDocument, validateLocalCampaignIdentityInput} from './index.js';

const input = {
  ownerProfileId: '0198a000-0000-7000-8000-000000000001',
  ownerDisplayName: '本机 Owner',
  profileCreatedAt: '2026-08-16T08:00:00.000Z',
  identity: {organizationName: '星河工作室', brandName: '星河', brandPositioning: '帮助独立团队清楚表达跨市场产品价值。', productName: '星河翻译助手', productDescription: '一个由本机资料确认的多语言产品说明助手。', campaignName: '星河产品首发', campaignObjective: '让目标市场理解产品定位并邀请结构化反馈。', callToAction: '阅读完整说明并分享反馈。'},
  context: {marketCode: 'CN', contentLocale: 'zh-CN', platform: 'XIAOHONGSHU', timeZone: 'Asia/Shanghai'},
  materials: [{fileName: '星河资料.md', digest: 'a'.repeat(64)}]
} as const;

describe('LOCAL_PRIVATE Campaign initialization', () => {
  it('builds a deterministic, material-bound Campaign with user-confirmed Organization, Brand, and Product authority', () => {
    const first = createLocalPrivateCampaignDocument(input);
    const second = createLocalPrivateCampaignDocument(input);
    expect(first).toEqual(second);
    expect(first).toMatchObject({dataMode: 'LOCAL_PRIVATE', graph: {organization: {displayName: '星河工作室', dataMode: 'LOCAL_PRIVATE'}, brands: [{name: '星河'}], products: [{name: '星河翻译助手'}]}, brief: {name: '星河产品首发'}});
    expect(first.evidenceRefs).toEqual([expect.objectContaining({publicSafe: false, sourceUrl: `local-material://sha256/${'a'.repeat(64)}`})]);
    expect(first.capabilitySnapshots.every((item) => item.source === 'LOCAL_UNVERIFIED_DECLARATION')).toBe(true);
    expect(first.graph.channelAccounts.every((item) => item.connectionState === 'NOT_CONNECTED')).toBe(true);
    expect(first.missionContract.externalActionAllowed).toBe(false);
    expect(JSON.stringify(first)).not.toContain('LumiClaw Presence local launch');
    expect(validateCampaignDocument(first, new Date('2026-08-16T08:00:00.000Z'))).toEqual({ok: true});
  });

  it('rejects missing or unknown user-confirmed identity fields', () => {
    expect(() => validateLocalCampaignIdentityInput({...input.identity, apiKey: 'forbidden'})).toThrowError(expect.objectContaining({code: 'LOCAL_CAMPAIGN_IDENTITY_SCHEMA_INVALID'}));
    expect(() => validateLocalCampaignIdentityInput({...input.identity, productName: ''})).toThrowError(expect.objectContaining({code: 'LOCAL_PRODUCT_NAME_INVALID'}));
  });
});
