'use client';

import type {AppLocale, RouteId} from '@lumiclaw/i18n';
import type {ArtifactRevision, CampaignDocument, CampaignEnvelope, PlatformArtifact} from '@lumiclaw/domain';
import {useCallback, useEffect, useState} from 'react';
import {platformPreviewModel} from '@/lib/platform-preview-model';

export type WorkspaceFixtureState = 'loading' | 'empty' | 'blocked' | 'needs-owner' | 'recovery';
type Phase = WorkspaceFixtureState | 'ready' | 'saving' | 'saved';
type ApiFailure = Error & {status?: number; code?: string};

const copy = {
  'zh-CN': {
    loading: ['正在读取推广任务…', '从统一控制面读取，不使用浏览器本地副本。'],
    empty: ['还没有保存的推广任务', '下方是公开安全的演示模板；填写后才会写入 PostgreSQL。'],
    blocked: ['当前步骤已安全阻断', '没有真实平台反馈、批准或执行权限；系统不会伪装成已运行。'],
    'needs-owner': ['需要你补全依据', '存在草稿 Claim 或缺少 Evidence；内容可保存和预览，但不能进入执行。'],
    recovery: ['控制面暂时不可用', '请确认本地 API 与 PostgreSQL 已启动，再重试；页面没有伪造成功。'],
    ready: ['已从数据库重新打开', 'Web、API 与未来 AgentTeams Adapter 读取同一版本化 Campaign。'],
    saving: ['正在保存新版本…', '使用 Idempotency-Key 与 If-Match 防止重复写入和覆盖。'],
    saved: ['新版本已持久化', '摘要、ETag、ArtifactRevision 与排程状态均由服务端确认。'],
    retry: '重新读取', create: '创建并保存', save: '保存新版本', unsaved: '有未保存修改', savedLabel: '数据库版本', digest: '稳定摘要', noLive: '只保存与预览 · 不发布', schedule: '排程合同', addSchedule: '生成排程预览', scheduleHint: 'IANA 时区；DST gap 会拒绝，fold 必须明确选择。', once: '一次性', recurring: '受约束重复', brandMatrix: '品牌与市场矩阵', claimEvidence: 'Claim / Evidence', content: '可编辑内容', preview: '原生风格预览', constraints: '公开安全约束', noSignals: '尚无真实互动信号。M1 不抓取评论、回复、私信或平台数据。', reviewHint: '这里只展示版本与风险。M1 不创建 OwnerDecision、ActionGrant 或 Receipt。'
  },
  en: {
    loading: ['Loading campaign…', 'Reading the shared control plane, never a browser-local business copy.'],
    empty: ['No saved campaign yet', 'The form uses a public-safe demo template and writes only after you create it.'],
    blocked: ['This step is safely blocked', 'There is no live feedback, approval, or execution authority; the UI does not simulate success.'],
    'needs-owner': ['Owner input is required', 'A draft Claim or missing Evidence remains. Content may be saved and previewed but cannot execute.'],
    recovery: ['Control plane unavailable', 'Check the local API and PostgreSQL, then retry. The page has not fabricated success.'],
    ready: ['Reopened from the database', 'Web, API, and the future AgentTeams adapter read the same versioned Campaign.'],
    saving: ['Saving a new version…', 'Idempotency-Key and If-Match prevent duplicate writes and lost updates.'],
    saved: ['New version persisted', 'The server confirmed the digest, ETag, ArtifactRevision, and schedule state.'],
    retry: 'Retry', create: 'Create and save', save: 'Save new version', unsaved: 'Unsaved changes', savedLabel: 'Database version', digest: 'Stable digest', noLive: 'Save and preview only · no publishing', schedule: 'Schedule contract', addSchedule: 'Build schedule preview', scheduleHint: 'IANA time zone; DST gaps fail closed and folds require an explicit choice.', once: 'One-time', recurring: 'Constrained recurring', brandMatrix: 'Brand and market matrix', claimEvidence: 'Claim / Evidence', content: 'Editable content', preview: 'Native-like preview', constraints: 'Public-safe constraints', noSignals: 'No real interaction signals exist. M1 does not collect comments, replies, DMs, or platform data.', reviewHint: 'This view shows versions and risk only. M1 creates no OwnerDecision, ActionGrant, or Receipt.'
  }
} as const;

