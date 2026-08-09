import type {AppLocale} from '@lumiclaw/i18n';
import {assertActionCenterModel} from './action-center-policy';
import {createActionCenterFixture} from './action-center-fixtures';
import type {
  ActionCenterMode,
  ActionCenterStateCode,
  ActionCenterViewModel,
  ActionGrantSummary,
  ActionTimelineEvent,
  NativeActionEvidence
} from './action-center-types';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return undefined;
  return value as string[];
}

function candidateReceipt(root: UnknownRecord): UnknownRecord | undefined {
  const direct = record(root.receipt);
  if (direct !== undefined) return direct;
  const receipts = root.receipts;
  return Array.isArray(receipts) ? record(receipts[0]) : undefined;
}

function candidateMode(grant: UnknownRecord | undefined, receipt: UnknownRecord | undefined): ActionCenterMode | undefined {
  const value = string(grant?.executionMode) ?? string(receipt?.executionMode);
  if (value === 'DIRECT') return 'DIRECT';
  if (value === 'NATIVE_HANDOFF' || value === 'HANDOFF') return 'HANDOFF';
  return undefined;
}

function candidateNativeEvidence(receipt: UnknownRecord | undefined): NativeActionEvidence | undefined {
  if (receipt === undefined) return undefined;
  const publicReference = string(receipt.platformUri) ?? string(receipt.handoffEvidenceUrl) ?? string(receipt.publicReference);
  const confirmedAt = string(receipt.reconciledAt) ?? string(receipt.confirmedAt) ?? string(receipt.createdAt);
  if (publicReference === undefined || confirmedAt === undefined) return undefined;
  return {
    receiptId: string(receipt.id) ?? 'adapter-receipt-reference',
    publicReference,
    evidenceKind: string(receipt.platformUri) !== undefined ? 'NATIVE_URI' : 'OWNER_RETURNED_URL',
    confirmedAt
  };
}

function candidateState(
  grant: UnknownRecord | undefined,
  receipt: UnknownRecord | undefined,
  mode: ActionCenterMode,
  nativeEvidence: NativeActionEvidence | undefined
): ActionCenterStateCode {
  const grantStatus = string(grant?.status);
  if (grantStatus === 'EXPIRED') return 'EXPIRED';
  if (grantStatus === 'REVOKED') return 'REVOKED';

  const receiptState = string(receipt?.state);
  if (receiptState === 'UNKNOWN') return 'UNKNOWN';
  if (receiptState === 'FAILED') return 'FAILED';
  if (receiptState === 'HANDOFF_CONFIRMED') {
    return nativeEvidence === undefined ? 'OWNER_ACTION_REQUIRED' : 'PUBLISHED';
  }
  if (receiptState === 'PUBLISHED') {
    if (nativeEvidence !== undefined) return 'PUBLISHED';
    return mode === 'HANDOFF' ? 'OWNER_ACTION_REQUIRED' : 'UNKNOWN';
  }
  if (mode === 'HANDOFF' && stringArray(receipt?.handoffSteps) !== undefined) return 'OWNER_ACTION_REQUIRED';
  if (grantStatus === 'ISSUED' || grantStatus === 'CONSUMED') return 'GRANT_ISSUED';
  return 'GRANT_READY';
}

function candidateGrant(grant: UnknownRecord | undefined): ActionGrantSummary | undefined {
  if (grant === undefined) return undefined;
  const status = string(grant.status);
  if (status !== 'ISSUED' && status !== 'CONSUMED' && status !== 'EXPIRED' && status !== 'REVOKED') return undefined;
  const revocationReasonCode = string(grant.revocationReason);
  return {
    id: string(grant.id) ?? 'adapter-grant-reference',
    digest: string(grant.grantDigest) ?? 'ADAPTER_GRANT_DIGEST_UNAVAILABLE',
    status,
    issuedAt: string(grant.issuedAt) ?? '1970-01-01T00:00:00.000Z',
    expiresAt: string(grant.expiresAt) ?? '1970-01-01T00:00:00.000Z',
    ...(revocationReasonCode === undefined ? {} : {revocationReasonCode})
  };
}

