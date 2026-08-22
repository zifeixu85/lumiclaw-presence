import type {AgentTaskAttempt,ArtifactWorkspace, CampaignEnvelope, EnvironmentReadinessItem, GoalWorkspace, KnowledgeOverview, LocalMaterialManifest, LocalOnboardingSession, LocalOwnerProfile, ManualPublishAuthorization, ManualPublishHandoff,MissionJob,RuntimeEvent,RuntimeReadinessState} from '@lumiclaw/domain';

export type WorkspaceSection = 'today' | 'goals' | 'campaigns' | 'ai-team' | 'calendar' | 'publish' | 'feedback' | 'knowledge' | 'accounts' | 'settings';

export type WorkspaceSnapshot = {
  code: 'LOCAL_FIRST_OPEN' | 'LOCAL_WORKSPACE_REOPENED';
  profile: LocalOwnerProfile | null;
  session: LocalOnboardingSession | null;
  materials: LocalMaterialManifest[];
  handoffs: ManualPublishHandoff[];
  campaign: CampaignEnvelope | null;
  knowledge?: KnowledgeOverview | null;
  goals?: GoalWorkspace | null;
  artifacts?: ArtifactWorkspace | null;
  publishAuthorization: ManualPublishAuthorization;
};

export type EnvironmentReadiness = {code: string; secretCollectionAllowed: false; items: EnvironmentReadinessItem[]};

export type TeamAgent = {
  code: `A${0 | 1 | 2 | 3 | 4 | 5}`;
  roleId: string;
  name: string;
  responsibility: string;
  skillIds: string[];
  status: 'NOT_CONFIGURED' | 'IDLE' | 'RUNNING' | 'ERROR';
  runtimeActorId?:string|null;attemptId?:string|null;taskId?:string|null;
  metrics: {tokens:null;tokenSource:'NO_RUNTIME_OBSERVATION';dailyCompleted:number|null;completionSource:'NO_RUNTIME_OBSERVATION'|'POSTGRESQL_RUNTIME_OBSERVATION'};
};

export type RepositorySkill = {id: string; name: string; roleIds: readonly string[]; state: 'AVAILABLE'; license: 'Apache-2.0'};
export type TeamResponse = {code: string; metricSource: string; agents: TeamAgent[];readiness?:RuntimeReadinessState;reasonCode?:string|null;runtimeVersion?:string;runtimeDigest?:string;teamProfileVersion?:string;teamProfileDigest?:string;bundleDigest?:string|null;runId?:string|null;lastHeartbeat?:string|null;jobs?:MissionJob[];attempts?:AgentTaskAttempt[];events?:RuntimeEvent[];boundary?:{runtimeSucceededMeans:string;auditPass:false;ownerApproved:false;published:false;businessSuccess:false}};
export type SkillListResponse = {code: string; source: 'REPOSITORY_OWNED'; skills: RepositorySkill[]};
