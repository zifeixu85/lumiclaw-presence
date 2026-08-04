import {
  CampaignPreparationError,
  createPublishingSchedule,
  createDemoCampaignDocument,
  isUuidV7,
  ScheduleContractError,
  sha256Digest,
  type CampaignDocument,
  type CampaignRepository,
  type MutationResult
} from '@lumiclaw/domain';
import {
  acceptRuntimeSubmission,
  acknowledgeRuntimeTask,
  attachProviderEvidence,
  materializeAcceptedRuntimeMission,
  MemoryShadowMissionRepository,
  PostgresShadowMissionRepository,
  PublicSafeMockMediaProvider,
  PublicSafeMockModelProvider,
  ShadowContractError,
  missionPublicEvidence,
  recordRuntimeProjectDispatch,
  reviewRevision,
  runPublicSafeFlight,
  type OwnerReview,
  type RuntimeProjectDispatchReceipt,
  type RuntimeSubmission,
  type RuntimeTaskAckReceipt,
  type ShadowMissionRepository
} from '@lumiclaw/governed-shadow';
import {PostgresCampaignRepository} from '@lumiclaw/db';
import Fastify, {type FastifyInstance, type FastifyReply, type FastifyRequest} from 'fastify';
import {MemoryCampaignRepository} from './memory-campaign-repository.js';
import {openApiDocument} from './openapi.js';

type BuildOptions = {repository?: CampaignRepository; shadowRepository?: ShadowMissionRepository; now?: () => Date};
type CampaignParams = {campaignId: string};
type MissionParams = {missionId: string};
type RuntimeEventBody =
  | {kind: 'PROJECT_DISPATCHED'; receipt: RuntimeProjectDispatchReceipt}
  | {kind: 'TASK_ACK'; receipt: RuntimeTaskAckReceipt}
  | {kind: 'TASK_SUBMIT'; submission: RuntimeSubmission}
  | {kind: 'FINALIZE_ACCEPTED_OUTPUTS'};
type SchedulePreviewBody = {localStart: string; timeZone: string; rrule?: string | null; foldPreference: 'EARLIER' | 'LATER'; misfirePolicy: 'SKIP' | 'HOLD_FOR_OWNER'};

