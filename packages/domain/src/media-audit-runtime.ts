import {sha256Digest} from './canonical.js';
import type {ArtifactRevisionV3} from './artifact-publish.js';
import {MediaContractError, type ArtifactRevisionV4, type MediaAuditDecisionV4} from './media-artifact.js';
import {
  AGENTTEAMS_TEAM_PROFILE_DIGEST,
  type MediaAuditAuthorityCheckCode,
  type MediaAuditCapabilityBoundaryV1,
  type MediaAuditEvidencePolicyV1,
  type MediaAuditMachineFactsV1,
  type MediaAuditPublicArtifactV1,
  type MediaAuditTaskAuthorityBindingV1,
  type MissionJob,
  type MissionRun,
  type RuntimeSkillLock,
  type RuntimeTaskContract
} from './persistent-runtime.js';
import {runtimeOutputSchema} from './runtime-output-schemas.js';

export const MEDIA_AUDIT_INPUT_SCHEMA_REF='lumiclaw.media-audit-input.v4' as const;
export const MEDIA_AUDIT_OUTPUT_SCHEMA_REF='lumiclaw.media-audit-output.v4' as const;
export const MEDIA_AUDIT_SKILL_SOURCE_DIGEST='196193608842dc619ea9b1db51fa98b1a50a7aa56823e48e6c4b6eb0422586b9' as const;
export const MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS=Object.freeze([
  'evidence-and-claim-grounding@1.0.0',
  'independent-action-audit@1.0.0',
  'trace-safe-escalation@1.0.0'
]);
export const MEDIA_AUDIT_CHECK_CODES=Object.freeze([
  'REVISION_BINDING','TEXT_VISUAL_SPEC_COHERENCE','FINAL_MEDIA_MACHINE_FACTS','PROVENANCE_COMPOSITION','RIGHTS_COST','BRAND_KNOWLEDGE_SNAPSHOTS','PLATFORM_CONSTRAINTS','SENSITIVE_TEXT_SPEC_RISK'
] as const);
export type MediaAuditCheckCode=MediaAuditAuthorityCheckCode;

const skillBase={id:'artifact-independent-audit',version:'2.0.0',source:'skills/artifact-independent-audit-v2/SKILL.md',sourceDigest:MEDIA_AUDIT_SKILL_SOURCE_DIGEST,license:'Apache-2.0' as const};
export const mediaAuditDomainSkillLock:ObjectFreeze<RuntimeSkillLock>=Object.freeze({...skillBase,digest:sha256Digest(skillBase)});
type ObjectFreeze<T>=Readonly<T>;

export type MediaAuditOutputV4={
  schemaVersion:4;taskId:string;inputDigest:string;artifactRevisionId:string;artifactRevisionDigest:string;mediaSetDigest:string;
  brandSnapshotDigest:string;knowledgeSnapshotDigest:string;actualMediaDigests:string[];result:'PASS'|'FAIL'|'ESCALATE';
  capabilityBoundary:MediaAuditCapabilityBoundaryV1;
  findings:Array<{checkCode:MediaAuditCheckCode;result:'PASS'|'FAIL'|'ESCALATE';message:string;evidenceDigests:string[];recoveryAction:string|null}>;
};

type MediaAuditAuthoritySeed=Omit<MediaAuditTaskAuthorityBindingV1,'baseReviewContentDigest'|'inputProjectionDigest'|'outputSchemaDigest'|'allowedEvidenceDigests'|'evidencePolicy'|'canonicalDigest'>;
type MediaAuditProjectionAuthority=MediaAuditAuthoritySeed&Pick<MediaAuditTaskAuthorityBindingV1,'baseReviewContentDigest'|'allowedEvidenceDigests'|'evidencePolicy'>;

