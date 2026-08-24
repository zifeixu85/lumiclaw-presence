import {describe,expect,it} from 'vitest';
import {
  AGENTTEAMS_IMAGE_DIGESTS,
  AGENTTEAMS_LICENSE,
  AGENTTEAMS_RUNTIME_VERSION,
  AGENTTEAMS_SOURCE_COMMIT,
  AGENTTEAMS_SOURCE_TAR_SHA256,
  AGENTTEAMS_TEAM_PROFILE_DIGEST,
  AGENTTEAMS_TEAM_PROFILE_VERSION,
  type MissionRun
} from './persistent-runtime.js';
import {mediaCompositionResourceSnapshot,type ArtifactRevisionV4} from './media-artifact.js';
import type {ArtifactRevisionV3} from './artifact-publish.js';
import {sha256Digest} from './canonical.js';
import {
  MEDIA_AUDIT_CHECK_CODES,
  MEDIA_AUDIT_OUTPUT_SCHEMA_REF,
  MEDIA_AUDIT_SKILL_SOURCE_DIGEST,
  MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS,
  compileMediaAuditRuntimeGraph,
  runtimeMediaAuditInputProjection,
  validateMediaAuditOutput,
  type MediaAuditOutputV4
} from './media-audit-runtime.js';

const ownerId='018f0000-0000-7000-8000-000000000912';
const at='2026-08-24T08:00:00.000Z';
const bundleId='bundle-exact-a5-source';
const bundleDigest=sha256Digest(bundleId);

