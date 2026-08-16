'use client';

import {CalendarDays, ChevronDown, CircleGauge, Database, FileText, Globe2, Library, Megaphone, MessageSquareText, Send, Settings, ShieldCheck, Users} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {ReactNode} from 'react';
import type {AppLocale} from '@lumiclaw/i18n';
import {Link} from '@/i18n/navigation';
import type {EnvironmentReadiness, WorkspaceSection, WorkspaceSnapshot} from '@/lib/production-types';
import {StatusBadge} from '@/components/ui/status-badge';

type WorkspaceShellProps = {locale: AppLocale; section: WorkspaceSection; snapshot: WorkspaceSnapshot; readiness: EnvironmentReadiness; children: ReactNode};

const nav = [
  {id: 'today', href: '/', key: 'today', icon: CircleGauge},
  {id: 'campaigns', href: '/campaigns', key: 'campaigns', icon: Megaphone},
  {id: 'ai-team', href: '/ai-team', key: 'aiTeam', icon: Users},
  {id: 'calendar', href: '/calendar', key: 'calendar', icon: CalendarDays},
  {id: 'publish', href: '/publish', key: 'publish', icon: Send},
  {id: 'feedback', href: '/feedback', key: 'feedback', icon: MessageSquareText},
  {id: 'knowledge', href: '/knowledge', key: 'knowledge', icon: Library},
  {id: 'accounts', href: '/accounts', key: 'accounts', icon: Globe2},
  {id: 'settings', href: '/settings', key: 'settings', icon: Settings}
] as const;

export function WorkspaceShell({locale, section, snapshot, readiness, children}: WorkspaceShellProps) {
  const t = useTranslations('Production');
  const campaign = snapshot.campaign?.document;
  const environmentGood = readiness.items.filter((item) => ['WEB', 'API', 'POSTGRESQL'].includes(item.service)).every((item) => item.state === 'AVAILABLE' || item.service === 'WEB' && item.state === 'UNKNOWN');
  const currentPath = section === 'today' ? '/' : `/${section}`;
  return <div className="lc-desktop-app grid min-h-screen grid-cols-[var(--lc-sidebar-width)_minmax(0,1fr)] bg-[var(--lc-canvas)]">
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[var(--lc-sidebar-width)] flex-col bg-[var(--lc-sidebar)] text-white">
      <div className="flex h-[var(--lc-header-height)] items-center gap-3 border-b border-white/10 px-5"><div className="grid size-8 place-items-center rounded-md bg-[var(--lc-accent)] font-[var(--lc-font-serif)] text-lg font-semibold">L</div><div className="min-w-0"><strong className="block truncate font-[var(--lc-font-serif)] text-[15px]">LumiClaw Presence</strong><span className="block truncate font-[var(--lc-font-mono)] text-[9px] tracking-[0.08em] text-white/75">{t('shellMode')}</span></div></div>
      <div className="border-b border-white/10 px-4 py-4"><button className="flex w-full items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-left hover:bg-white/8"><div className="grid size-7 place-items-center rounded bg-[#ee8b73]/15 text-[#ee9b87]"><Database size={14} aria-hidden /></div><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{campaign?.graph.organization.displayName ?? t('workspaceFallback')}</strong><small className="block truncate text-[10px] text-white/75">{snapshot.session?.dataMode === 'PUBLIC_SAFE_EXAMPLE' ? t('publicSafe') : t('localPrivate')}</small></span><ChevronDown size={14} aria-hidden className="text-white/75" /></button></div>
      <nav aria-label={t('workspaceNavigation')} className="lc-scrollbar flex-1 overflow-y-auto px-3 py-3"><ul className="space-y-0.5">{nav.map((item) => { const Icon = item.icon; const active = item.id === section; return <li key={item.id}><Link href={item.href} className={`flex min-h-9 items-center gap-3 rounded-md px-3 text-[13px] no-underline transition-colors ${active ? 'bg-white/12 font-semibold text-white' : 'text-white/75 hover:bg-white/7 hover:text-white'}`} aria-current={active ? 'page' : undefined}><Icon size={15} strokeWidth={1.8} aria-hidden /><span>{t(`nav.${item.key}`)}</span>{item.id === 'publish' && snapshot.handoffs.length > 0 ? <span className="ml-auto rounded-full bg-[#ee8b73] px-1.5 text-[9px] text-white">{snapshot.handoffs.length}</span> : null}</Link></li>; })}</ul>
      <div className="mt-5 border-t border-white/10 pt-4"><p className="px-3 font-[var(--lc-font-mono)] text-[9px] font-bold tracking-[0.09em] text-white/70">{t('controlPlane')}</p><Link href="/settings" className="mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-xs text-white/75 no-underline hover:bg-white/7"><ShieldCheck size={14} aria-hidden className={environmentGood ? 'text-[#7fc3a1]' : 'text-[#e4b16b]'} /><span className="flex-1">{t('readiness')}</span><span className={`size-1.5 rounded-full ${environmentGood ? 'bg-[#71b892]' : 'bg-[#dba55c]'}`} /></Link></div></nav>
      <div className="border-t border-white/10 p-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-bold">{snapshot.profile?.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><strong className="block truncate text-xs">{snapshot.profile?.displayName}</strong><small className="block text-[10px] text-white/75">{t('localOwner')}</small></div></div></div>
    </aside>
    <div className="col-start-2 min-w-0">
      <header className="sticky top-0 z-10 flex h-[var(--lc-header-height)] items-center justify-between border-b border-[var(--lc-line)] bg-[var(--lc-surface)]/95 px-7 backdrop-blur"><div className="flex items-center gap-2 text-xs text-[var(--lc-ink-muted)]"><FileText size={14} aria-hidden /><span>{campaign?.brief.name ?? t('workspaceFallback')}</span><span>/</span><strong className="font-semibold text-[var(--lc-ink)]">{nav.find((item) => item.id === section) === undefined ? section : t(`nav.${nav.find((item) => item.id === section)!.key}`)}</strong></div><div className="flex items-center gap-3"><StatusBadge tone={snapshot.campaign?.mode === 'LOCAL_PRIVATE' ? 'info' : 'warning'}>{snapshot.campaign?.mode ?? 'LOCAL_ONLY'} · {snapshot.campaign?.mode === 'LOCAL_PRIVATE' ? t('modeLocalPrivate') : t('modePublicSafe')}</StatusBadge><Link className="rounded-md border border-[var(--lc-line)] bg-white px-3 py-1.5 text-xs font-semibold no-underline hover:border-[#aaa69c]" href={currentPath} locale={locale === 'zh-CN' ? 'en' : 'zh-CN'}>{t('localeSwitch')}</Link></div></header>
      <main id="main-content" className="mx-auto w-full max-w-[1500px] px-7 py-7">{children}</main>
    </div>
  </div>;
}
