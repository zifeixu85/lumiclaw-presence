import {
  PersistentRuntimeError,isMediaAuditTaskContract,runtimeGatewayInputProjection,runtimeGatewayPhase,runtimeGatewayPolicy,runtimeGatewayRequestDigest,runtimeLeaseTokenDigest,runtimeMediaAuditInputProjection,sha256Digest,
  type GoalPlanRepository,type MediaArtifactRepository,type MediaProviderGateStatus,type PersistentRuntimeRepository,type RuntimeBinding,type RuntimeLease,type RuntimeSubmissionEnvelope
} from '@lumiclaw/domain';
import type {PersistentAgentTeamsDriver} from '@lumiclaw/runtime-agentteams';
import type {RuntimeOutputAuthority} from './output-authority.js';

export type GatewayTicketIssuer={issue(request:Record<string,unknown>):Promise<string>};
export type ControlledOutputFactory=(lease:RuntimeLease,input:unknown)=>unknown;

export class PersistentMissionWorker{
  public constructor(
    private readonly workerId:string,
    private readonly runtime:PersistentRuntimeRepository,
    private readonly goals:GoalPlanRepository,
    private readonly authority:RuntimeOutputAuthority,
    private readonly driver:PersistentAgentTeamsDriver,
    private readonly tickets:GatewayTicketIssuer,
    private readonly gatewayWorkerOrigin:string,
    private readonly leaseMs=120_000,
    private readonly controlledOutput?:ControlledOutputFactory,
    private readonly now:()=>Date=()=>new Date(),
    private readonly media?:MediaArtifactRepository,
    private readonly mediaGate?:()=>MediaProviderGateStatus|undefined
  ){}

  public async tick():Promise<'IDLE'|'RECOVERED_MATERIALIZATION'|'RECOVERED_SUBMISSION'|'CONFIRMED_COMPLETION'|'MATERIALIZED_MEDIA_AUDIT'|'ACCEPTED'|'BLOCKED'> {
    const runtimeStatus=await this.recordHeartbeat();
    if(this.media!==undefined&&await this.media.reconcileRuntimeAudits(this.now(),this.mediaGate?.()))return 'MATERIALIZED_MEDIA_AUDIT';
    const staged=await this.runtime.acquireStagedMaterialization(this.workerId,this.leaseMs,this.now());
    if(staged!==undefined){const heartbeat=this.startLeaseHeartbeat(staged.lease);try{await heartbeat.fence();await this.runtime.finalizeMaterialization(this.workerId,staged.lease.job.id,staged.lease.attempt.id,staged.lease.leaseToken,staged.batch.id,this.now());return 'RECOVERED_MATERIALIZATION';}catch{return 'BLOCKED';}finally{heartbeat.stop();}}
    if(runtimeStatus!=='READY')return 'BLOCKED';
    const completion=await this.runtime.acquirePendingCompletion(this.workerId,this.leaseMs,this.now());
    if(completion!==undefined){const heartbeat=this.startLeaseHeartbeat(completion.lease);try{await heartbeat.fence();await this.driver.complete(await this.binding(completion.lease),completion.lease.job.contract);await heartbeat.fence();await this.runtime.confirmRuntimeCompletion(this.workerId,completion.lease.job.id,completion.lease.attempt.id,completion.lease.leaseToken,completion.batch.id,this.now());return 'CONFIRMED_COMPLETION';}catch{return 'BLOCKED';}finally{heartbeat.stop();}}
    const recovery=await this.runtime.acquireSubmissionRecovery(this.workerId,this.leaseMs,this.now());
    if(recovery!==undefined)return await this.executeLease(recovery.lease,recovery.envelope,'RECOVERED_SUBMISSION');
    const lease=await this.runtime.acquireJob(this.workerId,this.leaseMs,this.now());if(lease===undefined)return 'IDLE';
    return await this.executeLease(lease,undefined,'ACCEPTED');
  }

