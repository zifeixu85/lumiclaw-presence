import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.join(root, '.evidence/sdd-002');
const expectedBase = '4377103b3fea493a591af7f069fd697d9601f1ca';
const expectedBranch = 'codex/sdd-002-governed-shadow-campaign';
const expectedArchive = '.evidence/sdd-002/source-packages/lumiclaw-presence-sdd-002-source.zip';
const expectedImmutableHistory = ['governed_artifact_revisions', 'audit_decisions', 'owner_reviews', 'trace_events', 'ledger_entries', 'shadow_idempotency'];
const expectedTasks = [
  {role: 'presence-mission-leader', kind: 'PROJECT_COORDINATION', attempt: 1, keys: ['mission']},
  {role: 'evidence-claim-steward', kind: 'FREEZE_EVIDENCE', attempt: 1, keys: ['claimEvidence']},
  {role: 'campaign-planner', kind: 'PLAN_CAMPAIGN', attempt: 1, keys: ['activationPlan', 'frozenClaimEvidenceDigest']},
  {role: 'founder-identity-producer', kind: 'PRODUCE_FOUNDER', attempt: 1, keys: ['evidenceRefIds', 'sourceRevisions']},
  {role: 'product-account-producer', kind: 'PRODUCE_PRODUCT', attempt: 1, keys: ['evidenceRefIds', 'sourceRevisions']},
  {role: 'independent-auditor', kind: 'AUDIT_REVISIONS', attempt: 1, keys: ['evidenceRefIds', 'producerSummaries']},
  {role: 'founder-identity-producer', kind: 'PRODUCE_FOUNDER_CORRECTION', attempt: 2, keys: ['deniedRevision', 'failedAudit', 'sourceRevisions']},
  {role: 'independent-auditor', kind: 'REAUDIT_CORRECTION', attempt: 2, keys: ['correctedRevision', 'failedAudit']}
];
const expectedTaskByKind = new Map(expectedTasks.map((task) => [task.kind, task]));
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
function zipLiteralPattern(value) { return value.replace(/([\\[\]*?])/gu, '\\$1'); }
function exactStringSet(actual, expected) {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== 'string')) return false;
  const values = [...actual].sort(); const wanted = [...expected].sort();
  return values.length === wanted.length && values.every((value, index) => value === wanted[index]);
}
function exactBooleanMap(actual, expected) {
  return actual !== null && typeof actual === 'object' && !Array.isArray(actual)
    && exactStringSet(Object.keys(actual), expected)
    && expected.every((key) => actual[key] === true);
}
function exactTaskSet(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== expectedTasks.length) return false;
  const tuples = tasks.map((task) => `${task.roleId}:${task.taskKind}:${task.attempt}`).sort();
  const expected = expectedTasks.map(({role, kind, attempt}) => `${role}:${kind}:${attempt}`).sort();
  const digestFields = ['inputDigest', 'outputDigest', 'ackReceiptDigest', 'submissionReceiptDigest', 'runtimeResultDigest', 'inputProjectionDigest'];
  return tuples.join(',') === expected.join(',')
    && new Set(tasks.map((task) => task.taskId)).size === 8
    && tasks.every((task) => task.resultSource === 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY'
      && task.protocol?.join(',') === 'DELEGATE,ACK,SUBMIT,CHECK,ACCEPT'
      && task.inputProjectionSchema === `lumiclaw.shadow.task-input.${task.taskKind.toLowerCase().replaceAll('_', '-')}.v1`
      && digestFields.every((field) => digest(task[field]))
      && exactStringSet(task.inputProjectionKeys, expectedTaskByKind.get(task.taskKind)?.keys ?? []))
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

function sourceIdentityMatches(sourcePackage, runtimeSource, currentHead, sourceArchive, currentGitFiles) {
  return sourcePackage.base === expectedBase
    && sourcePackage.head === currentHead
    && sourcePackage.sourceRevision === currentHead
    && sourcePackage.branch === expectedBranch
    && runtimeSource?.base === expectedBase
    && runtimeSource?.head === currentHead
    && runtimeSource?.branch === sourcePackage.branch
    && sourcePackage.archive === expectedArchive
    && sourcePackage.fileCount > 0
    && sourcePackage.fileCount === sourcePackage.files?.length
    && exactStringSet(sourcePackage.files, currentGitFiles)
    && sourceArchive.zipValid === true
    && sourceArchive.symlinkCount === 0
    && sourceArchive.unsafePathCount === 0
    && exactStringSet(sourceArchive.files, currentGitFiles)
    && sourceArchive.contentsMatchGit === true
    && sourcePackage.symlinkCount === 0
    && sourcePackage.bytes === sourceArchive.bytes
    && sourcePackage.sha256 === sourceArchive.sha256;
}

