import {sha256Digest} from './canonical.js';
import {digestCampaign} from './campaign.js';
import type {ArtifactRevision, CampaignDocument, CapabilitySnapshot, MissionContract, PlatformArtifact} from './campaign-types.js';
import {createDemoOrganizationGraph} from './graph-fixture.js';
import {createUuidV7} from './id.js';
import type {Platform} from './types.js';

const entropy = (seed: number): Uint8Array => Uint8Array.from(Array.from({length: 10}, (_, index) => (seed * 13 + index * 19) & 0xff));
const id = (offset: number): string => createUuidV7(1_788_100_000_000 + offset, entropy(offset));
const roleIds = ['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'] as const;

export function createDemoCampaignDocument(): CampaignDocument {
  const graph = createDemoOrganizationGraph();
  const organizationId = graph.organization.id;
  const campaignId = id(1);
  const product = graph.products[0]!;
  const evidenceId = id(2);
  const approvedClaimId = id(3);
  const draftClaimId = id(4);
  const marketIds = graph.markets.map((market) => market.id);
  const capabilities = graph.channelAccounts.map((account, index) => capability(account.platform, organizationId, account.id, id(20 + index)));
  const capabilityByAccount = new Map(capabilities.map((item) => [item.channelAccountId, item]));
  const mandates = new Map(graph.accountMandates.map((item) => [item.channelAccountId, item]));
  const units = graph.channelAccounts.map((account, index) => {
    const mandate = mandates.get(account.id)!;
    return {id: id(10 + index), organizationId, schemaVersion: 1 as const, identityId: account.identityId, productId: mandate.productId, marketId: mandate.marketId, channelAccountId: account.id, accountMandateId: mandate.id, platform: account.platform, plannedAction: 'PREPARE' as const};
  }) as CampaignDocument['activationPlan']['units'];
  const artifacts = units.map((unit, index) => ({
    id: id(30 + index), organizationId, campaignId, activationUnitId: unit.id, schemaVersion: 1 as const, revision: 1,
    platform: unit.platform, capabilitySnapshotId: capabilityByAccount.get(unit.channelAccountId)!.id,
    claimIds: [approvedClaimId], content: content(unit.platform), createdAt: '2026-08-03T00:00:00.000Z'
  })) as ArtifactRevision[];
  const missionContract: MissionContract = {schemaVersion: 1, sourceDigest: '0'.repeat(64), executionMode: 'SHADOW_PREP_ONLY', live: false, roleIds: [...roleIds], artifactPlatforms: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'], externalActionAllowed: false};
  const document: CampaignDocument = {
    schemaVersion: 1, id: campaignId, organizationId, dataMode: 'DEMO_SEED', live: false, graph,
    brief: {schemaVersion: 1, name: 'LumiClaw Presence local launch', objective: 'Explain the product direction and invite design-partner conversations using synthetic local content.', callToAction: 'Review the public product direction and share structured feedback.', contentLanguage: 'en', targetWindowStart: '2026-08-10T00:00:00.000Z', targetWindowEnd: '2026-08-20T00:00:00.000Z'},
    goalProfile: {schemaVersion: 1, primaryGoal: 'LAUNCH_MOMENTUM', supportingSignal: 'MARKET_LEARNING', measurementNotes: 'Record Owner comprehension and useful feedback; do not claim reach, leads, or revenue.'},
    evidenceRefs: [{id: evidenceId, organizationId, schemaVersion: 1, label: 'Synthetic product direction fixture', sourceUrl: 'https://example.invalid/evidence/lumiclaw-product-direction', capturedAt: '2026-08-03T00:00:00.000Z', contentDigest: sha256Digest('synthetic-public-safe-evidence'), publicSafe: true}],
    claims: [
      {id: approvedClaimId, organizationId, schemaVersion: 1, version: 1, subjectType: 'PRODUCT', subjectId: product.id, marketIds, statement: 'LumiClaw Presence is being built as an AI-native global brand operations product.', effectiveFrom: '2026-08-01T00:00:00.000Z', effectiveUntil: '2027-01-01T00:00:00.000Z', status: 'APPROVED', evidenceRefIds: [evidenceId]},
      {id: draftClaimId, organizationId, schemaVersion: 1, version: 1, subjectType: 'PRODUCT', subjectId: product.id, marketIds, statement: 'A synthetic candidate Claim intentionally remains unapproved to demonstrate a readiness gap.', effectiveFrom: '2026-08-01T00:00:00.000Z', effectiveUntil: '2027-01-01T00:00:00.000Z', status: 'DRAFT', evidenceRefIds: []}
    ],
    activationPlan: {schemaVersion: 1, summary: 'Founder voice prepares X and Xiaohongshu; product voice prepares Bluesky and LinkedIn.', units},
    capabilitySnapshots: capabilities, artifactRevisions: artifacts, publishingSchedules: [], scheduleOccurrences: [], missionContract
  };
  document.missionContract.sourceDigest = digestCampaign(document);
  return document;
}

function capability(platform: Platform, organizationId: string, channelAccountId: string, capabilityId: string): CapabilitySnapshot {
  const common = {id: capabilityId, organizationId, schemaVersion: 1 as const, channelAccountId, platform, capturedAt: '2026-08-03T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', source: 'M1_PUBLIC_SAFE_FIXTURE' as const, disclaimer: 'Approximate preview from a public-safe fixture; native rendering and account capability may differ.'};
  switch (platform) {
    case 'X': return {...common, executionMode: 'PREPARE_ONLY', constraints: {posts: {required: true, maxLength: 280, maxItems: 4}, altText: {required: true, maxLength: 1000}}};
    case 'BLUESKY': return {...common, executionMode: 'DIRECT_PLANNED_NOT_CONNECTED', constraints: {posts: {required: true, maxLength: 300, maxItems: 4}, embedUrl: {required: true, maxLength: 2048}, altText: {required: true, maxLength: 1000}}};
    case 'LINKEDIN': return {...common, executionMode: 'NATIVE_HANDOFF_PLANNED', constraints: {commentary: {required: true, maxLength: 3000}, linkTitle: {required: true, maxLength: 200}, linkUrl: {required: true, maxLength: 2048}}};
    case 'XIAOHONGSHU': return {...common, executionMode: 'NATIVE_HANDOFF_PLANNED', constraints: {title: {required: true, maxLength: 20}, body: {required: true, maxLength: 1000}, topics: {required: true, maxLength: 30, maxItems: 10}, coverLabel: {required: true, maxLength: 80}}};
  }
}

function content(platform: Platform): PlatformArtifact {
  switch (platform) {
    case 'X': return {kind: 'X', posts: ['A local, evidence-bound campaign skeleton for global brand operations. No live action yet.'], altText: 'Synthetic LumiClaw product direction card.'};
    case 'BLUESKY': return {kind: 'BLUESKY', posts: ['We are building LumiClaw Presence as an evidence-bound global brand operations product.'], embedUrl: 'https://example.invalid/lumiclaw', altText: 'Synthetic product direction preview.'};
    case 'LINKEDIN': return {kind: 'LINKEDIN', commentary: 'LumiClaw Presence is a local, non-live campaign walking skeleton focused on governed global brand operations.', authorKind: 'COMPANY', linkTitle: 'LumiClaw Presence product direction', linkUrl: 'https://example.invalid/lumiclaw'};
    case 'XIAOHONGSHU': return {kind: 'XIAOHONGSHU', title: 'LumiClaw 本地体验', body: '这是一个只保存和预览、不执行真实发布的品牌运营骨架。', topics: ['品牌运营', '安全演示'], coverLabel: 'LumiClaw Presence 合成封面'};
  }
}
