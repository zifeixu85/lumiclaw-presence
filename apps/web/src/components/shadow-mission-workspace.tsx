'use client';

import type {CampaignEnvelope, PlatformArtifact} from '@lumiclaw/domain';
import type {AppLocale} from '@lumiclaw/i18n';
import {useCallback, useEffect, useState} from 'react';

export type ShadowFixtureState = 'empty' | 'prerequisite-blocked' | 'queued' | 'running' | 'waiting-dependency' | 'needs-owner' | 'failed' | 'timed-out' | 'cancelled' | 'unknown-recovery' | 'audit-blocked' | 'revision-required' | 'shadow-complete';
type Role = {roleId: string; identityId: string; responsibility: string; permissions: string[]; orchestrationOnly: boolean; contextDigest: string};
type Task = {id: string; roleId: string; state: string; prerequisiteTaskIds: string[]; acceptedOutputDigest: string | null};
type Revision = {id: string; platform: string; revision: number; digest: string; parentRevisionId: string | null; producerRoleId: string; content: PlatformArtifact};
type Audit = {id: string; revisionId: string; outcome: 'PASS' | 'FAIL' | 'ESCALATE'; status: 'ACTIVE' | 'INVALIDATED'; issues: {code: string; message: string; evidenceRefIds: string[]; nextResponsibleRoleId: string}[]};
type Review = {revisionId: string; authority: 'NON_EXECUTABLE_OWNER_REVIEW'; createsActionGrant: false; decision: string};
type Trace = {sequence: number; kind: string; businessLabel: string; detail: Record<string, string | number | boolean | null>; createdAt: string};
type UiMission = {id: string; state: string; etag: string; runtimeVersion: 'v1.2.0'; sourceCampaignDigest: string; externalActionAllowed: false; actionGrantCount: 0; connectorCount: 0; externalActionCount: 0; roleContexts: Role[]; tasks: Task[]; revisions: Revision[]; audits: Audit[]; reviews: Review[]; trace: Trace[]; fault: {deniedRevisionId: string | null; correctedRevisionId: string | null; injectedPath: string}};
type ApiError = Error & {code?: string};

