import type {BlobRef, BlobStore} from '@lumiclaw/blob-store';
import {
  createUuidV7,
  LocalPresenceContractError,
  normalizeLocalDisplayName,
  prepareLocalMaterial,
  type LocalMaterialManifest,
  type LocalOnboardingContext,
  type LocalOnboardingSession,
  type LocalOwnerProfile,
  type LocalPresenceRepository,
  type ManualPublishHandoff,
  type MaterialIngestInput
} from '@lumiclaw/domain';
import {Kysely, PostgresDialect, type Selectable} from 'kysely';
import {Pool} from 'pg';
import type {Database, LocalMaterialManifestsTable, LocalOnboardingSessionsTable, LocalOwnerProfilesTable, ManualPublishHandoffsTable} from './database.js';

export class PostgresLocalPresenceRepository implements LocalPresenceRepository {
  readonly #pool: Pool;
  readonly #database: Kysely<Database>;

  public constructor(connectionString: string, private readonly blobs: BlobStore) {
    this.#pool = new Pool({connectionString, max: 4});
    this.#database = new Kysely<Database>({dialect: new PostgresDialect({pool: this.#pool})});
    this.#pool.on('error', (error) => console.error('PostgreSQL local-presence idle client error', error.message));
  }

  public async health(): Promise<boolean> {
    const marker = await this.#database.selectFrom('foundation_metadata').select('key').where('key', '=', 'installation_mode').executeTakeFirst();
    const table = await this.#pool.query<{exists: boolean}>("select to_regclass('public.local_owner_profiles') is not null as exists");
    return marker?.key === 'installation_mode' && table.rows[0]?.exists === true;
  }

  public async getProfile(): Promise<LocalOwnerProfile | undefined> {
    const row = await this.#database.selectFrom('local_owner_profiles').selectAll().where('singleton_key', '=', true).executeTakeFirst();
    return row === undefined ? undefined : profileFromRow(row);
  }

