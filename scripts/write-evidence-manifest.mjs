import {createHash} from 'node:crypto';
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.join(root, '.evidence/sdd-002');

async function readJson(relativePath) {
  const value = await readFile(path.join(evidenceRoot, relativePath), 'utf8');
  return JSON.parse(value);
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
  if (api.result !== 'PASS' || api.cleanup !== 'PASS') failures.push('api-integration');
  if (compose.result !== 'PASS' || compose.cleanup !== 'PASS') failures.push('compose-verification');
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
  if (agentteamsReal.status !== 'PASS' || agentteamsReal.runtime?.realAgentTeamsAcceptance !== true || agentteamsReal.runtime?.realModelAcceptance !== false || agentteamsReal.topology?.memberCount !== 6 || agentteamsReal.project?.taskCount !== 8 || agentteamsReal.project?.restartRecovered !== true || agentteamsReal.productControlPlane?.sameProjectBinding !== true || agentteamsReal.productControlPlane?.normalizedHistoryAuthoritative !== true || agentteamsReal.productControlPlane?.normalizedHistoryTamperRejected !== true || agentteamsReal.environmentLifecycle?.status !== 'PASS' || agentteamsReal.environmentLifecycle?.selfProvisioned !== true || agentteamsReal.environmentLifecycle?.exactRuntimeObjectsRemoved !== true || agentteamsReal.environmentLifecycle?.ephemeralCredentialsRemoved !== true || !causalRuntimeValid || agentteamsReal.noAction?.externalActionAllowed !== false) failures.push('agentteams-real-runtime');
  if (providers.status !== 'PASS' || providers.deepSeek?.canary !== 'NOT_RUN_NO_KEY' || providers.evoLink?.canary !== 'NOT_RUN_NO_KEY' || providers.publicSafeMock?.maturity !== 'MOCK_CONFORMANCE' || providers.noAction?.externalActionAllowed !== false) failures.push('provider-conformance');
  if (shadowPostgres.status !== 'PASS' || shadowPostgres.restartRecovered !== true || shadowPostgres.normalizedHistoryOnly !== true || shadowPostgres.idempotentReplayNormalizedValidated !== true || !Object.values(shadowPostgres.immutableHistory ?? {}).every(Boolean) || shadowPostgres.forbiddenTables !== 0 || shadowPostgres.noAction?.externalActionAllowed !== false) failures.push('shadow-postgres');
  if (browser.status !== 'PASS' || browser.consoleErrorCount !== 0 || browser.checks?.storybookRealBrowserStateMatrix?.count !== 14 || browser.screenshots?.length !== 5 || browser.realAgentTeamsClaim !== false) failures.push('browser-verification');
  if (!Array.isArray(licenses.disallowed) || licenses.disallowed.length !== 0) failures.push('license-inventory');
  if (secretScan.status !== 'PASS' || !Array.isArray(secretScan.findings) || secretScan.findings.length !== 0) failures.push('secret-scan');
  if (sourcePackage.publicSafe !== true || sourcePackage.secretScan !== 'PASS' || sourcePackage.pathScan !== 'PASS' || sourcePackage.archiveCrcTest !== 'PASS' || sourcePackage.workingTreeSnapshot !== false) failures.push('source-package');
  if (sbom.bomFormat !== 'CycloneDX') failures.push('sbom');
  if (npmAudit.metadata?.vulnerabilities?.total !== 0) failures.push('npm-audit');
  if (failures.length > 0) throw new Error(`EVIDENCE_VALIDATION_FAILED:${failures.join(',')}`);
}

async function collect(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute)));
    else if (entry.isFile() && entry.name !== 'run-manifest.json') files.push(absolute);
  }
  return files;
}

await assertEvidence();
const files = await collect(evidenceRoot);
const manifestFiles = [];
for (const file of files.sort()) {
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
