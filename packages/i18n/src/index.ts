export const locales = ['zh-CN', 'en'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'zh-CN';

export const routeIds = ['campaigns', 'setup', 'mission', 'review', 'learn'] as const;
export type RouteId = (typeof routeIds)[number];

export const foundationStates = [
  'NEEDS_INPUT',
  'PREPARING',
  'NEEDS_REVIEW',
  'BLOCKED',
  'NEEDS_OWNER',
  'UNKNOWN_RECONCILIATION_REQUIRED',
  'FOUNDATION_READY'
] as const;
export type FoundationState = (typeof foundationStates)[number];

export function isLocale(value: string): value is AppLocale {
  return locales.some((locale) => locale === value);
}

export function isRouteId(value: string): value is RouteId {
  return routeIds.some((routeId) => routeId === value);
}
