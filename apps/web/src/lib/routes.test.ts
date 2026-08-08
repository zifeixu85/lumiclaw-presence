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
    expect(en.Shell.mode).toContain('DEMO_SEED / NOT_LIVE');
    expect(zh.Shell.mode).toContain('DEMO_SEED / NOT_LIVE');
  });

  it('describes all four platform baselines without published state', () => {
    const platformLabels = Object.values(zh.Mission.platforms);
    expect(platformLabels).toHaveLength(4);
    expect(platformLabels.join(' ')).not.toContain('PUBLISHED');
  });

  it('keeps engineering terminology out of primary Chinese customer copy', () => {
    const primaryCopy = JSON.stringify({
      shell: {
        category: zh.Shell.category,
        milestone: zh.Shell.milestone,
        evidenceLabel: zh.Shell.evidenceLabel,
        evidenceValue: zh.Shell.evidenceValue,
        journeyLabel: zh.Shell.journeyLabel,
        ownerLabel: zh.Shell.ownerLabel,
        footer: zh.Shell.footer,
        nav: zh.Shell.nav
      },
      screens: Object.fromEntries(
        Object.entries(zh.Screens).map(([id, screen]) => [id, {
          eyebrow: screen.eyebrow,
          title: screen.title,
          summary: screen.summary,
          status: screen.status,
          basis: screen.basis,
          next: screen.next,
          previewTitle: screen.previewTitle,
          previewItems: screen.previewItems
        }])
      ),
      mission: zh.Mission
    });
    expect(primaryCopy).not.toMatch(/SDD|M0|M1|Adapter|Agent turn|Campaign|Claim|AccountMandate|Revision|Audit|OwnerDecision|ActionGrant|Receipt|Fixture|ActivationUnit|Composer|Coordinator/u);
  });
});
