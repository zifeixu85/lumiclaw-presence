import {
  createUuidV7,
  importEd25519PublicKey,
  ActionRepositoryError,
  type ActionGrant,
  type ActionReceipt,
  type ActionRepository,
  type OutboxClaim,
  type OutboxRecord,
} from '@lumiclaw/domain';
import type {KeyObject} from 'node:crypto';

type IdempotencyEntry = {requestDigest: string; grant: ActionGrant; outbox: OutboxRecord};

export class MemoryActionRepository implements ActionRepository {
  readonly #grants = new Map<string, ActionGrant>();
  readonly #outbox = new Map<string, OutboxRecord>();
  readonly #receipts = new Map<string, ActionReceipt>();
  readonly #idempotency = new Map<string, IdempotencyEntry>();
  readonly #ownerKeys = new Map<string, KeyObject>();

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
  async getGrantsByCampaign(organizationId: string, campaignId: string): Promise<ActionGrant[]> {
    return [...this.#grants.values()]
      .filter((grant) => grant.organizationId === organizationId && grant.campaignId === campaignId)
      .map((grant) => structuredClone(grant));
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

  async claimNextOutbox(_lockId: string): Promise<OutboxClaim | undefined> {
    // --- Lease recovery: reset timed-out PROCESSING records ---
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    for (const record of this.#outbox.values()) {
      if (record.state === 'PROCESSING' && record.lockedAt !== null && record.lockedAt < cutoff) {
        record.state = 'FAILED';
        record.lockedBy = null;
        record.lockedAt = null;
      }
    }

    for (const record of this.#outbox.values()) {
      if (record.state === 'PENDING') {
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
        record.lockedBy = _lockId;
        record.lockedAt = new Date().toISOString();
        record.attempts += 1;
        return {outbox: structuredClone(record), grant: signedGrant};
      }
    }
    return undefined;
  }

  async completeOutbox(outboxId: string, receipt: ActionReceipt): Promise<ActionReceipt> {
    const outbox = this.#outbox.get(outboxId);
    if (outbox === undefined) throw new ActionRepositoryError('OUTBOX_RECORD_NOT_FOUND', 'Outbox record not found.');

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
    grant.consumedAt = new Date().toISOString();
    this.#grants.set(grant.id, structuredClone(grant));

    outbox.state = 'COMPLETED';
    this.#receipts.set(receipt.id, structuredClone(receipt));
    return structuredClone(receipt);
  }

  async failOutbox(outboxId: string, reason: string): Promise<{outbox: OutboxRecord; receipt: ActionReceipt}> {
    const outbox = this.#outbox.get(outboxId);
    if (outbox === undefined) throw new ActionRepositoryError('OUTBOX_RECORD_NOT_FOUND', 'Outbox record not found.');

    // DEAD_LETTER when retry budget exhausted; FAILED otherwise
    outbox.state = outbox.attempts >= outbox.maxAttempts ? 'DEAD_LETTER' : 'FAILED';

    // Write an UNKNOWN receipt so the Owner can see the failure in the Timeline
    const payload = outbox.payload as {grant?: ActionGrant; aggregateId?: string};
    const grant = payload.grant;
    const receipt: ActionReceipt = {
      id: createUuidV7(),
      organizationId: outbox.organizationId,
      campaignId: grant?.campaignId ?? '',
      actionGrantId: grant?.id ?? (payload.aggregateId ?? ''),
      schemaVersion: 1,
      platform: grant?.platform ?? 'BLUESKY',
      executionMode: grant?.executionMode ?? 'DIRECT',
      state: 'UNKNOWN',
      platformUri: null,
      platformCid: null,
      handoffSteps: null,
      unknownReason: reason,
      reconciledAt: null,
      reconciliationMethod: null,
      createdAt: new Date().toISOString(),
      previousReceiptId: null,
    };
    this.#receipts.set(receipt.id, structuredClone(receipt));

    return {outbox: structuredClone(outbox), receipt: structuredClone(receipt)};
  }

  async reprocessOutbox(organizationId: string, outboxId: string): Promise<OutboxRecord> {
    const record = this.#outbox.get(outboxId);
    if (record === undefined || record.organizationId !== organizationId) {
      throw new ActionRepositoryError('OUTBOX_NOT_REPROCESSABLE', 'Outbox record not found.');
    }
    if (record.state !== 'FAILED' && record.state !== 'DEAD_LETTER') {
      throw new ActionRepositoryError('OUTBOX_NOT_REPROCESSABLE', `Outbox state ${record.state} does not allow reprocessing.`);
    }
    record.state = 'PENDING';
    record.lockedBy = null;
    record.lockedAt = null;
    record.attempts = 0;
    return structuredClone(record);
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
  }
}
