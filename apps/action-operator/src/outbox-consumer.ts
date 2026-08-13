import {
  digestActionGrant,
  ed25519Verify,
  isGrantConsumable,
  createUuidV7,
  sha256Digest,
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

    const {outbox: record, grant, lease} = claim;
    const failBeforeDispatch = async (reason: string): Promise<null> => {
      const failed = await this.#repo.failOutbox(record.id, reason, lease, 'DEFINITE_NOT_EXECUTED');
      this.#onReceipt?.(failed.receipt);
      return null;
    };

    // Use the authoritative grant from the DB (locked FOR UPDATE), not the
    // stale snapshot inside the Outbox payload.
    const payload = record.payload as {
      grant: ActionGrant;
      revision: ArtifactRevision;
      decision?: OwnerDecision;
      capabilitySnapshot?: CapabilitySnapshot;
    };
    const context = await this.#repo.getAuthoritativeExecutionContext(grant);
    if (context === undefined) return failBeforeDispatch('Authoritative execution context not found.');
    const {artifactRevision: artifact, decision, capabilitySnapshot: capability} = context;
    if (artifact === undefined || artifact.id !== grant.artifactRevisionId ||
        artifact.organizationId !== grant.organizationId || artifact.campaignId !== grant.campaignId ||
        artifact.activationUnitId !== grant.activationUnitId || artifact.platform !== grant.platform ||
        artifact.capabilitySnapshotId !== grant.capabilitySnapshotId) {
      return failBeforeDispatch('Authoritative ArtifactRevision scope mismatch.');
    }
    if (JSON.stringify(payload.revision) !== JSON.stringify(artifact)) {
      return failBeforeDispatch('Outbox ArtifactRevision differs from the authoritative Revision.');
    }

    // --- grant validation ---
    const n = this.#now();
    if (!isGrantConsumable(grant, n)) {
      const reason = grant.status === 'EXPIRED'
        ? 'Grant has expired.'
        : grant.status === 'REVOKED'
          ? 'Grant was revoked.'
          : 'Grant is not consumable.';
      return failBeforeDispatch(reason);
    }
    const calculated = digestActionGrant(grant);
    if (calculated !== grant.grantDigest) {
      return failBeforeDispatch('Grant digest mismatch.');
    }

    // --- Ed25519 signature (using Organization's registered key, not self-asserted) ---
    const orgKey = await this.#repo.getOrganizationOwnerKey(grant.organizationId);
    if (orgKey === undefined) {
      return failBeforeDispatch('Organization owner key not registered.');
    }
    if (!ed25519Verify(orgKey, grant.grantDigest, grant.ownerSignature)) {
      return failBeforeDispatch('Grant signature invalid against Organization owner key.');
    }

    if (decision.id !== grant.ownerDecisionId ||
        decision.organizationId !== grant.organizationId || decision.campaignId !== grant.campaignId ||
        decision.platform !== grant.platform || decision.executionMode !== grant.executionMode ||
        decision.channelAccountId !== grant.channelAccountId ||
        decision.capabilitySnapshotId !== grant.capabilitySnapshotId ||
        decision.artifactRevisionId !== grant.artifactRevisionId ||
        decision.activationUnitId !== grant.activationUnitId ||
        decision.scheduleOccurrenceId !== grant.scheduleOccurrenceId) {
      return failBeforeDispatch('OwnerDecision scope mismatch.');
    }
    if (payload.decision === undefined || JSON.stringify(payload.decision) !== JSON.stringify(decision) ||
        payload.capabilitySnapshot === undefined || JSON.stringify(payload.capabilitySnapshot) !== JSON.stringify(capability)) {
      return failBeforeDispatch('Outbox governance snapshots differ from authoritative records.');
    }
    if (sha256Digest(artifact) !== context.artifactRevisionDigest ||
        sha256Digest(capability) !== context.capabilitySnapshotDigest) {
      return failBeforeDispatch('Authoritative execution digest mismatch.');
    }
    const capabilityMode = grant.executionMode === 'DIRECT'
      ? 'DIRECT_PLANNED_NOT_CONNECTED'
      : 'NATIVE_HANDOFF_PLANNED';
    if (capability === undefined || capability.id !== grant.capabilitySnapshotId ||
        capability.organizationId !== grant.organizationId || capability.platform !== grant.platform ||
        capability.channelAccountId !== grant.channelAccountId || capability.executionMode !== capabilityMode ||
        !Number.isFinite(Date.parse(capability.expiresAt)) || Date.parse(capability.expiresAt) <= n.getTime()) {
      return failBeforeDispatch('CapabilitySnapshot scope, mode, or validity mismatch.');
    }

    // --- dispatch to connector ---
    const connector: PublishConnector | undefined = this.#connectors[grant.platform];
    if (connector === undefined) {
      return failBeforeDispatch(`No connector available for platform ${grant.platform}.`);
    }

    // Guard: grant.executionMode must match the connector's declared mode (P2-7).
    if (connector.executionMode !== grant.executionMode) {
      return failBeforeDispatch(`Execution mode mismatch: grant=${grant.executionMode}, connector=${connector.executionMode}`);
    }

    await this.#repo.beginDispatch(record.id, lease);
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
      const saved = await this.#repo.completeOutbox(record.id, receipt, lease);
      this.#onReceipt?.(saved); // fan-out via SSE
      return saved;
    }

    // UNKNOWN result — fail closed, never blind-retry
    const failed = await this.#repo.failOutbox(record.id,
      `UNKNOWN: ${result.message}`, lease, 'UNKNOWN');
    this.#onReceipt?.(failed.receipt); // fan-out UNKNOWN receipt via SSE
    return null;
  }
}
