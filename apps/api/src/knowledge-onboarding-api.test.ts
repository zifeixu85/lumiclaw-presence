import {describe,expect,it} from 'vitest';
import {buildApi} from './server.js';
import {MemoryKnowledgeRepository} from './memory-knowledge-repository.js';

const persona={displayName:'A梦',role:'Founder and builder',voice:'Practical, candid, evidence-bound',viewpoints:['Agent collaboration must be observable'],expressionBoundaries:['Never guarantee growth'],firstPersonRelationship:'Use first person only for founder experience',expressionExamples:['I will show the evidence before the claim.']};
const organization={name:'LumiClaw Studio',brandName:'LumiClaw',description:'AI-native global brand operations.',audiences:['B2B AI founders'],facts:['releaseStatus: beta','releaseStatus: generally available'],approvedClaims:[{statement:'Local-first onboarding is available',evidence:'Owner-confirmed public-safe product note'}]};
const product={name:'LumiClaw Presence',description:'Governed public presence missions.',valueProposition:'Coordinate facts, accounts and review.',audiences:['Global product teams'],facts:['Current slice is manual-only'],approvedClaims:[{statement:'PostgreSQL is the control-plane source of truth',evidence:'Architecture and migration evidence'}]};
const account=(platformCode:'X'|'XIAOHONGSHU')=>({platformCode,accountExists:false,handleOrDisplayName:platformCode==='X'?'@lumiclaw':'LumiClaw 小红书',producerMandates:platformCode==='X'?['FOUNDER_VOICE'] as const:['PRODUCT_EXPERTISE'] as const,rolePersona:platformCode==='X'?'Founder point of view':'Product education',audience:['AI builders'],targetMarket:platformCode==='X'?'US':'CN',contentLocale:platformCode==='X'?'en-US':'zh-CN',contentPillars:['Build notes','Governance'],expressionExamples:['Show the source.'],dos:['Be specific'],donts:['No growth guarantee'],ctaPolicy:'Invite a documented next step',cadenceHint:'Two useful posts per week'});

