import {describe, expect, it} from 'vitest';
import {adaptExperimentalActionCenterSnapshot} from './action-center-adapter';
import {policyForActionCenterState} from './action-center-policy';

describe('experimental Action Center adapter', () => {
  it('fails an invalid or unsupported transport snapshot to UNKNOWN with no blind retry', () => {
    const model = adaptExperimentalActionCenterSnapshot('not-an-object');
    expect(model.state).toBe('UNKNOWN');
    expect(model.source).toBe('EXPERIMENTAL_ADAPTER');
    expect(model.externalActionAllowed).toBe(false);
    expect(model.reconciliation?.blindRetryAllowed).toBe(false);
    expect(policyForActionCenterState(model.state).retryAllowed).toBe(false);
  });

  it('maps an ambiguous connector result to reconciliation, never retry', () => {
    const model = adaptExperimentalActionCenterSnapshot({
      live: true,
      externalActionAllowed: true,
      grant: {status: 'ISSUED', executionMode: 'DIRECT', platform: 'BLUESKY'},
      receipt: {state: 'UNKNOWN', unknownReason: 'NETWORK_RESPONSE_LOST'}
    });
    expect(model.state).toBe('UNKNOWN');
    expect(model.isLive).toBe(false);
    expect(model.externalActionAllowed).toBe(false);
    expect(model.reconciliation?.reasonCode).toBe('NETWORK_RESPONSE_LOST');
    expect(policyForActionCenterState(model.state).intent).toBe('START_RECONCILIATION');
  });

  it('fails an issued Grant with no recognized execution mode to UNKNOWN', () => {
    const model = adaptExperimentalActionCenterSnapshot({grant: {status: 'ISSUED', platform: 'BLUESKY'}});
    expect(model.state).toBe('UNKNOWN');
    expect(model.reconciliation?.reasonCode).toBe('ADAPTER_EXECUTION_MODE_UNSUPPORTED');
    expect(model.externalActionAllowed).toBe(false);
  });

  it('downgrades a Handoff PUBLISHED signal without returned evidence', () => {
    const model = adaptExperimentalActionCenterSnapshot({
      grant: {status: 'ISSUED', executionMode: 'NATIVE_HANDOFF', platform: 'LINKEDIN'},
      receipt: {state: 'PUBLISHED', handoffSteps: ['COPY', 'OPEN_NATIVE_APP', 'RETURN_URL']}
    });
    expect(model.mode).toBe('HANDOFF');
    expect(model.state).toBe('OWNER_ACTION_REQUIRED');
    expect(model.nativeEvidence).toBeUndefined();
  });

  it('accepts a reconciled Handoff as PUBLISHED only with returned native evidence', () => {
    const model = adaptExperimentalActionCenterSnapshot({
      grant: {status: 'CONSUMED', executionMode: 'NATIVE_HANDOFF', platform: 'LINKEDIN'},
      receipt: {
        id: 'candidate-receipt',
        state: 'HANDOFF_CONFIRMED',
        handoffEvidenceUrl: 'https://example.invalid/public-safe-handoff',
        reconciledAt: '2026-08-10T03:00:00.000Z'
      }
    });
    expect(model.state).toBe('PUBLISHED');
    expect(model.nativeEvidence?.evidenceKind).toBe('OWNER_RETURNED_URL');
  });

  it('preserves terminal Grant states without exposing retry', () => {
    for (const status of ['EXPIRED', 'REVOKED'] as const) {
      const model = adaptExperimentalActionCenterSnapshot({grant: {status, executionMode: 'DIRECT'}});
      expect(model.state).toBe(status);
      expect(policyForActionCenterState(model.state).retryAllowed).toBe(false);
    }
  });
});
