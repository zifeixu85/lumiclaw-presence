import {
  GOAL_ROLE_IDS,
  GoalPlanContractError,
  canonicalBundleDigest,
  contentPlanCanonicalPayload,
  expectedPlanDates,
  sha256Digest,
  stableContractId,
  validateAccountBindings,
  type AccountProfileBinding,
  type CampaignDocument,
  type ContentBrief,
  type ContentPlanRevision,
  type ContentPlanSlot,
  type MissionExecutionBundle,
  type MissionInputBindings,
  type MissionIntentBundle,
  type MissionRole,
  type MissionRoleId,
  type MissionSkillLock,
  type MissionTaskTemplate,
  type OperatingGoalRevision,
  type PlannerSubmission,
  type PlanSourceBinding,
  type ProducerRoleId,
  type RoleContextView,
  type KnowledgeRoleContext
} from '@lumiclaw/domain';
import {digestCampaign, validateCampaignDocument} from '@lumiclaw/domain';

export const SELECTED_PLATFORM_COMPILER_VERSION = '2.0.0-sdd009';
export const CONTENT_PLAN_SCHEMA_ID = 'lumiclaw.content-plan.v2' as const;
export const CONTENT_PLAN_SCHEMA_DIGEST = sha256Digest({
  id: CONTENT_PLAN_SCHEMA_ID,
  version: 2,
  closed: true,
  required: ['roleId','missionIntentId','intentBundleDigest','taskId','inputDigest','outputSchema','outputSchemaDigest','skillLockDigest','slots','currentBrief','sourceBindings']
});

const COMPILER_DIGEST = sha256Digest({version: SELECTED_PLATFORM_COMPILER_VERSION, selectedPlatforms: ['X','XIAOHONGSHU'], topology: GOAL_ROLE_IDS});
const TEAM_PROFILE = {id: 'lumiclaw-presence-six-role-v2', version: '2.0.0', runtimeCompatibility: 'agentteams-v1.2.0'} as const;

const SKILL_LOCKS: MissionSkillLock[] = [
  {skillId: 'trace-safe-escalation', version: '1.0.0', digest: '2231d266f0805abb1ea459333147b4c5ff94e082e1b72e558f87128ef77f458d', source: 'skills/trace-safe-escalation/SKILL.md'},
  {skillId: 'evidence-and-claim-grounding', version: '1.0.0', digest: '8ffe3b79cb0f47122c4cf49a9d5823d1260049d471055d29b11af9369e2dfc03', source: 'skills/evidence-and-claim-grounding/SKILL.md'},
  {skillId: 'campaign-strategy', version: '1.0.0', digest: 'f36e36065a2db1c5ec53f064a06bf3717c96204c6ab7bfa370a06e5542ca0615', source: 'skills/campaign-strategy/SKILL.md'},
  {skillId: 'account-native-expression', version: '1.0.0', digest: 'e0203cce699775fd00a35b07cd62d078d51c0f65c751d20e69a69cb9d6e623a9', source: 'skills/account-native-expression/SKILL.md'},
  {skillId: 'independent-action-audit', version: '1.0.0', digest: '2fa2e0018d33559c1283b2b53fd3989c226fac00e783e1a0f77113b7c17bf951', source: 'skills/independent-action-audit/SKILL.md'}
];

const ROLE_SKILL_IDS: Record<MissionRoleId, string[]> = {
  'presence-mission-leader': ['trace-safe-escalation'],
  'evidence-claim-steward': ['evidence-and-claim-grounding','trace-safe-escalation'],
  'campaign-planner': ['campaign-strategy','trace-safe-escalation'],
  'founder-identity-producer': ['evidence-and-claim-grounding','account-native-expression','trace-safe-escalation'],
  'product-account-producer': ['evidence-and-claim-grounding','account-native-expression','trace-safe-escalation'],
  'independent-auditor': ['evidence-and-claim-grounding','independent-action-audit','trace-safe-escalation']
};

