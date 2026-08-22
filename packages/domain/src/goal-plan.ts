import {sha256Digest} from './canonical.js';
import type {AccountOperatingProfileInput, KnowledgePlatform, KnowledgeRoleContext} from './knowledge-onboarding.js';
import type {MissionRoleId} from './campaign-types.js';

export const GOAL_HORIZONS = [7, 30] as const;
export const GOAL_CADENCES = ['DAILY', 'WEEKDAYS', 'THREE_PER_WEEK'] as const;
export const GOAL_SUCCESS_SIGNAL_CODES = ['PUBLISHING_CADENCE', 'VOICE_CONSISTENCY', 'OWNER_ACCEPTANCE_RATE', 'MARKET_LEARNING_NOTES'] as const;
export const GOAL_ROLE_IDS = [
  'presence-mission-leader',
  'evidence-claim-steward',
  'campaign-planner',
  'founder-identity-producer',
  'product-account-producer',
  'independent-auditor'
] as const satisfies readonly MissionRoleId[];

export type GoalHorizonDays = typeof GOAL_HORIZONS[number];
export type GoalCadence = typeof GOAL_CADENCES[number];
export type GoalState = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SUPERSEDED';
export type PlanState = 'DRAFT' | 'NEEDS_OWNER' | 'APPROVED' | 'INVALIDATED';
export type MissionBundleState = 'COMPILED' | 'INVALIDATED' | 'BLOCKED';
export type ProducerRoleId = 'founder-identity-producer' | 'product-account-producer';
export type GoalSuccessSignalCode = typeof GOAL_SUCCESS_SIGNAL_CODES[number];

export type GoalSuccessSignal = {code: GoalSuccessSignalCode; observation: string};

export type AccountProfileBinding = {
  accountProfileRevisionId: string;
  revision: number;
  digest: string;
  platformCode: KnowledgePlatform;
  handleOrDisplayName: string;
  producerMandates: AccountOperatingProfileInput['producerMandates'];
  targetMarket: string;
  contentLocale: string;
};

export type OperatingGoalInput = {
  objective: string;
  horizonDays: GoalHorizonDays;
  startsAt: string;
  endsAt: string;
  cadence: GoalCadence;
  selectedAccountIds: string[];
  targetMarket: string;
  contentLocale: string;
  timeZone: string;
  successSignals: GoalSuccessSignal[];
  knowledgeSnapshotId: string;
  knowledgeSnapshotDigest: string;
};

export type OperatingGoalRevision = OperatingGoalInput & {
  schemaVersion: 2;
  ownerId: string;
  goalId: string;
  revision: number;
  state: GoalState;
  parentDigest: string | null;
  canonicalDigest: string;
  createdAt: string;
};

export type ContentPlanSlot = {
  slotId: string;
  localDate: string;
  localTime: string | null;
  platformCode: KnowledgePlatform;
  accountProfileRevisionId: string;
  producerRole: ProducerRoleId;
  theme: string;
  contentObjective: string;
  claimConstraints: string[];
  sourceItemIds: string[];
  status: 'PLANNED';
};

export type ContentBrief = {
  briefId: string;
  slotId: string;
  platformCode: KnowledgePlatform;
  accountProfileRevisionId: string;
  producerRole: ProducerRoleId;
  theme: string;
  contentObjective: string;
  sourceItemIds: string[];
  claimConstraints: string[];
};

export type PlanSourceBinding = {
  snapshotId: string;
  snapshotDigest: string;
  sourceItemIds: string[];
  claimConstraints: string[];
};

export type ContentPlanRevision = {
  schemaVersion: 2;
  ownerId: string;
  planId: string;
  revision: number;
  goalId: string;
  goalRevision: number;
  goalRevisionDigest: string;
  missionIntentId: string;
  intentBundleId: string;
  intentBundleDigest: string;
  state: PlanState;
  slots: ContentPlanSlot[];
  currentBrief: ContentBrief;
  sourceBindings: PlanSourceBinding[];
  plannerSubmissionDigest: string;
  parentDigest: string | null;
  approvedInputDigest: string | null;
  canonicalDigest: string;
  createdAt: string;
};

