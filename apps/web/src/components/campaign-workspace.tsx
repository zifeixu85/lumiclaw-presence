'use client';

import type {AppLocale, RouteId} from '@lumiclaw/i18n';
import type {ArtifactRevision, CampaignDocument, CampaignEnvelope, PlatformArtifact} from '@lumiclaw/domain';
import {useCallback, useEffect, useRef, useState} from 'react';
import {rebaseCampaignDraft} from '@/lib/campaign-rebase';
import {platformPreviewModel} from '@/lib/platform-preview-model';
import {ShadowMissionWorkspace, type ShadowFixtureState} from './shadow-mission-workspace';

export type WorkspaceFixtureState = 'loading' | 'empty' | 'blocked' | 'needs-owner' | 'recovery';
type Phase = WorkspaceFixtureState | 'ready' | 'saving' | 'saved';
type ApiFailure = Error & {status?: number; code?: string; current?: {version: number; digest: string; etag: string}};
type ConflictRecovery = {server: CampaignEnvelope; conflictPaths: string[]};

export const copy = {
  'zh-CN': {
    loading: ['正在读取推广任务…', '从统一控制面读取，不使用浏览器本地副本。'],
    empty: ['还没有保存的推广任务', '下方是公开安全的演示模板；填写后才会写入 PostgreSQL。'],
    blocked: ['当前步骤已安全阻断', '没有真实平台反馈、批准或执行权限；系统不会伪装成已运行。'],
    'needs-owner': ['需要你补全依据', '存在草稿 Claim 或缺少 Evidence；内容可保存和预览，但不能进入执行。'],
    recovery: ['控制面暂时不可用', '请确认本地 API 与 PostgreSQL 已启动，再重试；页面没有伪造成功。'],
    ready: ['已从数据库重新打开', 'Web、API 与 AgentTeams Adapter 绑定同一版本化 Campaign digest。'],
    saving: ['正在保存新版本…', '使用 Idempotency-Key 与 If-Match 防止重复写入和覆盖。'],
    saved: ['新版本已持久化', '摘要、ETag、ArtifactRevision 与排程状态均由服务端确认。'],
    retry: '重试安全操作', rebase: '合并服务器版本并保留本地选择', create: '创建并保存', save: '保存新版本', unsaved: '有未保存修改', savedLabel: '数据库版本', digest: '稳定摘要', noLive: '只保存与预览 · 不发布', schedule: '排程合同', addSchedule: '生成排程预览', scheduleHint: 'IANA 时区；DST gap 会拒绝，fold 必须明确选择。', scheduleSaveFirst: '禁用原因：内容尚未保存。先保存，再把排程绑定到准确 Revision。', scheduleFoldRequired: '禁用原因：该本地时间可能出现 DST 重叠，请先选择 EARLIER 或 LATER。', schedulePreviewing: '禁用原因：正在生成排程预览，请稍候。', claimFutureOnly: 'Claim / Evidence 只约束未来执行：草稿仍可保存、编辑和比较；它不会被误显示成已批准或已发布。', scheduleIndependent: '排程按钮是独立校验：禁用只由“未保存内容 / 未选择 DST fold / 正在预览”决定，不等同于 Claim 阻断。', once: '一次性', recurring: '受约束重复', chooseFold: '请选择', misfire: '错过时间时', brandMatrix: '品牌与市场矩阵', claimEvidence: 'Claim / Evidence', content: '可编辑内容', preview: '原生风格预览', constraints: '公开安全约束', required: '必填', optional: '可选', maximum: '上限', items: '项', noSignals: '尚无真实互动信号。M1 不抓取评论、回复、私信或平台数据。', reviewHint: '这里只展示版本与风险。M1 不创建 OwnerDecision、ActionGrant 或 Receipt。', campaignName: '推广任务名称', objective: '目标', callToAction: '行动引导', contentLanguage: '内容语言', targetMarket: '目标市场', organization: '组织', brand: '品牌', product: '产品', editableDraft: '可编辑草稿', evidenceBound: '证据绑定，只读', localWallTime: '当地时间', timeZone: 'IANA 时区', pattern: '重复方式', dstFold: 'DST 重叠选择', occurrenceCount: '次预览', threadPost: '串文内容', post: '正文', altText: '替代文本', embedUrl: '嵌入链接', commentary: '配文', authorKind: '作者类型', linkTitle: '链接标题', linkUrl: '链接地址', title: '标题', body: '正文', topics: '话题（逗号分隔）', coverLabel: '封面文字', previewAccount: '目标账号', previewIdentity: '表达身份', capabilityAt: '能力快照', executionMode: '执行模式', violations: '约束违规', noViolations: '无', characters: '字符', stalePreview: '排程预览期间内容已变化，请重新生成。'
  },
  en: {
    loading: ['Loading campaign…', 'Reading the shared control plane, never a browser-local business copy.'],
    empty: ['No saved campaign yet', 'The form uses a public-safe demo template and writes only after you create it.'],
    blocked: ['This step is safely blocked', 'There is no live feedback, approval, or execution authority; the UI does not simulate success.'],
    'needs-owner': ['Owner input is required', 'A draft Claim or missing Evidence remains. Content may be saved and previewed but cannot execute.'],
    recovery: ['Control plane unavailable', 'Check the local API and PostgreSQL, then retry. The page has not fabricated success.'],
    ready: ['Reopened from the database', 'Web, API, and the AgentTeams adapter bind the same versioned Campaign digest.'],
    saving: ['Saving a new version…', 'Idempotency-Key and If-Match prevent duplicate writes and lost updates.'],
    saved: ['New version persisted', 'The server confirmed the digest, ETag, ArtifactRevision, and schedule state.'],
    retry: 'Retry safe operation', rebase: 'Merge server version and keep local choices', create: 'Create and save', save: 'Save new version', unsaved: 'Unsaved changes', savedLabel: 'Database version', digest: 'Stable digest', noLive: 'Save and preview only · no publishing', schedule: 'Schedule contract', addSchedule: 'Build schedule preview', scheduleHint: 'IANA time zone; DST gaps fail closed and folds require an explicit choice.', scheduleSaveFirst: 'Disabled: content has unsaved edits. Save first so the schedule binds an exact Revision.', scheduleFoldRequired: 'Disabled: this wall time may overlap at DST. Choose EARLIER or LATER first.', schedulePreviewing: 'Disabled: a schedule preview is already running.', claimFutureOnly: 'Claim / Evidence governs future execution only: drafts remain editable and comparable; they are never shown as approved or published.', scheduleIndependent: 'Schedule availability is a separate check: only unsaved content, missing DST fold, or an active preview disables this button—not a Claim block.', once: 'One-time', recurring: 'Constrained recurring', chooseFold: 'Choose', misfire: 'When time is missed', brandMatrix: 'Brand and market matrix', claimEvidence: 'Claim / Evidence', content: 'Editable content', preview: 'Native-like preview', constraints: 'Public-safe constraints', required: 'required', optional: 'optional', maximum: 'max', items: 'items', noSignals: 'No real interaction signals exist. M1 does not collect comments, replies, DMs, or platform data.', reviewHint: 'This view shows versions and risk only. M1 creates no OwnerDecision, ActionGrant, or Receipt.', campaignName: 'Campaign name', objective: 'Objective', callToAction: 'Call to action', contentLanguage: 'Content language', targetMarket: 'Target market', organization: 'Organization', brand: 'Brand', product: 'Product', editableDraft: 'editable draft', evidenceBound: 'evidence-bound read only', localWallTime: 'Local wall time', timeZone: 'IANA time zone', pattern: 'Pattern', dstFold: 'DST fold choice', occurrenceCount: 'occurrence(s)', threadPost: 'Thread post', post: 'Post', altText: 'Alt text', embedUrl: 'Embed URL', commentary: 'Commentary', authorKind: 'Author kind', linkTitle: 'Link title', linkUrl: 'Link URL', title: 'Title', body: 'Body', topics: 'Topics (comma separated)', coverLabel: 'Cover label', previewAccount: 'Target account', previewIdentity: 'Speaking identity', capabilityAt: 'Capability snapshot', executionMode: 'Execution mode', violations: 'Constraint violations', noViolations: 'none', characters: 'characters', stalePreview: 'Content changed while the schedule preview was loading. Build it again.'
  }
} as const;

