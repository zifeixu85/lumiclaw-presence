import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.join(root, '.evidence/sdd-002');
const expectedBase = '4377103b3fea493a591af7f069fd697d9601f1ca';
const expectedTasks = [
  ['presence-mission-leader', 'PROJECT_COORDINATION', 1],
  ['evidence-claim-steward', 'FREEZE_EVIDENCE', 1],
  ['campaign-planner', 'PLAN_CAMPAIGN', 1],
  ['founder-identity-producer', 'PRODUCE_FOUNDER', 1],
  ['product-account-producer', 'PRODUCE_PRODUCT', 1],
  ['independent-auditor', 'AUDIT_REVISIONS', 1],
  ['founder-identity-producer', 'PRODUCE_FOUNDER_CORRECTION', 2],
  ['independent-auditor', 'REAUDIT_CORRECTION', 2]
];
const publicEvidencePaths = [
  'agentteams-capability-report.json',
  'agentteams-image-smoke.json',
  'agentteams-real-runtime.json',
  'api-integration.json',
  'browser-verification.json',
  'browser/product-zh-mission-390.png',
  'browser/product-zh-mission-desktop.png',
  'browser/product-zh-review-390.png',
  'browser/product-zh-review-desktop.png',
  'browser/storybook-en-queued-390.png',
  'compose-verification.json',
  'license-inventory.json',
  'npm-audit.json',
  'provider-conformance.json',
  'sbom.cdx.json',
  'secret-scan.json',
  'shadow-postgres.json',
  'source-packages/lumiclaw-presence-sdd-002-source.zip',
  'source-packages/source-package-manifest.json'
];

async function readJson(relativePath) {
  const value = await readFile(path.join(evidenceRoot, relativePath), 'utf8');
  return JSON.parse(value);
}

function exactNoAction(value) {
  return value?.externalActionAllowed === false
    && value?.actionGrantCount === 0
    && value?.connectorCount === 0
    && value?.externalActionCount === 0;
}

function exactBrowserNoAction(value) {
  return value?.grants === 0
    && value?.connectors === 0
    && value?.actions === 0
    && value?.executionAllowed === 'FALSE';
}

function digest(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value); }
function buildDigest(value) { return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value); }
function exactTaskSet(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== expectedTasks.length) return false;
  const tuples = tasks.map((task) => `${task.roleId}:${task.taskKind}:${task.attempt}`).sort();
  const expected = expectedTasks.map(([role, kind, attempt]) => `${role}:${kind}:${attempt}`).sort();
  const digestFields = ['inputDigest', 'outputDigest', 'ackReceiptDigest', 'submissionReceiptDigest', 'runtimeResultDigest', 'inputProjectionDigest'];
  return tuples.join(',') === expected.join(',')
    && new Set(tasks.map((task) => task.taskId)).size === 8
    && tasks.every((task) => task.resultSource === 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY'
      && task.protocol?.join(',') === 'DELEGATE,ACK,SUBMIT,CHECK,ACCEPT'
      && task.inputProjectionSchema === `lumiclaw.shadow.task-input.${task.taskKind.toLowerCase().replaceAll('_', '-')}.v1`
      && digestFields.every((field) => digest(task[field]))
      && Array.isArray(task.inputProjectionKeys) && task.inputProjectionKeys.length > 0)
    && digestFields.every((field) => new Set(tasks.map((task) => task[field])).size === 8);
}

function runtimeIdentityMatches(runtime, lifecycle, imageManifest) {
  const expectedImages = new Map(imageManifest.images.map((image) => [image.component, `${image.repository}:${image.tag}:${image.digest}`]));
  return runtime?.requestedVersion === imageManifest.requestedVersion
    && runtime?.sourceTagCommit === imageManifest.sourceTagCommit
    && runtime?.sourceTarSha256 === imageManifest.sourceTarSha256
    && lifecycle?.sourceTarSha256 === imageManifest.sourceTarSha256
    && Array.isArray(runtime?.images) && runtime.images.length === imageManifest.images.length
    && runtime.images.every((image) => expectedImages.get(image.component) === `${image.repository}:${image.tag}:${image.digest}` && buildDigest(image.digest));
}

