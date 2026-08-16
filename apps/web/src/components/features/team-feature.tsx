'use client';

import {Bot, CalendarClock, ChevronRight, FileCode2, UsersRound} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {useEffect, useState} from 'react';
import {Link} from '@/i18n/navigation';
import {loadSkill} from '@/lib/production-api';
import type {RepositorySkill, TeamAgent} from '@/lib/production-types';
import {Button} from '@/components/ui/button';
import {Drawer} from '@/components/ui/dialog';
import {StatusBadge} from '@/components/ui/status-badge';

type TeamTab = 'overview' | 'employees' | 'skills' | 'schedules';
const tabs: TeamTab[] = ['overview', 'employees', 'skills', 'schedules'];

export function TeamFeature({agents, skills}: {agents: TeamAgent[]; skills: RepositorySkill[]}) {
  const t = useTranslations('Production');
  const query = useSearchParams().get('view');
  const active: TeamTab = tabs.includes(query as TeamTab) ? query as TeamTab : 'overview';
  const [selectedAgent, setSelectedAgent] = useState<TeamAgent | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<RepositorySkill | null>(null);
  return <div>
    <nav className="mb-5 flex gap-6 border-b border-[var(--lc-line)]" role="tablist" aria-label={t('teamTabList')}>
      {tabs.map((tab) => <Link key={tab} href={`/ai-team?view=${tab}`} role="tab" aria-selected={active === tab} className={`border-b-2 px-0.5 pb-3 text-[12px] font-semibold no-underline ${active === tab ? 'border-[var(--lc-accent)] text-[var(--lc-ink)]' : 'border-transparent text-[var(--lc-ink-muted)] hover:text-[var(--lc-ink)]'}`}>{t(`teamTabs.${tab}`)}</Link>)}
    </nav>
    <section id={`team-panel-${active}`} role="tabpanel">
      {active === 'overview' ? <WorkOverview agents={agents} /> : active === 'employees' ? <Employees agents={agents} onSelect={setSelectedAgent} /> : active === 'skills' ? <SkillsView skills={skills} onSelect={setSelectedSkill} /> : <SchedulesView />}
    </section>
    <AgentDrawer agent={selectedAgent} skills={skills} onClose={() => setSelectedAgent(null)} />
    <SkillDrawer key={selectedSkill?.id ?? 'closed'} skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
  </div>;
}

function WorkOverview({agents}: {agents: TeamAgent[]}) {
  const t = useTranslations('Production');
  const observedRunning = agents.filter((agent) => agent.status === 'RUNNING' && agent.metrics.source !== 'NO_RUNTIME_OBSERVATION').length;
  return <div className="grid grid-cols-[minmax(0,1.4fr)_360px] gap-6"><section className="border border-[var(--lc-line)] bg-[var(--lc-surface)]"><div className="border-b border-[var(--lc-line)] px-5 py-4"><h2 className="font-[var(--lc-font-serif)] text-xl font-semibold">{t('teamOverviewTitle')}</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--lc-ink-muted)]">{t('teamOverviewBody')}</p></div><dl className="grid grid-cols-3 gap-px bg-[var(--lc-line)]"><OverviewMetric label={t('stableEmployees')} value={agents.length} /><OverviewMetric label={t('observedRunning')} value={observedRunning} /><OverviewMetric label={t('scheduledJobs')} value={0} /></dl><div className="divide-y divide-[var(--lc-line)]">{agents.map((agent) => <div key={agent.code} className="grid grid-cols-[70px_minmax(0,1fr)_180px] items-center px-5 py-3"><strong className="font-[var(--lc-font-mono)] text-[11px]">{agent.code}</strong><span className="text-[13px]">{t(`agents.${agent.code}.name`)}</span><StatusBadge tone="warning">{agent.status}</StatusBadge></div>)}</div></section><aside className="border border-[var(--lc-line)] bg-[var(--lc-sidebar)] p-5 text-white"><UsersRound size={20} aria-hidden className="text-[#ef9b87]" /><p className="mt-5 font-[var(--lc-font-mono)] text-[10px] font-bold tracking-[0.08em] text-[#ef9b87]">NO_RUNTIME_OBSERVATION</p><p className="mt-4 text-[13px] leading-6 text-white/75">{t('teamMetricNote')}</p><p className="mt-5 text-[11px] leading-5 text-white/60">{t('skillAvailabilityBody')}</p></aside></div>;
}
function OverviewMetric({label, value}: {label: string; value: number}) { return <div className="bg-[var(--lc-surface)] p-5"><dt className="text-[11px] text-[var(--lc-ink-muted)]">{label}</dt><dd className="mt-2 font-[var(--lc-font-serif)] text-3xl font-semibold">{value}</dd></div>; }