const ROLE_DEFINITIONS: Record<MissionRoleId, Omit<MissionRole, 'roleId'>> = {
  'presence-mission-leader': {orchestrationOnly: true, responsibility: 'Coordinate task acknowledgements, dependencies and escalation only.', permissions: ['ORCHESTRATE','TRACE_APPEND'], prohibited: ['claim authoring','planning','platform content','audit','approval']},
  'evidence-claim-steward': {orchestrationOnly: false, responsibility: 'Freeze approved claim, evidence and source bindings.', permissions: ['READ_APPROVED_KNOWLEDGE','FREEZE_CLAIMS'], prohibited: ['platform content','audit','approval']},
  'campaign-planner': {orchestrationOnly: false, responsibility: 'Produce the bounded 7/30-day plan and current brief.', permissions: ['READ_GOAL','READ_SELECTED_ACCOUNTS','PLAN'], prohibited: ['platform content','audit','approval']},
  'founder-identity-producer': {orchestrationOnly: false, responsibility: 'Produce assigned selected-account work under the founder mandate.', permissions: ['READ_ASSIGNED_CONTEXT','PRODUCE_FOUNDER'], prohibited: ['other accounts','audit','approval','external action']},
  'product-account-producer': {orchestrationOnly: false, responsibility: 'Produce assigned selected-account work under the product mandate.', permissions: ['READ_ASSIGNED_CONTEXT','PRODUCE_PRODUCT'], prohibited: ['other accounts','audit','approval','external action']},
  'independent-auditor': {orchestrationOnly: false, responsibility: 'Independently audit producer outputs against frozen bindings.', permissions: ['READ_ARTIFACTS','READ_BINDINGS','AUDIT'], prohibited: ['edit content','owner approval','external action']}
};

export type CompileMissionIntentV2Input = {
  goal: OperatingGoalRevision;
  knowledge: KnowledgeRoleContext;
  accountProfiles: AccountProfileBinding[];
  compilerVersion?: string;
};

export function compileMissionIntentV2(input: CompileMissionIntentV2Input): MissionIntentBundle {
  const compilerVersion = input.compilerVersion ?? SELECTED_PLATFORM_COMPILER_VERSION;
  if (compilerVersion !== SELECTED_PLATFORM_COMPILER_VERSION) throw new GoalPlanContractError('COMPILER_VERSION_UNSUPPORTED');
  if (input.goal.state !== 'ACTIVE') throw new GoalPlanContractError('GOAL_NOT_ACTIVE');
  if (input.knowledge.snapshotId !== input.goal.knowledgeSnapshotId || input.knowledge.snapshotDigest !== input.goal.knowledgeSnapshotDigest) throw new GoalPlanContractError('KNOWLEDGE_SNAPSHOT_STALE');
  const accounts = validateAccountBindings(input.goal, input.accountProfiles);
  const approvedProfileDigests = new Map(input.knowledge.profileDigests.map((binding) => [binding.revisionId,binding.digest]));
  if (accounts.some((account) => approvedProfileDigests.get(account.accountProfileRevisionId) !== account.digest)) throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');
  const missionIntentId = stableContractId('mission', {ownerId: input.goal.ownerId, goalId: input.goal.goalId});
  const bundleId = stableContractId('bundle', {missionIntentId, generation: 1, goalDigest: input.goal.canonicalDigest, compilerVersion});
  const roles = roleRoster();
  const skillLocks = clone(SKILL_LOCKS);
  const inputBindings = missionInputBindings(input.goal, accounts, compilerVersion);
  const roleContexts = roleContextViews(missionIntentId, input.goal, input.knowledge, accounts);
  const tasks = intentTasks(missionIntentId, input.goal, accounts, roleContexts);
  const selectedPlatforms = [...new Set(accounts.map((account) => account.platformCode))].sort();
  const base: Omit<MissionIntentBundle, 'canonicalDigest'> = {
    schemaVersion: 2,
    kind: 'MISSION_INTENT',
    missionIntentId,
    ownerId: input.goal.ownerId,
    bundleId,
    generation: 1,
    state: 'COMPILED',
    compilerVersion,
    inputBindings,
    roles,
    roleContexts,
    skillLocks,
    tasks,
    selectedPlatforms,
    selectedAccountProfileRevisionIds: accounts.map((account) => account.accountProfileRevisionId),
    plannerRequirements: {horizonDays: input.goal.horizonDays, expectedSlotDates: expectedPlanDates(input.goal), requiredProducerRoles: ['founder-identity-producer','product-account-producer'], outputSchema: CONTENT_PLAN_SCHEMA_ID, outputSchemaDigest: CONTENT_PLAN_SCHEMA_DIGEST},
    humanGates: ['PLANNER_SUBMISSION_SCHEMA_VALIDATION','OWNER_APPROVES_EXACT_PLAN_DIGEST','SDD_010_ARTIFACT_AUDIT_REQUIRED'],
    auditRequirements: ['PRODUCER_AUDITOR_SEPARATION','SOURCE_AND_CLAIM_BINDINGS','EXACT_INPUT_OUTPUT_DIGESTS'],
    invalidationRules: ['KNOWLEDGE_SNAPSHOT_CHANGED','GOAL_REVISION_CHANGED','PLAN_REVISION_CHANGED','ACCOUNT_PROFILE_CHANGED'],
    evidenceContract: {agentTeamsExecuted: false, fixtureAllowed: true, externalActionAllowed: false}
  };
  return {...base, canonicalDigest: canonicalBundleDigest(base)};
}

