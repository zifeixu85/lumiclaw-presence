import type {CampaignEnvelope} from '@lumiclaw/domain';

const ids = {
  organization: '0198a000-0000-7000-8000-000000000001', campaign: '0198a000-0000-7000-8000-000000000002', brand: '0198a000-0000-7000-8000-000000000003', product: '0198a000-0000-7000-8000-000000000004', market: '0198a000-0000-7000-8000-000000000005', identity: '0198a000-0000-7000-8000-000000000006', claim: '0198a000-0000-7000-8000-000000000007', evidence: '0198a000-0000-7000-8000-000000000008'
};
const platforms = ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'] as const;
const artifacts = [
  {platform: 'X', content: {kind: 'X', posts: ['A governed, local public presence starts with exact evidence and an owner decision.'], altText: 'Public-safe LumiClaw Presence evidence card.'}},
  {platform: 'BLUESKY', content: {kind: 'BLUESKY', posts: ['LumiClaw Presence keeps brand operations evidence-bound and reviewable.'], embedUrl: 'https://example.invalid/lumiclaw', altText: 'Public-safe product preview.'}},
  {platform: 'LINKEDIN', content: {kind: 'LINKEDIN', commentary: 'LumiClaw Presence is being built as an AI-native global brand operations workspace with governed review and manual publishing handoff.', authorKind: 'COMPANY', linkTitle: 'LumiClaw Presence', linkUrl: 'https://example.invalid/lumiclaw'}},
  {platform: 'XIAOHONGSHU', content: {kind: 'XIAOHONGSHU', title: '让品牌表达有据可查', body: '从品牌事实、市场语境到发布前审阅，都保留清楚的责任与依据。', topics: ['品牌运营', '全球化'], coverLabel: 'LumiClaw Presence 公开安全示例'}}
] as const;

export const productionStoryCampaign = {
  document: {
    schemaVersion: 1, id: ids.campaign, organizationId: ids.organization, dataMode: 'DEMO_SEED', live: false,
    graph: {
      schemaVersion: 1,
      organization: {id: ids.organization, schemaVersion: 1, slug: 'lumiclaw-example', displayName: 'LumiClaw Example Organization'},
      identities: [{id: ids.identity, organizationId: ids.organization, schemaVersion: 1, kind: 'BRAND', displayName: 'LumiClaw', publicBio: 'Public-safe example identity.'}],
      brands: [{id: ids.brand, organizationId: ids.organization, schemaVersion: 1, name: 'LumiClaw', positioning: 'AI-native global brand operations'}],
      products: [{id: ids.product, organizationId: ids.organization, schemaVersion: 1, brandId: ids.brand, name: 'LumiClaw Presence', description: 'Governed public presence workspace.'}],
      markets: [{id: ids.market, organizationId: ids.organization, schemaVersion: 1, code: 'US', displayName: 'United States', primaryLanguage: 'en'}],
      channelAccounts: platforms.map((platform, index) => ({id: `0198a000-0000-7000-8000-0000000001${index}`, organizationId: ids.organization, schemaVersion: 1, identityId: ids.identity, platform, displayHandle: `@public-safe-${platform.toLowerCase()}`, connectionState: 'NOT_CONNECTED'})),
      accountMandates: []
    },
    brief: {schemaVersion: 1, name: 'LumiClaw Presence local launch', objective: 'Explain the evidence-bound product direction and invite structured design-partner feedback.', callToAction: 'Review the public product direction.', contentLanguage: 'en', targetWindowStart: '2026-08-16T00:00:00.000Z', targetWindowEnd: '2026-08-30T00:00:00.000Z'},
    goalProfile: {schemaVersion: 1, primaryGoal: 'LAUNCH_MOMENTUM', supportingSignal: 'MARKET_LEARNING', measurementNotes: 'Public-safe example; no reach, lead, or revenue result.'},
    evidenceRefs: [{id: ids.evidence, organizationId: ids.organization, schemaVersion: 1, label: 'Public-safe product direction', sourceUrl: 'https://example.invalid/evidence', capturedAt: '2026-08-16T00:00:00.000Z', contentDigest: 'a'.repeat(64), publicSafe: true}],
    claims: [{id: ids.claim, organizationId: ids.organization, schemaVersion: 1, version: 1, subjectType: 'PRODUCT', subjectId: ids.product, marketIds: [ids.market], statement: 'LumiClaw Presence is being built as an AI-native global brand operations product.', effectiveFrom: '2026-08-01T00:00:00.000Z', effectiveUntil: '2027-01-01T00:00:00.000Z', status: 'APPROVED', evidenceRefIds: [ids.evidence]}],
    activationPlan: {schemaVersion: 1, summary: 'Public-safe four-platform preparation.', units: []},
    capabilitySnapshots: platforms.map((platform, index) => ({id: `0198a000-0000-7000-8000-0000000002${index}`, organizationId: ids.organization, schemaVersion: 1, channelAccountId: `0198a000-0000-7000-8000-0000000001${index}`, platform, capturedAt: '2026-08-16T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', source: 'M1_PUBLIC_SAFE_FIXTURE', executionMode: 'NATIVE_HANDOFF_PLANNED', constraints: {}, disclaimer: 'Public-safe fixture; no live capability.'})),
    artifactRevisions: artifacts.map((item, index) => ({id: `0198a000-0000-7000-8000-0000000003${index}`, organizationId: ids.organization, campaignId: ids.campaign, activationUnitId: `0198a000-0000-7000-8000-0000000004${index}`, schemaVersion: 1, revision: 1, platform: item.platform, capabilitySnapshotId: `0198a000-0000-7000-8000-0000000002${index}`, claimIds: [ids.claim], content: item.content, createdAt: '2026-08-16T00:00:00.000Z'})),
    publishingSchedules: [], scheduleOccurrences: [],
    missionContract: {schemaVersion: 1, sourceDigest: 'b'.repeat(64), executionMode: 'SHADOW_PREP_ONLY', live: false, roleIds: ['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'], artifactPlatforms: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'], externalActionAllowed: false}
  }, version: 1, digest: 'b'.repeat(64), etag: '"story-public-safe-etag"', readiness: 'SAVED', gapCodes: [], createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z', mode: 'DEMO_SEED', live: false
} as unknown as CampaignEnvelope;
