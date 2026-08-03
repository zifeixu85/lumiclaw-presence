import {sha256Digest} from './canonical.js';
import {validateCampaignShape} from './campaign-schema.js';
import {mandateMatchesUnit, type ArtifactRevision, type CampaignDocument, type Claim, type PlatformArtifact} from './campaign-types.js';
import {validateOrganizationGraph} from './graph.js';
import {isStoredScheduleContractValid} from './schedule.js';
import type {Platform, ValidationIssue, ValidationResult} from './types.js';

export function canonicalCampaignPayload(document: CampaignDocument): unknown {
  return {...document, missionContract: {...document.missionContract, sourceDigest: ''}};
}

export function digestCampaign(document: CampaignDocument): string {
  return sha256Digest(canonicalCampaignPayload(document));
}

export function validateCampaignDocument(value: unknown, now = new Date()): ValidationResult {
  const shape = validateCampaignShape(value);
  if (!shape.valid) return {ok: false, issues: shape.issues};
  const document = shape.value;
  const issues: ValidationIssue[] = [];
  const graphResult = validateOrganizationGraph(document.graph, now);
  if (!graphResult.ok) issues.push(...graphResult.issues);

  const campaignIds = [
    document.id,
    ...document.evidenceRefs.map((item) => item.id),
    ...document.claims.map((item) => item.id),
    ...document.activationPlan.units.map((item) => item.id),
    ...document.capabilitySnapshots.map((item) => item.id),
    ...document.artifactRevisions.map((item) => item.id),
    ...document.publishingSchedules.map((item) => item.id),
    ...document.scheduleOccurrences.map((item) => item.id)
  ];
  if (new Set(campaignIds).size !== campaignIds.length) issues.push(issue('CAMPAIGN_DUPLICATE_ID', '/', 'Campaign-scoped object IDs must be unique.'));

  if (document.organizationId !== document.graph.organization.id) issues.push(issue('CAMPAIGN_ORGANIZATION_SCOPE_MISMATCH', '/organizationId', 'Campaign and graph organization scopes differ.'));
  const scoped = [...document.evidenceRefs, ...document.claims, ...document.activationPlan.units, ...document.capabilitySnapshots, ...document.artifactRevisions, ...document.publishingSchedules, ...document.scheduleOccurrences];
  scoped.forEach((item, index) => {
    if (item.organizationId !== document.organizationId) issues.push(issue('CAMPAIGN_ORGANIZATION_SCOPE_MISMATCH', `/scoped/${index}/organizationId`, 'Campaign child organization scope differs.'));
  });
  if (new Set(document.activationPlan.units.map((unit) => unit.platform)).size !== 4) issues.push(issue('ACTIVATION_PLATFORM_SET_INVALID', '/activationPlan/units', 'Activation plan must contain exactly one unit per M1 platform.'));

  const mandates = new Map(document.graph.accountMandates.map((mandate) => [mandate.id, mandate]));
  const accounts = new Map(document.graph.channelAccounts.map((account) => [account.id, account]));
  const products = new Set(document.graph.products.map((product) => product.id));
  const markets = new Set(document.graph.markets.map((market) => market.id));
  for (const [index, unit] of document.activationPlan.units.entries()) {
    const mandate = mandates.get(unit.accountMandateId);
    const account = accounts.get(unit.channelAccountId);
    if (mandate === undefined || !mandateMatchesUnit(mandate, unit)) issues.push(issue('ACTIVATION_MANDATE_SCOPE_INVALID', `/activationPlan/units/${index}`, 'Activation unit does not match its exact AccountMandate tuple.'));
    if (account === undefined || account.platform !== unit.platform || account.identityId !== unit.identityId) issues.push(issue('ACTIVATION_ACCOUNT_SCOPE_INVALID', `/activationPlan/units/${index}`, 'Activation unit account identity/platform does not match.'));
    if (!products.has(unit.productId)) issues.push(issue('CLAIM_PRODUCT_SCOPE_INVALID', `/activationPlan/units/${index}/productId`, 'Activation unit product is not in the Campaign graph.'));
    if (!markets.has(unit.marketId)) issues.push(issue('CLAIM_MARKET_SCOPE_INVALID', `/activationPlan/units/${index}/marketId`, 'Activation unit market is not in the Campaign graph.'));
  }

  const claims = new Map(document.claims.map((claim) => [claim.id, claim]));
  const evidence = new Set(document.evidenceRefs.map((item) => item.id));
  document.claims.forEach((claim, index) => {
    if (claim.status === 'DRAFT') return;
    const path = `/claims/${index}`;
    if (!products.has(claim.subjectId)) issues.push(issue('CLAIM_PRODUCT_SCOPE_INVALID', `${path}/subjectId`, 'Governed Claim subject is not a Campaign Product.'));
    if (claim.marketIds.some((marketId) => !markets.has(marketId))) issues.push(issue('CLAIM_MARKET_SCOPE_INVALID', `${path}/marketIds`, 'Governed Claim contains a Market outside the Campaign graph.'));
    const effectiveFrom = Date.parse(claim.effectiveFrom);
    const effectiveUntil = Date.parse(claim.effectiveUntil);
    if (!Number.isFinite(effectiveFrom) || !Number.isFinite(effectiveUntil) || effectiveFrom > now.getTime() || effectiveUntil <= now.getTime() || effectiveUntil <= effectiveFrom) issues.push(issue('CLAIM_EXPIRED', path, 'Governed Claim effective window is invalid or does not include validation time.'));
    if (claim.evidenceRefIds.length === 0 || claim.evidenceRefIds.some((id) => !evidence.has(id))) issues.push(issue('CLAIM_EVIDENCE_MISSING', `${path}/evidenceRefIds`, 'Governed Claim does not have a complete Campaign EvidenceRef set.'));
  });
  const capabilities = new Map(document.capabilitySnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const units = new Map(document.activationPlan.units.map((unit) => [unit.id, unit]));
  const capabilityPlatforms = new Set(document.capabilitySnapshots.map((snapshot) => snapshot.platform));
  const capabilityAccounts = new Set(document.capabilitySnapshots.map((snapshot) => snapshot.channelAccountId));
  if (capabilities.size !== 4 || capabilityPlatforms.size !== 4 || capabilityAccounts.size !== 4) issues.push(issue('ARTIFACT_CAPABILITY_SCOPE_INVALID', '/capabilitySnapshots', 'Campaign must contain exactly one CapabilitySnapshot for every M1 platform account.'));
  const artifactUnitIds = new Set(document.artifactRevisions.map((revision) => revision.activationUnitId));
  const artifactPlatforms = new Set(document.artifactRevisions.map((revision) => revision.platform));
  if (artifactUnitIds.size !== units.size || [...units.keys()].some((id) => !artifactUnitIds.has(id)) || artifactPlatforms.size !== 4) issues.push(issue('ARTIFACT_ACTIVATION_SCOPE_INVALID', '/artifactRevisions', 'Campaign must contain exactly one current artifact for every ActivationUnit and M1 platform.'));
  for (const [index, revision] of document.artifactRevisions.entries()) {
    const unit = units.get(revision.activationUnitId);
    if (unit === undefined || revision.campaignId !== document.id || revision.platform !== unit.platform) issues.push(issue('ARTIFACT_ACTIVATION_SCOPE_INVALID', `/artifactRevisions/${index}`, 'Artifact revision does not match the Campaign/ActivationUnit/platform.'));
    const capability = capabilities.get(revision.capabilitySnapshotId);
    if (capability === undefined || capability.platform !== revision.platform || capability.channelAccountId !== unit?.channelAccountId) issues.push(issue('ARTIFACT_CAPABILITY_SCOPE_INVALID', `/artifactRevisions/${index}/capabilitySnapshotId`, 'Artifact capability snapshot does not match its platform/account.'));
    if (capability !== undefined) {
      const capturedAt = Date.parse(capability.capturedAt);
      const expiresAt = Date.parse(capability.expiresAt);
      if (!Number.isFinite(capturedAt) || !Number.isFinite(expiresAt) || expiresAt <= now.getTime() || expiresAt <= capturedAt) issues.push(issue('CAPABILITY_EXPIRED', `/artifactRevisions/${index}/capabilitySnapshotId`, 'Capability snapshot time window is invalid or expired.'));
    }
    if (revision.content.kind !== revision.platform) issues.push(issue('ARTIFACT_ACTIVATION_SCOPE_INVALID', `/artifactRevisions/${index}/content/kind`, 'Artifact platform and content kind must match.'));
    for (const claimId of revision.claimIds) {
      const claim = claims.get(claimId);
      if (claim === undefined) {
        issues.push(issue('CLAIM_NOT_FOUND', `/artifactRevisions/${index}/claimIds`, 'Artifact references a missing Claim.'));
      } else if (unit !== undefined) {
        issues.push(...validateClaimForUnit(claim, unit.productId, unit.marketId, evidence, now, `/artifactRevisions/${index}/claimIds`));
      }
    }
    if (capability !== undefined) issues.push(...validateArtifactConstraints(revision, capability.constraints, `/artifactRevisions/${index}/content`));
  }

  const revisionIds = new Set(document.artifactRevisions.map((revision) => revision.id));
  const schedules = new Map(document.publishingSchedules.map((schedule) => [schedule.id, schedule]));
  if (document.publishingSchedules.filter((schedule) => schedule.status === 'ACTIVE').length > 1) issues.push(issue('SCHEDULE_SCOPE_INVALID', '/publishingSchedules', 'M1 permits only one active Campaign schedule.'));
  document.publishingSchedules.forEach((schedule, index) => {
    if (schedule.campaignId !== document.id) issues.push(issue('SCHEDULE_SCOPE_INVALID', `/publishingSchedules/${index}/campaignId`, 'Schedule does not belong to this Campaign.'));
    const scheduleRevisionIds = new Set(schedule.sourceArtifactRevisionIds);
    if (schedule.status === 'ACTIVE' && (scheduleRevisionIds.size !== revisionIds.size || [...revisionIds].some((id) => !scheduleRevisionIds.has(id)))) issues.push(issue('SCHEDULE_SOURCE_REVISION_STALE', `/publishingSchedules/${index}/sourceArtifactRevisionIds`, 'Active schedule must reference every exact current ArtifactRevision.'));
    const occurrences = document.scheduleOccurrences.filter((occurrence) => occurrence.scheduleId === schedule.id);
    if (!isStoredScheduleContractValid(schedule, occurrences, document.artifactRevisions)) issues.push(issue('SCHEDULE_CONTRACT_INVALID', `/publishingSchedules/${index}`, 'Schedule or occurrence data does not match the deterministic M1 preview contract.'));
  });
  document.scheduleOccurrences.forEach((occurrence, index) => {
    const schedule = schedules.get(occurrence.scheduleId);
    if (occurrence.campaignId !== document.id || schedule === undefined || occurrence.scheduleVersion !== schedule.version) issues.push(issue('SCHEDULE_OCCURRENCE_SCOPE_INVALID', `/scheduleOccurrences/${index}`, 'Occurrence does not match its schedule version and Campaign.'));
  });

  const calculated = digestCampaign(document);
  if (document.missionContract.sourceDigest !== calculated) issues.push(issue('MISSION_SOURCE_DIGEST_MISMATCH', '/missionContract/sourceDigest', 'MissionContract source digest does not match canonical Campaign content.'));
  const targetWindowStart = Date.parse(document.brief.targetWindowStart);
  const targetWindowEnd = Date.parse(document.brief.targetWindowEnd);
  if (!Number.isFinite(targetWindowStart) || !Number.isFinite(targetWindowEnd) || targetWindowEnd <= targetWindowStart) issues.push(issue('CAMPAIGN_WINDOW_INVALID', '/brief', 'Campaign target window must contain valid timestamps with end after start.'));
  return issues.length === 0 ? {ok: true} : {ok: false, issues};
}

function validateClaimForUnit(claim: Claim, productId: string, marketId: string, evidence: Set<string>, now: Date, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (claim.status !== 'APPROVED') issues.push(issue(claim.status === 'REVOKED' ? 'CLAIM_REVOKED' : 'CLAIM_NOT_APPROVED', path, 'Artifact Claim is not approved.'));
  if (claim.subjectId !== productId) issues.push(issue('CLAIM_PRODUCT_SCOPE_INVALID', path, 'Claim subject does not match the ActivationUnit product.'));
  if (!claim.marketIds.includes(marketId)) issues.push(issue('CLAIM_MARKET_SCOPE_INVALID', path, 'Claim market does not include the ActivationUnit market.'));
  const effectiveFrom = Date.parse(claim.effectiveFrom);
  const effectiveUntil = Date.parse(claim.effectiveUntil);
  if (!Number.isFinite(effectiveFrom) || !Number.isFinite(effectiveUntil) || effectiveFrom > now.getTime() || effectiveUntil <= now.getTime() || effectiveUntil <= effectiveFrom) issues.push(issue('CLAIM_EXPIRED', path, 'Claim effective window is invalid or does not include validation time.'));
  if (claim.evidenceRefIds.length === 0 || claim.evidenceRefIds.some((id) => !evidence.has(id))) issues.push(issue('CLAIM_EVIDENCE_MISSING', path, 'Claim does not have a complete EvidenceRef set.'));
  return issues;
}

function validateArtifactConstraints(revision: ArtifactRevision, constraints: Record<string, {maxLength?: number; maxItems?: number; required: boolean}>, path: string): ValidationIssue[] {
  const fields = artifactFields(revision.content);
  const issues: ValidationIssue[] = [];
  for (const [name, rule] of Object.entries(constraints)) {
    const value = fields[name];
    if (rule.required && (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))) issues.push(issue('ARTIFACT_FIELD_REQUIRED', `${path}/${name}`, `Required platform field ${name} is missing.`));
    if (rule.maxLength !== undefined && typeof value === 'string' && Array.from(value).length > rule.maxLength) issues.push(issue('ARTIFACT_TEXT_LIMIT_EXCEEDED', `${path}/${name}`, `Platform field ${name} exceeds the fixture limit.`));
    if (rule.maxLength !== undefined && Array.isArray(value) && value.some((item) => Array.from(item).length > rule.maxLength!)) issues.push(issue('ARTIFACT_TEXT_LIMIT_EXCEEDED', `${path}/${name}`, `A ${name} item exceeds the fixture limit.`));
    if (rule.maxItems !== undefined && Array.isArray(value) && value.length > rule.maxItems) issues.push(issue('ARTIFACT_ITEM_LIMIT_EXCEEDED', `${path}/${name}`, `Platform field ${name} has too many items.`));
  }
  return issues;
}

function artifactFields(content: PlatformArtifact): Record<string, string | string[]> {
  switch (content.kind) {
    case 'X': return {posts: content.posts, altText: content.altText};
    case 'BLUESKY': return {posts: content.posts, embedUrl: content.embedUrl, altText: content.altText};
    case 'LINKEDIN': return {commentary: content.commentary, linkTitle: content.linkTitle, linkUrl: content.linkUrl};
    case 'XIAOHONGSHU': return {title: content.title, body: content.body, topics: content.topics, coverLabel: content.coverLabel};
  }
}

function issue(code: ValidationIssue['code'], path: string, message: string): ValidationIssue { return {code, path, message}; }

export function platformForContent(content: PlatformArtifact): Platform { return content.kind; }
