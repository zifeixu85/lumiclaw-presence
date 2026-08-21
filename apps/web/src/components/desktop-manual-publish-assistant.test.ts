import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {activationEvidenceCopy, manualPublishEvidenceItems, safetyBlockEvidence} from './activation-evidence-fixture.js';
import {DesktopManualPublishAssistant} from './desktop-manual-publish-assistant.js';

describe('SDD-004 CR1 desktop evidence DOM', () => {
  it.each(['zh-CN', 'en'] as const)('renders the single manual desktop path in %s without an executable surface', (locale) => {
    const html = renderToStaticMarkup(createElement(DesktopManualPublishAssistant, {
      locale,
      copy: activationEvidenceCopy(locale),
      items: manualPublishEvidenceItems,
      blocks: safetyBlockEvidence
    }));
    expect((html.match(/data-platform=/gu) ?? [])).toHaveLength(6);
    expect(html).toContain('MANUAL_DESKTOP_ASSISTANT');
    expect(html).toContain('CAPABILITY_EXPIRED');
    expect(html).toContain('ACCOUNT_MISMATCH');
    expect(html).toContain('CAPABILITY_ID_MISMATCH');
    expect(html).not.toMatch(/<a\b|href=|<form\b|<input\b|<button\b|onClick=|>PUBLISHED<|HANDOFF_RECONCILED/iu);
    expect(html).not.toMatch(/Platform-ready|Assisted Handoff|Governed Direct|一键发布|自动发布/iu);
  });

  it('keeps Chinese user language focused on copy, download, open, manual completion and awaiting reconciliation', () => {
    const html = renderToStaticMarkup(createElement(DesktopManualPublishAssistant, {
      locale: 'zh-CN',
      copy: activationEvidenceCopy('zh-CN'),
      items: manualPublishEvidenceItems,
      blocks: safetyBlockEvidence
    }));
    for (const text of ['去发布', '预期账号', '精确版本', '复制正文', '复制/下载图片', '打开官方发布页', '人工完成', '等待系统核对', '不重新发布']) expect(html).toContain(text);
    expect(html).not.toMatch(/URL 输入|移动端|Native Share/iu);
  });
});
