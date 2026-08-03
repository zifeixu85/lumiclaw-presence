import {
  advanceCampaignEnvelope,
  campaignEtag,
  createCampaignEnvelope,
  digestCampaign,
  sha256Digest,
  validateCampaignDocument,
  type CampaignDocument,
  type CampaignEnvelope,
  type CampaignRepository,
  type CampaignSummary,
  type MutationResult
} from '@lumiclaw/domain';
import {Kysely, PostgresDialect, sql, type Transaction} from 'kysely';
import {Pool} from 'pg';
import type {Database} from './database.js';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

export class PostgresCampaignRepository implements CampaignRepository {
  readonly #database: Kysely<Database>;

  constructor(connectionString: string) {
    const pool = new Pool({connectionString, max: 10});
    // PostgreSQL restart terminates idle clients. A Pool error listener keeps that
    // expected dependency outage from becoming an uncaught EventEmitter error;
    // subsequent health/route queries acquire a fresh client and still fail closed.
    pool.on('error', () => console.error(JSON.stringify({code: 'POSTGRES_IDLE_CLIENT_ERROR'})));
    this.#database = new Kysely<Database>({dialect: new PostgresDialect({pool})});
  }

  async health(): Promise<boolean> {
    const row = await this.#database.selectFrom('foundation_metadata').select('key').where('key', '=', 'installation_mode').executeTakeFirst();
    return row !== undefined;
  }

  async list(organizationId: string): Promise<CampaignSummary[]> {
    const rows = await this.#database.selectFrom('campaigns').selectAll().where('organization_id', '=', organizationId).orderBy('updated_at', 'desc').execute();
    return rows.map((row) => {
      const envelope = envelopeFromRow(row);
      return {id: row.id, organizationId: row.organization_id, name: envelope.document.brief.name, version: row.version, digest: envelope.digest, readiness: envelope.readiness, gapCodes: envelope.gapCodes, updatedAt: envelope.updatedAt, mode: 'DEMO_SEED', live: false};
    });
  }

  async get(organizationId: string, campaignId: string): Promise<CampaignEnvelope | undefined> {
    const row = await this.#database.selectFrom('campaigns').selectAll().where('organization_id', '=', organizationId).where('id', '=', campaignId).executeTakeFirst();
    return row === undefined ? undefined : envelopeFromRow(row);
  }

  async getMissionContract(organizationId: string, campaignId: string): Promise<{contract: CampaignDocument['missionContract']; digest: string; version: number; readiness: CampaignEnvelope['readiness']; gapCodes: string[]} | undefined> {
    const envelope = await this.get(organizationId, campaignId);
    return envelope === undefined ? undefined : {contract: envelope.document.missionContract, digest: envelope.digest, version: envelope.version, readiness: envelope.readiness, gapCodes: envelope.gapCodes};
  }

  async create(organizationId: string, document: CampaignDocument, idempotencyKey: string, requestDigest: string, now = new Date()): Promise<MutationResult> {
    return this.#database.transaction().execute(async (trx) => {
      const route = '/api/v1/campaigns';
      await lockIdempotency(trx, organizationId, 'POST', route, idempotencyKey);
      const replay = await readIdempotency(trx, organizationId, 'POST', route, idempotencyKey, requestDigest, now);
      if (replay !== undefined) return replay;
      if (document.organizationId !== organizationId) return {ok: false, code: 'CAMPAIGN_NOT_FOUND'};
      const envelope = createCampaignEnvelope(document, now);
      await insertGraph(trx, document);
      await trx.insertInto('campaigns').values(headValues(envelope)).execute();
      await insertSnapshot(trx, envelope);
      await insertDomainRows(trx, envelope);
      await writeIdempotency(trx, organizationId, 'POST', route, idempotencyKey, requestDigest, 201, envelope, envelope.etag, now);
      return {ok: true, envelope, replayed: false};
    });
  }

  async update(organizationId: string, campaignId: string, document: CampaignDocument, expectedEtag: string, idempotencyKey: string, requestDigest: string, now = new Date()): Promise<MutationResult> {
    return this.#database.transaction().execute(async (trx) => {
      const route = `/api/v1/campaigns/${campaignId}`;
      await lockIdempotency(trx, organizationId, 'PUT', route, idempotencyKey);
      const replay = await readIdempotency(trx, organizationId, 'PUT', route, idempotencyKey, requestDigest, now);
      if (replay !== undefined) return replay;
      const row = await trx.selectFrom('campaigns').selectAll().where('organization_id', '=', organizationId).where('id', '=', campaignId).forUpdate().executeTakeFirst();
      if (row === undefined) return {ok: false, code: 'CAMPAIGN_NOT_FOUND'};
      const current = envelopeFromRow(row);
      if (current.etag !== expectedEtag) return {ok: false, code: 'CAMPAIGN_VERSION_CONFLICT', current};
      const envelope = advanceCampaignEnvelope(current, document, now);
      await insertGraph(trx, envelope.document);
      await trx.updateTable('campaigns').set({version: envelope.version, digest: envelope.digest, etag: envelope.etag, readiness: envelope.readiness, gap_codes: json(envelope.gapCodes), document: json(envelope.document), updated_at: envelope.updatedAt}).where('organization_id', '=', organizationId).where('id', '=', campaignId).executeTakeFirstOrThrow();
      await insertSnapshot(trx, envelope);
      await insertDomainRows(trx, envelope);
      await writeIdempotency(trx, organizationId, 'PUT', route, idempotencyKey, requestDigest, 200, envelope, envelope.etag, now);
      return {ok: true, envelope, replayed: false};
    });
  }

  async close(): Promise<void> { await this.#database.destroy(); }
}