const text = {
  'zh-CN': {
    eyebrow: 'GOVERNED SHADOW / NOT_LIVE', title: '六个角色，一条可核验的内容生产线。', subtitle: '你看到的是业务进度；任务 digest、模型快照与 runtime trace 按需展开。这里没有发布能力。',
    start: '启动六成员 SHADOW', run: '运行公开安全故障演练', running: '正在协调六个角色…', retry: '重新读取控制面',
    noMission: '尚未启动 Mission', noMissionDetail: '先保存 M1 Campaign；系统会固定当前 Campaign digest，再创建六个独立成员。', prereq: 'Campaign 前置条件未满足',
    roster: '责任分工', flow: '任务流', evidence: '证据抽屉', evidenceHint: '只展示 allowlist 字段与 digest；不展示 prompt、Key、Cookie 或原始 Matrix 消息。',
    reviewTitle: '审计台', reviewLead: '先看被拒绝的说法，再比较修正版。Auditor 只能给决定，不能替你改内容。', exactReview: '记录精确 Owner Review', reviewed: '已记录（不可执行）', changes: '修正差异',
    fail: '拒绝', pass: '通过', invalidated: '已失效', nextRole: '下一责任角色', boundEvidence: '绑定 Evidence', noGrant: 'Owner Review ≠ ActionGrant', noGrantDetail: '该确认只绑定 Revision digest 与账号意图；不会创建 Grant、连接器、排程执行或发布动作。',
    truth: '边界检查', trace: '逐条 trace / ledger', source: 'Campaign digest', team: '6 MEMBERS', version: 'AgentTeams v1.2.0', mock: '按钮运行的是公开安全 MOCK_CONFORMANCE；真实 AgentTeams 验收证据单独标注。',
    states: {QUEUED: '已排队', RUNNING: '运行中', WAITING_DEPENDENCY: '等待前置任务', NEEDS_OWNER_REVIEW: '等待 Owner 精确确认', FAILED: '失败', TIMED_OUT: '已超时', CANCELLED: '已取消', UNKNOWN_RECOVERY: '状态未知，正在恢复', AUDIT_BLOCKED: '审计阻断', REVISION_REQUIRED: '需要修订', SHADOW_COMPLETE: 'SHADOW 已完成'}
  },
  en: {
    eyebrow: 'GOVERNED SHADOW / NOT_LIVE', title: 'Six roles. One reviewable production line.', subtitle: 'Business progress first; task digests, model snapshots, and runtime trace stay progressively disclosed. There is no publishing capability.',
    start: 'Start six-member SHADOW', run: 'Run public-safe fault flight', running: 'Coordinating six roles…', retry: 'Reload control plane',
    noMission: 'No Mission has started', noMissionDetail: 'Save the M1 Campaign first. The system freezes its exact digest before creating six distinct members.', prereq: 'Campaign prerequisites are incomplete',
    roster: 'Responsibility map', flow: 'Task flow', evidence: 'Evidence drawer', evidenceHint: 'Only allowlisted fields and digests appear—never prompts, keys, cookies, or raw Matrix messages.',
    reviewTitle: 'Audit desk', reviewLead: 'Inspect the rejected claim first, then compare the correction. The Auditor decides but cannot edit.', exactReview: 'Record exact Owner Review', reviewed: 'Recorded (non-executable)', changes: 'Revision changes',
    fail: 'Denied', pass: 'Pass', invalidated: 'Invalidated', nextRole: 'Next responsible role', boundEvidence: 'Bound Evidence', noGrant: 'Owner Review ≠ ActionGrant', noGrantDetail: 'This intent binds a Revision digest and account. It creates no Grant, connector, due execution, or publishing action.',
    truth: 'Boundary check', trace: 'Trace / ledger events', source: 'Campaign digest', team: '6 MEMBERS', version: 'AgentTeams v1.2.0', mock: 'This button runs public-safe MOCK_CONFORMANCE. Real AgentTeams acceptance evidence is labeled separately.',
    states: {QUEUED: 'Queued', RUNNING: 'Running', WAITING_DEPENDENCY: 'Waiting for dependency', NEEDS_OWNER_REVIEW: 'Exact Owner review needed', FAILED: 'Failed', TIMED_OUT: 'Timed out', CANCELLED: 'Cancelled', UNKNOWN_RECOVERY: 'Unknown; recovering', AUDIT_BLOCKED: 'Audit blocked', REVISION_REQUIRED: 'Revision required', SHADOW_COMPLETE: 'SHADOW complete'}
  }
} as const;

