import {
  digestActionGrant,
  isGrantConsumable,
  createUuidV7,
  type ActionGrant,
  type ActionReceipt,
  type ActionRepository,
  type ArtifactRevision,
  type OutboxRecord,
} from '@lumiclaw/domain';
import {connectorByPlatform} from './connectors.js';

const entropy = new Uint8Array(10);

export class OutboxConsumer {
  readonly #repo: ActionRepository;
  readonly #lockId: string;
  readonly #pollMs: number;
  readonly #now: () => Date;
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;

  constructor(
    repo: ActionRepository,
    lockId: string,
    pollIntervalMs = 2000,
    now: () => Date = () => new Date(),
  ) {
    this.#repo = repo;
    this.#lockId = lockId;
    this.#pollMs = pollIntervalMs;
    this.#now = now;
  }

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#timer = setInterval(() => {
      this.processOne().catch(() => {
        /* consumer errors are surfaced via failOutbox — never crash the loop */
      });
    }, this.#pollMs);
  }

  stop(): void {
    this.#running = false;
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  get running(): boolean {
    return this.#running;
  }

  // -------------------------------------------------------------------
  // Single-message consume (public for testing)
  // -------------------------------------------------------------------

  async processOne(): Promise<ActionReceipt | null> {
    const record = await this.#repo.claimNextOutbox(this.#lockId);
    if (record === undefined) return null;

    // Decode payload
    const payload = record.payload as {
      grant: ActionGrant;
      revision: ArtifactRevision;
    };
    const grant = payload.grant;
    const artifact = payload.revision;

    // --- grant validation ---
    const n = this.#now();
    if (!isGrantConsumable(grant, n)) {
      const reason = grant.status === 'EXPIRED'
        ? 'Grant has expired.'
        : grant.status === 'REVOKED'
          ? 'Grant was revoked.'
          : 'Grant is not consumable.';
      await this.#repo.failOutbox(record.id, reason);
      return null;
    }
    const calculated = digestActionGrant(grant);
    if (calculated !== grant.grantDigest) {
      await this.#repo.failOutbox(record.id, 'Grant digest mismatch.');
      return null;
    }

    // --- dispatch to connector ---
    const connector = connectorByPlatform[grant.platform];
    if (connector === undefined) {
      await this.#repo.failOutbox(record.id,
        `No connector available for platform ${grant.platform}.`);
      return null;
    }

    const result = await connector.execute(grant, artifact.content);

    // --- write receipt ---
    if (result.ok) {
      const receipt: ActionReceipt = {
        id: createUuidV7(n.getTime(), entropy),
        organizationId: grant.organizationId,
        actionGrantId: grant.id,
        schemaVersion: 1,
        platform: grant.platform,
        executionMode: grant.executionMode,
        state: result.mode === 'DIRECT' ? 'PUBLISHED' : 'HANDOFF_CONFIRMED',
        platformUri: result.mode === 'DIRECT' ? result.platformUri : null,
        platformCid: result.mode === 'DIRECT' ? result.platformCid : null,
        handoffSteps: result.mode === 'NATIVE_HANDOFF' ? result.handoffSteps : null,
        unknownReason: null,
        reconciledAt: null,
        reconciliationMethod: null,
        createdAt: n.toISOString(),
      };
      return await this.#repo.completeOutbox(record.id, receipt);
    }

    // UNKNOWN result — fail closed, never blind-retry
    await this.#repo.failOutbox(record.id,
      `UNKNOWN: ${result.message}`);
    return null;
  }
}
