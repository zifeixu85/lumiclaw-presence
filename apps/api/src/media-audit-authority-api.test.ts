import {afterEach,describe,expect,it} from 'vitest';
import {
  CONTROLLED_MEDIA_AUDITOR_IDENTITY_ID,
  mediaCompositionResourceSnapshot,
  type ArtifactRevisionV4,
  type MediaArtifactRepository,
  type MediaAuditDecisionV4,
  type MediaWorkspace
} from '@lumiclaw/domain';
import {buildApi} from './server.js';

const apps:ReturnType<typeof buildApi>[]=[];
afterEach(async()=>Promise.all(apps.splice(0).map((app)=>app.close())));

describe('SDD-012 v4 media audit authority API',()=>{
  it('uses a closed controlled-fixture schema and never accepts browser-owned Auditor authority',async()=>{
    const fixture=mediaFixture();const app=buildApi({mediaArtifactRepository:fixture.repository,mediaSnapshotProbe:async()=>({brandSnapshot:fixture.revision.brandSnapshot,knowledgeSnapshot:fixture.revision.knowledgeSnapshot}),now:()=>new Date('2026-08-24T08:00:00.000Z')});apps.push(app);
    await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Media audit authority owner'}});
    const url=`/api/v1/media-revisions/${fixture.revision.id}/audits`;

    const arbitrary=await app.inject({method:'POST',url,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true,auditorIdentityId:'browser-chosen-auditor',result:'PASS'}});
    expect(arbitrary.statusCode,arbitrary.body).toBe(422);expect(arbitrary.json().code).toBe('MEDIA_JOB_STATE_INVALID');
    const missingMarker=await app.inject({method:'POST',url,payload:{revisionDigest:fixture.revision.canonicalDigest,result:'PASS'}});
    expect(missingMarker.statusCode,missingMarker.body).toBe(422);expect(missingMarker.json().code).toBe('MEDIA_JOB_STATE_INVALID');
    const fakeRuntime=await app.inject({method:'POST',url,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true,result:'PASS',runtimeReceipt:{taskId:'forged-a5-task',outputDigest:'f'.repeat(64)}}});
    expect(fakeRuntime.statusCode,fakeRuntime.body).toBe(422);expect(fakeRuntime.json().code).toBe('MEDIA_JOB_STATE_INVALID');

    const recorded=await app.inject({method:'POST',url,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true,result:'PASS'}});
    expect(recorded.statusCode,recorded.body).toBe(201);expect(recorded.json()).toMatchObject({code:'CONTROLLED_MEDIA_AUDIT_FIXTURE_RECORDED',controlledFixture:true,evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,authoritativeForOperations:false,nextState:'WAITING_FOR_SDD_007_ACCEPTED_AUDITOR_RECEIPT',audit:{auditorIdentityId:CONTROLLED_MEDIA_AUDITOR_IDENTITY_ID,auditorRole:'A5_INDEPENDENT_AUDITOR',evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,authoritativeForOperations:false,runtimeReceiptBinding:null}});
  });

  it('fails closed when a controlled PASS tries to unlock Owner approval or a publish package',async()=>{
    const fixture=mediaFixture();const app=buildApi({mediaArtifactRepository:fixture.repository,mediaSnapshotProbe:async()=>({brandSnapshot:fixture.revision.brandSnapshot,knowledgeSnapshot:fixture.revision.knowledgeSnapshot}),now:()=>new Date('2026-08-24T08:00:00.000Z')});apps.push(app);
    await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Media audit authority owner'}});
    const auditResponse=await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/audits`,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true,result:'PASS'}});const audit=auditResponse.json().audit as MediaAuditDecisionV4;

    const approve=await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/owner-decisions`,payload:{revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:audit.id,auditDecisionDigest:audit.canonicalDigest,result:'APPROVE'}});
    expect(approve.statusCode,approve.body).toBe(422);expect(approve.json()).toMatchObject({code:'MEDIA_AUDIT_RUNTIME_AUTHORITY_REQUIRED'});
    const pack=await app.inject({method:'POST',url:'/api/v1/media-publish-packages',payload:{revisionId:fixture.revision.id,revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:audit.id,auditDecisionDigest:audit.canonicalDigest,ownerDecisionId:'forged-owner-decision',ownerDecisionDigest:'e'.repeat(64)}});
    expect(pack.statusCode,pack.body).toBe(422);expect(pack.json()).toMatchObject({code:'MEDIA_AUDIT_RUNTIME_AUTHORITY_REQUIRED'});
    expect(fixture.workspace.ownerDecisions).toHaveLength(0);expect(fixture.workspace.packages).toHaveLength(0);
  });
});