export function buildApi(options: BuildOptions = {}): FastifyInstance {
  const app = Fastify({logger: false});
  const now = options.now ?? (() => new Date());
  const repository = options.repository ?? new MemoryCampaignRepository(now);
  const shadowRepository = options.shadowRepository ?? new MemoryShadowMissionRepository();
  app.addHook('onClose', async () => { await repository.close(); await shadowRepository.close(); });

  app.get('/health', async (_request, reply) => {
    try {
      if (!await repository.health()) throw new Error('database marker missing');
      if (!await shadowRepository.health()) throw new Error('shadow database marker missing');
      return {service: 'api', status: 'ok', mode: 'DEMO_SEED', live: false, controlPlane: 'POSTGRESQL'};
    } catch {
      return reply.status(503).send({service: 'api', status: 'unavailable', code: 'CONTROL_PLANE_UNAVAILABLE', mode: 'DEMO_SEED', live: false});
    }
  });

  app.get('/api/v1/openapi.json', async () => openApiDocument);
  app.get('/api/v1/campaigns/demo-template', async () => ({code: 'DEMO_TEMPLATE_READY', mode: 'DEMO_SEED', live: false, document: createDemoCampaignDocument()}));

  app.get('/api/v1/campaigns', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    if (organizationId === undefined) return;
    return {code: 'CAMPAIGN_LIST', mode: 'DEMO_SEED', live: false, campaigns: await repository.list(organizationId)};
  });

  app.post('/api/v1/campaigns', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    const idempotencyKey = requireIdempotency(request, reply);
    if (organizationId === undefined || idempotencyKey === undefined) return;
    const document = request.body as CampaignDocument;
    if (document?.organizationId !== organizationId) return reply.status(403).send(errorBody('ORGANIZATION_SCOPE_MISMATCH'));
    try {
      const result = await repository.create(organizationId, document, idempotencyKey, sha256Digest(document), now());
      return sendMutation(reply, result, 201);
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.get<{Params: CampaignParams}>('/api/v1/campaigns/:campaignId', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    if (organizationId === undefined) return;
    const envelope = await repository.get(organizationId, request.params.campaignId);
    if (envelope === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    void reply.header('ETag', envelope.etag);
    return {code: 'CAMPAIGN_REOPENED', ...envelope};
  });

  app.put<{Params: CampaignParams}>('/api/v1/campaigns/:campaignId', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    const idempotencyKey = requireIdempotency(request, reply);
    const ifMatch = request.headers['if-match'];
    if (organizationId === undefined || idempotencyKey === undefined) return;
    if (typeof ifMatch !== 'string' || ifMatch.length === 0) return reply.status(428).send(errorBody('ETAG_REQUIRED'));
    const document = request.body as CampaignDocument;
    if (document?.organizationId !== organizationId || document.id !== request.params.campaignId) return reply.status(403).send(errorBody('ORGANIZATION_SCOPE_MISMATCH'));
    try {
      const result = await repository.update(organizationId, request.params.campaignId, document, ifMatch, idempotencyKey, sha256Digest(document), now());
      return sendMutation(reply, result, 200);
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.get<{Params: CampaignParams}>('/api/v1/campaigns/:campaignId/mission-contract', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    if (organizationId === undefined) return;
    const value = await repository.getMissionContract(organizationId, request.params.campaignId);
    if (value === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    if (value.readiness === 'BLOCKED') return reply.status(409).send({...errorBody('CAMPAIGN_BLOCKED'), digest: value.digest, version: value.version, gapCodes: value.gapCodes});
    return {code: 'MISSION_CONTRACT_READY', mode: 'DEMO_SEED', live: false, ...value};
  });

  app.post<{Params: CampaignParams; Body: SchedulePreviewBody}>('/api/v1/campaigns/:campaignId/schedule-preview', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    if (organizationId === undefined) return;
    const envelope = await repository.get(organizationId, request.params.campaignId);
    if (envelope === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    try {
      const input = parseSchedulePreviewBody(request.body);
      const value = createPublishingSchedule({...input, organizationId, campaignId: request.params.campaignId, artifactRevisions: envelope.document.artifactRevisions}, now());
      return {code: 'SCHEDULE_PREVIEW_READY', mode: 'DEMO_SEED', live: false, executionAllowed: false, ...value};
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.get<{Params: CampaignParams}>('/api/v1/campaigns/:campaignId/shadow-missions', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const campaign = await repository.get(organizationId, request.params.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    const missions = await shadowRepository.getByCampaign(organizationId, request.params.campaignId);
    return {code: 'SHADOW_MISSION_LIST', mode: 'DEMO_SEED', live: false, externalActionAllowed: false, missions};
  });

  app.post<{Params: CampaignParams; Body: {sourceDigest: string; fault: 'BETA_TO_GA'}}>('/api/v1/campaigns/:campaignId/shadow-missions', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); const idempotencyKey = requireIdempotency(request, reply); const ifMatch = request.headers['if-match'];
    if (organizationId === undefined || idempotencyKey === undefined) return;
    if (typeof ifMatch !== 'string' || ifMatch.length === 0) return reply.status(428).send(errorBody('ETAG_REQUIRED'));
    const campaign = await repository.get(organizationId, request.params.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    if (campaign.etag !== ifMatch) return reply.status(412).header('ETag', campaign.etag).send(errorBody('CAMPAIGN_VERSION_CONFLICT'));
    if (!isStartMissionBody(request.body)) return reply.status(422).send(errorBody('SHADOW_START_SCHEMA_INVALID'));
    if (request.body.sourceDigest !== campaign.digest) return reply.status(409).send(errorBody('MISSION_SOURCE_DIGEST_MISMATCH'));
    try {
      const result = await shadowRepository.create({campaign: campaign.document, campaignVersion: campaign.version, campaignDigest: campaign.digest, now: now()}, idempotencyKey, sha256Digest(request.body));
      return reply.status(result.replayed ? 200 : 201).header('ETag', result.mission.etag).header('Idempotency-Replayed', String(result.replayed)).header('Location', `/api/v1/shadow-missions/${result.mission.id}`).send({code: result.replayed ? 'SHADOW_MISSION_REPLAYED' : 'SHADOW_MISSION_QUEUED', maturity: 'CONTROL_PLANE', mission: result.mission});
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.get<{Params: MissionParams}>('/api/v1/shadow-missions/:missionId', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    return reply.header('ETag', mission.etag).send({code: 'SHADOW_MISSION_REOPENED', mission});
  });

  app.post<{Params: MissionParams; Body: RuntimeEventBody}>('/api/v1/shadow-missions/:missionId/runtime-events', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); const idempotencyKey = requireIdempotency(request, reply);
    if (organizationId === undefined || idempotencyKey === undefined) return;
    if (!isRuntimeEventBody(request.body)) return reply.status(422).send(errorBody('RUNTIME_EVENT_SCHEMA_INVALID'));
    const route = `/api/v1/shadow-missions/${request.params.missionId}/runtime-events`; const requestDigest = sha256Digest(request.body);
    try {
      const replay = await shadowRepository.getIdempotentReplay(organizationId, route, idempotencyKey, requestDigest);
      if (replay !== undefined) {
        const quarantined = replay.trace.at(-1)?.kind === 'QUARANTINE';
        return reply.status(quarantined ? 422 : 200).header('ETag', replay.etag).header('Idempotency-Replayed', 'true').send({code: quarantined ? 'RUNTIME_SUBMISSION_QUARANTINED_REPLAYED' : 'RUNTIME_EVENT_REPLAYED', accepted: !quarantined, maturity: 'CONTROL_PLANE_RUNTIME_IMPORT', realAgentTeamsClaim: false, mission: replay});
      }
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    const ifMatch = request.headers['if-match']; if (typeof ifMatch !== 'string') return reply.status(428).send(errorBody('ETAG_REQUIRED')); if (ifMatch !== mission.etag) return reply.status(412).header('ETag', mission.etag).send(errorBody('MISSION_VERSION_CONFLICT'));
    try {
      let next; let accepted = true;
      if (request.body.kind === 'PROJECT_DISPATCHED') next = recordRuntimeProjectDispatch(mission, request.body.receipt, now());
      else if (request.body.kind === 'TASK_ACK') next = acknowledgeRuntimeTask(mission, request.body.receipt, now());
      else if (request.body.kind === 'TASK_SUBMIT') { next = acceptRuntimeSubmission(mission, request.body.submission, now()); accepted = next.trace.at(-1)?.kind !== 'QUARANTINE'; }
      else {
        const campaign = await repository.get(organizationId, mission.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
        next = materializeAcceptedRuntimeMission(mission, campaign.document, now());
      }
      const result = await shadowRepository.replaceIdempotent(next, mission.etag, route, idempotencyKey, requestDigest);
      return reply.status(accepted ? 200 : 422).header('ETag', result.mission.etag).header('Idempotency-Replayed', String(result.replayed)).send({code: accepted ? 'RUNTIME_EVENT_ACCEPTED' : 'RUNTIME_SUBMISSION_QUARANTINED', accepted, maturity: 'CONTROL_PLANE_RUNTIME_IMPORT', realAgentTeamsClaim: false, mission: result.mission});
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.post<{Params: MissionParams}>('/api/v1/shadow-missions/:missionId/public-safe-flight', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); const idempotencyKey = requireIdempotency(request, reply); if (organizationId === undefined || idempotencyKey === undefined) return;
    const route = `/api/v1/shadow-missions/${request.params.missionId}/public-safe-flight`; const requestDigest = sha256Digest({operation: 'PUBLIC_SAFE_FLIGHT', missionId: request.params.missionId});
    try {
      const replay = await shadowRepository.getIdempotentReplay(organizationId, route, idempotencyKey, requestDigest);
      if (replay !== undefined) return reply.header('ETag', replay.etag).header('Idempotency-Replayed', 'true').send({code: 'PUBLIC_SAFE_FLIGHT_REPLAYED', maturity: 'MOCK_CONFORMANCE', realAgentTeamsClaim: false, mission: replay});
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    const ifMatch = request.headers['if-match']; if (typeof ifMatch !== 'string') return reply.status(428).send(errorBody('ETAG_REQUIRED')); if (ifMatch !== mission.etag) return reply.status(412).header('ETag', mission.etag).send(errorBody('MISSION_VERSION_CONFLICT'));
    const campaign = await repository.get(organizationId, mission.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    try {
      const flightAt = now(); let next = runPublicSafeFlight(mission, campaign.document, flightAt);
      const producerTask = next.tasks.find((item) => item.roleId === 'founder-identity-producer')!;
      const modelResult = await new PublicSafeMockModelProvider({copy: 'Public-safe SHADOW fixture; not a real model result.'}, () => new Date(flightAt.getTime() + 4_000)).generateStructured<{copy: string}>({missionId: next.id, taskId: producerTask.id, model: 'deepseek-v4-flash', system: 'Return only the requested public-safe fixture schema. Never perform external actions.', input: {sourceCampaignDigest: next.sourceCampaignDigest}, outputSchema: {type: 'object', additionalProperties: false, required: ['copy'], properties: {copy: {type: 'string'}}}, temperature: 0, maxTokens: 200, timeoutMs: 1_000, maxAttempts: 1});
      if (!modelResult.ok) throw new ShadowContractError('MOCK_MODEL_CONFORMANCE_FAILED', modelResult.snapshot.error?.code ?? 'unknown');
      const media = await new PublicSafeMockMediaProvider(() => new Date(flightAt.getTime() + 4_500)).generate({organizationId, missionId: next.id, prompt: 'Governed SHADOW campaign evidence card', rightsConfirmedSynthetic: true});
      next = attachProviderEvidence(next, {modelCall: modelResult.snapshot, mediaAsset: media.asset}, new Date(flightAt.getTime() + 5_000));
      const result = await shadowRepository.replaceIdempotent(next, mission.etag, route, idempotencyKey, requestDigest);
      return reply.header('ETag', result.mission.etag).header('Idempotency-Replayed', String(result.replayed)).send({code: result.replayed ? 'PUBLIC_SAFE_FLIGHT_REPLAYED' : 'PUBLIC_SAFE_FLIGHT_COMPLETE', maturity: 'MOCK_CONFORMANCE', realAgentTeamsClaim: false, mission: result.mission});
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.post<{Params: MissionParams; Body: {revisionId: string; revisionDigest: string; decision: OwnerReview['decision']}}>('/api/v1/shadow-missions/:missionId/owner-reviews', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); const idempotencyKey = requireIdempotency(request, reply); if (organizationId === undefined || idempotencyKey === undefined) return;
    if (!isOwnerReviewBody(request.body)) return reply.status(422).send(errorBody('OWNER_REVIEW_SCHEMA_INVALID'));
    const route = `/api/v1/shadow-missions/${request.params.missionId}/owner-reviews`; const requestDigest = sha256Digest(request.body);
    try {
      const replay = await shadowRepository.getIdempotentReplay(organizationId, route, idempotencyKey, requestDigest);
      if (replay !== undefined) return reply.header('ETag', replay.etag).header('Idempotency-Replayed', 'true').send({code: 'NON_EXECUTABLE_OWNER_REVIEW_REPLAYED', createsActionGrant: false, externalActionAllowed: false, mission: replay});
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    const ifMatch = request.headers['if-match']; if (typeof ifMatch !== 'string') return reply.status(428).send(errorBody('ETAG_REQUIRED')); if (ifMatch !== mission.etag) return reply.status(412).header('ETag', mission.etag).send(errorBody('MISSION_VERSION_CONFLICT'));
    const campaign = await repository.get(organizationId, mission.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    try { const next = reviewRevision(mission, campaign.document, request.body.revisionId, request.body.revisionDigest, request.body.decision, now()); const result = await shadowRepository.replaceIdempotent(next, mission.etag, route, idempotencyKey, requestDigest); return reply.header('ETag', result.mission.etag).header('Idempotency-Replayed', String(result.replayed)).send({code: result.replayed ? 'NON_EXECUTABLE_OWNER_REVIEW_REPLAYED' : 'NON_EXECUTABLE_OWNER_REVIEW_RECORDED', createsActionGrant: false, externalActionAllowed: false, mission: result.mission}); } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.get<{Params: MissionParams}>('/api/v1/shadow-missions/:missionId/evidence', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    return {code: 'PUBLIC_SAFE_MISSION_EVIDENCE', evidence: missionPublicEvidence(mission)};
  });

  app.setNotFoundHandler(async (_request, reply) => reply.status(404).send({code: 'CONTROL_ROUTE_NOT_FOUND', mode: 'DEMO_SEED', live: false}));
  app.setErrorHandler(async (error, _request, reply) => sendDomainOrUnavailable(reply, error));
  return app;
}

function requireOrganization(request: FastifyRequest, reply: FastifyReply): string | undefined {
  const value = request.headers['x-lumiclaw-organization-id'];
  if (typeof value !== 'string' || !isUuidV7(value)) { void reply.status(428).send(errorBody('ORGANIZATION_SCOPE_REQUIRED')); return undefined; }
  return value;
}

function isRuntimeEventBody(value: unknown): value is RuntimeEventBody {
  if (value === null || typeof value !== 'object' || !('kind' in value)) return false;
  const event = value as Record<string, unknown>;
  if (event.kind === 'PROJECT_DISPATCHED') {
    if (!isRecord(event.receipt)) return false; const receipt = event.receipt;
    return receipt.schemaVersion === 1 && typeof receipt.projectId === 'string' && receipt.runtimeVersion === 'v1.2.0' && isSha256Build(receipt.buildDigest) && isDigest(receipt.memberSetDigest) && isDigest(receipt.dagDigest) && typeof receipt.dispatchedAt === 'string' && isDigest(receipt.receiptDigest) && Array.isArray(receipt.memberBindings) && receipt.memberBindings.length === 6 && receipt.memberBindings.every((binding) => isRecord(binding) && isRoleId(binding.roleId) && typeof binding.roleIdentityId === 'string' && typeof binding.runtimeActorId === 'string');
  }
  if (event.kind === 'TASK_ACK') {
    if (!isRecord(event.receipt)) return false; const receipt = event.receipt;
    return receipt.schemaVersion === 1 && typeof receipt.projectId === 'string' && typeof receipt.taskId === 'string' && isRoleId(receipt.roleId) && typeof receipt.runtimeActorId === 'string' && Number.isInteger(receipt.attempt) && Number(receipt.attempt) >= 1 && receipt.runtimeState === 'in_progress' && typeof receipt.acknowledgedAt === 'string' && isDigest(receipt.receiptDigest);
  }
  if (event.kind === 'TASK_SUBMIT') {
    if (!isRecord(event.submission)) return false; const submission = event.submission;
    if (!isRecord(submission.runtimeReceipt)) return false; const receipt = submission.runtimeReceipt;
    return submission.schemaVersion === 1 && typeof submission.missionId === 'string' && typeof submission.taskId === 'string' && isRoleId(submission.roleId) && typeof submission.roleIdentityId === 'string' && isDigest(submission.inputDigest) && isDigest(submission.skillLockDigest) && typeof submission.outputSchema === 'string' && submission.outputSchemaVersion === 1 && 'payload' in submission && isDigest(submission.outputDigest) && ['MOCK_CONFORMANCE', 'CANARY'].includes(String(submission.runtimeResultMaturity)) && receipt.schemaVersion === 1 && typeof receipt.projectId === 'string' && typeof receipt.taskId === 'string' && isRoleId(receipt.roleId) && typeof receipt.runtimeActorId === 'string' && Number.isInteger(receipt.attempt) && Number(receipt.attempt) >= 1 && isDigest(receipt.ackReceiptDigest) && receipt.runtimeState === 'submitted' && typeof receipt.submittedAt === 'string' && isDigest(receipt.resultDigest) && isDigest(receipt.receiptDigest);
  }
  return event.kind === 'FINALIZE_ACCEPTED_OUTPUTS';
}

const runtimeRoleIds = new Set(['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor']);
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isRoleId(value: unknown): boolean { return typeof value === 'string' && runtimeRoleIds.has(value); }
function isDigest(value: unknown): boolean { return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value); }
function isSha256Build(value: unknown): boolean { return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value); }

function requireIdempotency(request: FastifyRequest, reply: FastifyReply): string | undefined {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) { void reply.status(428).send(errorBody('IDEMPOTENCY_KEY_REQUIRED')); return undefined; }
  return value;
}

function sendMutation(reply: FastifyReply, result: MutationResult, status: 200 | 201) {
  if (!result.ok) {
    if (result.code === 'CAMPAIGN_NOT_FOUND') return reply.status(404).send(errorBody(result.code));
    if (result.code === 'IDEMPOTENCY_KEY_REUSED') return reply.status(409).send(errorBody(result.code));
    void reply.header('ETag', result.current?.etag ?? '');
    return reply.status(412).send({...errorBody(result.code), current: result.current === undefined ? undefined : {version: result.current.version, digest: result.current.digest, etag: result.current.etag}});
  }
  void reply.header('ETag', result.envelope.etag).header('Idempotency-Replayed', String(result.replayed));
  if (status === 201) void reply.header('Location', `/api/v1/campaigns/${result.envelope.document.id}`);
  return reply.status(result.replayed && status === 201 ? 200 : status).send({code: result.replayed ? 'CAMPAIGN_MUTATION_REPLAYED' : status === 201 ? 'CAMPAIGN_CREATED' : 'CAMPAIGN_SAVED', ...result.envelope});
}

function sendDomainOrUnavailable(reply: FastifyReply, error: unknown) {
  if (error instanceof CampaignPreparationError) return reply.status(422).send({...errorBody(error.code), details: error.details});
  if (error instanceof ScheduleContractError) return reply.status(422).send({...errorBody(error.code), details: error.message});
  if (error instanceof ShadowContractError) return reply.status(['IDEMPOTENCY_KEY_REUSED', 'MISSION_VERSION_CONFLICT', 'MISSION_STATE_CONFLICT', 'OWNER_REVIEW_DUPLICATE', 'RUNTIME_PROJECT_ALREADY_DISPATCHED'].includes(error.code) ? 409 : 422).send({...errorBody(error.code), details: error.details ?? error.message});
  if (error !== null && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_INVALID';
    return reply.status(error.statusCode).send(errorBody(code));
  }
  console.error(error);
  return reply.status(503).send(errorBody('CONTROL_PLANE_UNAVAILABLE'));
}

function isStartMissionBody(value: unknown): value is {sourceDigest: string; fault: 'BETA_TO_GA'} { if (value === null || typeof value !== 'object' || Array.isArray(value)) return false; const body = value as Record<string, unknown>; return Object.keys(body).length === 2 && typeof body.sourceDigest === 'string' && /^[a-f0-9]{64}$/u.test(body.sourceDigest) && body.fault === 'BETA_TO_GA'; }
function isOwnerReviewBody(value: unknown): value is {revisionId: string; revisionDigest: string; decision: OwnerReview['decision']} { if (value === null || typeof value !== 'object' || Array.isArray(value)) return false; const body = value as Record<string, unknown>; return Object.keys(body).length === 3 && typeof body.revisionId === 'string' && typeof body.revisionDigest === 'string' && ['READY_FOR_FUTURE_EXECUTION', 'CHANGES_REQUESTED'].includes(String(body.decision)); }

function errorBody(code: string) { return {code, mode: 'DEMO_SEED', live: false}; }

function parseSchedulePreviewBody(value: unknown): SchedulePreviewBody {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new CampaignPreparationError('CAMPAIGN_VALIDATION_FAILED', 'Schedule preview schema validation failed.', [{code: 'SCHEMA_INVALID', path: '/', message: 'Expected an object.'}]);
  const record = value as Record<string, unknown>;
  const allowed = new Set(['localStart', 'timeZone', 'rrule', 'foldPreference', 'misfirePolicy']);
  const invalid = Object.keys(record).filter((key) => !allowed.has(key));
  const rruleValid = record.rrule === undefined || record.rrule === null || typeof record.rrule === 'string';
  if (invalid.length > 0 || typeof record.localStart !== 'string' || typeof record.timeZone !== 'string' || !['EARLIER', 'LATER'].includes(String(record.foldPreference)) || !['SKIP', 'HOLD_FOR_OWNER'].includes(String(record.misfirePolicy)) || !rruleValid) {
    throw new CampaignPreparationError('CAMPAIGN_VALIDATION_FAILED', 'Schedule preview schema validation failed.', [{code: 'SCHEMA_INVALID', path: '/', message: invalid.length > 0 ? `Unknown fields: ${invalid.join(', ')}` : 'Invalid schedule preview field type.'}]);
  }
  return record as SchedulePreviewBody;
}

async function start(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) throw new Error('DATABASE_URL is required.');
  const app = buildApi({repository: new PostgresCampaignRepository(connectionString), shadowRepository: new PostgresShadowMissionRepository(connectionString)});
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  await app.listen({host: '0.0.0.0', port});
}

if (process.argv[1]?.endsWith('/server.js')) {
  start().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
