import { sha256Digest } from "./canonical.js";
import type { MissionRoleId } from "./campaign-types.js";
import {
  GOAL_ROLE_IDS,
  stableContractId,
  type ContentPlanRevision,
  type MissionBundle,
  type MissionExecutionBundle,
  type MissionTaskTemplate,
} from "./goal-plan.js";
import type {
  ArtifactAuditDecision,
  ArtifactRevisionV3,
} from "./artifact-publish.js";
import { runtimeOutputSchema } from "./runtime-output-schemas.js";

export const PERSISTENT_RUNTIME_SCHEMA_VERSION = 1 as const;
export const AGENTTEAMS_RUNTIME_VERSION = "v1.2.0" as const;
export const AGENTTEAMS_SOURCE_COMMIT =
  "793db242257a569d911b1aa59c1cd554af78511f" as const;
export const AGENTTEAMS_SOURCE_TAR_SHA256 =
  "a4a9d66fabc49e1d08246d9b8b65d2b67742b71b2b43d3dfc0d27e8861f0770c" as const;
export const AGENTTEAMS_LICENSE = "Apache-2.0" as const;
export const AGENTTEAMS_TEAM_PROFILE_ID =
  "lumiclaw-presence-six-role-v2" as const;
export const AGENTTEAMS_TEAM_PROFILE_VERSION = "2.0.0" as const;
export const AGENTTEAMS_TEAM_PROFILE_DIGEST =
  "7e010640242fe141568239facad73be5a3e2f40314b50bcd1d871818df741ef2" as const;
export const AGENTTEAMS_IMAGE_DIGESTS = Object.freeze({
  controller:
    "sha256:c0de550018e51b36138a5990b1e8095eacc9d44cc7cbdb36a697785ba02c9be4",
  manager:
    "sha256:29429e47118f859191fa133f8d617434019c0f03221b405474be7e467bad87b4",
  worker:
    "sha256:dcdd9103535cfac247267e0f69661820c801396d58e2c8e0c14eefd40b63b7bc",
});

export const RUNTIME_RUN_STATES = [
  "QUEUED",
  "DISPATCHING",
  "RUNNING",
  "HUMAN_GATE",
  "BLOCKED",
  "RECOVERING",
  "SUCCEEDED_RUNTIME",
  "FAILED_RUNTIME",
  "CANCELLED",
] as const;
export const RUNTIME_JOB_STATES = [
  "WAITING_DEPENDENCY",
  "QUEUED",
  "LEASED",
  "DISPATCHED",
  "ACKNOWLEDGED",
  "SUBMITTED",
  "ACCEPTED",
  "QUARANTINED",
  "BLOCKED",
  "CANCELLED",
] as const;
export const RUNTIME_ATTEMPT_STATES = [
  "LEASED",
  "DISPATCHED",
  "ACKNOWLEDGED",
  "SUBMITTED",
  "ACCEPTED",
  "QUARANTINED",
  "LEASE_LOST",
  "UNKNOWN",
  "FAILED",
] as const;
export const RUNTIME_READINESS_STATES = [
  "NOT_CONFIGURED",
  "STARTING",
  "READY",
  "DEGRADED",
  "INCOMPATIBLE",
  "UNREACHABLE",
  "RECOVERING",
  "BLOCKED",
] as const;
export const RUNTIME_STABLE_CODES = [
  "RUNTIME_NOT_CONFIGURED",
  "RUNTIME_VERSION_INCOMPATIBLE",
  "RUNTIME_UNREACHABLE",
  "JOB_LEASE_LOST",
  "RUNTIME_TASK_UNKNOWN",
  "TASK_ACK_TIMEOUT",
  "TASK_SUBMIT_TIMEOUT",
  "MODEL_PROVIDER_FAILED",
  "MODEL_TICKET_REPLAYED",
  "SUBMISSION_SCHEMA_INVALID",
  "SUBMISSION_INPUT_MISMATCH",
  "RUN_VERSION_CONFLICT",
  "DUPLICATE_SUBMISSION",
  "RECOVERY_REVIEW_REQUIRED",
] as const;

export type MissionRunState = (typeof RUNTIME_RUN_STATES)[number];
export type MissionJobState = (typeof RUNTIME_JOB_STATES)[number];
export type AgentTaskAttemptState = (typeof RUNTIME_ATTEMPT_STATES)[number];
export type RuntimeReadinessState = (typeof RUNTIME_READINESS_STATES)[number];
export type RuntimeStableCode = (typeof RUNTIME_STABLE_CODES)[number];

