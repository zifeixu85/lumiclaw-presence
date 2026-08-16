'use client';

import type {LocalCampaignIdentityInput, LocalOnboardingContext} from '@lumiclaw/domain';
import type {AppLocale} from '@lumiclaw/i18n';
import {AlertTriangle, LoaderCircle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useCallback, useEffect, useState} from 'react';
import {OnboardingFlow} from '@/components/onboarding/onboarding-flow';
import {DesktopGate} from '@/components/layout/desktop-gate';
import {WorkspaceShell} from '@/components/layout/workspace-shell';
import {Button} from '@/components/ui/button';
import {completeLocalOnboarding, createLocalProfile, deleteLocalMaterial, loadReadiness, loadSkills, loadTeam, loadWorkspace, ProductApiError, saveOnboardingContext, selectMaterialPath, uploadLocalMaterial, useExampleWorkspace} from '@/lib/production-api';
import type {EnvironmentReadiness, SkillListResponse, TeamResponse, WorkspaceSection, WorkspaceSnapshot} from '@/lib/production-types';
import {WorkspaceFeature} from './features/workspace-feature';

export type ProductionWorkspaceProps = {locale: AppLocale; initialSection?: WorkspaceSection; initialSnapshot?: WorkspaceSnapshot; initialReadiness?: EnvironmentReadiness; initialTeam?: TeamResponse; initialSkills?: SkillListResponse};

export function ProductionWorkspace({locale, initialSection = 'today', initialSnapshot, initialReadiness, initialTeam, initialSkills}: ProductionWorkspaceProps) {
  const t = useTranslations('Production');
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(initialSnapshot ?? null);
  const [readiness, setReadiness] = useState<EnvironmentReadiness | null>(initialReadiness ?? null);
  const [team, setTeam] = useState<TeamResponse | null>(initialTeam ?? null);
  const [skills, setSkills] = useState<SkillListResponse | null>(initialSkills ?? null);
  const [busy, setBusy] = useState(initialSnapshot === undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextSnapshot, nextReadiness, nextTeam, nextSkills] = await Promise.all([loadWorkspace(), loadReadiness(), loadTeam(), loadSkills()]);
    const webItem = nextReadiness.items.find((item) => item.service === 'WEB');
    if (webItem !== undefined) Object.assign(webItem, {state: 'AVAILABLE', source: 'CLIENT_OBSERVATION', reasonCode: 'CLIENT_RENDERED_READINESS'});
    setSnapshot(nextSnapshot); setReadiness(nextReadiness); setTeam(nextTeam); setSkills(nextSkills);
  }, []);

  useEffect(() => {
    if (initialSnapshot !== undefined && initialReadiness !== undefined && initialTeam !== undefined && initialSkills !== undefined) return;
    let live = true;
    void Promise.resolve().then(reload).catch((caught: unknown) => { if (live) setError(errorCode(caught)); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [initialReadiness, initialSkills, initialSnapshot, initialTeam, reload]);

  const run = async (operation: () => Promise<void>) => { setBusy(true); setError(null); try { await operation(); await reload(); } catch (caught) { setError(errorCode(caught)); } finally { setBusy(false); } };

  if (snapshot === null || readiness === null || team === null || skills === null) return <><DesktopGate /><div className="lc-desktop-app grid min-h-screen place-items-center bg-[var(--lc-canvas)]"><div className="max-w-md text-center">{error === null ? <><LoaderCircle className="mx-auto animate-spin text-[var(--lc-accent)]" size={26} aria-hidden /><p className="mt-4 text-sm text-[var(--lc-ink-muted)]">{t('loading')}</p></> : <><AlertTriangle className="mx-auto text-[var(--lc-danger)]" size={28} aria-hidden /><h1 className="mt-4 font-[var(--lc-font-serif)] text-2xl font-semibold">{t('errorTitle')}</h1><code className="mt-3 block text-xs text-[var(--lc-danger)]">{error}</code><Button className="mt-5" variant="primary" onClick={() => run(async () => {})}>{t('retry')}</Button></>}</div></div></>;

  if (snapshot.profile === null || snapshot.session?.state !== 'COMPLETED') return <><DesktopGate /><OnboardingFlow snapshot={snapshot} busy={busy} error={error} onCreateProfile={(name) => run(() => createLocalProfile(name))} onUseExample={() => run(useExampleWorkspace)} onSelectLocal={() => run(selectMaterialPath)} onUpload={(file) => run(() => uploadLocalMaterial(file))} onDelete={(id) => run(() => deleteLocalMaterial(id))} onFinishLocal={(context: LocalOnboardingContext, identity: LocalCampaignIdentityInput) => run(async () => { await saveOnboardingContext(context); await completeLocalOnboarding(identity); })} /></>;

  return <><DesktopGate /><WorkspaceShell locale={locale} section={initialSection} snapshot={snapshot} readiness={readiness}><WorkspaceFeature locale={locale} section={initialSection} snapshot={snapshot} readiness={readiness} team={team} skills={skills} onReload={() => run(async () => {})} /></WorkspaceShell></>;
}

function errorCode(error: unknown): string { return error instanceof ProductApiError ? error.code : error instanceof Error ? error.message : 'CONTROL_PLANE_UNAVAILABLE'; }
