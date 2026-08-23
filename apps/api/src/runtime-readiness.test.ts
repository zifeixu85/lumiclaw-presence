import {
  AGENTTEAMS_RUNTIME_VERSION,
  AGENTTEAMS_SOURCE_COMMIT,
  AGENTTEAMS_SOURCE_TAR_SHA256,
  GOAL_ROLE_IDS,
  type PersistentRuntimeRepository,
  type RuntimeTeamProjection,
  type RuntimeWorkerHeartbeat
} from '@lumiclaw/domain';
import {describe,expect,it} from 'vitest';
import {buildApi,runtimeReadiness} from './server.js';

const checkedAt=new Date('2026-08-22T12:00:00.000Z');
const gateway=(state:'NOT_CONFIGURED'|'READY'|'DEGRADED'|'INCOMPATIBLE'|'UNREACHABLE'='READY',controlledFake=false)=>async()=>({state,providerMode:controlledFake?'CONTROLLED_FAKE':'DEEPSEEK',controlledFake,configured:state!=='NOT_CONFIGURED',fingerprint:state==='NOT_CONFIGURED'?null:'sha256:test',updatedAt:checkedAt.toISOString()});

function heartbeat(overrides:Partial<RuntimeWorkerHeartbeat['agentTeams']>={}):RuntimeWorkerHeartbeat{return {schemaVersion:1,service:'mission-worker',workerIdDigest:'a'.repeat(64),observedAt:new Date(checkedAt.getTime()-1_000).toISOString(),expiresAt:new Date(checkedAt.getTime()+29_000).toISOString(),agentTeams:{state:'READY',runtimeVersion:AGENTTEAMS_RUNTIME_VERSION,runtimeDigest:AGENTTEAMS_SOURCE_TAR_SHA256,sourceCommit:AGENTTEAMS_SOURCE_COMMIT,sourceTarSha256:AGENTTEAMS_SOURCE_TAR_SHA256,teamProfileVersion:'2.0.0',teamProfileDigest:'b'.repeat(64),memberCount:6,reasonCode:null,identityEvidence:{verified:true,mismatches:[],expected:{sourceCommit:AGENTTEAMS_SOURCE_COMMIT,sourceTarSha256:AGENTTEAMS_SOURCE_TAR_SHA256},actual:{images:[]}},...overrides}};}
function repository(options:{healthy?:boolean;heartbeat?:RuntimeWorkerHeartbeat|null}={}):PersistentRuntimeRepository{return {health:async()=>options.healthy??true,getWorkerHeartbeat:async()=>options.heartbeat??null} as unknown as PersistentRuntimeRepository;}
function readyProjection():RuntimeTeamProjection{return {code:'RUNTIME_TEAM_PROJECTION',readiness:'READY',reasonCode:null,metricSource:'POSTGRESQL_RUNTIME_OBSERVATION',runtimeVersion:AGENTTEAMS_RUNTIME_VERSION,runtimeDigest:AGENTTEAMS_SOURCE_TAR_SHA256,teamProfileVersion:'2.0.0',teamProfileDigest:'b'.repeat(64),bundleDigest:'c'.repeat(64),runId:'run-stale-worker',lastHeartbeat:'2026-08-22T11:59:00.000Z',agents:GOAL_ROLE_IDS.map((roleId)=>({roleId,runtimeActorId:`@${roleId}:matrix.local`,status:'IDLE',attemptId:null,taskId:null,acceptedTaskCount:0})),jobs:[],attempts:[],events:[],boundary:{runtimeSucceededMeans:'TASK_CONTRACT_OUTPUTS_ACCEPTED',auditPass:false,ownerApproved:false,published:false,businessSuccess:false}};}

