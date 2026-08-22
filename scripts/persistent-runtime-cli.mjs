import {pathToFileURL} from 'node:url';
import path from 'node:path';

export async function readPersistentRuntimeStatus(options={}){
  const origin=runtimeApiOrigin(options.origin??process.env.LUMICLAW_API_ORIGIN??'http://127.0.0.1:4100');
  const fetcher=options.fetcher??fetch;
  const [readinessResponse,teamResponse]=await Promise.all([
    fetcher(`${origin}/api/v1/runtime/readiness`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(3_000)}),
    fetcher(`${origin}/api/v1/ai-team`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(3_000)})
  ]);
  if(!readinessResponse.ok||!teamResponse.ok)throw new Error('RUNTIME_CONTROL_PLANE_UNREACHABLE');
  const readiness=await readinessResponse.json();const team=await teamResponse.json();
  if(!record(readiness)||!stableReadiness(readiness.state)||!record(team)||!Array.isArray(team.agents)||team.agents.length!==6)throw new Error('RUNTIME_CONTROL_PLANE_RESPONSE_INVALID');
  const jobs=Array.isArray(team.jobs)?team.jobs.map((job)=>{if(!record(job)||typeof job.id!=='string'||typeof job.taskContractId!=='string'||typeof job.state!=='string')throw new Error('RUNTIME_CONTROL_PLANE_RESPONSE_INVALID');return {jobId:job.id,taskId:job.taskContractId,state:job.state,attemptCount:Number(job.attemptCount??0),acceptedOutputDigest:digestOrNull(job.acceptedOutputDigest)};}):[];
  const attempts=Array.isArray(team.attempts)?team.attempts.map((attempt)=>{if(!record(attempt)||typeof attempt.id!=='string'||typeof attempt.jobId!=='string'||typeof attempt.state!=='string')throw new Error('RUNTIME_CONTROL_PLANE_RESPONSE_INVALID');return {attemptId:attempt.id,jobId:attempt.jobId,state:attempt.state,runtimeTaskId:textOrNull(attempt.runtimeTaskId),runtimeActorId:textOrNull(attempt.runtimeActorId),outputDigest:digestOrNull(attempt.outputDigest)};}):[];
  return {schemaVersion:1,status:'PASS',source:'POSTGRESQL_CONTROL_PLANE_VIA_LOCAL_API',readiness:readiness.state,reasonCode:textOrNull(readiness.reasonCode),controlledFake:readiness.controlledFake===true,providerConfigured:readiness.configured===true,providerFingerprint:textOrNull(readiness.fingerprint),runId:textOrNull(team.runId),bundleDigest:digestOrNull(team.bundleDigest),runtimeVersion:typeof team.runtimeVersion==='string'?team.runtimeVersion:'UNOBSERVED',runtimeDigest:digestOrPlaceholder(team.runtimeDigest),teamProfileVersion:typeof team.teamProfileVersion==='string'?team.teamProfileVersion:'UNOBSERVED',teamProfileDigest:digestOrPlaceholder(team.teamProfileDigest),memberCount:team.agents.length,jobs,attempts,secretPresentInOutput:false};
}

export function runtimeApiOrigin(value){let parsed;try{parsed=new URL(value);}catch{throw new Error('RUNTIME_API_ORIGIN_FORBIDDEN');}const port=Number.parseInt(parsed.port,10);if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1'||parsed.username!==''||parsed.password!==''||parsed.pathname!=='/'||parsed.search!==''||parsed.hash!==''||!Number.isSafeInteger(port)||port<1024||port>65535||parsed.port!==String(port))throw new Error('RUNTIME_API_ORIGIN_FORBIDDEN');return parsed.origin;}

function stableReadiness(value){return ['NOT_CONFIGURED','STARTING','READY','DEGRADED','INCOMPATIBLE','UNREACHABLE','RECOVERING','BLOCKED'].includes(String(value));}
function digestOrNull(value){if(value===null||value===undefined)return null;if(typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value))throw new Error('RUNTIME_CONTROL_PLANE_RESPONSE_INVALID');return value;}
function digestOrPlaceholder(value){return typeof value==='string'&&(/^[a-f0-9]{64}$/u.test(value)||value==='UNOBSERVED')?value:'UNOBSERVED';}
function textOrNull(value){return typeof value==='string'?value:null;}
function record(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}

if(process.argv[1]!==undefined&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{if((process.argv[2]??'status')!=='status')throw new Error('RUNTIME_CLI_COMMAND_INVALID');process.stdout.write(`${JSON.stringify(await readPersistentRuntimeStatus())}\n`);}catch(error){process.stderr.write(`${JSON.stringify({schemaVersion:1,status:'FAIL',code:error instanceof Error?error.message:'RUNTIME_CLI_FAILED',secretPresentInOutput:false})}\n`);process.exitCode=1;}}