export function CampaignWorkspace({locale, routeId, fixtureState}: {locale: AppLocale; routeId: RouteId; fixtureState?: WorkspaceFixtureState | undefined}) {
  const t = copy[locale];
  const [phase, setPhase] = useState<Phase>(fixtureState ?? 'loading');
  const [document, setDocument] = useState<CampaignDocument>();
  const [envelope, setEnvelope] = useState<CampaignEnvelope>();
  const [dirty, setDirty] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    if (fixtureState !== undefined) return;
    setPhase('loading'); setErrorCode(undefined);
    try {
      const template = await api<{document: CampaignDocument}>('/api/v1/campaigns/demo-template');
      const organizationId = template.document.organizationId;
      const list = await api<{campaigns: {id: string}[]}>('/api/v1/campaigns', {headers: organizationHeaders(organizationId)});
      if (list.campaigns.length === 0) { setDocument(template.document); setEnvelope(undefined); setPhase('empty'); return; }
      const reopened = await api<CampaignEnvelope>(`/api/v1/campaigns/${list.campaigns[0]!.id}`, {headers: organizationHeaders(organizationId)});
      setEnvelope(reopened); setDocument(reopened.document); setPhase(reopened.readiness === 'NEEDS_OWNER' ? 'needs-owner' : 'ready');
    } catch (error) { const failure = error as ApiFailure; setErrorCode(failure.code); setPhase('recovery'); }
  }, [fixtureState]);

  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  const update = useCallback((next: CampaignDocument) => { setDocument(next); setDirty(true); setPhase(next.claims.some((claim) => claim.status !== 'APPROVED') ? 'needs-owner' : 'ready'); }, []);

  const persist = useCallback(async () => {
    if (document === undefined) return;
    setPhase('saving'); setErrorCode(undefined);
    try {
      const isCreate = envelope === undefined;
      const next = await api<CampaignEnvelope>(isCreate ? '/api/v1/campaigns' : `/api/v1/campaigns/${document.id}`, {
        method: isCreate ? 'POST' : 'PUT',
        headers: {...organizationHeaders(document.organizationId), 'content-type': 'application/json', 'idempotency-key': `web-${crypto.randomUUID()}`, ...(isCreate ? {} : {'if-match': envelope.etag})},
        body: JSON.stringify(document)
      });
      setEnvelope(next); setDocument(next.document); setDirty(false); setPhase('saved');
    } catch (error) { const failure = error as ApiFailure; setErrorCode(failure.code); setPhase(failure.status === 412 ? 'blocked' : 'recovery'); }
  }, [document, envelope]);

  if (fixtureState !== undefined) return <StatePanel phase={fixtureState} t={t} errorCode={undefined} onRetry={() => undefined} />;
  if (phase === 'loading' || phase === 'recovery') return <StatePanel phase={phase} t={t} errorCode={errorCode} onRetry={() => void load()} />;
  if (document === undefined) return <StatePanel phase="recovery" t={t} errorCode={undefined} onRetry={() => void load()} />;

  return (
    <section className="campaign-control" aria-label="Campaign control plane">
      <StatePanel phase={phase} t={t} errorCode={errorCode} onRetry={() => void load()} compact />
      <div className="campaign-meta">
        <span>{t.noLive}</span>
        {envelope !== undefined && <><span>{t.savedLabel} <strong>v{envelope.version}</strong></span><span className="digest-label">{t.digest} <code>{envelope.digest.slice(0, 12)}…</code></span></>}
        {dirty && <strong className="dirty-label">{t.unsaved}</strong>}
      </div>
      {routeId === 'campaigns' && <CampaignForm document={document} onChange={update} />}
      {routeId === 'setup' && <SetupEditor document={document} onChange={update} t={t} />}
      {routeId === 'mission' && <Composer document={document} onChange={update} t={t} />}
      {routeId === 'review' && <ReviewPanel document={document} envelope={envelope} t={t} />}
      {routeId === 'learn' && <BlockedPanel text={t.noSignals} />}
      {(routeId === 'campaigns' || routeId === 'setup' || routeId === 'mission') && <button className="primary-action" type="button" onClick={() => void persist()} disabled={phase === 'saving' || (envelope !== undefined && !dirty)}>{envelope === undefined ? t.create : t.save}</button>}
    </section>
  );
}

