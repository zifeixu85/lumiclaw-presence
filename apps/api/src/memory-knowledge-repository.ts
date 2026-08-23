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

type IdempotencyRecord = {requestDigest: string; response: KnowledgeOverview};

export class MemoryKnowledgeRepository implements KnowledgeRepository {
  readonly #auditEvents: Array<{ownerId:string;eventCode:string;at:string}>=[];
  readonly #sessions = new Map<string, KnowledgeOnboardingSession>();
  readonly #sources = new Map<string, SourceDocumentRevision>();
  readonly #sourceCandidates = new Map<string, SourceCandidateInput[]>();
  readonly #sourceBytes = new Map<string, Uint8Array>();
  readonly #profiles: ProfileRevision[] = [];
  readonly #items: KnowledgeItem[] = [];
  readonly #snapshots: KnowledgeSnapshot[] = [];
  readonly #snapshotContexts = new Map<string,{targetMarket:string;contentLocale:string;timeZone:string;contextDigest:string}>();
  readonly #snapshotSupersessions:KnowledgeSnapshotSupersession[]=[];
  readonly #supersessionReceipts=new Set<string>();
  readonly #resolutions = new Map<string, {selectedItemId: string; note: string}>();
  readonly #idempotency = new Map<string, IdempotencyRecord>();

  public async health(): Promise<boolean> { return true; }

