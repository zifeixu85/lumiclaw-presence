import {sha256Digest} from './canonical.js';
import type {MissionActivationUnit, MissionExecutionBundle, ProducerRoleId} from './goal-plan.js';

export const ARTIFACT_CONTRACT_VERSION = 'lumiclaw.artifact-publish.v3' as const;
export const artifactPlatforms = ['X', 'XIAOHONGSHU'] as const;
export type ArtifactPlatform = typeof artifactPlatforms[number];
export type ArtifactRevisionState = 'GENERATING' | 'QUARANTINED' | 'AWAITING_AUDIT' | 'AUDIT_FAILED' | 'AUDIT_ESCALATED' | 'OWNER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INVALIDATED';
export type AuditResult = 'PASS' | 'FAIL' | 'ESCALATE';
export type OwnerArtifactDecisionResult = 'APPROVE' | 'REJECT';
export type PackageState = 'READY' | 'INVALIDATED' | 'EXPORTED';

export type ArtifactProfileRef = {id:string;version:'1.0.0';digest:string;platformCode:ArtifactPlatform;source:string;checkedAt:string;expiresAt:string};
export type ArtifactSkillRef = {id:'x-content-expression'|'xiaohongshu-content-expression'|'artifact-independent-audit';version:'1.0.0';digest:string;source:`skills/${string}/SKILL.md`;sourceDigest:string;license:'Apache-2.0'};
export type AuthorizedMediaRef = {digest:string;fileName:string;mediaType:'image/png'|'image/jpeg'|'image/webp';rights:'OWNER_AUTHORIZED_LOCAL';altText:string};
export type ArtifactSourceBinding = {sourceItemId:string;bindingDigest:string};

export type XArtifactPayload = {
  kind:'X'; mode:'SINGLE'|'THREAD'; posts:Array<{position:number;text:string;mediaRefs:AuthorizedMediaRef[];altText:string|null}>;
  link:string|null;cta:string|null;language:string;accountProfileRevisionId:string;sourceBindings:ArtifactSourceBinding[];
};
export type XhsImageSpec = {position:number;purpose:string;aspectRatio:string;visualBrief:string;overlayCopy:string|null;altDescription:string|null;authorizedMediaRef:AuthorizedMediaRef|null};
export type XiaohongshuArtifactPayload = {
  kind:'XIAOHONGSHU';title:string;body:string;topics:string[];cta:string|null;coverSpec:{purpose:string;aspectRatio:string;visualBrief:string;overlayCopy:string|null};
  imageSpecs:XhsImageSpec[];language:string;accountProfileRevisionId:string;sourceBindings:ArtifactSourceBinding[];
};
export type ArtifactPayload = XArtifactPayload | XiaohongshuArtifactPayload;

export type ArtifactInputBindings = {
  executionBundle:{id:string;digest:string;generation:number;missionIntentId:string};
  operatingGoal:{id:string;digest:string};approvedPlan:{id:string;digest:string};knowledgeSnapshot:{id:string;digest:string};
  accountProfile:{id:string;digest:string;platformCode:ArtifactPlatform};producerSkill:ArtifactSkillRef;artifactProfile:ArtifactProfileRef;
  sourceSetDigest:string;
};

export type ProducerSubmission = {
  schemaVersion:3; evidenceMaturity:'CONTROLLED_FIXTURE'|'AGENTTEAMS_RUNTIME'; agentTeamsExecuted:boolean;
  submissionId:string;activationUnitId:string;producerRole:ProducerRoleId;producerIdentityId:string;inputBindings:ArtifactInputBindings;payload:ArtifactPayload;submittedAt:string;
};
export type QuarantinedSubmission = {ownerId:string;submissionId:string;activationUnitId:string;state:'QUARANTINED';reasonCode:ArtifactErrorCode;submissionDigest:string;createdAt:string};
export type ArtifactRevisionV3 = {
  schemaVersion:3;id:string;ownerId:string;activationUnitId:string;platformCode:ArtifactPlatform;revision:number;parentRevisionId:string|null;
  producerRole:ProducerRoleId;producerIdentityId:string;origin:'AGENT'|'OWNER_EDIT';evidenceMaturity:ProducerSubmission['evidenceMaturity'];agentTeamsExecuted:boolean;
  artifactProfileRef:ArtifactProfileRef;payload:ArtifactPayload;inputBindings:ArtifactInputBindings;canonicalDigest:string;state:'AWAITING_AUDIT';createdAt:string;
};
export type RegenerationRequest = {schemaVersion:3;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;reason:string;requestedBy:string;requestedAt:string;state:'REQUESTED';canonicalDigest:string};

export const auditCheckCodes = ['SCHEMA_AND_ORDER','SOURCE_GROUNDING','CLAIM_EVIDENCE','GOAL_AND_PLAN_FIT','ACCOUNT_VOICE','PLATFORM_CONSTRAINTS','SENSITIVE_RISK'] as const;
export type AuditCheckCode = typeof auditCheckCodes[number];
export type AuditFinding = {checkCode:AuditCheckCode;result:AuditResult;path:string;message:string;evidenceBindings:string[];recoveryAction:string|null};
export type ArtifactAuditDecision = {
  schemaVersion:3;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;auditorRole:'independent-auditor';auditorIdentityId:string;
  result:AuditResult;findings:AuditFinding[];evidenceBindings:string[];policyVersion:'artifact-independent-audit@1.0.0';policyDigest:string;canonicalDigest:string;createdAt:string;
};
export type ArtifactOwnerDecision = {
  schemaVersion:3;id:string;ownerId:string;artifactRevisionId:string;artifactRevisionDigest:string;auditDecisionId:string;auditDecisionDigest:string;
  result:OwnerArtifactDecisionResult;ownerIdentityId:string;reason:string|null;canonicalDigest:string;decidedAt:string;
};