function lockPackages(lock) {
  return Object.entries(lock.packages ?? {})
    .filter(([location, metadata]) => location.startsWith('node_modules/') && metadata.link !== true)
    .map(([location, metadata]) => ({
      name: metadata.name ?? location.replace(/^node_modules\//u, ''), version: metadata.version ?? 'unknown',
      license: metadata.license ?? 'UNKNOWN', resolved: metadata.resolved ?? null, integrity: metadata.integrity ?? null, dev: metadata.dev === true
    }))
    .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));
}

function licenseEvidenceValid(licenses, expectedPackages, sourceLockSha256) {
  return licenses?.schemaVersion === '1.0.0' && licenses?.status === 'PASS'
    && licenses?.source === 'package-lock.json' && licenses?.policy === 'docs/DEPENDENCY-POLICY.md'
    && licenses?.sourceLockSha256 === sourceLockSha256 && licenses?.packageCount === expectedPackages.length
    && licenses?.disallowedCount === 0 && Array.isArray(licenses?.disallowed) && licenses.disallowed.length === 0
    && JSON.stringify(licenses?.packages) === JSON.stringify(expectedPackages);
}

function sbomComponentIdentity(component) { return JSON.stringify({bomRef: component?.['bom-ref'], group: component?.group ?? null, name: component?.name, purl: component?.purl ?? null, type: component?.type, version: component?.version}); }
function sbomDependencyIdentity(dependency) { return JSON.stringify({ref: dependency?.ref, dependsOn: Array.isArray(dependency?.dependsOn) ? [...dependency.dependsOn].sort() : null}); }
function sbomEvidenceValid(sbom, expectedSbom, rootPackage, packageCount, sourceLockSha256) {
  const properties = new Map((sbom?.metadata?.component?.properties ?? []).map((property) => [property?.name, property?.value]));
  const actualComponents = (sbom?.components ?? []).map(sbomComponentIdentity).sort();
  const expectedComponents = (expectedSbom?.components ?? []).map(sbomComponentIdentity).sort();
  const actualDependencies = (sbom?.dependencies ?? []).map(sbomDependencyIdentity).sort();
  const expectedDependencies = (expectedSbom?.dependencies ?? []).map(sbomDependencyIdentity).sort();
  return sbom?.bomFormat === 'CycloneDX' && sbom?.specVersion === '1.6'
    && typeof sbom?.serialNumber === 'string' && /^urn:uuid:[a-f0-9-]{36}$/u.test(sbom.serialNumber)
    && Number.isInteger(sbom?.version) && sbom.version >= 1
    && sbom?.metadata?.component?.name === rootPackage.name && sbom?.metadata?.component?.version === rootPackage.version
    && Array.isArray(sbom?.components) && sbom.components.length > 0
    && sbom.components.every((component) => typeof component?.name === 'string' && component.name.length > 0 && typeof component?.version === 'string' && component.version.length > 0 && typeof component?.['bom-ref'] === 'string')
    && Array.isArray(sbom?.dependencies) && sbom.dependencies.length > 0
    && JSON.stringify(actualComponents) === JSON.stringify(expectedComponents)
    && JSON.stringify(actualDependencies) === JSON.stringify(expectedDependencies)
    && properties.get('lumiclaw:source-lock-sha256') === sourceLockSha256
    && properties.get('lumiclaw:license-inventory-package-count') === String(packageCount)
    && properties.get('lumiclaw:license-inventory-path') === '.evidence/sdd-002/license-inventory.json';
}