  private async executeLease(lease:RuntimeLease,recoveryEnvelope:RuntimeSubmissionEnvelope|null|undefined,success:'RECOVERED_SUBMISSION'|'ACCEPTED'){
    let envelope=recoveryEnvelope??undefined;const heartbeat=this.startLeaseHeartbeat(lease);
    try{
      await heartbeat.fence();let binding:RuntimeBinding;let runtimeTaskId:string;let runtimeActorId:string;
      if(recoveryEnvelope===undefined){const projection=await this.runtime.getProjection(lease.run.ownerId,lease.run.id);binding=await this.driver.ensureBinding(lease.run,projection.jobs,this.now());await heartbeat.fence();const dispatched=await this.driver.dispatch(binding,lease.job.contract);runtimeTaskId=dispatched.runtimeTaskId;runtimeActorId=dispatched.runtimeActorId;await heartbeat.fence();await this.runtime.bindRuntime(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,binding,runtimeTaskId,this.now());await heartbeat.fence();await this.driver.acknowledge(lease.job.contract,runtimeActorId);await heartbeat.fence();await this.runtime.recordAck(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,runtimeTaskId,runtimeActorId,this.now());
      }else{binding=await this.binding(lease);runtimeTaskId=lease.job.runtimeTaskId??lease.attempt.runtimeTaskId??'';runtimeActorId=lease.attempt.runtimeActorId??binding.memberBindings.find((item)=>item.roleId===lease.job.roleId)?.runtimeActorId??'';if(runtimeTaskId.length===0||runtimeActorId.length===0)throw new PersistentRuntimeError('RECOVERY_REVIEW_REQUIRED');if(recoveryEnvelope===null){await heartbeat.fence();await this.driver.acknowledge(lease.job.contract,runtimeActorId);await heartbeat.fence();await this.runtime.recordAck(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,runtimeTaskId,runtimeActorId,this.now());}}

      if(envelope===undefined){const generated=await this.generate(lease,runtimeTaskId,runtimeActorId,heartbeat.fence);envelope={schemaVersion:1,runId:lease.run.id,bundleId:lease.run.bundleId,bundleDigest:lease.run.bundleDigest,generation:lease.run.generation,taskId:lease.job.taskContractId,attemptId:lease.attempt.id,attemptNumber:lease.attempt.attemptNumber,roleId:lease.job.roleId,runtimeTaskId,runtimeActorId,inputDigest:lease.job.contract.inputDigest,skillLockDigest:lease.job.contract.skillLockDigest,outputSchema:lease.job.contract.outputSchema,payload:generated.value,outputDigest:generated.outputDigest,submittedAt:this.now().toISOString(),evidenceMaturity:'AGENTTEAMS_RUNTIME',agentTeamsExecuted:true,controlledProvider:generated.controlledFake};await heartbeat.fence();await this.runtime.recordSubmissionIntent(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,envelope,this.now());await heartbeat.fence();const submitted=await this.driver.submit(lease.job.contract,runtimeActorId,envelope.payload);if(sha256Digest(submitted.payload)!==envelope.outputDigest)throw new PersistentRuntimeError('SUBMISSION_INPUT_MISMATCH','GATEWAY_AGENTTEAMS_OUTPUT_MISMATCH');
      }else{await heartbeat.fence();const observed=await this.driver.observeSubmission(binding,lease.job.contract);if(observed.state==='MISSING'){const submitted=await this.driver.submit(lease.job.contract,runtimeActorId,envelope.payload);if(sha256Digest(submitted.payload)!==envelope.outputDigest)throw new PersistentRuntimeError('SUBMISSION_INPUT_MISMATCH','AGENTTEAMS_RECOVERY_OUTPUT_MISMATCH');}else if(observed.outputDigest!==envelope.outputDigest||sha256Digest(observed.payload)!==envelope.outputDigest)throw new PersistentRuntimeError('SUBMISSION_INPUT_MISMATCH','AGENTTEAMS_RECOVERY_OUTPUT_MISMATCH');}
      await heartbeat.fence();const plan=await this.authority.plan(lease,envelope,this.now());const batch=await this.runtime.stageMaterialization(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,envelope,plan.acceptedOutputRef,plan.candidates,this.now());await heartbeat.fence();await this.runtime.finalizeMaterialization(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,batch.id,this.now());return success;
    }catch(error){const runtimeError=error instanceof PersistentRuntimeError?error:new PersistentRuntimeError('RUNTIME_UNREACHABLE');try{if(envelope!==undefined&&['SUBMISSION_SCHEMA_INVALID','SUBMISSION_INPUT_MISMATCH','DUPLICATE_SUBMISSION'].includes(runtimeError.code))await this.runtime.quarantineSubmission(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,envelope,runtimeError.code,this.now());else if(!['JOB_LEASE_LOST','RUNTIME_UNREACHABLE','TASK_ACK_TIMEOUT','TASK_SUBMIT_TIMEOUT'].includes(runtimeError.code))await this.runtime.markAttemptUnknown(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,runtimeError.code,this.now());}catch{}return 'BLOCKED' as const;}finally{heartbeat.stop();}
  }

