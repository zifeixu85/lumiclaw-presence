import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  MARKET_LOCALIZATION_ERROR_CODES,
  MARKET_LOCALIZATION_SKILL_MANIFEST,
  PUBLIC_MARKET_PACKS,
  MarketLocalizationError,
  assertMarketContextDigest,
  bindMarketLocalizationSkill,
  createCampaignLocalizationBriefFixture,
  createOrganizationMarketKnowledgeFixture,
  loadPublicMarketPack,
  projectMarketContextForRole,
  resolveMarketContext,
  type MarketKnowledgePack
} from './market-localization.js';

const at = new Date('2026-08-16T12:00:00.000Z');

function errorCode(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof MarketLocalizationError) return error.code;
    throw error;
  }
  throw new Error('Expected MarketLocalizationError.');
}

describe('SDD-005 exact-three public market packs', () => {
  it('registers exactly US/en-US, JP/ja-JP and DE/de-DE as sourced public-safe fixtures', () => {
    expect(PUBLIC_MARKET_PACKS.map((pack) => [pack.marketCode, pack.primaryLocale])).toEqual([
      ['DE', 'de-DE'],
      ['JP', 'ja-JP'],
      ['US', 'en-US']
    ]);
    expect(new Set(PUBLIC_MARKET_PACKS.map((pack) => pack.packId)).size).toBe(3);
    expect(PUBLIC_MARKET_PACKS.every((pack) => pack.schemaVersion === 1 && pack.version === '2026.08.16.1' && pack.maturity === 'PUBLIC_SAFE_FIXTURE')).toBe(true);
    for (const pack of PUBLIC_MARKET_PACKS) {
      expect(pack.sourceRefs.length).toBeGreaterThanOrEqual(2);
      expect(pack.knowledge.filter((item) => item.mode === 'ACTIONABLE').every((item) => item.sourceRefIds.length > 0)).toBe(true);
    }
  });

  it('loads only the exact market/locale and fails closed for unknown, expired and mismatched packs', () => {
    expect(loadPublicMarketPack({marketCode: 'JP', locale: 'ja-JP', at}).packId).toBe('lumiclaw-public-market-jp');
    expect(errorCode(() => loadPublicMarketPack({marketCode: 'FR', locale: 'fr-FR', at}))).toBe('MARKET_PACK_NOT_FOUND');
    expect(errorCode(() => loadPublicMarketPack({marketCode: 'JP', locale: 'en-US', at}))).toBe('LOCALE_MARKET_MISMATCH');

    const expired = structuredClone(PUBLIC_MARKET_PACKS) as MarketKnowledgePack[];
    expired[0]!.expiresAt = '2026-08-15T00:00:00.000Z';
    expect(errorCode(() => loadPublicMarketPack({marketCode: expired[0]!.marketCode, locale: expired[0]!.primaryLocale, at, registry: expired}))).toBe('MARKET_PACK_EXPIRED');

    const wrongScope = structuredClone(PUBLIC_MARKET_PACKS) as MarketKnowledgePack[];
    wrongScope[0]!.marketCode = 'US';
    expect(errorCode(() => loadPublicMarketPack({marketCode: 'US', locale: wrongScope[0]!.primaryLocale, at, registry: wrongScope}))).toBe('MARKET_SCOPE_MISMATCH');
  });
});

