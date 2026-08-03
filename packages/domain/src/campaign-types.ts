import type {AccountMandate, DomainId, OrganizationGraph, Platform} from './types.js';

export type EvidenceRef = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  label: string;
  sourceUrl: string;
  capturedAt: string;
  contentDigest: string;
  publicSafe: true;
};

export type Claim = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  version: number;
  subjectType: 'PRODUCT';
  subjectId: DomainId;
  marketIds: DomainId[];
  statement: string;
  effectiveFrom: string;
  effectiveUntil: string;
  status: 'DRAFT' | 'APPROVED' | 'STALE' | 'REVOKED';
  evidenceRefIds: DomainId[];
};

export type CampaignBrief = {
  schemaVersion: 1;
  name: string;
  objective: string;
  callToAction: string;
  contentLanguage: 'en' | 'zh-CN';
  targetWindowStart: string;
  targetWindowEnd: string;
};

export type GoalProfile = {
  schemaVersion: 1;
  primaryGoal: 'LAUNCH_MOMENTUM';
  supportingSignal: 'MARKET_LEARNING';
  measurementNotes: string;
};

export type ActivationUnit = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  identityId: DomainId;
  productId: DomainId;
  marketId: DomainId;
  channelAccountId: DomainId;
  accountMandateId: DomainId;
  platform: Platform;
  plannedAction: 'PREPARE';
};

export type ActivationPlan = {
  schemaVersion: 1;
  summary: string;
  units: [ActivationUnit, ActivationUnit, ActivationUnit, ActivationUnit];
};

export type FieldConstraint = {
  maxLength?: number;
  maxItems?: number;
  required: boolean;
};

export type CapabilitySnapshot = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  channelAccountId: DomainId;
  platform: Platform;
  capturedAt: string;
  expiresAt: string;
  source: 'M1_PUBLIC_SAFE_FIXTURE';
  executionMode: 'PREPARE_ONLY' | 'DIRECT_PLANNED_NOT_CONNECTED' | 'NATIVE_HANDOFF_PLANNED';
  constraints: Record<string, FieldConstraint>;
  disclaimer: string;
};

export type XArtifact = {kind: 'X'; posts: string[]; altText: string};
export type BlueskyArtifact = {kind: 'BLUESKY'; posts: string[]; embedUrl: string; altText: string};
export type LinkedInArtifact = {kind: 'LINKEDIN'; commentary: string; authorKind: 'PERSON' | 'COMPANY'; linkTitle: string; linkUrl: string};
export type XiaohongshuArtifact = {kind: 'XIAOHONGSHU'; title: string; body: string; topics: string[]; coverLabel: string};
export type PlatformArtifact = XArtifact | BlueskyArtifact | LinkedInArtifact | XiaohongshuArtifact;

export type ArtifactRevision = {
  id: DomainId;
  organizationId: DomainId;
  campaignId: DomainId;
  activationUnitId: DomainId;
  schemaVersion: 1;
  revision: number;
  platform: Platform;
  capabilitySnapshotId: DomainId;
  claimIds: DomainId[];
  content: PlatformArtifact;
  createdAt: string;
};

export type MissionRoleId =
  | 'presence-mission-leader'
  | 'evidence-claim-steward'
  | 'campaign-planner'
  | 'founder-identity-producer'
  | 'product-account-producer'
  | 'independent-auditor';

export type MissionContract = {
  schemaVersion: 1;
  sourceDigest: string;
  executionMode: 'SHADOW_PREP_ONLY';
  live: false;
  roleIds: [MissionRoleId, MissionRoleId, MissionRoleId, MissionRoleId, MissionRoleId, MissionRoleId];
  artifactPlatforms: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'];
  externalActionAllowed: false;
};

export type CampaignDocument = {
  schemaVersion: 1;
  id: DomainId;
  organizationId: DomainId;
  dataMode: 'DEMO_SEED';
  live: false;
  graph: OrganizationGraph;
  brief: CampaignBrief;
  goalProfile: GoalProfile;
  evidenceRefs: EvidenceRef[];
  claims: Claim[];
  activationPlan: ActivationPlan;
  capabilitySnapshots: CapabilitySnapshot[];
  artifactRevisions: ArtifactRevision[];
  missionContract: MissionContract;
};

export type CampaignEnvelope = {
  document: CampaignDocument;
  version: number;
  digest: string;
  etag: string;
  readiness: 'SAVED' | 'BLOCKED' | 'NEEDS_OWNER';
  gapCodes: string[];
  createdAt: string;
  updatedAt: string;
  mode: 'DEMO_SEED';
  live: false;
};

export function mandateMatchesUnit(mandate: AccountMandate, unit: ActivationUnit): boolean {
  return mandate.organizationId === unit.organizationId
    && mandate.channelAccountId === unit.channelAccountId
    && mandate.identityId === unit.identityId
    && mandate.productId === unit.productId
    && mandate.marketId === unit.marketId;
}