export function importPlannerSubmissionV2(intent: MissionIntentBundle, submission: PlannerSubmission, createdAt: string): ContentPlanRevision {
  if (intent.state !== 'COMPILED') throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
  const plannerTask = intent.tasks.find((task) => task.roleId === 'campaign-planner' && task.kind === 'PLAN_CONTENT');
  if (plannerTask === undefined) throw new GoalPlanContractError('PLANNER_TASK_MISSING');
  if (submission.schemaVersion !== 2 || submission.roleId !== 'campaign-planner') throw new GoalPlanContractError('PLANNER_SUBMISSION_ROLE_MISMATCH');
  if (submission.missionIntentId !== intent.missionIntentId || submission.intentBundleId !== intent.bundleId || submission.intentBundleDigest !== intent.canonicalDigest) throw new GoalPlanContractError('PLANNER_SUBMISSION_INPUT_MISMATCH');
  if (submission.taskId !== plannerTask.taskId || submission.inputDigest !== plannerTask.inputDigest) throw new GoalPlanContractError('PLANNER_SUBMISSION_INPUT_MISMATCH');
  if (submission.outputSchema !== CONTENT_PLAN_SCHEMA_ID || submission.outputSchemaDigest !== CONTENT_PLAN_SCHEMA_DIGEST) throw new GoalPlanContractError('PLANNER_SUBMISSION_SCHEMA_MISMATCH');
  if (submission.skillLockDigest !== plannerTask.skillLockDigest) throw new GoalPlanContractError('PLANNER_SUBMISSION_SKILL_MISMATCH');
  validatePlanPayload(intent, submission.slots, submission.currentBrief, submission.sourceBindings);
  const goal = intent.inputBindings.operatingGoal;
  const planId = stableContractId('plan', {missionIntentId: intent.missionIntentId});
  const base: Omit<ContentPlanRevision, 'canonicalDigest'> = {
    schemaVersion: 2,
    ownerId: intent.ownerId,
    planId,
    revision: 1,
    goalId: goal.id,
    goalRevision: goal.revision,
    goalRevisionDigest: goal.digest,
    missionIntentId: intent.missionIntentId,
    intentBundleId: intent.bundleId,
    intentBundleDigest: intent.canonicalDigest,
    state: submission.evidenceMaturity === 'CONTROLLED_FIXTURE' ? 'NEEDS_OWNER' : 'DRAFT',
    slots: clone(submission.slots),
    currentBrief: clone(submission.currentBrief),
    sourceBindings: clone(submission.sourceBindings),
    plannerSubmissionDigest: sha256Digest(submission),
    parentDigest: null,
    approvedInputDigest: null,
    createdAt
  };
  return {...base, canonicalDigest: sha256Digest(contentPlanCanonicalPayload(base))};
}

export function reviseContentPlanV2(intent: MissionIntentBundle, current: ContentPlanRevision, changes: {slots: ContentPlanSlot[]; currentBrief: ContentBrief; sourceBindings: PlanSourceBinding[]}, expectedDigest: string, createdAt: string): ContentPlanRevision {
  if (current.canonicalDigest !== expectedDigest) throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');
  if (!['DRAFT','NEEDS_OWNER'].includes(current.state)) throw new GoalPlanContractError('PLAN_STATE_CONFLICT');
  if (current.intentBundleDigest !== intent.canonicalDigest) throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
  validatePlanPayload(intent, changes.slots, changes.currentBrief, changes.sourceBindings);
  const base: Omit<ContentPlanRevision, 'canonicalDigest'> = {
    ...clone(current), revision: current.revision + 1, state: 'NEEDS_OWNER', slots: clone(changes.slots), currentBrief: clone(changes.currentBrief), sourceBindings: clone(changes.sourceBindings), parentDigest: current.canonicalDigest, approvedInputDigest: null, createdAt
  };
  delete (base as Partial<ContentPlanRevision>).canonicalDigest;
  return {...base, canonicalDigest: sha256Digest(contentPlanCanonicalPayload(base))};
}

