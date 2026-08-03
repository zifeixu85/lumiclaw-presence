import type {RouteId} from '@lumiclaw/i18n';
import type {getTranslations} from 'next-intl/server';

type Translator = Awaited<ReturnType<typeof getTranslations<'Screens'>>>;

export type ScreenCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  basis: string;
  next: string;
  previewTitle: string;
  previewItems: [string, string, string];
  technicalStatus: string;
  technicalBasis: string;
};

function fromRoute(t: Translator, routeId: RouteId): ScreenCopy {
  return {
    eyebrow: t(`${routeId}.eyebrow`),
    title: t(`${routeId}.title`),
    summary: t(`${routeId}.summary`),
    status: t(`${routeId}.status`),
    basis: t(`${routeId}.basis`),
    next: t(`${routeId}.next`),
    previewTitle: t(`${routeId}.previewTitle`),
    previewItems: [
      t(`${routeId}.previewItems.first`),
      t(`${routeId}.previewItems.second`),
      t(`${routeId}.previewItems.third`)
    ],
    technicalStatus: t(`${routeId}.technicalStatus`),
    technicalBasis: t(`${routeId}.technicalBasis`)
  };
}

export function getScreenCopy(t: Translator, routeId: RouteId): ScreenCopy {
  switch (routeId) {
    case 'campaigns':
      return fromCampaigns(t);
    case 'setup':
      return fromSetup(t);
    case 'mission':
      return fromMission(t);
    case 'review':
      return fromReview(t);
    case 'learn':
      return fromLearn(t);
  }
}

function fromCampaigns(t: Translator): ScreenCopy {
  return fromRoute(t, 'campaigns');
}

function fromSetup(t: Translator): ScreenCopy {
  return fromRoute(t, 'setup');
}

function fromMission(t: Translator): ScreenCopy {
  return fromRoute(t, 'mission');
}

function fromReview(t: Translator): ScreenCopy {
  return fromRoute(t, 'review');
}

function fromLearn(t: Translator): ScreenCopy {
  return fromRoute(t, 'learn');
}
