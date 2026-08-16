import type {LocalCampaignIdentityInput, LocalOnboardingContext, ManualPublishHandoff} from '@lumiclaw/domain';
import type {EnvironmentReadiness, SkillListResponse, TeamResponse, WorkspaceSnapshot} from './production-types';

export class ProductApiError extends Error {
  public constructor(public readonly code: string, public readonly status: number) { super(code); this.name = 'ProductApiError'; }
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot> { return requestJson('/api/v1/local-workspace'); }
export async function loadReadiness(): Promise<EnvironmentReadiness> { return requestJson('/api/v1/environment-readiness'); }
export async function loadTeam(): Promise<TeamResponse> { return requestJson('/api/v1/ai-team'); }
export async function loadSkills(): Promise<SkillListResponse> { return requestJson('/api/v1/skills'); }
export async function createLocalProfile(displayName: string): Promise<void> { await requestJson('/api/v1/local-owner-profile', {method: 'POST', body: JSON.stringify({displayName}), headers: {'content-type': 'application/json'}}); }
export async function useExampleWorkspace(): Promise<void> { await requestJson('/api/v1/local-onboarding/example', {method: 'POST'}); }
export async function selectMaterialPath(): Promise<void> { await requestJson('/api/v1/local-onboarding/materials-path', {method: 'POST'}); }
export async function uploadLocalMaterial(file: File): Promise<void> {
  await requestJson('/api/v1/local-materials', {method: 'POST', body: await file.arrayBuffer(), headers: {'content-type': file.type || 'application/octet-stream', 'x-lumiclaw-file-name': encodeURIComponent(file.name)}});
}
export async function saveOnboardingContext(context: LocalOnboardingContext): Promise<void> { await requestJson('/api/v1/local-onboarding/context', {method: 'POST', body: JSON.stringify(context), headers: {'content-type': 'application/json'}}); }
export async function completeLocalOnboarding(identity: LocalCampaignIdentityInput): Promise<void> { await requestJson('/api/v1/local-onboarding/complete', {method: 'POST', body: JSON.stringify(identity), headers: {'content-type': 'application/json'}}); }
export async function deleteLocalMaterial(materialId: string): Promise<void> { await requestJson(`/api/v1/local-materials/${materialId}`, {method: 'DELETE'}); }
export async function loadSkill(skillId: string): Promise<{skill: {content: string; files: string[]; license: string}}> { return requestJson(`/api/v1/skills/${skillId}`); }
export async function recordManualHandoff(input: {organizationId: string; campaignId: string; artifactRevisionId: string; platform: string; action: ManualPublishHandoff['action']}): Promise<{handoff: ManualPublishHandoff; createsPublishedState: false}> { return requestJson('/api/v1/manual-publish-handoffs', {method: 'POST', body: JSON.stringify(input), headers: {'content-type': 'application/json'}}); }

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {...init, cache: 'no-store'});
  const payload = await response.json() as {code?: string};
  if (!response.ok) throw new ProductApiError(payload.code ?? 'CONTROL_PLANE_UNAVAILABLE', response.status);
  return payload as T;
}
