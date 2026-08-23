import {createHash} from 'node:crypto';
import {sha256Digest} from './canonical.js';

export const MEDIA_CONTRACT_VERSION = 'lumiclaw.media-artifact.v2' as const;
export const MEDIA_PACKAGE_CONTRACT_VERSION = 'lumiclaw.manual-publish-package.v4' as const;

export const mediaErrorCodes = [
  'MEDIA_SECRET_NOT_CONFIGURED','MEDIA_PROVIDER_PROFILE_STALE','MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE','MEDIA_PROVIDER_TASK_FAILED',
  'MEDIA_PROVIDER_TASK_UNKNOWN','MEDIA_RESULT_EXPIRED','MEDIA_DOWNLOAD_FAILED','MEDIA_RESULT_EMPTY','MEDIA_RESULT_TOO_LARGE',
  'MEDIA_MIME_INVALID','MEDIA_DIMENSIONS_INVALID','MEDIA_DIGEST_MISMATCH','MEDIA_METADATA_FORBIDDEN','MEDIA_TEXT_OVERFLOW',
  'MEDIA_GLYPH_MISSING','MEDIA_EMOJI_UNSUPPORTED','MEDIA_CONTRAST_INVALID','MEDIA_BRAND_BINDING_STALE',
  'MEDIA_KNOWLEDGE_BINDING_STALE','MEDIA_COMPOSITION_NONDETERMINISTIC','MEDIA_RIGHTS_REVIEW_REQUIRED','MEDIA_SET_INCOMPLETE',
  'MEDIA_REVISION_STALE','MEDIA_AUDITOR_INDEPENDENCE_REQUIRED','MEDIA_AUDIT_PASS_REQUIRED','MEDIA_OWNER_APPROVAL_REQUIRED',
  'MEDIA_PACKAGE_TAMPERED','MEDIA_PROMPT_SECRET_DETECTED','MEDIA_ALT_TEXT_REQUIRED','MEDIA_NO_OVERLAY_OWNER_DECISION_REQUIRED',
  'MEDIA_JOB_STATE_INVALID','MEDIA_LEASE_LOST','MEDIA_PROVIDER_TASK_MISMATCH','MEDIA_SNAPSHOT_NOT_APPROVED',
  'MEDIA_LOGO_BINDING_INVALID','MEDIA_SAFE_AREA_INVALID','SECRET_TICKET_PURPOSE_MISMATCH','SECRET_TICKET_SCOPE_MISMATCH',
  'SECRET_TICKET_EXPIRED','SECRET_TICKET_REPLAYED'
] as const;
export type MediaErrorCode = typeof mediaErrorCodes[number];

export class MediaContractError extends Error {
  public constructor(public readonly code:MediaErrorCode, message=code, public readonly details?:unknown) {
    super(message); this.name='MediaContractError';
  }
}

export type MediaMime = 'image/png'|'image/jpeg'|'image/webp';
export type MediaBlobRef = {algorithm:'sha256';digest:string;size:number};
export type MediaMaturity = 'CONTROLLED_FAKE'|'REAL_PROVIDER_CANARY'|'REAL_PROVIDER_OWNER_UAT';
export type MediaJobState = 'QUEUED'|'SUBMITTING'|'PROVIDER_PENDING'|'PROVIDER_PROCESSING'|'DOWNLOADING'|'VERIFYING'|'COMPOSING'|'READY_FOR_REVIEW'|'FAILED'|'UNKNOWN_CHARGE_STATE'|'CANCELLED';
export type MediaAssetState = 'UNREVIEWED'|'RIGHTS_REVIEW_REQUIRED'|'READY_TO_BIND'|'REJECTED'|'SUPERSEDED'|'QUARANTINED';

const deliveryBase = {
  id:'xhs-delivery-image',version:'1.0.0',width:1080,height:1440,aspectRatio:'3:4',allowedMimes:['image/png','image/jpeg','image/webp'] as const,
  maxBytes:10*1024*1024,coverPosition:1,safeArea:{left:96,right:96,top:120,bottom:120},
  typography:{startFontSizePx:72,minimumFontSizePx:48,fontSizeStepPx:4,lineHeight:1.2,maxLines:3,minimumContrastRatio:4.5},
  metadataPolicy:'STRIP_FINAL_QUARANTINE_RAW',textFreeBackgroundRequired:true
};
export const xhsDeliveryProfile = Object.freeze({...deliveryBase,canonicalDigest:sha256Digest(deliveryBase)});

export type BrandSnapshotBinding={id:string;digest:string;state:'APPROVED'|'DRAFT'|'SUPERSEDED';approvedAt:string|null;expiresAt:string|null};
export type KnowledgeSnapshotBinding={id:string;digest:string;state:'APPROVED'|'DRAFT'|'SUPERSEDED';approvedAt:string|null;expiresAt:string|null};
export type OwnerNoOverlayDecision={decisionId:string;ownerId:string;decidedAt:string;specDigest:string};

export type MediaGenerationSpec={
  schemaVersion:2;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;imageSpecPosition:number;
  promptTextPrivateRef:string;sourcePromptDigest:string;altText:string;overlayCopy:string|null;dimensions:{width:1080;height:1440};
  allowedMimes:MediaMime[];maxBytes:number;textFreeBackgroundRequired:true;policyRef:string;profileRef:string;profileDigest:string;
  createdAt:string;canonicalDigest:string;
};

export type MediaGenerationJob={
  schemaVersion:2;id:string;ownerId:string;specId:string;specDigest:string;artifactRevisionDigest:string;imageSpecPosition:number;generation:number;
  requestDigest:string;state:MediaJobState;providerAdapterRef:string;providerTaskId:string|null;providerSubmittedAt:string|null;lastObservedAt:string|null;
  providerReservedAmount:number|null;providerUsageDigest:string|null;
  leaseOwner:string|null;leaseTokenHash:string|null;leaseExpiresAt:string|null;attemptCount:number;errorCode:MediaErrorCode|null;
  submissionIntentDigest:string|null;createdAt:string;updatedAt:string;canonicalDigest:string;
};

