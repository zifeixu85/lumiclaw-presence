import {digestCampaign, validateCampaignDocument} from './campaign.js';
import type {ArtifactRevision, CampaignDocument, CampaignEnvelope} from './campaign-types.js';
import {canonicalize} from './canonical.js';
import {createUuidV7} from './id.js';

export function campaignEtag(id: string, version: number, digest: string): string {
  return `"campaign-${id}-v${version}-${digest}"`;
}

export function createCampaignEnvelope(document: CampaignDocument, now = new Date()): CampaignEnvelope {
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
  if (incoming.id !== current.document.id || incoming.organizationId !== current.document.organizationId) {
    throw new CampaignPreparationError('CAMPAIGN_IDENTITY_IMMUTABLE', 'Campaign ID and organization scope cannot change.');
  }
  const prepared = structuredClone(incoming);
  const currentByUnit = new Map(current.document.artifactRevisions.map((item) => [item.activationUnitId, item]));
  prepared.artifactRevisions = prepared.artifactRevisions.map((item) => reviseArtifact(currentByUnit.get(item.activationUnitId), item, now));
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

function reviseArtifact(current: ArtifactRevision | undefined, incoming: ArtifactRevision, now: Date): ArtifactRevision {
  if (current !== undefined && artifactGovernedContent(current) === artifactGovernedContent(incoming)) return structuredClone(current);
  return {...structuredClone(incoming), id: createUuidV7(now.getTime()), revision: (current?.revision ?? 0) + 1, createdAt: now.toISOString()};
}

function artifactGovernedContent(revision: ArtifactRevision): string {
  return canonicalize({activationUnitId: revision.activationUnitId, platform: revision.platform, capabilitySnapshotId: revision.capabilitySnapshotId, claimIds: revision.claimIds, content: revision.content});
}

function readinessGaps(document: CampaignDocument): string[] {
  return document.claims.filter((claim) => claim.status === 'DRAFT' || claim.evidenceRefIds.length === 0).map((claim) => `CLAIM_EVIDENCE_REQUIRED:${claim.id}`);
}

function assertValidCampaign(document: CampaignDocument, now: Date): void {
  const validation = validateCampaignDocument(document, now);
  if (!validation.ok) throw new CampaignPreparationError('CAMPAIGN_VALIDATION_FAILED', 'Campaign validation failed.', validation.issues);
}

export class CampaignPreparationError extends Error {
  constructor(public readonly code: 'CAMPAIGN_IDENTITY_IMMUTABLE' | 'CAMPAIGN_VALIDATION_FAILED', message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'CampaignPreparationError';
  }
}