function Employees({agents, onSelect}: {agents: TeamAgent[]; onSelect: (agent: TeamAgent) => void}) {
  const t = useTranslations('Production');
  return <><div className="border border-[var(--lc-line)] bg-[var(--lc-surface)]"><div className="grid grid-cols-[72px_minmax(220px,1fr)_minmax(260px,1.5fr)_120px_120px_150px_34px] border-b border-[var(--lc-line)] bg-[var(--lc-surface-muted)] px-5 py-2.5 font-[var(--lc-font-mono)] text-[9px] font-bold tracking-[0.06em] text-[var(--lc-ink-muted)]"><span>{t('code')}</span><span>{t('role')}</span><span>{t('responsibility')}</span><span>{t('tokens')}</span><span>{t('daily')}</span><span>{t('runtime')}</span><span /></div>{agents.map((agent) => <button key={agent.code} onClick={() => onSelect(agent)} className="grid w-full grid-cols-[72px_minmax(220px,1fr)_minmax(260px,1.5fr)_120px_120px_150px_34px] items-center border-b border-[var(--lc-line)] px-5 py-4 text-left last:border-0 hover:bg-[var(--lc-surface-muted)]"><div className="grid size-8 place-items-center rounded-full bg-[var(--lc-sidebar)] font-[var(--lc-font-mono)] text-[10px] font-bold text-white">{agent.code}</div><div><strong className="block text-[13px]">{t(`agents.${agent.code}.name`)}</strong><span className="font-[var(--lc-font-mono)] text-[9px] text-[var(--lc-ink-muted)]">{agent.roleId}</span></div><p className="pr-6 text-xs leading-5 text-[var(--lc-ink-muted)]">{t(`agents.${agent.code}.responsibility`)}</p><Metric value={agent.metrics.tokens} source={agent.metrics.source} /><Metric value={agent.metrics.dailyCompleted} source={agent.metrics.source} /><StatusBadge tone={agent.status === 'RUNNING' ? 'positive' : agent.status === 'ERROR' ? 'danger' : 'warning'}>{agent.status}</StatusBadge><ChevronRight size={15} aria-hidden /></button>)}</div><p className="mt-3 text-[11px] text-[var(--lc-ink-muted)]">{t('metricsSource')}: NO_RUNTIME_OBSERVATION · {t('teamMetricNote')}</p></>;
}
function Metric({value, source}: {value: number; source: string}) { return <div><strong className="font-[var(--lc-font-mono)] text-sm">{value}</strong><span className="mt-0.5 block max-w-[100px] truncate text-[9px] text-[var(--lc-ink-muted)]" title={source}>{source}</span></div>; }

function SkillsView({skills, onSelect}: {skills: RepositorySkill[]; onSelect: (skill: RepositorySkill) => void}) {
  const t = useTranslations('Production');
  return <section className="border border-[var(--lc-line)] bg-[var(--lc-surface)]"><div className="border-b border-[var(--lc-line)] px-5 py-4"><h2 className="font-[var(--lc-font-serif)] text-xl font-semibold">{t('teamTabs.skills')}</h2><p className="mt-2 text-[13px] text-[var(--lc-ink-muted)]">{t('skillAvailabilityBody')}</p></div><div className="grid grid-cols-[minmax(240px,1.2fr)_minmax(260px,1fr)_150px_100px] border-b border-[var(--lc-line)] bg-[var(--lc-surface-muted)] px-5 py-2.5 font-[var(--lc-font-mono)] text-[9px] font-bold text-[var(--lc-ink-muted)]"><span>{t('repositorySkill')}</span><span>{t('assignedRoles')}</span><span>{t('source')}</span><span>{t('status')}</span></div>{skills.map((skill) => <button key={skill.id} onClick={() => onSelect(skill)} className="grid w-full grid-cols-[minmax(240px,1.2fr)_minmax(260px,1fr)_150px_100px] items-center border-b border-[var(--lc-line)] px-5 py-4 text-left last:border-0 hover:bg-[var(--lc-surface-muted)]"><span><strong className="block text-[13px]"><RepositorySkillName skill={skill} /></strong><small className="font-[var(--lc-font-mono)] text-[9px] text-[var(--lc-ink-muted)]">{skill.id}</small></span><span className="text-xs text-[var(--lc-ink-muted)]">{skill.roleIds.join(' · ')}</span><span className="font-[var(--lc-font-mono)] text-[9px]">REPOSITORY_OWNED</span><StatusBadge tone="positive">{skill.state}</StatusBadge></button>)}</section>;
}

function SchedulesView() {
  const t = useTranslations('Production');
  return <div className="grid min-h-[390px] place-items-center border border-dashed border-[var(--lc-line)] bg-[var(--lc-surface)]"><div className="max-w-xl text-center"><CalendarClock className="mx-auto text-[var(--lc-warning)]" size={30} aria-hidden /><StatusBadge tone="warning">PLANNED · NO_RUNTIME_OBSERVATION</StatusBadge><h2 className="mt-4 font-[var(--lc-font-serif)] text-2xl font-semibold">{t('noScheduledTasks')}</h2><p className="mt-3 text-[13px] leading-6 text-[var(--lc-ink-muted)]">{t('noScheduledTasksBody')}</p></div></div>;
}

