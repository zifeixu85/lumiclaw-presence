import {digestCampaign, validateCampaignDocument} from './campaign.js';
import {validateCampaignShape} from './campaign-schema.js';
import type {ArtifactRevision, CampaignDocument, CampaignEnvelope, Claim} from './campaign-types.js';
import {canonicalize} from './canonical.js';
import {createUuidV7} from './id.js';
import {invalidateStaleSchedules} from './schedule.js';

export function campaignEtag(id: string, version: number, digest: string): string {
  return `"campaign-${id}-v${version}-${digest}"`;
}

export function createCampaignEnvelope(document: CampaignDocument, now = new Date()): CampaignEnvelope {
  assertCampaignShape(document);
  const prepared = structuredClone(document);
  prepared.missionContract.sourceDigest = digestCampaign(prepared);
  assertValidCampaign(prepared, now);
  const digest = digestCampaign(prepared);
  const timestamp = now.toISOString();
  const gaps = readinessGaps(prepared);
  return {
    document: prepared, version: 1, digest, etag: campaignEtag(prepared.id, 1, digest),
    readiness: gaps.length === 0 ? 'SAVED' : 'NEEDS_OWNER', gapCodes: gaps,
    createdAt: timestamp, updatedAt: timestamp, mode: 'DEMO_SEED', live: false
  };
}

export function advanceCampaignEnvelope(current: CampaignEnvelope, incoming: CampaignDocument, now = new Date()): CampaignEnvelope {
  assertCampaignShape(incoming);
  if (incoming.id !== current.document.id || incoming.organizationId !== current.document.organizationId) {
    throw new CampaignPreparationError('CAMPAIGN_IDENTITY_IMMUTABLE', 'Campaign ID and organization scope cannot change.');
  }
  assertAuthorityFields(current.document, incoming);
  const prepared = structuredClone(incoming);
  const currentClaims = new Map(current.document.claims.map((item) => [item.id, item]));
  prepared.claims = prepared.claims.map((item) => reviseClaim(currentClaims.get(item.id), item));
  const currentByUnit = new Map(current.document.artifactRevisions.map((item) => [item.activationUnitId, item]));
  prepared.artifactRevisions = prepared.artifactRevisions.map((item) => reviseArtifact(currentByUnit.get(item.activationUnitId), item, current.document, prepared, now));
  retainAndInvalidateReplacedSchedule(current.document, prepared, now);
  const scheduleState = invalidateStaleSchedules(prepared.publishingSchedules, prepared.scheduleOccurrences, prepared.artifactRevisions, now);
  prepared.publishingSchedules = scheduleState.schedules;
  prepared.scheduleOccurrences = scheduleState.occurrences;
  prepared.missionContract.sourceDigest = digestCampaign(prepared);
  assertValidCampaign(prepared, now);
  const version = current.version + 1;
  const digest = digestCampaign(prepared);
  const gaps = readinessGaps(prepared);
  return {
    document: prepared, version, digest, etag: campaignEtag(prepared.id, version, digest),
    readiness: gaps.length === 0 ? 'SAVED' : 'NEEDS_OWNER', gapCodes: gaps,
    createdAt: current.createdAt, updatedAt: now.toISOString(), mode: 'DEMO_SEED', live: false
  };
}

function assertCampaignShape(document: unknown): asserts document is CampaignDocument {
  const shape = validateCampaignShape(document);
  if (!shape.valid) throw new CampaignPreparationError('CAMPAIGN_VALIDATION_FAILED', 'Campaign schema validation failed.', shape.issues);
}

function retainAndInvalidateReplacedSchedule(current: CampaignDocument, prepared: CampaignDocument, now: Date): void {
  const incomingScheduleIds = new Set(prepared.publishingSchedules.map((item) => item.id));
  const incomingOccurrenceIds = new Set(prepared.scheduleOccurrences.map((item) => item.id));
  const addedSchedule = prepared.publishingSchedules.some((item) => !current.publishingSchedules.some((existing) => existing.id === item.id));
  prepared.publishingSchedules.push(...current.publishingSchedules.filter((item) => !incomingScheduleIds.has(item.id)).map((item) => structuredClone(item)));
  prepared.scheduleOccurrences.push(...current.scheduleOccurrences.filter((item) => !incomingOccurrenceIds.has(item.id)).map((item) => structuredClone(item)));
  if (!addedSchedule) return;
  const replacedIds = new Set(current.publishingSchedules.filter((item) => item.status === 'ACTIVE').map((item) => item.id));
  const timestamp = now.toISOString();
  prepared.publishingSchedules = prepared.publishingSchedules.map((item) => replacedIds.has(item.id) ? {...item, status: 'INVALIDATED', invalidationReason: 'SCHEDULE_EDIT', updatedAt: timestamp} : item);
  prepared.scheduleOccurrences = prepared.scheduleOccurrences.map((item) => replacedIds.has(item.scheduleId) && item.state === 'PENDING' ? {...item, state: 'INVALIDATED'} : item);
}