export type MediaAuditRuntimeBundleV1={schemaVersion:1;kind:'MISSION_EXECUTION';bundleId:string;sourceRunId:string;sourceBundleId:string;sourceBundleDigest:string;artifactRevisionId:string;artifactRevisionDigest:string;authorityDigest:string;canonicalDigest:string};
export type MediaAuditRequestV1={
  schemaVersion:1;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;sourceRunId:string;sourceBundleId:string;sourceBundleDigest:string;
  auditRunId:string;auditJobId:string;auditTaskId:string;taskContractDigest:string;inputProjectionDigest:string;outputSchemaDigest:string;generation:1;createdAt:string;canonicalDigest:string;
};
export type MediaAuditRequestState='WAITING_A5'|'QUEUED'|'RUNNING'|'RECOVERING'|'PASS'|'FAIL'|'ESCALATE'|'BLOCKED';
export type MediaAuditRequestView=MediaAuditRequestV1&{state:MediaAuditRequestState;runState:string;jobState:string;attemptId:string|null;attemptNumber:number|null;runtimeActorId:string|null;runtimeTaskId:string|null;receiptDigest:string|null;result:'PASS'|'FAIL'|'ESCALATE'|null;completionConfirmed:boolean};

export type MediaRuntimeAuditReceiptBindingV1={
  schemaVersion:1;ownerId:string;requestId:string;sourceRunId:string;runId:string;jobId:string;taskId:string;taskContractDigest:string;attemptId:string;attemptNumber:number;
  runtimeTaskId:string;runtimeActorId:string;roleId:'independent-auditor';auditorRole:'A5_INDEPENDENT_AUDITOR';teamRoleSkillLocks:string[];domainSkillLocks:RuntimeSkillLock[];skillLockDigest:string;
  runtimeInstanceId:string;runtimeProjectId:string;runtimeVersion:string;runtimeDigest:string;teamProfileVersion:string;teamProfileDigest:string;
  artifactRevisionId:string;artifactRevisionDigest:string;mediaSetDigest:string;actualMediaDigests:string[];finalByteDigests:string[];brandSnapshotDigest:string;knowledgeSnapshotDigest:string;
  policyDigest:string;profileDigest:string;mediaProviderCanaryReceiptDigest:string;mediaProviderGateFingerprintDigest:string;inputProjectionDigest:string;outputSchema:string;outputSchemaDigest:string;outputDigest:string;acceptedOutputRef:string;materializationBatchId:string;materializationBatchDigest:string;completionEventId:string;
  evidenceMaturity:'AGENTTEAMS_RUNTIME';agentTeamsExecuted:true;controlledProvider:false;authoritativeForOperations:true;canonicalDigest:string;
};

export type MediaRuntimeAuditReceiptV1={schemaVersion:1;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;requestId:string;result:'PASS'|'FAIL'|'ESCALATE';output:MediaAuditOutputV4;binding:MediaRuntimeAuditReceiptBindingV1;createdAt:string;canonicalDigest:string};

