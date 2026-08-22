import {
  GoalPlanContractError,
  sha256Digest,
  stableContractId,
  type AccountProfileBinding,
  type ContentPlanRevision,
  type GoalKnowledgeGuard,
  type GoalPlanRepository,
  type GoalWorkspace,
  type InvalidationEvent,
  type MissionBundle,
  type MissionExecutionBundle,
  type OperatingGoalRevision
} from '@lumiclaw/domain';

export class MemoryGoalPlanRepository implements GoalPlanRepository {
  readonly #goals: OperatingGoalRevision[] = [];
  readonly #plans: ContentPlanRevision[] = [];
  readonly #bundles: MissionBundle[] = [];
  readonly #invalidations: InvalidationEvent[] = [];
  readonly #idempotency = new Map<string,{digest:string;response:unknown}>();

  public async health(): Promise<boolean> { return true; }

  public async getWorkspace(ownerId: string): Promise<GoalWorkspace> {
    const goals = this.#goals.filter((goal) => goal.ownerId === ownerId);
    const plans = this.#plans.filter((plan) => plan.ownerId === ownerId);
    const bundles = this.#bundles.filter((bundle) => bundle.ownerId === ownerId);
    const invalidations = this.#invalidations.filter((event) => event.ownerId === ownerId);
    return clone({goals,plans,bundles,invalidations,bundleStates:bundles.map((bundle) => {
      const event = [...invalidations].reverse().find((candidate) => candidate.bundleId === bundle.bundleId);
      return {bundleId:bundle.bundleId,state:event === undefined ? bundle.state : 'INVALIDATED' as const,reasonCode:event?.reasonCode ?? null,recoveryAction:event?.recoveryAction ?? null};
    })});
  }

