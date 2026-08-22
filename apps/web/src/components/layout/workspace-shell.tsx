'use client';

import type {AppLocale} from '@lumiclaw/i18n';
import {CalendarDays, ChevronDown, CircleGauge, Crosshair, Library, Link2, Megaphone, MessageSquareText, Search, Send, Settings, ShieldCheck, Users} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {ReactNode} from 'react';
import {Link} from '@/i18n/navigation';
import type {EnvironmentReadiness, WorkspaceSection, WorkspaceSnapshot} from '@/lib/production-types';

type WorkspaceShellProps = {locale: AppLocale; section: WorkspaceSection; snapshot: WorkspaceSnapshot; readiness: EnvironmentReadiness; children: ReactNode};
type NavKey = 'today' | 'goals' | 'campaigns' | 'aiTeam' | 'calendar' | 'publish' | 'feedback' | 'knowledge' | 'accounts' | 'settings';

const operations = [
  {id: 'today', href: '/', key: 'today', icon: CircleGauge},
  {id: 'goals', href: '/goals', key: 'goals', icon: Crosshair},
  {id: 'ai-team', href: '/ai-team', key: 'aiTeam', icon: Users},
  {id: 'campaigns', href: '/campaigns', key: 'campaigns', icon: Megaphone},
  {id: 'calendar', href: '/calendar', key: 'calendar', icon: CalendarDays},
  {id: 'publish', href: '/publish', key: 'publish', icon: Send},
  {id: 'feedback', href: '/feedback', key: 'feedback', icon: MessageSquareText}
] as const;
const foundations = [
  {id: 'knowledge', href: '/knowledge', key: 'knowledge', icon: Library},
  {id: 'accounts', href: '/accounts', key: 'accounts', icon: Link2},
  {id: 'settings', href: '/settings', key: 'settings', icon: Settings}
] as const;