  public async createProfile(displayName: string, now: Date): Promise<LocalOwnerProfile> {
    const normalized = normalizeLocalDisplayName(displayName);
    return this.#database.transaction().execute(async (trx) => {
      const current = await trx.selectFrom('local_owner_profiles').selectAll().where('singleton_key', '=', true).forUpdate().executeTakeFirst();
      if (current !== undefined) {
        if (current.display_name !== normalized) throw new LocalPresenceContractError('LOCAL_PROFILE_ALREADY_EXISTS');
        return profileFromRow(current);
      }
      const id = createUuidV7(now.getTime());
      const profile = await trx.insertInto('local_owner_profiles').values({id, singleton_key: true, schema_version: 1, display_name: normalized, state: 'PROFILE_READY', created_at: now, updated_at: now}).returningAll().executeTakeFirstOrThrow();
      await trx.insertInto('local_onboarding_sessions').values({owner_profile_id: id, schema_version: 1, path: 'UNSELECTED', state: 'MATERIAL_CHOICE', data_mode: 'LOCAL_PRIVATE', organization_id: null, campaign_id: null, market_code: null, content_locale: null, platform: null, time_zone: null, material_ids: JSON.stringify([]), created_at: now, updated_at: now}).execute();
      return profileFromRow(profile);
    });
  }

  public async getSession(ownerProfileId: string): Promise<LocalOnboardingSession | undefined> {
    const row = await this.#database.selectFrom('local_onboarding_sessions').selectAll().where('owner_profile_id', '=', ownerProfileId).executeTakeFirst();
    return row === undefined ? undefined : sessionFromRow(row);
  }

  public async chooseExample(ownerProfileId: string, organizationId: string, campaignId: string, context: LocalOnboardingContext, now: Date): Promise<LocalOnboardingSession> {
    return this.#database.transaction().execute(async (trx) => {
      const row = await trx.updateTable('local_onboarding_sessions').set({path: 'PUBLIC_SAFE_EXAMPLE', state: 'COMPLETED', data_mode: 'PUBLIC_SAFE_EXAMPLE', organization_id: organizationId, campaign_id: campaignId, market_code: context.marketCode, content_locale: context.contentLocale, platform: context.platform, time_zone: context.timeZone, material_ids: JSON.stringify([]), updated_at: now}).where('owner_profile_id', '=', ownerProfileId).returningAll().executeTakeFirst();
      if (row === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
      await trx.updateTable('local_owner_profiles').set({state: 'ONBOARDING_COMPLETE', updated_at: now}).where('id', '=', ownerProfileId).execute();
      return sessionFromRow(row);
    });
  }

  public async selectLocalMaterials(ownerProfileId: string, now: Date): Promise<LocalOnboardingSession> {
    const row = await this.#database.updateTable('local_onboarding_sessions').set({path: 'LOCAL_MATERIALS', state: 'MATERIAL_CHOICE', data_mode: 'LOCAL_PRIVATE', updated_at: now}).where('owner_profile_id', '=', ownerProfileId).returningAll().executeTakeFirst();
    if (row === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
    return sessionFromRow(row);
  }

  public async setContext(ownerProfileId: string, context: LocalOnboardingContext, now: Date): Promise<LocalOnboardingSession> {
    const ready = await this.#database.selectFrom('local_material_manifests').select(({fn}) => fn.countAll<number>().as('count')).where('owner_profile_id', '=', ownerProfileId).where('state', '=', 'READY').executeTakeFirst();
    if (Number(ready?.count ?? 0) < 1) throw new LocalPresenceContractError('LOCAL_MATERIAL_REQUIRED');
    const row = await this.#database.updateTable('local_onboarding_sessions').set({state: 'CONTEXT_READY', market_code: context.marketCode, content_locale: context.contentLocale, platform: context.platform, time_zone: context.timeZone, updated_at: now}).where('owner_profile_id', '=', ownerProfileId).where('path', '=', 'LOCAL_MATERIALS').returningAll().executeTakeFirst();
    if (row === undefined) throw new LocalPresenceContractError('LOCAL_MATERIAL_PATH_REQUIRED');
    return sessionFromRow(row);
  }

  public async completeLocalOnboarding(ownerProfileId: string, organizationId: string, campaignId: string, now: Date): Promise<LocalOnboardingSession> {
    return this.#database.transaction().execute(async (trx) => {
      const session = await trx.selectFrom('local_onboarding_sessions').selectAll().where('owner_profile_id', '=', ownerProfileId).forUpdate().executeTakeFirst();
      if (session === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
      if (session.path !== 'LOCAL_MATERIALS' || session.state !== 'CONTEXT_READY') throw new LocalPresenceContractError('LOCAL_ONBOARDING_NOT_READY');
      const ready = await trx.selectFrom('local_material_manifests').select(({fn}) => fn.countAll<number>().as('count')).where('owner_profile_id', '=', ownerProfileId).where('state', '=', 'READY').executeTakeFirst();
      if (Number(ready?.count ?? 0) < 1) throw new LocalPresenceContractError('LOCAL_MATERIAL_REQUIRED');
      const row = await trx.updateTable('local_onboarding_sessions').set({state: 'COMPLETED', organization_id: organizationId, campaign_id: campaignId, updated_at: now}).where('owner_profile_id', '=', ownerProfileId).returningAll().executeTakeFirstOrThrow();
      await trx.updateTable('local_owner_profiles').set({state: 'ONBOARDING_COMPLETE', updated_at: now}).where('id', '=', ownerProfileId).execute();
      return sessionFromRow(row);
    });
  }

  public async ingestMaterial(input: MaterialIngestInput, now: Date): Promise<LocalMaterialManifest> {
    const prepared = prepareLocalMaterial(input, now);
    let cleanupRef: BlobRef | null = null;
    try {
      const material = await this.#database.transaction().execute(async (trx) => {
        const session = await trx.selectFrom('local_onboarding_sessions').select(['owner_profile_id', 'path', 'state']).where('owner_profile_id', '=', input.ownerProfileId).forUpdate().executeTakeFirst();
        if (session === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
        if (session.path !== 'LOCAL_MATERIALS') throw new LocalPresenceContractError('LOCAL_MATERIAL_PATH_REQUIRED');
        const duplicate = await trx.selectFrom('local_material_manifests').selectAll().where('owner_profile_id', '=', input.ownerProfileId).where('digest', '=', prepared.digest).executeTakeFirst();
        if (duplicate !== undefined) {
          const ids = await trx.selectFrom('local_material_manifests').select('id').where('owner_profile_id', '=', input.ownerProfileId).orderBy('created_at', 'asc').execute();
          await trx.updateTable('local_onboarding_sessions').set({material_ids: JSON.stringify(ids.map((item) => item.id)), state: session.state === 'COMPLETED' ? 'COMPLETED' : 'MATERIALS_READY', updated_at: now}).where('owner_profile_id', '=', input.ownerProfileId).where('path', '=', 'LOCAL_MATERIALS').executeTakeFirstOrThrow();
          return materialFromRow(duplicate);
        }
        const candidateRef: BlobRef = {algorithm: 'sha256', digest: prepared.digest, size: prepared.byteSize};
        const alreadyPresent = await this.blobs.has(candidateRef);
        const blobRef = await this.blobs.put(input.bytes);
        if (!alreadyPresent) cleanupRef = blobRef;
        if (blobRef.digest !== prepared.digest || blobRef.size !== prepared.byteSize) throw new LocalPresenceContractError('LOCAL_MATERIAL_DIGEST_MISMATCH');
        const row = await trx.insertInto('local_material_manifests').values({owner_profile_id: prepared.ownerProfileId, id: prepared.id, schema_version: 1, file_name: prepared.fileName, media_type: prepared.mediaType, byte_size: prepared.byteSize, digest: prepared.digest, state: prepared.state, extracted_text: prepared.extractedText, failure_code: prepared.failureCode, blob_ref: JSON.stringify(blobRef), created_at: now, updated_at: now}).returningAll().executeTakeFirstOrThrow();
        const ids = await trx.selectFrom('local_material_manifests').select('id').where('owner_profile_id', '=', input.ownerProfileId).orderBy('created_at', 'asc').execute();
        await trx.updateTable('local_onboarding_sessions').set({material_ids: JSON.stringify(ids.map((item) => item.id)), state: session.state === 'COMPLETED' ? 'COMPLETED' : 'MATERIALS_READY', updated_at: now}).where('owner_profile_id', '=', input.ownerProfileId).where('path', '=', 'LOCAL_MATERIALS').executeTakeFirstOrThrow();
        return materialFromRow(row);
      });
      cleanupRef = null;
      return material;
    } catch (error) {
      if (cleanupRef !== null) await this.blobs.delete(cleanupRef);
      throw error;
    }
  }

  public async listMaterials(ownerProfileId: string): Promise<LocalMaterialManifest[]> {
    const rows = await this.#database.selectFrom('local_material_manifests').selectAll().where('owner_profile_id', '=', ownerProfileId).orderBy('created_at', 'asc').execute();
    return rows.map(materialFromRow);
  }

  public async deleteMaterial(ownerProfileId: string, materialId: string): Promise<boolean> {
    const ref = await this.#database.transaction().execute(async (trx) => {
      const session = await trx.selectFrom('local_onboarding_sessions').select(['state']).where('owner_profile_id', '=', ownerProfileId).forUpdate().executeTakeFirst();
      if (session === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
      if (session.state === 'COMPLETED') throw new LocalPresenceContractError('LOCAL_MATERIAL_BOUND_TO_CAMPAIGN');
      const row = await trx.selectFrom('local_material_manifests').select(['blob_ref', 'digest']).where('owner_profile_id', '=', ownerProfileId).where('id', '=', materialId).forUpdate().executeTakeFirst();
      if (row === undefined) return undefined;
      await trx.deleteFrom('local_material_manifests').where('owner_profile_id', '=', ownerProfileId).where('id', '=', materialId).execute();
      const remaining = await trx.selectFrom('local_material_manifests').select(({fn}) => fn.countAll<number>().as('count')).where('digest', '=', row.digest).executeTakeFirst();
      const ids = await trx.selectFrom('local_material_manifests').select('id').where('owner_profile_id', '=', ownerProfileId).orderBy('created_at', 'asc').execute();
      await trx.updateTable('local_onboarding_sessions').set({material_ids: JSON.stringify(ids.map((item) => item.id)), state: ids.length > 0 ? 'MATERIALS_READY' : 'MATERIAL_CHOICE', updated_at: new Date()}).where('owner_profile_id', '=', ownerProfileId).executeTakeFirstOrThrow();
      return Number(remaining?.count ?? 0) === 0 ? row.blob_ref as BlobRef : null;
    });
    if (ref === undefined) return false;
    if (ref !== null) await this.blobs.delete(ref);
    return true;
  }

  public async recordManualHandoff(input: Omit<ManualPublishHandoff, 'schemaVersion' | 'id' | 'state' | 'evidenceReceiptId' | 'createdAt'>, now: Date): Promise<ManualPublishHandoff> {
    void input;
    void now;
    throw new LocalPresenceContractError('MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED');
  }

  public async listManualHandoffs(ownerProfileId: string): Promise<ManualPublishHandoff[]> {
    const rows = await this.#database.selectFrom('manual_publish_handoffs').selectAll().where('owner_profile_id', '=', ownerProfileId).orderBy('created_at', 'desc').execute();
    return rows.map(handoffFromRow);
  }

  public async close(): Promise<void> { await this.#database.destroy(); }
}