function sourceIdentityMatches(sourcePackage, runtimeSource, currentHead, sourceArchive) {
  return sourcePackage.base === expectedBase
    && sourcePackage.head === currentHead
    && sourcePackage.sourceRevision === currentHead
    && runtimeSource?.base === expectedBase
    && runtimeSource?.head === currentHead
    && runtimeSource?.branch === sourcePackage.branch
    && sourcePackage.fileCount === sourcePackage.files?.length
    && sourcePackage.bytes === sourceArchive.bytes
    && sourcePackage.sha256 === sourceArchive.sha256;
}

function runNegativeSelfTests({tasks, runtime, lifecycle, imageManifest, sourcePackage, runtimeSource, currentHead, sourceArchive, productControlPlane, noAction}) {
  const mutationsRejected = [
    !exactTaskSet(tasks.map((task, index) => index === 0 ? {...task, ackReceiptDigest: 'x'} : task)),
    !exactTaskSet(tasks.map((task, index) => index === 0 ? {...task, runtimeResultDigest: tasks[1].runtimeResultDigest} : task)),
    !runtimeIdentityMatches({...runtime, sourceTarSha256: 'WRONG'}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: runtime.images.map((image, index) => index === 0 ? {...image, digest: `sha256:${'0'.repeat(64)}`} : image)}, lifecycle, imageManifest),
    !sourceIdentityMatches({...sourcePackage, head: 'WRONG'}, runtimeSource, currentHead, sourceArchive),
    !sourceIdentityMatches(sourcePackage, {...runtimeSource, head: 'WRONG'}, currentHead, sourceArchive),
    {...productControlPlane, aggregatePoisonIgnored: false}.aggregatePoisonIgnored !== true,
    !exactNoAction({...noAction, actionGrantCount: 99}),
    !exactNoAction({...noAction, connectorCount: 99}),
    !exactNoAction({...noAction, externalActionCount: 99})
  ];
  if (!mutationsRejected.every(Boolean)) throw new Error('EVIDENCE_NEGATIVE_SELF_TEST_FAILED');
  return mutationsRejected.length;
}

