import type {AppLocale} from '@lumiclaw/i18n';
import en from '../../../messages/en.json';
import zhCN from '../../../messages/zh-CN.json';

type StringShape<T> = T extends string
  ? string
  : T extends Record<string, unknown>
    ? {[K in keyof T]: StringShape<T[K]>}
    : never;

export type ActionCenterCopy = StringShape<typeof zhCN.ActionCenter>;

const actionCenterCatalogs: Record<AppLocale, ActionCenterCopy> = {
  'zh-CN': zhCN.ActionCenter,
  en: en.ActionCenter
};

export function getActionCenterCopy(locale: AppLocale): ActionCenterCopy {
  return actionCenterCatalogs[locale];
}
