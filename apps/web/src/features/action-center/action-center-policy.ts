import type {
  ActionCenterActionAvailability,
  ActionCenterIntentCode,
  ActionCenterMode,
  ActionCenterStateCode,
  ActionCenterViewModel
} from './action-center-types';

export type ActionCenterStatePolicy = {
  intent: ActionCenterIntentCode;
  retryAllowed: boolean;
  dangerous: boolean;
  requiresExactScopeConfirmation: boolean;
  allowedModes: readonly ActionCenterMode[];
  tone: 'ready' | 'active' | 'owner' | 'success' | 'unknown' | 'failure' | 'terminal';
};

export const actionCenterStatePolicies = {
  GRANT_READY: {
    intent: 'REQUEST_GRANT_ISSUANCE',
    retryAllowed: false,
    dangerous: true,
    requiresExactScopeConfirmation: true,
    allowedModes: ['DIRECT', 'HANDOFF', 'PREPARE_ONLY'],
    tone: 'ready'
  },
  GRANT_ISSUED: {
    intent: 'MONITOR_EXISTING_GRANT',
    retryAllowed: false,
    dangerous: false,
    requiresExactScopeConfirmation: false,
    allowedModes: ['DIRECT', 'HANDOFF'],
    tone: 'active'
  },
  OWNER_ACTION_REQUIRED: {
    intent: 'RECORD_HANDOFF_EVIDENCE',
    retryAllowed: false,
    dangerous: false,
    requiresExactScopeConfirmation: false,
    allowedModes: ['HANDOFF'],
    tone: 'owner'
  },
  PUBLISHED: {
    intent: 'INSPECT_NATIVE_RECEIPT',
    retryAllowed: false,
    dangerous: false,
    requiresExactScopeConfirmation: false,
    allowedModes: ['DIRECT', 'HANDOFF'],
    tone: 'success'
  },
  UNKNOWN: {
    intent: 'START_RECONCILIATION',
    retryAllowed: false,
    dangerous: false,
    requiresExactScopeConfirmation: false,
    allowedModes: ['DIRECT', 'HANDOFF'],
    tone: 'unknown'
  },
  FAILED: {
    intent: 'REQUEST_NEW_CONTROLLED_ATTEMPT',
    retryAllowed: true,
    dangerous: true,
    requiresExactScopeConfirmation: true,
    allowedModes: ['DIRECT', 'HANDOFF', 'PREPARE_ONLY'],
    tone: 'failure'
  },
  EXPIRED: {
    intent: 'RETURN_TO_EXACT_REVIEW',
    retryAllowed: false,
    dangerous: false,
    requiresExactScopeConfirmation: false,
    allowedModes: ['DIRECT', 'HANDOFF'],
    tone: 'terminal'
  },
  REVOKED: {
    intent: 'INSPECT_REVOCATION',
    retryAllowed: false,
    dangerous: false,
    requiresExactScopeConfirmation: false,
    allowedModes: ['DIRECT', 'HANDOFF'],
    tone: 'terminal'
  }
} as const satisfies Record<ActionCenterStateCode, ActionCenterStatePolicy>;

export function policyForActionCenterState(state: ActionCenterStateCode): ActionCenterStatePolicy {
  return actionCenterStatePolicies[state];
}

export function actionCenterActionAvailability(
  model: ActionCenterViewModel,
  context: {hasIntentHandler: boolean; exactScopeConfirmed: boolean}
): ActionCenterActionAvailability {
  const policy = policyForActionCenterState(model.state);
  if (!policy.allowedModes.includes(model.mode)) {
    return {available: false, reason: 'MODEL_INVARIANT_VIOLATION'};
  }
  if (!context.hasIntentHandler) {
    return {available: false, reason: 'UI_INTENT_HANDLER_UNAVAILABLE'};
  }
  if (policy.requiresExactScopeConfirmation && !context.exactScopeConfirmed) {
    return {available: false, reason: 'EXACT_SCOPE_CONFIRMATION_REQUIRED'};
  }
  return {available: true, reason: 'AVAILABLE'};
}

export function assertActionCenterModel(model: ActionCenterViewModel): void {
  const policy = policyForActionCenterState(model.state);
  if (!policy.allowedModes.includes(model.mode)) {
    throw new Error(`ACTION_CENTER_MODE_INVALID:${model.state}:${model.mode}`);
  }
  if (model.state === 'UNKNOWN') {
    if (model.reconciliation?.blindRetryAllowed !== false) {
      throw new Error('ACTION_CENTER_UNKNOWN_RECONCILIATION_REQUIRED');
    }
    if (policy.retryAllowed) throw new Error('ACTION_CENTER_UNKNOWN_RETRY_FORBIDDEN');
  }
  if (model.state === 'PUBLISHED' && model.nativeEvidence === undefined) {
    throw new Error('ACTION_CENTER_PUBLISHED_EVIDENCE_REQUIRED');
  }
  if (model.state === 'OWNER_ACTION_REQUIRED' && model.mode !== 'HANDOFF') {
    throw new Error('ACTION_CENTER_OWNER_ACTION_REQUIRES_HANDOFF');
  }
  if ((model.state === 'EXPIRED' || model.state === 'REVOKED') && policy.retryAllowed) {
    throw new Error('ACTION_CENTER_TERMINAL_RETRY_FORBIDDEN');
  }
}