export type OfficialPublishUrlRef = {id:string;platformCode:ArtifactPlatform;url:string;sourceId:string;source:string;sourceVersion:string;checkedAt:string;expiresAt:string;digest:string};
export type ManualPublishFile = {position:number;fileName:string;mediaType:'application/json'|'text/plain'|'text/markdown';content:string;digest:string};
export type ManualPublishPackage = {
  schemaVersion:3;id:string;ownerId:string;platformCode:ArtifactPlatform;accountProfileRevisionId:string;artifactRevisionId:string;artifactRevisionDigest:string;
  auditDecisionId:string;auditDecisionDigest:string;ownerDecisionId:string;ownerDecisionDigest:string;officialPublishUrlRef:OfficialPublishUrlRef;
  exactInputDigest:string;orderedFiles:ManualPublishFile[];manifestDigest:string;state:'READY';createdAt:string;externalState:'UNVERIFIED_EXTERNAL_STATE';
};
export type PackageHelperEvent = {schemaVersion:3;id:string;ownerId:string;packageId:string;packageDigest:string;action:'COPY_TEXT'|'DOWNLOAD_PACKAGE'|'OPEN_OFFICIAL_PUBLISH_PAGE';state:'EXPORTED';externalState:'UNVERIFIED_EXTERNAL_STATE';createdAt:string;canonicalDigest:string};
export type ArtifactInvalidationEvent = {schemaVersion:3;id:string;ownerId:string;artifactRevisionId:string;reasonCode:'NEW_REVISION'|'BUNDLE_CHANGED'|'GOAL_CHANGED'|'PLAN_CHANGED'|'KNOWLEDGE_CHANGED'|'ACCOUNT_CHANGED'|'SKILL_CHANGED'|'PROFILE_CHANGED'|'TAMPER_DETECTED';previousDigest:string;currentDigest:string;createdAt:string;canonicalDigest:string};

export type ArtifactWorkspace = {revisions:ArtifactRevisionV3[];quarantines:QuarantinedSubmission[];audits:ArtifactAuditDecision[];ownerDecisions:ArtifactOwnerDecision[];regenerationRequests:RegenerationRequest[];packages:ManualPublishPackage[];helperEvents:PackageHelperEvent[];invalidations:ArtifactInvalidationEvent[]};

export interface ArtifactPublishRepository {
  health():Promise<boolean>;
  getWorkspace(ownerId:string):Promise<ArtifactWorkspace>;
  getRevision(ownerId:string,revisionId:string):Promise<ArtifactRevisionV3|undefined>;
  getAudit(ownerId:string,auditId:string):Promise<ArtifactAuditDecision|undefined>;
  getOwnerDecision(ownerId:string,decisionId:string):Promise<ArtifactOwnerDecision|undefined>;
  getPackage(ownerId:string,packageId:string):Promise<ManualPublishPackage|undefined>;
  appendRevision(ownerId:string,revision:ArtifactRevisionV3,expectedHeadDigest:string|null,idempotencyKey:string,now:Date):Promise<{revision:ArtifactRevisionV3;invalidations:ArtifactInvalidationEvent[];replayed:boolean}>;
  appendQuarantine(ownerId:string,value:QuarantinedSubmission,idempotencyKey:string,now:Date):Promise<{quarantine:QuarantinedSubmission;replayed:boolean}>;
  appendAudit(ownerId:string,value:ArtifactAuditDecision,expectedRevisionDigest:string,idempotencyKey:string,now:Date):Promise<{audit:ArtifactAuditDecision;replayed:boolean}>;
  appendOwnerDecision(ownerId:string,value:ArtifactOwnerDecision,expectedAuditDigest:string,idempotencyKey:string,now:Date):Promise<{decision:ArtifactOwnerDecision;replayed:boolean}>;
  appendRegenerationRequest(ownerId:string,value:RegenerationRequest,expectedRevisionDigest:string,idempotencyKey:string,now:Date):Promise<{request:RegenerationRequest;replayed:boolean}>;
  appendPackage(ownerId:string,value:ManualPublishPackage,expectedDecisionDigest:string,idempotencyKey:string,now:Date):Promise<{package:ManualPublishPackage;replayed:boolean}>;
  appendHelperEvent(ownerId:string,value:PackageHelperEvent,idempotencyKey:string,now:Date):Promise<{event:PackageHelperEvent;replayed:boolean}>;
  invalidateBindings(ownerId:string,revisionId:string,reasonCode:ArtifactInvalidationEvent['reasonCode'],previousDigest:string,currentDigest:string,now:Date):Promise<ArtifactInvalidationEvent>;
  close():Promise<void>;
}

export type ArtifactErrorCode =
  | 'ARTIFACT_SCHEMA_INVALID'|'ARTIFACT_INPUT_MISMATCH'|'ARTIFACT_PROFILE_UNSUPPORTED'|'ARTIFACT_PLATFORM_NOT_SELECTED'|'ARTIFACT_ACCOUNT_MISMATCH'
  | 'ARTIFACT_PRODUCER_MISMATCH'|'ARTIFACT_SOURCE_MISMATCH'|'ARTIFACT_LENGTH_INVALID'|'ARTIFACT_ORDER_INVALID'|'PLATFORM_CONSTRAINT_STALE'
  | 'AUDITOR_INDEPENDENCE_REQUIRED'|'AUDIT_FINDINGS_INCOMPLETE'|'AUDIT_PASS_REQUIRED'|'OWNER_DECISION_STALE'|'OWNER_BOUNDARY_VIOLATION'
  | 'PACKAGE_INPUT_INVALIDATED'|'PACKAGE_DIGEST_MISMATCH'|'OFFICIAL_URL_NOT_ALLOWLISTED'|'EXTERNAL_PUBLISH_UNVERIFIED'|'ARTIFACT_RUNTIME_AUTHORITY_REQUIRED'|'IDEMPOTENCY_KEY_REQUIRED'|'IDEMPOTENCY_KEY_REUSED'|'ETAG_REQUIRED';

