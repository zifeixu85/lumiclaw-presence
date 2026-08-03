import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {ProductShell, type MissionCopy, type ShellLabels} from './product-shell';

const labels: ShellLabels = {
  brand: 'LumiClaw Presence',
  category: '你的全球品牌运营工作台',
  mode: '演示环境 · DEMO_SEED / NOT_LIVE',
  milestone: '产品体验版 · 不会执行真实操作',
  localeLabel: '界面语言',
  localeSwitch: 'English',
  evidenceLabel: '当前环境',
  evidenceValue: '安全演示中',
  journeyLabel: '完成一次推广的五个步骤',
  statusLabel: '当前情况',
  ownerLabel: '你现在可以做',
  technicalDetailsLabel: '查看技术与验收信息',
  technicalStateLabel: '稳定状态码',
  technicalEvidenceLabel: '工程依据',
  footer: '这是安全演示：没有连接真实账号，不会审批或发布任何内容。',
  nav: {
    campaigns: '创建推广任务',
    setup: '准备品牌资料',
    mission: '制作各平台内容',
    review: '审核并确认',
    learn: '查看反馈并优化'
  }
};

const mission: MissionCopy = {
  rail: '各平台内容',
  composer: '内容编辑区',
  preview: '发布前预览',
  constraint: '尚未连接平台账号',
  disclaimer: '这是效果示意；正式发布前仍需你确认。',
  platforms: [
    {id: 'x', label: 'X · 仅展示准备方式'},
    {id: 'bluesky', label: 'Bluesky · 尚未连接'},
    {id: 'linkedin', label: 'LinkedIn · 计划人工交接'},
    {id: 'xiaohongshu', label: '小红书 · 计划人工交接'}
  ]
};

const meta = {
  title: 'M1/Campaign States',
  component: ProductShell,
  parameters: {
    docs: {
      description: {
        component: 'M1 state fixtures. These stories remain DEMO_SEED / NOT_LIVE and perform no network or platform action.'
      }
    }
  }
} satisfies Meta<typeof ProductShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const screen = {
  eyebrow: '03 · 为不同平台准备内容',
  title: '一次准备，形成四个平台各自合适的表达。',
  summary: '同一条品牌信息会按照不同平台的表达习惯分别准备，同时保留编辑区和发布前预览。',
  status: '四个平台内容可编辑、预览和保存',
  basis: '内容来自合成演示种子；没有调用模型或平台，也不会批准或发布。',
  next: '修改任一平台内容，检查预览，然后保存新版本。',
  previewTitle: '这里将展示四个平台的内容版本',
  previewItems: ['每个平台准备的表达方式', '可以由你修改的内容', '发送或发布前的效果预览'] as [string, string, string],
  technicalStatus: 'COMPOSER_PERSISTED / NO_AGENT_TURN / NO_PUBLISH',
  technicalBasis: '四平台 ArtifactRevision 与持久化合同可重开；真实 AgentTeams Mission 尚未运行。'
};

export const Loading: Story = {
  args: {
    locale: 'zh-CN',
    routeId: 'mission',
    labels,
    screen, mission, workspaceState: 'loading'
  }
};

export const Empty: Story = {args: {locale: 'zh-CN', routeId: 'campaigns', labels, screen, mission, workspaceState: 'empty'}};
export const Blocked: Story = {args: {locale: 'zh-CN', routeId: 'learn', labels, screen, mission, workspaceState: 'blocked'}};
export const NeedsOwner: Story = {args: {locale: 'zh-CN', routeId: 'review', labels, screen, mission, workspaceState: 'needs-owner'}};
export const Recovery: Story = {args: {locale: 'zh-CN', routeId: 'mission', labels, screen, mission, workspaceState: 'recovery'}};
