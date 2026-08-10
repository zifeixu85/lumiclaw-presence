import {
  ed25519Sign,
  ed25519Verify,
  exportEd25519PublicKey,
  generateEd25519KeyPair,
  importEd25519PublicKey,
  sha256Digest,
} from './canonical.js';
import type {KeyObject} from 'node:crypto';
import type {CampaignDocument, ScheduleOccurrence} from './campaign-types.js';
import {createDemoCampaignDocument} from './campaign-fixture.js';
import {createUuidV7} from './id.js';
import type {DomainId, Platform, ValidationIssue, ValidationResult} from './types.js';

export type ExecutionMode = 'DIRECT' | 'NATIVE_HANDOFF';
export type ActionGrantStatus = 'ISSUED' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
export type ActionReceiptState = 'PUBLISHED' | 'HANDOFF_PENDING' | 'HANDOFF_CONFIRMED' | 'FAILED' | 'UNKNOWN';
export type ReconciliationMethod = 'PLATFORM_QUERY' | 'OWNER_MANUAL';
export type OutboxState = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

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
 * Create a demo ActionGrant (plus companion OutboxRecord) against
 * the standard demo Campaign.  The grant targets the Bluesky unit
 * (DIRECT execution mode) with a 15‑minute expiry window.
 *
 * This is a convenience wrapper around {@link createActionGrant} for
 * backwards compatibility in tests and the demo golden path.
 */
export function createDemoActionGrant(
  campaign?: CampaignDocument,
  now: Date = new Date('2026-08-08T12:00:00.000Z'),
): {grant: ActionGrant; outbox: OutboxRecord} {
  const document = campaign ?? createDemoCampaignDocument();

  // Pick the Bluesky activation unit — that is the Hero Direct gate.
  const blueskyUnit = document.activationPlan.units.find(
    (u) => u.platform === 'BLUESKY',
  );
  if (blueskyUnit === undefined) {
    throw new Error('Demo Campaign is missing the Bluesky activation unit.');
  }
  const revision = document.artifactRevisions.find(
    (r) => r.activationUnitId === blueskyUnit.id && r.platform === 'BLUESKY',
  );
  if (revision === undefined) {
    throw new Error('Demo Campaign is missing the Bluesky artifact revision.');
  }
  const channelAccount = document.graph.channelAccounts.find(
    (a) => a.platform === 'BLUESKY',
  );
  if (channelAccount === undefined) {
    throw new Error('Demo Campaign is missing the Bluesky channel account.');
  }
  const capability = document.capabilitySnapshots.find(
    (c) => c.platform === 'BLUESKY' && c.channelAccountId === channelAccount.id,
  );
  if (capability === undefined) {
    throw new Error('Demo Campaign is missing the Bluesky capability snapshot.');
  }

  // Use the first schedule occurrence if one exists; otherwise synthesise
  // one and attach it to the Campaign so validation can resolve it.
  let occurrence: ScheduleOccurrence | undefined =
    document.scheduleOccurrences[0];
  if (occurrence === undefined) {
    occurrence = {
      id: id(60),
      organizationId: document.organizationId,
      campaignId: document.id,
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
    document.scheduleOccurrences.push(occurrence);
  }

  return createActionGrant({
    campaign: document,
    platform: 'BLUESKY',
    executionMode: 'DIRECT',
    scheduleOccurrenceId: occurrence.id,
    artifactRevisionId: revision.id,
    activationUnitId: blueskyUnit.id,
    channelAccountId: channelAccount.id,
    capabilitySnapshotId: capability.id,
    now,
  });
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