export class ArtifactContractError extends Error { public constructor(public readonly code:ArtifactErrorCode, message=code, public readonly details?:unknown){super(message);this.name='ArtifactContractError';} }

const X_PROFILE_BASE = {id:'X_POST_OR_THREAD',version:'1.0.0' as const,platformCode:'X' as const,source:'docs/research/platform-skills/fixtures/x-platform-rule-pack.v1alpha1.json',checkedAt:'2026-08-22T18:00:00+08:00',expiresAt:'2026-09-21T15:00:00+08:00'};
const XHS_PROFILE_BASE = {id:'XHS_IMAGE_NOTE',version:'1.0.0' as const,platformCode:'XIAOHONGSHU' as const,source:'docs/research/platform-skills/fixtures/xiaohongshu-platform-rule-pack.v1alpha1.json',checkedAt:'2026-08-22T18:00:00+08:00',expiresAt:'2026-09-21T16:30:00+08:00'};
export const artifactProfiles:Readonly<Record<ArtifactPlatform,ArtifactProfileRef>> = Object.freeze({
  X:Object.freeze({...X_PROFILE_BASE,digest:sha256Digest(X_PROFILE_BASE)}),XIAOHONGSHU:Object.freeze({...XHS_PROFILE_BASE,digest:sha256Digest(XHS_PROFILE_BASE)})
});
const skill=(id:ArtifactSkillRef['id'],source:ArtifactSkillRef['source'],sourceDigest:string):ArtifactSkillRef=>{const base={id,version:'1.0.0' as const,source,sourceDigest,license:'Apache-2.0' as const};return Object.freeze({...base,digest:sha256Digest(base)});};
export const artifactSkills=Object.freeze({
  X:skill('x-content-expression','skills/x-content-expression/SKILL.md','3e28bffa2d91b2dc848e7a3cff74e081920ab7288e176cbee85b84a38d50aeef'),
  XIAOHONGSHU:skill('xiaohongshu-content-expression','skills/xiaohongshu-content-expression/SKILL.md','669a6788ba2e6e88ec19f33fa553b2942ec6b6dcc6faab931ba9bcd938760c14'),
  AUDIT:skill('artifact-independent-audit','skills/artifact-independent-audit/SKILL.md','24dd33d4798f49d88fc22328732a0edc24eb7f2e2d38984c9c7bbb2d38601c40')
});

const officialRef=(value:Omit<OfficialPublishUrlRef,'digest'>):OfficialPublishUrlRef=>Object.freeze({...value,digest:sha256Digest(value)});
export const officialPublishUrlRegistry:Readonly<Record<ArtifactPlatform,OfficialPublishUrlRef>>=Object.freeze({
  X:officialRef({id:'official-publish-x-v1',platformCode:'X',url:'https://x.com/compose/post',sourceId:'X.HELP.POST',source:'https://help.x.com/en/using-x/how-to-post',sourceVersion:'live-help-retrieved-2026-08-22',checkedAt:'2026-08-22T15:00:00+08:00',expiresAt:'2026-09-21T15:00:00+08:00'}),
  XIAOHONGSHU:officialRef({id:'official-publish-xhs-v1',platformCode:'XIAOHONGSHU',url:'https://creator.xiaohongshu.com/publish',sourceId:'XHS.CREATOR.ENTRY',source:'https://creator.xiaohongshu.com/publish',sourceVersion:'live-entry-retrieved-2026-08-22',checkedAt:'2026-08-22T16:55:00+08:00',expiresAt:'2026-09-05T16:55:00+08:00'})
});

export function artifactRevisionEtag(value:ArtifactRevisionV3):string{return `\"artifact-${value.id}-r${value.revision}-${value.canonicalDigest}\"`;}
export function auditDecisionEtag(value:ArtifactAuditDecision):string{return `\"audit-${value.id}-${value.canonicalDigest}\"`;}
export function ownerDecisionEtag(value:ArtifactOwnerDecision):string{return `\"owner-decision-${value.id}-${value.canonicalDigest}\"`;}
export function packageEtag(value:ManualPublishPackage):string{return `\"package-${value.id}-${value.manifestDigest}\"`;}

export function expectedArtifactBindings(bundle:MissionExecutionBundle,unit:MissionActivationUnit):ArtifactInputBindings{
  const account=bundle.inputBindings.accountProfiles.find((item)=>item.accountProfileRevisionId===unit.accountProfileRevisionId);
  if(account===undefined||account.platformCode!==unit.platformCode)throw new ArtifactContractError('ARTIFACT_ACCOUNT_MISMATCH');
  const platform=unit.platformCode as ArtifactPlatform;const producerSkill=artifactSkills[platform];const artifactProfile=artifactProfiles[platform];
  return {executionBundle:{id:bundle.bundleId,digest:bundle.canonicalDigest,generation:bundle.generation,missionIntentId:bundle.missionIntentId},operatingGoal:{id:bundle.inputBindings.operatingGoal.id,digest:bundle.inputBindings.operatingGoal.digest},approvedPlan:{id:bundle.approvedPlanId,digest:bundle.approvedPlanDigest},knowledgeSnapshot:{id:bundle.inputBindings.knowledgeSnapshot.id,digest:bundle.inputBindings.knowledgeSnapshot.digest},accountProfile:{id:account.accountProfileRevisionId,digest:account.digest,platformCode:platform},producerSkill,artifactProfile,sourceSetDigest:sha256Digest([...unit.sourceItemIds].sort())};
}