export function approveContentPlanV2(intent: MissionIntentBundle, current: ContentPlanRevision, expectedDigest: string, createdAt: string): ContentPlanRevision {
  if (current.canonicalDigest !== expectedDigest) throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');
  if (!['DRAFT','NEEDS_OWNER'].includes(current.state)) throw new GoalPlanContractError('PLAN_STATE_CONFLICT');
  if (current.intentBundleDigest !== intent.canonicalDigest) throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
  validatePlanPayload(intent, current.slots, current.currentBrief, current.sourceBindings);
  const base: Omit<ContentPlanRevision, 'canonicalDigest'> = {
    ...clone(current), revision: current.revision + 1, state: 'APPROVED', parentDigest: current.canonicalDigest, approvedInputDigest: current.canonicalDigest, createdAt
  };
  delete (base as Partial<ContentPlanRevision>).canonicalDigest;
  return {...base, canonicalDigest: sha256Digest(contentPlanCanonicalPayload(base))};
}

export function continueSelectedPlatformMissionV2(intent: MissionIntentBundle, approvedPlan: ContentPlanRevision): MissionExecutionBundle {
  if (intent.state !== 'COMPILED') throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
  if (approvedPlan.state !== 'APPROVED') throw new GoalPlanContractError('PLAN_NOT_APPROVED');
  if (approvedPlan.intentBundleId !== intent.bundleId || approvedPlan.intentBundleDigest !== intent.canonicalDigest || approvedPlan.missionIntentId !== intent.missionIntentId) throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
  validatePlanPayload(intent, approvedPlan.slots, approvedPlan.currentBrief, approvedPlan.sourceBindings);
  const generation = approvedPlan.revision;
  if (generation < 2) throw new GoalPlanContractError('PLAN_NOT_APPROVED');
  const bundleId = stableContractId('bundle', {missionIntentId: intent.missionIntentId, generation, planDigest: approvedPlan.canonicalDigest, compilerVersion: intent.compilerVersion});
  const activationUnits = approvedPlan.slots.map((slot) => ({
    activationUnitId: stableContractId('unit', {missionIntentId: intent.missionIntentId, slotId: slot.slotId, accountId: slot.accountProfileRevisionId}),
    slotId: slot.slotId,
    localDate: slot.localDate,
    localTime: slot.localTime,
    platformCode: slot.platformCode,
    accountProfileRevisionId: slot.accountProfileRevisionId,
    producerRole: slot.producerRole,
    contentObjective: slot.contentObjective,
    sourceItemIds: [...slot.sourceItemIds],
    claimConstraints: [...slot.claimConstraints]
  }));
  const tasks = executionTasks(intent, approvedPlan, activationUnits.map((unit) => unit.activationUnitId));
  const dependencyDag = tasks.flatMap((task) => task.dependsOn.map((from) => ({from, to: task.taskId})));
  const expectedArtifactSchemas = intent.selectedPlatforms.map((platformCode) => ({platformCode, schemaRef: platformCode === 'X' ? 'lumiclaw.artifact.x.v1.sdd010' : 'lumiclaw.artifact.xiaohongshu-note.v1.sdd010', contractStatus: 'SDD_010_REQUIRED' as const}));
  const inputBindings = {...clone(intent.inputBindings), approvedPlan: {id: approvedPlan.planId, revision: approvedPlan.revision, digest: approvedPlan.canonicalDigest}};
  const traceSeed = sha256Digest({intent: intent.canonicalDigest, plan: approvedPlan.canonicalDigest});
  const trace = [
    {code: 'INTENT_BINDINGS_VERIFIED', inputDigest: intent.inputBindings.knowledgeSnapshot.digest, outputDigest: intent.canonicalDigest, detail: 'Approved Snapshot, active Goal and selected account revisions matched.'},
    {code: 'PLAN_EXACT_DIGEST_APPROVED', inputDigest: approvedPlan.approvedInputDigest!, outputDigest: approvedPlan.canonicalDigest, detail: 'Owner approval created an immutable APPROVED plan revision.'},
    {code: 'SELECTED_PLATFORM_DAG_COMPILED', inputDigest: traceSeed, outputDigest: sha256Digest({activationUnits,tasks,dependencyDag}), detail: 'Only explicitly selected X/Xiaohongshu account work was materialized.'}
  ];
  const base: Omit<MissionExecutionBundle, 'canonicalDigest'> = {
    schemaVersion: 2,
    kind: 'MISSION_EXECUTION',
    missionIntentId: intent.missionIntentId,
    ownerId: intent.ownerId,
    bundleId,
    generation,
    parentBundleId: intent.bundleId,
    parentBundleDigest: intent.canonicalDigest,
    approvedPlanId: approvedPlan.planId,
    approvedPlanRevision: approvedPlan.revision,
    approvedPlanDigest: approvedPlan.canonicalDigest,
    state: 'COMPILED',
    compilerVersion: intent.compilerVersion,
    inputBindings,
    roles: clone(intent.roles),
    roleContexts: clone(intent.roleContexts),
    skillLocks: clone(intent.skillLocks),
    selectedPlatforms: [...intent.selectedPlatforms],
    activationUnits,
    currentBrief: clone(approvedPlan.currentBrief),
    tasks,
    dependencyDag,
    expectedArtifactSchemas,
    trace,
    evidenceContract: {agentTeamsExecuted: false, fixtureAllowed: true, externalActionAllowed: false}
  };
  return {...base, canonicalDigest: canonicalBundleDigest(base)};
}

