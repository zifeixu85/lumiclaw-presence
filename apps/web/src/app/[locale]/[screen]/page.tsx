import type {AppLocale} from '@lumiclaw/i18n';
import {notFound} from 'next/navigation';
import {ProductionWorkspace} from '@/components/production-workspace';
import {isWorkspaceScreenId, sectionForLegacyScreen, workspaceScreenIds} from '@/lib/workspace-routes';

type ScreenPageProps = {
  params: Promise<{locale: AppLocale; screen: string}>;
};

export function generateStaticParams() {
  return [...workspaceScreenIds, 'setup', 'mission', 'review', 'learn'].map((screen) => ({screen}));
}

export default async function ScreenPage({params}: ScreenPageProps) {
  const {locale, screen} = await params;
  if (!isWorkspaceScreenId(screen) && !['setup', 'mission', 'review', 'learn'].includes(screen)) notFound();
  return <ProductionWorkspace locale={locale} initialSection={sectionForLegacyScreen(screen)} />;
}
