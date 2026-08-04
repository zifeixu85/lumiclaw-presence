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
const expectedRuntimeImageComponents = ['embedded-controller', 'manager-copaw', 'worker'];
const expectedSkillLocks = ['account-native-expression@1.0.0', 'campaign-strategy@1.0.0', 'evidence-and-claim-grounding@1.0.0', 'independent-action-audit@1.0.0', 'trace-safe-escalation@1.0.0'];
const expectedProviderPricing = {
  flash: {source: 'DEEPSEEK_OFFICIAL_2026-08-04', inputCacheHitUsdPerMillion: 0.0028, inputCacheMissUsdPerMillion: 0.14, outputUsdPerMillion: 0.28, peakMultiplierNotApplied: true},
  pro: {source: 'DEEPSEEK_OFFICIAL_2026-08-04', inputCacheHitUsdPerMillion: 0.003625, inputCacheMissUsdPerMillion: 0.435, outputUsdPerMillion: 0.87, peakMultiplierNotApplied: true}
};
const expectedLiveStageCodes = {
  MISSION_OPEN: 'LIVE_MISSION_OPEN_FAILED', RUNTIME_IDENTITY: 'LIVE_RUNTIME_IDENTITY_FAILED', TOPOLOGY: 'LIVE_AGENTTEAMS_TOPOLOGY_INVALID',
  PROJECT_CREATE: 'LIVE_PROJECT_CREATE_FAILED', DAG_PLAN: 'LIVE_DAG_PLAN_FAILED', MEMBER_BINDING: 'LIVE_MEMBER_BINDING_MISSING',
  PROJECT_DISPATCH: 'LIVE_PROJECT_DISPATCH_REJECTED', TASK_PROTOCOL: 'LIVE_TASK_PROTOCOL_FAILED', PROVIDER_REQUEST: 'LIVE_PROVIDER_REQUEST_FAILED',
  FINALIZE: 'LIVE_FINALIZE_FAILED', AGENTTEAMS_PROVISION: 'LIVE_AGENTTEAMS_ENVIRONMENT_FAILED', CLEANUP: 'LIVE_UAT_CLEANUP_FAILED'
};
const expectedProviderOutcomes = [
  'DEEPSEEK_SECRET_FILE_UNAVAILABLE',
  'PROVIDER_HTTP_401', 'PROVIDER_HTTP_402', 'PROVIDER_HTTP_404', 'PROVIDER_HTTP_429', 'PROVIDER_HTTP_500', 'PROVIDER_HTTP_502', 'PROVIDER_HTTP_503', 'PROVIDER_HTTP_504',
  'MODEL_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'MODEL_RESPONSE_IDENTITY_INVALID', 'MODEL_RETURNED_MODEL_MISMATCH', 'MODEL_FINISH_REASON_INVALID', 'MODEL_USAGE_INVALID', 'PROVIDER_RESPONSE_INVALID', 'MODEL_JSON_MALFORMED', 'MODEL_SCHEMA_INVALID', 'LIVE_MODEL_SEMANTIC_OUTPUT_INVALID', 'LIVE_PROVIDER_BROKER_FAILED'
];
const expectedRoleContracts = [
  {id: 'presence-mission-leader', orchestrationOnly: true, permissions: ['ORCHESTRATE'], skillLocks: ['trace-safe-escalation@1.0.0']},
  {id: 'evidence-claim-steward', orchestrationOnly: false, permissions: ['READ_EVIDENCE'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'trace-safe-escalation@1.0.0']},
  {id: 'campaign-planner', orchestrationOnly: false, permissions: ['PLAN'], skillLocks: ['campaign-strategy@1.0.0', 'trace-safe-escalation@1.0.0']},
  {id: 'founder-identity-producer', orchestrationOnly: false, permissions: ['PRODUCE_FOUNDER'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'account-native-expression@1.0.0', 'trace-safe-escalation@1.0.0']},
  {id: 'product-account-producer', orchestrationOnly: false, permissions: ['PRODUCE_PRODUCT'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'account-native-expression@1.0.0', 'trace-safe-escalation@1.0.0']},
  {id: 'independent-auditor', orchestrationOnly: false, permissions: ['AUDIT'], skillLocks: ['evidence-and-claim-grounding@1.0.0', 'independent-action-audit@1.0.0', 'trace-safe-escalation@1.0.0']}
];
const expectedScreenshotDimensions = new Map([
  ['browser/product-zh-mission-390.png', {width: 780, height: 7776}],
  ['browser/product-zh-mission-desktop.png', {width: 1440, height: 3525}],
  ['browser/product-zh-review-390.png', {width: 780, height: 8610}],
  ['browser/product-zh-review-desktop.png', {width: 1440, height: 2252}],
  ['browser/storybook-en-queued-390.png', {width: 780, height: 4748}]
]);
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
  'live-agentteams-no-secret-diagnostic.json',
  'live-deepseek-conformance.json',
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

