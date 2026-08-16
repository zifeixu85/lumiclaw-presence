import type {CampaignEnvelope, EnvironmentReadinessItem, LocalMaterialManifest, LocalOnboardingSession, LocalOwnerProfile, ManualPublishHandoff} from '@lumiclaw/domain';

export type WorkspaceSection = 'today' | 'campaigns' | 'ai-team' | 'calendar' | 'publish' | 'feedback' | 'knowledge' | 'accounts' | 'settings';

export type WorkspaceSnapshot = {
  code: 'LOCAL_FIRST_OPEN' | 'LOCAL_WORKSPACE_REOPENED';
  profile: LocalOwnerProfile | null;
  session: LocalOnboardingSession | null;
  materials: LocalMaterialManifest[];
  handoffs: ManualPublishHandoff[];
  campaign: CampaignEnvelope | null;
};

export type EnvironmentReadiness = {code: string; secretCollectionAllowed: false; items: EnvironmentReadinessItem[]};

export type TeamAgent = {
  code: `A${0 | 1 | 2 | 3 | 4 | 5}`;
  roleId: string;
  name: string;
  responsibility: string;
  skillIds: string[];
  status: 'NOT_CONFIGURED' | 'IDLE' | 'RUNNING' | 'ERROR';
  metrics: {tokens: number; dailyCompleted: number; source: 'NO_RUNTIME_OBSERVATION' | 'PUBLIC_SAFE_EXAMPLE'};
};

export type RepositorySkill = {id: string; name: string; roleIds: readonly string[]; state: 'AVAILABLE'; license: 'Apache-2.0'};
export type TeamResponse = {code: string; metricSource: string; agents: TeamAgent[]};
export type SkillListResponse = {code: string; source: 'REPOSITORY_OWNED'; skills: RepositorySkill[]};
