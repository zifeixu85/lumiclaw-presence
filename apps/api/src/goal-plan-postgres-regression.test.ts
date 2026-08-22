import {LocalContentAddressedBlobStore} from '@lumiclaw/blob-store';
import {PostgresGoalPlanRepository,PostgresKnowledgeRepository,PostgresLocalPresenceRepository} from '@lumiclaw/db';
import {expectedPlanDates,stableContractId,type BundleInvalidationRequest,type ContentPlanRevision,type InvalidationEvent,type MissionExecutionBundle,type MissionIntentBundle,type OperatingGoalRevision,type PlannerSubmission,type ProducerRoleId} from '@lumiclaw/domain';
import {CONTENT_PLAN_SCHEMA_DIGEST,CONTENT_PLAN_SCHEMA_ID} from '@lumiclaw/mission-compiler';
import {Pool} from 'pg';
import {describe,expect,it} from 'vitest';
import {buildApi} from './server.js';

const connectionString=process.env.SDD009_POSTGRES_URL;
const blobRoot=process.env.SDD009_BLOB_ROOT??'/tmp/lumiclaw-sdd009-postgres-regression-blobs';
const suite=connectionString===undefined?describe.skip:describe;
const persona={displayName:'PostgreSQL Fixture Owner',role:'Founder',voice:'Evidence first',viewpoints:['Governed missions should be inspectable'],expressionBoundaries:['No outcome guarantees'],firstPersonRelationship:'First person for founder experience only',expressionExamples:['I will show the source.']};
const organization={name:'Public Safe PostgreSQL Studio',brandName:'LumiClaw fixture',description:'Synthetic engineering fixture.',audiences:['AI builders'],facts:['Release status is engineering candidate'],approvedClaims:[{statement:'Persistent goal compiler is under engineering verification',evidence:'Public repository tests'}]};
const product={name:'Presence fixture',description:'Governed public presence mission fixture.',valueProposition:'Make planning inputs and approvals visible.',audiences:['Product teams'],facts:['No external action'],approvedClaims:[{statement:'The fixture performs no external action',evidence:'Execution contract externalActionAllowed false'}]};
const account=(platformCode:'X'|'XIAOHONGSHU')=>({platformCode,accountExists:false,handleOrDisplayName:platformCode==='X'?'@public_safe_pg':'公开安全产品手记',producerMandates:['FOUNDER_VOICE','PRODUCT_EXPERTISE'] as const,rolePersona:platformCode==='X'?'Founder and product build notes':'Founder and product explanation',audience:['AI builders'],targetMarket:platformCode==='X'?'US':'CN',contentLocale:platformCode==='X'?'en-US':'zh-CN',contentPillars:['Build notes'],expressionExamples:['Show the source.'],dos:['Be exact'],donts:['No outcome promise'],ctaPolicy:'Invite review',cadenceHint:'Daily fixture slot'});

