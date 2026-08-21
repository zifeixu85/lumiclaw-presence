import {describe, expect, it} from 'vitest';
import {
  ACTIVATION_REGISTRY_VERSION,
  activationCapabilityRegistry,
  activationInputDigest,
  activationLayers,
  activationPlatformCodes,
  allowedHandoffActions,
  buildInstagramHandoffPackage,
  buildLinkedInHandoffPackage,
  buildThreadsHandoffPackage,
  buildXHandoffPackage,
  handoffOutcomeStates,
  manualDesktopActionCodes,
  transitionHandoffOutcome,
  verifyHandoffPackage,
  type ActivationPlatformCode,
  type ApprovedActivationInput,
  type HandoffBuildResult,
  type HandoffPackage
} from './activation.js';
import {sha256Digest} from './canonical.js';
import {createDemoCampaignDocument} from './campaign-fixture.js';
import {validateCampaignDocument} from './campaign.js';

const builtAt = '2026-08-16T08:00:00.000Z';

describe('SDD-004 CR1 activation capability registry', () => {
  it('keeps six stable platform entries and three internal future layers without exposing a current direct path', () => {
    expect(activationPlatformCodes).toEqual(['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU', 'INSTAGRAM', 'THREADS']);
    expect(activationLayers).toEqual(['PLATFORM_READY', 'ASSISTED_HANDOFF', 'GOVERNED_DIRECT']);
    expect(Object.keys(activationCapabilityRegistry).sort()).toEqual([...activationPlatformCodes].sort());

    for (const platform of activationPlatformCodes) {
      const entry = activationCapabilityRegistry[platform];
      expect(entry.platform).toBe(platform);
      expect(entry.capabilityId).toBe(`lumiclaw.activation-capability.${platform}.v1`);
      expect(entry.registryVersion).toBe(ACTIVATION_REGISTRY_VERSION);
      expect(entry.currentExperience).toBe('MANUAL_DESKTOP_ASSISTANT');
      expect(entry.mode).toBe('MANUAL_PACKAGE');
      expect(entry.canPrefillText).toBe(false);
      expect(entry.canPrefillLink).toBe(false);
      expect(entry.canPrefillMedia).toBe(false);
      expect(entry.requiresAccountConfirmation).toBe(true);
      expect(entry.governedDirectAvailable).toBe(false);
      expect(entry.externalActionAllowed).toBe(false);
      expect(entry.proofCollection).toBe('PLANNED_READ_ONLY_RECONCILIATION');
      expect(entry.downgradeCode.length).toBeGreaterThan(0);
    }
    expect(activationCapabilityRegistry.INSTAGRAM.availability).toBe('CANDIDATE_PLANNED');
    expect(activationCapabilityRegistry.THREADS.availability).toBe('CANDIDATE_PLANNED');
    expect(activationCapabilityRegistry.THREADS.featureProbe).toEqual({code: 'THREADS_TEXT_INTENT', required: true, experimental: true});
  });
});