export function compileMediaAuditRuntimeGraph(input:{ownerId:string;revision:ArtifactRevisionV4;parentRevision:ArtifactRevisionV3;sourceRun:MissionRun;createdBy:string;createdAt:string}):{bundle:MediaAuditRuntimeBundleV1;run:MissionRun;job:MissionJob;request:MediaAuditRequestV1}{
  const {revision,parentRevision,sourceRun}=input;
  if(revision.ownerId!==input.ownerId||parentRevision.ownerId!==input.ownerId||revision.parentRevisionId!==parentRevision.id||revision.parentRevisionDigest!==parentRevision.canonicalDigest||revision.payloadDigest!==sha256Digest(parentRevision.payload)||parentRevision.platformCode!=='XIAOHONGSHU'||parentRevision.payload.kind!=='XIAOHONGSHU')throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  if(parentRevision.evidenceMaturity!=='AGENTTEAMS_RUNTIME'||parentRevision.agentTeamsExecuted!==true||parentRevision.inputBindings.executionBundle.id!==sourceRun.bundleId||parentRevision.inputBindings.executionBundle.digest!==sourceRun.bundleDigest||sourceRun.ownerId!==input.ownerId||sourceRun.state!=='SUCCEEDED_RUNTIME'||sourceRun.runtimeRequirement.teamProfileDigest!==AGENTTEAMS_TEAM_PROFILE_DIGEST)throw new MediaContractError('MEDIA_AUDIT_RUNTIME_SOURCE_REQUIRED');
  const publicArtifact:MediaAuditPublicArtifactV1={kind:'XIAOHONGSHU',title:parentRevision.payload.title,body:parentRevision.payload.body,topics:[...parentRevision.payload.topics],cta:parentRevision.payload.cta,language:parentRevision.payload.language,accountProfileRevisionId:parentRevision.payload.accountProfileRevisionId,coverSpec:{...parentRevision.payload.coverSpec},imageSpecs:parentRevision.payload.imageSpecs.map((item)=>({position:item.position,purpose:item.purpose,aspectRatio:item.aspectRatio,visualBrief:item.visualBrief,overlayCopy:item.overlayCopy,altDescription:item.altDescription})),sourceBindings:parentRevision.payload.sourceBindings.map((item)=>({...item}))};
  const capabilityBoundary:MediaAuditCapabilityBoundaryV1={reviewMode:'TEXT_ONLY_WITH_SERVER_MACHINE_FACTS',pixelInspectionPerformed:false,ownerVisualReviewRequired:true,notReviewed:['FINAL_PIXEL_VISUAL_QUALITY','HIDDEN_PIXEL_CONTENT','RENDERED_TEXT_OCR','PIXEL_TEXT_MEDIA_SEMANTICS']};
  const machineItems=revision.mediaSetBinding.items.map((item,index)=>({position:item.position,assetId:item.assetId,altText:item.altText,mimeType:item.mimeType,bytes:item.bytes,width:item.width,height:item.height,finalAssetDigest:item.finalAssetDigest,contentDigest:item.contentDigest,blobDigest:item.blobRef.digest,rawAssetDigest:item.rawAssetDigest,generationSpecDigest:item.generationSpecDigest,compositionSpecDigest:item.compositionSpecDigest,rightsReceiptDigest:item.rightsReceiptDigest,costReceiptDigest:item.costReceiptDigest,orderedPosition:item.position===index+1,contentDigestMatchesBlob:item.contentDigest===item.blobRef.digest,byteSizeMatchesBlob:item.bytes===item.blobRef.size,mimeAllowed:['image/png','image/jpeg','image/webp'].includes(item.mimeType),dimensionsMatchProfile:item.width===1080&&item.height===1440,lineageDigestsPresent:[item.finalAssetDigest,item.contentDigest,item.blobRef.digest,item.rawAssetDigest,item.generationSpecDigest,item.compositionSpecDigest,item.rightsReceiptDigest,item.costReceiptDigest].every(isDigest)}));
  if(machineItems.length===0||machineItems.some((item)=>!item.orderedPosition||!item.contentDigestMatchesBlob||!item.byteSizeMatchesBlob||!item.mimeAllowed||!item.dimensionsMatchProfile||!item.lineageDigestsPresent||item.altText.trim().length===0))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  const machineFactsBase={schemaVersion:1 as const,verifierRef:'lumiclaw.media-machine-verifier.v1' as const,items:machineItems.map((item)=>({...item,orderedPosition:true as const,contentDigestMatchesBlob:true as const,byteSizeMatchesBlob:true as const,mimeAllowed:true as const,dimensionsMatchProfile:true as const,lineageDigestsPresent:true as const})),allAssertionsPassed:true as const,capabilityBoundary};const machineFacts:MediaAuditMachineFactsV1={...machineFactsBase,canonicalDigest:sha256Digest(machineFactsBase)};
  const authoritySeed:MediaAuditAuthoritySeed={
    schemaVersion:1 as const,authorityType:'XHS_MEDIA_AUDIT_V4' as const,sourceRunId:sourceRun.id,sourceBundleId:sourceRun.bundleId,sourceBundleDigest:sourceRun.bundleDigest,
    artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,parentRevisionId:revision.parentRevisionId,parentRevisionDigest:revision.parentRevisionDigest,parentPayloadDigest:revision.payloadDigest,
    mediaSetDigest:revision.mediaSetBinding.canonicalDigest,finalMedia:revision.mediaSetBinding.items.map((item)=>({position:item.position,assetId:item.assetId,finalAssetDigest:item.finalAssetDigest,contentDigest:item.contentDigest,blobDigest:item.blobRef.digest,bytes:item.blobRef.size,mimeType:item.mimeType,rawAssetDigest:item.rawAssetDigest,generationSpecDigest:item.generationSpecDigest,compositionSpecDigest:item.compositionSpecDigest,rightsReceiptDigest:item.rightsReceiptDigest,costReceiptDigest:item.costReceiptDigest})),
    brandSnapshotId:revision.brandSnapshot.id,brandSnapshotDigest:revision.brandSnapshot.digest,knowledgeSnapshotId:revision.knowledgeSnapshot.id,knowledgeSnapshotDigest:revision.knowledgeSnapshot.digest,
    accountProfileId:parentRevision.inputBindings.accountProfile.id,accountProfileDigest:parentRevision.inputBindings.accountProfile.digest,artifactProfileRef:parentRevision.artifactProfileRef.id,artifactProfileDigest:parentRevision.artifactProfileRef.digest,mediaProfileRef:revision.mediaSetBinding.profileRef,mediaProfileDigest:revision.mediaSetBinding.profileDigest,
    publicArtifact,machineFacts,
    policyDigest:sha256Digest({domainSkillLock:mediaAuditDomainSkillLock.digest,artifactProfile:parentRevision.artifactProfileRef.digest,mediaProfile:revision.mediaSetBinding.profileDigest,brand:revision.brandSnapshot.digest,knowledge:revision.knowledgeSnapshot.digest}),teamRoleSkillLocks:[...MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS],domainSkillLocks:[{...mediaAuditDomainSkillLock}],inputProjectionSchema:MEDIA_AUDIT_INPUT_SCHEMA_REF,outputSchema:MEDIA_AUDIT_OUTPUT_SCHEMA_REF
  };
  const baseReviewProjection=baseReviewInputProjection(authoritySeed);assertSafeReviewProjection(baseReviewProjection);const baseReviewContentDigest=sha256Digest(baseReviewProjection);
  const skillLockDigest=sha256Digest({teamRoleSkillLocks:authoritySeed.teamRoleSkillLocks,domainSkillLocks:authoritySeed.domainSkillLocks});
  const provisional:RuntimeTaskContract={schemaVersion:1,runId:'pending',bundleId:'pending',bundleDigest:'0'.repeat(64),generation:1,taskId:'pending',roleId:'independent-auditor',kind:'AUDIT_CONTENT',mandate:'Audit the exact immutable Xiaohongshu v4 public text, visual specifications, source bindings and server-verified media facts; pixels remain Owner-reviewed.',dependencyIds:[],inputDigest:baseReviewContentDigest,skillLockDigest,outputSchema:MEDIA_AUDIT_OUTPUT_SCHEMA_REF,substantive:true,externalActionAllowed:false};
  const outputSchemaDigest=runtimeOutputSchema(provisional).canonicalDigest;
  const evidenceAuthority=deriveMediaAuditEvidenceAuthority({...authoritySeed,baseReviewContentDigest,outputSchemaDigest},skillLockDigest);const finalProjection=authorityInputProjection({...authoritySeed,baseReviewContentDigest,...evidenceAuthority});assertSafeReviewProjection(finalProjection);const inputProjectionDigest=sha256Digest(finalProjection);
  const authorityWithoutDigest={...authoritySeed,baseReviewContentDigest,inputProjectionDigest,outputSchemaDigest,...evidenceAuthority};
  const authorityBinding:MediaAuditTaskAuthorityBindingV1={...authorityWithoutDigest,canonicalDigest:sha256Digest(authorityWithoutDigest)};
  const bundleBase={schemaVersion:1 as const,kind:'MISSION_EXECUTION' as const,bundleId:stableId('media-audit-bundle',{ownerId:input.ownerId,revision:revision.canonicalDigest,sourceRun:sourceRun.id}),sourceRunId:sourceRun.id,sourceBundleId:sourceRun.bundleId,sourceBundleDigest:sourceRun.bundleDigest,artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,authorityDigest:authorityBinding.canonicalDigest};
  const bundle:MediaAuditRuntimeBundleV1={...bundleBase,canonicalDigest:sha256Digest(bundleBase)};
  const runId=stableId('mission-run',{ownerId:input.ownerId,bundleId:bundle.bundleId,bundleDigest:bundle.canonicalDigest,generation:1});
  const taskId=stableId('media-audit-task',{revision:revision.canonicalDigest,authority:authorityBinding.canonicalDigest});
  const contractWithoutDigest={schemaVersion:1 as const,runId,bundleId:bundle.bundleId,bundleDigest:bundle.canonicalDigest,generation:1,taskId,roleId:'independent-auditor' as const,kind:'AUDIT_CONTENT' as const,mandate:'Audit exact public text, visual specs, source bindings and deterministic media machine facts. Do not claim pixel inspection; Owner visual review remains mandatory. Do not edit, approve, package, navigate, or publish.',dependencyIds:[] as string[],inputDigest:inputProjectionDigest,skillLockDigest:provisional.skillLockDigest,outputSchema:MEDIA_AUDIT_OUTPUT_SCHEMA_REF,substantive:true,externalActionAllowed:false as const,authorityBinding,outputSchemaDigest};
  const contract:RuntimeTaskContract={...contractWithoutDigest,canonicalDigest:sha256Digest(contractWithoutDigest)};
  const run:MissionRun={schemaVersion:1,id:runId,ownerId:input.ownerId,bundleId:bundle.bundleId,bundleDigest:bundle.canonicalDigest,bundleKind:'MISSION_EXECUTION',generation:1,runtimeRequirement:structuredClone(sourceRun.runtimeRequirement),state:'QUEUED',createdBy:input.createdBy,createdAt:input.createdAt,startedAt:null,finishedAt:null,lastReconciledAt:null,errorCode:null,rowVersion:1};
  const jobId=stableId('mission-job',{runId,taskId,generation:1});
  const job:MissionJob={schemaVersion:1,id:jobId,runId,taskContractId:taskId,generation:1,roleId:'independent-auditor',kind:'AUDIT_CONTENT',dependencyIds:[],state:'QUEUED',availableAt:input.createdAt,leaseOwner:null,leaseTokenHash:null,leaseExpiresAt:null,attemptCount:0,acceptedAttemptId:null,acceptedOutputRef:null,acceptedOutputDigest:null,runtimeTaskId:null,lastErrorCode:null,rowVersion:1,contract};
  const requestBase={schemaVersion:1 as const,id:stableId('media-audit-request',{ownerId:input.ownerId,revision:revision.canonicalDigest,contract:contract.canonicalDigest}),ownerId:input.ownerId,artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,sourceRunId:sourceRun.id,sourceBundleId:sourceRun.bundleId,sourceBundleDigest:sourceRun.bundleDigest,auditRunId:run.id,auditJobId:job.id,auditTaskId:taskId,taskContractDigest:contract.canonicalDigest!,inputProjectionDigest,outputSchemaDigest,generation:1 as const,createdAt:input.createdAt};
  return {bundle,run,job,request:{...requestBase,canonicalDigest:sha256Digest(requestBase)}};
}