export type ProviderSubmissionOutcome=
  |{kind:'ACCEPTED';providerTaskId:string;providerSubmittedAt:string;reservedAmount:number|null;providerUsageDigest:string|null;observedAt:string}
  |{kind:'DEFINITELY_NOT_CREATED';stableCode:MediaErrorCode;observedAt:string}
  |{kind:'UNKNOWN';stableCode:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE';observedAt:string};

export type MediaProviderExactRequest={
  requestDigest:string;modelRef:string;capabilityProfileRef:string;sourcePromptDigest:string;promptText:string;width:1080;height:1440;n:1;
  promptRewriteAllowed:false;allowedMimes:readonly MediaMime[];maxBytes:number;textFreeBackgroundRequired:true;
};
export type ProviderTaskAccepted={kind:'ACCEPTED';providerTaskRef:string;reservedAmount:number|null;providerUsageDigest:string|null;observedAt:string};
export type ProviderSubmissionResult=ProviderTaskAccepted|{kind:'DEFINITELY_NOT_CREATED';stableCode:MediaErrorCode;observedAt:string}|{kind:'UNKNOWN';stableCode:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE';observedAt:string};
export type ProviderTaskObservation={state:'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'|'UNKNOWN';providerTaskRef:string;resultRef?:string;resultExpiresAt?:string|null;finalAmount?:number|null;providerUsageDigest?:string|null;stableCode?:MediaErrorCode;observedAt:string};
export interface MediaGenerationProvider {submit(request:MediaProviderExactRequest,ticket:MediaSecretTicket):Promise<ProviderSubmissionResult>;inspect(providerTaskRef:string,ticket:MediaSecretTicket):Promise<ProviderTaskObservation>}

export type CostReceipt={schemaVersion:1;billingUnit:string;reservedAmount:number|null;finalAmount:number|null;currencyAmount:number|null;pricingSourceRef:string;providerUsageDigest:string|null;state:'RESERVED'|'FINAL'|'UNVERIFIED';checkedAt:string;canonicalDigest:string};
export type RightsReceipt={schemaVersion:1;inputRightsAttestation:'PUBLIC_SAFE_SYNTHETIC'|'OWNER_ATTESTED';providerTermsSourceRef:string;termsCheckedAt:string;commercialUseStatus:'UNVERIFIED'|'OWNER_ATTESTED';ownerApprovalRequired:true;canonicalDigest:string};

export type RawProviderMediaAssetV2={
  schemaVersion:2;id:string;ownerId:string;assetRole:'PROVIDER_RAW';jobId:string;artifactRevisionId:string;artifactRevisionDigest:string;
  generationSpecId:string;generationSpecDigest:string;position:number;contentDigest:string;blobRef:MediaBlobRef;bytes:number;mimeType:MediaMime;
  width:1080;height:1440;aspectRatio:'3:4';fileName:string;altText:string;sourcePromptDigest:string;promptTextPrivateRef:string;
  providerTaskRef:string;providerAdapterSnapshotDigest:string;costReceiptDigest:string;rightsReceiptDigest:string;maturity:MediaMaturity;
  submittedAt:string;completedAt:string;downloadedAt:string;verifiedAt:string;resultExpiresAt:string|null;metadataState:'CLEAN'|'QUARANTINED';
  approvalState:MediaAssetState;canonicalDigest:string;
};

export type MediaCompositionSpecV1={
  schemaVersion:1;id:string;ownerId:string;rawAssetId:string;rawContentDigest:string;mode:'EXACT_OVERLAY'|'NO_OVERLAY';overlayCopy:string|null;
  overlayCopyDigest:string;brandSnapshotRef:string;brandSnapshotDigest:string;brandSnapshot:BrandSnapshotBinding;knowledgeSnapshotRef:string;knowledgeSnapshotDigest:string;knowledgeSnapshot:KnowledgeSnapshotBinding;
  templateRef:string;templateDigest:string;colorTokens:{foreground:string;panel:string;accent:string};logoAssetRef:string|null;logoAssetDigest:string|null;
  safeArea:{left:96;right:96;top:120;bottom:120};typographyProfileRef:string;typographyProfileDigest:string;
  compositorProfileRef:string;compositorProfileDigest:string;outputProfileRef:string;outputProfileDigest:string;
  ownerNoOverlayDecision:OwnerNoOverlayDecision|null;createdAt:string;canonicalDigest:string;
};

export type CompositedMediaAssetV2={
  schemaVersion:2;id:string;ownerId:string;assetRole:'DELIVERY_COMPOSITE';rawAssetId:string;rawContentDigest:string;compositionSpec:MediaCompositionSpecV1;
  compositionSpecDigest:string;position:number;contentDigest:string;blobRef:MediaBlobRef;bytes:number;mimeType:MediaMime;width:1080;height:1440;
  aspectRatio:'3:4';fileName:string;altText:string;metadataStripped:true;contrastRatio:number;fontSizePx:number;lineCount:number;costReceiptDigest:string;rightsReceiptDigest:string;
  approvalState:'READY_TO_BIND';verifiedAt:string;canonicalDigest:string;
};

export type MediaSetItem={position:number;assetId:string;finalAssetDigest:string;contentDigest:string;blobRef:MediaBlobRef;mimeType:MediaMime;bytes:number;width:1080;height:1440;altText:string;
  rawAssetDigest:string;generationSpecDigest:string;compositionSpecDigest:string;brandSnapshotDigest:string;knowledgeSnapshotDigest:string;templateDigest:string;
  rightsReceiptDigest:string;costReceiptDigest:string;fileName:string};
export type MediaSetBinding={schemaVersion:1;profileRef:string;profileDigest:string;items:MediaSetItem[];canonicalDigest:string};

export type ArtifactRevisionV4={schemaVersion:4;id:string;ownerId:string;platformCode:'XIAOHONGSHU';revision:number;parentRevisionId:string;parentRevisionDigest:string;
  producerIdentityId:string;payloadDigest:string;mediaSetBinding:MediaSetBinding;brandSnapshot:BrandSnapshotBinding;knowledgeSnapshot:KnowledgeSnapshotBinding;
  state:'AWAITING_AUDIT';createdAt:string;canonicalDigest:string};
export type MediaAuditDecisionV4={schemaVersion:4;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;auditorIdentityId:string;result:'PASS'|'FAIL'|'ESCALATE';
  actualMediaDigests:string[];provenanceDigest:string;rightsCostDigest:string;canonicalDigest:string;createdAt:string};
export type MediaOwnerDecisionV4={schemaVersion:4;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;auditDecisionId:string;auditDecisionDigest:string;result:'APPROVE'|'REJECT';ownerIdentityId:string;canonicalDigest:string;decidedAt:string};
export type ManualPublishTextFileV4={position:number;fileName:string;mediaType:'application/json'|'text/plain'|'text/markdown';content:string;digest:string;bytes:number};
export type ManualPublishBinaryFileV4={position:number;fileName:string;mediaType:MediaMime;blobRef:MediaBlobRef;digest:string;bytes:number;width:1080;height:1440};
export type ManualPublishPackageV4={schemaVersion:4;id:string;ownerId:string;platformCode:'XIAOHONGSHU';artifactRevisionId:string;artifactRevisionDigest:string;auditDecisionId:string;auditDecisionDigest:string;ownerDecisionId:string;ownerDecisionDigest:string;
  textFiles:ManualPublishTextFileV4[];binaryFiles:ManualPublishBinaryFileV4[];mediaManifest:{generatedMedia:true;mediaSetDigest:string;items:MediaSetItem[];canonicalDigest:string};manifestDigest:string;state:'READY';createdAt:string;externalState:'UNVERIFIED_EXTERNAL_STATE'};
export type MediaGovernanceInvalidation={schemaVersion:1;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;reasonCode:'MEDIA_CHANGED'|'MEDIA_ORDER_CHANGED'|'MEDIA_COMPOSITION_CHANGED'|'MEDIA_BRAND_SNAPSHOT_CHANGED'|'MEDIA_KNOWLEDGE_SNAPSHOT_CHANGED'|'MEDIA_RIGHTS_CHANGED'|'MEDIA_POLICY_CHANGED'|'MEDIA_TAMPER_DETECTED';currentDigest:string;invalidates:['AUDIT','OWNER_DECISION','PACKAGE'];createdAt:string;canonicalDigest:string};

export type SecretGatePurpose='MODEL_PROVIDER'|'MEDIA_PROVIDER';
export type SecretTicketScope='model:invoke'|'media:submit'|'media:inspect';
export type MediaSecretTicket={schemaVersion:1;purpose:SecretGatePurpose;scope:SecretTicketScope;secretFingerprint:string;nonceDigest:string;issuedAt:string;expiresAt:string;canonicalDigest:string};
export type MediaLease={job:MediaGenerationJob;spec:MediaGenerationSpec;leaseToken:string};
export type MediaBlobStage={ownerId:string;jobId:string;stage:'RAW_BLOB_WRITTEN'|'FINAL_BLOB_WRITTEN';contentDigest:string;blobRef:MediaBlobRef;state:'STAGED'|'COMMITTED'|'QUARANTINED';createdAt:string;committedAt:string|null};
export type MediaWorkspace={specs:MediaGenerationSpec[];jobs:MediaGenerationJob[];taskReceipts:unknown[];costReceipts:CostReceipt[];rightsReceipts:RightsReceipt[];rawAssets:RawProviderMediaAssetV2[];compositionSpecs:MediaCompositionSpecV1[];finalAssets:CompositedMediaAssetV2[];revisions:ArtifactRevisionV4[];audits:MediaAuditDecisionV4[];ownerDecisions:MediaOwnerDecisionV4[];packages:ManualPublishPackageV4[];invalidations:MediaGovernanceInvalidation[];staging:MediaBlobStage[]};
export interface MediaArtifactRepository {
  health():Promise<boolean>;
  enqueue(ownerId:string,specs:MediaGenerationSpec[],generation:number,providerAdapterRef:string,idempotencyKey:string,now:Date):Promise<{jobs:MediaGenerationJob[];replayed:boolean}>;
  getWorkspace(ownerId:string):Promise<MediaWorkspace>;
  getJob(ownerId:string,jobId:string):Promise<{job:MediaGenerationJob;spec:MediaGenerationSpec}|undefined>;
  acquireJob(workerId:string,leaseMs:number,now:Date):Promise<MediaLease|undefined>;
  heartbeat(workerId:string,jobId:string,leaseToken:string,leaseMs:number,now:Date):Promise<MediaGenerationJob>;
  persistSubmissionIntent(workerId:string,jobId:string,leaseToken:string,leaseMs:number,now:Date):Promise<MediaGenerationJob>;
  persistSubmissionOutcome(workerId:string,jobId:string,leaseToken:string,outcome:ProviderSubmissionOutcome,now:Date):Promise<MediaGenerationJob>;
  persistTaskObservation(workerId:string,jobId:string,leaseToken:string,observation:ProviderTaskObservation,now:Date):Promise<MediaGenerationJob>;
  stageBlob(ownerId:string,jobId:string,stage:MediaBlobStage['stage'],blobRef:MediaBlobRef,metadata:unknown,now:Date):Promise<MediaBlobStage>;
  commitRawPipeline(ownerId:string,jobId:string,cost:CostReceipt,rights:RightsReceipt,asset:RawProviderMediaAssetV2,now:Date):Promise<void>;
  commitFinalPipeline(ownerId:string,jobId:string,composition:MediaCompositionSpecV1,asset:CompositedMediaAssetV2,now:Date):Promise<void>;
  appendRevision(ownerId:string,revision:ArtifactRevisionV4,now:Date):Promise<ArtifactRevisionV4>;
  appendAudit(ownerId:string,audit:MediaAuditDecisionV4,now:Date):Promise<MediaAuditDecisionV4>;
  appendOwnerDecision(ownerId:string,decision:MediaOwnerDecisionV4,now:Date):Promise<MediaOwnerDecisionV4>;
  appendPackage(ownerId:string,value:ManualPublishPackageV4,now:Date):Promise<ManualPublishPackageV4>;
  appendInvalidation(ownerId:string,value:MediaGovernanceInvalidation,now:Date):Promise<MediaGovernanceInvalidation>;
  close():Promise<void>;
}

export function createMediaGenerationSpec(input:{ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;imageSpecPosition:number;promptTextPrivateRef:string;promptText:string;altText:string;overlayCopy:string|null;createdAt:string}):MediaGenerationSpec {
  if(!positive(input.imageSpecPosition))throw new MediaContractError('MEDIA_SET_INCOMPLETE');
  if(!nonEmpty(input.altText))throw new MediaContractError('MEDIA_ALT_TEXT_REQUIRED');
  if(!nonEmpty(input.promptText)||secretShaped(input.promptText))throw new MediaContractError('MEDIA_PROMPT_SECRET_DETECTED');
  const base={schemaVersion:2 as const,id:stableId('media-spec',{revision:input.artifactRevisionDigest,position:input.imageSpecPosition,prompt:sha256Digest(input.promptText),createdAt:input.createdAt}),ownerId:input.ownerId,
    artifactRevisionId:input.artifactRevisionId,artifactRevisionDigest:input.artifactRevisionDigest,imageSpecPosition:input.imageSpecPosition,promptTextPrivateRef:input.promptTextPrivateRef,
    sourcePromptDigest:sha256Digest(input.promptText),altText:input.altText.trim(),overlayCopy:input.overlayCopy,dimensions:{width:1080 as const,height:1440 as const},
    allowedMimes:[...xhsDeliveryProfile.allowedMimes] as MediaMime[],maxBytes:xhsDeliveryProfile.maxBytes,textFreeBackgroundRequired:true as const,
    policyRef:'media-generation-policy://text-free-background/v1',profileRef:`media-profile://${xhsDeliveryProfile.id}/${xhsDeliveryProfile.version}`,profileDigest:xhsDeliveryProfile.canonicalDigest,createdAt:input.createdAt};
  return {...base,canonicalDigest:sha256Digest(base)};
}

export function createMediaGenerationJob(input:{ownerId:string;generationSpec:MediaGenerationSpec;generation:number;providerAdapterRef:string;createdAt:string}):MediaGenerationJob {
  if(!positive(input.generation))throw new MediaContractError('MEDIA_JOB_STATE_INVALID');
  const requestDigest=sha256Digest({specDigest:input.generationSpec.canonicalDigest,generation:input.generation,providerAdapterRef:input.providerAdapterRef});
  const base={schemaVersion:2 as const,id:stableId('media-job',{requestDigest}),ownerId:input.ownerId,specId:input.generationSpec.id,specDigest:input.generationSpec.canonicalDigest,
    artifactRevisionDigest:input.generationSpec.artifactRevisionDigest,imageSpecPosition:input.generationSpec.imageSpecPosition,generation:input.generation,requestDigest,state:'QUEUED' as const,
    providerAdapterRef:input.providerAdapterRef,providerTaskId:null,providerSubmittedAt:null,lastObservedAt:null,providerReservedAmount:null,providerUsageDigest:null,leaseOwner:null,leaseTokenHash:null,leaseExpiresAt:null,attemptCount:0,errorCode:null,submissionIntentDigest:null,
    createdAt:input.createdAt,updatedAt:input.createdAt};
  return withJobDigest(base);
}

export function recordProviderSubmissionIntent(job:MediaGenerationJob,input:{leaseOwner:string;leaseTokenHash:string;leaseExpiresAt:string;recordedAt:string}):MediaGenerationJob {
  if(job.state==='UNKNOWN_CHARGE_STATE')throw new MediaContractError('MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE');
  if(job.state!=='QUEUED')throw new MediaContractError('MEDIA_JOB_STATE_INVALID');
  const submissionIntentDigest=sha256Digest({jobId:job.id,requestDigest:job.requestDigest,leaseOwner:input.leaseOwner,attempt:job.attemptCount+1,recordedAt:input.recordedAt});
  return withJobDigest({...withoutJobDigest(job),state:'SUBMITTING',leaseOwner:input.leaseOwner,leaseTokenHash:input.leaseTokenHash,leaseExpiresAt:input.leaseExpiresAt,attemptCount:job.attemptCount+1,submissionIntentDigest,updatedAt:input.recordedAt});
}

export function applyProviderSubmissionOutcome(job:MediaGenerationJob,outcome:ProviderSubmissionOutcome):MediaGenerationJob {
  if(job.state!=='SUBMITTING'||job.submissionIntentDigest===null)throw new MediaContractError('MEDIA_JOB_STATE_INVALID');
  if(outcome.kind==='ACCEPTED')return withJobDigest({...withoutJobDigest(job),state:'PROVIDER_PENDING',providerTaskId:outcome.providerTaskId,providerSubmittedAt:outcome.providerSubmittedAt,lastObservedAt:outcome.observedAt,providerReservedAmount:outcome.reservedAmount,providerUsageDigest:outcome.providerUsageDigest,updatedAt:outcome.observedAt,errorCode:null});
  if(outcome.kind==='UNKNOWN')return withJobDigest({...withoutJobDigest(job),state:'UNKNOWN_CHARGE_STATE',lastObservedAt:outcome.observedAt,updatedAt:outcome.observedAt,errorCode:outcome.stableCode});
  return withJobDigest({...withoutJobDigest(job),state:'FAILED',lastObservedAt:outcome.observedAt,updatedAt:outcome.observedAt,errorCode:outcome.stableCode});
}

export function claimMediaGenerationJob(job:MediaGenerationJob,input:{leaseOwner:string;leaseTokenHash:string;leaseExpiresAt:string;claimedAt:string}):MediaGenerationJob {
  if(['READY_FOR_REVIEW','FAILED','UNKNOWN_CHARGE_STATE','CANCELLED','SUBMITTING'].includes(job.state))throw new MediaContractError('MEDIA_JOB_STATE_INVALID');
  return withJobDigest({...withoutJobDigest(job),leaseOwner:input.leaseOwner,leaseTokenHash:input.leaseTokenHash,leaseExpiresAt:input.leaseExpiresAt,updatedAt:input.claimedAt});
}

export function heartbeatMediaGenerationJob(job:MediaGenerationJob,input:{leaseOwner:string;leaseTokenHash:string;leaseExpiresAt:string;observedAt:string}):MediaGenerationJob {
  if(job.leaseOwner!==input.leaseOwner||job.leaseTokenHash!==input.leaseTokenHash)throw new MediaContractError('MEDIA_LEASE_LOST');
  return withJobDigest({...withoutJobDigest(job),leaseExpiresAt:input.leaseExpiresAt,updatedAt:input.observedAt});
}

export function applyProviderTaskObservation(job:MediaGenerationJob,observation:ProviderTaskObservation):MediaGenerationJob {
  if(job.providerTaskId===null||observation.providerTaskRef!==job.providerTaskId)throw new MediaContractError('MEDIA_PROVIDER_TASK_MISMATCH');
  const base=withoutJobDigest(job);if(observation.state==='PENDING')return withJobDigest({...base,state:'PROVIDER_PENDING',lastObservedAt:observation.observedAt,updatedAt:observation.observedAt,errorCode:null});
  if(observation.state==='PROCESSING')return withJobDigest({...base,state:'PROVIDER_PROCESSING',lastObservedAt:observation.observedAt,updatedAt:observation.observedAt,errorCode:null});
  if(observation.state==='COMPLETED')return withJobDigest({...base,state:'DOWNLOADING',lastObservedAt:observation.observedAt,updatedAt:observation.observedAt,errorCode:null});
  if(observation.state==='FAILED')return withJobDigest({...base,state:'FAILED',lastObservedAt:observation.observedAt,updatedAt:observation.observedAt,errorCode:observation.stableCode??'MEDIA_PROVIDER_TASK_FAILED'});
  return withJobDigest({...base,state:'PROVIDER_PENDING',lastObservedAt:observation.observedAt,updatedAt:observation.observedAt,errorCode:observation.stableCode??'MEDIA_PROVIDER_TASK_UNKNOWN'});
}

export function advanceMediaGenerationJob(job:MediaGenerationJob,input:{state:'VERIFYING'|'COMPOSING'|'READY_FOR_REVIEW'|'FAILED';observedAt:string;errorCode?:MediaErrorCode|null}):MediaGenerationJob {
  const allowed:Record<MediaGenerationJob['state'],MediaGenerationJob['state'][]>= {QUEUED:[],SUBMITTING:[],PROVIDER_PENDING:[],PROVIDER_PROCESSING:[],DOWNLOADING:['VERIFYING','FAILED'],VERIFYING:['COMPOSING','FAILED'],COMPOSING:['READY_FOR_REVIEW','FAILED'],READY_FOR_REVIEW:[],FAILED:[],UNKNOWN_CHARGE_STATE:[],CANCELLED:[]};
  if(!allowed[job.state].includes(input.state))throw new MediaContractError('MEDIA_JOB_STATE_INVALID');return withJobDigest({...withoutJobDigest(job),state:input.state,errorCode:input.errorCode??null,updatedAt:input.observedAt});
}

export function mediaProviderRequest(spec:MediaGenerationSpec,modelRef:string,capabilityProfileRef:string):MediaProviderExactRequest {
  const base={modelRef,capabilityProfileRef,sourcePromptDigest:spec.sourcePromptDigest,promptTextPrivateRef:spec.promptTextPrivateRef,width:1080 as const,height:1440 as const,n:1 as const,promptRewriteAllowed:false as const,allowedMimes:spec.allowedMimes,maxBytes:spec.maxBytes,textFreeBackgroundRequired:true as const};
  return {...base,promptText:'PRIVATE_REF_RESOLVED_BY_WORKER',requestDigest:sha256Digest(base)};
}

export function createCostReceipt(input:Omit<CostReceipt,'schemaVersion'|'canonicalDigest'>):CostReceipt {const base={schemaVersion:1 as const,...input};return {...base,canonicalDigest:sha256Digest(base)};}
export function createRightsReceipt(input:Omit<RightsReceipt,'schemaVersion'|'canonicalDigest'|'ownerApprovalRequired'>):RightsReceipt {const base={schemaVersion:1 as const,...input,ownerApprovalRequired:true as const};return {...base,canonicalDigest:sha256Digest(base)};}

export function createRawProviderAsset(input:{ownerId:string;jobId:string;generationSpec:MediaGenerationSpec;contentDigest:string;blobRef:MediaBlobRef;bytes:number;mimeType:MediaMime;width:number;height:number;fileName:string;providerTaskRef:string;providerAdapterSnapshotDigest:string;costReceiptDigest:string;rightsReceiptDigest:string;maturity:MediaMaturity;submittedAt:string;completedAt:string;downloadedAt:string;verifiedAt:string;resultExpiresAt:string|null;metadataState:'CLEAN'|'QUARANTINED'}):RawProviderMediaAssetV2 {
  validateImageShape(input); if(input.metadataState==='QUARANTINED')throw new MediaContractError('MEDIA_METADATA_FORBIDDEN');
  const base={schemaVersion:2 as const,id:stableId('raw-media',{jobId:input.jobId,digest:input.contentDigest}),ownerId:input.ownerId,assetRole:'PROVIDER_RAW' as const,jobId:input.jobId,
    artifactRevisionId:input.generationSpec.artifactRevisionId,artifactRevisionDigest:input.generationSpec.artifactRevisionDigest,generationSpecId:input.generationSpec.id,generationSpecDigest:input.generationSpec.canonicalDigest,
    position:input.generationSpec.imageSpecPosition,contentDigest:input.contentDigest,blobRef:input.blobRef,bytes:input.bytes,mimeType:input.mimeType,width:1080 as const,height:1440 as const,aspectRatio:'3:4' as const,fileName:input.fileName,
    altText:input.generationSpec.altText,sourcePromptDigest:input.generationSpec.sourcePromptDigest,promptTextPrivateRef:input.generationSpec.promptTextPrivateRef,providerTaskRef:input.providerTaskRef,
    providerAdapterSnapshotDigest:input.providerAdapterSnapshotDigest,costReceiptDigest:input.costReceiptDigest,rightsReceiptDigest:input.rightsReceiptDigest,maturity:input.maturity,submittedAt:input.submittedAt,
    completedAt:input.completedAt,downloadedAt:input.downloadedAt,verifiedAt:input.verifiedAt,resultExpiresAt:input.resultExpiresAt,metadataState:input.metadataState,approvalState:'UNREVIEWED' as const};
  return {...base,canonicalDigest:sha256Digest(base)};
}

export const mediaCompositionResourceSnapshot=Object.freeze({templateRef:'media-template://editorial-panel/v1',templateDigest:sha256Digest('editorial-panel-v1'),typographyProfileRef:'media-typography://noto-sans-sc/v1',typographyProfileDigest:sha256Digest('noto-sans-sc-2.004-regular'),compositorProfileRef:'media-compositor://sharp-opentype/v1',compositorProfileDigest:sha256Digest('sharp-opentype-pinned-v1'),outputProfileRef:'media-output://xhs-png/v1',outputProfileDigest:sha256Digest('xhs-png-1080x1440-v1')});

export function createCompositionSpec(input:{ownerId:string;rawAsset:RawProviderMediaAssetV2;overlayCopy:string|null;brandSnapshot:BrandSnapshotBinding;knowledgeSnapshot:KnowledgeSnapshotBinding;ownerNoOverlayDecision:OwnerNoOverlayDecision|null;createdAt:string;colorTokens?:{foreground:string;panel:string;accent:string};logoAssetRef?:string|null;logoAssetDigest?:string|null}):MediaCompositionSpecV1 {
  assertSnapshot(input.brandSnapshot,'MEDIA_BRAND_BINDING_STALE',input.createdAt);assertSnapshot(input.knowledgeSnapshot,'MEDIA_KNOWLEDGE_BINDING_STALE',input.createdAt);
  const mode:'NO_OVERLAY'|'EXACT_OVERLAY'=input.overlayCopy===null?'NO_OVERLAY':'EXACT_OVERLAY';
  if(mode==='NO_OVERLAY'&&(input.ownerNoOverlayDecision===null||input.ownerNoOverlayDecision.ownerId!==input.ownerId||input.ownerNoOverlayDecision.specDigest!==input.rawAsset.generationSpecDigest))throw new MediaContractError('MEDIA_NO_OVERLAY_OWNER_DECISION_REQUIRED');
  if(mode==='EXACT_OVERLAY'&&!nonEmpty(input.overlayCopy))throw new MediaContractError('MEDIA_TEXT_OVERFLOW');
  const base={schemaVersion:1 as const,id:stableId('media-composition',{raw:input.rawAsset.canonicalDigest,overlay:input.overlayCopy,brand:input.brandSnapshot.digest,knowledge:input.knowledgeSnapshot.digest}),ownerId:input.ownerId,
    rawAssetId:input.rawAsset.id,rawContentDigest:input.rawAsset.contentDigest,mode,overlayCopy:input.overlayCopy,overlayCopyDigest:sha256Digest(input.overlayCopy),brandSnapshotRef:input.brandSnapshot.id,brandSnapshotDigest:input.brandSnapshot.digest,brandSnapshot:input.brandSnapshot,
    knowledgeSnapshotRef:input.knowledgeSnapshot.id,knowledgeSnapshotDigest:input.knowledgeSnapshot.digest,knowledgeSnapshot:input.knowledgeSnapshot,...mediaCompositionResourceSnapshot,colorTokens:input.colorTokens??{foreground:'#ffffff',panel:'#132238',accent:'#ed6a5a'},
    logoAssetRef:input.logoAssetRef??null,logoAssetDigest:input.logoAssetDigest??null,safeArea:{left:96 as const,right:96 as const,top:120 as const,bottom:120 as const},ownerNoOverlayDecision:input.ownerNoOverlayDecision,createdAt:input.createdAt};
  return {...base,canonicalDigest:sha256Digest(base)};
}

export function createCompositedAsset(input:{ownerId:string;rawAsset:RawProviderMediaAssetV2;compositionSpec:MediaCompositionSpecV1;contentDigest:string;blobRef:MediaBlobRef;bytes:number;mimeType:MediaMime;width:number;height:number;fileName:string;verifiedAt:string;metadataStripped:boolean;contrastRatio:number;fontSizePx:number;lineCount:number}):CompositedMediaAssetV2 {
  validateImageShape(input);if(!input.metadataStripped)throw new MediaContractError('MEDIA_METADATA_FORBIDDEN');
  if(input.compositionSpec.rawAssetId!==input.rawAsset.id||input.compositionSpec.rawContentDigest!==input.rawAsset.contentDigest)throw new MediaContractError('MEDIA_DIGEST_MISMATCH');
  if(input.compositionSpec.mode==='EXACT_OVERLAY'&&input.contrastRatio<xhsDeliveryProfile.typography.minimumContrastRatio)throw new MediaContractError('MEDIA_CONTRAST_INVALID');
  if(input.lineCount>xhsDeliveryProfile.typography.maxLines||input.fontSizePx<xhsDeliveryProfile.typography.minimumFontSizePx)throw new MediaContractError('MEDIA_TEXT_OVERFLOW');
  const base={schemaVersion:2 as const,id:stableId('final-media',{raw:input.rawAsset.id,composition:input.compositionSpec.canonicalDigest,digest:input.contentDigest}),ownerId:input.ownerId,assetRole:'DELIVERY_COMPOSITE' as const,
    rawAssetId:input.rawAsset.id,rawContentDigest:input.rawAsset.contentDigest,compositionSpec:input.compositionSpec,compositionSpecDigest:input.compositionSpec.canonicalDigest,position:input.rawAsset.position,
    contentDigest:input.contentDigest,blobRef:input.blobRef,bytes:input.bytes,mimeType:input.mimeType,width:1080 as const,height:1440 as const,aspectRatio:'3:4' as const,fileName:input.fileName,altText:input.rawAsset.altText,
    metadataStripped:true as const,contrastRatio:input.contrastRatio,fontSizePx:input.fontSizePx,lineCount:input.lineCount,costReceiptDigest:input.rawAsset.costReceiptDigest,rightsReceiptDigest:input.rawAsset.rightsReceiptDigest,approvalState:'READY_TO_BIND' as const,verifiedAt:input.verifiedAt};
  return {...base,canonicalDigest:sha256Digest(base)};
}

export function createMediaSetBinding(input:{items:CompositedMediaAssetV2[];sourceImageSpecs:MediaGenerationSpec[]}):MediaSetBinding {
  if(input.items.length===0||input.items.length!==input.sourceImageSpecs.length)throw new MediaContractError('MEDIA_SET_INCOMPLETE');
  const items=[...input.items].sort((a,b)=>a.position-b.position);const specs=[...input.sourceImageSpecs].sort((a,b)=>a.imageSpecPosition-b.imageSpecPosition);
  for(let index=0;index<items.length;index+=1){const expected=index+1;const asset=items[index];const spec=specs[index];if(asset?.position!==expected||spec?.imageSpecPosition!==expected||asset.altText!==spec.altText||asset.compositionSpec.rawAssetId!==asset.rawAssetId)throw new MediaContractError('MEDIA_SET_INCOMPLETE');}
  const mediaItems=items.map((asset,index):MediaSetItem=>({position:asset.position,assetId:asset.id,finalAssetDigest:asset.canonicalDigest,contentDigest:asset.contentDigest,blobRef:asset.blobRef,mimeType:asset.mimeType,bytes:asset.bytes,width:1080,height:1440,altText:asset.altText,
    rawAssetDigest:asset.rawContentDigest,generationSpecDigest:specs[index]!.canonicalDigest,compositionSpecDigest:asset.compositionSpecDigest,brandSnapshotDigest:asset.compositionSpec.brandSnapshotDigest,knowledgeSnapshotDigest:asset.compositionSpec.knowledgeSnapshotDigest,
    templateDigest:asset.compositionSpec.templateDigest,rightsReceiptDigest:asset.rightsReceiptDigest,costReceiptDigest:asset.costReceiptDigest,fileName:asset.fileName}));
  const base={schemaVersion:1 as const,profileRef:`media-profile://${xhsDeliveryProfile.id}/${xhsDeliveryProfile.version}`,profileDigest:xhsDeliveryProfile.canonicalDigest,items:mediaItems};return {...base,canonicalDigest:sha256Digest(base)};
}

export function materializeXhsMediaRevision(input:{ownerId:string;sourceRevision:{id:string;canonicalDigest:string;revision:number;producerIdentityId:string;payloadDigest:string};mediaSetBinding:MediaSetBinding;brandSnapshot:BrandSnapshotBinding;knowledgeSnapshot:KnowledgeSnapshotBinding;createdAt:string}):ArtifactRevisionV4 {
  assertSnapshot(input.brandSnapshot,'MEDIA_BRAND_BINDING_STALE',input.createdAt);assertSnapshot(input.knowledgeSnapshot,'MEDIA_KNOWLEDGE_BINDING_STALE',input.createdAt);
  if(input.mediaSetBinding.items.some((item)=>item.brandSnapshotDigest!==input.brandSnapshot.digest||item.knowledgeSnapshotDigest!==input.knowledgeSnapshot.digest))throw new MediaContractError('MEDIA_REVISION_STALE');
  const base={schemaVersion:4 as const,id:stableId('xhs-media-revision',{parent:input.sourceRevision.canonicalDigest,media:input.mediaSetBinding.canonicalDigest}),ownerId:input.ownerId,platformCode:'XIAOHONGSHU' as const,revision:input.sourceRevision.revision+1,
    parentRevisionId:input.sourceRevision.id,parentRevisionDigest:input.sourceRevision.canonicalDigest,producerIdentityId:input.sourceRevision.producerIdentityId,payloadDigest:input.sourceRevision.payloadDigest,mediaSetBinding:input.mediaSetBinding,
    brandSnapshot:input.brandSnapshot,knowledgeSnapshot:input.knowledgeSnapshot,state:'AWAITING_AUDIT' as const,createdAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

export function createMediaAuditDecision(input:{ownerId:string;revision:ArtifactRevisionV4;auditorIdentityId:string;result:'PASS'|'FAIL'|'ESCALATE';createdAt:string}):MediaAuditDecisionV4 {
  if(input.auditorIdentityId===input.revision.producerIdentityId)throw new MediaContractError('MEDIA_AUDITOR_INDEPENDENCE_REQUIRED');
  const base={schemaVersion:4 as const,id:stableId('media-audit',{revision:input.revision.canonicalDigest,auditor:input.auditorIdentityId,result:input.result}),ownerId:input.ownerId,artifactRevisionId:input.revision.id,artifactRevisionDigest:input.revision.canonicalDigest,
    auditorIdentityId:input.auditorIdentityId,result:input.result,actualMediaDigests:input.revision.mediaSetBinding.items.map((item)=>item.contentDigest),provenanceDigest:sha256Digest(input.revision.mediaSetBinding.items.map((item)=>({raw:item.rawAssetDigest,composition:item.compositionSpecDigest}))),
    rightsCostDigest:sha256Digest(input.revision.mediaSetBinding.items.map((item)=>({rights:item.rightsReceiptDigest,cost:item.costReceiptDigest}))),createdAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

export function createMediaOwnerDecision(input:{ownerId:string;revision:ArtifactRevisionV4;audit:MediaAuditDecisionV4;ownerIdentityId:string;result:'APPROVE'|'REJECT';createdAt:string}):MediaOwnerDecisionV4 {
  assertAuditBinding(input.revision,input.audit);if(input.result==='APPROVE'&&input.audit.result!=='PASS')throw new MediaContractError('MEDIA_AUDIT_PASS_REQUIRED');
  const base={schemaVersion:4 as const,id:stableId('media-owner-decision',{revision:input.revision.canonicalDigest,audit:input.audit.canonicalDigest,result:input.result}),ownerId:input.ownerId,artifactRevisionId:input.revision.id,artifactRevisionDigest:input.revision.canonicalDigest,
    auditDecisionId:input.audit.id,auditDecisionDigest:input.audit.canonicalDigest,result:input.result,ownerIdentityId:input.ownerIdentityId,decidedAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

export function createManualPublishPackageV4(input:{ownerId:string;revision:ArtifactRevisionV4;audit:MediaAuditDecisionV4;decision:MediaOwnerDecisionV4;textFiles:Array<{fileName:string;mediaType:'application/json'|'text/plain'|'text/markdown';content:string}>;createdAt:string}):ManualPublishPackageV4 {
  assertAuditBinding(input.revision,input.audit);if(input.audit.result!=='PASS')throw new MediaContractError('MEDIA_AUDIT_PASS_REQUIRED');
  if(input.decision.result!=='APPROVE'||input.decision.artifactRevisionDigest!==input.revision.canonicalDigest||input.decision.auditDecisionDigest!==input.audit.canonicalDigest)throw new MediaContractError('MEDIA_OWNER_APPROVAL_REQUIRED');
  const textFiles=input.textFiles.map((file,index)=>({position:index+1,fileName:file.fileName,mediaType:file.mediaType,content:file.content,digest:createHash('sha256').update(file.content,'utf8').digest('hex'),bytes:Buffer.byteLength(file.content)}));
  const binaryFiles=input.revision.mediaSetBinding.items.map((item,index)=>({position:textFiles.length+index+1,fileName:item.fileName,mediaType:item.mimeType,blobRef:item.blobRef,digest:item.contentDigest,bytes:item.bytes,width:1080 as const,height:1440 as const}));
  const mediaManifestBase={generatedMedia:true as const,mediaSetDigest:input.revision.mediaSetBinding.canonicalDigest,items:input.revision.mediaSetBinding.items};const mediaManifest={...mediaManifestBase,canonicalDigest:sha256Digest(mediaManifestBase)};
  const manifestBase={contract:MEDIA_PACKAGE_CONTRACT_VERSION,revision:input.revision.canonicalDigest,audit:input.audit.canonicalDigest,decision:input.decision.canonicalDigest,textFiles:textFiles.map(({fileName,mediaType,digest,bytes})=>({fileName,mediaType,digest,bytes})),binaryFiles:binaryFiles.map(({fileName,mediaType,digest,bytes})=>({fileName,mediaType,digest,bytes})),mediaManifestDigest:mediaManifest.canonicalDigest,externalState:'UNVERIFIED_EXTERNAL_STATE'};
  const manifestDigest=sha256Digest(manifestBase);return {schemaVersion:4,id:stableId('manual-package-v4',{manifestDigest}),ownerId:input.ownerId,platformCode:'XIAOHONGSHU',artifactRevisionId:input.revision.id,artifactRevisionDigest:input.revision.canonicalDigest,
    auditDecisionId:input.audit.id,auditDecisionDigest:input.audit.canonicalDigest,ownerDecisionId:input.decision.id,ownerDecisionDigest:input.decision.canonicalDigest,textFiles,binaryFiles,mediaManifest,manifestDigest,state:'READY',createdAt:input.createdAt,externalState:'UNVERIFIED_EXTERNAL_STATE'};
}

export function invalidateMediaGovernance(input:{ownerId:string;revision:ArtifactRevisionV4;reasonCode:MediaGovernanceInvalidation['reasonCode'];currentDigest:string;createdAt:string}):MediaGovernanceInvalidation {
  const base={schemaVersion:1 as const,id:stableId('media-invalidation',{revision:input.revision.canonicalDigest,reason:input.reasonCode,current:input.currentDigest}),ownerId:input.ownerId,artifactRevisionId:input.revision.id,artifactRevisionDigest:input.revision.canonicalDigest,
    reasonCode:input.reasonCode,currentDigest:input.currentDigest,invalidates:['AUDIT','OWNER_DECISION','PACKAGE'] as ['AUDIT','OWNER_DECISION','PACKAGE'],createdAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

export function issueMediaSecretTicket(input:{purpose:SecretGatePurpose;scope:SecretTicketScope;secretFingerprint:string;nonce:string;issuedAt:string;expiresAt:string}):MediaSecretTicket {
  if((input.purpose==='MEDIA_PROVIDER'&&!input.scope.startsWith('media:'))||(input.purpose==='MODEL_PROVIDER'&&!input.scope.startsWith('model:')))throw new MediaContractError('SECRET_TICKET_PURPOSE_MISMATCH');
  const base={schemaVersion:1 as const,purpose:input.purpose,scope:input.scope,secretFingerprint:input.secretFingerprint,nonceDigest:sha256Digest(input.nonce),issuedAt:input.issuedAt,expiresAt:input.expiresAt};return {...base,canonicalDigest:sha256Digest(base)};
}
export function assertMediaSecretTicket(ticket:MediaSecretTicket,input:{purpose:SecretGatePurpose;scope:SecretTicketScope;now:string}):MediaSecretTicket {
  if(ticket.purpose!==input.purpose)throw new MediaContractError('SECRET_TICKET_PURPOSE_MISMATCH');if(ticket.scope!==input.scope)throw new MediaContractError('SECRET_TICKET_SCOPE_MISMATCH');if(Date.parse(ticket.expiresAt)<=Date.parse(input.now))throw new MediaContractError('SECRET_TICKET_EXPIRED');return ticket;
}
export class MediaSecretTicketUseGuard {readonly #used=new Set<string>();public consume(ticket:MediaSecretTicket,input:{purpose:SecretGatePurpose;scope:SecretTicketScope;now:string}){assertMediaSecretTicket(ticket,input);if(this.#used.has(ticket.canonicalDigest))throw new MediaContractError('SECRET_TICKET_REPLAYED');this.#used.add(ticket.canonicalDigest);return ticket;}}

function withJobDigest<T extends Omit<MediaGenerationJob,'canonicalDigest'>>(base:T):MediaGenerationJob{return {...base,canonicalDigest:sha256Digest(base)};}
function withoutJobDigest(job:MediaGenerationJob):Omit<MediaGenerationJob,'canonicalDigest'>{const base={...job};delete (base as Partial<MediaGenerationJob>).canonicalDigest;return base;}
function validateImageShape(input:{contentDigest:string;blobRef:MediaBlobRef;bytes:number;mimeType:MediaMime;width:number;height:number}) {if(input.bytes<=0)throw new MediaContractError('MEDIA_RESULT_EMPTY');if(input.bytes>xhsDeliveryProfile.maxBytes)throw new MediaContractError('MEDIA_RESULT_TOO_LARGE');if(!xhsDeliveryProfile.allowedMimes.includes(input.mimeType))throw new MediaContractError('MEDIA_MIME_INVALID');if(input.width!==1080||input.height!==1440)throw new MediaContractError('MEDIA_DIMENSIONS_INVALID');if(input.blobRef.digest!==input.contentDigest||input.blobRef.size!==input.bytes)throw new MediaContractError('MEDIA_DIGEST_MISMATCH');}
function assertSnapshot(snapshot:BrandSnapshotBinding|KnowledgeSnapshotBinding,code:'MEDIA_BRAND_BINDING_STALE'|'MEDIA_KNOWLEDGE_BINDING_STALE',now:string){if(snapshot.state!=='APPROVED'||snapshot.approvedAt===null||(snapshot.expiresAt!==null&&Date.parse(snapshot.expiresAt)<=Date.parse(now)))throw new MediaContractError(code);}
function assertAuditBinding(revision:ArtifactRevisionV4,audit:MediaAuditDecisionV4){if(audit.artifactRevisionId!==revision.id||audit.artifactRevisionDigest!==revision.canonicalDigest)throw new MediaContractError('MEDIA_REVISION_STALE');}
function stableId(prefix:string,value:unknown){return `${prefix}-${sha256Digest(value).slice(0,32)}`;}
function positive(value:number){return Number.isSafeInteger(value)&&value>0;}
function nonEmpty(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0;}
function secretShaped(value:string){return /(?:authorization\s*:\s*bearer|api[_-]?key|sk-[a-z0-9_-]{8,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/iu.test(value);}
