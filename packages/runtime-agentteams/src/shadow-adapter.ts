import {
  AGENTTEAMS_V120_BUILD_DIGEST, acceptRuntimeSubmission, acknowledgeRuntimeTask, cancelMission, markRecoveryUnknown, markTimedOut, reconcileMission,
  recordRuntimeProjectDispatch, runtimeDagDigest, runtimeMemberSetDigest, runtimeProjectDispatchReceiptDigest,
  runtimeTaskAckReceiptDigest, type RuntimeSubmission, type ShadowMission
} from '@lumiclaw/governed-shadow';

export type AgentTeamsMember = {name: string; roleIdentityId: string; runtimeActorId: string; runtime: 'copaw'; state: 'READY' | 'UNKNOWN'};
export type AgentTeamsProjectInput = {id: string; sourceDigest: string; leaderName: string; memberNames: string[]; executionMode: 'SHADOW_PREP_ONLY'; externalActionAllowed: false};
export type AgentTeamsTaskInput = {id: string; projectId: string; assigneeName: string; inputDigest: string; inputProjectionSchema: string; inputProjectionDigest: string | null; prerequisiteTaskIds: string[]; skillLockDigest: string; outputSchema: string; timeoutMs: number};
export type AgentTeamsRuntimeSnapshot = {projectId: string; state: string; taskStates: Record<string, string>; capturedAt: string};

export interface AgentTeamsV120Transport {
  identity(): Promise<{runtime: 'agentteams'; version: string; buildDigest: string}>;
  members(): Promise<AgentTeamsMember[]>;
  createProject(input: AgentTeamsProjectInput): Promise<void>;
  createTask(input: AgentTeamsTaskInput): Promise<void>;
  markReady(projectId: string): Promise<void>;
  acknowledge(projectId: string, taskId: string, memberName: string): Promise<{runtimeActorId: string; acknowledgedAt: string; state: 'in_progress'}>;
  observe(projectId: string): Promise<AgentTeamsRuntimeSnapshot>;
  cancel(projectId: string, unreleasedTaskIds: string[]): Promise<void>;
}

export type AdapterResult = {mission: ShadowMission; runtime: AgentTeamsRuntimeSnapshot | null; accepted: boolean; codes: string[]};

export class AgentTeamsV120ShadowAdapter {
  constructor(private readonly transport: AgentTeamsV120Transport, private readonly now: () => Date = () => new Date()) {}

