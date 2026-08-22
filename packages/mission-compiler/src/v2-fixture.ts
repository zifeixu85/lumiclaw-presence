import {
  createOperatingGoalRevision,
  expectedPlanDates,
  sha256Digest,
  stableContractId,
  type AccountProfileBinding,
  type ContentPlanSlot,
  type KnowledgePlatform,
  type KnowledgeRoleContext,
  type OperatingGoalRevision,
  type PlannerSubmission,
  type ProducerRoleId
} from '@lumiclaw/domain';
import {CONTENT_PLAN_SCHEMA_DIGEST, CONTENT_PLAN_SCHEMA_ID, compileMissionIntentV2} from './index.js';

const OWNER_ID = '0199a000-0000-7000-8000-000000000009';
const SNAPSHOT_ID = '0199a000-0000-7000-8000-000000000010';
const SNAPSHOT_DIGEST = 'a'.repeat(64);

export function createV2Fixture(options: {horizonDays?: 7 | 30; platforms?: KnowledgePlatform[]; dualMandateSingleAccount?: boolean; missingProductCoverage?: boolean} = {}) {
  const horizonDays = options.horizonDays ?? 7;
  const platforms = options.platforms ?? ['X','XIAOHONGSHU'];
  const dual = options.dualMandateSingleAccount ?? false;
  const missing = options.missingProductCoverage ?? false;
  const all: Record<KnowledgePlatform, AccountProfileBinding> = {
    X: {accountProfileRevisionId: '0199a000-0000-7000-8000-000000000011', revision: 3, digest: 'b'.repeat(64), platformCode: 'X', handleOrDisplayName: '@lumi_founder_fixture', producerMandates: dual ? ['FOUNDER_VOICE','PRODUCT_EXPERTISE'] : ['FOUNDER_VOICE'], targetMarket: 'US', contentLocale: 'en-US'},
    XIAOHONGSHU: {accountProfileRevisionId: '0199a000-0000-7000-8000-000000000012', revision: 2, digest: 'c'.repeat(64), platformCode: 'XIAOHONGSHU', handleOrDisplayName: 'LumiClaw 产品手记（示例）', producerMandates: missing ? ['FOUNDER_VOICE'] : dual ? ['FOUNDER_VOICE','PRODUCT_EXPERTISE'] : ['PRODUCT_EXPERTISE'], targetMarket: 'CN', contentLocale: 'zh-CN'}
  };
  const accounts = platforms.map((platform) => all[platform]).map((account) => ({...account, producerMandates: [...account.producerMandates]}));
  if (platforms.length === 1 && dual) accounts[0]!.producerMandates = ['FOUNDER_VOICE','PRODUCT_EXPERTISE'];
  if (platforms.length === 1 && missing) accounts[0]!.producerMandates = ['FOUNDER_VOICE'];
  const start = '2026-08-24';
  const end = new Date(Date.parse(`${start}T00:00:00.000Z`) + (horizonDays - 1) * 86_400_000).toISOString().slice(0,10);
  const goal = createOperatingGoalRevision({
    ownerId: OWNER_ID,
    goalId: 'goal_public_safe_sdd009',
    revision: 2,
    state: 'ACTIVE',
    parentDigest: 'd'.repeat(64),
    value: {
      objective: '在受治理的节奏中解释 LumiClaw Presence 的公开构建进展，并学习不同账号表达的清晰度。',
      horizonDays,
      startsAt: start,
      endsAt: end,
      cadence: 'DAILY',
      selectedAccountIds: accounts.map((account) => account.accountProfileRevisionId),
      targetMarket: platforms.length === 1 && platforms[0] === 'XIAOHONGSHU' ? 'CN' : 'US',
      contentLocale: platforms.length === 1 && platforms[0] === 'XIAOHONGSHU' ? 'zh-CN' : 'en-US',
      timeZone: 'Asia/Singapore',
      successSignals: [
        {code: 'PUBLISHING_CADENCE', observation: '记录计划槽位是否按节奏进入 Owner 审阅。'},
        {code: 'VOICE_CONSISTENCY', observation: '记录两个账号的表达边界是否清晰可辨。'}
      ],
      knowledgeSnapshotId: SNAPSHOT_ID,
      knowledgeSnapshotDigest: SNAPSHOT_DIGEST
    },
    createdAt: '2026-08-22T00:00:00.000Z'
  });
  const knowledge: KnowledgeRoleContext = {
    snapshotId: SNAPSHOT_ID,
    snapshotDigest: SNAPSHOT_DIGEST,
    ownerId: OWNER_ID,
    targetMarket: 'SG',
    contentLocale: 'en-US',
    timeZone: 'Asia/Singapore',
    items: [
      {id: 'item-approved-claim', kind: 'CLAIM', normalizedValue: 'LumiClaw Presence is an engineering candidate.', sourceRevisionIds: ['source-public-1'], profileRevisionIds: [], ownerAuthority: 'ORGANIZATION_APPROVED_PRIVATE'},
      {id: 'item-approved-evidence', kind: 'EVIDENCE', normalizedValue: 'Public repository implementation and repeatable verification.', sourceRevisionIds: ['source-public-1'], profileRevisionIds: [], ownerAuthority: 'ORGANIZATION_APPROVED_PRIVATE'}
    ],
    sourceDigests: [{revisionId: 'source-public-1', digest: 'e'.repeat(64)}],
    profileDigests: accounts.map((account) => ({revisionId: account.accountProfileRevisionId, digest: account.digest}))
  };
  return {goal, knowledge, accounts};
}