  public async ensureOwner(ownerId: string, now: Date): Promise<KnowledgeOverview> {
    if (!this.#sessions.has(ownerId)) this.#sessions.set(ownerId, {ownerId, state: 'DRAFT', currentStep: 'PERSONA', rowVersion: 1, targetMarket: null, contentLocale: null, timeZone: null, currentSnapshotId: null, currentSnapshotDigest: null, updatedAt: now.toISOString()});
    return this.getOverview(ownerId);
  }

  public async getOverview(ownerId: string): Promise<KnowledgeOverview> {
    const session = this.requireSession(ownerId);
    return clone(this.overview(ownerId, session));
  }

  public async updateSession(ownerId: string, input: {currentStep: KnowledgeOnboardingSession['currentStep']; targetMarket?: string | null; contentLocale?: string | null; timeZone?: string | null}, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.mutate(ownerId, 'PUT:/onboarding/session', idempotencyKey, {input, expectedVersion}, async () => {
      const session = this.requireVersion(ownerId, expectedVersion);
      this.#sessions.set(ownerId, {...session, currentStep: input.currentStep, targetMarket: input.targetMarket === undefined ? session.targetMarket : input.targetMarket, contentLocale: input.contentLocale === undefined ? session.contentLocale : input.contentLocale, timeZone: input.timeZone === undefined ? session.timeZone : input.timeZone, rowVersion: session.rowVersion + 1, updatedAt: now.toISOString()});
      this.rebuildDraft(ownerId, now);
      return this.overview(ownerId, this.requireSession(ownerId));
    });
  }

  public async saveProfile(ownerId: string, kind: ProfileKind, platform: KnowledgePlatform | null, value: unknown, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.mutate(ownerId, `PUT:/profiles/${kind}/${platform ?? '-'}`, idempotencyKey, {value, expectedVersion}, async () => {
      const session = this.requireVersion(ownerId, expectedVersion);
      const payload = profilePayload(kind, platform, value);
      const version = this.#profiles.filter((item) => item.ownerId === ownerId && item.kind === kind && item.platformCode === platform).length + 1;
      const revision: ProfileRevision = {id: createUuidV7(now.getTime() + version), ownerId, kind, platformCode: platform, version, digest: sha256Digest({kind, platform, version, payload}), payload, createdAt: now.toISOString()};
      this.#profiles.push(revision);
      for (const item of profileKnowledgeItems(revision)) this.#items.push({...item, id: createUuidV7(now.getTime() + this.#items.length + 20)});
      this.#sessions.set(ownerId, {...session, rowVersion: session.rowVersion + 1, state: 'DRAFT', updatedAt: now.toISOString()});
      this.rebuildDraft(ownerId, now);
      return this.overview(ownerId, this.requireSession(ownerId));
    });
  }

  public async ingestSource(input: KnowledgeSourceInput, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.ingest(input.ownerId, input, 'UPLOADED_FILE', expectedVersion, idempotencyKey, now);
  }

  public async ingestTextSource(input: KnowledgeTextSourceInput, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.ingest(input.ownerId, input, 'OWNER_AUTHORED_TEXT', expectedVersion, idempotencyKey, now);
  }

  public async getSource(ownerId: string, documentId: string): Promise<SourceDocumentRevision | undefined> {
    const source = this.#sources.get(documentId);
    if (source === undefined) return undefined;
    if (source.ownerId !== ownerId) throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');
    return clone(source);
  }

  public async getProfileRevision(ownerId:string,revisionId:string):Promise<ProfileRevision|undefined>{const profile=this.#profiles.find((item)=>item.id===revisionId);if(profile===undefined)return undefined;if(profile.ownerId!==ownerId)throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');return clone(profile);}

  public async deleteSource(ownerId: string, documentId: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.mutate(ownerId, `DELETE:/knowledge/sources/${documentId}`, idempotencyKey, {documentId, expectedVersion}, async () => {
      const session = this.requireVersion(ownerId, expectedVersion);
      const source = this.#sources.get(documentId);
      if (source === undefined) throw new KnowledgeContractError('SOURCE_NOT_FOUND');
      if (source.ownerId !== ownerId) throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');
      this.#sources.set(documentId, {...source, status: 'DELETED', deletedAt: now.toISOString()});
      this.#sessions.set(ownerId, {...session, rowVersion: session.rowVersion + 1, state: 'DRAFT', updatedAt: now.toISOString()});
      this.rebuildDraft(ownerId, now);
      return this.overview(ownerId, this.requireSession(ownerId));
    });
  }

  public async confirmLegacySource(ownerId: string, documentId: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.mutate(ownerId, `POST:/knowledge/sources/${documentId}/confirm`, idempotencyKey, {documentId, expectedVersion}, async () => {
      const session = this.requireVersion(ownerId, expectedVersion);
      const source = this.#sources.get(documentId);
      if (source === undefined) throw new KnowledgeContractError('SOURCE_NOT_FOUND');
      if (source.ownerId !== ownerId) throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');
      if (source.status !== 'LEGACY_NEEDS_REVIEW') throw new KnowledgeContractError('SOURCE_REVIEW_NOT_REQUIRED');
      this.#sources.set(documentId, {...source, status: 'READY'});
      this.#sessions.set(ownerId, {...session, rowVersion: session.rowVersion + 1, state: 'DRAFT', updatedAt: now.toISOString()});
      this.rebuildDraft(ownerId, now);
      return this.overview(ownerId, this.requireSession(ownerId));
    });
  }

  public async resolveConflict(ownerId: string, conflictId: string, selectedItemId: string, note: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.mutate(ownerId, 'POST:/knowledge/snapshots/resolve-conflict', idempotencyKey, {conflictId, selectedItemId, note, expectedVersion}, async () => {
      const session = this.requireVersion(ownerId, expectedVersion);
      const draft = this.currentDraft(ownerId);
      const conflict = draft?.conflictDecisions.find((item) => item.id === conflictId);
      if (conflict === undefined || !conflict.itemIds.includes(selectedItemId)) throw new KnowledgeContractError('KNOWLEDGE_CONFLICT_NOT_FOUND');
      this.#resolutions.set(`${ownerId}:${conflictId}`, {selectedItemId, note: normalizedNote(note)});
      this.#sessions.set(ownerId, {...session, rowVersion: session.rowVersion + 1, state: 'DRAFT', updatedAt: now.toISOString()});
      this.rebuildDraft(ownerId, now);
      return this.overview(ownerId, this.requireSession(ownerId));
    });
  }

  public async approveSnapshot(ownerId: string, snapshotId: string, canonicalDigest: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    return this.mutate(ownerId, 'POST:/knowledge/snapshots/approve', idempotencyKey, {snapshotId, canonicalDigest, expectedVersion}, async () => {
      const session = this.requireVersion(ownerId, expectedVersion);
      const draft = this.#snapshots.find((item) => item.ownerId === ownerId && item.id === snapshotId && ['DRAFT', 'NEEDS_OWNER'].includes(item.state));
      if (draft === undefined) throw new KnowledgeContractError('SNAPSHOT_STALE');
      if (draft.canonicalDigest !== canonicalDigest) throw new KnowledgeContractError('SNAPSHOT_APPROVAL_DIGEST_MISMATCH');
      if (draft.sessionRowVersion !== expectedVersion) throw new KnowledgeContractError('SNAPSHOT_STALE');
      if (draft.gaps.length > 0) throw new KnowledgeContractError('SNAPSHOT_GAPS_UNRESOLVED');
      if (draft.conflictDecisions.some((item) => item.state !== 'RESOLVED')) throw new KnowledgeContractError('KNOWLEDGE_CONFLICT_UNRESOLVED');
      for (const source of this.activeSources(ownerId)) if (!this.#sourceBytes.has(source.blobDigest)) throw new KnowledgeContractError('SOURCE_BLOB_MISSING');
      const previous=this.#snapshots.find((snapshot)=>snapshot.ownerId===ownerId&&snapshot.state==='APPROVED');
      for (const snapshot of this.#snapshots) if (snapshot.ownerId === ownerId && snapshot.state === 'APPROVED') snapshot.state = 'SUPERSEDED';
      draft.state = 'APPROVED'; draft.approvedBy = ownerId; draft.approvedAt = now.toISOString();
      if(previous!==undefined){const eventId=`snapshot_supersession_${sha256Digest({ownerId,supersededSnapshotId:previous.id,approvedSnapshotId:draft.id}).slice(0,24)}`;if(!this.#snapshotSupersessions.some((event)=>event.eventId===eventId))this.#snapshotSupersessions.push({eventId,ownerId,supersededSnapshotId:previous.id,supersededSnapshotDigest:previous.canonicalDigest,approvedSnapshotId:draft.id,approvedSnapshotDigest:draft.canonicalDigest,createdAt:now.toISOString()});}
      this.#sessions.set(ownerId, {...session, state: 'KNOWLEDGE_APPROVED_NEEDS_GOAL', currentStep: 'REVIEW', currentSnapshotId: draft.id, currentSnapshotDigest: draft.canonicalDigest, rowVersion: session.rowVersion + 1, updatedAt: now.toISOString()});
      return this.overview(ownerId, this.requireSession(ownerId));
    });
  }

  public async getRoleContext(ownerId: string, snapshotId: string, canonicalDigest: string): Promise<KnowledgeRoleContext> {
    this.requireSession(ownerId);
    const snapshot = this.#snapshots.find((item) => item.ownerId === ownerId && item.id === snapshotId && item.state === 'APPROVED');
    if (snapshot === undefined || snapshot.canonicalDigest !== canonicalDigest) throw new KnowledgeContractError('SNAPSHOT_APPROVAL_DIGEST_MISMATCH');
    for(const binding of snapshot.sourceRevisionDigests){const source=[...this.#sources.values()].find((item)=>item.ownerId===ownerId&&item.id===binding.revisionId&&item.blobDigest===binding.digest);if(source!==undefined&&source.deletedAt!==null)throw new KnowledgeContractError('SNAPSHOT_STALE');if(source===undefined||!this.#sourceBytes.has(binding.digest))throw new KnowledgeContractError('SOURCE_BLOB_MISSING');}
    const context=this.#snapshotContexts.get(snapshotId);if(context===undefined)throw new KnowledgeContractError('SNAPSHOT_CONTEXT_BINDING_UNAVAILABLE');
    return {snapshotId, snapshotDigest: canonicalDigest, ownerId, targetMarket: context.targetMarket, contentLocale: context.contentLocale, timeZone: context.timeZone, items: snapshot.itemBindings.map(({id, kind, normalizedValue, sourceRevisionIds, profileRevisionIds, ownerAuthority}) => ({id, kind, normalizedValue, sourceRevisionIds, profileRevisionIds, ownerAuthority})), sourceDigests: snapshot.sourceRevisionDigests, profileDigests: snapshot.profileRevisionDigests};
  }

  public async listPendingSnapshotSupersessions(ownerId:string):Promise<KnowledgeSnapshotSupersession[]>{return clone(this.#snapshotSupersessions.filter((event)=>event.ownerId===ownerId&&!this.#supersessionReceipts.has(event.eventId)));}
  public async acknowledgeSnapshotSupersession(ownerId:string,eventId:string,now:Date):Promise<void>{void now;const event=this.#snapshotSupersessions.find((item)=>item.eventId===eventId);if(event===undefined)throw new KnowledgeContractError('SNAPSHOT_SUPERSESSION_NOT_FOUND');if(event.ownerId!==ownerId)throw new KnowledgeContractError('OWNER_BOUNDARY_VIOLATION');this.#supersessionReceipts.add(eventId);}

  public async close(): Promise<void> {}
  public async recordSecurityRejection(ownerId:string,eventCode:string,now:Date):Promise<void>{this.#auditEvents.push({ownerId,eventCode,at:now.toISOString()});}
  public auditEventsForTest():ReadonlyArray<{ownerId:string;eventCode:string;at:string}>{return this.#auditEvents;}
  public removeBlobForTest(digest: string): Uint8Array | undefined { const bytes=this.#sourceBytes.get(digest);this.#sourceBytes.delete(digest);return bytes; }
  public restoreBlobForTest(digest: string, bytes: Uint8Array): void { this.#sourceBytes.set(digest,bytes); }

  private async ingest(ownerId: string, input: KnowledgeSourceInput | KnowledgeTextSourceInput, sourceKind: 'UPLOADED_FILE' | 'OWNER_AUTHORED_TEXT', expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview> {
    const request = 'bytes' in input ? {label: input.label, fileName: input.fileName, declaredMediaType: input.declaredMediaType, digest: sha256Digest([...input.bytes]), candidates: input.candidates ?? [], expectedVersion} : {...input, expectedVersion};
    return this.mutate(ownerId, `POST:/knowledge/sources/${sourceKind}`, idempotencyKey, request, async () => {
      const session = this.requireVersion(ownerId, expectedVersion);
      const prepared = prepareKnowledgeSource(input, now, sourceKind);
      const documentId = createUuidV7(now.getTime() + this.#sources.size + 1);
      const revisionId = createUuidV7(now.getTime() + this.#sources.size + 101);
      const revision: SourceDocumentRevision = {...prepared, id: revisionId, documentId, version: 1, status: 'READY', deletedAt: null};
      this.#sources.set(documentId, revision); this.#sourceCandidates.set(revisionId, prepared.candidates); this.#sourceBytes.set(revision.blobDigest, 'bytes' in input ? new Uint8Array(input.bytes) : new TextEncoder().encode(input.text));
      const candidates = prepared.candidates.length > 0 ? prepared.candidates : [{kind: 'SOURCE_EXCERPT' as const, value: prepared.extractedText}];
      for (const candidate of candidates) this.#items.push({id: createUuidV7(now.getTime() + this.#items.length + 201), kind: candidate.kind, normalizedValue: candidate.value, sourceRevisionIds: [revisionId], profileRevisionIds: [], ownerAuthority: 'ORGANIZATION_APPROVED_PRIVATE', sensitivity: revision.sensitivity});
      this.#sessions.set(ownerId, {...session, rowVersion: session.rowVersion + 1, state: 'DRAFT', updatedAt: now.toISOString()});
      this.rebuildDraft(ownerId, now);
      return this.overview(ownerId, this.requireSession(ownerId));
    });
  }

  private rebuildDraft(ownerId: string, now: Date): void {
    const session = this.requireSession(ownerId);
    for (const snapshot of this.#snapshots) if (snapshot.ownerId === ownerId && ['DRAFT', 'NEEDS_OWNER'].includes(snapshot.state)) snapshot.state = 'SUPERSEDED';
    const sources = this.activeSources(ownerId);
    const profiles = this.latestProfiles(ownerId);
    const activeProfileIds = new Set([profiles.persona?.id, profiles.organization?.id, profiles.product?.id, profiles.accounts.X?.id, profiles.accounts.XIAOHONGSHU?.id].filter((id): id is string => id !== undefined));
    const activeSourceIds = new Set(sources.map((item) => item.id));
    const items = this.#items.filter((item) => item.sourceRevisionIds.some((id) => activeSourceIds.has(id)) || item.profileRevisionIds.some((id) => activeProfileIds.has(id)));
    const conflicts = buildConflicts(ownerId, items, this.#resolutions);
    const gaps: KnowledgeGapCode[] = [];
    if (profiles.persona === null) gaps.push('PERSONA_REQUIRED');
    if (profiles.organization === null) gaps.push('ORGANIZATION_REQUIRED');
    if (profiles.product === null) gaps.push('PRODUCT_REQUIRED');
    if (profiles.accounts.X === undefined) gaps.push('X_ACCOUNT_REQUIRED');
    if (profiles.accounts.XIAOHONGSHU === undefined) gaps.push('XIAOHONGSHU_ACCOUNT_REQUIRED');
    if (sources.length === 0) gaps.push('SOURCE_REQUIRED');
    if (session.targetMarket === null) gaps.push('MARKET_REQUIRED');
    if (session.contentLocale === null) gaps.push('CONTENT_LOCALE_REQUIRED');
    if (session.timeZone === null) gaps.push('TIME_ZONE_REQUIRED');
    if (sources.some((item) => item.status === 'LEGACY_NEEDS_REVIEW')) gaps.push('SOURCE_REVIEW_REQUIRED');
    if (sources.some((item) => !this.#sourceBytes.has(item.blobDigest))) gaps.push('SOURCE_BLOB_MISSING');
    const version = this.#snapshots.filter((item) => item.ownerId === ownerId).length + 1;
    const base = {id: createUuidV7(now.getTime() + version + 401), ownerId, version, sessionRowVersion: session.rowVersion, sourceRevisionDigests: sources.map((item) => ({revisionId: item.id, digest: item.blobDigest})), profileRevisionDigests: [...activeProfileIds].sort().map((revisionId) => ({revisionId, digest: this.#profiles.find((item) => item.id === revisionId)!.digest})), itemBindings: [...items].sort((a, b) => a.id.localeCompare(b.id)), conflictDecisions: conflicts, gaps};
    const snapshot: KnowledgeSnapshot = {...base, state: conflicts.some((item) => item.state === 'NEEDS_OWNER_DECISION') ? 'NEEDS_OWNER' : 'DRAFT', canonicalDigest: snapshotDigest(base), approvedBy: null, approvedAt: null, createdAt: now.toISOString()};
    this.#snapshots.push(snapshot);
    if(session.targetMarket!==null&&session.contentLocale!==null&&session.timeZone!==null)this.#snapshotContexts.set(snapshot.id,{targetMarket:session.targetMarket,contentLocale:session.contentLocale,timeZone:session.timeZone,contextDigest:sha256Digest({schemaVersion:2,snapshotId:snapshot.id,targetMarket:session.targetMarket,contentLocale:session.contentLocale,timeZone:session.timeZone})});
    const knowledgeState = conflicts.some((item) => item.state === 'NEEDS_OWNER_DECISION') ? 'NEEDS_OWNER_DECISION' : gaps.length === 0 ? 'READY_FOR_APPROVAL' : 'DRAFT';
    const authoritative=this.#snapshots.find((item)=>item.ownerId===ownerId&&item.state==='APPROVED');
    this.#sessions.set(ownerId, {...session, state: knowledgeState, currentSnapshotId: authoritative?.id??snapshot.id, currentSnapshotDigest: authoritative?.canonicalDigest??snapshot.canonicalDigest});
  }

  private activeSources(ownerId: string): SourceDocumentRevision[] { return [...this.#sources.values()].filter((item) => item.ownerId === ownerId && item.deletedAt === null).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
  private latestProfiles(ownerId: string): KnowledgeOverview['profiles'] {
    const latest = (kind: ProfileKind, platform: KnowledgePlatform | null) => this.#profiles.filter((item) => item.ownerId === ownerId && item.kind === kind && item.platformCode === platform).sort((a, b) => b.version - a.version)[0] ?? null;
    const x = latest('ACCOUNT', 'X'); const xhs = latest('ACCOUNT', 'XIAOHONGSHU');
    return {persona: latest('PERSONA', null), organization: latest('ORGANIZATION', null), product: latest('PRODUCT', null), accounts: {...(x === null ? {} : {X: x}), ...(xhs === null ? {} : {XIAOHONGSHU: xhs})}};
  }
  private currentDraft(ownerId: string): KnowledgeSnapshot | null { return [...this.#snapshots].reverse().find((item) => item.ownerId === ownerId && ['DRAFT', 'NEEDS_OWNER'].includes(item.state)) ?? null; }
  private overview(ownerId: string, session: KnowledgeOnboardingSession): KnowledgeOverview { return {session, sources: this.activeSources(ownerId), profiles: this.latestProfiles(ownerId), draft: this.currentDraft(ownerId), approvedHistory: this.#snapshots.filter((item) => item.ownerId === ownerId && ['APPROVED', 'SUPERSEDED'].includes(item.state) && item.approvedAt !== null).sort((a, b) => b.version - a.version)}; }
  private requireSession(ownerId: string): KnowledgeOnboardingSession { const session = this.#sessions.get(ownerId); if (session === undefined) throw new KnowledgeContractError('LOCAL_PROFILE_NOT_FOUND'); return session; }
  private requireVersion(ownerId: string, expectedVersion: number): KnowledgeOnboardingSession { const session = this.requireSession(ownerId); if (session.rowVersion !== expectedVersion) throw new KnowledgeContractError('SNAPSHOT_STALE'); return session; }
  private async mutate(ownerId: string, route: string, key: string, request: unknown, operation: () => Promise<KnowledgeOverview>): Promise<KnowledgeOverview> {
    if (key.length < 8 || key.length > 128) throw new KnowledgeContractError('IDEMPOTENCY_KEY_REQUIRED');
    const recordKey = `${ownerId}:${route}:${key}`; const requestDigest = sha256Digest(request); const existing = this.#idempotency.get(recordKey);
    if (existing !== undefined) { if (existing.requestDigest !== requestDigest) throw new KnowledgeContractError('IDEMPOTENCY_KEY_REUSED'); return clone(existing.response); }
    const response = await operation(); this.#idempotency.set(recordKey, {requestDigest, response: clone(response)}); return clone(response);
  }
}

function buildConflicts(ownerId: string, items: KnowledgeItem[], resolutions: Map<string, {selectedItemId: string; note: string}>): KnowledgeConflict[] {
  const groups = new Map<string, KnowledgeItem[]>();
  for (const item of items) { if (!['ORGANIZATION_FACT', 'PRODUCT_FACT', 'CLAIM'].includes(item.kind)) continue; const slot=conflictSlot(item.normalizedValue); if(slot===null)continue; const key=`${item.kind}:${slot}`; const group = groups.get(key) ?? []; group.push(item); groups.set(key, group); }
  const conflicts: KnowledgeConflict[] = [];
  for (const [kind, candidates] of groups) {
    const unique = new Map<string, KnowledgeItem>();
    for (const item of orderKnowledgeItemsForOwnerDecision(candidates)) { const value=item.normalizedValue.toLocaleLowerCase('en-US'); if(!unique.has(value))unique.set(value,item); }
    if (unique.size < 2) continue;
    const itemIds = orderKnowledgeItemsForOwnerDecision([...unique.values()]).map((item) => item.id); const id = sha256Digest({kind, itemIds}); const resolution = resolutions.get(`${ownerId}:${id}`);
    conflicts.push({id, itemIds, reasonCode: 'INCOMPATIBLE_VALUES', ownerResolution: resolution ?? null, state: resolution === undefined ? 'NEEDS_OWNER_DECISION' : 'RESOLVED'});
  }
  return conflicts;
}
function normalizedNote(value: string): string { const note = value.normalize('NFC').trim(); if (note.length < 1 || note.length > 1000) throw new KnowledgeContractError('CONFLICT_RESOLUTION_NOTE_INVALID'); return note; }
function conflictSlot(value:string):string|null{const match=/^([^:=\n]{1,80})\s*[:=]\s*(.+)$/u.exec(value);return match===null?null:match[1]!.normalize('NFC').trim().toLocaleLowerCase('en-US');}
function clone<T>(value: T): T { return structuredClone(value); }
