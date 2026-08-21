'use client';

import type {LocalCampaignIdentityInput, LocalOnboardingContext} from '@lumiclaw/domain';
import type {AppLocale} from '@lumiclaw/i18n';
import {FileText, LockKeyhole, ShieldCheck, Sparkles, Upload} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useState, type ChangeEvent, type FormEvent} from 'react';
import type {WorkspaceSnapshot} from '@/lib/production-types';
import {Button} from '@/components/ui/button';
import {StatusBadge} from '@/components/ui/status-badge';

type OnboardingFlowProps = {
  locale: AppLocale;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  error: string | null;
  onStartExample: (name: string) => Promise<void>;
  onStartLocal: (name: string) => Promise<void>;
  onUseExample: () => Promise<void>;
  onSelectLocal: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onDelete: (materialId: string) => Promise<void>;
  onFinishLocal: (context: LocalOnboardingContext, identity: LocalCampaignIdentityInput) => Promise<void>;
};

const fieldClass = 'mt-1.5 min-h-10 w-full rounded-md border border-[var(--lc-line)] bg-white px-3 text-[13px] text-[var(--lc-ink)] placeholder:text-[#aaa69f]';
const textAreaClass = `${fieldClass} min-h-24 py-2.5 leading-5`;

export function OnboardingFlow(props: OnboardingFlowProps) {
  const t = useTranslations('Production');
  const activeStep = props.snapshot.profile === null ? 1 : props.snapshot.session?.path === 'UNSELECTED' ? 2 : 3;
  return (
    <div className="lc-onboarding-shell lc-desktop-app">
      <aside className="lc-onboarding-rail flex flex-col px-4 py-5">
        <div className="flex items-center gap-3"><div className="lc-brand-mark">L</div><div><strong className="block text-[15px]">LumiClaw</strong><span className="font-[var(--lc-font-mono)] text-[10px] tracking-[0.08em] text-white/55">PRESENCE</span></div></div>
        <div className="mt-10"><p className="px-2 font-[var(--lc-font-mono)] text-[9px] uppercase tracking-[0.1em] text-white/70">{t('setupProgress')}</p><ol className="mt-3"><OnboardingStep index={1} active={activeStep === 1} done={activeStep > 1} title={t('setupName')} body={t('setupNameBody')} /><OnboardingStep index={2} active={activeStep === 2} done={activeStep > 2} title={t('setupPath')} body={t('setupPathBody')} /><OnboardingStep index={3} active={activeStep === 3} done={false} title={t('setupMaterials')} body={t('setupMaterialsBody')} /><OnboardingStep index={4} active={false} done={false} title={t('setupGoal')} body={t('setupGoalBody')} /></ol></div>
        <div className="mt-auto space-y-3 border-t border-white/15 pt-5 text-[10px] text-white/65"><p className="flex items-center gap-2"><LockKeyhole size={14} aria-hidden />{t('noRemoteRegistration')}</p><p className="flex items-center gap-2"><ShieldCheck size={14} aria-hidden />{t('noBrowserSecrets')}</p><p className="flex items-center gap-2"><ShieldCheck size={14} aria-hidden />{t('noExternalActions')}</p></div>
      </aside>
      <main id="main-content" className="lc-scrollbar relative overflow-y-auto bg-[var(--lc-surface)] px-[clamp(42px,7vw,108px)] py-12">
        <a className="absolute right-6 top-5 rounded-md border border-[var(--lc-line)] bg-white px-3 py-1.5 text-xs font-semibold no-underline hover:border-[var(--lc-line-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lc-accent)]" href={`/${props.locale === 'zh-CN' ? 'en' : 'zh-CN'}`}>{t('localeSwitch')}</a>
        <div className="lc-page-enter mx-auto max-w-[900px]">{props.snapshot.profile === null ? <ProfileStep {...props} /> : props.snapshot.session?.path === 'UNSELECTED' ? <ChoiceStep {...props} /> : <MaterialStep {...props} />}</div>
      </main>
    </div>
  );
}