export function isMediaAuditTaskContract(contract:RuntimeTaskContract):contract is RuntimeTaskContract&{authorityBinding:MediaAuditTaskAuthorityBindingV1;outputSchemaDigest:string;canonicalDigest:string}{return contract.roleId==='independent-auditor'&&contract.kind==='AUDIT_CONTENT'&&contract.outputSchema===MEDIA_AUDIT_OUTPUT_SCHEMA_REF&&contract.authorityBinding?.authorityType==='XHS_MEDIA_AUDIT_V4'&&typeof contract.outputSchemaDigest==='string'&&typeof contract.canonicalDigest==='string';}

export function runtimeMediaAuditInputProjection(contract:RuntimeTaskContract):Record<string,unknown>{
  if(!isMediaAuditTaskContract(contract))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  const base=withoutContractDigest(contract);if(sha256Digest(base)!==contract.canonicalDigest)throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  const authorityBase={...contract.authorityBinding};delete (authorityBase as Partial<MediaAuditTaskAuthorityBindingV1>).canonicalDigest;if(sha256Digest(authorityBase)!==contract.authorityBinding.canonicalDigest)throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  if(contract.authorityBinding.inputProjectionSchema!==MEDIA_AUDIT_INPUT_SCHEMA_REF||contract.authorityBinding.outputSchema!==MEDIA_AUDIT_OUTPUT_SCHEMA_REF||sha256Digest(contract.authorityBinding.teamRoleSkillLocks)!==sha256Digest(MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS)||sha256Digest(contract.authorityBinding.domainSkillLocks)!==sha256Digest([mediaAuditDomainSkillLock])||contract.skillLockDigest!==sha256Digest({teamRoleSkillLocks:MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS,domainSkillLocks:[mediaAuditDomainSkillLock]}))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  const baseReviewProjection=baseReviewInputProjection(contract.authorityBinding);assertSafeReviewProjection(baseReviewProjection);if(sha256Digest(baseReviewProjection)!==contract.authorityBinding.baseReviewContentDigest)throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');const expectedEvidenceAuthority=deriveMediaAuditEvidenceAuthority(contract.authorityBinding,contract.skillLockDigest);if(sha256Digest(expectedEvidenceAuthority.allowedEvidenceDigests)!==sha256Digest(contract.authorityBinding.allowedEvidenceDigests)||sha256Digest(expectedEvidenceAuthority.evidencePolicy)!==sha256Digest(contract.authorityBinding.evidencePolicy))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  const projection=authorityInputProjection(contract.authorityBinding);assertSafeReviewProjection(projection);if(sha256Digest(projection)!==contract.inputDigest||contract.authorityBinding.inputProjectionDigest!==contract.inputDigest)throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');return projection;
}

