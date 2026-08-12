import type {ActionReceipt} from '@lumiclaw/domain';
import type {FastifyReply} from 'fastify';

// ---------------------------------------------------------------------------
// EventBus — lightweight publish / subscribe for receipt lifecycle events
// ---------------------------------------------------------------------------

export class ReceiptEventBus {
  readonly #listeners = new Map<string, Set<(receipt: ActionReceipt) => void>>();

  on(event: string, handler: (receipt: ActionReceipt) => void): void {
    let set = this.#listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(handler);
  }

  off(event: string, handler: (receipt: ActionReceipt) => void): void {
    this.#listeners.get(event)?.delete(handler);
  }

  emit(event: string, receipt: ActionReceipt): void {
    for (const handler of this.#listeners.get(event) ?? []) {
      try { handler(receipt); } catch { /* one broken subscriber must not crash others */ }
    }
  }
}

// ---------------------------------------------------------------------------
// SseManager — manages SSE client connections and fan-out
// ---------------------------------------------------------------------------

type SseClient = {
  organizationId: string;
  campaignId: string;
  reply: FastifyReply;
  seenReceiptIds: Set<string>;
};

export class SseManager {
  readonly #bus: ReceiptEventBus;
  readonly #clients = new Set<SseClient>();
  #heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  #pollTimer: ReturnType<typeof setInterval> | null = null;
  readonly #loadReceipts: ((organizationId: string, campaignId: string) => Promise<ActionReceipt[]>) | undefined;

  constructor(bus: ReceiptEventBus, loadReceipts?: (organizationId: string, campaignId: string) => Promise<ActionReceipt[]>) {
    this.#bus = bus;
    this.#loadReceipts = loadReceipts;
    // Relay receipt events to matching SSE clients
    this.#bus.on('receipt:created', (receipt) => this.#onReceipt(receipt));
  }

  // -------------------------------------------------------------------
  // Client lifecycle
  // -------------------------------------------------------------------

  subscribe(organizationId: string, campaignId: string, reply: FastifyReply): void {
    const client: SseClient = {organizationId, campaignId, reply, seenReceiptIds: new Set()};
    this.#clients.add(client);

    // Remove when client disconnects
    reply.raw.on('close', () => {
      this.#clients.delete(client);
    });

    // Start heartbeat if this is the first client
    if (this.#heartbeatTimer === null) {
      this.#heartbeatTimer = setInterval(() => this.#heartbeat(), 15_000);
    }
    if (this.#loadReceipts !== undefined && this.#pollTimer === null) {
      this.#pollTimer = setInterval(() => { void this.#pollDatabase(); }, 1_000);
    }
  }

  // -------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------

  /** Called by external code when a receipt has been persisted. */
  notifyReceiptCreated(receipt: ActionReceipt): void {
    this.#bus.emit('receipt:created', receipt);
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  #onReceipt(receipt: ActionReceipt): void {
    const event = `event: receipt_created\ndata: ${JSON.stringify({event: 'receipt_created', receipt})}\n\n`;
    for (const client of this.#clients) {
      // Isolate by Organization + Campaign — no cross-tenant leakage.
      if (client.organizationId !== receipt.organizationId) continue;
      if (client.campaignId !== receipt.campaignId) continue;
      if (client.seenReceiptIds.has(receipt.id)) continue;
      client.seenReceiptIds.add(receipt.id);
      try {
        client.reply.raw.write(event);
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  async #pollDatabase(): Promise<void> {
    if (this.#loadReceipts === undefined) return;
    for (const client of this.#clients) {
      try {
        const receipts = await this.#loadReceipts(client.organizationId, client.campaignId);
        for (const receipt of receipts.reverse()) this.#onReceipt(receipt);
      } catch {
        // A transient database failure must not cross scopes or close clients.
      }
    }
  }

  #heartbeat(): void {
    const hb = `:heartbeat\n\n`;
    for (const client of this.#clients) {
      try { client.reply.raw.write(hb); } catch { this.#clients.delete(client); }
    }
  }

  // -------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------

  close(): void {
    if (this.#heartbeatTimer !== null) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
    if (this.#pollTimer !== null) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
    for (const client of this.#clients) {
      try { client.reply.raw.end(); } catch { /* best-effort */ }
    }
    this.#clients.clear();
  }
}