function ProfileStep({busy, error, onStartExample, onStartLocal}: OnboardingFlowProps) {
  const t = useTranslations('Production');
  const [name, setName] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); await onStartLocal(name); };
  const disabled = busy || name.trim().length === 0;
  return <section aria-labelledby="profile-title"><StepHeading eyebrow={t('firstOpenEyebrow')} title={t('firstOpenTitle')} body={t('firstOpenBody')} /><form className="mt-9 max-w-xl" onSubmit={submit}><label className="text-[13px] font-semibold" htmlFor="local-display-name">{t('displayName')}</label><input id="local-display-name" className={fieldClass} required minLength={1} maxLength={64} autoComplete="nickname" autoFocus value={name} placeholder={t('displayNamePlaceholder')} onChange={(event) => setName(event.target.value)} /><p className="mt-2 text-xs text-[var(--lc-ink-muted)]">{t('displayNameHint')}</p><ErrorLine error={error} /><div className="mt-6 grid grid-cols-2 gap-3"><Button variant="primary" type="submit" disabled={disabled}>{t('continueWithLocal')}</Button><Button variant="secondary" type="button" disabled={disabled} onClick={() => onStartExample(name)}><Sparkles size={15} aria-hidden />{t('quickExample')}</Button></div><p className="mt-3 text-[11px] leading-5 text-[var(--lc-ink-muted)]">{t('firstOpenPathHint')}</p></form></section>;
}

function ChoiceStep({busy, error, onUseExample, onSelectLocal}: OnboardingFlowProps) {
  const t = useTranslations('Production');
  return <section><StepHeading eyebrow={t('choiceEyebrow')} title={t('choiceTitle')} body={t('choiceBody')} /><div className="mt-8 grid grid-cols-2 gap-5"><ChoiceCard icon={<Sparkles size={19} />} title={t('exampleTitle')} body={t('exampleBody')} badge={t('exampleBadge')} technicalCode="PUBLIC_SAFE_EXAMPLE" action={t('useExample')} busy={busy} onClick={onUseExample} /><ChoiceCard icon={<Upload size={19} />} title={t('localTitle')} body={t('localBody')} badge={t('localBadge')} technicalCode="LOCAL_PRIVATE" action={t('useLocal')} busy={busy} onClick={onSelectLocal} /></div><ErrorLine error={error} /></section>;
}

