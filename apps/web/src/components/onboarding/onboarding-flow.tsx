'use client';

import type {LocalOnboardingContext} from '@lumiclaw/domain';
import {FileText, LockKeyhole, ShieldCheck, Sparkles, Upload} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useState, type ChangeEvent, type FormEvent} from 'react';
import type {WorkspaceSnapshot} from '@/lib/production-types';
import {Button} from '@/components/ui/button';
import {StatusBadge} from '@/components/ui/status-badge';

type OnboardingFlowProps = {
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  error: string | null;
  onCreateProfile: (name: string) => Promise<void>;
  onUseExample: () => Promise<void>;
  onSelectLocal: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onDelete: (materialId: string) => Promise<void>;
  onFinishLocal: (context: LocalOnboardingContext) => Promise<void>;
};

const fieldClass = 'mt-1.5 min-h-10 w-full rounded-md border border-[var(--lc-line)] bg-white px-3 text-[13px] text-[var(--lc-ink)] placeholder:text-[#aaa69f]';

export function OnboardingFlow(props: OnboardingFlowProps) {
  return (
    <div className="lc-desktop-app grid min-h-screen grid-cols-[360px_minmax(0,1fr)] bg-[var(--lc-canvas)]">
      <aside className="flex flex-col bg-[var(--lc-sidebar)] px-10 py-9 text-white">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-md bg-[var(--lc-accent)] font-[var(--lc-font-serif)] text-xl font-semibold">L</div><div><strong className="block font-[var(--lc-font-serif)] text-lg">LumiClaw Presence</strong><span className="text-[11px] tracking-[0.08em] text-white/75">GLOBAL BRAND OPERATIONS</span></div></div>
        <div className="mt-24 border-t border-white/15 pt-6"><p className="font-[var(--lc-font-mono)] text-[10px] font-bold tracking-[0.12em] text-[#ee9b88]">PRODUCTION UX 1.4</p><h2 className="mt-3 max-w-[12ch] font-[var(--lc-font-serif)] text-[34px] leading-[1.04] tracking-[-0.035em]">A governed public presence starts locally.</h2><p className="mt-5 text-[13px] leading-6 text-white/75">Identity, source material, context, review, and every handoff remain visible and recoverable.</p></div>
        <div className="mt-auto space-y-3 border-t border-white/15 pt-5 text-xs text-white/75"><p className="flex items-center gap-2"><LockKeyhole size={14} aria-hidden /> No remote registration</p><p className="flex items-center gap-2"><ShieldCheck size={14} aria-hidden /> No browser API keys</p></div>
      </aside>
      <main id="main-content" className="lc-scrollbar overflow-y-auto px-[clamp(52px,8vw,128px)] py-16">
        <div className="mx-auto max-w-[820px]">{props.snapshot.profile === null ? <ProfileStep {...props} /> : props.snapshot.session?.path === 'UNSELECTED' ? <ChoiceStep {...props} /> : <MaterialStep {...props} />}</div>
      </main>
    </div>
  );
}

function ProfileStep({busy, error, onCreateProfile}: OnboardingFlowProps) {
  const t = useTranslations('Production');
  const [name, setName] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); await onCreateProfile(name); };
  return <section aria-labelledby="profile-title"><StepHeading eyebrow={t('firstOpenEyebrow')} title={t('firstOpenTitle')} body={t('firstOpenBody')} /><form className="mt-9 max-w-xl" onSubmit={submit}><label className="text-[13px] font-semibold" htmlFor="local-display-name">{t('displayName')}</label><input id="local-display-name" className={fieldClass} required minLength={1} maxLength={64} autoComplete="nickname" autoFocus value={name} placeholder={t('displayNamePlaceholder')} onChange={(event) => setName(event.target.value)} /><p className="mt-2 text-xs text-[var(--lc-ink-muted)]">{t('displayNameHint')}</p><ErrorLine error={error} /><Button className="mt-6" variant="primary" type="submit" disabled={busy || name.trim().length === 0}>{t('continue')}</Button></form></section>;
}

function ChoiceStep({busy, error, onUseExample, onSelectLocal}: OnboardingFlowProps) {
  const t = useTranslations('Production');
  return <section><StepHeading eyebrow={t('choiceEyebrow')} title={t('choiceTitle')} body={t('choiceBody')} /><div className="mt-9 grid grid-cols-2 gap-5"><ChoiceCard icon={<Sparkles size={19} />} title={t('exampleTitle')} body={t('exampleBody')} badge={t('exampleBadge')} action={t('useExample')} busy={busy} onClick={onUseExample} /><ChoiceCard icon={<Upload size={19} />} title={t('localTitle')} body={t('localBody')} badge={t('localBadge')} action={t('useLocal')} busy={busy} onClick={onSelectLocal} /></div><ErrorLine error={error} /></section>;
}

