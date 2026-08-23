import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe,expect,it,vi} from 'vitest';
import {LocalContentAddressedBlobStore,sha256} from '@lumiclaw/blob-store';
import {createCompositionSpec,createMediaGenerationSpec,createRawProviderAsset,issueMediaSecretTicket,type BrandSnapshotBinding,type KnowledgeSnapshotBinding} from '@lumiclaw/domain';
import {
  ControlledFakeMediaProvider,EvoLinkMediaAdapter,assertSafeProviderResultUrl,buildDeterministicZip,
  composeXhsDeliveryImage,decodeAndValidateXhsImage,downloadAndIngestProviderResult,fontAssetManifest,
  type SafeDownloadDependencies
} from './index.js';

const now='2026-08-24T05:00:00.000Z';const ownerId='00000000-0000-4000-8000-000000000001';
const brand:BrandSnapshotBinding={id:'brand',digest:'b'.repeat(64),state:'APPROVED',approvedAt:now,expiresAt:null};
const knowledge:KnowledgeSnapshotBinding={id:'knowledge',digest:'c'.repeat(64),state:'APPROVED',approvedAt:now,expiresAt:null};
const ticket=issueMediaSecretTicket({purpose:'MEDIA_PROVIDER',scope:'media:submit',secretFingerprint:'fp',nonce:'n',issuedAt:now,expiresAt:'2026-08-24T05:10:00.000Z'});
const generationSpec=createMediaGenerationSpec({ownerId,artifactRevisionId:'revision',artifactRevisionDigest:'a'.repeat(64),imageSpecPosition:1,promptTextPrivateRef:'private://prompt/1',promptText:'无文字的暖色抽象背景，不含标题或标识。',altText:'暖色抽象背景',overlayCopy:'把一次发布变成可审校的全球在场',createdAt:now});

describe('controlled fake and secure media ingest',()=>{
  it('generates deterministic, genuinely decodable 1080x1440 PNG bytes without a provider claim',async()=>{
    const provider=new ControlledFakeMediaProvider();const request={requestDigest:'1'.repeat(64),modelRef:'controlled-fake',capabilityProfileRef:'controlled-fake-v1',sourcePromptDigest:generationSpec.sourcePromptDigest,promptText:'无文字背景',width:1080 as const,height:1440 as const,n:1 as const,promptRewriteAllowed:false as const,allowedMimes:['image/png'] as const,maxBytes:10*1024*1024,textFreeBackgroundRequired:true as const};
    const first=await provider.generateBytes(request);const second=await provider.generateBytes(request);expect(first.equals(second)).toBe(true);
    const decoded=await decodeAndValidateXhsImage(first,'image/png');expect(decoded).toMatchObject({mimeType:'image/png',width:1080,height:1440});expect(first.byteLength).toBeLessThan(1024*1024);
    expect(provider.maturity).toBe('CONTROLLED_FAKE');expect(provider.providerEvidence).toBe(false);
  });

  it.each([
    ['empty',Buffer.alloc(0),'image/png','MEDIA_RESULT_EMPTY'],
    ['html',Buffer.from('<html>not image</html>'),'image/png','MEDIA_MIME_INVALID'],
    ['svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/svg+xml','MEDIA_MIME_INVALID'],
  ])('rejects %s bytes before Blob authority',async(_name,bytes,declared,code)=>{await expect(decodeAndValidateXhsImage(bytes,declared)).rejects.toMatchObject({code});});

  it('blocks credentials, HTTP, loopback, private/link-local IPs and DNS rebinding',async()=>{
    const resolve=vi.fn(async(host:string)=>host==='safe.example'?[{address:'203.0.113.8',family:4}]:[{address:'127.0.0.1',family:4}]);
    await expect(assertSafeProviderResultUrl('http://safe.example/a.png',{resolve})).rejects.toMatchObject({code:'MEDIA_DOWNLOAD_FAILED'});
    await expect(assertSafeProviderResultUrl('https://u:p@safe.example/a.png',{resolve})).rejects.toMatchObject({code:'MEDIA_DOWNLOAD_FAILED'});
    await expect(assertSafeProviderResultUrl('https://localhost/a.png',{resolve})).rejects.toMatchObject({code:'MEDIA_DOWNLOAD_FAILED'});
    await expect(assertSafeProviderResultUrl('https://unsafe.example/a.png',{resolve})).rejects.toMatchObject({code:'MEDIA_DOWNLOAD_FAILED'});
    const first=await assertSafeProviderResultUrl('https://safe.example/a.png',{resolve});expect(first.resolvedAddresses).toEqual(['203.0.113.8']);
    resolve.mockResolvedValueOnce([{address:'127.0.0.1',family:4}]);await expect(assertSafeProviderResultUrl('https://safe.example/a.png',{resolve,expectedAddresses:first.resolvedAddresses})).rejects.toMatchObject({code:'MEDIA_DOWNLOAD_FAILED'});
  });

  it('follows only bounded safe redirects, verifies exact bytes, and persists a content-addressed Blob',async()=>{
    const bytes=await new ControlledFakeMediaProvider().generateBytes({requestDigest:'2'.repeat(64),modelRef:'fake',capabilityProfileRef:'fake',sourcePromptDigest:generationSpec.sourcePromptDigest,promptText:'background',width:1080,height:1440,n:1,promptRewriteAllowed:false,allowedMimes:['image/png'],maxBytes:10*1024*1024,textFreeBackgroundRequired:true});
    const calls:string[]=[];const fetcher=vi.fn(async(url:string)=>{calls.push(url);return url.endsWith('/start')?new Response(null,{status:302,headers:{location:'https://cdn.example/final.png'}}):new Response(Uint8Array.from(bytes).buffer,{status:200,headers:{'content-type':'image/png','content-length':String(bytes.byteLength)}});});
    const root=await mkdtemp(path.join(os.tmpdir(),'lumiclaw-sdd012-provider-'));try{const store=new LocalContentAddressedBlobStore(root);const deps:SafeDownloadDependencies={fetcher,resolve:async()=>[{address:'203.0.113.9',family:4}]};
      const result=await downloadAndIngestProviderResult('https://cdn.example/start','image/png',store,deps);expect(calls).toHaveLength(2);expect(result.blobRef.digest).toBe(sha256(bytes));expect(await store.has(result.blobRef)).toBe(true);expect(result.ephemeralUrlRetained).toBe(false);
    }finally{await rm(root,{recursive:true,force:true});}
  });
});

