import {sha256Digest} from './canonical.js';
import {isValidRfc3339DateTime} from './rfc3339.js';

export const ACTIVATION_REGISTRY_VERSION = 'lumiclaw.activation-capabilities.v1' as const;

export const activationPlatformCodes = ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU', 'INSTAGRAM', 'THREADS'] as const;
export type ActivationPlatformCode = typeof activationPlatformCodes[number];

export const activationLayers = ['PLATFORM_READY', 'ASSISTED_HANDOFF', 'GOVERNED_DIRECT'] as const;
export type ActivationLayer = typeof activationLayers[number];

export const handoffModes = ['OFFICIAL_INTENT', 'OFFICIAL_URL_SHARE', 'MANUAL_PACKAGE', 'NATIVE_HANDOFF', 'DIRECT'] as const;
export type HandoffMode = typeof handoffModes[number];

export type ActivationAvailability = 'AVAILABLE_NON_EXECUTING' | 'CANDIDATE_PLANNED';
export type HandoffProofType = 'PUBLIC_POST_URL' | 'SAFE_SCREENSHOT' | 'NATIVE_RECORD_ID';
export type FeatureProbeCode = 'NONE' | 'THREADS_TEXT_INTENT';

export type ActivationCapability = {
  readonly schemaVersion: 1;
  readonly registryVersion: typeof ACTIVATION_REGISTRY_VERSION;
  readonly capabilityId: string;
  readonly platform: ActivationPlatformCode;
  readonly currentExperience: 'MANUAL_DESKTOP_ASSISTANT';
  readonly availability: ActivationAvailability;
  readonly layer: ActivationLayer;
  readonly mode: HandoffMode;
  readonly canPrefillText: boolean;
  readonly canPrefillLink: boolean;
  readonly canPrefillMedia: false;
  readonly requiresAccountConfirmation: true;
  readonly proofTypes: readonly HandoffProofType[];
  readonly proofCollection: 'PLANNED_READ_ONLY_RECONCILIATION';
  readonly featureProbe: {
    readonly code: FeatureProbeCode;
    readonly required: boolean;
    readonly experimental: boolean;
  };
  readonly fallbackMode: HandoffMode;
  readonly downgradeCode: string;
  readonly governedDirectAvailable: false;
  readonly externalActionAllowed: false;
  readonly officialContractSource: string | null;
};

// Only public provider contracts are referenced. No provider implementation, SDK, DOM
// integration, credential flow, or provider-owned type is copied into this registry.
const capability = (
  entry: Omit<ActivationCapability, 'schemaVersion' | 'registryVersion' | 'capabilityId' | 'currentExperience' | 'canPrefillMedia' | 'requiresAccountConfirmation' | 'proofCollection' | 'governedDirectAvailable' | 'externalActionAllowed'>
): ActivationCapability => Object.freeze({
  schemaVersion: 1,
  registryVersion: ACTIVATION_REGISTRY_VERSION,
  capabilityId: `lumiclaw.activation-capability.${entry.platform}.v1`,
  currentExperience: 'MANUAL_DESKTOP_ASSISTANT',
  canPrefillMedia: false,
  requiresAccountConfirmation: true,
  proofCollection: 'PLANNED_READ_ONLY_RECONCILIATION',
  governedDirectAvailable: false,
  externalActionAllowed: false,
  ...entry,
  proofTypes: Object.freeze([...entry.proofTypes]),
  featureProbe: Object.freeze({...entry.featureProbe})
});

