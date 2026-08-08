import type zhMessages from '../messages/zh-CN.json';
import type {AppLocale} from '@lumiclaw/i18n';

declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof zhMessages;
  }
}
