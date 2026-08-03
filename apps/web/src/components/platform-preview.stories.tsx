import {createDemoCampaignDocument, type PlatformArtifact} from '@lumiclaw/domain';
import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {copy, PlatformPreview, type PreviewContext} from './campaign-workspace';

const document = createDemoCampaignDocument();
const content = (kind: PlatformArtifact['kind']) => document.artifactRevisions.find((item) => item.platform === kind)!.content;
const context: PreviewContext = {
  accountHandle: '@lumiclaw-demo',
  identityName: 'LumiClaw Presence',
  capturedAt: '2026-08-03T00:00:00.000Z',
  executionMode: 'PREPARE_ONLY',
  violations: []
};

const meta = {
  title: 'M1/Four Platform Previews',
  component: PlatformPreview,
  parameters: {docs: {description: {component: 'Distinct, editable-model preview surfaces. All stories are synthetic DEMO_SEED / NOT_LIVE and perform no action.'}}},
  args: {context, t: copy['zh-CN']}
} satisfies Meta<typeof PlatformPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const X: Story = {args: {content: content('X')}};
export const Bluesky: Story = {args: {content: content('BLUESKY')}};
export const LinkedIn: Story = {args: {content: content('LINKEDIN')}};
export const Xiaohongshu: Story = {args: {content: content('XIAOHONGSHU')}};
