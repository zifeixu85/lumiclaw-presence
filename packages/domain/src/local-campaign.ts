import {createHash} from 'node:crypto';
import {digestCampaign} from './campaign.js';
import type {CampaignDocument, CapabilitySnapshot, PlatformArtifact} from './campaign-types.js';
import {createUuidV7} from './id.js';
import {LocalPresenceContractError, type LocalMaterialManifest, type LocalOnboardingContext} from './local-presence.js';
import type {Platform} from './types.js';

export type LocalCampaignIdentityInput = {
  organizationName: string;
  brandName: string;
  brandPositioning: string;
  productName: string;
  productDescription: string;
  campaignName: string;
  campaignObjective: string;
  callToAction: string;
};

export type LocalPrivateCampaignInput = {
  ownerProfileId: string;
  ownerDisplayName: string;
  profileCreatedAt: string;
  identity: LocalCampaignIdentityInput;
  context: LocalOnboardingContext;
  materials: ReadonlyArray<Pick<LocalMaterialManifest, 'fileName' | 'digest'>>;
};

const identityKeys = ['brandName', 'brandPositioning', 'callToAction', 'campaignName', 'campaignObjective', 'organizationName', 'productDescription', 'productName'] as const;
const platforms = ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'] as const;
const roleIds = ['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'] as const;

export function validateLocalCampaignIdentityInput(value: unknown): LocalCampaignIdentityInput {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== [...identityKeys].sort().join(',')) throw new LocalPresenceContractError('LOCAL_CAMPAIGN_IDENTITY_SCHEMA_INVALID');
  return {
    organizationName: safeText(value.organizationName, 120, 'LOCAL_ORGANIZATION_NAME_INVALID'),
    brandName: safeText(value.brandName, 120, 'LOCAL_BRAND_NAME_INVALID'),
    brandPositioning: safeText(value.brandPositioning, 1000, 'LOCAL_BRAND_POSITIONING_INVALID'),
    productName: safeText(value.productName, 120, 'LOCAL_PRODUCT_NAME_INVALID'),
    productDescription: safeText(value.productDescription, 2000, 'LOCAL_PRODUCT_DESCRIPTION_INVALID'),
    campaignName: safeText(value.campaignName, 120, 'LOCAL_CAMPAIGN_NAME_INVALID'),
    campaignObjective: safeText(value.campaignObjective, 2000, 'LOCAL_CAMPAIGN_OBJECTIVE_INVALID'),
    callToAction: safeText(value.callToAction, 500, 'LOCAL_CAMPAIGN_CALL_TO_ACTION_INVALID')
  };
}