async function lockIdempotency(database: DatabaseExecutor, organizationId: string, method: string, route: string, key: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${method}:${route}:${key}`}, 0))`.execute(database);
}

function headValues(envelope: CampaignEnvelope) {
  return {organization_id: envelope.document.organizationId, id: envelope.document.id, version: envelope.version, digest: envelope.digest, etag: envelope.etag, readiness: envelope.readiness, gap_codes: json(envelope.gapCodes), document: json(envelope.document), created_at: envelope.createdAt, updated_at: envelope.updatedAt};
}

async function insertGraph(trx: Transaction<Database>, document: CampaignDocument): Promise<void> {
  const graph = document.graph;
  await trx.insertInto('organizations').values({id: graph.organization.id, schema_version: 1, slug: graph.organization.slug, display_name: graph.organization.displayName, data_mode: 'DEMO_SEED', live: false}).onConflict((conflict) => conflict.column('id').doUpdateSet({slug: graph.organization.slug, display_name: graph.organization.displayName})).execute();
  await trx.insertInto('identities').values(graph.identities.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, kind: item.kind, display_name: item.displayName, public_bio: item.publicBio}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({kind: eb.ref('excluded.kind'), display_name: eb.ref('excluded.display_name'), public_bio: eb.ref('excluded.public_bio')}))).execute();
  await trx.insertInto('brands').values(graph.brands.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, name: item.name, positioning: item.positioning}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({name: eb.ref('excluded.name'), positioning: eb.ref('excluded.positioning')}))).execute();
  await trx.insertInto('products').values(graph.products.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, brand_id: item.brandId, name: item.name, description: item.description}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({brand_id: eb.ref('excluded.brand_id'), name: eb.ref('excluded.name'), description: eb.ref('excluded.description')}))).execute();
  await trx.insertInto('markets').values(graph.markets.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, code: item.code, display_name: item.displayName, primary_language: item.primaryLanguage}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({code: eb.ref('excluded.code'), display_name: eb.ref('excluded.display_name'), primary_language: eb.ref('excluded.primary_language')}))).execute();
  await trx.insertInto('channel_accounts').values(graph.channelAccounts.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, identity_id: item.identityId, platform: item.platform, display_handle: item.displayHandle, connection_state: 'NOT_CONNECTED'}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({identity_id: eb.ref('excluded.identity_id'), platform: eb.ref('excluded.platform'), display_handle: eb.ref('excluded.display_handle')}))).execute();
  await trx.insertInto('account_mandates').values(graph.accountMandates.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, channel_account_id: item.channelAccountId, identity_id: item.identityId, product_id: item.productId, market_id: item.marketId, role: item.role, allowed_actions: json(item.allowedActions), requires_owner_review: true, valid_from: item.validFrom, valid_until: item.validUntil}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({channel_account_id: eb.ref('excluded.channel_account_id'), identity_id: eb.ref('excluded.identity_id'), product_id: eb.ref('excluded.product_id'), market_id: eb.ref('excluded.market_id'), role: eb.ref('excluded.role'), allowed_actions: eb.ref('excluded.allowed_actions'), valid_from: eb.ref('excluded.valid_from'), valid_until: eb.ref('excluded.valid_until')}))).execute();
}

async function insertSnapshot(trx: Transaction<Database>, envelope: CampaignEnvelope): Promise<void> {
  await trx.insertInto('campaign_snapshots').values({organization_id: envelope.document.organizationId, campaign_id: envelope.document.id, version: envelope.version, digest: envelope.digest, document: json(envelope.document), created_at: envelope.updatedAt}).execute();
}