export type RuntimeRequirement = {
  runtime: "agentteams";
  version: typeof AGENTTEAMS_RUNTIME_VERSION;
  sourceCommit: typeof AGENTTEAMS_SOURCE_COMMIT;
  sourceTarSha256: typeof AGENTTEAMS_SOURCE_TAR_SHA256;
  license: typeof AGENTTEAMS_LICENSE;
  imageDigests: typeof AGENTTEAMS_IMAGE_DIGESTS;
  teamProfileVersion: string;
  teamProfileDigest: string;
};

export type RuntimeTaskContract = {
  schemaVersion: 1;
  runId: string;
  bundleId: string;
  bundleDigest: string;
  generation: number;
  taskId: string;
  roleId: MissionRoleId;
  kind: MissionTaskTemplate["kind"];
  mandate: string;
  dependencyIds: string[];
  inputDigest: string;
  skillLockDigest: string;
  outputSchema: string;
  substantive: boolean;
  externalActionAllowed: false;
};

export type MissionRun = {
  schemaVersion: 1;
  id: string;
  ownerId: string;
  bundleId: string;
  bundleDigest: string;
  bundleKind: MissionBundle["kind"];
  generation: number;
  runtimeRequirement: RuntimeRequirement;
  state: MissionRunState;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastReconciledAt: string | null;
  errorCode: RuntimeStableCode | null;
  rowVersion: number;
};

export type MissionJob = {
  schemaVersion: 1;
  id: string;
  runId: string;
  taskContractId: string;
  generation: number;
  roleId: MissionRoleId;
  kind: MissionTaskTemplate["kind"];
  dependencyIds: string[];
  state: MissionJobState;
  availableAt: string;
  leaseOwner: string | null;
  leaseTokenHash: string | null;
  leaseExpiresAt: string | null;
  attemptCount: number;
  acceptedAttemptId: string | null;
  acceptedOutputRef: string | null;
  acceptedOutputDigest: string | null;
  runtimeTaskId: string | null;
  lastErrorCode: RuntimeStableCode | null;
  rowVersion: number;
  contract: RuntimeTaskContract;
};