describe('SDD-005 deterministic context resolution', () => {
  it('applies Campaign > approved Organization > Public Pack while preserving all provenance', () => {
    const pack = loadPublicMarketPack({marketCode: 'DE', locale: 'de-DE', at});
    const organizationKnowledge = createOrganizationMarketKnowledgeFixture('DE');
    const brief = createCampaignLocalizationBriefFixture('DE');
    const context = resolveMarketContext({pack, organizationKnowledge, brief, at});
    const voice = context.resolvedItems.find((item) => item.key === 'content.voice');

    expect(context.status).toBe('READY');
    expect(voice).toMatchObject({activeLayer: 'CAMPAIGN', value: 'Sachlich, ruhig und handlungsorientiert; Produktfakten unverändert lassen.', actionable: true});
    expect(voice?.provenance.map((entry) => entry.layer)).toEqual(['CAMPAIGN', 'ORGANIZATION', 'PUBLIC_PACK']);
    expect(context.organizationId).toBe(organizationKnowledge.organizationId);
    expect(context.activationUnitId).toBe(brief.activationUnitId);
  });

  it('returns a deterministic blocked conflict instead of silently selecting an incompatible value', () => {
    const pack = loadPublicMarketPack({marketCode: 'JP', locale: 'ja-JP', at});
    const organizationKnowledge = createOrganizationMarketKnowledgeFixture('JP');
    const brief = createCampaignLocalizationBriefFixture('JP');
    const context = resolveMarketContext({pack, organizationKnowledge, brief, at});

    expect(context.status).toBe('BLOCKED');
    expect(context.blockingCodes).toEqual(['MARKET_KNOWLEDGE_CONFLICT']);
    expect(context.conflicts).toHaveLength(1);
    expect(context.conflicts[0]).toMatchObject({code: 'MARKET_KNOWLEDGE_CONFLICT', key: 'typography.emphasis', requiresHumanDecision: true});
    expect(context.resolvedItems.find((item) => item.key === 'typography.emphasis')).toMatchObject({activeLayer: 'ORGANIZATION', actionable: false});
    expect(errorCode(() => projectMarketContextForRole(context, 'founder-identity-producer'))).toBe('MARKET_KNOWLEDGE_CONFLICT');
  });

  it('produces a stable digest and detects source order, value and bound-context mutation', () => {
    const pack = loadPublicMarketPack({marketCode: 'US', locale: 'en-US', at});
    const brief = createCampaignLocalizationBriefFixture('US');
    const first = resolveMarketContext({pack, brief, at});
    const second = resolveMarketContext({pack: structuredClone(pack), brief: structuredClone(brief), at});
    expect(second).toEqual(first);
    assertMarketContextDigest(first, first.contextDigest);

    const reorderedPack = structuredClone(pack);
    reorderedPack.sourceRefs.reverse();
    expect(resolveMarketContext({pack: reorderedPack, brief, at}).contextDigest).not.toBe(first.contextDigest);

    const changedBrief = structuredClone(brief);
    changedBrief.explicitDecisions[0]!.value += ' Changed.';
    expect(resolveMarketContext({pack, brief: changedBrief, at}).contextDigest).not.toBe(first.contextDigest);

    const tampered = structuredClone(first);
    tampered.platform = 'LINKEDIN';
    expect(errorCode(() => assertMarketContextDigest(tampered, first.contextDigest))).toBe('CONTEXT_DIGEST_MISMATCH');
  });

  it('requires evidence for actionable knowledge but permits an unsourced non-actionable question', () => {
    const pack = loadPublicMarketPack({marketCode: 'US', locale: 'en-US', at});
    const brief = createCampaignLocalizationBriefFixture('US');
    brief.explicitDecisions.push({
      key: 'review.open-question',
      value: 'Should the product name remain untranslated?',
      mode: 'QUESTION',
      conflictBehavior: 'ALLOW_OVERRIDE',
      sourceRefIds: [],
      applicability: {marketCode: 'US', locales: ['en-US'], platforms: ['X']},
      reviewedAt: '2026-08-16T00:00:00.000Z',
      expiresAt: null
    });
    expect(resolveMarketContext({pack, brief, at}).questions.map((item) => item.key)).toContain('review.open-question');

    brief.explicitDecisions[0]!.sourceRefIds = [];
    expect(errorCode(() => resolveMarketContext({pack, brief, at}))).toBe('SOURCE_REQUIRED');
  });

  it('rejects source/organization/market/locale scope leaks and expired Organization knowledge', () => {
    const pack = loadPublicMarketPack({marketCode: 'US', locale: 'en-US', at});
    const brief = createCampaignLocalizationBriefFixture('US');
    const otherOrganization = createOrganizationMarketKnowledgeFixture('US');
    otherOrganization.organizationId = '019f0000-0000-7000-8000-000000000099';
    expect(errorCode(() => resolveMarketContext({pack, organizationKnowledge: otherOrganization, brief, at}))).toBe('ORGANIZATION_SCOPE_MISMATCH');

    const wrongMarket = structuredClone(brief);
    wrongMarket.marketCode = 'DE';
    expect(errorCode(() => resolveMarketContext({pack, brief: wrongMarket, at}))).toBe('MARKET_SCOPE_MISMATCH');

    const wrongLocale = structuredClone(brief);
    wrongLocale.locale = 'ja-JP';
    expect(errorCode(() => resolveMarketContext({pack, brief: wrongLocale, at}))).toBe('LOCALE_MARKET_MISMATCH');

    const badSourcePack = structuredClone(pack);
    badSourcePack.sourceRefs[0]!.scope.marketCodes = ['DE'];
    expect(errorCode(() => resolveMarketContext({pack: badSourcePack, brief, at}))).toBe('SOURCE_SCOPE_MISMATCH');

    const expiredOrganization = createOrganizationMarketKnowledgeFixture('US');
    expiredOrganization.expiresAt = '2026-08-15T00:00:00.000Z';
    expect(errorCode(() => resolveMarketContext({pack, organizationKnowledge: expiredOrganization, brief, at}))).toBe('SOURCE_EXPIRED');
  });
});