function MaterialStep({snapshot, busy, error, onUpload, onDelete, onFinishLocal}: OnboardingFlowProps) {
  const t = useTranslations('Production');
  const session = snapshot.session;
  const [context, setContext] = useState<LocalOnboardingContext>({marketCodes: session?.marketCodes.length ? session.marketCodes : ['CN'], contentLocales: session?.contentLocales.length ? session.contentLocales : ['zh-CN'], platforms: session?.platforms.length ? session.platforms : ['XIAOHONGSHU'], defaultTimeZone: session?.defaultTimeZone ?? 'Asia/Shanghai'});
  const [identity, setIdentity] = useState<LocalCampaignIdentityInput>({organizationName: '', brandName: '', brandPositioning: '', productName: '', productDescription: '', campaignName: '', campaignObjective: '', callToAction: ''});
  const fileSelected = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file !== undefined) await onUpload(file); event.target.value = ''; };
  const submit = async (event: FormEvent) => { event.preventDefault(); await onFinishLocal(context, identity); };
  return <section><StepHeading eyebrow={t('localMaterialsEyebrow')} title={t('materialTitle')} body={t('materialBody')} />
    <div className="mt-8 border-y border-[var(--lc-line)] bg-[var(--lc-surface)] py-5">
      <div className="flex items-start justify-between gap-6"><div><StatusBadge tone="positive">{t('materialSupported')}</StatusBadge><p className="mt-3 text-xs text-[var(--lc-ink-muted)]">{t('materialPlanned')}</p></div><label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-[var(--lc-sidebar)] px-3.5 text-[13px] font-semibold text-white hover:bg-[#343430]"><Upload aria-hidden size={15} />{t('chooseFile')}<input className="sr-only" type="file" accept=".md,.txt,text/markdown,text/plain" onChange={fileSelected} disabled={busy} /></label></div>
      <div className="mt-5 divide-y divide-[var(--lc-line)] border-y border-[var(--lc-line)]">{snapshot.materials.length === 0 ? <p className="py-5 text-center text-xs text-[var(--lc-ink-muted)]">{t('chooseFile')}</p> : snapshot.materials.map((material) => <div key={material.id} className="py-3"><div className="flex items-center gap-4"><div className="grid size-9 place-items-center rounded-md bg-[var(--lc-positive-soft)] text-[var(--lc-positive)]"><FileText size={16} aria-hidden /></div><div className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{material.fileName}</strong><span className="block truncate font-[var(--lc-font-mono)] text-[10px] text-[var(--lc-ink-muted)]">{t('digest')}: {material.digest}</span></div><StatusBadge tone="positive">{material.state}</StatusBadge><Button size="sm" variant="ghost" disabled={busy} onClick={() => onDelete(material.id)}>{t('remove')}</Button></div><details className="ml-[52px] mt-2"><summary className="cursor-pointer text-xs font-semibold text-[var(--lc-info)]">{t('materialPreview')}</summary><pre className="lc-scrollbar mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--lc-surface-muted)] p-3 font-[var(--lc-font-mono)] text-[11px] leading-5 text-[var(--lc-ink-muted)]">{material.extractedText}</pre></details></div>)}</div>
    </div>
    <form className="mt-8" onSubmit={submit}>
      <h2 className="font-[var(--lc-font-serif)] text-2xl font-semibold tracking-[-0.02em]">{t('identityTitle')}</h2><p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--lc-ink-muted)]">{t('identityBody')}</p>
      <div className="mt-5 grid grid-cols-2 gap-4"><TextField label={t('organizationName')} value={identity.organizationName} placeholder={t('organizationPlaceholder')} onChange={(organizationName) => setIdentity({...identity, organizationName})} /><TextField label={t('brandName')} value={identity.brandName} placeholder={t('brandPlaceholder')} onChange={(brandName) => setIdentity({...identity, brandName})} /><TextField multiline label={t('brandPositioning')} value={identity.brandPositioning} placeholder={t('positioningPlaceholder')} onChange={(brandPositioning) => setIdentity({...identity, brandPositioning})} /><TextField label={t('productName')} value={identity.productName} placeholder={t('productPlaceholder')} onChange={(productName) => setIdentity({...identity, productName})} /><TextField multiline label={t('productDescription')} value={identity.productDescription} placeholder={t('productDescriptionPlaceholder')} onChange={(productDescription) => setIdentity({...identity, productDescription})} /><TextField label={t('campaignName')} value={identity.campaignName} placeholder={t('campaignPlaceholder')} onChange={(campaignName) => setIdentity({...identity, campaignName})} /><TextField multiline label={t('campaignObjective')} value={identity.campaignObjective} placeholder={t('campaignObjectivePlaceholder')} onChange={(campaignObjective) => setIdentity({...identity, campaignObjective})} /><TextField multiline label={t('callToAction')} value={identity.callToAction} placeholder={t('callToActionPlaceholder')} onChange={(callToAction) => setIdentity({...identity, callToAction})} /></div>
      <div className="mt-8 border-t border-[var(--lc-line)] pt-8"><h2 className="font-[var(--lc-font-serif)] text-2xl font-semibold tracking-[-0.02em]">{t('contextTitle')}</h2><p className="mt-2 max-w-2xl text-[13px] text-[var(--lc-ink-muted)]">{t('contextBody')}</p><div className="mt-5 grid grid-cols-2 gap-4"><MultiSelectField label={t('market')} hint={t('multiSelectHint')} values={context.marketCodes} options={[['CN', t('marketChina')], ['US', t('marketUnitedStates')], ['SG', t('marketSingapore')]]} onChange={(marketCodes) => setContext({...context, marketCodes})} /><MultiSelectField label={t('contentLocale')} hint={t('multiSelectHint')} values={context.contentLocales} options={[['zh-CN', t('localeChinese')], ['en-US', t('localeEnglishUs')], ['en-SG', t('localeEnglishSg')]]} onChange={(contentLocales) => setContext({...context, contentLocales})} /><MultiSelectField label={t('platform')} hint={t('multiSelectHint')} values={context.platforms} options={[['XIAOHONGSHU', 'XIAOHONGSHU'], ['LINKEDIN', 'LINKEDIN'], ['X', 'X'], ['BLUESKY', 'BLUESKY']]} onChange={(platforms) => setContext({...context, platforms})} /><SelectField label={t('timeZone')} value={context.defaultTimeZone} options={[['Asia/Shanghai', 'Asia/Shanghai'], ['Asia/Singapore', 'Asia/Singapore'], ['America/Los_Angeles', 'America/Los_Angeles']]} onChange={(defaultTimeZone) => setContext({...context, defaultTimeZone})} /></div></div>
      <p className="mt-3 max-w-3xl rounded-md bg-[var(--lc-info-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--lc-info)]">{t('contextScopeNote')}</p>
      <ErrorLine error={error} /><Button className="mt-6" variant="primary" type="submit" disabled={busy || snapshot.materials.length === 0}>{t('finishSetup')}</Button>
    </form>
  </section>;
}