export type AgentTaskAttempt = {
  schemaVersion: 1;
  id: string;
  jobId: string;
  attemptNumber: number;
  roleId: MissionRoleId;
  runtimeTaskId: string | null;
  runtimeActorId: string | null;
  inputDigest: string;
  skillLockDigest: string;
  schemaRef: string;
  state: AgentTaskAttemptState;
  ackAt: string | null;
  submittedAt: string | null;
  outputDigest: string | null;
  errorCode: RuntimeStableCode | null;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeBinding = {
  schemaVersion: 1;
  runId: string;
  runtimeInstanceId: string;
  runtimeProjectId: string;
  teamProfileVersion: string;
  teamProfileDigest: string;
  runtimeVersion: typeof AGENTTEAMS_RUNTIME_VERSION;
  runtimeDigest: string;
  memberBindings: Array<{ roleId: MissionRoleId; runtimeActorId: string }>;
  state: "BOUND" | "UNKNOWN" | "INCOMPATIBLE";
  boundAt: string;
  lastObservedAt: string;
};

export type RuntimeEvent = {
  schemaVersion: 1;
  id: string;
  sequence: number;
  runId: string;
  jobId: string | null;
  attemptId: string | null;
  type: string;
  stableCode: RuntimeStableCode | null;
  publicPayload: Record<string, unknown>;
  privateEvidenceRef: string | null;
  occurredAt: string;
};

export type RuntimeSubmissionEnvelope = {
  schemaVersion: 1;
  runId: string;
  bundleId: string;
  bundleDigest: string;
  generation: number;
  taskId: string;
  attemptId: string;
  attemptNumber: number;
  roleId: MissionRoleId;
  runtimeTaskId: string;
  runtimeActorId: string;
  inputDigest: string;
  skillLockDigest: string;
  outputSchema: string;
  payload: unknown;
  outputDigest: string;
  submittedAt: string;
  evidenceMaturity: "AGENTTEAMS_RUNTIME";
  agentTeamsExecuted: true;
  controlledProvider: boolean;
};

export type RuntimeTeamProjection = {
  code: "RUNTIME_TEAM_PROJECTION";
  readiness: RuntimeReadinessState;
  reasonCode: RuntimeStableCode | null;
  metricSource: "POSTGRESQL_RUNTIME_OBSERVATION";
  runtimeVersion: string;
  runtimeDigest: string;
  teamProfileVersion: string;
  teamProfileDigest: string;
  bundleDigest: string | null;
  runId: string | null;
  lastHeartbeat: string | null;
  agents: Array<{
    roleId: MissionRoleId;
    runtimeActorId: string | null;
    status: "NOT_CONFIGURED" | "IDLE" | "RUNNING" | "ERROR";
    attemptId: string | null;
    taskId: string | null;
    acceptedTaskCount: number;
  }>;
  jobs: MissionJob[];
  attempts: AgentTaskAttempt[];
  events: RuntimeEvent[];
  boundary: {
    runtimeSucceededMeans: "TASK_CONTRACT_OUTPUTS_ACCEPTED";
    auditPass: false;
    ownerApproved: false;
    published: false;
    businessSuccess: false;
  };
};

export type RuntimeWorkspace = {
  runs: MissionRun[];
  jobs: MissionJob[];
  attempts: AgentTaskAttempt[];
  bindings: RuntimeBinding[];
  events: RuntimeEvent[];
  readiness: RuntimeReadinessState;
};

export type RuntimeLease = {
  run: MissionRun;
  job: MissionJob;
  attempt: AgentTaskAttempt;
  leaseToken: string;
};

export type RuntimeMaterializationCandidate =
  | {
      kind: "PROTOCOL";
      authorityId: string;
      canonicalDigest: string;
      payload: Record<string, unknown>;
    }
  | {
      kind: "CONTENT_PLAN";
      authorityId: string;
      canonicalDigest: string;
      expectedHeadDigest: string | null;
      payload: ContentPlanRevision;
    }
  | {
      kind: "ARTIFACT_REVISION";
      authorityId: string;
      canonicalDigest: string;
      expectedHeadDigest: string | null;
      payload: ArtifactRevisionV3;
    }
  | {
      kind: "ARTIFACT_AUDIT";
      authorityId: string;
      canonicalDigest: string;
      expectedRevisionDigest: string;
      payload: ArtifactAuditDecision;
    };
export type RuntimeMaterializationBatch = {
  schemaVersion: 1;
  id: string;
  ownerId: string;
  runId: string;
  jobId: string;
  attemptId: string;
  outputDigest: string;
  acceptedOutputRef: string;
  batchDigest: string;
  candidates: RuntimeMaterializationCandidate[];
  envelope: RuntimeSubmissionEnvelope;
  state: "STAGED" | "COMMITTED";
  createdAt: string;
  committedAt: string | null;
};

export type ModelGatewayTicketClaims = {
  schemaVersion: 1;
  ownerId: string;
  runId: string;
  jobId: string;
  taskId: string;
  attemptId: string;
  attemptNumber: number;
  runtimeTaskId: string;
  runtimeActorId: string;
  workerIdDigest: string;
  leaseTokenDigest: string;
  phase: "ORCHESTRATE" | "CLAIM" | "PLAN" | "PRODUCE" | "AUDIT";
  model: "deepseek-v4-flash" | "deepseek-v4-pro";
  policyDigest: string;
  inputDigest: string;
  requestDigest: string;
  outputSchema: string;
  expiresAt: string;
  nonce: string;
};
export type RuntimeGatewayGenerateRequest = {
  ownerId: string;
  runId: string;
  jobId: string;
  taskId: string;
  attemptId: string;
  attemptNumber: number;
  runtimeTaskId: string;
  runtimeActorId: string;
  workerIdDigest: string;
  leaseTokenDigest: string;
  phase: ModelGatewayTicketClaims["phase"];
  model: ModelGatewayTicketClaims["model"];
  policyDigest: string;
  inputDigest: string;
  outputSchemaRef: string;
  system: string;
  input: unknown;
  outputSchema: Record<string, unknown>;
};
export type RuntimeWorkerHeartbeat = {
  schemaVersion: 1;
  service: "mission-worker";
  workerIdDigest: string;
  observedAt: string;
  expiresAt: string;
  agentTeams: {
    state: "READY" | "INCOMPATIBLE" | "UNREACHABLE";
    runtimeVersion: string;
    runtimeDigest: string;
    sourceCommit: string;
    sourceTarSha256: string;
    teamProfileVersion: string;
    teamProfileDigest: string;
    memberCount: number;
    reasonCode: string | null;
    identityEvidence: null | {
      verified: boolean;
      mismatches: string[];
      expected: { sourceCommit: string; sourceTarSha256: string };
      actual: { images: unknown[] };
    };
  };
};
export type RuntimeReadinessComponents = {
  controlPlane: boolean;
  gateway: {
    state: RuntimeReadinessState;
    configured: boolean;
    controlledFake: boolean;
    fingerprint: string | null;
    updatedAt: string | null;
  };
  workerHeartbeat: RuntimeWorkerHeartbeat | null;
  pinnedIdentity: boolean;
};
export type ModelGatewayTicketUseOutcome =
  "USED" | "REPLAYED" | "EXPIRED" | "REJECTED";
export interface ModelGatewayTicketRepository {
  health(): Promise<boolean>;
  issue(
    claims: ModelGatewayTicketClaims,
    ticketDigest: string,
    now: Date,
  ): Promise<void>;
  consume(
    claims: ModelGatewayTicketClaims,
    ticketDigest: string,
    now: Date,
  ): Promise<ModelGatewayTicketUseOutcome>;
  close(): Promise<void>;
}

export interface PersistentRuntimeRepository {
  health(): Promise<boolean>;
  createRun(
    ownerId: string,
    bundle: MissionBundle,
    createdBy: string,
    idempotencyKey: string,
    now: Date,
  ): Promise<{ run: MissionRun; jobs: MissionJob[]; replayed: boolean }>;
  getRun(ownerId: string, runId: string): Promise<MissionRun | undefined>;
  getWorkspace(ownerId: string): Promise<RuntimeWorkspace>;
  getProjection(
    ownerId: string,
    runId?: string,
  ): Promise<RuntimeTeamProjection>;
  recordWorkerHeartbeat(heartbeat: RuntimeWorkerHeartbeat): Promise<void>;
  getWorkerHeartbeat(now: Date): Promise<RuntimeWorkerHeartbeat | null>;
  acquireJob(
    workerId: string,
    leaseMs: number,
    now: Date,
  ): Promise<RuntimeLease | undefined>;
  heartbeatLease(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    leaseMs: number,
    now: Date,
  ): Promise<MissionJob>;
  bindRuntime(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    binding: RuntimeBinding,
    runtimeTaskId: string,
    now: Date,
  ): Promise<void>;
  recordAck(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    runtimeTaskId: string,
    runtimeActorId: string,
    at: Date,
  ): Promise<void>;
  recordSubmissionIntent(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    envelope: RuntimeSubmissionEnvelope,
    now: Date,
  ): Promise<void>;
  acquireSubmissionRecovery(
    workerId: string,
    leaseMs: number,
    now: Date,
  ): Promise<{ lease: RuntimeLease; envelope: RuntimeSubmissionEnvelope | null } | undefined>;
  stageMaterialization(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    envelope: RuntimeSubmissionEnvelope,
    acceptedOutputRef: string,
    candidates: RuntimeMaterializationCandidate[],
    now: Date,
  ): Promise<RuntimeMaterializationBatch>;
  acquireStagedMaterialization(
    workerId: string,
    leaseMs: number,
    now: Date,
  ): Promise<
    { lease: RuntimeLease; batch: RuntimeMaterializationBatch } | undefined
  >;
  finalizeMaterialization(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    batchId: string,
    now: Date,
  ): Promise<{ accepted: boolean; duplicate: boolean; run: MissionRun }>;
  acquirePendingCompletion(
    workerId: string,
    leaseMs: number,
    now: Date,
  ): Promise<{ lease: RuntimeLease; batch: RuntimeMaterializationBatch } | undefined>;
  confirmRuntimeCompletion(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    batchId: string,
    now: Date,
  ): Promise<void>;
  quarantineSubmission(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    envelope: RuntimeSubmissionEnvelope,
    code: RuntimeStableCode,
    now: Date,
  ): Promise<void>;
  markAttemptUnknown(
    workerId: string,
    jobId: string,
    attemptId: string,
    leaseToken: string,
    code: RuntimeStableCode,
    now: Date,
  ): Promise<void>;
  reconcileRun(
    ownerId: string,
    runId: string,
    observation: {
      knownRuntimeTaskIds: string[];
      acceptedOutputDigests: string[];
      runtimeReachable: boolean;
    },
    now: Date,
  ): Promise<MissionRun>;
  cancelRun(
    ownerId: string,
    runId: string,
    expectedRowVersion: number,
    idempotencyKey: string,
    now: Date,
  ): Promise<{ run: MissionRun; replayed: boolean }>;
  retryBlocked(
    ownerId: string,
    runId: string,
    expectedRowVersion: number,
    idempotencyKey: string,
    now: Date,
  ): Promise<{ run: MissionRun; replayed: boolean }>;
  close(): Promise<void>;
}

export class PersistentRuntimeError extends Error {
  public constructor(
    public readonly code: RuntimeStableCode,
    message: string = code,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "PersistentRuntimeError";
  }
}

export function pinnedRuntimeRequirement(
  bundle: MissionBundle,
): RuntimeRequirement {
  return {
    runtime: "agentteams",
    version: AGENTTEAMS_RUNTIME_VERSION,
    sourceCommit: AGENTTEAMS_SOURCE_COMMIT,
    sourceTarSha256: AGENTTEAMS_SOURCE_TAR_SHA256,
    license: AGENTTEAMS_LICENSE,
    imageDigests: AGENTTEAMS_IMAGE_DIGESTS,
    teamProfileVersion: bundle.inputBindings.teamProfile.version,
    teamProfileDigest: bundle.inputBindings.teamProfile.digest,
  };
}

export function runtimeGatewayPhase(
  kind: MissionTaskTemplate["kind"],
): ModelGatewayTicketClaims["phase"] {
  return kind === "ORCHESTRATE"
    ? "ORCHESTRATE"
    : kind === "FREEZE_CLAIMS"
      ? "CLAIM"
      : kind === "PLAN_CONTENT"
        ? "PLAN"
        : kind === "PRODUCE_CONTENT"
          ? "PRODUCE"
          : "AUDIT";
}

export function runtimeGatewayInputProjection(
  bundle: MissionBundle,
  contract: RuntimeTaskContract,
): Record<string, unknown> {
  const task = bundle.tasks.find((item) => item.taskId === contract.taskId);
  const context = bundle.roleContexts.find(
    (item) => item.roleId === contract.roleId,
  );
  const skillLocks = resolveTaskSkillLocks(bundle, contract.skillLockDigest);
  if (
    task === undefined ||
    context === undefined ||
    skillLocks === undefined ||
    bundle.bundleId !== contract.bundleId ||
    bundle.canonicalDigest !== contract.bundleDigest ||
    bundle.generation !== contract.generation ||
    task.roleId !== contract.roleId ||
    task.kind !== contract.kind ||
    task.inputDigest !== contract.inputDigest ||
    task.skillLockDigest !== contract.skillLockDigest ||
    task.outputSchema !== contract.outputSchema ||
    sha256Digest(task.dependsOn) !== sha256Digest(contract.dependencyIds)
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "GATEWAY_TASK_PROJECTION_MISMATCH",
    );
  const assigned =
    bundle.kind === "MISSION_EXECUTION"
      ? bundle.activationUnits
          .filter((unit) => unit.producerRole === contract.roleId)
          .map((unit) => ({
            activationUnitId: unit.activationUnitId,
            slotId: unit.slotId,
            platformCode: unit.platformCode,
            accountProfileRevisionId: unit.accountProfileRevisionId,
            producerRole: unit.producerRole,
            contentObjective: unit.contentObjective,
            sourceItemIds: [...unit.sourceItemIds],
            claimConstraints: [...unit.claimConstraints],
          }))
      : [];
  return {
    schemaVersion: 1,
    bundle: {
      bundleId: bundle.bundleId,
      bundleDigest: bundle.canonicalDigest,
      kind: bundle.kind,
      generation: bundle.generation,
      parentBundleId: bundle.parentBundleId,
      parentBundleDigest: bundle.parentBundleDigest,
    },
    task: {
      schemaVersion: contract.schemaVersion,
      taskId: contract.taskId,
      roleId: contract.roleId,
      kind: contract.kind,
      mandate: contract.mandate,
      dependencyIds: [...contract.dependencyIds],
      inputDigest: contract.inputDigest,
      skillLockDigest: contract.skillLockDigest,
      outputSchema: contract.outputSchema,
      substantive: contract.substantive,
      externalActionAllowed: false,
    },
    roleContext: context,
    skillLocks,
    authorityBindings: bundle.inputBindings,
    assignedActivationUnits: assigned,
  };
}

export function runtimeGatewayPolicy(
  contract: RuntimeTaskContract,
  phase: ModelGatewayTicketClaims["phase"],
  model: ModelGatewayTicketClaims["model"],
): { system: string; outputSchema: Record<string, unknown>; digest: string } {
  if (runtimeGatewayPhase(contract.kind) !== phase)
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "GATEWAY_PHASE_MISMATCH",
    );
  const registered = runtimeOutputSchema(contract);
  const system = `LumiClaw governed TaskContract executor. Role=${contract.roleId}; phase=${phase}; mandate=${contract.mandate} Return only one JSON value for schema ${contract.outputSchema}. Never perform external actions, reveal secrets, change authority objects, or claim Owner approval, publication, or business success.`;
  const outputSchema = registered.schema;
  return {
    system,
    outputSchema,
    digest: runtimeGatewayPolicyDigest({
      phase,
      model,
      system,
      outputSchemaRef: contract.outputSchema,
      outputSchema,
    }),
  };
}

