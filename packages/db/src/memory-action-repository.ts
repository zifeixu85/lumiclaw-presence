import {
  createUuidV7,
  digestActionGrant,
  ActionRepositoryError,
  type ActionGrant,
  type ActionReceipt,
  type ActionRepository,
  type OutboxRecord,
} from '@lumiclaw/domain';

type IdempotencyEntry = {requestDigest: string; grant: ActionGrant; outbox: OutboxRecord};

export class MemoryActionRepository implements ActionRepository {
  readonly #grants = new Map<string, ActionGrant>();
  readonly #outbox = new Map<string, OutboxRecord>();
  readonly #receipts = new Map<string, ActionReceipt>();
  readonly #idempotency = new Map<string, IdempotencyEntry>();

  async health(): Promise<boolean> {
    return true;
  }

  async createGrantWithOutbox(
    grant: ActionGrant,
    outbox: OutboxRecord,
    idempotencyKey: string,
    requestDigest: string,
  ): Promise<{grant: ActionGrant; outbox: OutboxRecord; replayed: boolean}> {
    const routeKey = `POST:/api/v1/campaigns/${grant.campaignId}/action-grants:${grant.organizationId}:${idempotencyKey}`;
    const previous = this.#idempotency.get(routeKey);
    if (previous !== undefined) {
      if (previous.requestDigest !== requestDigest) {
        throw new ActionRepositoryError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
      }
      return {grant: structuredClone(previous.grant), outbox: structuredClone(previous.outbox), replayed: true};
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
    return structuredClone(revoked);
  }

  async claimNextOutbox(_lockId: string): Promise<OutboxRecord | undefined> {
    for (const record of this.#outbox.values()) {
      if (record.state === 'PENDING') {
        record.state = 'PROCESSING';
        record.lockedBy = _lockId;
        record.lockedAt = new Date().toISOString();
        record.attempts += 1;
        return structuredClone(record);
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
    if (grant.status !== 'ISSUED') {
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
    outbox.state = 'FAILED';

    // Write an UNKNOWN receipt so the Owner can see the failure in the Timeline
    const payload = outbox.payload as {grant?: ActionGrant; aggregateId?: string};
    const grant = payload.grant;
    const receipt: ActionReceipt = {
      id: createUuidV7(Date.now(), new Uint8Array(10)),
      organizationId: outbox.organizationId,
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
    };
    this.#receipts.set(receipt.id, structuredClone(receipt));

    return {outbox: structuredClone(outbox), receipt: structuredClone(receipt)};
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
    const confirmed: ActionReceipt = {
      ...receipt,
      state: 'HANDOFF_CONFIRMED',
      platformUri,
      platformCid: platformCid ?? null,
    };
    this.#receipts.set(receiptId, confirmed);
    return structuredClone(confirmed);
  }

  async reconcileReceipt(
    organizationId: string,
    receiptId: string,
    method: 'PLATFORM_QUERY' | 'OWNER_MANUAL',
    notes?: string,
  ): Promise<ActionReceipt> {
    const receipt = this.#receipts.get(receiptId);
    if (receipt === undefined) throw new ActionRepositoryError('RECEIPT_NOT_FOUND', 'Receipt not found.');
    if (receipt.organizationId !== organizationId) throw new ActionRepositoryError('RECEIPT_NOT_FOUND', 'Receipt not found.');
    if (receipt.state !== 'UNKNOWN') throw new ActionRepositoryError('RECEIPT_NOT_UNKNOWN', `Receipt state ${receipt.state} does not allow reconciliation.`);
    const reconciled: ActionReceipt = {
      ...receipt,
      reconciledAt: new Date().toISOString(),
      reconciliationMethod: method,
    };
    this.#receipts.set(receiptId, reconciled);
    return structuredClone(reconciled);
  }

  async close(): Promise<void> {
    this.#grants.clear();
    this.#outbox.clear();
    this.#receipts.clear();
    this.#idempotency.clear();
  }
}