describe('pinned deterministic Chinese compositor',()=>{
  it('uses a reviewed, content-addressed OFL font rather than a system/CDN font',async()=>{
    const font=await readFile(path.resolve(fontAssetManifest.path));expect(sha256(font)).toBe(fontAssetManifest.sha256);expect(fontAssetManifest.license).toBe('OFL-1.1');expect(fontAssetManifest.fallbackOrder).toEqual(['Noto Sans SC Regular 2.004']);
  });

  it('renders exact overlay deterministically inside safe area with >=4.5:1 contrast and strips metadata',async()=>{
    const rawBytes=await new ControlledFakeMediaProvider().generateBytes({requestDigest:'3'.repeat(64),modelRef:'fake',capabilityProfileRef:'fake',sourcePromptDigest:generationSpec.sourcePromptDigest,promptText:'background',width:1080,height:1440,n:1,promptRewriteAllowed:false,allowedMimes:['image/png'],maxBytes:10*1024*1024,textFreeBackgroundRequired:true});
    const rawAsset=createRawProviderAsset({ownerId,jobId:'job',generationSpec,contentDigest:sha256(rawBytes),blobRef:{algorithm:'sha256',digest:sha256(rawBytes),size:rawBytes.byteLength},bytes:rawBytes.byteLength,mimeType:'image/png',width:1080,height:1440,fileName:'raw.png',providerTaskRef:'controlled-task',providerAdapterSnapshotDigest:'d'.repeat(64),costReceiptDigest:'e'.repeat(64),rightsReceiptDigest:'f'.repeat(64),maturity:'CONTROLLED_FAKE',submittedAt:now,completedAt:now,downloadedAt:now,verifiedAt:now,resultExpiresAt:null,metadataState:'CLEAN'});
    const composition=createCompositionSpec({ownerId,rawAsset,overlayCopy:generationSpec.overlayCopy,brandSnapshot:brand,knowledgeSnapshot:knowledge,ownerNoOverlayDecision:null,createdAt:now});
    const first=await composeXhsDeliveryImage(rawBytes,rawAsset,composition);const second=await composeXhsDeliveryImage(rawBytes,rawAsset,composition);expect(first.bytes.equals(second.bytes)).toBe(true);expect(first.contentDigest).toBe(second.contentDigest);expect(first.layout).toMatchObject({safeArea:{left:96,right:96,top:120,bottom:120},contrastRatio:expect.any(Number)});expect(first.layout.contrastRatio).toBeGreaterThanOrEqual(4.5);
    expect(await decodeAndValidateXhsImage(first.bytes,'image/png')).toMatchObject({width:1080,height:1440,metadataState:'CLEAN'});
  });

  it.each([
    ['emoji','真实协作 🧠','MEDIA_EMOJI_UNSUPPORTED'],
    ['missing glyph','\u{10FFFF}','MEDIA_GLYPH_MISSING'],
    ['overflow','这是一个故意设计得极其漫长并且无法在三行安全区域内完成确定性排版的中文标题'.repeat(8),'MEDIA_TEXT_OVERFLOW']
  ])('fails closed for %s',async(_name,overlayCopy,code)=>{
    const rawBytes=await new ControlledFakeMediaProvider().generateBytes({requestDigest:'4'.repeat(64),modelRef:'fake',capabilityProfileRef:'fake',sourcePromptDigest:generationSpec.sourcePromptDigest,promptText:'background',width:1080,height:1440,n:1,promptRewriteAllowed:false,allowedMimes:['image/png'],maxBytes:10*1024*1024,textFreeBackgroundRequired:true});
    const rawAsset=createRawProviderAsset({ownerId,jobId:'job',generationSpec,contentDigest:sha256(rawBytes),blobRef:{algorithm:'sha256',digest:sha256(rawBytes),size:rawBytes.byteLength},bytes:rawBytes.byteLength,mimeType:'image/png',width:1080,height:1440,fileName:'raw.png',providerTaskRef:'controlled-task',providerAdapterSnapshotDigest:'d'.repeat(64),costReceiptDigest:'e'.repeat(64),rightsReceiptDigest:'f'.repeat(64),maturity:'CONTROLLED_FAKE',submittedAt:now,completedAt:now,downloadedAt:now,verifiedAt:now,resultExpiresAt:null,metadataState:'CLEAN'});
    const composition=createCompositionSpec({ownerId,rawAsset,overlayCopy,brandSnapshot:brand,knowledgeSnapshot:knowledge,ownerNoOverlayDecision:null,createdAt:now});await expect(composeXhsDeliveryImage(rawBytes,rawAsset,composition)).rejects.toMatchObject({code});
  });
});