export const activationCapabilityRegistry: Readonly<Record<ActivationPlatformCode, ActivationCapability>> = Object.freeze({
  X: capability({
    platform: 'X', availability: 'AVAILABLE_NON_EXECUTING', layer: 'ASSISTED_HANDOFF', mode: 'MANUAL_PACKAGE',
    canPrefillText: false, canPrefillLink: false, proofTypes: ['PUBLIC_POST_URL'],
    featureProbe: {code: 'NONE', required: false, experimental: false}, fallbackMode: 'MANUAL_PACKAGE',
    downgradeCode: 'X_DIRECT_NOT_VERIFIED',
    officialContractSource: 'https://developer.x.com/en/docs/twitter-for-websites/tweet-button/guides/web-intent'
  }),
  BLUESKY: capability({
    platform: 'BLUESKY', availability: 'AVAILABLE_NON_EXECUTING', layer: 'PLATFORM_READY', mode: 'MANUAL_PACKAGE',
    canPrefillText: false, canPrefillLink: false, proofTypes: ['NATIVE_RECORD_ID', 'PUBLIC_POST_URL'],
    featureProbe: {code: 'NONE', required: false, experimental: false}, fallbackMode: 'MANUAL_PACKAGE',
    downgradeCode: 'BLUESKY_DIRECT_NOT_IMPLEMENTED', officialContractSource: null
  }),
  LINKEDIN: capability({
    platform: 'LINKEDIN', availability: 'AVAILABLE_NON_EXECUTING', layer: 'ASSISTED_HANDOFF', mode: 'MANUAL_PACKAGE',
    canPrefillText: false, canPrefillLink: false, proofTypes: ['PUBLIC_POST_URL'],
    featureProbe: {code: 'NONE', required: false, experimental: false}, fallbackMode: 'MANUAL_PACKAGE',
    downgradeCode: 'LINKEDIN_URL_ONLY_HANDOFF',
    officialContractSource: 'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/plugins/share-plugin'
  }),
  XIAOHONGSHU: capability({
    platform: 'XIAOHONGSHU', availability: 'AVAILABLE_NON_EXECUTING', layer: 'ASSISTED_HANDOFF', mode: 'MANUAL_PACKAGE',
    canPrefillText: false, canPrefillLink: false, proofTypes: ['PUBLIC_POST_URL', 'SAFE_SCREENSHOT'],
    featureProbe: {code: 'NONE', required: false, experimental: false}, fallbackMode: 'MANUAL_PACKAGE',
    downgradeCode: 'XIAOHONGSHU_NATIVE_USER_ACTION_REQUIRED', officialContractSource: 'https://agora.xiaohongshu.com/doc'
  }),
  INSTAGRAM: capability({
    platform: 'INSTAGRAM', availability: 'CANDIDATE_PLANNED', layer: 'PLATFORM_READY', mode: 'MANUAL_PACKAGE',
    canPrefillText: false, canPrefillLink: false, proofTypes: ['PUBLIC_POST_URL', 'SAFE_SCREENSHOT'],
    featureProbe: {code: 'NONE', required: false, experimental: false}, fallbackMode: 'MANUAL_PACKAGE',
    downgradeCode: 'INSTAGRAM_ARTIFACT_PROFILE_PLANNED', officialContractSource: 'https://www.instagram.com/'
  }),
  THREADS: capability({
    platform: 'THREADS', availability: 'CANDIDATE_PLANNED', layer: 'ASSISTED_HANDOFF', mode: 'MANUAL_PACKAGE',
    canPrefillText: false, canPrefillLink: false, proofTypes: ['PUBLIC_POST_URL'],
    featureProbe: {code: 'THREADS_TEXT_INTENT', required: true, experimental: true}, fallbackMode: 'MANUAL_PACKAGE',
    downgradeCode: 'THREADS_INTENT_EXPERIMENTAL_ARTIFACT_PROFILE_PLANNED',
    officialContractSource: 'https://developers.facebook.com/docs/threads/threads-web-intents/'
  })
});

export type ApprovedMediaReference = {
  readonly digest: string;
  readonly fileName: string;
};

export type ActivationCapabilitySnapshot = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly registryVersion: typeof ACTIVATION_REGISTRY_VERSION;
  readonly registryCapabilityId: string;
  readonly platform: ActivationPlatformCode;
  readonly accountId: string;
  readonly layer: ActivationLayer;
  readonly mode: HandoffMode;
  readonly capturedAt: string;
  readonly expiresAt: string;
};