export type PlannerSubmission = {
  schemaVersion: 2;
  roleId: 'campaign-planner';
  missionIntentId: string;
  intentBundleId: string;
  intentBundleDigest: string;
  taskId: string;
  inputDigest: string;
  outputSchema: 'lumiclaw.content-plan.v2';
  outputSchemaDigest: string;
  skillLockDigest: string;
  slots: ContentPlanSlot[];
  currentBrief: ContentBrief;
  sourceBindings: PlanSourceBinding[];
  evidenceMaturity: 'CONTROLLED_FIXTURE' | 'AGENTTEAMS_RUNTIME';
};

export type MissionSkillLock = {skillId: string; version: string; digest: string; source: string};
export type MissionRole = {
  roleId: MissionRoleId;
  orchestrationOnly: boolean;
  responsibility: string;
  permissions: string[];
  prohibited: string[];
};

export type RoleContextView = {
  roleId: MissionRoleId;
  contextDigest: string;
  knowledgeItemIds: string[];
  accountProfileRevisionIds: string[];
  visibleBindings: string[];
  excluded: string[];
};

export type MissionTaskTemplate = {
  taskId: string;
  kind: 'ORCHESTRATE' | 'FREEZE_CLAIMS' | 'PLAN_CONTENT' | 'PRODUCE_CONTENT' | 'AUDIT_CONTENT';
  roleId: MissionRoleId;
  platformCode: KnowledgePlatform | null;
  accountProfileRevisionIds: string[];
  mandate: string;
  dependsOn: string[];
  inputDigest: string;
  outputSchema: string;
  skillLockDigest: string;
  substantive: boolean;
};

export type MissionInputBindings = {
  knowledgeSnapshot: {id: string; digest: string; state: 'APPROVED'};
  operatingGoal: {id: string; revision: number; digest: string; state: 'ACTIVE'};
  accountProfiles: AccountProfileBinding[];
  compiler: {version: string; digest: string};
  teamProfile: {id: string; version: string; digest: string; runtimeCompatibility: string};
  plannerOutputSchema: {id: 'lumiclaw.content-plan.v2'; digest: string};
};

export type MissionIntentBundle = {
  schemaVersion: 2;
  kind: 'MISSION_INTENT';
  missionIntentId: string;
  ownerId: string;
  bundleId: string;
  generation: number;
  parentBundleId: string | null;
  parentBundleDigest: string | null;
  state: MissionBundleState;
  canonicalDigest: string;
  compilerVersion: string;
  inputBindings: MissionInputBindings;
  roles: MissionRole[];
  roleContexts: RoleContextView[];
  skillLocks: MissionSkillLock[];
  tasks: MissionTaskTemplate[];
  selectedPlatforms: KnowledgePlatform[];
  selectedAccountProfileRevisionIds: string[];
  plannerRequirements: {
    horizonDays: GoalHorizonDays;
    expectedSlotDates: string[];
    requiredProducerRoles: ProducerRoleId[];
    outputSchema: 'lumiclaw.content-plan.v2';
    outputSchemaDigest: string;
  };
  humanGates: string[];
  auditRequirements: string[];
  invalidationRules: string[];
  evidenceContract: {agentTeamsExecuted: false; fixtureAllowed: true; externalActionAllowed: false};
};

export type MissionActivationUnit = {
  activationUnitId: string;
  slotId: string;
  localDate: string;
  localTime: string | null;
  platformCode: KnowledgePlatform;
  accountProfileRevisionId: string;
  producerRole: ProducerRoleId;
  contentObjective: string;
  sourceItemIds: string[];
  claimConstraints: string[];
};