function StatePanel({phase, t, errorCode, onRetry, compact = false}: {phase: Phase; t: typeof copy[AppLocale]; errorCode: string | undefined; onRetry: () => void; compact?: boolean}) {
  const [title, description] = t[phase];
  return <div className={`control-state state-${phase}${compact ? ' compact' : ''}`} role={phase === 'recovery' || phase === 'blocked' ? 'alert' : 'status'}><span className="state-pulse" aria-hidden="true"/><div><strong>{title}</strong><p>{description}</p>{errorCode !== undefined && <code>{errorCode}</code>}</div>{phase === 'recovery' && <button type="button" onClick={onRetry}>{t.retry}</button>}</div>;
}

function CampaignForm({document, onChange}: {document: CampaignDocument; onChange: (value: CampaignDocument) => void}) {
  const setBrief = (key: 'name' | 'objective' | 'callToAction', value: string) => { const next = structuredClone(document); next.brief[key] = value; onChange(next); };
  return <div className="editor-surface form-grid"><label><span>Campaign name</span><input value={document.brief.name} maxLength={120} onChange={(event) => setBrief('name', event.target.value)} /></label><label className="wide"><span>Objective</span><textarea value={document.brief.objective} maxLength={2000} onChange={(event) => setBrief('objective', event.target.value)} /></label><label className="wide"><span>Call to action</span><textarea value={document.brief.callToAction} maxLength={500} onChange={(event) => setBrief('callToAction', event.target.value)} /></label><label><span>Content language</span><select value={document.brief.contentLanguage} onChange={(event) => { const next = structuredClone(document); next.brief.contentLanguage = event.target.value as 'en' | 'zh-CN'; onChange(next); }}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label><label><span>Target market</span><input value={document.graph.markets.map((market) => market.code).join(', ')} readOnly /></label></div>;
}

function SetupEditor({document, onChange, t}: {document: CampaignDocument; onChange: (value: CampaignDocument) => void; t: typeof copy[AppLocale]}) {
  return <div className="setup-grid"><section className="editor-surface"><h2>{t.brandMatrix}</h2><label><span>Organization</span><input value={document.graph.organization.displayName} onChange={(event) => { const next = structuredClone(document); next.graph.organization.displayName = event.target.value; onChange(next); }} /></label><label><span>Brand</span><input value={document.graph.brands[0]!.name} onChange={(event) => { const next = structuredClone(document); next.graph.brands[0]!.name = event.target.value; onChange(next); }} /></label><label><span>Product</span><input value={document.graph.products[0]!.name} onChange={(event) => { const next = structuredClone(document); next.graph.products[0]!.name = event.target.value; onChange(next); }} /></label><div className="tag-row">{document.graph.markets.map((market) => <span key={market.id}>{market.code} · {market.primaryLanguage}</span>)}</div></section><section className="editor-surface"><h2>{t.claimEvidence}</h2>{document.claims.map((claim) => <article className="claim-card" key={claim.id}><span className={`claim-status status-${claim.status.toLowerCase()}`}>{claim.status}</span><textarea value={claim.statement} onChange={(event) => { const next = structuredClone(document); next.claims.find((item) => item.id === claim.id)!.statement = event.target.value; onChange(next); }} /><small>{claim.evidenceRefIds.length} EvidenceRef · valid until {claim.effectiveUntil.slice(0, 10)}</small></article>)}</section></div>;
}

