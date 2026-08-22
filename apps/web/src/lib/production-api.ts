import type {AccountOperatingProfileInput, ContentBrief, ContentPlanRevision, ContentPlanSlot, KnowledgeOverview, KnowledgePlatform, KnowledgeStep, LocalCampaignIdentityInput, LocalOnboardingContext, MissionExecutionBundle, MissionIntentBundle, OperatingGoalInput, OperatingGoalRevision, OrganizationProfileInput, PersonaProfileInput, PlanSourceBinding, PlannerSubmission, ProductProfileInput, ProfileKind} from '@lumiclaw/domain';
import type {EnvironmentReadiness, SkillListResponse, TeamResponse, WorkspaceSnapshot} from './production-types';

export class ProductApiError extends Error {
  public constructor(public readonly code: string, public readonly status: number) { super(code); this.name = 'ProductApiError'; }
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot> { return requestJson('/api/v1/local-workspace'); }
export async function loadReadiness(): Promise<EnvironmentReadiness> { return requestJson('/api/v1/environment-readiness'); }
export async function loadTeam(): Promise<TeamResponse> { return requestJson('/api/v1/ai-team'); }
export async function loadSkills(): Promise<SkillListResponse> { return requestJson('/api/v1/skills'); }
export async function createLocalProfile(displayName: string): Promise<void> { await requestJson('/api/v1/local-owner-profile', {method: 'POST', body: JSON.stringify({displayName}), headers: {'content-type': 'application/json'}}); }
export async function selectExampleWorkspace(): Promise<void> { await requestJson('/api/v1/local-onboarding/example', {method: 'POST'}); }
export async function selectMaterialPath(): Promise<void> { await requestJson('/api/v1/local-onboarding/materials-path', {method: 'POST'}); }
export async function uploadLocalMaterial(file: File): Promise<void> {
  await requestJson('/api/v1/local-materials', {method: 'POST', body: await file.arrayBuffer(), headers: {'content-type': file.type || 'application/octet-stream', 'x-lumiclaw-file-name': encodeURIComponent(file.name)}});
}
export async function saveOnboardingContext(context: LocalOnboardingContext): Promise<void> { await requestJson('/api/v1/local-onboarding/context', {method: 'POST', body: JSON.stringify(context), headers: {'content-type': 'application/json'}}); }
export async function completeLocalOnboarding(identity: LocalCampaignIdentityInput): Promise<void> { await requestJson('/api/v1/local-onboarding/complete', {method: 'POST', body: JSON.stringify(identity), headers: {'content-type': 'application/json'}}); }
export async function deleteLocalMaterial(materialId: string): Promise<void> { await requestJson(`/api/v1/local-materials/${materialId}`, {method: 'DELETE'}); }
type KnowledgeMutationResponse={overview:KnowledgeOverview};
const knowledgeHeaders=(version:number,key:string):HeadersInit=>({'content-type':'application/json','if-match':`"knowledge-${version}"`,'idempotency-key':key});
const knowledgeControlHeaders=(version:number,key:string):HeadersInit=>({'if-match':`"knowledge-${version}"`,'idempotency-key':key});
const mutationKey=(prefix:string)=>`${prefix}-${crypto.randomUUID()}`;
export async function saveKnowledgeProfile(kind:Exclude<ProfileKind,'ACCOUNT'>,payload:PersonaProfileInput|OrganizationProfileInput|ProductProfileInput,version:number,nextStep:KnowledgeStep):Promise<KnowledgeOverview>{const saved=await requestJson<KnowledgeMutationResponse>(`/api/v1/profiles/${kind.toLowerCase()}`,{method:'PUT',headers:knowledgeHeaders(version,mutationKey(`profile-${kind}`)),body:JSON.stringify(payload)});return saveKnowledgeSession(saved.overview.session.rowVersion,{currentStep:nextStep});}
export async function saveAccountProfile(platform:KnowledgePlatform,payload:AccountOperatingProfileInput,version:number,nextStep:KnowledgeStep):Promise<KnowledgeOverview>{const saved=await requestJson<KnowledgeMutationResponse>(`/api/v1/profiles/accounts/${platform}`,{method:'PUT',headers:knowledgeHeaders(version,mutationKey(`account-${platform}`)),body:JSON.stringify(payload)});return saveKnowledgeSession(saved.overview.session.rowVersion,{currentStep:nextStep});}
export async function saveKnowledgeSession(version:number,input:{currentStep:KnowledgeStep;targetMarket?:string|null;contentLocale?:string|null;timeZone?:string|null}):Promise<KnowledgeOverview>{const response=await requestJson<KnowledgeMutationResponse>('/api/v1/onboarding/session',{method:'PUT',headers:knowledgeHeaders(version,mutationKey('session')),body:JSON.stringify(input)});return response.overview;}
export async function uploadKnowledgeFiles(files:File[],version:number):Promise<KnowledgeOverview>{let currentVersion=version;let overview:KnowledgeOverview|undefined;for(const file of files){const response=await requestJson<KnowledgeMutationResponse>('/api/v1/knowledge/sources',{method:'POST',headers:{'if-match':`"knowledge-${currentVersion}"`,'idempotency-key':mutationKey('source-file'),'content-type':file.type||'application/octet-stream','x-lumiclaw-file-name':encodeURIComponent(file.name)},body:await file.arrayBuffer()});overview=response.overview;currentVersion=overview.session.rowVersion;}if(overview===undefined)throw new ProductApiError('SOURCE_FILE_REQUIRED',422);return overview;}
export async function addKnowledgeText(label:string,text:string,version:number):Promise<KnowledgeOverview>{const response=await requestJson<KnowledgeMutationResponse>('/api/v1/knowledge/sources/text',{method:'POST',headers:knowledgeHeaders(version,mutationKey('source-text')),body:JSON.stringify({label,text})});return response.overview;}
export async function deleteKnowledgeSource(sourceId:string,version:number):Promise<KnowledgeOverview>{const response=await requestJson<KnowledgeMutationResponse>(`/api/v1/knowledge/sources/${sourceId}`,{method:'DELETE',headers:knowledgeControlHeaders(version,mutationKey('source-delete'))});return response.overview;}
export async function confirmLegacySource(sourceId:string,version:number):Promise<KnowledgeOverview>{const response=await requestJson<KnowledgeMutationResponse>(`/api/v1/knowledge/sources/${sourceId}/confirm`,{method:'POST',headers:knowledgeControlHeaders(version,mutationKey('source-confirm'))});return response.overview;}
export async function resolveKnowledgeConflict(conflictId:string,selectedItemId:string,note:string,version:number):Promise<KnowledgeOverview>{const response=await requestJson<KnowledgeMutationResponse>('/api/v1/knowledge/snapshots/resolve-conflict',{method:'POST',headers:knowledgeHeaders(version,mutationKey('conflict')),body:JSON.stringify({conflictId,selectedItemId,note})});return response.overview;}
export async function approveKnowledgeSnapshot(snapshotId:string,canonicalDigest:string,version:number):Promise<KnowledgeOverview>{const response=await requestJson<KnowledgeMutationResponse>('/api/v1/knowledge/snapshots/approve',{method:'POST',headers:knowledgeHeaders(version,mutationKey('snapshot-approve')),body:JSON.stringify({snapshotId,canonicalDigest})});return response.overview;}
export async function loadSkill(skillId: string): Promise<{skill: {content: string; files: string[]; license: string}}> { return requestJson(`/api/v1/skills/${skillId}`); }

type GoalMutationResponse = {goal: OperatingGoalRevision};
type IntentMutationResponse = {bundle: MissionIntentBundle; plannerExecution: {status: 'NOT_RUN'; fixtureAllowedForEngineering: true; agentTeamsExecuted: false}};
type PlanMutationResponse = {plan: ContentPlanRevision; agentTeamsExecuted: boolean; evidenceMaturity: string};
type ApprovalMutationResponse = {plan: ContentPlanRevision; bundle: MissionExecutionBundle; agentTeamsExecuted: false; externalActionAllowed: false};

export async function createOperatingGoal(value: OperatingGoalInput, knowledgeVersion: number): Promise<OperatingGoalRevision> {
  const response = await requestJson<GoalMutationResponse>('/api/v1/goals', {method: 'POST', headers: knowledgeHeaders(knowledgeVersion, mutationKey('goal-create')), body: JSON.stringify(value)});
  return response.goal;
}
export async function activateOperatingGoal(goal: OperatingGoalRevision): Promise<OperatingGoalRevision> {
  const response = await requestJson<GoalMutationResponse>(`/api/v1/goals/${goal.goalId}/activate`, {method: 'POST', headers: exactHeaders(goalEtagValue(goal), mutationKey('goal-activate')), body: JSON.stringify({canonicalDigest: goal.canonicalDigest})});
  return response.goal;
}
export async function compileMissionIntent(goal: OperatingGoalRevision): Promise<MissionIntentBundle> {
  const response = await requestJson<IntentMutationResponse>('/api/v1/missions/compile', {method: 'POST', headers: exactHeaders(goalEtagValue(goal), mutationKey('mission-intent')), body: JSON.stringify({goalId: goal.goalId, goalDigest: goal.canonicalDigest})});
  return response.bundle;
}
export async function importControlledPlannerSubmission(intent: MissionIntentBundle, submission: PlannerSubmission): Promise<ContentPlanRevision> {
  const response = await requestJson<PlanMutationResponse>('/api/v1/content-plans', {method: 'POST', headers: exactHeaders(bundleEtagValue(intent), mutationKey('plan-import')), body: JSON.stringify(submission)});
  return response.plan;
}
export async function reviseContentPlan(plan: ContentPlanRevision, slots: ContentPlanSlot[], currentBrief: ContentBrief, sourceBindings: PlanSourceBinding[]): Promise<ContentPlanRevision> {
  const response = await requestJson<PlanMutationResponse>(`/api/v1/content-plans/${plan.planId}`, {method: 'PATCH', headers: exactHeaders(planEtagValue(plan), mutationKey('plan-revise')), body: JSON.stringify({canonicalDigest: plan.canonicalDigest, slots, currentBrief, sourceBindings})});
  return response.plan;
}
export async function approveContentPlan(plan: ContentPlanRevision): Promise<ApprovalMutationResponse> {
  return requestJson(`/api/v1/content-plans/${plan.planId}/approve`, {method: 'POST', headers: exactHeaders(planEtagValue(plan), mutationKey('plan-approve')), body: JSON.stringify({canonicalDigest: plan.canonicalDigest})});
}

function exactHeaders(etag: string, key: string): HeadersInit { return {'content-type': 'application/json', 'if-match': etag, 'idempotency-key': key}; }
function goalEtagValue(goal: OperatingGoalRevision): string { return `"goal-${goal.goalId}-r${goal.revision}-${goal.canonicalDigest}"`; }
function planEtagValue(plan: ContentPlanRevision): string { return `"plan-${plan.planId}-r${plan.revision}-${plan.canonicalDigest}"`; }
function bundleEtagValue(bundle: MissionIntentBundle): string { return `"bundle-${bundle.bundleId}-g${bundle.generation}-${bundle.canonicalDigest}"`; }
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {...init, cache: 'no-store'});
  const payload = await response.json() as {code?: string};
  if (!response.ok) throw new ProductApiError(payload.code ?? 'CONTROL_PLANE_UNAVAILABLE', response.status);
  return payload as T;
}
