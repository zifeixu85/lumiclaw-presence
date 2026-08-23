import type {BlobStore} from '@lumiclaw/blob-store';
import {
  MediaContractError,createCompositionSpec,createCompositedAsset,createCostReceipt,createRawProviderAsset,createRightsReceipt,
  mediaProviderRequest,sha256Digest,type BrandSnapshotBinding,type KnowledgeSnapshotBinding,type MediaArtifactRepository,
  type MediaGenerationProvider,type MediaMaturity,type MediaSecretTicket,type OwnerNoOverlayDecision,type ProviderTaskObservation
} from '@lumiclaw/domain';
import {composeXhsDeliveryImage,decodeAndValidateXhsImage} from '@lumiclaw/providers';

export const mediaCrashStages=['SUBMISSION_INTENT_PERSISTED','PROVIDER_TASK_PERSISTED','DOWNLOADING_TRANSITION_PERSISTED','RAW_BLOB_BEFORE_DB_COMMIT','FINAL_BLOB_BEFORE_DB_COMMIT'] as const;
export type MediaCrashStage=typeof mediaCrashStages[number];

export type MediaWorkerDependencies={
  repository:MediaArtifactRepository;blobStore:BlobStore;provider:MediaGenerationProvider;workerId:string;leaseMs:number;
  modelRef:string;capabilityProfileRef:string;providerAdapterSnapshotDigest:string;maturity:MediaMaturity;
  providerSecretFingerprint:string;
  expectedAdapterRef?:string;
  resolvePrompt:(privateRef:string)=>Promise<string>;resolveResult:(observation:ProviderTaskObservation)=>Promise<{bytes:Uint8Array;declaredMime:string}>;
  ticket:(scope:'media:submit'|'media:inspect')=>Promise<MediaSecretTicket>;
  resolveGovernance:(ownerId:string,now:Date)=>Promise<{brandSnapshot:BrandSnapshotBinding;knowledgeSnapshot:KnowledgeSnapshotBinding}>;
  resolveNoOverlayDecision?:(specDigest:string)=>Promise<OwnerNoOverlayDecision|null>;
  crashAfter?:(stage:MediaCrashStage)=>void;
};

