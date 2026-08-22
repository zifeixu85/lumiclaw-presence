'use client';

import type {AccountOperatingProfileInput, KnowledgePlatform, KnowledgeStep, OrganizationProfileInput, PersonaProfileInput, ProductProfileInput, ProfileKind} from '@lumiclaw/domain';
import type {AppLocale} from '@lumiclaw/i18n';
import {AlertTriangle, LoaderCircle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useCallback, useEffect, useState} from 'react';
import {OnboardingFlow} from '@/components/onboarding/onboarding-flow';
import {DesktopGate} from '@/components/layout/desktop-gate';
import {WorkspaceShell} from '@/components/layout/workspace-shell';
import {Button} from '@/components/ui/button';
import {addKnowledgeText, approveKnowledgeSnapshot, confirmLegacySource, createLocalProfile, deleteKnowledgeSource, loadReadiness, loadSkills, loadTeam, loadWorkspace, ProductApiError, resolveKnowledgeConflict, saveAccountProfile, saveKnowledgeProfile, saveKnowledgeSession, selectExampleWorkspace, selectMaterialPath, uploadKnowledgeFiles} from '@/lib/production-api';
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

  const run = async (operation: () => Promise<unknown>) => { setBusy(true); setError(null); try { await operation(); await reload(); } catch (caught) { setError(errorCode(caught)); } finally { setBusy(false); } };
  const knowledgeVersion = () => {
    const version = snapshot?.knowledge?.session.rowVersion;
    if (version === undefined) throw new ProductApiError('KNOWLEDGE_ONBOARDING_NOT_READY', 409);
    return version;
  };

  if (snapshot === null || readiness === null || team === null || skills === null) return <><DesktopGate /><div className="lc-desktop-app grid min-h-screen place-items-center bg-[var(--lc-canvas)]"><div className="max-w-md text-center">{error === null ? <><LoaderCircle className="mx-auto animate-spin text-[var(--lc-accent)]" size={26} aria-hidden /><p className="mt-4 text-sm text-[var(--lc-ink-muted)]">{t('loading')}</p></> : <><AlertTriangle className="mx-auto text-[var(--lc-danger)]" size={28} aria-hidden /><h1 className="mt-4 font-[var(--lc-font-serif)] text-2xl font-semibold">{t('errorTitle')}</h1><code className="mt-3 block text-xs text-[var(--lc-danger)]">{error}</code><Button className="mt-5" variant="primary" onClick={() => run(async () => {})}>{t('retry')}</Button></>}</div></div></>;

  const publicExampleReady = snapshot.session?.path === 'PUBLIC_SAFE_EXAMPLE' && snapshot.session.state === 'COMPLETED';
  const approvedKnowledgeReady = snapshot.knowledge?.session.state === 'KNOWLEDGE_APPROVED_NEEDS_GOAL';
  if (!publicExampleReady && !approvedKnowledgeReady) return <><DesktopGate /><OnboardingFlow
    locale={locale}
    snapshot={snapshot}
    busy={busy}
    error={error}
    onStartExample={(name) => run(async () => { await createLocalProfile(name); await selectExampleWorkspace(); })}
    onStartLocal={(name) => run(async () => { await createLocalProfile(name); await selectMaterialPath(); })}
    onSelectLocal={() => run(selectMaterialPath)}
    onMoveStep={(step: KnowledgeStep) => run(() => saveKnowledgeSession(knowledgeVersion(), {currentStep: step}))}
    onSaveProfile={(kind: Exclude<ProfileKind, 'ACCOUNT'>, payload: PersonaProfileInput | OrganizationProfileInput | ProductProfileInput, next: KnowledgeStep) => run(() => saveKnowledgeProfile(kind, payload, knowledgeVersion(), next))}
    onSaveOrganizationProduct={(organization: OrganizationProfileInput, product: ProductProfileInput) => run(async () => {
      const afterOrganization = await saveKnowledgeProfile('ORGANIZATION', organization, knowledgeVersion(), 'ORGANIZATION_PRODUCT');
      await saveKnowledgeProfile('PRODUCT', product, afterOrganization.session.rowVersion, 'SOURCES');
    })}
    onSaveAccount={(platform: KnowledgePlatform, payload: AccountOperatingProfileInput, next: KnowledgeStep) => run(() => saveAccountProfile(platform, payload, knowledgeVersion(), next))}
    onUpload={(files) => run(() => uploadKnowledgeFiles(files, knowledgeVersion()))}
    onAddText={(label, text) => run(() => addKnowledgeText(label, text, knowledgeVersion()))}
    onDeleteSource={(id) => run(() => deleteKnowledgeSource(id, knowledgeVersion()))}
    onConfirmLegacy={(id) => run(() => confirmLegacySource(id, knowledgeVersion()))}
    onSaveContext={(targetMarket, contentLocale, timeZone) => run(() => saveKnowledgeSession(knowledgeVersion(), {currentStep: 'REVIEW', targetMarket, contentLocale, timeZone}))}
    onResolve={(conflictId, itemId) => run(() => resolveKnowledgeConflict(conflictId, itemId, 'Owner confirmed this value in the guided review.', knowledgeVersion()))}
    onApprove={(snapshotId, digest) => run(() => approveKnowledgeSnapshot(snapshotId, digest, knowledgeVersion()))}
  /></>;

  return <><DesktopGate /><WorkspaceShell locale={locale} section={initialSection} snapshot={snapshot} readiness={readiness}><WorkspaceFeature locale={locale} section={initialSection} snapshot={snapshot} readiness={readiness} team={team} skills={skills} onReload={reload} /></WorkspaceShell></>;
}

function errorCode(error: unknown): string { return error instanceof ProductApiError ? error.code : error instanceof Error ? error.message : 'CONTROL_PLANE_UNAVAILABLE'; }
