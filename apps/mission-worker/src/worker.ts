import {
  PersistentRuntimeError,runtimeGatewayInputProjection,runtimeGatewayPhase,runtimeGatewayPolicy,runtimeGatewayRequestDigest,runtimeLeaseTokenDigest,sha256Digest,
  type GoalPlanRepository,type PersistentRuntimeRepository,type RuntimeLease,type RuntimeSubmissionEnvelope
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
    private readonly now:()=>Date=()=>new Date()
  ){}

  public async tick():Promise<'IDLE'|'RECOVERED_MATERIALIZATION'|'ACCEPTED'|'BLOCKED'> {
    const runtimeStatus=await this.recordHeartbeat();
    const staged=await this.runtime.acquireStagedMaterialization(this.workerId,this.leaseMs,this.now());
    if(staged!==undefined){const result=await this.runtime.finalizeMaterialization(this.workerId,staged.lease.job.id,staged.lease.attempt.id,staged.lease.leaseToken,staged.batch.id,this.now());if(result.accepted)await this.driver.complete(await this.binding(staged.lease),staged.lease.job.taskContractId);return 'RECOVERED_MATERIALIZATION';}
    if(runtimeStatus!=='READY')return 'BLOCKED';
    const lease=await this.runtime.acquireJob(this.workerId,this.leaseMs,this.now());if(lease===undefined)return 'IDLE';
    let envelope:RuntimeSubmissionEnvelope|undefined;let heartbeat:ReturnType<typeof setInterval>|undefined;
    try{
      const projection=await this.runtime.getProjection(lease.run.ownerId,lease.run.id);const binding=await this.driver.ensureBinding(lease.run,projection.jobs,this.now());const dispatched=await this.driver.dispatch(binding,lease.job.contract);await this.runtime.bindRuntime(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,binding,dispatched.runtimeTaskId,this.now());await this.driver.acknowledge(lease.job.contract,dispatched.runtimeActorId);await this.runtime.recordAck(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,dispatched.runtimeTaskId,dispatched.runtimeActorId,this.now());
      heartbeat=setInterval(()=>{void this.runtime.heartbeatLease(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,this.leaseMs,this.now()).catch(()=>undefined);},Math.max(5_000,Math.floor(this.leaseMs/3)));heartbeat.unref();
      const bundle=await this.goals.getBundle(lease.run.ownerId,lease.run.bundleId);if(bundle===undefined||bundle.canonicalDigest!==lease.run.bundleDigest)throw new PersistentRuntimeError('SUBMISSION_INPUT_MISMATCH','BUNDLE_AUTHORITY_MISMATCH');const input=runtimeGatewayInputProjection(bundle,lease.job.contract);const phase=runtimeGatewayPhase(lease.job.kind);const model='deepseek-v4-flash' as const;const policy=runtimeGatewayPolicy(lease.job.contract,phase,model);const workerIdDigest=sha256Digest(this.workerId);const leaseTokenDigest=runtimeLeaseTokenDigest(lease.leaseToken);const generateRequest={ownerId:lease.run.ownerId,runId:lease.run.id,jobId:lease.job.id,taskId:lease.job.taskContractId,attemptId:lease.attempt.id,attemptNumber:lease.attempt.attemptNumber,runtimeTaskId:dispatched.runtimeTaskId,runtimeActorId:dispatched.runtimeActorId,workerIdDigest,leaseTokenDigest,phase,model,policyDigest:policy.digest,inputDigest:lease.job.contract.inputDigest,outputSchemaRef:lease.job.contract.outputSchema,system:policy.system,input,outputSchema:policy.outputSchema};const requestDigest=runtimeGatewayRequestDigest(generateRequest);
      const ticket=await this.tickets.issue({ownerId:lease.run.ownerId,runId:lease.run.id,jobId:lease.job.id,taskId:lease.job.taskContractId,attemptId:lease.attempt.id,attemptNumber:lease.attempt.attemptNumber,runtimeTaskId:dispatched.runtimeTaskId,runtimeActorId:dispatched.runtimeActorId,workerIdDigest,leaseTokenDigest,phase,model,policyDigest:policy.digest,inputDigest:lease.job.contract.inputDigest,requestDigest,outputSchema:lease.job.contract.outputSchema});
      const generated=await this.driver.generate(lease.job.contract,dispatched.runtimeActorId,this.gatewayWorkerOrigin,ticket,{...generateRequest,...(this.controlledOutput===undefined?{}:{controlledOutput:this.controlledOutput(lease,input)})});
      const submitted=await this.driver.submit(lease.job.contract,dispatched.runtimeActorId,generated.value);if(sha256Digest(submitted.payload)!==generated.outputDigest)throw new PersistentRuntimeError('SUBMISSION_INPUT_MISMATCH','GATEWAY_AGENTTEAMS_OUTPUT_MISMATCH');envelope={schemaVersion:1,runId:lease.run.id,bundleId:lease.run.bundleId,bundleDigest:lease.run.bundleDigest,generation:lease.run.generation,taskId:lease.job.taskContractId,attemptId:lease.attempt.id,attemptNumber:lease.attempt.attemptNumber,roleId:lease.job.roleId,runtimeTaskId:dispatched.runtimeTaskId,runtimeActorId:dispatched.runtimeActorId,inputDigest:lease.job.contract.inputDigest,skillLockDigest:lease.job.contract.skillLockDigest,outputSchema:lease.job.contract.outputSchema,payload:submitted.payload,outputDigest:generated.outputDigest,submittedAt:submitted.submittedAt,evidenceMaturity:'AGENTTEAMS_RUNTIME',agentTeamsExecuted:true,controlledProvider:generated.controlledFake};
      const plan=await this.authority.plan(lease,envelope);const batch=await this.runtime.stageMaterialization(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,envelope,plan.acceptedOutputRef,plan.candidates,this.now());const result=await this.runtime.finalizeMaterialization(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,batch.id,this.now());if(result.accepted)await this.driver.complete(binding,dispatched.runtimeTaskId);return 'ACCEPTED';
    }catch(error){const runtimeError=error instanceof PersistentRuntimeError?error:new PersistentRuntimeError('RUNTIME_UNREACHABLE');try{if(envelope!==undefined&&['SUBMISSION_SCHEMA_INVALID','SUBMISSION_INPUT_MISMATCH','DUPLICATE_SUBMISSION'].includes(runtimeError.code))await this.runtime.quarantineSubmission(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,envelope,runtimeError.code,this.now());else await this.runtime.markAttemptUnknown(this.workerId,lease.job.id,lease.attempt.id,lease.leaseToken,runtimeError.code,this.now());}catch{}return 'BLOCKED';}finally{if(heartbeat!==undefined)clearInterval(heartbeat);}
  }
  private async recordHeartbeat(){const observedAt=this.now();const status=await this.driver.readiness();await this.runtime.recordWorkerHeartbeat({schemaVersion:1,service:'mission-worker',workerIdDigest:sha256Digest(this.workerId),observedAt:observedAt.toISOString(),expiresAt:new Date(observedAt.getTime()+Math.max(10_000,Math.floor(this.leaseMs/2))).toISOString(),agentTeams:status});return status.state;}
  private async binding(lease:RuntimeLease){const projection=await this.runtime.getProjection(lease.run.ownerId,lease.run.id);const binding=projection.runId===lease.run.id?(await this.runtime.getWorkspace(lease.run.ownerId)).bindings.find((item)=>item.runId===lease.run.id):undefined;if(binding===undefined)throw new PersistentRuntimeError('RECOVERY_REVIEW_REQUIRED');return binding;}
}