describe('SDD-004 CR1 deterministic desktop manual packages', () => {
  it.each([
    ['X', () => buildXHandoffPackage({activation: approvedInput('X'), builtAt, text: 'A & B = safe?', link: 'https://example.invalid/path?a=1&b=two words', hashtags: ['#Launch', '安全'], via: '@lumiclaw_demo'}), 'https://x.com/compose/post'],
    ['THREADS', () => buildThreadsHandoffPackage({activation: approvedInput('THREADS'), builtAt, text: 'Threads text stays in the copy payload & never enters the URL.', featureProbe: 'SUPPORTED'}), 'https://www.threads.net/intent/post'],
    ['LINKEDIN', () => buildLinkedInHandoffPackage({activation: approvedInput('LINKEDIN'), builtAt, text: 'LinkedIn body remains manual.', link: 'https://example.invalid/article?ref=a&next=b'}), 'https://www.linkedin.com/feed/?shareActive=true'],
    ['INSTAGRAM', () => buildInstagramHandoffPackage({activation: approvedInput('INSTAGRAM'), builtAt, text: 'Instagram caption remains manual.'}), 'https://www.instagram.com/']
  ] as const)('%s returns only the four current manual actions and an allowlisted non-prefilled official page', (_platform, build, expectedTarget) => {
    const pkg = successful(build());
    expect(pkg.actions).toEqual(manualDesktopActionCodes);
    expect(pkg.safeOpenTarget).toBe(expectedTarget);
    expect(pkg.selectedMode).toBe('MANUAL_PACKAGE');
    expect(pkg.outcomeState).toBe('USER_ACTION_REQUIRED');
    expect(pkg.externalActionAllowed).toBe(false);
    expect(pkg.navigationPerformed).toBe(false);
    expect(pkg.reconciliation).toBe('PLANNED_READ_ONLY_RECONCILIATION');
    const target = new URL(pkg.safeOpenTarget);
    expect(target.searchParams.has('text')).toBe(false);
    expect(target.searchParams.has('url')).toBe(false);
    expect(target.searchParams.has('hashtags')).toBe(false);
    expect(target.searchParams.has('via')).toBe(false);
    expect(target.protocol).toBe('https:');
  });

  it.each(['SUPPORTED', 'UNSUPPORTED', 'UNKNOWN'] as const)('keeps Threads on the manual desktop path when the future intent probe is %s', (featureProbe) => {
    const pkg = successful(buildThreadsHandoffPackage({activation: approvedInput('THREADS'), builtAt, text: 'Approved Threads copy.', featureProbe}));
    expect(pkg.selectedMode).toBe('MANUAL_PACKAGE');
    expect(pkg.safeOpenTarget).toBe('https://www.threads.net/intent/post');
    expect(pkg.fallbackReason).toBe(`THREADS_TEXT_INTENT_${featureProbe}_NOT_USED_CURRENT_UI`);
  });

  it('keeps link, hashtags and via in the copy package while never placing them in the X target', () => {
    const pkg = successful(buildXHandoffPackage({activation: approvedInput('X'), builtAt, text: 'Approved copy', link: 'https://example.invalid/a?b=1&c=2', hashtags: ['#Launch', '安全'], via: '@lumiclaw_demo'}));
    expect(pkg.copyPayload).toEqual({text: 'Approved copy', link: 'https://example.invalid/a?b=1&c=2', hashtags: ['Launch', '安全'], via: 'lumiclaw_demo'});
    expect(new URL(pkg.safeOpenTarget).search).toBe('');
  });

  it.each([
    ['UNSAFE_SHARE_URL', () => buildXHandoffPackage({activation: approvedInput('X'), builtAt, text: 'copy', link: 'javascript:alert(1)', hashtags: [], via: null})],
    ['INVALID_INPUT', () => buildXHandoffPackage({activation: approvedInput('X'), builtAt, text: 'copy', link: null, hashtags: ['bad&inject=1'], via: null})],
    ['INVALID_INPUT', () => buildXHandoffPackage({activation: approvedInput('X'), builtAt, text: 'copy', link: null, hashtags: [], via: 'not valid!'})]
  ] as const)('rejects malformed copy input with %s', (code, build) => {
    expect(build()).toEqual({ok: false, code});
  });
});