function runNegativeSelfTests({tasks, runtime, lifecycle, imageManifest, sourcePackage, runtimeSource, currentHead, sourceArchive, currentGitFiles, productControlPlane, noAction, shadowPostgres, licenses, expectedPackages, sourceLockSha256, sbom, expectedSbom, rootPackage}) {
  const mutationsRejected = [
    !exactTaskSet(tasks.map((task, index) => index === 0 ? {...task, ackReceiptDigest: 'x'} : task)),
    !exactTaskSet(tasks.map((task, index) => index === 0 ? {...task, runtimeResultDigest: tasks[1].runtimeResultDigest} : task)),
    !runtimeIdentityMatches({...runtime, sourceTarSha256: 'WRONG'}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: runtime.images.map((image, index) => index === 0 ? {...image, digest: `sha256:${'0'.repeat(64)}`} : image)}, lifecycle, imageManifest),
    !sourceIdentityMatches({...sourcePackage, head: 'WRONG'}, runtimeSource, currentHead, sourceArchive, currentGitFiles),
    !sourceIdentityMatches(sourcePackage, {...runtimeSource, head: 'WRONG'}, currentHead, sourceArchive, currentGitFiles),
    {...productControlPlane, aggregatePoisonIgnored: false}.aggregatePoisonIgnored !== true,
    !exactNoAction({...noAction, actionGrantCount: 99}),
    !exactNoAction({...noAction, connectorCount: 99}),
    !exactNoAction({...noAction, externalActionCount: 99}),
    !exactBooleanMap(undefined, expectedImmutableHistory),
    !exactBooleanMap({}, expectedImmutableHistory),
    !exactTaskSet(tasks.map((task, index) => index === 0 ? {...task, inputProjectionKeys: ['x']} : task)),
    !sourceIdentityMatches({...sourcePackage, fileCount: 0, files: []}, runtimeSource, currentHead, sourceArchive, currentGitFiles),
    !sourceIdentityMatches({...sourcePackage, archive: '.evidence/sdd-002/source-packages/not-the-evidence.zip'}, runtimeSource, currentHead, sourceArchive, currentGitFiles),
    !sourceIdentityMatches(sourcePackage, runtimeSource, currentHead, {...sourceArchive, zipValid: false}, currentGitFiles),
    !sourceIdentityMatches(sourcePackage, runtimeSource, currentHead, {...sourceArchive, contentsMatchGit: false}, currentGitFiles),
    !licenseEvidenceValid({disallowed: []}, expectedPackages, sourceLockSha256),
    !sbomEvidenceValid({bomFormat: 'CycloneDX'}, expectedSbom, rootPackage, expectedPackages.length, sourceLockSha256),
    !sbomEvidenceValid({...sbom, components: sbom.components.slice(0, 1)}, expectedSbom, rootPackage, expectedPackages.length, sourceLockSha256),
    !exactBooleanMap({...shadowPostgres.immutableHistory, owner_reviews: false}, expectedImmutableHistory)
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
  const currentBranch = execFileSync('git', ['branch', '--show-current'], {cwd: root, encoding: 'utf8'}).trim();
  const currentGitTree = execFileSync('git', ['ls-tree', '-r', currentHead], {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(Boolean);
  const currentGitFiles = currentGitTree.map((entry) => entry.slice(entry.indexOf('\t') + 1)).sort((left, right) => left.localeCompare(right, 'en'));
  const gitTreeHasSymlinks = currentGitTree.some((entry) => entry.startsWith('120000 '));
  const sourceArchivePath = path.join(root, expectedArchive);
  const sourceArchiveBytes = await readFile(sourceArchivePath);
  let zipValid = true;
  try { execFileSync('unzip', ['-t', sourceArchivePath], {cwd: root, stdio: 'pipe'}); } catch { zipValid = false; }
  let archiveEntries = [];
  try { archiveEntries = execFileSync('unzip', ['-Z1', sourceArchivePath], {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(Boolean); } catch { zipValid = false; }
  let zipSymlinkCount = 0;
  try { zipSymlinkCount = execFileSync('zipinfo', ['-l', sourceArchivePath], {cwd: root, encoding: 'utf8'}).split('\n').filter((line) => line.startsWith('l')).length; } catch { zipValid = false; }
  const unsafeArchiveEntries = archiveEntries.filter((entry) => {
    const normalized = entry.endsWith('/') ? entry.slice(0, -1) : entry;
    return normalized.length === 0 || path.isAbsolute(normalized) || normalized.includes('\\') || normalized.split('/').some((segment) => segment === '..' || segment === '');
  });
  const archiveFiles = archiveEntries.filter((entry) => !entry.endsWith('/')).sort((left, right) => left.localeCompare(right, 'en'));
  let contentsMatchGit = exactStringSet(archiveFiles, currentGitFiles);
  if (contentsMatchGit) {
    for (const file of currentGitFiles) {
      const archiveContent = execFileSync('unzip', ['-p', sourceArchivePath, zipLiteralPattern(file)], {cwd: root, maxBuffer: 64 * 1024 * 1024});
      const gitContent = execFileSync('git', ['show', `${currentHead}:${file}`], {cwd: root, maxBuffer: 64 * 1024 * 1024});
      if (!archiveContent.equals(gitContent)) { contentsMatchGit = false; break; }
    }
  }
  const sourceArchive = {
    bytes: sourceArchiveBytes.length,
    sha256: createHash('sha256').update(sourceArchiveBytes).digest('hex'),
    zipValid: zipValid && sourceArchiveBytes.subarray(0, 2).toString('ascii') === 'PK' && !gitTreeHasSymlinks,
    symlinkCount: zipSymlinkCount,
    unsafePathCount: unsafeArchiveEntries.length,
    files: archiveFiles,
    contentsMatchGit
  };
  const lockText = await readFile(path.join(root, 'package-lock.json'), 'utf8');
  const sourceLockSha256 = createHash('sha256').update(lockText).digest('hex');
  const expectedPackages = lockPackages(JSON.parse(lockText));
  const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const sbomTempRoot = await mkdtemp(path.join(tmpdir(), 'lumiclaw-sdd002-sbom-'));
  const expectedSbomPath = path.join(sbomTempRoot, 'expected-sbom.cdx.json');
  let expectedSbom;
  try {
    execFileSync(path.join(root, 'node_modules/.bin/cyclonedx-npm'), ['--output-file', expectedSbomPath, '--output-format', 'JSON'], {cwd: root, stdio: 'pipe'});
    expectedSbom = JSON.parse(await readFile(expectedSbomPath, 'utf8'));
  } finally { await rm(sbomTempRoot, {recursive: true, force: true}); }
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
  if (shadowPostgres.status !== 'PASS' || shadowPostgres.restartRecovered !== true || shadowPostgres.normalizedHistoryOnly !== true || shadowPostgres.idempotencyMetadataOnly !== true || shadowPostgres.advancedCheckpointRejected !== true || shadowPostgres.idempotentReplayNormalizedValidated !== true || !exactBooleanMap(shadowPostgres.immutableHistory, expectedImmutableHistory) || shadowPostgres.counts?.owner_reviews !== 1 || shadowPostgres.forbiddenTables !== 0 || !exactNoAction(shadowPostgres.noAction)) failures.push('shadow-postgres');
  const productBrowser = browser.checks?.productHydratedMissionAndReview;
  const browserNoActionValid = exactBrowserNoAction(productBrowser?.mission)
    && exactBrowserNoAction(browser.checks?.englishHydratedMission)
    && exactBrowserNoAction(browser.checks?.mobile390Mission)
    && productBrowser?.review?.noGrantBoundary === true
    && Array.isArray(productBrowser?.review?.grants)
    && productBrowser.review.grants.join(',') === '0,0,0,FALSE';
  if (browser.status !== 'PASS' || browser.consoleErrorCount !== 0 || browser.checks?.storybookRealBrowserStateMatrix?.count !== 14 || declaredBrowserScreenshots.join(',') !== expectedBrowserScreenshots.join(',') || browser.realAgentTeamsClaim !== false || !browserNoActionValid) failures.push('browser-verification');
  if (!licenseEvidenceValid(licenses, expectedPackages, sourceLockSha256)) failures.push('license-inventory');
  if (secretScan.status !== 'PASS' || !Array.isArray(secretScan.findings) || secretScan.findings.length !== 0) failures.push('secret-scan');
  if (currentBranch !== expectedBranch || sourcePackage.publicSafe !== true || sourcePackage.secretScan !== 'PASS' || sourcePackage.pathScan !== 'PASS' || sourcePackage.archiveCrcTest !== 'PASS' || sourcePackage.workingTreeSnapshot !== false || !sourceIdentityMatches(sourcePackage, agentteamsReal.sourceIdentity, currentHead, sourceArchive, currentGitFiles)) failures.push('source-package');
  if (!sbomEvidenceValid(sbom, expectedSbom, rootPackage, expectedPackages.length, sourceLockSha256)) failures.push('sbom');
  if (npmAudit.metadata?.vulnerabilities?.total !== 0) failures.push('npm-audit');
  if (failures.length > 0) throw new Error(`EVIDENCE_VALIDATION_FAILED:${failures.join(',')}`);
  return runNegativeSelfTests({tasks: causalTasks, runtime: agentteamsReal.runtime, lifecycle: agentteamsReal.environmentLifecycle, imageManifest, sourcePackage, runtimeSource: agentteamsReal.sourceIdentity, currentHead, sourceArchive, currentGitFiles, productControlPlane: agentteamsReal.productControlPlane, noAction: agentteamsReal.noAction, shadowPostgres, licenses, expectedPackages, sourceLockSha256, sbom, expectedSbom, rootPackage});
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
