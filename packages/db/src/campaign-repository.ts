import {
  advanceCampaignEnvelope,
  createCampaignEnvelope,
  sha256Digest,
  type CampaignDocument,
  type CampaignEnvelope,
  type CampaignRepository,
  type CampaignSummary,
  type MutationResult
} from '@lumiclaw/domain';
import {Kysely, PostgresDialect, type Transaction} from 'kysely';
import {Pool} from 'pg';
import type {Database} from './database.js';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

export class PostgresCampaignRepository implements CampaignRepository {
  readonly #database: Kysely<Database>;

  constructor(connectionString: string) {
    this.#database = new Kysely<Database>({dialect: new PostgresDialect({pool: new Pool({connectionString, max: 10})})});
  }

  async health(): Promise<boolean> {
    const row = await this.#database.selectFrom('foundation_metadata').select('key').where('key', '=', 'installation_mode').executeTakeFirst();
    return row !== undefined;
  }

  async list(organizationId: string): Promise<CampaignSummary[]> {
    const rows = await this.#database.selectFrom('campaigns').selectAll().where('organization_id', '=', organizationId).orderBy('updated_at', 'desc').execute();
    return rows.map((row) => {
      const document = row.document as CampaignDocument;
      return {id: row.id, organizationId: row.organization_id, name: document.brief.name, version: row.version, digest: row.digest.trim(), readiness: row.readiness, gapCodes: row.gap_codes as string[], updatedAt: iso(row.updated_at), mode: 'DEMO_SEED', live: false};
    });
  }

  async get(organizationId: string, campaignId: string): Promise<CampaignEnvelope | undefined> {
    const row = await this.#database.selectFrom('campaigns').selectAll().where('organization_id', '=', organizationId).where('id', '=', campaignId).executeTakeFirst();
    return row === undefined ? undefined : envelopeFromRow(row);
  }

  async getMissionContract(organizationId: string, campaignId: string): Promise<{contract: CampaignDocument['missionContract']; digest: string; version: number} | undefined> {
    const envelope = await this.get(organizationId, campaignId);
    return envelope === undefined ? undefined : {contract: envelope.document.missionContract, digest: envelope.digest, version: envelope.version};
  }

  async create(organizationId: string, document: CampaignDocument, idempotencyKey: string, requestDigest: string, now = new Date()): Promise<MutationResult> {
    return this.#database.transaction().execute(async (trx) => {
      const route = '/api/v1/campaigns';
      const replay = await readIdempotency(trx, organizationId, 'POST', route, idempotencyKey, requestDigest);
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
      const replay = await readIdempotency(trx, organizationId, 'PUT', route, idempotencyKey, requestDigest);
      if (replay !== undefined) return replay;
      const row = await trx.selectFrom('campaigns').selectAll().where('organization_id', '=', organizationId).where('id', '=', campaignId).forUpdate().executeTakeFirst();
      if (row === undefined) return {ok: false, code: 'CAMPAIGN_NOT_FOUND'};
      const current = envelopeFromRow(row);
      if (current.etag !== expectedEtag) return {ok: false, code: 'CAMPAIGN_VERSION_CONFLICT', current};
      const envelope = advanceCampaignEnvelope(current, document, now);
      await trx.updateTable('campaigns').set({version: envelope.version, digest: envelope.digest, etag: envelope.etag, readiness: envelope.readiness, gap_codes: json(envelope.gapCodes), document: json(envelope.document), updated_at: envelope.updatedAt}).where('organization_id', '=', organizationId).where('id', '=', campaignId).executeTakeFirstOrThrow();
      await insertSnapshot(trx, envelope);
      await insertDomainRows(trx, envelope);
      await writeIdempotency(trx, organizationId, 'PUT', route, idempotencyKey, requestDigest, 200, envelope, envelope.etag, now);
      return {ok: true, envelope, replayed: false};
    });
  }

  async close(): Promise<void> { await this.#database.destroy(); }
}

function headValues(envelope: CampaignEnvelope) {
  return {organization_id: envelope.document.organizationId, id: envelope.document.id, version: envelope.version, digest: envelope.digest, etag: envelope.etag, readiness: envelope.readiness, gap_codes: json(envelope.gapCodes), document: json(envelope.document), created_at: envelope.createdAt, updated_at: envelope.updatedAt};
}