function StepHeading({eyebrow, title, body}: {eyebrow: string; title: string; body: string}) { return <header><p className="lc-eyebrow">{eyebrow}</p><h1 id="profile-title" className="mt-2 max-w-[22ch] text-[32px] font-semibold leading-[1.18] tracking-[-0.03em]">{title}</h1><p className="mt-4 max-w-2xl text-[14px] leading-6 text-[var(--lc-ink-muted)]">{body}</p></header>; }
function ErrorLine({error}: {error: string | null}) { return error === null ? null : <p role="alert" className="mt-4 rounded-md bg-[var(--lc-danger-soft)] px-3 py-2 font-[var(--lc-font-mono)] text-xs text-[var(--lc-danger)]">{error}</p>; }
function ChoiceCard({icon, title, body, badge, technicalCode, action, busy, onClick}: {icon: React.ReactNode; title: string; body: string; badge: string; technicalCode: string; action: string; busy: boolean; onClick: () => Promise<void>}) { const t = useTranslations('Production'); return <article className="lc-choice-card"><div className="grid size-10 place-items-center rounded-md bg-[var(--lc-accent-soft)] text-[var(--lc-accent)]">{icon}</div><span className="mt-4 inline-flex w-fit rounded-full bg-[var(--lc-info-soft)] px-2 py-1 text-[9px] font-semibold text-[var(--lc-info)]">{badge}</span><h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-2 flex-1 text-[13px] leading-6 text-[var(--lc-ink-muted)]">{body}</p><details className="lc-technical-details"><summary>{t('technicalDetails')}</summary><code>{technicalCode}</code></details><Button className="mt-5 w-full" variant="secondary" disabled={busy} onClick={onClick}>{action}</Button></article>; }
function OnboardingStep({index, active, done, title, body}: {index: number; active: boolean; done: boolean; title: string; body: string}) { return <li className="lc-onboarding-step" data-active={String(active)}><span>{done ? '✓' : index}</span><div><strong className="block text-[11px]">{title}</strong><small className="text-[9px] text-current">{body}</small></div></li>; }
function SelectField({label, value, options, onChange}: {label: string; value: string; options: [string, string][]; onChange: (value: string) => void}) { return <label className="text-[13px] font-semibold">{label}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>; }
function MultiSelectField({label, hint, values, options, onChange}: {label: string; hint: string; values: string[]; options: [string, string][]; onChange: (values: string[]) => void}) {
  const toggle = (value: string) => { const selected = values.includes(value); if (selected && values.length === 1) return; onChange(selected ? values.filter((item) => item !== value) : [...values, value]); };
  return <fieldset className="rounded-md border border-[var(--lc-line)] bg-white p-3"><legend className="px-1 text-[13px] font-semibold">{label}</legend><p className="mb-2 text-[10px] text-[var(--lc-ink-muted)]">{hint}</p><div className="flex flex-wrap gap-2">{options.map(([code, name]) => { const selected = values.includes(code); return <button key={code} type="button" aria-pressed={selected} className="lc-multi-option" data-selected={String(selected)} onClick={() => toggle(code)}>{name}</button>; })}</div></fieldset>;
}
function TextField({label, value, placeholder, multiline = false, onChange}: {label: string; value: string; placeholder: string; multiline?: boolean; onChange: (value: string) => void}) { return <label className="text-[13px] font-semibold">{label}{multiline ? <textarea className={textAreaClass} required value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input className={fieldClass} required value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>; }