describe('SDD-005 role projections and Skill binding', () => {
  it('keeps Producer minimal, Auditor evidence-rich, and Leader orchestration-only', () => {
    const context = resolveMarketContext({
      pack: loadPublicMarketPack({marketCode: 'DE', locale: 'de-DE', at}),
      organizationKnowledge: createOrganizationMarketKnowledgeFixture('DE'),
      brief: createCampaignLocalizationBriefFixture('DE'),
      at
    });
    const producer = projectMarketContextForRole(context, 'product-account-producer');
    const auditor = projectMarketContextForRole(context, 'independent-auditor');
    const leader = projectMarketContextForRole(context, 'presence-mission-leader');

    expect(producer.projectionKind).toBe('PRODUCER_MINIMUM');
    if (producer.projectionKind !== 'PRODUCER_MINIMUM') throw new Error('Expected Producer projection.');
    expect('sourceRefs' in producer).toBe(false);
    expect('conflicts' in producer).toBe(false);
    expect(producer.marketCode).toBe('DE');
    expect(producer.resolvedItems.every((item) => item.applicability.marketCode === 'DE' && item.applicability.platforms.includes(context.platform))).toBe(true);
    expect(auditor).toMatchObject({projectionKind: 'AUDITOR_EVIDENCE', roleId: 'independent-auditor', contextDigest: context.contextDigest});
    expect('sourceRefs' in auditor && auditor.sourceRefs.length).toBeGreaterThan(0);
    expect(leader).toEqual({schemaVersion: 1, projectionKind: 'LEADER_DEPENDENCY_STATUS', roleId: 'presence-mission-leader', contextDigest: context.contextDigest, status: 'READY', blockingCodes: []});
    expect('resolvedItems' in leader).toBe(false);
  });

  it('binds manifest version, role, schema, context digest and output boundary', () => {
    const context = resolveMarketContext({pack: loadPublicMarketPack({marketCode: 'US', locale: 'en-US', at}), brief: createCampaignLocalizationBriefFixture('US'), at});
    const binding = bindMarketLocalizationSkill(context, 'founder-identity-producer');
    expect(MARKET_LOCALIZATION_SKILL_MANIFEST).toMatchObject({name: 'market-localization-context', version: '1.0.0', inputSchema: 'lumiclaw.market-context-view.v1', createsOrchestrator: false});
    expect(binding).toMatchObject({skillName: 'market-localization-context', skillVersion: '1.0.0', roleId: 'founder-identity-producer', contextDigest: context.contextDigest, outputBoundary: 'LOCALIZATION_GUIDANCE_ONLY'});
    expect(binding.projectionDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('keeps the committed Skill manifest and human-readable contract aligned with runtime bindings', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'skills/market-localization-context/manifest.json'), 'utf8')) as unknown;
    const skill = readFileSync(resolve(process.cwd(), 'skills/market-localization-context/SKILL.md'), 'utf8');
    expect(manifest).toEqual(MARKET_LOCALIZATION_SKILL_MANIFEST);
    expect(skill).toContain('market-localization-context@1.0.0');
    expect(skill).toContain('lumiclaw.market-context-view.v1');
    expect(skill).toContain('LOCALIZATION_GUIDANCE_ONLY');
    expect(skill).toContain('Leader');
    expect(skill).toContain('Independent Auditor');
    expect(skill).toContain('must not create an orchestrator');
    expect(skill).toContain('External actions: forbidden');
  });

  it('publishes every mandatory stable error code', () => {
    expect(MARKET_LOCALIZATION_ERROR_CODES).toEqual(expect.arrayContaining([
      'MARKET_PACK_NOT_FOUND', 'MARKET_PACK_EXPIRED', 'MARKET_SCOPE_MISMATCH', 'LOCALE_MARKET_MISMATCH',
      'SOURCE_REQUIRED', 'SOURCE_SCOPE_MISMATCH', 'ORGANIZATION_SCOPE_MISMATCH', 'MARKET_KNOWLEDGE_CONFLICT', 'CONTEXT_DIGEST_MISMATCH'
    ]));
  });
});
