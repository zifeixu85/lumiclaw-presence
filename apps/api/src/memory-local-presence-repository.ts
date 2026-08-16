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

export class MemoryLocalPresenceRepository implements LocalPresenceRepository {
  #profile: LocalOwnerProfile | undefined;
  #session: LocalOnboardingSession | undefined;
  readonly #materials = new Map<string, LocalMaterialManifest>();
  readonly #bytes = new Map<string, Uint8Array>();
  readonly #handoffs: ManualPublishHandoff[] = [];

  public async health(): Promise<boolean> { return true; }
  public async getProfile(): Promise<LocalOwnerProfile | undefined> { return clone(this.#profile); }

  public async createProfile(displayName: string, now: Date): Promise<LocalOwnerProfile> {
    const normalized = normalizeLocalDisplayName(displayName);
    if (this.#profile !== undefined) {
      if (this.#profile.displayName !== normalized) throw new LocalPresenceContractError('LOCAL_PROFILE_ALREADY_EXISTS');
      return clone(this.#profile)!;
    }
    const timestamp = now.toISOString();
    this.#profile = {schemaVersion: 1, id: createUuidV7(now.getTime()), displayName: normalized, state: 'PROFILE_READY', createdAt: timestamp, updatedAt: timestamp};
    this.#session = {schemaVersion: 1, ownerProfileId: this.#profile.id, path: 'UNSELECTED', state: 'MATERIAL_CHOICE', dataMode: 'LOCAL_PRIVATE', organizationId: null, campaignId: null, marketCodes: [], contentLocales: [], platforms: [], defaultTimeZone: null, materialIds: [], createdAt: timestamp, updatedAt: timestamp};
    return clone(this.#profile)!;
  }

  public async getSession(ownerProfileId: string): Promise<LocalOnboardingSession | undefined> {
    return this.#session?.ownerProfileId === ownerProfileId ? clone(this.#session) : undefined;
  }

  public async chooseExample(ownerProfileId: string, organizationId: string, campaignId: string, context: LocalOnboardingContext, now: Date): Promise<LocalOnboardingSession> {
    const session = this.requireMutableSession(ownerProfileId);
    this.#session = {...session, path: 'PUBLIC_SAFE_EXAMPLE', state: 'COMPLETED', dataMode: 'PUBLIC_SAFE_EXAMPLE', organizationId, campaignId, ...context, materialIds: [], updatedAt: now.toISOString()};
    this.completeProfile(now);
    return clone(this.#session)!;
  }

  public async selectLocalMaterials(ownerProfileId: string, now: Date): Promise<LocalOnboardingSession> {
    const session = this.requireMutableSession(ownerProfileId);
    this.#session = {...session, path: 'LOCAL_MATERIALS', state: 'MATERIAL_CHOICE', dataMode: 'LOCAL_PRIVATE', updatedAt: now.toISOString()};
    return clone(this.#session)!;
  }

  public async setContext(ownerProfileId: string, context: LocalOnboardingContext, now: Date): Promise<LocalOnboardingSession> {
    const session = this.requireMutableSession(ownerProfileId);
    if (session.path !== 'LOCAL_MATERIALS') throw new LocalPresenceContractError('LOCAL_MATERIAL_PATH_REQUIRED');
    if (this.readyMaterials(ownerProfileId).length < 1) throw new LocalPresenceContractError('LOCAL_MATERIAL_REQUIRED');
    this.#session = {...session, ...context, state: 'CONTEXT_READY', updatedAt: now.toISOString()};
    return clone(this.#session)!;
  }

  public async completeLocalOnboarding(ownerProfileId: string, organizationId: string, campaignId: string, now: Date): Promise<LocalOnboardingSession> {
    const session = this.requireMutableSession(ownerProfileId);
    if (session.path !== 'LOCAL_MATERIALS' || session.state !== 'CONTEXT_READY' || this.readyMaterials(ownerProfileId).length < 1) throw new LocalPresenceContractError('LOCAL_ONBOARDING_NOT_READY');
    this.#session = {...session, organizationId, campaignId, state: 'COMPLETED', updatedAt: now.toISOString()};
    this.completeProfile(now);
    return clone(this.#session)!;
  }

  public async ingestMaterial(input: MaterialIngestInput, now: Date): Promise<LocalMaterialManifest> {
    const session = this.requireMutableSession(input.ownerProfileId);
    if (session.path !== 'LOCAL_MATERIALS') throw new LocalPresenceContractError('LOCAL_MATERIAL_PATH_REQUIRED');
    const prepared = prepareLocalMaterial(input, now);
    const duplicate = [...this.#materials.values()].find((item) => item.ownerProfileId === input.ownerProfileId && item.digest === prepared.digest);
    if (duplicate !== undefined) return clone(duplicate)!;
    const manifest: LocalMaterialManifest = {...prepared, blobRef: {algorithm: 'sha256', digest: prepared.digest, size: prepared.byteSize}};
    this.#materials.set(manifest.id, manifest);
    this.#bytes.set(manifest.digest, new Uint8Array(input.bytes));
    this.#session = {...session, state: 'MATERIALS_READY', materialIds: [...session.materialIds, manifest.id], updatedAt: now.toISOString()};
    return clone(manifest)!;
  }

  public async listMaterials(ownerProfileId: string): Promise<LocalMaterialManifest[]> { return clone(this.readyMaterials(ownerProfileId))!; }

  public async deleteMaterial(ownerProfileId: string, materialId: string): Promise<boolean> {
    const material = this.#materials.get(materialId);
    if (material === undefined || material.ownerProfileId !== ownerProfileId) return false;
    const session = this.requireSession(ownerProfileId);
    if (session.state === 'COMPLETED') throw new LocalPresenceContractError('LOCAL_MATERIAL_BOUND_TO_CAMPAIGN');
    this.#materials.delete(materialId);
    if (![...this.#materials.values()].some((item) => item.digest === material.digest)) this.#bytes.delete(material.digest);
    const materialIds = session.materialIds.filter((id) => id !== materialId);
    this.#session = {...session, materialIds, state: materialIds.length > 0 ? 'MATERIALS_READY' : 'MATERIAL_CHOICE'};
    return true;
  }

  public async recordManualHandoff(input: Omit<ManualPublishHandoff, 'schemaVersion' | 'id' | 'state' | 'evidenceReceiptId' | 'createdAt'>, now: Date): Promise<ManualPublishHandoff> {
    void now;
    this.requireSession(input.ownerProfileId);
    throw new LocalPresenceContractError('MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED');
  }

  public async listManualHandoffs(ownerProfileId: string): Promise<ManualPublishHandoff[]> { return clone(this.#handoffs.filter((item) => item.ownerProfileId === ownerProfileId))!; }
  public async close(): Promise<void> {}

  private requireSession(ownerProfileId: string): LocalOnboardingSession {
    if (this.#session?.ownerProfileId !== ownerProfileId) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
    return this.#session;
  }

  private requireMutableSession(ownerProfileId: string): LocalOnboardingSession {
    const session = this.requireSession(ownerProfileId);
    if (session.state === 'COMPLETED') throw new LocalPresenceContractError('LOCAL_ONBOARDING_ALREADY_COMPLETED');
    return session;
  }

  private readyMaterials(ownerProfileId: string): LocalMaterialManifest[] { return [...this.#materials.values()].filter((item) => item.ownerProfileId === ownerProfileId && item.state === 'READY'); }
  private completeProfile(now: Date): void {
    if (this.#profile === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
    this.#profile = {...this.#profile, state: 'ONBOARDING_COMPLETE', updatedAt: now.toISOString()};
  }
}

function clone<T>(value: T): T { return value === undefined ? value : structuredClone(value); }