export type ApprovedActivationInput = {
  readonly schemaVersion: 1;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly revisionId: string;
  readonly platform: ActivationPlatformCode;
  readonly accountId: string;
  readonly approvedRevisionDigest: string;
  readonly orderedMedia: readonly ApprovedMediaReference[];
  readonly capabilitySnapshot: ActivationCapabilitySnapshot;
  readonly accountConfirmation: {
    readonly confirmed: boolean;
    readonly accountId: string | null;
  };
};

export const manualDesktopActionCodes = ['COPY_TEXT', 'COPY_OR_DOWNLOAD_MEDIA', 'OPEN_OFFICIAL_PUBLISH_PAGE', 'MANUAL_COMPLETE'] as const;
export type ManualDesktopActionCode = typeof manualDesktopActionCodes[number];

export const handoffOutcomeStates = [
  'USER_ACTION_REQUIRED',
  'HANDOFF_OPENED',
  'AWAITING_RECONCILIATION',
  'FAILED',
  'UNKNOWN_RECONCILIATION_REQUIRED'
] as const;
export type HandoffOutcomeState = typeof handoffOutcomeStates[number];

export type HandoffCopyPayload = {
  readonly text: string;
  readonly link: string | null;
  readonly hashtags: readonly string[];
  readonly via: string | null;
};

export type HandoffPackage = {
  readonly schemaVersion: 1;
  readonly packageDigest: string;
  readonly inputDigest: string;
  readonly platform: ActivationPlatformCode;
  readonly accountId: string;
  readonly capabilitySnapshotId: string;
  readonly registryCapabilityId: string;
  readonly capabilityExpiresAt: string;
  readonly approvedRevisionDigest: string;
  readonly orderedMedia: readonly ApprovedMediaReference[];
  readonly builtAt: string;
  readonly selectedMode: HandoffMode;
  readonly fallbackMode: HandoffMode;
  readonly fallbackReason: string | null;
  readonly copyPayload: HandoffCopyPayload;
  readonly safeOpenTarget: string;
  readonly actions: readonly ManualDesktopActionCode[];
  readonly reconciliation: 'PLANNED_READ_ONLY_RECONCILIATION';
  readonly outcomeState: 'USER_ACTION_REQUIRED';
  readonly externalActionAllowed: false;
  readonly navigationPerformed: false;
};

export type HandoffBlockedCode =
  | 'INVALID_INPUT'
  | 'PLATFORM_MISMATCH'
  | 'CAPABILITY_PLATFORM_MISMATCH'
  | 'CAPABILITY_ACCOUNT_MISMATCH'
  | 'CAPABILITY_ID_MISMATCH'
  | 'CAPABILITY_MODE_MISMATCH'
  | 'CAPABILITY_EXPIRED'
  | 'ACCOUNT_CONFIRMATION_REQUIRED'
  | 'ACCOUNT_MISMATCH'
  | 'UNSAFE_SHARE_URL'
  | 'UNSAFE_OPEN_TARGET'
  | 'PACKAGE_BINDING_MISMATCH'
  | 'PACKAGE_CONTRACT_INVALID'
  | 'PACKAGE_DIGEST_MISMATCH'
  | 'INVALID_OUTCOME_TRANSITION'
  | 'UNKNOWN_RECONCILIATION_REQUIRED_NO_RESEND';

export type HandoffFailure = {readonly ok: false; readonly code: HandoffBlockedCode};
export type HandoffBuildResult = {readonly ok: true; readonly package: HandoffPackage} | HandoffFailure;
export type ThreadsFeatureProbeResult = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

type CommonBuildRequest = {
  readonly activation: ApprovedActivationInput;
  readonly builtAt: string;
  readonly text: string;
};

export type XHandoffRequest = CommonBuildRequest & {
  readonly link: string | null;
  readonly hashtags: readonly string[];
  readonly via: string | null;
};

export type ThreadsHandoffRequest = CommonBuildRequest & {
  readonly featureProbe: ThreadsFeatureProbeResult;
};