function MaterialStep({snapshot, busy, error, onUpload, onDelete, onFinishLocal}: OnboardingFlowProps) {
  const t = useTranslations('Production');
  const session = snapshot.session;
  const [context, setContext] = useState<LocalOnboardingContext>({marketCode: session?.marketCode ?? 'CN', contentLocale: session?.contentLocale ?? 'zh-CN', platform: session?.platform ?? 'XIAOHONGSHU', timeZone: session?.timeZone ?? 'Asia/Shanghai'});
  const fileSelected = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file !== undefined) await onUpload(file); event.target.value = ''; };
  const submit = async (event: FormEvent) => { event.preventDefault(); await onFinishLocal(context); };
  return <section><StepHeading eyebrow="LOCAL MATERIALS · SERVER EXTRACTED" title={t('materialTitle')} body={t('materialBody')} />
    <div className="mt-8 rounded-[var(--lc-radius-md)] border border-[var(--lc-line)] bg-[var(--lc-surface)] p-5">
      <div className="flex items-start justify-between gap-6"><div><StatusBadge tone="positive">{t('materialSupported')}</StatusBadge><p className="mt-3 text-xs text-[var(--lc-ink-muted)]">{t('materialPlanned')}</p></div><label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-[var(--lc-sidebar)] px-3.5 text-[13px] font-semibold text-white hover:bg-[#343430]"><Upload aria-hidden size={15} />{t('chooseFile')}<input className="sr-only" type="file" accept=".md,.txt,text/markdown,text/plain" onChange={fileSelected} disabled={busy} /></label></div>
      <div className="mt-5 divide-y divide-[var(--lc-line)] border-y border-[var(--lc-line)]">{snapshot.materials.length === 0 ? <p className="py-5 text-center text-xs text-[var(--lc-ink-muted)]">{t('chooseFile')}</p> : snapshot.materials.map((material) => <div key={material.id} className="flex items-center gap-4 py-3"><div className="grid size-9 place-items-center rounded-md bg-[var(--lc-positive-soft)] text-[var(--lc-positive)]"><FileText size={16} aria-hidden /></div><div className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{material.fileName}</strong><span className="block truncate font-[var(--lc-font-mono)] text-[10px] text-[var(--lc-ink-muted)]">{t('digest')}: {material.digest}</span></div><StatusBadge tone="positive">{material.state}</StatusBadge><Button size="sm" variant="ghost" disabled={busy} onClick={() => onDelete(material.id)}>{t('remove')}</Button></div>)}</div>
    </div>
    <form className="mt-8" onSubmit={submit}><h2 className="font-[var(--lc-font-serif)] text-2xl font-semibold tracking-[-0.02em]">{t('contextTitle')}</h2><p className="mt-2 max-w-2xl text-[13px] text-[var(--lc-ink-muted)]">{t('contextBody')}</p><div className="mt-5 grid grid-cols-2 gap-4"><SelectField label={t('market')} value={context.marketCode} options={[['CN', 'CN · China'], ['US', 'US · United States'], ['SG', 'SG · Singapore']]} onChange={(marketCode) => setContext({...context, marketCode})} /><SelectField label={t('contentLocale')} value={context.contentLocale} options={[['zh-CN', 'zh-CN · 简体中文'], ['en-US', 'en-US · English (US)'], ['en-SG', 'en-SG · English (SG)']]} onChange={(contentLocale) => setContext({...context, contentLocale})} /><SelectField label={t('platform')} value={context.platform} options={[['XIAOHONGSHU', 'XIAOHONGSHU'], ['LINKEDIN', 'LINKEDIN'], ['X', 'X'], ['BLUESKY', 'BLUESKY']]} onChange={(platform) => setContext({...context, platform})} /><SelectField label={t('timeZone')} value={context.timeZone} options={[['Asia/Shanghai', 'Asia/Shanghai'], ['Asia/Singapore', 'Asia/Singapore'], ['America/Los_Angeles', 'America/Los_Angeles']]} onChange={(timeZone) => setContext({...context, timeZone})} /></div><ErrorLine error={error} /><Button className="mt-6" variant="primary" type="submit" disabled={busy || snapshot.materials.length === 0}>{t('finishSetup')}</Button></form>
  </section>;
}

function StepHeading({eyebrow, title, body}: {eyebrow: string; title: string; body: string}) { return <header><p className="font-[var(--lc-font-mono)] text-[10px] font-bold tracking-[0.11em] text-[var(--lc-accent)]">{eyebrow}</p><h1 id="profile-title" className="mt-3 max-w-[18ch] font-[var(--lc-font-serif)] text-[46px] font-semibold leading-[1.02] tracking-[-0.045em]">{title}</h1><p className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--lc-ink-muted)]">{body}</p></header>; }
function ErrorLine({error}: {error: string | null}) { return error === null ? null : <p role="alert" className="mt-4 rounded-md bg-[var(--lc-danger-soft)] px-3 py-2 font-[var(--lc-font-mono)] text-xs text-[var(--lc-danger)]">{error}</p>; }
function ChoiceCard({icon, title, body, badge, action, busy, onClick}: {icon: React.ReactNode; title: string; body: string; badge: string; action: string; busy: boolean; onClick: () => Promise<void>}) { return <article className="flex min-h-[280px] flex-col rounded-[var(--lc-radius-md)] border border-[var(--lc-line)] bg-[var(--lc-surface)] p-6"><div className="grid size-10 place-items-center rounded-md bg-[var(--lc-accent-soft)] text-[var(--lc-accent)]">{icon}</div><StatusBadge tone="info"><span className="mt-0">{badge}</span></StatusBadge><h2 className="mt-5 font-[var(--lc-font-serif)] text-2xl font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-2 flex-1 text-[13px] leading-6 text-[var(--lc-ink-muted)]">{body}</p><Button className="mt-5 w-full" variant="secondary" disabled={busy} onClick={onClick}>{action}</Button></article>; }
function SelectField({label, value, options, onChange}: {label: string; value: string; options: [string, string][]; onChange: (value: string) => void}) { return <label className="text-[13px] font-semibold">{label}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>; }