export function runtimeGatewayPolicyDigest(input: {
  phase: ModelGatewayTicketClaims["phase"];
  model: ModelGatewayTicketClaims["model"];
  system: string;
  outputSchemaRef: string;
  outputSchema: Record<string, unknown>;
}): string {
  return sha256Digest({ schemaVersion: 1, ...input });
}

export function runtimeGatewayRequestDigest(
  request: RuntimeGatewayGenerateRequest,
): string {
  return sha256Digest({ schemaVersion: 1, ...request });
}
export function runtimeLeaseTokenDigest(token: string): string {
  return sha256Digest({ schemaVersion: 1, kind: "RUNTIME_LEASE_TOKEN", token });
}

export function missionRunEtag(
  run: Pick<MissionRun, "id" | "rowVersion">,
): string {
  return `\"runtime-run-${run.id}-v${run.rowVersion}\"`;
}
export function parseMissionRunEtag(
  value: string | undefined,
  runId: string,
): number {
  const match = value?.match(
    new RegExp(`^\"runtime-run-${escapeRegExp(runId)}-v([1-9][0-9]*)\"$`, "u"),
  );
  if (match?.[1] === undefined)
    throw new PersistentRuntimeError(
      value === undefined ? "SUBMISSION_INPUT_MISMATCH" : "RUN_VERSION_CONFLICT",
      value === undefined ? "ETAG_REQUIRED" : "RUN_VERSION_CONFLICT",
    );
  return Number.parseInt(match[1], 10);
}