describe('SDD-004 CR1 exact binding and fail-closed checks', () => {
  it.each([
    ['CAPABILITY_EXPIRED', (input: ApprovedActivationInput) => mutate(input, (value) => { value.capabilitySnapshot.expiresAt = builtAt; })],
    ['CAPABILITY_PLATFORM_MISMATCH', (input: ApprovedActivationInput) => mutate(input, (value) => { value.capabilitySnapshot.platform = 'LINKEDIN'; })],
    ['CAPABILITY_ACCOUNT_MISMATCH', (input: ApprovedActivationInput) => mutate(input, (value) => { value.capabilitySnapshot.accountId = 'account-other'; })],
    ['CAPABILITY_ID_MISMATCH', (input: ApprovedActivationInput) => mutate(input, (value) => { value.capabilitySnapshot.registryCapabilityId = 'wrong-capability'; })],
    ['CAPABILITY_MODE_MISMATCH', (input: ApprovedActivationInput) => mutate(input, (value) => { value.capabilitySnapshot.mode = 'DIRECT'; })],
    ['ACCOUNT_CONFIRMATION_REQUIRED', (input: ApprovedActivationInput) => mutate(input, (value) => { value.accountConfirmation.confirmed = false; value.accountConfirmation.accountId = null; })],
    ['ACCOUNT_MISMATCH', (input: ApprovedActivationInput) => mutate(input, (value) => { value.accountConfirmation.accountId = 'account-other'; })]
  ] as const)('fails closed with %s', (code, makeInput) => {
    const result = buildXHandoffPackage({activation: makeInput(approvedInput('X')), builtAt, text: 'Approved copy', link: null, hashtags: [], via: null});
    expect(result).toEqual({ok: false, code});
  });

  it('fails closed when a platform-specific builder receives the wrong platform', () => {
    expect(buildXHandoffPackage({activation: approvedInput('LINKEDIN'), builtAt, text: 'Approved copy', link: null, hashtags: [], via: null})).toEqual({ok: false, code: 'PLATFORM_MISMATCH'});
  });

  it('binds exact revision, ordered media, account, capability identity and expiry into deterministic package identity', () => {
    const input = approvedInput('X');
    const first = successful(buildXHandoffPackage({activation: input, builtAt, text: 'Approved copy', link: null, hashtags: [], via: null}));
    const again = successful(buildXHandoffPackage({activation: structuredClone(input), builtAt, text: 'Approved copy', link: null, hashtags: [], via: null}));
    expect(again).toEqual(first);
    expect(first.inputDigest).toBe(activationInputDigest(input));
    expect(first.approvedRevisionDigest).toBe(input.approvedRevisionDigest);
    expect(first.orderedMedia.map((item) => item.digest)).toEqual(input.orderedMedia.map((item) => item.digest));
    expect(verifyHandoffPackage(first, input, builtAt)).toEqual({ok: true});

    const reordered: ApprovedActivationInput = {...structuredClone(input), orderedMedia: [...input.orderedMedia].reverse()};
    const second = successful(buildXHandoffPackage({activation: reordered, builtAt, text: 'Approved copy', link: null, hashtags: [], via: null}));
    expect(second.inputDigest).not.toBe(first.inputDigest);
    expect(second.packageDigest).not.toBe(first.packageDigest);
    expect(verifyHandoffPackage(first, reordered, builtAt)).toEqual({ok: false, code: 'PACKAGE_BINDING_MISMATCH'});
  });

  it('detects package mutation and unsafe target replacement', () => {
    const input = approvedInput('INSTAGRAM');
    const original = successful(buildInstagramHandoffPackage({activation: input, builtAt, text: 'Approved caption'}));
    const copyMutation = structuredClone(original) as Writable<HandoffPackage>;
    copyMutation.copyPayload.text = 'mutated';
    expect(verifyHandoffPackage(copyMutation, input, builtAt)).toEqual({ok: false, code: 'PACKAGE_DIGEST_MISMATCH'});
    const targetMutation = structuredClone(original) as Writable<HandoffPackage>;
    targetMutation.safeOpenTarget = 'https://evil.example/steal';
    expect(verifyHandoffPackage(targetMutation, input, builtAt)).toEqual({ok: false, code: 'UNSAFE_OPEN_TARGET'});
  });

  it('rejects a recomputed digest when the package contract is forged', () => {
    const input = approvedInput('X');
    const original = successful(buildXHandoffPackage({activation: input, builtAt, text: 'Approved copy', link: null, hashtags: [], via: null}));
    const forged = structuredClone(original) as Writable<HandoffPackage>;
    forged.actions = ['MANUAL_COMPLETE'];
    const {packageDigest: oldDigest, ...draft} = forged;
    expect(oldDigest).toBe(original.packageDigest);
    forged.packageDigest = sha256Digest(draft);
    expect(verifyHandoffPackage(forged, input, builtAt)).toEqual({ok: false, code: 'PACKAGE_CONTRACT_INVALID'});
  });
});

