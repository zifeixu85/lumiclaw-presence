import type {AppLocale} from '@lumiclaw/i18n';
import {isRouteId, routeIds} from '@lumiclaw/i18n';
import {notFound} from 'next/navigation';
import {ProductShell} from '@/components/product-shell';
import {getPageData} from '@/lib/page-data';

type ScreenPageProps = {
  params: Promise<{locale: AppLocale; screen: string}>;
};

export function generateStaticParams() {
  return routeIds.filter((routeId) => routeId !== 'campaigns').map((screen) => ({screen}));
}

export default async function ScreenPage({params}: ScreenPageProps) {
  const {locale, screen} = await params;
  if (!isRouteId(screen) || screen === 'campaigns') notFound();
  const data = await getPageData(locale, screen);
  return <ProductShell locale={locale} routeId={screen} {...data} />;
}