export function validateMediaAuditOutput(contract:RuntimeTaskContract,value:MediaAuditOutputV4):MediaAuditOutputV4{
  if(!isMediaAuditTaskContract(contract))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');const binding=contract.authorityBinding;
  const codes=value.findings.map((item)=>item.checkCode);const unique=new Set(codes);const media=binding.finalMedia.map((item)=>item.contentDigest);const allowedEvidence=new Set(binding.allowedEvidenceDigests);const policyByCheck=new Map(binding.evidencePolicy.map((item)=>[item.checkCode,item]));
  const evidenceInvalid=value.findings.some((item)=>{const policy=policyByCheck.get(item.checkCode);return policy===undefined||item.evidenceDigests.length===0||new Set(item.evidenceDigests).size!==item.evidenceDigests.length||item.evidenceDigests.some((digest)=>!isDigest(digest)||!allowedEvidence.has(digest))||sha256Digest(item.evidenceDigests)!==sha256Digest(policy.requiredEvidenceDigests);});
  if(value.schemaVersion!==4||value.taskId!==contract.taskId||value.inputDigest!==contract.inputDigest||value.artifactRevisionId!==binding.artifactRevisionId||value.artifactRevisionDigest!==binding.artifactRevisionDigest||value.mediaSetDigest!==binding.mediaSetDigest||value.brandSnapshotDigest!==binding.brandSnapshotDigest||value.knowledgeSnapshotDigest!==binding.knowledgeSnapshotDigest||sha256Digest(value.actualMediaDigests)!==sha256Digest(media)||sha256Digest(value.capabilityBoundary)!==sha256Digest(binding.machineFacts.capabilityBoundary)||unique.size!==MEDIA_AUDIT_CHECK_CODES.length||MEDIA_AUDIT_CHECK_CODES.some((code)=>!unique.has(code))||evidenceInvalid)throw new MediaContractError('MEDIA_AUDIT_OUTPUT_INVALID');
  const derived=value.findings.some((item)=>item.result==='ESCALATE')?'ESCALATE':value.findings.some((item)=>item.result==='FAIL')?'FAIL':'PASS';if(derived!==value.result)throw new MediaContractError('MEDIA_AUDIT_OUTPUT_INVALID');return structuredClone(value);
}

