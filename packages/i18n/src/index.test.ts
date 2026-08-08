import {describe, expect, it} from 'vitest';
import {defaultLocale, foundationStates, isLocale, isRouteId, routeIds} from './index.js';

describe('stable i18n foundation codes', () => {
  it('keeps Chinese as default without translating route IDs', () => {
    expect(defaultLocale).toBe('zh-CN');
    expect(routeIds).toEqual(['campaigns', 'setup', 'mission', 'review', 'learn']);
    expect(isRouteId('任务空间')).toBe(false);
  });

  it('accepts only the initial locale contract', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('zh-CN')).toBe(true);
    expect(isLocale('zh')).toBe(false);
    expect(foundationStates).toContain('UNKNOWN_RECONCILIATION_REQUIRED');
  });
});