export type LinkedInHandoffRequest = CommonBuildRequest & {
  readonly link: string;
};

export type InstagramHandoffRequest = CommonBuildRequest;

type PackageDraft = Omit<HandoffPackage, 'packageDigest'>;

export function buildXHandoffPackage(request: XHandoffRequest): HandoffBuildResult {
  const valid = validateActivation(request.activation, 'X', request.builtAt);
  if (!valid.ok) return valid;
  const content = validateCopyPayload(request.text, request.link, request.hashtags, request.via);
  if (!content.ok) return content;
  const target = new URL('https://x.com/compose/post');
  return finalizePackage(request.activation, request.builtAt, 'MANUAL_PACKAGE', 'WEB_PREFILL_DISABLED_BY_OWNER_FREEZE', copyPayload(content), target.toString(), [
    'COPY_TEXT', 'COPY_OR_DOWNLOAD_MEDIA', 'OPEN_OFFICIAL_PUBLISH_PAGE', 'MANUAL_COMPLETE'
  ]);
}

export function buildThreadsHandoffPackage(request: ThreadsHandoffRequest): HandoffBuildResult {
  const valid = validateActivation(request.activation, 'THREADS', request.builtAt);
  if (!valid.ok) return valid;
  const content = validateCopyPayload(request.text, null, [], null);
  if (!content.ok) return content;
  const target = new URL('https://www.threads.net/intent/post');
  return finalizePackage(
    request.activation,
    request.builtAt,
    'MANUAL_PACKAGE',
    `THREADS_TEXT_INTENT_${request.featureProbe}_NOT_USED_CURRENT_UI`,
    copyPayload(content),
    target.toString(),
    ['COPY_TEXT', 'COPY_OR_DOWNLOAD_MEDIA', 'OPEN_OFFICIAL_PUBLISH_PAGE', 'MANUAL_COMPLETE']
  );
}

export function buildLinkedInHandoffPackage(request: LinkedInHandoffRequest): HandoffBuildResult {
  const valid = validateActivation(request.activation, 'LINKEDIN', request.builtAt);
  if (!valid.ok) return valid;
  const content = validateCopyPayload(request.text, request.link, [], null);
  if (!content.ok) return content;
  const target = new URL('https://www.linkedin.com/feed/?shareActive=true');
  return finalizePackage(request.activation, request.builtAt, 'MANUAL_PACKAGE', 'WEB_PREFILL_DISABLED_BY_OWNER_FREEZE', copyPayload(content), target.toString(), [
    'COPY_TEXT', 'COPY_OR_DOWNLOAD_MEDIA', 'OPEN_OFFICIAL_PUBLISH_PAGE', 'MANUAL_COMPLETE'
  ]);
}

export function buildInstagramHandoffPackage(request: InstagramHandoffRequest): HandoffBuildResult {
  const valid = validateActivation(request.activation, 'INSTAGRAM', request.builtAt);
  if (!valid.ok) return valid;
  const content = validateCopyPayload(request.text, null, [], null);
  if (!content.ok) return content;
  return finalizePackage(request.activation, request.builtAt, 'MANUAL_PACKAGE', 'INSTAGRAM_WEB_PREFILL_NOT_CLAIMED', copyPayload(content), 'https://www.instagram.com/', [
    'COPY_TEXT', 'COPY_OR_DOWNLOAD_MEDIA', 'OPEN_OFFICIAL_PUBLISH_PAGE', 'MANUAL_COMPLETE'
  ]);
}

export function activationInputDigest(input: ApprovedActivationInput): string {
  return sha256Digest({
    schemaVersion: input.schemaVersion,
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    revisionId: input.revisionId,
    platform: input.platform,
    accountId: input.accountId,
    approvedRevisionDigest: input.approvedRevisionDigest,
    orderedMedia: input.orderedMedia.map(({digest, fileName}) => ({digest, fileName})),
    capabilitySnapshot: input.capabilitySnapshot,
    accountConfirmation: input.accountConfirmation
  });
}

