import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {ShadowMissionWorkspace} from './shadow-mission-workspace';

const meta = {
  title: 'M2/Governed SHADOW Mission States',
  component: ShadowMissionWorkspace,
  parameters: {layout: 'fullscreen', docs: {description: {component: 'Business-first Mission/Review state matrix. Every fixture is DEMO_SEED / NOT_LIVE and performs no network, AgentTeams, model, connector, schedule, or platform action.'}}},
  args: {locale: 'zh-CN', route: 'mission'}
} satisfies Meta<typeof ShadowMissionWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {args: {fixtureState: 'empty'}};
export const PrerequisiteBlocked: Story = {args: {fixtureState: 'prerequisite-blocked'}};
export const Queued: Story = {args: {fixtureState: 'queued'}};
export const Running: Story = {args: {fixtureState: 'running'}};
export const WaitingDependency: Story = {args: {fixtureState: 'waiting-dependency'}};
export const NeedsOwner: Story = {args: {fixtureState: 'needs-owner'}};
export const Failed: Story = {args: {fixtureState: 'failed'}};
export const TimedOut: Story = {args: {fixtureState: 'timed-out'}};
export const Cancelled: Story = {args: {fixtureState: 'cancelled'}};
export const UnknownRecovery: Story = {args: {fixtureState: 'unknown-recovery'}};
export const AuditBlocked: Story = {args: {fixtureState: 'audit-blocked'}};
export const RevisionRequired: Story = {args: {fixtureState: 'revision-required'}};
export const ShadowComplete: Story = {args: {fixtureState: 'shadow-complete'}};
export const EnglishQueued390px: Story = {args: {locale: 'en', fixtureState: 'queued'}, parameters: {viewport: {defaultViewport: 'mobile1'}}};
