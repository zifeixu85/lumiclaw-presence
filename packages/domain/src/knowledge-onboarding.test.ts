import {describe,expect,it} from 'vitest';
import {knowledgeAuthorityRequiresOwnerConfirmation,orderKnowledgeItemsForOwnerDecision,parseKnowledgeEtag,prepareKnowledgeSource,profileKnowledgeItems,profilePayload,snapshotDigest,validateKnowledgeSessionInput,validateTextSource} from './knowledge-onboarding.js';
import type {KnowledgeContractError} from './knowledge-onboarding.js';

describe('SDD-008 knowledge onboarding contracts',()=>{
  it('maps an ordinary UTF-8 file and free text to content-addressed source revisions without technical metadata',()=>{
    const now=new Date('2026-08-22T00:00:00.000Z');
    const file=prepareKnowledgeSource({ownerId:'owner',label:'产品说明',fileName:'product.md',declaredMediaType:'text/markdown',bytes:new TextEncoder().encode('# Product\r\nA governed tool.')},now,'UPLOADED_FILE');
    const text=prepareKnowledgeSource({ownerId:'owner',label:'补充说明',text:'Founder voice: practical and direct',candidates:[]},now,'OWNER_AUTHORED_TEXT');
    expect(file).toMatchObject({mediaType:'text/markdown',extractedText:'# Product\nA governed tool.',blobRef:{algorithm:'sha256'}});
    expect(file.blobDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(text.fileName).toBeNull();
  });

  it.each([
    ['brief.pdf','application/pdf'],['brief.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['voice.mp3','audio/mpeg']
  ])('fails closed for planned source %s',(fileName,declaredMediaType)=>{
    expect(()=>prepareKnowledgeSource({ownerId:'owner',label:'planned',fileName,declaredMediaType,bytes:new Uint8Array([1,2,3])},new Date(),'UPLOADED_FILE')).toThrowError(expect.objectContaining<Partial<KnowledgeContractError>>({code:'SOURCE_TYPE_PLANNED'}));
  });

  it('rejects malformed UTF-8 and secret-shaped values before they become knowledge',()=>{
    expect(()=>prepareKnowledgeSource({ownerId:'owner',label:'bad',fileName:'bad.txt',declaredMediaType:'text/plain',bytes:new Uint8Array([0xff])},new Date(),'UPLOADED_FILE')).toThrowError(expect.objectContaining<Partial<KnowledgeContractError>>({code:'SOURCE_INVALID_UTF8'}));
    expect(()=>validateTextSource({label:'bad',text:'Bearer abcdefghijklmnopqrstuvwxyz1234',candidates:[]})).toThrowError(expect.objectContaining<Partial<KnowledgeContractError>>({code:'SECRET_SHAPED_VALUE_FORBIDDEN'}));
  });

  it('keeps market, content locale and IANA time zone independent and enforces ETags',()=>{
    expect(validateKnowledgeSessionInput({currentStep:'MARKET_CONTEXT',targetMarket:'JP',contentLocale:'en-US',timeZone:'Asia/Tokyo'})).toEqual({currentStep:'MARKET_CONTEXT',targetMarket:'JP',contentLocale:'en-US',timeZone:'Asia/Tokyo'});
    expect(parseKnowledgeEtag('"knowledge-7"')).toBe(7);
    expect(()=>parseKnowledgeEtag(undefined)).toThrowError(expect.objectContaining<Partial<KnowledgeContractError>>({code:'ETAG_REQUIRED'}));
  });

  it('creates deterministic profile items and exact snapshot digests',()=>{
    const payload=profilePayload('PERSONA',null,{displayName:'A梦',role:'Founder',voice:'Direct and evidence-bound',viewpoints:['Coordination matters'],expressionBoundaries:['No growth guarantees'],firstPersonRelationship:'Speak as the founder',expressionExamples:['Show the evidence.']});
    const revision={id:'r1',ownerId:'o1',kind:'PERSONA' as const,platformCode:null,version:1,digest:'a'.repeat(64),payload,createdAt:'2026-08-22T00:00:00.000Z'};
    expect(profileKnowledgeItems(revision)).toMatchObject([{kind:'PERSONA',profileRevisionIds:['r1']}]);
    const base={id:'s1',ownerId:'o1',version:1,sessionRowVersion:2,sourceRevisionDigests:[],profileRevisionDigests:[{revisionId:'r1',digest:'a'.repeat(64)}],itemBindings:[],conflictDecisions:[],gaps:[]};
    expect(snapshotDigest(base)).toBe(snapshotDigest(structuredClone(base)));
    expect(snapshotDigest(base)).toBe('31eae2f34fe21b2aa6ea604988c23950318bc5db55edf4ab500aeeb365204c10');
    expect(snapshotDigest({...base,sessionRowVersion:3})).not.toBe(snapshotDigest(base));
  });

  it('orders conflict candidates by frozen authority without silently resolving them',()=>{
    const candidates=[
      {id:'model',ownerAuthority:'MODEL_PRIOR_SUGGESTION' as const},
      {id:'public',ownerAuthority:'PUBLIC_MARKET_PACK' as const},
      {id:'organization',ownerAuthority:'ORGANIZATION_APPROVED_PRIVATE' as const},
      {id:'campaign',ownerAuthority:'CAMPAIGN_EXPLICIT' as const}
    ];
    expect(orderKnowledgeItemsForOwnerDecision(candidates).map((item)=>item.id)).toEqual(['campaign','organization','public','model']);
    expect(knowledgeAuthorityRequiresOwnerConfirmation('MODEL_PRIOR_SUGGESTION')).toBe(true);
    expect(knowledgeAuthorityRequiresOwnerConfirmation('PUBLIC_MARKET_PACK')).toBe(false);
  });
});
