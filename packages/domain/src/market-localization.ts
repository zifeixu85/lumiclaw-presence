import {sha256Digest} from './canonical.js';
import type {MissionRoleId} from './campaign-types.js';
import type {Platform} from './types.js';

export const MARKET_LOCALIZATION_ERROR_CODES = [
  'MARKET_PACK_NOT_FOUND',
  'MARKET_PACK_EXPIRED',
  'MARKET_SCOPE_MISMATCH',
  'LOCALE_MARKET_MISMATCH',
  'SOURCE_REQUIRED',
  'SOURCE_SCOPE_MISMATCH',
  'SOURCE_EXPIRED',
  'ORGANIZATION_SCOPE_MISMATCH',
  'ORGANIZATION_KNOWLEDGE_UNAPPROVED',
  'MARKET_KNOWLEDGE_CONFLICT',
  'CONTEXT_DIGEST_MISMATCH',
  'ROLE_PROJECTION_FORBIDDEN'
] as const;

export type MarketLocalizationErrorCode = typeof MARKET_LOCALIZATION_ERROR_CODES[number];
export type MarketCode = 'US' | 'JP' | 'DE';
export type MarketLocale = 'en-US' | 'ja-JP' | 'de-DE';
export type MarketContentLanguage = 'en' | 'ja' | 'de';
export type MarketKnowledgeLayer = 'CAMPAIGN' | 'ORGANIZATION' | 'PUBLIC_PACK';

export type MarketSourceRef = {
  sourceId: string;
  url: string;
  publisher: string;
  title: string;
  retrievedAt: string;
  versionOrUpdatedAt: string;
  sourceKind: 'PRIMARY_GOVERNMENT' | 'AUTHORITATIVE_STANDARD' | 'SYNTHETIC_APPROVED_FIXTURE';
  licenseOrTerms: string;
  reuseBoundary: 'CC0_BOUNDED_PARAPHRASE' | 'UNICODE_LICENSE_BOUNDED_DATA' | 'ATTRIBUTED_BOUNDED_PARAPHRASE' | 'CITATION_ONLY_PARAPHRASE' | 'REPOSITORY_AUTHORED_SYNTHETIC';
  publicSafe: true;
  scope: {
    marketCodes: MarketCode[];
    locales: MarketLocale[];
    platforms: Platform[];
    knowledgeKeys: string[];
  };
  expiresAt: string | null;
};

export type MarketKnowledgeItem = {
  key: string;
  value: string;
  mode: 'ACTIONABLE' | 'QUESTION';
  conflictBehavior: 'ALLOW_OVERRIDE' | 'BLOCK_ON_DIFFERENCE';
  sourceRefIds: string[];
  applicability: {marketCode: MarketCode; locales: MarketLocale[]; platforms: Platform[]};
  reviewedAt: string;
  expiresAt: string | null;
};

export type MarketKnowledgePack = {
  schemaVersion: 1;
  packId: string;
  marketCode: MarketCode;
  primaryLocale: MarketLocale;
  locales: MarketLocale[];
  version: string;
  effectiveFrom: string;
  reviewedAt: string;
  expiresAt: string | null;
  sourceRefs: MarketSourceRef[];
  knowledge: MarketKnowledgeItem[];
  maturity: 'PUBLIC_SAFE_FIXTURE';
};

export type OrganizationMarketKnowledge = {
  schemaVersion: 1;
  organizationId: string;
  marketCode: MarketCode;
  version: string;
  approved: boolean;
  approvedAt: string;
  expiresAt: string | null;
  sourceRefs: MarketSourceRef[];
  knowledge: MarketKnowledgeItem[];
  dataClassification: 'SYNTHETIC_ORGANIZATION_OVERRIDE_FIXTURE';
};

export type CampaignLocalizationBrief = {
  schemaVersion: 1;
  organizationId: string;
  campaignId: string;
  activationUnitId: string;
  version: string;
  marketCode: MarketCode;
  locale: MarketLocale;
  uiLocale: 'zh-CN' | 'en';
  contentLanguage: MarketContentLanguage;
  platform: Platform;
  timeZone: string;
  sourceRefs: MarketSourceRef[];
  explicitDecisions: MarketKnowledgeItem[];
};

export type ResolvedMarketKnowledgeItem = {
  key: string;
  value: string;
  activeLayer: MarketKnowledgeLayer;
  activeVersion: string;
  actionable: boolean;
  requiresHumanDecision: boolean;
  sourceRefIds: string[];
  provenance: {
    layer: MarketKnowledgeLayer;
    version: string;
    value: string;
    sourceRefIds: string[];
  }[];
  applicability: MarketKnowledgeItem['applicability'];
};

export type MarketKnowledgeConflict = {
  code: 'MARKET_KNOWLEDGE_CONFLICT';
  key: string;
  values: {layer: MarketKnowledgeLayer; version: string; value: string; sourceRefIds: string[]}[];
  requiresHumanDecision: true;
};

