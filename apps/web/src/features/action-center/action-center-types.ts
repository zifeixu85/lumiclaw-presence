import type {AppLocale} from '@lumiclaw/i18n';

export const actionCenterStateCodes = [
  'GRANT_READY',
  'GRANT_ISSUED',
  'OWNER_ACTION_REQUIRED',
  'PUBLISHED',
  'UNKNOWN',
  'FAILED',
  'EXPIRED',
  'REVOKED'
] as const;

export type ActionCenterStateCode = (typeof actionCenterStateCodes)[number];

export const actionCenterModes = ['DIRECT', 'HANDOFF', 'PREPARE_ONLY'] as const;
export type ActionCenterMode = (typeof actionCenterModes)[number];

export type ActionCenterClaimMaturity =
  | 'IMPLEMENTED'
  | 'ENGINEERING_VERIFIED'
  | 'EXTERNAL_CALIBRATED'
  | 'BUSINESS_VERIFIED'
  | 'PLANNED'
  | 'NOT_CLAIMED';

export const actionCenterIntentCodes = [
  'REQUEST_GRANT_ISSUANCE',
  'MONITOR_EXISTING_GRANT',
  'RECORD_HANDOFF_EVIDENCE',
  'INSPECT_NATIVE_RECEIPT',
  'START_RECONCILIATION',
  'REQUEST_NEW_CONTROLLED_ATTEMPT',
  'RETURN_TO_EXACT_REVIEW',
  'INSPECT_REVOCATION'
] as const;

export type ActionCenterIntentCode = (typeof actionCenterIntentCodes)[number];

export const actionTimelineKinds = [
  'OWNER_REVIEW_RECORDED',
  'GRANT_READY',
  'GRANT_ISSUED',
  'OPERATOR_ACCEPTED',
  'HANDOFF_PACKAGE_READY',
  'OWNER_EVIDENCE_REQUIRED',
  'NATIVE_EVIDENCE_CONFIRMED',
  'OUTCOME_UNKNOWN',
  'RECONCILIATION_REQUIRED',
  'ACTION_FAILED',
  'GRANT_EXPIRED',
  'GRANT_REVOKED'
] as const;

export type ActionTimelineKind = (typeof actionTimelineKinds)[number];

export type ExactOwnerReviewSummary = {
  revisionId: string;
  revisionVersion: number;
  revisionDigest: string;
  accountLabel: string;
  accountId: string;
  intendedAction: string;
  auditEvidenceCode: string;
  ownerDecisionCode: string;
  reviewedAt: string;
  authorizationExpiresAt: string;
};

export type ActionGrantSummary = {
  id: string;
  digest: string;
  status: 'ISSUED' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  issuedAt: string;
  expiresAt: string;
  revocationReasonCode?: string;
};

export type ActionExecutionSummary = {
  platform: 'X' | 'BLUESKY' | 'LINKEDIN' | 'XIAOHONGSHU' | 'UNKNOWN';
  actionLabel: string;
  contentLanguage: string;
  targetMarket: string;
  scheduleTimeZone: string;
  handoffSteps?: string[];
};

export type ActionTimelineEvent = {
  id: string;
  kind: ActionTimelineKind;
  occurredAt: string;
  evidenceCode: string;
};

export type NativeActionEvidence = {
  receiptId: string;
  publicReference: string;
  evidenceKind: 'NATIVE_URI' | 'OWNER_RETURNED_URL' | 'APPROVED_SAFE_EVIDENCE';
  confirmedAt: string;
};

export type ReconciliationSummary = {
  reasonCode: string;
  methods: ('PLATFORM_QUERY' | 'OWNER_MANUAL')[];
  blindRetryAllowed: false;
};

export type ActionCenterViewModel = {
  state: ActionCenterStateCode;
  mode: ActionCenterMode;
  claimMaturity: ActionCenterClaimMaturity;
  environmentLabel: 'UI_FOUNDATION_NOT_LIVE' | 'CONTROL_PLANE';
  isLive: boolean;
  externalActionAllowed: boolean;
  source: 'PUBLIC_SAFE_FIXTURE' | 'EXPERIMENTAL_ADAPTER';
  uiLocale: AppLocale;
  review: ExactOwnerReviewSummary;
  grant?: ActionGrantSummary;
  execution: ActionExecutionSummary;
  timeline: ActionTimelineEvent[];
  nativeEvidence?: NativeActionEvidence;
  reconciliation?: ReconciliationSummary;
};

export type ActionCenterIntent = {
  code: ActionCenterIntentCode;
  state: ActionCenterStateCode;
  revisionId: string;
  revisionDigest: string;
  grantId?: string;
};

export type ActionCenterActionAvailability = {
  available: boolean;
  reason:
    | 'AVAILABLE'
    | 'UI_INTENT_HANDLER_UNAVAILABLE'
    | 'EXACT_SCOPE_CONFIRMATION_REQUIRED'
    | 'MODEL_INVARIANT_VIOLATION';
};