export function verifyHandoffPackage(value: HandoffPackage, input: ApprovedActivationInput, verifiedAt: string): {readonly ok: true} | HandoffFailure {
  const builtValid = validateActivation(input, value.platform, value.builtAt);
  if (!builtValid.ok) return builtValid;
  const currentValid = validateActivation(input, value.platform, verifiedAt);
  if (!currentValid.ok) return currentValid;
  const expectedInputDigest = activationInputDigest(input);
  if (
    value.inputDigest !== expectedInputDigest
    || value.platform !== input.platform
    || value.accountId !== input.accountId
    || value.capabilitySnapshotId !== input.capabilitySnapshot.id
    || value.registryCapabilityId !== input.capabilitySnapshot.registryCapabilityId
    || value.capabilityExpiresAt !== input.capabilitySnapshot.expiresAt
    || value.approvedRevisionDigest !== input.approvedRevisionDigest
    || sha256Digest(value.orderedMedia) !== sha256Digest(input.orderedMedia)
  ) return {ok: false, code: 'PACKAGE_BINDING_MISMATCH'};
  const validatedCopy = validateCopyPayload(value.copyPayload.text, value.copyPayload.link, value.copyPayload.hashtags, value.copyPayload.via);
  if (
    !validatedCopy.ok
    || value.schemaVersion !== 1
    || value.selectedMode !== 'MANUAL_PACKAGE'
    || value.fallbackMode !== 'MANUAL_PACKAGE'
    || sha256Digest(value.actions) !== sha256Digest(manualDesktopActionCodes)
    || value.reconciliation !== 'PLANNED_READ_ONLY_RECONCILIATION'
    || value.outcomeState !== 'USER_ACTION_REQUIRED'
    || value.externalActionAllowed !== false
    || value.navigationPerformed !== false
    || (value.fallbackReason !== null && !isBoundedIdentifier(value.fallbackReason))
    || sha256Digest(copyPayload(validatedCopy)) !== sha256Digest(value.copyPayload)
  ) return {ok: false, code: 'PACKAGE_CONTRACT_INVALID'};
  if (!isSafeOpenTarget(value.safeOpenTarget, value.platform, value.selectedMode)) return {ok: false, code: 'UNSAFE_OPEN_TARGET'};
  const {packageDigest, ...draft} = value;
  if (packageDigest !== sha256Digest(draft)) return {ok: false, code: 'PACKAGE_DIGEST_MISMATCH'};
  return {ok: true};
}

export type HandoffOutcomeEvent = 'PACKAGE_CREATED' | 'OFFICIAL_PAGE_OPENED' | 'MANUAL_COMPLETION_RECORDED' | 'FAILURE_RECORDED' | 'RESULT_UNKNOWN' | 'REQUEST_RESEND';

export function transitionHandoffOutcome(request: {
  readonly from: HandoffOutcomeState | null;
  readonly event: HandoffOutcomeEvent;
}): {readonly ok: true; readonly state: HandoffOutcomeState} | HandoffFailure {
  if (request.from === 'UNKNOWN_RECONCILIATION_REQUIRED' && request.event === 'REQUEST_RESEND') {
    return {ok: false, code: 'UNKNOWN_RECONCILIATION_REQUIRED_NO_RESEND'};
  }
  if (request.from === null && request.event === 'PACKAGE_CREATED') return {ok: true, state: 'USER_ACTION_REQUIRED'};
  if (request.from === 'USER_ACTION_REQUIRED' && request.event === 'OFFICIAL_PAGE_OPENED') return {ok: true, state: 'HANDOFF_OPENED'};
  if (request.from === 'HANDOFF_OPENED' && request.event === 'MANUAL_COMPLETION_RECORDED') return {ok: true, state: 'AWAITING_RECONCILIATION'};
  if ((request.from === 'USER_ACTION_REQUIRED' || request.from === 'HANDOFF_OPENED') && request.event === 'FAILURE_RECORDED') return {ok: true, state: 'FAILED'};
  if ((request.from === 'HANDOFF_OPENED' || request.from === 'AWAITING_RECONCILIATION') && request.event === 'RESULT_UNKNOWN') return {ok: true, state: 'UNKNOWN_RECONCILIATION_REQUIRED'};
  return {ok: false, code: 'INVALID_OUTCOME_TRANSITION'};
}