export type MarketContextView = {
  schemaVersion: 1;
  organizationId: string;
  campaignId: string;
  activationUnitId: string;
  marketCode: MarketCode;
  locale: MarketLocale;
  uiLocale: 'zh-CN' | 'en';
  contentLanguage: MarketContentLanguage;
  platform: Platform;
  timeZone: string;
  status: 'READY' | 'BLOCKED';
  blockingCodes: ('MARKET_KNOWLEDGE_CONFLICT')[];
  reviewRequired: boolean;
  resolvedItems: ResolvedMarketKnowledgeItem[];
  questions: MarketKnowledgeItem[];
  conflicts: MarketKnowledgeConflict[];
  sourceRefs: MarketSourceRef[];
  packSelection: {packId: string; version: string; packDigest: string};
  contextDigest: string;
};

export class MarketLocalizationError extends Error {
  constructor(public readonly code: MarketLocalizationErrorCode, message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'MarketLocalizationError';
  }
}

const PLATFORMS: Platform[] = ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'];
const PRIMARY_LOCALES: Record<MarketCode, MarketLocale> = {US: 'en-US', JP: 'ja-JP', DE: 'de-DE'};
const PACK_IDS: Record<MarketCode, string> = {US: 'lumiclaw-public-market-us', JP: 'lumiclaw-public-market-jp', DE: 'lumiclaw-public-market-de'};
const FIXTURE_VERSION = '2026.08.16.1';
const REVIEWED_AT = '2026-08-16T00:00:00.000Z';
const SYNTHETIC_ORGANIZATION_ID = '019f0000-0000-7000-8000-000000000001';

function source(
  sourceId: string,
  marketCode: MarketCode,
  locale: MarketLocale,
  keys: string[],
  details: Omit<MarketSourceRef, 'sourceId' | 'scope' | 'publicSafe' | 'expiresAt'>
): MarketSourceRef {
  return {...details, sourceId, publicSafe: true, scope: {marketCodes: [marketCode], locales: [locale], platforms: [...PLATFORMS], knowledgeKeys: keys}, expiresAt: null};
}

function item(
  marketCode: MarketCode,
  locale: MarketLocale,
  key: string,
  value: string,
  sourceRefIds: string[],
  conflictBehavior: MarketKnowledgeItem['conflictBehavior'] = 'ALLOW_OVERRIDE'
): MarketKnowledgeItem {
  return {key, value, mode: 'ACTIONABLE', conflictBehavior, sourceRefIds, applicability: {marketCode, locales: [locale], platforms: [...PLATFORMS]}, reviewedAt: REVIEWED_AT, expiresAt: null};
}

const US_CLDR = source('unicode-cldr-49-en-us', 'US', 'en-US', ['punctuation.quotation'], {
  url: 'https://www.unicode.org/cldr/charts/49/summary/en.html',
  publisher: 'Unicode Consortium',
  title: 'Locale Data Summary for English [en] — CLDR 49',
  retrievedAt: '2026-08-16',
  versionOrUpdatedAt: 'CLDR 49 / 2026',
  sourceKind: 'AUTHORITATIVE_STANDARD',
  licenseOrTerms: 'Unicode Terms of Use, Exhibit 1 (Unicode Data Files and Software License)',
  reuseBoundary: 'UNICODE_LICENSE_BOUNDED_DATA'
});
const US_USWDS = source('gsa-uswds-design-principles', 'US', 'en-US', ['content.voice'], {
  url: 'https://designsystem.digital.gov/design-principles/',
  publisher: 'U.S. General Services Administration — U.S. Web Design System',
  title: 'USWDS Design principles',
  retrievedAt: '2026-08-16',
  versionOrUpdatedAt: 'Retrieved 2026-08-16; living guidance',
  sourceKind: 'PRIMARY_GOVERNMENT',
  licenseOrTerms: 'USWDS CC0 1.0/public-domain dedication except separately identified assets',
  reuseBoundary: 'CC0_BOUNDED_PARAPHRASE'
});
const JP_CLDR = source('unicode-cldr-49-ja-jp', 'JP', 'ja-JP', ['punctuation.quotation'], {
  url: 'https://www.unicode.org/cldr/charts/49/summary/ja.html',
  publisher: 'Unicode Consortium',
  title: 'Locale Data Summary for Japanese [ja] — CLDR 49',
  retrievedAt: '2026-08-16',
  versionOrUpdatedAt: 'CLDR 49 / 2026',
  sourceKind: 'AUTHORITATIVE_STANDARD',
  licenseOrTerms: 'Unicode Terms of Use, Exhibit 1 (Unicode Data Files and Software License)',
  reuseBoundary: 'UNICODE_LICENSE_BOUNDED_DATA'
});
const JP_DADS = source('jp-digital-agency-typography-2025-04-23', 'JP', 'ja-JP', ['typography.emphasis'], {
  url: 'https://design.digital.go.jp/dads/foundations/typography/',
  publisher: 'Digital Agency, Government of Japan',
  title: 'デジタル庁デザインシステムβ版 — タイポグラフィ（概要）',
  retrievedAt: '2026-08-16',
  versionOrUpdatedAt: '2025-04-23',
  sourceKind: 'PRIMARY_GOVERNMENT',
  licenseOrTerms: 'Digital Agency website copyright policy; source attribution and transformation notice required',
  reuseBoundary: 'ATTRIBUTED_BOUNDED_PARAPHRASE'
});
const DE_CLDR = source('unicode-cldr-49-de-de', 'DE', 'de-DE', ['punctuation.quotation'], {
  url: 'https://www.unicode.org/cldr/charts/49/summary/de.html',
  publisher: 'Unicode Consortium',
  title: 'Locale Data Summary for German [de] — CLDR 49',
  retrievedAt: '2026-08-16',
  versionOrUpdatedAt: 'CLDR 49 / 2026',
  sourceKind: 'AUTHORITATIVE_STANDARD',
  licenseOrTerms: 'Unicode Terms of Use, Exhibit 1 (Unicode Data Files and Software License)',
  reuseBoundary: 'UNICODE_LICENSE_BOUNDED_DATA'
});
const DE_RULES = source('german-spelling-council-rules-2024', 'DE', 'de-DE', ['content.voice'], {
  url: 'https://www.rechtschreibrat.com/DOX/RfdR_Amtliches-Regelwerk_2024.pdf',
  publisher: 'Rat für deutsche Rechtschreibung',
  title: 'Amtliches Regelwerk der deutschen Rechtschreibung 2024',
  retrievedAt: '2026-08-16',
  versionOrUpdatedAt: '2024; in force since 2024-07-01',
  sourceKind: 'AUTHORITATIVE_STANDARD',
  licenseOrTerms: 'Citation-only reference; no source text copied',
  reuseBoundary: 'CITATION_ONLY_PARAPHRASE'
});

