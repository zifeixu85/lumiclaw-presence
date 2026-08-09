import {describe, expect, it} from 'vitest';
import {
  actionCenterActionAvailability,
  actionCenterStatePolicies,
  assertActionCenterModel,
  policyForActionCenterState
} from './action-center-policy';
import {createActionCenterFixture, createAllActionCenterFixtures} from './action-center-fixtures';
import {actionCenterStateCodes} from './action-center-types';

describe('Action Center state policy', () => {
  it('covers all eight states with one unique next intent and an explicit retry policy', () => {
    const fixtures = createAllActionCenterFixtures();
    expect(fixtures.map((fixture) => fixture.state)).toEqual(actionCenterStateCodes);
    const policies = fixtures.map((fixture) => policyForActionCenterState(fixture.state));
    expect(new Set(policies.map((policy) => policy.intent)).size).toBe(actionCenterStateCodes.length);
    expect(policies.every((policy) => typeof policy.retryAllowed === 'boolean')).toBe(true);
    expect(fixtures.every((fixture) => fixture.claimMaturity === 'IMPLEMENTED')).toBe(true);
    expect(fixtures.every((fixture) => fixture.externalActionAllowed === false && fixture.isLive === false)).toBe(true);
    expect(Object.keys(actionCenterStatePolicies).sort()).toEqual([...actionCenterStateCodes].sort());
  });

  it('allows retry only as a newly controlled attempt after a definitive failure', () => {
    for (const state of actionCenterStateCodes) {
      const policy = policyForActionCenterState(state);
      expect(policy.retryAllowed).toBe(state === 'FAILED');
      if (state === 'FAILED') expect(policy.intent).toBe('REQUEST_NEW_CONTROLLED_ATTEMPT');
      if (state === 'UNKNOWN') expect(policy.intent).toBe('START_RECONCILIATION');
    }
  });

  it('keeps a dangerous issuance unavailable until scope confirmation and a handler both exist', () => {
    const ready = createActionCenterFixture('GRANT_READY');
    expect(actionCenterActionAvailability(ready, {hasIntentHandler: false, exactScopeConfirmed: true})).toEqual({
      available: false,
      reason: 'UI_INTENT_HANDLER_UNAVAILABLE'
    });
    expect(actionCenterActionAvailability(ready, {hasIntentHandler: true, exactScopeConfirmed: false})).toEqual({
      available: false,
      reason: 'EXACT_SCOPE_CONFIRMATION_REQUIRED'
    });
    expect(actionCenterActionAvailability(ready, {hasIntentHandler: true, exactScopeConfirmed: true})).toEqual({
      available: true,
      reason: 'AVAILABLE'
    });
  });

  it('rejects optimistic published and UNKNOWN retry invariants', () => {
    const published = createActionCenterFixture('PUBLISHED');
    const publishedWithoutEvidence = structuredClone(published);
    delete publishedWithoutEvidence.nativeEvidence;
    expect(() => assertActionCenterModel(publishedWithoutEvidence)).toThrow('ACTION_CENTER_PUBLISHED_EVIDENCE_REQUIRED');
    const unknown = createActionCenterFixture('UNKNOWN');
    const unknownWithoutReconciliation = structuredClone(unknown);
    delete unknownWithoutReconciliation.reconciliation;
    expect(() => assertActionCenterModel(unknownWithoutReconciliation)).toThrow('ACTION_CENTER_UNKNOWN_RECONCILIATION_REQUIRED');
  });
});
