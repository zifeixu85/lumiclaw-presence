import {createDemoCampaignDocument, createUuidV7, sha256Digest} from '@lumiclaw/domain';
import {AGENTTEAMS_V120_BUILD_DIGEST, runtimeDagDigest, runtimeMemberSetDigest, runtimeProjectDispatchReceiptDigest, runtimeTaskAckReceiptDigest, runtimeTaskSubmissionReceiptDigest, ShadowContractError, type ModelGenerateRequest, type ModelProvider, type ShadowMission, type TaskContract} from '@lumiclaw/governed-shadow';
import {afterEach, describe, expect, it} from 'vitest';
import {buildApi} from './server.js';

const apps = [] as ReturnType<typeof buildApi>[];
const now = () => new Date('2026-08-03T12:00:00.000Z');
const runtimeImportTestToken = 'public-safe-runtime-import-test-token-v1';
const runtimeBootstrapTestSecret = 'public-safe-runtime-bootstrap-conformance-v1';

function projectReceipt(mission: ShadowMission) {
  const memberBindings = mission.roleContexts.map((context) => ({roleId: context.roleId, roleIdentityId: context.identityId, runtimeActorId: `@${context.roleId}:runtime.test`}));
  const base = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, runtimeVersion: 'v1.2.0' as const, buildDigest: AGENTTEAMS_V120_BUILD_DIGEST, memberBindings, memberSetDigest: runtimeMemberSetDigest(memberBindings), dagDigest: runtimeDagDigest(mission), dispatchedAt: now().toISOString()};
  return {...base, receiptDigest: runtimeProjectDispatchReceiptDigest(base)};
}

function ackReceipt(mission: ShadowMission, task: TaskContract) {
  const runtimeActorId = mission.runtimeProjectDispatch!.memberBindings.find((item) => item.roleId === task.roleId)!.runtimeActorId;
  const base = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId, attempt: task.attempt, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest!, runtimeState: 'in_progress' as const, acknowledgedAt: now().toISOString()};
  return {...base, receiptDigest: runtimeTaskAckReceiptDigest(base)};
}

function taskSubmission(mission: ShadowMission, task: TaskContract, payload: unknown, maturity: 'MOCK_CONFORMANCE' | 'CANARY' = 'MOCK_CONFORMANCE') {
  const current = mission.tasks.find((item) => item.id === task.id)!; const outputDigest = sha256Digest(payload);
  const resultDigest = sha256Digest({schemaVersion: 1, taskId: task.id, roleId: task.roleId, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest, payload, outputDigest, maturity, externalActionAllowed: false});
  const base = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, taskId: task.id, roleId: task.roleId, runtimeActorId: current.runtimeAck!.runtimeActorId, attempt: task.attempt, ackReceiptDigest: current.runtimeAck!.receiptDigest, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest!, runtimeState: 'submitted' as const, submittedAt: now().toISOString(), resultDigest, resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY' as const, runtimeObservationId: sha256Digest({taskId: task.id, resultDigest, inputProjectionDigest: task.inputProjectionDigest, source: 'test-persisted-summary'})};
  return {schemaVersion: 1 as const, missionId: mission.id, taskId: task.id, roleId: task.roleId, roleIdentityId: task.roleIdentityId, inputDigest: task.inputDigest, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest!, skillLockDigest: task.skillLockDigest, outputSchema: task.outputSchema, outputSchemaVersion: 1 as const, payload, outputDigest, runtimeResultMaturity: maturity, runtimeReceipt: {...base, receiptDigest: runtimeTaskSubmissionReceiptDigest(base)}};
}

function liveSnapshot(request: ModelGenerateRequest<unknown>, errorCode: string | null, value: unknown = null) {
  const inputDigest = sha256Digest({system: request.system, input: request.input, outputSchema: request.outputSchema});
  return {schemaVersion: 1 as const, id: createUuidV7(now().getTime(), new Uint8Array(10)), missionId: request.missionId, taskId: request.taskId, provider: 'DEEPSEEK' as const, maturity: 'CANARY' as const, model: request.model, response: {id: 'redacted-fixture-response', actualModel: request.model, systemFingerprint: null, finishReason: 'stop'}, config: {temperature: 0, maxTokens: 4000, responseFormat: 'json_object' as const, timeoutMs: 120000, maxAttempts: 3}, pricing: {source: 'DEEPSEEK_OFFICIAL_2026-08-04' as const, inputCacheHitUsdPerMillion: 0.0028, inputCacheMissUsdPerMillion: 0.14, outputUsdPerMillion: 0.28, peakMultiplierNotApplied: true as const}, inputDigest, outputDigest: errorCode === null ? sha256Digest(value) : null, tokenUsage: {input: 20, output: 10, cacheHit: 5, cacheMiss: 15, reasoning: 0}, estimatedCostUsd: 0.000004914, latencyMs: 23, attempts: 1, error: errorCode === null ? null : {code: errorCode, retryable: errorCode === 'MODEL_TIMEOUT' || errorCode === 'PROVIDER_UNAVAILABLE' || /^(?:PROVIDER_HTTP_(?:429|5\d\d))$/u.test(errorCode)}, secretPresent: false as const, createdAt: now().toISOString()};
}

type FounderFaultMode = 'EXACT_FROZEN_PHRASE' | 'OMIT_FROZEN_PHRASE' | 'PARAPHRASE_FROZEN_PHRASE' | 'REVERSE_FROZEN_PHRASE' | 'PUNCTUATE_FROZEN_PHRASE' | 'SPLIT_FROZEN_PHRASE' | 'ALT_TEXT_ONLY' | 'XIAOHONGSHU_ONLY' | 'UNICODE_LOOKALIKE';

function liveFixtureValue(request: ModelGenerateRequest<unknown>, auditMode: 'EXACT_FROZEN_FAIL' | 'INVALID_ALL_PASS', founderFaultMode: FounderFaultMode): unknown {
  const input = request.input as {taskKind: TaskContract['kind']; projection: Record<string, unknown>};
  const projection = input.projection;
  if (input.taskKind === 'FREEZE_EVIDENCE') return {frozen: true, assessment: 'Public-safe deterministic Claim/Evidence freeze.'};
  if (input.taskKind === 'PLAN_CAMPAIGN') return {rationale: 'Public-safe deterministic four-platform activation plan.'};
  if (input.taskKind === 'PRODUCE_FOUNDER' || input.taskKind === 'PRODUCE_PRODUCT') {
    const platforms = input.taskKind === 'PRODUCE_FOUNDER' ? ['X', 'XIAOHONGSHU'] : ['BLUESKY', 'LINKEDIN'];
    const sourceRevisions = projection.sourceRevisions as {platform: string; content: Record<string, unknown>}[];
    return {revisions: platforms.map((platform) => {
      const source = sourceRevisions.find((revision) => revision.platform === platform)!;
      const content = structuredClone(source.content);
      if (platform === 'X') {
        if (founderFaultMode === 'EXACT_FROZEN_PHRASE') content.posts = ['LumiClaw Presence is generally available in every market today.'];
        else if (founderFaultMode === 'OMIT_FROZEN_PHRASE' || founderFaultMode === 'XIAOHONGSHU_ONLY') content.posts = ['LumiClaw Presence remains in governed beta.'];
        else if (founderFaultMode === 'PARAPHRASE_FROZEN_PHRASE') content.posts = ['LumiClaw Presence is broadly available.'];
        else if (founderFaultMode === 'REVERSE_FROZEN_PHRASE') content.posts = ['LumiClaw Presence is available generally.'];
        else if (founderFaultMode === 'PUNCTUATE_FROZEN_PHRASE') content.posts = ['LumiClaw Presence is generally-available.'];
        else if (founderFaultMode === 'SPLIT_FROZEN_PHRASE') content.posts = ['generally', 'available'];
        else if (founderFaultMode === 'ALT_TEXT_ONLY') { content.posts = ['LumiClaw Presence remains in governed beta.']; content.altText = 'generally available'; }
        else content.posts = ['LumiClaw Presence is generаlly available.'];
      }
      if (platform === 'XIAOHONGSHU' && founderFaultMode === 'XIAOHONGSHU_ONLY') content.body = 'generally available';
      return {platform, content};
    })};
  }
  if (input.taskKind === 'AUDIT_REVISIONS') {
    const producerSummaries = projection.producerSummaries as {founder: {revisions: {platform: string}[]}; product: {revisions: {platform: string}[]}};
    const evidenceRefIds = projection.evidenceRefIds as string[];
    const issue = {code: 'CLAIM_OVERREACH', severity: 'BLOCKING', path: '/content/posts/0', message: 'The frozen evidence does not support generally available.', evidenceRefIds, nextResponsibleRoleId: 'founder-identity-producer'};
    return {decisions: [...producerSummaries.founder.revisions, ...producerSummaries.product.revisions].map((revision) => ({platform: revision.platform, outcome: auditMode === 'EXACT_FROZEN_FAIL' && revision.platform === 'X' ? 'FAIL' : 'PASS', issues: auditMode === 'EXACT_FROZEN_FAIL' && revision.platform === 'X' ? [issue] : []}))};
  }
  if (input.taskKind === 'PRODUCE_FOUNDER_CORRECTION') {
    const source = (projection.sourceRevisions as {platform: string; content: Record<string, unknown>}[]).find((revision) => revision.platform === 'X')!;
    return {revisions: [{platform: 'X', content: structuredClone(source.content)}]};
  }
  if (input.taskKind === 'REAUDIT_CORRECTION') return {decisions: [{platform: 'X', outcome: 'PASS', issues: []}]};
  throw new Error('PUBLIC_SAFE_LIVE_FIXTURE_TASK_UNEXPECTED');
}