export function createLocalPrivateCampaignDocument(input: LocalPrivateCampaignInput): CampaignDocument {
  if (input.materials.length < 1) throw new LocalPresenceContractError('LOCAL_MATERIAL_REQUIRED');
  const identity = validateLocalCampaignIdentityInput(input.identity);
  const anchor = Date.parse(input.profileCreatedAt);
  if (!Number.isFinite(anchor)) throw new LocalPresenceContractError('LOCAL_PROFILE_TIMESTAMP_INVALID');
  const makeId = (label: string, offset: number): string => createUuidV7(anchor + offset, createHash('sha256').update(`${input.ownerProfileId}:${label}`).digest().subarray(0, 10));
  const organizationId = makeId('organization', 1);
  const brandId = makeId('brand', 2);
  const productId = makeId('product', 3);
  const ownerIdentityId = makeId('owner-identity', 4);
  const productIdentityId = makeId('product-identity', 5);
  const marketId = makeId('market', 6);
  const campaignId = makeId('campaign', 7);
  const claimId = makeId('claim', 8);
  const capturedAt = new Date(anchor).toISOString();
  const validFrom = new Date(anchor - 24 * 60 * 60 * 1000).toISOString();
  const validUntil = new Date(anchor + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const targetWindowEnd = new Date(anchor + 30 * 24 * 60 * 60 * 1000).toISOString();
  const contentLanguage = input.context.contentLocale.startsWith('zh') ? 'zh-CN' as const : 'en' as const;
  const localLanguage = contentLanguage === 'zh-CN';
  const marketName = marketDisplayName(input.context.marketCode, localLanguage);
  const accounts = platforms.map((platform, index) => ({
    id: makeId(`account-${platform}`, 20 + index), organizationId, schemaVersion: 1 as const,
    identityId: platform === 'X' || platform === 'XIAOHONGSHU' ? ownerIdentityId : productIdentityId,
    platform, displayHandle: `PLANNED_NOT_CONNECTED_${platform}`, connectionState: 'NOT_CONNECTED' as const
  }));
  const mandates = accounts.map((account, index) => ({
    id: makeId(`mandate-${account.platform}`, 30 + index), organizationId, schemaVersion: 1 as const,
    channelAccountId: account.id, identityId: account.identityId, productId, marketId,
    role: account.identityId === ownerIdentityId ? 'FOUNDER_VOICE' as const : 'PRODUCT_VOICE' as const,
    allowedActions: ['PREPARE'] as ['PREPARE'], requiresOwnerReview: true as const, validFrom, validUntil
  }));
  const units = accounts.map((account, index) => ({
    id: makeId(`unit-${account.platform}`, 40 + index), organizationId, schemaVersion: 1 as const,
    identityId: account.identityId, productId, marketId, channelAccountId: account.id,
    accountMandateId: mandates[index]!.id, platform: account.platform, plannedAction: 'PREPARE' as const
  })) as CampaignDocument['activationPlan']['units'];
  const capabilities = accounts.map((account, index) => localCapability(account.platform, organizationId, account.id, makeId(`capability-${account.platform}`, 50 + index), capturedAt, validUntil, localLanguage));
  const evidenceRefs = input.materials.map((material, index) => ({
    id: makeId(`evidence-${material.digest}`, 60 + index), organizationId, schemaVersion: 1 as const,
    label: material.fileName, sourceUrl: `local-material://sha256/${material.digest}`, capturedAt,
    contentDigest: material.digest, publicSafe: false
  }));
  const artifacts = units.map((unit, index) => ({
    id: makeId(`artifact-${unit.platform}`, 80 + index), organizationId, campaignId,
    activationUnitId: unit.id, schemaVersion: 1 as const, revision: 1, platform: unit.platform,
    capabilitySnapshotId: capabilities[index]!.id, claimIds: [claimId],
    content: localContent(unit.platform, identity, localLanguage), createdAt: capturedAt
  })) as CampaignDocument['artifactRevisions'];
  const document: CampaignDocument = {
    schemaVersion: 1, id: campaignId, organizationId, dataMode: 'LOCAL_PRIVATE', live: false,
    graph: {
      schemaVersion: 1,
      organization: {id: organizationId, schemaVersion: 1, slug: `local-${organizationId.slice(0, 8)}`, displayName: identity.organizationName, dataMode: 'LOCAL_PRIVATE', live: false},
      identities: [
        {id: ownerIdentityId, organizationId, schemaVersion: 1, kind: 'PERSON', displayName: input.ownerDisplayName, publicBio: localLanguage ? '本机 Owner 确认的创始人表达身份；未连接外部账号。' : 'Locally confirmed Owner identity; no external account is connected.'},
        {id: productIdentityId, organizationId, schemaVersion: 1, kind: 'PRODUCT', displayName: identity.productName, publicBio: identity.productDescription}
      ],
      brands: [{id: brandId, organizationId, schemaVersion: 1, name: identity.brandName, positioning: identity.brandPositioning}],
      products: [{id: productId, organizationId, schemaVersion: 1, brandId, name: identity.productName, description: identity.productDescription}],
      markets: [{id: marketId, organizationId, schemaVersion: 1, code: input.context.marketCode, displayName: marketName, primaryLanguage: input.context.contentLocale}],
      channelAccounts: accounts,
      accountMandates: mandates
    },
    brief: {schemaVersion: 1, name: identity.campaignName, objective: identity.campaignObjective, callToAction: identity.callToAction, contentLanguage, targetWindowStart: capturedAt, targetWindowEnd},
    goalProfile: {schemaVersion: 1, primaryGoal: 'LAUNCH_MOMENTUM', supportingSignal: 'MARKET_LEARNING', measurementNotes: localLanguage ? '本机 Owner 确认的初始化目标；没有 runtime、触达、线索或营收结果。' : 'Locally confirmed initialization goal; no runtime, reach, lead, or revenue result.'},
    evidenceRefs,
    claims: [{id: claimId, organizationId, schemaVersion: 1, version: 1, subjectType: 'PRODUCT', subjectId: productId, marketIds: [marketId], statement: `${identity.productName}: ${identity.productDescription}`, effectiveFrom: validFrom, effectiveUntil: validUntil, status: 'APPROVED', evidenceRefIds: evidenceRefs.map((item) => item.id)}],
    activationPlan: {schemaVersion: 1, summary: localLanguage ? '四个平台只准备可审阅草稿；账号未连接，禁止外部执行。' : 'Prepare reviewable drafts for four platforms; accounts are unconnected and external execution is forbidden.', units},
    capabilitySnapshots: capabilities,
    artifactRevisions: artifacts,
    publishingSchedules: [], scheduleOccurrences: [],
    missionContract: {schemaVersion: 1, sourceDigest: '0'.repeat(64), executionMode: 'SHADOW_PREP_ONLY', live: false, roleIds: [...roleIds], artifactPlatforms: [...platforms], externalActionAllowed: false}
  };
  document.missionContract.sourceDigest = digestCampaign(document);
  return document;
}

function localCapability(platform: Platform, organizationId: string, channelAccountId: string, id: string, capturedAt: string, expiresAt: string, localLanguage: boolean): CapabilitySnapshot {
  const common = {id, organizationId, schemaVersion: 1 as const, channelAccountId, platform, capturedAt, expiresAt, source: 'LOCAL_UNVERIFIED_DECLARATION' as const, disclaimer: localLanguage ? '仅为本机准备约束；未完成 OAuth、live probe 或平台能力核验。' : 'Local preparation constraint only; OAuth, live probes, and platform capability verification are absent.'};
  switch (platform) {
    case 'X': return {...common, executionMode: 'PREPARE_ONLY', constraints: {posts: {required: true, maxLength: 280, maxItems: 4}, altText: {required: true, maxLength: 1000}}};
    case 'BLUESKY': return {...common, executionMode: 'DIRECT_PLANNED_NOT_CONNECTED', constraints: {posts: {required: true, maxLength: 300, maxItems: 4}, embedUrl: {required: true, maxLength: 2048}, altText: {required: true, maxLength: 1000}}};
    case 'LINKEDIN': return {...common, executionMode: 'NATIVE_HANDOFF_PLANNED', constraints: {commentary: {required: true, maxLength: 3000}, linkTitle: {required: true, maxLength: 200}, linkUrl: {required: true, maxLength: 2048}}};
    case 'XIAOHONGSHU': return {...common, executionMode: 'NATIVE_HANDOFF_PLANNED', constraints: {title: {required: true, maxLength: 20}, body: {required: true, maxLength: 1000}, topics: {required: true, maxLength: 30, maxItems: 10}, coverLabel: {required: true, maxLength: 80}}};
  }
}

function localContent(platform: Platform, input: LocalCampaignIdentityInput, localLanguage: boolean): PlatformArtifact {
  const message = `${input.productName} — ${input.campaignObjective}`;
  const alt = localLanguage ? `${input.productName} 的本机私有内容草稿。` : `Local private draft for ${input.productName}.`;
  switch (platform) {
    case 'X': return {kind: 'X', posts: [truncate(message, 280)], altText: truncate(alt, 1000)};
    case 'BLUESKY': return {kind: 'BLUESKY', posts: [truncate(message, 300)], embedUrl: 'https://example.invalid/not-configured', altText: truncate(alt, 1000)};
    case 'LINKEDIN': return {kind: 'LINKEDIN', commentary: truncate(`${message}\n\n${input.productDescription}\n\n${input.callToAction}`, 3000), authorKind: 'COMPANY', linkTitle: truncate(input.productName, 200), linkUrl: 'https://example.invalid/not-configured'};
    case 'XIAOHONGSHU': return {kind: 'XIAOHONGSHU', title: truncate(input.campaignName, 20), body: truncate(`${input.campaignObjective}\n\n${input.productDescription}\n\n${input.callToAction}`, 1000), topics: [truncate(input.brandName, 30), truncate(input.productName, 30)], coverLabel: truncate(`${input.productName} · LOCAL_PRIVATE`, 80)};
  }
}

function safeText(value: unknown, maxLength: number, code: string): string {
  if (typeof value !== 'string') throw new LocalPresenceContractError(code);
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (normalized.length < 1 || Array.from(normalized).length > maxLength || /[\p{Cc}\p{Cf}]/u.test(normalized)) throw new LocalPresenceContractError(code);
  return normalized;
}

function truncate(value: string, limit: number): string { return Array.from(value).slice(0, limit).join(''); }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function marketDisplayName(code: string, localLanguage: boolean): string {
  const names: Record<string, [string, string]> = {CN: ['中国', 'China'], US: ['美国', 'United States'], SG: ['新加坡', 'Singapore']};
  return names[code]?.[localLanguage ? 0 : 1] ?? code;
}
