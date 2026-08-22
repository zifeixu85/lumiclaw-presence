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
import {Kysely,PostgresDialect,type Selectable,type Transaction} from 'kysely';
import {Pool} from 'pg';
import type {Database,MissionBundleStatusEventsV2Table} from './database.js';

export class PostgresGoalPlanRepository implements GoalPlanRepository {
  readonly #pool:Pool;readonly #database:Kysely<Database>;
  public constructor(connectionString:string){this.#pool=new Pool({connectionString,max:4});this.#database=new Kysely<Database>({dialect:new PostgresDialect({pool:this.#pool})});this.#pool.on('error',(error)=>console.error('PostgreSQL goal-plan idle client error',error.message));}
  public async health():Promise<boolean>{const result=await this.#pool.query<{exists:boolean}>("select to_regclass('public.mission_bundle_generations_v2') is not null as exists");return result.rows[0]?.exists===true;}

  public async getWorkspace(ownerId:string):Promise<GoalWorkspace>{
    const [goalRows,planRows,bundleRows,eventRows]=await Promise.all([
      this.#database.selectFrom('operating_goal_revisions').selectAll().where('owner_profile_id','=',ownerId).orderBy('goal_id').orderBy('revision').execute(),
      this.#database.selectFrom('content_plan_revisions_v2').selectAll().where('owner_profile_id','=',ownerId).orderBy('plan_id').orderBy('revision').execute(),
      this.#database.selectFrom('mission_bundle_generations_v2').selectAll().where('owner_profile_id','=',ownerId).orderBy('mission_intent_id').orderBy('generation').execute(),
      this.#database.selectFrom('mission_bundle_status_events_v2').selectAll().where('owner_profile_id','=',ownerId).orderBy('created_at').execute()
    ]);
    const goals=goalRows.map((row)=>json<OperatingGoalRevision>(row.payload));const plans=planRows.map((row)=>json<ContentPlanRevision>(row.payload));const bundles=bundleRows.map((row)=>json<MissionBundle>(row.payload));const invalidations=eventRows.map(eventFromRow);
    return {goals,plans,bundles,invalidations,bundleStates:bundles.map((bundle)=>{const event=[...invalidations].reverse().find((candidate)=>candidate.bundleId===bundle.bundleId);return {bundleId:bundle.bundleId,state:event===undefined?bundle.state:'INVALIDATED',reasonCode:event?.reasonCode??null,recoveryAction:event?.recoveryAction??null};})};
  }
  public async getGoal(ownerId:string,goalId:string):Promise<OperatingGoalRevision|undefined>{const row=await this.#database.selectFrom('operating_goal_heads as h').innerJoin('operating_goal_revisions as r',(join)=>join.onRef('r.owner_profile_id','=','h.owner_profile_id').onRef('r.goal_id','=','h.goal_id').onRef('r.revision','=','h.current_revision')).select('r.payload').where('h.owner_profile_id','=',ownerId).where('h.goal_id','=',goalId).executeTakeFirst();return row===undefined?undefined:json(row.payload);}
  public async getPlan(ownerId:string,planId:string):Promise<ContentPlanRevision|undefined>{const row=await this.#database.selectFrom('content_plan_heads_v2 as h').innerJoin('content_plan_revisions_v2 as r',(join)=>join.onRef('r.owner_profile_id','=','h.owner_profile_id').onRef('r.plan_id','=','h.plan_id').onRef('r.revision','=','h.current_revision')).select('r.payload').where('h.owner_profile_id','=',ownerId).where('h.plan_id','=',planId).executeTakeFirst();return row===undefined?undefined:json(row.payload);}
  public async getBundle(ownerId:string,bundleId:string):Promise<MissionBundle|undefined>{const row=await this.#database.selectFrom('mission_bundle_generations_v2').select('payload').where('owner_profile_id','=',ownerId).where('bundle_id','=',bundleId).executeTakeFirst();return row===undefined?undefined:json(row.payload);}

  public async appendGoal(ownerId:string,goal:OperatingGoalRevision,bindings:AccountProfileBinding[],expectedHeadDigest:string|null,guard:GoalKnowledgeGuard,idempotencyKey:string,now:Date){
    return this.withIdempotency(ownerId,'GOAL_APPEND',idempotencyKey,{goalDigest:goal.canonicalDigest,bindings,expectedHeadDigest,guard},now,async(trx)=>{
      if(goal.ownerId!==ownerId||goal.knowledgeSnapshotId!==guard.snapshotId||goal.knowledgeSnapshotDigest!==guard.snapshotDigest)throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');await this.assertKnowledgeGuard(trx,ownerId,guard,bindings);
      const head=await trx.selectFrom('operating_goal_heads').selectAll().where('owner_profile_id','=',ownerId).where('goal_id','=',goal.goalId).forUpdate().executeTakeFirst();
      if(head===undefined){if(expectedHeadDigest!==null||goal.revision!==1||goal.parentDigest!==null)throw new GoalPlanContractError('GOAL_VERSION_CONFLICT');}
      else if(head.current_digest.trim()!==expectedHeadDigest||goal.parentDigest!==expectedHeadDigest||goal.revision!==head.current_revision+1)throw new GoalPlanContractError('GOAL_VERSION_CONFLICT');
      await trx.insertInto('operating_goal_revisions').values({owner_profile_id:ownerId,goal_id:goal.goalId,revision:goal.revision,state:goal.state,canonical_digest:goal.canonicalDigest,parent_digest:goal.parentDigest,knowledge_snapshot_id:goal.knowledgeSnapshotId,knowledge_snapshot_digest:goal.knowledgeSnapshotDigest,selected_account_ids:JSON.stringify(goal.selectedAccountIds),payload:JSON.stringify(goal),created_at:goal.createdAt}).execute();
      for(const binding of bindings)await trx.insertInto('operating_goal_account_bindings').values({owner_profile_id:ownerId,goal_id:goal.goalId,goal_revision:goal.revision,account_profile_revision_id:binding.accountProfileRevisionId,profile_digest:binding.digest,platform_code:binding.platformCode,producer_mandates:JSON.stringify(binding.producerMandates)}).execute();
      if(head===undefined)await trx.insertInto('operating_goal_heads').values({owner_profile_id:ownerId,goal_id:goal.goalId,current_revision:goal.revision,current_digest:goal.canonicalDigest,row_version:1,state:goal.state,updated_at:now}).execute();
      else await trx.updateTable('operating_goal_heads').set({current_revision:goal.revision,current_digest:goal.canonicalDigest,row_version:head.row_version+1,state:goal.state,updated_at:now}).where('owner_profile_id','=',ownerId).where('goal_id','=',goal.goalId).executeTakeFirstOrThrow();
      if(head!==undefined&&head.current_digest.trim()!==goal.canonicalDigest)await this.invalidateTx(trx,ownerId,'GOAL_REVISION_CHANGED',goal.canonicalDigest,now);
      return {goal,replayed:false};
    });
  }

  public async appendBundle(ownerId:string,bundle:MissionBundle,expectedGoalDigest:string,idempotencyKey:string,now:Date){
    return this.withIdempotency(ownerId,'BUNDLE_APPEND',idempotencyKey,{bundleDigest:bundle.canonicalDigest,expectedGoalDigest},now,async(trx)=>{
      if(bundle.ownerId!==ownerId||bundle.inputBindings.operatingGoal.digest!==expectedGoalDigest)throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');await this.assertCurrentGoalAndInputs(trx,ownerId,bundle,expectedGoalDigest);
      const existing=await trx.selectFrom('mission_bundle_generations_v2').selectAll().where('owner_profile_id','=',ownerId).where('bundle_id','=',bundle.bundleId).executeTakeFirst();if(existing!==undefined){if(existing.canonical_digest.trim()!==bundle.canonicalDigest)throw new GoalPlanContractError('MISSION_DIGEST_MISMATCH');return {bundle:json<MissionBundle>(existing.payload),replayed:true};}
      await this.insertBundle(trx,bundle,now);return {bundle,replayed:false};
    });
  }

  public async appendPlan(ownerId:string,plan:ContentPlanRevision,expectedHeadDigest:string|null,idempotencyKey:string,now:Date){
    return this.withIdempotency(ownerId,'PLAN_APPEND',idempotencyKey,{planDigest:plan.canonicalDigest,expectedHeadDigest},now,async(trx)=>{
      if(plan.ownerId!==ownerId)throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');await this.assertIntentAvailable(trx,ownerId,plan.intentBundleId,plan.intentBundleDigest);
      const head=await trx.selectFrom('content_plan_heads_v2').selectAll().where('owner_profile_id','=',ownerId).where('plan_id','=',plan.planId).forUpdate().executeTakeFirst();
      if(head===undefined){if(expectedHeadDigest!==null||plan.revision!==1||plan.parentDigest!==null)throw new GoalPlanContractError('PLAN_VERSION_CONFLICT');}
      else if(head.current_digest.trim()!==expectedHeadDigest||plan.parentDigest!==expectedHeadDigest||plan.revision!==head.current_revision+1)throw new GoalPlanContractError('PLAN_VERSION_CONFLICT');
      await this.insertPlan(trx,plan,now);if(head===undefined)await trx.insertInto('content_plan_heads_v2').values({owner_profile_id:ownerId,plan_id:plan.planId,current_revision:plan.revision,current_digest:plan.canonicalDigest,row_version:1,state:plan.state,updated_at:now}).execute();else await trx.updateTable('content_plan_heads_v2').set({current_revision:plan.revision,current_digest:plan.canonicalDigest,row_version:head.row_version+1,state:plan.state,updated_at:now}).where('owner_profile_id','=',ownerId).where('plan_id','=',plan.planId).executeTakeFirstOrThrow();
      if(head!==undefined)await this.invalidateTx(trx,ownerId,'PLAN_REVISION_CHANGED',plan.canonicalDigest,now,undefined,true);return {plan,replayed:false};
    });
  }

  public async approvePlanAndAppendBundle(ownerId:string,expectedPlanDigest:string,approvedPlan:ContentPlanRevision,bundle:MissionExecutionBundle,idempotencyKey:string,now:Date){
    return this.withIdempotency(ownerId,'PLAN_APPROVE_EXECUTION_APPEND',idempotencyKey,{expectedPlanDigest,approvedPlanDigest:approvedPlan.canonicalDigest,bundleDigest:bundle.canonicalDigest},now,async(trx)=>{
      if(approvedPlan.ownerId!==ownerId||bundle.ownerId!==ownerId||approvedPlan.state!=='APPROVED'||bundle.approvedPlanDigest!==approvedPlan.canonicalDigest)throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');await this.assertIntentAvailable(trx,ownerId,approvedPlan.intentBundleId,approvedPlan.intentBundleDigest);
      const head=await trx.selectFrom('content_plan_heads_v2').selectAll().where('owner_profile_id','=',ownerId).where('plan_id','=',approvedPlan.planId).forUpdate().executeTakeFirst();if(head===undefined||head.current_digest.trim()!==expectedPlanDigest||approvedPlan.parentDigest!==expectedPlanDigest||approvedPlan.revision!==head.current_revision+1)throw new GoalPlanContractError('PLAN_DIGEST_MISMATCH');
      const duplicate=await trx.selectFrom('mission_bundle_generations_v2').select('canonical_digest').where('owner_profile_id','=',ownerId).where('mission_intent_id','=',bundle.missionIntentId).where('generation','=',bundle.generation).executeTakeFirst();if(duplicate!==undefined)throw new GoalPlanContractError('MISSION_GENERATION_CONFLICT');
      await this.insertPlan(trx,approvedPlan,now);await trx.updateTable('content_plan_heads_v2').set({current_revision:approvedPlan.revision,current_digest:approvedPlan.canonicalDigest,row_version:head.row_version+1,state:'APPROVED',updated_at:now}).where('owner_profile_id','=',ownerId).where('plan_id','=',approvedPlan.planId).executeTakeFirstOrThrow();await this.insertBundle(trx,bundle,now);await this.invalidateTx(trx,ownerId,'PLAN_REVISION_CHANGED',approvedPlan.canonicalDigest,now,bundle.bundleId,true);return {plan:approvedPlan,bundle,replayed:false};
    });
  }

  public async invalidateBundles(ownerId:string,reasonCode:InvalidationEvent['reasonCode'],currentDigest:string,now:Date):Promise<InvalidationEvent[]>{return this.#database.transaction().execute((trx)=>this.invalidateTx(trx,ownerId,reasonCode,currentDigest,now,undefined,reasonCode==='PLAN_REVISION_CHANGED'));}
  public async close():Promise<void>{await this.#database.destroy();}

  private async assertKnowledgeGuard(trx:Transaction<Database>,ownerId:string,guard:GoalKnowledgeGuard,bindings:AccountProfileBinding[]):Promise<void>{
    const session=await trx.selectFrom('local_onboarding_sessions').selectAll().where('owner_profile_id','=',ownerId).forUpdate().executeTakeFirst();if(session===undefined)throw new GoalPlanContractError('OWNER_BOUNDARY_VIOLATION');if(session.knowledge_state!=='KNOWLEDGE_APPROVED_NEEDS_GOAL'||session.row_version!==guard.rowVersion||session.current_knowledge_snapshot_id!==guard.snapshotId||session.current_knowledge_snapshot_digest?.trim()!==guard.snapshotDigest)throw new GoalPlanContractError('KNOWLEDGE_SNAPSHOT_STALE');
    const snapshot=await trx.selectFrom('knowledge_snapshots').select(['state','canonical_digest']).where('owner_profile_id','=',ownerId).where('id','=',guard.snapshotId).executeTakeFirst();if(snapshot?.state!=='APPROVED'||snapshot.canonical_digest.trim()!==guard.snapshotDigest)throw new GoalPlanContractError('KNOWLEDGE_SNAPSHOT_NOT_APPROVED');
    for(const binding of bindings){const row=await trx.selectFrom('knowledge_profile_revisions').select(['digest','kind','platform_code']).where('owner_profile_id','=',ownerId).where('id','=',binding.accountProfileRevisionId).executeTakeFirst();if(row===undefined||row.kind!=='ACCOUNT'||row.platform_code!==binding.platformCode||row.digest.trim()!==binding.digest||!guard.accountProfileDigests.some((item)=>item.revisionId===binding.accountProfileRevisionId&&item.digest===binding.digest))throw new GoalPlanContractError('ACCOUNT_PROFILE_MISSING');}
  }
  private async assertCurrentGoalAndInputs(trx:Transaction<Database>,ownerId:string,bundle:MissionBundle,expectedGoalDigest:string):Promise<void>{
    const head=await trx.selectFrom('operating_goal_heads').selectAll().where('owner_profile_id','=',ownerId).where('goal_id','=',bundle.inputBindings.operatingGoal.id).forUpdate().executeTakeFirst();if(head===undefined||head.current_digest.trim()!==expectedGoalDigest||head.state!=='ACTIVE')throw new GoalPlanContractError('MISSION_INPUT_CHANGED');
    const guard:GoalKnowledgeGuard={rowVersion:(await trx.selectFrom('local_onboarding_sessions').select('row_version').where('owner_profile_id','=',ownerId).executeTakeFirstOrThrow()).row_version,snapshotId:bundle.inputBindings.knowledgeSnapshot.id,snapshotDigest:bundle.inputBindings.knowledgeSnapshot.digest,accountProfileDigests:bundle.inputBindings.accountProfiles.map((item)=>({revisionId:item.accountProfileRevisionId,digest:item.digest}))};await this.assertKnowledgeGuard(trx,ownerId,guard,bundle.inputBindings.accountProfiles);
  }
  private async assertIntentAvailable(trx:Transaction<Database>,ownerId:string,bundleId:string,digest:string):Promise<void>{const row=await trx.selectFrom('mission_bundle_generations_v2').select(['canonical_digest','kind']).where('owner_profile_id','=',ownerId).where('bundle_id','=',bundleId).executeTakeFirst();if(row===undefined||row.kind!=='MISSION_INTENT'||row.canonical_digest.trim()!==digest)throw new GoalPlanContractError('MISSION_INPUT_CHANGED');const invalid=await trx.selectFrom('mission_bundle_status_events_v2').select('event_id').where('owner_profile_id','=',ownerId).where('bundle_id','=',bundleId).executeTakeFirst();if(invalid!==undefined)throw new GoalPlanContractError('MISSION_INPUT_CHANGED');}
  private async insertPlan(trx:Transaction<Database>,plan:ContentPlanRevision,now:Date):Promise<void>{await trx.insertInto('content_plan_revisions_v2').values({owner_profile_id:plan.ownerId,plan_id:plan.planId,revision:plan.revision,goal_id:plan.goalId,goal_revision:plan.goalRevision,mission_intent_id:plan.missionIntentId,intent_bundle_id:plan.intentBundleId,state:plan.state,canonical_digest:plan.canonicalDigest,parent_digest:plan.parentDigest,payload:JSON.stringify(plan),created_at:now}).execute();}
  private async insertBundle(trx:Transaction<Database>,bundle:MissionBundle,now:Date):Promise<void>{await trx.insertInto('mission_bundle_generations_v2').values({owner_profile_id:bundle.ownerId,bundle_id:bundle.bundleId,mission_intent_id:bundle.missionIntentId,generation:bundle.generation,kind:bundle.kind,canonical_digest:bundle.canonicalDigest,compiler_version:bundle.compilerVersion,parent_bundle_id:bundle.kind==='MISSION_EXECUTION'?bundle.parentBundleId:null,goal_id:bundle.inputBindings.operatingGoal.id,goal_revision:bundle.inputBindings.operatingGoal.revision,goal_digest:bundle.inputBindings.operatingGoal.digest,plan_id:bundle.kind==='MISSION_EXECUTION'?bundle.approvedPlanId:null,plan_revision:bundle.kind==='MISSION_EXECUTION'?bundle.approvedPlanRevision:null,plan_digest:bundle.kind==='MISSION_EXECUTION'?bundle.approvedPlanDigest:null,payload:JSON.stringify(bundle),created_at:now}).execute();}
  private async invalidateTx(trx:Transaction<Database>,ownerId:string,reasonCode:InvalidationEvent['reasonCode'],currentDigest:string,now:Date,exceptBundleId?:string,executionOnly=false):Promise<InvalidationEvent[]>{
    let query=trx.selectFrom('mission_bundle_generations_v2').selectAll().where('owner_profile_id','=',ownerId);if(exceptBundleId!==undefined)query=query.where('bundle_id','!=',exceptBundleId);if(executionOnly)query=query.where('kind','=','MISSION_EXECUTION');const bundles=await query.execute();const events:InvalidationEvent[]=[];
    for(const row of bundles){const existing=await trx.selectFrom('mission_bundle_status_events_v2').select('event_id').where('owner_profile_id','=',ownerId).where('bundle_id','=',row.bundle_id).executeTakeFirst();if(existing!==undefined)continue;const bundle=json<MissionBundle>(row.payload);const previousDigest=reasonCode==='KNOWLEDGE_SNAPSHOT_CHANGED'?bundle.inputBindings.knowledgeSnapshot.digest:reasonCode==='GOAL_REVISION_CHANGED'?bundle.inputBindings.operatingGoal.digest:bundle.kind==='MISSION_EXECUTION'?bundle.approvedPlanDigest:bundle.canonicalDigest;if(previousDigest===currentDigest)continue;const event:InvalidationEvent={eventId:stableContractId('invalidation',{bundleId:bundle.bundleId,reasonCode,previousDigest,currentDigest}),ownerId,bundleId:bundle.bundleId,reasonCode,previousDigest,currentDigest,recoveryAction:'REVIEW_AND_COMPILE_NEW_GENERATION',createdAt:now.toISOString()};await trx.insertInto('mission_bundle_status_events_v2').values({owner_profile_id:ownerId,event_id:event.eventId,bundle_id:event.bundleId,state:'INVALIDATED',reason_code:event.reasonCode,previous_digest:event.previousDigest,current_digest:event.currentDigest,recovery_action:event.recoveryAction,created_at:now}).execute();events.push(event);}
    return events;
  }
  private async withIdempotency<T extends {replayed:boolean}>(ownerId:string,route:string,key:string,request:unknown,now:Date,operation:(trx:Transaction<Database>)=>Promise<T>):Promise<T>{if(key.length<8||key.length>128)throw new GoalPlanContractError('IDEMPOTENCY_KEY_REQUIRED');const requestDigest=sha256Digest(request);return this.#database.transaction().execute(async(trx)=>{const existing=await trx.selectFrom('goal_plan_idempotency_records_v2').selectAll().where('owner_profile_id','=',ownerId).where('route','=',route).where('idempotency_key','=',key).executeTakeFirst();if(existing!==undefined){if(existing.request_digest.trim()!==requestDigest)throw new GoalPlanContractError('IDEMPOTENCY_KEY_REUSED');return {...json<T>(existing.response_body),replayed:true};}const response=await operation(trx);await trx.insertInto('goal_plan_idempotency_records_v2').values({owner_profile_id:ownerId,route,idempotency_key:key,request_digest:requestDigest,response_body:JSON.stringify(response),created_at:now}).execute();return response;});}
}

function eventFromRow(row:Selectable<MissionBundleStatusEventsV2Table>):InvalidationEvent{return {eventId:row.event_id,ownerId:row.owner_profile_id,bundleId:row.bundle_id,reasonCode:row.reason_code,previousDigest:row.previous_digest.trim(),currentDigest:row.current_digest.trim(),recoveryAction:row.recovery_action,createdAt:iso(row.created_at)};}
function json<T>(value:unknown):T{return (typeof value==='string'?JSON.parse(value):value) as T;}
function iso(value:Date|string):string{return value instanceof Date?value.toISOString():new Date(value).toISOString();}