async function liveInitialAuditAttempt(auditMode: 'EXACT_FROZEN_FAIL' | 'INVALID_ALL_PASS', suffix: string, founderFaultMode: FounderFaultMode = 'EXACT_FROZEN_PHRASE') {
  let callIndex = 0;
  const provider = {generateStructured: async (request: ModelGenerateRequest<unknown>) => {
    const value = liveFixtureValue(request, auditMode, founderFaultMode);
    const snapshot = liveSnapshot(request, null, value);
    snapshot.id = createUuidV7(now().getTime() + callIndex, new Uint8Array(10).fill(callIndex + 1));
    callIndex += 1;
    return {ok: true as const, value, snapshot};
  }} as unknown as ModelProvider;
  const app = buildApi({now, runtimeBootstrapSecret: runtimeBootstrapTestSecret, deepseekApiKey: 'public-safe-in-memory-provider-fixture', liveModelProviderFactory: () => provider}); apps.push(app);
  const document = createDemoCampaignDocument(); const headers = {'x-lumiclaw-organization-id': document.organizationId};
  const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {...headers, 'idempotency-key': `audit-campaign-${suffix}`}, payload: document});
  const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': `audit-start-${suffix}`, 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA', providerMode: 'LIVE_DEEPSEEK_UAT', providerModel: 'deepseek-v4-flash'}});
  let mission = started.json().mission as ShadowMission; let etag = started.headers.etag!; const missionId = mission.id;
  const issue = async (action: string, task?: TaskContract) => (await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-runner/tickets`, headers: {...headers, 'x-lumiclaw-runner-bootstrap': runtimeBootstrapTestSecret}, payload: {missionId, campaignDigest: mission.sourceCampaignDigest, action, roleId: task?.roleId ?? null, taskId: task?.id ?? null, attempt: task?.attempt ?? null, agentTeamsSourceTarSha256: mission.runtimeExpectation.agentTeamsSourceTarSha256, agentTeamsBuildDigest: mission.runtimeExpectation.agentTeamsBuildDigest, imageDigests: mission.runtimeExpectation.imageDigests}})).json().ticket as string;
  const dispatch = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('PROJECT_DISPATCH'), 'idempotency-key': `audit-dispatch-${suffix}`, 'if-match': etag}, payload: {kind: 'PROJECT_DISPATCHED', receipt: projectReceipt(mission)}}); mission = dispatch.json().mission; etag = dispatch.headers.etag!;
  let lastGenerated: Awaited<ReturnType<typeof app.inject>> | undefined; let initialAuditSubmit: Awaited<ReturnType<typeof app.inject>> | undefined; let staleAuditSubmit: Awaited<ReturnType<typeof app.inject>> | undefined; let wrongScopeAuditSubmit: Awaited<ReturnType<typeof app.inject>> | undefined; let acceptedAuditRequest: {ticket: string; idempotencyKey: string; etag: string; submission: ReturnType<typeof taskSubmission>} | undefined;
  for (const kind of ['PROJECT_COORDINATION', 'FREEZE_EVIDENCE', 'PLAN_CAMPAIGN', 'PRODUCE_FOUNDER', 'PRODUCE_PRODUCT', 'AUDIT_REVISIONS'] as const) {
    let task = mission.tasks.find((candidate) => candidate.kind === kind)!;
    const ack = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('TASK_ACK', task), 'idempotency-key': `audit-ack-${suffix}-${kind}`, 'if-match': etag}, payload: {kind: 'TASK_ACK', receipt: ackReceipt(mission, task)}});
    expect(ack.statusCode).toBe(200); mission = ack.json().mission; etag = ack.headers.etag!; task = mission.tasks.find((candidate) => candidate.id === task.id)!;
    let payload: unknown;
    if (kind === 'PROJECT_COORDINATION') payload = {projectId: mission.runtimeProjectId, externalActionAllowed: false};
    else {
      lastGenerated = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('MODEL_GENERATE', task)}, payload: {taskId: task.id, roleId: task.roleId, attempt: task.attempt, inputProjectionDigest: task.inputProjectionDigest}});
      if (lastGenerated.statusCode !== 200) break;
      mission = lastGenerated.json().mission; etag = lastGenerated.headers.etag!; task = mission.tasks.find((candidate) => candidate.id === task.id)!; payload = lastGenerated.json().payload;
    }
    const submission = taskSubmission(mission, task, payload, 'CANARY');
    if (kind === 'AUDIT_REVISIONS') {
      const staleTicket = await issue('TASK_SUBMIT', task);
      staleAuditSubmit = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': staleTicket, 'idempotency-key': `audit-stale-${suffix}`, 'if-match': '"mission-stale"'}, payload: {kind: 'TASK_SUBMIT', submission}});
      const wrongScopeTicket = await issue('TASK_SUBMIT', task);
      wrongScopeAuditSubmit = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': wrongScopeTicket, 'idempotency-key': `audit-scope-${suffix}`, 'if-match': etag}, payload: {kind: 'TASK_SUBMIT', submission: {...submission, roleId: 'campaign-planner'}}});
    }
    const ticket = await issue('TASK_SUBMIT', task); const idempotencyKey = `audit-submit-${suffix}-${kind}`;
    const submitted = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': ticket, 'idempotency-key': idempotencyKey, 'if-match': etag}, payload: {kind: 'TASK_SUBMIT', submission}});
    if (kind === 'AUDIT_REVISIONS') initialAuditSubmit = submitted;
    if (kind === 'AUDIT_REVISIONS') acceptedAuditRequest = {ticket, idempotencyKey, etag, submission};
    if (submitted.statusCode !== 200) break;
    mission = submitted.json().mission; etag = submitted.headers.etag!;
  }
  const reopened = await app.inject({method: 'GET', url: `/api/v1/shadow-missions/${missionId}`, headers});
  return {app, headers, missionId, lastGenerated, initialAuditSubmit, staleAuditSubmit, wrongScopeAuditSubmit, acceptedAuditRequest, reopened};
}

async function firstLiveDomainAttempt(provider: ModelProvider, suffix: string) {
  const app = buildApi({now, runtimeBootstrapSecret: runtimeBootstrapTestSecret, deepseekApiKey: 'public-safe-in-memory-provider-fixture', liveModelProviderFactory: () => provider}); apps.push(app);
  const document = createDemoCampaignDocument(); const headers = {'x-lumiclaw-organization-id': document.organizationId};
  const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {...headers, 'idempotency-key': `provider-campaign-${suffix}`}, payload: document});
  const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': `provider-start-${suffix}`, 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA', providerMode: 'LIVE_DEEPSEEK_UAT', providerModel: 'deepseek-v4-flash'}});
  let mission = started.json().mission as ShadowMission; let etag = started.headers.etag!; const missionId = mission.id;
  const issue = async (action: string, task?: TaskContract) => (await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-runner/tickets`, headers: {...headers, 'x-lumiclaw-runner-bootstrap': runtimeBootstrapTestSecret}, payload: {missionId, campaignDigest: mission.sourceCampaignDigest, action, roleId: task?.roleId ?? null, taskId: task?.id ?? null, attempt: task?.attempt ?? null, agentTeamsSourceTarSha256: mission.runtimeExpectation.agentTeamsSourceTarSha256, agentTeamsBuildDigest: mission.runtimeExpectation.agentTeamsBuildDigest, imageDigests: mission.runtimeExpectation.imageDigests}})).json().ticket as string;
  const dispatch = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('PROJECT_DISPATCH'), 'idempotency-key': `provider-dispatch-${suffix}`, 'if-match': etag}, payload: {kind: 'PROJECT_DISPATCHED', receipt: projectReceipt(mission)}}); mission = dispatch.json().mission; etag = dispatch.headers.etag!;
  let task = mission.tasks.find((item) => item.kind === 'FREEZE_EVIDENCE')!;
  const ack = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('TASK_ACK', task), 'idempotency-key': `provider-ack-${suffix}`, 'if-match': etag}, payload: {kind: 'TASK_ACK', receipt: ackReceipt(mission, task)}}); mission = ack.json().mission; task = mission.tasks.find((item) => item.id === task.id)!;
  const generated = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('MODEL_GENERATE', task)}, payload: {taskId: task.id, roleId: task.roleId, attempt: task.attempt, inputProjectionDigest: task.inputProjectionDigest}});
  const reopened = await app.inject({method: 'GET', url: `/api/v1/shadow-missions/${missionId}`, headers});
  return {generated, reopened, task};
}