const PACKS: MarketKnowledgePack[] = [
  {
    schemaVersion: 1, packId: PACK_IDS.DE, marketCode: 'DE', primaryLocale: 'de-DE', locales: ['de-DE'], version: FIXTURE_VERSION,
    effectiveFrom: '2026-08-16T00:00:00.000Z', reviewedAt: REVIEWED_AT, expiresAt: null, sourceRefs: [DE_CLDR, DE_RULES], maturity: 'PUBLIC_SAFE_FIXTURE',
    knowledge: [
      item('DE', 'de-DE', 'punctuation.quotation', 'Für primäre Zitate „…“ und für verschachtelte Zitate ‚…‘ als Locale-Ausgangspunkt verwenden.', [DE_CLDR.sourceId], 'BLOCK_ON_DIFFERENCE'),
      item('DE', 'de-DE', 'content.voice', 'Die amtliche deutsche Rechtschreibung 2024 als Review-Basis verwenden; Variantenfragen an einen Menschen geben.', [DE_RULES.sourceId])
    ]
  },
  {
    schemaVersion: 1, packId: PACK_IDS.JP, marketCode: 'JP', primaryLocale: 'ja-JP', locales: ['ja-JP'], version: FIXTURE_VERSION,
    effectiveFrom: '2026-08-16T00:00:00.000Z', reviewedAt: REVIEWED_AT, expiresAt: null, sourceRefs: [JP_CLDR, JP_DADS], maturity: 'PUBLIC_SAFE_FIXTURE',
    knowledge: [
      item('JP', 'ja-JP', 'punctuation.quotation', '主引用は「…」、入れ子の引用は『…』をロケール上の出発点にする。', [JP_CLDR.sourceId], 'BLOCK_ON_DIFFERENCE'),
      item('JP', 'ja-JP', 'typography.emphasis', '日本語本文では、特別な理由がない限り合成イタリックによる強調を避け、別の表現を人が確認する。', [JP_DADS.sourceId], 'BLOCK_ON_DIFFERENCE')
    ]
  },
  {
    schemaVersion: 1, packId: PACK_IDS.US, marketCode: 'US', primaryLocale: 'en-US', locales: ['en-US'], version: FIXTURE_VERSION,
    effectiveFrom: '2026-08-16T00:00:00.000Z', reviewedAt: REVIEWED_AT, expiresAt: null, sourceRefs: [US_CLDR, US_USWDS], maturity: 'PUBLIC_SAFE_FIXTURE',
    knowledge: [
      item('US', 'en-US', 'punctuation.quotation', 'Use “…” for primary quotations and ‘…’ for nested quotations as the locale starting point.', [US_CLDR.sourceId], 'BLOCK_ON_DIFFERENCE'),
      item('US', 'en-US', 'content.voice', 'Use clear, easy-to-follow language and structure web copy for scanning.', [US_USWDS.sourceId])
    ]
  }
];

