import {describe,expect,it} from 'vitest';
import {readPersistentRuntimeStatus,runtimeApiOrigin} from './persistent-runtime-cli.mjs';

const digest=(character:string)=>character.repeat(64);
const response=(value:unknown,ok=true)=>({ok,json:async()=>value}) as Response;

describe('persistent runtime read-only CLI',()=>{
  it('projects the exact PostgreSQL run/task/digests exposed by the local API without inventing tokens or secrets',async()=>{
    const calls:string[]=[];const status=await readPersistentRuntimeStatus({origin:'http://127.0.0.1:4411',fetcher:async(input:URL|string|Request)=>{const url=String(input);calls.push(url);return url.endsWith('/runtime/readiness')?response({state:'DEGRADED',reasonCode:'CONTROLLED_FAKE_ENGINEERING_TEST',controlledFake:true,configured:false,fingerprint:null}):response({runId:'run-public-safe',bundleDigest:digest('a'),runtimeVersion:'v1.2.0',runtimeDigest:digest('b'),teamProfileVersion:'2.0.0',teamProfileDigest:digest('c'),agents:Array.from({length:6},(_,index)=>({roleId:`role-${index}`})),jobs:[{id:'job-1',taskContractId:'task-1',state:'ACKNOWLEDGED',attemptCount:1,acceptedOutputDigest:null}],attempts:[{id:'attempt-1',jobId:'job-1',state:'ACKNOWLEDGED',runtimeTaskId:'runtime-task-1',runtimeActorId:'@actor:matrix.local',outputDigest:null}]});}});
    expect(calls).toEqual(['http://127.0.0.1:4411/api/v1/runtime/readiness','http://127.0.0.1:4411/api/v1/ai-team']);
    expect(status).toMatchObject({status:'PASS',source:'POSTGRESQL_CONTROL_PLANE_VIA_LOCAL_API',readiness:'DEGRADED',controlledFake:true,runId:'run-public-safe',bundleDigest:digest('a'),memberCount:6,jobs:[{taskId:'task-1',state:'ACKNOWLEDGED'}],attempts:[{runtimeTaskId:'runtime-task-1'}],secretPresentInOutput:false});
    expect(JSON.stringify(status)).not.toMatch(/api.?key|authorization|bearer|ticket|token/iu);
  });
  it('allows only an exact loopback HTTP origin and fails closed on unavailable or malformed authority',async()=>{
    for(const value of ['https://127.0.0.1:4411','http://localhost:4411','http://127.0.0.1','http://127.0.0.1:4411/path','http://user@127.0.0.1:4411'])expect(()=>runtimeApiOrigin(value)).toThrow('RUNTIME_API_ORIGIN_FORBIDDEN');
    await expect(readPersistentRuntimeStatus({fetcher:async()=>response({},false)})).rejects.toThrow('RUNTIME_CONTROL_PLANE_UNREACHABLE');
    await expect(readPersistentRuntimeStatus({fetcher:async(input:URL|string|Request)=>String(input).endsWith('/runtime/readiness')?response({state:'READY'}):response({agents:[]})})).rejects.toThrow('RUNTIME_CONTROL_PLANE_RESPONSE_INVALID');
  });
  it('uses the loopback Compose API HostPort by default',async()=>{
    const calls:string[]=[];
    await expect(readPersistentRuntimeStatus({fetcher:async(input:URL|string|Request)=>{calls.push(String(input));return response({},false);}})).rejects.toThrow('RUNTIME_CONTROL_PLANE_UNREACHABLE');
    expect(calls).toEqual(['http://127.0.0.1:4100/api/v1/runtime/readiness','http://127.0.0.1:4100/api/v1/ai-team']);
  });
});