suite('SDD-009 fresh PostgreSQL authority regressions',()=>{
  it('scopes Goal/Plan invalidation, preserves S1 during draft, recovers an approval outbox failure, and replans the same Mission',async()=>{
    const now=()=>new Date('2026-08-22T11:00:00.000Z');
    const failingGoalRepository=new FailOncePostgresGoalPlanRepository(connectionString!);
    const knowledgeRepository=new PostgresKnowledgeRepository(connectionString!,new LocalContentAddressedBlobStore(blobRoot));
    let app=buildApi({now,goalPlanRepository:failingGoalRepository,knowledgeRepository,localPresenceRepository:new PostgresLocalPresenceRepository(connectionString!,new LocalContentAddressedBlobStore(blobRoot))});
    const approved=await approveKnowledge(app);
    const migrationProbe=new Pool({connectionString:connectionString!});
    try{
      await migrationProbe.query('alter table knowledge_snapshot_context_bindings_v2 disable trigger knowledge_snapshot_context_bindings_v2_immutable');
      await migrationProbe.query('delete from knowledge_snapshot_context_bindings_v2 where snapshot_id=$1',[approved.snapshotId]);
    }finally{
      await migrationProbe.query('alter table knowledge_snapshot_context_bindings_v2 enable trigger knowledge_snapshot_context_bindings_v2_immutable');
    }
    expect(Number((await migrationProbe.query<{count:string}>('select count(*) from knowledge_snapshot_context_bindings_v2 where snapshot_id=$1',[approved.snapshotId])).rows[0]?.count)).toBe(0);
    const missionA=await createMission(app,approved,'A','X');
    expect(Number((await migrationProbe.query<{count:string}>('select count(*) from knowledge_snapshot_context_bindings_v2 where snapshot_id=$1',[approved.snapshotId])).rows[0]?.count)).toBe(1);
    await migrationProbe.end();
    const missionB=await createMission(app,approved,'B','XIAOHONGSHU');

    const planASubmission=plannerSubmission(missionA.intent,missionA.goal);const firstEditedSlot=planASubmission.slots[0];if(firstEditedSlot===undefined)throw new Error('PG_PLAN_A_SLOT_MISSING');firstEditedSlot.theme='Plan A isolated revision';planASubmission.currentBrief.theme=firstEditedSlot.theme;
    const planEdited=await app.inject({method:'POST',url:'/api/v1/content-plans',headers:{'if-match':bundleEtag(missionA.intent),'idempotency-key':'pg-plan-a-edit-0001'},payload:planASubmission});
    expect(planEdited.statusCode,planEdited.body).toBe(201);
    expect(await effectiveState(app,missionA.execution.bundleId)).toBe('INVALIDATED');
    expect(await effectiveState(app,missionB.execution.bundleId)).toBe('COMPILED');

    const goalAPatch=await app.inject({method:'PATCH',url:`/api/v1/goals/${missionA.goal.goalId}`,headers:{'if-match':missionA.goalEtag,'idempotency-key':'pg-goal-a-edit-0001'},payload:{...goalInput(missionA.goal),canonicalDigest:missionA.goal.canonicalDigest,objective:`${missionA.goal.objective} Owner revision`}});
    expect(goalAPatch.statusCode,goalAPatch.body).toBe(200);
    expect(await effectiveState(app,missionB.intent.bundleId)).toBe('COMPILED');
    expect(await effectiveState(app,missionB.execution.bundleId)).toBe('COMPILED');

    let workspace=(await app.inject({method:'GET',url:'/api/v1/local-workspace'})).json();
    const draftMutation=await app.inject({method:'POST',url:'/api/v1/knowledge/sources/text',headers:{'if-match':`"knowledge-${workspace.knowledge.session.rowVersion}"`,'idempotency-key':'pg-knowledge-s2-draft-0001'},payload:{label:'Public-safe S2 draft',text:'A draft-only source must not supersede the immutable approved S1 binding.'}});
    expect(draftMutation.statusCode,draftMutation.body).toBe(201);const draftOverview=draftMutation.json().overview;
    expect(draftOverview.draft.state).toBe('DRAFT');expect(draftOverview.session.state).not.toBe('KNOWLEDGE_APPROVED_NEEDS_GOAL');expect(draftOverview.session.currentSnapshotId).toBe(approved.snapshotId);expect(draftOverview.session.currentSnapshotDigest).toBe(approved.snapshotDigest);
    const s1Context=await app.inject({method:'GET',url:`/api/v1/knowledge/snapshots/${approved.snapshotId}/role-context`,headers:{'x-lumiclaw-snapshot-digest':approved.snapshotDigest}});
    expect(s1Context.statusCode,s1Context.body).toBe(200);
    expect(await effectiveState(app,missionB.execution.bundleId)).toBe('COMPILED');
    const compileDuringDraft=await app.inject({method:'POST',url:'/api/v1/missions/compile',headers:{'if-match':missionB.goalEtag,'idempotency-key':'pg-s1-compile-during-s2-draft-0001'},payload:{goalId:missionB.goal.goalId,goalDigest:missionB.goal.canonicalDigest}});
    expect(compileDuringDraft.statusCode,compileDuringDraft.body).toBe(200);expect(compileDuringDraft.json().bundle.canonicalDigest).toBe(missionB.intent.canonicalDigest);

    failingGoalRepository.failNext();
    const failedApproval=await app.inject({method:'POST',url:'/api/v1/knowledge/snapshots/approve',headers:{'if-match':draftMutation.headers.etag!,'idempotency-key':'pg-s2-approve-crash-0001'},payload:{snapshotId:draftOverview.draft.id,canonicalDigest:draftOverview.draft.canonicalDigest}});
    expect(failedApproval.statusCode,failedApproval.body).toBe(503);
    expect(await knowledgeRepository.listPendingSnapshotSupersessions(missionB.goal.ownerId)).toHaveLength(1);
    expect((await failingGoalRepository.getWorkspace(missionB.goal.ownerId)).bundleStates.find((item)=>item.bundleId===missionB.execution.bundleId)?.state).toBe('COMPILED');
    await app.close();

    const recoveredGoalRepository=new PostgresGoalPlanRepository(connectionString!);const recoveredKnowledgeRepository=new PostgresKnowledgeRepository(connectionString!,new LocalContentAddressedBlobStore(blobRoot));
    app=buildApi({now,goalPlanRepository:recoveredGoalRepository,knowledgeRepository:recoveredKnowledgeRepository,localPresenceRepository:new PostgresLocalPresenceRepository(connectionString!,new LocalContentAddressedBlobStore(blobRoot))});
    const recoveredRead=await app.inject({method:'GET',url:`/api/v1/mission-bundles/${missionB.execution.bundleId}`});expect(recoveredRead.statusCode,recoveredRead.body).toBe(200);expect(recoveredRead.json().effectiveState).toBe('INVALIDATED');expect(recoveredRead.json().invalidation.reasonCode).toBe('KNOWLEDGE_SNAPSHOT_CHANGED');
    expect(await recoveredKnowledgeRepository.listPendingSnapshotSupersessions(missionB.goal.ownerId)).toHaveLength(0);
    const approvalRetry=await app.inject({method:'POST',url:'/api/v1/knowledge/snapshots/approve',headers:{'if-match':draftMutation.headers.etag!,'idempotency-key':'pg-s2-approve-crash-0001'},payload:{snapshotId:draftOverview.draft.id,canonicalDigest:draftOverview.draft.canonicalDigest}});expect(approvalRetry.statusCode,approvalRetry.body).toBe(200);
    await app.inject({method:'GET',url:`/api/v1/mission-bundles/${missionB.execution.bundleId}`});
    workspace=(await app.inject({method:'GET',url:'/api/v1/local-workspace'})).json();
    expect(workspace.goals.invalidations.filter((event:{bundleId:string})=>event.bundleId===missionB.execution.bundleId)).toHaveLength(1);

    const snapshot2=workspace.knowledge.approvedHistory.find((snapshot:{id:string})=>snapshot.id===draftOverview.draft.id);expect(snapshot2?.state).toBe('APPROVED');
    const currentGoalB=workspace.goals.goals.filter((goal:{goalId:string})=>goal.goalId===missionB.goal.goalId).sort((left:{revision:number},right:{revision:number})=>right.revision-left.revision)[0] as OperatingGoalRevision;
    const revisedB=await app.inject({method:'PATCH',url:`/api/v1/goals/${currentGoalB.goalId}`,headers:{'if-match':goalEtag(currentGoalB),'idempotency-key':'pg-goal-b-s2-rebind-0001'},payload:{...goalInput(currentGoalB),canonicalDigest:currentGoalB.canonicalDigest,knowledgeSnapshotId:snapshot2.id,knowledgeSnapshotDigest:snapshot2.canonicalDigest}});expect(revisedB.statusCode,revisedB.body).toBe(200);
    const draftB=revisedB.json().goal as OperatingGoalRevision;const activatedB=await app.inject({method:'POST',url:`/api/v1/goals/${draftB.goalId}/activate`,headers:{'if-match':revisedB.headers.etag!,'idempotency-key':'pg-goal-b-s2-activate-0001'},payload:{canonicalDigest:draftB.canonicalDigest}});expect(activatedB.statusCode,activatedB.body).toBe(200);const activeB=activatedB.json().goal as OperatingGoalRevision;
    const recompiled=await app.inject({method:'POST',url:'/api/v1/missions/compile',headers:{'if-match':activatedB.headers.etag!,'idempotency-key':'pg-goal-b-s2-compile-0001'},payload:{goalId:activeB.goalId,goalDigest:activeB.canonicalDigest}});expect(recompiled.statusCode,recompiled.body).toBe(201);const intent2=recompiled.json().bundle as MissionIntentBundle;
    const imported2=await app.inject({method:'POST',url:'/api/v1/content-plans',headers:{'if-match':recompiled.headers.etag!,'idempotency-key':'pg-goal-b-s2-plan-0001'},payload:plannerSubmission(intent2,activeB)});expect(imported2.statusCode,imported2.body).toBe(201);const plan2=imported2.json().plan;
    const approved2=await app.inject({method:'POST',url:`/api/v1/content-plans/${plan2.planId}/approve`,headers:{'if-match':imported2.headers.etag!,'idempotency-key':'pg-goal-b-s2-execution-0001'},payload:{canonicalDigest:plan2.canonicalDigest}});expect(approved2.statusCode,approved2.body).toBe(200);const execution2=approved2.json().bundle;
    expect(intent2.missionIntentId).toBe(missionB.intent.missionIntentId);expect(intent2.generation).toBeGreaterThan(missionB.execution.generation);expect(intent2.parentBundleDigest).toBe(missionB.execution.canonicalDigest);
    expect(plan2.planId).toBe(missionB.plan.planId);expect(plan2.revision).toBeGreaterThan(missionB.plan.revision);expect(execution2.missionIntentId).toBe(missionB.execution.missionIntentId);expect(execution2.generation).toBeGreaterThan(intent2.generation);expect(execution2.canonicalDigest).not.toBe(missionB.execution.canonicalDigest);expect(execution2.selectedPlatforms).toEqual(['XIAOHONGSHU']);
    await app.close();
  },120_000);
});

