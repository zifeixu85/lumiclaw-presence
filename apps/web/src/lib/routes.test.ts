import {describe, expect, it} from 'vitest';
import en from '../../messages/en.json';
import zh from '../../messages/zh-CN.json';
import {defaultLocale, routeIds} from '@lumiclaw/i18n';
import {routing} from '../i18n/routing';

describe('product shell route contract', () => {
  it('has exactly five stable route IDs and Chinese default', () => {
    expect(defaultLocale).toBe('zh-CN');
    expect(routeIds).toEqual(['campaigns', 'setup', 'mission', 'review', 'learn']);
    expect(routing.localeDetection).toBe(false);
  });

  it('marks both locales as non-live', () => {
    expect(en.Shell.mode).toBe('DEMO_SEED / NOT_LIVE');
    expect(zh.Shell.mode).toBe('DEMO_SEED / NOT_LIVE');
  });

  it('describes all four platform baselines without published state', () => {
    const platformLabels = Object.values(zh.Mission.platforms);
    expect(platformLabels).toHaveLength(4);
    expect(platformLabels.join(' ')).not.toContain('PUBLISHED');
  });
});