export function createRuntimeMediaAuditDecision(input:{ownerId:string;revision:ArtifactRevisionV4;receipt:MediaRuntimeAuditReceiptV1;createdAt:string}):MediaAuditDecisionV4{
  const {revision,receipt}=input;const binding=receipt.binding;
  if(revision.ownerId!==input.ownerId||receipt.ownerId!==input.ownerId||receipt.artifactRevisionId!==revision.id||receipt.artifactRevisionDigest!==revision.canonicalDigest||binding.ownerId!==input.ownerId||binding.artifactRevisionId!==revision.id||binding.artifactRevisionDigest!==revision.canonicalDigest||binding.mediaSetDigest!==revision.mediaSetBinding.canonicalDigest||binding.brandSnapshotDigest!==revision.brandSnapshot.digest||binding.knowledgeSnapshotDigest!==revision.knowledgeSnapshot.digest||sha256Digest(binding.actualMediaDigests)!==sha256Digest(revision.mediaSetBinding.items.map((item)=>item.contentDigest))||sha256Digest(binding.finalByteDigests)!==sha256Digest(revision.mediaSetBinding.items.map((item)=>item.blobRef.digest))||binding.runtimeActorId===revision.producerIdentityId||binding.evidenceMaturity!=='AGENTTEAMS_RUNTIME'||binding.agentTeamsExecuted!==true||binding.controlledProvider!==false||binding.authoritativeForOperations!==true)throw new MediaContractError('MEDIA_AUDIT_RUNTIME_RECEIPT_INVALID');
  const base={schemaVersion:4 as const,id:stableId('media-audit',{revision:revision.canonicalDigest,receipt:receipt.canonicalDigest,result:receipt.result}),ownerId:input.ownerId,artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,auditorRole:'A5_INDEPENDENT_AUDITOR' as const,auditorIdentityId:binding.runtimeActorId,evidenceMaturity:'AGENTTEAMS_RUNTIME' as const,agentTeamsExecuted:true as const,authoritativeForOperations:true as const,runtimeReceiptBinding:binding,result:receipt.result,actualMediaDigests:revision.mediaSetBinding.items.map((item)=>item.contentDigest),provenanceDigest:sha256Digest(revision.mediaSetBinding.items.map((item)=>({raw:item.rawAssetDigest,composition:item.compositionSpecDigest}))),rightsCostDigest:sha256Digest(revision.mediaSetBinding.items.map((item)=>({rights:item.rightsReceiptDigest,cost:item.costReceiptDigest}))),createdAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

function baseReviewInputProjection(value:MediaAuditAuthoritySeed|MediaAuditTaskAuthorityBindingV1){return {schemaVersion:4,authorityType:value.authorityType,source:{runId:value.sourceRunId,bundleId:value.sourceBundleId,bundleDigest:value.sourceBundleDigest},revision:{id:value.artifactRevisionId,digest:value.artifactRevisionDigest,parentId:value.parentRevisionId,parentDigest:value.parentRevisionDigest,parentPayloadDigest:value.parentPayloadDigest,mediaSetDigest:value.mediaSetDigest},reviewContent:value.publicArtifact,finalMedia:value.finalMedia,machineFacts:value.machineFacts,snapshots:{brandId:value.brandSnapshotId,brandDigest:value.brandSnapshotDigest,knowledgeId:value.knowledgeSnapshotId,knowledgeDigest:value.knowledgeSnapshotDigest},profiles:{accountId:value.accountProfileId,accountDigest:value.accountProfileDigest,artifactRef:value.artifactProfileRef,artifactDigest:value.artifactProfileDigest,mediaRef:value.mediaProfileRef,mediaDigest:value.mediaProfileDigest},policyDigest:value.policyDigest,teamRoleSkillLocks:value.teamRoleSkillLocks,domainSkillLocks:value.domainSkillLocks,inputProjectionSchema:value.inputProjectionSchema,outputSchema:value.outputSchema,privacyBoundary:{included:'OWNER_INTENDED_PUBLIC_ARTIFACT_AND_APPROVED_SAFE_DIGEST_CONTEXT_ONLY',excluded:['PRIVATE_PROMPT','RAW_PROVIDER_BODY','SIGNED_URL','SECRET','RAW_BYTES','BASE64','PRIVATE_KNOWLEDGE_TEXT']},externalActionAllowed:false};}
function authorityInputProjection(value:MediaAuditProjectionAuthority|MediaAuditTaskAuthorityBindingV1){return {...baseReviewInputProjection(value),evidenceAuthority:{baseReviewContentDigest:value.baseReviewContentDigest,allowedEvidenceDigests:value.allowedEvidenceDigests,evidencePolicy:value.evidencePolicy}};}
function deriveMediaAuditEvidenceAuthority(value:Pick<MediaAuditTaskAuthorityBindingV1,'sourceBundleDigest'|'artifactRevisionDigest'|'parentRevisionDigest'|'parentPayloadDigest'|'mediaSetDigest'|'finalMedia'|'brandSnapshotDigest'|'knowledgeSnapshotDigest'|'accountProfileDigest'|'artifactProfileDigest'|'mediaProfileDigest'|'policyDigest'|'domainSkillLocks'|'machineFacts'|'baseReviewContentDigest'|'outputSchemaDigest'>,skillLockDigest:string):{allowedEvidenceDigests:string[];evidencePolicy:MediaAuditEvidencePolicyV1[]}{
  const finalAssetDigests=value.finalMedia.map((item)=>item.finalAssetDigest);const contentDigests=value.finalMedia.map((item)=>item.contentDigest);const blobDigests=value.finalMedia.map((item)=>item.blobDigest);const rawDigests=value.finalMedia.map((item)=>item.rawAssetDigest);const generationDigests=value.finalMedia.map((item)=>item.generationSpecDigest);const compositionDigests=value.finalMedia.map((item)=>item.compositionSpecDigest);const rightsDigests=value.finalMedia.map((item)=>item.rightsReceiptDigest);const costDigests=value.finalMedia.map((item)=>item.costReceiptDigest);const skillDigests=value.domainSkillLocks.flatMap((item)=>[item.digest,item.sourceDigest]);
  const evidencePolicy:MediaAuditEvidencePolicyV1[]=[
    {checkCode:'REVISION_BINDING',requiredEvidenceDigests:uniqueDigests([value.sourceBundleDigest,value.artifactRevisionDigest,value.parentRevisionDigest,value.parentPayloadDigest,value.mediaSetDigest,value.baseReviewContentDigest])},
    {checkCode:'TEXT_VISUAL_SPEC_COHERENCE',requiredEvidenceDigests:uniqueDigests([value.parentPayloadDigest,value.mediaSetDigest,value.baseReviewContentDigest,...contentDigests])},
    {checkCode:'FINAL_MEDIA_MACHINE_FACTS',requiredEvidenceDigests:uniqueDigests([value.machineFacts.canonicalDigest,value.mediaSetDigest,...finalAssetDigests,...contentDigests,...blobDigests])},
    {checkCode:'PROVENANCE_COMPOSITION',requiredEvidenceDigests:uniqueDigests([...rawDigests,...generationDigests,...compositionDigests])},
    {checkCode:'RIGHTS_COST',requiredEvidenceDigests:uniqueDigests([...rightsDigests,...costDigests])},
    {checkCode:'BRAND_KNOWLEDGE_SNAPSHOTS',requiredEvidenceDigests:uniqueDigests([value.brandSnapshotDigest,value.knowledgeSnapshotDigest])},
    {checkCode:'PLATFORM_CONSTRAINTS',requiredEvidenceDigests:uniqueDigests([value.accountProfileDigest,value.artifactProfileDigest,value.mediaProfileDigest,value.policyDigest])},
    {checkCode:'SENSITIVE_TEXT_SPEC_RISK',requiredEvidenceDigests:uniqueDigests([value.brandSnapshotDigest,value.knowledgeSnapshotDigest,value.policyDigest,...skillDigests,skillLockDigest,value.baseReviewContentDigest,value.outputSchemaDigest])}
  ];
  const allowedEvidenceDigests=uniqueDigests(evidencePolicy.flatMap((item)=>item.requiredEvidenceDigests));if(allowedEvidenceDigests.some((digest)=>!isDigest(digest))||evidencePolicy.some((item)=>item.requiredEvidenceDigests.length===0||new Set(item.requiredEvidenceDigests).size!==item.requiredEvidenceDigests.length))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');return {allowedEvidenceDigests,evidencePolicy};
}
function withoutContractDigest(contract:RuntimeTaskContract){const base={...contract};delete base.canonicalDigest;return base;}
function stableId(prefix:string,value:unknown){return `${prefix}-${sha256Digest(value).slice(0,32)}`;}
function isDigest(value:string){return /^[a-f0-9]{64}$/u.test(value);}
function uniqueDigests(values:string[]){return [...new Set(values)];}
function assertSafeReviewProjection(value:unknown){const serialized=JSON.stringify(value);if(Buffer.byteLength(serialized,'utf8')>512_000||/(?:authorization\s*:\s*bearer|api[_-]?key|sk-[a-z0-9_-]{8,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|private-prompt:\/\/|[?&](?:x-amz-signature|x-goog-signature|signature|access_token)=|data:image\/[a-z0-9.+-]+;base64,)/iu.test(serialized))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');}
