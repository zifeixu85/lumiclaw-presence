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
  DeepSeekModelProvider,
  failLiveMission,
  liveModelGenerationSchema,
  materializeAcceptedRuntimeMission,
  materializeAcceptedRuntimeProgress,
  MemoryShadowMissionRepository,
  PostgresShadowMissionRepository,
  PublicSafeMockMediaProvider,
  PublicSafeMockModelProvider,
  ShadowContractError,
  missionPublicEvidence,
  recordRuntimeProjectDispatch,
  recordLiveModelCall,
  reviewRevision,
  runPublicSafeFlight,
  runtimeTaskInputProjection,
  validateLiveModelTaskOutput,
  type ModelProvider,
  type OwnerReview,
  type RuntimeProjectDispatchReceipt,
  type RuntimeSubmission,
  type RuntimeTaskAckReceipt,
  type TaskContract,
  type ShadowMissionRepository
} from '@lumiclaw/governed-shadow';
import {PostgresCampaignRepository} from '@lumiclaw/db';
import {timingSafeEqual} from 'node:crypto';
import Fastify, {type FastifyInstance, type FastifyReply, type FastifyRequest} from 'fastify';
import {MemoryCampaignRepository} from './memory-campaign-repository.js';
import {openApiDocument} from './openapi.js';
import {LiveRuntimeTicketStore, LiveTicketError, readComposeSecret, type LiveTicketAction, type LiveTicketBinding} from './live-runtime-security.js';

type BuildOptions = {repository?: CampaignRepository; shadowRepository?: ShadowMissionRepository; now?: () => Date; runtimeImportToken?: string | undefined; deepseekApiKey?: string | undefined; runtimeBootstrapSecret?: string | undefined; liveModelProviderFactory?: ((apiKey: string) => ModelProvider) | undefined};
type CampaignParams = {campaignId: string};
type MissionParams = {missionId: string};
type RuntimeEventBody =
  | {kind: 'PROJECT_DISPATCHED'; receipt: RuntimeProjectDispatchReceipt}
  | {kind: 'TASK_ACK'; receipt: RuntimeTaskAckReceipt}
  | {kind: 'TASK_SUBMIT'; submission: RuntimeSubmission}
  | {kind: 'FINALIZE_ACCEPTED_OUTPUTS'};
type SchedulePreviewBody = {localStart: string; timeZone: string; rrule?: string | null; foldPreference: 'EARLIER' | 'LATER'; misfirePolicy: 'SKIP' | 'HOLD_FOR_OWNER'};
type LiveTicketBody = LiveTicketBinding & {agentTeamsSourceTarSha256: string; agentTeamsBuildDigest: string; imageDigests: {component: string; digest: string}[]};
type LiveModelBody = {taskId: string; roleId: string; attempt: number; inputProjectionDigest: string};

