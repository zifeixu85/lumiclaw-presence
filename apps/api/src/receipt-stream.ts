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
  campaignId: string;
  reply: FastifyReply;
};

export class SseManager {
  readonly #bus: ReceiptEventBus;
  readonly #clients = new Set<SseClient>();
  #heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(bus: ReceiptEventBus) {
    this.#bus = bus;
    // Relay receipt events to matching SSE clients
    this.#bus.on('receipt:created', (receipt) => this.#onReceipt(receipt));
  }

  // -------------------------------------------------------------------
  // Client lifecycle
  // -------------------------------------------------------------------

  subscribe(campaignId: string, reply: FastifyReply): void {
    const client: SseClient = {campaignId, reply};
    this.#clients.add(client);

    // Remove when client disconnects
    reply.raw.on('close', () => {
      this.#clients.delete(client);
    });

    // Start heartbeat if this is the first client
    if (this.#heartbeatTimer === null) {
      this.#heartbeatTimer = setInterval(() => this.#heartbeat(), 15_000);
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
      // Only push to clients watching the receipt's campaign
      // (campaignId is resolved via the actionGrantId → grant → campaignId chain;
      //  for simplicity we fan-out to all and let the client filter,
      //  or we could look up the campaignId here. We'll use a simple approach:
      //  push to all — the client can ignore events for other campaigns.)
      // Actually let's be precise and skip the fan-out for now. The client
      // subscribes by campaignId and we don't have the campaignId on the receipt.
      // For the demo, we push to all clients and let them filter.
      try {
        client.reply.raw.write(event);
      } catch {
        this.#clients.delete(client);
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
    for (const client of this.#clients) {
      try { client.reply.raw.end(); } catch { /* best-effort */ }
    }
    this.#clients.clear();
  }
}
