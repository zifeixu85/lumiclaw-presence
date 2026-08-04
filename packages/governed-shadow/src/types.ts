import type {CampaignDocument, MissionRoleId, Platform, PlatformArtifact} from '@lumiclaw/domain';

export type ShadowMissionState =
  | 'QUEUED' | 'RUNNING' | 'WAITING_DEPENDENCY' | 'NEEDS_OWNER_REVIEW'
  | 'FAILED' | 'TIMED_OUT' | 'CANCELLED' | 'UNKNOWN_RECOVERY'
  | 'AUDIT_BLOCKED' | 'REVISION_REQUIRED' | 'SHADOW_COMPLETE';
export type AgentTaskState = 'ASSIGNED' | 'ACKNOWLEDGED' | 'RUNNING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'WAITING_DEPENDENCY' | 'TIMED_OUT' | 'CANCELLED' | 'UNKNOWN';
export type MissionPermission = 'ORCHESTRATE' | 'READ_EVIDENCE' | 'PLAN' | 'PRODUCE_FOUNDER' | 'PRODUCE_PRODUCT' | 'AUDIT';
export type AllowedTool = 'TASK_READ' | 'TASK_ACK' | 'TASK_SUBMIT' | 'EVIDENCE_READ' | 'MODEL_GENERATE' | 'REVISION_READ' | 'AUDIT_SUBMIT' | 'TRACE_APPEND';

export type SkillLock = {
  id: string;
  name: 'evidence-and-claim-grounding' | 'campaign-strategy' | 'account-native-expression' | 'independent-action-audit' | 'trace-safe-escalation';
  version: '1.0.0';
  digest: string;
  source: `skills/${string}/SKILL.md`;
};

export type RoleContext = {
  schemaVersion: 1;
  missionId: string;
  roleId: MissionRoleId;
  identityId: string;
  responsibility: string;
  permissions: MissionPermission[];
  allowedTools: AllowedTool[];
  visibleData: ('MISSION' | 'FROZEN_EVIDENCE' | 'PLAN' | 'FOUNDER_UNITS' | 'PRODUCT_UNITS' | 'REVISIONS' | 'AUDIT_BINDINGS')[];
  prohibitedOutputs: string[];
  orchestrationOnly: boolean;
  skillLockIds: string[];
  contextDigest: string;
};

export type RuntimeMemberBinding = {
  roleId: MissionRoleId;
  roleIdentityId: string;
  runtimeActorId: string;
};

export type RuntimeProjectDispatchReceipt = {
  schemaVersion: 1;
  projectId: string;
  runtimeVersion: 'v1.2.0';
  buildDigest: string;
  memberBindings: RuntimeMemberBinding[];
  memberSetDigest: string;
  dagDigest: string;
  dispatchedAt: string;
  receiptDigest: string;
};

export type RuntimeTaskAckReceipt = {
  schemaVersion: 1;
  projectId: string;
  taskId: string;
  roleId: MissionRoleId;
  runtimeActorId: string;
  attempt: number;
  inputProjectionSchema: string;
  inputProjectionDigest: string;
  runtimeState: 'in_progress';
  acknowledgedAt: string;
  receiptDigest: string;
};

export type RuntimeTaskSubmissionReceipt = {
  schemaVersion: 1;
  projectId: string;
  taskId: string;
  roleId: MissionRoleId;
  runtimeActorId: string;
  attempt: number;
  ackReceiptDigest: string;
  inputProjectionSchema: string;
  inputProjectionDigest: string;
  runtimeState: 'submitted';
  submittedAt: string;
  resultDigest: string;
  resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY';
  runtimeObservationId: string;
  receiptDigest: string;
};

