import type {AppLocale} from '@lumiclaw/i18n';
import {assertActionCenterModel} from './action-center-policy';
import type {
  ActionCenterMode,
  ActionCenterStateCode,
  ActionCenterViewModel,
  ActionGrantSummary,
  ActionTimelineEvent
} from './action-center-types';

const fixtureNow = '2026-08-10T02:00:00.000Z';
const fixtureDigest = '7c1e0c3b2e46573313db90ef9b87b4bf1d8be87a9924f8e1d1b739c04173b0a4';
const fixtureGrantDigest = '9e77be1ea5a318a64bdc6706166c65b24805e6f20ed20a1469b871830086295f';

function event(kind: ActionTimelineEvent['kind'], minute: number, evidenceCode: string): ActionTimelineEvent {
  return {
    id: `fixture-event-${String(minute).padStart(2, '0')}-${kind.toLowerCase()}`,
    kind,
    occurredAt: `2026-08-10T02:${String(minute).padStart(2, '0')}:00.000Z`,
    evidenceCode
  };
}

function grant(status: ActionGrantSummary['status']): ActionGrantSummary {
  return {
    id: 'fixture-grant-public-safe-001',
    digest: fixtureGrantDigest,
    status,
    issuedAt: '2026-08-10T02:02:00.000Z',
    expiresAt: '2026-08-10T02:17:00.000Z',
    ...(status === 'REVOKED' ? {revocationReasonCode: 'OWNER_SCOPE_WITHDRAWN'} : {})
  };
}

function stateMode(state: ActionCenterStateCode): ActionCenterMode {
  if (state === 'OWNER_ACTION_REQUIRED' || state === 'REVOKED') return 'HANDOFF';
  if (state === 'FAILED') return 'PREPARE_ONLY';
  return 'DIRECT';
}

function stateGrant(state: ActionCenterStateCode): ActionGrantSummary | undefined {
  if (state === 'GRANT_READY' || state === 'FAILED') return undefined;
  if (state === 'EXPIRED') return grant('EXPIRED');
  if (state === 'REVOKED') return grant('REVOKED');
  if (state === 'PUBLISHED') return grant('CONSUMED');
  return grant('ISSUED');
}

function stateTimeline(state: ActionCenterStateCode): ActionTimelineEvent[] {
  const base = [
    event('OWNER_REVIEW_RECORDED', 0, 'FIXTURE_OWNER_REVIEW_EXACT'),
    event('GRANT_READY', 1, 'FIXTURE_SCOPE_READY')
  ];
  switch (state) {
    case 'GRANT_READY':
      return base;
    case 'GRANT_ISSUED':
      return [...base, event('GRANT_ISSUED', 2, 'FIXTURE_GRANT_ISSUED')];
    case 'OWNER_ACTION_REQUIRED':
      return [...base, event('GRANT_ISSUED', 2, 'FIXTURE_HANDOFF_GRANT'), event('HANDOFF_PACKAGE_READY', 3, 'FIXTURE_PACKAGE_READY'), event('OWNER_EVIDENCE_REQUIRED', 4, 'FIXTURE_NO_RETURN_EVIDENCE')];
    case 'PUBLISHED':
      return [...base, event('GRANT_ISSUED', 2, 'FIXTURE_DIRECT_GRANT'), event('OPERATOR_ACCEPTED', 3, 'FIXTURE_OPERATOR_ACCEPTED'), event('NATIVE_EVIDENCE_CONFIRMED', 4, 'FIXTURE_NATIVE_REFERENCE')];
    case 'UNKNOWN':
      return [...base, event('GRANT_ISSUED', 2, 'FIXTURE_DIRECT_GRANT'), event('OUTCOME_UNKNOWN', 3, 'FIXTURE_RESPONSE_LOST'), event('RECONCILIATION_REQUIRED', 4, 'FIXTURE_RECONCILIATION_ONLY')];
    case 'FAILED':
      return [...base, event('ACTION_FAILED', 2, 'FIXTURE_PREPARE_FAILED')];
    case 'EXPIRED':
      return [...base, event('GRANT_ISSUED', 2, 'FIXTURE_DIRECT_GRANT'), event('GRANT_EXPIRED', 17, 'FIXTURE_TTL_ELAPSED')];
    case 'REVOKED':
      return [...base, event('GRANT_ISSUED', 2, 'FIXTURE_HANDOFF_GRANT'), event('GRANT_REVOKED', 5, 'FIXTURE_OWNER_REVOCATION')];
  }
}