function AgentDrawer({agent, skills, onClose}: {agent: TeamAgent | null; skills: RepositorySkill[]; onClose: () => void}) {
  const t = useTranslations('Production');
  const [skillContent, setSkillContent] = useState<{id: string; content: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inspect = async (id: string) => { setError(null); try { const result = await loadSkill(id); setSkillContent({id, content: result.skill.content}); } catch (caught) { setError(caught instanceof Error ? caught.message : 'SKILL_LOAD_FAILED'); } };
  return <Drawer open={agent !== null} onOpenChange={(open) => { if (!open) { setSkillContent(null); onClose(); } }} title={agent === null ? t('agent') : `${agent.code} · ${t(`agents.${agent.code}.name`)}`} description={agent?.roleId ?? ''}>
    {agent === null ? null : <div><div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-[var(--lc-line)] bg-[var(--lc-line)]"><AgentFact label={t('runtime')} value={agent.status} /><AgentFact label={t('tokens')} value={String(agent.metrics.tokens)} /><AgentFact label={t('daily')} value={String(agent.metrics.dailyCompleted)} /></div><section className="mt-6"><h3 className="text-xs font-semibold">{t('responsibility')}</h3><p className="mt-2 text-[14px] leading-6 text-[var(--lc-ink-muted)]">{t(`agents.${agent.code}.responsibility`)}</p></section><section className="mt-6"><div className="flex items-center gap-2"><FileCode2 size={15} aria-hidden /><h3 className="text-xs font-semibold">{t('skills')}</h3></div><p className="mt-2 text-[11px] text-[var(--lc-ink-muted)]">{t('skillSource')}</p><div className="mt-3 space-y-2">{agent.skillIds.map((id) => { const skill = skills.find((item) => item.id === id); return <button key={id} onClick={() => inspect(id)} className="flex w-full items-center gap-3 rounded-md border border-[var(--lc-line)] bg-white px-3 py-3 text-left hover:border-[#aaa69c]"><Bot size={15} aria-hidden className="text-[var(--lc-accent)]" /><span className="min-w-0 flex-1"><strong className="block text-xs">{skill === undefined ? id : <RepositorySkillName skill={skill} />}</strong><small className="font-[var(--lc-font-mono)] text-[9px] text-[var(--lc-ink-muted)]">{id}</small></span><ChevronRight size={14} aria-hidden /></button>; })}</div></section>{error === null ? null : <p role="alert" className="mt-4 text-xs text-[var(--lc-danger)]">{error}</p>}{skillContent === null ? null : <SkillSource id={skillContent.id} content={skillContent.content} />}<div className="mt-6"><Button disabled variant="secondary">{t('startAgentPlanned')}</Button></div></div>}
  </Drawer>;
}

function SkillDrawer({skill, onClose}: {skill: RepositorySkill | null; onClose: () => void}) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (skill === null) return;
    let live = true;
    void loadSkill(skill.id).then((result) => { if (live) setContent(result.skill.content); }).catch((caught: unknown) => { if (live) setError(caught instanceof Error ? caught.message : 'SKILL_LOAD_FAILED'); });
    return () => { live = false; };
  }, [skill]);
  return <Drawer open={skill !== null} onOpenChange={(open) => { if (!open) onClose(); }} title={skill?.name ?? ''} description={skill === null ? '' : `${skill.id} · REPOSITORY_OWNED · ${skill.license}`}>
    {error === null ? null : <p role="alert" className="text-xs text-[var(--lc-danger)]">{error}</p>}
    {skill === null || content === null ? null : <SkillSource id={skill.id} content={content} />}
  </Drawer>;
}
function SkillSource({id, content}: {id: string; content: string}) { return <section><div className="flex items-center justify-between"><h3 className="text-xs font-semibold">{id}/SKILL.md</h3><StatusBadge tone="positive">REPOSITORY_OWNED</StatusBadge></div><pre className="lc-scrollbar mt-3 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-md bg-[var(--lc-sidebar)] p-4 font-[var(--lc-font-mono)] text-[11px] leading-5 text-white/75">{content}</pre></section>; }
function RepositorySkillName({skill}: {skill: RepositorySkill}) {
  const t = useTranslations('Production');
  const labels: Record<string, string> = {'trace-safe-escalation': t('teamSkills.traceSafeEscalation'), 'evidence-and-claim-grounding': t('teamSkills.evidenceClaimGrounding'), 'campaign-strategy': t('teamSkills.campaignStrategy'), 'account-native-expression': t('teamSkills.accountNativeExpression'), 'independent-action-audit': t('teamSkills.independentActionAudit')};
  return labels[skill.id] ?? skill.name;
}
function AgentFact({label, value}: {label: string; value: string}) { return <div className="bg-[var(--lc-surface)] p-4"><p className="font-[var(--lc-font-mono)] text-[9px] font-bold text-[var(--lc-ink-muted)]">{label.toUpperCase()}</p><strong className="mt-2 block text-xs">{value}</strong></div>; }