export type MissionExecutionBundle = {
  schemaVersion: 2;
  kind: 'MISSION_EXECUTION';
  missionIntentId: string;
  ownerId: string;
  bundleId: string;
  generation: number;
  parentBundleId: string;
  parentBundleDigest: string;
  approvedPlanId: string;
  approvedPlanRevision: number;
  approvedPlanDigest: string;
  state: MissionBundleState;
  canonicalDigest: string;
  compilerVersion: string;
  inputBindings: MissionInputBindings & {approvedPlan: {id: string; revision: number; digest: string}};
  roles: MissionRole[];
  roleContexts: RoleContextView[];
  skillLocks: MissionSkillLock[];
  selectedPlatforms: KnowledgePlatform[];
  activationUnits: MissionActivationUnit[];
  currentBrief: ContentBrief;
  tasks: MissionTaskTemplate[];
  dependencyDag: Array<{from: string; to: string}>;
  expectedArtifactSchemas: Array<{platformCode: KnowledgePlatform; schemaRef: string; contractStatus: 'SDD_010_REQUIRED'}>;
  trace: Array<{code: string; inputDigest: string; outputDigest: string; detail: string}>;
  evidenceContract: {agentTeamsExecuted: false; fixtureAllowed: true; externalActionAllowed: false};
};

export type MissionBundle = MissionIntentBundle | MissionExecutionBundle;

export type InvalidationEvent = {
  eventId: string;
  ownerId: string;
  bundleId: string;
  reasonCode: 'KNOWLEDGE_SNAPSHOT_CHANGED' | 'GOAL_REVISION_CHANGED' | 'PLAN_REVISION_CHANGED' | 'ACCOUNT_PROFILE_CHANGED' | 'MISSION_INPUT_CHANGED';
  previousDigest: string;
  currentDigest: string;
  recoveryAction: 'REVIEW_AND_COMPILE_NEW_GENERATION';
  createdAt: string;
};

export type BundleInvalidationRequest =
  | {reasonCode: 'GOAL_REVISION_CHANGED'; currentDigest: string; goalId: string}
  | {reasonCode: 'PLAN_REVISION_CHANGED'; currentDigest: string; planId: string; missionIntentId: string}
  | {reasonCode: 'KNOWLEDGE_SNAPSHOT_CHANGED'; currentDigest: string; supersededSnapshotId: string; supersededSnapshotDigest: string}
  | {reasonCode: 'ACCOUNT_PROFILE_CHANGED'; currentDigest: string; supersededAccountProfileRevisionIds: string[]}
  | {reasonCode: 'MISSION_INPUT_CHANGED'; currentDigest: string; missionIntentId: string};

export type GoalWorkspace = {
  goals: OperatingGoalRevision[];
  plans: ContentPlanRevision[];
  bundles: MissionBundle[];
  bundleStates: Array<{bundleId: string; state: MissionBundleState; reasonCode: InvalidationEvent['reasonCode'] | null; recoveryAction: InvalidationEvent['recoveryAction'] | null}>;
  invalidations: InvalidationEvent[];
};

export type GoalKnowledgeGuard = {
  rowVersion: number;
  snapshotId: string;
  snapshotDigest: string;
  accountProfileDigests: Array<{revisionId: string; digest: string}>;
};

export interface GoalPlanRepository {
  health(): Promise<boolean>;
  getWorkspace(ownerId: string): Promise<GoalWorkspace>;
  getGoal(ownerId: string, goalId: string): Promise<OperatingGoalRevision | undefined>;
  getPlan(ownerId: string, planId: string): Promise<ContentPlanRevision | undefined>;
  getBundle(ownerId: string, bundleId: string): Promise<MissionBundle | undefined>;
  appendGoal(ownerId: string, goal: OperatingGoalRevision, bindings: AccountProfileBinding[], expectedHeadDigest: string | null, guard: GoalKnowledgeGuard, idempotencyKey: string, now: Date): Promise<{goal: OperatingGoalRevision; replayed: boolean}>;
  appendBundle(ownerId: string, bundle: MissionBundle, expectedGoalDigest: string, idempotencyKey: string, now: Date): Promise<{bundle: MissionBundle; replayed: boolean}>;
  appendPlan(ownerId: string, plan: ContentPlanRevision, expectedHeadDigest: string | null, idempotencyKey: string, now: Date): Promise<{plan: ContentPlanRevision; replayed: boolean}>;
  approvePlanAndAppendBundle(ownerId: string, expectedPlanDigest: string, approvedPlan: ContentPlanRevision, bundle: MissionExecutionBundle, idempotencyKey: string, now: Date): Promise<{plan: ContentPlanRevision; bundle: MissionExecutionBundle; replayed: boolean}>;
  invalidateBundles(ownerId: string, request: BundleInvalidationRequest, now: Date): Promise<InvalidationEvent[]>;
  close(): Promise<void>;
}