export function CampaignWorkspace({locale, routeId, fixtureState}: {locale: AppLocale; routeId: RouteId; fixtureState?: WorkspaceFixtureState | undefined}) {
  const t = copy[locale];
  const [phase, setPhase] = useState<Phase>(fixtureState ?? 'loading');
  const [document, setDocument] = useState<CampaignDocument>();
  const [envelope, setEnvelope] = useState<CampaignEnvelope>();
  const [dirty, setDirty] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const [conflictRecovery, setConflictRecovery] = useState<ConflictRecovery>();
  const [conflictRefreshNeeded, setConflictRefreshNeeded] = useState(false);
  const savingRef = useRef(false);
  const pendingMutationRef = useRef<{fingerprint: string; key: string} | undefined>(undefined);

  const load = useCallback(async () => {
    if (fixtureState !== undefined) return;
    setPhase('loading'); setErrorCode(undefined);
    try {
      const template = await api<{document: CampaignDocument}>('/api/v1/campaigns/demo-template');
      const organizationId = template.document.organizationId;
      const list = await api<{campaigns: {id: string}[]}>('/api/v1/campaigns', {headers: organizationHeaders(organizationId)});
      if (list.campaigns.length === 0) { setDocument(template.document); setEnvelope(undefined); setDirty(false); setConflictRecovery(undefined); setConflictRefreshNeeded(false); pendingMutationRef.current = undefined; setPhase('empty'); return; }
      const reopened = await api<CampaignEnvelope>(`/api/v1/campaigns/${list.campaigns[0]!.id}`, {headers: organizationHeaders(organizationId)});
      setEnvelope(reopened); setDocument(reopened.document); setDirty(false); setConflictRecovery(undefined); setConflictRefreshNeeded(false); pendingMutationRef.current = undefined; setPhase(reopened.readiness === 'BLOCKED' ? 'blocked' : reopened.readiness === 'NEEDS_OWNER' ? 'needs-owner' : 'ready');
    } catch (error) { const failure = error as ApiFailure; setErrorCode(failure.code); setPhase('recovery'); }
  }, [fixtureState]);

  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  const update = useCallback((next: CampaignDocument) => {
    setDocument(next); setDirty(true);
    if (conflictRecovery !== undefined && envelope !== undefined) {
      const rebased = rebaseCampaignDraft(envelope.document, next, conflictRecovery.server.document);
      setConflictRecovery({server: conflictRecovery.server, conflictPaths: rebased.conflictPaths});
      setErrorCode(`CAMPAIGN_VERSION_CONFLICT · v${conflictRecovery.server.version} · ${conflictRecovery.server.digest.slice(0, 12)}… · ${rebased.conflictPaths.length} conflict(s)`);
      setPhase('blocked');
      return;
    }
    if (conflictRefreshNeeded) { setPhase('blocked'); return; }
    setPhase(next.claims.some((claim) => claim.status !== 'APPROVED') ? 'needs-owner' : 'ready');
  }, [conflictRecovery, conflictRefreshNeeded, envelope]);

  const persist = useCallback(async () => {
    if (document === undefined || savingRef.current) return;
    savingRef.current = true;
    const fingerprint = JSON.stringify(document);
    const pending = pendingMutationRef.current;
    const idempotencyKey = pending?.fingerprint === fingerprint ? pending.key : `web-${crypto.randomUUID()}`;
    pendingMutationRef.current = {fingerprint, key: idempotencyKey};
    setPhase('saving'); setErrorCode(undefined);
    try {
      const isCreate = envelope === undefined;
      const next = await api<CampaignEnvelope>(isCreate ? '/api/v1/campaigns' : `/api/v1/campaigns/${document.id}`, {
        method: isCreate ? 'POST' : 'PUT',
        headers: {...organizationHeaders(document.organizationId), 'content-type': 'application/json', 'idempotency-key': idempotencyKey, ...(isCreate ? {} : {'if-match': envelope.etag})},
        body: JSON.stringify(document)
      });
      setEnvelope(next); setDocument(next.document); setDirty(false); setConflictRecovery(undefined); setConflictRefreshNeeded(false); setPhase('saved');
      pendingMutationRef.current = undefined;
    } catch (error) {
      const failure = error as ApiFailure;
      const conflict = failure.current;
      if (failure.status === 412 && envelope !== undefined) {
        pendingMutationRef.current = undefined;
        setConflictRefreshNeeded(true);
        try {
          const server = await api<CampaignEnvelope>(`/api/v1/campaigns/${document.id}`, {headers: organizationHeaders(document.organizationId)});
          const rebased = rebaseCampaignDraft(envelope.document, document, server.document);
          setConflictRecovery({server, conflictPaths: rebased.conflictPaths});
          setConflictRefreshNeeded(false);
          setErrorCode(`${failure.code ?? 'CAMPAIGN_VERSION_CONFLICT'} · v${server.version} · ${server.digest.slice(0, 12)}… · ${rebased.conflictPaths.length} conflict(s)`);
          setPhase('blocked');
        } catch (refreshError) {
          setErrorCode((refreshError as ApiFailure).code ?? 'CONFLICT_REFRESH_FAILED');
          setPhase('blocked');
        }
      } else {
        if (failure.status === 422) pendingMutationRef.current = undefined;
        setErrorCode(conflict === undefined ? failure.code : `${failure.code} · v${conflict.version} · ${conflict.digest.slice(0, 12)}…`);
        setPhase(failure.status === 422 ? 'blocked' : 'recovery');
      }
    }
    finally { savingRef.current = false; }
  }, [document, envelope]);

  const recover = useCallback(() => {
    if (conflictRecovery !== undefined) {
      if (envelope === undefined || document === undefined) return;
      const rebased = rebaseCampaignDraft(envelope.document, document, conflictRecovery.server.document);
      setEnvelope(conflictRecovery.server);
      setDocument(rebased.document);
      setDirty(true);
      setConflictRecovery(undefined);
      setConflictRefreshNeeded(false);
      setErrorCode(undefined);
      setPhase('ready');
    } else if (conflictRefreshNeeded && envelope !== undefined && document !== undefined) {
      void (async () => {
        try {
          const server = await api<CampaignEnvelope>(`/api/v1/campaigns/${document.id}`, {headers: organizationHeaders(document.organizationId)});
          const rebased = rebaseCampaignDraft(envelope.document, document, server.document);
          setConflictRecovery({server, conflictPaths: rebased.conflictPaths});
          setConflictRefreshNeeded(false);
          setErrorCode(`CAMPAIGN_VERSION_CONFLICT · v${server.version} · ${server.digest.slice(0, 12)}… · ${rebased.conflictPaths.length} conflict(s)`);
        } catch (refreshError) { setErrorCode((refreshError as ApiFailure).code ?? 'CONFLICT_REFRESH_FAILED'); }
      })();
    } else if (pendingMutationRef.current !== undefined && document !== undefined) void persist();
    else void load();
  }, [conflictRecovery, conflictRefreshNeeded, document, envelope, load, persist]);

  if (fixtureState !== undefined && (routeId === 'mission' || routeId === 'review')) return <ShadowMissionWorkspace locale={locale} route={routeId} fixtureState={shadowFixture(fixtureState)} />;
  if (fixtureState !== undefined) return <StatePanel phase={fixtureState} t={t} errorCode={undefined} onRetry={() => undefined} />;
  if (phase === 'loading' || phase === 'recovery') return <StatePanel phase={phase} t={t} errorCode={errorCode} onRetry={recover} />;
  if (document === undefined) return <StatePanel phase="recovery" t={t} errorCode={undefined} onRetry={() => void load()} />;

  return (
    <section className="campaign-control" aria-label="Campaign control plane">
      <StatePanel phase={phase} t={t} errorCode={errorCode} onRetry={recover} retryLabel={conflictRecovery === undefined ? undefined : t.rebase} retryable={conflictRecovery !== undefined || conflictRefreshNeeded} compact />
      <div className="campaign-meta">
        <span>{t.noLive}</span>
        {envelope !== undefined && <><span>{t.savedLabel} <strong>v{envelope.version}</strong></span><span className="digest-label">{t.digest} <code>{envelope.digest.slice(0, 12)}…</code></span></>}
        {dirty && <strong className="dirty-label">{t.unsaved}</strong>}
      </div>
      {routeId === 'campaigns' && <CampaignForm document={document} onChange={update} t={t} />}
      {routeId === 'setup' && <SetupEditor document={document} onChange={update} t={t} />}
      {(routeId === 'mission' || routeId === 'review') && <div className="governance-boundaries"><article><span>CLAIM / EVIDENCE</span><p>{t.claimFutureOnly}</p></article><article><span>SCHEDULE DRAFT</span><p>{t.scheduleIndependent}</p></article></div>}
      {routeId === 'mission' && <><ShadowMissionWorkspace locale={locale} route="mission" {...(envelope === undefined ? {} : {campaign: envelope})} /><details className="m1-editor-disclosure"><summary>{t.content} / {t.schedule}</summary><Composer document={document} dirty={dirty} onChange={update} t={t} /></details></>}
      {routeId === 'review' && <ShadowMissionWorkspace locale={locale} route="review" {...(envelope === undefined ? {} : {campaign: envelope})} />}
      {routeId === 'learn' && <BlockedPanel text={t.noSignals} />}
      {(routeId === 'campaigns' || routeId === 'setup' || routeId === 'mission') && <button className="primary-action" type="button" onClick={() => void persist()} disabled={phase === 'saving' || conflictRefreshNeeded || (envelope !== undefined && !dirty)}>{envelope === undefined ? t.create : t.save}</button>}
    </section>
  );
}