export function validatePersistentRuntimeBundle(bundle: MissionBundle): void {
  if (
    bundle.state !== "COMPILED" ||
    bundle.ownerId.length === 0 ||
    bundle.canonicalDigest !== sha256Digest(stripCanonicalDigest(bundle))
  )
    throw new PersistentRuntimeError("SUBMISSION_INPUT_MISMATCH");
  if (
    bundle.inputBindings.teamProfile.id !== AGENTTEAMS_TEAM_PROFILE_ID ||
    bundle.inputBindings.teamProfile.version !==
      AGENTTEAMS_TEAM_PROFILE_VERSION ||
    bundle.inputBindings.teamProfile.digest !==
      AGENTTEAMS_TEAM_PROFILE_DIGEST ||
    bundle.inputBindings.teamProfile.runtimeCompatibility !==
      "agentteams-v1.2.0"
  )
    throw new PersistentRuntimeError(
      "RUNTIME_VERSION_INCOMPATIBLE",
      "PINNED_TEAM_PROFILE_REQUIRED",
    );
  const roleIds = bundle.roles.map((role) => role.roleId);
  if (
    roleIds.length !== 6 ||
    new Set(roleIds).size !== 6 ||
    GOAL_ROLE_IDS.some((role) => !roleIds.includes(role))
  )
    throw new PersistentRuntimeError(
      "RUNTIME_VERSION_INCOMPATIBLE",
      "EXACTLY_SIX_ROLES_REQUIRED",
    );
  const leader = bundle.roles.find(
    (role) => role.roleId === "presence-mission-leader",
  );
  if (leader?.orchestrationOnly !== true)
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "LEADER_MUST_BE_ORCHESTRATION_ONLY",
    );
  if (
    bundle.tasks.some(
      (task) =>
        task.roleId === "presence-mission-leader" &&
        (task.kind !== "ORCHESTRATE" || task.substantive),
    )
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "LEADER_DOMAIN_OUTPUT_FORBIDDEN",
    );
  if (
    !bundle.roles.some((role) => role.roleId === "founder-identity-producer") ||
    !bundle.roles.some((role) => role.roleId === "product-account-producer") ||
    !bundle.roles.some((role) => role.roleId === "independent-auditor")
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "PRODUCER_AUDITOR_SEPARATION_REQUIRED",
    );
  const tasks = new Set(bundle.tasks.map((task) => task.taskId));
  if (
    tasks.size !== bundle.tasks.length ||
    bundle.tasks.some(
      (task) =>
        !task.dependsOn.every((dependency) => tasks.has(dependency)) ||
        task.dependsOn.includes(task.taskId),
    )
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "TASK_DAG_INVALID",
    );
  if (
    bundle.tasks.some(
      (task) =>
        resolveTaskSkillLocks(bundle, task.skillLockDigest) === undefined,
    )
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "SKILL_LOCK_MISMATCH",
    );
  assertAcyclic(bundle.tasks);
  if (bundle.kind === "MISSION_EXECUTION") validateExecutionBoundaries(bundle);
}