export function buildApi(options: BuildOptions = {}): FastifyInstance {
  const app = Fastify({logger: false});
  const now = options.now ?? (() => new Date());
  const repository = options.repository ?? new MemoryCampaignRepository(now);
  const shadowRepository = options.shadowRepository ?? new MemoryShadowMissionRepository();
  const runtimeImportToken = options.runtimeImportToken;
  const ticketStore = new LiveRuntimeTicketStore(options.runtimeBootstrapSecret, () => now().getTime());
  const deepseekApiKey = options.deepseekApiKey;
  const liveModelProviderFactory = options.liveModelProviderFactory ?? ((apiKey: string) => new DeepSeekModelProvider({apiKey, executionClass: 'CANARY'}));
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

  app.post<{Params: CampaignParams; Body: {sourceDigest: string; fault: 'BETA_TO_GA'; providerMode?: 'PUBLIC_SAFE_MOCK' | 'LIVE_DEEPSEEK_UAT'; providerModel?: 'deepseek-v4-flash' | 'deepseek-v4-pro'}}>('/api/v1/campaigns/:campaignId/shadow-missions', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); const idempotencyKey = requireIdempotency(request, reply); const ifMatch = request.headers['if-match'];
    if (organizationId === undefined || idempotencyKey === undefined) return;
    if (typeof ifMatch !== 'string' || ifMatch.length === 0) return reply.status(428).send(errorBody('ETAG_REQUIRED'));
    const campaign = await repository.get(organizationId, request.params.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    if (campaign.etag !== ifMatch) return reply.status(412).header('ETag', campaign.etag).send(errorBody('CAMPAIGN_VERSION_CONFLICT'));
    if (campaign.readiness === 'BLOCKED') return reply.status(409).send({...errorBody('CAMPAIGN_BLOCKED'), digest: campaign.digest, version: campaign.version, gapCodes: campaign.gapCodes});
    if (!isStartMissionBody(request.body)) return reply.status(422).send(errorBody('SHADOW_START_SCHEMA_INVALID'));
    if (request.body.sourceDigest !== campaign.digest) return reply.status(409).send(errorBody('MISSION_SOURCE_DIGEST_MISMATCH'));
    try {
      const result = await shadowRepository.create({campaign: campaign.document, campaignVersion: campaign.version, campaignDigest: campaign.digest, providerMode: request.body.providerMode ?? 'PUBLIC_SAFE_MOCK', providerModel: request.body.providerModel ?? 'deepseek-v4-flash', now: now()}, idempotencyKey, sha256Digest(request.body));
      return reply.status(result.replayed ? 200 : 201).header('ETag', result.mission.etag).header('Idempotency-Replayed', String(result.replayed)).header('Location', `/api/v1/shadow-missions/${result.mission.id}`).send({code: result.replayed ? 'SHADOW_MISSION_REPLAYED' : 'SHADOW_MISSION_QUEUED', maturity: 'CONTROL_PLANE', mission: result.mission});
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.get<{Params: MissionParams}>('/api/v1/shadow-missions/:missionId', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    return reply.header('ETag', mission.etag).send({code: 'SHADOW_MISSION_REOPENED', mission});
  });

  app.post<{Params: MissionParams; Body: LiveTicketBody}>('/api/v1/shadow-missions/:missionId/live-runner/tickets', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    if (!isLiveTicketBody(request.body) || mission.providerMode !== 'LIVE_DEEPSEEK_UAT' || request.body.missionId !== mission.id || request.body.campaignDigest !== mission.sourceCampaignDigest || request.body.agentTeamsSourceTarSha256 !== mission.runtimeExpectation.agentTeamsSourceTarSha256 || request.body.agentTeamsBuildDigest !== mission.runtimeExpectation.agentTeamsBuildDigest || sha256Digest(request.body.imageDigests) !== sha256Digest(mission.runtimeExpectation.imageDigests)) return reply.status(422).send(errorBody('LIVE_RUNTIME_BINDING_INVALID'));
    const task = request.body.taskId === null ? undefined : mission.tasks.find((item) => item.id === request.body.taskId);
    const taskScopeInvalid = (task === undefined) !== (request.body.taskId === null) || (request.body.action === 'FAIL' ? request.body.roleId !== null || request.body.attempt !== null : task !== undefined && (task.roleId !== request.body.roleId || task.attempt !== request.body.attempt));
    if (taskScopeInvalid) return reply.status(422).send(errorBody('LIVE_RUNTIME_TASK_SCOPE_INVALID'));
    if (!liveTicketActionAllowed(mission, request.body.action, task)) return reply.status(409).send(errorBody('LIVE_RUNTIME_ACTION_NOT_READY'));
    const bootstrap = request.headers['x-lumiclaw-runner-bootstrap'];
    if (typeof bootstrap !== 'string') return reply.status(403).send(errorBody('LIVE_RUNTIME_BOOTSTRAP_REQUIRED'));
    try {
      const binding: LiveTicketBinding = {missionId: request.body.missionId, campaignDigest: request.body.campaignDigest, action: request.body.action, roleId: request.body.roleId, taskId: request.body.taskId, attempt: request.body.attempt};
      const issued = ticketStore.issue(bootstrap, binding);
      return reply.header('cache-control', 'no-store').send({code: 'LIVE_RUNTIME_TICKET_ISSUED', ...issued, scope: binding, secretPresent: false});
    } catch (error) { return sendLiveSecurityError(reply, error); }
  });

  app.post<{Params: MissionParams; Body: LiveModelBody}>('/api/v1/shadow-missions/:missionId/live-model-generate', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    if (!isLiveModelBody(request.body) || mission.providerMode !== 'LIVE_DEEPSEEK_UAT') return reply.status(422).send(errorBody('LIVE_MODEL_REQUEST_INVALID'));
    const task = mission.tasks.find((item) => item.id === request.body.taskId);
    if (task === undefined || task.roleId !== request.body.roleId || task.attempt !== request.body.attempt || task.inputProjectionDigest !== request.body.inputProjectionDigest || task.roleId === 'presence-mission-leader') return reply.status(422).send(errorBody('LIVE_MODEL_TASK_BINDING_INVALID'));
    const ticket = request.headers['x-lumiclaw-runtime-ticket'];
    try { ticketStore.consume(typeof ticket === 'string' ? ticket : '', liveBinding(mission, 'MODEL_GENERATE', task.roleId, task.id, task.attempt)); } catch (error) { return sendLiveSecurityError(reply, error); }
    const campaign = await repository.get(organizationId, mission.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    if (deepseekApiKey === undefined) {
      const failed = failLiveMission(mission, 'DEEPSEEK_SECRET_FILE_UNAVAILABLE', task.id, true, now());
      await shadowRepository.replace(failed, mission.etag);
      return reply.status(503).send({code: 'DEEPSEEK_SECRET_FILE_UNAVAILABLE', providerOutcomeCode: 'DEEPSEEK_SECRET_FILE_UNAVAILABLE', mockFallback: false, nextResponsible: 'COORDINATOR'});
    }
    try {
      const input = runtimeTaskInputProjection(mission, campaign.document, task);
      const result = await liveModelProviderFactory(deepseekApiKey).generateStructured<unknown>({missionId: mission.id, taskId: task.id, model: mission.providerModel, system: liveSystemPrompt(task.kind, task.roleId), input, outputSchema: liveModelGenerationSchema(task, input), temperature: 0, maxTokens: 4_000, timeoutMs: task.timeoutMs, maxAttempts: 3});
      const normalized = result.ok ? normalizeLiveRoleOutput(task, result.value, input) : undefined;
      if (normalized !== undefined) result.snapshot.runtimeOutputDigest = sha256Digest(normalized);
      let next = recordLiveModelCall(mission, result.snapshot, now());
      if (!result.ok || normalized === undefined || !validateLiveModelTaskOutput(task, normalized)) {
        if (next.state !== 'FAILED') next = failLiveMission(next, result.ok ? 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID' : result.snapshot.error?.code ?? 'LIVE_MODEL_FAILED', task.id, result.ok ? false : result.snapshot.error?.retryable ?? false, now());
        await shadowRepository.replace(next, mission.etag);
        const providerOutcomeCode = next.runtimeStatus.failure?.code ?? 'LIVE_PROVIDER_BROKER_FAILED';
        return reply.status(502).send({code: providerOutcomeCode, providerOutcomeCode, mockFallback: false, nextResponsible: 'COORDINATOR'});
      }
      const saved = await shadowRepository.replace(next, mission.etag);
      return reply.header('ETag', saved.etag).header('cache-control', 'no-store').send({code: 'LIVE_MODEL_OUTPUT_READY', maturity: 'LIVE_PROVIDER_CANARY', payload: normalized, receipt: result.snapshot, mission: saved});
    } catch {
      const providerOutcomeCode = 'LIVE_PROVIDER_BROKER_FAILED';
      const failed = failLiveMission(mission, providerOutcomeCode, task.id, false, now());
      try { await shadowRepository.replace(failed, mission.etag); } catch {}
      return reply.status(502).send({code: providerOutcomeCode, providerOutcomeCode, mockFallback: false, nextResponsible: 'COORDINATOR'});
    }
  });

  app.post<{Params: MissionParams; Body: {code: string; failedTaskId: string | null; retryable: boolean}}>('/api/v1/shadow-missions/:missionId/live-runner/fail', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    if (!isLiveFailureBody(request.body) || mission.providerMode !== 'LIVE_DEEPSEEK_UAT') return reply.status(422).send(errorBody('LIVE_FAILURE_SCHEMA_INVALID'));
    const ticket = request.headers['x-lumiclaw-runtime-ticket'];
    try { ticketStore.consume(typeof ticket === 'string' ? ticket : '', liveBinding(mission, 'FAIL', null, request.body.failedTaskId, null)); } catch (error) { return sendLiveSecurityError(reply, error); }
    const failed = await shadowRepository.replace(failLiveMission(mission, request.body.code, request.body.failedTaskId, request.body.retryable, now()), mission.etag);
    return reply.header('ETag', failed.etag).send({code: 'LIVE_RUNTIME_FAILED_CLOSED', mockFallback: false, mission: failed});
  });

  app.post<{Params: MissionParams; Body: RuntimeEventBody}>('/api/v1/shadow-missions/:missionId/runtime-events', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); const idempotencyKey = requireIdempotency(request, reply);
    if (organizationId === undefined || idempotencyKey === undefined) return;
    if (!isRuntimeEventBody(request.body)) return reply.status(422).send(errorBody('RUNTIME_EVENT_SCHEMA_INVALID'));
    const mission = await shadowRepository.get(organizationId, request.params.missionId); if (mission === undefined) return reply.status(404).send(errorBody('MISSION_NOT_FOUND'));
    if (mission.providerMode === 'LIVE_DEEPSEEK_UAT') {
      const ticket = request.headers['x-lumiclaw-runtime-ticket'];
      try { ticketStore.consume(typeof ticket === 'string' ? ticket : '', liveBindingFromRuntimeEvent(mission, request.body)); } catch (error) { return sendLiveSecurityError(reply, error); }
    } else if (!requireRuntimeImportAuthentication(request, reply, runtimeImportToken)) return;
    const route = `/api/v1/shadow-missions/${request.params.missionId}/runtime-events`; const requestDigest = sha256Digest(request.body);
    try {
      const replay = await shadowRepository.getIdempotentReplay(organizationId, route, idempotencyKey, requestDigest);
      if (replay !== undefined) {
        const quarantined = replay.trace.at(-1)?.kind === 'QUARANTINE';
        return reply.status(quarantined ? 422 : 200).header('ETag', replay.etag).header('Idempotency-Replayed', 'true').send({code: quarantined ? 'RUNTIME_SUBMISSION_QUARANTINED_REPLAYED' : 'RUNTIME_EVENT_REPLAYED', accepted: !quarantined, maturity: 'CONTROL_PLANE_RUNTIME_IMPORT', realAgentTeamsClaim: false, mission: replay});
      }
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
    const ifMatch = request.headers['if-match']; if (typeof ifMatch !== 'string') return reply.status(428).send(errorBody('ETAG_REQUIRED')); if (ifMatch !== mission.etag) return reply.status(412).header('ETag', mission.etag).send(errorBody('MISSION_VERSION_CONFLICT'));
    try {
      let next; let accepted = true;
      if (request.body.kind === 'PROJECT_DISPATCHED') {
        const campaign = await repository.get(organizationId, mission.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
        if (campaign.readiness === 'BLOCKED') return reply.status(409).send({...errorBody('CAMPAIGN_BLOCKED'), digest: campaign.digest, version: campaign.version, gapCodes: campaign.gapCodes});
        if (campaign.version !== mission.sourceCampaignVersion || campaign.digest !== mission.sourceCampaignDigest) return reply.status(409).send(errorBody('MISSION_SOURCE_DIGEST_MISMATCH'));
        next = recordRuntimeProjectDispatch(mission, request.body.receipt, now());
      }
      else if (request.body.kind === 'TASK_ACK') next = acknowledgeRuntimeTask(mission, request.body.receipt, now());
      else if (request.body.kind === 'TASK_SUBMIT') {
        next = acceptRuntimeSubmission(mission, request.body.submission, now()); accepted = next.trace.at(-1)?.kind !== 'QUARANTINE';
        if (accepted) {
          const campaign = await repository.get(organizationId, mission.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
          next = materializeAcceptedRuntimeProgress(next, campaign.document, now());
        }
      }
      else {
        const campaign = await repository.get(organizationId, mission.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
        next = materializeAcceptedRuntimeMission(mission, campaign.document, now());
      }
      const result = await shadowRepository.replaceIdempotent(next, mission.etag, route, idempotencyKey, requestDigest);
      return reply.status(accepted ? 200 : 422).header('ETag', result.mission.etag).header('Idempotency-Replayed', String(result.replayed)).send({code: accepted ? 'RUNTIME_EVENT_ACCEPTED' : 'RUNTIME_SUBMISSION_QUARANTINED', accepted, maturity: 'CONTROL_PLANE_RUNTIME_IMPORT', realAgentTeamsClaim: result.mission.providerMode === 'LIVE_DEEPSEEK_UAT', mission: result.mission});
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
    return receipt.schemaVersion === 1 && typeof receipt.projectId === 'string' && typeof receipt.taskId === 'string' && isRoleId(receipt.roleId) && typeof receipt.runtimeActorId === 'string' && Number.isInteger(receipt.attempt) && Number(receipt.attempt) >= 1 && typeof receipt.inputProjectionSchema === 'string' && isDigest(receipt.inputProjectionDigest) && receipt.runtimeState === 'in_progress' && typeof receipt.acknowledgedAt === 'string' && isDigest(receipt.receiptDigest);
  }
  if (event.kind === 'TASK_SUBMIT') {
    if (!isRecord(event.submission)) return false; const submission = event.submission;
    if (!isRecord(submission.runtimeReceipt)) return false; const receipt = submission.runtimeReceipt;
    return submission.schemaVersion === 1 && typeof submission.missionId === 'string' && typeof submission.taskId === 'string' && isRoleId(submission.roleId) && typeof submission.roleIdentityId === 'string' && isDigest(submission.inputDigest) && typeof submission.inputProjectionSchema === 'string' && isDigest(submission.inputProjectionDigest) && isDigest(submission.skillLockDigest) && typeof submission.outputSchema === 'string' && submission.outputSchemaVersion === 1 && 'payload' in submission && isDigest(submission.outputDigest) && ['MOCK_CONFORMANCE', 'CANARY'].includes(String(submission.runtimeResultMaturity)) && receipt.schemaVersion === 1 && typeof receipt.projectId === 'string' && typeof receipt.taskId === 'string' && isRoleId(receipt.roleId) && typeof receipt.runtimeActorId === 'string' && Number.isInteger(receipt.attempt) && Number(receipt.attempt) >= 1 && isDigest(receipt.ackReceiptDigest) && typeof receipt.inputProjectionSchema === 'string' && isDigest(receipt.inputProjectionDigest) && receipt.runtimeState === 'submitted' && typeof receipt.submittedAt === 'string' && isDigest(receipt.resultDigest) && receipt.resultSource === 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY' && isDigest(receipt.runtimeObservationId) && isDigest(receipt.receiptDigest);
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

function requireRuntimeImportAuthentication(request: FastifyRequest, reply: FastifyReply, expected: string | undefined): boolean {
  if (expected === undefined || expected.length < 32) { void reply.status(503).send(errorBody('RUNTIME_IMPORT_DISABLED')); return false; }
  const supplied = request.headers['x-lumiclaw-runtime-import-token'];
  if (typeof supplied !== 'string') { void reply.status(403).send(errorBody('RUNTIME_IMPORT_AUTH_REQUIRED')); return false; }
  const expectedBytes = Buffer.from(expected); const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) { void reply.status(403).send(errorBody('RUNTIME_IMPORT_AUTH_INVALID')); return false; }
  return true;
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
  if (error instanceof ShadowContractError) return reply.status(['IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENT_RESPONSE_VERSION_ADVANCED', 'MISSION_VERSION_CONFLICT', 'MISSION_STATE_CONFLICT', 'OWNER_REVIEW_DUPLICATE', 'RUNTIME_PROJECT_ALREADY_DISPATCHED'].includes(error.code) ? 409 : 422).send({...errorBody(error.code), details: error.details ?? error.message});
  if (error !== null && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_INVALID';
    return reply.status(error.statusCode).send(errorBody(code));
  }
  console.error(error);
  return reply.status(503).send(errorBody('CONTROL_PLANE_UNAVAILABLE'));
}

function isStartMissionBody(value: unknown): value is {sourceDigest: string; fault: 'BETA_TO_GA'; providerMode?: 'PUBLIC_SAFE_MOCK' | 'LIVE_DEEPSEEK_UAT'; providerModel?: 'deepseek-v4-flash' | 'deepseek-v4-pro'} {
  if (!isRecord(value)) return false;
  const allowed = new Set(['sourceDigest', 'fault', 'providerMode', 'providerModel']);
  return Object.keys(value).every((key) => allowed.has(key)) && typeof value.sourceDigest === 'string' && /^[a-f0-9]{64}$/u.test(value.sourceDigest) && value.fault === 'BETA_TO_GA' && (value.providerMode === undefined || ['PUBLIC_SAFE_MOCK', 'LIVE_DEEPSEEK_UAT'].includes(String(value.providerMode))) && (value.providerModel === undefined || ['deepseek-v4-flash', 'deepseek-v4-pro'].includes(String(value.providerModel)));
}
function isOwnerReviewBody(value: unknown): value is {revisionId: string; revisionDigest: string; decision: OwnerReview['decision']} { if (value === null || typeof value !== 'object' || Array.isArray(value)) return false; const body = value as Record<string, unknown>; return Object.keys(body).length === 3 && typeof body.revisionId === 'string' && typeof body.revisionDigest === 'string' && ['READY_FOR_FUTURE_EXECUTION', 'CHANGES_REQUESTED'].includes(String(body.decision)); }

function isLiveTicketBody(value: unknown): value is LiveTicketBody {
  if (!isRecord(value)) return false;
  const exact = ['action', 'agentTeamsBuildDigest', 'agentTeamsSourceTarSha256', 'attempt', 'campaignDigest', 'imageDigests', 'missionId', 'roleId', 'taskId'];
  if (Object.keys(value).sort().join(',') !== exact.sort().join(',')) return false;
  return typeof value.missionId === 'string' && isDigest(value.campaignDigest) && ['PROJECT_DISPATCH', 'TASK_ACK', 'MODEL_GENERATE', 'TASK_SUBMIT', 'FINALIZE', 'FAIL'].includes(String(value.action)) && (value.roleId === null || isRoleId(value.roleId)) && (value.taskId === null || typeof value.taskId === 'string') && (value.attempt === null || Number.isSafeInteger(value.attempt)) && isDigest(value.agentTeamsSourceTarSha256) && isSha256Build(value.agentTeamsBuildDigest) && Array.isArray(value.imageDigests) && value.imageDigests.length === 3 && value.imageDigests.every((item) => isRecord(item) && typeof item.component === 'string' && isSha256Build(item.digest));
}

function isLiveModelBody(value: unknown): value is LiveModelBody { return isRecord(value) && Object.keys(value).sort().join(',') === 'attempt,inputProjectionDigest,roleId,taskId' && typeof value.taskId === 'string' && isRoleId(value.roleId) && Number.isSafeInteger(value.attempt) && isDigest(value.inputProjectionDigest); }
function isLiveFailureBody(value: unknown): value is {code: string; failedTaskId: string | null; retryable: boolean} { return isRecord(value) && Object.keys(value).sort().join(',') === 'code,failedTaskId,retryable' && typeof value.code === 'string' && value.code.length > 0 && value.code.length <= 80 && (value.failedTaskId === null || typeof value.failedTaskId === 'string') && typeof value.retryable === 'boolean'; }

function liveBinding(mission: Awaited<ReturnType<ShadowMissionRepository['get']>> & {}, action: LiveTicketAction, roleId: string | null, taskId: string | null, attempt: number | null): LiveTicketBinding { return {missionId: mission.id, campaignDigest: mission.sourceCampaignDigest, action, roleId, taskId, attempt}; }
function liveBindingFromRuntimeEvent(mission: NonNullable<Awaited<ReturnType<ShadowMissionRepository['get']>>>, event: RuntimeEventBody): LiveTicketBinding {
  if (event.kind === 'PROJECT_DISPATCHED') return liveBinding(mission, 'PROJECT_DISPATCH', null, null, null);
  if (event.kind === 'TASK_ACK') return liveBinding(mission, 'TASK_ACK', event.receipt.roleId, event.receipt.taskId, event.receipt.attempt);
  if (event.kind === 'TASK_SUBMIT') return liveBinding(mission, 'TASK_SUBMIT', event.submission.roleId, event.submission.taskId, mission.tasks.find((task) => task.id === event.submission.taskId)?.attempt ?? null);
  return liveBinding(mission, 'FINALIZE', null, null, null);
}

function liveTicketActionAllowed(mission: NonNullable<Awaited<ReturnType<ShadowMissionRepository['get']>>>, action: LiveTicketAction, task: NonNullable<Awaited<ReturnType<ShadowMissionRepository['get']>>>['tasks'][number] | undefined): boolean {
  if (action === 'PROJECT_DISPATCH') return mission.state === 'WAITING_RUNTIME' && mission.runtimeProjectDispatch === null && task === undefined;
  if (action === 'TASK_ACK') return mission.state === 'RUNNING' && task?.state === 'ASSIGNED';
  if (action === 'MODEL_GENERATE') return mission.state === 'RUNNING' && task?.state === 'ACKNOWLEDGED' && task.roleId !== 'presence-mission-leader';
  if (action === 'TASK_SUBMIT') return mission.state === 'RUNNING' || ['REVISION_REQUIRED', 'AUDIT_BLOCKED'].includes(mission.state) ? task?.state === 'ACKNOWLEDGED' && (task.roleId === 'presence-mission-leader' || mission.modelCalls.some((call) => call.taskId === task.id && call.outputDigest !== null && call.error === null)) : false;
  if (action === 'FINALIZE') return task === undefined && mission.tasks.every((candidate) => candidate.state === 'ACCEPTED');
  return action === 'FAIL' && !['AWAITING_OWNER_REVIEW', 'COMPLETED_SHADOW'].includes(mission.state);
}

function liveSystemPrompt(kind: string, roleId: string): string {
  const special = kind === 'PRODUCE_FOUNDER' ? 'For the frozen Flight fault only, X revision 1 must contain the exact phrase “generally available”; do not add it to any other platform.' : kind === 'AUDIT_REVISIONS' ? 'Independently reject X revision 1 when it says “generally available”, using CLAIM_OVERREACH and the supplied Evidence Ref IDs; do not self-approve Producer work.' : kind === 'PRODUCE_FOUNDER_CORRECTION' ? 'Copy the supplied approved source X content exactly; the correction must remove the unsupported availability claim.' : kind === 'REAUDIT_CORRECTION' ? 'Independently PASS only when the corrected X content matches the evidence-bound source; never reuse the Producer voice as an audit.' : '';
  return `You are the ${roleId} domain member in a governed local SHADOW UAT. Return JSON only, exactly matching the supplied role schema. The control plane binds cryptographic digests after your structured role output; do not invent digests. Never publish, comment, reply, DM, scrape, create a connector or ActionGrant. ${special}`.trim();
}

function normalizeLiveRoleOutput(task: TaskContract, raw: unknown, input: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!isRecord(raw) || !isRecord(input.projection)) return undefined;
  const projection = input.projection;
  if (task.kind === 'FREEZE_EVIDENCE') {
    if (raw.frozen !== true || typeof raw.assessment !== 'string' || !isRecord(projection.claimEvidence)) return undefined;
    return {frozen: true, claimEvidenceDigest: sha256Digest({claims: projection.claimEvidence.claims, evidence: projection.claimEvidence.evidenceRefs})};
  }
  if (task.kind === 'PLAN_CAMPAIGN') return typeof raw.rationale === 'string' && isRecord(projection.activationPlan) ? {activationPlanDigest: sha256Digest(projection.activationPlan)} : undefined;
  if (['PRODUCE_FOUNDER', 'PRODUCE_PRODUCT', 'PRODUCE_FOUNDER_CORRECTION'].includes(task.kind)) {
    if (!Array.isArray(raw.revisions) || !Array.isArray(projection.sourceRevisions)) return undefined;
    const rawRevisions = raw.revisions as unknown[]; const sourceRevisions = projection.sourceRevisions as unknown[];
    const expected = task.kind === 'PRODUCE_FOUNDER' ? ['X', 'XIAOHONGSHU'] : task.kind === 'PRODUCE_PRODUCT' ? ['BLUESKY', 'LINKEDIN'] : ['X'];
    if (rawRevisions.length !== expected.length || new Set(rawRevisions.map((value) => isRecord(value) ? String(value.platform) : '')).size !== expected.length) return undefined;
    const revisions = expected.map((platform) => {
      const candidate = rawRevisions.find((value) => isRecord(value) && value.platform === platform); const source = sourceRevisions.find((value) => isRecord(value) && value.platform === platform);
      if (!isRecord(candidate) || !isRecord(source) || !isRecord(candidate.content) || candidate.content.kind !== platform) return undefined;
      if (task.kind === 'PRODUCE_FOUNDER_CORRECTION' && sha256Digest(candidate.content) !== sha256Digest(source.content)) return undefined;
      return {platform, revision: task.kind === 'PRODUCE_FOUNDER_CORRECTION' ? 2 : 1, sourceRevisionDigest: sha256Digest(source), contentDigest: sha256Digest(candidate.content), content: candidate.content};
    });
    if (revisions.some((value) => value === undefined)) return undefined;
    const result: Record<string, unknown> = {revisions};
    if (task.kind === 'PRODUCE_FOUNDER_CORRECTION') { if (!isRecord(projection.failedAudit) || typeof projection.failedAudit.digest !== 'string') return undefined; result.failedAuditDigest = projection.failedAudit.digest; }
    return result;
  }
  if (!Array.isArray(raw.decisions)) return undefined;
  const rawDecisions = raw.decisions as unknown[];
  if (task.kind === 'AUDIT_REVISIONS') {
    if (!isRecord(projection.producerSummaries) || !isRecord(projection.producerSummaries.founder) || !isRecord(projection.producerSummaries.product)) return undefined;
    const revisions = [...(Array.isArray(projection.producerSummaries.founder.revisions) ? projection.producerSummaries.founder.revisions : []), ...(Array.isArray(projection.producerSummaries.product.revisions) ? projection.producerSummaries.product.revisions : [])];
    if (revisions.length !== 4 || rawDecisions.length !== 4 || !Array.isArray(projection.evidenceRefIds) || !projection.evidenceRefIds.every((value) => typeof value === 'string')) return undefined;
    const evidenceRefIds = new Set(projection.evidenceRefIds as string[]);
    const decisions = revisions.map((revision) => {
      if (!isRecord(revision)) return undefined;
      const candidate = rawDecisions.find((value) => isRecord(value) && value.platform === revision.platform);
      if (!isRecord(candidate) || !Array.isArray(candidate.issues)) return undefined;
      if (revision.platform !== 'X') {
        if (candidate.outcome !== 'PASS' || candidate.issues.length !== 0) return undefined;
      } else {
        if (candidate.outcome !== 'FAIL' || candidate.issues.length !== 1 || !isRecord(candidate.issues[0])) return undefined;
        const issue = candidate.issues[0];
        if (issue.code !== 'CLAIM_OVERREACH' || issue.severity !== 'BLOCKING' || issue.nextResponsibleRoleId !== 'founder-identity-producer' || typeof issue.path !== 'string' || issue.path.length === 0 || typeof issue.message !== 'string' || issue.message.length === 0 || !Array.isArray(issue.evidenceRefIds) || issue.evidenceRefIds.length === 0 || !issue.evidenceRefIds.every((value) => typeof value === 'string' && evidenceRefIds.has(value))) return undefined;
      }
      return {platform: revision.platform, revision: 1, revisionContentDigest: revision.contentDigest, outcome: candidate.outcome, issues: candidate.issues};
    });
    return decisions.some((value) => value === undefined) ? undefined : {decisions};
  }
  if (!isRecord(projection.correctedRevision) || !isRecord(projection.failedAudit) || rawDecisions.length !== 1 || !isRecord(rawDecisions[0])) return undefined;
  const candidate = rawDecisions[0];
  if (candidate.platform !== 'X' || candidate.outcome !== 'PASS' || !Array.isArray(candidate.issues) || candidate.issues.length !== 0) return undefined;
  return {decisions: [{platform: 'X', revision: 2, revisionContentDigest: sha256Digest(projection.correctedRevision.content), outcome: candidate.outcome, issues: candidate.issues}], failedAuditDigest: projection.failedAudit.digest};
}

function sendLiveSecurityError(reply: FastifyReply, error: unknown) {
  const code = error instanceof LiveTicketError ? error.code : 'LIVE_RUNTIME_AUTH_FAILED';
  return reply.status(code.includes('UNAVAILABLE') ? 503 : 403).send({code, mockFallback: false, secretPresent: false});
}

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
  const app = buildApi({repository: new PostgresCampaignRepository(connectionString), shadowRepository: new PostgresShadowMissionRepository(connectionString), runtimeImportToken: readComposeSecret('/run/secrets/lumiclaw_runtime_import_token'), deepseekApiKey: readComposeSecret('/run/secrets/deepseek_api_key'), runtimeBootstrapSecret: readComposeSecret('/run/secrets/lumiclaw_runtime_broker_bootstrap')});
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  await app.listen({host: '0.0.0.0', port});
}

if (process.argv[1]?.endsWith('/server.js')) {
  start().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