export const PUBLIC_MARKET_PACKS = Object.freeze(PACKS.map((pack) => deepFreeze(structuredClone(pack)))) as readonly MarketKnowledgePack[];

export const MARKET_LOCALIZATION_SKILL_MANIFEST = deepFreeze({
  schemaVersion: 1 as const,
  name: 'market-localization-context' as const,
  version: '1.0.0' as const,
  inputSchema: 'lumiclaw.market-context-view.v1' as const,
  projections: {
    'presence-mission-leader': 'LEADER_DEPENDENCY_STATUS',
    'evidence-claim-steward': 'AUDITOR_EVIDENCE',
    'campaign-planner': 'PLANNER_SELECTION',
    'founder-identity-producer': 'PRODUCER_MINIMUM',
    'product-account-producer': 'PRODUCER_MINIMUM',
    'independent-auditor': 'AUDITOR_EVIDENCE'
  },
  outputBoundary: 'LOCALIZATION_GUIDANCE_ONLY' as const,
  createsOrchestrator: false as const,
  externalActionAllowed: false as const,
  mayRewriteApprovedArtifact: false as const
});

export function loadPublicMarketPack(input: {marketCode: string; locale: string; at: Date; registry?: readonly MarketKnowledgePack[]}): MarketKnowledgePack {
  const registry = input.registry ?? PUBLIC_MARKET_PACKS;
  validateExactThreeRegistry(registry);
  if (!isMarketCode(input.marketCode)) throw new MarketLocalizationError('MARKET_PACK_NOT_FOUND', `No public market pack exists for ${input.marketCode}.`);
  const pack = registry.find((candidate) => candidate.marketCode === input.marketCode);
  if (pack === undefined) throw new MarketLocalizationError('MARKET_PACK_NOT_FOUND', `No public market pack exists for ${input.marketCode}.`);
  validatePack(pack, input.locale, input.at);
  return structuredClone(pack);
}

