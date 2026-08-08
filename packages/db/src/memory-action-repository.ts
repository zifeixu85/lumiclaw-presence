import {
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
    outbox.state = 'COMPLETED';
    this.#receipts.set(receipt.id, structuredClone(receipt));
    return structuredClone(receipt);
  }

  async failOutbox(outboxId: string, reason: string): Promise<OutboxRecord> {
    const outbox = this.#outbox.get(outboxId);
    if (outbox === undefined) throw new ActionRepositoryError('OUTBOX_RECORD_NOT_FOUND', 'Outbox record not found.');
    outbox.state = 'FAILED';
    return structuredClone(outbox);
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