export class GoalPlanContractError extends Error {
  public constructor(public readonly code: string, message = code, public readonly details?: unknown) {
    super(message);
    this.name = 'GoalPlanContractError';
  }
}

export function createOperatingGoalRevision(input: {
  ownerId: string;
  goalId: string;
  revision: number;
  state: GoalState;
  parentDigest: string | null;
  value: unknown;
  createdAt: string;
}): OperatingGoalRevision {
  const value = validateOperatingGoalInput(input.value);
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new GoalPlanContractError('GOAL_REVISION_INVALID');
  if (input.revision === 1 && input.parentDigest !== null) throw new GoalPlanContractError('GOAL_PARENT_DIGEST_INVALID');
  if (input.revision > 1 && !isDigest(input.parentDigest)) throw new GoalPlanContractError('GOAL_PARENT_DIGEST_INVALID');
  const base = {schemaVersion: 2 as const, ownerId: input.ownerId, goalId: input.goalId, revision: input.revision, state: input.state, parentDigest: input.parentDigest, ...value, createdAt: input.createdAt};
  return {...base, canonicalDigest: sha256Digest(goalCanonicalPayload(base))};
}

export function validateOperatingGoalInput(value: unknown): OperatingGoalInput {
  assertExactObject(value, ['objective','horizonDays','startsAt','endsAt','cadence','selectedAccountIds','targetMarket','contentLocale','timeZone','successSignals','knowledgeSnapshotId','knowledgeSnapshotDigest'], 'GOAL_SCHEMA_INVALID');
  if (!GOAL_HORIZONS.includes(value.horizonDays as GoalHorizonDays)) throw new GoalPlanContractError('GOAL_HORIZON_INVALID');
  if (!GOAL_CADENCES.includes(value.cadence as GoalCadence)) throw new GoalPlanContractError('GOAL_CADENCE_INVALID');
  const startsAt = validateLocalDate(value.startsAt, 'GOAL_TIME_WINDOW_INVALID');
  const endsAt = validateLocalDate(value.endsAt, 'GOAL_TIME_WINDOW_INVALID');
  const expectedEnd = addDays(startsAt, Number(value.horizonDays) - 1);
  if (endsAt !== expectedEnd) throw new GoalPlanContractError('GOAL_TIME_WINDOW_INVALID');
  const selectedAccountIds = uniqueStrings(value.selectedAccountIds, 1, 2, 'ACCOUNT_NOT_SELECTED');
  const successSignals = successSignalList(value.successSignals);
  return {
    objective: text(value.objective, 2000, 'GOAL_OBJECTIVE_INVALID'),
    horizonDays: value.horizonDays as GoalHorizonDays,
    startsAt,
    endsAt,
    cadence: value.cadence as GoalCadence,
    selectedAccountIds,
    targetMarket: market(value.targetMarket),
    contentLocale: locale(value.contentLocale),
    timeZone: ianaTimeZone(value.timeZone),
    successSignals,
    knowledgeSnapshotId: text(value.knowledgeSnapshotId, 160, 'KNOWLEDGE_SNAPSHOT_STALE'),
    knowledgeSnapshotDigest: digest(value.knowledgeSnapshotDigest, 'KNOWLEDGE_SNAPSHOT_STALE')
  };
}

export function goalCanonicalPayload(goal: Omit<OperatingGoalRevision, 'canonicalDigest'>): unknown {
  return {
    schemaVersion: goal.schemaVersion, ownerId: goal.ownerId, goalId: goal.goalId, revision: goal.revision,
    state: goal.state, parentDigest: goal.parentDigest, objective: goal.objective, horizonDays: goal.horizonDays,
    startsAt: goal.startsAt, endsAt: goal.endsAt, cadence: goal.cadence,
    selectedAccountIds: [...goal.selectedAccountIds], targetMarket: goal.targetMarket,
    contentLocale: goal.contentLocale, timeZone: goal.timeZone, successSignals: goal.successSignals,
    knowledgeSnapshotId: goal.knowledgeSnapshotId, knowledgeSnapshotDigest: goal.knowledgeSnapshotDigest
  };
}

