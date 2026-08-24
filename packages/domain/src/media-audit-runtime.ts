import {sha256Digest} from './canonical.js';
import type {ArtifactRevisionV3} from './artifact-publish.js';
import {MediaContractError, type ArtifactRevisionV4, type MediaAuditDecisionV4} from './media-artifact.js';
import {
  AGENTTEAMS_TEAM_PROFILE_DIGEST,
  type MediaAuditTaskAuthorityBindingV1,
  type MissionJob,
  type MissionRun,
  type RuntimeSkillLock,
  type RuntimeTaskContract
} from './persistent-runtime.js';
import {runtimeOutputSchema} from './runtime-output-schemas.js';

export const MEDIA_AUDIT_INPUT_SCHEMA_REF='lumiclaw.media-audit-input.v4' as const;
export const MEDIA_AUDIT_OUTPUT_SCHEMA_REF='lumiclaw.media-audit-output.v4' as const;
export const MEDIA_AUDIT_SKILL_SOURCE_DIGEST='713b50a321e71af1ce58a04dd15e00e4e340eb895b9d617fb968e098b92e08ad' as const;
export const MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS=Object.freeze([
  'evidence-and-claim-grounding@1.0.0',
  'independent-action-audit@1.0.0',
  'trace-safe-escalation@1.0.0'
]);
export const MEDIA_AUDIT_CHECK_CODES=Object.freeze([
  'REVISION_BINDING','TEXT_MEDIA_COHERENCE','FINAL_MEDIA_BYTES','PROVENANCE_COMPOSITION','RIGHTS_COST','BRAND_KNOWLEDGE_SNAPSHOTS','PLATFORM_CONSTRAINTS','SENSITIVE_RISK'
] as const);
export type MediaAuditCheckCode=typeof MEDIA_AUDIT_CHECK_CODES[number];

const skillBase={id:'artifact-independent-audit',version:'2.0.0',source:'skills/artifact-independent-audit-v2/SKILL.md',sourceDigest:MEDIA_AUDIT_SKILL_SOURCE_DIGEST,license:'Apache-2.0' as const};
export const mediaAuditDomainSkillLock:ObjectFreeze<RuntimeSkillLock>=Object.freeze({...skillBase,digest:sha256Digest(skillBase)});
type ObjectFreeze<T>=Readonly<T>;