export function createActionCenterFixture(
  state: ActionCenterStateCode,
  uiLocale: AppLocale = 'zh-CN'
): ActionCenterViewModel {
  const mode = stateMode(state);
  const grantSummary = stateGrant(state);
  const model: ActionCenterViewModel = {
    state,
    mode,
    claimMaturity: 'IMPLEMENTED',
    environmentLabel: 'UI_FOUNDATION_NOT_LIVE',
    isLive: false,
    externalActionAllowed: false,
    source: 'PUBLIC_SAFE_FIXTURE',
    uiLocale,
    review: {
      revisionId: 'fixture-revision-public-safe-004',
      revisionVersion: 4,
      revisionDigest: fixtureDigest,
      accountLabel: 'Demo Product Presence · public-safe fixture',
      accountId: 'fixture-account-public-safe-001',
      intendedAction: mode === 'HANDOFF' ? 'Prepare one native handoff package' : mode === 'DIRECT' ? 'Publish one exact approved post' : 'Prepare only; no platform action',
      auditEvidenceCode: 'FIXTURE_AUDIT_PASS_EXACT_REVISION',
      ownerDecisionCode: 'FIXTURE_OWNER_REVIEW_ONLY',
      reviewedAt: fixtureNow,
      authorizationExpiresAt: '2026-08-10T02:17:00.000Z'
    },
    ...(grantSummary === undefined ? {} : {grant: grantSummary}),
    execution: {
      platform: mode === 'HANDOFF' ? 'LINKEDIN' : mode === 'PREPARE_ONLY' ? 'X' : 'BLUESKY',
      actionLabel: mode === 'HANDOFF' ? 'NATIVE_HANDOFF' : mode === 'PREPARE_ONLY' ? 'PREPARE_ONLY' : 'CREATE_POST',
      contentLanguage: 'en',
      targetMarket: 'GLOBAL',
      scheduleTimeZone: 'Asia/Singapore',
      ...(mode === 'HANDOFF' ? {handoffSteps: ['FIXTURE_COPY_APPROVED_CONTENT', 'FIXTURE_COMPLETE_IN_NATIVE_APP', 'FIXTURE_RETURN_PUBLIC_EVIDENCE']} : {})
    },
    timeline: stateTimeline(state),
    ...(state === 'PUBLISHED' ? {
      nativeEvidence: {
        receiptId: 'fixture-receipt-public-safe-001',
        publicReference: 'https://example.invalid/lumiclaw/public-safe-receipt',
        evidenceKind: 'NATIVE_URI' as const,
        confirmedAt: '2026-08-10T02:04:00.000Z'
      }
    } : {}),
    ...(state === 'UNKNOWN' ? {
      reconciliation: {
        reasonCode: 'FIXTURE_PLATFORM_RESPONSE_NOT_CONFIRMED',
        methods: ['PLATFORM_QUERY', 'OWNER_MANUAL'],
        blindRetryAllowed: false as const
      }
    } : {})
  };
  assertActionCenterModel(model);
  return model;
}

export function createAllActionCenterFixtures(uiLocale: AppLocale = 'zh-CN'): ActionCenterViewModel[] {
  return (['GRANT_READY', 'GRANT_ISSUED', 'OWNER_ACTION_REQUIRED', 'PUBLISHED', 'UNKNOWN', 'FAILED', 'EXPIRED', 'REVOKED'] as const)
    .map((state) => createActionCenterFixture(state, uiLocale));
}
