import {createUuidV7} from './id.js';
import type {OrganizationGraph, Platform} from './types.js';

const random = (seed: number): Uint8Array => Uint8Array.from(Array.from({length: 10}, (_, index) => (seed + index * 17) & 0xff));
const id = (offset: number): string => createUuidV7(1_788_000_000_000 + offset, random(offset));

export function createDemoOrganizationGraph(): OrganizationGraph {
  const organizationId = id(1);
  const brandId = id(2);
  const productId = id(3);
  const founderIdentityId = id(4);
  const productIdentityId = id(5);
  const globalMarketId = id(6);
  const chinaMarketId = id(7);
  const accounts = ([
    ['X', founderIdentityId, '@founder-demo'],
    ['XIAOHONGSHU', founderIdentityId, '创始人演示账号'],
    ['BLUESKY', productIdentityId, '@product.demo.invalid'],
    ['LINKEDIN', productIdentityId, 'LumiClaw Product Demo']
  ] as [Platform, string, string][]).map(([platform, identityId, displayHandle], index) => ({
    id: id(10 + index), organizationId, schemaVersion: 1 as const, identityId, platform, displayHandle, connectionState: 'NOT_CONNECTED' as const
  }));
  const marketByPlatform: Record<Platform, string> = {X: globalMarketId, BLUESKY: globalMarketId, LINKEDIN: globalMarketId, XIAOHONGSHU: chinaMarketId};

  return {
    schemaVersion: 1,
    organization: {id: organizationId, schemaVersion: 1, slug: 'lumiclaw-demo', displayName: 'LumiClaw Demo Organization', dataMode: 'DEMO_SEED', live: false},
    identities: [
      {id: founderIdentityId, organizationId, schemaVersion: 1, kind: 'PERSON', displayName: 'Founder Demo Identity', publicBio: 'Synthetic founder identity used only for local engineering verification.'},
      {id: productIdentityId, organizationId, schemaVersion: 1, kind: 'PRODUCT', displayName: 'LumiClaw Product Demo', publicBio: 'Synthetic product identity used only for local engineering verification.'}
    ],
    brands: [{id: brandId, organizationId, schemaVersion: 1, name: 'LumiClaw Demo Brand', positioning: 'A synthetic global brand operations example.'}],
    products: [{id: productId, organizationId, schemaVersion: 1, brandId, name: 'LumiClaw Presence Demo', description: 'A local, non-live campaign walking skeleton.'}],
    markets: [
      {id: globalMarketId, organizationId, schemaVersion: 1, code: 'GLOBAL-EN', displayName: 'Global English', primaryLanguage: 'en'},
      {id: chinaMarketId, organizationId, schemaVersion: 1, code: 'CN-ZH', displayName: 'China Chinese', primaryLanguage: 'zh-CN'}
    ],
    channelAccounts: accounts,
    accountMandates: accounts.map((account, index) => ({
      id: id(20 + index), organizationId, schemaVersion: 1, channelAccountId: account.id, identityId: account.identityId, productId,
      marketId: marketByPlatform[account.platform], role: account.identityId === founderIdentityId ? 'FOUNDER_VOICE' : 'PRODUCT_VOICE',
      allowedActions: ['PREPARE'], requiresOwnerReview: true, validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z'
    }))
  };
}