function adapterTimeline(state: ActionCenterStateCode, fallback: ActionCenterViewModel): ActionTimelineEvent[] {
  const terminalKind = {
    GRANT_READY: 'GRANT_READY',
    GRANT_ISSUED: 'GRANT_ISSUED',
    OWNER_ACTION_REQUIRED: 'OWNER_EVIDENCE_REQUIRED',
    PUBLISHED: 'NATIVE_EVIDENCE_CONFIRMED',
    UNKNOWN: 'RECONCILIATION_REQUIRED',
    FAILED: 'ACTION_FAILED',
    EXPIRED: 'GRANT_EXPIRED',
    REVOKED: 'GRANT_REVOKED'
  } as const;
  return [
    fallback.timeline[0] ?? {
      id: 'adapter-owner-review',
      kind: 'OWNER_REVIEW_RECORDED',
      occurredAt: fallback.review.reviewedAt,
      evidenceCode: fallback.review.ownerDecisionCode
    },
    {
      id: `adapter-state-${state.toLowerCase()}`,
      kind: terminalKind[state],
      occurredAt: fallback.grant?.issuedAt ?? fallback.review.reviewedAt,
      evidenceCode: `ADAPTER_${state}`
    }
  ];
}

/**
 * Experimental anti-corruption adapter for an unfrozen M3 transport.
 *
 * It intentionally accepts `unknown`, imports no backend action type, and treats
 * candidate field names as disposable hints. A frozen API SDD must replace this
 * boundary before any live mutation can be wired.
 */
export function adaptExperimentalActionCenterSnapshot(
  input: unknown,
  uiLocale: AppLocale = 'zh-CN'
): ActionCenterViewModel {
  const root = record(input);
  const fallback = createActionCenterFixture('GRANT_READY', uiLocale);
  if (root === undefined) {
    const unknownModel: ActionCenterViewModel = {
      ...createActionCenterFixture('UNKNOWN', uiLocale),
      source: 'EXPERIMENTAL_ADAPTER',
      reconciliation: {
        reasonCode: 'ADAPTER_SNAPSHOT_INVALID',
        methods: ['OWNER_MANUAL'],
        blindRetryAllowed: false
      }
    };
    assertActionCenterModel(unknownModel);
    return unknownModel;
  }

  const grantRecord = record(root.grant);
  const receiptRecord = candidateReceipt(root);
  const modeSignal = candidateMode(grantRecord, receiptRecord);
  const candidateExecutionMode = modeSignal ?? 'PREPARE_ONLY';
  const nativeEvidence = candidateNativeEvidence(receiptRecord);
  const candidateStateCode = candidateState(grantRecord, receiptRecord, candidateExecutionMode, nativeEvidence);
  const missingRequiredMode = modeSignal === undefined && candidateStateCode !== 'GRANT_READY' && candidateStateCode !== 'FAILED';
  const state = missingRequiredMode ? 'UNKNOWN' : candidateStateCode;
  const mode: ActionCenterMode = state === 'OWNER_ACTION_REQUIRED'
    ? 'HANDOFF'
    : state === 'FAILED' && modeSignal === undefined
      ? 'PREPARE_ONLY'
      : modeSignal ?? 'DIRECT';
  const grantSummary = candidateGrant(grantRecord);
  const handoffSteps = stringArray(receiptRecord?.handoffSteps);

  const model: ActionCenterViewModel = {
    ...fallback,
    state,
    mode,
    environmentLabel: 'UI_FOUNDATION_NOT_LIVE',
    isLive: false,
    externalActionAllowed: false,
    source: 'EXPERIMENTAL_ADAPTER',
    ...(grantSummary === undefined ? {} : {grant: grantSummary}),
    execution: {
      ...fallback.execution,
      platform: string(grantRecord?.platform) === 'X' || string(grantRecord?.platform) === 'BLUESKY' || string(grantRecord?.platform) === 'LINKEDIN' || string(grantRecord?.platform) === 'XIAOHONGSHU'
        ? string(grantRecord?.platform) as ActionCenterViewModel['execution']['platform']
        : fallback.execution.platform,
      actionLabel: mode === 'HANDOFF' ? 'NATIVE_HANDOFF' : mode === 'DIRECT' ? 'DIRECT_ACTION' : 'PREPARE_ONLY',
      ...(handoffSteps === undefined ? {} : {handoffSteps})
    },
    timeline: adapterTimeline(state, fallback),
    ...(nativeEvidence === undefined ? {} : {nativeEvidence}),
    ...(state === 'UNKNOWN' ? {
      reconciliation: {
        reasonCode: missingRequiredMode ? 'ADAPTER_EXECUTION_MODE_UNSUPPORTED' : string(receiptRecord?.unknownReason) ?? 'ADAPTER_OUTCOME_NOT_CONFIRMED',
        methods: ['PLATFORM_QUERY', 'OWNER_MANUAL'],
        blindRetryAllowed: false
      }
    } : {})
  };
  assertActionCenterModel(model);
  return model;
}
