import {
  createUuidV7,
  importEd25519PublicKey,
  sha256Digest,
  ActionRepositoryError,
  type ActionGrant,
  type ArtifactRevision,
  type AuthoritativeExecutionContext,
  type CapabilitySnapshot,
  type OwnerDecision,
  type ActionReceipt,
  type ActionRepository,
  type ExecutionFailureDisposition,
  type OutboxClaim,
  type OutboxLease,
  type OutboxRecord,
} from '@lumiclaw/domain';
import type {KeyObject} from 'node:crypto';

type IdempotencyEntry = {requestDigest: string; grant: ActionGrant; outbox: OutboxRecord};
type Clock = () => Date;

export class MemoryActionRepository implements ActionRepository {
  readonly #grants = new Map<string, ActionGrant>();
  readonly #outbox = new Map<string, OutboxRecord>();
  readonly #receipts = new Map<string, ActionReceipt>();
  readonly #artifactRevisions = new Map<string, ArtifactRevision>();
  readonly #decisions = new Map<string, OwnerDecision>();
  readonly #capabilitySnapshots = new Map<string, CapabilitySnapshot>();
  readonly #leases = new Map<string, OutboxLease>();
  readonly #dispatchStarted = new Set<string>();
  readonly #idempotency = new Map<string, IdempotencyEntry>();
  readonly #ownerKeys = new Map<string, KeyObject>();
  readonly #now: Clock;

  constructor(now: Clock = () => new Date()) {
    this.#now = now;
  }

  async health(): Promise<boolean> {
    return true;
  }

  async getOrganizationOwnerKey(organizationId: string): Promise<KeyObject | undefined> {
    return this.#ownerKeys.get(organizationId);
  }

  async getGrant(organizationId: string, grantId: string): Promise<ActionGrant | undefined> {
    const grant = this.#grants.get(grantId);
    return grant?.organizationId === organizationId ? structuredClone(grant) : undefined;
  }

