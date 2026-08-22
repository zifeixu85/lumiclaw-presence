import type {BlobRef, BlobStore} from '@lumiclaw/blob-store';
import {createHash} from 'node:crypto';
import {
  createUuidV7,
  KnowledgeContractError,
  orderKnowledgeItemsForOwnerDecision,
  prepareKnowledgeSource,
  profileKnowledgeItems,
  profilePayload,
  sha256Digest,
  snapshotDigest,
  type KnowledgeConflict,
  type KnowledgeGapCode,
  type KnowledgeItem,
  type KnowledgeOnboardingSession,
  type KnowledgeOverview,
  type KnowledgePlatform,
  type KnowledgeRepository,
  type KnowledgeRoleContext,
  type KnowledgeSnapshot,
  type KnowledgeSnapshotSupersession,
  type KnowledgeSourceInput,
  type KnowledgeTextSourceInput,
  type ProfileKind,
  type ProfileRevision,
  type SourceCandidateInput,
  type SourceDocumentRevision
} from '@lumiclaw/domain';
import {Kysely, PostgresDialect, type Selectable, type Transaction} from 'kysely';
import {Pool} from 'pg';
import type {Database, KnowledgeItemsTable, KnowledgeProfileRevisionsTable, KnowledgeSnapshotsTable, LocalOnboardingSessionsTable, SourceDocumentRevisionsTable} from './database.js';

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  readonly #pool: Pool;
  readonly #database: Kysely<Database>;
  public constructor(connectionString: string, private readonly blobs: BlobStore) {
    this.#pool = new Pool({connectionString, max: 4});
    this.#database = new Kysely<Database>({dialect: new PostgresDialect({pool: this.#pool})});
    this.#pool.on('error', (error) => console.error('PostgreSQL knowledge idle client error', error.message));
  }

  public async health(): Promise<boolean> { const result = await this.#pool.query<{exists: boolean}>("select to_regclass('public.knowledge_snapshots') is not null as exists"); return result.rows[0]?.exists === true; }
  public async ensureOwner(ownerId: string, now: Date): Promise<KnowledgeOverview> { void now; return this.getOverview(ownerId); }
  public async getOverview(ownerId: string): Promise<KnowledgeOverview> { return this.readOverview(this.#database, ownerId); }

  public async updateSession(ownerId: string, input: {currentStep: KnowledgeOnboardingSession['currentStep']; targetMarket?: string | null; contentLocale?: string | null; timeZone?: string | null}, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.withIdempotency(ownerId, 'PUT:/onboarding/session', idempotencyKey, {input, expectedVersion}, now, async (trx) => {
      const session = await this.lockSession(trx, ownerId, expectedVersion);
      await trx.updateTable('local_onboarding_sessions').set({current_step: input.currentStep, target_market: input.targetMarket === undefined ? session.target_market : input.targetMarket, knowledge_content_locale: input.contentLocale === undefined ? session.knowledge_content_locale : input.contentLocale, knowledge_time_zone: input.timeZone === undefined ? session.knowledge_time_zone : input.timeZone, knowledge_state: 'DRAFT', row_version: session.row_version + 1, updated_at: now}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
      await this.rebuildDraft(trx, ownerId, now);
      return this.readOverview(trx, ownerId);
    });
  }

  public async saveProfile(ownerId: string, kind: ProfileKind, platform: KnowledgePlatform | null, value: unknown, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.withIdempotency(ownerId, `PUT:/profiles/${kind}/${platform ?? '-'}`, idempotencyKey, {value, expectedVersion}, now, async (trx) => {
      const session = await this.lockSession(trx, ownerId, expectedVersion);
      const payload = profilePayload(kind, platform, value);
      const count = await trx.selectFrom('knowledge_profile_revisions').select(({fn}) => fn.max<number>('version').as('version')).where('owner_profile_id', '=', ownerId).where('kind', '=', kind).where('platform_code', platform === null ? 'is' : '=', platform).executeTakeFirst();
      const version = Number(count?.version ?? 0) + 1; const id = createUuidV7(now.getTime() + version);
      const revision: ProfileRevision = {id, ownerId, kind, platformCode: platform, version, digest: sha256Digest({kind, platform, version, payload}), payload, createdAt: now.toISOString()};
      await trx.insertInto('knowledge_profile_revisions').values({owner_profile_id: ownerId, id, kind, platform_code: platform, version, digest: revision.digest, payload: JSON.stringify(payload), created_at: now}).execute();
      const items = profileKnowledgeItems(revision);
      for (const [index, item] of items.entries()) await trx.insertInto('knowledge_items').values({owner_profile_id: ownerId, id: createUuidV7(now.getTime() + 100 + index), kind: item.kind, normalized_value: item.normalizedValue, source_revision_id: null, profile_revision_id: id, owner_authority: item.ownerAuthority, sensitivity: item.sensitivity, created_at: now}).execute();
      await trx.updateTable('local_onboarding_sessions').set({knowledge_state: 'DRAFT', row_version: session.row_version + 1, updated_at: now}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
      await this.rebuildDraft(trx, ownerId, now);
      return this.readOverview(trx, ownerId);
    });
  }

  public async ingestSource(input: KnowledgeSourceInput, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> { return this.ingest(input.ownerId, input, 'UPLOADED_FILE', expectedVersion, idempotencyKey, now); }
  public async ingestTextSource(input: KnowledgeTextSourceInput, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> { return this.ingest(input.ownerId, input, 'OWNER_AUTHORED_TEXT', expectedVersion, idempotencyKey, now); }

  public async getSource(ownerId: string, documentId: string): Promise<SourceDocumentRevision | undefined> {
    const owner = await this.#database.selectFrom('source_documents').select('owner_profile_id').where('id', '=', documentId).executeTakeFirst();
    if (owner !== undefined && owner.owner_profile_id !== ownerId) throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');
    const rows = await this.activeSourceRows(this.#database, ownerId); return rows.find((item) => item.document_id === documentId) === undefined ? undefined : sourceFromRow(rows.find((item) => item.document_id === documentId)!);
  }

  public async getProfileRevision(ownerId:string,revisionId:string):Promise<ProfileRevision|undefined>{const row=await this.#database.selectFrom('knowledge_profile_revisions').selectAll().where('id','=',revisionId).executeTakeFirst();if(row===undefined)return undefined;if(row.owner_profile_id!==ownerId)throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');return profileFromRow(row);}

  public async deleteSource(ownerId: string, documentId: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.withIdempotency(ownerId, `DELETE:/knowledge/sources/${documentId}`, idempotencyKey, {documentId, expectedVersion}, now, async (trx) => {
      const session = await this.lockSession(trx, ownerId, expectedVersion);
      const owner = await trx.selectFrom('source_documents').selectAll().where('id', '=', documentId).forUpdate().executeTakeFirst();
      if (owner === undefined) throw new KnowledgeContractError('SOURCE_NOT_FOUND');
      if (owner.owner_profile_id !== ownerId) throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');
      if (owner.deleted_at !== null) throw new KnowledgeContractError('SOURCE_NOT_FOUND');
      await trx.updateTable('source_documents').set({deleted_at: now}).where('owner_profile_id', '=', ownerId).where('id', '=', documentId).executeTakeFirstOrThrow();
      await trx.updateTable('local_onboarding_sessions').set({knowledge_state: 'DRAFT', row_version: session.row_version + 1, updated_at: now}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
      await this.rebuildDraft(trx, ownerId, now);
      await this.audit(trx, ownerId, 'SOURCE_DELETED_NEW_DRAFT_REQUIRED', 'SOURCE_DOCUMENT', documentId, now);
      return this.readOverview(trx, ownerId);
    });
  }

  public async confirmLegacySource(ownerId: string, documentId: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.withIdempotency(ownerId, `POST:/knowledge/sources/${documentId}/confirm`, idempotencyKey, {documentId, expectedVersion}, now, async (trx) => {
      const session = await this.lockSession(trx, ownerId, expectedVersion);
      const current = (await this.activeSourceRows(trx, ownerId)).find((item) => item.document_id === documentId);
      if (current === undefined) {
        const foreign = await trx.selectFrom('source_documents').select('owner_profile_id').where('id', '=', documentId).executeTakeFirst();
        if (foreign !== undefined) throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');
        throw new KnowledgeContractError('SOURCE_NOT_FOUND');
      }
      if (current.status !== 'LEGACY_NEEDS_REVIEW') throw new KnowledgeContractError('SOURCE_REVIEW_NOT_REQUIRED');
      const id = createUuidV7(now.getTime() + 31);
      await trx.insertInto('source_document_revisions').values({owner_profile_id: ownerId, id, document_id: documentId, version: current.version + 1, source_kind: current.source_kind, label: current.label, file_name: current.file_name, media_type: current.media_type, byte_size: current.byte_size, blob_digest: current.blob_digest, blob_ref: current.blob_ref, extracted_text_digest: createHash('sha256').update(current.extracted_text, 'utf8').digest('hex'), extracted_text: current.extracted_text, candidate_items: current.candidate_items, status: 'READY', sensitivity: current.sensitivity, created_at: now}).execute();
      const itemId = createUuidV7(now.getTime() + 32);
      await trx.insertInto('knowledge_items').values({owner_profile_id: ownerId, id: itemId, kind: 'SOURCE_EXCERPT', normalized_value: current.extracted_text, source_revision_id: id, profile_revision_id: null, owner_authority: 'ORGANIZATION_APPROVED_PRIVATE', sensitivity: current.sensitivity, created_at: now}).execute();
      await trx.insertInto('knowledge_item_source_bindings').values({owner_profile_id: ownerId, knowledge_item_id: itemId, source_revision_id: id}).execute();
      await trx.updateTable('local_onboarding_sessions').set({knowledge_state: 'DRAFT', row_version: session.row_version + 1, updated_at: now}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
      await this.rebuildDraft(trx, ownerId, now);
      return this.readOverview(trx, ownerId);
    });
  }

  public async resolveConflict(ownerId: string, conflictId: string, selectedItemId: string, note: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.withIdempotency(ownerId, 'POST:/knowledge/snapshots/resolve-conflict', idempotencyKey, {conflictId, selectedItemId, note, expectedVersion}, now, async (trx) => {
      const session = await this.lockSession(trx, ownerId, expectedVersion); const draft = await this.currentDraft(trx, ownerId);
      const conflict = draft?.conflictDecisions.find((item) => item.id === conflictId);
      if (conflict === undefined || !conflict.itemIds.includes(selectedItemId)) throw new KnowledgeContractError('KNOWLEDGE_CONFLICT_NOT_FOUND');
      const normalized = note.normalize('NFC').trim(); if (normalized.length < 1 || normalized.length > 1000) throw new KnowledgeContractError('CONFLICT_RESOLUTION_NOTE_INVALID');
      await trx.insertInto('knowledge_conflict_resolutions').values({owner_profile_id: ownerId, conflict_key: conflictId, selected_item_id: selectedItemId, note: normalized, resolved_at: now}).onConflict((oc) => oc.columns(['owner_profile_id','conflict_key']).doUpdateSet({selected_item_id: selectedItemId, note: normalized, resolved_at: now})).execute();
      await trx.updateTable('local_onboarding_sessions').set({knowledge_state: 'DRAFT', row_version: session.row_version + 1, updated_at: now}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
      await this.rebuildDraft(trx, ownerId, now); return this.readOverview(trx, ownerId);
    });
  }

  public async approveSnapshot(ownerId: string, snapshotId: string, canonicalDigest: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.withIdempotency(ownerId, 'POST:/knowledge/snapshots/approve', idempotencyKey, {snapshotId, canonicalDigest, expectedVersion}, now, async (trx) => {
      const session = await this.lockSession(trx, ownerId, expectedVersion);
      const row = await trx.selectFrom('knowledge_snapshots').selectAll().where('owner_profile_id', '=', ownerId).where('id', '=', snapshotId).forUpdate().executeTakeFirst();
      if (row === undefined || !['DRAFT','NEEDS_OWNER'].includes(row.state)) throw new KnowledgeContractError('SNAPSHOT_STALE');
      const draft = snapshotFromRow(row);
      if (draft.canonicalDigest !== canonicalDigest) throw new KnowledgeContractError('SNAPSHOT_APPROVAL_DIGEST_MISMATCH');
      if (draft.sessionRowVersion !== expectedVersion) throw new KnowledgeContractError('SNAPSHOT_STALE');
      if (draft.gaps.length > 0) throw new KnowledgeContractError('SNAPSHOT_GAPS_UNRESOLVED');
      if (draft.conflictDecisions.some((item) => item.state !== 'RESOLVED')) throw new KnowledgeContractError('KNOWLEDGE_CONFLICT_UNRESOLVED');
      const sources = await this.activeSourceRows(trx, ownerId); for (const source of sources) if (!await this.blobs.has(blobRef(source.blob_ref))) throw new KnowledgeContractError('SOURCE_BLOB_MISSING');
      const previous=await trx.selectFrom('knowledge_snapshots').select(['id','canonical_digest']).where('owner_profile_id','=',ownerId).where('state','=','APPROVED').forUpdate().executeTakeFirst();
      await trx.updateTable('knowledge_snapshots').set({state: 'SUPERSEDED'}).where('owner_profile_id', '=', ownerId).where('state', '=', 'APPROVED').execute();
      await trx.updateTable('knowledge_snapshots').set({state: 'APPROVED', approved_by: ownerId, approved_at: now}).where('owner_profile_id', '=', ownerId).where('id', '=', snapshotId).executeTakeFirstOrThrow();
      if(previous!==undefined){const eventId=`snapshot_supersession_${sha256Digest({ownerId,supersededSnapshotId:previous.id,approvedSnapshotId:snapshotId}).slice(0,24)}`;await trx.insertInto('knowledge_snapshot_supersession_outbox_v2').values({owner_profile_id:ownerId,event_id:eventId,superseded_snapshot_id:previous.id,superseded_snapshot_digest:previous.canonical_digest.trim(),approved_snapshot_id:snapshotId,approved_snapshot_digest:canonicalDigest,created_at:now}).onConflict((oc)=>oc.columns(['owner_profile_id','event_id']).doNothing()).execute();}
      await trx.updateTable('local_onboarding_sessions').set({knowledge_state: 'KNOWLEDGE_APPROVED_NEEDS_GOAL', current_step: 'REVIEW', current_knowledge_snapshot_id: snapshotId, current_knowledge_snapshot_digest: canonicalDigest, row_version: session.row_version + 1, updated_at: now}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
      await trx.updateTable('local_owner_profiles').set({state: 'ONBOARDING_COMPLETE', updated_at: now}).where('id', '=', ownerId).executeTakeFirstOrThrow();
      await this.audit(trx, ownerId, 'KNOWLEDGE_SNAPSHOT_APPROVED', 'KNOWLEDGE_SNAPSHOT', snapshotId, now);
      return this.readOverview(trx, ownerId);
    });
  }

  public async getRoleContext(ownerId: string, snapshotId: string, canonicalDigest: string): Promise<KnowledgeRoleContext> {
    const session = await this.#database.selectFrom('local_onboarding_sessions').select('owner_profile_id').where('owner_profile_id', '=', ownerId).executeTakeFirst();
    if (session === undefined) throw new KnowledgeContractError('SNAPSHOT_STALE');
    const row = await this.#database.selectFrom('knowledge_snapshots').selectAll().where('owner_profile_id', '=', ownerId).where('id', '=', snapshotId).where('state', '=', 'APPROVED').executeTakeFirst();
    if (row === undefined || row.canonical_digest.trim() !== canonicalDigest) throw new KnowledgeContractError('SNAPSHOT_APPROVAL_DIGEST_MISMATCH');
    const snapshot = snapshotFromRow(row);
    for(const binding of snapshot.sourceRevisionDigests){const source=await this.#database.selectFrom('source_document_revisions').select(['blob_digest','blob_ref']).where('owner_profile_id','=',ownerId).where('id','=',binding.revisionId).executeTakeFirst();if(source===undefined||source.blob_digest.trim()!==binding.digest||!await this.blobs.has(blobRef(source.blob_ref)))throw new KnowledgeContractError('SOURCE_BLOB_MISSING');}
    const existingContext=await this.#database.selectFrom('knowledge_snapshot_context_bindings_v2').selectAll().where('owner_profile_id','=',ownerId).where('snapshot_id','=',snapshotId).executeTakeFirst();
    const context=existingContext??await this.materializeApprovedSnapshotContext(this.#database,ownerId,snapshotId,canonicalDigest,new Date());
    if(context===undefined)throw new KnowledgeContractError('SNAPSHOT_CONTEXT_BINDING_UNAVAILABLE');
    return {snapshotId, snapshotDigest: canonicalDigest, ownerId, targetMarket: context.target_market, contentLocale: context.content_locale, timeZone: context.time_zone, items: snapshot.itemBindings.map(({id, kind, normalizedValue, sourceRevisionIds, profileRevisionIds, ownerAuthority}) => ({id, kind, normalizedValue, sourceRevisionIds, profileRevisionIds, ownerAuthority})), sourceDigests: snapshot.sourceRevisionDigests, profileDigests: snapshot.profileRevisionDigests};
  }

  public async listPendingSnapshotSupersessions(ownerId:string):Promise<KnowledgeSnapshotSupersession[]>{const rows=await this.#database.selectFrom('knowledge_snapshot_supersession_outbox_v2 as o').leftJoin('knowledge_snapshot_supersession_receipts_v2 as r',(join)=>join.onRef('r.owner_profile_id','=','o.owner_profile_id').onRef('r.event_id','=','o.event_id')).selectAll('o').where('o.owner_profile_id','=',ownerId).where('r.event_id','is',null).orderBy('o.created_at').execute();return rows.map((row)=>({eventId:row.event_id,ownerId:row.owner_profile_id,supersededSnapshotId:row.superseded_snapshot_id,supersededSnapshotDigest:row.superseded_snapshot_digest.trim(),approvedSnapshotId:row.approved_snapshot_id,approvedSnapshotDigest:row.approved_snapshot_digest.trim(),createdAt:iso(row.created_at)}));}
  public async acknowledgeSnapshotSupersession(ownerId:string,eventId:string,now:Date):Promise<void>{const event=await this.#database.selectFrom('knowledge_snapshot_supersession_outbox_v2').select('event_id').where('owner_profile_id','=',ownerId).where('event_id','=',eventId).executeTakeFirst();if(event===undefined)throw new KnowledgeContractError('SNAPSHOT_SUPERSESSION_NOT_FOUND');await this.#database.insertInto('knowledge_snapshot_supersession_receipts_v2').values({owner_profile_id:ownerId,event_id:eventId,delivered_at:now}).onConflict((oc)=>oc.columns(['owner_profile_id','event_id']).doNothing()).execute();}

  public async recordSecurityRejection(ownerId: string, eventCode: string, now: Date): Promise<void> {
    await this.#database.insertInto('knowledge_audit_events').values({owner_profile_id:ownerId,id:createUuidV7(now.getTime()+900),event_code:'KNOWLEDGE_REQUEST_REJECTED',target_type:'REDACTED_REQUEST',target_id:null,redacted_metadata:JSON.stringify({reasonCode:eventCode,redacted:true}),created_at:now}).execute();
  }

  public async close(): Promise<void> { await this.#database.destroy(); }

  private async ingest(ownerId: string, input: KnowledgeSourceInput | KnowledgeTextSourceInput, sourceKind: 'UPLOADED_FILE' | 'OWNER_AUTHORED_TEXT', expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    const prepared = prepareKnowledgeSource(input, now, sourceKind); const bytes = 'bytes' in input ? input.bytes : new TextEncoder().encode(input.text);
    let cleanup: BlobRef | null = null;
    const existed = await this.blobs.has(prepared.blobRef); const stored = await this.blobs.put(bytes); if (!existed) cleanup = stored;
    if (stored.digest !== prepared.blobDigest || stored.size !== prepared.byteSize) { if (cleanup !== null) await this.deleteBlobIfUnreferenced(cleanup); throw new KnowledgeContractError('SOURCE_DIGEST_MISMATCH'); }
    try {
      const request = {label: prepared.label, fileName: prepared.fileName, digest: prepared.blobDigest, candidates: prepared.candidates, expectedVersion};
      const result = await this.withIdempotency(ownerId, `POST:/knowledge/sources/${sourceKind}`, idempotencyKey, request, now, async (trx) => {
        const session = await this.lockSession(trx, ownerId, expectedVersion); const documentId = createUuidV7(now.getTime() + 11); const revisionId = createUuidV7(now.getTime() + 12);
        await trx.insertInto('source_documents').values({owner_profile_id: ownerId, id: documentId, source_kind: sourceKind, label: prepared.label, sensitivity: prepared.sensitivity, created_at: now, deleted_at: null}).execute();
        await trx.insertInto('source_document_revisions').values({owner_profile_id: ownerId, id: revisionId, document_id: documentId, version: 1, source_kind: sourceKind, label: prepared.label, file_name: prepared.fileName, media_type: prepared.mediaType, byte_size: prepared.byteSize, blob_digest: prepared.blobDigest, blob_ref: JSON.stringify(stored), extracted_text_digest: prepared.extractedTextDigest, extracted_text: prepared.extractedText, candidate_items: JSON.stringify(prepared.candidates), status: 'READY', sensitivity: prepared.sensitivity, created_at: now}).execute();
        const candidates: Array<SourceCandidateInput | {kind: 'SOURCE_EXCERPT'; value: string}> = prepared.candidates.length > 0 ? prepared.candidates : [{kind: 'SOURCE_EXCERPT', value: prepared.extractedText}];
        for (const [index, candidate] of candidates.entries()) { const itemId = createUuidV7(now.getTime() + 30 + index); await trx.insertInto('knowledge_items').values({owner_profile_id: ownerId, id: itemId, kind: candidate.kind, normalized_value: candidate.value, source_revision_id: revisionId, profile_revision_id: null, owner_authority: 'ORGANIZATION_APPROVED_PRIVATE', sensitivity: prepared.sensitivity, created_at: now}).execute(); await trx.insertInto('knowledge_item_source_bindings').values({owner_profile_id: ownerId, knowledge_item_id: itemId, source_revision_id: revisionId}).execute(); }
        await trx.updateTable('local_onboarding_sessions').set({knowledge_state: 'DRAFT', row_version: session.row_version + 1, updated_at: now}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
        await this.rebuildDraft(trx, ownerId, now); await this.audit(trx, ownerId, 'SOURCE_REVISION_CREATED', 'SOURCE_DOCUMENT', documentId, now); return this.readOverview(trx, ownerId);
      });
      cleanup = null; return result;
    } catch (error) { if (cleanup !== null) await this.deleteBlobIfUnreferenced(cleanup); throw error; }
  }

  private async withIdempotency(ownerId: string, route: string, key: string, request: unknown, now: Date, operation: (trx: Transaction<Database>) => Promise<KnowledgeOverview>): Promise<KnowledgeOverview> {
    if (key.length < 8 || key.length > 128) throw new KnowledgeContractError('IDEMPOTENCY_KEY_REQUIRED'); const digest = sha256Digest(request);
    return this.#database.transaction().execute(async (trx) => {
      await this.materializeApprovedSnapshotContext(trx,ownerId,undefined,undefined,now);
      const existing = await trx.selectFrom('knowledge_idempotency_records').selectAll().where('owner_profile_id', '=', ownerId).where('route', '=', route).where('idempotency_key', '=', key).executeTakeFirst();
      if (existing !== undefined) { if (existing.request_digest.trim() !== digest) throw new KnowledgeContractError('IDEMPOTENCY_KEY_REUSED'); return json<KnowledgeOverview>(existing.response_body); }
      const response = await operation(trx); await trx.insertInto('knowledge_idempotency_records').values({owner_profile_id: ownerId, route, idempotency_key: key, request_digest: digest, response_body: JSON.stringify(response), created_at: now}).execute(); return response;
    });
  }

  private async rebuildDraft(trx: Transaction<Database>, ownerId: string, now: Date): Promise<void> {
    const sessionRow = await trx.selectFrom('local_onboarding_sessions').selectAll().where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
    await trx.updateTable('knowledge_snapshots').set({state: 'SUPERSEDED'}).where('owner_profile_id', '=', ownerId).where('state', 'in', ['DRAFT','NEEDS_OWNER']).execute();
    const sourceRows = await this.activeSourceRows(trx, ownerId); const sources = sourceRows.map(sourceFromRow); const profiles = await this.latestProfiles(trx, ownerId);
    const profileIds = [profiles.persona?.id, profiles.organization?.id, profiles.product?.id, profiles.accounts.X?.id, profiles.accounts.XIAOHONGSHU?.id].filter((id): id is string => id !== undefined);
    const sourceIds = sources.map((item) => item.id); let itemRows: Selectable<KnowledgeItemsTable>[] = [];
    if (profileIds.length > 0 || sourceIds.length > 0) itemRows = await trx.selectFrom('knowledge_items').selectAll().where((eb) => eb.or([...(sourceIds.length === 0 ? [] : [eb('source_revision_id', 'in', sourceIds)]), ...(profileIds.length === 0 ? [] : [eb('profile_revision_id', 'in', profileIds)])])).orderBy('id').execute();
    const items = itemRows.map(itemFromRow); const resolutionRows = await trx.selectFrom('knowledge_conflict_resolutions').selectAll().where('owner_profile_id', '=', ownerId).execute(); const resolutions = new Map(resolutionRows.map((item) => [item.conflict_key.trim(), {selectedItemId: item.selected_item_id, note: item.note}])); const conflicts = buildConflicts(items, resolutions);
    const gaps: KnowledgeGapCode[] = [];
    if (profiles.persona === null) gaps.push('PERSONA_REQUIRED'); if (profiles.organization === null) gaps.push('ORGANIZATION_REQUIRED'); if (profiles.product === null) gaps.push('PRODUCT_REQUIRED'); if (profiles.accounts.X === undefined) gaps.push('X_ACCOUNT_REQUIRED'); if (profiles.accounts.XIAOHONGSHU === undefined) gaps.push('XIAOHONGSHU_ACCOUNT_REQUIRED'); if (sources.length === 0) gaps.push('SOURCE_REQUIRED'); if (sessionRow.target_market === null) gaps.push('MARKET_REQUIRED'); if (sessionRow.knowledge_content_locale === null) gaps.push('CONTENT_LOCALE_REQUIRED'); if (sessionRow.knowledge_time_zone === null) gaps.push('TIME_ZONE_REQUIRED'); if (sources.some((item) => item.status === 'LEGACY_NEEDS_REVIEW')) gaps.push('SOURCE_REVIEW_REQUIRED');
    for (const source of sourceRows) if (!await this.blobs.has(blobRef(source.blob_ref))) { gaps.push('SOURCE_BLOB_MISSING'); break; }
    const max = await trx.selectFrom('knowledge_snapshots').select(({fn}) => fn.max<number>('version').as('version')).where('owner_profile_id', '=', ownerId).executeTakeFirst(); const version = Number(max?.version ?? 0) + 1;
    const profileRevisionDigests = profileIds.sort().map((revisionId) => ({revisionId, digest: this.profileDigest(profiles, revisionId)}));
    const base = {id: createUuidV7(now.getTime() + 401 + version), ownerId, version, sessionRowVersion: sessionRow.row_version, sourceRevisionDigests: sources.map((item) => ({revisionId: item.id, digest: item.blobDigest})), profileRevisionDigests, itemBindings: items, conflictDecisions: conflicts, gaps};
    const snapshot: KnowledgeSnapshot = {...base, state: conflicts.some((item) => item.state === 'NEEDS_OWNER_DECISION') ? 'NEEDS_OWNER' : 'DRAFT', canonicalDigest: snapshotDigest(base), approvedBy: null, approvedAt: null, createdAt: now.toISOString()};
    await trx.insertInto('knowledge_snapshots').values({owner_profile_id: ownerId, id: snapshot.id, version, state: snapshot.state, session_row_version: snapshot.sessionRowVersion, canonical_digest: snapshot.canonicalDigest, source_revision_digests: JSON.stringify(snapshot.sourceRevisionDigests), profile_revision_digests: JSON.stringify(snapshot.profileRevisionDigests), item_bindings: JSON.stringify(snapshot.itemBindings), conflict_decisions: JSON.stringify(snapshot.conflictDecisions), gaps: JSON.stringify(snapshot.gaps), approved_by: null, approved_at: null, created_at: now}).execute();
    if(sessionRow.target_market!==null&&sessionRow.knowledge_content_locale!==null&&sessionRow.knowledge_time_zone!==null){const context={schemaVersion:2,snapshotId:snapshot.id,targetMarket:sessionRow.target_market,contentLocale:sessionRow.knowledge_content_locale,timeZone:sessionRow.knowledge_time_zone};await trx.insertInto('knowledge_snapshot_context_bindings_v2').values({owner_profile_id:ownerId,snapshot_id:snapshot.id,schema_version:2,target_market:context.targetMarket,content_locale:context.contentLocale,time_zone:context.timeZone,context_digest:sha256Digest(context),created_at:now}).execute();}
    for (const source of sources) await trx.insertInto('knowledge_snapshot_source_bindings').values({owner_profile_id: ownerId, snapshot_id: snapshot.id, source_revision_id: source.id, source_digest: source.blobDigest}).execute();
    const knowledgeState = conflicts.some((item) => item.state === 'NEEDS_OWNER_DECISION') ? 'NEEDS_OWNER_DECISION' : gaps.length === 0 ? 'READY_FOR_APPROVAL' : 'DRAFT';
    const authoritative=await trx.selectFrom('knowledge_snapshots').select(['id','canonical_digest']).where('owner_profile_id','=',ownerId).where('state','=','APPROVED').executeTakeFirst();
    await trx.updateTable('local_onboarding_sessions').set({knowledge_state: knowledgeState, current_knowledge_snapshot_id: authoritative?.id??snapshot.id, current_knowledge_snapshot_digest: authoritative?.canonical_digest.trim()??snapshot.canonicalDigest}).where('owner_profile_id', '=', ownerId).executeTakeFirstOrThrow();
  }

  private async readOverview(db: Kysely<Database> | Transaction<Database>, ownerId: string): Promise<KnowledgeOverview> {
    const session = await db.selectFrom('local_onboarding_sessions').selectAll().where('owner_profile_id', '=', ownerId).executeTakeFirst(); if (session === undefined) throw new KnowledgeContractError('LOCAL_PROFILE_NOT_FOUND');
    const sources = (await this.activeSourceRows(db, ownerId)).map(sourceFromRow); const profiles = await this.latestProfiles(db, ownerId); const snapshots = (await db.selectFrom('knowledge_snapshots').selectAll().where('owner_profile_id', '=', ownerId).orderBy('version','desc').execute()).map(snapshotFromRow);
    return {session: sessionFromRow(session), sources, profiles, draft: snapshots.find((item) => ['DRAFT','NEEDS_OWNER'].includes(item.state)) ?? null, approvedHistory: snapshots.filter((item) => item.approvedAt !== null)};
  }
  private async activeSourceRows(db: Kysely<Database> | Transaction<Database>, ownerId: string): Promise<Selectable<SourceDocumentRevisionsTable>[]> { const rows = await db.selectFrom('source_documents as d').innerJoin('source_document_revisions as r', (join) => join.onRef('r.owner_profile_id','=','d.owner_profile_id').onRef('r.document_id','=','d.id')).selectAll('r').where('d.owner_profile_id','=',ownerId).where('d.deleted_at','is',null).orderBy('r.document_id').orderBy('r.version','desc').execute(); const seen = new Set<string>(); return rows.filter((row) => seen.has(row.document_id) ? false : (seen.add(row.document_id), true)); }
  private async latestProfiles(db: Kysely<Database> | Transaction<Database>, ownerId: string): Promise<KnowledgeOverview['profiles']> { const rows = await db.selectFrom('knowledge_profile_revisions').selectAll().where('owner_profile_id','=',ownerId).orderBy('version','desc').execute(); const pick = (kind: ProfileKind, platform: KnowledgePlatform | null) => { const row = rows.find((item) => item.kind === kind && item.platform_code === platform); return row === undefined ? null : profileFromRow(row); }; const x=pick('ACCOUNT','X'); const xhs=pick('ACCOUNT','XIAOHONGSHU'); return {persona:pick('PERSONA',null),organization:pick('ORGANIZATION',null),product:pick('PRODUCT',null),accounts:{...(x===null?{}:{X:x}),...(xhs===null?{}:{XIAOHONGSHU:xhs})}}; }
  private async currentDraft(db: Kysely<Database> | Transaction<Database>, ownerId: string): Promise<KnowledgeSnapshot | null> { const row = await db.selectFrom('knowledge_snapshots').selectAll().where('owner_profile_id','=',ownerId).where('state','in',['DRAFT','NEEDS_OWNER']).orderBy('version','desc').executeTakeFirst(); return row===undefined?null:snapshotFromRow(row); }
  private async materializeApprovedSnapshotContext(db:Kysely<Database>|Transaction<Database>,ownerId:string,requestedSnapshotId:string|undefined,requestedDigest:string|undefined,now:Date):Promise<{target_market:string;content_locale:string;time_zone:string}|undefined>{
    const session=await db.selectFrom('local_onboarding_sessions').select(['current_knowledge_snapshot_id','current_knowledge_snapshot_digest','target_market','knowledge_content_locale','knowledge_time_zone']).where('owner_profile_id','=',ownerId).executeTakeFirst();
    if(session===undefined||session.current_knowledge_snapshot_id===null||session.current_knowledge_snapshot_digest===null||session.target_market===null||session.knowledge_content_locale===null||session.knowledge_time_zone===null)return undefined;
    const snapshotId=requestedSnapshotId??session.current_knowledge_snapshot_id;const canonicalDigest=requestedDigest??session.current_knowledge_snapshot_digest.trim();
    if(session.current_knowledge_snapshot_id!==snapshotId||session.current_knowledge_snapshot_digest.trim()!==canonicalDigest)return undefined;
    const snapshot=await db.selectFrom('knowledge_snapshots').select('canonical_digest').where('owner_profile_id','=',ownerId).where('id','=',snapshotId).where('state','=','APPROVED').executeTakeFirst();
    if(snapshot===undefined||snapshot.canonical_digest.trim()!==canonicalDigest)return undefined;
    const context={schemaVersion:2 as const,snapshotId,targetMarket:session.target_market,contentLocale:session.knowledge_content_locale,timeZone:session.knowledge_time_zone};
    await db.insertInto('knowledge_snapshot_context_bindings_v2').values({owner_profile_id:ownerId,snapshot_id:snapshotId,schema_version:2,target_market:context.targetMarket,content_locale:context.contentLocale,time_zone:context.timeZone,context_digest:sha256Digest(context),created_at:now}).onConflict((oc)=>oc.columns(['owner_profile_id','snapshot_id']).doNothing()).execute();
    return {target_market:context.targetMarket,content_locale:context.contentLocale,time_zone:context.timeZone};
  }
  private async lockSession(trx: Transaction<Database>, ownerId: string, expected: number): Promise<Selectable<LocalOnboardingSessionsTable>> { const row=await trx.selectFrom('local_onboarding_sessions').selectAll().where('owner_profile_id','=',ownerId).forUpdate().executeTakeFirst(); if(row===undefined)throw new KnowledgeContractError('LOCAL_PROFILE_NOT_FOUND'); if(row.row_version!==expected)throw new KnowledgeContractError('SNAPSHOT_STALE'); return row; }
  private profileDigest(profiles: KnowledgeOverview['profiles'], id: string): string { const all=[profiles.persona,profiles.organization,profiles.product,profiles.accounts.X,profiles.accounts.XIAOHONGSHU]; const item=all.find((entry)=>entry?.id===id); if(item===undefined||item===null)throw new KnowledgeContractError('SNAPSHOT_STALE'); return item.digest; }
  private async audit(trx: Transaction<Database>, ownerId: string, code: string, type: string, targetId: string, now: Date): Promise<void> { await trx.insertInto('knowledge_audit_events').values({owner_profile_id:ownerId,id:createUuidV7(now.getTime()+800),event_code:code,target_type:type,target_id:targetId,redacted_metadata:JSON.stringify({source:'CONTROL_PLANE'}),created_at:now}).execute(); }
  private async deleteBlobIfUnreferenced(ref: BlobRef): Promise<void> { const [source,legacy]=await Promise.all([this.#database.selectFrom('source_document_revisions').select('id').where('blob_digest','=',ref.digest).executeTakeFirst(),this.#database.selectFrom('local_material_manifests').select('id').where('digest','=',ref.digest).executeTakeFirst()]);if(source===undefined&&legacy===undefined)await this.blobs.delete(ref); }
}

function sessionFromRow(row: Selectable<LocalOnboardingSessionsTable>): KnowledgeOnboardingSession { return {ownerId:row.owner_profile_id,state:row.knowledge_state,currentStep:row.current_step,rowVersion:row.row_version,targetMarket:row.target_market,contentLocale:row.knowledge_content_locale,timeZone:row.knowledge_time_zone,currentSnapshotId:row.current_knowledge_snapshot_id,currentSnapshotDigest:row.current_knowledge_snapshot_digest?.trim()??null,updatedAt:iso(row.updated_at)}; }
function sourceFromRow(row: Selectable<SourceDocumentRevisionsTable>): SourceDocumentRevision { return {id:row.id,documentId:row.document_id,ownerId:row.owner_profile_id,version:row.version,sourceKind:row.source_kind,label:row.label,fileName:row.file_name,mediaType:row.media_type,byteSize:row.byte_size,blobDigest:row.blob_digest.trim(),blobRef:blobRef(row.blob_ref),extractedTextDigest:row.extracted_text_digest.trim(),extractedText:row.extracted_text,status:row.status,sensitivity:row.sensitivity,createdAt:iso(row.created_at),deletedAt:null}; }
function profileFromRow(row: Selectable<KnowledgeProfileRevisionsTable>): ProfileRevision { return {id:row.id,ownerId:row.owner_profile_id,kind:row.kind,platformCode:row.platform_code,version:row.version,digest:row.digest.trim(),payload:json<ProfileRevision['payload']>(row.payload),createdAt:iso(row.created_at)}; }
function itemFromRow(row: Selectable<KnowledgeItemsTable>): KnowledgeItem { return {id:row.id,kind:row.kind,normalizedValue:row.normalized_value,sourceRevisionIds:row.source_revision_id===null?[]:[row.source_revision_id],profileRevisionIds:row.profile_revision_id===null?[]:[row.profile_revision_id],ownerAuthority:row.owner_authority,sensitivity:row.sensitivity}; }
function snapshotFromRow(row: Selectable<KnowledgeSnapshotsTable>): KnowledgeSnapshot { return {id:row.id,ownerId:row.owner_profile_id,version:row.version,state:row.state,sessionRowVersion:row.session_row_version,sourceRevisionDigests:json(row.source_revision_digests),profileRevisionDigests:json(row.profile_revision_digests),itemBindings:json(row.item_bindings),conflictDecisions:json(row.conflict_decisions),gaps:json(row.gaps),canonicalDigest:row.canonical_digest.trim(),approvedBy:row.approved_by,approvedAt:row.approved_at===null?null:iso(row.approved_at),createdAt:iso(row.created_at)}; }
function buildConflicts(items: KnowledgeItem[], resolutions: Map<string,{selectedItemId:string;note:string}>): KnowledgeConflict[] { const groups=new Map<string,KnowledgeItem[]>(); for(const item of items){if(!['ORGANIZATION_FACT','PRODUCT_FACT','CLAIM'].includes(item.kind))continue;const slot=conflictSlot(item.normalizedValue);if(slot===null)continue;const key=`${item.kind}:${slot}`;const group=groups.get(key)??[];group.push(item);groups.set(key,group);} const result:KnowledgeConflict[]=[]; for(const [kind,candidates] of groups){const unique=new Map<string,KnowledgeItem>();for(const item of orderKnowledgeItemsForOwnerDecision(candidates)){const value=item.normalizedValue.toLocaleLowerCase('en-US');if(!unique.has(value))unique.set(value,item);}if(unique.size<2)continue;const itemIds=orderKnowledgeItemsForOwnerDecision([...unique.values()]).map((item)=>item.id);const id=sha256Digest({kind,itemIds});const resolution=resolutions.get(id);result.push({id,itemIds,reasonCode:'INCOMPATIBLE_VALUES',ownerResolution:resolution??null,state:resolution===undefined?'NEEDS_OWNER_DECISION':'RESOLVED'});} return result; }
function conflictSlot(value:string):string|null{const match=/^([^:=\n]{1,80})\s*[:=]\s*(.+)$/u.exec(value);return match===null?null:match[1]!.normalize('NFC').trim().toLocaleLowerCase('en-US');}
function blobRef(value: unknown): BlobRef { const ref=json<BlobRef>(value); if(ref.algorithm!=='sha256'||!/^[a-f0-9]{64}$/u.test(ref.digest)||!Number.isInteger(ref.size))throw new KnowledgeContractError('SOURCE_DIGEST_MISMATCH'); return ref; }
function json<T>(value: unknown): T { return (typeof value==='string'?JSON.parse(value):value) as T; }
function iso(value: Date|string): string { return value instanceof Date?value.toISOString():new Date(value).toISOString(); }
