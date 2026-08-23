import {PostgresArtifactPublishRepository,PostgresGoalPlanRepository,PostgresPersistentRuntimeRepository} from '@lumiclaw/db';
import {type RuntimeReadinessState} from '@lumiclaw/domain';
import {DockerAgentTeamsV120Driver} from '@lumiclaw/runtime-agentteams';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {RuntimeOutputAuthority} from './output-authority.js';
import {missionWorkerHealthStatus,notConfiguredMissionWorkerReadiness} from './readiness.js';
import {HttpGatewayTicketIssuer,PersistentMissionWorker} from './worker.js';

const port=integerEnv('PORT',4001);const connectionString=requiredEnv('DATABASE_URL');const driverMode=process.env.AGENTTEAMS_DRIVER??'NOT_CONFIGURED';const gatewayControlOrigin=driverMode==='DOCKER_HOST_SUPERVISOR'?requiredEnv('MODEL_GATEWAY_URL'):'http://127.0.0.1:1';const gatewayWorkerOrigin=driverMode==='DOCKER_HOST_SUPERVISOR'?requiredEnv('MODEL_GATEWAY_WORKER_ORIGIN'):'http://host.docker.internal:1';const workerId=process.env.MISSION_WORKER_ID??`mission-worker-${process.pid}`;const pollMs=integerEnv('MISSION_WORKER_POLL_MS',1_000);const leaseMs=integerEnv('MISSION_WORKER_LEASE_MS',120_000);
const runtime=new PostgresPersistentRuntimeRepository(connectionString);const goals=new PostgresGoalPlanRepository(connectionString);const artifacts=new PostgresArtifactPublishRepository(connectionString);const driver=new DockerAgentTeamsV120Driver();const authority=new RuntimeOutputAuthority(goals,artifacts);
let worker:PersistentMissionWorker|undefined;let heartbeatAt:string|null=null;let lastTick:'IDLE'|'RECOVERED_MATERIALIZATION'|'RECOVERED_SUBMISSION'|'CONFIRMED_COMPLETION'|'ACCEPTED'|'BLOCKED'|'NOT_CONFIGURED'='NOT_CONFIGURED';let stopping=false;

if(driverMode==='DOCKER_HOST_SUPERVISOR'){
  const bootstrap=await readSecret(requiredEnv('RUNTIME_GATEWAY_BOOTSTRAP_FILE'),32);
  worker=new PersistentMissionWorker(workerId,runtime,goals,authority,driver,new HttpGatewayTicketIssuer(gatewayControlOrigin,bootstrap),gatewayWorkerOrigin,leaseMs);
}else if(driverMode!=='NOT_CONFIGURED')throw new Error('AGENTTEAMS_DRIVER_INVALID');

const server=createServer(async(request,response)=>{
  response.setHeader('cache-control','no-store');response.setHeader('content-type','application/json');
  if(request.method!=='GET'||request.url!=='/health'){response.writeHead(404);response.end(JSON.stringify({code:'MISSION_WORKER_ROUTE_NOT_FOUND',externalActionAllowed:false}));return;}
  const health=await readiness();response.writeHead(missionWorkerHealthStatus(health.state));response.end(JSON.stringify(health));
});
server.listen(port,'0.0.0.0');
void loop();
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{stopping=true;server.close(()=>{void Promise.allSettled([runtime.close(),goals.close(),artifacts.close()]).finally(()=>{process.exitCode=0;});});});

async function loop(){while(!stopping){if(worker!==undefined){lastTick=await worker.tick().catch(()=>'BLOCKED');heartbeatAt=new Date().toISOString();}await delay(pollMs);}}

