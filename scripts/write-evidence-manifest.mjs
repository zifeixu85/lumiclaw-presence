import {createHash} from 'node:crypto';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.join(root, '.evidence/sdd-002');
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
    && causalTasks.length === 8
    && causalTasks.every((task) => task.resultSource === 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY' && typeof task.ackReceiptDigest === 'string' && typeof task.submissionReceiptDigest === 'string' && typeof task.runtimeResultDigest === 'string' && typeof task.inputProjectionDigest === 'string' && Array.isArray(task.inputProjectionKeys) && task.inputProjectionKeys.length > 0);
  if (agentteamsReal.status !== 'PASS' || agentteamsReal.runtime?.realAgentTeamsAcceptance !== true || agentteamsReal.runtime?.realModelAcceptance !== false || agentteamsReal.topology?.memberCount !== 6 || agentteamsReal.project?.taskCount !== 8 || agentteamsReal.project?.restartRecovered !== true || agentteamsReal.productControlPlane?.sameProjectBinding !== true || agentteamsReal.productControlPlane?.normalizedHistoryAuthoritative !== true || agentteamsReal.productControlPlane?.normalizedHistoryTamperRejected !== true || agentteamsReal.productControlPlane?.databaseCounts?.action_tables !== 0 || agentteamsReal.environmentLifecycle?.status !== 'PASS' || agentteamsReal.environmentLifecycle?.selfProvisioned !== true || agentteamsReal.environmentLifecycle?.exactRuntimeObjectsRemoved !== true || agentteamsReal.environmentLifecycle?.ephemeralCredentialsRemoved !== true || !causalRuntimeValid || agentteamsReal.noAction?.executionMode !== 'SHADOW_PREP_ONLY' || !exactNoAction(agentteamsReal.noAction)) failures.push('agentteams-real-runtime');
  if (providers.status !== 'PASS' || providers.deepSeek?.canary !== 'NOT_RUN_NO_KEY' || providers.evoLink?.canary !== 'NOT_RUN_NO_KEY' || providers.publicSafeMock?.maturity !== 'MOCK_CONFORMANCE' || !exactNoAction(providers.noAction)) failures.push('provider-conformance');
  if (shadowPostgres.status !== 'PASS' || shadowPostgres.restartRecovered !== true || shadowPostgres.normalizedHistoryOnly !== true || shadowPostgres.idempotentReplayNormalizedValidated !== true || !Object.values(shadowPostgres.immutableHistory ?? {}).every(Boolean) || shadowPostgres.forbiddenTables !== 0 || !exactNoAction(shadowPostgres.noAction)) failures.push('shadow-postgres');
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
  if (sourcePackage.publicSafe !== true || sourcePackage.secretScan !== 'PASS' || sourcePackage.pathScan !== 'PASS' || sourcePackage.archiveCrcTest !== 'PASS' || sourcePackage.workingTreeSnapshot !== false) failures.push('source-package');
  if (sbom.bomFormat !== 'CycloneDX') failures.push('sbom');
  if (npmAudit.metadata?.vulnerabilities?.total !== 0) failures.push('npm-audit');
  if (failures.length > 0) throw new Error(`EVIDENCE_VALIDATION_FAILED:${failures.join(',')}`);
}

await assertEvidence();
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