export function createRuntimeRunGraph(
  bundle: MissionBundle,
  createdBy: string,
  now: Date,
): { run: MissionRun; jobs: MissionJob[] } {
  validatePersistentRuntimeBundle(bundle);
  const runId = stableContractId("mission-run", {
    ownerId: bundle.ownerId,
    bundleId: bundle.bundleId,
    bundleDigest: bundle.canonicalDigest,
    generation: bundle.generation,
  });
  const run: MissionRun = {
    schemaVersion: 1,
    id: runId,
    ownerId: bundle.ownerId,
    bundleId: bundle.bundleId,
    bundleDigest: bundle.canonicalDigest,
    bundleKind: bundle.kind,
    generation: bundle.generation,
    runtimeRequirement: pinnedRuntimeRequirement(bundle),
    state: "QUEUED",
    createdBy,
    createdAt: now.toISOString(),
    startedAt: null,
    finishedAt: null,
    lastReconciledAt: null,
    errorCode: null,
    rowVersion: 1,
  };
  const executableTasks =
    bundle.kind === "MISSION_INTENT"
      ? bundle.tasks.filter((task) =>
          ["ORCHESTRATE", "FREEZE_CLAIMS", "PLAN_CONTENT"].includes(task.kind),
        )
      : bundle.tasks;
  const jobs = executableTasks.map((task): MissionJob => {
    const contract: RuntimeTaskContract = {
      schemaVersion: 1,
      runId,
      bundleId: bundle.bundleId,
      bundleDigest: bundle.canonicalDigest,
      generation: bundle.generation,
      taskId: task.taskId,
      roleId: task.roleId,
      kind: task.kind,
      mandate: task.mandate,
      dependencyIds: [...task.dependsOn],
      inputDigest: task.inputDigest,
      skillLockDigest: task.skillLockDigest,
      outputSchema: task.outputSchema,
      substantive: task.substantive,
      externalActionAllowed: false,
    };
    return {
      schemaVersion: 1,
      id: stableContractId("mission-job", {
        runId,
        taskId: task.taskId,
        generation: bundle.generation,
      }),
      runId,
      taskContractId: task.taskId,
      generation: bundle.generation,
      roleId: task.roleId,
      kind: task.kind,
      dependencyIds: [...task.dependsOn],
      state: task.dependsOn.length === 0 ? "QUEUED" : "WAITING_DEPENDENCY",
      availableAt: now.toISOString(),
      leaseOwner: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      attemptCount: 0,
      acceptedAttemptId: null,
      acceptedOutputRef: null,
      acceptedOutputDigest: null,
      runtimeTaskId: null,
      lastErrorCode: null,
      rowVersion: 1,
      contract,
    };
  });
  return { run, jobs };
}

