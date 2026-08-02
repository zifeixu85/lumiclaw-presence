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
};

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
  return {
    eyebrow: t('campaigns.eyebrow'),
    title: t('campaigns.title'),
    summary: t('campaigns.summary'),
    status: t('campaigns.status'),
    basis: t('campaigns.basis'),
    next: t('campaigns.next')
  };
}

function fromSetup(t: Translator): ScreenCopy {
  return {
    eyebrow: t('setup.eyebrow'),
    title: t('setup.title'),
    summary: t('setup.summary'),
    status: t('setup.status'),
    basis: t('setup.basis'),
    next: t('setup.next')
  };
}

function fromMission(t: Translator): ScreenCopy {
  return {
    eyebrow: t('mission.eyebrow'),
    title: t('mission.title'),
    summary: t('mission.summary'),
    status: t('mission.status'),
    basis: t('mission.basis'),
    next: t('mission.next')
  };
}

function fromReview(t: Translator): ScreenCopy {
  return {
    eyebrow: t('review.eyebrow'),
    title: t('review.title'),
    summary: t('review.summary'),
    status: t('review.status'),
    basis: t('review.basis'),
    next: t('review.next')
  };
}

function fromLearn(t: Translator): ScreenCopy {
  return {
    eyebrow: t('learn.eyebrow'),
    title: t('learn.title'),
    summary: t('learn.summary'),
    status: t('learn.status'),
    basis: t('learn.basis'),
    next: t('learn.next')
  };
}