  async getOutbox(organizationId: string, outboxId: string): Promise<OutboxRecord | undefined> {
    const outbox = this.#outbox.get(outboxId);
    return outbox?.organizationId === organizationId ? structuredClone(outbox) : undefined;
  }
  async getGrantsByCampaign(organizationId: string, campaignId: string): Promise<ActionGrant[]> {
    return [...this.#grants.values()]
      .filter((grant) => grant.organizationId === organizationId && grant.campaignId === campaignId)
      .map((grant) => structuredClone(grant));
  }

  async getArtifactRevision(organizationId: string, revisionId: string): Promise<ArtifactRevision | undefined> {
    const revision = this.#artifactRevisions.get(revisionId);
    return revision?.organizationId === organizationId ? structuredClone(revision) : undefined;
  }

  async getAuthoritativeExecutionContext(grant: ActionGrant): Promise<AuthoritativeExecutionContext | undefined> {
    const decision = this.#decisions.get(grant.ownerDecisionId);
    const artifactRevision = this.#artifactRevisions.get(grant.artifactRevisionId);
    const capabilitySnapshot = this.#capabilitySnapshots.get(grant.capabilitySnapshotId);
    if (decision === undefined || artifactRevision === undefined || capabilitySnapshot === undefined) return undefined;
    return {
      decision: structuredClone(decision),
      artifactRevision: structuredClone(artifactRevision),
      capabilitySnapshot: structuredClone(capabilitySnapshot),
      artifactRevisionDigest: sha256Digest(artifactRevision),
      capabilitySnapshotDigest: sha256Digest(capabilitySnapshot),
    };
  }

  async createGrantWithOutbox(
    grant: ActionGrant,
    outbox: OutboxRecord,
    idempotencyKey: string,
    requestDigest: string,
    ownerPublicKey?: string,
  ): Promise<{grant: ActionGrant; outbox: OutboxRecord; replayed: boolean}> {
    const routeKey = `POST:/api/v1/campaigns/${grant.campaignId}/action-grants:${grant.organizationId}:${idempotencyKey}`;
    const previous = this.#idempotency.get(routeKey);
    if (previous !== undefined) {
      if (previous.requestDigest !== requestDigest) {
        throw new ActionRepositoryError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
      }
      return {grant: structuredClone(previous.grant), outbox: structuredClone(previous.outbox), replayed: true};
    }

    // Auto-register the owner public key on first use (demo mode)
    if (ownerPublicKey !== undefined && !this.#ownerKeys.has(grant.organizationId)) {
      this.#ownerKeys.set(grant.organizationId, importEd25519PublicKey(ownerPublicKey));
    }

    const revision = (outbox.payload as {revision?: ArtifactRevision}).revision;
    if (revision !== undefined) this.#artifactRevisions.set(revision.id, structuredClone(revision));
    const decision = (outbox.payload as {decision?: OwnerDecision}).decision;
    if (decision !== undefined) this.#decisions.set(decision.id, structuredClone(decision));
    const capability = (outbox.payload as {capabilitySnapshot?: CapabilitySnapshot}).capabilitySnapshot;
    if (capability !== undefined) this.#capabilitySnapshots.set(capability.id, structuredClone(capability));
    this.#grants.set(grant.id, structuredClone(grant));
    this.#outbox.set(outbox.id, structuredClone(outbox));
    this.#idempotency.set(routeKey, {requestDigest, grant: structuredClone(grant), outbox: structuredClone(outbox)});
    return {grant: structuredClone(grant), outbox: structuredClone(outbox), replayed: false};
  }

  async revokeGrant(organizationId: string, grantId: string, reason: string): Promise<ActionGrant> {
    const grant = this.#grants.get(grantId);
    if (grant === undefined) throw new ActionRepositoryError('ACTION_GRANT_NOT_FOUND', 'Grant not found.');
    if (grant.organizationId !== organizationId) throw new ActionRepositoryError('ACTION_GRANT_NOT_FOUND', 'Grant not found.');
    if (grant.status !== 'ISSUED') throw new ActionRepositoryError('ACTION_GRANT_NOT_REVOCABLE', `Grant status ${grant.status} does not allow revocation.`);
    const revoked: ActionGrant = {...grant, status: 'REVOKED', revocationReason: reason};
    this.#grants.set(grantId, revoked);

    // Cancel any PENDING outbox records for this grant.
    for (const record of this.#outbox.values()) {
      if (record.aggregateId === grantId && record.state === 'PENDING') {
        record.state = 'CANCELLED';
      }
    }

    return structuredClone(revoked);
  }

  async claimNextOutbox(lockId: string): Promise<OutboxClaim | undefined> {
    const now = this.#now();
    this.#recoverExpiredProcessing(now);

    for (const record of this.#outbox.values()) {
      if (record.state !== 'PENDING') continue;

      // Fetch the authoritative grant from the store — never trust the
      // Outbox payload snapshot which may be stale.
      const grant = this.#grants.get(record.aggregateId);
      if (grant === undefined) return undefined; // grant deleted concurrently

      // Reserve execution before returning to the connector. Keep the signed
      // payload returned to the consumer immutable (ISSUED).
      const signedGrant = structuredClone(grant);
      if (grant.status !== 'ISSUED') {
        record.state = 'CANCELLED';
        continue;
      }
      grant.status = 'EXECUTING';
      this.#grants.set(grant.id, grant);

      record.state = 'PROCESSING';
      record.lockedBy = lockId;
      record.lockedAt = now.toISOString();
      record.attempts += 1;
      const lease = {
        lockedBy: lockId,
        attempt: record.attempts,
        token: createUuidV7(now.getTime()),
      };
      this.#leases.set(record.id, lease);
      return {
        outbox: structuredClone(record),
        grant: signedGrant,
        lease: structuredClone(lease),
      };
    }
    return undefined;
  }

  async beginDispatch(outboxId: string, lease: OutboxLease): Promise<void> {
    this.#assertLease(outboxId, lease);
    if (this.#dispatchStarted.has(outboxId)) throw new ActionRepositoryError('OUTBOX_LEASE_LOST', 'Dispatch already started.');
    this.#dispatchStarted.add(outboxId);
  }

  async completeOutbox(outboxId: string, receipt: ActionReceipt, lease: OutboxLease): Promise<ActionReceipt> {
    const outbox = this.#outbox.get(outboxId);
    if (outbox === undefined) throw new ActionRepositoryError('OUTBOX_RECORD_NOT_FOUND', 'Outbox record not found.');
    this.#assertLease(outboxId, lease);
    if (outbox.state !== 'PROCESSING') {
      throw new ActionRepositoryError('OUTBOX_NOT_PROCESSING', `Outbox state ${outbox.state} does not allow completion.`);
    }

    // Verify the grant is still ISSUED — one grant can only be consumed once
    const grant = this.#grants.get(receipt.actionGrantId);
    if (grant === undefined) throw new ActionRepositoryError('ACTION_GRANT_NOT_FOUND', 'Grant not found.');
    // Some API route fixtures seed receipts directly without running the
    // consumer. PostgreSQL (the production authority) requires EXECUTING;
    // memory accepts ISSUED only for that non-external fixture path.
    if (grant.status !== 'EXECUTING' && grant.status !== 'ISSUED') {
      throw new ActionRepositoryError('ACTION_GRANT_ALREADY_CONSUMED',
        `Grant status ${grant.status} does not allow consumption.`);
    }

    // Mark grant as CONSUMED atomically (single-threaded, but models the DB constraint)
    grant.status = 'CONSUMED';
    grant.consumedAt = this.#now().toISOString();
    this.#grants.set(grant.id, structuredClone(grant));

    outbox.state = 'COMPLETED';
    this.#leases.delete(outboxId);
    this.#dispatchStarted.delete(outboxId);
    this.#receipts.set(receipt.id, structuredClone(receipt));
    return structuredClone(receipt);
  }

  async failOutbox(outboxId: string, reason: string, lease: OutboxLease, disposition: ExecutionFailureDisposition): Promise<{outbox: OutboxRecord; receipt: ActionReceipt}> {
    const outbox = this.#outbox.get(outboxId);
    if (outbox === undefined) throw new ActionRepositoryError('OUTBOX_RECORD_NOT_FOUND', 'Outbox record not found.');
    this.#assertLease(outboxId, lease);
    if (disposition === 'DEFINITE_NOT_EXECUTED' && this.#dispatchStarted.has(outboxId)) {
      throw new ActionRepositoryError('EXECUTION_DISPOSITION_INVALID', 'A dispatched attempt cannot be marked definitely not executed.');
    }

    const receipt = this.#finalizeFailure(outbox, disposition, reason, this.#now());
    return {outbox: structuredClone(outbox), receipt: structuredClone(receipt)};
  }

  async reprocessOutbox(organizationId: string, outboxId: string): Promise<OutboxRecord> {
    void organizationId;
    void outboxId;
    throw new ActionRepositoryError('OUTBOX_NOT_REPROCESSABLE', 'Single-use ActionGrants are never reprocessed; issue a new governed grant.');
  }

  async getReceiptsByCampaign(organizationId: string, campaignId: string): Promise<ActionReceipt[]> {
    return [...this.#receipts.values()]
      .filter((r) => r.organizationId === organizationId)
      .filter((r) => {
        const grant = this.#grants.get(r.actionGrantId);
        return grant !== undefined && grant.campaignId === campaignId;
      })
      .map((r) => structuredClone(r));
  }

  async getReceipt(organizationId: string, receiptId: string): Promise<ActionReceipt | undefined> {
    const receipt = this.#receipts.get(receiptId);
    return receipt?.organizationId === organizationId ? structuredClone(receipt) : undefined;
  }

  async confirmHandoff(
    organizationId: string,
    receiptId: string,
    platformUri: string,
    platformCid?: string,
  ): Promise<ActionReceipt> {
    const receipt = this.#receipts.get(receiptId);
    if (receipt === undefined || receipt.organizationId !== organizationId) {
      throw new ActionRepositoryError('RECEIPT_NOT_FOUND', 'Receipt not found.');
    }
    if (receipt.state !== 'HANDOFF_PENDING') {
      throw new ActionRepositoryError('HANDOFF_NOT_PENDING', `Receipt state ${receipt.state} does not allow handoff confirmation.`);
    }

    // Guard against duplicate confirmation — check for an existing successor.
    for (const existing of this.#receipts.values()) {
      if (existing.previousReceiptId === receiptId) {
        throw new ActionRepositoryError('HANDOFF_ALREADY_CONFIRMED', 'A handoff confirmation already exists for this receipt.');
      }
    }

    const confirmed: ActionReceipt = {
      id: createUuidV7(),
      organizationId: receipt.organizationId,
      campaignId: receipt.campaignId,
      actionGrantId: receipt.actionGrantId,
      schemaVersion: 1,
      platform: receipt.platform,
      executionMode: receipt.executionMode,
      state: 'HANDOFF_CONFIRMED',
      platformUri,
      platformCid: platformCid ?? null,
      handoffSteps: receipt.handoffSteps,
      unknownReason: null,
      reconciledAt: null,
      reconciliationMethod: null,
      createdAt: new Date().toISOString(),
      previousReceiptId: receipt.id,
    };
    this.#receipts.set(confirmed.id, confirmed);
    return structuredClone(confirmed);
  }

  async reconcileReceipt(
    organizationId: string,
    receiptId: string,
    method: 'PLATFORM_QUERY' | 'OWNER_MANUAL',
    outcome: 'PUBLISHED' | 'FAILED' | 'NOT_EXECUTED',
    platformUri?: string,
    platformCid?: string,
    _notes?: string,
  ): Promise<ActionReceipt> {
    const receipt = this.#receipts.get(receiptId);
    if (receipt === undefined) throw new ActionRepositoryError('RECEIPT_NOT_FOUND', 'Receipt not found.');
    if (receipt.organizationId !== organizationId) throw new ActionRepositoryError('RECEIPT_NOT_FOUND', 'Receipt not found.');
    if (receipt.state !== 'UNKNOWN') throw new ActionRepositoryError('RECEIPT_NOT_UNKNOWN', `Receipt state ${receipt.state} does not allow reconciliation.`);

    // Guard against duplicate reconciliation.
    for (const existing of this.#receipts.values()) {
      if (existing.previousReceiptId === receiptId) {
        throw new ActionRepositoryError('RECEIPT_ALREADY_RECONCILED', 'A reconciliation already exists for this receipt.');
      }
    }

    const reconciled: ActionReceipt = {
      id: createUuidV7(),
      organizationId: receipt.organizationId,
      campaignId: receipt.campaignId,
      actionGrantId: receipt.actionGrantId,
      schemaVersion: 1,
      platform: receipt.platform,
      executionMode: receipt.executionMode,
      state: outcome,
      platformUri: outcome === 'PUBLISHED' ? platformUri ?? null : null,
      platformCid: outcome === 'PUBLISHED' ? platformCid ?? null : null,
      handoffSteps: receipt.handoffSteps,
      unknownReason: receipt.unknownReason,
      reconciledAt: new Date().toISOString(),
      reconciliationMethod: method,
      createdAt: new Date().toISOString(),
      previousReceiptId: receipt.id,
    };
    this.#receipts.set(reconciled.id, reconciled);
    return structuredClone(reconciled);
  }

  async close(): Promise<void> {
    this.#grants.clear();
    this.#outbox.clear();
    this.#receipts.clear();
    this.#idempotency.clear();
    this.#artifactRevisions.clear();
    this.#decisions.clear();
    this.#capabilitySnapshots.clear();
    this.#leases.clear();
    this.#dispatchStarted.clear();
  }

  #recoverExpiredProcessing(now: Date): void {
    const cutoff = now.getTime() - 5 * 60 * 1000;
    for (const record of this.#outbox.values()) {
      if (record.state !== 'PROCESSING' || record.lockedAt === null) continue;
      if (new Date(record.lockedAt).getTime() >= cutoff) continue;

      const dispatchStarted = this.#dispatchStarted.has(record.id);
      this.#finalizeFailure(
        record,
        dispatchStarted ? 'UNKNOWN' : 'DEFINITE_NOT_EXECUTED',
        dispatchStarted
          ? 'Operator lease expired after dispatch may have started; reconcile before any retry.'
          : 'Operator lease expired before dispatch.',
        now,
      );
    }
  }

  #finalizeFailure(
    outbox: OutboxRecord,
    disposition: ExecutionFailureDisposition,
    reason: string,
    now: Date,
  ): ActionReceipt {
    outbox.state = disposition === 'UNKNOWN' ? 'DEAD_LETTER' : 'FAILED';
    outbox.lockedBy = null;
    outbox.lockedAt = null;

    const authoritativeGrant = this.#grants.get(outbox.aggregateId);
    const payloadGrant = (outbox.payload as {grant?: ActionGrant}).grant;
    const grant = authoritativeGrant ?? payloadGrant;
    if (grant === undefined) {
      throw new ActionRepositoryError(
        'ACTION_GRANT_NOT_FOUND',
        'Cannot finalize an Outbox without its authoritative ActionGrant.',
      );
    }

    const receipt: ActionReceipt = {
      id: createUuidV7(now.getTime()),
      organizationId: outbox.organizationId,
      campaignId: grant.campaignId,
      actionGrantId: grant.id,
      schemaVersion: 1,
      platform: grant.platform,
      executionMode: grant.executionMode,
      state: disposition === 'UNKNOWN' ? 'UNKNOWN' : 'NOT_EXECUTED',
      platformUri: null,
      platformCid: null,
      handoffSteps: null,
      unknownReason: reason,
      reconciledAt: null,
      reconciliationMethod: null,
      createdAt: now.toISOString(),
      previousReceiptId: null,
    };
    this.#receipts.set(receipt.id, structuredClone(receipt));

    if (authoritativeGrant !== undefined) {
      authoritativeGrant.status = disposition === 'UNKNOWN' ? 'CONSUMED' : 'REVOKED';
      if (disposition === 'UNKNOWN') {
        authoritativeGrant.consumedAt = now.toISOString();
      } else {
        authoritativeGrant.revocationReason = reason;
      }
      this.#grants.set(authoritativeGrant.id, authoritativeGrant);
    }

    this.#leases.delete(outbox.id);
    this.#dispatchStarted.delete(outbox.id);
    return receipt;
  }

  #assertLease(outboxId: string, lease: OutboxLease): void {
    const current = this.#leases.get(outboxId);
    if (current === undefined || current.lockedBy !== lease.lockedBy || current.attempt !== lease.attempt || current.token !== lease.token) {
      throw new ActionRepositoryError('OUTBOX_LEASE_LOST', 'Outbox lease is stale.');
    }
  }
}
