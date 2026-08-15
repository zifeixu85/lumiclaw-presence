import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  MarketLocalizationError,
  bindMarketLocalizationSkill,
  createCampaignLocalizationBriefFixture,
  createOrganizationMarketKnowledgeFixture,
  loadPublicMarketPack,
  projectMarketContextForRole,
  resolveMarketContext,
  type MarketCode,
  type MissionRoleId
} from '../packages/domain/src/index.js';

const at = new Date('2026-08-16T12:00:00.000Z');
const markets = ['US', 'JP', 'DE'] as const satisfies readonly MarketCode[];
const producerRoles: Record<MarketCode, Extract<MissionRoleId, 'founder-identity-producer' | 'product-account-producer'>> = {
  US: 'founder-identity-producer',
  JP: 'product-account-producer',
  DE: 'product-account-producer'
};
const expressions: Record<MarketCode, string> = {
  US: 'LumiClaw turns one approved product fact into a reviewable market brief.',
  JP: 'LumiClawは、承認済みの製品情報を、市場別に確認できるブリーフとして整理します。',
  DE: 'LumiClaw überführt eine freigegebene Produktinformation in ein prüfbares Markt-Briefing.'
};

export function marketLocalizationEvidenceDocument() {
  return {
    schemaVersion: 1 as const,
    evidenceLabel: 'PUBLIC_SAFE_FIXTURE / 非客户证据' as const,
    generatedFrom: 'SDD-005 deterministic resolver; repository-authored synthetic inputs only' as const,
    fixtures: markets.map((marketCode) => {
      const brief = createCampaignLocalizationBriefFixture(marketCode);
      const organizationKnowledge = createOrganizationMarketKnowledgeFixture(marketCode);
      const context = resolveMarketContext({pack: loadPublicMarketPack({marketCode, locale: brief.locale, at}), organizationKnowledge, brief, at});
      const producerRole = producerRoles[marketCode];
      let producerContext: Record<string, unknown>;
      try {
        const projection = projectMarketContextForRole(context, producerRole);
        if (projection.projectionKind !== 'PRODUCER_MINIMUM') throw new Error('SDD005_PRODUCER_PROJECTION_INVALID');
        producerContext = {
          projectionKind: projection.projectionKind,
          roleId: projection.roleId,
          contextDigest: projection.contextDigest,
          marketCode: projection.marketCode,
          locale: projection.locale,
          resolvedItems: projection.resolvedItems.map((item) => ({key: item.key, value: item.value, activeLayer: item.activeLayer, actionable: item.actionable}))
        };
      } catch (error) {
        if (!(error instanceof MarketLocalizationError) || error.code !== 'MARKET_KNOWLEDGE_CONFLICT') throw error;
        producerContext = {projectionKind: 'PRODUCER_BLOCKED', roleId: producerRole, contextDigest: context.contextDigest, marketCode, locale: context.locale, status: 'BLOCKED_BY_CONFLICT', blockingCodes: ['MARKET_KNOWLEDGE_CONFLICT']};
      }
      const auditor = projectMarketContextForRole(context, 'independent-auditor');
      if (auditor.projectionKind !== 'AUDITOR_EVIDENCE') throw new Error('SDD005_AUDITOR_PROJECTION_INVALID');
      const skillBinding = bindMarketLocalizationSkill(context, context.status === 'READY' ? producerRole : 'independent-auditor');
      const compactSourceRefs = context.sourceRefs.map((sourceRef) => ({
        sourceId: sourceRef.sourceId,
        url: sourceRef.url,
        publisher: sourceRef.publisher,
        versionOrUpdatedAt: sourceRef.versionOrUpdatedAt,
        reuseBoundary: sourceRef.reuseBoundary
      }));
      return {
        marketCode,
        locale: context.locale,
        uiLocale: context.uiLocale,
        contentLanguage: context.contentLanguage,
        platform: context.platform,
        timeZone: context.timeZone,
        syntheticProductFact: brief.explicitDecisions.find((decision) => decision.key === 'product.fact')!.value,
        localizedExpression: expressions[marketCode],
        packId: context.packSelection.packId,
        packVersion: context.packSelection.version,
        contextDigest: context.contextDigest,
        status: context.status,
        sourceCount: context.sourceRefs.length,
        organizationOverrideSource: organizationKnowledge.sourceRefs[0]!.title,
        resolvedItems: context.resolvedItems.map((item) => ({
          key: item.key,
          value: item.value,
          activeLayer: item.activeLayer,
          actionable: item.actionable,
          sourceRefIds: item.sourceRefIds,
          provenance: item.provenance.map((entry) => ({layer: entry.layer, version: entry.version, sourceRefIds: entry.sourceRefIds}))
        })),
        questions: context.questions.map((question) => ({key: question.key, value: question.value})),
        conflicts: context.conflicts,
        sourceRefs: compactSourceRefs,
        producerRole,
        producerContext,
        auditorContext: {
          projectionKind: auditor.projectionKind,
          roleId: auditor.roleId,
          contextDigest: auditor.contextDigest,
          marketCode: auditor.marketCode,
          locale: auditor.locale,
          sourceRefs: compactSourceRefs,
          conflicts: auditor.conflicts,
          provenance: auditor.resolvedItems.map((item) => ({
            key: item.key,
            layers: item.provenance.map((entry) => ({layer: entry.layer, sourceRefIds: entry.sourceRefIds}))
          }))
        },
        skillBinding: {skillName: skillBinding.skillName, skillVersion: skillBinding.skillVersion, roleId: skillBinding.roleId, contextDigest: skillBinding.contextDigest, projectionKind: skillBinding.projectionKind, projectionDigest: skillBinding.projectionDigest, outputBoundary: skillBinding.outputBoundary}
      };
    })
  };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const serialized = `${JSON.stringify(marketLocalizationEvidenceDocument())}\n`;
  const fixturePath = resolve(process.cwd(), 'apps/web/src/fixtures/market-localization-evidence.json');
  if (process.argv.includes('--check')) {
    if (readFileSync(fixturePath, 'utf8') !== serialized) throw new Error('SDD005_MARKET_EVIDENCE_FIXTURE_STALE');
    console.info('SDD-005 market-localization evidence fixture verified: 3 markets, deterministic digests.');
  } else {
    process.stdout.write(serialized);
  }
}
