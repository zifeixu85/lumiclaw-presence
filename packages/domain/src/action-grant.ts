import {
  ed25519Sign,
  ed25519Verify,
  exportEd25519PublicKey,
  generateEd25519KeyPair,
  importEd25519PublicKey,
  sha256Digest,
} from './canonical.js';
import type {KeyObject} from 'node:crypto';
import type {ActivationUnit, ArtifactRevision, CampaignDocument, CapabilitySnapshot, ScheduleOccurrence} from './campaign-types.js';
import {createUuidV7} from './id.js';
import type {ChannelAccount, DomainId, Platform, ValidationIssue, ValidationResult} from './types.js';

export type ExecutionMode = 'DIRECT' | 'NATIVE_HANDOFF';
export type ActionGrantStatus = 'ISSUED' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
export type ActionReceiptState = 'PUBLISHED' | 'HANDOFF_PENDING' | 'HANDOFF_CONFIRMED' | 'FAILED' | 'UNKNOWN';
export type ReconciliationMethod = 'PLATFORM_QUERY' | 'OWNER_MANUAL';
export type OutboxState = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * An Owner's explicit decision to authorise an action on a specific platform
 * against a Campaign.  Every ActionGrant must be bound to one OwnerDecision.
 *
 * Persistence: the decision is materialised as the {@link ActionGrant.ownerDecisionId}
 * column.  A dedicated owner_decisions table is deferred to M3-07.
 */
export type OwnerDecision = {
  id: DomainId;
  organizationId: DomainId;
  campaignId: DomainId;
  platform: Platform;
  executionMode: ExecutionMode;
  scheduleOccurrenceId: DomainId;
  artifactRevisionId: DomainId;
  activationUnitId: DomainId;
  /** ChannelAccount resolved from the Campaign at decision time. */
  channelAccountId: DomainId;
  /** CapabilitySnapshot in effect when the decision was made. */
  capabilitySnapshotId: DomainId;
  /** ISO-8601 timestamp of the Owner's decision. */
  decidedAt: string;
};

export type ActionGrant = {
  id: DomainId;
  organizationId: DomainId;
  campaignId: DomainId;
  scheduleOccurrenceId: DomainId;
  artifactRevisionId: DomainId;
  activationUnitId: DomainId;
  schemaVersion: 1;
  platform: Platform;
  executionMode: ExecutionMode;
  status: ActionGrantStatus;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revocationReason: string | null;
  grantDigest: string;
  /** ChannelAccount this grant targets — bound from the OwnerDecision. */
  channelAccountId: DomainId;
  /** CapabilitySnapshot in effect when the grant was issued. */
  capabilitySnapshotId: DomainId;
  /** Ed25519 signature over grantDigest (base64url). */
  ownerSignature: string;
  /** Ed25519 public key embedded for self-contained verification (base64url). */
  ownerPublicKey: string;
  /** OwnerDecision that authorised this grant. */
  ownerDecisionId: DomainId;
};

export type OutboxRecord = {
  id: DomainId;
  organizationId: DomainId;
  aggregateType: 'ACTION_GRANT';
  aggregateId: DomainId;
  schemaVersion: 1;
  payload: unknown;
  state: OutboxState;
  lockedBy: string | null;
  lockedAt: string | null;
  attempts: number;
  createdAt: string;
};

export type ActionReceipt = {
  id: DomainId;
  organizationId: DomainId;
  actionGrantId: DomainId;
  schemaVersion: 1;
  platform: Platform;
  executionMode: ExecutionMode;
  state: ActionReceiptState;
  platformUri: string | null;
  platformCid: string | null;
  handoffSteps: string[] | null;
  unknownReason: string | null;
  reconciledAt: string | null;
  reconciliationMethod: ReconciliationMethod | null;
  createdAt: string;
};

/** Canonical digest of the ActionGrant body, excluding the digest and signature fields. */
export function digestActionGrant(grant: ActionGrant): string {
  const {grantDigest: _, ownerSignature: __, ...body} = grant;
  return sha256Digest(body);
}

