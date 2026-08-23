import {
  CampaignPreparationError,
  createLocalPrivateCampaignDocument,
  createPublishingSchedule,
  createDemoCampaignDocument,
  isUuidV7,
  ScheduleContractError,
  sha256Digest,
  type CampaignDocument,
  type CampaignRepository,
  type MutationResult
} from '@lumiclaw/domain';
import {blockedManualPublishAuthorization, isSecretBearingObject, LOCAL_MATERIAL_MAX_BYTES, LocalPresenceContractError, normalizeLocalDisplayName, validateLocalCampaignIdentityInput, validateOnboardingContext, type LocalOnboardingSession, type LocalPresenceRepository, type ManualPublishHandoff} from '@lumiclaw/domain';
import {isSecretBearingKnowledgeObject, knowledgeEtag, KnowledgeContractError, parseKnowledgeEtag, validateKnowledgeSessionInput, validateSourceCandidates, validateTextSource, type KnowledgePlatform, type KnowledgeRepository, type ProfileKind} from '@lumiclaw/domain';
import {accountBindingsFromKnowledge, createOperatingGoalRevision, goalEtag, GoalPlanContractError, planEtag, stableContractId, validateOperatingGoalInput, type AccountOperatingProfileInput, type ContentBrief, type ContentPlanSlot, type GoalPlanRepository, type MissionBundle, type OperatingGoalInput, type OperatingGoalRevision, type PlanSourceBinding, type PlannerSubmission} from '@lumiclaw/domain';
import {artifactRevisionEtag, auditDecisionEtag, buildManualPublishPackage, controlledAuditFindings, createArtifactAuditDecision, createArtifactOwnerDecision, createArtifactRevision, createControlledProducerSubmission, createOwnerEditRevision, createRegenerationRequest, effectiveArtifactState, effectivePackageState, ownerDecisionEtag, packageEtag, parseArtifactAuditFindings, parseArtifactPayload, parseProducerSubmission, quarantineProducerSubmission, recordPackageHelperEvent, ArtifactContractError, type ArtifactAuditDecision, type ArtifactOwnerDecision, type ArtifactPublishRepository, type ArtifactRevisionV3, type AuditResult, type MissionExecutionBundle, type OwnerArtifactDecisionResult, type ProducerSubmission} from '@lumiclaw/domain';
import {AGENTTEAMS_RUNTIME_VERSION,AGENTTEAMS_SOURCE_COMMIT,AGENTTEAMS_SOURCE_TAR_SHA256,missionRunEtag,parseMissionRunEtag,PersistentRuntimeError,type MissionRun,type PersistentRuntimeRepository,type RuntimeReadinessState,type RuntimeWorkerHeartbeat} from '@lumiclaw/domain';
import {LocalContentAddressedBlobStore} from '@lumiclaw/blob-store';
import {
  acceptRuntimeSubmission,
  acknowledgeRuntimeTask,
  attachProviderEvidence,
  DeepSeekModelProvider,
  failLiveMission,
  hasFrozenFounderFault,
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
import {PostgresArtifactPublishRepository, PostgresCampaignRepository, PostgresGoalPlanRepository, PostgresKnowledgeRepository, PostgresLocalPresenceRepository,PostgresPersistentRuntimeRepository} from '@lumiclaw/db';
import {approveContentPlanV2, compileMissionIntentV2, continueSelectedPlatformMissionV2, importPlannerSubmissionV2, reviseContentPlanV2} from '@lumiclaw/mission-compiler';
import {timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import Fastify, {type FastifyInstance, type FastifyReply, type FastifyRequest} from 'fastify';
import {MemoryCampaignRepository} from './memory-campaign-repository.js';
import {MemoryLocalPresenceRepository} from './memory-local-presence-repository.js';
import {MemoryKnowledgeRepository} from './memory-knowledge-repository.js';
import {MemoryGoalPlanRepository} from './memory-goal-plan-repository.js';
import {MemoryArtifactPublishRepository} from './memory-artifact-publish-repository.js';
import {liveTaskActionPhaseAllowed} from './live-ticket-policy.js';
import {openApiDocument} from './openapi.js';
import {LiveRuntimeTicketStore, LiveTicketError, readComposeSecret, type LiveTicketAction, type LiveTicketBinding} from './live-runtime-security.js';

type GatewayReadiness={state:RuntimeReadinessState;providerMode:string;controlledFake:boolean;configured:boolean;fingerprint:string|null;updatedAt:string|null};
type BuildOptions = {repository?: CampaignRepository; shadowRepository?: ShadowMissionRepository; localPresenceRepository?: LocalPresenceRepository; knowledgeRepository?: KnowledgeRepository; goalPlanRepository?: GoalPlanRepository; artifactPublishRepository?: ArtifactPublishRepository; persistentRuntimeRepository?:PersistentRuntimeRepository;gatewayReadinessProbe?:()=>Promise<GatewayReadiness>;now?: () => Date; runtimeImportToken?: string | undefined; deepseekApiKey?: string | undefined; runtimeBootstrapSecret?: string | undefined; liveModelProviderFactory?: ((apiKey: string) => ModelProvider) | undefined};
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
  const app = Fastify({logger: false, bodyLimit: LOCAL_MATERIAL_MAX_BYTES + 1});
  const now = options.now ?? (() => new Date());
  const repository = options.repository ?? new MemoryCampaignRepository(now);
  const shadowRepository = options.shadowRepository ?? new MemoryShadowMissionRepository();
  const localPresenceRepository = options.localPresenceRepository ?? new MemoryLocalPresenceRepository();
  const knowledgeRepository = options.knowledgeRepository ?? new MemoryKnowledgeRepository();
  const goalPlanRepository = options.goalPlanRepository ?? new MemoryGoalPlanRepository();
  const artifactPublishRepository = options.artifactPublishRepository ?? new MemoryArtifactPublishRepository();
  const persistentRuntimeRepository=options.persistentRuntimeRepository;
  const runtimeImportToken = options.runtimeImportToken;
  const ticketStore = new LiveRuntimeTicketStore(options.runtimeBootstrapSecret, () => now().getTime());
  const deepseekApiKey = options.deepseekApiKey;
  const liveModelProviderFactory = options.liveModelProviderFactory ?? ((apiKey: string) => new DeepSeekModelProvider({apiKey, executionClass: 'CANARY'}));
  app.addContentTypeParser(['text/plain', 'text/markdown', 'application/octet-stream', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/mpeg', 'audio/mp4', 'audio/wav'], {parseAs: 'buffer'}, (_request, body, done) => done(null, body));
  app.addHook('onClose', async () => { await repository.close(); await shadowRepository.close(); await localPresenceRepository.close(); await knowledgeRepository.close(); await goalPlanRepository.close(); await artifactPublishRepository.close(); await persistentRuntimeRepository?.close(); });
  app.addHook('preHandler',async(request)=>{const requestPath=request.url.split('?')[0]??'';if(!/^\/api\/v1\/(?:local-workspace|goals(?:\/|$)|missions(?:\/|$)|mission-bundles(?:\/|$)|content-plans(?:\/|$)|artifacts(?:\/|$)|artifact-submissions(?:\/|$)|manual-publish-packages(?:\/|$))/u.test(requestPath))return;const profile=await localPresenceRepository.getProfile();if(profile!==undefined){await reconcileKnowledgeSupersessions(knowledgeRepository,goalPlanRepository,profile.id,now());await reconcileArtifactSupersessions(goalPlanRepository,artifactPublishRepository,profile.id,now());}});

  app.get('/health', async (_request, reply) => {
    try {
      if (!await repository.health()) throw new Error('database marker missing');
      if (!await shadowRepository.health()) throw new Error('shadow database marker missing');
      if (!await knowledgeRepository.health()) throw new Error('knowledge database marker missing');
      if (!await goalPlanRepository.health()) throw new Error('goal database marker missing');
      if (!await artifactPublishRepository.health()) throw new Error('artifact database marker missing');
      return {service: 'api', status: 'ok', mode: 'DEMO_SEED', live: false, controlPlane: 'POSTGRESQL'};
    } catch {
      return reply.status(503).send({service: 'api', status: 'unavailable', code: 'CONTROL_PLANE_UNAVAILABLE', mode: 'DEMO_SEED', live: false});
    }
  });

  const ensurePublicSafeCampaign = async () => {
    const document = createDemoCampaignDocument();
    const current = await repository.get(document.organizationId, document.id);
    if (current !== undefined) return current;
    const result = await repository.create(document.organizationId, document, 'sdd006-public-safe-example-v1', sha256Digest(document), now());
    if (!result.ok) throw new LocalPresenceContractError(result.code);
    return result.envelope;
  };
  const rejectKnowledgeRequest = async (reply: FastifyReply, code: string) => {
    const profile = await localPresenceRepository.getProfile();
    if (profile !== undefined) await knowledgeRepository.recordSecurityRejection(profile.id, code, now()).catch(() => undefined);
    return reply.status(422).send(errorBody(code));
  };

  app.get('/api/v1/local-workspace', async (_request, reply) => {
    void reply.header('cache-control', 'no-store');
    const profile = await localPresenceRepository.getProfile();
    const publishAuthorization = blockedManualPublishAuthorization();
    if (profile === undefined) return {code: 'LOCAL_FIRST_OPEN', profile: null, session: null, materials: [], handoffs: [], campaign: null, knowledge: null, goals: null, artifacts: null, publishAuthorization};
    const [session, materials, handoffs, knowledge, goals, artifacts] = await Promise.all([localPresenceRepository.getSession(profile.id), localPresenceRepository.listMaterials(profile.id), localPresenceRepository.listManualHandoffs(profile.id), knowledgeRepository.ensureOwner(profile.id, now()), goalPlanRepository.getWorkspace(profile.id),artifactPublishRepository.getWorkspace(profile.id)]);
    const campaign = session?.organizationId !== null && session?.organizationId !== undefined && session.campaignId !== null ? await repository.get(session.organizationId, session.campaignId) : undefined;
    void reply.header('ETag', knowledgeEtag(knowledge.session.rowVersion));
    return {code: 'LOCAL_WORKSPACE_REOPENED', profile, session: session ?? null, materials, handoffs, campaign: campaign ?? null, knowledge, goals, artifacts, publishAuthorization};
  });

  app.post('/api/v1/local-owner-profile', async (request, reply) => {
    if (isSecretBearingObject(request.body)) return reply.status(422).send(errorBody('BROWSER_SECRET_FIELD_FORBIDDEN'));
    if (!isExactRecord(request.body, ['displayName'])) return reply.status(422).send(errorBody('LOCAL_PROFILE_SCHEMA_INVALID'));
    const profile = await localPresenceRepository.createProfile(normalizeLocalDisplayName(request.body.displayName), now());
    await knowledgeRepository.ensureOwner(profile.id, now());
    return reply.status(201).header('cache-control', 'no-store').send({code: 'LOCAL_PROFILE_READY', profile, requiresEmail: false, requiresPassword: false, remoteRegistration: false});
  });

  app.get('/api/v1/local-owner', async (_request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const knowledge = await knowledgeRepository.ensureOwner(profile.id, now());
    return reply.header('cache-control','no-store').header('ETag', knowledgeEtag(knowledge.session.rowVersion)).send({code:'LOCAL_OWNER_REOPENED',profile});
  });

  app.patch('/api/v1/local-owner', async (request, reply) => {
    if (isSecretBearingKnowledgeObject(request.body) || !isExactRecord(request.body,['displayName'])) return rejectKnowledgeRequest(reply,'BROWSER_SECRET_FIELD_FORBIDDEN');
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const updated = await localPresenceRepository.updateProfile(normalizeLocalDisplayName(request.body.displayName), now());
    return reply.header('cache-control','no-store').send({code:'LOCAL_OWNER_UPDATED',profile:updated});
  });

  app.get('/api/v1/onboarding/session', async (_request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const overview = await knowledgeRepository.ensureOwner(profile.id, now());
    return reply.header('cache-control','no-store').header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'KNOWLEDGE_ONBOARDING_REOPENED',overview});
  });

  app.put('/api/v1/onboarding/session', async (request, reply) => {
    if (isSecretBearingKnowledgeObject(request.body)) return rejectKnowledgeRequest(reply,'BROWSER_SECRET_FIELD_FORBIDDEN');
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const headers = knowledgeMutationHeaders(request); const overview = await knowledgeRepository.updateSession(profile.id,validateKnowledgeSessionInput(request.body),headers.version,headers.idempotencyKey,now());
    return reply.header('cache-control','no-store').header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'KNOWLEDGE_ONBOARDING_SAVED',overview});
  });

  app.put<{Params:{profileKind:string}}>('/api/v1/profiles/:profileKind', async (request, reply) => {
    if (isSecretBearingKnowledgeObject(request.body)) return rejectKnowledgeRequest(reply,'BROWSER_SECRET_FIELD_FORBIDDEN');
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const kindMap:Record<string,ProfileKind>={persona:'PERSONA',organization:'ORGANIZATION',product:'PRODUCT'}; const kind=kindMap[request.params.profileKind]; if(kind===undefined)return reply.status(404).send(errorBody('PROFILE_KIND_NOT_FOUND'));
    const headers=knowledgeMutationHeaders(request); const overview=await knowledgeRepository.saveProfile(profile.id,kind,null,request.body,headers.version,headers.idempotencyKey,now());
    return reply.header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'KNOWLEDGE_PROFILE_REVISION_CREATED',overview});
  });

  app.put<{Params:{platform:string}}>('/api/v1/profiles/accounts/:platform', async (request, reply) => {
    if (isSecretBearingKnowledgeObject(request.body)) return rejectKnowledgeRequest(reply,'BROWSER_SECRET_FIELD_FORBIDDEN');
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const platform=request.params.platform.toUpperCase() as KnowledgePlatform; if(!['X','XIAOHONGSHU'].includes(platform))return reply.status(404).send(errorBody('ACCOUNT_PLATFORM_NOT_FOUND'));
    const headers=knowledgeMutationHeaders(request); const overview=await knowledgeRepository.saveProfile(profile.id,'ACCOUNT',platform,request.body,headers.version,headers.idempotencyKey,now());
    return reply.header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'ACCOUNT_OPERATING_PROFILE_REVISION_CREATED',overview});
  });

  app.post('/api/v1/knowledge/sources', async (request, reply) => {
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return; const headers=knowledgeMutationHeaders(request);
    const encoded=request.headers['x-lumiclaw-file-name'];if(typeof encoded!=='string'||!(request.body instanceof Buffer))return reply.status(422).send(errorBody('SOURCE_FILE_REQUIRED'));
    const fileName=decodeFileName(encoded);const overview=await knowledgeRepository.ingestSource({ownerId:profile.id,label:fileName,fileName,declaredMediaType:request.headers['content-type']?.split(';')[0]??'application/octet-stream',bytes:request.body,candidates:validateSourceCandidates(undefined)},headers.version,headers.idempotencyKey,now());
    return reply.status(201).header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'SOURCE_DOCUMENT_REVISION_CREATED',overview});
  });

  app.post('/api/v1/knowledge/sources/text', async (request, reply) => {
    if(isSecretBearingKnowledgeObject(request.body))return rejectKnowledgeRequest(reply,'BROWSER_SECRET_FIELD_FORBIDDEN'); const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return; const headers=knowledgeMutationHeaders(request);
    if(!isRecord(request.body)||Object.keys(request.body).sort().join(',')!=='label,text')return reply.status(422).send(errorBody('SOURCE_TEXT_SCHEMA_INVALID')); const input=validateTextSource({...request.body,candidates:[]});
    const overview=await knowledgeRepository.ingestTextSource({ownerId:profile.id,...input},headers.version,headers.idempotencyKey,now());return reply.status(201).header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'SOURCE_TEXT_REVISION_CREATED',overview});
  });

  app.get<{Params:{sourceId:string}}>('/api/v1/knowledge/sources/:sourceId', async (request, reply) => { const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return; const source=await knowledgeRepository.getSource(profile.id,request.params.sourceId);if(source===undefined)return reply.status(404).send(errorBody('SOURCE_NOT_FOUND'));return reply.header('cache-control','no-store').send({code:'SOURCE_DOCUMENT_REOPENED',source}); });
  app.delete<{Params:{sourceId:string}}>('/api/v1/knowledge/sources/:sourceId', async (request, reply) => { const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const headers=knowledgeMutationHeaders(request);const overview=await knowledgeRepository.deleteSource(profile.id,request.params.sourceId,headers.version,headers.idempotencyKey,now());return reply.header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'SOURCE_DOCUMENT_DELETED_NEW_DRAFT_REQUIRED',overview}); });
  app.post<{Params:{sourceId:string}}>('/api/v1/knowledge/sources/:sourceId/confirm', async (request, reply) => { const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const headers=knowledgeMutationHeaders(request);const overview=await knowledgeRepository.confirmLegacySource(profile.id,request.params.sourceId,headers.version,headers.idempotencyKey,now());return reply.header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'LEGACY_SOURCE_CONFIRMED_NEW_REVISION',overview}); });

  app.get('/api/v1/knowledge/snapshots/draft',async(_request,reply)=>{const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const overview=await knowledgeRepository.ensureOwner(profile.id,now());return reply.header('cache-control','no-store').header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'KNOWLEDGE_SNAPSHOT_DRAFT',draft:overview.draft,overview});});
  app.post('/api/v1/knowledge/snapshots/resolve-conflict',async(request,reply)=>{if(isSecretBearingKnowledgeObject(request.body)||!isExactRecord(request.body,['conflictId','selectedItemId','note'])||typeof request.body.conflictId!=='string'||typeof request.body.selectedItemId!=='string'||typeof request.body.note!=='string')return rejectKnowledgeRequest(reply,'CONFLICT_RESOLUTION_SCHEMA_INVALID');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const headers=knowledgeMutationHeaders(request);const overview=await knowledgeRepository.resolveConflict(profile.id,request.body.conflictId,request.body.selectedItemId,request.body.note,headers.version,headers.idempotencyKey,now());return reply.header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'KNOWLEDGE_CONFLICT_RESOLVED',overview});});
  app.post('/api/v1/knowledge/snapshots/approve',async(request,reply)=>{if(isSecretBearingKnowledgeObject(request.body)||!isExactRecord(request.body,['snapshotId','canonicalDigest'])||typeof request.body.snapshotId!=='string'||typeof request.body.canonicalDigest!=='string')return rejectKnowledgeRequest(reply,'SNAPSHOT_APPROVAL_SCHEMA_INVALID');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const headers=knowledgeMutationHeaders(request);const approvedAt=now();const overview=await knowledgeRepository.approveSnapshot(profile.id,request.body.snapshotId,request.body.canonicalDigest,headers.version,headers.idempotencyKey,approvedAt);await reconcileKnowledgeSupersessions(knowledgeRepository,goalPlanRepository,profile.id,approvedAt);return reply.header('ETag',knowledgeEtag(overview.session.rowVersion)).send({code:'AUTHORITATIVE_KNOWLEDGE_SNAPSHOT_APPROVED',overview});});
  app.get<{Params:{snapshotId:string}}>('/api/v1/knowledge/snapshots/:snapshotId/role-context',async(request,reply)=>{const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const digest=request.headers['x-lumiclaw-snapshot-digest'];if(typeof digest!=='string')return reply.status(428).send(errorBody('SNAPSHOT_DIGEST_REQUIRED'));const roleContext=await knowledgeRepository.getRoleContext(profile.id,request.params.snapshotId,digest);return reply.header('cache-control','no-store').send({code:'APPROVED_KNOWLEDGE_ROLE_CONTEXT',roleContext});});

  app.get('/api/v1/goals', async (_request,reply) => {
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;
    return reply.header('cache-control','no-store').send({code:'GOAL_WORKSPACE_REOPENED',workspace:await goalPlanRepository.getWorkspace(profile.id)});
  });

  app.post('/api/v1/goals', async (request,reply) => {
    if(isSecretBearingKnowledgeObject(request.body))return rejectKnowledgeRequest(reply,'BROWSER_SECRET_FIELD_FORBIDDEN');
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;
    const headers=knowledgeMutationHeaders(request); const value=validateOperatingGoalInput(request.body);
    const goalId=stableContractId('goal',{ownerId:profile.id,idempotencyKey:headers.idempotencyKey});
    const goal=createOperatingGoalRevision({ownerId:profile.id,goalId,revision:1,state:'DRAFT',parentDigest:null,value,createdAt:now().toISOString()});
    const inputs=await approvedGoalInputs(knowledgeRepository,profile.id,goal,false);
    if(headers.version!==inputs.guard.rowVersion)throw new GoalPlanContractError('KNOWLEDGE_SNAPSHOT_STALE');
    const result=await goalPlanRepository.appendGoal(profile.id,goal,inputs.bindings,null,inputs.guard,headers.idempotencyKey,now());
    return reply.status(result.replayed?200:201).header('ETag',goalEtag(result.goal)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'GOAL_MUTATION_REPLAYED':'OPERATING_GOAL_CREATED',goal:result.goal,accountBindings:inputs.bindings});
  });

  app.get<{Params:{goalId:string}}>('/api/v1/goals/:goalId',async(request,reply)=>{
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const goal=await goalPlanRepository.getGoal(profile.id,request.params.goalId);if(goal===undefined)return reply.status(404).send(errorBody('GOAL_NOT_FOUND'));return reply.header('cache-control','no-store').header('ETag',goalEtag(goal)).send({code:'OPERATING_GOAL_REOPENED',goal});
  });

  app.patch<{Params:{goalId:string}}>('/api/v1/goals/:goalId',async(request,reply)=>{
    if(isSecretBearingKnowledgeObject(request.body))return rejectKnowledgeRequest(reply,'BROWSER_SECRET_FIELD_FORBIDDEN');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;
    const current=await requireGoal(goalPlanRepository,profile.id,request.params.goalId);const {canonicalDigest,...raw}=exactGoalPatch(request.body);
    if(current.state==='DRAFT'&&current.parentDigest===canonicalDigest&&sha256Digest(goalInput(current))===sha256Digest(raw)){const headers=exactMutationHeaders(request,current.parentDigest,previousGoalEtag(current));const inputs=await approvedGoalInputs(knowledgeRepository,profile.id,current,false);const result=await goalPlanRepository.appendGoal(profile.id,current,inputs.bindings,current.parentDigest,inputs.guard,headers.idempotencyKey,now());return reply.header('ETag',goalEtag(result.goal)).header('Idempotency-Replayed',String(result.replayed)).send({code:'GOAL_MUTATION_REPLAYED',goal:result.goal,invalidated:true});}
    const headers=exactMutationHeaders(request,current.canonicalDigest,goalEtag(current));if(canonicalDigest!==current.canonicalDigest)throw new GoalPlanContractError('GOAL_DIGEST_MISMATCH');
    const goal=createOperatingGoalRevision({ownerId:profile.id,goalId:current.goalId,revision:current.revision+1,state:'DRAFT',parentDigest:current.canonicalDigest,value:raw,createdAt:now().toISOString()});const inputs=await approvedGoalInputs(knowledgeRepository,profile.id,goal,false);
    const result=await goalPlanRepository.appendGoal(profile.id,goal,inputs.bindings,current.canonicalDigest,inputs.guard,headers.idempotencyKey,now());return reply.header('ETag',goalEtag(result.goal)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'GOAL_MUTATION_REPLAYED':'OPERATING_GOAL_REVISION_CREATED',goal:result.goal,invalidated:true});
  });

  for(const transition of ['activate','pause'] as const) app.post<{Params:{goalId:string}}>(`/api/v1/goals/:goalId/${transition}`,async(request,reply)=>{
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const current=await requireGoal(goalPlanRepository,profile.id,request.params.goalId);
    if(!isExactRecord(request.body,['canonicalDigest'])||typeof request.body.canonicalDigest!=='string')throw new GoalPlanContractError('GOAL_DIGEST_MISMATCH');
    const expectedState=transition==='activate'?'ACTIVE':'PAUSED';
    if(current.state===expectedState&&current.parentDigest===request.body.canonicalDigest){const headers=exactMutationHeaders(request,current.parentDigest,previousGoalEtag(current));const inputs=await approvedGoalInputs(knowledgeRepository,profile.id,current,false);const result=await goalPlanRepository.appendGoal(profile.id,current,inputs.bindings,current.parentDigest,inputs.guard,headers.idempotencyKey,now());return reply.header('ETag',goalEtag(result.goal)).header('Idempotency-Replayed',String(result.replayed)).send({code:transition==='activate'?'OPERATING_GOAL_ACTIVATED':'OPERATING_GOAL_PAUSED',goal:result.goal});}
    const headers=exactMutationHeaders(request,current.canonicalDigest,goalEtag(current));if(request.body.canonicalDigest!==current.canonicalDigest)throw new GoalPlanContractError('GOAL_DIGEST_MISMATCH');
    if(transition==='activate'&&!['DRAFT','PAUSED'].includes(current.state))throw new GoalPlanContractError('GOAL_STATE_CONFLICT');if(transition==='pause'&&current.state!=='ACTIVE')throw new GoalPlanContractError('GOAL_STATE_CONFLICT');
    const goal=createOperatingGoalRevision({ownerId:profile.id,goalId:current.goalId,revision:current.revision+1,state:transition==='activate'?'ACTIVE':'PAUSED',parentDigest:current.canonicalDigest,value:goalInput(current),createdAt:now().toISOString()});const inputs=await approvedGoalInputs(knowledgeRepository,profile.id,goal,false);
    const result=await goalPlanRepository.appendGoal(profile.id,goal,inputs.bindings,current.canonicalDigest,inputs.guard,headers.idempotencyKey,now());return reply.header('ETag',goalEtag(result.goal)).header('Idempotency-Replayed',String(result.replayed)).send({code:transition==='activate'?'OPERATING_GOAL_ACTIVATED':'OPERATING_GOAL_PAUSED',goal:result.goal});
  });

  app.post('/api/v1/missions/compile',async(request,reply)=>{
    if(!isExactRecord(request.body,['goalId','goalDigest'])||typeof request.body.goalId!=='string'||typeof request.body.goalDigest!=='string')throw new GoalPlanContractError('MISSION_COMPILE_SCHEMA_INVALID');
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const goal=await requireGoal(goalPlanRepository,profile.id,request.body.goalId);const headers=exactMutationHeaders(request,goal.canonicalDigest,goalEtag(goal));if(request.body.goalDigest!==goal.canonicalDigest)throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
    const inputs=await approvedGoalInputs(knowledgeRepository,profile.id,goal,true);const workspace=await goalPlanRepository.getWorkspace(profile.id);const missionIntentId=stableContractId('mission',{ownerId:profile.id,goalId:goal.goalId});const lineage=workspace.bundles.filter((bundle)=>bundle.missionIntentId===missionIntentId).sort((left,right)=>right.generation-left.generation)[0];const existing=workspace.bundles.find((bundle)=>bundle.kind==='MISSION_INTENT'&&bundle.missionIntentId===missionIntentId&&bundle.inputBindings.operatingGoal.digest===goal.canonicalDigest&&bundle.inputBindings.knowledgeSnapshot.id===goal.knowledgeSnapshotId&&bundle.inputBindings.knowledgeSnapshot.digest===goal.knowledgeSnapshotDigest&&workspace.bundleStates.find((state)=>state.bundleId===bundle.bundleId)?.state!=='INVALIDATED');const bundle=compileMissionIntentV2({goal,knowledge:inputs.context,accountProfiles:inputs.bindings,lineage:existing?.kind==='MISSION_INTENT'?{generation:existing.generation,parentBundleId:existing.parentBundleId,parentBundleDigest:existing.parentBundleDigest}:{generation:(lineage?.generation??0)+1,parentBundleId:lineage?.bundleId??null,parentBundleDigest:lineage?.canonicalDigest??null}});const result=await goalPlanRepository.appendBundle(profile.id,bundle,goal.canonicalDigest,headers.idempotencyKey,now());
    return reply.status(result.replayed?200:201).header('ETag',bundleEtag(result.bundle)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'MISSION_INTENT_REPLAYED':'MISSION_INTENT_COMPILED',bundle:result.bundle,plannerExecution:{status:'NOT_RUN',fixtureAllowedForEngineering:true,agentTeamsExecuted:false}});
  });

  app.get<{Params:{bundleId:string}}>('/api/v1/mission-bundles/:bundleId',async(request,reply)=>{
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const bundle=await goalPlanRepository.getBundle(profile.id,request.params.bundleId);if(bundle===undefined)return reply.status(404).send(errorBody('MISSION_BUNDLE_NOT_FOUND'));const workspace=await goalPlanRepository.getWorkspace(profile.id);const effective=workspace.bundleStates.find((item)=>item.bundleId===bundle.bundleId);return reply.header('cache-control','no-store').header('ETag',bundleEtag(bundle)).send({code:'MISSION_BUNDLE_REOPENED',bundle,effectiveState:effective?.state??bundle.state,invalidation:workspace.invalidations.find((item)=>item.bundleId===bundle.bundleId)??null});
  });

  app.post('/api/v1/content-plans',async(request,reply)=>{
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const submission=request.body as PlannerSubmission;if(!isRecord(submission)||typeof submission.intentBundleId!=='string')throw new GoalPlanContractError('PLANNER_SUBMISSION_SCHEMA_MISMATCH');const intent=await requireIntent(goalPlanRepository,profile.id,submission.intentBundleId);const headers=exactMutationHeaders(request,intent.canonicalDigest,bundleEtag(intent));
    const planId=stableContractId('plan',{missionIntentId:intent.missionIntentId});const previous=await goalPlanRepository.getPlan(profile.id,planId);const submissionDigest=sha256Digest(submission);if(previous?.intentBundleId===intent.bundleId&&previous.plannerSubmissionDigest===submissionDigest){const replay=await goalPlanRepository.appendPlan(profile.id,previous,previous.parentDigest,headers.idempotencyKey,now());return reply.status(200).header('ETag',planEtag(replay.plan)).header('Idempotency-Replayed',String(replay.replayed)).send({code:'CONTENT_PLAN_REPLAYED',plan:replay.plan,agentTeamsExecuted:submission.evidenceMaturity==='AGENTTEAMS_RUNTIME',evidenceMaturity:submission.evidenceMaturity});}const plan=importPlannerSubmissionV2(intent,submission,now().toISOString(),previous);const result=await goalPlanRepository.appendPlan(profile.id,plan,previous?.canonicalDigest??null,headers.idempotencyKey,now());return reply.status(result.replayed?200:201).header('ETag',planEtag(result.plan)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'CONTENT_PLAN_REPLAYED':'CONTROLLED_PLANNER_SUBMISSION_IMPORTED',plan:result.plan,agentTeamsExecuted:submission.evidenceMaturity==='AGENTTEAMS_RUNTIME',evidenceMaturity:submission.evidenceMaturity});
  });

  app.get<{Params:{planId:string}}>('/api/v1/content-plans/:planId',async(request,reply)=>{
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const plan=await goalPlanRepository.getPlan(profile.id,request.params.planId);if(plan===undefined)return reply.status(404).send(errorBody('CONTENT_PLAN_NOT_FOUND'));return reply.header('cache-control','no-store').header('ETag',planEtag(plan)).send({code:'CONTENT_PLAN_REOPENED',plan});
  });

  app.patch<{Params:{planId:string}}>('/api/v1/content-plans/:planId',async(request,reply)=>{
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const current=await requirePlan(goalPlanRepository,profile.id,request.params.planId);if(!isExactRecord(request.body,['canonicalDigest','slots','currentBrief','sourceBindings'])||typeof request.body.canonicalDigest!=='string')throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');const intent=await requireIntent(goalPlanRepository,profile.id,current.intentBundleId);
    if(current.parentDigest===request.body.canonicalDigest&&sha256Digest({slots:current.slots,currentBrief:current.currentBrief,sourceBindings:current.sourceBindings})===sha256Digest({slots:request.body.slots,currentBrief:request.body.currentBrief,sourceBindings:request.body.sourceBindings})){const headers=exactMutationHeaders(request,current.parentDigest,previousPlanEtag(current));const result=await goalPlanRepository.appendPlan(profile.id,current,current.parentDigest,headers.idempotencyKey,now());return reply.header('ETag',planEtag(result.plan)).header('Idempotency-Replayed',String(result.replayed)).send({code:'CONTENT_PLAN_REPLAYED',plan:result.plan});}
    const headers=exactMutationHeaders(request,current.canonicalDigest,planEtag(current));if(request.body.canonicalDigest!==current.canonicalDigest)throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');
    const plan=reviseContentPlanV2(intent,current,{slots:request.body.slots as ContentPlanSlot[],currentBrief:request.body.currentBrief as ContentBrief,sourceBindings:request.body.sourceBindings as PlanSourceBinding[]},current.canonicalDigest,now().toISOString());const result=await goalPlanRepository.appendPlan(profile.id,plan,current.canonicalDigest,headers.idempotencyKey,now());return reply.header('ETag',planEtag(result.plan)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'CONTENT_PLAN_REPLAYED':'CONTENT_PLAN_REVISION_CREATED',plan:result.plan});
  });

  app.post<{Params:{planId:string}}>('/api/v1/content-plans/:planId/approve',async(request,reply)=>{
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const current=await requirePlan(goalPlanRepository,profile.id,request.params.planId);if(!isExactRecord(request.body,['canonicalDigest'])||typeof request.body.canonicalDigest!=='string')throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');const intent=await requireIntent(goalPlanRepository,profile.id,current.intentBundleId);
    if(current.state==='APPROVED'&&current.parentDigest===request.body.canonicalDigest){const headers=exactMutationHeaders(request,current.parentDigest,previousPlanEtag(current));const bundle=continueSelectedPlatformMissionV2(intent,current);const result=await goalPlanRepository.approvePlanAndAppendBundle(profile.id,current.parentDigest,current,bundle,headers.idempotencyKey,now());return reply.header('ETag',planEtag(result.plan)).header('X-LumiClaw-Bundle-ETag',bundleEtag(result.bundle)).header('Idempotency-Replayed',String(result.replayed)).send({code:'PLAN_APPROVAL_REPLAYED',plan:result.plan,bundle:result.bundle,agentTeamsExecuted:false,externalActionAllowed:false});}
    const headers=exactMutationHeaders(request,current.canonicalDigest,planEtag(current));if(request.body.canonicalDigest!==current.canonicalDigest)throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');
    const approved=approveContentPlanV2(intent,current,current.canonicalDigest,now().toISOString());const bundle=continueSelectedPlatformMissionV2(intent,approved);const result=await goalPlanRepository.approvePlanAndAppendBundle(profile.id,current.canonicalDigest,approved,bundle,headers.idempotencyKey,now());return reply.header('ETag',planEtag(result.plan)).header('X-LumiClaw-Bundle-ETag',bundleEtag(result.bundle)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'PLAN_APPROVAL_REPLAYED':'CONTENT_PLAN_APPROVED_EXECUTION_COMPILED',plan:result.plan,bundle:result.bundle,agentTeamsExecuted:false,externalActionAllowed:false});
  });

  app.get('/api/v1/artifacts',async(_request,reply)=>{const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;return reply.header('cache-control','no-store').send({code:'ARTIFACT_WORKSPACE_REOPENED',workspace:await artifactPublishRepository.getWorkspace(profile.id),agentTeamsExecuted:false,fixtureBoundary:'CONTROLLED_FIXTURE_ONLY_UNTIL_SDD_007'});});

  app.post('/api/v1/artifacts/controlled-fixture',async(request,reply)=>{
    if(!isExactRecord(request.body,['activationUnitId','bundleId','xMode'])||typeof request.body.activationUnitId!=='string'||typeof request.body.bundleId!=='string'||!['SINGLE','THREAD'].includes(String(request.body.xMode)))throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');const body=request.body as {activationUnitId:string;bundleId:string;xMode:'SINGLE'|'THREAD'};const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const bundle=await requireExecution(goalPlanRepository,profile.id,body.bundleId);const headers=artifactMutationHeaders(request,bundle.canonicalDigest,bundleEtag(bundle));const unit=bundle.activationUnits.find((item)=>item.activationUnitId===body.activationUnitId);if(unit===undefined)throw new ArtifactContractError('ARTIFACT_PLATFORM_NOT_SELECTED');const submission=createControlledProducerSubmission(bundle,unit,{xMode:body.xMode,submittedAt:now().toISOString()});return acceptProducerArtifact(profile.id,submission,bundle,headers.idempotencyKey,artifactPublishRepository,now(),reply);
  });

  app.post('/api/v1/artifact-submissions',async(request,reply)=>{
    const submission=parseProducerSubmission(request.body);if(submission.evidenceMaturity!=='CONTROLLED_FIXTURE'||submission.agentTeamsExecuted!==false)throw new ArtifactContractError('ARTIFACT_RUNTIME_AUTHORITY_REQUIRED');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const bundle=await requireExecution(goalPlanRepository,profile.id,submission.inputBindings.executionBundle.id);const headers=artifactMutationHeaders(request,bundle.canonicalDigest,bundleEtag(bundle));return acceptProducerArtifact(profile.id,submission,bundle,headers.idempotencyKey,artifactPublishRepository,now(),reply);
  });

  app.get<{Params:{artifactId:string}}>('/api/v1/artifacts/:artifactId',async(request,reply)=>{const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const revision=await artifactPublishRepository.getRevision(profile.id,request.params.artifactId);if(revision===undefined)return reply.status(404).send(errorBody('ARTIFACT_NOT_FOUND'));const workspace=await artifactPublishRepository.getWorkspace(profile.id);return reply.header('cache-control','no-store').header('ETag',artifactRevisionEtag(revision)).send({code:'ARTIFACT_REVISION_REOPENED',revision,effectiveState:effectiveArtifactState(workspace,revision),history:{audits:workspace.audits.filter((item)=>item.artifactRevisionId===revision.id),ownerDecisions:workspace.ownerDecisions.filter((item)=>item.artifactRevisionId===revision.id),packages:workspace.packages.filter((item)=>item.artifactRevisionId===revision.id),invalidations:workspace.invalidations.filter((item)=>item.artifactRevisionId===revision.id)}});});

  app.post<{Params:{artifactId:string}}>('/api/v1/artifacts/:artifactId/edit',async(request,reply)=>{if(!isExactRecord(request.body,['canonicalDigest','payload'])||typeof request.body.canonicalDigest!=='string')throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');const payload=parseArtifactPayload(request.body.payload);const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const base=await requireArtifactRevision(artifactPublishRepository,profile.id,request.params.artifactId);const headers=artifactMutationHeaders(request,base.canonicalDigest,artifactRevisionEtag(base));if(request.body.canonicalDigest!==base.canonicalDigest)throw new ArtifactContractError('OWNER_DECISION_STALE');const workspace=await artifactPublishRepository.getWorkspace(profile.id);const head=latestUnitRevision(workspace.revisions,base.activationUnitId);if(head?.id!==base.id)throw new ArtifactContractError('OWNER_DECISION_STALE');const revision=createOwnerEditRevision({ownerId:profile.id,ownerIdentityId:profile.id,base,payload,revision:base.revision+1,createdAt:now().toISOString()});const result=await artifactPublishRepository.appendRevision(profile.id,revision,base.canonicalDigest,headers.idempotencyKey,now());return reply.status(201).header('ETag',artifactRevisionEtag(result.revision)).header('Idempotency-Replayed',String(result.replayed)).send({code:'OWNER_EDIT_ARTIFACT_REVISION_CREATED',...result,requiresIndependentReaudit:true});});

  app.post<{Params:{artifactId:string}}>('/api/v1/artifacts/:artifactId/regenerate',async(request,reply)=>{if(!isExactRecord(request.body,['canonicalDigest','reason'])||typeof request.body.canonicalDigest!=='string'||typeof request.body.reason!=='string')throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const revision=await requireArtifactRevision(artifactPublishRepository,profile.id,request.params.artifactId);const headers=artifactMutationHeaders(request,revision.canonicalDigest,artifactRevisionEtag(revision));if(request.body.canonicalDigest!==revision.canonicalDigest)throw new ArtifactContractError('OWNER_DECISION_STALE');const value=createRegenerationRequest({ownerId:profile.id,revision,requestedBy:profile.id,reason:request.body.reason,requestedAt:now().toISOString()});const result=await artifactPublishRepository.appendRegenerationRequest(profile.id,value,revision.canonicalDigest,headers.idempotencyKey,now());return reply.status(201).header('Idempotency-Replayed',String(result.replayed)).send({code:'ARTIFACT_REGENERATION_REQUEST_CREATED',...result,agentTeamsExecuted:false,nextState:'WAITING_FOR_SDD_007_RUNTIME'});});

  app.post<{Params:{artifactId:string}}>('/api/v1/artifacts/:artifactId/audits',async(request,reply)=>{if(!isExactRecord(request.body,['canonicalDigest','controlledFixture','findings','result'])||typeof request.body.canonicalDigest!=='string'||request.body.controlledFixture!==true||!['PASS','FAIL','ESCALATE'].includes(String(request.body.result)))throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');const resultCode=request.body.result as AuditResult;const suppliedFindings=parseArtifactAuditFindings(request.body.findings);const findings=suppliedFindings.length===0?controlledAuditFindings(resultCode):suppliedFindings;const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const revision=await requireArtifactRevision(artifactPublishRepository,profile.id,request.params.artifactId);const headers=artifactMutationHeaders(request,revision.canonicalDigest,artifactRevisionEtag(revision));if(request.body.canonicalDigest!==revision.canonicalDigest)throw new ArtifactContractError('OWNER_DECISION_STALE');const audit=createArtifactAuditDecision({ownerId:profile.id,revision,auditorIdentityId:'controlled-independent-auditor-a5',result:resultCode,findings,evidenceBindings:[revision.inputBindings.knowledgeSnapshot.digest,revision.inputBindings.approvedPlan.digest],createdAt:now().toISOString()});const result=await artifactPublishRepository.appendAudit(profile.id,audit,revision.canonicalDigest,headers.idempotencyKey,now());return reply.status(result.replayed?200:201).header('ETag',auditDecisionEtag(result.audit)).header('Idempotency-Replayed',String(result.replayed)).send({code:'CONTROLLED_INDEPENDENT_AUDIT_RECORDED',...result,agentTeamsExecuted:false,controlledFixture:true});});

  app.post<{Params:{artifactId:string}}>('/api/v1/artifacts/:artifactId/owner-decisions',async(request,reply)=>{if(!isExactRecord(request.body,['auditDecisionDigest','auditDecisionId','canonicalDigest','reason','result'])||typeof request.body.canonicalDigest!=='string'||typeof request.body.auditDecisionId!=='string'||typeof request.body.auditDecisionDigest!=='string'||!['APPROVE','REJECT'].includes(String(request.body.result))||(request.body.reason!==null&&typeof request.body.reason!=='string'))throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const revision=await requireArtifactRevision(artifactPublishRepository,profile.id,request.params.artifactId);const audit=await requireArtifactAudit(artifactPublishRepository,profile.id,request.body.auditDecisionId);const headers=artifactMutationHeaders(request,revision.canonicalDigest,artifactRevisionEtag(revision));if(request.body.canonicalDigest!==revision.canonicalDigest||request.body.auditDecisionDigest!==audit.canonicalDigest)throw new ArtifactContractError('OWNER_DECISION_STALE');const decision=createArtifactOwnerDecision({ownerId:profile.id,revision,audit,result:request.body.result as OwnerArtifactDecisionResult,ownerIdentityId:profile.id,reason:request.body.reason as string|null,decidedAt:now().toISOString()});const result=await artifactPublishRepository.appendOwnerDecision(profile.id,decision,audit.canonicalDigest,headers.idempotencyKey,now());return reply.status(201).header('ETag',ownerDecisionEtag(result.decision)).header('Idempotency-Replayed',String(result.replayed)).send({code:decision.result==='APPROVE'?'EXACT_ARTIFACT_REVISION_APPROVED':'EXACT_ARTIFACT_REVISION_REJECTED',...result,externalActionAllowed:false});});

  app.get('/api/v1/manual-publish-packages',async(_request,reply)=>{const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const workspace=await artifactPublishRepository.getWorkspace(profile.id);return reply.header('cache-control','no-store').send({code:'MANUAL_PUBLISH_PACKAGE_LIST',packages:workspace.packages.map((pack)=>({...pack,effectiveState:effectivePackageState(workspace,pack)})),externalState:'UNVERIFIED_EXTERNAL_STATE'});});
  app.post('/api/v1/manual-publish-packages',async(request,reply)=>{if(!isExactRecord(request.body,['artifactRevisionDigest','artifactRevisionId','auditDecisionDigest','auditDecisionId','ownerDecisionDigest','ownerDecisionId'])||Object.values(request.body).some((value)=>typeof value!=='string'))throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const revision=await requireArtifactRevision(artifactPublishRepository,profile.id,String(request.body.artifactRevisionId));const audit=await requireArtifactAudit(artifactPublishRepository,profile.id,String(request.body.auditDecisionId));const decision=await requireArtifactOwnerDecision(artifactPublishRepository,profile.id,String(request.body.ownerDecisionId));const headers=artifactMutationHeaders(request,decision.canonicalDigest,ownerDecisionEtag(decision));if(request.body.artifactRevisionDigest!==revision.canonicalDigest||request.body.auditDecisionDigest!==audit.canonicalDigest||request.body.ownerDecisionDigest!==decision.canonicalDigest)throw new ArtifactContractError('PACKAGE_INPUT_INVALIDATED');const pack=buildManualPublishPackage({ownerId:profile.id,revision,audit,decision,createdAt:now().toISOString()});const result=await artifactPublishRepository.appendPackage(profile.id,pack,decision.canonicalDigest,headers.idempotencyKey,now());return reply.status(result.replayed?200:201).header('ETag',packageEtag(result.package)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'MANUAL_PUBLISH_PACKAGE_REPLAYED':'MANUAL_PUBLISH_PACKAGE_READY',...result,externalState:'UNVERIFIED_EXTERNAL_STATE'});});
  app.get<{Params:{packageId:string}}>('/api/v1/manual-publish-packages/:packageId',async(request,reply)=>{const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const pack=await artifactPublishRepository.getPackage(profile.id,request.params.packageId);if(pack===undefined)return reply.status(404).send(errorBody('PACKAGE_NOT_FOUND'));const workspace=await artifactPublishRepository.getWorkspace(profile.id);return reply.header('cache-control','no-store').header('ETag',packageEtag(pack)).send({code:'MANUAL_PUBLISH_PACKAGE_REOPENED',package:pack,effectiveState:effectivePackageState(workspace,pack)});});
  app.get<{Params:{packageId:string}}>('/api/v1/manual-publish-packages/:packageId/download',async(request,reply)=>{const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const pack=await artifactPublishRepository.getPackage(profile.id,request.params.packageId);if(pack===undefined)return reply.status(404).send(errorBody('PACKAGE_NOT_FOUND'));const workspace=await artifactPublishRepository.getWorkspace(profile.id);if(effectivePackageState(workspace,pack)==='INVALIDATED')throw new ArtifactContractError('PACKAGE_INPUT_INVALIDATED');return reply.header('content-type','application/vnd.lumiclaw.manual-publish-package+json').header('content-disposition',`attachment; filename=lumiclaw-${pack.platformCode.toLowerCase()}-${pack.id}.json`).send({schemaVersion:3,packageId:pack.id,manifestDigest:pack.manifestDigest,orderedFiles:pack.orderedFiles,externalState:'UNVERIFIED_EXTERNAL_STATE'});});
  for(const [pathSuffix,action] of [['copy-event','COPY_TEXT'],['download-event','DOWNLOAD_PACKAGE'],['open-official','OPEN_OFFICIAL_PUBLISH_PAGE']] as const)app.post<{Params:{packageId:string}}>(`/api/v1/manual-publish-packages/:packageId/${pathSuffix}`,async(request,reply)=>{if(!isExactRecord(request.body,[]))throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const pack=await artifactPublishRepository.getPackage(profile.id,request.params.packageId);if(pack===undefined)return reply.status(404).send(errorBody('PACKAGE_NOT_FOUND'));const headers=artifactMutationHeaders(request,pack.manifestDigest,packageEtag(pack));const event=recordPackageHelperEvent({ownerId:profile.id,value:pack,action,createdAt:now().toISOString()});const result=await artifactPublishRepository.appendHelperEvent(profile.id,event,headers.idempotencyKey,now());return reply.header('Idempotency-Replayed',String(result.replayed)).send({code:`PACKAGE_${action}_RECORDED`,...result,officialUrl:action==='OPEN_OFFICIAL_PUBLISH_PAGE'?pack.officialPublishUrlRef.url:null,externalState:'UNVERIFIED_EXTERNAL_STATE',published:false});});

  app.post('/api/v1/local-onboarding/example', async (_request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    await requireMutableOnboardingSession(localPresenceRepository, profile.id);
    const campaign = await ensurePublicSafeCampaign();
    const session = await localPresenceRepository.chooseExample(profile.id, campaign.document.organizationId, campaign.document.id, {marketCodes: ['US'], contentLocales: ['en-US'], platforms: ['LINKEDIN', 'X', 'BLUESKY', 'XIAOHONGSHU'], defaultTimeZone: 'America/Los_Angeles'}, now());
    return reply.status(201).send({code: 'PUBLIC_SAFE_EXAMPLE_READY', source: 'PUBLIC_SAFE_EXAMPLE', externalActionAllowed: false, session, campaign});
  });

  app.post('/api/v1/local-onboarding/materials-path', async (_request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    await requireMutableOnboardingSession(localPresenceRepository, profile.id);
    const session = await localPresenceRepository.selectLocalMaterials(profile.id, now());
    return {code: 'LOCAL_MATERIAL_PATH_READY', session, acceptedTypes: ['.md', '.txt'], maxBytes: LOCAL_MATERIAL_MAX_BYTES, plannedTypes: ['.pdf', '.docx']};
  });

  app.post('/api/v1/local-onboarding/context', async (request, reply) => {
    if (isSecretBearingObject(request.body)) return reply.status(422).send(errorBody('BROWSER_SECRET_FIELD_FORBIDDEN'));
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    await requireMutableOnboardingSession(localPresenceRepository, profile.id);
    const session = await localPresenceRepository.setContext(profile.id, validateOnboardingContext(request.body), now());
    return {code: 'LOCAL_CONTEXT_READY', session};
  });

  app.post('/api/v1/local-onboarding/complete', async (request, reply) => {
    if (isSecretBearingObject(request.body)) return reply.status(422).send(errorBody('BROWSER_SECRET_FIELD_FORBIDDEN'));
    const identity = validateLocalCampaignIdentityInput(request.body);
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const currentSession = await localPresenceRepository.getSession(profile.id);
    if (currentSession === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
    if (currentSession.state === 'COMPLETED') throw new LocalPresenceContractError('LOCAL_ONBOARDING_ALREADY_COMPLETED');
    if (currentSession.path !== 'LOCAL_MATERIALS' || !['CONTEXT_READY', 'COMPLETION_PENDING'].includes(currentSession.state) || currentSession.marketCodes.length === 0 || currentSession.contentLocales.length === 0 || currentSession.platforms.length === 0 || currentSession.defaultTimeZone === null) throw new LocalPresenceContractError('LOCAL_ONBOARDING_NOT_READY');
    const materials = (await localPresenceRepository.listMaterials(profile.id)).filter((item) => item.state === 'READY');
    const document = createLocalPrivateCampaignDocument({
      ownerProfileId: profile.id,
      ownerDisplayName: profile.displayName,
      profileCreatedAt: profile.createdAt,
      identity,
      context: {marketCodes: currentSession.marketCodes, contentLocales: currentSession.contentLocales, platforms: currentSession.platforms, defaultTimeZone: currentSession.defaultTimeZone},
      materials
    });
    const documentDigest = sha256Digest(document);
    await localPresenceRepository.reserveLocalOnboardingCompletion(profile.id, materials.map((material) => material.id), documentDigest, now());
    const created = await repository.create(document.organizationId, document, `sdd006-local-private-${profile.id}`, documentDigest, now());
    if (!created.ok) throw new LocalPresenceContractError('LOCAL_CAMPAIGN_INITIALIZATION_CONFLICT');
    const session = await localPresenceRepository.completeLocalOnboarding(profile.id, document.organizationId, document.id, documentDigest, now());
    return {code: 'LOCAL_ONBOARDING_COMPLETE', source: 'LOCAL_PRIVATE_USER_CONFIRMED', dataMode: 'LOCAL_PRIVATE', externalActionAllowed: false, session, campaign: created.envelope};
  });

  app.get('/api/v1/local-materials', async (_request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    return reply.header('cache-control', 'no-store').send({code: 'LOCAL_MATERIAL_LIST', materials: await localPresenceRepository.listMaterials(profile.id)});
  });

  app.post('/api/v1/local-materials', async (request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    await requireMutableOnboardingSession(localPresenceRepository, profile.id);
    const encodedName = request.headers['x-lumiclaw-file-name'];
    if (typeof encodedName !== 'string') return reply.status(422).send(errorBody('LOCAL_MATERIAL_FILE_NAME_REQUIRED'));
    if (!(request.body instanceof Buffer)) return reply.status(422).send(errorBody('LOCAL_MATERIAL_BYTES_REQUIRED'));
    const material = await localPresenceRepository.ingestMaterial({ownerProfileId: profile.id, fileName: decodeFileName(encodedName), declaredMediaType: request.headers['content-type']?.split(';')[0] ?? 'application/octet-stream', bytes: request.body}, now());
    return reply.status(201).header('cache-control', 'no-store').send({code: 'LOCAL_MATERIAL_READY', material});
  });

  app.delete<{Params: {materialId: string}}>('/api/v1/local-materials/:materialId', async (request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    const removed = await localPresenceRepository.deleteMaterial(profile.id, request.params.materialId);
    if (!removed) return reply.status(404).send(errorBody('LOCAL_MATERIAL_NOT_FOUND'));
    return {code: 'LOCAL_MATERIAL_DELETED'};
  });

  app.get('/api/v1/environment-readiness', async (_request, reply) => {
    const checkedAt = now().toISOString();
    let postgresAvailable = false;
    try { postgresAvailable = await localPresenceRepository.health(); } catch {}
    const runtime=await runtimeReadiness(persistentRuntimeRepository,options.gatewayReadinessProbe,now());
    return reply.header('cache-control', 'no-store').send({code: 'ENVIRONMENT_READINESS', secretCollectionAllowed: false, items: [
      {service: 'WEB', state: 'UNKNOWN', source: 'CLIENT_OBSERVATION', checkedAt, reasonCode: 'WEB_CONFIRMS_AFTER_RESPONSE', remediation: null},
      {service: 'API', state: 'AVAILABLE', source: 'API_SELF_CHECK', checkedAt, reasonCode: 'READINESS_HANDLER_REACHED', remediation: null},
      {service: 'POSTGRESQL', state: postgresAvailable ? 'AVAILABLE' : 'UNAVAILABLE', source: 'POSTGRESQL_PROBE', checkedAt, reasonCode: postgresAvailable ? 'LOCAL_SCHEMA_REACHABLE' : 'LOCAL_SCHEMA_UNAVAILABLE', remediation: postgresAvailable ? null : 'Start the project-scoped PostgreSQL and migration services.'},
      {service:'MODEL_GATEWAY',state:runtime.probes.gateway.state,source:'MODEL_GATEWAY_HEALTH',checkedAt,reasonCode:runtime.probes.gateway.reasonCode,remediation:runtime.probes.gateway.remediation},
      {service:'MISSION_WORKER',state:runtime.probes.worker.state,source:'MISSION_WORKER_HEARTBEAT',checkedAt,reasonCode:runtime.probes.worker.reasonCode,remediation:runtime.probes.worker.remediation},
      {service:'AGENTTEAMS_RUNTIME',state:runtime.probes.agentTeams.state,source:'PINNED_AGENTTEAMS_CONTROLLER',checkedAt,reasonCode:runtime.probes.agentTeams.reasonCode,remediation:runtime.probes.agentTeams.remediation},
      {service:'PERSISTENT_RUNTIME',state:runtime.state,source:'FOUR_WAY_AUTHORITY_CONJUNCTION',checkedAt,reasonCode:runtime.reasonCode,remediation:runtime.remediation}
    ]});
  });

  app.get('/api/v1/runtime/readiness',async(_request,reply)=>reply.header('cache-control','no-store').send({code:'RUNTIME_READINESS',secretCollectionAllowed:false,...await runtimeReadiness(persistentRuntimeRepository,options.gatewayReadinessProbe,now())}));

  app.get('/api/v1/ai-team', async (_request,reply) => {
    if(persistentRuntimeRepository===undefined)return {code: 'AI_TEAM_ROSTER', metricSource: 'NO_RUNTIME_OBSERVATION', agents: aiTeamRoster()};
    const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;
    const combined=await runtimeReadiness(persistentRuntimeRepository,options.gatewayReadinessProbe,now());
    if(combined.probes.controlPlane.state==='UNREACHABLE')return reply.status(503).send(errorBody('RUNTIME_UNREACHABLE'));
    const projection=await persistentRuntimeRepository.getProjection(profile.id);const configured=aiTeamRoster();
    return reply.header('cache-control','no-store').send({...projection,code:'RUNTIME_TEAM_PROJECTION',metricSource:'POSTGRESQL_RUNTIME_OBSERVATION',readiness:combined.state,reasonCode:combined.reasonCode,lastHeartbeat:combined.probes.worker.state==='READY'?projection.lastHeartbeat:null,agents:configured.map((agent)=>{const live=projection.agents.find((item)=>item.roleId===agent.roleId)!;return {...agent,status:live.status,runtimeActorId:live.runtimeActorId,attemptId:live.attemptId,taskId:live.taskId,metrics:{tokens:null,tokenSource:'NO_RUNTIME_OBSERVATION',dailyCompleted:projection.attempts.filter((item)=>item.roleId===agent.roleId&&item.state==='ACCEPTED').length,completionSource:'POSTGRESQL_RUNTIME_OBSERVATION'}};})});
  });

  app.post<{Body:{bundleId:string;bundleDigest:string}}>('/api/v1/mission-runs',async(request,reply)=>{
    if(persistentRuntimeRepository===undefined)return reply.status(503).send(errorBody('RUNTIME_NOT_CONFIGURED'));const profile=await requireLocalProfile(localPresenceRepository,reply);const key=requireIdempotency(request,reply);if(profile===undefined||key===undefined)return;
    if(!isExactRecord(request.body,['bundleDigest','bundleId'])||typeof request.body.bundleId!=='string'||!isDigest(request.body.bundleDigest))return reply.status(422).send(errorBody('SUBMISSION_SCHEMA_INVALID'));
    const bundle=await goalPlanRepository.getBundle(profile.id,request.body.bundleId);if(bundle===undefined)return reply.status(404).send(errorBody('MISSION_BUNDLE_NOT_FOUND'));if(bundle.canonicalDigest!==request.body.bundleDigest)return reply.status(412).send(errorBody('SUBMISSION_INPUT_MISMATCH'));
    const result=await persistentRuntimeRepository.createRun(profile.id,bundle,profile.id,key,now());return reply.status(result.replayed?200:201).header('cache-control','no-store').header('ETag',runtimeRunEtag(result.run)).header('idempotency-replayed',String(result.replayed)).header('location',`/api/v1/mission-runs/${result.run.id}`).send({code:result.replayed?'MISSION_RUN_REPLAYED':'MISSION_RUN_CREATED',...result});
  });
  app.get<{Params:{runId:string}}>('/api/v1/mission-runs/:runId',async(request,reply)=>{if(persistentRuntimeRepository===undefined)return reply.status(503).send(errorBody('RUNTIME_NOT_CONFIGURED'));const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const run=await persistentRuntimeRepository.getRun(profile.id,request.params.runId);if(run===undefined)return reply.status(404).send(errorBody('MISSION_RUN_NOT_FOUND'));return reply.header('cache-control','no-store').header('ETag',runtimeRunEtag(run)).send({code:'MISSION_RUN',run,projection:await persistentRuntimeRepository.getProjection(profile.id,run.id)});});
  app.get<{Params:{runId:string}}>('/api/v1/mission-runs/:runId/team',async(request,reply)=>{if(persistentRuntimeRepository===undefined)return reply.status(503).send(errorBody('RUNTIME_NOT_CONFIGURED'));const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const run=await persistentRuntimeRepository.getRun(profile.id,request.params.runId);if(run===undefined)return reply.status(404).send(errorBody('MISSION_RUN_NOT_FOUND'));return reply.header('cache-control','no-store').send(await persistentRuntimeRepository.getProjection(profile.id,run.id));});
  app.get<{Params:{runId:string}}>('/api/v1/mission-runs/:runId/events',async(request,reply)=>{if(persistentRuntimeRepository===undefined)return reply.status(503).send(errorBody('RUNTIME_NOT_CONFIGURED'));const profile=await requireLocalProfile(localPresenceRepository,reply);if(profile===undefined)return;const run=await persistentRuntimeRepository.getRun(profile.id,request.params.runId);if(run===undefined)return reply.status(404).send(errorBody('MISSION_RUN_NOT_FOUND'));const projection=await persistentRuntimeRepository.getProjection(profile.id,run.id);return reply.header('cache-control','no-store').send({code:'RUNTIME_EVENT_LIST',runId:run.id,events:projection.events});});
  app.post<{Params:{runId:string}}>('/api/v1/mission-runs/:runId/cancel',async(request,reply)=>{if(persistentRuntimeRepository===undefined)return reply.status(503).send(errorBody('RUNTIME_NOT_CONFIGURED'));const profile=await requireLocalProfile(localPresenceRepository,reply);const key=requireIdempotency(request,reply);const expected=runtimeExpectedVersion(request,request.params.runId);if(profile===undefined||key===undefined)return;if(expected===undefined)return reply.status(428).send(errorBody('ETAG_REQUIRED'));const result=await persistentRuntimeRepository.cancelRun(profile.id,request.params.runId,expected,key,now());return reply.header('cache-control','no-store').header('ETag',runtimeRunEtag(result.run)).header('idempotency-replayed',String(result.replayed)).send({code:'MISSION_RUN_CANCEL_RESULT',...result});});
  app.post<{Params:{runId:string}}>('/api/v1/mission-runs/:runId/retry-blocked',async(request,reply)=>{if(persistentRuntimeRepository===undefined)return reply.status(503).send(errorBody('RUNTIME_NOT_CONFIGURED'));const profile=await requireLocalProfile(localPresenceRepository,reply);const key=requireIdempotency(request,reply);const expected=runtimeExpectedVersion(request,request.params.runId);if(profile===undefined||key===undefined)return;if(expected===undefined)return reply.status(428).send(errorBody('ETAG_REQUIRED'));const result=await persistentRuntimeRepository.retryBlocked(profile.id,request.params.runId,expected,key,now());return reply.header('cache-control','no-store').header('ETag',runtimeRunEtag(result.run)).header('idempotency-replayed',String(result.replayed)).send({code:'MISSION_RUN_RETRY_RESULT',...result});});

  app.get('/api/v1/skills', async () => ({code: 'REPOSITORY_SKILL_LIST', source: 'REPOSITORY_OWNED', skills: repositorySkills.map(({id, name, roleIds}) => ({id, name, roleIds, state: 'AVAILABLE', license: 'Apache-2.0'}))}));
  app.get<{Params: {skillId: string}}>('/api/v1/skills/:skillId', async (request, reply) => {
    const skill = repositorySkills.find((item) => item.id === request.params.skillId);
    if (skill === undefined) return reply.status(404).send(errorBody('SKILL_NOT_FOUND'));
    const content = await readFile(path.join(process.cwd(), 'skills', skill.id, 'SKILL.md'), 'utf8');
    return {code: 'REPOSITORY_SKILL_REOPENED', source: 'REPOSITORY_OWNED', skill: {...skill, license: 'Apache-2.0', files: ['SKILL.md'], content}};
  });

  app.get('/api/v1/manual-publish-handoffs', async (_request, reply) => {
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    return {code: 'MANUAL_HANDOFF_LIST', authorization: blockedManualPublishAuthorization(), handoffs: await localPresenceRepository.listManualHandoffs(profile.id)};
  });

  app.post('/api/v1/manual-publish-handoffs', async (request, reply) => {
    if (isSecretBearingObject(request.body)) return reply.status(422).send(errorBody('BROWSER_SECRET_FIELD_FORBIDDEN'));
    const profile = await requireLocalProfile(localPresenceRepository, reply); if (profile === undefined) return;
    if (!isManualHandoffBody(request.body)) return reply.status(422).send(errorBody('MANUAL_HANDOFF_SCHEMA_INVALID'));
    const body = request.body;
    const campaign = await repository.get(body.organizationId, body.campaignId);
    const revision = campaign?.document.artifactRevisions.find((item) => item.id === body.artifactRevisionId && item.platform === body.platform);
    if (campaign === undefined || revision === undefined) return reply.status(404).send(errorBody('MANUAL_HANDOFF_ARTIFACT_NOT_FOUND'));
    return reply.status(409).send({
      code: 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED',
      mode: campaign.mode,
      live: false,
      createsHandoff: false,
      createsPublishedState: false,
      readBackEvidencePresent: false,
      authorization: blockedManualPublishAuthorization()
    });
  });

  app.get('/api/v1/openapi.json', async () => openApiDocument);
  app.get('/api/v1/campaigns/demo-template', async () => ({code: 'DEMO_TEMPLATE_READY', mode: 'DEMO_SEED', live: false, document: createDemoCampaignDocument()}));

  app.get('/api/v1/campaigns', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    if (organizationId === undefined) return;
    const campaigns = await repository.list(organizationId);
    return {code: 'CAMPAIGN_LIST', mode: campaigns[0]?.mode ?? 'DEMO_SEED', live: false, campaigns};
  });

  app.post('/api/v1/campaigns', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    const idempotencyKey = requireIdempotency(request, reply);
    if (organizationId === undefined || idempotencyKey === undefined) return;
    const document = request.body as CampaignDocument;
    if (document?.organizationId !== organizationId) return reply.status(403).send(errorBody('ORGANIZATION_SCOPE_MISMATCH'));
    if (document?.dataMode === 'LOCAL_PRIVATE') return reply.status(403).send(errorBody('LOCAL_PRIVATE_CAMPAIGN_REQUIRES_ONBOARDING'));
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
    if (value.readiness === 'BLOCKED') return reply.status(409).send({...errorBody('CAMPAIGN_BLOCKED'), mode: value.mode, digest: value.digest, version: value.version, gapCodes: value.gapCodes});
    return {code: 'MISSION_CONTRACT_READY', live: false, ...value};
  });

  app.post<{Params: CampaignParams; Body: SchedulePreviewBody}>('/api/v1/campaigns/:campaignId/schedule-preview', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    if (organizationId === undefined) return;
    const envelope = await repository.get(organizationId, request.params.campaignId);
    if (envelope === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    try {
      const input = parseSchedulePreviewBody(request.body);
      const value = createPublishingSchedule({...input, organizationId, campaignId: request.params.campaignId, artifactRevisions: envelope.document.artifactRevisions}, now());
      return {code: 'SCHEDULE_PREVIEW_READY', mode: envelope.mode, live: false, executionAllowed: false, ...value};
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
  });

  app.get<{Params: CampaignParams}>('/api/v1/campaigns/:campaignId/shadow-missions', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); if (organizationId === undefined) return;
    const campaign = await repository.get(organizationId, request.params.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    const missions = await shadowRepository.getByCampaign(organizationId, request.params.campaignId);
    return {code: 'SHADOW_MISSION_LIST', mode: campaign.mode, live: false, externalActionAllowed: false, missions};
  });

  app.post<{Params: CampaignParams; Body: {sourceDigest: string; fault: 'BETA_TO_GA'; providerMode?: 'PUBLIC_SAFE_MOCK' | 'LIVE_DEEPSEEK_UAT'; providerModel?: 'deepseek-v4-flash' | 'deepseek-v4-pro'}}>('/api/v1/campaigns/:campaignId/shadow-missions', async (request, reply) => {
    const organizationId = requireOrganization(request, reply); const idempotencyKey = requireIdempotency(request, reply); const ifMatch = request.headers['if-match'];
    if (organizationId === undefined || idempotencyKey === undefined) return;
    if (typeof ifMatch !== 'string' || ifMatch.length === 0) return reply.status(428).send(errorBody('ETAG_REQUIRED'));
    const campaign = await repository.get(organizationId, request.params.campaignId); if (campaign === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    if (campaign.mode === 'LOCAL_PRIVATE') return reply.status(403).send({...errorBody('LOCAL_PRIVATE_RUNTIME_REQUIRES_SDD_007'), mode: 'LOCAL_PRIVATE'});
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
  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof KnowledgeContractError) {
      const profile = await localPresenceRepository.getProfile().catch(() => undefined);
      if (profile !== undefined) await knowledgeRepository.recordSecurityRejection(profile.id,error.code,now()).catch(() => undefined);
    }
    return sendDomainOrUnavailable(reply, error);
  });
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
  if (error instanceof LocalPresenceContractError) {
    const status = ['LOCAL_PROFILE_ALREADY_EXISTS', 'LOCAL_ONBOARDING_ALREADY_COMPLETED', 'LOCAL_ONBOARDING_COMPLETION_IN_PROGRESS', 'LOCAL_ONBOARDING_COMPLETION_CONFLICT', 'LOCAL_ONBOARDING_MATERIAL_SET_CHANGED', 'LOCAL_MATERIAL_BOUND_TO_CAMPAIGN', 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED'].includes(error.code) ? 409 : error.code.includes('NOT_FOUND') ? 404 : error.code.includes('TYPE_PLANNED') || error.code.includes('TYPE_UNSUPPORTED') ? 415 : 422;
    return reply.status(status).send(errorBody(error.code));
  }
  if (error instanceof KnowledgeContractError) {
    const status = error.code === 'OWNER_BOUNDARY_VIOLATION' ? 403 : error.code === 'SNAPSHOT_STALE' ? 412 : ['IDEMPOTENCY_KEY_REUSED','KNOWLEDGE_CONFLICT_UNRESOLVED','SNAPSHOT_GAPS_UNRESOLVED'].includes(error.code) ? 409 : error.code.includes('NOT_FOUND') ? 404 : error.code === 'SOURCE_TYPE_PLANNED' ? 415 : error.code === 'ETAG_REQUIRED' || error.code === 'IDEMPOTENCY_KEY_REQUIRED' || error.code === 'SNAPSHOT_DIGEST_REQUIRED' ? 428 : 422;
    return reply.status(status).send(errorBody(error.code));
  }
  if (error instanceof GoalPlanContractError) {
    const status = error.code === 'OWNER_BOUNDARY_VIOLATION' ? 403 : error.code.includes('NOT_FOUND') ? 404 : error.code.includes('STALE') || error.code.includes('VERSION_CONFLICT') || error.code.includes('DIGEST_MISMATCH') || error.code === 'MISSION_INPUT_CHANGED' ? 412 : error.code === 'IDEMPOTENCY_KEY_REQUIRED' || error.code === 'ETAG_REQUIRED' ? 428 : ['IDEMPOTENCY_KEY_REUSED','GOAL_STATE_CONFLICT','PLAN_STATE_CONFLICT','PRODUCER_COVERAGE_REQUIRED','PLAN_NOT_APPROVED','MISSION_GENERATION_CONFLICT'].includes(error.code) ? 409 : 422;
    return reply.status(status).send({...errorBody(error.code),details:error.details});
  }
  if (error instanceof ArtifactContractError) {
    const status = error.code === 'OWNER_BOUNDARY_VIOLATION' ? 403 : error.code.includes('NOT_FOUND') ? 404 : error.code === 'IDEMPOTENCY_KEY_REQUIRED' || error.code === 'ETAG_REQUIRED' ? 428 : error.code === 'IDEMPOTENCY_KEY_REUSED' || error.code === 'AUDIT_PASS_REQUIRED' || error.code === 'AUDITOR_INDEPENDENCE_REQUIRED' ? 409 : error.code.includes('STALE') || error.code.includes('INVALIDATED') || error.code === 'ARTIFACT_INPUT_MISMATCH' ? 412 : 422;
    return reply.status(status).send({...errorBody(error.code), details:error.details});
  }
  if(error instanceof PersistentRuntimeError){if(error.code==='RUN_VERSION_CONFLICT'){const current=runtimeConflictEtag(error.details);if(current!==undefined)reply.header('ETag',current);return reply.status(412).send({...errorBody(error.code),currentEtag:current??null});}const status=error.code==='RUNTIME_NOT_CONFIGURED'||error.code==='RUNTIME_UNREACHABLE'?503:error.code==='DUPLICATE_SUBMISSION'||error.code==='RECOVERY_REVIEW_REQUIRED'?409:error.code==='JOB_LEASE_LOST'?412:422;return reply.status(status).send({...errorBody(error.code),details:error.message});}
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
  if (action === 'TASK_ACK') return task !== undefined && liveTaskActionPhaseAllowed(action, mission.state, task.kind) && task.state === 'ASSIGNED';
  if (action === 'MODEL_GENERATE') return task !== undefined && liveTaskActionPhaseAllowed(action, mission.state, task.kind) && task.state === 'ACKNOWLEDGED' && task.roleId !== 'presence-mission-leader';
  if (action === 'TASK_SUBMIT') return task !== undefined && liveTaskActionPhaseAllowed(action, mission.state, task.kind) && task.state === 'ACKNOWLEDGED' && (task.roleId === 'presence-mission-leader' || mission.modelCalls.some((call) => call.taskId === task.id && call.outputDigest !== null && call.error === null));
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
      if (task.kind === 'PRODUCE_FOUNDER' && platform === 'X' && !hasFrozenFounderFault(candidate.content)) return undefined;
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

const repositorySkills = [
  {id: 'trace-safe-escalation', name: 'Trace-safe escalation', roleIds: ['presence-mission-leader']},
  {id: 'evidence-and-claim-grounding', name: 'Evidence and Claim grounding', roleIds: ['evidence-claim-steward', 'independent-auditor']},
  {id: 'campaign-strategy', name: 'Campaign strategy', roleIds: ['campaign-planner']},
  {id: 'account-native-expression', name: 'Account-native expression', roleIds: ['founder-identity-producer', 'product-account-producer']},
  {id: 'independent-action-audit', name: 'Independent action audit', roleIds: ['independent-auditor']}
] as const;

function aiTeamRoster() {
  return [
    {code: 'A0', roleId: 'presence-mission-leader', name: '任务协调', responsibility: '只编排任务与依赖，不生成领域内容。', skillIds: ['trace-safe-escalation']},
    {code: 'A1', roleId: 'evidence-claim-steward', name: '事实核验', responsibility: '冻结获批 Claim 与 Evidence 绑定。', skillIds: ['evidence-and-claim-grounding']},
    {code: 'A2', roleId: 'campaign-planner', name: '市场策划', responsibility: '分配市场、账号与平台行动单元。', skillIds: ['campaign-strategy']},
    {code: 'A3', roleId: 'founder-identity-producer', name: '创始人内容', responsibility: '仅生产创始人身份的平台内容。', skillIds: ['account-native-expression']},
    {code: 'A4', roleId: 'product-account-producer', name: '产品内容', responsibility: '仅生产产品账号的平台内容。', skillIds: ['account-native-expression']},
    {code: 'A5', roleId: 'independent-auditor', name: '独立审校', responsibility: '独立检查证据、权限与平台约束。', skillIds: ['evidence-and-claim-grounding', 'independent-action-audit']}
  ].map((agent) => ({...agent, status: 'NOT_CONFIGURED', metrics: {tokens: null, tokenSource: 'NO_RUNTIME_OBSERVATION', dailyCompleted: null, completionSource: 'NO_RUNTIME_OBSERVATION'}}));
}

export async function runtimeReadiness(repository:PersistentRuntimeRepository|undefined,gatewayProbe:BuildOptions['gatewayReadinessProbe'],checkedAt:Date){
  const notConfigured={state:'NOT_CONFIGURED' as RuntimeReadinessState,reasonCode:'RUNTIME_NOT_CONFIGURED',remediation:'Start this component from the terminal-only runtime launcher.'};
  if(repository===undefined)return {state:'NOT_CONFIGURED' as const,reasonCode:'RUNTIME_NOT_CONFIGURED',remediation:'Configure the terminal-only gateway Secret and start the persistent runtime.',configured:false,fingerprint:null,updatedAt:null,providerMode:'UNKNOWN',controlledFake:false,probes:{controlPlane:notConfigured,gateway:notConfigured,worker:notConfigured,agentTeams:notConfigured}};
  const database=await repository.health().catch(()=>false);const controlPlane=database?{state:'READY' as RuntimeReadinessState,reasonCode:null,remediation:null}:{state:'UNREACHABLE' as RuntimeReadinessState,reasonCode:'RUNTIME_UNREACHABLE',remediation:'Restore PostgreSQL and rerun migrations.'};
  if(!database)return {state:'UNREACHABLE' as const,reasonCode:'RUNTIME_UNREACHABLE',remediation:controlPlane.remediation,configured:false,fingerprint:null,updatedAt:null,providerMode:'UNKNOWN',controlledFake:false,probes:{controlPlane,gateway:notConfigured,worker:notConfigured,agentTeams:notConfigured}};
  if(gatewayProbe===undefined)return {state:'NOT_CONFIGURED' as const,reasonCode:'RUNTIME_NOT_CONFIGURED',remediation:'Start Model Gateway and the isolated host mission-worker supervisor.',configured:false,fingerprint:null,updatedAt:null,providerMode:'UNKNOWN',controlledFake:false,probes:{controlPlane,gateway:notConfigured,worker:notConfigured,agentTeams:notConfigured}};
  let gateway:GatewayReadiness;let heartbeat:RuntimeWorkerHeartbeat|null;
  try{[gateway,heartbeat]=await Promise.all([gatewayProbe(),repository.getWorkerHeartbeat(checkedAt)]);}catch{return {state:'UNREACHABLE' as const,reasonCode:'RUNTIME_UNREACHABLE',remediation:'Restore the unavailable runtime component; fixture fallback is disabled.',configured:false,fingerprint:null,updatedAt:null,providerMode:'UNKNOWN',controlledFake:false,probes:{controlPlane,gateway:{state:'UNREACHABLE' as RuntimeReadinessState,reasonCode:'RUNTIME_UNREACHABLE',remediation:'Restore Model Gateway.'},worker:{state:'UNREACHABLE' as RuntimeReadinessState,reasonCode:'RUNTIME_UNREACHABLE',remediation:'Restore mission-worker heartbeat.'},agentTeams:{state:'UNREACHABLE' as RuntimeReadinessState,reasonCode:'RUNTIME_UNREACHABLE',remediation:'Restore pinned AgentTeams.'}}};}
  const heartbeatFresh=heartbeat!==null&&checkedAt.getTime()-Date.parse(heartbeat.observedAt)>=0&&checkedAt.getTime()<Date.parse(heartbeat.expiresAt);
  const observed=heartbeat?.agentTeams;const pinned=heartbeatFresh&&observed?.identityEvidence?.verified===true&&observed.memberCount===6&&observed.runtimeVersion===AGENTTEAMS_RUNTIME_VERSION&&observed.runtimeDigest===AGENTTEAMS_SOURCE_TAR_SHA256&&observed.sourceCommit===AGENTTEAMS_SOURCE_COMMIT&&observed.sourceTarSha256===AGENTTEAMS_SOURCE_TAR_SHA256&&observed.identityEvidence.expected.sourceCommit===AGENTTEAMS_SOURCE_COMMIT&&observed.identityEvidence.expected.sourceTarSha256===AGENTTEAMS_SOURCE_TAR_SHA256;
  const agentTeamsReady=pinned&&observed?.state==='READY';
  const gatewayStatus={state:gateway.state,reasonCode:gateway.state==='READY'?gateway.controlledFake?'CONTROLLED_FAKE_ENGINEERING_TEST':null:gateway.state==='NOT_CONFIGURED'?'RUNTIME_NOT_CONFIGURED':'RUNTIME_UNREACHABLE',remediation:gateway.state==='READY'?null:gateway.state==='NOT_CONFIGURED'?'Configure DeepSeek from the no-echo terminal CLI.':'Restore Model Gateway.'};
  const workerStatus={state:heartbeatFresh?'READY' as RuntimeReadinessState:'UNREACHABLE' as RuntimeReadinessState,reasonCode:heartbeatFresh?null:'MISSION_WORKER_HEARTBEAT_MISSING',remediation:heartbeatFresh?null:'Start or restore the isolated local mission-worker host supervisor.'};
  const agentTeamsStatus={state:agentTeamsReady?'READY' as RuntimeReadinessState:observed?.state==='UNREACHABLE'||!heartbeatFresh?'UNREACHABLE' as RuntimeReadinessState:'INCOMPATIBLE' as RuntimeReadinessState,reasonCode:agentTeamsReady?null:observed?.state==='UNREACHABLE'||!heartbeatFresh?'RUNTIME_UNREACHABLE':'RUNTIME_VERSION_INCOMPATIBLE',remediation:agentTeamsReady?null:'Restore the exact pinned AgentTeams v1.2.0 six-member profile.'};
  let state:RuntimeReadinessState='READY';let reasonCode:string|null=null;let remediation:string|null=null;
  if(!heartbeatFresh){state='UNREACHABLE';reasonCode='MISSION_WORKER_HEARTBEAT_MISSING';remediation='Start or restore the isolated local mission-worker host supervisor.';}
  else if(gateway.state==='NOT_CONFIGURED'){state='NOT_CONFIGURED';reasonCode='RUNTIME_NOT_CONFIGURED';remediation='Configure the terminal-only Secret and start the host supervisor.';}
  else if(gateway.state==='UNREACHABLE'||agentTeamsStatus.state==='UNREACHABLE'){state='UNREACHABLE';reasonCode='RUNTIME_UNREACHABLE';remediation='Restore all four runtime probes.';}
  else if(!agentTeamsReady||gateway.state==='INCOMPATIBLE'){state='INCOMPATIBLE';reasonCode='RUNTIME_VERSION_INCOMPATIBLE';remediation='Restore the exact pinned AgentTeams source and image identity.';}
  else if(gateway.controlledFake||gateway.state==='DEGRADED'){state='DEGRADED';reasonCode='CONTROLLED_FAKE_ENGINEERING_TEST';remediation='Controlled fake is engineering-only; configure DeepSeek for a provider canary.';}
  return {state,reasonCode,remediation,configured:gateway.configured,fingerprint:gateway.fingerprint,updatedAt:gateway.updatedAt,providerMode:gateway.providerMode,controlledFake:gateway.controlledFake,probes:{controlPlane,gateway:gatewayStatus,worker:workerStatus,agentTeams:agentTeamsStatus}};
}

function runtimeRunEtag(run:MissionRun){return missionRunEtag(run);}
function runtimeExpectedVersion(request:FastifyRequest,runId:string){try{return parseMissionRunEtag(typeof request.headers['if-match']==='string'?request.headers['if-match']:undefined,runId);}catch{return undefined;}}
function runtimeConflictEtag(details:unknown){if(details===null||typeof details!=='object'||Array.isArray(details))return undefined;const value=details as {runId?:unknown;rowVersion?:unknown};return typeof value.runId==='string'&&Number.isSafeInteger(value.rowVersion)&&Number(value.rowVersion)>0?missionRunEtag({id:value.runId,rowVersion:Number(value.rowVersion)}):undefined;}

async function requireLocalProfile(repository: LocalPresenceRepository, reply: FastifyReply) {
  const profile = await repository.getProfile();
  if (profile === undefined) { void reply.status(409).send(errorBody('LOCAL_PROFILE_REQUIRED')); return undefined; }
  return profile;
}

function knowledgeMutationHeaders(request: FastifyRequest): {version:number;idempotencyKey:string} {
  const idempotencyKey=request.headers['idempotency-key']; if(typeof idempotencyKey!=='string'||idempotencyKey.length<8||idempotencyKey.length>128)throw new KnowledgeContractError('IDEMPOTENCY_KEY_REQUIRED');
  return {version:parseKnowledgeEtag(typeof request.headers['if-match']==='string'?request.headers['if-match']:undefined),idempotencyKey};
}

function exactMutationHeaders(request: FastifyRequest, expectedDigest: string, expectedEtag: string): {idempotencyKey:string} {
  const idempotencyKey=request.headers['idempotency-key'];if(typeof idempotencyKey!=='string'||idempotencyKey.length<8||idempotencyKey.length>128)throw new GoalPlanContractError('IDEMPOTENCY_KEY_REQUIRED');
  const ifMatch=request.headers['if-match'];if(typeof ifMatch!=='string')throw new GoalPlanContractError('ETAG_REQUIRED');if(ifMatch!==expectedEtag||!ifMatch.includes(expectedDigest))throw new GoalPlanContractError('MISSION_INPUT_CHANGED');return {idempotencyKey};
}

function artifactMutationHeaders(request: FastifyRequest, expectedDigest: string, expectedEtag: string): {idempotencyKey:string} {
  const idempotencyKey=request.headers['idempotency-key'];if(typeof idempotencyKey!=='string'||idempotencyKey.length<8||idempotencyKey.length>128)throw new ArtifactContractError('IDEMPOTENCY_KEY_REQUIRED');
  const ifMatch=request.headers['if-match'];if(typeof ifMatch!=='string')throw new ArtifactContractError('ETAG_REQUIRED');if(ifMatch!==expectedEtag||!ifMatch.includes(expectedDigest))throw new ArtifactContractError('ARTIFACT_INPUT_MISMATCH');return {idempotencyKey};
}

function exactGoalPatch(value: unknown): OperatingGoalInput & {canonicalDigest:string} {
  if(!isExactRecord(value,['canonicalDigest','objective','horizonDays','startsAt','endsAt','cadence','selectedAccountIds','targetMarket','contentLocale','timeZone','successSignals','knowledgeSnapshotId','knowledgeSnapshotDigest'])||typeof value.canonicalDigest!=='string')throw new GoalPlanContractError('GOAL_SCHEMA_INVALID');
  const {canonicalDigest,...input}=value;return {...validateOperatingGoalInput(input),canonicalDigest};
}

function goalInput(goal: OperatingGoalRevision): OperatingGoalInput { return {objective:goal.objective,horizonDays:goal.horizonDays,startsAt:goal.startsAt,endsAt:goal.endsAt,cadence:goal.cadence,selectedAccountIds:[...goal.selectedAccountIds],targetMarket:goal.targetMarket,contentLocale:goal.contentLocale,timeZone:goal.timeZone,successSignals:structuredClone(goal.successSignals),knowledgeSnapshotId:goal.knowledgeSnapshotId,knowledgeSnapshotDigest:goal.knowledgeSnapshotDigest}; }
function bundleEtag(bundle: MissionBundle): string{return `\"bundle-${bundle.bundleId}-g${bundle.generation}-${bundle.canonicalDigest}\"`;}
function previousGoalEtag(goal:OperatingGoalRevision):string{if(goal.revision<2||goal.parentDigest===null)throw new GoalPlanContractError('GOAL_VERSION_CONFLICT');return `\"goal-${goal.goalId}-r${goal.revision-1}-${goal.parentDigest}\"`;}
function previousPlanEtag(plan:{planId:string;revision:number;parentDigest:string|null}):string{if(plan.revision<2||plan.parentDigest===null)throw new GoalPlanContractError('PLAN_VERSION_CONFLICT');return `\"plan-${plan.planId}-r${plan.revision-1}-${plan.parentDigest}\"`;}

async function approvedGoalInputs(repository: KnowledgeRepository,ownerId:string,goal:OperatingGoalRevision,requireProducerCoverage:boolean){
  const overview=await repository.getOverview(ownerId);const context=await repository.getRoleContext(ownerId,goal.knowledgeSnapshotId,goal.knowledgeSnapshotDigest);
  const revisions=await Promise.all(goal.selectedAccountIds.map((revisionId)=>repository.getProfileRevision(ownerId,revisionId)));const profiles=revisions.filter((profile):profile is NonNullable<typeof profile>=>profile!==undefined&&profile.kind==='ACCOUNT').map((profile)=>({id:profile.id,revision:profile.version,digest:profile.digest,payload:profile.payload as AccountOperatingProfileInput}));
  const bindings=accountBindingsFromKnowledge(goal,context,profiles,{requireProducerCoverage});
  return {context,bindings,guard:{rowVersion:overview.session.rowVersion,snapshotId:context.snapshotId,snapshotDigest:context.snapshotDigest,accountProfileDigests:bindings.map((binding)=>({revisionId:binding.accountProfileRevisionId,digest:binding.digest}))}};
}
async function reconcileKnowledgeSupersessions(knowledgeRepository:KnowledgeRepository,goalPlanRepository:GoalPlanRepository,ownerId:string,at:Date):Promise<void>{const pending=await knowledgeRepository.listPendingSnapshotSupersessions(ownerId);for(const event of pending){await goalPlanRepository.invalidateBundles(ownerId,{reasonCode:'KNOWLEDGE_SNAPSHOT_CHANGED',currentDigest:event.approvedSnapshotDigest,supersededSnapshotId:event.supersededSnapshotId,supersededSnapshotDigest:event.supersededSnapshotDigest},at);await knowledgeRepository.acknowledgeSnapshotSupersession(ownerId,event.eventId,at);}}
async function reconcileArtifactSupersessions(goalRepository:GoalPlanRepository,artifactRepository:ArtifactPublishRepository,ownerId:string,at:Date):Promise<void>{const [goals,artifacts]=await Promise.all([goalRepository.getWorkspace(ownerId),artifactRepository.getWorkspace(ownerId)]);for(const revision of artifacts.revisions){if(artifacts.invalidations.some((item)=>item.artifactRevisionId===revision.id))continue;const bundleState=goals.bundleStates.find((item)=>item.bundleId===revision.inputBindings.executionBundle.id);if(bundleState?.state!=='INVALIDATED')continue;const event=[...goals.invalidations].reverse().find((item)=>item.bundleId===revision.inputBindings.executionBundle.id);const reasonMap={KNOWLEDGE_SNAPSHOT_CHANGED:'KNOWLEDGE_CHANGED',GOAL_REVISION_CHANGED:'GOAL_CHANGED',PLAN_REVISION_CHANGED:'PLAN_CHANGED',ACCOUNT_PROFILE_CHANGED:'ACCOUNT_CHANGED',MISSION_INPUT_CHANGED:'BUNDLE_CHANGED'} as const;await artifactRepository.invalidateBindings(ownerId,revision.id,reasonMap[bundleState.reasonCode??'MISSION_INPUT_CHANGED'],revision.canonicalDigest,event?.currentDigest??sha256Digest(bundleState),at);}}

async function requireGoal(repository:GoalPlanRepository,ownerId:string,goalId:string){const goal=await repository.getGoal(ownerId,goalId);if(goal===undefined)throw new GoalPlanContractError('GOAL_NOT_FOUND');return goal;}
async function requirePlan(repository:GoalPlanRepository,ownerId:string,planId:string){const plan=await repository.getPlan(ownerId,planId);if(plan===undefined)throw new GoalPlanContractError('CONTENT_PLAN_NOT_FOUND');return plan;}
async function requireIntent(repository:GoalPlanRepository,ownerId:string,bundleId:string){const bundle=await repository.getBundle(ownerId,bundleId);if(bundle===undefined)throw new GoalPlanContractError('MISSION_BUNDLE_NOT_FOUND');if(bundle.kind!=='MISSION_INTENT')throw new GoalPlanContractError('MISSION_INPUT_CHANGED');const workspace=await repository.getWorkspace(ownerId);if(workspace.bundleStates.find((item)=>item.bundleId===bundleId)?.state==='INVALIDATED')throw new GoalPlanContractError('MISSION_INPUT_CHANGED');return bundle;}

async function requireExecution(repository:GoalPlanRepository,ownerId:string,bundleId:string):Promise<MissionExecutionBundle>{const bundle=await repository.getBundle(ownerId,bundleId);if(bundle===undefined)throw new ArtifactContractError('ARTIFACT_INPUT_MISMATCH');if(bundle.kind!=='MISSION_EXECUTION')throw new ArtifactContractError('ARTIFACT_INPUT_MISMATCH');const workspace=await repository.getWorkspace(ownerId);if(workspace.bundleStates.find((item)=>item.bundleId===bundleId)?.state==='INVALIDATED')throw new ArtifactContractError('ARTIFACT_INPUT_MISMATCH');return bundle;}
async function requireArtifactRevision(repository:ArtifactPublishRepository,ownerId:string,artifactId:string):Promise<ArtifactRevisionV3>{const revision=await repository.getRevision(ownerId,artifactId);if(revision===undefined)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');return revision;}
async function requireArtifactAudit(repository:ArtifactPublishRepository,ownerId:string,auditId:string):Promise<ArtifactAuditDecision>{const audit=await repository.getAudit(ownerId,auditId);if(audit===undefined)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');return audit;}
async function requireArtifactOwnerDecision(repository:ArtifactPublishRepository,ownerId:string,decisionId:string):Promise<ArtifactOwnerDecision>{const decision=await repository.getOwnerDecision(ownerId,decisionId);if(decision===undefined)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');return decision;}
function latestUnitRevision(revisions:ArtifactRevisionV3[],activationUnitId:string):ArtifactRevisionV3|undefined{return revisions.filter((item)=>item.activationUnitId===activationUnitId).sort((left,right)=>right.revision-left.revision)[0];}

async function acceptProducerArtifact(ownerId:string,submission:ProducerSubmission,bundle:MissionExecutionBundle,idempotencyKey:string,repository:ArtifactPublishRepository,at:Date,reply:FastifyReply){
  const workspace=await repository.getWorkspace(ownerId);const head=latestUnitRevision(workspace.revisions,submission.activationUnitId);const quarantine=quarantineProducerSubmission(submission,bundle,at.toISOString());
  if(quarantine!==null){const result=await repository.appendQuarantine(ownerId,quarantine,idempotencyKey,at);return reply.status(422).header('Idempotency-Replayed',String(result.replayed)).send({code:'PRODUCER_SUBMISSION_QUARANTINED',...result,agentTeamsExecuted:submission.agentTeamsExecuted});}
  if(head!==undefined&&head.origin==='AGENT'){const replayCandidate=createArtifactRevision({ownerId,submission,bundle,revision:head.revision,parentRevisionId:head.parentRevisionId,createdAt:head.createdAt});if(replayCandidate.canonicalDigest===head.canonicalDigest){const parent=head.parentRevisionId===null?undefined:workspace.revisions.find((item)=>item.id===head.parentRevisionId);const replay=await repository.appendRevision(ownerId,replayCandidate,parent?.canonicalDigest??null,idempotencyKey,at);return reply.status(200).header('ETag',artifactRevisionEtag(replay.revision)).header('Idempotency-Replayed',String(replay.replayed)).send({code:'ARTIFACT_REVISION_REPLAYED',...replay,agentTeamsExecuted:submission.agentTeamsExecuted});}}
  const revision=createArtifactRevision({ownerId,submission,bundle,revision:(head?.revision??0)+1,parentRevisionId:head?.id??null,createdAt:at.toISOString()});const result=await repository.appendRevision(ownerId,revision,head?.canonicalDigest??null,idempotencyKey,at);return reply.status(result.replayed?200:201).header('ETag',artifactRevisionEtag(result.revision)).header('Idempotency-Replayed',String(result.replayed)).send({code:result.replayed?'ARTIFACT_REVISION_REPLAYED':'PRODUCER_ARTIFACT_REVISION_CREATED',...result,agentTeamsExecuted:submission.agentTeamsExecuted});
}

async function requireMutableOnboardingSession(repository: LocalPresenceRepository, ownerProfileId: string): Promise<LocalOnboardingSession> {
  const session = await repository.getSession(ownerProfileId);
  if (session === undefined) throw new LocalPresenceContractError('LOCAL_PROFILE_NOT_FOUND');
  if (session.state === 'COMPLETED') throw new LocalPresenceContractError('LOCAL_ONBOARDING_ALREADY_COMPLETED');
  if (session.state === 'COMPLETION_PENDING') throw new LocalPresenceContractError('LOCAL_ONBOARDING_COMPLETION_IN_PROGRESS');
  return session;
}

function isExactRecord(value: unknown, keys: string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

function decodeFileName(value: string): string {
  try { return decodeURIComponent(value); }
  catch { throw new LocalPresenceContractError('LOCAL_MATERIAL_FILE_NAME_INVALID'); }
}

type ManualHandoffBody = {organizationId: string; campaignId: string; artifactRevisionId: string; platform: string; action: ManualPublishHandoff['action']};
function isManualHandoffBody(value: unknown): value is ManualHandoffBody {
  return isExactRecord(value, ['organizationId', 'campaignId', 'artifactRevisionId', 'platform', 'action']) && typeof value.organizationId === 'string' && isUuidV7(value.organizationId) && typeof value.campaignId === 'string' && isUuidV7(value.campaignId) && typeof value.artifactRevisionId === 'string' && isUuidV7(value.artifactRevisionId) && typeof value.platform === 'string' && ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'].includes(value.platform) && value.action === 'OPEN_OFFICIAL_PAGE';
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
  const blobRoot = process.env.BLOB_ROOT;
  if (blobRoot === undefined) throw new Error('BLOB_ROOT is required.');
  const gatewayStatusUrl=process.env.MODEL_GATEWAY_URL;const app = buildApi({repository: new PostgresCampaignRepository(connectionString), shadowRepository: new PostgresShadowMissionRepository(connectionString), localPresenceRepository: new PostgresLocalPresenceRepository(connectionString, new LocalContentAddressedBlobStore(blobRoot)), knowledgeRepository: new PostgresKnowledgeRepository(connectionString,new LocalContentAddressedBlobStore(blobRoot)), goalPlanRepository: new PostgresGoalPlanRepository(connectionString), artifactPublishRepository:new PostgresArtifactPublishRepository(connectionString),persistentRuntimeRepository:new PostgresPersistentRuntimeRepository(connectionString),...(gatewayStatusUrl===undefined?{}:{gatewayReadinessProbe:async()=>fetchJsonHealth<GatewayReadiness>(gatewayStatusUrl)}), runtimeImportToken: readComposeSecret('/run/secrets/lumiclaw_runtime_import_token'), deepseekApiKey: readComposeSecret('/run/secrets/deepseek_api_key'), runtimeBootstrapSecret: readComposeSecret('/run/secrets/lumiclaw_runtime_broker_bootstrap')});
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  await app.listen({host: '0.0.0.0', port});
}

async function fetchJsonHealth<T>(origin:string):Promise<T>{const response=await fetch(`${origin}/health`,{signal:AbortSignal.timeout(2_000)});return response.json() as Promise<T>;}

if (process.argv[1]?.endsWith('/server.js')) {
  start().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