async function readiness(){
  if(driverMode==='NOT_CONFIGURED')return notConfiguredMissionWorkerReadiness(await runtime.health().catch(()=>false),workerId);
  const [postgresql,agentTeams,gateway]=await Promise.all([runtime.health().catch(()=>false),driver.readiness(),probeGateway()]);
  const heartbeatFresh=heartbeatAt!==null&&Date.now()-Date.parse(heartbeatAt)<=Math.max(30_000,pollMs*5);
  let state:RuntimeReadinessState='READY';let reasonCode:string|null=null;
  if(!postgresql||gateway.state==='UNREACHABLE'||agentTeams.state==='UNREACHABLE'){state='UNREACHABLE';reasonCode='RUNTIME_UNREACHABLE';}
  else if(driverMode!=='DOCKER_HOST_SUPERVISOR'||gateway.state==='NOT_CONFIGURED'){state='NOT_CONFIGURED';reasonCode='RUNTIME_NOT_CONFIGURED';}
  else if(agentTeams.state==='INCOMPATIBLE'){state='INCOMPATIBLE';reasonCode='RUNTIME_VERSION_INCOMPATIBLE';}
  else if(!heartbeatFresh){state='STARTING';reasonCode='MISSION_WORKER_HEARTBEAT_MISSING';}
  else if(gateway.controlledFake){state='DEGRADED';reasonCode='CONTROLLED_FAKE_ENGINEERING_TEST';}
  const verified=agentTeams.identityEvidence?.verified===true;return {service:'mission-worker',state,reasonCode,controlPlane:{state:postgresql?'READY':'UNREACHABLE',source:'POSTGRESQL'},worker:{state:worker===undefined?'NOT_CONFIGURED':heartbeatFresh?'READY':'STARTING',workerId,heartbeatAt,lastTick},gateway,agentTeams:{state:agentTeams.state,memberCount:agentTeams.memberCount,version:agentTeams.runtimeVersion,sourceCommit:verified?agentTeams.identityEvidence!.expected.sourceCommit:'UNVERIFIED',sourceTarSha256:agentTeams.runtimeDigest,teamProfileVersion:agentTeams.teamProfileVersion,teamProfileDigest:agentTeams.teamProfileDigest,imageDigests:agentTeams.identityEvidence?.actual.images??[],pinnedIdentityVerified:verified,identityEvidence:agentTeams.identityEvidence},authority:{mode:'LOCAL_DOCKER_HOST_SUPERVISOR',dockerSocketMounted:false,fixedCommandSurface:true,webDockerAuthority:false,apiDockerAuthority:false,gatewayDockerAuthority:false},externalActionAllowed:false,secretPresentInResponse:false};
}

async function probeGateway():Promise<{state:RuntimeReadinessState;providerMode:string;controlledFake:boolean;configured:boolean;fingerprint:string|null;updatedAt:string|null}>{try{const response=await fetch(`${gatewayControlOrigin}/health`,{signal:AbortSignal.timeout(2_000)});const value=await response.json() as Record<string,unknown>;return {state:runtimeState(value.state),providerMode:typeof value.providerMode==='string'?value.providerMode:'UNKNOWN',controlledFake:value.controlledFake===true,configured:value.configured===true,fingerprint:typeof value.fingerprint==='string'?value.fingerprint:null,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:null};}catch{return {state:'UNREACHABLE',providerMode:'UNKNOWN',controlledFake:false,configured:false,fingerprint:null,updatedAt:null};}}
function runtimeState(value:unknown):RuntimeReadinessState{return ['NOT_CONFIGURED','STARTING','READY','DEGRADED','INCOMPATIBLE','UNREACHABLE','RECOVERING','BLOCKED'].includes(String(value))?value as RuntimeReadinessState:'UNREACHABLE';}
async function readSecret(file:string,minimumBytes:number){const metadata=await stat(file);if(!metadata.isFile()||(metadata.mode&0o077)!==0)throw new Error('SECRET_FILE_MODE_MUST_BE_0400_OR_0600');const value=(await readFile(file,'utf8')).trim();if(Buffer.byteLength(value)<minimumBytes)throw new Error('SECRET_FILE_VALUE_TOO_SHORT');return value;}
function requiredEnv(name:string){const value=process.env[name];if(value===undefined||value.length===0)throw new Error(`${name} is required.`);return value;}
function integerEnv(name:string,fallback:number){const value=Number.parseInt(process.env[name]??String(fallback),10);if(!Number.isSafeInteger(value)||value<=0)throw new Error(`${name} is invalid.`);return value;}
function delay(milliseconds:number){return new Promise<void>((resolve)=>setTimeout(resolve,milliseconds));}