async function assertEvidence() {
  const [api, compose, agentteamsImage, agentteamsReal, providers, shadowPostgres, browser, licenses, secretScan, sourcePackage, sbom, npmAudit] = await Promise.all([
    readJson('api-integration.json'),
    readJson('compose-verification.json'),
    readJson('agentteams-image-smoke.json'),
    readJson('agentteams-real-runtime.json'),
    readJson('provider-conformance.json'),
    readJson('shadow-postgres.json'),
    readJson('browser-verification.json'),
    readJson('license-inventory.json'),
    readJson('secret-scan.json'),
    readJson('source-packages/source-package-manifest.json'),
    readJson('sbom.cdx.json'),
    readJson('npm-audit.json')
  ]);
  const imageManifest = JSON.parse(await readFile(path.join(root, 'infra/agentteams/image-manifest.json'), 'utf8'));
  const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const sourceArchiveBytes = await readFile(path.join(evidenceRoot, sourcePackage.archive.replace(/^\.evidence\/sdd-002\//u, '')));
  const sourceArchive = {bytes: sourceArchiveBytes.length, sha256: createHash('sha256').update(sourceArchiveBytes).digest('hex')};
  const failures = [];
  const expectedBrowserScreenshots = publicEvidencePaths.filter((file) => file.startsWith('browser/')).sort();
  const declaredBrowserScreenshots = (browser.screenshots ?? []).map((file) => file.replace(/^\.evidence\/sdd-002\//u, '')).sort();
  const apiNoAction = api.checks?.ownerReviewAndNoAction;
  if (api.result !== 'PASS' || api.cleanup !== 'PASS' || apiNoAction?.actionGrants !== 0 || apiNoAction?.connectors !== 0 || apiNoAction?.externalActions !== 0 || api.checks?.persistedCounts?.forbiddenActionTables !== 0) failures.push('api-integration');
  const composeOperator = compose.checks?.actionOperatorDormantNoGrants;
  if (compose.result !== 'PASS' || compose.cleanup !== 'PASS' || compose.checks?.forbiddenActionTables !== 0 || composeOperator?.state !== 'DORMANT_NO_GRANTS' || composeOperator?.actionGrantRoutes !== 0 || composeOperator?.connectorRoutes !== 0 || composeOperator?.externalActionAllowed !== false || compose.checks?.missionWorkerSharedControlPlane?.externalActionAllowed !== false) failures.push('compose-verification');
  if (agentteamsImage.result !== 'PASS' || agentteamsImage.cleanup !== 'PASS' || agentteamsImage.liveAgentTeamRun !== false) failures.push('agentteams-image-smoke');
  const causalTasks = agentteamsReal.project?.tasks ?? [];
  const causalRuntimeValid = agentteamsReal.causalRuntimeImport?.exactRuntimeActorCount === 6
    && agentteamsReal.causalRuntimeImport?.workerGeneratedResultCount === 8
    && agentteamsReal.causalRuntimeImport?.independentAuditorResultSource === 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY'
    && agentteamsReal.causalRuntimeImport?.apiRejectsUnacknowledgedOrDigestMismatchedSubmit === true
    && agentteamsReal.causalRuntimeImport?.runtimeImportAuthentication === 'EPHEMERAL_ADAPTER_TOKEN'
    && agentteamsReal.causalRuntimeImport?.unauthenticatedRuntimeImportRejected === true
    && agentteamsReal.causalRuntimeImport?.authenticationMaterialPersisted === false
    && agentteamsReal.causalRuntimeImport?.exactTaskCount === 8
    && agentteamsReal.causalRuntimeImport?.roleContextProjectionVerified === true
    && agentteamsReal.causalRuntimeImport?.wholeCampaignWorkerInputForbidden === true
    && Array.isArray(agentteamsReal.causalRuntimeImport?.causalTransitions)
    && agentteamsReal.causalRuntimeImport.causalTransitions.map((transition) => transition.state).join(',') === 'REVISION_REQUIRED,AUDIT_BLOCKED,NEEDS_OWNER_REVIEW'
    && exactTaskSet(causalTasks);
  const exactProductIdentity = agentteamsReal.project?.id === agentteamsReal.productControlPlane?.runtimeProjectId
    && agentteamsReal.productControlPlane?.missionId !== undefined
    && agentteamsReal.productControlPlane?.persistedCampaignId !== undefined
    && agentteamsReal.productControlPlane?.sourceCampaignDigest !== undefined;
  if (agentteamsReal.status !== 'PASS' || agentteamsReal.runtime?.realAgentTeamsAcceptance !== true || agentteamsReal.runtime?.realModelAcceptance !== false || agentteamsReal.topology?.memberCount !== 6 || agentteamsReal.project?.taskCount !== 8 || agentteamsReal.project?.restartRecovered !== true || !exactProductIdentity || agentteamsReal.productControlPlane?.sameProjectBinding !== true || agentteamsReal.productControlPlane?.normalizedHistoryAuthoritative !== true || agentteamsReal.productControlPlane?.aggregatePoisonIgnored !== true || agentteamsReal.productControlPlane?.normalizedHistoryTamperRejected !== true || agentteamsReal.productControlPlane?.databaseCounts?.action_tables !== 0 || agentteamsReal.environmentLifecycle?.status !== 'PASS' || agentteamsReal.environmentLifecycle?.selfProvisioned !== true || agentteamsReal.environmentLifecycle?.exactRuntimeObjectsRemoved !== true || agentteamsReal.environmentLifecycle?.ephemeralCredentialsRemoved !== true || !runtimeIdentityMatches(agentteamsReal.runtime, agentteamsReal.environmentLifecycle, imageManifest) || !causalRuntimeValid || agentteamsReal.noAction?.executionMode !== 'SHADOW_PREP_ONLY' || !exactNoAction(agentteamsReal.noAction)) failures.push('agentteams-real-runtime');
  const deepSeekConformance = providers.deepSeek?.conformance;
  if (providers.status !== 'PASS' || providers.deepSeek?.canary !== 'NOT_RUN_NO_KEY' || providers.evoLink?.canary !== 'NOT_RUN_NO_KEY' || providers.publicSafeMock?.maturity !== 'MOCK_CONFORMANCE' || deepSeekConformance?.executionClass !== 'MOCK_CONFORMANCE' || deepSeekConformance?.actualReturnedModel !== 'deepseek-v4-flash' || deepSeekConformance?.finishReason !== 'stop' || deepSeekConformance?.responseIdentityCaptured !== true || deepSeekConformance?.responseIdentityRejections?.join(',') !== 'MODEL_RETURNED_MODEL_MISMATCH,MODEL_FINISH_REASON_INVALID,MODEL_RESPONSE_IDENTITY_INVALID,MODEL_USAGE_INVALID' || !exactNoAction(providers.noAction)) failures.push('provider-conformance');
  if (shadowPostgres.status !== 'PASS' || shadowPostgres.restartRecovered !== true || shadowPostgres.normalizedHistoryOnly !== true || shadowPostgres.idempotencyMetadataOnly !== true || shadowPostgres.advancedCheckpointRejected !== true || shadowPostgres.idempotentReplayNormalizedValidated !== true || !Object.values(shadowPostgres.immutableHistory ?? {}).every(Boolean) || shadowPostgres.forbiddenTables !== 0 || !exactNoAction(shadowPostgres.noAction)) failures.push('shadow-postgres');
  const productBrowser = browser.checks?.productHydratedMissionAndReview;
  const browserNoActionValid = exactBrowserNoAction(productBrowser?.mission)
    && exactBrowserNoAction(browser.checks?.englishHydratedMission)
    && exactBrowserNoAction(browser.checks?.mobile390Mission)
    && productBrowser?.review?.noGrantBoundary === true
    && Array.isArray(productBrowser?.review?.grants)
    && productBrowser.review.grants.join(',') === '0,0,0,FALSE';
  if (browser.status !== 'PASS' || browser.consoleErrorCount !== 0 || browser.checks?.storybookRealBrowserStateMatrix?.count !== 14 || declaredBrowserScreenshots.join(',') !== expectedBrowserScreenshots.join(',') || browser.realAgentTeamsClaim !== false || !browserNoActionValid) failures.push('browser-verification');
  if (!Array.isArray(licenses.disallowed) || licenses.disallowed.length !== 0) failures.push('license-inventory');
  if (secretScan.status !== 'PASS' || !Array.isArray(secretScan.findings) || secretScan.findings.length !== 0) failures.push('secret-scan');
  if (sourcePackage.publicSafe !== true || sourcePackage.secretScan !== 'PASS' || sourcePackage.pathScan !== 'PASS' || sourcePackage.archiveCrcTest !== 'PASS' || sourcePackage.workingTreeSnapshot !== false || !sourceIdentityMatches(sourcePackage, agentteamsReal.sourceIdentity, currentHead, sourceArchive)) failures.push('source-package');
  if (sbom.bomFormat !== 'CycloneDX') failures.push('sbom');
  if (npmAudit.metadata?.vulnerabilities?.total !== 0) failures.push('npm-audit');
  if (failures.length > 0) throw new Error(`EVIDENCE_VALIDATION_FAILED:${failures.join(',')}`);
  return runNegativeSelfTests({tasks: causalTasks, runtime: agentteamsReal.runtime, lifecycle: agentteamsReal.environmentLifecycle, imageManifest, sourcePackage, runtimeSource: agentteamsReal.sourceIdentity, currentHead, sourceArchive, productControlPlane: agentteamsReal.productControlPlane, noAction: agentteamsReal.noAction});
}

const negativeMutationsRejected = await assertEvidence();
const manifestFiles = [];
for (const relativePath of publicEvidencePaths) {
  const file = path.join(evidenceRoot, relativePath);
  const value = await readFile(file);
  const metadata = await stat(file);
  manifestFiles.push({
    path: path.relative(root, file),
    bytes: metadata.size,
    sha256: createHash('sha256').update(value).digest('hex')
  });
}

const manifest = {
  schemaVersion: '1.0.0',
  sdd: 'SDD-002',
  maturity: 'ENGINEERING_VERIFIED',
  generatedAt: new Date().toISOString(),
  fixtureDisclosure: 'Synthetic/local Campaign evidence only; not customer UAT, live platform execution, or production verification.',
  privacyBoundary: 'Strict public-safe allowlist; ChatGPT Pro interaction screenshots, browser/session state, credentials, runtime state, database state, and superseded source archives are excluded.',
  negativeMutationsRejected,
  validatedGates: [
    'api-integration',
    'compose-verification',
    'agentteams-image-smoke',
    'agentteams-real-runtime',
    'provider-conformance',
    'shadow-postgres',
    'browser-verification',
    'license-inventory',
    'secret-scan',
    'source-package',
    'sbom',
    'npm-audit'
  ],
  files: manifestFiles
};
await writeFile(path.join(evidenceRoot, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.info(JSON.stringify({status: 'PASS', files: manifestFiles.length}));