export function goalEtag(goal: OperatingGoalRevision): string { return `\"goal-${goal.goalId}-r${goal.revision}-${goal.canonicalDigest}\"`; }
export function planEtag(plan: ContentPlanRevision): string { return `\"plan-${plan.planId}-r${plan.revision}-${plan.canonicalDigest}\"`; }

export function expectedPlanDates(goal: Pick<OperatingGoalRevision, 'startsAt' | 'horizonDays' | 'cadence'>): string[] {
  const dates = Array.from({length: goal.horizonDays}, (_, index) => addDays(goal.startsAt, index));
  if (goal.cadence === 'DAILY') return dates;
  if (goal.cadence === 'WEEKDAYS') return dates.filter((date) => { const day = new Date(`${date}T00:00:00.000Z`).getUTCDay(); return day >= 1 && day <= 5; });
  return dates.filter((_date, index) => index % 7 === 0 || index % 7 === 2 || index % 7 === 4);
}

export function validateAccountBindings(goal: OperatingGoalRevision, profiles: readonly AccountProfileBinding[]): AccountProfileBinding[] {
  if (goal.selectedAccountIds.length !== profiles.length) throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');
  const selected = new Set(goal.selectedAccountIds);
  const seen = new Set<string>();
  for (const profile of profiles) {
    if (!selected.has(profile.accountProfileRevisionId)) throw new GoalPlanContractError('ACCOUNT_NOT_SELECTED');
    if (seen.has(profile.accountProfileRevisionId)) throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');
    seen.add(profile.accountProfileRevisionId);
    if (!['X','XIAOHONGSHU'].includes(profile.platformCode)) throw new GoalPlanContractError('PLATFORM_NOT_SUPPORTED');
    if (!isDigest(profile.digest)) throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');
  }
  const mandates = new Set(profiles.flatMap((profile) => profile.producerMandates));
  if (!mandates.has('FOUNDER_VOICE') || !mandates.has('PRODUCT_EXPERTISE')) throw new GoalPlanContractError('PRODUCER_COVERAGE_REQUIRED');
  return [...profiles].sort((left, right) => left.platformCode.localeCompare(right.platformCode) || left.accountProfileRevisionId.localeCompare(right.accountProfileRevisionId));
}

export function accountBindingsFromKnowledge(goal: OperatingGoalRevision, context: KnowledgeRoleContext, accountProfiles: Array<{id: string; revision: number; digest: string; payload: AccountOperatingProfileInput}>, options: {requireProducerCoverage?: boolean} = {}): AccountProfileBinding[] {
  if (context.snapshotId !== goal.knowledgeSnapshotId || context.snapshotDigest !== goal.knowledgeSnapshotDigest) throw new GoalPlanContractError('KNOWLEDGE_SNAPSHOT_STALE');
  const approvedProfiles = new Map(context.profileDigests.map((item) => [item.revisionId, item.digest]));
  const bindings = accountProfiles.filter((profile) => goal.selectedAccountIds.includes(profile.id)).map((profile) => {
    if (approvedProfiles.get(profile.id) !== profile.digest) throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');
    return {accountProfileRevisionId: profile.id, revision: profile.revision, digest: profile.digest, platformCode: profile.payload.platformCode, handleOrDisplayName: profile.payload.handleOrDisplayName, producerMandates: profile.payload.producerMandates, targetMarket: profile.payload.targetMarket, contentLocale: profile.payload.contentLocale};
  });
  if (options.requireProducerCoverage === false) {
    if (goal.selectedAccountIds.length !== bindings.length) throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');
    return bindings.sort((left,right)=>left.platformCode.localeCompare(right.platformCode)||left.accountProfileRevisionId.localeCompare(right.accountProfileRevisionId));
  }
  return validateAccountBindings(goal, bindings);
}