export function createControlledProducerSubmission(bundle:MissionExecutionBundle,unit:MissionActivationUnit,options:{xMode?:'SINGLE'|'THREAD';submittedAt:string}):ProducerSubmission{
  if(bundle.activationUnits.every((candidate)=>candidate.activationUnitId!==unit.activationUnitId))throw new ArtifactContractError('ARTIFACT_PLATFORM_NOT_SELECTED');
  const inputBindings=expectedArtifactBindings(bundle,unit);const sourceBindings=unit.sourceItemIds.map((sourceItemId)=>({sourceItemId,bindingDigest:sha256Digest({knowledgeSnapshotDigest:bundle.inputBindings.knowledgeSnapshot.digest,sourceItemId})}));
  const payload:ArtifactPayload=unit.platformCode==='X'?controlledXPayload(unit,inputBindings.accountProfile.id,sourceBindings,options.xMode??'THREAD'):controlledXhsPayload(unit,inputBindings.accountProfile.id,sourceBindings);
  return {schemaVersion:3,evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,submissionId:stableId('controlled-producer-submission',{bundle:bundle.canonicalDigest,unit:unit.activationUnitId,payload}),activationUnitId:unit.activationUnitId,producerRole:unit.producerRole,producerIdentityId:`controlled-${unit.producerRole}`,inputBindings,payload,submittedAt:options.submittedAt};
}

export function controlledAuditFindings(result:AuditResult):AuditFinding[]{return auditCheckCodes.map((checkCode,index)=>({checkCode,result:index===0?result:'PASS',path:checkCode==='SCHEMA_AND_ORDER'?'/':'/inputBindings',message:result==='PASS'||index>0?`${checkCode} passed against the exact controlled fixture bindings.`:`Controlled ${result} finding for fail-closed engineering verification.`,evidenceBindings:[sha256Digest({checkCode,result})],recoveryAction:result==='PASS'||index>0?null:result==='FAIL'?'Create a new revision and request independent re-audit.':'Escalate the sensitive risk to the Owner before any approval.'}));}

export function createArtifactRevision(input:{ownerId:string;submission:ProducerSubmission;bundle:MissionExecutionBundle;revision:number;parentRevisionId:string|null;createdAt:string}):ArtifactRevisionV3{
  const {submission,bundle}=input;const unit=bundle.activationUnits.find((item)=>item.activationUnitId===submission.activationUnitId);
  if(unit===undefined)throw new ArtifactContractError('ARTIFACT_PLATFORM_NOT_SELECTED');
  const expected=expectedArtifactBindings(bundle,unit);validateSubmission(submission,unit,expected,input.createdAt);
  const base={schemaVersion:3 as const,id:stableId('artifact-revision',{ownerId:input.ownerId,activationUnitId:unit.activationUnitId,revision:input.revision,submissionDigest:sha256Digest(submission)}),ownerId:input.ownerId,activationUnitId:unit.activationUnitId,platformCode:unit.platformCode as ArtifactPlatform,revision:input.revision,parentRevisionId:input.parentRevisionId,producerRole:submission.producerRole,producerIdentityId:submission.producerIdentityId,origin:'AGENT' as const,evidenceMaturity:submission.evidenceMaturity,agentTeamsExecuted:submission.agentTeamsExecuted,artifactProfileRef:expected.artifactProfile,payload:normalizePayload(submission.payload),inputBindings:expected,state:'AWAITING_AUDIT' as const,createdAt:input.createdAt};
  return {...base,canonicalDigest:sha256Digest(base)};
}

export function quarantineProducerSubmission(submission:ProducerSubmission,bundle:MissionExecutionBundle,createdAt:string):QuarantinedSubmission|null{
  try{createArtifactRevision({ownerId:bundle.ownerId,submission,bundle,revision:1,parentRevisionId:null,createdAt});return null;}catch(error){if(!(error instanceof ArtifactContractError))throw error;return {ownerId:bundle.ownerId,submissionId:submission.submissionId,activationUnitId:submission.activationUnitId,state:'QUARANTINED',reasonCode:error.code,submissionDigest:sha256Digest(submission),createdAt};}
}

export function createOwnerEditRevision(input:{ownerId:string;ownerIdentityId:string;base:ArtifactRevisionV3;payload:ArtifactPayload;revision:number;createdAt:string}):ArtifactRevisionV3{
  if(input.base.ownerId!==input.ownerId)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');validateArtifactPayload(input.payload,input.base.platformCode,input.base.inputBindings,input.createdAt);
  const base={...input.base,id:stableId('artifact-revision',{parent:input.base.id,revision:input.revision,payload:input.payload}),revision:input.revision,parentRevisionId:input.base.id,producerIdentityId:input.ownerIdentityId,origin:'OWNER_EDIT' as const,payload:normalizePayload(input.payload),state:'AWAITING_AUDIT' as const,createdAt:input.createdAt};
  const {canonicalDigest,...canonical}=base;void canonicalDigest;return {...canonical,canonicalDigest:sha256Digest(canonical)};
}

export function createRegenerationRequest(input:{ownerId:string;revision:ArtifactRevisionV3;requestedBy:string;reason:string;requestedAt:string}):RegenerationRequest{
  if(input.ownerId!==input.revision.ownerId)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');const reason=boundedText(input.reason,1,2000,'ARTIFACT_SCHEMA_INVALID');
  const base={schemaVersion:3 as const,id:stableId('regeneration-request',{revision:input.revision.canonicalDigest,reason,at:input.requestedAt}),ownerId:input.ownerId,artifactRevisionId:input.revision.id,artifactRevisionDigest:input.revision.canonicalDigest,reason,requestedBy:boundedText(input.requestedBy,1,200,'ARTIFACT_SCHEMA_INVALID'),requestedAt:input.requestedAt,state:'REQUESTED' as const};return {...base,canonicalDigest:sha256Digest(base)};
}