function reviseClaim(current: Claim | undefined, incoming: Claim): Claim {
  if (current === undefined) return {...structuredClone(incoming), version: 1};
  const currentAuthority = canonicalize({...current, statement: '', version: 0});
  const incomingAuthority = canonicalize({...incoming, statement: '', version: 0});
  if (currentAuthority !== incomingAuthority) throw new CampaignPreparationError('CAMPAIGN_AUTHORITY_FIELD_CHANGED', 'Claim scope, status, evidence, and effective window are server-governed in M1.');
  const currentContent = canonicalize({...current, version: 0});
  const incomingContent = canonicalize({...incoming, version: 0});
  if (current.status !== 'DRAFT' && currentContent !== incomingContent) throw new CampaignPreparationError('CAMPAIGN_AUTHORITY_FIELD_CHANGED', 'Only a DRAFT Claim statement can be edited in M1; approved or retired Claim evidence bindings are immutable.');
  return currentContent === incomingContent ? structuredClone(current) : {...structuredClone(incoming), version: current.version + 1};
}

function assertAuthorityFields(current: CampaignDocument, incoming: CampaignDocument): void {
  const authorityView = (document: CampaignDocument) => ({
    evidenceRefs: document.evidenceRefs,
    claimIds: document.claims.map((item) => item.id),
    capabilitySnapshots: document.capabilitySnapshots,
    activationUnits: document.activationPlan.units,
    organization: {...document.graph.organization, displayName: ''},
    identities: document.graph.identities.map((item) => ({...item, displayName: '', publicBio: ''})),
    brands: document.graph.brands.map((item) => ({...item, name: '', positioning: ''})),
    products: document.graph.products.map((item) => ({...item, name: '', description: ''})),
    markets: document.graph.markets.map((item) => ({...item, displayName: '', primaryLanguage: ''})),
    channelAccounts: document.graph.channelAccounts.map((item) => ({...item, displayHandle: ''})),
    accountMandates: document.graph.accountMandates,
    missionContract: {...document.missionContract, sourceDigest: ''}
  });
  if (canonicalize(authorityView(current)) !== canonicalize(authorityView(incoming))) throw new CampaignPreparationError('CAMPAIGN_AUTHORITY_FIELD_CHANGED', 'M1 PUT cannot rewrite evidence, capability constraints, activation scope, account mandate, or graph identity edges.');
  const currentSchedules = new Map(current.publishingSchedules.map((item) => [item.id, item]));
  const currentOccurrences = new Map(current.scheduleOccurrences.map((item) => [item.id, item]));
  if (incoming.publishingSchedules.some((item) => currentSchedules.has(item.id) && canonicalize(item) !== canonicalize(currentSchedules.get(item.id))) || incoming.scheduleOccurrences.some((item) => currentOccurrences.has(item.id) && canonicalize(item) !== canonicalize(currentOccurrences.get(item.id)))) throw new CampaignPreparationError('CAMPAIGN_AUTHORITY_FIELD_CHANGED', 'Existing schedule history is immutable; a time or recurrence edit must append a new preview contract.');
}

function reviseArtifact(current: ArtifactRevision | undefined, incoming: ArtifactRevision, currentDocument: CampaignDocument, incomingDocument: CampaignDocument, now: Date): ArtifactRevision {
  if (current !== undefined && artifactGovernedContent(current, currentDocument) === artifactGovernedContent(incoming, incomingDocument)) return structuredClone(current);
  return {...structuredClone(incoming), id: createUuidV7(now.getTime()), revision: (current?.revision ?? 0) + 1, createdAt: now.toISOString()};
}

function artifactGovernedContent(revision: ArtifactRevision, document: CampaignDocument): string {
  const unit = document.activationPlan.units.find((item) => item.id === revision.activationUnitId);
  const claimIds = new Set(revision.claimIds);
  const claims = document.claims.filter((item) => claimIds.has(item.id));
  const evidenceIds = new Set(claims.flatMap((item) => item.evidenceRefIds));
  return canonicalize({
    activationUnit: unit,
    identity: document.graph.identities.find((item) => item.id === unit?.identityId),
    product: document.graph.products.find((item) => item.id === unit?.productId),
    market: document.graph.markets.find((item) => item.id === unit?.marketId),
    channelAccount: document.graph.channelAccounts.find((item) => item.id === unit?.channelAccountId),
    accountMandate: document.graph.accountMandates.find((item) => item.id === unit?.accountMandateId),
    capabilitySnapshot: document.capabilitySnapshots.find((item) => item.id === revision.capabilitySnapshotId),
    claims,
    evidenceRefs: document.evidenceRefs.filter((item) => evidenceIds.has(item.id)),
    platform: revision.platform,
    content: revision.content
  });
}

function readinessGaps(document: CampaignDocument): string[] {
  return document.claims.filter((claim) => claim.status === 'DRAFT' || claim.evidenceRefIds.length === 0).map((claim) => `CLAIM_EVIDENCE_REQUIRED:${claim.id}`);
}

function assertValidCampaign(document: CampaignDocument, now: Date): void {
  const validation = validateCampaignDocument(document, now);
  if (!validation.ok) throw new CampaignPreparationError('CAMPAIGN_VALIDATION_FAILED', 'Campaign validation failed.', validation.issues);
}

export class CampaignPreparationError extends Error {
  constructor(public readonly code: 'CAMPAIGN_IDENTITY_IMMUTABLE' | 'CAMPAIGN_AUTHORITY_FIELD_CHANGED' | 'CAMPAIGN_VALIDATION_FAILED', message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'CampaignPreparationError';
  }
}