export class MediaArtifactWorker {
  public constructor(private readonly dependencies:MediaWorkerDependencies){}
  public async processOnce(now=new Date()):Promise<'IDLE'|'PROGRESSED'|'WAITING'|'REVIEW_REQUIRED'>{const d=this.dependencies;const lease=await d.repository.acquireJob(d.workerId,d.leaseMs,now);if(!lease)return 'IDLE';let job=lease.job;const spec=lease.spec;const token=lease.leaseToken;if(d.expectedAdapterRef!==undefined&&job.providerAdapterRef!==d.expectedAdapterRef)throw new MediaContractError('MEDIA_PROVIDER_PROFILE_STALE');
    if(job.state==='QUEUED'){
      job=await d.repository.persistSubmissionIntent(d.workerId,job.id,token,d.leaseMs,now);d.crashAfter?.('SUBMISSION_INTENT_PERSISTED');
      const prompt=await d.resolvePrompt(spec.promptTextPrivateRef);const request=mediaProviderRequest(spec,d.modelRef,d.capabilityProfileRef);if(sha256Digest(prompt)!==spec.sourcePromptDigest)throw new MediaContractError('MEDIA_DIGEST_MISMATCH');request.promptText=prompt;
      const result=await d.provider.submit(request,await d.ticket('media:submit'));const outcome=result.kind==='ACCEPTED'?{kind:'ACCEPTED' as const,providerTaskId:result.providerTaskRef,providerSubmittedAt:result.observedAt,reservedAmount:result.reservedAmount,providerUsageDigest:result.providerUsageDigest,observedAt:result.observedAt}:result;
      job=await d.repository.persistSubmissionOutcome(d.workerId,job.id,token,outcome,new Date(result.observedAt));if(result.kind!=='ACCEPTED'){if(d.maturity==='REAL_PROVIDER_CANARY')await d.repository.recordProviderCanaryOutcome(job.ownerId,job.id,d.providerSecretFingerprint,'FAILED',result.stableCode,new Date(result.observedAt),new Date(Date.parse(result.observedAt)+24*60*60*1000));return result.kind==='UNKNOWN'?'REVIEW_REQUIRED':'PROGRESSED';}d.crashAfter?.('PROVIDER_TASK_PERSISTED');
    }
    if(job.state==='PROVIDER_PENDING'||job.state==='PROVIDER_PROCESSING'||job.state==='DOWNLOADING'){
      const observation=await d.provider.inspect(job.providerTaskId!,await d.ticket('media:inspect'));
      if(job.state!=='DOWNLOADING')job=await d.repository.persistTaskObservation(d.workerId,job.id,token,observation,new Date(observation.observedAt));
      if(observation.state==='PENDING'||observation.state==='PROCESSING')return 'WAITING';if(observation.state==='FAILED'||observation.state==='UNKNOWN'){if(d.maturity==='REAL_PROVIDER_CANARY')await d.repository.recordProviderCanaryOutcome(job.ownerId,job.id,d.providerSecretFingerprint,'FAILED',observation.stableCode??'MEDIA_PROVIDER_TASK_FAILED',new Date(observation.observedAt),new Date(Date.parse(observation.observedAt)+24*60*60*1000));return 'REVIEW_REQUIRED';}d.crashAfter?.('DOWNLOADING_TRANSITION_PERSISTED');
      const workspace=await d.repository.getWorkspace(job.ownerId);const stagedRaw=workspace.staging.find((item)=>item.jobId===job.id&&item.stage==='RAW_BLOB_WRITTEN'&&item.state==='STAGED') as (typeof workspace.staging[number]&{metadata?:RawCommit})|undefined;
      if(stagedRaw?.metadata){if(!(await d.blobStore.has(stagedRaw.blobRef)))throw new MediaContractError('MEDIA_DIGEST_MISMATCH');await d.repository.commitRawPipeline(job.ownerId,job.id,stagedRaw.metadata.cost,stagedRaw.metadata.rights,stagedRaw.metadata.asset,now);job=(await d.repository.getJob(job.ownerId,job.id))!.job;}
      else {const downloaded=await d.resolveResult(observation);const decoded=await decodeAndValidateXhsImage(downloaded.bytes,downloaded.declaredMime);if(decoded.metadataState==='QUARANTINED')throw new MediaContractError('MEDIA_METADATA_FORBIDDEN');const blobRef=await d.blobStore.put(downloaded.bytes);const checkedAt=observation.observedAt;const cost=createCostReceipt({billingUnit:'provider-credit',reservedAmount:job.providerReservedAmount,finalAmount:observation.finalAmount??null,currencyAmount:null,pricingSourceRef:'provider-profile://media/current',providerUsageDigest:observation.providerUsageDigest??job.providerUsageDigest,state:observation.finalAmount!==undefined?'FINAL':job.providerReservedAmount===null?'UNVERIFIED':'RESERVED',checkedAt});const rights=createRightsReceipt({inputRightsAttestation:d.maturity==='CONTROLLED_FAKE'?'PUBLIC_SAFE_SYNTHETIC':'OWNER_ATTESTED',providerTermsSourceRef:'source-register://media-provider-terms',termsCheckedAt:checkedAt,commercialUseStatus:'UNVERIFIED'});
        const asset=createRawProviderAsset({ownerId:job.ownerId,jobId:job.id,generationSpec:spec,contentDigest:blobRef.digest,blobRef,bytes:blobRef.size,mimeType:decoded.mimeType,width:decoded.width,height:decoded.height,fileName:`raw-${String(spec.imageSpecPosition).padStart(2,'0')}.png`,providerTaskRef:job.providerTaskId!,providerAdapterSnapshotDigest:d.providerAdapterSnapshotDigest,costReceiptDigest:cost.canonicalDigest,rightsReceiptDigest:rights.canonicalDigest,maturity:d.maturity,submittedAt:job.providerSubmittedAt!,completedAt:observation.observedAt,downloadedAt:now.toISOString(),verifiedAt:now.toISOString(),resultExpiresAt:observation.resultExpiresAt??null,metadataState:decoded.metadataState});const metadata={cost,rights,asset};await d.repository.stageBlob(job.ownerId,job.id,'RAW_BLOB_WRITTEN',blobRef,metadata,now);d.crashAfter?.('RAW_BLOB_BEFORE_DB_COMMIT');await d.repository.commitRawPipeline(job.ownerId,job.id,cost,rights,asset,now);job=(await d.repository.getJob(job.ownerId,job.id))!.job;}
    }
    if(job.state==='COMPOSING'){
      const workspace=await d.repository.getWorkspace(job.ownerId);const staged=workspace.staging.find((item)=>item.jobId===job.id&&item.stage==='FINAL_BLOB_WRITTEN'&&item.state==='STAGED') as (typeof workspace.staging[number]&{metadata?:FinalCommit})|undefined;
      if(staged?.metadata){if(!(await d.blobStore.has(staged.blobRef)))throw new MediaContractError('MEDIA_DIGEST_MISMATCH');await d.repository.commitFinalPipeline(job.ownerId,job.id,staged.metadata.composition,staged.metadata.asset,now);if(d.maturity==='REAL_PROVIDER_CANARY')await d.repository.recordProviderCanaryOutcome(job.ownerId,job.id,d.providerSecretFingerprint,'PASSED',null,now,new Date(now.getTime()+24*60*60*1000));return 'PROGRESSED';}
      const raw=workspace.rawAssets.find((value)=>value.jobId===job.id);if(!raw)throw new MediaContractError('MEDIA_JOB_STATE_INVALID');const rawBytes=await d.blobStore.get(raw.blobRef);const ownerNoOverlayDecision=spec.overlayCopy===null?(await d.resolveNoOverlayDecision?.(spec.canonicalDigest)??null):null;const governance=await d.resolveGovernance(job.ownerId,now);const composition=createCompositionSpec({ownerId:job.ownerId,rawAsset:raw,overlayCopy:spec.overlayCopy,brandSnapshot:governance.brandSnapshot,knowledgeSnapshot:governance.knowledgeSnapshot,ownerNoOverlayDecision,createdAt:now.toISOString()});const output=await composeXhsDeliveryImage(rawBytes,raw,composition);const blobRef=await d.blobStore.put(output.bytes);const asset=createCompositedAsset({ownerId:job.ownerId,rawAsset:raw,compositionSpec:composition,contentDigest:blobRef.digest,blobRef,bytes:blobRef.size,mimeType:'image/png',width:1080,height:1440,fileName:`image-${String(spec.imageSpecPosition).padStart(2,'0')}.png`,verifiedAt:now.toISOString(),metadataStripped:true,contrastRatio:output.layout.contrastRatio,fontSizePx:output.layout.fontSizePx,lineCount:output.layout.lineCount});const metadata={composition,asset};await d.repository.stageBlob(job.ownerId,job.id,'FINAL_BLOB_WRITTEN',blobRef,metadata,now);d.crashAfter?.('FINAL_BLOB_BEFORE_DB_COMMIT');await d.repository.commitFinalPipeline(job.ownerId,job.id,composition,asset,now);if(d.maturity==='REAL_PROVIDER_CANARY')await d.repository.recordProviderCanaryOutcome(job.ownerId,job.id,d.providerSecretFingerprint,'PASSED',null,now,new Date(now.getTime()+24*60*60*1000));return 'PROGRESSED';
    }
    return job.state==='READY_FOR_REVIEW'?'PROGRESSED':'WAITING';
  }
}
type RawCommit={cost:ReturnType<typeof createCostReceipt>;rights:ReturnType<typeof createRightsReceipt>;asset:ReturnType<typeof createRawProviderAsset>};
type FinalCommit={composition:ReturnType<typeof createCompositionSpec>;asset:ReturnType<typeof createCompositedAsset>};