export class HttpGatewayTicketIssuer implements GatewayTicketIssuer{
  private readonly origin:string;
  public constructor(origin:string,private readonly bootstrap:string){this.origin=assertLoopbackGatewayControlOrigin(origin);}
  public async issue(request:Record<string,unknown>){const response=await fetch(`${this.origin}/internal/v1/tickets`,{method:'POST',headers:{'content-type':'application/json','x-lumiclaw-gateway-bootstrap':this.bootstrap},body:JSON.stringify(request),signal:AbortSignal.timeout(5_000)});const body=await response.json() as {ticket?:unknown;code?:unknown};if(!response.ok||typeof body.ticket!=='string')throw new PersistentRuntimeError(typeof body.code==='string'&&body.code==='MODEL_TICKET_REPLAYED'?'MODEL_TICKET_REPLAYED':'RUNTIME_UNREACHABLE');return body.ticket;}
}

export function assertLoopbackGatewayControlOrigin(origin:string){let parsed:URL;try{parsed=new URL(origin);}catch{throw new PersistentRuntimeError('RUNTIME_UNREACHABLE','MODEL_GATEWAY_CONTROL_ORIGIN_FORBIDDEN');}const port=Number.parseInt(parsed.port,10);if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1'||parsed.username!==''||parsed.password!==''||parsed.pathname!=='/'||parsed.search!==''||parsed.hash!==''||!Number.isSafeInteger(port)||port<1024||port>65535||parsed.port!==String(port))throw new PersistentRuntimeError('RUNTIME_UNREACHABLE','MODEL_GATEWAY_CONTROL_ORIGIN_FORBIDDEN');return parsed.origin;}
