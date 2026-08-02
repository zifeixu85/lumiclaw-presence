import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {ProductShell, type MissionCopy, type ShellLabels} from './product-shell';

const labels: ShellLabels = {
  brand: 'LumiClaw Presence',
  category: 'AI 原生全球品牌运营',
  mode: 'DEMO_SEED / NOT_LIVE',
  milestone: 'M0 · 交付基础',
  localeLabel: '界面语言',
  localeSwitch: 'English',
  evidenceLabel: '证据状态',
  evidenceValue: 'Storybook state contract',
  journeyLabel: 'Campaign Journey',
  ownerLabel: 'Owner 下一步',
  footer: '预览不代表账号已连接、产物已批准或平台已发布。',
  nav: {
    campaigns: 'Campaigns / Start',
    setup: 'Setup & Readiness',
    mission: 'Mission Workspace',
    review: 'Review & Action',
    learn: 'Response & Learn'
  }
};

const mission: MissionCopy = {
  rail: 'Activation Units',
  composer: 'Editable Composer',
  preview: 'Native-like Preview',
  constraint: '能力快照未连接',
  disclaimer: '近似预览；平台原生渲染可能变化。',
  platforms: [
    {id: 'x', label: 'X · PREPARE ONLY'},
    {id: 'bluesky', label: 'Bluesky · NOT CONNECTED'},
    {id: 'linkedin', label: 'LinkedIn · HANDOFF PLANNED'},
    {id: 'xiaohongshu', label: '小红书 · HANDOFF PLANNED'}
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
      eyebrow: '03 · 协作空间',
      title: '同一个事实核，四种平台原生表达。',
      summary: '这是 UI 状态合同，不是 Agent 运行或平台连接证据。',
      status: 'ADAPTER CONTRACT ONLY · 无 Agent turn',
      basis: '当前依据：六角色拓扑合同与四平台 Preview 计划',
      next: '审阅信息层级与诚实能力标签，不执行任何外部动作。'
    },
    mission
  }
};