class FailOncePostgresGoalPlanRepository extends PostgresGoalPlanRepository{#fail=false;public failNext(){this.#fail=true;}public override async invalidateBundles(ownerId:string,request:BundleInvalidationRequest,now:Date):Promise<InvalidationEvent[]>{if(this.#fail){this.#fail=false;throw new Error('INJECTED_INVALIDATION_DELIVERY_FAILURE');}return super.invalidateBundles(ownerId,request,now);}}
type Approved={snapshotId:string;snapshotDigest:string;xId:string;xhsId:string;etag:string};
type Mission={goal:OperatingGoalRevision;goalEtag:string;intent:MissionIntentBundle;plan:ContentPlanRevision;planEtag:string;execution:MissionExecutionBundle};
async function approveKnowledge(app:ReturnType<typeof buildApi>):Promise<Approved>{
  expect((await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'PostgreSQL Fixture Owner'}})).statusCode).toBe(201);let overview=(await app.inject({method:'GET',url:'/api/v1/onboarding/session'})).json().overview;
  const mutate=async(method:'PUT'|'POST',url:string,payload:Record<string,unknown>,key:string)=>{const result=await app.inject({method,url,headers:{'if-match':`"knowledge-${overview.session.rowVersion}"`,'idempotency-key':key},payload});expect(result.statusCode,result.body).toBeLessThan(300);overview=result.json().overview;return result;};
  await mutate('PUT','/api/v1/profiles/persona',persona,'pg-persona-0001');await mutate('PUT','/api/v1/profiles/organization',organization,'pg-org-0001');await mutate('PUT','/api/v1/profiles/product',product,'pg-product-0001');await mutate('POST','/api/v1/knowledge/sources/text',{label:'Public-safe source',text:'The compiler fixture performs no external platform action.'},'pg-source-0001');await mutate('PUT','/api/v1/profiles/accounts/X',account('X'),'pg-x-account-0001');await mutate('PUT','/api/v1/profiles/accounts/XIAOHONGSHU',account('XIAOHONGSHU'),'pg-xhs-account-0001');await mutate('PUT','/api/v1/onboarding/session',{currentStep:'REVIEW',targetMarket:'US',contentLocale:'en-US',timeZone:'Asia/Singapore'},'pg-context-0001');
  const draft=overview.draft;const approved=await mutate('POST','/api/v1/knowledge/snapshots/approve',{snapshotId:draft.id,canonicalDigest:draft.canonicalDigest},'pg-s1-approve-0001');return {snapshotId:draft.id,snapshotDigest:draft.canonicalDigest,xId:overview.profiles.accounts.X.id,xhsId:overview.profiles.accounts.XIAOHONGSHU.id,etag:approved.headers.etag!};
}
async function createMission(app:ReturnType<typeof buildApi>,approved:Approved,label:string,platform:'X'|'XIAOHONGSHU'):Promise<Mission>{
  const selectedId=platform==='X'?approved.xId:approved.xhsId;const input={objective:`Public-safe isolated Goal ${label}.`,horizonDays:7,startsAt:label==='A'?'2026-08-24':'2026-09-01',endsAt:label==='A'?'2026-08-30':'2026-09-07',cadence:'DAILY',selectedAccountIds:[selectedId],targetMarket:platform==='X'?'US':'CN',contentLocale:platform==='X'?'en-US':'zh-CN',timeZone:'Asia/Singapore',successSignals:[{code:'PUBLISHING_CADENCE',observation:`Record reviewed slots for Goal ${label}.`}],knowledgeSnapshotId:approved.snapshotId,knowledgeSnapshotDigest:approved.snapshotDigest};
  const created=await app.inject({method:'POST',url:'/api/v1/goals',headers:{'if-match':approved.etag,'idempotency-key':`pg-goal-${label}-create-0001`},payload:input});expect(created.statusCode,created.body).toBe(201);const draft=created.json().goal as OperatingGoalRevision;
  const activated=await app.inject({method:'POST',url:`/api/v1/goals/${draft.goalId}/activate`,headers:{'if-match':created.headers.etag!,'idempotency-key':`pg-goal-${label}-activate-0001`},payload:{canonicalDigest:draft.canonicalDigest}});expect(activated.statusCode,activated.body).toBe(200);const goal=activated.json().goal as OperatingGoalRevision;
  const compiled=await app.inject({method:'POST',url:'/api/v1/missions/compile',headers:{'if-match':activated.headers.etag!,'idempotency-key':`pg-goal-${label}-compile-0001`},payload:{goalId:goal.goalId,goalDigest:goal.canonicalDigest}});expect(compiled.statusCode,compiled.body).toBe(201);const intent=compiled.json().bundle as MissionIntentBundle;
  const imported=await app.inject({method:'POST',url:'/api/v1/content-plans',headers:{'if-match':compiled.headers.etag!,'idempotency-key':`pg-goal-${label}-plan-0001`},payload:plannerSubmission(intent,goal)});expect(imported.statusCode,imported.body).toBe(201);const plan=imported.json().plan;
  const approvedPlan=await app.inject({method:'POST',url:`/api/v1/content-plans/${plan.planId}/approve`,headers:{'if-match':imported.headers.etag!,'idempotency-key':`pg-goal-${label}-execution-0001`},payload:{canonicalDigest:plan.canonicalDigest}});expect(approvedPlan.statusCode,approvedPlan.body).toBe(200);return {goal,goalEtag:activated.headers.etag!,intent,plan:approvedPlan.json().plan,planEtag:approvedPlan.headers.etag!,execution:approvedPlan.json().bundle};
}
async function effectiveState(app:ReturnType<typeof buildApi>,bundleId:string):Promise<string>{const response=await app.inject({method:'GET',url:`/api/v1/mission-bundles/${bundleId}`});expect(response.statusCode,response.body).toBe(200);return response.json().effectiveState;}
function goalInput(goal:OperatingGoalRevision){return {objective:goal.objective,horizonDays:goal.horizonDays,startsAt:goal.startsAt,endsAt:goal.endsAt,cadence:goal.cadence,selectedAccountIds:goal.selectedAccountIds,targetMarket:goal.targetMarket,contentLocale:goal.contentLocale,timeZone:goal.timeZone,successSignals:goal.successSignals,knowledgeSnapshotId:goal.knowledgeSnapshotId,knowledgeSnapshotDigest:goal.knowledgeSnapshotDigest};}
function goalEtag(goal:OperatingGoalRevision){return `"goal-${goal.goalId}-r${goal.revision}-${goal.canonicalDigest}"`;}
function bundleEtag(bundle:MissionIntentBundle){return `"bundle-${bundle.bundleId}-g${bundle.generation}-${bundle.canonicalDigest}"`;}
function plannerSubmission(intent:MissionIntentBundle,goal:OperatingGoalRevision):PlannerSubmission{const planner=intent.tasks.find((task)=>task.roleId==='campaign-planner')!;const items=intent.roleContexts.find((context)=>context.roleId==='campaign-planner')!.knowledgeItemIds.slice(0,2);const dates=expectedPlanDates(goal);const slots=dates.map((localDate,index)=>{const available=intent.inputBindings.accountProfiles;const producerRole:ProducerRoleId=index%2===0?'founder-identity-producer':'product-account-producer';const mandate=producerRole==='founder-identity-producer'?'FOUNDER_VOICE':'PRODUCT_EXPERTISE';const selected=available.find((candidate)=>candidate.producerMandates.includes(mandate))!;return {slotId:stableContractId('slot',{intentBundleId:intent.bundleId,localDate,index}),localDate,localTime:index%2===0?'09:30':'18:30',platformCode:selected.platformCode,accountProfileRevisionId:selected.accountProfileRevisionId,producerRole,theme:`Public-safe theme ${index+1}`,contentObjective:producerRole==='founder-identity-producer'?'Explain a founder decision.':'Explain a product workflow.',claimConstraints:['No AgentTeams run claim','No business outcome claim'],sourceItemIds:items,status:'PLANNED' as const};});const first=slots[0]!;return {schemaVersion:2,roleId:'campaign-planner',missionIntentId:intent.missionIntentId,intentBundleId:intent.bundleId,intentBundleDigest:intent.canonicalDigest,taskId:planner.taskId,inputDigest:planner.inputDigest,outputSchema:CONTENT_PLAN_SCHEMA_ID,outputSchemaDigest:CONTENT_PLAN_SCHEMA_DIGEST,skillLockDigest:planner.skillLockDigest,slots,currentBrief:{briefId:stableContractId('brief',{slotId:first.slotId}),slotId:first.slotId,platformCode:first.platformCode,accountProfileRevisionId:first.accountProfileRevisionId,producerRole:first.producerRole,theme:first.theme,contentObjective:first.contentObjective,sourceItemIds:[...first.sourceItemIds],claimConstraints:[...first.claimConstraints]},sourceBindings:[{snapshotId:goal.knowledgeSnapshotId,snapshotDigest:goal.knowledgeSnapshotDigest,sourceItemIds:items,claimConstraints:['Approved evidence only']}],evidenceMaturity:'CONTROLLED_FIXTURE'};}
