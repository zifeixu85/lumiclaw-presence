import {afterEach,describe,expect,it,vi} from 'vitest';
import type {BlobStore} from '@lumiclaw/blob-store';
import {
  CONTROLLED_MEDIA_AUDITOR_IDENTITY_ID,
  MediaContractError,
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

    const recorded=await app.inject({method:'POST',url,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true}});
    expect(recorded.statusCode,recorded.body).toBe(201);expect(recorded.json()).toMatchObject({code:'CONTROLLED_MEDIA_AUDIT_FIXTURE_RECORDED',controlledFixture:true,serverOwnedOutcome:true,evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,authoritativeForOperations:false,nextState:'WAITING_FOR_SDD_007_ACCEPTED_AUDITOR_RECEIPT',audit:{auditorIdentityId:CONTROLLED_MEDIA_AUDITOR_IDENTITY_ID,auditorRole:'A5_INDEPENDENT_AUDITOR',result:'ESCALATE',evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,authoritativeForOperations:false,runtimeReceiptBinding:null}});
  });

  it('allows only an exact request body and rejects every caller-owned outcome or receipt field',async()=>{
    const fixture=mediaFixture();const app=buildApi({mediaArtifactRepository:fixture.repository,mediaSnapshotProbe:async()=>({brandSnapshot:fixture.revision.brandSnapshot,knowledgeSnapshot:fixture.revision.knowledgeSnapshot}),now:()=>new Date('2026-08-24T08:00:00.000Z')});apps.push(app);await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Media audit request owner'}});const url=`/api/v1/media-revisions/${fixture.revision.id}/audit-requests`;const base={revisionDigest:fixture.revision.canonicalDigest};
    for(const extra of [{auditorIdentityId:'browser-a5'},{result:'PASS'},{runtimeReceipt:{outputDigest:'f'.repeat(64)}},{authoritativeForOperations:true}]){const response=await app.inject({method:'POST',url,payload:{...base,...extra}});expect(response.statusCode,response.body).toBe(422);expect(response.json().code).toBe('MEDIA_JOB_STATE_INVALID');}
    const accepted=await app.inject({method:'POST',url,headers:{'if-match':`"media-revision-${fixture.revision.canonicalDigest}"`,'idempotency-key':'media-audit-request-api-1'},payload:base});expect(accepted.statusCode,accepted.body).toBe(202);expect(accepted.json()).toMatchObject({code:'MEDIA_A5_AUDIT_REQUEST_QUEUED',state:'WAITING_A5',externalActionCount:0,callerSuppliedAuthorityAccepted:false});expect(fixture.requestCalls).toHaveLength(1);
  });

  it('fails closed when a controlled PASS tries to unlock Owner approval or a publish package',async()=>{
    const fixture=mediaFixture();const app=buildApi({mediaArtifactRepository:fixture.repository,mediaSnapshotProbe:async()=>({brandSnapshot:fixture.revision.brandSnapshot,knowledgeSnapshot:fixture.revision.knowledgeSnapshot}),now:()=>new Date('2026-08-24T08:00:00.000Z')});apps.push(app);
    await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Media audit authority owner'}});
    const auditResponse=await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/audits`,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true}});const audit=auditResponse.json().audit as MediaAuditDecisionV4;

    const auditEtag=`"media-audit-${fixture.revision.canonicalDigest}-${audit.canonicalDigest}"`;const approve=await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/owner-decisions`,headers:{'if-match':auditEtag,'idempotency-key':'controlled-cannot-approve'},payload:{revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:audit.id,auditDecisionDigest:audit.canonicalDigest,visualReviewId:null,visualReviewDigest:null,result:'APPROVE'}});
    expect(approve.statusCode,approve.body).toBe(422);expect(approve.json()).toMatchObject({code:'MEDIA_AUDIT_PASS_REQUIRED'});
    const pack=await app.inject({method:'POST',url:'/api/v1/media-publish-packages',payload:{revisionId:fixture.revision.id,revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:audit.id,auditDecisionDigest:audit.canonicalDigest,ownerDecisionId:'forged-owner-decision',ownerDecisionDigest:'e'.repeat(64)}});
    expect(pack.statusCode,pack.body).toBe(422);expect(pack.json()).toMatchObject({code:'MEDIA_AUDIT_RUNTIME_AUTHORITY_REQUIRED'});
    expect(fixture.workspace.ownerDecisions).toHaveLength(0);expect(fixture.workspace.packages).toHaveLength(0);
  });

  it('requires closed visual/decision/package mutations with exact ETag and idempotency headers',async()=>{
    const fixture=mediaFixture();const app=buildApi({mediaArtifactRepository:fixture.repository,mediaSnapshotProbe:async()=>({brandSnapshot:fixture.revision.brandSnapshot,knowledgeSnapshot:fixture.revision.knowledgeSnapshot}),now:()=>new Date('2026-08-24T08:00:00.000Z')});apps.push(app);
    await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Exact mutation owner'}});
    const audit=(await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/audits`,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true}})).json().audit as MediaAuditDecisionV4;
    const visualUrl=`/api/v1/media-revisions/${fixture.revision.id}/visual-reviews`;const visualBody={revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:audit.id,auditDecisionDigest:audit.canonicalDigest,result:'REJECTED',checklist:{visualQualityConfirmed:false,hiddenContentChecked:false,renderedTextOcrChecked:false,pixelTextMediaSemanticsConfirmed:false},reviewedMediaDigests:fixture.revision.mediaSetBinding.items.map((item)=>item.contentDigest)};
    const visualExtra=await app.inject({method:'POST',url:visualUrl,headers:{'if-match':`"media-audit-${fixture.revision.canonicalDigest}-${audit.canonicalDigest}"`,'idempotency-key':'visual-closed-body'},payload:{...visualBody,ownerIdentity:'caller-owned'}});expect(visualExtra.statusCode,visualExtra.body).toBe(422);expect(visualExtra.json().code).toBe('MEDIA_JOB_STATE_INVALID');
    const visualShort=await app.inject({method:'POST',url:visualUrl,headers:{'if-match':`"media-audit-${fixture.revision.canonicalDigest}-${audit.canonicalDigest}"`,'idempotency-key':'short'},payload:visualBody});expect(visualShort.statusCode,visualShort.body).toBe(428);expect(visualShort.json().code).toBe('MEDIA_IDEMPOTENCY_KEY_REQUIRED');
    const visualMissingEtag=await app.inject({method:'POST',url:visualUrl,headers:{'idempotency-key':'visual-missing-etag'},payload:visualBody});expect(visualMissingEtag.statusCode,visualMissingEtag.body).toBe(428);expect(visualMissingEtag.json().code).toBe('MEDIA_ETAG_REQUIRED');
    const visualWrongEtag=await app.inject({method:'POST',url:visualUrl,headers:{'if-match':'"wrong"','idempotency-key':'visual-wrong-etag'},payload:visualBody});expect(visualWrongEtag.statusCode,visualWrongEtag.body).toBe(412);expect(visualWrongEtag.json().code).toBe('MEDIA_INPUT_CHANGED');

    const decisionUrl=`/api/v1/media-revisions/${fixture.revision.id}/owner-decisions`;const decisionBody={revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:audit.id,auditDecisionDigest:audit.canonicalDigest,visualReviewId:null,visualReviewDigest:null,result:'REJECT'};
    const decisionExtra=await app.inject({method:'POST',url:decisionUrl,headers:{'if-match':`"media-audit-${fixture.revision.canonicalDigest}-${audit.canonicalDigest}"`,'idempotency-key':'decision-closed-body'},payload:{...decisionBody,createdAt:'caller-owned'}});expect(decisionExtra.statusCode,decisionExtra.body).toBe(422);expect(decisionExtra.json().code).toBe('MEDIA_JOB_STATE_INVALID');
    const decisionMissing=await app.inject({method:'POST',url:decisionUrl,payload:decisionBody});expect(decisionMissing.statusCode,decisionMissing.body).toBe(428);expect(decisionMissing.json().code).toBe('MEDIA_IDEMPOTENCY_KEY_REQUIRED');
    const decisionWrong=await app.inject({method:'POST',url:decisionUrl,headers:{'if-match':'"wrong"','idempotency-key':'decision-wrong-etag'},payload:decisionBody});expect(decisionWrong.statusCode,decisionWrong.body).toBe(412);expect(decisionWrong.json().code).toBe('MEDIA_INPUT_CHANGED');

    const runtimeAudit={...audit,id:'runtime-audit-header-fixture',result:'PASS',evidenceMaturity:'AGENTTEAMS_RUNTIME',agentTeamsExecuted:true,authoritativeForOperations:true,runtimeReceiptBinding:{evidenceMaturity:'AGENTTEAMS_RUNTIME',agentTeamsExecuted:true,controlledProvider:false,authoritativeForOperations:true},canonicalDigest:'a'.repeat(64)} as unknown as MediaAuditDecisionV4;fixture.workspace.audits.push(runtimeAudit);const decision={id:'decision-header-fixture',canonicalDigest:'b'.repeat(64)};fixture.workspace.ownerDecisions.push(decision as never);const packageBody={revisionId:fixture.revision.id,revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:runtimeAudit.id,auditDecisionDigest:runtimeAudit.canonicalDigest,ownerDecisionId:decision.id,ownerDecisionDigest:decision.canonicalDigest};
    const packageExtra=await app.inject({method:'POST',url:'/api/v1/media-publish-packages',headers:{'if-match':`"media-owner-decision-${decision.canonicalDigest}"`,'idempotency-key':'package-closed-body'},payload:{...packageBody,runtimeReceipt:'caller-owned'}});expect(packageExtra.statusCode,packageExtra.body).toBe(422);expect(packageExtra.json().code).toBe('MEDIA_JOB_STATE_INVALID');
    const packageMissing=await app.inject({method:'POST',url:'/api/v1/media-publish-packages',payload:packageBody});expect(packageMissing.statusCode,packageMissing.body).toBe(428);expect(packageMissing.json().code).toBe('MEDIA_IDEMPOTENCY_KEY_REQUIRED');
    const packageWrong=await app.inject({method:'POST',url:'/api/v1/media-publish-packages',headers:{'if-match':'"wrong"','idempotency-key':'package-wrong-etag'},payload:packageBody});expect(packageWrong.statusCode,packageWrong.body).toBe(412);expect(packageWrong.json().code).toBe('MEDIA_INPUT_CHANGED');
  });

  it('returns durable 201/200 visual review semantics with exact canonical checklist authority',async()=>{
    const fixture=mediaFixture();let stored:unknown;const appendOwnerVisualReview=vi.fn(async(_ownerId:string,review:unknown)=>{if(stored!==undefined)return {review:stored,replayed:true};stored=review;return {review,replayed:false};});Object.assign(fixture.repository,{appendOwnerVisualReview});
    const app=buildApi({mediaArtifactRepository:fixture.repository,mediaSnapshotProbe:async()=>({brandSnapshot:fixture.revision.brandSnapshot,knowledgeSnapshot:fixture.revision.knowledgeSnapshot}),now:()=>new Date('2026-08-24T08:00:00.000Z')});apps.push(app);await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Visual replay owner'}});
    const controlled=(await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/audits`,payload:{revisionDigest:fixture.revision.canonicalDigest,controlledFixture:true}})).json().audit as MediaAuditDecisionV4;const runtimeAudit={...controlled,id:'runtime-audit-visual-api',result:'PASS',evidenceMaturity:'AGENTTEAMS_RUNTIME',agentTeamsExecuted:true,authoritativeForOperations:true,runtimeReceiptBinding:{evidenceMaturity:'AGENTTEAMS_RUNTIME',agentTeamsExecuted:true,controlledProvider:false,authoritativeForOperations:true},canonicalDigest:'c'.repeat(64)} as unknown as MediaAuditDecisionV4;fixture.workspace.audits.push(runtimeAudit);
    const checklist={visualQualityConfirmed:true,hiddenContentChecked:true,renderedTextOcrChecked:true,pixelTextMediaSemanticsConfirmed:true};const payload={revisionDigest:fixture.revision.canonicalDigest,auditDecisionId:runtimeAudit.id,auditDecisionDigest:runtimeAudit.canonicalDigest,result:'CONFIRMED',checklist,reviewedMediaDigests:fixture.revision.mediaSetBinding.items.map((item)=>item.contentDigest)};const headers={'if-match':`"media-audit-${fixture.revision.canonicalDigest}-${runtimeAudit.canonicalDigest}"`,'idempotency-key':'visual-api-restart-replay'};
    const created=await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/visual-reviews`,headers,payload});expect(created.statusCode,created.body).toBe(201);expect(created.headers['idempotency-replayed']).toBe('false');expect(created.headers.etag).toBe(`"media-visual-review-${created.json().review.canonicalDigest}"`);expect(created.json().review).toMatchObject({result:'CONFIRMED',checklist,reviewedMediaDigests:payload.reviewedMediaDigests});
    const replayed=await app.inject({method:'POST',url:`/api/v1/media-revisions/${fixture.revision.id}/visual-reviews`,headers,payload});expect(replayed.statusCode,replayed.body).toBe(200);expect(replayed.headers['idempotency-replayed']).toBe('true');expect(replayed.json().review).toEqual(created.json().review);expect(appendOwnerVisualReview).toHaveBeenCalledTimes(2);
  });

  it('replays PostgreSQL receipt and package-file authority before every package download',async()=>{
    const fixture=mediaFixture();const verifyPackage=vi.fn(async()=>{throw new MediaContractError('MEDIA_AUDIT_RUNTIME_RECEIPT_INVALID');});Object.assign(fixture.repository,{verifyPackage});const blobs={put:vi.fn(),get:vi.fn(),has:vi.fn(),delete:vi.fn()} as unknown as BlobStore;const app=buildApi({mediaArtifactRepository:fixture.repository,mediaBlobStore:blobs,now:()=>new Date('2026-08-24T08:00:00.000Z')});apps.push(app);await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Media package authority owner'}});
    const response=await app.inject({method:'GET',url:'/api/v1/media-publish-packages/package-runtime-authority/download'});expect(response.statusCode,response.body).toBe(422);expect(response.json().code).toBe('MEDIA_AUDIT_RUNTIME_RECEIPT_INVALID');expect(verifyPackage).toHaveBeenCalledOnce();expect(blobs.get).not.toHaveBeenCalled();
  });
});

function mediaFixture(){
  const brand={id:'brand-authority',digest:'1'.repeat(64),state:'APPROVED' as const,approvedAt:'2026-08-24T07:00:00.000Z',expiresAt:null};const knowledge={id:'018f0000-0000-7000-8000-000000000071',digest:'2'.repeat(64),state:'APPROVED' as const,approvedAt:'2026-08-24T07:00:00.000Z',expiresAt:null};
  const revision={schemaVersion:4,id:'media-revision-v4-authority',ownerId:'owner-filled-by-route',platformCode:'XIAOHONGSHU',revision:4,parentRevisionId:'artifact-v3',parentRevisionDigest:'3'.repeat(64),producerIdentityId:'controlled-product-account-producer',payloadDigest:'4'.repeat(64),mediaSetBinding:{schemaVersion:1,profileRef:'profile',profileDigest:'5'.repeat(64),items:[{position:1,assetId:'final-asset-1',finalAssetDigest:'6'.repeat(64),contentDigest:'7'.repeat(64),blobRef:{algorithm:'sha256',digest:'7'.repeat(64),size:100},mimeType:'image/png',bytes:100,width:1080,height:1440,altText:'受控 final',rawAssetDigest:'8'.repeat(64),generationSpecDigest:'9'.repeat(64),compositionSpecDigest:'a'.repeat(64),brandSnapshotDigest:brand.digest,knowledgeSnapshotDigest:knowledge.digest,templateDigest:mediaCompositionResourceSnapshot.templateDigest,rightsReceiptDigest:'b'.repeat(64),costReceiptDigest:'c'.repeat(64),fileName:'image-01.png'}],canonicalDigest:'d'.repeat(64)},brandSnapshot:brand,knowledgeSnapshot:knowledge,state:'AWAITING_AUDIT',createdAt:'2026-08-24T07:30:00.000Z',canonicalDigest:'e'.repeat(64)} satisfies ArtifactRevisionV4;
  const workspace={specs:[],jobs:[],taskReceipts:[],costReceipts:[],rightsReceipts:[],rawAssets:[],compositionSpecs:[],finalAssets:[{id:'final-asset-1',canonicalDigest:'6'.repeat(64),compositionSpec:{templateDigest:mediaCompositionResourceSnapshot.templateDigest,typographyProfileDigest:mediaCompositionResourceSnapshot.typographyProfileDigest,compositorProfileDigest:mediaCompositionResourceSnapshot.compositorProfileDigest,outputProfileDigest:mediaCompositionResourceSnapshot.outputProfileDigest}}],revisions:[revision],auditRequests:[],runtimeAuditReceipts:[],audits:[],visualReviews:[],ownerDecisions:[],packages:[],invalidations:[],staging:[]} as unknown as MediaWorkspace;
  const requestCalls:Array<{ownerId:string;revisionId:string;revisionDigest:string;idempotencyKey:string}>=[];const repository={getWorkspace:async()=>workspace,resolveApprovedGovernance:async()=>({brandSnapshot:brand,knowledgeSnapshot:knowledge}),requestRuntimeAudit:async(ownerId:string,revisionId:string,revisionDigest:string,idempotencyKey:string)=>{requestCalls.push({ownerId,revisionId,revisionDigest,idempotencyKey});return {request:{id:'request-api-fixture',artifactRevisionId:revisionId,artifactRevisionDigest:revisionDigest},replayed:false};},appendAudit:async(_ownerId:string,audit:MediaAuditDecisionV4)=>{workspace.audits.push(audit);return audit;},appendOwnerDecision:async()=>{throw new Error('must remain blocked');},appendPackage:async()=>{throw new Error('must remain blocked');},appendInvalidation:async(_ownerId:string,value:never)=>value,close:async()=>undefined} as unknown as MediaArtifactRepository;
  return {revision,workspace,repository,requestCalls};
}