function mediaFixture(){
  const brand={id:'brand-authority',digest:'1'.repeat(64),state:'APPROVED' as const,approvedAt:'2026-08-24T07:00:00.000Z',expiresAt:null};const knowledge={id:'018f0000-0000-7000-8000-000000000071',digest:'2'.repeat(64),state:'APPROVED' as const,approvedAt:'2026-08-24T07:00:00.000Z',expiresAt:null};
  const revision={schemaVersion:4,id:'media-revision-v4-authority',ownerId:'owner-filled-by-route',platformCode:'XIAOHONGSHU',revision:4,parentRevisionId:'artifact-v3',parentRevisionDigest:'3'.repeat(64),producerIdentityId:'controlled-product-account-producer',payloadDigest:'4'.repeat(64),mediaSetBinding:{schemaVersion:1,profileRef:'profile',profileDigest:'5'.repeat(64),items:[{position:1,assetId:'final-asset-1',finalAssetDigest:'6'.repeat(64),contentDigest:'7'.repeat(64),blobRef:{algorithm:'sha256',digest:'7'.repeat(64),size:100},mimeType:'image/png',bytes:100,width:1080,height:1440,altText:'受控 final',rawAssetDigest:'8'.repeat(64),generationSpecDigest:'9'.repeat(64),compositionSpecDigest:'a'.repeat(64),brandSnapshotDigest:brand.digest,knowledgeSnapshotDigest:knowledge.digest,templateDigest:mediaCompositionResourceSnapshot.templateDigest,rightsReceiptDigest:'b'.repeat(64),costReceiptDigest:'c'.repeat(64),fileName:'image-01.png'}],canonicalDigest:'d'.repeat(64)},brandSnapshot:brand,knowledgeSnapshot:knowledge,state:'AWAITING_AUDIT',createdAt:'2026-08-24T07:30:00.000Z',canonicalDigest:'e'.repeat(64)} satisfies ArtifactRevisionV4;
  const workspace={specs:[],jobs:[],taskReceipts:[],costReceipts:[],rightsReceipts:[],rawAssets:[],compositionSpecs:[],finalAssets:[{id:'final-asset-1',canonicalDigest:'6'.repeat(64),compositionSpec:{templateDigest:mediaCompositionResourceSnapshot.templateDigest,typographyProfileDigest:mediaCompositionResourceSnapshot.typographyProfileDigest,compositorProfileDigest:mediaCompositionResourceSnapshot.compositorProfileDigest,outputProfileDigest:mediaCompositionResourceSnapshot.outputProfileDigest}}],revisions:[revision],audits:[],ownerDecisions:[],packages:[],invalidations:[],staging:[]} as unknown as MediaWorkspace;
  const repository={getWorkspace:async()=>workspace,resolveApprovedGovernance:async()=>({brandSnapshot:brand,knowledgeSnapshot:knowledge}),appendAudit:async(_ownerId:string,audit:MediaAuditDecisionV4)=>{workspace.audits.push(audit);return audit;},appendOwnerDecision:async()=>{throw new Error('must remain blocked');},appendPackage:async()=>{throw new Error('must remain blocked');},appendInvalidation:async(_ownerId:string,value:never)=>value,close:async()=>undefined} as unknown as MediaArtifactRepository;
  return {revision,workspace,repository};
}
