# SDD-005 — Market Localization Knowledge Foundation

> Status: `SPEC_READY`
> Date: `2026-08-16`
> Module: `M2-07`
> Owner: LumiClaw product/design Owner
> Worktree: `/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-005-market-localization-foundation`
> Branch: `codex/sdd-005-market-localization-foundation`
> Base: `9e241da98be00c56204894c67b7599d37ff10505`
> Acceptance report: `docs/reports/acceptance/SDD-005-ACCEPTANCE.md`

## 1. User problem and outcome

A team already operating in several countries often owns market-specific research, terminology, brand rules, customer feedback and proven local expressions. LumiClaw currently distinguishes Market and content language, but it does not yet provide a versioned, sourced and user-overridable localization context that Agents can consume and an independent Auditor can verify.

The bounded outcome is a public-safe foundation that proves:

1. an Organization can contribute higher-priority market knowledge without placing customer data in the public repository;
2. LumiClaw can ship a small, expandable set of sourced public market packs;
3. a Mission selects only the relevant market data and produces a deterministic, source-carrying `MarketContextView`;
4. Producers and the independent Auditor receive different least-context projections;
5. the system fails closed on missing provenance, expiry, scope mismatch, conflicts and digest mutation.

This SDD validates data and Agent-context contracts. It does not claim that generated copy is culturally correct, legally compliant, customer-accepted or commercially effective.

## 2. First public-safe market set

The first set contains three deliberately different markets:

| Code | Primary locale | Purpose in this SDD |
|---|---|---|
| `US` | `en-US` | English baseline, style/format conventions and platform notes |
| `JP` | `ja-JP` | Non-English register, writing/typography and localization review |
| `DE` | `de-DE` | German register, format and language-variant handling |

Every entry is a `PUBLIC_SAFE_FIXTURE` backed by primary or authoritative public sources where available. A fixture is engineering evidence, not customer knowledge or market-performance evidence. Country stereotypes, legal conclusions and unsupported cultural claims are prohibited.

## 3. Source and precedence model

Three inputs form one context:

```text
CampaignLocalizationBrief
> OrganizationMarketKnowledge fixture
> versioned PublicMarketPack
> model prior (question/proposal only; never approved truth)
```

Precedence chooses the active value but never erases provenance. Conflicting values produce a stable conflict record. An expired, unsupported, unlicensed or unsourced actionable rule cannot enter a valid context.

Public-source evidence must record URL, publisher, title, retrieved date, applicable scope, version/update date when available, and reuse/citation boundary. Raw webpages are not copied into the repository.

## 4. Domain contract

The implementation must define versioned contracts equivalent to:

```ts
type MarketKnowledgePack = {
  schemaVersion: 1;
  packId: string;
  marketCode: string;
  locales: string[];
  version: string;
  effectiveFrom: string;
  reviewedAt: string;
  expiresAt: string | null;
  sourceRefs: MarketSourceRef[];
  knowledge: MarketKnowledgeItem[];
  maturity: 'PUBLIC_SAFE_FIXTURE';
};

type OrganizationMarketKnowledge = {
  organizationId: string;
  marketCode: string;
  version: string;
  approved: boolean;
  sourceRefs: MarketSourceRef[];
  knowledge: MarketKnowledgeItem[];
};

type CampaignLocalizationBrief = {
  campaignId: string;
  marketCode: string;
  locale: string;
  contentLanguage: string;
  platform: string;
  timeZone: string;
  explicitDecisions: MarketKnowledgeItem[];
};

type MarketContextView = {
  schemaVersion: 1;
  organizationId: string;
  campaignId: string;
  marketCode: string;
  locale: string;
  contentLanguage: string;
  platform: string;
  timeZone: string;
  resolvedItems: ResolvedMarketKnowledgeItem[];
  conflicts: MarketKnowledgeConflict[];
  sourceRefs: MarketSourceRef[];
  packSelection: {packId: string; version: string};
  contextDigest: string;
};
```

Stable field names may be refined during implementation, but the following invariants are mandatory:

- market, UI locale, content language, platform and time zone remain separate;
- Organization and Campaign scope are explicit;
- each actionable item references at least one source;
- source, pack and context identities participate in a deterministic digest;
- public fixture and Organization-private input are distinct types and paths;
- the resolver does not mutate its inputs or approved Campaign/Artifact state;
- changes produce a new context digest and a review-required signal, not a silent rewrite.

## 5. AgentTeams and Skill contract

Add a versioned `market-localization-context` Skill contract or manifest without creating a second orchestrator.

Role projections:

- Mission Leader: dependency/status only; no domain content generation;
- Evidence & Claim Steward: sources, expiry, conflicts and provenance;
- Campaign Planner: target market, locale, platform, time zone and strategy constraints;
- Founder/Product Producers: the minimum resolved conventions and Campaign decisions required by their ActivationUnit;
- Independent Auditor: resolved items plus source/conflict/unsupported-claim evidence; no permission to rewrite or approve.

The Producer view must not receive unrelated markets. The Auditor view may include conflict and provenance fields unavailable in the Producer view. Skill version and context digest must be visible in the evidence fixture and testable.

## 6. UX evidence surface

Add an isolated, Chinese-first Storybook evidence surface or an equivalently reviewable public-safe fixture. It must show the same synthetic product fact prepared for US, JP and DE as three localization briefs, including:

- selected market, locale and platform;
- public pack version;
- Organization override source, if present;
- resolved guidance with source count;
- conflicts or questions requiring a human;
- current Agent using the context and the independent Auditor boundary;
- a clear `PUBLIC_SAFE_FIXTURE / not customer evidence` label.

Do not modify the Owner-frozen UX 1.1 core workspace in this SDD. Do not claim final visual design or content-quality UAT.

## 7. Implementation boundary

### In scope

- US, JP and DE public-safe pack fixtures;
- source register entries and citation/reuse metadata;
- schemas/types, registry, loader, deterministic resolver and digest;
- one synthetic Organization override and one explicit conflict case;
- stable fail-closed error codes;
- Producer/Auditor least-context projections and SkillLock/manifest evidence;
- isolated visual/fixture evidence;
- unit, contract, regression, i18n, secret and build tests;
- Chinese acceptance report, screenshot, commit, push and Draft PR.

### Out of scope

- real customer documents or tenant upload pipeline;
- vector database, embeddings or general RAG infrastructure;
- automatic web crawling or background market-pack updates;
- legal, tax, advertising or cultural compliance guarantees;
- platform publishing, OAuth, credentials, ActionGrant or external action;
- changing approved memory, Skills or ArtifactRevision automatically;
- supporting more than the three first fixtures;
- measuring localization quality, reach, leads or revenue.

## 8. Fail-closed states

The implementation must use stable codes for at least:

- `MARKET_PACK_NOT_FOUND`;
- `MARKET_PACK_EXPIRED`;
- `MARKET_SCOPE_MISMATCH`;
- `LOCALE_MARKET_MISMATCH`;
- `SOURCE_REQUIRED`;
- `SOURCE_SCOPE_MISMATCH`;
- `ORGANIZATION_SCOPE_MISMATCH`;
- `MARKET_KNOWLEDGE_CONFLICT`;
- `CONTEXT_DIGEST_MISMATCH`.

A conflict may return a deterministic blocked result with evidence, but it cannot be silently resolved by source order when the values are semantically incompatible.

## 9. Acceptance criteria

| ID | Binary criterion |
|---|---|
| AC-01 | Exactly three first-party public-safe packs exist for US, JP and DE; each has stable identity/version, primary locale, source refs and `PUBLIC_SAFE_FIXTURE` maturity. |
| AC-02 | Registry/loader selects exactly the requested pack and rejects unknown, expired or market/locale-mismatched inputs with stable codes. |
| AC-03 | Resolver applies Campaign > approved Organization > Public Pack precedence, preserves provenance and returns an explicit conflict rather than silently overwriting incompatible knowledge. |
| AC-04 | Same inputs yield the same canonical `MarketContextView` and digest; input/source/order/scope mutation changes or invalidates the digest. |
| AC-05 | Every actionable resolved item has source evidence; unsourced items are rejected or remain non-actionable questions. |
| AC-06 | Producer receives only the selected market's minimum context; Auditor receives provenance/conflict evidence; Leader cannot receive a domain-generation projection. |
| AC-07 | A versioned `market-localization-context` Skill/manifest binds role, input schema, context digest and output boundary without creating another orchestration runtime. |
| AC-08 | Isolated Chinese-first evidence shows US/JP/DE briefs, pack/source/version, override/conflict and Agent/Auditor trace, clearly labeled as synthetic and non-customer evidence. |
| AC-09 | Existing Campaign, AgentTeams, i18n, status, build, secret, dependency and full repository gates pass without external actions or credentials. |
| AC-10 | Chinese acceptance report records exact commands/results, public-safe screenshot, limitations, rollback, source/license decisions and Owner UAT steps; maturity is at most `EVIDENCE_READY`. |

## 10. Owner UAT

Owner reviews only the public-safe evidence surface:

1. verify that selecting US, JP and DE visibly changes the localization brief, not only its translated label;
2. verify that the system distinguishes enterprise-provided knowledge, public pack knowledge and Campaign decisions;
3. inspect one conflict and confirm it asks for a decision rather than silently choosing;
4. inspect Agent trace and confirm only the current Producer and independent Auditor are exposed in task context;
5. confirm the page does not claim legal compliance, customer results or worldwide coverage;
6. return `UAT-01 PASS` or the exact failed criterion and requested change.

No real company files, market account or platform action is required.

## 11. Verification matrix

Required minimum checks:

- targeted domain/resolver/role-projection tests;
- deterministic snapshot and mutation tests;
- cross-market and cross-organization negative tests;
- source/expiry/conflict matrix;
- Story/DOM test and desktop screenshot;
- `npm run check:messages`, `npm run check:status`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run storybook:build`, `npm run check:secrets`, `npm run verify:dependencies`, `npm run verify`, `git diff --check`;
- `npm audit --omit=dev --json` with limitations recorded.

## 12. Rollback and claims

Rollback is a pure Git revert unless the Executor proposes a schema or service change, which is prohibited without a change request. No platform, customer or secret state should exist.

Allowed claim after machine verification: `IMPLEMENTED / ENGINEERING_VERIFIED` public-safe market-context foundation. Required Owner UAT pending state: `EVIDENCE_READY`.

Not allowed: culturally correct, compliant, customer-approved, globally covered, production-ready or business-effective localization.