export function validateRuntimeSubmission(
  contract: RuntimeTaskContract,
  attempt: AgentTaskAttempt,
  envelope: RuntimeSubmissionEnvelope,
  binding: RuntimeBinding,
): void {
  if (
    envelope.schemaVersion !== 1 ||
    envelope.evidenceMaturity !== "AGENTTEAMS_RUNTIME" ||
    envelope.agentTeamsExecuted !== true ||
    !validDateTime(envelope.submittedAt)
  )
    throw new PersistentRuntimeError("SUBMISSION_SCHEMA_INVALID");
  if (
    envelope.runId !== contract.runId ||
    envelope.bundleId !== contract.bundleId ||
    envelope.bundleDigest !== contract.bundleDigest ||
    envelope.generation !== contract.generation ||
    envelope.taskId !== contract.taskId ||
    envelope.attemptId !== attempt.id ||
    envelope.attemptNumber !== attempt.attemptNumber ||
    envelope.roleId !== contract.roleId ||
    envelope.inputDigest !== contract.inputDigest ||
    envelope.skillLockDigest !== contract.skillLockDigest ||
    envelope.outputSchema !== contract.outputSchema ||
    envelope.runtimeTaskId !== attempt.runtimeTaskId
  )
    throw new PersistentRuntimeError("SUBMISSION_INPUT_MISMATCH");
  const actor = binding.memberBindings.find(
    (member) => member.roleId === contract.roleId,
  )?.runtimeActorId;
  if (
    binding.runId !== contract.runId ||
    binding.state !== "BOUND" ||
    actor === undefined ||
    actor !== envelope.runtimeActorId
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "RUNTIME_ACTOR_BINDING_MISMATCH",
    );
  if (
    attempt.runtimeActorId === null ||
    attempt.runtimeActorId !== envelope.runtimeActorId
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "ACK_SUBMIT_ACTOR_MISMATCH",
    );
  if (contract.roleId === "presence-mission-leader" && contract.substantive)
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "LEADER_DOMAIN_OUTPUT_FORBIDDEN",
    );
  if (envelope.outputDigest !== sha256Digest(envelope.payload))
    throw new PersistentRuntimeError(
      "SUBMISSION_SCHEMA_INVALID",
      "OUTPUT_DIGEST_MISMATCH",
    );
}