describe('SDD-012 CR2 exact A5 media Audit TaskContract',()=>{
  it('compiles one independent A5 task with immutable revision, bytes, snapshots, schemas and exact Skill locks',()=>{
    const graph=compileMediaAuditRuntimeGraph({ownerId,revision:revision(),parentRevision:parent(),sourceRun:sourceRun(),createdBy:ownerId,createdAt:at});
    const contract=graph.job.contract;const authority=contract.authorityBinding!;
    expect(graph.job).toMatchObject({roleId:'independent-auditor',kind:'AUDIT_CONTENT',state:'QUEUED'});
    expect(contract).toMatchObject({outputSchema:MEDIA_AUDIT_OUTPUT_SCHEMA_REF,externalActionAllowed:false,substantive:true});
    expect(authority).toMatchObject({artifactRevisionId:'media-revision-exact-a5',artifactRevisionDigest:revision().canonicalDigest,mediaSetDigest:revision().mediaSetBinding.canonicalDigest,brandSnapshotDigest:revision().brandSnapshot.digest,knowledgeSnapshotDigest:revision().knowledgeSnapshot.digest,teamRoleSkillLocks:[...MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS],domainSkillLocks:[expect.objectContaining({id:'artifact-independent-audit',version:'2.0.0',sourceDigest:MEDIA_AUDIT_SKILL_SOURCE_DIGEST})]});
    expect(authority.finalMedia).toEqual([expect.objectContaining({contentDigest:'7'.repeat(64),blobDigest:'8'.repeat(64),bytes:128})]);
    expect(sha256Digest(runtimeMediaAuditInputProjection(contract))).toBe(contract.inputDigest);
  });

  it('rejects alternate Skill locks, controlled source history, and cross-revision or cross-snapshot output',()=>{
    const graph=compileMediaAuditRuntimeGraph({ownerId,revision:revision(),parentRevision:parent(),sourceRun:sourceRun(),createdBy:ownerId,createdAt:at});
    const tampered=structuredClone(graph.job.contract);tampered.authorityBinding!.teamRoleSkillLocks=['independent-action-audit@9.9.9'];const authorityBase={...tampered.authorityBinding!};delete (authorityBase as {canonicalDigest?:string}).canonicalDigest;tampered.authorityBinding!.canonicalDigest=sha256Digest(authorityBase);const contractBase={...tampered};delete (contractBase as {canonicalDigest?:string}).canonicalDigest;tampered.canonicalDigest=sha256Digest(contractBase);
    expect(()=>runtimeMediaAuditInputProjection(tampered)).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_TASK_CONTRACT_INVALID'}));
    expect(()=>compileMediaAuditRuntimeGraph({ownerId,revision:revision(),parentRevision:{...parent(),evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false},sourceRun:sourceRun(),createdBy:ownerId,createdAt:at})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_RUNTIME_SOURCE_REQUIRED'}));
    const output=passingOutput(graph.job.contract.taskId,graph.job.contract.inputDigest);
    expect(validateMediaAuditOutput(graph.job.contract,output).result).toBe('PASS');
    for(const candidate of [
      {...output,taskId:'cross-task'},
      {...output,inputDigest:'0'.repeat(64)},
      {...output,artifactRevisionId:'cross-revision'},
      {...output,artifactRevisionDigest:'0'.repeat(64)},
      {...output,mediaSetDigest:'6'.repeat(64)},
      {...output,brandSnapshotDigest:'2'.repeat(64)},
      {...output,knowledgeSnapshotDigest:'3'.repeat(64)},
      {...output,actualMediaDigests:['4'.repeat(64)]}
    ])expect(()=>validateMediaAuditOutput(graph.job.contract,candidate)).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
    expect(()=>validateMediaAuditOutput(graph.job.contract,{...output,result:'PASS',findings:output.findings.map((finding,index)=>index===0?{...finding,result:'FAIL'}:finding)})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
  });
});

function passingOutput(taskId:string,inputDigest:string):MediaAuditOutputV4{return {schemaVersion:4,taskId,inputDigest,artifactRevisionId:revision().id,artifactRevisionDigest:revision().canonicalDigest,mediaSetDigest:revision().mediaSetBinding.canonicalDigest,brandSnapshotDigest:revision().brandSnapshot.digest,knowledgeSnapshotDigest:revision().knowledgeSnapshot.digest,actualMediaDigests:revision().mediaSetBinding.items.map((item)=>item.contentDigest),result:'PASS',findings:MEDIA_AUDIT_CHECK_CODES.map((checkCode)=>({checkCode,result:'PASS',message:`${checkCode} exact binding passed`,evidenceDigests:[revision().canonicalDigest],recoveryAction:null}))};}

function sourceRun():MissionRun{return {schemaVersion:1,id:'source-run-exact-a5',ownerId,bundleId,bundleDigest,bundleKind:'MISSION_EXECUTION',generation:1,runtimeRequirement:{runtime:'agentteams',version:AGENTTEAMS_RUNTIME_VERSION,sourceCommit:AGENTTEAMS_SOURCE_COMMIT,sourceTarSha256:AGENTTEAMS_SOURCE_TAR_SHA256,license:AGENTTEAMS_LICENSE,imageDigests:AGENTTEAMS_IMAGE_DIGESTS,teamProfileVersion:AGENTTEAMS_TEAM_PROFILE_VERSION,teamProfileDigest:AGENTTEAMS_TEAM_PROFILE_DIGEST},state:'SUCCEEDED_RUNTIME',createdBy:ownerId,createdAt:at,startedAt:at,finishedAt:at,lastReconciledAt:at,errorCode:null,rowVersion:8};}

function parent():ArtifactRevisionV3{const base={schemaVersion:3 as const,id:'artifact-revision-v3-exact-a5',ownerId,activationUnitId:'activation-xhs-exact-a5',platformCode:'XIAOHONGSHU' as const,revision:3,parentRevisionId:null,producerRole:'product-account-producer' as const,producerIdentityId:'@product-account-producer:matrix.local',origin:'AGENT' as const,evidenceMaturity:'AGENTTEAMS_RUNTIME' as const,agentTeamsExecuted:true,artifactProfileRef:{id:'XHS_IMAGE_NOTE',version:'1.0.0' as const,digest:'2'.repeat(64),platformCode:'XIAOHONGSHU' as const,source:'test-profile',checkedAt:at,expiresAt:'2026-09-24T08:00:00.000Z'},payload:{kind:'XIAOHONGSHU' as const,title:'杭州 AI 品牌运营',body:'只陈述可验证事实。',topics:['AI','品牌运营'],cta:null,coverSpec:{purpose:'封面',aspectRatio:'3:4',visualBrief:'杭州城市光影',overlayCopy:'可审校的全球品牌运营'},imageSpecs:[{position:1,purpose:'封面',aspectRatio:'3:4',visualBrief:'杭州城市光影',overlayCopy:'可审校的全球品牌运营',altDescription:'杭州城市光影',authorizedMediaRef:null}],language:'zh-CN',accountProfileRevisionId:'account-xhs',sourceBindings:[]},inputBindings:{executionBundle:{id:bundleId,digest:bundleDigest,generation:1,missionIntentId:'mission-intent-exact-a5'},operatingGoal:{id:'goal-exact-a5',digest:'3'.repeat(64)},approvedPlan:{id:'plan-exact-a5',digest:'4'.repeat(64)},knowledgeSnapshot:{id:'knowledge-exact-a5',digest:'5'.repeat(64)},accountProfile:{id:'account-xhs',digest:'6'.repeat(64),platformCode:'XIAOHONGSHU' as const},producerSkill:{id:'xiaohongshu-content-expression' as const,version:'1.0.0' as const,digest:'a'.repeat(64),source:'skills/xiaohongshu-content-expression/SKILL.md' as const,sourceDigest:'b'.repeat(64),license:'Apache-2.0' as const},artifactProfile:{id:'XHS_IMAGE_NOTE',version:'1.0.0' as const,digest:'2'.repeat(64),platformCode:'XIAOHONGSHU' as const,source:'test-profile',checkedAt:at,expiresAt:'2026-09-24T08:00:00.000Z'},sourceSetDigest:'c'.repeat(64)},state:'AWAITING_AUDIT' as const,createdAt:at};return {...base,canonicalDigest:sha256Digest(base)};}

function revision():ArtifactRevisionV4{const base={schemaVersion:4 as const,id:'media-revision-exact-a5',ownerId,platformCode:'XIAOHONGSHU' as const,revision:4,parentRevisionId:parent().id,parentRevisionDigest:parent().canonicalDigest,producerIdentityId:parent().producerIdentityId,payloadDigest:sha256Digest(parent().payload),mediaSetBinding:{schemaVersion:1 as const,profileRef:'xhs-delivery-profile',profileDigest:'d'.repeat(64),items:[{position:1,assetId:'final-a5-1',finalAssetDigest:'e'.repeat(64),contentDigest:'7'.repeat(64),blobRef:{algorithm:'sha256' as const,digest:'8'.repeat(64),size:128},mimeType:'image/png' as const,bytes:128,width:1080 as const,height:1440 as const,altText:'杭州城市光影',rawAssetDigest:'9'.repeat(64),generationSpecDigest:'a'.repeat(64),compositionSpecDigest:'b'.repeat(64),brandSnapshotDigest:'c'.repeat(64),knowledgeSnapshotDigest:'d'.repeat(64),templateDigest:mediaCompositionResourceSnapshot.templateDigest,rightsReceiptDigest:'e'.repeat(64),costReceiptDigest:'f'.repeat(64),fileName:'image-01.png'}],canonicalDigest:'1'.repeat(64)},brandSnapshot:{id:'brand-a5',digest:'c'.repeat(64),state:'APPROVED' as const,approvedAt:at,expiresAt:null},knowledgeSnapshot:{id:'knowledge-a5',digest:'d'.repeat(64),state:'APPROVED' as const,approvedAt:at,expiresAt:null},state:'AWAITING_AUDIT' as const,createdAt:at};return {...base,canonicalDigest:sha256Digest(base)};}