function missionInputBindings(goal: OperatingGoalRevision, accounts: AccountProfileBinding[], compilerVersion: string): MissionInputBindings {
  const team = {...TEAM_PROFILE, digest: sha256Digest(TEAM_PROFILE)};
  return {
    knowledgeSnapshot: {id: goal.knowledgeSnapshotId, digest: goal.knowledgeSnapshotDigest, state: 'APPROVED'},
    operatingGoal: {id: goal.goalId, revision: goal.revision, digest: goal.canonicalDigest, state: 'ACTIVE'},
    accountProfiles: clone(accounts),
    compiler: {version: compilerVersion, digest: COMPILER_DIGEST},
    teamProfile: team,
    plannerOutputSchema: {id: CONTENT_PLAN_SCHEMA_ID, digest: CONTENT_PLAN_SCHEMA_DIGEST}
  };
}

function roleRoster(): MissionRole[] { return GOAL_ROLE_IDS.map((roleId) => ({roleId, ...clone(ROLE_DEFINITIONS[roleId])})); }

function roleContextViews(missionIntentId: string, goal: OperatingGoalRevision, knowledge: KnowledgeRoleContext, accounts: AccountProfileBinding[]): RoleContextView[] {
  const allItems = knowledge.items.map((item) => item.id).sort();
  const claimItems = knowledge.items.filter((item) => ['CLAIM','EVIDENCE','ORGANIZATION_FACT','PRODUCT_FACT','SOURCE_EXCERPT'].includes(item.kind)).map((item) => item.id).sort();
  const accountIds = accounts.map((account) => account.accountProfileRevisionId);
  const forProducer = (role: ProducerRoleId) => accounts.filter((account) => account.producerMandates.includes(role === 'founder-identity-producer' ? 'FOUNDER_VOICE' : 'PRODUCT_EXPERTISE')).map((account) => account.accountProfileRevisionId);
  const base = GOAL_ROLE_IDS.map((roleId): Omit<RoleContextView,'contextDigest'> => {
    if (roleId === 'presence-mission-leader') return {roleId, knowledgeItemIds: [], accountProfileRevisionIds: [], visibleBindings: ['MISSION_ID','TASK_STATE','DEPENDENCY_DIGEST'], excluded: ['DOMAIN_ARTIFACTS','RAW_BLOB_PATHS','SECRETS','UNAPPROVED_DRAFTS']};
    if (roleId === 'evidence-claim-steward') return {roleId, knowledgeItemIds: claimItems, accountProfileRevisionIds: [], visibleBindings: ['APPROVED_SNAPSHOT','SOURCE_DIGESTS','CLAIM_EVIDENCE'], excluded: ['ACCOUNT_SECRETS','RAW_BLOB_PATHS','UNAPPROVED_DRAFTS']};
    if (roleId === 'campaign-planner') return {roleId, knowledgeItemIds: allItems, accountProfileRevisionIds: accountIds, visibleBindings: ['ACTIVE_GOAL','SELECTED_ACCOUNTS','MARKET','CONTENT_LOCALE','TIME_ZONE'], excluded: ['ACCOUNT_SECRETS','RAW_BLOB_PATHS','UNSELECTED_ACCOUNTS']};
    if (roleId === 'founder-identity-producer' || roleId === 'product-account-producer') return {roleId, knowledgeItemIds: claimItems, accountProfileRevisionIds: forProducer(roleId), visibleBindings: ['ASSIGNED_PLAN_SLOTS','ASSIGNED_ACCOUNT_MANDATE','CLAIM_CONSTRAINTS'], excluded: ['ACCOUNT_SECRETS','RAW_BLOB_PATHS','UNSELECTED_ACCOUNTS','OTHER_PRODUCER_DRAFTS']};
    return {roleId, knowledgeItemIds: claimItems, accountProfileRevisionIds: accountIds, visibleBindings: ['APPROVED_PLAN','PRODUCER_OUTPUT_DIGESTS','SOURCE_AND_CLAIM_BINDINGS'], excluded: ['ACCOUNT_SECRETS','RAW_BLOB_PATHS','OWNER_APPROVAL_AUTHORITY']};
  });
  return base.map((context) => ({...context, contextDigest: sha256Digest({missionIntentId, goalDigest: goal.canonicalDigest, snapshotDigest: knowledge.snapshotDigest, ...context})}));
}

