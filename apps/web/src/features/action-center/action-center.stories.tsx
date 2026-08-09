import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {ActionCenter} from './action-center';
import {getActionCenterCopy} from './action-center-copy';
import {createActionCenterFixture} from './action-center-fixtures';

const meta = {
  title: 'SDD-004/Action Center State Matrix',
  component: ActionCenter,
  parameters: {
    layout: 'fullscreen',
    a11y: {test: 'error'},
    docs: {
      description: {
        component: 'Public-safe Action Center UI foundation. Every story is synthetic, NOT_LIVE, and has no API, credential, connector, scheduler, operator, or platform action.'
      }
    }
  },
  args: {
    copy: getActionCenterCopy('zh-CN'),
    model: createActionCenterFixture('GRANT_READY')
  }
} satisfies Meta<typeof ActionCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GrantReady: Story = {};
export const GrantIssued: Story = {args: {model: createActionCenterFixture('GRANT_ISSUED')}};
export const OwnerActionRequired: Story = {args: {model: createActionCenterFixture('OWNER_ACTION_REQUIRED')}};
export const PublishedWithNativeEvidence: Story = {args: {model: createActionCenterFixture('PUBLISHED')}};
export const UnknownReconciliationOnly: Story = {args: {model: createActionCenterFixture('UNKNOWN')}};
export const FailedNewDecisionOnly: Story = {args: {model: createActionCenterFixture('FAILED')}};
export const ExpiredTerminal: Story = {args: {model: createActionCenterFixture('EXPIRED')}};
export const RevokedTerminal: Story = {args: {model: createActionCenterFixture('REVOKED')}};

export const InteractiveGrantConfirmation: Story = {args: {onIntent: () => undefined}};

export const EnglishUnknownNarrow: Story = {
  args: {
    copy: getActionCenterCopy('en'),
    model: createActionCenterFixture('UNKNOWN', 'en')
  },
  parameters: {viewport: {defaultViewport: 'mobile1'}}
};
