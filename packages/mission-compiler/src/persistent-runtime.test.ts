import {
  AGENTTEAMS_SOURCE_TAR_SHA256,
  RUNTIME_READINESS_STATES,
  canonicalBundleDigest,
  createRuntimeRunGraph,
  publicRuntimeEventPayload,
  runtimeGatewayInputProjection,
  runtimeGatewayPhase,
  runtimeGatewayPolicy,
  runtimeOutputSchema,
  sha256Digest,
  validateRuntimeSubmission,
  type AgentTaskAttempt,
  type RuntimeBinding,
  type RuntimeSubmissionEnvelope
} from '@lumiclaw/domain';
import {describe,expect,it} from 'vitest';
import {compileMissionIntentV2} from './index.js';
import {createV2Fixture} from './v2-fixture.js';

function intent(){const fixture=createV2Fixture();return compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});}

describe('SDD-007 persistent runtime contracts',()=>{
  it('preserves every frozen readiness meaning',()=>{
    expect(RUNTIME_READINESS_STATES).toEqual(['NOT_CONFIGURED','STARTING','READY','DEGRADED','INCOMPATIBLE','UNREACHABLE','RECOVERING','BLOCKED']);
  });

  it('compiles an opaque six-member Intent into only the executable runtime jobs',()=>{
    const bundle=intent();
    const graph=createRuntimeRunGraph(bundle,'owner-terminal',new Date('2026-08-22T12:00:00.000Z'));
    expect(bundle.roles).toHaveLength(6);
    expect(graph.jobs.map((job)=>job.kind)).toEqual(['ORCHESTRATE','FREEZE_CLAIMS','PLAN_CONTENT']);
    expect(graph.run.runtimeRequirement).toMatchObject({version:'v1.2.0',sourceTarSha256:AGENTTEAMS_SOURCE_TAR_SHA256,license:'Apache-2.0'});
    for(const job of graph.jobs){
      const projection=runtimeGatewayInputProjection(bundle,job.contract);
      const phase=runtimeGatewayPhase(job.kind);
      const policy=runtimeGatewayPolicy(job.contract,phase,'deepseek-v4-flash');
      expect(sha256Digest(projection)).toMatch(/^[a-f0-9]{64}$/u);
      expect(policy.digest).toMatch(/^[a-f0-9]{64}$/u);
      expect(runtimeOutputSchema(job.contract).schema).toMatchObject({additionalProperties:false});
    }
  });

  it('authoritatively binds ACK and Submit to the role actor',()=>{
    const bundle=intent();
    const lease=createRuntimeRunGraph(bundle,'owner-terminal',new Date('2026-08-22T12:00:00.000Z')).jobs[0]!;
    const runtimeTaskId='agentteams-task-1';
    const attempt:AgentTaskAttempt={schemaVersion:1,id:'attempt-1',jobId:lease.id,attemptNumber:1,roleId:lease.roleId,runtimeTaskId,runtimeActorId:'@leader:matrix.local',inputDigest:lease.contract.inputDigest,skillLockDigest:lease.contract.skillLockDigest,schemaRef:lease.contract.outputSchema,state:'ACKNOWLEDGED',ackAt:'2026-08-22T12:00:01.000Z',submittedAt:null,outputDigest:null,errorCode:null,createdAt:'2026-08-22T12:00:00.000Z',updatedAt:'2026-08-22T12:00:01.000Z'};
    const binding:RuntimeBinding={schemaVersion:1,runId:lease.runId,runtimeInstanceId:'agentteams-controller',runtimeProjectId:'project-1',teamProfileVersion:bundle.inputBindings.teamProfile.version,teamProfileDigest:bundle.inputBindings.teamProfile.digest,runtimeVersion:'v1.2.0',runtimeDigest:AGENTTEAMS_SOURCE_TAR_SHA256,memberBindings:bundle.roles.map((role,index)=>({roleId:role.roleId,runtimeActorId:index===0?'@leader:matrix.local':`@actor-${index}:matrix.local`})),state:'BOUND',boundAt:'2026-08-22T12:00:00.000Z',lastObservedAt:'2026-08-22T12:00:01.000Z'};
    const payload={schemaVersion:1,taskId:lease.taskContractId,inputDigest:lease.contract.inputDigest,agentTeamsExecuted:true,completed:true};
    const envelope:RuntimeSubmissionEnvelope={schemaVersion:1,runId:lease.runId,bundleId:bundle.bundleId,bundleDigest:bundle.canonicalDigest,generation:bundle.generation,taskId:lease.taskContractId,attemptId:attempt.id,attemptNumber:1,roleId:lease.roleId,runtimeTaskId,runtimeActorId:'@leader:matrix.local',inputDigest:lease.contract.inputDigest,skillLockDigest:lease.contract.skillLockDigest,outputSchema:lease.contract.outputSchema,payload,outputDigest:sha256Digest(payload),submittedAt:'2026-08-22T12:00:02.000Z',evidenceMaturity:'AGENTTEAMS_RUNTIME',agentTeamsExecuted:true,controlledProvider:true};
    expect(()=>validateRuntimeSubmission(lease.contract,attempt,envelope,binding)).not.toThrow();
    try{validateRuntimeSubmission(lease.contract,attempt,{...envelope,runtimeActorId:'@actor-1:matrix.local'},binding);throw new Error('EXPECTED_REJECTION');}catch(error){expect(error).toMatchObject({code:'SUBMISSION_INPUT_MISMATCH'});}
  });

  it('redacts secret-bearing keys and strings while retaining fingerprints',()=>{
    expect(publicRuntimeEventPayload({authorization:'Bearer hidden-secret-value',apiKey:'sk-secret-value-1234567890',fingerprint:'0123456789abcdef',nested:{ticket:'raw-ticket'}})).toEqual({authorization:'[REDACTED]',apiKey:'[REDACTED]',fingerprint:'0123456789abcdef',nested:{ticket:'[REDACTED]'}});
    expect(publicRuntimeEventPayload({runtimeTaskId:'agentteams-media-audit-5cbd20ee14cff4efdb1d86965079df90'})).toEqual({runtimeTaskId:'agentteams-media-audit-5cbd20ee14cff4efdb1d86965079df90'});
  });

  it('fails closed on aggregate or SkillLock tampering without rejecting unrelated valid locks',()=>{
    const bundle=intent();
    expect(()=>createRuntimeRunGraph(bundle,'owner-terminal',new Date())).not.toThrow();
    const taskTamper=redigest({...bundle,tasks:bundle.tasks.map((task,index)=>index===0?{...task,skillLockDigest:'f'.repeat(64)}:task)});
    expect(()=>createRuntimeRunGraph(taskTamper,'owner-terminal',new Date())).toThrowError(expect.objectContaining({message:'SKILL_LOCK_MISMATCH'}));
    const lockTamper=redigest({...bundle,skillLocks:bundle.skillLocks.map((lock,index)=>index===0?{...lock,source:'skills/tampered/SKILL.md'}:lock)});
    expect(()=>createRuntimeRunGraph(lockTamper,'owner-terminal',new Date())).toThrowError(expect.objectContaining({message:'SKILL_LOCK_MISMATCH'}));
    const missing=redigest({...bundle,skillLocks:bundle.skillLocks.slice(1)});
    expect(()=>createRuntimeRunGraph(missing,'owner-terminal',new Date())).toThrowError(expect.objectContaining({message:'SKILL_LOCK_MISMATCH'}));
    const reordered=redigest({...bundle,skillLocks:[...bundle.skillLocks].reverse()});
    expect(()=>createRuntimeRunGraph(reordered,'owner-terminal',new Date())).toThrowError(expect.objectContaining({message:'SKILL_LOCK_MISMATCH'}));
    const duplicate=redigest({...bundle,skillLocks:[...bundle.skillLocks,{...bundle.skillLocks[0]!}]});
    expect(()=>createRuntimeRunGraph(duplicate,'owner-terminal',new Date())).toThrowError(expect.objectContaining({message:'SKILL_LOCK_MISMATCH'}));
    const overLimit=redigest({...bundle,skillLocks:Array.from({length:13},(_,index)=>({skillId:`bounded-skill-${index}`,version:'1.0.0',digest:sha256Digest({index}),source:`skills/bounded-skill-${index}/SKILL.md`}))});
    expect(()=>createRuntimeRunGraph(overLimit,'owner-terminal',new Date())).toThrowError(expect.objectContaining({message:'SKILL_LOCK_MISMATCH'}));
  });
});

function redigest<T extends ReturnType<typeof intent>>(value:T):T{const {canonicalDigest,...base}=value;if(!/^[a-f0-9]{64}$/u.test(canonicalDigest))throw new Error('TEST_BUNDLE_DIGEST_INVALID');return {...base,canonicalDigest:canonicalBundleDigest(base)} as T;}
