import type {AppLocale} from '@lumiclaw/i18n';
import {ProductionWorkspace} from '@/components/production-workspace';

export default async function TodayPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const {locale} = await params;
  return <ProductionWorkspace locale={locale} initialSection="today" />;
}