describe('SDD-008 guided knowledge API',()=>{
  it('lets an ordinary user save seven recoverable steps, review source excerpts, resolve conflict and approve exact snapshot',async()=>{
    const knowledgeRepository=new MemoryKnowledgeRepository(); const app=buildApi({knowledgeRepository,now:()=>new Date('2026-08-22T08:00:00.000Z')});
    const created=await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'A梦'}});expect(created.statusCode).toBe(201);
    let overview=(await app.inject({method:'GET',url:'/api/v1/onboarding/session'})).json().overview;
    const mutate=async(method:'PUT'|'POST',url:string,payload:Record<string,unknown>,key:string)=>{
      const response=await app.inject({method,url,headers:{'if-match':`"knowledge-${overview.session.rowVersion}"`,'idempotency-key':key,'content-type':'application/json'},payload});
      expect(response.statusCode,response.body).toBeLessThan(300);overview=response.json().overview;return response;
    };
    await mutate('PUT','/api/v1/profiles/persona',persona,'persona-0001');
    await mutate('PUT','/api/v1/profiles/organization',organization,'organization-0001');
    await mutate('PUT','/api/v1/profiles/product',product,'product-0001');
    const files=[['founder.md','text/markdown','# Founder\nEvidence first.'],['product.md','text/markdown','# Product\nGoverned missions.'],['facts.txt','text/plain','PostgreSQL is authoritative.']] as const;
    for(const [fileName,contentType,body] of files){const response=await app.inject({method:'POST',url:'/api/v1/knowledge/sources',headers:{'if-match':`"knowledge-${overview.session.rowVersion}"`,'idempotency-key':`file-${fileName}-0001`,'content-type':contentType,'x-lumiclaw-file-name':encodeURIComponent(fileName)},payload:Buffer.from(body)});expect(response.statusCode,response.body).toBe(201);overview=response.json().overview;}
    await mutate('POST','/api/v1/knowledge/sources/text',{label:'Founder boundary',text:'Never claim customer results without customer evidence.'},'text-source-0001');
    await mutate('POST','/api/v1/knowledge/sources/text',{label:'Product scope',text:'The current publishing path is manual-only.'},'text-source-0002');
    await mutate('PUT','/api/v1/profiles/accounts/X',account('X'),'account-x-0001');
    await mutate('PUT','/api/v1/profiles/accounts/XIAOHONGSHU',account('XIAOHONGSHU'),'account-xhs-0001');
    const contextPayload={currentStep:'REVIEW',targetMarket:'US',contentLocale:'en-US',timeZone:'America/Los_Angeles'};
    const saved=await mutate('PUT','/api/v1/onboarding/session',contextPayload,'context-0001');
    const replay=await app.inject({method:'PUT',url:'/api/v1/onboarding/session',headers:{'if-match':`"knowledge-${overview.session.rowVersion-1}"`,'idempotency-key':'context-0001','content-type':'application/json'},payload:contextPayload});expect(replay.statusCode).toBe(200);expect(replay.json().overview.session.rowVersion).toBe(overview.session.rowVersion);expect(saved.json().overview.sources).toHaveLength(5);

    expect(overview.draft.gaps).toEqual([]);expect(overview.draft.conflictDecisions).toHaveLength(1);expect(overview.draft.itemBindings.filter((item:{kind:string})=>item.kind==='SOURCE_EXCERPT')).toHaveLength(5);
    const blocked=await app.inject({method:'POST',url:'/api/v1/knowledge/snapshots/approve',headers:{'if-match':`"knowledge-${overview.session.rowVersion}"`,'idempotency-key':'approve-blocked-0001'},payload:{snapshotId:overview.draft.id,canonicalDigest:overview.draft.canonicalDigest}});expect(blocked.statusCode).toBe(409);expect(blocked.json().code).toBe('KNOWLEDGE_CONFLICT_UNRESOLVED');
    const conflict=overview.draft.conflictDecisions[0];await mutate('POST','/api/v1/knowledge/snapshots/resolve-conflict',{conflictId:conflict.id,selectedItemId:conflict.itemIds[0],note:'Owner confirms the current release status.'},'resolve-0001');
    expect(overview.session.state).toBe('READY_FOR_APPROVAL');const approvedDraft=overview.draft;
    await mutate('POST','/api/v1/knowledge/snapshots/approve',{snapshotId:approvedDraft.id,canonicalDigest:approvedDraft.canonicalDigest},'approve-0001');
    expect(overview.session.state).toBe('KNOWLEDGE_APPROVED_NEEDS_GOAL');expect(overview.approvedHistory[0]).toMatchObject({id:approvedDraft.id,state:'APPROVED',approvedBy:expect.any(String)});
    const role=await app.inject({method:'GET',url:`/api/v1/knowledge/snapshots/${approvedDraft.id}/role-context`,headers:{'x-lumiclaw-snapshot-digest':approvedDraft.canonicalDigest}});expect(role.statusCode).toBe(200);expect(role.json().roleContext).toMatchObject({targetMarket:'US',contentLocale:'en-US',timeZone:'America/Los_Angeles'});expect(role.json().roleContext.sourceDigests).toHaveLength(5);
    const roleAccounts=role.json().roleContext.items.filter((item:{kind:string})=>item.kind==='ACCOUNT_PROFILE').map((item:{normalizedValue:string})=>JSON.parse(item.normalizedValue));expect(roleAccounts).toEqual(expect.arrayContaining([expect.objectContaining({platformCode:'X',targetMarket:'US',contentLocale:'en-US'}),expect.objectContaining({platformCode:'XIAOHONGSHU',targetMarket:'CN',contentLocale:'zh-CN'})]));
    const reopened=await app.inject({method:'GET',url:'/api/v1/local-workspace'});expect(reopened.statusCode).toBe(200);expect(reopened.json().knowledge.session.state).toBe('KNOWLEDGE_APPROVED_NEEDS_GOAL');expect(reopened.json().knowledge.sources).toHaveLength(5);

    knowledgeRepository.removeBlobForTest(overview.sources[0].blobDigest);const missingRole=await app.inject({method:'GET',url:`/api/v1/knowledge/snapshots/${approvedDraft.id}/role-context`,headers:{'x-lumiclaw-snapshot-digest':approvedDraft.canonicalDigest}});expect(missingRole.statusCode).toBe(422);expect(missingRole.json().code).toBe('SOURCE_BLOB_MISSING');
    await mutate('PUT','/api/v1/profiles/product',{...product,description:'A changed product fact creates a new draft.'},'product-0002');expect(overview.session.state).not.toBe('KNOWLEDGE_APPROVED_NEEDS_GOAL');expect(overview.approvedHistory[0].id).toBe(approvedDraft.id);
    const staleRole=await app.inject({method:'GET',url:`/api/v1/knowledge/snapshots/${approvedDraft.id}/role-context`,headers:{'x-lumiclaw-snapshot-digest':approvedDraft.canonicalDigest}});expect(staleRole.statusCode).toBe(422);expect(staleRole.json().code).toBe('SOURCE_BLOB_MISSING');
    await app.close();
  });

  it('fails closed for planned sources, stale ETags, secret fields and missing blobs',async()=>{
    const knowledgeRepository=new MemoryKnowledgeRepository();const app=buildApi({knowledgeRepository});await app.inject({method:'POST',url:'/api/v1/local-owner-profile',payload:{displayName:'Owner'}});
    const pdf=await app.inject({method:'POST',url:'/api/v1/knowledge/sources',headers:{'if-match':'"knowledge-1"','idempotency-key':'planned-pdf-0001','content-type':'application/pdf','x-lumiclaw-file-name':'brief.pdf'},payload:Buffer.from('%PDF')});expect(pdf.statusCode).toBe(415);expect(pdf.json().code).toBe('SOURCE_TYPE_PLANNED');
    const stale=await app.inject({method:'PUT',url:'/api/v1/profiles/persona',headers:{'if-match':'"knowledge-99"','idempotency-key':'stale-profile-0001'},payload:persona});expect(stale.statusCode).toBe(412);
    const secretValue='sk-this-must-never-persist';const secret=await app.inject({method:'PUT',url:'/api/v1/profiles/accounts/X',headers:{'if-match':'"knowledge-1"','idempotency-key':'secret-account-0001'},payload:{...account('X'),apiKey:secretValue}});expect(secret.statusCode).toBe(422);expect(secret.json().code).toBe('BROWSER_SECRET_FIELD_FORBIDDEN');
    const audit=knowledgeRepository.auditEventsForTest();expect(audit.map((item)=>item.eventCode)).toEqual(expect.arrayContaining(['SOURCE_TYPE_PLANNED','SNAPSHOT_STALE','BROWSER_SECRET_FIELD_FORBIDDEN']));expect(JSON.stringify(audit)).not.toContain(secretValue);
    await app.close();
  });

  it('rejects a source ID from a different Owner boundary',async()=>{const repository=new MemoryKnowledgeRepository();const now=new Date('2026-08-22T08:00:00.000Z');await repository.ensureOwner('owner-a',now);await repository.ensureOwner('owner-b',now);const overview=await repository.ingestTextSource({ownerId:'owner-a',label:'Owner A source',text:'Only Owner A can read this source.',candidates:[]},1,'owner-a-source-0001',now);const source=overview.sources[0];expect(source).toBeDefined();if(source===undefined)throw new Error('SOURCE_FIXTURE_MISSING');await expect(repository.getSource('owner-b',source.documentId)).rejects.toMatchObject({code:'OWNER_BOUNDARY_VIOLATION'});await repository.close();});
});