function StatePanel({phase, t, errorCode, onRetry, compact = false, retryable = true, retryLabel}: {phase: Phase; t: typeof copy[AppLocale]; errorCode: string | undefined; onRetry: () => void; compact?: boolean; retryable?: boolean; retryLabel?: string | undefined}) {
  const [title, description] = t[phase];
  return <div className={`control-state state-${phase}${compact ? ' compact' : ''}`} role={phase === 'recovery' || phase === 'blocked' ? 'alert' : 'status'}><span className="state-pulse" aria-hidden="true"/><div><strong>{title}</strong><p>{description}</p>{errorCode !== undefined && <code>{errorCode}</code>}</div>{retryable && (phase === 'recovery' || (phase === 'blocked' && errorCode !== undefined)) && <button type="button" onClick={onRetry}>{retryLabel ?? t.retry}</button>}</div>;
}

function CampaignForm({document, onChange, t}: {document: CampaignDocument; onChange: (value: CampaignDocument) => void; t: typeof copy[AppLocale]}) {
  const setBrief = (key: 'name' | 'objective' | 'callToAction', value: string) => { const next = structuredClone(document); next.brief[key] = value; onChange(next); };
  return <div className="editor-surface form-grid"><label><span>{t.campaignName}</span><input value={document.brief.name} maxLength={120} onChange={(event) => setBrief('name', event.target.value)} /></label><label className="wide"><span>{t.objective}</span><textarea value={document.brief.objective} maxLength={2000} onChange={(event) => setBrief('objective', event.target.value)} /></label><label className="wide"><span>{t.callToAction}</span><textarea value={document.brief.callToAction} maxLength={500} onChange={(event) => setBrief('callToAction', event.target.value)} /></label><label><span>{t.contentLanguage}</span><select value={document.brief.contentLanguage} onChange={(event) => { const next = structuredClone(document); next.brief.contentLanguage = event.target.value as 'en' | 'zh-CN'; onChange(next); }}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label><label><span>{t.targetMarket}</span><input value={document.graph.markets.map((market) => market.code).join(', ')} readOnly /></label></div>;
}