export type MediaAuditOutputV4={
  schemaVersion:4;taskId:string;inputDigest:string;artifactRevisionId:string;artifactRevisionDigest:string;mediaSetDigest:string;
  brandSnapshotDigest:string;knowledgeSnapshotDigest:string;actualMediaDigests:string[];result:'PASS'|'FAIL'|'ESCALATE';
  findings:Array<{checkCode:MediaAuditCheckCode;result:'PASS'|'FAIL'|'ESCALATE';message:string;evidenceDigests:string[];recoveryAction:string|null}>;
};

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
  if(revision.ownerId!==input.ownerId||parentRevision.ownerId!==input.ownerId||revision.parentRevisionId!==parentRevision.id||revision.parentRevisionDigest!==parentRevision.canonicalDigest||parentRevision.platformCode!=='XIAOHONGSHU')throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');
  if(parentRevision.evidenceMaturity!=='AGENTTEAMS_RUNTIME'||parentRevision.agentTeamsExecuted!==true||parentRevision.inputBindings.executionBundle.id!==sourceRun.bundleId||parentRevision.inputBindings.executionBundle.digest!==sourceRun.bundleDigest||sourceRun.ownerId!==input.ownerId||sourceRun.state!=='SUCCEEDED_RUNTIME'||sourceRun.runtimeRequirement.teamProfileDigest!==AGENTTEAMS_TEAM_PROFILE_DIGEST)throw new MediaContractError('MEDIA_AUDIT_RUNTIME_SOURCE_REQUIRED');
  const authoritySeed={
    schemaVersion:1 as const,authorityType:'XHS_MEDIA_AUDIT_V4' as const,sourceRunId:sourceRun.id,sourceBundleId:sourceRun.bundleId,sourceBundleDigest:sourceRun.bundleDigest,
    artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,parentRevisionId:revision.parentRevisionId,parentRevisionDigest:revision.parentRevisionDigest,parentPayloadDigest:revision.payloadDigest,
    mediaSetDigest:revision.mediaSetBinding.canonicalDigest,finalMedia:revision.mediaSetBinding.items.map((item)=>({position:item.position,assetId:item.assetId,finalAssetDigest:item.finalAssetDigest,contentDigest:item.contentDigest,blobDigest:item.blobRef.digest,bytes:item.blobRef.size,mimeType:item.mimeType,rawAssetDigest:item.rawAssetDigest,generationSpecDigest:item.generationSpecDigest,compositionSpecDigest:item.compositionSpecDigest,rightsReceiptDigest:item.rightsReceiptDigest,costReceiptDigest:item.costReceiptDigest})),
    brandSnapshotId:revision.brandSnapshot.id,brandSnapshotDigest:revision.brandSnapshot.digest,knowledgeSnapshotId:revision.knowledgeSnapshot.id,knowledgeSnapshotDigest:revision.knowledgeSnapshot.digest,
    accountProfileId:parentRevision.inputBindings.accountProfile.id,accountProfileDigest:parentRevision.inputBindings.accountProfile.digest,artifactProfileRef:parentRevision.artifactProfileRef.id,artifactProfileDigest:parentRevision.artifactProfileRef.digest,mediaProfileRef:revision.mediaSetBinding.profileRef,mediaProfileDigest:revision.mediaSetBinding.profileDigest,
    policyDigest:sha256Digest({domainSkillLock:mediaAuditDomainSkillLock.digest,artifactProfile:parentRevision.artifactProfileRef.digest,mediaProfile:revision.mediaSetBinding.profileDigest,brand:revision.brandSnapshot.digest,knowledge:revision.knowledgeSnapshot.digest}),teamRoleSkillLocks:[...MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS],domainSkillLocks:[{...mediaAuditDomainSkillLock}],inputProjectionSchema:MEDIA_AUDIT_INPUT_SCHEMA_REF,outputSchema:MEDIA_AUDIT_OUTPUT_SCHEMA_REF
  };
  const authorityProjection=authorityInputProjection(authoritySeed);
  const inputProjectionDigest=sha256Digest(authorityProjection);
  const provisional:RuntimeTaskContract={schemaVersion:1,runId:'pending',bundleId:'pending',bundleDigest:'0'.repeat(64),generation:1,taskId:'pending',roleId:'independent-auditor',kind:'AUDIT_CONTENT',mandate:'Audit the exact immutable Xiaohongshu v4 text and final media bytes only.',dependencyIds:[],inputDigest:inputProjectionDigest,skillLockDigest:sha256Digest({teamRoleSkillLocks:authoritySeed.teamRoleSkillLocks,domainSkillLocks:authoritySeed.domainSkillLocks}),outputSchema:MEDIA_AUDIT_OUTPUT_SCHEMA_REF,substantive:true,externalActionAllowed:false};
  const outputSchemaDigest=runtimeOutputSchema(provisional).canonicalDigest;
  const authorityWithoutDigest={...authoritySeed,inputProjectionDigest,outputSchemaDigest};
  const authorityBinding:MediaAuditTaskAuthorityBindingV1={...authorityWithoutDigest,canonicalDigest:sha256Digest(authorityWithoutDigest)};
  const bundleBase={schemaVersion:1 as const,kind:'MISSION_EXECUTION' as const,bundleId:stableId('media-audit-bundle',{ownerId:input.ownerId,revision:revision.canonicalDigest,sourceRun:sourceRun.id}),sourceRunId:sourceRun.id,sourceBundleId:sourceRun.bundleId,sourceBundleDigest:sourceRun.bundleDigest,artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,authorityDigest:authorityBinding.canonicalDigest};
  const bundle:MediaAuditRuntimeBundleV1={...bundleBase,canonicalDigest:sha256Digest(bundleBase)};
  const runId=stableId('mission-run',{ownerId:input.ownerId,bundleId:bundle.bundleId,bundleDigest:bundle.canonicalDigest,generation:1});
  const taskId=stableId('media-audit-task',{revision:revision.canonicalDigest,authority:authorityBinding.canonicalDigest});
  const contractWithoutDigest={schemaVersion:1 as const,runId,bundleId:bundle.bundleId,bundleDigest:bundle.canonicalDigest,generation:1,taskId,roleId:'independent-auditor' as const,kind:'AUDIT_CONTENT' as const,mandate:'Audit the exact immutable Xiaohongshu v4 text and final media bytes only; do not edit, approve, package, navigate, or publish.',dependencyIds:[] as string[],inputDigest:inputProjectionDigest,skillLockDigest:provisional.skillLockDigest,outputSchema:MEDIA_AUDIT_OUTPUT_SCHEMA_REF,substantive:true,externalActionAllowed:false as const,authorityBinding,outputSchemaDigest};
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
  const projection=authorityInputProjection(contract.authorityBinding);if(sha256Digest(projection)!==contract.inputDigest||contract.authorityBinding.inputProjectionDigest!==contract.inputDigest)throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');return projection;
}

export function validateMediaAuditOutput(contract:RuntimeTaskContract,value:MediaAuditOutputV4):MediaAuditOutputV4{
  if(!isMediaAuditTaskContract(contract))throw new MediaContractError('MEDIA_AUDIT_TASK_CONTRACT_INVALID');const binding=contract.authorityBinding;
  const codes=value.findings.map((item)=>item.checkCode);const unique=new Set(codes);const media=binding.finalMedia.map((item)=>item.contentDigest);
  if(value.schemaVersion!==4||value.taskId!==contract.taskId||value.inputDigest!==contract.inputDigest||value.artifactRevisionId!==binding.artifactRevisionId||value.artifactRevisionDigest!==binding.artifactRevisionDigest||value.mediaSetDigest!==binding.mediaSetDigest||value.brandSnapshotDigest!==binding.brandSnapshotDigest||value.knowledgeSnapshotDigest!==binding.knowledgeSnapshotDigest||sha256Digest(value.actualMediaDigests)!==sha256Digest(media)||unique.size!==MEDIA_AUDIT_CHECK_CODES.length||MEDIA_AUDIT_CHECK_CODES.some((code)=>!unique.has(code))||value.findings.some((item)=>item.evidenceDigests.some((digest)=>!isDigest(digest))))throw new MediaContractError('MEDIA_AUDIT_OUTPUT_INVALID');
  const derived=value.findings.some((item)=>item.result==='ESCALATE')?'ESCALATE':value.findings.some((item)=>item.result==='FAIL')?'FAIL':'PASS';if(derived!==value.result)throw new MediaContractError('MEDIA_AUDIT_OUTPUT_INVALID');return structuredClone(value);
}