  private async generate(lease:RuntimeLease,runtimeTaskId:string,runtimeActorId:string,fence:()=>Promise<void>){if(lease.job.roleId==='presence-mission-leader'){const value={schemaVersion:1 as const,taskId:lease.job.taskContractId,inputDigest:lease.job.contract.inputDigest,agentTeamsExecuted:true as const,completed:true as const};return {value,outputDigest:sha256Digest(value),controlledFake:false};}let input:Record<string,unknown>;if(isMediaAuditTaskContract(lease.job.contract))input=runtimeMediaAuditInputProjection(lease.job.contract);else{const bundle=await this.goals.getBundle(lease.run.ownerId,lease.run.bundleId);if(bundle===undefined||bundle.canonicalDigest!==lease.run.bundleDigest)throw new PersistentRuntimeError('SUBMISSION_INPUT_MISMATCH','BUNDLE_AUTHORITY_MISMATCH');input=runtimeGatewayInputProjection(bundle,lease.job.contract);}const phase=runtimeGatewayPhase(lease.job.kind);const model='deepseek-v4-flash' as const;const policy=runtimeGatewayPolicy(lease.job.contract,phase,model);const workerIdDigest=sha256Digest(this.workerId);const leaseTokenDigest=runtimeLeaseTokenDigest(lease.leaseToken);const generateRequest={ownerId:lease.run.ownerId,runId:lease.run.id,jobId:lease.job.id,taskId:lease.job.taskContractId,attemptId:lease.attempt.id,attemptNumber:lease.attempt.attemptNumber,runtimeTaskId,runtimeActorId,workerIdDigest,leaseTokenDigest,phase,model,policyDigest:policy.digest,inputDigest:lease.job.contract.inputDigest,outputSchemaRef:lease.job.contract.outputSchema,system:policy.system,input,outputSchema:policy.outputSchema};const requestDigest=runtimeGatewayRequestDigest(generateRequest);await fence();const ticket=await this.tickets.issue({ownerId:lease.run.ownerId,runId:lease.run.id,jobId:lease.job.id,taskId:lease.job.taskContractId,attemptId:lease.attempt.id,attemptNumber:lease.attempt.attemptNumber,runtimeTaskId,runtimeActorId,workerIdDigest,leaseTokenDigest,phase,model,policyDigest:policy.digest,inputDigest:lease.job.contract.inputDigest,requestDigest,outputSchema:lease.job.contract.outputSchema});await fence();return await this.driver.generate(lease.job.contract,runtimeActorId,this.gatewayWorkerOrigin,ticket,{...generateRequest,...(this.controlledOutput===undefined?{}:{controlledOutput:this.controlledOutput(lease,input)})});}

  private startLeaseHeartbeat(lease:RuntimeLease){let active=true;let lost:PersistentRuntimeError|undefined;let pending=Promise.resolve();const beat=()=>{pending=pending.then(async()=>{if(!active||lost!==undefined)return;try{await this.runtime.heartbeatLease(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,this.leaseMs,this.now());}catch(error){lost=error instanceof PersistentRuntimeError?error:new PersistentRuntimeError('JOB_LEASE_LOST');}});return pending;};void beat();const timer=setInterval(()=>{void beat();},Math.max(250,Math.floor(this.leaseMs/3)));timer.unref();return {fence:async()=>{await beat();if(lost!==undefined)throw lost;},stop:()=>{active=false;clearInterval(timer);}};}
  private async recordHeartbeat(){const observedAt=this.now();const status=await this.driver.readiness();await this.runtime.recordWorkerHeartbeat({schemaVersion:1,service:'mission-worker',workerIdDigest:sha256Digest(this.workerId),observedAt:observedAt.toISOString(),expiresAt:new Date(observedAt.getTime()+Math.max(10_000,Math.floor(this.leaseMs/2))).toISOString(),agentTeams:status});return status.state;}
  private async binding(lease:RuntimeLease){const projection=await this.runtime.getProjection(lease.run.ownerId,lease.run.id);const binding=projection.runId===lease.run.id?(await this.runtime.getWorkspace(lease.run.ownerId)).bindings.find((item)=>item.runId===lease.run.id):undefined;if(binding===undefined)throw new PersistentRuntimeError('RECOVERY_REVIEW_REQUIRED');return binding;}
}

export class HttpGatewayTicketIssuer implements GatewayTicketIssuer{
  private readonly origin:string;
  public constructor(origin:string,private readonly bootstrap:string){this.origin=assertLoopbackGatewayControlOrigin(origin);}
  public async issue(request:Record<string,unknown>){const response=await fetch(`${this.origin}/internal/v1/tickets`,{method:'POST',headers:{'content-type':'application/json','x-lumiclaw-gateway-bootstrap':this.bootstrap},body:JSON.stringify(request),signal:AbortSignal.timeout(5_000)});const body=await response.json() as {ticket?:unknown;code?:unknown};if(!response.ok||typeof body.ticket!=='string')throw new PersistentRuntimeError(typeof body.code==='string'&&body.code==='MODEL_TICKET_REPLAYED'?'MODEL_TICKET_REPLAYED':'RUNTIME_UNREACHABLE');return body.ticket;}
}

export function assertLoopbackGatewayControlOrigin(origin:string){let parsed:URL;try{parsed=new URL(origin);}catch{throw new PersistentRuntimeError('RUNTIME_UNREACHABLE','MODEL_GATEWAY_CONTROL_ORIGIN_FORBIDDEN');}const port=Number.parseInt(parsed.port,10);if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1'||parsed.username!==''||parsed.password!==''||parsed.pathname!=='/'||parsed.search!==''||parsed.hash!==''||!Number.isSafeInteger(port)||port<1024||port>65535||parsed.port!==String(port))throw new PersistentRuntimeError('RUNTIME_UNREACHABLE','MODEL_GATEWAY_CONTROL_ORIGIN_FORBIDDEN');return parsed.origin;}
