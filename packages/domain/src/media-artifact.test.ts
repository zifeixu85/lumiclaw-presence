import {describe, expect, it} from 'vitest';
import {
  MEDIA_CONTRACT_VERSION,
  CONTROLLED_MEDIA_AUDITOR_IDENTITY_ID,
  MediaContractError,
  createMediaGenerationSpec,
  createMediaGenerationJob,
  recordProviderSubmissionIntent,
  applyProviderSubmissionOutcome,
  createCompositionSpec,
  createRawProviderAsset,
  createCompositedAsset,
  createMediaSetBinding,
  materializeXhsMediaRevision,
  createMediaAuditDecision,
  createMediaOwnerDecision,
  createManualPublishPackageV4,
  invalidateMediaGovernance,
  issueMediaSecretTicket,
  assertMediaSecretTicket,
  MediaSecretTicketUseGuard,
  xhsDeliveryProfile,
  type ArtifactRevisionV4,
  type BrandSnapshotBinding,
  type CompositedMediaAssetV2,
  type KnowledgeSnapshotBinding,
  type MediaGenerationSpec,
  type RawProviderMediaAssetV2
} from './media-artifact.js';
import {sha256Digest} from './canonical.js';

const now = '2026-08-24T04:00:00.000Z';
const ownerId = '00000000-0000-4000-8000-000000000001';
const sourceRevisionDigest = 'a'.repeat(64);
const brand: BrandSnapshotBinding = {id:'brand-snapshot-1',digest:'b'.repeat(64),state:'APPROVED',approvedAt:now,expiresAt:'2026-09-24T04:00:00.000Z'};
const knowledge: KnowledgeSnapshotBinding = {id:'knowledge-snapshot-1',digest:'c'.repeat(64),state:'APPROVED',approvedAt:now,expiresAt:null};

function spec(position=1, overlayCopy:string|null='让全球品牌运营可审校') {
  return createMediaGenerationSpec({
    ownerId, artifactRevisionId:'xhs-revision-v3', artifactRevisionDigest:sourceRevisionDigest,
    imageSpecPosition:position, promptTextPrivateRef:`private://prompt/${position}`,
    promptText:'无文字、无标识的暖色编辑部风格抽象背景，不出现任何中文或英文标题。',
    altText:`第 ${position} 张暖色抽象品牌背景`, overlayCopy, createdAt:now
  });
}

function raw(value:MediaGenerationSpec=spec()):RawProviderMediaAssetV2 {
  const bytes=Buffer.from(`raw-${value.imageSpecPosition}`);
  return createRawProviderAsset({
    ownerId, jobId:`job-${value.imageSpecPosition}`, generationSpec:value, contentDigest:sha256Digest(bytes),
    blobRef:{algorithm:'sha256',digest:sha256Digest(bytes),size:bytes.byteLength}, bytes:bytes.byteLength,
    mimeType:'image/png',width:1080,height:1440,fileName:`raw-${value.imageSpecPosition}.png`,
    providerTaskRef:`provider-task-${value.imageSpecPosition}`,providerAdapterSnapshotDigest:'d'.repeat(64),
    costReceiptDigest:'e'.repeat(64),rightsReceiptDigest:'f'.repeat(64),maturity:'CONTROLLED_FAKE',
    submittedAt:now,completedAt:now,downloadedAt:now,verifiedAt:now,resultExpiresAt:null,metadataState:'CLEAN'
  });
}

function finalAsset(value:MediaGenerationSpec=spec()):CompositedMediaAssetV2 {
  const rawAsset=raw(value); const composition=createCompositionSpec({
    ownerId,rawAsset,overlayCopy:value.overlayCopy,brandSnapshot:brand,knowledgeSnapshot:knowledge,
    ownerNoOverlayDecision:value.overlayCopy===null?{decisionId:`no-overlay-${value.imageSpecPosition}`,ownerId,decidedAt:now,specDigest:value.canonicalDigest}:null,
    createdAt:now
  });
  const bytes=Buffer.from(`final-${value.imageSpecPosition}`);
  return createCompositedAsset({ownerId,rawAsset,compositionSpec:composition,contentDigest:sha256Digest(bytes),
    blobRef:{algorithm:'sha256',digest:sha256Digest(bytes),size:bytes.byteLength},bytes:bytes.byteLength,mimeType:'image/png',width:1080,height:1440,
    fileName:`image-${String(value.imageSpecPosition).padStart(2,'0')}.png`,verifiedAt:now,metadataStripped:true,contrastRatio:7.2,fontSizePx:72,lineCount:1});
}

