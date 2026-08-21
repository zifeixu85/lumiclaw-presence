import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {MarketLocalizationEvidence} from './market-localization-evidence';

const meta = {
  title: 'M2/SDD-005 Market Localization Evidence',
  component: MarketLocalizationEvidence,
  parameters: {
    layout: 'fullscreen',
    docs: {description: {component: '隔离、中文优先的 PUBLIC_SAFE_FIXTURE 证据面。只展示 US/JP/DE 的来源、版本、合成覆盖、冲突与角色投影；不是客户证据，不执行外部动作。'}}
  },
  args: {initialMarket: 'US'}
} satisfies Meta<typeof MarketLocalizationEvidence>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeMarketSelector: Story = {};
export const JapanConflictBlocked: Story = {args: {initialMarket: 'JP'}};
export const GermanyThreeLayerPrecedence: Story = {args: {initialMarket: 'DE'}};
