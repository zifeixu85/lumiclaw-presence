import {
  digestActionGrant,
  ed25519Verify,
  isGrantConsumable,
  createUuidV7,
  type ActionGrant,
  type ActionReceipt,
  type ActionRepository,
  type ArtifactRevision,
  type CapabilitySnapshot,
  type OwnerDecision,
  type OutboxRecord,
} from '@lumiclaw/domain';
import {connectorByPlatform, type PublishConnector} from './connectors.js';

export class OutboxConsumer {
  readonly #repo: ActionRepository;
  readonly #lockId: string;
  readonly #pollMs: number;
  readonly #now: () => Date;
  readonly #onReceipt: ((receipt: ActionReceipt) => void) | undefined;
  readonly #connectors: typeof connectorByPlatform;
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;

  constructor(
    repo: ActionRepository,
    lockId: string,
    pollIntervalMs = 2000,
    now: () => Date = () => new Date(),
    /** Optional callback invoked after every successful receipt creation
     *  so the caller can fan-out via SSE or other channels. */
    onReceipt?: (receipt: ActionReceipt) => void,
    connectors: typeof connectorByPlatform = connectorByPlatform,
  ) {
    this.#repo = repo;
    this.#lockId = lockId;
    this.#pollMs = pollIntervalMs;
    this.#now = now;
    this.#onReceipt = onReceipt;
    this.#connectors = connectors;
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
    const claim = await this.#repo.claimNextOutbox(this.#lockId);
    if (claim === undefined) return null;

    const {outbox: record, grant} = claim;

    // Use the authoritative grant from the DB (locked FOR UPDATE), not the
    // stale snapshot inside the Outbox payload.
    const payload = record.payload as {
      grant: ActionGrant;
      revision: ArtifactRevision;
      decision?: OwnerDecision;
      capabilitySnapshot?: CapabilitySnapshot;
    };
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

    // --- Ed25519 signature (using Organization's registered key, not self-asserted) ---
    const orgKey = await this.#repo.getOrganizationOwnerKey(grant.organizationId);
    if (orgKey === undefined) {
      await this.#repo.failOutbox(record.id, 'Organization owner key not registered.');
      return null;
    }
    if (!ed25519Verify(orgKey, grant.grantDigest, grant.ownerSignature)) {
      await this.#repo.failOutbox(record.id, 'Grant signature invalid against Organization owner key.');
      return null;
    }

    const decision = payload.decision;
    if (decision === undefined || decision.id !== grant.ownerDecisionId ||
        decision.organizationId !== grant.organizationId || decision.campaignId !== grant.campaignId ||
        decision.platform !== grant.platform || decision.executionMode !== grant.executionMode ||
        decision.channelAccountId !== grant.channelAccountId ||
        decision.capabilitySnapshotId !== grant.capabilitySnapshotId ||
        decision.artifactRevisionId !== grant.artifactRevisionId ||
        decision.activationUnitId !== grant.activationUnitId ||
        decision.scheduleOccurrenceId !== grant.scheduleOccurrenceId) {
      await this.#repo.failOutbox(record.id, 'OwnerDecision scope mismatch.');
      return null;
    }
    const capability = payload.capabilitySnapshot;
    const capabilityMode = grant.executionMode === 'DIRECT'
      ? 'DIRECT_PLANNED_NOT_CONNECTED'
      : 'NATIVE_HANDOFF_PLANNED';
    if (capability === undefined || capability.id !== grant.capabilitySnapshotId ||
        capability.organizationId !== grant.organizationId || capability.platform !== grant.platform ||
        capability.channelAccountId !== grant.channelAccountId || capability.executionMode !== capabilityMode ||
        !Number.isFinite(Date.parse(capability.expiresAt)) || Date.parse(capability.expiresAt) <= n.getTime()) {
      await this.#repo.failOutbox(record.id, 'CapabilitySnapshot scope, mode, or validity mismatch.');
      return null;
    }

    // --- dispatch to connector ---
    const connector: PublishConnector | undefined = this.#connectors[grant.platform];
    if (connector === undefined) {
      await this.#repo.failOutbox(record.id,
        `No connector available for platform ${grant.platform}.`);
      return null;
    }

    // Guard: grant.executionMode must match the connector's declared mode (P2-7).
    if (connector.executionMode !== grant.executionMode) {
      await this.#repo.failOutbox(record.id,
        `Execution mode mismatch: grant=${grant.executionMode}, connector=${connector.executionMode}`);
      return null;
    }

    const result = await connector.execute(grant, artifact.content);

    // --- write receipt ---
    if (result.ok) {
      const receipt: ActionReceipt = {
        id: createUuidV7(n.getTime()),
        organizationId: grant.organizationId,
        campaignId: grant.campaignId,
        actionGrantId: grant.id,
        schemaVersion: 1,
        platform: grant.platform,
        executionMode: grant.executionMode,
        state: result.mode === 'DIRECT' ? 'PUBLISHED' : 'HANDOFF_PENDING',
        platformUri: result.mode === 'DIRECT' ? result.platformUri : null,
        platformCid: result.mode === 'DIRECT' ? result.platformCid : null,
        handoffSteps: result.mode === 'NATIVE_HANDOFF' ? result.handoffSteps : null,
        unknownReason: null,
        reconciledAt: null,
        reconciliationMethod: null,
        createdAt: n.toISOString(),
        previousReceiptId: null,
      };
      const saved = await this.#repo.completeOutbox(record.id, receipt);
      this.#onReceipt?.(saved); // fan-out via SSE
      return saved;
    }

    // UNKNOWN result — fail closed, never blind-retry
    const failed = await this.#repo.failOutbox(record.id,
      `UNKNOWN: ${result.message}`);
    this.#onReceipt?.(failed.receipt); // fan-out UNKNOWN receipt via SSE
    return null;
  }
}