describe('SDD-012 provider-neutral media contracts',()=>{
  it('pins the exact XHS delivery profile without a provider brand in core semantics',()=>{
    expect(MEDIA_CONTRACT_VERSION).toBe('lumiclaw.media-artifact.v2');
    expect(xhsDeliveryProfile).toMatchObject({width:1080,height:1440,aspectRatio:'3:4',maxBytes:10*1024*1024,coverPosition:1,safeArea:{left:96,right:96,top:120,bottom:120}});
    expect(JSON.stringify(xhsDeliveryProfile).toLowerCase()).not.toContain('evolink');
  });

  it('rejects secret-shaped prompts, empty alt text, wrong dimensions and non-contiguous media sets',()=>{
    expect(()=>createMediaGenerationSpec({...spec(),promptText:'Authorization: Bearer sk-secret',createdAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_PROMPT_SECRET_DETECTED'}));
    expect(()=>createMediaGenerationSpec({ownerId,artifactRevisionId:'xhs-revision-v3',artifactRevisionDigest:sourceRevisionDigest,imageSpecPosition:1,promptTextPrivateRef:'private://prompt/1',promptText:'无文字的抽象背景',altText:'  ',overlayCopy:'标题',createdAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_ALT_TEXT_REQUIRED'}));
    const first=finalAsset(spec(1)); const third=finalAsset(spec(3));
    expect(()=>createMediaSetBinding({items:[first,third],sourceImageSpecs:[spec(1),spec(3)]})).toThrowError(expect.objectContaining({code:'MEDIA_SET_INCOMPLETE'}));
  });

  it('persists submission intent before the billable call and fails closed on unknown create outcome',()=>{
    const generationSpec=spec();
    const job=createMediaGenerationJob({ownerId,generationSpec,generation:1,providerAdapterRef:'adapter://media/first',createdAt:now});
    const submitting=recordProviderSubmissionIntent(job,{leaseOwner:'worker-a',leaseTokenHash:'1'.repeat(64),leaseExpiresAt:'2026-08-24T04:02:00.000Z',recordedAt:now});
    expect(submitting.state).toBe('SUBMITTING');
    const unknown=applyProviderSubmissionOutcome(submitting,{kind:'UNKNOWN',stableCode:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE',observedAt:now});
    expect(unknown.state).toBe('UNKNOWN_CHARGE_STATE');
    expect(()=>recordProviderSubmissionIntent(unknown,{leaseOwner:'worker-b',leaseTokenHash:'2'.repeat(64),leaseExpiresAt:'2026-08-24T04:03:00.000Z',recordedAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE'}));
  });

  it('binds media tickets to issuer, signature, current fingerprint, time and one-shot authority',async()=>{
    const authority={issuer:'media-broker-test-v1',signingKey:'test-only-media-ticket-signing-key-32-bytes',currentSecretFingerprint:'abc12345'};const media=issueMediaSecretTicket({...authority,purpose:'MEDIA_PROVIDER',scope:'media:submit',secretFingerprint:authority.currentSecretFingerprint,nonce:'n-media',issuedAt:now,expiresAt:'2026-08-24T04:01:00.000Z'});
    expect(()=>assertMediaSecretTicket(media,{...authority,purpose:'MODEL_PROVIDER',scope:'model:invoke',now})).toThrowError(expect.objectContaining({code:'SECRET_TICKET_PURPOSE_MISMATCH'}));
    expect(assertMediaSecretTicket(media,{...authority,purpose:'MEDIA_PROVIDER',scope:'media:submit',now}).purpose).toBe('MEDIA_PROVIDER');
    const guard=new MediaSecretTicketUseGuard(authority);expect(await guard.consume(media,{purpose:'MEDIA_PROVIDER',scope:'media:submit',now})).toBe(media);
    await expect(guard.consume(media,{purpose:'MEDIA_PROVIDER',scope:'media:submit',now})).rejects.toMatchObject({code:'SECRET_TICKET_REPLAYED'});
    expect(()=>assertMediaSecretTicket({...media,canonicalDigest:'0'.repeat(64)},{...authority,purpose:'MEDIA_PROVIDER',scope:'media:submit',now})).toThrowError(expect.objectContaining({code:'SECRET_TICKET_AUTHORITY_INVALID'}));
    expect(()=>assertMediaSecretTicket(media,{...authority,currentSecretFingerprint:'changed-fingerprint',purpose:'MEDIA_PROVIDER',scope:'media:submit',now})).toThrowError(expect.objectContaining({code:'SECRET_TICKET_AUTHORITY_INVALID'}));
    const future=issueMediaSecretTicket({...authority,purpose:'MEDIA_PROVIDER',scope:'media:submit',secretFingerprint:authority.currentSecretFingerprint,nonce:'future',issuedAt:'2026-08-24T04:00:10.001Z',expiresAt:'2026-08-24T04:00:50.000Z'});expect(()=>assertMediaSecretTicket(future,{...authority,purpose:'MEDIA_PROVIDER',scope:'media:submit',now})).toThrowError(expect.objectContaining({code:'SECRET_TICKET_AUTHORITY_INVALID'}));
    expect(()=>assertMediaSecretTicket(media,{...authority,purpose:'MEDIA_PROVIDER',scope:'media:submit',now:'2026-08-24T04:02:00.000Z'})).toThrowError(expect.objectContaining({code:'SECRET_TICKET_EXPIRED'}));
  });
});

describe('SDD-012 exact composition, governance and binary package',()=>{
  it('requires an exact Owner NO_OVERLAY decision and still creates separate raw/final lineage',()=>{
    const generationSpec=spec(1,null);const rawAsset=raw(generationSpec);
    expect(()=>createCompositionSpec({ownerId,rawAsset,overlayCopy:null,brandSnapshot:brand,knowledgeSnapshot:knowledge,ownerNoOverlayDecision:null,createdAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_NO_OVERLAY_OWNER_DECISION_REQUIRED'}));
    const final=finalAsset(generationSpec);
    expect(final.compositionSpec.mode).toBe('NO_OVERLAY');
    expect(final.assetRole).toBe('DELIVERY_COMPOSITE');
    expect(final.id).not.toBe(rawAsset.id);
  });

  it('materializes only a complete ordered final set as a child v4 revision',()=>{
    const specs=[spec(1),spec(2)];const finals=specs.map(finalAsset);const binding=createMediaSetBinding({items:finals,sourceImageSpecs:specs});
    const revision=materializeXhsMediaRevision({ownerId,sourceRevision:{id:'xhs-revision-v3',canonicalDigest:sourceRevisionDigest,revision:2,producerIdentityId:'product-producer',payloadDigest:'9'.repeat(64)},mediaSetBinding:binding,brandSnapshot:brand,knowledgeSnapshot:knowledge,createdAt:now});
    expect(revision.schemaVersion).toBe(4);expect(revision.revision).toBe(3);expect(revision.parentRevisionId).toBe('xhs-revision-v3');expect(revision.mediaSetBinding.items[0]?.position).toBe(1);
    expect(revision.canonicalDigest).not.toBe(sourceRevisionDigest);
  });

  it('records only an explicit controlled A5 fixture and never promotes it to operational approval or packaging',()=>{
    const specs=[spec(1),spec(2)];const revision=materializeXhsMediaRevision({ownerId,sourceRevision:{id:'xhs-revision-v3',canonicalDigest:sourceRevisionDigest,revision:2,producerIdentityId:'product-producer',payloadDigest:'9'.repeat(64)},mediaSetBinding:createMediaSetBinding({items:specs.map(finalAsset),sourceImageSpecs:specs}),brandSnapshot:brand,knowledgeSnapshot:knowledge,createdAt:now});
    expect(()=>createMediaAuditDecision({ownerId,revision,controlledFixture:false as true,result:'PASS',createdAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_RUNTIME_AUTHORITY_REQUIRED'}));
    const fail=createMediaAuditDecision({ownerId,revision,controlledFixture:true,result:'FAIL',createdAt:now});
    expect(fail).toMatchObject({auditorIdentityId:CONTROLLED_MEDIA_AUDITOR_IDENTITY_ID,auditorRole:'A5_INDEPENDENT_AUDITOR',evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,authoritativeForOperations:false,runtimeReceiptBinding:null});
    expect(fail.auditorIdentityId).not.toBe(revision.producerIdentityId);
    expect(()=>createMediaOwnerDecision({ownerId,revision,audit:fail,ownerIdentityId:'owner',result:'APPROVE',createdAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_PASS_REQUIRED'}));
    const pass=createMediaAuditDecision({ownerId,revision,controlledFixture:true,result:'PASS',createdAt:now});
    expect(()=>createMediaOwnerDecision({ownerId,revision,audit:pass,ownerIdentityId:'owner',result:'APPROVE',createdAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_RUNTIME_AUTHORITY_REQUIRED'}));
    const rejected=createMediaOwnerDecision({ownerId,revision,audit:pass,ownerIdentityId:'owner',result:'REJECT',createdAt:now});
    const forgedApproval={...rejected,result:'APPROVE' as const};
    expect(()=>createManualPublishPackageV4({ownerId,revision,audit:pass,decision:forgedApproval,textFiles:[{fileName:'title.txt',mediaType:'text/plain',content:'标题'}],createdAt:now})).toThrowError(expect.objectContaining({code:'MEDIA_AUDIT_RUNTIME_AUTHORITY_REQUIRED'}));
  });

  it.each(['MEDIA_BRAND_SNAPSHOT_CHANGED','MEDIA_KNOWLEDGE_SNAPSHOT_CHANGED','MEDIA_COMPOSITION_CHANGED','MEDIA_TAMPER_DETECTED'] as const)('invalidates audit, decision and package lineage for %s',(reasonCode)=>{
    const revision={id:'revision-v4',canonicalDigest:'7'.repeat(64)} as ArtifactRevisionV4;
    const event=invalidateMediaGovernance({ownerId,revision,reasonCode,currentDigest:'8'.repeat(64),createdAt:now});
    expect(event.invalidates).toEqual(['AUDIT','OWNER_DECISION','PACKAGE']);
  });

  it('never exposes a provider brand in stable core error codes',()=>{
    expect(new MediaContractError('MEDIA_RESULT_EXPIRED').code).toBe('MEDIA_RESULT_EXPIRED');
    expect(()=>new MediaContractError('EVOLINK_FAILURE' as never)).not.toThrow();
  });
});