export function ShadowMissionWorkspace({locale, route, campaign, fixtureState}: {locale: AppLocale; route: 'mission' | 'review'; campaign?: CampaignEnvelope; fixtureState?: ShadowFixtureState}) {
  const t = text[locale]; const [mission, setMission] = useState<UiMission | undefined>(() => fixtureState === undefined ? undefined : fixtureMission(fixtureState));
  const [phase, setPhase] = useState<'loading' | 'ready' | 'working' | 'error'>(fixtureState === undefined ? 'loading' : 'ready'); const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    if (fixtureState !== undefined || campaign === undefined) { setPhase('ready'); return; }
    setPhase('loading');
    try { const response = await api<{missions: UiMission[]}>(`/api/v1/campaigns/${campaign.document.id}/shadow-missions`, {headers: orgHeaders(campaign.document.organizationId)}); setMission(response.missions[0]); setPhase('ready'); setError(undefined); }
    catch (failure) { setError((failure as ApiError).code ?? 'CONTROL_PLANE_UNAVAILABLE'); setPhase('error'); }
  }, [campaign, fixtureState]);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);

  const start = useCallback(async () => {
    if (campaign === undefined) return; setPhase('working');
    try { const response = await api<{mission: UiMission}>(`/api/v1/campaigns/${campaign.document.id}/shadow-missions`, {method: 'POST', headers: {...orgHeaders(campaign.document.organizationId), 'content-type': 'application/json', 'idempotency-key': `web-shadow-${crypto.randomUUID()}`, 'if-match': campaign.etag}, body: JSON.stringify({sourceDigest: campaign.digest, fault: 'BETA_TO_GA'})}); setMission(response.mission); setPhase('ready'); }
    catch (failure) { setError((failure as ApiError).code); setPhase('error'); }
  }, [campaign]);
  const run = useCallback(async () => {
    if (campaign === undefined || mission === undefined) return; setPhase('working');
    try { const response = await api<{mission: UiMission}>(`/api/v1/shadow-missions/${mission.id}/public-safe-flight`, {method: 'POST', headers: {...orgHeaders(campaign.document.organizationId), 'idempotency-key': `web-flight-${crypto.randomUUID()}`, 'if-match': mission.etag}}); setMission(response.mission); setPhase('ready'); }
    catch (failure) { setError((failure as ApiError).code); setPhase('error'); }
  }, [campaign, mission]);
  const review = useCallback(async (revision: Revision) => {
    if (campaign === undefined || mission === undefined) return; setPhase('working');
    try { const response = await api<{mission: UiMission}>(`/api/v1/shadow-missions/${mission.id}/owner-reviews`, {method: 'POST', headers: {...orgHeaders(campaign.document.organizationId), 'content-type': 'application/json', 'idempotency-key': `web-review-${crypto.randomUUID()}`, 'if-match': mission.etag}, body: JSON.stringify({revisionId: revision.id, revisionDigest: revision.digest, decision: 'READY_FOR_FUTURE_EXECUTION'})}); setMission(response.mission); setPhase('ready'); }
    catch (failure) { setError((failure as ApiError).code); setPhase('error'); }
  }, [campaign, mission]);

  if (phase === 'loading') return <MissionEmpty title={t.running} detail={t.subtitle} state="RUNNING" />;
  if (phase === 'error') return <MissionEmpty title={t.states.FAILED} detail={error ?? 'CONTROL_PLANE_UNAVAILABLE'} state="FAILED"><button className="shadow-button" type="button" onClick={() => void load()}>{t.retry}</button></MissionEmpty>;
  if (campaign === undefined && fixtureState === undefined) return <MissionEmpty title={t.prereq} detail={t.noMissionDetail} state="PREREQUISITE_BLOCKED" />;
  if (mission === undefined) return <MissionEmpty title={t.noMission} detail={t.noMissionDetail} state="EMPTY"><button className="shadow-button" type="button" onClick={() => void start()}>{t.start}</button></MissionEmpty>;
  return route === 'review' ? <ReviewDesk mission={mission} t={t} working={phase === 'working'} onReview={review} /> : <MissionBoard mission={mission} t={t} working={phase === 'working'} onRun={run} />;
}

function MissionBoard({mission, t, working, onRun}: {mission: UiMission; t: typeof text[AppLocale]; working: boolean; onRun: () => void}) {
  return <section className="shadow-console" aria-label="Governed SHADOW Mission">
    <header className="shadow-console-head"><div><p>{t.eyebrow}</p><h2>{t.title}</h2><span>{t.subtitle}</span></div><div className="mission-pulse"><i /><strong>{stateLabel(mission.state, t)}</strong><small>{mission.externalActionAllowed ? 'UNSAFE' : 'NO EXTERNAL ACTION'}</small></div></header>
    <div className="mission-facts"><span>{t.team}</span><span>{t.version}</span><span>{t.source} <code>{mission.sourceCampaignDigest.slice(0, 12)}…</code></span></div>
    <section className="roster-section"><div className="section-label"><span>01</span><h3>{t.roster}</h3></div><div className="role-roster">{mission.roleContexts.map((role, index) => <article className={role.roleId === 'independent-auditor' ? 'role-card auditor' : 'role-card'} key={role.roleId}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{roleName(role.roleId)}</strong><p>{role.responsibility}</p></div><small>{role.permissions.join(' · ')}</small>{role.orchestrationOnly && <em>ORCHESTRATION ONLY</em>}</article>)}</div></section>
    <section className="task-section"><div className="section-label"><span>02</span><h3>{t.flow}</h3></div><div className="task-flow">{mission.tasks.map((task) => <div className="task-node" data-state={task.state} key={task.id}><i /><span>{roleName(task.roleId)}</span><strong>{taskState(task.state)}</strong><code>{task.acceptedOutputDigest?.slice(0, 8) ?? 'waiting'}</code></div>)}</div></section>
    {mission.state === 'QUEUED' && <div className="flight-control"><button className="shadow-button signal" disabled={working} type="button" onClick={onRun}>{working ? t.running : t.run}</button><p>{t.mock}</p></div>}
    <NoActionProof mission={mission} t={t} />
    <EvidenceDrawer mission={mission} t={t} />
  </section>;
}