function intentTasks(missionIntentId: string, goal: OperatingGoalRevision, accounts: AccountProfileBinding[], contexts: RoleContextView[]): MissionTaskTemplate[] {
  const task = (suffix: string, kind: MissionTaskTemplate['kind'], roleId: MissionRoleId, dependsOn: string[], accountProfileRevisionIds: string[], mandate: string, platformCode: AccountProfileBinding['platformCode'] | null, outputSchema: string, substantive: boolean): MissionTaskTemplate => {
    const taskId = stableContractId('task', {missionIntentId, suffix});
    const context = contexts.find((item) => item.roleId === roleId)!;
    const skillLockDigest = roleSkillDigest(roleId);
    return {taskId, kind, roleId, platformCode, accountProfileRevisionIds, mandate, dependsOn, inputDigest: sha256Digest({missionIntentId, goalDigest: goal.canonicalDigest, contextDigest: context.contextDigest, dependsOn, accountProfileRevisionIds, mandate, outputSchema, skillLockDigest}), outputSchema, skillLockDigest, substantive};
  };
  const leader = task('leader','ORCHESTRATE','presence-mission-leader',[],[],'Coordinate only; never author domain output.',null,'lumiclaw.orchestration-receipt.v2',false);
  const steward = task('steward','FREEZE_CLAIMS','evidence-claim-steward',[leader.taskId],[],'Freeze approved claim/evidence/source bindings.',null,'lumiclaw.frozen-claim-set.v2',true);
  const planner = task('planner','PLAN_CONTENT','campaign-planner',[steward.taskId],accounts.map((account) => account.accountProfileRevisionId),'Create the complete selected-account 7/30-day plan.',null,CONTENT_PLAN_SCHEMA_ID,true);
  const producer = (role: ProducerRoleId, mandateCode: 'FOUNDER_VOICE' | 'PRODUCT_EXPERTISE') => {
    const assigned = accounts.filter((account) => account.producerMandates.includes(mandateCode));
    return task(role, 'PRODUCE_CONTENT', role, [planner.taskId], assigned.map((account) => account.accountProfileRevisionId), role === 'founder-identity-producer' ? 'Express founder perspective for assigned plan slots.' : 'Explain product value and use cases for assigned plan slots.', assigned.length === 1 ? assigned[0]!.platformCode : null, 'lumiclaw.selected-platform-artifact-template.v2', true);
  };
  const founder = producer('founder-identity-producer','FOUNDER_VOICE');
  const product = producer('product-account-producer','PRODUCT_EXPERTISE');
  const auditor = task('auditor','AUDIT_CONTENT','independent-auditor',[founder.taskId,product.taskId],accounts.map((account) => account.accountProfileRevisionId),'Audit both Producer outputs independently; never edit or approve.',null,'lumiclaw.audit-decision.sdd010',true);
  return [leader,steward,planner,founder,product,auditor];
}