function SetupEditor({document, onChange, t}: {document: CampaignDocument; onChange: (value: CampaignDocument) => void; t: typeof copy[AppLocale]}) {
  return <div className="setup-grid"><section className="editor-surface"><h2>{t.brandMatrix}</h2><label><span>{t.organization}</span><input value={document.graph.organization.displayName} onChange={(event) => { const next = structuredClone(document); next.graph.organization.displayName = event.target.value; onChange(next); }} /></label><label><span>{t.brand}</span><input value={document.graph.brands[0]!.name} onChange={(event) => { const next = structuredClone(document); next.graph.brands[0]!.name = event.target.value; onChange(next); }} /></label><label><span>{t.product}</span><input value={document.graph.products[0]!.name} onChange={(event) => { const next = structuredClone(document); next.graph.products[0]!.name = event.target.value; onChange(next); }} /></label><div className="tag-row">{document.graph.markets.map((market) => <span key={market.id}>{market.code} · {market.primaryLanguage}</span>)}</div></section><section className="editor-surface"><h2>{t.claimEvidence}</h2>{document.claims.map((claim) => <article className="claim-card" key={claim.id}><span className={`claim-status status-${claim.status.toLowerCase()}`}>{claim.status}</span><textarea value={claim.statement} readOnly={claim.status !== 'DRAFT'} onChange={(event) => { if (claim.status !== 'DRAFT') return; const next = structuredClone(document); next.claims.find((item) => item.id === claim.id)!.statement = event.target.value; onChange(next); }} /><small>{claim.evidenceRefIds.length} EvidenceRef · {claim.effectiveUntil.slice(0, 10)} · {claim.status === 'DRAFT' ? t.editableDraft : t.evidenceBound}</small></article>)}</section></div>;
}