function ReviewDesk({mission, t, working, onReview}: {mission: UiMission; t: typeof text[AppLocale]; working: boolean; onReview: (revision: Revision) => void}) {
  const current = latestPassing(mission); const denied = mission.revisions.find((item) => item.id === mission.fault.deniedRevisionId); const corrected = mission.revisions.find((item) => item.id === mission.fault.correctedRevisionId); const deniedAudit = mission.audits.find((item) => item.revisionId === denied?.id);
  return <section className="review-desk" aria-label="Independent Audit and exact Owner Review">
    <header className="review-desk-head"><div><p>{t.eyebrow}</p><h2>{t.reviewTitle}</h2><span>{t.reviewLead}</span></div><strong>{current.length}/4 PASS</strong></header>
    {denied !== undefined && deniedAudit !== undefined && <section className="fault-case"><div className="fault-flag"><span>AUDIT</span><strong>{t.fail}</strong><small>{deniedAudit.status === 'INVALIDATED' ? t.invalidated : deniedAudit.status}</small></div><div className="fault-copy"><p>{contentText(denied.content)}</p><code>{mission.fault.injectedPath}</code>{deniedAudit.issues.map((issue) => <div className="audit-reason" key={issue.code}><strong>{issue.code}</strong><span>{issue.message}</span><small>{t.nextRole}: {roleName(issue.nextResponsibleRoleId)} · {t.boundEvidence}: {issue.evidenceRefIds.length}</small></div>)}</div>{corrected !== undefined && <div className="revision-diff"><span>{t.changes}</span><del>{contentText(denied.content)}</del><ins>{contentText(corrected.content)}</ins><small>v1 → v2 · digest {corrected.digest.slice(0, 10)}…</small></div>}</section>}
    <div className="revision-grid">{current.map((revision) => { const review = mission.reviews.find((item) => item.revisionId === revision.id); return <article className="revision-card" key={revision.id}><header><span>{revision.platform === 'XIAOHONGSHU' ? '小红书' : revision.platform}</span><strong>v{revision.revision}</strong></header><p>{contentText(revision.content)}</p><dl><div><dt>Producer</dt><dd>{roleName(revision.producerRoleId)}</dd></div><div><dt>Audit</dt><dd>PASS</dd></div><div><dt>Digest</dt><dd><code>{revision.digest.slice(0, 12)}…</code></dd></div></dl><button className="review-action" disabled={working || review !== undefined} type="button" onClick={() => void onReview(revision)}>{review === undefined ? t.exactReview : t.reviewed}</button></article>; })}</div>
    <div className="review-boundary"><span>!</span><div><strong>{t.noGrant}</strong><p>{t.noGrantDetail}</p></div></div><NoActionProof mission={mission} t={t} /><EvidenceDrawer mission={mission} t={t} />
  </section>;
}

function NoActionProof({mission, t}: {mission: UiMission; t: typeof text[AppLocale]}) { return <section className="no-action-proof"><div className="section-label"><span>03</span><h3>{t.truth}</h3></div><div><span><strong>{mission.actionGrantCount}</strong> ActionGrant</span><span><strong>{mission.connectorCount}</strong> Connector</span><span><strong>{mission.externalActionCount}</strong> External action</span><span className="safe"><strong>FALSE</strong> executionAllowed</span></div></section>; }
function EvidenceDrawer({mission, t}: {mission: UiMission; t: typeof text[AppLocale]}) { return <details className="evidence-drawer"><summary><span>{t.evidence}</span><small>{mission.trace.length} events · ledger linked</small></summary><p>{t.evidenceHint}</p><ol>{mission.trace.map((event) => <li key={event.sequence}><span>{String(event.sequence).padStart(2, '0')}</span><strong>{event.businessLabel}</strong><code>{event.kind}</code></li>)}</ol></details>; }
function MissionEmpty({title, detail, state, children}: {title: string; detail: string; state: string; children?: React.ReactNode}) { return <section className="mission-empty"><span>GOVERNED SHADOW / NOT_LIVE · {state}</span><div><h2>{title}</h2><p>{detail}</p>{children}</div></section>; }