function requestLiveTicket(app: ReturnType<typeof buildApi>, headers: Record<string, string>, mission: ShadowMission, action: string, task?: TaskContract, overrides: Record<string, unknown> = {}) {
  return app.inject({method: 'POST', url: `/api/v1/shadow-missions/${mission.id}/live-runner/tickets`, headers: {...headers, 'x-lumiclaw-runner-bootstrap': runtimeBootstrapTestSecret}, payload: {missionId: mission.id, campaignDigest: mission.sourceCampaignDigest, action, roleId: task?.roleId ?? null, taskId: task?.id ?? null, attempt: task?.attempt ?? null, agentTeamsSourceTarSha256: mission.runtimeExpectation.agentTeamsSourceTarSha256, agentTeamsBuildDigest: mission.runtimeExpectation.agentTeamsBuildDigest, imageDigests: mission.runtimeExpectation.imageDigests, ...overrides}});
}

afterEach(async () => { await Promise.all(apps.splice(0).map(async (app) => app.close())); });

describe('M1 Campaign API contract', () => {
  it('persists explicit Live UAT state and fails closed without the Compose secret, with no Mock fallback', async () => {
    const app = buildApi({now, runtimeBootstrapSecret: runtimeBootstrapTestSecret}); apps.push(app); const document = createDemoCampaignDocument();
    const base = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'live-campaign-001'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: base, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...base, 'idempotency-key': 'live-start-00001', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA', providerMode: 'LIVE_DEEPSEEK_UAT', providerModel: 'deepseek-v4-flash'}});
    expect(started.statusCode).toBe(201); expect(started.json().mission).toMatchObject({state: 'WAITING_RUNTIME', providerMode: 'LIVE_DEEPSEEK_UAT', providerMaturity: 'LIVE_PROVIDER_CANARY', live: false, runtimeStatus: {nextResponsible: 'COORDINATOR'}});
    const missionId = started.json().mission.id; let mission = started.json().mission as ShadowMission; let etag = started.headers.etag!;
    const ticket = async (action: string, task?: TaskContract) => app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-runner/tickets`, headers: {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runner-bootstrap': runtimeBootstrapTestSecret}, payload: {missionId, campaignDigest: mission.sourceCampaignDigest, action, roleId: task?.roleId ?? null, taskId: task?.id ?? null, attempt: task?.attempt ?? null, agentTeamsSourceTarSha256: mission.runtimeExpectation.agentTeamsSourceTarSha256, agentTeamsBuildDigest: mission.runtimeExpectation.agentTeamsBuildDigest, imageDigests: mission.runtimeExpectation.imageDigests}});
    const projectTicket = await ticket('PROJECT_DISPATCH'); expect(projectTicket.statusCode).toBe(200);
    const dispatched = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-ticket': projectTicket.json().ticket, 'idempotency-key': 'live-dispatch-001', 'if-match': etag}, payload: {kind: 'PROJECT_DISPATCHED', receipt: projectReceipt(mission)}});
    expect(dispatched.statusCode).toBe(200); mission = dispatched.json().mission; etag = dispatched.headers.etag!;
    const steward = mission.tasks.find((task) => task.kind === 'FREEZE_EVIDENCE')!;
    const ackTicket = await ticket('TASK_ACK', steward); expect(ackTicket.statusCode).toBe(200);
    const acked = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-ticket': ackTicket.json().ticket, 'idempotency-key': 'live-ack-0000001', 'if-match': etag}, payload: {kind: 'TASK_ACK', receipt: ackReceipt(mission, steward)}});
    expect(acked.statusCode).toBe(200); mission = acked.json().mission;
    const modelTicket = await ticket('MODEL_GENERATE', mission.tasks.find((task) => task.id === steward.id)!); expect(modelTicket.statusCode).toBe(200);
    const missingSecret = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-ticket': modelTicket.json().ticket}, payload: {taskId: steward.id, roleId: steward.roleId, attempt: steward.attempt, inputProjectionDigest: steward.inputProjectionDigest}});
    expect(missingSecret.statusCode).toBe(503); expect(missingSecret.json()).toMatchObject({code: 'DEEPSEEK_SECRET_FILE_UNAVAILABLE', mockFallback: false, nextResponsible: 'COORDINATOR'});
    const reopened = await app.inject({method: 'GET', url: `/api/v1/shadow-missions/${missionId}`, headers: {'x-lumiclaw-organization-id': document.organizationId}});
    expect(reopened.json().mission).toMatchObject({state: 'FAILED', modelCalls: [], actionGrantCount: 0, connectorCount: 0, externalActionCount: 0, runtimeStatus: {failure: {code: 'DEEPSEEK_SECRET_FILE_UNAVAILABLE'}}});
    const reuse = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-ticket': modelTicket.json().ticket}, payload: {taskId: steward.id, roleId: steward.roleId, attempt: steward.attempt, inputProjectionDigest: steward.inputProjectionDigest}});
    expect(reuse.statusCode).toBe(403); expect(reuse.json().code).toBe('LIVE_RUNTIME_TICKET_REUSED');
    const forbiddenFallback = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/public-safe-flight`, headers: {...base, 'idempotency-key': 'live-no-fallback', 'if-match': reopened.headers.etag!}});
    expect(forbiddenFallback.statusCode).toBe(422); expect(forbiddenFallback.json().code).toBe('MOCK_FALLBACK_FORBIDDEN');
  });

  it('binds a redacted Live provider receipt to the exact domain Task before accepting its Runtime Submit', async () => {
    const app = buildApi({now, runtimeBootstrapSecret: runtimeBootstrapTestSecret, deepseekApiKey: 'conformance-key-that-never-leaves-memory-0001', liveModelProviderFactory: () => ({generateStructured: async (request: ModelGenerateRequest<unknown>) => {
      const value = {frozen: true, assessment: 'Approved Claim and Evidence bindings are frozen for SHADOW review.'}; const inputDigest = sha256Digest({system: request.system, input: request.input}); const outputDigest = sha256Digest(value);
      return {ok: true as const, value, snapshot: {schemaVersion: 1 as const, id: createUuidV7(now().getTime(), new Uint8Array(10)), missionId: request.missionId, taskId: request.taskId, provider: 'DEEPSEEK' as const, maturity: 'CANARY' as const, model: request.model, response: {id: 'redacted-conformance-response', actualModel: request.model, systemFingerprint: null, finishReason: 'stop'}, config: {temperature: 0, maxTokens: 4000, responseFormat: 'json_object' as const, timeoutMs: 120000, maxAttempts: 3}, pricing: {source: 'DEEPSEEK_OFFICIAL_2026-08-04' as const, inputCacheHitUsdPerMillion: 0.0028, inputCacheMissUsdPerMillion: 0.14, outputUsdPerMillion: 0.28, peakMultiplierNotApplied: true as const}, inputDigest, outputDigest, tokenUsage: {input: 20, output: 10, cacheHit: 5, cacheMiss: 15, reasoning: 0}, estimatedCostUsd: 0.000004914, latencyMs: 23, attempts: 1, error: null, secretPresent: false as const, createdAt: now().toISOString()}};
    }} as unknown as ModelProvider)}); apps.push(app); const document = createDemoCampaignDocument(); const headers = {'x-lumiclaw-organization-id': document.organizationId};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {...headers, 'idempotency-key': 'live-success-campaign'}, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': 'live-success-start', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA', providerMode: 'LIVE_DEEPSEEK_UAT', providerModel: 'deepseek-v4-flash'}});
    let mission = started.json().mission as ShadowMission; let etag = started.headers.etag!; const missionId = mission.id;
    const issue = async (action: string, task?: TaskContract) => (await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-runner/tickets`, headers: {...headers, 'x-lumiclaw-runner-bootstrap': runtimeBootstrapTestSecret}, payload: {missionId, campaignDigest: mission.sourceCampaignDigest, action, roleId: task?.roleId ?? null, taskId: task?.id ?? null, attempt: task?.attempt ?? null, agentTeamsSourceTarSha256: mission.runtimeExpectation.agentTeamsSourceTarSha256, agentTeamsBuildDigest: mission.runtimeExpectation.agentTeamsBuildDigest, imageDigests: mission.runtimeExpectation.imageDigests}})).json().ticket as string;
    const dispatch = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('PROJECT_DISPATCH'), 'idempotency-key': 'live-success-dispatch', 'if-match': etag}, payload: {kind: 'PROJECT_DISPATCHED', receipt: projectReceipt(mission)}}); mission = dispatch.json().mission; etag = dispatch.headers.etag!;
    let task = mission.tasks.find((item) => item.kind === 'FREEZE_EVIDENCE')!;
    const ack = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('TASK_ACK', task), 'idempotency-key': 'live-success-ack', 'if-match': etag}, payload: {kind: 'TASK_ACK', receipt: ackReceipt(mission, task)}}); mission = ack.json().mission;
    task = mission.tasks.find((item) => item.kind === 'FREEZE_EVIDENCE')!;
    const generated = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('MODEL_GENERATE', task)}, payload: {taskId: task.id, roleId: task.roleId, attempt: task.attempt, inputProjectionDigest: task.inputProjectionDigest}});
    expect(generated.statusCode).toBe(200); expect(generated.json()).toMatchObject({maturity: 'LIVE_PROVIDER_CANARY', receipt: {provider: 'DEEPSEEK', maturity: 'CANARY', secretPresent: false}, mission: {modelCalls: [{taskId: task.id, runtimeOutputDigest: sha256Digest(generated.json().payload)}]}}); mission = generated.json().mission; etag = generated.headers.etag!; task = mission.tasks.find((item) => item.kind === 'FREEZE_EVIDENCE')!;
    const submit = taskSubmission(mission, task, generated.json().payload, 'CANARY');
    const accepted = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': await issue('TASK_SUBMIT', task), 'idempotency-key': 'live-success-submit', 'if-match': etag}, payload: {kind: 'TASK_SUBMIT', submission: submit}});
    expect(accepted.statusCode).toBe(200); expect(accepted.json().mission.tasks.find((item: {id: string}) => item.id === task.id).state).toBe('ACCEPTED'); expect(accepted.json().mission.modelCalls).toHaveLength(1); expect(accepted.json().mission.actionGrantCount).toBe(0);
  });

  it('imports the fifth independent Auditor model result and materializes the exact frozen FAIL', async () => {
    const {app, headers, missionId, lastGenerated, initialAuditSubmit, staleAuditSubmit, wrongScopeAuditSubmit, acceptedAuditRequest, reopened} = await liveInitialAuditAttempt('EXACT_FROZEN_FAIL', 'exact');
    expect(lastGenerated?.statusCode).toBe(200); expect(initialAuditSubmit?.statusCode).toBe(200);
    expect(staleAuditSubmit?.statusCode).toBe(412); expect(staleAuditSubmit?.json().code).toBe('MISSION_VERSION_CONFLICT');
    expect(wrongScopeAuditSubmit?.statusCode).toBe(403); expect(wrongScopeAuditSubmit?.json()).toEqual({code: 'LIVE_RUNTIME_TICKET_SCOPE_MISMATCH', mockFallback: false, secretPresent: false});
    const replayWithConsumedTicket = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': acceptedAuditRequest!.ticket, 'idempotency-key': acceptedAuditRequest!.idempotencyKey, 'if-match': acceptedAuditRequest!.etag}, payload: {kind: 'TASK_SUBMIT', submission: acceptedAuditRequest!.submission}});
    expect(replayWithConsumedTicket.statusCode).toBe(403); expect(replayWithConsumedTicket.json()).toEqual({code: 'LIVE_RUNTIME_TICKET_REUSED', mockFallback: false, secretPresent: false});
    expect(reopened.json().mission).toMatchObject({state: 'REVISION_REQUIRED', modelCalls: expect.any(Array), actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(reopened.json().mission.modelCalls).toHaveLength(5); expect(reopened.json().mission.revisions).toHaveLength(4); expect(reopened.json().mission.audits).toHaveLength(4);
    const reopenedMission = reopened.json().mission;
    expect(reopenedMission.audits.find((audit: {revisionId: string}) => audit.revisionId === reopenedMission.fault.deniedRevisionId)).toMatchObject({outcome: 'FAIL', status: 'ACTIVE', issues: [{code: 'CLAIM_OVERREACH', nextResponsibleRoleId: 'founder-identity-producer'}]});
    expect(reopenedMission.audits.filter((audit: {revisionId: string}) => audit.revisionId !== reopenedMission.fault.deniedRevisionId).every((audit: {outcome: string; issues: unknown[]}) => audit.outcome === 'PASS' && audit.issues.length === 0)).toBe(true);
  });

  it('authorizes only the exact correction and re-audit phase tickets through seven accepted model receipts', async () => {
    const {app, headers, missionId, reopened} = await liveInitialAuditAttempt('EXACT_FROZEN_FAIL', 'phase-policy');
    let mission = reopened.json().mission as ShadowMission; let etag = reopened.headers.etag!;
    expect(mission).toMatchObject({state: 'REVISION_REQUIRED', modelCalls: expect.any(Array), actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(mission.modelCalls).toHaveLength(5); expect(mission.revisions).toHaveLength(4); expect(mission.audits).toHaveLength(4);

    let correction = mission.tasks.find((task) => task.kind === 'PRODUCE_FOUNDER_CORRECTION')!;
    const reAuditWaiting = mission.tasks.find((task) => task.kind === 'REAUDIT_CORRECTION')!;
    const acceptedInitialAuditor = mission.tasks.find((task) => task.kind === 'AUDIT_REVISIONS')!;
    expect(correction).toMatchObject({state: 'ASSIGNED', roleId: 'founder-identity-producer', attempt: 2});
    const wrongAction = await requestLiveTicket(app, headers, mission, 'FINALIZE', correction);
    expect(wrongAction.statusCode).toBe(409); expect(wrongAction.json().code).toBe('LIVE_RUNTIME_ACTION_NOT_READY');
    const wrongRole = await requestLiveTicket(app, headers, mission, 'TASK_ACK', correction, {roleId: 'campaign-planner'});
    expect(wrongRole.statusCode).toBe(422); expect(wrongRole.json().code).toBe('LIVE_RUNTIME_TASK_SCOPE_INVALID');
    const wrongAttempt = await requestLiveTicket(app, headers, mission, 'TASK_ACK', correction, {attempt: 1});
    expect(wrongAttempt.statusCode).toBe(422); expect(wrongAttempt.json().code).toBe('LIVE_RUNTIME_TASK_SCOPE_INVALID');
    const reAuditWrongPhase = await requestLiveTicket(app, headers, mission, 'TASK_ACK', reAuditWaiting);
    expect(reAuditWrongPhase.statusCode).toBe(409); expect(reAuditWrongPhase.json().code).toBe('LIVE_RUNTIME_ACTION_NOT_READY');
    const initialTaskLaterPhase = await requestLiveTicket(app, headers, mission, 'TASK_ACK', acceptedInitialAuditor);
    expect(initialTaskLaterPhase.statusCode).toBe(409); expect(initialTaskLaterPhase.json().code).toBe('LIVE_RUNTIME_ACTION_NOT_READY');
    const prematureCorrectionModel = await requestLiveTicket(app, headers, mission, 'MODEL_GENERATE', correction);
    expect(prematureCorrectionModel.statusCode).toBe(409); expect(prematureCorrectionModel.json().code).toBe('LIVE_RUNTIME_ACTION_NOT_READY');
    const correctionAckTicket = await requestLiveTicket(app, headers, mission, 'TASK_ACK', correction);
    expect(correctionAckTicket.statusCode).toBe(200);
    const correctionAck = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': correctionAckTicket.json().ticket, 'idempotency-key': 'phase-correction-ack', 'if-match': etag}, payload: {kind: 'TASK_ACK', receipt: ackReceipt(mission, correction)}});
    expect(correctionAck.statusCode).toBe(200); mission = correctionAck.json().mission; etag = correctionAck.headers.etag!; correction = mission.tasks.find((task) => task.id === correction.id)!;
    expect(correction.state).toBe('ACKNOWLEDGED');

    const correctionModelTicket = await requestLiveTicket(app, headers, mission, 'MODEL_GENERATE', correction);
    expect(correctionModelTicket.statusCode).toBe(200);
    const wrongDigest = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {...headers, 'x-lumiclaw-runtime-ticket': correctionModelTicket.json().ticket}, payload: {taskId: correction.id, roleId: correction.roleId, attempt: correction.attempt, inputProjectionDigest: 'f'.repeat(64)}});
    expect(wrongDigest.statusCode).toBe(422); expect(wrongDigest.json().code).toBe('LIVE_MODEL_TASK_BINDING_INVALID');
    const correctionGenerated = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {...headers, 'x-lumiclaw-runtime-ticket': correctionModelTicket.json().ticket}, payload: {taskId: correction.id, roleId: correction.roleId, attempt: correction.attempt, inputProjectionDigest: correction.inputProjectionDigest}});
    expect(correctionGenerated.statusCode).toBe(200); mission = correctionGenerated.json().mission; etag = correctionGenerated.headers.etag!; correction = mission.tasks.find((task) => task.id === correction.id)!;
    const reusedCorrectionModel = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {...headers, 'x-lumiclaw-runtime-ticket': correctionModelTicket.json().ticket}, payload: {taskId: correction.id, roleId: correction.roleId, attempt: correction.attempt, inputProjectionDigest: correction.inputProjectionDigest}});
    expect(reusedCorrectionModel.statusCode).toBe(403); expect(reusedCorrectionModel.json().code).toBe('LIVE_RUNTIME_TICKET_REUSED');
    const correctionSubmission = taskSubmission(mission, correction, correctionGenerated.json().payload, 'CANARY');
    const correctionSubmitTicket = await requestLiveTicket(app, headers, mission, 'TASK_SUBMIT', correction); expect(correctionSubmitTicket.statusCode).toBe(200);
    const correctionSubmit = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': correctionSubmitTicket.json().ticket, 'idempotency-key': 'phase-correction-submit', 'if-match': etag}, payload: {kind: 'TASK_SUBMIT', submission: correctionSubmission}});
    expect(correctionSubmit.statusCode).toBe(200); mission = correctionSubmit.json().mission; etag = correctionSubmit.headers.etag!;
    const replayedCorrectionSubmit = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': correctionSubmitTicket.json().ticket, 'idempotency-key': 'phase-correction-submit', 'if-match': etag}, payload: {kind: 'TASK_SUBMIT', submission: correctionSubmission}});
    expect(replayedCorrectionSubmit.statusCode).toBe(403); expect(replayedCorrectionSubmit.json().code).toBe('LIVE_RUNTIME_TICKET_REUSED');
    expect(mission).toMatchObject({state: 'AUDIT_BLOCKED', actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}); expect(mission.revisions).toHaveLength(5); expect(mission.audits).toHaveLength(4);

    let reAudit = mission.tasks.find((task) => task.kind === 'REAUDIT_CORRECTION')!;
    expect(reAudit).toMatchObject({state: 'ASSIGNED', roleId: 'independent-auditor', attempt: 2});
    const correctionAfterPhase = await requestLiveTicket(app, headers, mission, 'TASK_ACK', correction);
    expect(correctionAfterPhase.statusCode).toBe(409); expect(correctionAfterPhase.json().code).toBe('LIVE_RUNTIME_ACTION_NOT_READY');
    const prematureReAuditModel = await requestLiveTicket(app, headers, mission, 'MODEL_GENERATE', reAudit);
    expect(prematureReAuditModel.statusCode).toBe(409); expect(prematureReAuditModel.json().code).toBe('LIVE_RUNTIME_ACTION_NOT_READY');
    const reAuditAckTicket = await requestLiveTicket(app, headers, mission, 'TASK_ACK', reAudit); expect(reAuditAckTicket.statusCode).toBe(200);
    const reAuditAck = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': reAuditAckTicket.json().ticket, 'idempotency-key': 'phase-reaudit-ack', 'if-match': etag}, payload: {kind: 'TASK_ACK', receipt: ackReceipt(mission, reAudit)}});
    expect(reAuditAck.statusCode).toBe(200); mission = reAuditAck.json().mission; etag = reAuditAck.headers.etag!; reAudit = mission.tasks.find((task) => task.id === reAudit.id)!;
    const reAuditModelTicket = await requestLiveTicket(app, headers, mission, 'MODEL_GENERATE', reAudit); expect(reAuditModelTicket.statusCode).toBe(200);
    const reAuditGenerated = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/live-model-generate`, headers: {...headers, 'x-lumiclaw-runtime-ticket': reAuditModelTicket.json().ticket}, payload: {taskId: reAudit.id, roleId: reAudit.roleId, attempt: reAudit.attempt, inputProjectionDigest: reAudit.inputProjectionDigest}});
    expect(reAuditGenerated.statusCode).toBe(200); mission = reAuditGenerated.json().mission; etag = reAuditGenerated.headers.etag!; reAudit = mission.tasks.find((task) => task.id === reAudit.id)!;
    const reAuditSubmission = taskSubmission(mission, reAudit, reAuditGenerated.json().payload, 'CANARY');
    const reAuditSubmitTicket = await requestLiveTicket(app, headers, mission, 'TASK_SUBMIT', reAudit); expect(reAuditSubmitTicket.statusCode).toBe(200);
    const reAuditSubmit = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/runtime-events`, headers: {...headers, 'x-lumiclaw-runtime-ticket': reAuditSubmitTicket.json().ticket, 'idempotency-key': 'phase-reaudit-submit', 'if-match': etag}, payload: {kind: 'TASK_SUBMIT', submission: reAuditSubmission}});
    expect(reAuditSubmit.statusCode).toBe(200); mission = reAuditSubmit.json().mission;
    expect(mission).toMatchObject({state: 'AWAITING_OWNER_REVIEW', actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(mission.modelCalls).toHaveLength(7); expect(mission.revisions).toHaveLength(5); expect(mission.audits).toHaveLength(5);
    expect(mission.audits.find((audit) => audit.revisionId === mission.fault.deniedRevisionId)?.status).toBe('INVALIDATED');
    expect(mission.audits.find((audit) => audit.revisionId === mission.fault.correctedRevisionId)).toMatchObject({outcome: 'PASS', status: 'ACTIVE'});
  });

  it('rejects a structurally closed all-PASS initial Audit before AgentTeams submission import', async () => {
    const {lastGenerated, initialAuditSubmit, reopened} = await liveInitialAuditAttempt('INVALID_ALL_PASS', 'all-pass');
    expect(lastGenerated?.statusCode).toBe(502); expect(lastGenerated?.json()).toMatchObject({code: 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', providerOutcomeCode: 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', mockFallback: false});
    expect(initialAuditSubmit).toBeUndefined();
    expect(reopened.json().mission).toMatchObject({state: 'FAILED', modelCalls: expect.any(Array), revisions: [], audits: [], actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(reopened.json().mission.modelCalls).toHaveLength(5);
  });

  it.each([
    'OMIT_FROZEN_PHRASE', 'PARAPHRASE_FROZEN_PHRASE', 'REVERSE_FROZEN_PHRASE', 'PUNCTUATE_FROZEN_PHRASE',
    'SPLIT_FROZEN_PHRASE', 'ALT_TEXT_ONLY', 'XIAOHONGSHU_ONLY', 'UNICODE_LOOKALIKE'
  ] as const)('rejects Founder frozen-fault mutation %s before the independent Auditor model call', async (founderFaultMode) => {
    const suffix = founderFaultMode.toLowerCase().replaceAll('_', '-');
    const {lastGenerated, initialAuditSubmit, reopened} = await liveInitialAuditAttempt('EXACT_FROZEN_FAIL', suffix, founderFaultMode);
    expect(lastGenerated?.statusCode).toBe(502); expect(lastGenerated?.json()).toMatchObject({code: 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', providerOutcomeCode: 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', mockFallback: false});
    expect(initialAuditSubmit).toBeUndefined();
    expect(reopened.json().mission).toMatchObject({state: 'FAILED', modelCalls: expect.any(Array), revisions: [], audits: [], actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(reopened.json().mission.modelCalls).toHaveLength(3);
  });

  it.each(['PROVIDER_HTTP_401', 'PROVIDER_HTTP_402', 'PROVIDER_HTTP_404', 'PROVIDER_HTTP_429', 'PROVIDER_HTTP_500', 'PROVIDER_HTTP_502', 'PROVIDER_HTTP_503', 'PROVIDER_HTTP_504', 'MODEL_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'MODEL_RESPONSE_IDENTITY_INVALID', 'MODEL_RETURNED_MODEL_MISMATCH', 'MODEL_OUTPUT_TRUNCATED', 'MODEL_CONTENT_FILTERED', 'MODEL_TOOL_CALL_FORBIDDEN', 'MODEL_INFERENCE_RESOURCE_UNAVAILABLE', 'MODEL_FINISH_REASON_INVALID', 'MODEL_USAGE_INVALID', 'PROVIDER_RESPONSE_INVALID', 'MODEL_JSON_MALFORMED', 'MODEL_SCHEMA_INVALID'])('persists only the allowlisted first-domain provider outcome %s', async (providerOutcomeCode) => {
    const provider = {generateStructured: async (request: ModelGenerateRequest<unknown>) => ({ok: false as const, snapshot: liveSnapshot(request, providerOutcomeCode)})};
    const {generated, reopened, task} = await firstLiveDomainAttempt(provider, providerOutcomeCode.toLowerCase().replaceAll('_', '-'));
    expect(generated.statusCode).toBe(502); expect(generated.json()).toEqual({code: providerOutcomeCode, providerOutcomeCode, mockFallback: false, nextResponsible: 'COORDINATOR'});
    expect(reopened.json().mission).toMatchObject({state: 'FAILED', runtimeStatus: {failure: {code: providerOutcomeCode, failedTaskId: task.id}}, modelCalls: [{taskId: task.id, error: {code: providerOutcomeCode}}], actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(JSON.stringify(generated.json())).not.toMatch(/redacted-fixture-response|authorization|bearer|prompt|model content/iu);
  });

  it('persists the semantic outcome without returning model content or the response receipt', async () => {
    const value = {status: 'valid JSON but wrong role semantics'};
    const provider = {generateStructured: async (request: ModelGenerateRequest<unknown>) => ({ok: true as const, value, snapshot: liveSnapshot(request, null, value)})} as unknown as ModelProvider;
    const {generated, reopened, task} = await firstLiveDomainAttempt(provider, 'semantic-invalid');
    expect(generated.statusCode).toBe(502); expect(generated.json()).toEqual({code: 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', providerOutcomeCode: 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', mockFallback: false, nextResponsible: 'COORDINATOR'});
    expect(reopened.json().mission).toMatchObject({state: 'FAILED', runtimeStatus: {failure: {code: 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', failedTaskId: task.id}}, modelCalls: [{taskId: task.id, error: null}], actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(JSON.stringify(generated.json())).not.toContain('valid JSON but wrong role semantics');
  });

  it('redacts arbitrary broker exceptions to the stable broker outcome', async () => {
    const raw = 'Bearer dummy-secret raw-provider-response';
    for (const [suffix, failure] of [['plain', new Error(raw)], ['internal-contract', new ShadowContractError('LIVE_MODEL_CALL_RECEIPT_INVALID', raw)]] as const) {
      const provider = {generateStructured: async () => { throw failure; }} as ModelProvider;
      const {generated, reopened, task} = await firstLiveDomainAttempt(provider, `broker-failed-${suffix}`);
      expect(generated.statusCode).toBe(502); expect(generated.json()).toEqual({code: 'LIVE_PROVIDER_BROKER_FAILED', providerOutcomeCode: 'LIVE_PROVIDER_BROKER_FAILED', mockFallback: false, nextResponsible: 'COORDINATOR'});
      expect(JSON.stringify(generated.json())).not.toContain(raw); expect(JSON.stringify(generated.json())).not.toContain('LIVE_MODEL_CALL_RECEIPT_INVALID'); expect(reopened.json().mission).toMatchObject({state: 'FAILED', runtimeStatus: {failure: {code: 'LIVE_PROVIDER_BROKER_FAILED', failedTaskId: task.id}}, modelCalls: [], actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    }
  });

  it('returns explicit PostgreSQL/non-live health and OpenAPI', async () => {
    const app = buildApi({now}); apps.push(app);
    expect((await app.inject({method: 'GET', url: '/health'})).json()).toEqual({service: 'api', status: 'ok', mode: 'DEMO_SEED', live: false, controlPlane: 'POSTGRESQL'});
    const openapi = await app.inject({method: 'GET', url: '/api/v1/openapi.json'});
    expect(openapi.json().openapi).toBe('3.1.0');
    expect(openapi.json().paths['/api/v1/campaigns']).toBeDefined();
    expect(openapi.json().paths['/api/v1/campaigns/{campaignId}/shadow-missions']).toBeDefined();
    expect(openapi.json().paths['/api/v1/shadow-missions/{missionId}/runtime-events']).toBeDefined();
    expect(openapi.json().components.schemas.CampaignDocument.properties.graph.additionalProperties).toBe(false);
  });

  it('queues, runs, reopens and exactly reviews a governed SHADOW Mission without action authority', async () => {
    const app = buildApi({now}); apps.push(app); const document = createDemoCampaignDocument();
    const baseHeaders = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'campaign-for-shadow'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: baseHeaders, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...baseHeaders, 'idempotency-key': 'shadow-start-0001', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA'}});
    expect(started.statusCode).toBe(201); expect(started.json().mission).toMatchObject({runtimeVersion: 'v1.2.0', state: 'QUEUED', externalActionAllowed: false}); expect(started.json().mission.roleContexts).toHaveLength(6);
    const missionId = started.json().mission.id;
    const flight = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/public-safe-flight`, headers: {...baseHeaders, 'idempotency-key': 'flight-run-00001', 'if-match': started.headers.etag!}});
    expect(flight.statusCode).toBe(200); expect(flight.json()).toMatchObject({maturity: 'MOCK_CONFORMANCE', realAgentTeamsClaim: false}); expect(flight.json().mission).toMatchObject({state: 'NEEDS_OWNER_REVIEW', actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
    expect(flight.json().mission.modelCalls).toHaveLength(1); expect(flight.json().mission.modelCalls[0]).toMatchObject({provider: 'PUBLIC_SAFE_MOCK', maturity: 'MOCK_CONFORMANCE', secretPresent: false});
    expect(flight.json().mission.mediaAssets).toHaveLength(1); expect(flight.json().mission.mediaAssets[0]).toMatchObject({provider: 'PUBLIC_SAFE_MOCK', approvalState: 'UNREVIEWED'});
    const flightReplay = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/public-safe-flight`, headers: {...baseHeaders, 'idempotency-key': 'flight-run-00001', 'if-match': started.headers.etag!}});
    expect(flightReplay.statusCode).toBe(200); expect(flightReplay.headers['idempotency-replayed']).toBe('true'); expect(flightReplay.json().mission.etag).toBe(flight.json().mission.etag);
    const denied = flight.json().mission.revisions.find((item: {id: string}) => item.id === flight.json().mission.fault.deniedRevisionId);
    const deniedReview = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/owner-reviews`, headers: {...baseHeaders, 'idempotency-key': 'denied-review-01', 'if-match': flight.headers.etag!}, payload: {revisionId: denied.id, revisionDigest: denied.digest, decision: 'READY_FOR_FUTURE_EXECUTION'}});
    expect(deniedReview.statusCode).toBe(422); expect(deniedReview.json().code).toBe('REVIEW_AUDIT_PASS_REQUIRED');
    const corrected = flight.json().mission.revisions.find((item: {id: string}) => item.id === flight.json().mission.fault.correctedRevisionId);
    const reviewed = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/owner-reviews`, headers: {...baseHeaders, 'idempotency-key': 'exact-review-001', 'if-match': flight.headers.etag!}, payload: {revisionId: corrected.id, revisionDigest: corrected.digest, decision: 'READY_FOR_FUTURE_EXECUTION'}});
    expect(reviewed.statusCode).toBe(200); expect(reviewed.json()).toMatchObject({createsActionGrant: false, externalActionAllowed: false}); expect(reviewed.json().mission.reviews[0]).toMatchObject({authority: 'NON_EXECUTABLE_OWNER_REVIEW', createsActionGrant: false});
    const reviewReplay = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${missionId}/owner-reviews`, headers: {...baseHeaders, 'idempotency-key': 'exact-review-001', 'if-match': flight.headers.etag!}, payload: {revisionId: corrected.id, revisionDigest: corrected.digest, decision: 'READY_FOR_FUTURE_EXECUTION'}});
    expect(reviewReplay.statusCode).toBe(200); expect(reviewReplay.headers['idempotency-replayed']).toBe('true'); expect(reviewReplay.json().mission.etag).toBe(reviewed.json().mission.etag);
    const evidence = await app.inject({method: 'GET', url: `/api/v1/shadow-missions/${missionId}/evidence`, headers: baseHeaders});
    expect(evidence.json().evidence.noAction).toEqual({externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0});
  });

  it('persists adapter Project/ACK/Submit events and quarantines duplicate accepted Runtime output', async () => {
    const app = buildApi({now, runtimeImportToken: runtimeImportTestToken}); apps.push(app); const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-import-token': runtimeImportTestToken, 'idempotency-key': 'runtime-campaign'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': 'runtime-start-001', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA'}});
    const missionId = started.json().mission.id; const route = `/api/v1/shadow-missions/${missionId}/runtime-events`;
    const initialTask = started.json().mission.tasks.find((item: {roleId: string}) => item.roleId === 'presence-mission-leader'); const initialPayload = {projectId: started.json().mission.runtimeProjectId, externalActionAllowed: false}; const initialOutputDigest = sha256Digest(initialPayload);
    const forgedResultDigest = sha256Digest({schemaVersion: 1, taskId: initialTask.id, roleId: initialTask.roleId, inputProjectionSchema: initialTask.inputProjectionSchema, inputProjectionDigest: initialTask.inputProjectionDigest, payload: initialPayload, outputDigest: initialOutputDigest, maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false});
    const forgedBeforeDispatch = {schemaVersion: 1, missionId, taskId: initialTask.id, roleId: initialTask.roleId, roleIdentityId: initialTask.roleIdentityId, inputDigest: initialTask.inputDigest, inputProjectionSchema: initialTask.inputProjectionSchema, inputProjectionDigest: initialTask.inputProjectionDigest, skillLockDigest: initialTask.skillLockDigest, outputSchema: initialTask.outputSchema, outputSchemaVersion: 1, payload: initialPayload, outputDigest: initialOutputDigest, runtimeResultMaturity: 'MOCK_CONFORMANCE', runtimeReceipt: {schemaVersion: 1, projectId: started.json().mission.runtimeProjectId, taskId: initialTask.id, roleId: initialTask.roleId, runtimeActorId: '@presence-mission-leader:runtime.test', attempt: 1, ackReceiptDigest: '0'.repeat(64), inputProjectionSchema: initialTask.inputProjectionSchema, inputProjectionDigest: initialTask.inputProjectionDigest, runtimeState: 'submitted', submittedAt: now().toISOString(), resultDigest: forgedResultDigest, resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY', runtimeObservationId: '0'.repeat(64), receiptDigest: '0'.repeat(64)}};
    const dispatchReceipt = projectReceipt(started.json().mission as ShadowMission);
    const unauthenticated = await app.inject({method: 'POST', url: route, headers: {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'runtime-no-auth-01', 'if-match': started.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: dispatchReceipt}});
    expect(unauthenticated.statusCode).toBe(403); expect(unauthenticated.json().code).toBe('RUNTIME_IMPORT_AUTH_REQUIRED');
    const rejectedBeforeDispatch = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-forged-01', 'if-match': started.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission: forgedBeforeDispatch}}); expect(rejectedBeforeDispatch.statusCode).toBe(422); expect(rejectedBeforeDispatch.json().mission.trace.at(-1).detail.errors).toContain('PROJECT_NOT_DISPATCHED');
    const dispatched = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-project-1', 'if-match': rejectedBeforeDispatch.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: dispatchReceipt}});
    expect(dispatched.statusCode).toBe(200); expect(dispatched.json().mission.state).toBe('RUNNING');
    const task = dispatched.json().mission.tasks.find((item: {roleId: string}) => item.roleId === 'presence-mission-leader');
    const rejectedBeforeAck = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-forged-02', 'if-match': dispatched.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission: forgedBeforeDispatch}}); expect(rejectedBeforeAck.statusCode).toBe(422); expect(rejectedBeforeAck.json().mission.trace.at(-1).detail.errors).toContain('TASK_NOT_ACKNOWLEDGED');
    const exactAckReceipt = ackReceipt(dispatched.json().mission as ShadowMission, task as TaskContract);
    const ack = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-ack-0001', 'if-match': rejectedBeforeAck.headers.etag!}, payload: {kind: 'TASK_ACK', receipt: exactAckReceipt}});
    expect(ack.statusCode).toBe(200); expect(ack.json().mission.tasks.find((item: {id: string}) => item.id === task.id).state).toBe('ACKNOWLEDGED');
    const payload = {projectId: ack.json().mission.runtimeProjectId, externalActionAllowed: false};
    const submission = taskSubmission(ack.json().mission as ShadowMission, task as TaskContract, payload);
    const submitted = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-submit-01', 'if-match': ack.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission}});
    expect(submitted.statusCode).toBe(200); expect(submitted.json().mission.tasks.find((item: {id: string}) => item.id === task.id).state).toBe('ACCEPTED');
    const duplicate = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-submit-02', 'if-match': submitted.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission}});
    expect(duplicate.statusCode).toBe(422); expect(duplicate.json()).toMatchObject({code: 'RUNTIME_SUBMISSION_QUARANTINED', accepted: false}); expect(duplicate.json().mission.trace.at(-1).detail.errors).toContain('DUPLICATE_ACCEPTED_SUBMISSION');
    const duplicateReplay = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-submit-02', 'if-match': submitted.headers.etag!}, payload: {kind: 'TASK_SUBMIT', submission}});
    expect(duplicateReplay.statusCode).toBe(422); expect(duplicateReplay.headers['idempotency-replayed']).toBe('true'); expect(duplicateReplay.json()).toMatchObject({code: 'RUNTIME_SUBMISSION_QUARANTINED_REPLAYED', accepted: false, realAgentTeamsClaim: false});
    const secondDispatch = await app.inject({method: 'POST', url: route, headers: {...headers, 'idempotency-key': 'runtime-project-2', 'if-match': duplicate.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: {...dispatchReceipt, buildDigest: `sha256:${'b'.repeat(64)}`}}});
    expect(secondDispatch.statusCode).toBe(409); expect(secondDispatch.json()).toMatchObject({code: 'RUNTIME_PROJECT_ALREADY_DISPATCHED'});
  });

  it('creates, replays, reopens, saves, and returns the same mission source digest', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'create-campaign-001'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    expect(created.statusCode).toBe(201);
    const first = created.json();
    const replay = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    expect(replay.statusCode).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    const reopened = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}`, headers: {'x-lumiclaw-organization-id': document.organizationId}});
    expect(reopened.json().digest).toBe(first.digest);
    const updatedDocument = reopened.json().document;
    const x = updatedDocument.artifactRevisions.find((item: {platform: string}) => item.platform === 'X');
    x.content.posts[0] = 'Updated synthetic X copy.';
    const saved = await app.inject({method: 'PUT', url: `/api/v1/campaigns/${document.id}`, headers: {...headers, 'idempotency-key': 'save-campaign-0001', 'if-match': reopened.headers.etag!}, payload: updatedDocument});
    expect(saved.statusCode).toBe(200);
    expect(saved.json().version).toBe(2);
    expect(saved.json().document.artifactRevisions.find((item: {platform: string}) => item.platform === 'X').revision).toBe(2);
    const mission = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}/mission-contract`, headers: {'x-lumiclaw-organization-id': document.organizationId}});
    expect(mission.json().digest).toBe(saved.json().digest);
    expect(mission.json().contract.sourceDigest).toBe(saved.json().digest);
  });

  it('fails closed for missing controls, key reuse, stale ETag, and cross-tenant scope', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument();
    expect((await app.inject({method: 'GET', url: '/api/v1/campaigns'})).statusCode).toBe(428);
    const orgHeaders = {'x-lumiclaw-organization-id': document.organizationId};
    expect((await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: orgHeaders, payload: document})).statusCode).toBe(428);
    const headers = {...orgHeaders, 'idempotency-key': 'fixed-key-0001'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const changed = structuredClone(document); changed.brief.name = 'Different body'; changed.missionContract.sourceDigest = 'f'.repeat(64);
    expect((await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: changed})).statusCode).toBe(409);
    expect((await app.inject({method: 'PUT', url: `/api/v1/campaigns/${document.id}`, headers: {...headers, 'idempotency-key': 'save-key-00001', 'if-match': '"stale"'}, payload: document})).statusCode).toBe(412);
    expect((await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}`, headers: {'x-lumiclaw-organization-id': document.graph.identities[0]!.id}})).statusCode).toBe(404);
    expect(created.headers.etag).toMatch(/^"campaign-/u);
  });

  it('returns a domain rejection rather than availability failure for malformed nested contracts', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument() as unknown as {organizationId: string; artifactRevisions: unknown[]};
    document.artifactRevisions[0] = {};
    const response = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'malformed-campaign'}, payload: document});
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('CAMPAIGN_VALIDATION_FAILED');
  });

  it('rejects forged initial approval, capability, artifact metadata, and invalid timestamps', async () => {
    const app = buildApi({now}); apps.push(app);
    const cases = [
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.claims[1]!.status = 'APPROVED'; document.claims[1]!.version = 99; document.claims[1]!.evidenceRefIds = [document.evidenceRefs[0]!.id]; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.capabilitySnapshots[0]!.constraints.posts!.maxLength = 99_999; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.artifactRevisions[0]!.revision = 99; document.artifactRevisions[0]!.createdAt = '2026-08-03T01:00:00.000Z'; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.evidenceRefs[0]!.capturedAt = 'not-a-date'; },
      (document: ReturnType<typeof createDemoCampaignDocument>) => { document.brief.targetWindowStart = '2026-02-31T00:00:00Z'; }
    ];
    for (const [index, mutate] of cases.entries()) {
      const document = createDemoCampaignDocument(); mutate(document);
      const response = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': `forged-create-${index}`}, payload: document});
      expect(response.statusCode).toBe(422);
      expect(response.json().code).toBe(index >= cases.length - 2 ? 'CAMPAIGN_VALIDATION_FAILED' : 'CAMPAIGN_AUTHORITY_FIELD_CHANGED');
    }
  });

  it('rejects campaign-scoped child IDs already owned by another Campaign in the tenant', async () => {
    const app = buildApi({now}); apps.push(app);
    const first = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': first.organizationId, 'idempotency-key': 'first-child-owner'};
    expect((await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: first})).statusCode).toBe(201);
    const second = structuredClone(first);
    second.id = createUuidV7(1_788_100_100_000, new Uint8Array(10).fill(77));
    second.artifactRevisions.forEach((item) => { item.campaignId = second.id; });
    const response = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers: {...headers, 'idempotency-key': 'second-child-owner'}, payload: second});
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('CAMPAIGN_CHILD_ID_CONFLICT');
  });

  it('previews persistent schedule rows while rejecting DST gaps and never enabling execution', async () => {
    const app = buildApi({now}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'create-for-schedule'};
    await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const preview = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/schedule-preview`, headers, payload: {localStart: '2026-11-01T01:30', timeZone: 'America/New_York', rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=2', foldPreference: 'LATER', misfirePolicy: 'SKIP'}});
    expect(preview.statusCode).toBe(200);
    expect(preview.json().executionAllowed).toBe(false);
    expect(preview.json().occurrences).toHaveLength(2);
    const gap = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/schedule-preview`, headers, payload: {localStart: '2026-03-08T02:30', timeZone: 'America/New_York', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'}});
    expect(gap.statusCode).toBe(422);
    expect(gap.json().code).toBe('DST_GAP');
    const forged = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/schedule-preview`, headers, payload: {localStart: '2026-09-01T09:00', timeZone: 'UTC', foldPreference: 'EARLIER', misfirePolicy: 'SKIP', organizationId: document.graph.identities[0]!.id}});
    expect(forged.statusCode).toBe(422);
    expect(forged.json().details[0].code).toBe('SCHEMA_INVALID');
  });

  it('re-derives time-bound readiness on reopen without changing the stored digest', async () => {
    let instant = new Date('2026-08-03T12:00:00.000Z');
    const clock = () => instant;
    const app = buildApi({now: clock}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'idempotency-key': 'time-readiness-001'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const digest = created.json().digest;
    instant = new Date('2027-02-01T00:00:00.000Z');
    const reopened = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}`, headers});
    expect(reopened.json().readiness).toBe('BLOCKED');
    expect(reopened.json().gapCodes).toContain('CLAIM_EXPIRED');
    expect(reopened.json().digest).toBe(digest);
    const list = await app.inject({method: 'GET', url: '/api/v1/campaigns', headers});
    expect(list.json().campaigns[0].readiness).toBe('BLOCKED');
    const mission = await app.inject({method: 'GET', url: `/api/v1/campaigns/${document.id}/mission-contract`, headers});
    expect(mission.statusCode).toBe(409);
    expect(mission.json().code).toBe('CAMPAIGN_BLOCKED');
    expect(mission.json().digest).toBe(digest);
    const blockedStart = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': 'blocked-shadow-start', 'if-match': created.headers.etag!}, payload: {sourceDigest: digest, fault: 'BETA_TO_GA'}});
    expect(blockedStart.statusCode).toBe(409);
    expect(blockedStart.json()).toMatchObject({code: 'CAMPAIGN_BLOCKED', digest, gapCodes: expect.arrayContaining(['CLAIM_EXPIRED'])});
  });

  it('re-checks Campaign freshness immediately before authenticated Project dispatch', async () => {
    let instant = new Date('2026-08-03T12:00:00.000Z');
    const clock = () => instant;
    const app = buildApi({now: clock, runtimeImportToken: runtimeImportTestToken}); apps.push(app);
    const document = createDemoCampaignDocument();
    const headers = {'x-lumiclaw-organization-id': document.organizationId, 'x-lumiclaw-runtime-import-token': runtimeImportTestToken, 'idempotency-key': 'dispatch-freshness-campaign'};
    const created = await app.inject({method: 'POST', url: '/api/v1/campaigns', headers, payload: document});
    const started = await app.inject({method: 'POST', url: `/api/v1/campaigns/${document.id}/shadow-missions`, headers: {...headers, 'idempotency-key': 'dispatch-freshness-start', 'if-match': created.headers.etag!}, payload: {sourceDigest: created.json().digest, fault: 'BETA_TO_GA'}});
    expect(started.statusCode).toBe(201);
    instant = new Date('2027-02-01T00:00:00.000Z');
    const blockedDispatch = await app.inject({method: 'POST', url: `/api/v1/shadow-missions/${started.json().mission.id}/runtime-events`, headers: {...headers, 'idempotency-key': 'dispatch-after-expiry', 'if-match': started.headers.etag!}, payload: {kind: 'PROJECT_DISPATCHED', receipt: projectReceipt(started.json().mission)}});
    expect(blockedDispatch.statusCode).toBe(409);
    expect(blockedDispatch.json()).toMatchObject({code: 'CAMPAIGN_BLOCKED', gapCodes: expect.arrayContaining(['CLAIM_EXPIRED'])});
  });
});
