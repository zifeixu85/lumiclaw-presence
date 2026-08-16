'use client';

import {MonitorUp} from 'lucide-react';
import {useTranslations} from 'next-intl';

export function DesktopGate() {
  const t = useTranslations('Production');
  return <div className="lc-desktop-gate"><div className="max-w-lg text-center"><MonitorUp className="mx-auto text-[#ef9b87]" size={34} aria-hidden /><h1 className="mt-5 font-[var(--lc-font-serif)] text-3xl font-semibold">{t('desktopTitle')}</h1><p className="mt-3 text-sm leading-6 text-white/75">{t('desktopBody')}</p><code className="mt-5 inline-block rounded-md bg-white/10 px-3 py-2 text-xs">MIN_DESKTOP_WIDTH = 1024px</code></div></div>;
}
