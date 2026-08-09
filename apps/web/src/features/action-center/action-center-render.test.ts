import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {getActionCenterCopy} from './action-center-copy';
import {createActionCenterFixture} from './action-center-fixtures';

const componentSource = readFileSync(new URL('./action-center.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

describe('Action Center accessible render contract', () => {
  it('keeps exact review, grant, execution, and receipt as semantic regions', () => {
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain('aria-live="polite"');
    expect(componentSource).toContain('<EvidenceCard index="02" title={copy.sections.exactReview}');
    expect(componentSource).toContain('<EvidenceCard index="03" title={copy.sections.grant}');
    expect(componentSource).toContain('<ExecutionCard model={model} copy={copy} />');
    expect(componentSource).toContain('<ReceiptTimeline events={model.timeline} model={model} copy={copy} />');
    const model = createActionCenterFixture('GRANT_ISSUED');
    expect(model.execution.scheduleTimeZone).toBe('Asia/Singapore');
    expect(model.uiLocale).toBe('zh-CN');
  });

  it('has UNKNOWN reconciliation copy without a retry action', () => {
    const copy = getActionCenterCopy('zh-CN');
    expect(copy.sections.reconciliation).toContain('UNKNOWN');
    expect(copy.unknownFixed).toContain('系统不会重复发布');
    expect(copy.actions.START_RECONCILIATION).toBe('开始对账');
    expect(copy.states.UNKNOWN.next).not.toContain('重试');
    expect(componentSource).toContain("model.state === 'UNKNOWN'");
  });

  it('represents incomplete Handoff as owner action required without native evidence', () => {
    const model = createActionCenterFixture('OWNER_ACTION_REQUIRED');
    expect(model.state).toBe('OWNER_ACTION_REQUIRED');
    expect(model.mode).toBe('HANDOFF');
    expect(model.nativeEvidence).toBeUndefined();
    expect(getActionCenterCopy('zh-CN').noNativeEvidence).toContain('不能显示为已发布');
  });

  it('uses native keyboard controls, visible focus, and disabled reasons', () => {
    expect(componentSource).toContain('type="checkbox"');
    expect(componentSource).toContain('type="button"');
    expect(componentSource).toContain('disabled={!availability.available}');
    expect(componentSource).toContain('aria-describedby={disabledReason === undefined ? undefined : disabledReasonId}');
    expect(cssSource).toContain(':where(button, input):focus-visible');
    expect(cssSource).toContain('outline: 3px solid var(--action-focus)');
  });

  it('keeps the route foundation non-live and handler-gated', () => {
    const model = createActionCenterFixture('PUBLISHED');
    expect(model.environmentLabel).toBe('UI_FOUNDATION_NOT_LIVE');
    expect(model.externalActionAllowed).toBe(false);
    expect(getActionCenterCopy('zh-CN').actionUnavailable).toContain('没有接入任何动作处理器');
    expect(componentSource).toContain('hasIntentHandler: onIntent !== undefined');
  });
});
