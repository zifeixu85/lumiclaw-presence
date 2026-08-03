import type {AppLocale, RouteId} from '@lumiclaw/i18n';
import {getTranslations} from 'next-intl/server';
import type {MissionCopy, ShellLabels} from '@/components/product-shell';
import {getScreenCopy} from './shell-copy';

export async function getPageData(locale: AppLocale, routeId: RouteId) {
  const [shell, screens, mission] = await Promise.all([
    getTranslations({locale, namespace: 'Shell'}),
    getTranslations({locale, namespace: 'Screens'}),
    getTranslations({locale, namespace: 'Mission'})
  ]);

  const labels: ShellLabels = {
    brand: shell('brand'),
    category: shell('category'),
    mode: shell('mode'),
    milestone: shell('milestone'),
    localeLabel: shell('localeLabel'),
    localeSwitch: shell('localeSwitch'),
    evidenceLabel: shell('evidenceLabel'),
    evidenceValue: shell('evidenceValue'),
    journeyLabel: shell('journeyLabel'),
    statusLabel: shell('statusLabel'),
    ownerLabel: shell('ownerLabel'),
    technicalDetailsLabel: shell('technicalDetailsLabel'),
    technicalStateLabel: shell('technicalStateLabel'),
    technicalEvidenceLabel: shell('technicalEvidenceLabel'),
    footer: shell('footer'),
    nav: {
      campaigns: shell('nav.campaigns'),
      setup: shell('nav.setup'),
      mission: shell('nav.mission'),
      review: shell('nav.review'),
      learn: shell('nav.learn')
    }
  };

  const missionCopy: MissionCopy = {
    rail: mission('rail'),
    composer: mission('composer'),
    preview: mission('preview'),
    constraint: mission('constraint'),
    disclaimer: mission('disclaimer'),
    platforms: [
      {id: 'x', label: mission('platforms.x')},
      {id: 'bluesky', label: mission('platforms.bluesky')},
      {id: 'linkedin', label: mission('platforms.linkedin')},
      {id: 'xiaohongshu', label: mission('platforms.xiaohongshu')}
    ]
  };

  return {labels, screen: getScreenCopy(screens, routeId), mission: missionCopy};
}
