'use client';

import {useState} from 'react';
import evidenceDocument from '../fixtures/market-localization-evidence.json';

export type MarketCode = 'US' | 'JP' | 'DE';
type ProducerRole = 'founder-identity-producer' | 'product-account-producer';
const roleUiNames = {
  'presence-mission-leader': 'A0 任务协调 Agent',
  'evidence-claim-steward': 'A1 事实核验 Agent',
  'campaign-planner': 'A2 市场策划 Agent',
  'founder-identity-producer': 'A3 创始人内容 Agent',
  'product-account-producer': 'A4 产品内容 Agent',
  'independent-auditor': 'A5 独立审校 Agent'
} as const;
type SerializedEvidenceFixture = (typeof evidenceDocument.fixtures)[number];
export type MarketLocalizationEvidenceFixture = Omit<SerializedEvidenceFixture, 'marketCode' | 'producerRole' | 'questions'> & {
  marketCode: MarketCode;
  producerRole: ProducerRole;
  questions: {key: string; value: string}[];
};

export function createMarketLocalizationEvidenceFixture(): MarketLocalizationEvidenceFixture[] {
  return structuredClone(evidenceDocument.fixtures) as MarketLocalizationEvidenceFixture[];
}

export function MarketLocalizationEvidence({initialMarket = 'US'}: {initialMarket?: MarketCode}) {
  const [selectedMarket, setSelectedMarket] = useState<MarketCode>(initialMarket);
  const fixtures = createMarketLocalizationEvidenceFixture();
  const selected = fixtures.find((fixture) => fixture.marketCode === selectedMarket)!;
  const producerBlocked = selected.producerContext.projectionKind === 'PRODUCER_BLOCKED';

  return <main className="market-evidence" data-evidence="PUBLIC_SAFE_FIXTURE">
    <header className="market-evidence__hero">
      <div>
        <p className="market-evidence__eyebrow">SDD-005 · ISOLATED STORYBOOK EVIDENCE</p>
        <h1>一条产品事实，三份可追溯的市场简报</h1>
        <p>只展示版本化公共来源、合成 Organization 覆盖、Campaign 明确决定与角色最小上下文。这里不生成客户结论，也不执行发布。</p>
      </div>
      <strong>PUBLIC_SAFE_FIXTURE / 非客户证据</strong>
    </header>

    <section className="market-evidence__fact" aria-label="同一合成产品事实">
      <span>同一合成产品事实</span>
      <p>{selected.syntheticProductFact}</p>
    </section>

    <nav className="market-evidence__markets" aria-label="选择市场">
      {fixtures.map((fixture) => <button key={fixture.marketCode} type="button" aria-pressed={fixture.marketCode === selectedMarket} onClick={() => setSelectedMarket(fixture.marketCode)}>
        <span>{fixture.marketCode}</span>
        <strong>{fixture.locale}</strong>
        <small>{fixture.localizedExpression}</small>
      </button>)}
    </nav>

    <section className="market-evidence__selected" aria-live="polite">
      <header>
        <div>
          <p>当前 Localization Brief</p>
          <h2>{selected.marketCode} · {selected.locale} · {selected.platform}</h2>
        </div>
        <span className={selected.status === 'READY' ? 'market-evidence__ready' : 'market-evidence__blocked'}>{selected.status}</span>
      </header>

      <div className="market-evidence__expression">
        <span>合成本地化表达 / 未做质量 UAT</span>
        <p lang={selected.contentLanguage}>{selected.localizedExpression}</p>
      </div>

      <dl className="market-evidence__dimensions">
        <div><dt>UI locale</dt><dd>{selected.uiLocale}</dd></div>
        <div><dt>Content language</dt><dd>{selected.contentLanguage}</dd></div>
        <div><dt>Market</dt><dd>{selected.marketCode}</dd></div>
        <div><dt>Platform</dt><dd>{selected.platform}</dd></div>
        <div><dt>Time zone</dt><dd>{selected.timeZone}</dd></div>
        <div><dt>Pack</dt><dd>{selected.packVersion}</dd></div>
      </dl>

      <div className="market-evidence__grid">
        <article>
          <span>01 · 已解析指导</span>
          <h3>来源与优先级没有被折叠</h3>
          <ul>{selected.resolvedItems.map((item) => <li key={item.key}>
            <strong>{item.key}</strong>
            <p>{item.value}</p>
            <small>{item.activeLayer} · {item.sourceRefIds.length} active source · {item.provenance.length} provenance layer</small>
          </li>)}</ul>
        </article>

        <article>
          <span>02 · Organization 已批准覆盖</span>
          <h3>{selected.organizationOverrideSource}</h3>
          <p>仅为公开仓内的 synthetic Organization fixture；不是企业资料，也不是客户证据。</p>
          <code>{selected.contextDigest}</code>
        </article>

        <article className={selected.conflicts.length > 0 ? 'market-evidence__conflict' : ''}>
          <span>03 · 冲突 / 人工问题</span>
          <h3>{selected.conflicts.length > 0 ? '需要 Owner 决定，Producer 已阻断' : '当前没有阻断性语义冲突'}</h3>
          {selected.conflicts.map((conflict) => <div key={conflict.key}>
            <code>{conflict.code}</code>
            <p>{conflict.key}</p>
            <small>{conflict.values.map((value) => `${value.layer}: ${value.value}`).join(' / ')}</small>
          </div>)}
          {selected.questions.map((question) => <p key={question.key}>{question.value}</p>)}
        </article>

        <article>
          <span>04 · 来源登记</span>
          <h3>{selected.sourceCount} 条当前上下文来源</h3>
          <ol>{selected.sourceRefs.map((sourceRef) => <li key={sourceRef.sourceId}>
            <a href={sourceRef.url} target="_blank" rel="noreferrer">{sourceRef.publisher}</a>
            <small>{sourceRef.versionOrUpdatedAt} · {sourceRef.reuseBoundary}</small>
          </li>)}</ol>
        </article>
      </div>

      <footer className="market-evidence__roles">
        <article data-testid="producer-context">
          <span>当前 Producer</span>
          <h3>{roleUiNames[selected.producerRole]}</h3>
          <code>{selected.producerRole}</code>
          <p>{producerBlocked ? 'BLOCKED_BY_CONFLICT' : 'PRODUCER_MINIMUM · 只含当前 ActivationUnit 的可执行指导'}</p>
          <code>{selected.producerContext.contextDigest.slice(0, 20)}…</code>
        </article>
        <article data-testid="auditor-context">
          <span>Independent Auditor</span>
          <h3>{roleUiNames['independent-auditor']}</h3>
          <code>independent-auditor</code>
          <p>AUDITOR_EVIDENCE · 可见 provenance / source / conflict，不可改稿或批准</p>
          <code>{selected.skillBinding.skillName}@{selected.skillBinding.skillVersion} · CONTRACT_BOUND / NOT_RUN · {selected.skillBinding.projectionDigest.slice(0, 20)}…</code>
        </article>
      </footer>
      <div className="market-evidence__role-contract" aria-label="UX 1.2 稳定 Agent 名称">
        {Object.entries(roleUiNames).map(([roleId, uiName]) => <span key={roleId}><strong>{uiName}</strong><code>{roleId}</code></span>)}
      </div>
    </section>

    <footer className="market-evidence__nonclaim">
      <strong>IMPLEMENTED FIXTURE / OWNER UAT PENDING · NOT_CLAIMED</strong>
      <p>本页不是 Agent 运行或 ACCEPTED 证据。A0 只协调，不生成本地化内容；不声明本地化质量、合规保证、客户结果、全球市场覆盖、PMF、增长或收入；无 Credential、Connector、ActionGrant、Postiz/AGPL 或外部动作。</p>
    </footer>
  </main>;
}