function executionTasks(intent: MissionIntentBundle, plan: ContentPlanRevision, activationUnitIds: string[]): MissionTaskTemplate[] {
  const intentByRole = new Map(intent.tasks.map((task) => [task.roleId, task]));
  const leader = clone(intentByRole.get('presence-mission-leader')!);
  const steward = clone(intentByRole.get('evidence-claim-steward')!);
  const planner = clone(intentByRole.get('campaign-planner')!);
  const makeProducer = (role: ProducerRoleId) => {
    const source = clone(intentByRole.get(role)!);
    const slots = plan.slots.filter((slot) => slot.producerRole === role);
    if (slots.length === 0) throw new GoalPlanContractError('PRODUCER_COVERAGE_REQUIRED');
    source.accountProfileRevisionIds = [...new Set(slots.map((slot) => slot.accountProfileRevisionId))];
    source.platformCode = new Set(slots.map((slot) => slot.platformCode)).size === 1 ? slots[0]!.platformCode : null;
    source.outputSchema = 'lumiclaw.selected-platform-artifact.sdd010';
    source.inputDigest = sha256Digest({intentTaskDigest: source.inputDigest, approvedPlanDigest: plan.canonicalDigest, slots, activationUnitIds: slots.map((slot) => activationUnitIds[plan.slots.indexOf(slot)])});
    source.mandate = role === 'founder-identity-producer' ? 'Produce founder-perspective artifacts for the exact assigned selected-account slots.' : 'Produce product-expertise artifacts for the exact assigned selected-account slots.';
    source.substantive = true;
    return source;
  };
  const founder = makeProducer('founder-identity-producer');
  const product = makeProducer('product-account-producer');
  const auditor = clone(intentByRole.get('independent-auditor')!);
  auditor.dependsOn = [founder.taskId,product.taskId];
  auditor.inputDigest = sha256Digest({intentTaskDigest: auditor.inputDigest, approvedPlanDigest: plan.canonicalDigest, producerTaskDigests: [founder.inputDigest,product.inputDigest]});
  return [leader,steward,planner,founder,product,auditor];
}

function validatePlanPayload(intent: MissionIntentBundle, slots: ContentPlanSlot[], currentBrief: ContentBrief, sourceBindings: PlanSourceBinding[]): void {
  const expectedDates = intent.plannerRequirements.expectedSlotDates;
  if (!Array.isArray(slots) || slots.length !== expectedDates.length) throw new GoalPlanContractError('PLAN_SLOT_COVERAGE_INVALID');
  const selectedAccounts = new Map(intent.inputBindings.accountProfiles.map((account) => [account.accountProfileRevisionId, account]));
  const expected = new Set(expectedDates);
  const dates = new Set<string>();
  const slotIds = new Set<string>();
  const producers = new Set<ProducerRoleId>();
  for (const slot of slots) {
    assertSlot(slot);
    if (!expected.has(slot.localDate) || dates.has(slot.localDate) || slotIds.has(slot.slotId)) throw new GoalPlanContractError('PLAN_SLOT_COVERAGE_INVALID');
    dates.add(slot.localDate); slotIds.add(slot.slotId);
    const account = selectedAccounts.get(slot.accountProfileRevisionId);
    if (account === undefined) throw new GoalPlanContractError('ACCOUNT_NOT_SELECTED');
    if (account.platformCode !== slot.platformCode || !intent.selectedPlatforms.includes(slot.platformCode)) throw new GoalPlanContractError('PLATFORM_NOT_SUPPORTED');
    const mandate = slot.producerRole === 'founder-identity-producer' ? 'FOUNDER_VOICE' : 'PRODUCT_EXPERTISE';
    if (!account.producerMandates.includes(mandate)) throw new GoalPlanContractError('PRODUCER_COVERAGE_REQUIRED');
    producers.add(slot.producerRole);
  }
  if (producers.size !== 2) throw new GoalPlanContractError('PRODUCER_COVERAGE_REQUIRED');
  if (!expectedDates.every((date) => dates.has(date))) throw new GoalPlanContractError('PLAN_SLOT_COVERAGE_INVALID');
  const briefSlot = slots.find((slot) => slot.slotId === currentBrief.slotId);
  if (briefSlot === undefined || briefSlot.platformCode !== currentBrief.platformCode || briefSlot.accountProfileRevisionId !== currentBrief.accountProfileRevisionId || briefSlot.producerRole !== currentBrief.producerRole) throw new GoalPlanContractError('CURRENT_BRIEF_INVALID');
  if (sourceBindings.length < 1 || sourceBindings.some((binding) => binding.snapshotId !== intent.inputBindings.knowledgeSnapshot.id || binding.snapshotDigest !== intent.inputBindings.knowledgeSnapshot.digest || binding.sourceItemIds.length < 1)) throw new GoalPlanContractError('PLAN_SOURCE_BINDING_INVALID');
  const allowedItems = new Set(intent.roleContexts.find((context) => context.roleId === 'campaign-planner')!.knowledgeItemIds);
  if (sourceBindings.some((binding) => binding.sourceItemIds.some((id) => !allowedItems.has(id)))) throw new GoalPlanContractError('PLAN_SOURCE_BINDING_INVALID');
}

