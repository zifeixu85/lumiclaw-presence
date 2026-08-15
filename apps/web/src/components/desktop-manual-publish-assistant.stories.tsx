import type {Meta, StoryObj} from '@storybook/nextjs-vite';
import {activationEvidenceCopy, manualPublishEvidenceItems, safetyBlockEvidence} from './activation-evidence-fixture';
import {DesktopManualPublishAssistant} from './desktop-manual-publish-assistant';

const meta = {
  title: 'M3/Desktop Manual Publish Assistant',
  component: DesktopManualPublishAssistant,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'SDD-004 CR1 public-safe desktop evidence. One manual “go publish” path only; no navigation, prefill, upload, URL return, Direct, credentials, or platform action.'
      }
    }
  }
} satisfies Meta<typeof DesktopManualPublishAssistant>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChineseDesktop: Story = {
  args: {locale: 'zh-CN', copy: activationEvidenceCopy('zh-CN'), items: manualPublishEvidenceItems, blocks: safetyBlockEvidence}
};

export const EnglishDesktop: Story = {
  args: {locale: 'en', copy: activationEvidenceCopy('en'), items: manualPublishEvidenceItems, blocks: safetyBlockEvidence}
};