describe('real adapter and archive boundary',()=>{
  it('submits n=1 exact size with prompt rewrite disabled and maps timeout-before-task-id to UNKNOWN',async()=>{
    const acceptedFetch=vi.fn<(url:string,init?:RequestInit)=>Promise<Response>>().mockResolvedValue(new Response(JSON.stringify({id:'task-unified-1',status:'pending',usage:{credits_reserved:1.5}}),{status:200,headers:{'content-type':'application/json'}}));
    const adapter=new EvoLinkMediaAdapter({apiKey:'redacted-test-key-value',fetcher:acceptedFetch,now:()=>new Date(now)});const request={requestDigest:'5'.repeat(64),modelRef:'media-model-ref',capabilityProfileRef:'profile-ref',sourcePromptDigest:generationSpec.sourcePromptDigest,promptText:'text-free background',width:1080 as const,height:1440 as const,n:1 as const,promptRewriteAllowed:false as const,allowedMimes:['image/png'] as const,maxBytes:10*1024*1024,textFreeBackgroundRequired:true as const};
    await expect(adapter.submit(request,ticket)).resolves.toMatchObject({kind:'ACCEPTED',providerTaskRef:'task-unified-1',reservedAmount:1.5});
    const body=JSON.parse(String(acceptedFetch.mock.calls[0]?.[1]?.body));expect(body).toMatchObject({model:'wan2.5-text-to-image',size:'1080x1440',n:1,prompt_extend:false});
    const timeout=new EvoLinkMediaAdapter({apiKey:'redacted-test-key-value',fetcher:async()=>{throw new DOMException('timeout','TimeoutError');},now:()=>new Date(now)});await expect(timeout.submit(request,ticket)).resolves.toMatchObject({kind:'UNKNOWN',stableCode:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE'});
  });

  it('polls the same task and does not expose raw result URLs in observations after ingestion',async()=>{
    const adapter=new EvoLinkMediaAdapter({apiKey:'redacted-test-key-value',fetcher:async()=>new Response(JSON.stringify({id:'task-unified-1',status:'completed',results:['https://cdn.example/signed.png'],model:'wan2.5-text-to-image'}),{status:200}),now:()=>new Date(now)});const inspectTicket=issueMediaSecretTicket({purpose:'MEDIA_PROVIDER',scope:'media:inspect',secretFingerprint:'fp',nonce:'inspect',issuedAt:now,expiresAt:'2026-08-24T05:10:00.000Z'});
    const observation=await adapter.inspect('task-unified-1',inspectTicket);expect(observation).toMatchObject({state:'COMPLETED',providerTaskRef:'task-unified-1'});expect(observation.resultRef).toBe('https://cdn.example/signed.png');expect(JSON.stringify(adapter.publicSnapshot())).not.toContain('signed.png');
  });

  it('builds a deterministic binary ZIP and rejects digest mismatches',()=>{
    const entries=[{fileName:'manifest.json',bytes:Buffer.from('{"ok":true}'),digest:sha256(Buffer.from('{"ok":true}'))},{fileName:'image-01.png',bytes:Buffer.from([1,2,3]),digest:sha256(Buffer.from([1,2,3]))}];
    const a=buildDeterministicZip(entries);const b=buildDeterministicZip(entries);expect(a.equals(b)).toBe(true);expect(a.subarray(0,2).toString('hex')).toBe('504b');expect(()=>buildDeterministicZip([{...entries[0]!,digest:'0'.repeat(64)}])).toThrowError(expect.objectContaining({code:'MEDIA_PACKAGE_TAMPERED'}));
  });
});
