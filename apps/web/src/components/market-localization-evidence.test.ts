import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {describe, expect, it} from 'vitest';
import {MarketLocalizationEvidence, createMarketLocalizationEvidenceFixture} from './market-localization-evidence';

describe('SDD-005 isolated market-localization evidence surface', () => {
  it('prepares the same synthetic product fact as three distinct US/JP/DE briefs', () => {
    const fixtures = createMarketLocalizationEvidenceFixture();
    expect(fixtures.map((fixture) => [fixture.marketCode, fixture.locale, fixture.platform])).toEqual([
      ['US', 'en-US', 'X'],
      ['JP', 'ja-JP', 'BLUESKY'],
      ['DE', 'de-DE', 'LINKEDIN']
    ]);
    expect(new Set(fixtures.map((fixture) => fixture.syntheticProductFact)).size).toBe(1);
    expect(new Set(fixtures.map((fixture) => fixture.localizedExpression)).size).toBe(3);
    expect(fixtures.every((fixture) => fixture.packVersion === '2026.08.16.1' && fixture.sourceCount >= 3)).toBe(true);
    expect(fixtures.every((fixture) => fixture.uiLocale === 'zh-CN')).toBe(true);
    expect(fixtures.map((fixture) => fixture.contentLanguage)).toEqual(['en', 'ja', 'de']);
  });

  it('renders Chinese-first source/version/override/conflict and separated Agent evidence without customer claims', () => {
    const html = renderToStaticMarkup(createElement(MarketLocalizationEvidence, {initialMarket: 'JP'}));
    expect(html).toContain('PUBLIC_SAFE_FIXTURE / 非客户证据');
    expect(html).toContain('JP · ja-JP · BLUESKY');
    expect(html).toContain('Organization 已批准覆盖');
    expect(html).toContain('MARKET_KNOWLEDGE_CONFLICT');
    expect(html).toContain('product-account-producer');
    expect(html).toContain('independent-auditor');
    expect(html).toContain('A4 产品内容 Agent');
    expect(html).toContain('A5 独立审校 Agent');
    expect(html).toContain('A0 任务协调 Agent');
    expect(html).toContain('market-localization-context@1.0.0');
    expect(html).toContain('CONTRACT_BOUND / NOT_RUN');
    expect(html).toContain('OWNER UAT PENDING');
    expect(html).toContain('BLOCKED_BY_CONFLICT');
    expect(html).not.toMatch(/客户效果已验证|法律合规保证|文化合规保证|全球覆盖已实现|PMF 已验证|收入提升已验证/u);
  });

  it('keeps Producer evidence minimal while Auditor retains provenance and sources', () => {
    const fixtures = createMarketLocalizationEvidenceFixture();
    const us = fixtures.find((fixture) => fixture.marketCode === 'US')!;
    expect(us.producerContext).toMatchObject({projectionKind: 'PRODUCER_MINIMUM', marketCode: 'US', locale: 'en-US'});
    expect(JSON.stringify(us.producerContext)).not.toMatch(/sourceRefs|conflicts|ja-JP|de-DE|unicode\.org/u);
    expect(us.auditorContext).toMatchObject({projectionKind: 'AUDITOR_EVIDENCE', marketCode: 'US', locale: 'en-US'});
    expect(JSON.stringify(us.auditorContext)).toMatch(/sourceRefs|provenance|unicode\.org/u);
  });
});
