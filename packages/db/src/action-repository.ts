import {
  ActionRepositoryError,
  computeOwnerKeyId,
  createUuidV7,
  importEd25519PublicKey,
  type ActionGrant,
  type OwnerDecision,
  type ActionReceipt,
  type ActionRepository,
  type OutboxClaim,
  type OutboxRecord,
  type OutboxState,
} from '@lumiclaw/domain';
import {Pool, type PoolClient} from 'pg';
import type {KeyObject} from 'node:crypto';

// ---------------------------------------------------------------------------
// Postgres implementation
// ---------------------------------------------------------------------------

export class PostgresActionRepository implements ActionRepository {
  readonly #pool: Pool;

  constructor(connectionString: string) {
    this.#pool = new Pool({connectionString, max: 8});
    this.#pool.on('error', () =>
      console.error(JSON.stringify({code: 'POSTGRES_ACTION_IDLE_CLIENT_ERROR'})),
    );
  }

  async health(): Promise<boolean> {
    const result = await this.#pool.query(
      "select to_regclass('public.action_grants') as marker",
    );
    return result.rows[0]?.marker === 'action_grants';
  }

  async getOrganizationOwnerKey(organizationId: string): Promise<KeyObject | undefined> {
    const result = await this.#pool.query(
      `select owner_public_key from organizations where id = $1`,
      [organizationId],
    );
    if (result.rowCount === 0 || result.rows[0].owner_public_key === null) return undefined;
    return importEd25519PublicKey(result.rows[0].owner_public_key as string);
  }

  async getGrant(organizationId: string, grantId: string): Promise<ActionGrant | undefined> {
    const result = await this.#pool.query(
      `select status, payload from action_grants where organization_id=$1 and id=$2`,
      [organizationId, grantId],
    );
    return result.rowCount === 0 ? undefined : {...result.rows[0].payload as ActionGrant, status: result.rows[0].status as ActionGrant['status']};
  }

  async getGrantsByCampaign(organizationId: string, campaignId: string): Promise<ActionGrant[]> {
    const result = await this.#pool.query(
      `select status, payload from action_grants where organization_id=$1 and campaign_id=$2 order by created_at desc`,
      [organizationId, campaignId],
    );
    return result.rows.map((row) => ({...row.payload as ActionGrant, status: row.status as ActionGrant['status']}));
  }

  // -----------------------------------------------------------------------
  // Write — API layer
  // -----------------------------------------------------------------------

  async createGrantWithOutbox(
    grant: ActionGrant,
    outbox: OutboxRecord,
    idempotencyKey: string,
    requestDigest: string,
    ownerPublicKey?: string,
  ): Promise<{grant: ActionGrant; outbox: OutboxRecord; replayed: boolean}> {
    return this.#transaction(async (client) => {
      const route = `/api/v1/campaigns/${grant.campaignId}/action-grants`;

      // Auto-register owner public key when provided (demo mode / first use)
      if (ownerPublicKey !== undefined) {
        await client.query(
          `update organizations set owner_public_key = $2
           where id = $1 and owner_public_key is null`,
          [grant.organizationId, ownerPublicKey],
        );
        const registered = await client.query(`select owner_public_key from organizations where id=$1`, [grant.organizationId]);
        const key = registered.rows[0]?.owner_public_key as string | null | undefined;
        if (key === undefined || key === null || computeOwnerKeyId(importEd25519PublicKey(key)) !== grant.ownerKeyId) {
          throw new ActionRepositoryError('OWNER_SIGNING_KEY_MISMATCH', 'Grant was not signed by the Organization registered owner key.');
        }
      }

      // Idempotency guard
      await client.query(
        'select pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${grant.organizationId}:${route}:${idempotencyKey}`],
      );
      const replay = await client.query(
        `select request_digest, response_body, response_etag from idempotency_records
         where organization_id=$1 and method=$2 and route=$3 and idempotency_key=$4`,
        [grant.organizationId, 'POST', route, idempotencyKey],
      );
      if (replay.rowCount !== 0) {
        if (String(replay.rows[0].request_digest).trim() !== requestDigest) {
          throw new ActionRepositoryError(
            'IDEMPOTENCY_KEY_REUSED',
            'Idempotency key was reused with a different body.',
          );
        }
        const body = replay.rows[0].response_body as {grant: ActionGrant; outbox: OutboxRecord};
        return {grant: body.grant, outbox: body.outbox, replayed: true};
      }

      const decision = (outbox.payload as {decision?: OwnerDecision}).decision;
      if (decision === undefined || decision.id !== grant.ownerDecisionId ||
          decision.organizationId !== grant.organizationId || decision.campaignId !== grant.campaignId ||
          decision.platform !== grant.platform || decision.executionMode !== grant.executionMode ||
          decision.scheduleOccurrenceId !== grant.scheduleOccurrenceId ||
          decision.artifactRevisionId !== grant.artifactRevisionId ||
          decision.activationUnitId !== grant.activationUnitId ||
          decision.channelAccountId !== grant.channelAccountId ||
          decision.capabilitySnapshotId !== grant.capabilitySnapshotId) {
        throw new ActionRepositoryError('OWNER_DECISION_SCOPE_INVALID', 'OwnerDecision does not exactly authorize this ActionGrant.');
      }
      const authoritativeScope = await client.query(
        `select ar.digest as artifact_revision_digest,
                encode(sha256(convert_to(cs.payload::text, 'UTF8')), 'hex') as capability_snapshot_digest
           from artifact_revisions ar
           join capability_snapshots cs on cs.organization_id=ar.organization_id and cs.id=$3
          where ar.organization_id=$1 and ar.id=$2`,
        [decision.organizationId, decision.artifactRevisionId, decision.capabilitySnapshotId],
      );
      if (authoritativeScope.rowCount !== 1) throw new ActionRepositoryError('OWNER_DECISION_AUTHORITY_NOT_FOUND', 'Authoritative Revision or CapabilitySnapshot was not found.');
      const artifactRevisionDigest = String(authoritativeScope.rows[0].artifact_revision_digest).trim();
      const capabilitySnapshotDigest = String(authoritativeScope.rows[0].capability_snapshot_digest).trim();
      await client.query(
        `insert into owner_decisions(organization_id,id,campaign_id,platform,execution_mode,schedule_occurrence_id,artifact_revision_id,activation_unit_id,channel_account_id,capability_snapshot_id,artifact_revision_digest,capability_snapshot_digest,decided_by,payload,decided_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [decision.organizationId, decision.id, decision.campaignId, decision.platform,
          decision.executionMode, decision.scheduleOccurrenceId, decision.artifactRevisionId,
          decision.activationUnitId, decision.channelAccountId, decision.capabilitySnapshotId,
          artifactRevisionDigest, capabilitySnapshotDigest, 'OWNER', JSON.stringify(decision), decision.decidedAt],
      );

      // Atomic insert: decision + grant + outbox
      await client.query(
        `insert into action_grants(organization_id,id,campaign_id,schedule_occurrence_id,artifact_revision_id,activation_unit_id,schema_version,platform,execution_mode,status,issued_at,expires_at,grant_digest,channel_account_id,capability_snapshot_id,owner_signature,owner_key_id,owner_decision_id,payload,created_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          grant.organizationId, grant.id, grant.campaignId,
          grant.scheduleOccurrenceId, grant.artifactRevisionId,
          grant.activationUnitId, grant.schemaVersion, grant.platform,
          grant.executionMode, grant.status, grant.issuedAt, grant.expiresAt,
          grant.grantDigest, grant.channelAccountId, grant.capabilitySnapshotId,
          grant.ownerSignature, grant.ownerKeyId, grant.ownerDecisionId,
          JSON.stringify(grant), grant.issuedAt,
        ],
      );
      await client.query(
        `insert into outbox(organization_id,id,aggregate_type,aggregate_id,schema_version,payload,state,attempts,created_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          outbox.organizationId, outbox.id, outbox.aggregateType,
          outbox.aggregateId, outbox.schemaVersion,
          JSON.stringify(outbox.payload), outbox.state, outbox.attempts,
          outbox.createdAt,
        ],
      );

      // Write idempotency record
      const responseBody = {grant, outbox};
      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await client.query(
        `insert into idempotency_records(organization_id,method,route,idempotency_key,request_digest,status_code,response_body,response_etag,expires_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          grant.organizationId, 'POST', route, idempotencyKey,
          requestDigest, 201, JSON.stringify(responseBody), grant.grantDigest,
          expires,
        ],
      );

      return {grant, outbox, replayed: false};
    });
  }

  async revokeGrant(
    organizationId: string,
    grantId: string,
    reason: string,
  ): Promise<ActionGrant> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query(
        `select payload from action_grants
         where organization_id=$1 and id=$2 for update`,
        [organizationId, grantId],
      );
      if (locked.rowCount === 0) {
        throw new ActionRepositoryError(
          'ACTION_GRANT_NOT_FOUND',
          'Grant not found.',
        );
      }
      const grant = locked.rows[0].payload as ActionGrant;
      if (grant.status !== 'ISSUED') {
        throw new ActionRepositoryError(
          'ACTION_GRANT_NOT_REVOCABLE',
          `Grant status ${grant.status} does not allow revocation.`,
        );
      }
      const revoked: ActionGrant = {
        ...grant,
        status: 'REVOKED',
        revocationReason: reason,
      };
      await client.query(
        `update action_grants set status=$1, revocation_reason=$2, payload=$3
         where organization_id=$4 and id=$5`,
        [revoked.status, revoked.revocationReason, JSON.stringify(revoked),
          organizationId, grantId],
      );

      // Cancel any PENDING outbox records so they are never picked up by the
      // consumer.  PROCESSING records will be stopped by the authoritative
      // grant check in claimNextOutbox (P1-3).
      await client.query(
        `update outbox set state='CANCELLED'
         where organization_id=$1 and aggregate_id=$2 and state='PENDING'`,
        [organizationId, grantId],
      );

      await client.query('commit');
      return revoked;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  // -----------------------------------------------------------------------
  // Consume — action-operator
  // -----------------------------------------------------------------------

  async claimNextOutbox(lockId: string): Promise<OutboxClaim | undefined> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');

      // --- Lease recovery: reset timed-out PROCESSING records ---
      const leaseCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      // Stalled records within retry budget → back to PENDING
      const stalled = await client.query(
        `with stalled as (
           update outbox set state='FAILED', locked_by=NULL, locked_at=NULL,
             payload=payload || jsonb_build_object('failureReason','UNKNOWN: operator lease expired; reconciliation required')
           where state='PROCESSING' and locked_at < $1
           returning organization_id, aggregate_id, payload
         )
         select organization_id, aggregate_id, payload from stalled`,
        [leaseCutoff],
      );
      for (const recovered of stalled.rows) {
        const payload = recovered.payload as {grant: ActionGrant};
        await client.query(
          `insert into action_receipts(organization_id,id,campaign_id,action_grant_id,schema_version,platform,execution_mode,state,unknown_reason,created_at,previous_receipt_id)
           values($1,$2,$3,$4,1,$5,$6,'UNKNOWN',$7,now(),null)`,
          [recovered.organization_id, createUuidV7(), payload.grant.campaignId, recovered.aggregate_id, payload.grant.platform, payload.grant.executionMode, 'Operator lease expired after dispatch may have started; reconcile before any retry.'],
        );
      }
      // Stalled records that exhausted retries → DEAD_LETTER
      // Stalled rows were moved to UNKNOWN above; they are never auto-retried.

      const row = await client.query(
        `select id, organization_id, aggregate_type, aggregate_id,
                schema_version, payload, state, attempts, max_attempts, created_at
         from outbox
         where state = 'PENDING'
         order by created_at
         limit 1
         for update skip locked`,
      );
      if (row.rowCount === 0) {
        // Lease-expiry recovery above is authoritative business state. Even
        // when there is no new PENDING work, persist FAILED + UNKNOWN so a
        // later poll cannot blindly retry an externally ambiguous action.
        await client.query('commit');
        return undefined;
      }
      const r = row.rows[0]!;
      const orgId = r.organization_id as string;
      const aggregateId = r.aggregate_id as string;

      // Lock the authoritative grant row in the same transaction.
      // The consumer must use this grant — never the stale Outbox payload snapshot.
      const grantRow = await client.query(
        `select payload from action_grants
         where organization_id=$1 and id=$2 for update`,
        [orgId, aggregateId],
      );
      if (grantRow.rowCount === 0) {
        await client.query('rollback');
        return undefined; // grant deleted concurrently
      }
      const grant = grantRow.rows[0].payload as ActionGrant;

      const reserved = await client.query(
        `update action_grants set status='EXECUTING'
         where organization_id=$1 and id=$2 and status='ISSUED' returning id`,
        [orgId, aggregateId],
      );
      if (reserved.rowCount === 0) {
        await client.query(`update outbox set state='CANCELLED', locked_by=NULL, locked_at=NULL where organization_id=$1 and id=$2`, [orgId, r.id]);
        await client.query('commit');
        return undefined;
      }

      const now = new Date().toISOString();
      await client.query(
        `update outbox set state='PROCESSING', locked_by=$1, locked_at=$2,
                attempts=attempts+1
         where organization_id=$3 and id=$4`,
        [lockId, now, orgId, r.id as string],
      );
      await client.query('commit');

      const outbox: OutboxRecord = {
        id: r.id as string,
        organizationId: orgId,
        aggregateType: r.aggregate_type as 'ACTION_GRANT',
        aggregateId,
        schemaVersion: 1,
        payload: r.payload,
        state: 'PROCESSING',
        lockedBy: lockId,
        lockedAt: now,
        attempts: (r.attempts as number) + 1,
        maxAttempts: (r.max_attempts as number) ?? 3,
        createdAt: (r.created_at as Date).toISOString(),
      };
      return {outbox, grant};
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeOutbox(
    outboxId: string,
    receipt: ActionReceipt,
  ): Promise<ActionReceipt> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      const row = await client.query(
        `select organization_id, aggregate_id from outbox where id=$1 for update`,
        [outboxId],
      );
      if (row.rowCount === 0) {
        throw new ActionRepositoryError(
          'OUTBOX_RECORD_NOT_FOUND',
          'Outbox record not found.',
        );
      }
      const orgId = row.rows[0].organization_id as string;
      const grantId = row.rows[0].aggregate_id as string;

      // Lock the grant row and verify it is still ISSUED
      const grantRow = await client.query(
        `select status, payload from action_grants
         where organization_id=$1 and id=$2 for update`,
        [orgId, grantId],
      );
      if (grantRow.rowCount === 0) {
        throw new ActionRepositoryError(
          'ACTION_GRANT_NOT_FOUND',
          'Grant not found.',
        );
      }
      const grantStatus = grantRow.rows[0].status as string;
      if (grantStatus !== 'EXECUTING') {
        throw new ActionRepositoryError(
          'ACTION_GRANT_ALREADY_CONSUMED',
          `Grant status ${grantStatus} does not allow consumption.`,
        );
      }

      // Mark grant as CONSUMED atomically
      const consumedAt = new Date().toISOString();
      const grantPayload = grantRow.rows[0].payload as Record<string, unknown>;
      const updatedGrant = {...grantPayload, status: 'CONSUMED', consumedAt};
      await client.query(
        `update action_grants set status='CONSUMED', consumed_at=$1, payload=$2
         where organization_id=$3 and id=$4`,
        [consumedAt, JSON.stringify(updatedGrant), orgId, grantId],
      );

      await client.query(
        `update outbox set state='COMPLETED' where organization_id=$1 and id=$2`,
        [orgId, outboxId],
      );
      await client.query(
        `insert into action_receipts(organization_id,id,campaign_id,action_grant_id,schema_version,platform,execution_mode,state,platform_uri,platform_cid,handoff_steps,created_at,previous_receipt_id)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          receipt.organizationId, receipt.id, receipt.campaignId,
          receipt.actionGrantId,
          receipt.schemaVersion, receipt.platform, receipt.executionMode,
          receipt.state, receipt.platformUri, receipt.platformCid,
          receipt.handoffSteps !== null ? JSON.stringify(receipt.handoffSteps) : null,
          receipt.createdAt,
          receipt.previousReceiptId,
        ],
      );
      await client.query('commit');
      return receipt;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async failOutbox(
    outboxId: string,
    reason: string,
  ): Promise<{outbox: OutboxRecord; receipt: ActionReceipt}> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      const row = await client.query(
        `select organization_id, payload, state, attempts, max_attempts from outbox where id=$1 for update`,
        [outboxId],
      );
      if (row.rowCount === 0) {
        throw new ActionRepositoryError(
          'OUTBOX_RECORD_NOT_FOUND',
          'Outbox record not found.',
        );
      }
      const orgId = row.rows[0].organization_id as string;
      if (row.rows[0].state !== 'PROCESSING') {
        throw new ActionRepositoryError('OUTBOX_NOT_PROCESSING', 'Only a claimed PROCESSING outbox can be failed.');
      }
      const payload = row.rows[0].payload as Record<string, unknown>;
      const grant = (payload as {grant?: ActionGrant}).grant;

      const maxAttempts = (row.rows[0].max_attempts as number) ?? 3;
      const attempts = row.rows[0].attempts as number;
      const terminalState: OutboxState = attempts >= maxAttempts ? 'DEAD_LETTER' : 'FAILED';
      await client.query(
        `update outbox set state=$1, payload=$2, locked_by=NULL, locked_at=NULL
         where organization_id=$3 and id=$4`,
        [terminalState, JSON.stringify({...payload, failureReason: reason}), orgId, outboxId],
      );

      // Write an UNKNOWN receipt so the Owner can see the failure in the Timeline
      const receiptId = createUuidV7();
      const receipt: ActionReceipt = {
        id: receiptId,
        organizationId: orgId,
        campaignId: grant?.campaignId ?? '',
        actionGrantId: grant?.id ?? ((payload as {aggregateId?: string}).aggregateId ?? ''),
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
      const campaignId = grant?.campaignId ?? '';
      await client.query(
        `insert into action_receipts(organization_id,id,campaign_id,action_grant_id,schema_version,platform,execution_mode,state,unknown_reason,created_at,previous_receipt_id)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          receipt.organizationId, receipt.id, campaignId,
          receipt.actionGrantId,
          receipt.schemaVersion, receipt.platform, receipt.executionMode,
          receipt.state, receipt.unknownReason, receipt.createdAt, receipt.previousReceiptId,
        ],
      );

      await client.query('commit');

      // Determine terminal state from the authoritative row columns, not the
      // JSONB payload (which contains {grant, revision} without retry counters).
      const outbox: OutboxRecord = {
        id: outboxId,
        organizationId: orgId,
        aggregateType: 'ACTION_GRANT',
        aggregateId: grant?.id ?? ((payload as {aggregateId?: string}).aggregateId ?? ''),
        schemaVersion: 1,
        payload: {...payload, failureReason: reason},
        state: terminalState,
        lockedBy: null,
        lockedAt: null,
        attempts,
        maxAttempts,
        createdAt: new Date().toISOString(),
      };

      return {outbox, receipt};
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async reprocessOutbox(
    organizationId: string,
    outboxId: string,
  ): Promise<OutboxRecord> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      const row = await client.query(
        `update outbox set state='PENDING', locked_by=NULL, locked_at=NULL, attempts=0
         where organization_id=$1 and id=$2
           and state in ('FAILED','DEAD_LETTER')
         returning id, organization_id, aggregate_type, aggregate_id,
                   schema_version, payload, state, attempts, max_attempts, created_at`,
        [organizationId, outboxId],
      );
      if (row.rowCount === 0) {
        throw new ActionRepositoryError(
          'OUTBOX_NOT_REPROCESSABLE',
          'Outbox record not found or not in a reprocessable state.',
        );
      }
      await client.query('commit');
      const r = row.rows[0]!;
      return {
        id: r.id as string,
        organizationId: r.organization_id as string,
        aggregateType: r.aggregate_type as 'ACTION_GRANT',
        aggregateId: r.aggregate_id as string,
        schemaVersion: 1,
        payload: r.payload,
        state: 'PENDING',
        lockedBy: null,
        lockedAt: null,
        attempts: (r.attempts as number),
        maxAttempts: (r.max_attempts as number) ?? 3,
        createdAt: (r.created_at as Date).toISOString(),
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  // -----------------------------------------------------------------------
  // Read — API Timeline
  // -----------------------------------------------------------------------

  async getReceiptsByCampaign(
    organizationId: string,
    campaignId: string,
  ): Promise<ActionReceipt[]> {
    const result = await this.#pool.query(
      `select r.*
       from action_receipts r
       join action_grants g on g.organization_id=r.organization_id
                            and g.id=r.action_grant_id
       where r.organization_id=$1 and g.campaign_id=$2
       order by r.created_at desc`,
      [organizationId, campaignId],
    );
    return result.rows.map(rowToReceipt);
  }

  async getReceipt(
    organizationId: string,
    receiptId: string,
  ): Promise<ActionReceipt | undefined> {
    const result = await this.#pool.query(
      `select * from action_receipts
       where organization_id=$1 and id=$2`,
      [organizationId, receiptId],
    );
    return result.rowCount === 0 ? undefined : rowToReceipt(result.rows[0]!);
  }

  async confirmHandoff(
    organizationId: string,
    receiptId: string,
    platformUri: string,
    platformCid?: string,
  ): Promise<ActionReceipt> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');

      // Lock the original receipt to serialise concurrent confirmations.
      const row = await client.query(
        `select * from action_receipts
         where organization_id=$1 and id=$2 for update`,
        [organizationId, receiptId],
      );
      if (row.rowCount === 0) {
        throw new ActionRepositoryError('RECEIPT_NOT_FOUND', 'Receipt not found.');
      }
      const current = rowToReceipt(row.rows[0]!);
      if (current.state !== 'HANDOFF_PENDING') {
        throw new ActionRepositoryError(
          'HANDOFF_NOT_PENDING',
          `Receipt state ${current.state} does not allow handoff confirmation.`,
        );
      }

      // Guard against duplicate confirmation.
      const existing = await client.query(
        `select id from action_receipts
         where organization_id=$1 and previous_receipt_id=$2`,
        [organizationId, receiptId],
      );
      if (existing.rowCount !== 0) {
        throw new ActionRepositoryError(
          'HANDOFF_ALREADY_CONFIRMED',
          'A handoff confirmation already exists for this receipt.',
        );
      }

      // Append a new receipt — never mutate the original.
      const newId = createUuidV7();
      const createdAt = new Date().toISOString();
      await client.query(
        `insert into action_receipts(organization_id,id,campaign_id,action_grant_id,schema_version,platform,execution_mode,state,platform_uri,platform_cid,handoff_steps,created_at,previous_receipt_id)
         values($1,$2,$3,$4,$5,$6,$7,'HANDOFF_CONFIRMED',$8,$9,$10,$11,$12)`,
        [
          organizationId, newId, current.campaignId,
          current.actionGrantId,
          current.schemaVersion, current.platform, current.executionMode,
          platformUri, platformCid ?? null,
          current.handoffSteps !== null ? JSON.stringify(current.handoffSteps) : null,
          createdAt, receiptId,
        ],
      );
      await client.query('commit');

      return {
        id: newId,
        organizationId,
        campaignId: current.campaignId,
        actionGrantId: current.actionGrantId,
        schemaVersion: 1,
        platform: current.platform,
        executionMode: current.executionMode,
        state: 'HANDOFF_CONFIRMED',
        platformUri,
        platformCid: platformCid ?? null,
        handoffSteps: current.handoffSteps,
        unknownReason: null,
        reconciledAt: null,
        reconciliationMethod: null,
        createdAt,
        previousReceiptId: receiptId,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
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
    const client = await this.#pool.connect();
    try {
      await client.query('begin');

      const row = await client.query(
        `select * from action_receipts
         where organization_id=$1 and id=$2 for update`,
        [organizationId, receiptId],
      );
      if (row.rowCount === 0) {
        throw new ActionRepositoryError('RECEIPT_NOT_FOUND', 'Receipt not found.');
      }
      const current = rowToReceipt(row.rows[0]!);
      if (current.state !== 'UNKNOWN') {
        throw new ActionRepositoryError(
          'RECEIPT_NOT_UNKNOWN',
          `Receipt state ${current.state} does not allow reconciliation.`,
        );
      }

      // Guard against duplicate reconciliation.
      const existing = await client.query(
        `select id from action_receipts
         where organization_id=$1 and previous_receipt_id=$2`,
        [organizationId, receiptId],
      );
      if (existing.rowCount !== 0) {
        throw new ActionRepositoryError(
          'RECEIPT_ALREADY_RECONCILED',
          'A reconciliation already exists for this receipt.',
        );
      }

      // Append a new receipt — reconciliation is a new fact, not a mutation.
      const newId = createUuidV7();
      const createdAt = new Date().toISOString();
      await client.query(
        `insert into action_receipts(organization_id,id,campaign_id,action_grant_id,schema_version,platform,execution_mode,state,platform_uri,platform_cid,handoff_steps,unknown_reason,reconciled_at,reconciliation_method,created_at,previous_receipt_id)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          organizationId, newId, current.campaignId,
          current.actionGrantId,
          current.schemaVersion, current.platform, current.executionMode,
          outcome,
          outcome === 'PUBLISHED' ? platformUri ?? null : null,
          outcome === 'PUBLISHED' ? platformCid ?? null : null,
          current.handoffSteps !== null ? JSON.stringify(current.handoffSteps) : null,
          current.unknownReason,
          createdAt, method, createdAt, receiptId,
        ],
      );
      await client.query('commit');

      return {
        ...current,
        id: newId,
        state: outcome,
        platformUri: outcome === 'PUBLISHED' ? platformUri ?? null : null,
        platformCid: outcome === 'PUBLISHED' ? platformCid ?? null : null,
        reconciledAt: createdAt,
        reconciliationMethod: method,
        createdAt,
        previousReceiptId: receiptId,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  // -----------------------------------------------------------------------

  async close(): Promise<void> {
    await this.#pool.end();
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  async #transaction<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}
// ---------------------------------------------------------------------------
// Domain error
// ---------------------------------------------------------------------------

function rowToReceipt(row: Record<string, unknown>): ActionReceipt {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    campaignId: row.campaign_id as string,
    actionGrantId: row.action_grant_id as string,
    schemaVersion: row.schema_version as number as 1,
    platform: row.platform as string as ActionReceipt['platform'],
    executionMode: row.execution_mode as string as ActionReceipt['executionMode'],
    state: row.state as string as ActionReceipt['state'],
    platformUri: (row.platform_uri as string) ?? null,
    platformCid: (row.platform_cid as string) ?? null,
    handoffSteps: row.handoff_steps as string[] | null,
    unknownReason: (row.unknown_reason as string) ?? null,
    reconciledAt: row.reconciled_at ? (row.reconciled_at as Date).toISOString() : null,
    reconciliationMethod: (row.reconciliation_method as string as ActionReceipt['reconciliationMethod']) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    previousReceiptId: (row.previous_receipt_id as string) ?? null,
  };
}
