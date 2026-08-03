import type {PlatformArtifact} from '@lumiclaw/domain';
import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {copy, PlatformPreview, type PreviewContext} from './campaign-workspace';

const content: Record<PlatformArtifact['kind'], PlatformArtifact> = {
  X: {kind: 'X', posts: ['A local, evidence-bound campaign skeleton for global brand operations. No live action yet.'], altText: 'Synthetic LumiClaw product direction card.'},
  BLUESKY: {kind: 'BLUESKY', posts: ['We are building LumiClaw Presence as an evidence-bound global brand operations product.'], embedUrl: 'https://example.invalid/lumiclaw', altText: 'Synthetic product direction preview.'},
  LINKEDIN: {kind: 'LINKEDIN', commentary: 'LumiClaw Presence is a local, non-live campaign walking skeleton focused on governed global brand operations.', authorKind: 'COMPANY', linkTitle: 'LumiClaw Presence product direction', linkUrl: 'https://example.invalid/lumiclaw'},
  XIAOHONGSHU: {kind: 'XIAOHONGSHU', title: 'LumiClaw 本地体验', body: '这是一个只保存和预览、不执行真实发布的品牌运营骨架。', topics: ['品牌运营', '安全演示'], coverLabel: 'LumiClaw Presence 合成封面'}
};
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

export const X: Story = {args: {content: content.X}};
export const Bluesky: Story = {args: {content: content.BLUESKY}};
export const LinkedIn: Story = {args: {content: content.LINKEDIN}};
export const Xiaohongshu: Story = {args: {content: content.XIAOHONGSHU}};