function liveConformanceValid(value) {
  const mounts = value?.composeInspect?.secretMounts;
  const transport = value?.stdinTransport;
  const diagnostics = value?.stageDiagnostics;
  const providerOutcomes = value?.providerOutcomeDiagnostics;
  const receipt = transport?.receipt;
  return value?.schemaVersion === 1
    && value?.status === 'PASS'
    && value?.maturity === 'ENGINEERING_VERIFIED'
    && value?.liveProviderVerified === false
    && value?.liveProviderStatus === 'NOT_RUN_NO_OWNER_SECRET'
    && value?.targetedContracts?.testFiles === 6
    && value?.targetedContracts?.tests === 126
    && value?.targetedContracts?.noKeyFailClosed === true
    && value?.targetedContracts?.mockFallback === false
    && value?.targetedContracts?.scopedSingleUseTickets === true
    && value?.targetedContracts?.wrongScopeBurnsTicket === true
    && value?.targetedContracts?.leaderModelCallForbidden === true
    && value?.targetedContracts?.independentAuditorReceiptRequired === true
    && value?.targetedContracts?.exactRoleSchemaPromptBound === true
    && value?.targetedContracts?.firstDomainFixtureCovered === true
    && transport?.status === 'PASS'
    && transport?.protocol === 'STRICT_JSON_EXACT_FOUR_FIELDS_SINGLE_FD0_READ'
    && transport?.nestedChildProcess === true
    && transport?.cases === 5
    && transport?.nestedTransportCases === 4
    && transport?.validFields === 4
    && transport?.partialRejected === true
    && transport?.malformedRejected === true
    && transport?.extraFieldRejected === true
    && transport?.operationalFailureRejected === true
    && transport?.stdoutStderrInherited === false
    && transport?.bootstrapOrSecretFinding === false
    && transport?.stableFailureCode === 'LIVE_UAT_TRANSPORT_INVALID'
    && transport?.operationalFailureCode === 'LIVE_MISSION_OPEN_FAILED'
    && receipt?.status === 'PASS'
    && receipt?.mode === 'LIVE_UAT_STDIN_TRANSPORT_CONFORMANCE'
    && receipt?.fieldCount === 4
    && receipt?.nestedChildProcess === true
    && receipt?.secretPresent === false
    && exactStringSet(Object.keys(receipt?.fieldDigests ?? {}), ['organizationId', 'missionId', 'campaignDigest', 'bootstrap'])
    && Object.values(receipt.fieldDigests).every(digest)
    && diagnostics?.status === 'PASS'
    && diagnostics?.actualNestedChildProcess === true
    && diagnostics?.cases === 12
    && Array.isArray(diagnostics?.stages) && diagnostics.stages.length === 12
    && diagnostics.stages.every((entry) => expectedLiveStageCodes[entry.stage] === entry.code && entry.progress !== null && typeof entry.progress === 'object')
    && exactStringSet(diagnostics.stages.map((entry) => entry.stage), Object.keys(expectedLiveStageCodes))
    && diagnostics?.arbitraryExceptionTextForwarded === false
    && diagnostics?.rawChildOutputForwarded === false
    && diagnostics?.bootstrapTicketHeaderRawResponseFinding === false
    && diagnostics?.receiptBeforeCleanup === true
    && diagnostics?.publicPackageIncludesFailureReceipt === false
    && providerOutcomes?.status === 'PASS'
    && providerOutcomes?.actualNestedChildProcess === true
    && providerOutcomes?.cases === expectedProviderOutcomes.length
    && exactStringSet(providerOutcomes?.outcomes?.map((entry) => entry.providerOutcomeCode), expectedProviderOutcomes)
    && providerOutcomes.outcomes.every((entry) => entry.failedTaskBound === true)
    && providerOutcomes?.missingOrContradictoryMapsTo === 'LIVE_PROVIDER_BROKER_FAILED'
    && providerOutcomes?.arbitraryExceptionTextForwarded === false
    && providerOutcomes?.rawHttpOrModelOutputForwarded === false
    && providerOutcomes?.bootstrapTicketHeaderResponseIdFinding === false
    && value?.composePolicy?.status === 'PASS'
    && value?.composePolicy?.dockerSocketMounted === false
    && value?.composePolicy?.secretAsServiceEnvironment === false
    && value?.clientBundle?.status === 'PASS'
    && value?.clientBundle?.bundleCount === 3
    && Array.isArray(value?.clientBundle?.forbidden) && value.clientBundle.forbidden.length === 0
    && value?.composeInspect?.project === 'lumiclaw-sdd002-live-conformance'
    && value?.composeInspect?.health?.status === 'ok'
    && value?.composeInspect?.secretInEnvironment === false
    && value?.composeInspect?.dockerSocketMounted === false
    && value?.composeInspect?.sensitiveLogFinding === false
    && Array.isArray(mounts) && mounts.length === 2
    && mounts.map((mount) => `${mount.destination}:${mount.readOnly}`).join(',') === '/run/secrets/deepseek_api_key:true,/run/secrets/lumiclaw_runtime_broker_bootstrap:true'
    && value?.secretIngress === 'INTERACTIVE_TTY_TO_0600_TEMP_FILES_TO_READ_ONLY_COMPOSE_SECRETS'
    && value?.cleanupEvidence?.exactComposeProjectRemoved === true
    && value?.cleanupEvidence?.temporarySecretDirectoryRemoved === true
    && value?.cleanupEvidence?.currentFailedCanaryObjectsAbsentBeforeRun === true
    && exactNoAction(value?.noAction)
    && value?.cleanup === 'PASS';
}