function Composer({document, onChange, t}: {document: CampaignDocument; onChange: (value: CampaignDocument) => void; t: typeof copy[AppLocale]}) {
  const [selected, setSelected] = useState<ArtifactRevision['platform']>('X');
  const [schedule, setSchedule] = useState<{localStart: string; timeZone: string; recurring: boolean; rrule: string; foldPreference: 'EARLIER' | 'LATER'; misfirePolicy: 'SKIP' | 'HOLD_FOR_OWNER'}>({localStart: '2026-11-01T01:30', timeZone: 'America/New_York', recurring: false, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=3', foldPreference: 'LATER', misfirePolicy: 'HOLD_FOR_OWNER'});
  const [scheduleError, setScheduleError] = useState<string>();
  const revision = latestByPlatform(document.artifactRevisions).get(selected)!;
  const capability = document.capabilitySnapshots.find((item) => item.id === revision.capabilitySnapshotId)!;
  const edit = (content: PlatformArtifact) => { const next = structuredClone(document); const target = next.artifactRevisions.find((item) => item.id === revision.id)!; target.content = content; onChange(next); };
  const previewSchedule = async () => {
    try {
      setScheduleError(undefined);
      const value = await api<{schedule: CampaignDocument['publishingSchedules'][number]; occurrences: CampaignDocument['scheduleOccurrences']}>(`/api/v1/campaigns/${document.id}/schedule-preview`, {method: 'POST', headers: {...organizationHeaders(document.organizationId), 'content-type': 'application/json'}, body: JSON.stringify({localStart: schedule.localStart, timeZone: schedule.timeZone, rrule: schedule.recurring ? schedule.rrule : null, foldPreference: schedule.foldPreference, misfirePolicy: schedule.misfirePolicy})});
      const next = structuredClone(document); next.publishingSchedules.push(value.schedule); next.scheduleOccurrences.push(...value.occurrences); onChange(next);
    } catch (error) { setScheduleError((error as ApiFailure).code ?? 'SCHEDULE_PREVIEW_FAILED'); }
  };
  return <><div className="platform-tabs" role="tablist" aria-label={t.content}>{(['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'] as const).map((platform) => <button key={platform} type="button" role="tab" aria-selected={selected === platform} onClick={() => setSelected(platform)}>{platform === 'XIAOHONGSHU' ? '小红书' : platform === 'BLUESKY' ? 'Bluesky' : platform === 'LINKEDIN' ? 'LinkedIn' : 'X'}</button>)}</div><div className="composer-live"><section className="editor-surface"><h2>{t.content}</h2><PlatformFields content={revision.content} onChange={edit} constraints={capability.constraints} /></section><section className="preview-surface"><h2>{t.preview}</h2><PlatformPreview content={revision.content} /><p>{capability.disclaimer}</p></section></div><section className="schedule-editor"><h2>{t.schedule}</h2><p>{t.scheduleHint}</p><div className="schedule-grid"><label><span>Local wall time</span><input type="datetime-local" value={schedule.localStart} onChange={(event) => setSchedule({...schedule, localStart: event.target.value})} /></label><label><span>IANA time zone</span><input value={schedule.timeZone} onChange={(event) => setSchedule({...schedule, timeZone: event.target.value})} /></label><label><span>Pattern</span><select value={schedule.recurring ? 'rrule' : 'once'} onChange={(event) => setSchedule({...schedule, recurring: event.target.value === 'rrule'})}><option value="once">{t.once}</option><option value="rrule">{t.recurring}</option></select></label><label><span>DST fold</span><select value={schedule.foldPreference} onChange={(event) => setSchedule({...schedule, foldPreference: event.target.value as 'EARLIER' | 'LATER'})}><option value="EARLIER">EARLIER</option><option value="LATER">LATER</option></select></label>{schedule.recurring && <label className="wide"><span>RRULE</span><input value={schedule.rrule} onChange={(event) => setSchedule({...schedule, rrule: event.target.value})} /></label>}</div><button type="button" className="secondary-action" onClick={() => void previewSchedule()}>{t.addSchedule}</button>{scheduleError !== undefined && <code className="error-code">{scheduleError}</code>}{document.publishingSchedules.map((item) => <div className="schedule-row" key={item.id}><strong>{item.kind}</strong><span>{item.localStart} · {item.timeZone}</span><code>{item.status}</code></div>)}</section></>;
}

function PlatformFields({content, onChange, constraints}: {content: PlatformArtifact; onChange: (value: PlatformArtifact) => void; constraints: Record<string, {maxLength?: number; maxItems?: number; required: boolean}>}) {
  const field = (label: string, value: string, key: string, update: (value: string) => PlatformArtifact) => <label><span>{label} <small>{Array.from(value).length}/{constraints[key]?.maxLength ?? '—'}</small></span><textarea value={value} maxLength={constraints[key]?.maxLength} onChange={(event) => onChange(update(event.target.value))} /></label>;
  switch (content.kind) {
    case 'X': return <>{field('Thread post', content.posts[0] ?? '', 'posts', (value) => ({...content, posts: [value]}))}{field('Alt text', content.altText, 'altText', (value) => ({...content, altText: value}))}</>;
    case 'BLUESKY': return <>{field('Post', content.posts[0] ?? '', 'posts', (value) => ({...content, posts: [value]}))}<label><span>Embed URL</span><input value={content.embedUrl} onChange={(event) => onChange({...content, embedUrl: event.target.value})} /></label>{field('Alt text', content.altText, 'altText', (value) => ({...content, altText: value}))}</>;
    case 'LINKEDIN': return <>{field('Commentary', content.commentary, 'commentary', (value) => ({...content, commentary: value}))}<label><span>Link title</span><input value={content.linkTitle} onChange={(event) => onChange({...content, linkTitle: event.target.value})} /></label><label><span>Link URL</span><input value={content.linkUrl} onChange={(event) => onChange({...content, linkUrl: event.target.value})} /></label></>;
    case 'XIAOHONGSHU': return <>{field('标题', content.title, 'title', (value) => ({...content, title: value}))}{field('正文', content.body, 'body', (value) => ({...content, body: value}))}<label><span>话题（逗号分隔）</span><input value={content.topics.join(', ')} onChange={(event) => onChange({...content, topics: event.target.value.split(',').map((item) => item.trim()).filter(Boolean)})} /></label></>;
  }
}

export function PlatformPreview({content}: {content: PlatformArtifact}) {
  const model = platformPreviewModel(content);
  if (content.kind === 'X') return <article className={`native-preview ${model.className}`}><header><span className="avatar">LP</span><strong>LumiClaw Presence</strong><small>@lumiclaw · now</small></header><p>{content.posts[0]}</p><footer>♡　↻　▱　⌁</footer></article>;
  if (content.kind === 'BLUESKY') return <article className={`native-preview ${model.className}`}><header><span className="avatar">LP</span><strong>LumiClaw Presence</strong><small>lumiclaw.bsky.social</small></header><p>{content.posts[0]}</p><div className="embed-card">{content.embedUrl}</div><footer>♡　↻　💬</footer></article>;
  if (content.kind === 'LINKEDIN') return <article className={`native-preview ${model.className}`}><header><span className="avatar">LP</span><strong>LumiClaw Presence</strong><small>Global brand operations · 1m</small></header><p>{content.commentary}</p><div className="linkedin-link"><strong>{content.linkTitle}</strong><small>{content.linkUrl}</small></div><footer>Like　Comment　Repost　Send</footer></article>;
  return <article className={`native-preview ${model.className}`}><div className="xhs-cover"><span>小红书</span><strong>{content.coverLabel}</strong></div><h3>{content.title}</h3><p>{content.body}</p><div className="topics">{content.topics.map((topic) => <span key={topic}>#{topic}</span>)}</div><footer>♡ 收藏　💬 评论</footer></article>;
}

function ReviewPanel({document, envelope, t}: {document: CampaignDocument; envelope: CampaignEnvelope | undefined; t: typeof copy[AppLocale]}) { return <div className="review-grid"><BlockedPanel text={t.reviewHint} />{document.claims.map((claim) => <article className="review-card" key={claim.id}><span>{claim.status}</span><p>{claim.statement}</p><small>{claim.evidenceRefIds.length} EvidenceRef</small></article>)}<article className="review-card digest-card"><span>MissionContract</span><code>{envelope?.digest ?? document.missionContract.sourceDigest}</code><small>SHADOW_PREP_ONLY · externalActionAllowed=false</small></article></div>; }
function BlockedPanel({text}: {text: string}) { return <div className="blocked-panel"><span aria-hidden="true">×</span><p>{text}</p></div>; }
function latestByPlatform(revisions: ArtifactRevision[]) { return new Map(revisions.map((revision) => [revision.platform, revision])); }
function organizationHeaders(id: string) { return {'x-lumiclaw-organization-id': id}; }
async function api<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, {...init, cache: 'no-store'}); const body = await response.json() as T & {code?: string}; if (!response.ok) { const error = new Error(body.code ?? `HTTP_${response.status}`) as ApiFailure; error.status = response.status; if (body.code !== undefined) error.code = body.code; throw error; } return body; }