async function insertGraph(trx: Transaction<Database>, document: CampaignDocument): Promise<void> {
  const graph = document.graph;
  await trx.insertInto('organizations').values({id: graph.organization.id, schema_version: 1, slug: graph.organization.slug, display_name: graph.organization.displayName, data_mode: 'DEMO_SEED', live: false}).onConflict((conflict) => conflict.column('id').doNothing()).execute();
  await trx.insertInto('identities').values(graph.identities.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, kind: item.kind, display_name: item.displayName, public_bio: item.publicBio}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  await trx.insertInto('brands').values(graph.brands.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, name: item.name, positioning: item.positioning}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  await trx.insertInto('products').values(graph.products.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, brand_id: item.brandId, name: item.name, description: item.description}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  await trx.insertInto('markets').values(graph.markets.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, code: item.code, display_name: item.displayName, primary_language: item.primaryLanguage}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  await trx.insertInto('channel_accounts').values(graph.channelAccounts.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, identity_id: item.identityId, platform: item.platform, display_handle: item.displayHandle, connection_state: 'NOT_CONNECTED'}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  await trx.insertInto('account_mandates').values(graph.accountMandates.map((item) => ({organization_id: item.organizationId, id: item.id, schema_version: 1, channel_account_id: item.channelAccountId, identity_id: item.identityId, product_id: item.productId, market_id: item.marketId, role: item.role, allowed_actions: json(item.allowedActions), requires_owner_review: true, valid_from: item.validFrom, valid_until: item.validUntil}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
}

async function insertSnapshot(trx: Transaction<Database>, envelope: CampaignEnvelope): Promise<void> {
  await trx.insertInto('campaign_snapshots').values({organization_id: envelope.document.organizationId, campaign_id: envelope.document.id, version: envelope.version, digest: envelope.digest, document: json(envelope.document), created_at: envelope.updatedAt}).execute();
}

async function insertDomainRows(trx: Transaction<Database>, envelope: CampaignEnvelope): Promise<void> {
  const document = envelope.document;
  if (document.evidenceRefs.length > 0) await trx.insertInto('evidence_refs').values(document.evidenceRefs.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, content_digest: item.contentDigest, payload: json(item), created_at: item.capturedAt}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  if (document.claims.length > 0) await trx.insertInto('claims').values(document.claims.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, version: item.version, status: item.status, subject_id: item.subjectId, effective_from: item.effectiveFrom, effective_until: item.effectiveUntil, payload: json(item), created_at: envelope.updatedAt}))).onConflict((conflict) => conflict.columns(['organization_id', 'id', 'version']).doNothing()).execute();
  if (document.capabilitySnapshots.length > 0) await trx.insertInto('capability_snapshots').values(document.capabilitySnapshots.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, channel_account_id: item.channelAccountId, platform: item.platform, captured_at: item.capturedAt, expires_at: item.expiresAt, payload: json(item)}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
  if (document.artifactRevisions.length > 0) await trx.insertInto('artifact_revisions').values(document.artifactRevisions.map((item) => ({organization_id: item.organizationId, id: item.id, campaign_id: document.id, activation_unit_id: item.activationUnitId, platform: item.platform, revision: item.revision, digest: sha256Digest(item), payload: json(item), created_at: item.createdAt}))).onConflict((conflict) => conflict.columns(['organization_id', 'id']).doNothing()).execute();
}

async function readIdempotency(database: DatabaseExecutor, organizationId: string, method: string, route: string, key: string, requestDigest: string): Promise<MutationResult | undefined> {
  const row = await database.selectFrom('idempotency_records').selectAll().where('organization_id', '=', organizationId).where('method', '=', method).where('route', '=', route).where('idempotency_key', '=', key).executeTakeFirst();
  if (row === undefined) return undefined;
  if (row.request_digest.trim() !== requestDigest) return {ok: false, code: 'IDEMPOTENCY_KEY_REUSED'};
  return {ok: true, envelope: row.response_body as CampaignEnvelope, replayed: true};
}

async function writeIdempotency(database: DatabaseExecutor, organizationId: string, method: string, route: string, key: string, requestDigest: string, statusCode: number, body: CampaignEnvelope, etag: string, now: Date): Promise<void> {
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await database.insertInto('idempotency_records').values({organization_id: organizationId, method, route, idempotency_key: key, request_digest: requestDigest, status_code: statusCode, response_body: json(body), response_etag: etag, expires_at: expires}).execute();
}

function envelopeFromRow(row: {organization_id: string; id: string; version: number; digest: string; etag: string; readiness: CampaignEnvelope['readiness']; gap_codes: unknown; document: unknown; created_at: Date | string; updated_at: Date | string}): CampaignEnvelope {
  return {document: row.document as CampaignDocument, version: row.version, digest: row.digest.trim(), etag: row.etag, readiness: row.readiness, gapCodes: row.gap_codes as string[], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), mode: 'DEMO_SEED', live: false};
}

function iso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }

function json(value: unknown): string { return JSON.stringify(value); }