export function contentPlanCanonicalPayload(plan: Omit<ContentPlanRevision, 'canonicalDigest'>): unknown {
  return {
    schemaVersion: plan.schemaVersion, ownerId: plan.ownerId, planId: plan.planId, revision: plan.revision,
    goalId: plan.goalId, goalRevision: plan.goalRevision, goalRevisionDigest: plan.goalRevisionDigest,
    missionIntentId: plan.missionIntentId, intentBundleId: plan.intentBundleId, intentBundleDigest: plan.intentBundleDigest,
    state: plan.state, slots: plan.slots, currentBrief: plan.currentBrief, sourceBindings: plan.sourceBindings,
    plannerSubmissionDigest: plan.plannerSubmissionDigest, parentDigest: plan.parentDigest, approvedInputDigest: plan.approvedInputDigest
  };
}

export function canonicalBundleDigest(bundle: Omit<MissionBundle, 'canonicalDigest'>): string { return sha256Digest(bundle); }

export function stableContractId(prefix: string, value: unknown): string { return `${prefix}_${sha256Digest(value).slice(0, 24)}`; }

function successSignalList(value: unknown): GoalSuccessSignal[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > GOAL_SUCCESS_SIGNAL_CODES.length) throw new GoalPlanContractError('GOAL_SUCCESS_SIGNALS_INVALID');
  const result: GoalSuccessSignal[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    assertExactObject(item, ['code','observation'], 'GOAL_SUCCESS_SIGNALS_INVALID');
    if (!GOAL_SUCCESS_SIGNAL_CODES.includes(item.code as GoalSuccessSignalCode) || seen.has(String(item.code))) throw new GoalPlanContractError('GOAL_SUCCESS_SIGNALS_INVALID');
    seen.add(String(item.code));
    const observation = text(item.observation, 500, 'GOAL_SUCCESS_SIGNALS_INVALID');
    if (/(?:revenue|income|lead volume|follower growth|guarantee|营收|收入|线索量|粉丝增长|保证)/iu.test(observation)) throw new GoalPlanContractError('SUCCESS_SIGNAL_BUSINESS_OUTCOME_FORBIDDEN');
    result.push({code: item.code as GoalSuccessSignalCode, observation});
  }
  return result;
}

function assertExactObject(value: unknown, keys: readonly string[], code: string): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) throw new GoalPlanContractError(code);
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, max: number, code: string): string { if (typeof value !== 'string') throw new GoalPlanContractError(code); const normalized = value.normalize('NFC').trim(); if (normalized.length < 1 || normalized.length > max) throw new GoalPlanContractError(code); return normalized; }
function uniqueStrings(value: unknown, min: number, max: number, code: string): string[] { if (!Array.isArray(value) || value.length < min || value.length > max || value.some((item) => typeof item !== 'string' || item.length < 1) || new Set(value).size !== value.length) throw new GoalPlanContractError(code); return [...value] as string[]; }
export function validateLocalDate(value: unknown, code = 'LOCAL_DATE_INVALID'): string {
  const date = text(value, 10, code);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new GoalPlanContractError(code);
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (
    instant.getUTCFullYear() !== year
    || instant.getUTCMonth() !== month - 1
    || instant.getUTCDate() !== day
    || instant.toISOString().slice(0, 10) !== date
  ) throw new GoalPlanContractError(code);
  return date;
}
function addDays(date: string, days: number): string { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function market(value: unknown): string { const result = text(value, 2, 'TARGET_MARKET_INVALID'); if (!/^[A-Z]{2}$/u.test(result)) throw new GoalPlanContractError('TARGET_MARKET_INVALID'); return result; }
function locale(value: unknown): string { const result = text(value, 16, 'CONTENT_LOCALE_INVALID'); if (!/^[a-z]{2}(?:-[A-Z]{2})?$/u.test(result)) throw new GoalPlanContractError('CONTENT_LOCALE_INVALID'); return result; }
function ianaTimeZone(value: unknown): string { const result = text(value, 80, 'TIME_ZONE_INVALID'); try { new Intl.DateTimeFormat('en-US', {timeZone: result}).format(new Date()); } catch { throw new GoalPlanContractError('TIME_ZONE_INVALID'); } return result; }
function isDigest(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value); }
function digest(value: unknown, code: string): string { if (!isDigest(value)) throw new GoalPlanContractError(code); return value; }
