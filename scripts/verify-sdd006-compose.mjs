import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const project = 'lumiclaw-sdd006-verify';
const webPort = '3166';
const apiPort = '4166';
const apiUrl = `http://127.0.0.1:${apiPort}`;
const evidencePath = path.resolve('.evidence/sdd-006/compose-verification.json');
const fixtureName = 'sdd-006-local-private-fixture.md';
const fixtureBytes = Buffer.from('# 星河公开安全测试资料\n用于验证本机私有初始化，不含客户或私密资料。');
const localIdentity = {organizationName: '星河工作室', brandName: '星河', brandPositioning: '帮助独立团队清楚表达跨市场产品价值。', productName: '星河翻译助手', productDescription: '一个由本机资料确认的多语言产品说明助手。', campaignName: '星河产品首发', campaignObjective: '让目标市场理解产品定位并邀请结构化反馈。', callToAction: '阅读完整说明并分享反馈。'};
const events = [];
const checks = {};

function docker(args, inherit = false) {
  const command = ['compose', '--project-name', project, ...args];
  const startedAt = new Date().toISOString();
  try {
    const output = execFileSync('docker', command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: {...process.env, LUMICLAW_WEB_PORT: webPort, LUMICLAW_API_PORT: apiPort}
    });
    events.push({command: ['docker', ...command], startedAt, result: 'PASS'});
    return output ?? '';
  } catch (error) {
    events.push({command: ['docker', ...command], startedAt, result: 'FAIL'});
    throw error;
  }
}

async function waitHealthy(timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const output = docker(['ps', '--format', 'json']).trim();
    const rows = output === '' ? [] : output.startsWith('[') ? JSON.parse(output) : output.split('\n').map((line) => JSON.parse(line));
    const health = new Map(rows.map((row) => [row.Service, row.Health || row.State]));
    if (['postgres', 'api', 'mission-worker', 'action-operator', 'web'].every((service) => health.get(service) === 'healthy')) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('SDD006_COMPOSE_HEALTH_TIMEOUT');
}