function profileFromRow(row: Selectable<LocalOwnerProfilesTable>): LocalOwnerProfile {
  return {schemaVersion: 1, id: row.id, displayName: row.display_name, state: row.state, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)};
}

function sessionFromRow(row: Selectable<LocalOnboardingSessionsTable>): LocalOnboardingSession {
  return {schemaVersion: 1, ownerProfileId: row.owner_profile_id, path: row.path, state: row.state, dataMode: row.data_mode, organizationId: row.organization_id, campaignId: row.campaign_id, marketCode: row.market_code, contentLocale: row.content_locale, platform: row.platform, timeZone: row.time_zone, materialIds: stringArray(row.material_ids), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)};
}

function materialFromRow(row: Selectable<LocalMaterialManifestsTable>): LocalMaterialManifest {
  return {schemaVersion: 1, id: row.id, ownerProfileId: row.owner_profile_id, fileName: row.file_name, mediaType: row.media_type, byteSize: row.byte_size, digest: row.digest.trim(), state: row.state, extractedText: row.extracted_text, failureCode: row.failure_code, blobRef: row.blob_ref as BlobRef | null, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)};
}

function handoffFromRow(row: Selectable<ManualPublishHandoffsTable>): ManualPublishHandoff {
  return {schemaVersion: 1, id: row.id, ownerProfileId: row.owner_profile_id, campaignId: row.campaign_id, artifactRevisionId: row.artifact_revision_id, platform: row.platform, action: row.action, state: 'AWAITING_RECONCILIATION', evidenceReceiptId: null, createdAt: iso(row.created_at)};
}

function stringArray(value: unknown): string[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
}

function iso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