export function WorkspaceShell({locale, section, snapshot, readiness, children}: WorkspaceShellProps) {
  const t = useTranslations('Production');
  const campaign = snapshot.campaign?.document;
  const environmentGood = readiness.items.filter((item) => ['WEB', 'API', 'POSTGRESQL'].includes(item.service)).every((item) => item.state === 'AVAILABLE' || item.service === 'WEB' && item.state === 'UNKNOWN');
  const currentPath = section === 'today' ? '/' : `/${section}`;
  const mode = snapshot.session?.dataMode === 'PUBLIC_SAFE_EXAMPLE' ? 'demo' : 'local';
  const navItem = [...operations, ...foundations].find((item) => item.id === section);
  return <div className="lc-shell lc-desktop-app grid min-h-screen grid-cols-[var(--lc-sidebar-width)_minmax(0,1fr)] bg-[var(--lc-canvas)]">
    <aside className="lc-sidebar fixed inset-y-0 left-0 z-20 flex w-[var(--lc-sidebar-width)] flex-col bg-[var(--lc-sidebar)] text-white">
      <div className="flex h-16 items-center gap-3 px-3.5"><div className="lc-brand-mark">L</div><div className="min-w-0 leading-tight"><strong className="block truncate text-[15px] font-semibold">LumiClaw</strong><span className="mt-1 block font-[var(--lc-font-mono)] text-[10px] tracking-[0.08em] text-white/55">PRESENCE</span></div></div>
      <button type="button" className="lc-workspace-switcher text-white"><span className="grid size-[30px] place-items-center rounded-md bg-[var(--lc-mint)] font-[var(--lc-font-mono)] text-[10px] font-bold text-[var(--lc-sidebar)]">{campaign?.graph.organization.displayName.slice(0, 2).toUpperCase() ?? 'LC'}</span><span className="min-w-0"><strong className="block truncate text-xs font-semibold">{campaign?.graph.organization.displayName ?? t('workspaceFallback')}</strong><small className="block truncate text-[9px] text-white/55">{mode === 'demo' ? t('demoWorkspace') : t('privateWorkspace')}</small></span><ChevronDown size={14} aria-hidden className="text-white/55" /></button>
      <nav aria-label={t('workspaceNavigation')} className="lc-scrollbar flex-1 overflow-y-auto px-2 py-1">
        <p className="lc-nav-label">{t('operationsWorkspace')}</p><ul className="space-y-0.5">{operations.map((item) => <NavItem key={item.id} item={item} section={section} count={item.id === 'today' ? 3 : item.id === 'publish' ? snapshot.handoffs.length : 0} />)}</ul>
        <p className="lc-nav-label">{t('foundations')}</p><ul className="space-y-0.5">{foundations.map((item) => <NavItem key={item.id} item={item} section={section} />)}</ul>
        <div className="mx-2 mt-5 border-t border-white/10 pt-3"><Link href="/settings" className="flex min-h-9 items-center gap-2.5 rounded-md px-2 text-[11px] text-white/65 no-underline hover:bg-white/7 hover:text-white"><ShieldCheck size={14} aria-hidden className={environmentGood ? 'text-[var(--lc-mint)]' : 'text-[#ffb89d]'} /><span className="flex-1">{t('readiness')}</span><span className={`size-1.5 rounded-full ${environmentGood ? 'bg-[var(--lc-mint)]' : 'bg-[#ffb89d]'}`} /></Link></div>
      </nav>
      <div className="grid min-h-16 grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 border-t border-white/10 px-3"><div className="grid size-8 place-items-center rounded-full bg-[var(--lc-mint)] text-xs font-bold text-[var(--lc-sidebar)]">{snapshot.profile?.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><strong className="block truncate text-xs">{snapshot.profile?.displayName}</strong><small className="block truncate text-[9px] text-white/50">{t('ownerRole')}</small></div></div>
    </aside>
    <div className="col-start-2 min-w-0">
      <header className="lc-topbar sticky top-0 z-10 h-[var(--lc-header-height)] items-center gap-4 border-b border-[var(--lc-line)] bg-[var(--lc-surface)]/95 px-5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--lc-ink-muted)]"><span className="truncate">{campaign?.graph.organization.displayName ?? t('workspaceFallback')}</span><span>›</span><strong className="truncate font-semibold text-[var(--lc-ink)]">{navItem === undefined ? section : t(`nav.${navItem.key}`)}</strong></div>
        <label className="lc-search"><Search size={15} aria-hidden className="text-[var(--lc-ink-muted)]" /><input type="search" aria-label={t('globalSearch')} placeholder={t('globalSearch')} /><kbd>⌘ K</kbd></label>
        <div className="flex items-center justify-end gap-2"><Link href="/ai-team" className="lc-team-entry"><Users size={14} aria-hidden /><span className="font-semibold">{t('aiTeamEntry')}</span><small className="text-[9px] text-[var(--lc-positive)]">{t('rolesConfigured')}</small></Link><span className="lc-mode-pill" data-mode={mode}>{mode === 'demo' ? t('demoData') : t('localPrivateShort')}</span><Link className="rounded-md border border-[var(--lc-line)] bg-white px-3 py-1.5 text-xs font-semibold no-underline hover:border-[var(--lc-line-strong)]" href={currentPath} locale={locale === 'zh-CN' ? 'en' : 'zh-CN'}>{t('localeSwitch')}</Link><div className="grid size-8 place-items-center rounded-full bg-[var(--lc-mint)] text-xs font-bold">{snapshot.profile?.displayName.slice(0, 1).toUpperCase()}</div></div>
      </header>
      <main id="main-content" className="lc-page-enter mx-auto w-full max-w-[1500px] px-[30px] py-7">{children}</main>
    </div>
  </div>;
}

function NavItem({item, section, count = 0}: {item: {id: string; href: string; key: NavKey; icon: typeof CircleGauge}; section: WorkspaceSection; count?: number}) {
  const t = useTranslations('Production');
  const Icon = item.icon;
  const active = item.id === section;
  return <li><Link href={item.href} className="lc-nav-item" data-active={String(active)} aria-current={active ? 'page' : undefined}><Icon size={17} strokeWidth={1.8} aria-hidden /><span className="text-[13px] font-medium">{t(`nav.${item.key}`)}</span>{count > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-white/12 px-1.5 font-[var(--lc-font-mono)] text-[9px]">{count}</span> : item.id === 'ai-team' ? <span className="size-2 rounded-full border border-[var(--lc-mint)]" aria-label={t('rolesConfigured')} /> : null}</Link></li>;
}
