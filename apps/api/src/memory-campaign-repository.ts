import {
  advanceCampaignEnvelope,
  createCampaignEnvelope,
  validateCampaignDocument,
  type CampaignDocument,
  type CampaignEnvelope,
  type CampaignRepository,
  type CampaignSummary,
  type MutationResult
} from '@lumiclaw/domain';

type IdempotencyEntry = {requestDigest: string; envelope: CampaignEnvelope};

export class MemoryCampaignRepository implements CampaignRepository {
  readonly #campaigns = new Map<string, CampaignEnvelope>();
  readonly #idempotency = new Map<string, IdempotencyEntry>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async health(): Promise<boolean> { return true; }

  async list(organizationId: string): Promise<CampaignSummary[]> {
    return [...this.#campaigns.values()].filter((item) => item.document.organizationId === organizationId).map((item) => currentReadiness(item, this.now())).map((item) => ({id: item.document.id, organizationId, name: item.document.brief.name, version: item.version, digest: item.digest, readiness: item.readiness, gapCodes: item.gapCodes, updatedAt: item.updatedAt, mode: 'DEMO_SEED', live: false}));
  }

  async get(organizationId: string, campaignId: string): Promise<CampaignEnvelope | undefined> {
    const envelope = this.#campaigns.get(campaignId);
    return envelope?.document.organizationId === organizationId ? currentReadiness(structuredClone(envelope), this.now()) : undefined;
  }

  async getMissionContract(organizationId: string, campaignId: string) {
    const envelope = await this.get(organizationId, campaignId);
    return envelope === undefined ? undefined : {contract: envelope.document.missionContract, digest: envelope.digest, version: envelope.version, readiness: envelope.readiness, gapCodes: envelope.gapCodes};
  }

  async create(organizationId: string, document: CampaignDocument, key: string, requestDigest: string, now = new Date()): Promise<MutationResult> {
    const idempotency = this.#idempotency.get(`POST:${organizationId}:${key}`);
    if (idempotency !== undefined) return idempotency.requestDigest === requestDigest ? {ok: true, envelope: structuredClone(idempotency.envelope), replayed: true} : {ok: false, code: 'IDEMPOTENCY_KEY_REUSED'};
    if (document.organizationId !== organizationId) return {ok: false, code: 'CAMPAIGN_NOT_FOUND'};
    const envelope = createCampaignEnvelope(document, now);
    this.#campaigns.set(document.id, structuredClone(envelope));
    this.#idempotency.set(`POST:${organizationId}:${key}`, {requestDigest, envelope: structuredClone(envelope)});
    return {ok: true, envelope, replayed: false};
  }

  async update(organizationId: string, campaignId: string, document: CampaignDocument, expectedEtag: string, key: string, requestDigest: string, now = new Date()): Promise<MutationResult> {
    const idempotencyKey = `PUT:${organizationId}:${campaignId}:${key}`;
    const idempotency = this.#idempotency.get(idempotencyKey);
    if (idempotency !== undefined) return idempotency.requestDigest === requestDigest ? {ok: true, envelope: structuredClone(idempotency.envelope), replayed: true} : {ok: false, code: 'IDEMPOTENCY_KEY_REUSED'};
    const current = await this.get(organizationId, campaignId);
    if (current === undefined) return {ok: false, code: 'CAMPAIGN_NOT_FOUND'};
    if (current.etag !== expectedEtag) return {ok: false, code: 'CAMPAIGN_VERSION_CONFLICT', current};
    const envelope = advanceCampaignEnvelope(current, document, now);
    this.#campaigns.set(campaignId, structuredClone(envelope));
    this.#idempotency.set(idempotencyKey, {requestDigest, envelope: structuredClone(envelope)});
    return {ok: true, envelope, replayed: false};
  }

  async close(): Promise<void> {}
}

function currentReadiness(envelope: CampaignEnvelope, now: Date): CampaignEnvelope {
  const validation = validateCampaignDocument(envelope.document, now);
  const temporalCodes = new Set(['CLAIM_EXPIRED', 'CAPABILITY_EXPIRED', 'GRAPH_MANDATE_EXPIRED']);
  const temporalIssues = validation.ok ? [] : validation.issues.filter((item) => temporalCodes.has(item.code));
  if (!validation.ok && validation.issues.some((item) => !temporalCodes.has(item.code))) throw new Error('PERSISTED_CAMPAIGN_INTEGRITY_FAILED');
  return temporalIssues.length === 0 ? envelope : {...envelope, readiness: 'BLOCKED', gapCodes: [...new Set(temporalIssues.map((item) => item.code))]};
}