export type TaskContract = {
  schemaVersion: 1;
  id: string;
  missionId: string;
  roleId: MissionRoleId;
  roleIdentityId: string;
  kind: 'PROJECT_COORDINATION' | 'FREEZE_EVIDENCE' | 'PLAN_CAMPAIGN' | 'PRODUCE_FOUNDER' | 'PRODUCE_PRODUCT' | 'AUDIT_REVISIONS' | 'PRODUCE_FOUNDER_CORRECTION' | 'REAUDIT_CORRECTION';
  inputDigest: string;
  inputProjectionSchema: string;
  inputProjectionDigest: string | null;
  inputProjectionKeys: string[];
  prerequisiteTaskIds: string[];
  skillLockDigest: string;
  outputSchema: string;
  outputSchemaVersion: 1;
  timeoutMs: number;
  allowedTools: AllowedTool[];
  state: AgentTaskState;
  attempt: number;
  ackedAt: string | null;
  runtimeAck: RuntimeTaskAckReceipt | null;
  submittedAt: string | null;
  runtimeSubmission: RuntimeTaskSubmissionReceipt | null;
  acceptedOutputDigest: string | null;
  acceptedPayload?: unknown;
};

export type GovernedArtifactRevision = {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  campaignId: string;
  missionId: string;
  activationUnitId: string;
  producerRoleId: 'founder-identity-producer' | 'product-account-producer';
  producerIdentityId: string;
  platform: Platform;
  revision: number;
  parentRevisionId: string | null;
  sourceCampaignDigest: string;
  claimBindingDigest: string;
  capabilityBindingDigest: string;
  content: PlatformArtifact;
  digest: string;
  createdAt: string;
  immutable: true;
};

export type AuditIssue = {
  code: 'CLAIM_OVERREACH' | 'CAPABILITY_CONSTRAINT' | 'EVIDENCE_MISSING' | 'ROLE_PERMISSION' | 'DIGEST_MISMATCH';
  severity: 'BLOCKING' | 'ESCALATE';
  path: string;
  message: string;
  evidenceRefIds: string[];
  nextResponsibleRoleId: MissionRoleId;
};

export type AuditDecision = {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  campaignId: string;
  missionId: string;
  revisionId: string;
  revisionDigest: string;
  auditorRoleId: 'independent-auditor';
  auditorIdentityId: string;
  outcome: 'PASS' | 'FAIL' | 'ESCALATE';
  issues: AuditIssue[];
  bindings: {claimEvidenceDigest: string; mandateDigest: string; capabilityDigest: string; policyVersion: 'm2-shadow-policy@1.0.0'};
  status: 'ACTIVE' | 'INVALIDATED';
  invalidatedByRevisionId: string | null;
  supersedesAuditId: string | null;
  createdAt: string;
  digest: string;
};

export type OwnerReview = {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  campaignId: string;
  missionId: string;
  revisionId: string;
  revisionDigest: string;
  channelAccountId: string;
  actionIntent: 'PREPARE_ONLY';
  decision: 'READY_FOR_FUTURE_EXECUTION' | 'CHANGES_REQUESTED';
  authority: 'NON_EXECUTABLE_OWNER_REVIEW';
  createsActionGrant: false;
  externalActionAllowed: false;
  createdAt: string;
};

export type ModelCallSnapshot = {
  schemaVersion: 1;
  id: string;
  missionId: string;
  taskId: string;
  provider: 'DEEPSEEK' | 'PUBLIC_SAFE_MOCK';
  maturity: 'MOCK_CONFORMANCE' | 'CANARY';
  model: string;
  response: {id: string | null; actualModel: string | null; systemFingerprint: string | null; finishReason: string | null};
  config: {temperature: number; maxTokens: number; responseFormat: 'json_object'; timeoutMs: number; maxAttempts: number};
  pricing: {source: 'DEEPSEEK_OFFICIAL_2026-08-04'; inputCacheHitUsdPerMillion: number; inputCacheMissUsdPerMillion: number; outputUsdPerMillion: number; peakMultiplierNotApplied: true};
  inputDigest: string;
  outputDigest: string | null;
  tokenUsage: {input: number; output: number; cacheHit: number; cacheMiss: number; reasoning: number} | null;
  estimatedCostUsd: number | null;
  latencyMs: number;
  attempts: number;
  error: {code: string; retryable: boolean} | null;
  secretPresent: false;
  createdAt: string;
};

