import {describe,expect,it} from 'vitest';
import {
  AGENTTEAMS_IMAGE_DIGESTS,
  AGENTTEAMS_LICENSE,
  AGENTTEAMS_RUNTIME_VERSION,
  AGENTTEAMS_SOURCE_COMMIT,
  AGENTTEAMS_SOURCE_TAR_SHA256,
  AGENTTEAMS_TEAM_PROFILE_DIGEST,
  AGENTTEAMS_TEAM_PROFILE_VERSION,
  type MissionRun,
  type RuntimeTaskContract
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
    expect(authority).toMatchObject({artifactRevisionId:revision().id,artifactRevisionDigest:revision().canonicalDigest,mediaSetDigest:revision().mediaSetBinding.canonicalDigest,brandSnapshotDigest:revision().brandSnapshot.digest,knowledgeSnapshotDigest:revision().knowledgeSnapshot.digest,teamRoleSkillLocks:[...MEDIA_AUDIT_TEAM_ROLE_SKILL_LOCKS],domainSkillLocks:[expect.objectContaining({id:'artifact-independent-audit',version:'2.0.0',sourceDigest:MEDIA_AUDIT_SKILL_SOURCE_DIGEST})]});
    expect(authority.finalMedia).toEqual([expect.objectContaining({contentDigest:'7'.repeat(64),blobDigest:'7'.repeat(64),bytes:128})]);
    const projection=runtimeMediaAuditInputProjection(contract);
    expect(projection).toMatchObject({
      reviewContent:{title:'杭州 AI 品牌运营',body:'只陈述可验证事实。',topics:['AI','品牌运营'],language:'zh-CN',accountProfileRevisionId:'account-xhs',coverSpec:{visualBrief:'杭州城市光影',overlayCopy:'可审校的全球品牌运营'},imageSpecs:[{position:1,visualBrief:'杭州城市光影',overlayCopy:'可审校的全球品牌运营',altDescription:'杭州城市光影'}]},
      machineFacts:{allAssertionsPassed:true,capabilityBoundary:{reviewMode:'TEXT_ONLY_WITH_SERVER_MACHINE_FACTS',pixelInspectionPerformed:false,ownerVisualReviewRequired:true}},
      evidenceAuthority:{baseReviewContentDigest:authority.baseReviewContentDigest,allowedEvidenceDigests:authority.allowedEvidenceDigests,evidencePolicy:authority.evidencePolicy},
      privacyBoundary:{included:'OWNER_INTENDED_PUBLIC_ARTIFACT_AND_APPROVED_SAFE_DIGEST_CONTEXT_ONLY'},
      externalActionAllowed:false
    });
    expect(sha256Digest(projection)).toBe(contract.inputDigest);
    expect(authority.inputProjectionDigest).toBe(contract.inputDigest);
  });

  it('rejects alternate Skill locks, controlled source history, and cross-revision or cross-snapshot output',()=>{
    const graph=compileMediaAuditRuntimeGraph({ownerId,revision:revision(),parentRevision:parent(),sourceRun:sourceRun(),createdBy:ownerId,createdAt:at});
    const tampered=structuredClone(graph.job.contract);tampered.authorityBinding!.teamRoleSkillLocks=['independent-action-audit@9.9.9'];const authorityBase={...tampered.authorityBinding!};delete (authorityBase as {canonicalDigest?:string}).canonicalDigest;tampered.authorityBinding!.canonicalDigest=sha256Digest(authorityBase);const contractBase={...tampered};delete (contractBase as {canonicalDigest?:string}).canonicalDigest;tampered.canonicalDigest=sha256Digest(contractBase);
    expect(()=>runtimeMediaAuditInputProjection(tampered)).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_TASK_CONTRACT_INVALID'}));
    expect(()=>compileMediaAuditRuntimeGraph({ownerId,revision:revision(),parentRevision:{...parent(),evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false},sourceRun:sourceRun(),createdBy:ownerId,createdAt:at})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_RUNTIME_SOURCE_REQUIRED'}));
    const output=passingOutput(graph.job.contract);
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

  it('binds public review content and evidence policy without a self-referential digest',()=>{
    const firstParent=parent();const first=compileMediaAuditRuntimeGraph({ownerId,revision:revision(firstParent),parentRevision:firstParent,sourceRun:sourceRun(),createdBy:ownerId,createdAt:at});
    for(const field of ['body','visualBrief','overlayCopy','altDescription'] as const){const changedParent=mutatedParent(field);const changed=compileMediaAuditRuntimeGraph({ownerId,revision:revision(changedParent),parentRevision:changedParent,sourceRun:sourceRun(),createdBy:ownerId,createdAt:at});expect(changed.job.contract.authorityBinding!.baseReviewContentDigest,field).not.toBe(first.job.contract.authorityBinding!.baseReviewContentDigest);expect(changed.job.contract.inputDigest,field).not.toBe(first.job.contract.inputDigest);expect(changed.job.contract.taskId,field).not.toBe(first.job.contract.taskId);expect(changed.job.contract.canonicalDigest,field).not.toBe(first.job.contract.canonicalDigest);}

    const tampered=structuredClone(first.job.contract);tampered.authorityBinding!.evidencePolicy[0]!.requiredEvidenceDigests.reverse();resealContract(tampered);
    expect(()=>runtimeMediaAuditInputProjection(tampered)).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_TASK_CONTRACT_INVALID'}));
    const reordered=structuredClone(first.job.contract);reordered.authorityBinding!.evidencePolicy.reverse();resealContract(reordered);
    expect(()=>runtimeMediaAuditInputProjection(reordered)).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_TASK_CONTRACT_INVALID'}));
  });

  it('rejects secrets, signed URLs and unbounded raw bytes from the A5 gateway projection',()=>{
    for(const unsafeBody of ['private-prompt://internal','https://example.invalid/file?x-amz-signature=secret','data:image/png;base64,AAAA']){
      const unsafeParent=parent(unsafeBody);
      expect(()=>compileMediaAuditRuntimeGraph({ownerId,revision:revision(unsafeParent),parentRevision:unsafeParent,sourceRun:sourceRun(),createdBy:ownerId,createdAt:at})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_TASK_CONTRACT_INVALID'}));
    }
    const safe=compileMediaAuditRuntimeGraph({ownerId,revision:revision(),parentRevision:parent(),sourceRun:sourceRun(),createdBy:ownerId,createdAt:at});
    const serialized=JSON.stringify((runtimeMediaAuditInputProjection(safe.job.contract) as {reviewContent:unknown}).reviewContent);
    expect(serialized).not.toMatch(/private-prompt|x-amz-signature|data:image|raw provider|secret/i);
  });

  it('accepts only the exact per-check evidence authority and honest text-only capability',()=>{
    const graph=compileMediaAuditRuntimeGraph({ownerId,revision:revision(),parentRevision:parent(),sourceRun:sourceRun(),createdBy:ownerId,createdAt:at});const output=passingOutput(graph.job.contract);
    expect(validateMediaAuditOutput(graph.job.contract,output)).toEqual(output);
    const replaceFirst=(evidenceDigests:string[])=>({...output,findings:output.findings.map((finding,index)=>index===0?{...finding,evidenceDigests}:finding)});
    expect(()=>validateMediaAuditOutput(graph.job.contract,replaceFirst(['f'.repeat(64)]))).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
    const cross=compileMediaAuditRuntimeGraph({ownerId,revision:revision(parent('cross revision')),parentRevision:parent('cross revision'),sourceRun:sourceRun(),createdBy:ownerId,createdAt:at}).job.contract.authorityBinding!.artifactRevisionDigest;
    expect(()=>validateMediaAuditOutput(graph.job.contract,replaceFirst([cross]))).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
    const required=output.findings[0]!.evidenceDigests;
    expect(()=>validateMediaAuditOutput(graph.job.contract,replaceFirst([...required,required[0]!]))).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
    expect(()=>validateMediaAuditOutput(graph.job.contract,replaceFirst([]))).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
    const unknown={...output,findings:output.findings.map((finding,index)=>index===0?{...finding,checkCode:'UNKNOWN_CHECK'}:finding)} as unknown as MediaAuditOutputV4;
    expect(()=>validateMediaAuditOutput(graph.job.contract,unknown)).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
    const pixelClaim={...output,capabilityBoundary:{...output.capabilityBoundary,pixelInspectionPerformed:true}} as unknown as MediaAuditOutputV4;
    expect(()=>validateMediaAuditOutput(graph.job.contract,pixelClaim)).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_OUTPUT_INVALID'}));
  });
});

function passingOutput(contract:RuntimeTaskContract):MediaAuditOutputV4{const authority=contract.authorityBinding!;return {schemaVersion:4,taskId:contract.taskId,inputDigest:contract.inputDigest,artifactRevisionId:authority.artifactRevisionId,artifactRevisionDigest:authority.artifactRevisionDigest,mediaSetDigest:authority.mediaSetDigest,brandSnapshotDigest:authority.brandSnapshotDigest,knowledgeSnapshotDigest:authority.knowledgeSnapshotDigest,actualMediaDigests:authority.finalMedia.map((item)=>item.contentDigest),result:'PASS',capabilityBoundary:structuredClone(authority.machineFacts.capabilityBoundary),findings:MEDIA_AUDIT_CHECK_CODES.map((checkCode)=>({checkCode,result:'PASS',message:`${checkCode} exact binding passed`,evidenceDigests:[...authority.evidencePolicy.find((item)=>item.checkCode===checkCode)!.requiredEvidenceDigests],recoveryAction:null}))};}

function resealContract(contract:RuntimeTaskContract){const authorityBase={...contract.authorityBinding!};delete (authorityBase as {canonicalDigest?:string}).canonicalDigest;contract.authorityBinding!.canonicalDigest=sha256Digest(authorityBase);const contractBase={...contract};delete (contractBase as {canonicalDigest?:string}).canonicalDigest;contract.canonicalDigest=sha256Digest(contractBase);}

function sourceRun():MissionRun{return {schemaVersion:1,id:'source-run-exact-a5',ownerId,bundleId,bundleDigest,bundleKind:'MISSION_EXECUTION',generation:1,runtimeRequirement:{runtime:'agentteams',version:AGENTTEAMS_RUNTIME_VERSION,sourceCommit:AGENTTEAMS_SOURCE_COMMIT,sourceTarSha256:AGENTTEAMS_SOURCE_TAR_SHA256,license:AGENTTEAMS_LICENSE,imageDigests:AGENTTEAMS_IMAGE_DIGESTS,teamProfileVersion:AGENTTEAMS_TEAM_PROFILE_VERSION,teamProfileDigest:AGENTTEAMS_TEAM_PROFILE_DIGEST},state:'SUCCEEDED_RUNTIME',createdBy:ownerId,createdAt:at,startedAt:at,finishedAt:at,lastReconciledAt:at,errorCode:null,rowVersion:8};}

function parent(body='只陈述可验证事实。'):ArtifactRevisionV3{const base={schemaVersion:3 as const,id:`artifact-revision-v3-${sha256Digest(body).slice(0,12)}`,ownerId,activationUnitId:'activation-xhs-exact-a5',platformCode:'XIAOHONGSHU' as const,revision:3,parentRevisionId:null,producerRole:'product-account-producer' as const,producerIdentityId:'@product-account-producer:matrix.local',origin:'AGENT' as const,evidenceMaturity:'AGENTTEAMS_RUNTIME' as const,agentTeamsExecuted:true,artifactProfileRef:{id:'XHS_IMAGE_NOTE',version:'1.0.0' as const,digest:'2'.repeat(64),platformCode:'XIAOHONGSHU' as const,source:'test-profile',checkedAt:at,expiresAt:'2026-09-24T08:00:00.000Z'},payload:{kind:'XIAOHONGSHU' as const,title:'杭州 AI 品牌运营',body,topics:['AI','品牌运营'],cta:null,coverSpec:{purpose:'封面',aspectRatio:'3:4',visualBrief:'杭州城市光影',overlayCopy:'可审校的全球品牌运营'},imageSpecs:[{position:1,purpose:'封面',aspectRatio:'3:4',visualBrief:'杭州城市光影',overlayCopy:'可审校的全球品牌运营',altDescription:'杭州城市光影',authorizedMediaRef:null}],language:'zh-CN',accountProfileRevisionId:'account-xhs',sourceBindings:[]},inputBindings:{executionBundle:{id:bundleId,digest:bundleDigest,generation:1,missionIntentId:'mission-intent-exact-a5'},operatingGoal:{id:'goal-exact-a5',digest:'3'.repeat(64)},approvedPlan:{id:'plan-exact-a5',digest:'4'.repeat(64)},knowledgeSnapshot:{id:'knowledge-exact-a5',digest:'5'.repeat(64)},accountProfile:{id:'account-xhs',digest:'6'.repeat(64),platformCode:'XIAOHONGSHU' as const},producerSkill:{id:'xiaohongshu-content-expression' as const,version:'1.0.0' as const,digest:'a'.repeat(64),source:'skills/xiaohongshu-content-expression/SKILL.md' as const,sourceDigest:'b'.repeat(64),license:'Apache-2.0' as const},artifactProfile:{id:'XHS_IMAGE_NOTE',version:'1.0.0' as const,digest:'2'.repeat(64),platformCode:'XIAOHONGSHU' as const,source:'test-profile',checkedAt:at,expiresAt:'2026-09-24T08:00:00.000Z'},sourceSetDigest:'c'.repeat(64)},state:'AWAITING_AUDIT' as const,createdAt:at};return {...base,canonicalDigest:sha256Digest(base)};}
function mutatedParent(field:'body'|'visualBrief'|'overlayCopy'|'altDescription'){const value=structuredClone(parent());if(value.payload.kind!=='XIAOHONGSHU')throw new Error('expected XIAOHONGSHU fixture');const payload=value.payload;if(field==='body')payload.body='正文发生了一个字节变化。';else if(field==='visualBrief'){payload.coverSpec.visualBrief='不同视觉简报';payload.imageSpecs[0]!.visualBrief='不同视觉简报';}else if(field==='overlayCopy'){payload.coverSpec.overlayCopy='不同叠字';payload.imageSpecs[0]!.overlayCopy='不同叠字';}else payload.imageSpecs[0]!.altDescription='不同替代文本';value.id=`artifact-revision-v3-${field}`;const base={...value};delete (base as Partial<ArtifactRevisionV3>).canonicalDigest;return {...base,canonicalDigest:sha256Digest(base)} as ArtifactRevisionV3;}

function revision(parentRevision=parent()):ArtifactRevisionV4{const base={schemaVersion:4 as const,id:`media-revision-${sha256Digest(parentRevision.canonicalDigest).slice(0,12)}`,ownerId,platformCode:'XIAOHONGSHU' as const,revision:4,parentRevisionId:parentRevision.id,parentRevisionDigest:parentRevision.canonicalDigest,producerIdentityId:parentRevision.producerIdentityId,payloadDigest:sha256Digest(parentRevision.payload),mediaSetBinding:{schemaVersion:1 as const,profileRef:'xhs-delivery-profile',profileDigest:'d'.repeat(64),items:[{position:1,assetId:'final-a5-1',finalAssetDigest:'e'.repeat(64),contentDigest:'7'.repeat(64),blobRef:{algorithm:'sha256' as const,digest:'7'.repeat(64),size:128},mimeType:'image/png' as const,bytes:128,width:1080 as const,height:1440 as const,altText:'杭州城市光影',rawAssetDigest:'9'.repeat(64),generationSpecDigest:'a'.repeat(64),compositionSpecDigest:'b'.repeat(64),brandSnapshotDigest:'c'.repeat(64),knowledgeSnapshotDigest:'d'.repeat(64),templateDigest:mediaCompositionResourceSnapshot.templateDigest,rightsReceiptDigest:'e'.repeat(64),costReceiptDigest:'f'.repeat(64),fileName:'image-01.png'}],canonicalDigest:'1'.repeat(64)},brandSnapshot:{id:'brand-a5',digest:'c'.repeat(64),state:'APPROVED' as const,approvedAt:at,expiresAt:null},knowledgeSnapshot:{id:'knowledge-a5',digest:'d'.repeat(64),state:'APPROVED' as const,approvedAt:at,expiresAt:null},state:'AWAITING_AUDIT' as const,createdAt:at};return {...base,canonicalDigest:sha256Digest(base)};}
