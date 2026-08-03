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
  title: 'Foundation/Product Shell',
  component: ProductShell,
  parameters: {
    docs: {
      description: {
        component: 'M0 review baseline only. This story contains no live Campaign, Agent turn, approval, account, or platform action.'
      }
    }
  }
} satisfies Meta<typeof ProductShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MissionContractOnly: Story = {
  args: {
    locale: 'zh-CN',
    routeId: 'mission',
    labels,
    screen: {
      eyebrow: '03 · 为不同平台准备内容',
      title: '一次准备，形成四个平台各自合适的表达。',
      summary: '同一条品牌信息会按照不同平台的表达习惯分别准备，同时保留编辑区和发布前预览。',
      status: '当前只展示工作方式，AI 团队尚未开始',
      basis: '没有连接模型或平台账号，也没有生成、批准或发布任何内容。',
      next: '查看四个平台的内容位置和预览方式，判断是否符合你的工作习惯。',
      previewTitle: '这里将展示四个平台的内容版本',
      previewItems: ['每个平台准备的表达方式', '可以由你修改的内容', '发送或发布前的效果预览'],
      technicalStatus: 'ADAPTER_CONTRACT_ONLY / NO_AGENT_TURN',
      technicalBasis: '六角色 TeamProfile 和四平台 Adapter 边界已验证；真实 AgentTeams Mission 尚未运行。'
    },
    mission
  }
};