export function controlledPlannerSubmission(goal: OperatingGoalRevision, accounts: AccountProfileBinding[]): PlannerSubmission {
  const intent = compileMissionIntentV2({goal, knowledge: createKnowledge(goal, accounts), accountProfiles: accounts});
  const planner = intent.tasks.find((task) => task.roleId === 'campaign-planner')!;
  const dates = expectedPlanDates(goal);
  const roleFor = (index: number): ProducerRoleId => index % 2 === 0 ? 'founder-identity-producer' : 'product-account-producer';
  const accountFor = (role: ProducerRoleId) => accounts.find((account) => account.producerMandates.includes(role === 'founder-identity-producer' ? 'FOUNDER_VOICE' : 'PRODUCT_EXPERTISE'))!;
  const slots: ContentPlanSlot[] = dates.map((localDate,index) => {
    const producerRole = roleFor(index);
    const account = accountFor(producerRole);
    return {
      slotId: stableContractId('slot',{missionIntentId:intent.missionIntentId,localDate,index}),
      localDate,
      localTime: index % 2 === 0 ? '09:30' : '18:30',
      platformCode: account.platformCode,
      accountProfileRevisionId: account.accountProfileRevisionId,
      producerRole,
      theme: producerRole === 'founder-identity-producer' ? `构建者视角 ${index + 1}` : `产品实践 ${index + 1}`,
      contentObjective: producerRole === 'founder-identity-producer' ? '用创始人第一人称解释一个公开构建判断。' : '用产品账号说明一个可验证的工作流能力。',
      claimConstraints: ['不得声称真实 AgentTeams 已运行','不得承诺增长、线索或收入'],
      sourceItemIds: ['item-approved-claim','item-approved-evidence'],
      status: 'PLANNED'
    };
  });
  const first = slots[0]!;
  return {
    schemaVersion: 2,
    roleId: 'campaign-planner',
    missionIntentId: intent.missionIntentId,
    intentBundleId: intent.bundleId,
    intentBundleDigest: intent.canonicalDigest,
    taskId: planner.taskId,
    inputDigest: planner.inputDigest,
    outputSchema: CONTENT_PLAN_SCHEMA_ID,
    outputSchemaDigest: CONTENT_PLAN_SCHEMA_DIGEST,
    skillLockDigest: planner.skillLockDigest,
    slots,
    currentBrief: {briefId: stableContractId('brief',{slotId:first.slotId}), slotId:first.slotId, platformCode:first.platformCode, accountProfileRevisionId:first.accountProfileRevisionId, producerRole:first.producerRole, theme:first.theme, contentObjective:first.contentObjective, sourceItemIds:[...first.sourceItemIds], claimConstraints:[...first.claimConstraints]},
    sourceBindings: [{snapshotId: goal.knowledgeSnapshotId, snapshotDigest: goal.knowledgeSnapshotDigest, sourceItemIds: ['item-approved-claim','item-approved-evidence'], claimConstraints: ['Only approved public-safe engineering claims may be used.']}],
    evidenceMaturity: 'CONTROLLED_FIXTURE'
  };
}

function createKnowledge(goal: OperatingGoalRevision, accounts: AccountProfileBinding[]): KnowledgeRoleContext {
  return {
    snapshotId: goal.knowledgeSnapshotId, snapshotDigest: goal.knowledgeSnapshotDigest, ownerId: goal.ownerId,
    targetMarket: goal.targetMarket, contentLocale: goal.contentLocale, timeZone: goal.timeZone,
    items: [
      {id:'item-approved-claim',kind:'CLAIM',normalizedValue:'LumiClaw Presence is an engineering candidate.',sourceRevisionIds:['source-public-1'],profileRevisionIds:[],ownerAuthority:'ORGANIZATION_APPROVED_PRIVATE'},
      {id:'item-approved-evidence',kind:'EVIDENCE',normalizedValue:'Public repository implementation and repeatable verification.',sourceRevisionIds:['source-public-1'],profileRevisionIds:[],ownerAuthority:'ORGANIZATION_APPROVED_PRIVATE'}
    ],
    sourceDigests:[{revisionId:'source-public-1',digest:'e'.repeat(64)}],
    profileDigests:accounts.map((account)=>({revisionId:account.accountProfileRevisionId,digest:account.digest}))
  };
}

export function fixtureDigest(value: unknown): string { return sha256Digest(value); }