async function postJson(route, body) {
  const response = await fetch(`${apiUrl}${route}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  return {status: response.status, body: await response.json()};
}

async function upload(fileName, bytes) {
  const response = await fetch(`${apiUrl}/api/v1/local-materials`, {method: 'POST', headers: {'content-type': 'text/markdown', 'x-lumiclaw-file-name': encodeURIComponent(fileName)}, body: bytes});
  return {status: response.status, body: await response.json()};
}

function postgresScalar(sql) {
  return docker(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At', '-c', sql]).trim();
}

function blobExists(bytes) {
  const digest = createHash('sha256').update(bytes).digest('hex');
  const blobPath = `/var/lib/lumiclaw/blobs/${digest.slice(0, 2)}/${digest.slice(2)}`;
  const output = docker(['exec', '-T', 'api', 'node', '-e', `process.stdout.write(require('node:fs').existsSync(${JSON.stringify(blobPath)}) ? 'true' : 'false')`]).trim();
  return output === 'true';
}

function postgresRepositoryCompletedMutationCodes(ownerProfileId) {
  const source = `
    import {LocalContentAddressedBlobStore} from '@lumiclaw/blob-store';
    import {PostgresLocalPresenceRepository} from '@lumiclaw/db';
    const repository = new PostgresLocalPresenceRepository(process.env.DATABASE_URL, new LocalContentAddressedBlobStore(process.env.BLOB_ROOT));
    const now = new Date('2026-08-16T09:00:00.000Z');
    const ownerProfileId = ${JSON.stringify(ownerProfileId)};
    const mutations = [
      () => repository.selectLocalMaterials(ownerProfileId, now),
      () => repository.chooseExample(ownerProfileId, 'example-org', 'example-campaign', {marketCodes: ['US'], contentLocales: ['en-US'], platforms: ['LINKEDIN'], defaultTimeZone: 'America/Los_Angeles'}, now),
      () => repository.setContext(ownerProfileId, {marketCodes: ['US'], contentLocales: ['en-US'], platforms: ['LINKEDIN'], defaultTimeZone: 'America/New_York'}, now),
      () => repository.completeLocalOnboarding(ownerProfileId, 'replacement-org', 'replacement-campaign', now),
      () => repository.ingestMaterial({ownerProfileId, fileName: 'repository-post-completion.md', declaredMediaType: 'text/markdown', bytes: new TextEncoder().encode('# must fail')}, now)
    ];
    const codes = [];
    for (const mutate of mutations) {
      try { await mutate(); codes.push('MUTATION_SUCCEEDED'); }
      catch (error) { codes.push(error?.code ?? 'UNKNOWN_ERROR'); }
    }
    await repository.close();
    process.stdout.write(JSON.stringify(codes));
  `;
  return JSON.parse(docker(['exec', '-T', 'api', 'node', '--input-type=module', '-e', source]));
}

await mkdir(path.dirname(evidencePath), {recursive: true});
let result = 'FAIL';
let failure = null;
try {
  docker(['down', '--volumes', '--remove-orphans']);
  docker(['build', 'api'], true);
  docker(['up', '--no-build', '--detach'], true);
  await waitHealthy();
  checks.freshServicesHealthy = true;

  const profile = await postJson('/api/v1/local-owner-profile', {displayName: 'PG negative-path owner'});
  if (profile.status !== 201) throw new Error('SDD006_NEGATIVE_PROFILE_CREATE_FAILED');
  const prematureBytes = Buffer.from('# upload must fail before path selection');
  const premature = await upload('premature.md', prematureBytes);
  if (premature.status !== 422 || premature.body.code !== 'LOCAL_MATERIAL_PATH_REQUIRED') throw new Error('SDD006_PREMATURE_UPLOAD_DID_NOT_FAIL_CLOSED');
  if (Number(postgresScalar('select count(*) from local_material_manifests')) !== 0 || blobExists(prematureBytes)) throw new Error('SDD006_PREMATURE_UPLOAD_LEFT_PERSISTENCE');
  checks.uploadRequiresSelectedLocalPathWithoutManifestOrBlob = true;

  const selected = await postJson('/api/v1/local-onboarding/materials-path', {});
  if (selected.status !== 200 || selected.body.session?.path !== 'LOCAL_MATERIALS') throw new Error('SDD006_NEGATIVE_PATH_SELECTION_FAILED');
  postgresScalar("alter table local_material_manifests add constraint sdd006_force_failure check (file_name <> 'force-db-failure.md')");
  const failureBytes = Buffer.from('# force database failure after Blob put');
  const failedWrite = await upload('force-db-failure.md', failureBytes);
  postgresScalar('alter table local_material_manifests drop constraint sdd006_force_failure');
  if (failedWrite.status !== 503 || failedWrite.body.code !== 'CONTROL_PLANE_UNAVAILABLE') throw new Error('SDD006_FORCED_DB_FAILURE_NOT_SURFACED');
  if (Number(postgresScalar('select count(*) from local_material_manifests')) !== 0 || blobExists(failureBytes)) throw new Error('SDD006_DB_FAILURE_LEFT_ORPHAN_BLOB');
  checks.databaseWriteFailureCleansNewBlob = true;

  const duplicateResults = await Promise.all([upload(fixtureName, fixtureBytes), upload(fixtureName, fixtureBytes)]);
  if (!duplicateResults.every((entry) => entry.status === 201) || duplicateResults[0].body.material?.id !== duplicateResults[1].body.material?.id) throw new Error('SDD006_CONCURRENT_DUPLICATE_RESULT_INCONSISTENT');
  const materialCount = Number(postgresScalar('select count(*) from local_material_manifests'));
  const persistedMaterialIds = JSON.parse(postgresScalar('select material_ids::text from local_onboarding_sessions limit 1'));
  if (materialCount !== 1 || persistedMaterialIds.length !== 1 || persistedMaterialIds[0] !== duplicateResults[0].body.material.id) throw new Error('SDD006_CONCURRENT_DUPLICATE_PERSISTENCE_INCONSISTENT');
  checks.concurrentDuplicateUploadIsIdempotentAndConsistent = true;

  docker(['down', '--volumes', '--remove-orphans']);
  docker(['up', '--no-build', '--detach'], true);
  await waitHealthy();
  execFileSync(process.execPath, ['scripts/verify-sdd006-browser.mjs'], {cwd: process.cwd(), stdio: 'inherit', env: {...process.env, SDD006_WEB_URL: `http://127.0.0.1:${webPort}`}});
  checks.realBilingualBrowserFlow = true;

  const before = await fetch(`${apiUrl}/api/v1/local-workspace`).then((response) => response.json());
  const beforeDocument = before.campaign?.document;
  if (
    before.profile?.displayName !== 'SDD-006 Owner'
    || before.session?.state !== 'COMPLETED'
    || before.session?.dataMode !== 'LOCAL_PRIVATE'
    || JSON.stringify(before.session?.marketCodes) !== JSON.stringify(['CN', 'US'])
    || JSON.stringify(before.session?.contentLocales) !== JSON.stringify(['zh-CN', 'en-US'])
    || JSON.stringify(before.session?.platforms) !== JSON.stringify(['XIAOHONGSHU', 'LINKEDIN'])
    || before.session?.defaultTimeZone !== 'Asia/Shanghai'
    || before.materials?.length !== 1
    || before.materials[0]?.fileName !== fixtureName
    || !/^[a-f0-9]{64}$/u.test(before.materials[0]?.digest ?? '')
    || before.handoffs?.length !== 0
    || before.publishAuthorization?.reasonCode !== 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED'
    || before.publishAuthorization?.externalActionAllowed !== false
    || before.campaign?.mode !== 'LOCAL_PRIVATE'
    || beforeDocument?.dataMode !== 'LOCAL_PRIVATE'
    || beforeDocument?.graph?.organization?.displayName !== '星河工作室'
    || beforeDocument?.graph?.brands?.[0]?.name !== '星河'
    || beforeDocument?.graph?.products?.[0]?.name !== '星河翻译助手'
    || JSON.stringify(beforeDocument?.graph?.markets?.map((market) => market.code)) !== JSON.stringify(['CN', 'US'])
    || beforeDocument?.brief?.name !== '星河产品首发'
    || JSON.stringify(beforeDocument).includes('LumiClaw Presence local launch')
  ) throw new Error('SDD006_PRE_RESTART_LOCAL_PRIVATE_STATE_INVALID');
  const persistedContext = postgresScalar("select market_codes::text || '|' || content_locales::text || '|' || platforms::text || '|' || default_time_zone from local_onboarding_sessions limit 1");
  if (persistedContext !== '[\"CN\", \"US\"]|[\"zh-CN\", \"en-US\"]|[\"XIAOHONGSHU\", \"LINKEDIN\"]|Asia/Shanghai') throw new Error('SDD006_MULTI_CONTEXT_NOT_PERSISTED_IN_POSTGRES');
  checks.preRestartAuthoritativeLocalPrivateGraph = true;
  checks.multiContextPersistedInPostgres = true;

  const materialBeforeDelete = before.materials[0];
  const sessionRowBeforeReentry = postgresScalar("select state || '|' || path || '|' || coalesce(organization_id::text, '') || '|' || coalesce(campaign_id::text, '') || '|' || material_ids::text from local_onboarding_sessions limit 1");
  const postCompletionBytes = Buffer.from('# must not persist after completed onboarding');
  const [materialsPathReentry, exampleReentry, contextReentry, completionReentry, postCompletionUpload] = await Promise.all([
    postJson('/api/v1/local-onboarding/materials-path', {}),
    postJson('/api/v1/local-onboarding/example', {}),
    postJson('/api/v1/local-onboarding/context', {marketCodes: ['US', 'SG'], contentLocales: ['en-US', 'zh-CN'], platforms: ['LINKEDIN', 'X'], defaultTimeZone: 'America/New_York'}),
    postJson('/api/v1/local-onboarding/complete', localIdentity),
    upload('post-completion.md', postCompletionBytes)
  ]);
  const repositoryMutationCodes = postgresRepositoryCompletedMutationCodes(before.profile.id);
  const afterReentryAttempts = await fetch(`${apiUrl}/api/v1/local-workspace`).then((response) => response.json());
  if (
    ![materialsPathReentry, exampleReentry, contextReentry, completionReentry, postCompletionUpload].every((response) => response.status === 409 && response.body.code === 'LOCAL_ONBOARDING_ALREADY_COMPLETED')
    || repositoryMutationCodes.length !== 5
    || !repositoryMutationCodes.every((code) => code === 'LOCAL_ONBOARDING_ALREADY_COMPLETED')
    || Number(postgresScalar('select count(*) from local_material_manifests')) !== 1
    || postgresScalar("select state || '|' || path || '|' || coalesce(organization_id::text, '') || '|' || coalesce(campaign_id::text, '') || '|' || material_ids::text from local_onboarding_sessions limit 1") !== sessionRowBeforeReentry
    || !blobExists(fixtureBytes)
    || blobExists(postCompletionBytes)
    || JSON.stringify(afterReentryAttempts.session) !== JSON.stringify(before.session)
    || afterReentryAttempts.materials?.length !== 1
    || afterReentryAttempts.materials[0]?.id !== materialBeforeDelete.id
    || afterReentryAttempts.materials[0]?.digest !== materialBeforeDelete.digest
    || afterReentryAttempts.campaign?.digest !== before.campaign.digest
    || afterReentryAttempts.campaign?.document?.evidenceRefs?.[0]?.sourceUrl !== beforeDocument.evidenceRefs[0].sourceUrl
  ) throw new Error('SDD006_COMPLETED_ONBOARDING_MUTATION_REENTRY_DID_NOT_FAIL_CLOSED');
  checks.completedOnboardingCannotReenterOrIngest = true;

  const deleteBoundResponse = await fetch(`${apiUrl}/api/v1/local-materials/${materialBeforeDelete.id}`, {method: 'DELETE'});
  const deleteBoundBody = await deleteBoundResponse.json();
  const afterDeleteAttempt = await fetch(`${apiUrl}/api/v1/local-workspace`).then((response) => response.json());
  if (
    deleteBoundResponse.status !== 409
    || deleteBoundBody.code !== 'LOCAL_MATERIAL_BOUND_TO_CAMPAIGN'
    || Number(postgresScalar('select count(*) from local_material_manifests')) !== 1
    || !blobExists(fixtureBytes)
    || afterDeleteAttempt.session?.state !== 'COMPLETED'
    || afterDeleteAttempt.session?.campaignId !== before.session.campaignId
    || afterDeleteAttempt.session?.materialIds?.[0] !== materialBeforeDelete.id
    || afterDeleteAttempt.materials?.[0]?.digest !== materialBeforeDelete.digest
    || afterDeleteAttempt.campaign?.document?.evidenceRefs?.[0]?.sourceUrl !== beforeDocument.evidenceRefs[0].sourceUrl
  ) throw new Error('SDD006_BOUND_MATERIAL_DELETE_DID_NOT_FAIL_CLOSED');
  checks.completedCampaignMaterialCannotBeDeleted = true;

  const revision = beforeDocument.artifactRevisions[0];
  const deniedHandoff = await postJson('/api/v1/manual-publish-handoffs', {organizationId: beforeDocument.organizationId, campaignId: beforeDocument.id, artifactRevisionId: revision.id, platform: revision.platform, action: 'OWNER_REPORTED_COMPLETE'});
  const handoffList = await fetch(`${apiUrl}/api/v1/manual-publish-handoffs`).then((response) => response.json());
  if (
    deniedHandoff.status !== 409
    || deniedHandoff.body.code !== 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED'
    || deniedHandoff.body.createsHandoff !== false
    || deniedHandoff.body.authorization?.auditState !== 'MISSING'
    || deniedHandoff.body.authorization?.ownerDecisionState !== 'MISSING'
    || Number(postgresScalar('select count(*) from manual_publish_handoffs')) !== 0
    || handoffList.handoffs?.length !== 0
  ) throw new Error('SDD006_UNAPPROVED_MANUAL_HANDOFF_DID_NOT_FAIL_CLOSED');
  checks.unapprovedRevisionCannotCreateManualPublishHandoff = true;

  docker(['restart', 'postgres', 'api']);
  await waitHealthy();
  docker(['down']);
  docker(['up', '--detach']);
  await waitHealthy();
  const reopened = await fetch(`${apiUrl}/api/v1/local-workspace`).then((response) => response.json());
  if (
    reopened.profile?.displayName !== before.profile.displayName
    || reopened.session?.campaignId !== before.session.campaignId
    || reopened.session?.dataMode !== 'LOCAL_PRIVATE'
    || JSON.stringify(reopened.session?.marketCodes) !== JSON.stringify(before.session.marketCodes)
    || JSON.stringify(reopened.session?.contentLocales) !== JSON.stringify(before.session.contentLocales)
    || JSON.stringify(reopened.session?.platforms) !== JSON.stringify(before.session.platforms)
    || reopened.session?.defaultTimeZone !== before.session.defaultTimeZone
    || reopened.materials?.length !== 1
    || reopened.materials[0]?.digest !== before.materials[0].digest
    || reopened.materials[0]?.extractedText !== before.materials[0].extractedText
    || reopened.campaign?.document?.graph?.organization?.displayName !== '星河工作室'
    || reopened.campaign?.document?.brief?.name !== '星河产品首发'
    || reopened.handoffs?.length !== 0
    || reopened.publishAuthorization?.state !== 'BLOCKED'
    || reopened.publishAuthorization?.handoffCreationAllowed !== false
  ) throw new Error('SDD006_RESTART_REOPEN_INVALID');
  checks.postgresAndBlobRestartReopen = true;

  const readiness = await fetch(`${apiUrl}/api/v1/environment-readiness`).then((response) => response.json());
  if (readiness.secretCollectionAllowed !== false || readiness.items.find((item) => item.service === 'POSTGRESQL')?.state !== 'AVAILABLE' || readiness.items.find((item) => item.service === 'AGENTTEAMS_RUNTIME')?.state !== 'NOT_CONFIGURED') throw new Error('SDD006_READINESS_CONTRACT_INVALID');
  checks.readinessTruthContract = true;
  const forbiddenTables = Number(postgresScalar("select count(*) from information_schema.tables where table_schema='public' and table_name in ('connectors','action_grants','action_outbox')"));
  if (forbiddenTables !== 0) throw new Error('SDD006_FORBIDDEN_ACTION_TABLE_PRESENT');
  checks.noActionCapableTables = true;
  result = 'PASS';
} catch (error) {
  failure = error instanceof Error ? error.message : 'UNKNOWN_SDD006_COMPOSE_FAILURE';
  throw error;
} finally {
  let cleanup = 'PASS';
  try { docker(['down', '--volumes', '--remove-orphans']); } catch { cleanup = 'FAIL'; }
  await writeFile(evidencePath, `${JSON.stringify({schemaVersion: 1, project, result, cleanup, generatedAt: new Date().toISOString(), checks, failure, events}, null, 2)}\n`);
}

console.info(JSON.stringify({status: result, evidence: '.evidence/sdd-006/compose-verification.json'}));