/** True when the grant is ISSUED and its expiry window has not passed. */
export function isGrantConsumable(grant: ActionGrant, now: Date): boolean {
  if (grant.status !== 'ISSUED') return false;
  const expiresAt = Date.parse(grant.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

/** True when the grant has been consumed and must not be replayed. */
export function isGrantConsumed(grant: ActionGrant): boolean {
  return grant.status === 'CONSUMED';
}

/**
 * Validate an ActionGrant against its source Campaign.
 * Returns {ok: true} when the grant is scope-correct, digest-intact,
 * not yet expired / revoked / consumed, and references real Campaign
 * children (occurrence + artifact revision).
 */
export function validateActionGrant(
  grant: ActionGrant,
  campaign: CampaignDocument,
  now: Date,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // --- scope ---
  if (grant.organizationId !== campaign.organizationId) {
    issues.push(issue('ACTION_GRANT_SCOPE_INVALID', '/organizationId',
      'Grant organization does not match Campaign.'));
  }
  if (grant.campaignId !== campaign.id) {
    issues.push(issue('ACTION_GRANT_SCOPE_INVALID', '/campaignId',
      'Grant campaign does not match.'));
  }

  // --- digest ---
  const calculated = digestActionGrant(grant);
  if (calculated !== grant.grantDigest) {
    issues.push(issue('ACTION_GRANT_DIGEST_MISMATCH', '/grantDigest',
      'Grant digest does not match canonical body.'));
  }

  // --- Ed25519 signature ---
  if (calculated === grant.grantDigest) {
    const publicKey = importEd25519PublicKey(grant.ownerPublicKey);
    const sigValid = ed25519Verify(publicKey, grant.grantDigest, grant.ownerSignature);
    if (!sigValid) {
      issues.push(issue('ACTION_GRANT_SIGNATURE_INVALID', '/ownerSignature',
        'Ed25519 signature does not verify against the grant digest.'));
    }
  }

  // --- status ---
  if (grant.status === 'EXPIRED') {
    issues.push(issue('ACTION_GRANT_EXPIRED', '/status',
      'Grant has already been marked expired.'));
  }
  if (grant.status === 'REVOKED') {
    issues.push(issue('ACTION_GRANT_REVOKED', '/status',
      'Grant has been revoked by the Owner.'));
  }
  if (grant.status === 'CONSUMED') {
    issues.push(issue('ACTION_GRANT_ALREADY_CONSUMED', '/status',
      'Grant has already been consumed.'));
  }

  // --- expiry window ---
  const expiresAt = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    issues.push(issue('ACTION_GRANT_EXPIRED', '/expiresAt',
      'Grant expiresAt is not a valid date.'));
  } else if (expiresAt <= now.getTime()) {
    issues.push(issue('ACTION_GRANT_EXPIRED', '/expiresAt',
      'Grant has passed its expiry window.'));
  }

  // --- occurrence reference ---
  const occurrence = campaign.scheduleOccurrences.find(
    (o) => o.id === grant.scheduleOccurrenceId,
  );
  if (occurrence === undefined) {
    issues.push(issue('ACTION_GRANT_OCCURRENCE_NOT_FOUND',
      '/scheduleOccurrenceId',
      'Grant occurrence is not in the Campaign.'));
  }

  // --- artifact revision reference ---
  const revision = campaign.artifactRevisions.find(
    (r) => r.id === grant.artifactRevisionId,
  );
  if (revision === undefined) {
    issues.push(issue('ACTION_GRANT_REVISION_NOT_FOUND',
      '/artifactRevisionId',
      'Grant artifact revision is not in the Campaign.'));
  } else if (revision.platform !== grant.platform) {
    issues.push(issue('ACTION_GRANT_SCOPE_INVALID', '/platform',
      'Grant platform does not match artifact revision platform.'));
  } else if (revision.activationUnitId !== grant.activationUnitId) {
    issues.push(issue('ACTION_GRANT_SCOPE_INVALID', '/activationUnitId',
      'Grant activation unit does not match artifact revision.'));
  }

  // --- channel account reference ---
  const channelAccount = campaign.graph.channelAccounts.find(
    (a) => a.id === grant.channelAccountId,
  );
  if (channelAccount === undefined) {
    issues.push(issue('ACTION_GRANT_CHANNEL_ACCOUNT_NOT_FOUND',
      '/channelAccountId',
      'Grant channel account is not in the Campaign graph.'));
  } else if (channelAccount.platform !== grant.platform) {
    issues.push(issue('ACTION_GRANT_SCOPE_INVALID', '/platform',
      'Grant platform does not match channel account platform.'));
  }

  // --- capability snapshot reference ---
  const capability = campaign.capabilitySnapshots.find(
    (c) => c.id === grant.capabilitySnapshotId,
  );
  if (capability === undefined) {
    issues.push(issue('ACTION_GRANT_CAPABILITY_NOT_FOUND',
      '/capabilitySnapshotId',
      'Grant capability snapshot is not in the Campaign.'));
  } else {
    if (capability.platform !== grant.platform) {
      issues.push(issue('ACTION_GRANT_CAPABILITY_PLATFORM_MISMATCH',
        '/capabilitySnapshotId',
        'Capability platform does not match grant platform.'));
    }
    if (capability.channelAccountId !== grant.channelAccountId) {
      issues.push(issue('ACTION_GRANT_CAPABILITY_ACCOUNT_MISMATCH',
        '/capabilitySnapshotId',
        'Capability channel account does not match grant channel account.'));
    }
  }

  return issues.length === 0 ? {ok: true} : {ok: false, issues};
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const entropy = (seed: number): Uint8Array =>
  Uint8Array.from(Array.from({length: 10}, (_, i) => (seed * 13 + i * 19) & 0xff));

const id = (offset: number): string =>
  createUuidV7(1_788_200_000_000 + offset, entropy(offset));

/** Cached demo key pair so all demo grants share the same owner key. */
let _demoKeyPair: {publicKey: KeyObject; privateKey: KeyObject} | undefined;

function getDemoKeyPair(): {publicKey: KeyObject; privateKey: KeyObject} {
  if (_demoKeyPair === undefined) _demoKeyPair = generateEd25519KeyPair();
  return _demoKeyPair;
}

/**
 * Resolve the platform-specific references from a Campaign that are
 * required to create an ActionGrant.  Throws when any reference is
 * missing.
 *
 * Shared by {@link createDemoActionGrant}, the API route, and
 * eventually by the OwnerDecision → Grant path.
 */
export function resolveGrantRefs(
  campaign: CampaignDocument,
  platform: Platform,
): {
  activationUnit: ActivationUnit;
  artifactRevision: ArtifactRevision;
  channelAccount: ChannelAccount;
  capabilitySnapshot: CapabilitySnapshot;
  scheduleOccurrence: ScheduleOccurrence;
} {
  const activationUnit = campaign.activationPlan.units.find(
    (u) => u.platform === platform,
  );
  if (activationUnit === undefined) {
    throw new Error(`Campaign is missing an activation unit for platform ${platform}.`);
  }
  const artifactRevision = campaign.artifactRevisions.find(
    (r) => r.activationUnitId === activationUnit.id && r.platform === platform,
  );
  if (artifactRevision === undefined) {
    throw new Error(`Campaign is missing an artifact revision for platform ${platform}.`);
  }
  const channelAccount = campaign.graph.channelAccounts.find(
    (a) => a.platform === platform,
  );
  if (channelAccount === undefined) {
    throw new Error(`Campaign is missing a channel account for platform ${platform}.`);
  }
  const capabilitySnapshot = campaign.capabilitySnapshots.find(
    (c) => c.platform === platform && c.channelAccountId === channelAccount.id,
  );
  if (capabilitySnapshot === undefined) {
    throw new Error(`Campaign is missing a capability snapshot for platform ${platform}.`);
  }

  // Use the first schedule occurrence if one exists; otherwise synthesise
  // one and attach it to the Campaign so validation can resolve it.
  let scheduleOccurrence: ScheduleOccurrence | undefined =
    campaign.scheduleOccurrences[0];
  if (scheduleOccurrence === undefined) {
    scheduleOccurrence = {
      id: id(60),
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      scheduleId: id(61),
      scheduleVersion: 1,
      schemaVersion: 1,
      ordinal: 1,
      localWallTime: '2026-08-10T09:00:00',
      scheduledForUtc: '2026-08-10T01:00:00.000Z',
      utcOffsetMinutes: 480,
      state: 'PENDING',
      misfireReason: null,
    };
    campaign.scheduleOccurrences.push(scheduleOccurrence);
  }

  return {activationUnit, artifactRevision, channelAccount, capabilitySnapshot, scheduleOccurrence};
}

/**
 * Create an OwnerDecision — the formal record of the Owner's intent to
 * authorise an action on a specific platform against a Campaign.
 *
 * The decision resolves {@link channelAccountId} and
 * {@link capabilitySnapshotId} from the Campaign via
 * {@link resolveGrantRefs}.  Callers supply the remaining references
 * (occurrence, revision, activation unit) explicitly.
 *
 * Every ActionGrant must be bound to an OwnerDecision via
 * {@link createActionGrantFromDecision}.
 */
export function createOwnerDecision(params: {
  campaign: CampaignDocument;
  platform: Platform;
  executionMode: ExecutionMode;
  scheduleOccurrenceId: DomainId;
  artifactRevisionId: DomainId;
  activationUnitId: DomainId;
  now?: Date;
}): OwnerDecision {
  const {
    campaign, platform, executionMode,
    scheduleOccurrenceId, artifactRevisionId, activationUnitId,
    now = new Date('2026-08-08T12:00:00.000Z'),
  } = params;

  const refs = resolveGrantRefs(campaign, platform);

  return {
    id: id(80),
    organizationId: campaign.organizationId,
    campaignId: campaign.id,
    platform,
    executionMode,
    scheduleOccurrenceId,
    artifactRevisionId,
    activationUnitId,
    channelAccountId: refs.channelAccount.id,
    capabilitySnapshotId: refs.capabilitySnapshot.id,
    decidedAt: now.toISOString(),
  };
}

/**
 * Create an ActionGrant (plus companion OutboxRecord) from a formal
 * {@link OwnerDecision}.  This is the canonical path for grant creation —
 * every ActionGrant must be bound to an OwnerDecision.
 *
 * The decision's references are validated against the Campaign before
 * the grant is issued.
 */
export function createActionGrantFromDecision(
  decision: OwnerDecision,
  campaign: CampaignDocument,
  params?: {
    privateKey?: KeyObject;
    publicKey?: KeyObject;
    now?: Date;
  },
): {grant: ActionGrant; outbox: OutboxRecord} {
  const {privateKey, publicKey, now = new Date('2026-08-08T12:00:00.000Z')} = params ?? {};

  // Validate that all decision refs resolve in the Campaign
  const revision = campaign.artifactRevisions.find(
    (r) => r.id === decision.artifactRevisionId,
  );
  if (revision === undefined) {
    throw new Error('Decision artifact revision not found in Campaign.');
  }

  // Build params without optional keys so exactOptionalPropertyTypes passes
  const base = {
    campaign,
    platform: decision.platform,
    executionMode: decision.executionMode,
    scheduleOccurrenceId: decision.scheduleOccurrenceId,
    artifactRevisionId: decision.artifactRevisionId,
    activationUnitId: decision.activationUnitId,
    channelAccountId: decision.channelAccountId,
    capabilitySnapshotId: decision.capabilitySnapshotId,
    ownerDecisionId: decision.id,
  } as const;
  const grantParams: Parameters<typeof createActionGrant>[0] =
    privateKey !== undefined && publicKey !== undefined
      ? {...base, privateKey, publicKey, now}
      : {...base, now};
  return createActionGrant(grantParams);
}

/**
 * Create a demo ActionGrant (plus companion OutboxRecord) against a
 * Campaign.  The caller must supply the target {@link Platform} and
 * {@link ExecutionMode}; all other references are resolved from the
 * Campaign via {@link resolveGrantRefs}.
 *
 * Internally creates a synthetic {@link OwnerDecision} so every grant
 * follows the Decision → Grant path.
 *
 * The grant is issued with a 15‑minute expiry window and state ISSUED.
 * A demo Ed25519 key pair is used for signing.
 */
export function createDemoActionGrant(
  campaign: CampaignDocument,
  params: {
    platform: Platform;
    executionMode: ExecutionMode;
    now?: Date;
  },
): {grant: ActionGrant; outbox: OutboxRecord} {
  const {platform, executionMode, now = new Date('2026-08-08T12:00:00.000Z')} = params;
  const refs = resolveGrantRefs(campaign, platform);

  // Synthesise an OwnerDecision so every grant follows the Decision → Grant path
  const decision = createOwnerDecision({
    campaign,
    platform,
    executionMode,
    scheduleOccurrenceId: refs.scheduleOccurrence.id,
    artifactRevisionId: refs.artifactRevision.id,
    activationUnitId: refs.activationUnit.id,
    now,
  });

  return createActionGrantFromDecision(decision, campaign, {now});
}

/**
 * Create an ActionGrant (plus companion OutboxRecord) against a Campaign.
 * All references (occurrence, revision, activation unit, channel account,
 * capability) must be resolvable from the provided Campaign.
 *
 * The grant is issued with a 15‑minute expiry window and state ISSUED.
 * An Ed25519 signature is produced over the grant digest.  When
 * `privateKey` + `publicKey` are provided they are used directly;
 * otherwise a fresh demo key pair is generated.
 */
export function createActionGrant(params: {
  campaign: CampaignDocument;
  platform: Platform;
  executionMode: ExecutionMode;
  scheduleOccurrenceId: DomainId;
  artifactRevisionId: DomainId;
  activationUnitId: DomainId;
  channelAccountId: DomainId;
  capabilitySnapshotId: DomainId;
  /** OwnerDecision that authorised this grant. */
  ownerDecisionId: DomainId;
  privateKey?: KeyObject;
  publicKey?: KeyObject;
  now?: Date;
}): {grant: ActionGrant; outbox: OutboxRecord} {
  const {
    campaign,
    platform,
    executionMode,
    scheduleOccurrenceId,
    artifactRevisionId,
    activationUnitId,
    channelAccountId,
    capabilitySnapshotId,
    ownerDecisionId,
    privateKey,
    publicKey,
    now = new Date('2026-08-08T12:00:00.000Z'),
  } = params;

  const revision = campaign.artifactRevisions.find(
    (r) => r.id === artifactRevisionId,
  );
  if (revision === undefined) {
    throw new Error('Artifact revision not found in Campaign.');
  }

  // Use provided key pair or reuse the cached demo key pair
  const keyPair: {publicKey: KeyObject; privateKey: KeyObject} =
    privateKey !== undefined && publicKey !== undefined
      ? {publicKey, privateKey}
      : getDemoKeyPair();

  const grantId = id(70);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  const ownerPublicKeyEncoded = exportEd25519PublicKey(keyPair.publicKey);

  const unsigned: Omit<ActionGrant, 'grantDigest' | 'ownerSignature'> = {
    id: grantId,
    organizationId: campaign.organizationId,
    campaignId: campaign.id,
    scheduleOccurrenceId,
    artifactRevisionId,
    activationUnitId,
    schemaVersion: 1,
    platform,
    executionMode,
    status: 'ISSUED',
    issuedAt,
    expiresAt,
    consumedAt: null,
    revocationReason: null,
    channelAccountId,
    capabilitySnapshotId,
    ownerDecisionId,
    ownerPublicKey: ownerPublicKeyEncoded,
  };
  const grantDigest = sha256Digest(unsigned);
  const ownerSignature = ed25519Sign(keyPair.privateKey, grantDigest);

  const grant: ActionGrant = {...unsigned, grantDigest, ownerSignature};

  const outbox: OutboxRecord = {
    id: id(71),
    organizationId: campaign.organizationId,
    aggregateType: 'ACTION_GRANT',
    aggregateId: grantId,
    schemaVersion: 1,
    payload: {grant, revision},
    state: 'PENDING',
    lockedBy: null,
    lockedAt: null,
    attempts: 0,
    createdAt: issuedAt,
  };

  return {grant, outbox};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function issue(
  code: ValidationIssue['code'],
  path: string,
  message: string,
): ValidationIssue {
  return {code, path, message};
}

// ---------------------------------------------------------------------------
// Repository port (implemented by @lumiclaw/db)
// ---------------------------------------------------------------------------

export interface ActionRepository {
  createGrantWithOutbox(
    grant: ActionGrant,
    outbox: OutboxRecord,
    idempotencyKey: string,
    requestDigest: string,
  ): Promise<{grant: ActionGrant; outbox: OutboxRecord; replayed: boolean}>;

  revokeGrant(
    organizationId: string,
    grantId: string,
    reason: string,
  ): Promise<ActionGrant>;

  claimNextOutbox(lockId: string): Promise<OutboxRecord | undefined>;

  completeOutbox(
    outboxId: string,
    receipt: ActionReceipt,
  ): Promise<ActionReceipt>;

  failOutbox(
    outboxId: string,
    reason: string,
  ): Promise<{outbox: OutboxRecord; receipt: ActionReceipt}>;

  getReceiptsByCampaign(
    organizationId: string,
    campaignId: string,
  ): Promise<ActionReceipt[]>;

  getReceipt(
    organizationId: string,
    receiptId: string,
  ): Promise<ActionReceipt | undefined>;

  reconcileReceipt(
    organizationId: string,
    receiptId: string,
    method: ReconciliationMethod,
    notes?: string,
  ): Promise<ActionReceipt>;

  confirmHandoff(
    organizationId: string,
    receiptId: string,
    platformUri: string,
    platformCid?: string,
  ): Promise<ActionReceipt>;

  health(): Promise<boolean>;
  close(): Promise<void>;
}

export class ActionRepositoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ActionRepositoryError';
  }
}