export function allowedHandoffActions(state: HandoffOutcomeState): readonly string[] {
  switch (state) {
    case 'USER_ACTION_REQUIRED': return ['OPEN_OFFICIAL_PUBLISH_PAGE', 'MARK_FAILED'];
    case 'HANDOFF_OPENED': return ['MANUAL_COMPLETE', 'MARK_FAILED', 'MARK_UNKNOWN'];
    case 'AWAITING_RECONCILIATION': return ['WAIT_FOR_RECONCILIATION', 'MARK_UNKNOWN'];
    case 'UNKNOWN_RECONCILIATION_REQUIRED': return ['RECONCILE_ONLY'];
    case 'FAILED': return [];
  }
}

function validateActivation(input: ApprovedActivationInput, expectedPlatform: ActivationPlatformCode, builtAt: string): {readonly ok: true} | HandoffFailure {
  if (!isValidRfc3339DateTime(builtAt) || input.schemaVersion !== 1) return {ok: false, code: 'INVALID_INPUT'};
  if (input.platform !== expectedPlatform) return {ok: false, code: 'PLATFORM_MISMATCH'};
  const entry = activationCapabilityRegistry[expectedPlatform];
  const snapshot = input.capabilitySnapshot;
  if (snapshot.platform !== input.platform) return {ok: false, code: 'CAPABILITY_PLATFORM_MISMATCH'};
  if (snapshot.accountId !== input.accountId) return {ok: false, code: 'CAPABILITY_ACCOUNT_MISMATCH'};
  if (snapshot.registryVersion !== ACTIVATION_REGISTRY_VERSION || snapshot.registryCapabilityId !== entry.capabilityId) return {ok: false, code: 'CAPABILITY_ID_MISMATCH'};
  if (snapshot.layer !== entry.layer || snapshot.mode !== entry.mode) return {ok: false, code: 'CAPABILITY_MODE_MISMATCH'};
  if (!isValidRfc3339DateTime(snapshot.capturedAt) || !isValidRfc3339DateTime(snapshot.expiresAt)) return {ok: false, code: 'INVALID_INPUT'};
  if (Date.parse(snapshot.capturedAt) > Date.parse(builtAt) || Date.parse(snapshot.capturedAt) >= Date.parse(snapshot.expiresAt)) return {ok: false, code: 'INVALID_INPUT'};
  if (Date.parse(snapshot.expiresAt) <= Date.parse(builtAt)) return {ok: false, code: 'CAPABILITY_EXPIRED'};
  if (!input.accountConfirmation.confirmed || input.accountConfirmation.accountId === null) return {ok: false, code: 'ACCOUNT_CONFIRMATION_REQUIRED'};
  if (input.accountConfirmation.accountId !== input.accountId) return {ok: false, code: 'ACCOUNT_MISMATCH'};
  if (![input.organizationId, input.campaignId, input.revisionId, input.accountId, snapshot.id].every(isBoundedIdentifier)) return {ok: false, code: 'INVALID_INPUT'};
  if (!isDigest(input.approvedRevisionDigest) || input.orderedMedia.length > 20) return {ok: false, code: 'INVALID_INPUT'};
  if (input.orderedMedia.some((item) => !isDigest(item.digest) || !/^(?!\.\.?$)[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(item.fileName))) return {ok: false, code: 'INVALID_INPUT'};
  return {ok: true};
}

function validateCopyPayload(text: string, link: string | null, hashtags: readonly string[], via: string | null): ({readonly ok: true} & HandoffCopyPayload) | HandoffFailure {
  if (text.length === 0 || text.length > 100_000 || /[\u0000]/u.test(text)) return {ok: false, code: 'INVALID_INPUT'};
  if (link !== null && !isSafeSharedUrl(link)) return {ok: false, code: 'UNSAFE_SHARE_URL'};
  const normalizedHashtags = hashtags.map((item) => item.replace(/^#+/u, ''));
  if (normalizedHashtags.length > 20 || normalizedHashtags.some((item) => item.length === 0 || item.length > 100 || /[\s,#&?]/u.test(item))) return {ok: false, code: 'INVALID_INPUT'};
  const normalizedVia = via === null ? null : via.replace(/^@/u, '');
  if (normalizedVia !== null && !/^[A-Za-z0-9_]{1,15}$/u.test(normalizedVia)) return {ok: false, code: 'INVALID_INPUT'};
  return {ok: true, text, link, hashtags: normalizedHashtags, via: normalizedVia};
}

function copyPayload(value: {readonly ok: true} & HandoffCopyPayload): HandoffCopyPayload {
  return {text: value.text, link: value.link, hashtags: value.hashtags, via: value.via};
}

function finalizePackage(
  input: ApprovedActivationInput,
  builtAt: string,
  selectedMode: HandoffMode,
  fallbackReason: string | null,
  copyPayload: HandoffCopyPayload,
  safeOpenTarget: string,
  actions: readonly ManualDesktopActionCode[]
): HandoffBuildResult {
  if (!isSafeOpenTarget(safeOpenTarget, input.platform, selectedMode)) return {ok: false, code: 'UNSAFE_OPEN_TARGET'};
  const registry = activationCapabilityRegistry[input.platform];
  const draft: PackageDraft = {
    schemaVersion: 1,
    inputDigest: activationInputDigest(input),
    platform: input.platform,
    accountId: input.accountId,
    capabilitySnapshotId: input.capabilitySnapshot.id,
    registryCapabilityId: input.capabilitySnapshot.registryCapabilityId,
    capabilityExpiresAt: input.capabilitySnapshot.expiresAt,
    approvedRevisionDigest: input.approvedRevisionDigest,
    orderedMedia: input.orderedMedia.map((item) => Object.freeze({...item})),
    builtAt,
    selectedMode,
    fallbackMode: registry.fallbackMode,
    fallbackReason,
    copyPayload: Object.freeze({...copyPayload, hashtags: Object.freeze([...copyPayload.hashtags])}),
    safeOpenTarget,
    actions: Object.freeze([...actions]),
    reconciliation: registry.proofCollection,
    outcomeState: 'USER_ACTION_REQUIRED',
    externalActionAllowed: false,
    navigationPerformed: false
  };
  return {ok: true, package: Object.freeze({...draft, packageDigest: sha256Digest(draft)})};
}

function isSafeSharedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hostname.length > 0 && value.length <= 4096;
  } catch {
    return false;
  }
}

function isSafeOpenTarget(value: string, platform: ActivationPlatformCode, mode: HandoffMode): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hash !== '') return false;
    const keys = [...url.searchParams.keys()];
    if (platform === 'X' && mode === 'MANUAL_PACKAGE') return url.hostname === 'x.com' && url.pathname === '/compose/post' && keys.length === 0;
    if (platform === 'THREADS' && mode === 'MANUAL_PACKAGE') return url.hostname === 'www.threads.net' && url.pathname === '/intent/post' && keys.length === 0;
    if (platform === 'LINKEDIN' && mode === 'MANUAL_PACKAGE') return url.hostname === 'www.linkedin.com' && url.pathname === '/feed/' && keys.length === 1 && url.searchParams.get('shareActive') === 'true';
    if (platform === 'INSTAGRAM' && mode === 'MANUAL_PACKAGE') return url.hostname === 'www.instagram.com' && url.pathname === '/' && keys.length === 0;
    return false;
  } catch {
    return false;
  }
}

function isDigest(value: string): boolean { return /^[a-f0-9]{64}$/u.test(value); }
function isBoundedIdentifier(value: string): boolean { return value.length > 0 && value.length <= 200 && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value); }