export type MediaAsset = {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  missionId: string;
  contentDigest: string;
  mimeType: 'image/svg+xml';
  bytes: number;
  provider: 'PUBLIC_SAFE_MOCK' | 'EVOLINK_CANARY';
  maturity: 'MOCK_CONFORMANCE' | 'CANARY';
  rights: {basis: 'SYNTHETIC_GENERATED'; commercialUseReviewed: false; ownerApprovalRequired: true};
  costReceipt: {currency: 'USD'; amount: number; estimated: boolean};
  approvalState: 'UNREVIEWED';
  createdAt: string;
};

export type MissionTraceEvent = {
  schemaVersion: 1;
  id: string;
  missionId: string;
  sequence: number;
  kind: 'MISSION' | 'PROJECT' | 'TASK' | 'ACK' | 'SUBMIT' | 'QUARANTINE' | 'MODEL' | 'MEDIA' | 'REVISION' | 'AUDIT' | 'OWNER_REVIEW' | 'RECOVERY' | 'CANCEL';
  businessLabel: string;
  detail: Record<string, string | number | boolean | null>;
  safe: true;
  createdAt: string;
};

export type LedgerEntry = {
  schemaVersion: 1;
  id: string;
  missionId: string;
  sequence: number;
  action: string;
  actorRoleId: MissionRoleId | 'OWNER' | 'CONTROL_PLANE';
  inputDigest: string;
  outputDigest: string;
  previousEntryDigest: string | null;
  entryDigest: string;
  createdAt: string;
};

export type ShadowMission = {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  campaignId: string;
  sourceCampaignVersion: number;
  sourceCampaignDigest: string;
  runtime: 'agentteams';
  runtimeVersion: 'v1.2.0';
  runtimeProjectId: string;
  runtimeProjectDispatch: RuntimeProjectDispatchReceipt | null;
  executionMode: 'SHADOW_PREP_ONLY';
  dataMode: 'DEMO_SEED';
  live: false;
  externalActionAllowed: false;
  actionGrantCount: 0;
  connectorCount: 0;
  externalActionCount: 0;
  state: ShadowMissionState;
  version: number;
  etag: string;
  createdAt: string;
  updatedAt: string;
  roleContexts: [RoleContext, RoleContext, RoleContext, RoleContext, RoleContext, RoleContext];
  skillLocks: [SkillLock, SkillLock, SkillLock, SkillLock, SkillLock];
  tasks: TaskContract[];
  revisions: GovernedArtifactRevision[];
  audits: AuditDecision[];
  reviews: OwnerReview[];
  modelCalls: ModelCallSnapshot[];
  mediaAssets: MediaAsset[];
  trace: MissionTraceEvent[];
  ledger: LedgerEntry[];
  recovery: {status: 'NOT_REQUIRED' | 'RECONCILED' | 'UNKNOWN'; recoveredAt: string | null; duplicateSubmissionsRejected: number};
  fault: {kind: 'BETA_TO_GA'; frozenClaimStatement: string; injectedPath: string; deniedRevisionId: string | null; correctedRevisionId: string | null};
};

export type StartShadowMissionInput = {campaign: CampaignDocument; campaignVersion: number; campaignDigest: string; now: Date};

export type RuntimeSubmission = {
  schemaVersion: 1;
  missionId: string;
  taskId: string;
  roleId: MissionRoleId;
  roleIdentityId: string;
  inputDigest: string;
  inputProjectionSchema: string;
  inputProjectionDigest: string;
  skillLockDigest: string;
  outputSchema: string;
  outputSchemaVersion: 1;
  payload: unknown;
  outputDigest: string;
  runtimeResultMaturity: 'MOCK_CONFORMANCE' | 'CANARY';
  runtimeReceipt: RuntimeTaskSubmissionReceipt;
};

export interface ShadowMissionRepository {
  health(): Promise<boolean>;
  create(input: StartShadowMissionInput, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}>;
  get(organizationId: string, missionId: string): Promise<ShadowMission | undefined>;
  getByCampaign(organizationId: string, campaignId: string): Promise<ShadowMission[]>;
  replace(mission: ShadowMission, expectedEtag: string): Promise<ShadowMission>;
  getIdempotentReplay(organizationId: string, route: string, idempotencyKey: string, requestDigest: string): Promise<ShadowMission | undefined>;
  replaceIdempotent(mission: ShadowMission, expectedEtag: string, route: string, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}>;
  close(): Promise<void>;
}