export function createRuntimeMediaAuditDecision(input:{ownerId:string;revision:ArtifactRevisionV4;receipt:MediaRuntimeAuditReceiptV1;createdAt:string}):MediaAuditDecisionV4{
  const {revision,receipt}=input;const binding=receipt.binding;
  if(revision.ownerId!==input.ownerId||receipt.ownerId!==input.ownerId||receipt.artifactRevisionId!==revision.id||receipt.artifactRevisionDigest!==revision.canonicalDigest||binding.ownerId!==input.ownerId||binding.artifactRevisionId!==revision.id||binding.artifactRevisionDigest!==revision.canonicalDigest||binding.mediaSetDigest!==revision.mediaSetBinding.canonicalDigest||binding.brandSnapshotDigest!==revision.brandSnapshot.digest||binding.knowledgeSnapshotDigest!==revision.knowledgeSnapshot.digest||sha256Digest(binding.actualMediaDigests)!==sha256Digest(revision.mediaSetBinding.items.map((item)=>item.contentDigest))||sha256Digest(binding.finalByteDigests)!==sha256Digest(revision.mediaSetBinding.items.map((item)=>item.blobRef.digest))||binding.runtimeActorId===revision.producerIdentityId||binding.evidenceMaturity!=='AGENTTEAMS_RUNTIME'||binding.agentTeamsExecuted!==true||binding.controlledProvider!==false||binding.authoritativeForOperations!==true)throw new MediaContractError('MEDIA_AUDIT_RUNTIME_RECEIPT_INVALID');
  const base={schemaVersion:4 as const,id:stableId('media-audit',{revision:revision.canonicalDigest,receipt:receipt.canonicalDigest,result:receipt.result}),ownerId:input.ownerId,artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,auditorRole:'A5_INDEPENDENT_AUDITOR' as const,auditorIdentityId:binding.runtimeActorId,evidenceMaturity:'AGENTTEAMS_RUNTIME' as const,agentTeamsExecuted:true as const,authoritativeForOperations:true as const,runtimeReceiptBinding:binding,result:receipt.result,actualMediaDigests:revision.mediaSetBinding.items.map((item)=>item.contentDigest),provenanceDigest:sha256Digest(revision.mediaSetBinding.items.map((item)=>({raw:item.rawAssetDigest,composition:item.compositionSpecDigest}))),rightsCostDigest:sha256Digest(revision.mediaSetBinding.items.map((item)=>({rights:item.rightsReceiptDigest,cost:item.costReceiptDigest}))),createdAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

function authorityInputProjection(value:Omit<MediaAuditTaskAuthorityBindingV1,'inputProjectionDigest'|'outputSchemaDigest'|'canonicalDigest'>|MediaAuditTaskAuthorityBindingV1){return {schemaVersion:4,authorityType:value.authorityType,source:{runId:value.sourceRunId,bundleId:value.sourceBundleId,bundleDigest:value.sourceBundleDigest},revision:{id:value.artifactRevisionId,digest:value.artifactRevisionDigest,parentId:value.parentRevisionId,parentDigest:value.parentRevisionDigest,parentPayloadDigest:value.parentPayloadDigest,mediaSetDigest:value.mediaSetDigest},finalMedia:value.finalMedia,snapshots:{brandId:value.brandSnapshotId,brandDigest:value.brandSnapshotDigest,knowledgeId:value.knowledgeSnapshotId,knowledgeDigest:value.knowledgeSnapshotDigest},profiles:{accountId:value.accountProfileId,accountDigest:value.accountProfileDigest,artifactRef:value.artifactProfileRef,artifactDigest:value.artifactProfileDigest,mediaRef:value.mediaProfileRef,mediaDigest:value.mediaProfileDigest},policyDigest:value.policyDigest,teamRoleSkillLocks:value.teamRoleSkillLocks,domainSkillLocks:value.domainSkillLocks,outputSchema:value.outputSchema,externalActionAllowed:false};}
function withoutContractDigest(contract:RuntimeTaskContract){const base={...contract};delete base.canonicalDigest;return base;}
function stableId(prefix:string,value:unknown){return `${prefix}-${sha256Digest(value).slice(0,32)}`;}
function isDigest(value:string){return /^[a-f0-9]{64}$/u.test(value);}