function assertSlot(slot: ContentPlanSlot): void {
  const exact = ['slotId','localDate','localTime','platformCode','accountProfileRevisionId','producerRole','theme','contentObjective','claimConstraints','sourceItemIds','status'];
  if (!isRecord(slot) || Object.keys(slot).some((key) => !exact.includes(key)) || exact.some((key) => !(key in slot))) throw new GoalPlanContractError('PLAN_SCHEMA_INVALID');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(slot.localDate) || (slot.localTime !== null && !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(slot.localTime)) || !['X','XIAOHONGSHU'].includes(slot.platformCode) || !['founder-identity-producer','product-account-producer'].includes(slot.producerRole) || slot.status !== 'PLANNED') throw new GoalPlanContractError('PLAN_SCHEMA_INVALID');
  if (!text(slot.slotId,160) || !text(slot.theme,500) || !text(slot.contentObjective,1000) || !stringList(slot.claimConstraints,0,20,1000) || !stringList(slot.sourceItemIds,1,100,160)) throw new GoalPlanContractError('PLAN_SCHEMA_INVALID');
}

function roleSkillDigest(roleId: MissionRoleId): string {
  const locks = SKILL_LOCKS.filter((lock) => ROLE_SKILL_IDS[roleId].includes(lock.skillId));
  return sha256Digest(locks);
}

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.normalize('NFC').trim().length >= 1 && value.length <= max; }
function stringList(value: unknown, min: number, max: number, itemMax: number): value is string[] { return Array.isArray(value) && value.length >= min && value.length <= max && new Set(value).size === value.length && value.every((item) => text(item,itemMax)); }
function clone<T>(value: T): T { return structuredClone(value); }

export type MissionAdapterInput = {
  schemaVersion: 1;
  campaignId: string;
  organizationId: string;
  sourceDigest: string;
  live: false;
  executionMode: 'SHADOW_PREP_ONLY';
  externalActionAllowed: false;
  roles: {id: MissionRoleId; orchestrationOnly: boolean; permissions: ('ORCHESTRATE' | 'EVIDENCE' | 'PLAN' | 'PRODUCE' | 'AUDIT')[]}[];
  artifacts: {activationUnitId: string; platform: string}[];
};

export function compileMissionAdapterInput(document: CampaignDocument, now = new Date()): MissionAdapterInput {
  const validation = validateCampaignDocument(document, now);
  if (!validation.ok) throw new Error(JSON.stringify({code: 'MISSION_INPUT_INVALID', issues: validation.issues}));
  const sourceDigest = digestCampaign(document);
  if (sourceDigest !== document.missionContract.sourceDigest) throw new Error('MISSION_SOURCE_DIGEST_MISMATCH');
  const permissions = new Map<MissionRoleId, MissionAdapterInput['roles'][number]['permissions']>([
    ['presence-mission-leader', ['ORCHESTRATE']], ['evidence-claim-steward', ['EVIDENCE']], ['campaign-planner', ['PLAN']],
    ['founder-identity-producer', ['PRODUCE']], ['product-account-producer', ['PRODUCE']], ['independent-auditor', ['AUDIT']]
  ]);
  return {
    schemaVersion: 1, campaignId: document.id, organizationId: document.organizationId, sourceDigest,
    live: false, executionMode: 'SHADOW_PREP_ONLY', externalActionAllowed: false,
    roles: document.missionContract.roleIds.map((id) => ({id, orchestrationOnly: id === 'presence-mission-leader', permissions: permissions.get(id)!})),
    artifacts: document.activationPlan.units.map((unit) => ({activationUnitId: unit.id, platform: unit.platform}))
  };
}