export function createArtifactAuditDecision(input:{ownerId:string;revision:ArtifactRevisionV3;auditorIdentityId:string;result:AuditResult;findings:AuditFinding[];evidenceBindings:string[];createdAt:string}):ArtifactAuditDecision{
  if(input.ownerId!==input.revision.ownerId)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');assertCurrentArtifactBindings(input.revision,input.createdAt);if(input.auditorIdentityId===input.revision.producerIdentityId)throw new ArtifactContractError('AUDITOR_INDEPENDENCE_REQUIRED');
  const codes=new Set(input.findings.map((item)=>item.checkCode));if(codes.size!==auditCheckCodes.length||auditCheckCodes.some((code)=>!codes.has(code)))throw new ArtifactContractError('AUDIT_FINDINGS_INCOMPLETE');
  const derived=input.findings.some((item)=>item.result==='ESCALATE')?'ESCALATE':input.findings.some((item)=>item.result==='FAIL')?'FAIL':'PASS';if(derived!==input.result)throw new ArtifactContractError('AUDIT_FINDINGS_INCOMPLETE');
  const policyDigest=artifactSkills.AUDIT.digest;const base={schemaVersion:3 as const,id:stableId('artifact-audit',{revision:input.revision.canonicalDigest,auditor:input.auditorIdentityId,result:input.result,findings:input.findings}),ownerId:input.ownerId,artifactRevisionId:input.revision.id,artifactRevisionDigest:input.revision.canonicalDigest,auditorRole:'independent-auditor' as const,auditorIdentityId:boundedText(input.auditorIdentityId,1,200,'ARTIFACT_SCHEMA_INVALID'),result:input.result,findings:structuredClone(input.findings),evidenceBindings:uniqueSorted(input.evidenceBindings),policyVersion:'artifact-independent-audit@1.0.0' as const,policyDigest,createdAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

export function createArtifactOwnerDecision(input:{ownerId:string;revision:ArtifactRevisionV3;audit:ArtifactAuditDecision;result:OwnerArtifactDecisionResult;ownerIdentityId:string;reason?:string|null;decidedAt:string}):ArtifactOwnerDecision{
  if(input.ownerId!==input.revision.ownerId||input.ownerId!==input.audit.ownerId)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');assertCurrentArtifactBindings(input.revision,input.decidedAt);
  if(input.audit.artifactRevisionId!==input.revision.id||input.audit.artifactRevisionDigest!==input.revision.canonicalDigest)throw new ArtifactContractError('OWNER_DECISION_STALE');if(input.result==='APPROVE'&&input.audit.result!=='PASS')throw new ArtifactContractError('AUDIT_PASS_REQUIRED');
  const reason=input.reason===undefined||input.reason===null?null:boundedText(input.reason,1,2000,'ARTIFACT_SCHEMA_INVALID');const base={schemaVersion:3 as const,id:stableId('artifact-owner-decision',{revision:input.revision.canonicalDigest,audit:input.audit.canonicalDigest,result:input.result,owner:input.ownerIdentityId}),ownerId:input.ownerId,artifactRevisionId:input.revision.id,artifactRevisionDigest:input.revision.canonicalDigest,auditDecisionId:input.audit.id,auditDecisionDigest:input.audit.canonicalDigest,result:input.result,ownerIdentityId:boundedText(input.ownerIdentityId,1,200,'ARTIFACT_SCHEMA_INVALID'),reason,decidedAt:input.decidedAt};return {...base,canonicalDigest:sha256Digest(base)};
}

export function buildManualPublishPackage(input:{ownerId:string;revision:ArtifactRevisionV3;audit:ArtifactAuditDecision;decision:ArtifactOwnerDecision;createdAt:string;officialUrlRef?:OfficialPublishUrlRef}):ManualPublishPackage{
  const {revision,audit,decision}=input;if(revision.ownerId!==input.ownerId||audit.ownerId!==input.ownerId||decision.ownerId!==input.ownerId)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');assertCurrentArtifactBindings(revision,input.createdAt);
  if(audit.result!=='PASS'||decision.result!=='APPROVE')throw new ArtifactContractError('AUDIT_PASS_REQUIRED');if(audit.artifactRevisionDigest!==revision.canonicalDigest||decision.artifactRevisionDigest!==revision.canonicalDigest||decision.auditDecisionDigest!==audit.canonicalDigest)throw new ArtifactContractError('PACKAGE_INPUT_INVALIDATED');
  const official=sanitizeOfficialPublishUrlRef(input.officialUrlRef??officialPublishUrlRegistry[revision.platformCode],input.createdAt);const exactInputDigest=sha256Digest({revision:revision.canonicalDigest,audit:audit.canonicalDigest,decision:decision.canonicalDigest,official:official.digest});
  const contentFiles=packageContentFiles(revision);const manifestBody=canonicalJson({schemaVersion:3,contract:ARTIFACT_CONTRACT_VERSION,platformCode:revision.platformCode,accountProfileRevisionId:revision.inputBindings.accountProfile.id,artifactRevision:{id:revision.id,digest:revision.canonicalDigest},auditDecision:{id:audit.id,digest:audit.canonicalDigest},ownerDecision:{id:decision.id,digest:decision.canonicalDigest},officialPublishUrlRef:{id:official.id,digest:official.digest},externalState:'UNVERIFIED_EXTERNAL_STATE',files:contentFiles.map((file)=>({position:file.position,fileName:file.fileName,mediaType:file.mediaType,digest:file.digest}))});
  const manifest=file(1,'manifest.json','application/json',manifestBody);const orderedFiles=[manifest,...contentFiles.map((entry,index)=>({...entry,position:index+2}))];const manifestDigest=manifest.digest;const base={schemaVersion:3 as const,id:stableId('manual-publish-package',{exactInputDigest,manifestDigest}),ownerId:input.ownerId,platformCode:revision.platformCode,accountProfileRevisionId:revision.inputBindings.accountProfile.id,artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,auditDecisionId:audit.id,auditDecisionDigest:audit.canonicalDigest,ownerDecisionId:decision.id,ownerDecisionDigest:decision.canonicalDigest,officialPublishUrlRef:official,exactInputDigest,orderedFiles,manifestDigest,state:'READY' as const,createdAt:input.createdAt,externalState:'UNVERIFIED_EXTERNAL_STATE' as const};assertPublicSafePackage(base);return base;
}

export function verifyManualPublishPackage(value:ManualPublishPackage):{ok:true}|{ok:false;code:ArtifactErrorCode}{
  try{assertPublicSafePackage(value);const manifest=value.orderedFiles[0];if(manifest?.fileName!=='manifest.json'||manifest.digest!==value.manifestDigest||value.orderedFiles.some((entry,index)=>entry.position!==index+1||entry.digest!==sha256Digest(entry.content)))return {ok:false,code:'PACKAGE_DIGEST_MISMATCH'};sanitizeOfficialPublishUrlRef(value.officialPublishUrlRef,value.createdAt);return {ok:true};}catch(error){return {ok:false,code:error instanceof ArtifactContractError?error.code:'PACKAGE_DIGEST_MISMATCH'};}
}

export function recordPackageHelperEvent(input:{ownerId:string;value:ManualPublishPackage;action:PackageHelperEvent['action'];createdAt:string}):PackageHelperEvent{
  if(input.value.ownerId!==input.ownerId)throw new ArtifactContractError('OWNER_BOUNDARY_VIOLATION');if(!verifyManualPublishPackage(input.value).ok)throw new ArtifactContractError('PACKAGE_DIGEST_MISMATCH');if(input.action==='OPEN_OFFICIAL_PUBLISH_PAGE')sanitizeOfficialPublishUrlRef(input.value.officialPublishUrlRef,input.createdAt);
  const base={schemaVersion:3 as const,id:stableId('package-helper-event',{packageId:input.value.id,action:input.action,createdAt:input.createdAt}),ownerId:input.ownerId,packageId:input.value.id,packageDigest:input.value.manifestDigest,action:input.action,state:'EXPORTED' as const,externalState:'UNVERIFIED_EXTERNAL_STATE' as const,createdAt:input.createdAt};return {...base,canonicalDigest:sha256Digest(base)};
}

export function createArtifactInvalidation(input:Omit<ArtifactInvalidationEvent,'schemaVersion'|'id'|'canonicalDigest'>):ArtifactInvalidationEvent{const base={schemaVersion:3 as const,id:stableId('artifact-invalidation',input),...input};return {...base,canonicalDigest:sha256Digest(base)};}

export function effectiveArtifactState(workspace:ArtifactWorkspace,revision:ArtifactRevisionV3):ArtifactRevisionState{
  if(workspace.invalidations.some((event)=>event.artifactRevisionId===revision.id))return 'INVALIDATED';const audit=[...workspace.audits].reverse().find((item)=>item.artifactRevisionId===revision.id&&item.artifactRevisionDigest===revision.canonicalDigest);if(audit===undefined)return 'AWAITING_AUDIT';if(audit.result==='FAIL')return 'AUDIT_FAILED';if(audit.result==='ESCALATE')return 'AUDIT_ESCALATED';const decision=[...workspace.ownerDecisions].reverse().find((item)=>item.artifactRevisionId===revision.id&&item.auditDecisionId===audit.id);if(decision===undefined)return 'OWNER_REVIEW';return decision.result==='APPROVE'?'APPROVED':'REJECTED';
}

export function effectivePackageState(workspace:ArtifactWorkspace,value:ManualPublishPackage):PackageState{if(workspace.invalidations.some((event)=>event.artifactRevisionId===value.artifactRevisionId))return 'INVALIDATED';return workspace.helperEvents.some((event)=>event.packageId===value.id)?'EXPORTED':'READY';}

export function sanitizeOfficialPublishUrlRef(value:OfficialPublishUrlRef,at:string):OfficialPublishUrlRef{
  if(value.platformCode!==artifactPlatforms.find((item)=>item===value.platformCode)||Date.parse(value.checkedAt)>=Date.parse(value.expiresAt)||Date.parse(value.expiresAt)<=Date.parse(at))throw new ArtifactContractError(value.platformCode==='X'||value.platformCode==='XIAOHONGSHU'?'PLATFORM_CONSTRAINT_STALE':'OFFICIAL_URL_NOT_ALLOWLISTED');
  let parsed:URL;try{parsed=new URL(value.url);}catch{throw new ArtifactContractError('OFFICIAL_URL_NOT_ALLOWLISTED');}if(parsed.protocol!=='https:'||parsed.username!==''||parsed.password!=='' )throw new ArtifactContractError('OFFICIAL_URL_NOT_ALLOWLISTED');
  const valid=value.platformCode==='X'?parsed.hostname==='x.com'&&parsed.pathname==='/compose/post':parsed.hostname==='creator.xiaohongshu.com'&&parsed.pathname==='/publish';if(!valid)throw new ArtifactContractError('OFFICIAL_URL_NOT_ALLOWLISTED');
  const clean=`${parsed.origin}${parsed.pathname}`;const base={...value,url:clean,digest:''};const {digest,...canonical}=base;void digest;return {...canonical,digest:sha256Digest(canonical)};
}

export function assertCurrentArtifactBindings(revision:ArtifactRevisionV3,at:string):void{const profile=artifactProfiles[revision.platformCode];const skill=artifactSkills[revision.platformCode];if(revision.artifactProfileRef.digest!==profile.digest||revision.inputBindings.artifactProfile.digest!==profile.digest)throw new ArtifactContractError('ARTIFACT_PROFILE_UNSUPPORTED');if(revision.inputBindings.producerSkill.digest!==skill.digest)throw new ArtifactContractError('ARTIFACT_INPUT_MISMATCH');if(Date.parse(profile.expiresAt)<=Date.parse(at))throw new ArtifactContractError('PLATFORM_CONSTRAINT_STALE');}

function validateSubmission(submission:ProducerSubmission,unit:MissionActivationUnit,expected:ArtifactInputBindings,at:string):void{
  if(submission.schemaVersion!==3||submission.agentTeamsExecuted!== (submission.evidenceMaturity==='AGENTTEAMS_RUNTIME'))throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');
  if(submission.producerRole!==unit.producerRole)throw new ArtifactContractError('ARTIFACT_PRODUCER_MISMATCH');if(submission.payload.kind!==unit.platformCode)throw new ArtifactContractError('ARTIFACT_PLATFORM_NOT_SELECTED');
  if(sha256Digest(submission.inputBindings)!==sha256Digest(expected))throw new ArtifactContractError('ARTIFACT_INPUT_MISMATCH');validateArtifactPayload(submission.payload,unit.platformCode as ArtifactPlatform,expected,at);
}

export function validateArtifactPayload(payload:ArtifactPayload,platform:ArtifactPlatform,bindings:ArtifactInputBindings,at:string):void{
  if(payload.kind!==platform||bindings.artifactProfile.platformCode!==platform||bindings.artifactProfile.digest!==artifactProfiles[platform].digest)throw new ArtifactContractError('ARTIFACT_PROFILE_UNSUPPORTED');if(Date.parse(bindings.artifactProfile.expiresAt)<=Date.parse(at))throw new ArtifactContractError('PLATFORM_CONSTRAINT_STALE');
  if(payload.accountProfileRevisionId!==bindings.accountProfile.id)throw new ArtifactContractError('ARTIFACT_ACCOUNT_MISMATCH');const sources=payload.sourceBindings.map((item)=>item.sourceItemId);if(sha256Digest([...sources].sort())!==bindings.sourceSetDigest||new Set(sources).size!==sources.length||payload.sourceBindings.some((item)=>!isDigest(item.bindingDigest)||item.bindingDigest!==sha256Digest({knowledgeSnapshotDigest:bindings.knowledgeSnapshot.digest,sourceItemId:item.sourceItemId})))throw new ArtifactContractError('ARTIFACT_SOURCE_MISMATCH');
  if(payload.kind==='X')validateX(payload);else validateXhs(payload);
}

function validateX(payload:XArtifactPayload):void{
  const expectedCount=payload.mode==='SINGLE'?1:payload.posts.length;if(payload.posts.length!==expectedCount||payload.posts.length<1||payload.posts.length>25)throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');assertContinuous(payload.posts.map((item)=>item.position));
  for(const post of payload.posts){if(weightedXLength(post.text)>280)throw new ArtifactContractError('ARTIFACT_LENGTH_INVALID');if(post.mediaRefs.length>4)throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');validateMedia(post.mediaRefs);if(post.mediaRefs.length>0&&(post.altText===null||post.altText.length<1||post.altText.length>1000))throw new ArtifactContractError('ARTIFACT_LENGTH_INVALID');}
  if(payload.link!==null){let url:URL;try{url=new URL(payload.link);}catch{throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');}if(url.protocol!=='https:')throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');}boundedText(payload.language,2,16,'ARTIFACT_SCHEMA_INVALID');if(payload.cta!==null)boundedText(payload.cta,1,500,'ARTIFACT_LENGTH_INVALID');
}
function validateXhs(payload:XiaohongshuArtifactPayload):void{
  boundedText(payload.title,1,120,'ARTIFACT_LENGTH_INVALID');boundedText(payload.body,1,20000,'ARTIFACT_LENGTH_INVALID');if(payload.topics.length<1||payload.topics.length>30||new Set(payload.topics).size!==payload.topics.length)throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');payload.topics.forEach((item)=>boundedText(item.replace(/^#/u,''),1,80,'ARTIFACT_LENGTH_INVALID'));if(payload.imageSpecs.length<1||payload.imageSpecs.length>18)throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');assertContinuous(payload.imageSpecs.map((item)=>item.position));
  boundedText(payload.coverSpec.purpose,1,500,'ARTIFACT_SCHEMA_INVALID');boundedText(payload.coverSpec.aspectRatio,3,20,'ARTIFACT_SCHEMA_INVALID');boundedText(payload.coverSpec.visualBrief,1,4000,'ARTIFACT_SCHEMA_INVALID');for(const spec of payload.imageSpecs){boundedText(spec.purpose,1,500,'ARTIFACT_SCHEMA_INVALID');boundedText(spec.visualBrief,1,4000,'ARTIFACT_SCHEMA_INVALID');if(spec.authorizedMediaRef!==null)validateMedia([spec.authorizedMediaRef]);}if(payload.cta!==null)boundedText(payload.cta,1,500,'ARTIFACT_LENGTH_INVALID');
}
function validateMedia(items:AuthorizedMediaRef[]):void{for(const item of items){if(!isDigest(item.digest)||item.rights!=='OWNER_AUTHORIZED_LOCAL'||!safeFileName(item.fileName)||item.altText.length<1||item.altText.length>1000)throw new ArtifactContractError('ARTIFACT_SCHEMA_INVALID');}}

export function weightedXLength(value:string):number{const url=/https:\/\/[^\s]+/gu;let total=0;let cursor=0;for(const match of value.matchAll(url)){total+=weightedPlain(value.slice(cursor,match.index))+23;cursor=(match.index??0)+match[0].length;}return total+weightedPlain(value.slice(cursor));}
function weightedPlain(value:string):number{return Array.from(value).reduce((sum,char)=>sum+(char.codePointAt(0)!<=0x10ff?1:2),0);}

function packageContentFiles(revision:ArtifactRevisionV3):ManualPublishFile[]{
  if(revision.payload.kind==='X'){const payload=revision.payload;const posts=payload.posts.map((post)=>file(0,`post-${String(post.position).padStart(2,'0')}.txt`,'text/plain',`${post.text}\n`));const joined=payload.posts.map((post)=>`${post.position}/${payload.posts.length}\n${post.text}`).join('\n\n---\n\n');const content=`${joined}${payload.cta===null?'':`\n\nCTA: ${payload.cta}`}${payload.link===null?'':`\n\n${payload.link}`}\n`;const media=payload.posts.flatMap((post)=>post.mediaRefs.map((entry)=>({postPosition:post.position,fileName:entry.fileName,digest:entry.digest,mediaType:entry.mediaType,rights:entry.rights,altText:entry.altText})));return [file(0,'content.md','text/markdown',content),...posts,file(0,'media-alt-manifest.json','application/json',canonicalJson({media}))];}
  const payload=revision.payload;const imageSpecs=payload.imageSpecs.map((item)=>({...item,authorizedMediaRef:item.authorizedMediaRef===null?null:{digest:item.authorizedMediaRef.digest,fileName:item.authorizedMediaRef.fileName,mediaType:item.authorizedMediaRef.mediaType,rights:item.authorizedMediaRef.rights,altText:item.authorizedMediaRef.altText}}));return [file(0,'title.txt','text/plain',`${payload.title}\n`),file(0,'body.md','text/markdown',`${payload.body}${payload.cta===null?'':`\n\nCTA: ${payload.cta}`}\n`),file(0,'topics.txt','text/plain',`${payload.topics.map((item)=>`#${item.replace(/^#/u,'')}`).join(' ')}\n`),file(0,'image-specs.json','application/json',canonicalJson({coverSpec:payload.coverSpec,imageSpecs,generatedMedia:false}))];
}
function controlledXPayload(unit:MissionActivationUnit,accountProfileRevisionId:string,sourceBindings:ArtifactSourceBinding[],mode:'SINGLE'|'THREAD'):XArtifactPayload{
  const objective=boundedText(unit.contentObjective,1,160,'ARTIFACT_SCHEMA_INVALID');const posts=mode==='SINGLE'?[{position:1,text:`${objective} Every claim stays bound to approved evidence before the Owner decides.`,mediaRefs:[],altText:null}]:[
    {position:1,text:`${objective} A public presence mission starts with an exact goal and approved knowledge.`,mediaRefs:[],altText:null},
    {position:2,text:'The Producer and independent Auditor have separate responsibilities. Every finding remains visible.',mediaRefs:[],altText:null},
    {position:3,text:'The Owner approves an exact revision. Copy, download, or opening X never means PUBLISHED.',mediaRefs:[],altText:null}
  ];
  return {kind:'X',mode,posts,link:null,cta:'Review the evidence-bound mission package.',language:'en-US',accountProfileRevisionId,sourceBindings};
}
function controlledXhsPayload(unit:MissionActivationUnit,accountProfileRevisionId:string,sourceBindings:ArtifactSourceBinding[]):XiaohongshuArtifactPayload{
  return {kind:'XIAOHONGSHU',title:'一份真正可审阅的内容交付',body:`本次内容目标：${boundedText(unit.contentObjective,1,200,'ARTIFACT_SCHEMA_INVALID')}。\n\nProducer、独立审校和 Owner 决策各自留下精确摘要。当前仅输出配图规格，没有生成图片，也没有自动发布。`,topics:['AI原生品牌运营','内容治理'],cta:'查看完整证据链',coverSpec:{purpose:'让普通用户一眼理解“先审校，再批准”',aspectRatio:'3:4',visualBrief:'米白纸张质感，深墨绿信息层级，珊瑚色标记 Owner gate。',overlayCopy:'完整内容，精确批准'},imageSpecs:[{position:1,purpose:'封面',aspectRatio:'3:4',visualBrief:'展示 Goal → Artifact → Audit → Owner 四段式证据链。',overlayCopy:'从目标到可发布包',altDescription:'四段式内容治理证据链',authorizedMediaRef:null},{position:2,purpose:'审校发现',aspectRatio:'3:4',visualBrief:'逐项列出来源、账号、平台约束和风险 findings。',overlayCopy:'每一项都可追踪',altDescription:'独立审校逐项 findings 示例',authorizedMediaRef:null},{position:3,purpose:'人工发布边界',aspectRatio:'3:4',visualBrief:'显示复制、下载、打开官方页均保持外部状态未确认。',overlayCopy:'打开页面 ≠ 已发布',altDescription:'人工发布包的未确认外部状态',authorizedMediaRef:null}],language:'zh-CN',accountProfileRevisionId,sourceBindings};
}
function file(position:number,fileName:string,mediaType:ManualPublishFile['mediaType'],content:string):ManualPublishFile{return {position,fileName,mediaType,content,digest:sha256Digest(content)};}
function assertPublicSafePackage(value:unknown):void{const text=JSON.stringify(value);if(/(?:file:\/\/|\/Users\/|[A-Z]:\\|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|(?:api[_-]?key|access[_-]?token|password|cookie|secret)\s*[:=])/iu.test(text))throw new ArtifactContractError('PACKAGE_INPUT_INVALIDATED');}
function normalizePayload<T extends ArtifactPayload>(value:T):T{return structuredClone(value);}
function stableId(prefix:string,value:unknown):string{return `${prefix}_${sha256Digest(value).slice(0,24)}`;}
function canonicalJson(value:unknown):string{return `${JSON.stringify(sortJson(value),null,2)}\n`;}
function sortJson(value:unknown):unknown{if(Array.isArray(value))return value.map(sortJson);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,sortJson(item)]));return value;}
function assertContinuous(positions:number[]):void{if(positions.some((value,index)=>value!==index+1))throw new ArtifactContractError('ARTIFACT_ORDER_INVALID');}
function uniqueSorted(value:string[]):string[]{return [...new Set(value)].sort();}
function boundedText(value:unknown,min:number,max:number,code:ArtifactErrorCode):string{if(typeof value!=='string'){throw new ArtifactContractError(code);}const normalized=value.normalize('NFC').trim();if(normalized.length<min||normalized.length>max||/[\u0000]/u.test(normalized))throw new ArtifactContractError(code);return normalized;}
function safeFileName(value:string):boolean{return /^(?!\.?\.?$)[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value);}
function isDigest(value:unknown):value is string{return typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);}