function liveNoSecretDiagnosticValid(value, currentHead, imageManifest) {
  const progress = value?.diagnosedBoundary?.progress;
  return value?.schemaVersion === 1
    && value?.status === 'PASS'
    && value?.maturity === 'ENGINEERING_VERIFIED_NO_OWNER_SECRET'
    && value?.source?.base === expectedBase
    && value?.source?.head === currentHead
    && value?.source?.branch === expectedBranch
    && value?.runtime?.name === 'AgentTeams'
    && value?.runtime?.version === 'v1.2.0'
    && value?.runtime?.sourceTarSha256 === imageManifest?.sourceTarSha256
    && value?.runtime?.buildDigest === `sha256:${imageManifest?.sourceTarSha256}`
    && digest(value?.runtime?.imageDigestSetDigest)
    && value?.runtime?.expectedMemberCount === 6
    && value?.runtime?.exactMemberCount === 6
    && value?.runtime?.expectedTaskCount === 8
    && value?.runtime?.exactTaskCount === 8
    && value?.diagnosedBoundary?.stage === 'PROVIDER_REQUEST'
    && value?.diagnosedBoundary?.code === 'LIVE_PROVIDER_REQUEST_FAILED'
    && value?.diagnosedBoundary?.providerOutcomeCode === 'DEEPSEEK_SECRET_FILE_UNAVAILABLE'
    && exactRecord(progress, {runtimeIdentityVerified: true, topologyVerified: true, projectCreated: true, dagPlanned: true, memberBindingsResolved: true, projectDispatched: true, providerBrokerRequestStarted: true})
    && value?.diagnosedBoundary?.modelReceiptCount === 0
    && value?.diagnosedBoundary?.ownerSecretPresent === false
    && value?.diagnosedBoundary?.externalProviderRequestOccurred === false
    && value?.diagnosedBoundary?.liveProviderVerified === false
    && value?.diagnosedBoundary?.mockFallback === false
    && value?.persistedMission?.state === 'FAILED'
    && value?.persistedMission?.failureCode === 'DEEPSEEK_SECRET_FILE_UNAVAILABLE'
    && value?.persistedMission?.externalActionCount === 0
    && exactNoAction({...value?.noAction, externalActionAllowed: false})
    && exactRecord(value?.nonDisclosure, {bootstrapFinding: false, ticketFinding: false, authorizationFinding: false, rawProviderResponseFinding: false})
    && exactRecord(value?.cleanup, {agentTeams: 'PASS', controlPlane: 'PASS', secretDirectory: 'PASS'})
    && value?.failureReceipt === '.evidence/sdd-002/deepseek-live-failure.json'
    && !publicEvidencePaths.includes('deepseek-live-failure.json');
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
function exactRecord(actual, expected) {
  return actual !== null && typeof actual === 'object' && !Array.isArray(actual)
    && exactStringSet(Object.keys(actual), Object.keys(expected))
    && Object.entries(expected).every(([key, value]) => actual[key] === value);
}
function providerEvidenceValid(providers) {
  const conformance = providers?.deepSeek?.conformance;
  return providers?.status === 'PASS'
    && providers?.deepSeek?.canary === 'NOT_RUN_NO_KEY'
    && providers?.evoLink?.canary === 'NOT_RUN_NO_KEY'
    && providers?.publicSafeMock?.maturity === 'MOCK_CONFORMANCE'
    && conformance?.executionClass === 'MOCK_CONFORMANCE'
    && conformance?.exactSchemaPromptBound === true
    && conformance?.inputDigestIncludesOutputSchema === true
    && conformance?.actualReturnedModel === 'deepseek-v4-flash'
    && conformance?.finishReason === 'stop'
    && conformance?.responseIdentityCaptured === true
    && conformance?.responseIdentityRejections?.join(',') === 'MODEL_RETURNED_MODEL_MISMATCH,MODEL_FINISH_REASON_INVALID,MODEL_RESPONSE_IDENTITY_INVALID,MODEL_USAGE_INVALID'
    && conformance?.usageBreakdownConsistencyRejected === true
    && conformance?.usageBreakdownPolicy === 'BOTH_OR_NONE_EXACT_SUM; ABSENT_MEANS_ALL_CACHE_MISS'
    && conformance?.costSnapshotUsd === 0.000025256
    && exactRecord(conformance?.costSnapshotsUsd, {flash: 0.000025256, pro: 0.0000783725})
    && exactRecord(conformance?.pricingSnapshots?.flash, expectedProviderPricing.flash)
    && exactRecord(conformance?.pricingSnapshots?.pro, expectedProviderPricing.pro)
    && exactNoAction(providers?.noAction);
}
function roleContractIdentity(role) {
  return JSON.stringify({
    id: role?.id,
    orchestrationOnly: role?.orchestrationOnly,
    permissions: Array.isArray(role?.permissions) ? [...role.permissions].sort() : null,
    skillLocks: Array.isArray(role?.skillLocks) ? [...role.skillLocks].sort() : null
  });
}
function exactRoleContracts(roles) {
  if (!Array.isArray(roles)) return false;
  const actual = roles.map(roleContractIdentity).sort();
  const expected = expectedRoleContracts.map(roleContractIdentity).sort();
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function pngImageMatches(value, expected) {
  const signature = '89504e470d0a1a0a';
  return Buffer.isBuffer(value) && value.length >= 24
    && value.subarray(0, 8).toString('hex') === signature
    && value.subarray(12, 16).toString('ascii') === 'IHDR'
    && value.readUInt32BE(16) === expected.width
    && value.readUInt32BE(20) === expected.height;
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
  if (!exactStringSet(imageManifest?.images?.map((image) => image.component), expectedRuntimeImageComponents)
    || !exactStringSet(runtime?.images?.map((image) => image.component), expectedRuntimeImageComponents)) return false;
  const expectedImages = new Map(imageManifest.images.map((image) => [image.component, image]));
  return runtime.requestedVersion === imageManifest.requestedVersion
    && runtime?.sourceTagCommit === imageManifest.sourceTagCommit
    && runtime?.sourceTarSha256 === imageManifest.sourceTarSha256
    && lifecycle?.sourceTarSha256 === imageManifest.sourceTarSha256
    && runtime.images.every((image) => {
      const expected = expectedImages.get(image.component);
      return expected !== undefined
        && image.repository === expected.repository
        && image.tag === expected.tag
        && image.digest === expected.digest
        && image.platformVerified === expected.platformVerified
        && buildDigest(image.digest);
    });
}

function capabilityEvidenceValid(capability, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256) {
  const runtime = capability?.profiles?.runtime;
  const team = capability?.profiles?.team;
  return capability?.schemaVersion === '1.0.0'
    && capability?.kind === 'ADAPTER_CONTRACT_SMOKE'
    && capability?.status === 'SUCCESS'
    && capability?.probeMode === 'CONTROLLED_FIXTURE'
    && capability?.runtime === 'agentteams'
    && capability?.requestedVersion === 'v1.2.0'
    && capability?.controllerVersion === 'v1.2.0'
    && capability?.buildIdentity === 'v1.2.0'
    && capability?.liveAgentTeamRun === false
    && capability?.runtimeProfileValidation === 'PASS'
    && capability?.teamProfileValidation === 'PASS'
    && capability?.roleCount === 6
    && runtime?.path === 'infra/agentteams/runtime-profile.json'
    && runtime?.sha256 === runtimeProfileSha256
    && runtime?.id === runtimeProfile.id
    && runtime?.runtime === 'agentteams'
    && runtime?.version === 'v1.2.0'
    && exactStringSet(runtimeProfile.images?.map((image) => image.component), ['manager', 'worker'])
    && JSON.stringify(runtime?.images) === JSON.stringify(runtimeProfile.images)
    && team?.path === 'infra/agentteams/team-profile.json'
    && team?.sha256 === teamProfileSha256
    && team?.id === teamProfile.id
    && team?.runtimeVersion === 'v1.2.0'
    && team?.executionMode === 'SHADOW_PREP_ONLY'
    && team?.externalActionAllowed === false
    && team?.modelMaturity === 'MOCK_CONFORMANCE'
    && teamProfile.runtimeVersion === team.runtimeVersion
    && teamProfile.executionMode === team.executionMode
    && teamProfile.externalActionAllowed === team.externalActionAllowed
    && teamProfile.modelMaturity === team.modelMaturity
    && exactRoleContracts(teamProfile.roles)
    && exactRoleContracts(team?.roles)
    && exactStringSet(team?.skillLocks, expectedSkillLocks);
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

function runNegativeSelfTests({tasks, runtime, lifecycle, imageManifest, capability, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256, sourcePackage, runtimeSource, currentHead, sourceArchive, currentGitFiles, productControlPlane, noAction, shadowPostgres, licenses, expectedPackages, sourceLockSha256, sbom, expectedSbom, rootPackage, providers, liveConformance, liveNoSecret}) {
  const duplicateRuntimeImages = runtime.images.map(() => ({...runtime.images[0]}));
  const extraRuntimeImage = {...runtime.images[0], component: 'unknown-component'};
  const mutateCapabilityRole = (roleId, mutation) => ({
    ...capability,
    profiles: {
      ...capability.profiles,
      team: {
        ...capability.profiles.team,
        roles: capability.profiles.team.roles.map((role) => role.id === roleId ? mutation(role) : role)
      }
    }
  });
  const mutateProviderConformance = (mutation) => ({...providers, deepSeek: {...providers.deepSeek, conformance: mutation(providers.deepSeek.conformance)}});
  const mutationsRejected = [
    !exactTaskSet(tasks.map((task, index) => index === 0 ? {...task, ackReceiptDigest: 'x'} : task)),
    !exactTaskSet(tasks.map((task, index) => index === 0 ? {...task, runtimeResultDigest: tasks[1].runtimeResultDigest} : task)),
    !runtimeIdentityMatches({...runtime, sourceTarSha256: 'WRONG'}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: runtime.images.map((image, index) => index === 0 ? {...image, digest: `sha256:${'0'.repeat(64)}`} : image)}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: duplicateRuntimeImages}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: runtime.images.filter((image) => image.component !== 'worker')}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: runtime.images.filter((image) => image.component !== 'manager-copaw')}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: [...runtime.images, extraRuntimeImage]}, lifecycle, imageManifest),
    !runtimeIdentityMatches({...runtime, images: runtime.images.map((image, index) => index === 0 ? {...image, platformVerified: 'linux/amd64'} : image)}, lifecycle, imageManifest),
    !capabilityEvidenceValid({}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid({...capability, schemaVersion: '0.0.0'}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid({...capability, roleCount: 5}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid({...capability, profiles: {...capability.profiles, team: {...capability.profiles.team, roles: capability.profiles.team.roles.slice(0, 5)}}}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid({...capability, profiles: {...capability.profiles, team: {...capability.profiles.team, roles: [...capability.profiles.team.roles, {...capability.profiles.team.roles[0], id: 'unknown-role'}]}}}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid(mutateCapabilityRole('presence-mission-leader', (role) => ({...role, orchestrationOnly: false})), runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid(mutateCapabilityRole('founder-identity-producer', (role) => ({...role, permissions: [...role.permissions, 'AUDIT']})), runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid(mutateCapabilityRole('campaign-planner', (role) => ({...role, skillLocks: ['trace-safe-escalation@1.0.0']})), runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid({...capability, profiles: {...capability.profiles, team: {...capability.profiles.team, skillLocks: capability.profiles.team.skillLocks.slice(1)}}}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid({...capability, profiles: {...capability.profiles, team: {...capability.profiles.team, sha256: '0'.repeat(64)}}}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
    !capabilityEvidenceValid({...capability, profiles: {...capability.profiles, runtime: {...capability.profiles.runtime, sha256: '0'.repeat(64)}}}, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256),
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
    !licenseEvidenceValid({...licenses, packages: [], packageCount: 0}, expectedPackages, sourceLockSha256),
    !sbomEvidenceValid({bomFormat: 'CycloneDX'}, expectedSbom, rootPackage, expectedPackages.length, sourceLockSha256),
    !sbomEvidenceValid({...sbom, components: sbom.components.slice(0, 1)}, expectedSbom, rootPackage, expectedPackages.length, sourceLockSha256),
    !exactBooleanMap({...shadowPostgres.immutableHistory, owner_reviews: false}, expectedImmutableHistory),
    !pngImageMatches(Buffer.from('not a png', 'utf8'), {width: 390, height: 844}),
    !providerEvidenceValid(mutateProviderConformance((conformance) => ({...conformance, costSnapshotsUsd: {...conformance.costSnapshotsUsd, flash: 0.000028}}))),
    !providerEvidenceValid(mutateProviderConformance((conformance) => ({...conformance, pricingSnapshots: {...conformance.pricingSnapshots, flash: {...conformance.pricingSnapshots.flash, inputCacheHitUsdPerMillion: undefined}}}))),
    !providerEvidenceValid(mutateProviderConformance((conformance) => ({...conformance, usageBreakdownConsistencyRejected: false}))),
    !providerEvidenceValid(mutateProviderConformance((conformance) => ({...conformance, exactSchemaPromptBound: false}))),
    !liveConformanceValid({...liveConformance, liveProviderVerified: true}),
    !liveConformanceValid({...liveConformance, composeInspect: {...liveConformance.composeInspect, secretInEnvironment: true}}),
    !liveConformanceValid({...liveConformance, targetedContracts: {...liveConformance.targetedContracts, mockFallback: true}}),
    !liveConformanceValid({...liveConformance, targetedContracts: {...liveConformance.targetedContracts, tests: 0}}),
    !liveConformanceValid({...liveConformance, targetedContracts: {...liveConformance.targetedContracts, exactRoleSchemaPromptBound: false}}),
    !liveConformanceValid({...liveConformance, providerOutcomeDiagnostics: {...liveConformance.providerOutcomeDiagnostics, outcomes: liveConformance.providerOutcomeDiagnostics.outcomes.map((entry, index) => index === 0 ? {...entry, providerOutcomeCode: 'RAW_PROVIDER_FAILURE'} : entry)}}),
    !liveConformanceValid({...liveConformance, stdinTransport: {...liveConformance.stdinTransport, nestedChildProcess: false}}),
    !liveConformanceValid({...liveConformance, stdinTransport: {...liveConformance.stdinTransport, bootstrapOrSecretFinding: true}}),
    !liveConformanceValid({...liveConformance, stdinTransport: {...liveConformance.stdinTransport, extraFieldRejected: false}}),
    !liveConformanceValid({...liveConformance, cleanupEvidence: {...liveConformance.cleanupEvidence, exactComposeProjectRemoved: false}}),
    !liveNoSecretDiagnosticValid({...liveNoSecret, source: {...liveNoSecret.source, head: '0'.repeat(40)}}, currentHead, imageManifest),
    !liveNoSecretDiagnosticValid({...liveNoSecret, diagnosedBoundary: {...liveNoSecret.diagnosedBoundary, ownerSecretPresent: true}}, currentHead, imageManifest),
    !liveNoSecretDiagnosticValid({...liveNoSecret, diagnosedBoundary: {...liveNoSecret.diagnosedBoundary, providerOutcomeCode: 'LIVE_PROVIDER_BROKER_FAILED'}}, currentHead, imageManifest),
    !liveNoSecretDiagnosticValid({...liveNoSecret, noAction: {...liveNoSecret.noAction, externalActionCount: 1}}, currentHead, imageManifest)
  ];
  if (!mutationsRejected.every(Boolean)) throw new Error('EVIDENCE_NEGATIVE_SELF_TEST_FAILED');
  return mutationsRejected.length;
}

async function assertEvidence() {
  const [capability, api, compose, agentteamsImage, agentteamsReal, providers, liveConformance, liveNoSecret, shadowPostgres, browser, licenses, secretScan, sourcePackage, sbom, npmAudit] = await Promise.all([
    readJson('agentteams-capability-report.json'),
    readJson('api-integration.json'),
    readJson('compose-verification.json'),
    readJson('agentteams-image-smoke.json'),
    readJson('agentteams-real-runtime.json'),
    readJson('provider-conformance.json'),
    readJson('live-deepseek-conformance.json'),
    readJson('live-agentteams-no-secret-diagnostic.json'),
    readJson('shadow-postgres.json'),
    readJson('browser-verification.json'),
    readJson('license-inventory.json'),
    readJson('secret-scan.json'),
    readJson('source-packages/source-package-manifest.json'),
    readJson('sbom.cdx.json'),
    readJson('npm-audit.json')
  ]);
  const imageManifest = JSON.parse(await readFile(path.join(root, 'infra/agentteams/image-manifest.json'), 'utf8'));
  const runtimeProfileText = await readFile(path.join(root, 'infra/agentteams/runtime-profile.json'), 'utf8');
  const teamProfileText = await readFile(path.join(root, 'infra/agentteams/team-profile.json'), 'utf8');
  const runtimeProfileSha256 = createHash('sha256').update(runtimeProfileText).digest('hex');
  const teamProfileSha256 = createHash('sha256').update(teamProfileText).digest('hex');
  const runtimeProfile = JSON.parse(runtimeProfileText);
  const teamProfile = JSON.parse(teamProfileText);
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
  const screenshotEvidenceValid = (await Promise.all([...expectedScreenshotDimensions].map(async ([file, dimensions]) => {
    const value = await readFile(path.join(evidenceRoot, file));
    return pngImageMatches(value, dimensions);
  }))).every(Boolean);
  if (!capabilityEvidenceValid(capability, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256)) failures.push('agentteams-capability-report');
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
  if (!providerEvidenceValid(providers)) failures.push('provider-conformance');
  if (!liveConformanceValid(liveConformance)) failures.push('live-deepseek-conformance');
  if (!liveNoSecretDiagnosticValid(liveNoSecret, currentHead, imageManifest)) failures.push('live-agentteams-no-secret-diagnostic');
  if (shadowPostgres.status !== 'PASS' || shadowPostgres.restartRecovered !== true || shadowPostgres.normalizedHistoryOnly !== true || shadowPostgres.idempotencyMetadataOnly !== true || shadowPostgres.advancedCheckpointRejected !== true || shadowPostgres.idempotentReplayNormalizedValidated !== true || !exactBooleanMap(shadowPostgres.immutableHistory, expectedImmutableHistory) || shadowPostgres.counts?.owner_reviews !== 1 || shadowPostgres.forbiddenTables !== 0 || !exactNoAction(shadowPostgres.noAction)) failures.push('shadow-postgres');
  const productBrowser = browser.checks?.productHydratedMissionAndReview;
  const browserNoActionValid = exactBrowserNoAction(productBrowser?.mission)
    && exactBrowserNoAction(browser.checks?.englishHydratedMission)
    && exactBrowserNoAction(browser.checks?.mobile390Mission)
    && productBrowser?.review?.noGrantBoundary === true
    && Array.isArray(productBrowser?.review?.grants)
    && productBrowser.review.grants.join(',') === '0,0,0,FALSE';
  const browserModeChoice = productBrowser?.modeChoice;
  const browserModeChoiceValid = browserModeChoice?.mock === true && browserModeChoice?.live === true && browserModeChoice?.maturity === true && browserModeChoice?.coordinator === true && browserModeChoice?.unpublished === true && browserModeChoice?.noAction === true;
  if (browser.status !== 'PASS' || browser.consoleErrorCount !== 0 || browser.checks?.storybookRealBrowserStateMatrix?.count !== 16 || !browserModeChoiceValid || declaredBrowserScreenshots.join(',') !== expectedBrowserScreenshots.join(',') || !screenshotEvidenceValid || browser.realAgentTeamsClaim !== false || !browserNoActionValid) failures.push('browser-verification');
  if (!licenseEvidenceValid(licenses, expectedPackages, sourceLockSha256)) failures.push('license-inventory');
  if (secretScan.status !== 'PASS' || !Array.isArray(secretScan.findings) || secretScan.findings.length !== 0) failures.push('secret-scan');
  if (currentBranch !== expectedBranch || sourcePackage.publicSafe !== true || sourcePackage.secretScan !== 'PASS' || sourcePackage.pathScan !== 'PASS' || sourcePackage.archiveCrcTest !== 'PASS' || sourcePackage.workingTreeSnapshot !== false || !sourceIdentityMatches(sourcePackage, agentteamsReal.sourceIdentity, currentHead, sourceArchive, currentGitFiles)) failures.push('source-package');
  if (!sbomEvidenceValid(sbom, expectedSbom, rootPackage, expectedPackages.length, sourceLockSha256)) failures.push('sbom');
  if (npmAudit.metadata?.vulnerabilities?.total !== 0) failures.push('npm-audit');
  if (failures.length > 0) throw new Error(`EVIDENCE_VALIDATION_FAILED:${failures.join(',')}`);
  return runNegativeSelfTests({tasks: causalTasks, runtime: agentteamsReal.runtime, lifecycle: agentteamsReal.environmentLifecycle, imageManifest, capability, runtimeProfile, teamProfile, runtimeProfileSha256, teamProfileSha256, sourcePackage, runtimeSource: agentteamsReal.sourceIdentity, currentHead, sourceArchive, currentGitFiles, productControlPlane: agentteamsReal.productControlPlane, noAction: agentteamsReal.noAction, shadowPostgres, licenses, expectedPackages, sourceLockSha256, sbom, expectedSbom, rootPackage, providers, liveConformance, liveNoSecret});
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
    'agentteams-capability-report',
    'api-integration',
    'compose-verification',
    'agentteams-image-smoke',
    'agentteams-real-runtime',
    'provider-conformance',
    'live-deepseek-conformance',
    'live-agentteams-no-secret-diagnostic',
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