  async dispatch(mission: ShadowMission): Promise<AdapterResult> {
    const identity = await this.transport.identity(); const codes: string[] = [];
    if (identity.version !== 'v1.2.0') codes.push('RUNTIME_VERSION_MISMATCH');
    if (!/^sha256:[a-f0-9]{64}$/u.test(identity.buildDigest)) codes.push('RUNTIME_BUILD_DIGEST_INVALID');
    const members = await this.transport.members();
    if (members.length !== 6) codes.push('MEMBER_COUNT_NOT_EXACTLY_SIX');
    const expected = new Map(mission.roleContexts.map((context) => [context.roleId, context.identityId]));
    for (const [role, identityId] of expected) if (!members.some((member) => member.name === role && member.roleIdentityId === identityId && member.runtime === 'copaw')) codes.push(`MEMBER_IDENTITY_MISMATCH:${role}`);
    if (new Set(members.map((member) => member.roleIdentityId)).size !== members.length || new Set(members.map((member) => member.runtimeActorId)).size !== members.length || members.some((member) => member.runtimeActorId.length === 0)) codes.push('MEMBER_IDENTITY_COLLISION');
    if (codes.length > 0) return {mission, runtime: null, accepted: false, codes};
    await this.transport.createProject({id: mission.runtimeProjectId, sourceDigest: mission.sourceCampaignDigest, leaderName: 'presence-mission-leader', memberNames: mission.roleContexts.map((item) => item.roleId), executionMode: 'SHADOW_PREP_ONLY', externalActionAllowed: false});
    for (const task of mission.tasks) await this.transport.createTask({id: task.id, projectId: mission.runtimeProjectId, assigneeName: task.roleId, inputDigest: task.inputDigest, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest, prerequisiteTaskIds: task.prerequisiteTaskIds, skillLockDigest: task.skillLockDigest, outputSchema: task.outputSchema, timeoutMs: task.timeoutMs});
    await this.transport.markReady(mission.runtimeProjectId); const runtime = await this.transport.observe(mission.runtimeProjectId);
    const memberBindings = mission.roleContexts.map((context) => ({roleId: context.roleId, roleIdentityId: context.identityId, runtimeActorId: members.find((member) => member.name === context.roleId)!.runtimeActorId}));
    const receiptBase = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, runtimeVersion: 'v1.2.0' as const, buildDigest: identity.buildDigest, memberBindings, memberSetDigest: runtimeMemberSetDigest(memberBindings), dagDigest: runtimeDagDigest(mission), dispatchedAt: runtime.capturedAt};
    const receipt = {...receiptBase, receiptDigest: runtimeProjectDispatchReceiptDigest(receiptBase)};
    return {mission: recordRuntimeProjectDispatch(mission, receipt, this.now()), runtime, accepted: true, codes: []};
  }

  async acknowledge(mission: ShadowMission, taskId: string, roleName: string): Promise<AdapterResult> {
    const task = mission.tasks.find((item) => item.id === taskId);
    if (task === undefined) return {mission, runtime: null, accepted: false, codes: ['TASK_NOT_FOUND']};
    if (task.roleId !== roleName) return {mission, runtime: null, accepted: false, codes: ['ACK_ROLE_MISMATCH']};
    if (!task.prerequisiteTaskIds.every((id) => mission.tasks.find((item) => item.id === id)?.state === 'ACCEPTED')) return {mission, runtime: null, accepted: false, codes: ['TASK_PREREQUISITE_NOT_ACCEPTED']};
    const observedAck = await this.transport.acknowledge(mission.runtimeProjectId, taskId, roleName); const runtime = await this.transport.observe(mission.runtimeProjectId);
    if (task.inputProjectionDigest === null) return {mission, runtime, accepted: false, codes: ['TASK_INPUT_PROJECTION_NOT_READY']};
    const receiptBase = {schemaVersion: 1 as const, projectId: mission.runtimeProjectId, taskId, roleId: task.roleId, runtimeActorId: observedAck.runtimeActorId, attempt: task.attempt, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest, runtimeState: observedAck.state, acknowledgedAt: observedAck.acknowledgedAt};
    const receipt = {...receiptBase, receiptDigest: runtimeTaskAckReceiptDigest(receiptBase)};
    return {mission: acknowledgeRuntimeTask(mission, receipt, this.now()), runtime, accepted: true, codes: []};
  }

  async importSubmission(mission: ShadowMission, submission: RuntimeSubmission): Promise<AdapterResult> {
    const next = acceptRuntimeSubmission(mission, submission, this.now()); const quarantined = next.trace.at(-1)?.kind === 'QUARANTINE'; const runtime = await this.transport.observe(mission.runtimeProjectId);
    return {mission: next, runtime, accepted: !quarantined, codes: quarantined ? String(next.trace.at(-1)?.detail.errors).split(',') : []};
  }

  async recover(mission: ShadowMission): Promise<AdapterResult> {
    try { const runtime = await this.transport.observe(mission.runtimeProjectId); const acceptedTaskIds = Object.entries(runtime.taskStates).filter(([, state]) => state === 'accepted').map(([id]) => id); return {mission: reconcileMission(mission, acceptedTaskIds, this.now()), runtime, accepted: true, codes: []}; }
    catch { return {mission: markRecoveryUnknown(mission, 'RUNTIME_RECONCILE_UNAVAILABLE', this.now()), runtime: null, accepted: false, codes: ['RUNTIME_RECONCILE_UNAVAILABLE']}; }
  }

  async timeout(mission: ShadowMission, taskId: string): Promise<AdapterResult> { return {mission: markTimedOut(mission, taskId, this.now()), runtime: await this.transport.observe(mission.runtimeProjectId), accepted: false, codes: ['TASK_TIMEOUT']}; }
  async cancel(mission: ShadowMission): Promise<AdapterResult> { const unreleased = mission.tasks.filter((item) => !['ACCEPTED', 'REJECTED'].includes(item.state)).map((item) => item.id); await this.transport.cancel(mission.runtimeProjectId, unreleased); return {mission: cancelMission(mission, this.now()), runtime: await this.transport.observe(mission.runtimeProjectId), accepted: true, codes: []}; }
}

export class InMemoryAgentTeamsV120Transport implements AgentTeamsV120Transport {
  readonly #projects = new Map<string, {state: string; tasks: Record<string, string>}>();
  constructor(private readonly memberList: AgentTeamsMember[], private readonly buildDigest = AGENTTEAMS_V120_BUILD_DIGEST, private readonly runtimeVersion = 'v1.2.0') {}
  async identity() { return {runtime: 'agentteams' as const, version: this.runtimeVersion, buildDigest: this.buildDigest}; }
  async members() { return structuredClone(this.memberList); }
  async createProject(input: AgentTeamsProjectInput) { if (input.externalActionAllowed) throw new Error('EXTERNAL_ACTION_NOT_ALLOWED'); this.#projects.set(input.id, {state: 'planning', tasks: {}}); }
  async createTask(input: AgentTeamsTaskInput) { const project = this.#projects.get(input.projectId); if (project === undefined) throw new Error('PROJECT_NOT_FOUND'); project.tasks[input.id] = input.prerequisiteTaskIds.length > 0 ? 'waiting_dependency' : 'assigned'; }
  async markReady(projectId: string) { this.#projects.get(projectId)!.state = 'ready'; }
  async acknowledge(projectId: string, taskId: string, memberName: string) { const member = this.memberList.find((candidate) => candidate.name === memberName); if (member === undefined) throw new Error('MEMBER_NOT_FOUND'); this.#projects.get(projectId)!.tasks[taskId] = 'in_progress'; return {runtimeActorId: member.runtimeActorId, acknowledgedAt: new Date(0).toISOString(), state: 'in_progress' as const}; }
  async observe(projectId: string) { const value = this.#projects.get(projectId); if (value === undefined) throw new Error('PROJECT_NOT_FOUND'); return {projectId, state: value.state, taskStates: structuredClone(value.tasks), capturedAt: new Date(0).toISOString()}; }
  async cancel(projectId: string, unreleasedTaskIds: string[]) { const value = this.#projects.get(projectId)!; for (const id of unreleasedTaskIds) value.tasks[id] = 'cancelled'; value.state = 'cancelled'; }
}