export function publicRuntimeEventPayload(
  value: unknown,
): Record<string, unknown> {
  const sanitized = redactRuntimeValue(value);
  return isRecord(sanitized) ? sanitized : { value: sanitized };
}

export function redactRuntimeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactRuntimeValue);
  if (!isRecord(value))
    return typeof value === "string" && looksSecret(value)
      ? "[REDACTED]"
      : value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value))
    result[key] = secretKey(key) ? "[REDACTED]" : redactRuntimeValue(item);
  return result;
}

export function runtimeBoundary() {
  return {
    runtimeSucceededMeans: "TASK_CONTRACT_OUTPUTS_ACCEPTED" as const,
    auditPass: false as const,
    ownerApproved: false as const,
    published: false as const,
    businessSuccess: false as const,
  };
}

function validateExecutionBoundaries(bundle: MissionExecutionBundle): void {
  const producers = new Set(
    bundle.activationUnits.map((unit) => unit.producerRole),
  );
  if (
    !producers.has("founder-identity-producer") ||
    !producers.has("product-account-producer")
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "BOTH_PRODUCERS_REQUIRED",
    );
  if (
    bundle.tasks
      .filter((task) => task.kind === "AUDIT_CONTENT")
      .some((task) => task.roleId !== "independent-auditor")
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "AUDITOR_ROLE_MISMATCH",
    );
  if (
    bundle.tasks
      .filter((task) => task.kind === "PRODUCE_CONTENT")
      .some(
        (task) =>
          !["founder-identity-producer", "product-account-producer"].includes(
            task.roleId,
          ),
      )
  )
    throw new PersistentRuntimeError(
      "SUBMISSION_INPUT_MISMATCH",
      "PRODUCER_ROLE_MISMATCH",
    );
}

function assertAcyclic(tasks: MissionTaskTemplate[]): void {
  const dependencies = new Map(
    tasks.map((task) => [task.taskId, task.dependsOn]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new PersistentRuntimeError(
        "SUBMISSION_INPUT_MISMATCH",
        "TASK_DAG_CYCLE",
      );
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of tasks) visit(task.taskId);
}

function resolveTaskSkillLocks(
  bundle: MissionBundle,
  digest: string,
): MissionBundle["skillLocks"] | undefined {
  const locks = bundle.skillLocks;
  if (
    locks.length === 0 ||
    locks.length > 12 ||
    new Set(locks.map((lock) => lock.skillId)).size !== locks.length ||
    locks.some(
      (lock) =>
        lock.skillId.length === 0 ||
        lock.version.length === 0 ||
        !/^[a-f0-9]{64}$/u.test(lock.digest) ||
        !/^skills\/.+\/SKILL\.md$/u.test(lock.source),
    )
  )
    return undefined;
  const matches: MissionBundle["skillLocks"][] = [];
  for (let mask = 1; mask < 1 << locks.length; mask += 1) {
    const selected = locks.filter(
      (_lock, index) => (mask & (1 << index)) !== 0,
    );
    if (sha256Digest(selected) === digest) matches.push(selected);
    if (matches.length > 1) return undefined;
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function stripCanonicalDigest<T extends MissionBundle>(
  bundle: T,
): Omit<T, "canonicalDigest"> {
  const { canonicalDigest, ...rest } = bundle;
  void canonicalDigest;
  return rest;
}
function validDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && /T/u.test(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function secretKey(key: string): boolean {
  return (
    /(?:api.?key|authorization|cookie|password|secret|token|ticket|credential|bootstrap)/iu.test(
      key,
    ) && !/(?:digest|fingerprint|configured|expiresAt|updatedAt)/u.test(key)
  );
}
function looksSecret(value: string): boolean {
  return /(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+\S{12,}|x-lumiclaw-runtime-ticket)/u.test(
    value,
  );
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