  public async getGoal(ownerId: string, goalId: string): Promise<OperatingGoalRevision | undefined> { return cloneOrUndefined(latest(this.#goals.filter((goal) => goal.ownerId === ownerId && goal.goalId === goalId))); }
  public async getPlan(ownerId: string, planId: string): Promise<ContentPlanRevision | undefined> { return cloneOrUndefined(latest(this.#plans.filter((plan) => plan.ownerId === ownerId && plan.planId === planId))); }
  public async getBundle(ownerId: string, bundleId: string): Promise<MissionBundle | undefined> { return cloneOrUndefined(this.#bundles.find((bundle) => bundle.ownerId === ownerId && bundle.bundleId === bundleId)); }

  public async appendGoal(ownerId: string, goal: OperatingGoalRevision, bindings: AccountProfileBinding[], expectedHeadDigest: string | null, guard: GoalKnowledgeGuard, idempotencyKey: string, now: Date): Promise<{goal: OperatingGoalRevision; replayed: boolean}> {
    void now;
    return this.idempotent(ownerId,'GOAL_APPEND',idempotencyKey,{goalDigest:goal.canonicalDigest,bindings,expectedHeadDigest,guard},() => {
      if (goal.ownerId !== ownerId || goal.knowledgeSnapshotId !== guard.snapshotId || goal.knowledgeSnapshotDigest !== guard.snapshotDigest) throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');
      if (goal.selectedAccountIds.length !== bindings.length || bindings.some((binding) => !goal.selectedAccountIds.includes(binding.accountProfileRevisionId) || !guard.accountProfileDigests.some((item) => item.revisionId === binding.accountProfileRevisionId && item.digest === binding.digest))) throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');
      const current = latest(this.#goals.filter((item) => item.ownerId === ownerId && item.goalId === goal.goalId));
      if (current === undefined) {
        if (expectedHeadDigest !== null || goal.revision !== 1 || goal.parentDigest !== null) throw new GoalPlanContractError('GOAL_VERSION_CONFLICT');
      } else if (expectedHeadDigest !== current.canonicalDigest || goal.parentDigest !== current.canonicalDigest || goal.revision !== current.revision + 1) throw new GoalPlanContractError('GOAL_VERSION_CONFLICT');
      this.#goals.push(clone(goal));
      if (current !== undefined && current.canonicalDigest !== goal.canonicalDigest) this.invalidateSync(ownerId,'GOAL_REVISION_CHANGED',goal.canonicalDigest,now);
      return {goal:clone(goal),replayed:false};
    });
  }

  public async appendBundle(ownerId: string, bundle: MissionBundle, expectedGoalDigest: string, idempotencyKey: string, now: Date): Promise<{bundle: MissionBundle; replayed: boolean}> {
    void now;
    return this.idempotent(ownerId,'BUNDLE_APPEND',idempotencyKey,{bundleDigest:bundle.canonicalDigest,expectedGoalDigest},() => {
      if (bundle.ownerId !== ownerId || bundle.inputBindings.operatingGoal.digest !== expectedGoalDigest) throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');
      const goal = latest(this.#goals.filter((item) => item.ownerId === ownerId && item.goalId === bundle.inputBindings.operatingGoal.id));
      if (goal === undefined || goal.canonicalDigest !== expectedGoalDigest || goal.state !== 'ACTIVE') throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
      const existing = this.#bundles.find((item) => item.ownerId === ownerId && item.bundleId === bundle.bundleId);
      if (existing !== undefined) {
        if (existing.canonicalDigest !== bundle.canonicalDigest) throw new GoalPlanContractError('MISSION_DIGEST_MISMATCH');
        return {bundle:clone(existing),replayed:true};
      }
      this.#bundles.push(clone(bundle));
      return {bundle:clone(bundle),replayed:false};
    });
  }

  public async appendPlan(ownerId: string, plan: ContentPlanRevision, expectedHeadDigest: string | null, idempotencyKey: string, now: Date): Promise<{plan: ContentPlanRevision; replayed: boolean}> {
    return this.idempotent(ownerId,'PLAN_APPEND',idempotencyKey,{planDigest:plan.canonicalDigest,expectedHeadDigest},() => {
      if (plan.ownerId !== ownerId) throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');
      const current = latest(this.#plans.filter((item) => item.ownerId === ownerId && item.planId === plan.planId));
      if (current === undefined) {
        if (expectedHeadDigest !== null || plan.revision !== 1 || plan.parentDigest !== null) throw new GoalPlanContractError('PLAN_VERSION_CONFLICT');
      } else if (expectedHeadDigest !== current.canonicalDigest || plan.parentDigest !== current.canonicalDigest || plan.revision !== current.revision + 1) throw new GoalPlanContractError('PLAN_VERSION_CONFLICT');
      this.#plans.push(clone(plan));
      if (current !== undefined && current.canonicalDigest !== plan.canonicalDigest) this.invalidateSync(ownerId,'PLAN_REVISION_CHANGED',plan.canonicalDigest,now);
      return {plan:clone(plan),replayed:false};
    });
  }

  public async approvePlanAndAppendBundle(ownerId: string, expectedPlanDigest: string, approvedPlan: ContentPlanRevision, bundle: MissionExecutionBundle, idempotencyKey: string, now: Date): Promise<{plan: ContentPlanRevision; bundle: MissionExecutionBundle; replayed: boolean}> {
    return this.idempotent(ownerId,'PLAN_APPROVE_EXECUTION_APPEND',idempotencyKey,{expectedPlanDigest,approvedPlanDigest:approvedPlan.canonicalDigest,bundleDigest:bundle.canonicalDigest},() => {
      const current = latest(this.#plans.filter((item) => item.ownerId === ownerId && item.planId === approvedPlan.planId));
      if (current === undefined || current.canonicalDigest !== expectedPlanDigest || approvedPlan.parentDigest !== expectedPlanDigest || approvedPlan.revision !== current.revision + 1) throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');
      if (approvedPlan.ownerId !== ownerId || bundle.ownerId !== ownerId || approvedPlan.state !== 'APPROVED' || bundle.approvedPlanDigest !== approvedPlan.canonicalDigest) throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');
      if (this.#bundles.some((item) => item.ownerId === ownerId && item.bundleId === bundle.bundleId)) throw new GoalPlanContractError('MISSION_GENERATION_CONFLICT');
      this.#plans.push(clone(approvedPlan)); this.#bundles.push(clone(bundle));
      this.invalidateSync(ownerId,'PLAN_REVISION_CHANGED',approvedPlan.canonicalDigest,now,bundle.bundleId);
      return {plan:clone(approvedPlan),bundle:clone(bundle),replayed:false};
    });
  }

  public async invalidateBundles(ownerId: string, reasonCode: InvalidationEvent['reasonCode'], currentDigest: string, now: Date): Promise<InvalidationEvent[]> { return clone(this.invalidateSync(ownerId,reasonCode,currentDigest,now)); }
  public async close(): Promise<void> {}

  private invalidateSync(ownerId: string, reasonCode: InvalidationEvent['reasonCode'], currentDigest: string, now: Date, exceptBundleId?: string): InvalidationEvent[] {
    const events: InvalidationEvent[] = [];
    for (const bundle of this.#bundles.filter((item) => item.ownerId === ownerId && item.bundleId !== exceptBundleId && (reasonCode !== 'PLAN_REVISION_CHANGED' || item.kind === 'MISSION_EXECUTION'))) {
      if (this.#invalidations.some((event) => event.bundleId === bundle.bundleId)) continue;
      const previousDigest = reasonCode === 'KNOWLEDGE_SNAPSHOT_CHANGED' ? bundle.inputBindings.knowledgeSnapshot.digest : reasonCode === 'GOAL_REVISION_CHANGED' ? bundle.inputBindings.operatingGoal.digest : bundle.kind === 'MISSION_EXECUTION' ? bundle.approvedPlanDigest : bundle.canonicalDigest;
      if (previousDigest === currentDigest) continue;
      const event: InvalidationEvent = {eventId:stableContractId('invalidation',{bundleId:bundle.bundleId,reasonCode,previousDigest,currentDigest}),ownerId,bundleId:bundle.bundleId,reasonCode,previousDigest,currentDigest,recoveryAction:'REVIEW_AND_COMPILE_NEW_GENERATION',createdAt:now.toISOString()};
      this.#invalidations.push(event); events.push(event);
    }
    return events;
  }

  private async idempotent<T>(ownerId: string, route: string, key: string, request: unknown, operation: () => T): Promise<T> {
    if (key.length < 8 || key.length > 128) throw new GoalPlanContractError('IDEMPOTENCY_KEY_REQUIRED');
    const id = `${ownerId}:${route}:${key}`; const digest = sha256Digest(request); const existing = this.#idempotency.get(id);
    if (existing !== undefined) { if (existing.digest !== digest) throw new GoalPlanContractError('IDEMPOTENCY_KEY_REUSED'); const replay = clone(existing.response) as T & {replayed?:boolean}; if ('replayed' in (replay as object)) replay.replayed = true; return replay; }
    const response = operation(); this.#idempotency.set(id,{digest,response:clone(response)}); return response;
  }
}

function latest<T extends {revision:number}>(items: T[]): T | undefined { return [...items].sort((left,right)=>right.revision-left.revision)[0]; }
function clone<T>(value:T):T{return structuredClone(value);}
function cloneOrUndefined<T>(value:T|undefined):T|undefined{return value===undefined?undefined:clone(value);}
