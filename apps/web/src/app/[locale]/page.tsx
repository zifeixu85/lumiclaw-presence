import type {AppLocale} from '@lumiclaw/i18n';
import {ProductShell} from '@/components/product-shell';
import {getPageData} from '@/lib/page-data';

export default async function CampaignsPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const {locale} = await params;
  const data = await getPageData(locale, 'campaigns');
  return <ProductShell locale={locale} routeId="campaigns" {...data} />;
}
