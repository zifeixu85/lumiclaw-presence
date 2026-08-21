import type {WorkspaceSection} from './production-types';

export const workspaceScreenIds = ['campaigns', 'ai-team', 'calendar', 'publish', 'feedback', 'knowledge', 'accounts', 'settings'] as const;
export type WorkspaceScreenId = (typeof workspaceScreenIds)[number];
export function isWorkspaceScreenId(value: string): value is WorkspaceScreenId { return workspaceScreenIds.some((screen) => screen === value); }

export function sectionForLegacyScreen(screen: string): WorkspaceSection {
  if (screen === 'setup') return 'knowledge';
  if (screen === 'mission' || screen === 'review') return 'campaigns';
  if (screen === 'learn') return 'feedback';
  return isWorkspaceScreenId(screen) ? screen : 'today';
}