export function resolveMarketContext(input: {pack: MarketKnowledgePack; organizationKnowledge?: OrganizationMarketKnowledge; brief: CampaignLocalizationBrief; at: Date}): MarketContextView {
  const {pack, organizationKnowledge, brief, at} = input;
  if (pack.marketCode !== brief.marketCode) throw new MarketLocalizationError('MARKET_SCOPE_MISMATCH', 'Campaign market does not match the selected public pack.');
  validatePack(pack, brief.locale, at);
  validateBrief(brief, at);
  if (organizationKnowledge !== undefined) {
    if (organizationKnowledge.organizationId !== brief.organizationId) throw new MarketLocalizationError('ORGANIZATION_SCOPE_MISMATCH', 'Organization knowledge belongs to another Organization.');
    if (organizationKnowledge.marketCode !== brief.marketCode) throw new MarketLocalizationError('MARKET_SCOPE_MISMATCH', 'Organization knowledge belongs to another market.');
    if (!organizationKnowledge.approved) throw new MarketLocalizationError('ORGANIZATION_KNOWLEDGE_UNAPPROVED', 'Only approved Organization knowledge may enter a context.');
    if (isExpired(organizationKnowledge.expiresAt, at)) throw new MarketLocalizationError('SOURCE_EXPIRED', 'Organization market knowledge is expired.');
    validateLayer(organizationKnowledge.marketCode, brief.locale, organizationKnowledge.sourceRefs, organizationKnowledge.knowledge, at);
  }

  const candidates: Candidate[] = [];
  addCandidates(candidates, 'PUBLIC_PACK', pack.version, pack.knowledge, brief);
  if (organizationKnowledge !== undefined) addCandidates(candidates, 'ORGANIZATION', organizationKnowledge.version, organizationKnowledge.knowledge, brief);
  addCandidates(candidates, 'CAMPAIGN', brief.version, brief.explicitDecisions, brief);

  const questions = candidates
    .filter((candidate) => candidate.item.mode === 'QUESTION')
    .map((candidate) => structuredClone(candidate.item))
    .sort((left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value));
  const actionable = candidates.filter((candidate) => candidate.item.mode === 'ACTIONABLE');
  const byKey = new Map<string, Candidate[]>();
  for (const candidate of actionable) {
    const group = byKey.get(candidate.item.key) ?? [];
    group.push(candidate);
    byKey.set(candidate.item.key, group);
  }

  const resolvedItems: ResolvedMarketKnowledgeItem[] = [];
  const conflicts: MarketKnowledgeConflict[] = [];
  for (const [key, groupValue] of [...byKey.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const group = groupValue.sort(compareCandidate);
    const active = group[0]!;
    const values = [...new Set(group.map((candidate) => candidate.item.value))];
    const incompatible = values.length > 1 && group.some((candidate) => candidate.item.conflictBehavior === 'BLOCK_ON_DIFFERENCE');
    const provenance = group.map((candidate) => ({layer: candidate.layer, version: candidate.version, value: candidate.item.value, sourceRefIds: [...candidate.item.sourceRefIds].sort()}));
    if (incompatible) conflicts.push({code: 'MARKET_KNOWLEDGE_CONFLICT', key, values: provenance, requiresHumanDecision: true});
    resolvedItems.push({
      key, value: active.item.value, activeLayer: active.layer, activeVersion: active.version, actionable: !incompatible,
      requiresHumanDecision: incompatible, sourceRefIds: [...active.item.sourceRefIds].sort(), provenance,
      applicability: structuredClone(active.item.applicability)
    });
  }

  const referencedSourceIds = new Set(candidates.flatMap((candidate) => candidate.item.sourceRefIds));
  const allSources = mergeSources(pack.sourceRefs, organizationKnowledge?.sourceRefs ?? [], brief.sourceRefs);
  const sourceRefs = allSources.filter((entry) => referencedSourceIds.has(entry.sourceId)).sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const status = conflicts.length > 0 ? 'BLOCKED' as const : 'READY' as const;
  const blockingCodes = conflicts.length > 0 ? ['MARKET_KNOWLEDGE_CONFLICT'] as const : [];
  const payload = {
    schemaVersion: 1 as const,
    organizationId: brief.organizationId,
    campaignId: brief.campaignId,
    activationUnitId: brief.activationUnitId,
    marketCode: brief.marketCode,
    locale: brief.locale,
    uiLocale: brief.uiLocale,
    contentLanguage: brief.contentLanguage,
    platform: brief.platform,
    timeZone: brief.timeZone,
    status,
    blockingCodes: [...blockingCodes],
    reviewRequired: conflicts.length > 0 || questions.length > 0,
    resolvedItems,
    questions,
    conflicts,
    sourceRefs,
    packSelection: {packId: pack.packId, version: pack.version, packDigest: sha256Digest(pack)}
  };
  return {...payload, contextDigest: sha256Digest(payload)};
}

export function assertMarketContextDigest(context: MarketContextView, expectedDigest: string): void {
  const {contextDigest, ...payload} = context;
  const calculated = sha256Digest(payload);
  if (contextDigest !== expectedDigest || calculated !== contextDigest) {
    throw new MarketLocalizationError('CONTEXT_DIGEST_MISMATCH', 'Market context digest does not match the canonical context payload.', {expectedDigest, contextDigest, calculated});
  }
}

type MinimumResolvedItem = Pick<ResolvedMarketKnowledgeItem, 'key' | 'value' | 'activeLayer' | 'actionable' | 'applicability'>;
type LeaderProjection = {schemaVersion: 1; projectionKind: 'LEADER_DEPENDENCY_STATUS'; roleId: 'presence-mission-leader'; contextDigest: string; status: MarketContextView['status']; blockingCodes: MarketContextView['blockingCodes']};
type ProducerProjection = {schemaVersion: 1; projectionKind: 'PRODUCER_MINIMUM'; roleId: 'founder-identity-producer' | 'product-account-producer'; contextDigest: string; activationUnitId: string; marketCode: MarketCode; locale: MarketLocale; contentLanguage: MarketContentLanguage; platform: Platform; timeZone: string; resolvedItems: MinimumResolvedItem[]};
type PlannerProjection = {schemaVersion: 1; projectionKind: 'PLANNER_SELECTION'; roleId: 'campaign-planner'; contextDigest: string; activationUnitId: string; marketCode: MarketCode; locale: MarketLocale; contentLanguage: MarketContentLanguage; platform: Platform; timeZone: string; resolvedItems: MinimumResolvedItem[]};
type AuditorProjection = {schemaVersion: 1; projectionKind: 'AUDITOR_EVIDENCE'; roleId: 'independent-auditor' | 'evidence-claim-steward'; contextDigest: string; activationUnitId: string; marketCode: MarketCode; locale: MarketLocale; contentLanguage: MarketContentLanguage; platform: Platform; timeZone: string; status: MarketContextView['status']; resolvedItems: ResolvedMarketKnowledgeItem[]; questions: MarketKnowledgeItem[]; conflicts: MarketKnowledgeConflict[]; sourceRefs: MarketSourceRef[]; packSelection: MarketContextView['packSelection']};
export type MarketRoleProjection = LeaderProjection | ProducerProjection | PlannerProjection | AuditorProjection;

export function projectMarketContextForRole(context: MarketContextView, roleId: MissionRoleId): MarketRoleProjection {
  assertMarketContextDigest(context, context.contextDigest);
  if (roleId === 'presence-mission-leader') return {schemaVersion: 1, projectionKind: 'LEADER_DEPENDENCY_STATUS', roleId, contextDigest: context.contextDigest, status: context.status, blockingCodes: [...context.blockingCodes]};
  const selection = {activationUnitId: context.activationUnitId, marketCode: context.marketCode, locale: context.locale, contentLanguage: context.contentLanguage, platform: context.platform, timeZone: context.timeZone};
  if (roleId === 'campaign-planner') return {schemaVersion: 1, projectionKind: 'PLANNER_SELECTION', roleId, contextDigest: context.contextDigest, ...selection, resolvedItems: minimumItems(context)};
  if (roleId === 'founder-identity-producer' || roleId === 'product-account-producer') {
    if (context.status === 'BLOCKED') throw new MarketLocalizationError('MARKET_KNOWLEDGE_CONFLICT', 'A Producer cannot consume a blocked market context.', context.conflicts);
    return {schemaVersion: 1, projectionKind: 'PRODUCER_MINIMUM', roleId, contextDigest: context.contextDigest, ...selection, resolvedItems: minimumItems(context)};
  }
  if (roleId === 'independent-auditor' || roleId === 'evidence-claim-steward') {
    return {schemaVersion: 1, projectionKind: 'AUDITOR_EVIDENCE', roleId, contextDigest: context.contextDigest, ...selection, status: context.status, resolvedItems: structuredClone(context.resolvedItems), questions: structuredClone(context.questions), conflicts: structuredClone(context.conflicts), sourceRefs: structuredClone(context.sourceRefs), packSelection: structuredClone(context.packSelection)};
  }
  throw new MarketLocalizationError('ROLE_PROJECTION_FORBIDDEN', `Role ${roleId satisfies never} has no market-context projection.`);
}

export function bindMarketLocalizationSkill(context: MarketContextView, roleId: MissionRoleId): {
  schemaVersion: 1;
  skillName: 'market-localization-context';
  skillVersion: '1.0.0';
  roleId: MissionRoleId;
  inputSchema: 'lumiclaw.market-context-view.v1';
  contextDigest: string;
  projectionKind: MarketRoleProjection['projectionKind'];
  projectionDigest: string;
  outputBoundary: 'LOCALIZATION_GUIDANCE_ONLY';
  createsOrchestrator: false;
  externalActionAllowed: false;
} {
  const projection = projectMarketContextForRole(context, roleId);
  const expectedProjection = MARKET_LOCALIZATION_SKILL_MANIFEST.projections[roleId];
  if (projection.projectionKind !== expectedProjection) throw new MarketLocalizationError('ROLE_PROJECTION_FORBIDDEN', 'Role projection does not match the versioned Skill manifest.');
  return {schemaVersion: 1, skillName: MARKET_LOCALIZATION_SKILL_MANIFEST.name, skillVersion: MARKET_LOCALIZATION_SKILL_MANIFEST.version, roleId, inputSchema: MARKET_LOCALIZATION_SKILL_MANIFEST.inputSchema, contextDigest: context.contextDigest, projectionKind: projection.projectionKind, projectionDigest: sha256Digest(projection), outputBoundary: MARKET_LOCALIZATION_SKILL_MANIFEST.outputBoundary, createsOrchestrator: false, externalActionAllowed: false};
}

export function createOrganizationMarketKnowledgeFixture(marketCode: MarketCode): OrganizationMarketKnowledge {
  const locale = PRIMARY_LOCALES[marketCode];
  const sourceId = `synthetic-organization-${marketCode.toLowerCase()}-approved-override`;
  const keys = marketCode === 'JP' ? ['typography.emphasis'] : ['content.voice'];
  const sourceRef = source(sourceId, marketCode, locale, keys, {
    url: 'https://github.com/zifeixu85/lumiclaw-presence/blob/main/docs/research/SOURCE-AND-ASSET-REGISTER.md#sdd-005-market-localization-sources',
    publisher: 'LumiClaw public-safe synthetic fixture',
    title: `Synthetic approved Organization market override — ${marketCode}`,
    retrievedAt: '2026-08-16',
    versionOrUpdatedAt: FIXTURE_VERSION,
    sourceKind: 'SYNTHETIC_APPROVED_FIXTURE',
    licenseOrTerms: 'Repository-authored Apache-2.0 synthetic fixture; not customer evidence',
    reuseBoundary: 'REPOSITORY_AUTHORED_SYNTHETIC'
  });
  const values: Record<MarketCode, string> = {
    US: 'Use a calm, technically specific voice and preserve approved product terminology.',
    JP: '日本語の強調には合成イタリックを常に使用する。',
    DE: 'Ruhig, fachlich präzise und mit der freigegebenen Produktterminologie formulieren.'
  };
  return {
    schemaVersion: 1, organizationId: SYNTHETIC_ORGANIZATION_ID, marketCode, version: FIXTURE_VERSION, approved: true,
    approvedAt: REVIEWED_AT, expiresAt: null, sourceRefs: [sourceRef], dataClassification: 'SYNTHETIC_ORGANIZATION_OVERRIDE_FIXTURE',
    knowledge: [item(marketCode, locale, keys[0]!, values[marketCode], [sourceId], marketCode === 'JP' ? 'BLOCK_ON_DIFFERENCE' : 'ALLOW_OVERRIDE')]
  };
}

export function createCampaignLocalizationBriefFixture(marketCode: MarketCode): CampaignLocalizationBrief {
  const locale = PRIMARY_LOCALES[marketCode];
  const sourceId = `synthetic-campaign-${marketCode.toLowerCase()}-owner-decision`;
  const keys = marketCode === 'DE' ? ['product.fact', 'content.voice'] : ['product.fact'];
  const sourceRef = source(sourceId, marketCode, locale, keys, {
    url: 'https://github.com/zifeixu85/lumiclaw-presence/blob/main/docs/research/SOURCE-AND-ASSET-REGISTER.md#sdd-005-market-localization-sources',
    publisher: 'LumiClaw public-safe synthetic fixture',
    title: `Synthetic Campaign owner decision — ${marketCode}`,
    retrievedAt: '2026-08-16',
    versionOrUpdatedAt: FIXTURE_VERSION,
    sourceKind: 'SYNTHETIC_APPROVED_FIXTURE',
    licenseOrTerms: 'Repository-authored Apache-2.0 synthetic fixture; not customer evidence',
    reuseBoundary: 'REPOSITORY_AUTHORED_SYNTHETIC'
  });
  const config: Record<MarketCode, {campaignId: string; activationUnitId: string; contentLanguage: MarketContentLanguage; platform: Platform; timeZone: string}> = {
    US: {campaignId: '019f0000-0000-7000-8000-000000000010', activationUnitId: '019f0000-0000-7000-8000-000000000011', contentLanguage: 'en', platform: 'X', timeZone: 'America/New_York'},
    JP: {campaignId: '019f0000-0000-7000-8000-000000000020', activationUnitId: '019f0000-0000-7000-8000-000000000021', contentLanguage: 'ja', platform: 'BLUESKY', timeZone: 'Asia/Tokyo'},
    DE: {campaignId: '019f0000-0000-7000-8000-000000000030', activationUnitId: '019f0000-0000-7000-8000-000000000031', contentLanguage: 'de', platform: 'LINKEDIN', timeZone: 'Europe/Berlin'}
  };
  const selected = config[marketCode];
  const decisions = [item(marketCode, locale, 'product.fact', 'LumiClaw prepares one approved product fact as a reviewable market brief.', [sourceId], 'BLOCK_ON_DIFFERENCE')];
  if (marketCode === 'DE') decisions.push(item('DE', 'de-DE', 'content.voice', 'Sachlich, ruhig und handlungsorientiert; Produktfakten unverändert lassen.', [sourceId]));
  return {schemaVersion: 1, organizationId: SYNTHETIC_ORGANIZATION_ID, campaignId: selected.campaignId, activationUnitId: selected.activationUnitId, version: FIXTURE_VERSION, marketCode, locale, uiLocale: 'zh-CN', contentLanguage: selected.contentLanguage, platform: selected.platform, timeZone: selected.timeZone, sourceRefs: [sourceRef], explicitDecisions: decisions};
}

function validateExactThreeRegistry(registry: readonly MarketKnowledgePack[]): void {
  const codes = registry.map((pack) => pack.marketCode).sort();
  if (registry.length !== 3 || codes.join(',') !== 'DE,JP,US') throw new MarketLocalizationError('MARKET_SCOPE_MISMATCH', 'The first public registry must contain exactly one DE, JP and US pack.');
}

function validatePack(pack: MarketKnowledgePack, locale: string, at: Date): void {
  if (pack.schemaVersion !== 1 || pack.maturity !== 'PUBLIC_SAFE_FIXTURE' || PACK_IDS[pack.marketCode] !== pack.packId) throw new MarketLocalizationError('MARKET_SCOPE_MISMATCH', 'Public market pack identity or maturity is invalid.');
  if (pack.primaryLocale !== PRIMARY_LOCALES[pack.marketCode] || !pack.locales.includes(pack.primaryLocale)) throw new MarketLocalizationError('MARKET_SCOPE_MISMATCH', 'Public market pack primary locale does not match its market.');
  if (!pack.locales.includes(locale as MarketLocale)) throw new MarketLocalizationError('LOCALE_MARKET_MISMATCH', `Locale ${locale} is not supported by ${pack.marketCode}.`);
  if (isExpired(pack.expiresAt, at)) throw new MarketLocalizationError('MARKET_PACK_EXPIRED', `Public market pack ${pack.packId} is expired.`);
  validateLayer(pack.marketCode, pack.primaryLocale, pack.sourceRefs, pack.knowledge, at);
}

function validateBrief(brief: CampaignLocalizationBrief, at: Date): void {
  if (brief.locale !== PRIMARY_LOCALES[brief.marketCode]) throw new MarketLocalizationError('LOCALE_MARKET_MISMATCH', 'Campaign locale does not match the selected first-market fixture.');
  validateLayer(brief.marketCode, brief.locale, brief.sourceRefs, brief.explicitDecisions, at);
}

function validateLayer(marketCode: MarketCode, locale: MarketLocale, sourceRefs: MarketSourceRef[], knowledge: MarketKnowledgeItem[], at: Date): void {
  const sourceById = new Map<string, MarketSourceRef>();
  for (const entry of sourceRefs) {
    if (sourceById.has(entry.sourceId)) throw new MarketLocalizationError('SOURCE_SCOPE_MISMATCH', `Duplicate source identity ${entry.sourceId}.`);
    if (isExpired(entry.expiresAt, at)) throw new MarketLocalizationError('SOURCE_EXPIRED', `Source ${entry.sourceId} is expired.`);
    sourceById.set(entry.sourceId, entry);
  }
  for (const knowledgeItem of knowledge) {
    if (knowledgeItem.applicability.marketCode !== marketCode) throw new MarketLocalizationError('MARKET_SCOPE_MISMATCH', `Knowledge ${knowledgeItem.key} belongs to another market.`);
    if (!knowledgeItem.applicability.locales.includes(locale)) throw new MarketLocalizationError('LOCALE_MARKET_MISMATCH', `Knowledge ${knowledgeItem.key} does not include locale ${locale}.`);
    if (isExpired(knowledgeItem.expiresAt, at)) throw new MarketLocalizationError('SOURCE_EXPIRED', `Knowledge ${knowledgeItem.key} is expired.`);
    if (knowledgeItem.mode === 'ACTIONABLE' && knowledgeItem.sourceRefIds.length === 0) throw new MarketLocalizationError('SOURCE_REQUIRED', `Actionable knowledge ${knowledgeItem.key} has no source evidence.`);
    for (const sourceId of knowledgeItem.sourceRefIds) {
      const evidence = sourceById.get(sourceId);
      if (evidence === undefined) throw new MarketLocalizationError('SOURCE_REQUIRED', `Source ${sourceId} for ${knowledgeItem.key} is missing.`);
      const scopeValid = evidence.scope.marketCodes.includes(marketCode)
        && evidence.scope.locales.includes(locale)
        && evidence.scope.knowledgeKeys.includes(knowledgeItem.key)
        && knowledgeItem.applicability.platforms.every((platform) => evidence.scope.platforms.includes(platform));
      if (!scopeValid) throw new MarketLocalizationError('SOURCE_SCOPE_MISMATCH', `Source ${sourceId} is outside the scope of ${knowledgeItem.key}.`);
    }
  }
}

type Candidate = {layer: MarketKnowledgeLayer; version: string; item: MarketKnowledgeItem};
const LAYER_PRIORITY: Record<MarketKnowledgeLayer, number> = {CAMPAIGN: 3, ORGANIZATION: 2, PUBLIC_PACK: 1};
function compareCandidate(left: Candidate, right: Candidate): number {
  return LAYER_PRIORITY[right.layer] - LAYER_PRIORITY[left.layer] || left.version.localeCompare(right.version) || left.item.value.localeCompare(right.item.value);
}

function addCandidates(target: Candidate[], layer: MarketKnowledgeLayer, version: string, knowledge: MarketKnowledgeItem[], brief: CampaignLocalizationBrief): void {
  for (const knowledgeItem of knowledge) {
    if (knowledgeItem.applicability.marketCode === brief.marketCode && knowledgeItem.applicability.locales.includes(brief.locale) && knowledgeItem.applicability.platforms.includes(brief.platform)) {
      target.push({layer, version, item: structuredClone(knowledgeItem)});
    }
  }
}

function mergeSources(...groups: MarketSourceRef[][]): MarketSourceRef[] {
  const merged = new Map<string, MarketSourceRef>();
  for (const entry of groups.flat()) {
    const previous = merged.get(entry.sourceId);
    if (previous !== undefined && sha256Digest(previous) !== sha256Digest(entry)) throw new MarketLocalizationError('SOURCE_SCOPE_MISMATCH', `Source identity ${entry.sourceId} has conflicting metadata.`);
    merged.set(entry.sourceId, structuredClone(entry));
  }
  return [...merged.values()];
}

function minimumItems(context: MarketContextView): MinimumResolvedItem[] {
  return context.resolvedItems
    .filter((entry) => entry.actionable && entry.applicability.marketCode === context.marketCode && entry.applicability.locales.includes(context.locale) && entry.applicability.platforms.includes(context.platform))
    .map((entry) => ({key: entry.key, value: entry.value, activeLayer: entry.activeLayer, actionable: entry.actionable, applicability: structuredClone(entry.applicability)}));
}

function isExpired(expiresAt: string | null, at: Date): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= at.getTime();
}

function isMarketCode(value: string): value is MarketCode {
  return value === 'US' || value === 'JP' || value === 'DE';
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}