async function insertDomainRows(trx: Transaction<Database>, envelope: CampaignEnvelope): Promise<void> {
  const document = envelope.document;
  if (document.evidenceRefs.length > 0) await trx.insertInto('evidence_refs').values(document.evidenceRefs.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, content_digest: item.contentDigest, payload: json(item), created_at: item.capturedAt}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({content_digest: eb.ref('excluded.content_digest'), payload: eb.ref('excluded.payload'), created_at: eb.ref('excluded.created_at')}))).execute();
  if (document.claims.length > 0) await trx.insertInto('claims').values(document.claims.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, version: item.version, status: item.status, subject_id: item.subjectId, effective_from: item.effectiveFrom, effective_until: item.effectiveUntil, payload: json(item), created_at: envelope.updatedAt}))).onConflict((conflict) => conflict.columns(['organization_id', 'id', 'version']).doNothing()).execute();
  if (document.capabilitySnapshots.length > 0) await trx.insertInto('capability_snapshots').values(document.capabilitySnapshots.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, channel_account_id: item.channelAccountId, platform: item.platform, captured_at: item.capturedAt, expires_at: item.expiresAt, payload: json(item)}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({channel_account_id: eb.ref('excluded.channel_account_id'), platform: eb.ref('excluded.platform'), captured_at: eb.ref('excluded.captured_at'), expires_at: eb.ref('excluded.expires_at'), payload: eb.ref('excluded.payload')}))).execute();
  if (document.artifactRevisions.length > 0) await trx.insertInto('artifact_revisions').values(document.artifactRevisions.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, activation_unit_id: item.activationUnitId, platform: item.platform, revision: item.revision, digest: sha256Digest(item), payload: json(item), created_at: item.createdAt}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  if (document.publishingSchedules.length > 0) await trx.insertInto('publishing_schedules').values(document.publishingSchedules.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, version: item.version, kind: item.kind, time_zone: item.timeZone, local_start: item.localStart, rrule: item.rrule, status: item.status, payload: json(item), created_at: item.createdAt, updated_at: item.updatedAt}))).onConflict((conflict) => conflict.columns(['organization_id', 'id', 'version']).doUpdateSet((eb) => ({status: eb.ref('excluded.status'), payload: eb.ref('excluded.payload'), updated_at: eb.ref('excluded.updated_at')}))).execute();
  if (document.scheduleOccurrences.length > 0) await trx.insertInto('schedule_occurrences').values(document.scheduleOccurrences.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, schedule_id: item.scheduleId, schedule_version: item.scheduleVersion, ordinal: item.ordinal, scheduled_for: item.scheduledForUtc, state: item.state, payload: json(item)}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doUpdateSet((eb) => ({state: eb.ref('excluded.state'), payload: eb.ref('excluded.payload')}))).execute();
}

async function readIdempotency(database: DatabaseExecutor, organizationId: string, method: string, route: string, key: string, requestDigest: string, now: Date): Promise<MutationResult | undefined> {
  const row = await database.selectFrom('idempotency_records').selectAll().where('organization_id', '=', organizationId).where('method', '=', method).where('route', '=', route).where('idempotency_key', '=', key).executeTakeFirst();
  if (row === undefined) return undefined;
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    await database.deleteFrom('idempotency_records').where('organization_id', '=', organizationId).where('method', '=', method).where('route', '=', route).where('idempotency_key', '=', key).execute();
    return undefined;
  }
  if (row.request_digest.trim() !== requestDigest) return {ok: false, code: 'IDEMPOTENCY_KEY_REUSED'};
  return {ok: true, envelope: row.response_body as CampaignEnvelope, replayed: true};
}

async function writeIdempotency(database: DatabaseExecutor, organizationId: string, method: string, route: string, key: string, requestDigest: string, statusCode: number, body: CampaignEnvelope, etag: string, now: Date): Promise<void> {
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await database.insertInto('idempotency_records').values({organization_id: organizationId, method, route, idempotency_key: key, request_digest: requestDigest, status_code: statusCode, response_body: json(body), response_etag: etag, expires_at: expires}).execute();
}

function envelopeFromRow(row: {organization_id: string; id: string; version: number; digest: string; etag: string; readiness: CampaignEnvelope['readiness']; gap_codes: unknown; document: unknown; created_at: Date | string; updated_at: Date | string}): CampaignEnvelope {
  const document = row.document as CampaignDocument;
  const digest = digestCampaign(document);
  if (document.id !== row.id || document.organizationId !== row.organization_id || row.digest.trim() !== digest || row.etag !== campaignEtag(row.id, row.version, digest)) throw new Error('PERSISTED_CAMPAIGN_INTEGRITY_FAILED');
  const validation = validateCampaignDocument(document, new Date());
  const temporalCodes = new Set(['CLAIM_EXPIRED', 'CAPABILITY_EXPIRED', 'GRAPH_MANDATE_EXPIRED']);
  const temporalIssues = validation.ok ? [] : validation.issues.filter((item) => temporalCodes.has(item.code));
  if (!validation.ok && validation.issues.some((item) => !temporalCodes.has(item.code))) throw new Error('PERSISTED_CAMPAIGN_INTEGRITY_FAILED');
  return {document, version: row.version, digest, etag: row.etag, readiness: temporalIssues.length > 0 ? 'BLOCKED' : row.readiness, gapCodes: temporalIssues.length > 0 ? [...new Set(temporalIssues.map((item) => item.code))] : row.gap_codes as string[], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), mode: 'DEMO_SEED', live: false};
}

function iso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }

function json(value: unknown): string { return JSON.stringify(value); }
