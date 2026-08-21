import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {NextIntlClientProvider} from 'next-intl';
import messages from '../../messages/zh-CN.json';
import type {EnvironmentReadiness, SkillListResponse, TeamResponse, WorkspaceSnapshot} from '@/lib/production-types';
import {productionStoryCampaign} from '@/fixtures/production-story-fixture';
import {ProductionWorkspace} from './production-workspace';

const campaign = productionStoryCampaign;
const document = campaign.document;
const profile = {schemaVersion: 1 as const, id: document.organizationId, displayName: 'A梦 Owner', state: 'ONBOARDING_COMPLETE' as const, createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z'};
const publishAuthorization = {state: 'BLOCKED', reasonCode: 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED', auditState: 'MISSING', ownerDecisionState: 'MISSING', requiredAuthorities: ['INDEPENDENT_AUDIT_PASS', 'EXACT_EXTERNAL_ACTION_OWNER_DECISION'], remediationCodes: ['SDD_007_REQUIRED', 'CONNECTOR_SDD_REQUIRED'], reviewExportAllowed: true, externalActionAllowed: false, handoffCreationAllowed: false} as const;
const complete: WorkspaceSnapshot = {code: 'LOCAL_WORKSPACE_REOPENED', profile, session: {schemaVersion: 1, ownerProfileId: profile.id, path: 'PUBLIC_SAFE_EXAMPLE', state: 'COMPLETED', dataMode: 'PUBLIC_SAFE_EXAMPLE', organizationId: document.organizationId, campaignId: document.id, marketCodes: ['US'], contentLocales: ['en-US'], platforms: ['LINKEDIN', 'X', 'BLUESKY', 'XIAOHONGSHU'], defaultTimeZone: 'America/Los_Angeles', materialIds: [], createdAt: profile.createdAt, updatedAt: profile.updatedAt}, materials: [], handoffs: [], campaign, publishAuthorization};
const firstOpen: WorkspaceSnapshot = {code: 'LOCAL_FIRST_OPEN', profile: null, session: null, materials: [], handoffs: [], campaign: null, publishAuthorization};
const readiness: EnvironmentReadiness = {code: 'ENVIRONMENT_READINESS', secretCollectionAllowed: false, items: [
  {service: 'WEB', state: 'AVAILABLE', source: 'CLIENT_OBSERVATION', checkedAt: profile.createdAt, reasonCode: 'CLIENT_RENDERED_READINESS', remediation: null},
  {service: 'API', state: 'AVAILABLE', source: 'API_SELF_CHECK', checkedAt: profile.createdAt, reasonCode: 'READINESS_HANDLER_REACHED', remediation: null},
  {service: 'POSTGRESQL', state: 'AVAILABLE', source: 'POSTGRESQL_PROBE', checkedAt: profile.createdAt, reasonCode: 'LOCAL_SCHEMA_REACHABLE', remediation: null},
  {service: 'AGENTTEAMS_ADAPTER', state: 'AVAILABLE', source: 'BUILD_CONTRACT', checkedAt: profile.createdAt, reasonCode: 'ADAPTER_CONTRACT_BUILT', remediation: null},
  {service: 'AGENTTEAMS_RUNTIME', state: 'NOT_CONFIGURED', source: 'RUNTIME_CONFIGURATION', checkedAt: profile.createdAt, reasonCode: 'SDD_007_REQUIRED', remediation: 'Complete SDD-007.'}
]};
const roles = [
  ['A0', 'presence-mission-leader', '任务协调', '只编排任务与依赖，不生成领域内容。', ['trace-safe-escalation']],
  ['A1', 'evidence-claim-steward', '事实核验', '冻结获批 Claim 与 Evidence 绑定。', ['evidence-and-claim-grounding']],
  ['A2', 'campaign-planner', '市场策划', '分配市场、账号与平台行动单元。', ['campaign-strategy']],
  ['A3', 'founder-identity-producer', '创始人内容', '仅生产创始人身份的平台内容。', ['account-native-expression']],
  ['A4', 'product-account-producer', '产品内容', '仅生产产品账号的平台内容。', ['account-native-expression']],
  ['A5', 'independent-auditor', '独立审校', '独立检查证据、权限与平台约束。', ['independent-action-audit']]
] as const;
const team: TeamResponse = {code: 'AI_TEAM_ROSTER', metricSource: 'NO_RUNTIME_OBSERVATION', agents: roles.map(([code, roleId, name, responsibility, skillIds]) => ({code, roleId, name, responsibility, skillIds: [...skillIds], status: 'NOT_CONFIGURED', metrics: {tokens: 0, dailyCompleted: 0, source: 'NO_RUNTIME_OBSERVATION'}}))};
const skills: SkillListResponse = {code: 'REPOSITORY_SKILL_LIST', source: 'REPOSITORY_OWNED', skills: [{id: 'trace-safe-escalation', name: 'Trace-safe escalation', roleIds: ['presence-mission-leader'], state: 'AVAILABLE', license: 'Apache-2.0'}, {id: 'evidence-and-claim-grounding', name: 'Evidence and Claim grounding', roleIds: ['evidence-claim-steward'], state: 'AVAILABLE', license: 'Apache-2.0'}, {id: 'campaign-strategy', name: 'Campaign strategy', roleIds: ['campaign-planner'], state: 'AVAILABLE', license: 'Apache-2.0'}, {id: 'account-native-expression', name: 'Account-native expression', roleIds: ['founder-identity-producer', 'product-account-producer'], state: 'AVAILABLE', license: 'Apache-2.0'}, {id: 'independent-action-audit', name: 'Independent action audit', roleIds: ['independent-auditor'], state: 'AVAILABLE', license: 'Apache-2.0'}]};

const meta = {title: 'M5/Production Workspace', component: ProductionWorkspace, decorators: [(Story) => <NextIntlClientProvider locale="zh-CN" messages={messages}><Story /></NextIntlClientProvider>], parameters: {a11y: {test: 'error'}, viewport: {defaultViewport: 'desktop'}}} satisfies Meta<typeof ProductionWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
const base = {locale: 'zh-CN' as const, initialSnapshot: complete, initialReadiness: readiness, initialTeam: team, initialSkills: skills};
export const Today: Story = {args: {...base, initialSection: 'today'}};
export const Campaign: Story = {args: {...base, initialSection: 'campaigns'}};
export const PublishCenter: Story = {args: {...base, initialSection: 'publish'}};
export const AITeam: Story = {args: {...base, initialSection: 'ai-team'}};
export const FirstOpen: Story = {args: {...base, initialSnapshot: firstOpen, initialSection: 'today'}};
