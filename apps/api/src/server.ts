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
import {PostgresCampaignRepository} from '@lumiclaw/db';
import Fastify, {type FastifyInstance, type FastifyReply, type FastifyRequest} from 'fastify';
import {MemoryCampaignRepository} from './memory-campaign-repository.js';
import {openApiDocument} from './openapi.js';

type BuildOptions = {repository?: CampaignRepository; now?: () => Date};
type CampaignParams = {campaignId: string};
type SchedulePreviewBody = {localStart: string; timeZone: string; rrule?: string | null; foldPreference: 'EARLIER' | 'LATER'; misfirePolicy: 'SKIP' | 'HOLD_FOR_OWNER'};

export function buildApi(options: BuildOptions = {}): FastifyInstance {
  const app = Fastify({logger: false});
  const repository = options.repository ?? new MemoryCampaignRepository();
  const now = options.now ?? (() => new Date());
  app.addHook('onClose', async () => repository.close());

  app.get('/health', async (_request, reply) => {
    try {
      if (!await repository.health()) throw new Error('database marker missing');
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
    return {code: 'MISSION_CONTRACT_READY', mode: 'DEMO_SEED', live: false, ...value};
  });

  app.post<{Params: CampaignParams; Body: SchedulePreviewBody}>('/api/v1/campaigns/:campaignId/schedule-preview', async (request, reply) => {
    const organizationId = requireOrganization(request, reply);
    if (organizationId === undefined) return;
    const envelope = await repository.get(organizationId, request.params.campaignId);
    if (envelope === undefined) return reply.status(404).send(errorBody('CAMPAIGN_NOT_FOUND'));
    try {
      const value = createPublishingSchedule({organizationId, campaignId: request.params.campaignId, artifactRevisions: envelope.document.artifactRevisions, ...request.body}, now());
      return {code: 'SCHEDULE_PREVIEW_READY', mode: 'DEMO_SEED', live: false, executionAllowed: false, ...value};
    } catch (error) { return sendDomainOrUnavailable(reply, error); }
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
  console.error(error);
  return reply.status(503).send(errorBody('CONTROL_PLANE_UNAVAILABLE'));
}

function errorBody(code: string) { return {code, mode: 'DEMO_SEED', live: false}; }

async function start(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) throw new Error('DATABASE_URL is required.');
  const app = buildApi({repository: new PostgresCampaignRepository(connectionString)});
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  await app.listen({host: '0.0.0.0', port});
}

if (process.argv[1]?.endsWith('/server.js')) {
  start().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
