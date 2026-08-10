import {
  ActionRepositoryError,
  createUuidV7,
  type ActionGrant,
  type ActionReceipt,
  type ActionRepository,
  type OutboxRecord,
} from '@lumiclaw/domain';
import {Pool, type PoolClient} from 'pg';

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

  // -----------------------------------------------------------------------
  // Write — API layer
  // -----------------------------------------------------------------------

  async createGrantWithOutbox(
    grant: ActionGrant,
    outbox: OutboxRecord,
    idempotencyKey: string,
    requestDigest: string,
  ): Promise<{grant: ActionGrant; outbox: OutboxRecord; replayed: boolean}> {
    return this.#transaction(async (client) => {
      const route = `/api/v1/campaigns/${grant.campaignId}/action-grants`;

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

      // Atomic insert: grant + outbox
      await client.query(
        `insert into action_grants(organization_id,id,campaign_id,schedule_occurrence_id,artifact_revision_id,activation_unit_id,schema_version,platform,execution_mode,status,issued_at,expires_at,grant_digest,channel_account_id,capability_snapshot_id,owner_signature,owner_public_key,payload,created_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          grant.organizationId, grant.id, grant.campaignId,
          grant.scheduleOccurrenceId, grant.artifactRevisionId,
          grant.activationUnitId, grant.schemaVersion, grant.platform,
          grant.executionMode, grant.status, grant.issuedAt, grant.expiresAt,
          grant.grantDigest, grant.channelAccountId, grant.capabilitySnapshotId,
          grant.ownerSignature, grant.ownerPublicKey,
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

  async claimNextOutbox(lockId: string): Promise<OutboxRecord | undefined> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      const row = await client.query(
        `select id, organization_id, aggregate_type, aggregate_id,
                schema_version, payload, state, attempts, created_at
         from outbox
         where state = 'PENDING'
         order by created_at
         limit 1
         for update skip locked`,
      );
      if (row.rowCount === 0) {
        await client.query('rollback');
        return undefined;
      }
      const r = row.rows[0]!;
      await client.query(
        `update outbox set state='PROCESSING', locked_by=$1, locked_at=$2,
                attempts=attempts+1
         where organization_id=$3 and id=$4`,
        [lockId, new Date().toISOString(), r.organization_id as string, r.id as string],
      );
      await client.query('commit');
      return {
        id: r.id as string,
        organizationId: r.organization_id as string,
        aggregateType: r.aggregate_type as 'ACTION_GRANT',
        aggregateId: r.aggregate_id as string,
        schemaVersion: 1,
        payload: r.payload,
        state: 'PROCESSING',
        lockedBy: lockId,
        lockedAt: new Date().toISOString(),
        attempts: (r.attempts as number) + 1,
        createdAt: (r.created_at as Date).toISOString(),
      };
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
      if (grantStatus !== 'ISSUED') {
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
        `insert into action_receipts(organization_id,id,action_grant_id,schema_version,platform,execution_mode,state,platform_uri,platform_cid,handoff_steps,created_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          receipt.organizationId, receipt.id, receipt.actionGrantId,
          receipt.schemaVersion, receipt.platform, receipt.executionMode,
          receipt.state, receipt.platformUri, receipt.platformCid,
          receipt.handoffSteps !== null ? JSON.stringify(receipt.handoffSteps) : null,
          receipt.createdAt,
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
        `select organization_id, payload from outbox where id=$1 for update`,
        [outboxId],
      );
      if (row.rowCount === 0) {
        throw new ActionRepositoryError(
          'OUTBOX_RECORD_NOT_FOUND',
          'Outbox record not found.',
        );
      }
      const orgId = row.rows[0].organization_id as string;
      const payload = row.rows[0].payload as Record<string, unknown>;
      const grant = (payload as {grant?: ActionGrant}).grant;

      await client.query(
        `update outbox set state='FAILED', payload=$1
         where organization_id=$2 and id=$3`,
        [JSON.stringify({...payload, failureReason: reason}), orgId, outboxId],
      );

      // Write an UNKNOWN receipt so the Owner can see the failure in the Timeline
      const receiptId = createUuidV7(Date.now(), new Uint8Array(10));
      const receipt: ActionReceipt = {
        id: receiptId,
        organizationId: orgId,
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
      };
      await client.query(
        `insert into action_receipts(organization_id,id,action_grant_id,schema_version,platform,execution_mode,state,unknown_reason,created_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          receipt.organizationId, receipt.id, receipt.actionGrantId,
          receipt.schemaVersion, receipt.platform, receipt.executionMode,
          receipt.state, receipt.unknownReason, receipt.createdAt,
        ],
      );

      await client.query('commit');

      const outbox: OutboxRecord = {
        id: outboxId,
        organizationId: orgId,
        aggregateType: 'ACTION_GRANT',
        aggregateId: grant?.id ?? ((payload as {aggregateId?: string}).aggregateId ?? ''),
        schemaVersion: 1,
        payload: {...payload, failureReason: reason},
        state: 'FAILED',
        lockedBy: null,
        lockedAt: null,
        attempts: 0,
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
    _organizationId: string,
    _receiptId: string,
    _platformUri: string,
    _platformCid?: string,
  ): Promise<ActionReceipt> {
    // action_receipts has an immutable trigger — updating state from
    // HANDOFF_PENDING → HANDOFF_CONFIRMED requires a trigger exception
    // or a separate confirmation table.  Deferred to a future migration.
    throw new ActionRepositoryError(
      'HANDOFF_NOT_AVAILABLE',
      'Postgres handoff confirmation is not yet available. Use the in-memory repository for tests.',
    );
  }

  async reconcileReceipt(
    organizationId: string,
    receiptId: string,
    _method: 'PLATFORM_QUERY' | 'OWNER_MANUAL',
    _notes?: string,
  ): Promise<ActionReceipt> {
    // action_receipts is immutable — reconciliation is recorded as a new
    // fact (separate reconciliation table) in M3-07.  For now, throw.
    throw new ActionRepositoryError(
      'RECONCILIATION_NOT_AVAILABLE',
      'Postgres reconciliation is not yet available (M3-07). Use the in-memory repository for tests.',
    );
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
  };
}