function fixtureMission(state: ShadowFixtureState): UiMission | undefined {
  if (state === 'empty' || state === 'prerequisite-blocked') return undefined; const mapped: Record<Exclude<ShadowFixtureState, 'empty' | 'prerequisite-blocked'>, string> = {queued: 'QUEUED', running: 'RUNNING', 'waiting-dependency': 'WAITING_DEPENDENCY', 'needs-owner': 'NEEDS_OWNER_REVIEW', failed: 'FAILED', 'timed-out': 'TIMED_OUT', cancelled: 'CANCELLED', 'unknown-recovery': 'UNKNOWN_RECOVERY', 'audit-blocked': 'AUDIT_BLOCKED', 'revision-required': 'REVISION_REQUIRED', 'shadow-complete': 'SHADOW_COMPLETE'};
  const roles = ['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'];
  return {id: 'fixture-mission', state: mapped[state], etag: '"fixture"', runtimeVersion: 'v1.2.0', sourceCampaignDigest: 'a'.repeat(64), externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0, roleContexts: roles.map((roleId, index) => ({roleId, identityId: `fixture-${index}`, responsibility: roleName(roleId), permissions: index === 0 ? ['ORCHESTRATE'] : index === 5 ? ['AUDIT'] : ['PRODUCE'], orchestrationOnly: index === 0, contextDigest: 'b'.repeat(64)})), tasks: roles.map((roleId, index) => ({id: `task-${index}`, roleId, state: index < 3 ? 'ACCEPTED' : mapped[state] === 'WAITING_DEPENDENCY' ? 'WAITING_DEPENDENCY' : 'RUNNING', prerequisiteTaskIds: [], acceptedOutputDigest: index < 3 ? 'c'.repeat(64) : null})), revisions: [], audits: [], reviews: [], trace: [{sequence: 1, kind: 'MISSION', businessLabel: 'SHADOW Mission fixture', detail: {}, createdAt: '2026-08-04T00:00:00Z'}], fault: {deniedRevisionId: null, correctedRevisionId: null, injectedPath: '/content/posts/0'}};
}

function latestPassing(mission: UiMission): Revision[] { return ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].flatMap((platform) => mission.revisions.filter((revision) => revision.platform === platform && mission.audits.some((audit) => audit.revisionId === revision.id && audit.status === 'ACTIVE' && audit.outcome === 'PASS')).sort((a, b) => b.revision - a.revision).slice(0, 1)); }
function stateLabel(state: string, t: typeof text[AppLocale]): string { return (t.states as Record<string, string>)[state] ?? state; }
function roleName(role: string): string { return ({'presence-mission-leader': 'Presence Mission Leader', 'evidence-claim-steward': 'Evidence & Claim Steward', 'campaign-planner': 'Campaign Planner', 'founder-identity-producer': 'Founder Identity Producer', 'product-account-producer': 'Product Account Producer', 'independent-auditor': 'Independent Auditor'} as Record<string, string>)[role] ?? role; }
function taskState(state: string): string { return state.replaceAll('_', ' ').toLowerCase(); }
function contentText(content: PlatformArtifact): string { switch (content.kind) { case 'X': case 'BLUESKY': return content.posts.join(' / '); case 'LINKEDIN': return content.commentary; case 'XIAOHONGSHU': return `${content.title} — ${content.body}`; } }
function orgHeaders(organizationId: string): Record<string, string> { return {'x-lumiclaw-organization-id': organizationId}; }
async function api<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(path, {...init, cache: 'no-store'}); const body = await response.json() as T & {code?: string}; if (!response.ok) { const error = new Error(body.code ?? `HTTP_${response.status}`) as ApiError; if (body.code !== undefined) error.code = body.code; throw error; } return body; }