describe('SDD-004 CR1 non-executing outcome contract', () => {
  it('contains no published or current reconciled state', () => {
    expect(handoffOutcomeStates).toEqual(['USER_ACTION_REQUIRED', 'HANDOFF_OPENED', 'AWAITING_RECONCILIATION', 'FAILED', 'UNKNOWN_RECONCILIATION_REQUIRED']);
    expect(handoffOutcomeStates).not.toContain('PUBLISHED');
    expect(handoffOutcomeStates).not.toContain('HANDOFF_RECONCILED');
  });

  it('moves only through the current manual opened and awaiting-reconciliation path', () => {
    const created = transitionHandoffOutcome({from: null, event: 'PACKAGE_CREATED'});
    expect(created).toEqual({ok: true, state: 'USER_ACTION_REQUIRED'});
    const opened = transitionHandoffOutcome({from: 'USER_ACTION_REQUIRED', event: 'OFFICIAL_PAGE_OPENED'});
    expect(opened).toEqual({ok: true, state: 'HANDOFF_OPENED'});
    const awaiting = transitionHandoffOutcome({from: 'HANDOFF_OPENED', event: 'MANUAL_COMPLETION_RECORDED'});
    expect(awaiting).toEqual({ok: true, state: 'AWAITING_RECONCILIATION'});
    expect(allowedHandoffActions('AWAITING_RECONCILIATION')).toEqual(['WAIT_FOR_RECONCILIATION', 'MARK_UNKNOWN']);
  });

  it('requires reconciliation and denies blind resend from unknown', () => {
    expect(transitionHandoffOutcome({from: 'AWAITING_RECONCILIATION', event: 'RESULT_UNKNOWN'})).toEqual({ok: true, state: 'UNKNOWN_RECONCILIATION_REQUIRED'});
    expect(allowedHandoffActions('UNKNOWN_RECONCILIATION_REQUIRED')).toEqual(['RECONCILE_ONLY']);
    expect(transitionHandoffOutcome({from: 'UNKNOWN_RECONCILIATION_REQUIRED', event: 'REQUEST_RESEND'})).toEqual({ok: false, code: 'UNKNOWN_RECONCILIATION_REQUIRED_NO_RESEND'});
  });

  it('does not accept a proof or success-like transition in the current state machine', () => {
    expect(transitionHandoffOutcome({from: 'AWAITING_RECONCILIATION', event: 'MANUAL_COMPLETION_RECORDED'})).toEqual({ok: false, code: 'INVALID_OUTCOME_TRANSITION'});
  });
});

describe('SDD-004 exact-four regression boundary', () => {
  it('keeps the accepted M1 Campaign invariant at exactly four active platforms', () => {
    const document = createDemoCampaignDocument();
    expect([...document.activationPlan.units.map((unit) => unit.platform)].sort()).toEqual(['BLUESKY', 'LINKEDIN', 'X', 'XIAOHONGSHU']);
    expect(document.artifactRevisions).toHaveLength(4);
    expect(validateCampaignDocument(document, new Date('2026-08-16T08:00:00.000Z'))).toEqual({ok: true});
  });
});

function approvedInput(platform: ActivationPlatformCode): ApprovedActivationInput {
  const registry = activationCapabilityRegistry[platform];
  return {
    schemaVersion: 1,
    organizationId: 'org-public-safe',
    campaignId: 'campaign-public-safe',
    revisionId: `revision-${platform.toLowerCase()}`,
    platform,
    accountId: `account-${platform.toLowerCase()}`,
    approvedRevisionDigest: sha256Digest(`approved-revision-${platform}`),
    orderedMedia: [
      {digest: sha256Digest(`media-${platform}-1`), fileName: '01-approved-image.png'},
      {digest: sha256Digest(`media-${platform}-2`), fileName: '02-approved-image.png'}
    ],
    capabilitySnapshot: {
      schemaVersion: 1,
      id: `capability-snapshot-${platform.toLowerCase()}`,
      registryVersion: ACTIVATION_REGISTRY_VERSION,
      registryCapabilityId: registry.capabilityId,
      platform,
      accountId: `account-${platform.toLowerCase()}`,
      layer: registry.layer,
      mode: registry.mode,
      capturedAt: '2026-08-15T08:00:00.000Z',
      expiresAt: '2026-08-18T08:00:00.000Z'
    },
    accountConfirmation: {confirmed: true, accountId: `account-${platform.toLowerCase()}`}
  };
}

function successful(result: HandoffBuildResult): HandoffPackage {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.package;
}

type Writable<T> = {-readonly [K in keyof T]: T[K] extends object ? Writable<T[K]> : T[K]};

function mutate(input: ApprovedActivationInput, change: (value: Writable<ApprovedActivationInput>) => void): ApprovedActivationInput {
  const value = structuredClone(input) as Writable<ApprovedActivationInput>;
  change(value);
  return value;
}