describe('persistent runtime readiness conjunction',()=>{
  it('preserves NOT_CONFIGURED, INCOMPATIBLE, and UNREACHABLE without folding them together',async()=>{
    await expect(runtimeReadiness(undefined,undefined,checkedAt)).resolves.toMatchObject({state:'NOT_CONFIGURED'});
    await expect(runtimeReadiness(repository({healthy:false}),gateway(),checkedAt)).resolves.toMatchObject({state:'UNREACHABLE'});
    await expect(runtimeReadiness(repository(),gateway(),checkedAt)).resolves.toMatchObject({state:'UNREACHABLE',reasonCode:'MISSION_WORKER_HEARTBEAT_MISSING',probes:{worker:{state:'UNREACHABLE'},agentTeams:{state:'UNREACHABLE'}}});
    await expect(runtimeReadiness(repository(),gateway('NOT_CONFIGURED'),checkedAt)).resolves.toMatchObject({state:'UNREACHABLE',reasonCode:'MISSION_WORKER_HEARTBEAT_MISSING',probes:{gateway:{state:'NOT_CONFIGURED'},worker:{state:'UNREACHABLE'}}});
    const stale={...heartbeat(),observedAt:new Date(checkedAt.getTime()-61_000).toISOString(),expiresAt:new Date(checkedAt.getTime()-1_000).toISOString()};
    await expect(runtimeReadiness(repository({heartbeat:stale}),gateway(),checkedAt)).resolves.toMatchObject({state:'UNREACHABLE',reasonCode:'MISSION_WORKER_HEARTBEAT_MISSING',probes:{worker:{state:'UNREACHABLE'},agentTeams:{state:'UNREACHABLE'}}});
    await expect(runtimeReadiness(repository({heartbeat:heartbeat({sourceCommit:'wrong'})}),gateway(),checkedAt)).resolves.toMatchObject({state:'INCOMPATIBLE',probes:{agentTeams:{state:'INCOMPATIBLE'}}});
    await expect(runtimeReadiness(repository({heartbeat:heartbeat({state:'INCOMPATIBLE'})}),gateway(),checkedAt)).resolves.toMatchObject({state:'INCOMPATIBLE',probes:{agentTeams:{state:'INCOMPATIBLE',reasonCode:'RUNTIME_VERSION_INCOMPATIBLE'}}});
    await expect(runtimeReadiness(repository({heartbeat:heartbeat()}),gateway('UNREACHABLE'),checkedAt)).resolves.toMatchObject({state:'UNREACHABLE'});
  });

  it('never reports controlled fake as READY and requires all four exact authorities for READY',async()=>{
    const fake=await runtimeReadiness(repository({heartbeat:heartbeat()}),gateway('READY',true),checkedAt);
    expect(fake).toMatchObject({state:'DEGRADED',reasonCode:'CONTROLLED_FAKE_ENGINEERING_TEST',controlledFake:true,probes:{controlPlane:{state:'READY'},worker:{state:'READY'},agentTeams:{state:'READY'}}});
    await expect(runtimeReadiness(repository({heartbeat:heartbeat()}),gateway(),checkedAt)).resolves.toMatchObject({state:'READY',controlledFake:false});
  });

  it('does not let an old run/binding projection keep AI Team READY after the worker heartbeat disappears',async()=>{
    const persistentRuntimeRepository={...repository(),getProjection:async()=>readyProjection(),close:async()=>{}} as PersistentRuntimeRepository;
    const app=buildApi({now:()=>checkedAt,persistentRuntimeRepository,gatewayReadinessProbe:gateway()});
    try{
      await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Runtime Owner'}});
      const response=await app.inject({method:'GET',url:'/api/v1/ai-team'});
      expect(response.statusCode,response.body).toBe(200);
      expect(response.json()).toMatchObject({code:'RUNTIME_TEAM_PROJECTION',readiness:'UNREACHABLE',reasonCode:'MISSION_WORKER_HEARTBEAT_MISSING',lastHeartbeat:null,metricSource:'POSTGRESQL_RUNTIME_OBSERVATION'});
      expect(response.json().agents).toHaveLength(6);
    }finally{await app.close();}
  });
});