function Composer({document, dirty, onChange, t}: {document: CampaignDocument; dirty: boolean; onChange: (value: CampaignDocument) => void; t: typeof copy[AppLocale]}) {
  const [selected, setSelected] = useState<ArtifactRevision['platform']>('X');
  const [schedule, setSchedule] = useState<{localStart: string; timeZone: string; recurring: boolean; rrule: string; foldPreference: '' | 'EARLIER' | 'LATER'; misfirePolicy: 'SKIP' | 'HOLD_FOR_OWNER'}>({localStart: '2026-11-01T01:30', timeZone: 'America/New_York', recurring: false, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=3', foldPreference: '', misfirePolicy: 'HOLD_FOR_OWNER'});
  const [scheduleError, setScheduleError] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const currentDocumentRef = useRef(document);
  useEffect(() => { currentDocumentRef.current = document; }, [document]);
  const revision = latestByPlatform(document.artifactRevisions).get(selected)!;
  const capability = document.capabilitySnapshots.find((item) => item.id === revision.capabilitySnapshotId)!;
  const unit = document.activationPlan.units.find((item) => item.id === revision.activationUnitId)!;
  const account = document.graph.channelAccounts.find((item) => item.id === unit.channelAccountId)!;
  const identity = document.graph.identities.find((item) => item.id === unit.identityId)!;
  const previewContext: PreviewContext = {accountHandle: account.displayHandle, identityName: identity.displayName, capturedAt: capability.capturedAt, executionMode: capability.executionMode, violations: constraintViolations(revision.content, capability.constraints)};
  const edit = (content: PlatformArtifact) => { const next = structuredClone(document); const target = next.artifactRevisions.find((item) => item.id === revision.id)!; target.content = content; onChange(next); };
  const previewSchedule = async () => {
    if (schedule.foldPreference === '') { setScheduleError('FOLD_PREFERENCE_REQUIRED'); return; }
    const requestedDocument = document;
    setPreviewing(true);
    try {
      setScheduleError(undefined);
      const value = await api<{schedule: CampaignDocument['publishingSchedules'][number]; occurrences: CampaignDocument['scheduleOccurrences']}>(`/api/v1/campaigns/${document.id}/schedule-preview`, {method: 'POST', headers: {...organizationHeaders(document.organizationId), 'content-type': 'application/json'}, body: JSON.stringify({localStart: schedule.localStart, timeZone: schedule.timeZone, rrule: schedule.recurring ? schedule.rrule : null, foldPreference: schedule.foldPreference, misfirePolicy: schedule.misfirePolicy})});
      if (currentDocumentRef.current !== requestedDocument) { setScheduleError(t.stalePreview); return; }
      const next = structuredClone(document); next.publishingSchedules.push(value.schedule); next.scheduleOccurrences.push(...value.occurrences); onChange(next);
    } catch (error) { setScheduleError((error as ApiFailure).code ?? 'SCHEDULE_PREVIEW_FAILED'); }
    finally { setPreviewing(false); }
  };
  const disabledReason = dirty ? t.scheduleSaveFirst : schedule.foldPreference === '' ? t.scheduleFoldRequired : previewing ? t.schedulePreviewing : undefined;
  return <><div className="platform-tabs" role="tablist" aria-label={t.content}>{(['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'] as const).map((platform) => <button key={platform} type="button" role="tab" aria-selected={selected === platform} onClick={() => setSelected(platform)}>{platform === 'XIAOHONGSHU' ? '小红书' : platform === 'BLUESKY' ? 'Bluesky' : platform === 'LINKEDIN' ? 'LinkedIn' : 'X'}</button>)}</div><div className="composer-live"><section className="editor-surface"><h2>{t.content}</h2><PlatformFields content={revision.content} onChange={edit} constraints={capability.constraints} t={t} /></section><section className="preview-surface"><h2>{t.preview}</h2><PlatformPreview content={revision.content} context={previewContext} t={t} /><p>{capability.disclaimer}</p><div className="constraint-list"><strong>{t.constraints}</strong>{Object.entries(capability.constraints).map(([name, rule]) => <code key={name}>{name}: {rule.required ? t.required : t.optional}{rule.maxLength === undefined ? '' : ` · ${t.maximum} ${rule.maxLength}`}{rule.maxItems === undefined ? '' : ` · ${t.items} ${rule.maxItems}`}</code>)}</div></section></div><section className="schedule-editor"><h2>{t.schedule}</h2><p>{t.scheduleHint}</p><div className="schedule-grid"><label><span>{t.localWallTime}</span><input type="datetime-local" value={schedule.localStart} onChange={(event) => setSchedule({...schedule, localStart: event.target.value})} /></label><label><span>{t.timeZone}</span><input value={schedule.timeZone} onChange={(event) => setSchedule({...schedule, timeZone: event.target.value})} /></label><label><span>{t.pattern}</span><select value={schedule.recurring ? 'rrule' : 'once'} onChange={(event) => setSchedule({...schedule, recurring: event.target.value === 'rrule'})}><option value="once">{t.once}</option><option value="rrule">{t.recurring}</option></select></label><label><span>{t.dstFold}</span><select value={schedule.foldPreference} onChange={(event) => setSchedule({...schedule, foldPreference: event.target.value as '' | 'EARLIER' | 'LATER'})}><option value="">{t.chooseFold}</option><option value="EARLIER">EARLIER</option><option value="LATER">LATER</option></select></label><label><span>{t.misfire}</span><select value={schedule.misfirePolicy} onChange={(event) => setSchedule({...schedule, misfirePolicy: event.target.value as 'SKIP' | 'HOLD_FOR_OWNER'})}><option value="SKIP">SKIP</option><option value="HOLD_FOR_OWNER">HOLD_FOR_OWNER</option></select></label>{schedule.recurring && <label className="wide"><span>RRULE</span><input value={schedule.rrule} onChange={(event) => setSchedule({...schedule, rrule: event.target.value})} /></label>}</div><button type="button" className="secondary-action" aria-describedby={disabledReason === undefined ? undefined : 'schedule-disabled-reason'} disabled={disabledReason !== undefined} onClick={() => void previewSchedule()}>{t.addSchedule}</button>{disabledReason !== undefined && <small id="schedule-disabled-reason" className="schedule-save-first">{disabledReason}</small>}{scheduleError !== undefined && <code className="error-code">{scheduleError}</code>}{document.publishingSchedules.map((item) => { const occurrences = document.scheduleOccurrences.filter((occurrence) => occurrence.scheduleId === item.id).sort((left, right) => left.ordinal - right.ordinal); const first = occurrences[0]; return <div className="schedule-row" key={item.id}><strong>{item.kind}</strong><span>{item.localStart} · {item.timeZone} → {first?.scheduledForUtc ?? '—'}</span><small>{item.foldPreference} · UTC{formatOffset(first?.utcOffsetMinutes)} · {item.misfirePolicy} · {occurrences.length} {t.occurrenceCount}</small><code>{item.status}</code></div>; })}</section></>;
}

function shadowFixture(state: WorkspaceFixtureState): ShadowFixtureState { return ({loading: 'running', empty: 'empty', blocked: 'audit-blocked', 'needs-owner': 'needs-owner', recovery: 'unknown-recovery'} as const)[state]; }

function PlatformFields({content, onChange, constraints, t}: {content: PlatformArtifact; onChange: (value: PlatformArtifact) => void; constraints: Record<string, {maxLength?: number; maxItems?: number; required: boolean}>; t: typeof copy[AppLocale]}) {
  const field = (label: string, value: string, key: string, update: (value: string) => PlatformArtifact) => <label><span>{label} <small>{Array.from(value).length}/{constraints[key]?.maxLength ?? '—'} {t.characters}</small></span><textarea value={value} maxLength={constraints[key]?.maxLength} onChange={(event) => onChange(update(event.target.value))} /></label>;
  switch (content.kind) {
    case 'X': return <>{field(t.threadPost, content.posts[0] ?? '', 'posts', (value) => ({...content, posts: [value, ...content.posts.slice(1)]}))}{field(t.altText, content.altText, 'altText', (value) => ({...content, altText: value}))}</>;
    case 'BLUESKY': return <>{field(t.post, content.posts[0] ?? '', 'posts', (value) => ({...content, posts: [value, ...content.posts.slice(1)]}))}<label><span>{t.embedUrl}</span><input value={content.embedUrl} onChange={(event) => onChange({...content, embedUrl: event.target.value})} /></label>{field(t.altText, content.altText, 'altText', (value) => ({...content, altText: value}))}</>;
    case 'LINKEDIN': return <>{field(t.commentary, content.commentary, 'commentary', (value) => ({...content, commentary: value}))}<label><span>{t.authorKind}</span><select value={content.authorKind} onChange={(event) => onChange({...content, authorKind: event.target.value as 'PERSON' | 'COMPANY'})}><option value="PERSON">PERSON</option><option value="COMPANY">COMPANY</option></select></label><label><span>{t.linkTitle}</span><input value={content.linkTitle} onChange={(event) => onChange({...content, linkTitle: event.target.value})} /></label><label><span>{t.linkUrl}</span><input value={content.linkUrl} onChange={(event) => onChange({...content, linkUrl: event.target.value})} /></label></>;
    case 'XIAOHONGSHU': return <>{field(t.title, content.title, 'title', (value) => ({...content, title: value}))}{field(t.body, content.body, 'body', (value) => ({...content, body: value}))}<label><span>{t.topics}</span><input value={content.topics.join(', ')} onChange={(event) => onChange({...content, topics: event.target.value.split(',').map((item) => item.trim()).filter(Boolean)})} /></label>{field(t.coverLabel, content.coverLabel, 'coverLabel', (value) => ({...content, coverLabel: value}))}</>;
  }
}

export type PreviewContext = {accountHandle: string; identityName: string; capturedAt: string; executionMode: string; violations: string[]};

export function PlatformPreview({content, context, t}: {content: PlatformArtifact; context: PreviewContext; t: typeof copy[AppLocale]}) {
  const model = platformPreviewModel(content);
  const metadata = <PreviewMetadata context={context} t={t} />;
  if (content.kind === 'X') return <article className={`native-preview ${model.className}`}><header><span className="avatar">LP</span><strong>{context.identityName}</strong><small>{context.accountHandle}</small></header>{content.posts.map((post, index) => <p key={`${index}-${post}`}>{post}</p>)}<footer>♡　↻　▱　⌁</footer>{metadata}</article>;
  if (content.kind === 'BLUESKY') return <article className={`native-preview ${model.className}`}><header><span className="avatar">LP</span><strong>{context.identityName}</strong><small>{context.accountHandle}</small></header>{content.posts.map((post, index) => <p key={`${index}-${post}`}>{post}</p>)}<div className="embed-card">{content.embedUrl}</div><footer>♡　↻　💬</footer>{metadata}</article>;
  if (content.kind === 'LINKEDIN') return <article className={`native-preview ${model.className}`}><header><span className="avatar">LP</span><strong>{context.identityName}</strong><small>{context.accountHandle} · {content.authorKind}</small></header><p>{content.commentary}</p><span className="see-more">…see more</span><div className="linkedin-link"><strong>{content.linkTitle}</strong><small>{content.linkUrl}</small></div><footer>Like　Comment　Repost　Send</footer>{metadata}</article>;
  return <article className={`native-preview ${model.className}`}><div className="xhs-cover"><span>小红书</span><strong>{content.coverLabel}</strong></div><h3>{content.title}</h3><p>{content.body}</p><div className="topics">{content.topics.map((topic) => <span key={topic}>#{topic}</span>)}</div><footer>♡ 收藏　💬 评论</footer>{metadata}</article>;
}

function PreviewMetadata({context, t}: {context: PreviewContext; t: typeof copy[AppLocale]}) { return <dl className="preview-metadata"><div><dt>{t.previewAccount}</dt><dd>{context.accountHandle}</dd></div><div><dt>{t.previewIdentity}</dt><dd>{context.identityName}</dd></div><div><dt>{t.capabilityAt}</dt><dd>{context.capturedAt}</dd></div><div><dt>{t.executionMode}</dt><dd>{context.executionMode}</dd></div><div><dt>{t.violations}</dt><dd>{context.violations.length === 0 ? t.noViolations : context.violations.join(', ')}</dd></div></dl>; }

function BlockedPanel({text}: {text: string}) { return <div className="blocked-panel"><span aria-hidden="true">×</span><p>{text}</p></div>; }
function constraintViolations(content: PlatformArtifact, constraints: Record<string, {maxLength?: number; maxItems?: number; required: boolean}>): string[] {
  const fields: Record<string, string | string[]> = content.kind === 'X'
    ? {posts: content.posts, altText: content.altText}
    : content.kind === 'BLUESKY'
      ? {posts: content.posts, embedUrl: content.embedUrl, altText: content.altText}
      : content.kind === 'LINKEDIN'
        ? {commentary: content.commentary, linkTitle: content.linkTitle, linkUrl: content.linkUrl}
        : {title: content.title, body: content.body, topics: content.topics, coverLabel: content.coverLabel};
  return Object.entries(constraints).flatMap(([name, rule]) => {
    const value = fields[name];
    if (rule.required && (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))) return [`${name}:required`];
    if (rule.maxItems !== undefined && Array.isArray(value) && value.length > rule.maxItems) return [`${name}:maxItems`];
    if (rule.maxLength !== undefined && typeof value === 'string' && Array.from(value).length > rule.maxLength) return [`${name}:maxLength`];
    if (rule.maxLength !== undefined && Array.isArray(value) && value.some((item) => Array.from(item).length > rule.maxLength!)) return [`${name}:maxLength`];
    return [];
  });
}
function formatOffset(value: number | undefined): string { if (value === undefined) return '—'; const sign = value >= 0 ? '+' : '-'; const absolute = Math.abs(value); return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`; }
function latestByPlatform(revisions: ArtifactRevision[]) { return new Map(revisions.map((revision) => [revision.platform, revision])); }
function organizationHeaders(id: string) { return {'x-lumiclaw-organization-id': id}; }
async function api<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, {...init, cache: 'no-store'}); const body = await response.json() as T & {code?: string; current?: {version: number; digest: string; etag: string}}; if (!response.ok) { const error = new Error(body.code ?? `HTTP_${response.status}`) as ApiFailure; error.status = response.status; if (body.code !== undefined) error.code = body.code; if (body.current !== undefined) error.current = body.current; throw error; } return body; }
