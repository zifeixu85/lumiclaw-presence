import {lookup as dnsLookup} from 'node:dns/promises';
import {readFile} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {sha256,type BlobRef,type BlobStore} from '@lumiclaw/blob-store';
import {
  MediaContractError,MediaSecretTicketUseGuard,sha256Digest,xhsDeliveryProfile,type MediaCompositionSpecV1,type MediaGenerationProvider,
  type MediaProviderExactRequest,type MediaSecretTicket,type ProviderSubmissionResult,type ProviderTaskObservation,
  type RawProviderMediaAssetV2
} from '@lumiclaw/domain';
import opentype from 'opentype.js';
import sharp from 'sharp';

const PNG_SIGNATURE=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const MAX_REDIRECTS=3;
const PROVIDER_CREATE_URL='https://api.evolink.ai/v1/images/generations';
const PROVIDER_TASK_ORIGIN='https://api.evolink.ai';
const PROVIDER_MODEL='wan2.5-text-to-image';

export const fontAssetManifest=Object.freeze({
  path:'assets/media/fonts/NotoSansSC-Regular.otf',family:'Noto Sans SC',version:'2.004',
  sha256:'faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9',license:'OFL-1.1' as const,
  source:'https://github.com/notofonts/noto-cjk/tree/Sans2.004',sourceCommit:'523d033d6cb47f4a80c58a35753646f5c3608a78',
  fallbackOrder:['Noto Sans SC Regular 2.004'] as const,systemFallback:false,remoteFallback:false
});
export const compositorDependencyManifest=Object.freeze({
  sharp:{version:'0.35.3',license:'Apache-2.0',binaryRuntime:'libvips',binaryLicense:'LGPL-3.0-or-later',decision:'PINNED_LOCAL_OPERATOR'},
  opentype:{version:'1.3.4',license:'MIT',decision:'PINNED_GLYPH_TO_PATH'},archive:{implementation:'LumiClaw deterministic ZIP store writer',license:'Apache-2.0'},
  browserCanvas:false,networkAccess:false,systemFonts:false
});

export type DecodedXhsImage={mimeType:'image/png'|'image/jpeg'|'image/webp';width:1080;height:1440;bytes:number;contentDigest:string;metadataState:'CLEAN'|'QUARANTINED'};

export class ControlledFakeMediaProvider {
  public readonly maturity='CONTROLLED_FAKE' as const;
  public readonly providerEvidence=false;
  public async generateBytes(request:MediaProviderExactRequest|string):Promise<Buffer>{
    if(typeof request!=='string'&&(request.width!==1080||request.height!==1440||request.n!==1||request.promptRewriteAllowed||!request.textFreeBackgroundRequired))throw new MediaContractError('MEDIA_DIMENSIONS_INVALID');
    const requestDigest=typeof request==='string'?request.replace('controlled-fake://',''):request.requestDigest;const seed=Buffer.from(requestDigest.slice(0,12),'hex');const primary={r:42+(seed[0]??0)%72,g:48+(seed[1]??0)%64,b:74+(seed[2]??0)%72,alpha:1};const accent={r:170+(seed[3]??0)%70,g:78+(seed[4]??0)%90,b:70+(seed[5]??0)%80,alpha:1};
    const shapes=Buffer.from(`<svg width="1080" height="1440" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1440" fill="rgb(${primary.r},${primary.g},${primary.b})"/><circle cx="870" cy="260" r="360" fill="rgb(${accent.r},${accent.g},${accent.b})" opacity=".72"/><path d="M0 1040 C280 860 640 1260 1080 940 L1080 1440 L0 1440Z" fill="#f0b58a" opacity=".58"/><path d="M80 240 L520 80 L940 720 L310 910Z" fill="#f6e4ce" opacity=".20"/></svg>`);
    return sharp({create:{width:1080,height:1440,channels:4,background:primary}}).composite([{input:shapes}]).png({compressionLevel:9,adaptiveFiltering:false,palette:false,effort:10}).toBuffer();
  }
}

/** Explicit no-Secret engineering path. Its task references can never be used as real-provider evidence. */
export class ControlledFakeMediaAdapter implements MediaGenerationProvider {
  readonly #generator=new ControlledFakeMediaProvider();readonly #tickets=new MediaSecretTicketUseGuard();
  public async submit(request:MediaProviderExactRequest,ticket:MediaSecretTicket):Promise<ProviderSubmissionResult>{
    this.#tickets.consume(ticket,{purpose:'MEDIA_PROVIDER',scope:'media:submit',now:new Date().toISOString()});
    return {kind:'ACCEPTED',providerTaskRef:`controlled-fake://${request.requestDigest}`,reservedAmount:0,providerUsageDigest:sha256Digest({maturity:'CONTROLLED_FAKE',request:request.requestDigest}),observedAt:new Date().toISOString()};
  }
  public async inspect(providerTaskRef:string,ticket:MediaSecretTicket):Promise<ProviderTaskObservation>{
    this.#tickets.consume(ticket,{purpose:'MEDIA_PROVIDER',scope:'media:inspect',now:new Date().toISOString()});
    if(!providerTaskRef.startsWith('controlled-fake://'))return {state:'UNKNOWN',providerTaskRef,stableCode:'MEDIA_PROVIDER_TASK_MISMATCH',observedAt:new Date().toISOString()};
    return {state:'COMPLETED',providerTaskRef,resultRef:providerTaskRef,finalAmount:0,providerUsageDigest:sha256Digest({maturity:'CONTROLLED_FAKE',providerTaskRef}),observedAt:new Date().toISOString()};
  }
  public async resolve(providerTaskRef:string){if(!providerTaskRef.startsWith('controlled-fake://'))throw new MediaContractError('MEDIA_PROVIDER_TASK_MISMATCH');return this.#generator.generateBytes(providerTaskRef);}
}

export async function decodeAndValidateXhsImage(input:Uint8Array,declaredMime:string):Promise<DecodedXhsImage>{
  const bytes=Buffer.from(input);if(bytes.byteLength===0)throw new MediaContractError('MEDIA_RESULT_EMPTY');if(bytes.byteLength>xhsDeliveryProfile.maxBytes)throw new MediaContractError('MEDIA_RESULT_TOO_LARGE');
  const mime=sniffMime(bytes);if(mime===null||!xhsDeliveryProfile.allowedMimes.includes(mime)||normalMime(declaredMime)!==mime||!containerEndsExactly(bytes,mime))throw new MediaContractError('MEDIA_MIME_INVALID');
  let metadata:Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;try{metadata=await sharp(bytes,{failOn:'error',limitInputPixels:1080*1440*2,sequentialRead:true}).metadata();}catch{throw new MediaContractError('MEDIA_MIME_INVALID');}
  if(metadata.width!==1080||metadata.height!==1440||metadata.pages!==undefined&&metadata.pages!==1)throw new MediaContractError('MEDIA_DIMENSIONS_INVALID');
  if((metadata.format==='png'?'image/png':metadata.format==='jpeg'?'image/jpeg':metadata.format==='webp'?'image/webp':null)!==mime)throw new MediaContractError('MEDIA_MIME_INVALID');
  const metadataState=metadata.exif!==undefined||metadata.icc!==undefined||metadata.iptc!==undefined||metadata.xmp!==undefined?'QUARANTINED':'CLEAN';
  return {mimeType:mime,width:1080,height:1440,bytes:bytes.byteLength,contentDigest:sha256(bytes),metadataState};
}

export type AddressRecord={address:string;family:number};
export type SafeDownloadDependencies={
  fetcher?:(url:string,init?:RequestInit)=>Promise<Response>;
  resolve?:(hostname:string)=>Promise<AddressRecord[]>;
};

export async function assertSafeProviderResultUrl(value:string,input:{resolve?:(hostname:string)=>Promise<AddressRecord[]>;expectedAddresses?:string[]}={}):Promise<{url:URL;resolvedAddresses:string[]}>{
  let url:URL;try{url=new URL(value);}catch{throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');}
  if(url.protocol!=='https:'||url.username!==''||url.password!==''||url.port!==''&&url.port!=='443'||url.hostname.length===0||url.hostname.toLowerCase()==='localhost'||url.hostname.toLowerCase().endsWith('.localhost'))throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');
  const resolver=input.resolve??(async(hostname)=>dnsLookup(hostname,{all:true,verbatim:true}));let records:AddressRecord[];try{records=net.isIP(url.hostname)>0?[{address:url.hostname,family:net.isIP(url.hostname)}]:await resolver(url.hostname);}catch{throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');}
  const addresses=[...new Set(records.map((item)=>item.address))].sort();if(addresses.length===0||addresses.some(blockedAddress))throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');
  if(input.expectedAddresses!==undefined&&JSON.stringify([...input.expectedAddresses].sort())!==JSON.stringify(addresses))throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');
  return {url,resolvedAddresses:addresses};
}

export async function downloadAndIngestProviderResult(value:string,declaredMime:string|null,store:BlobStore,deps:SafeDownloadDependencies={}):Promise<{blobRef:BlobRef;decoded:DecodedXhsImage;ephemeralUrlRetained:false}>{
  const fetcher=deps.fetcher??((url,init)=>fetch(url,init));let current=value;let sameHostAddresses:string[]|undefined;
  for(let redirects=0;redirects<=MAX_REDIRECTS;redirects+=1){const safetyInput:{resolve?:(hostname:string)=>Promise<AddressRecord[]>;expectedAddresses?:string[]}={};if(deps.resolve!==undefined)safetyInput.resolve=deps.resolve;if(sameHostAddresses!==undefined)safetyInput.expectedAddresses=sameHostAddresses;const safe=await assertSafeProviderResultUrl(current,safetyInput);sameHostAddresses=safe.resolvedAddresses;
    let response:Response;try{response=await fetcher(safe.url.toString(),{method:'GET',redirect:'manual',headers:{accept:'image/png,image/jpeg,image/webp'},signal:AbortSignal.timeout(15_000)});}catch{throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');}
    if([301,302,303,307,308].includes(response.status)){if(redirects===MAX_REDIRECTS)throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');const location=response.headers.get('location');if(location===null)throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');const next=new URL(location,safe.url);if(next.hostname!==safe.url.hostname)sameHostAddresses=undefined;current=next.toString();continue;}
    if(!response.ok||response.body===null)throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');const contentLength=numberHeader(response.headers.get('content-length'));if(contentLength!==null&&(contentLength<=0||contentLength>xhsDeliveryProfile.maxBytes))throw new MediaContractError(contentLength<=0?'MEDIA_RESULT_EMPTY':'MEDIA_RESULT_TOO_LARGE');
    const chunks:Buffer[]=[];let total=0;const reader=response.body.getReader();for(;;){const {done,value:chunk}=await reader.read();if(done)break;total+=chunk.byteLength;if(total>xhsDeliveryProfile.maxBytes){await reader.cancel();throw new MediaContractError('MEDIA_RESULT_TOO_LARGE');}chunks.push(Buffer.from(chunk));}
    if(contentLength!==null&&contentLength!==total)throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');const bytes=Buffer.concat(chunks,total);const headerMime=response.headers.get('content-type')?.split(';')[0]?.trim()??null;if(headerMime===null)throw new MediaContractError('MEDIA_MIME_INVALID');if(declaredMime!==null&&normalMime(headerMime)!==normalMime(declaredMime))throw new MediaContractError('MEDIA_MIME_INVALID');
    const decoded=await decodeAndValidateXhsImage(bytes,declaredMime??headerMime);if(decoded.metadataState==='QUARANTINED')throw new MediaContractError('MEDIA_METADATA_FORBIDDEN');const blobRef=await store.put(bytes);if(blobRef.digest!==decoded.contentDigest||blobRef.size!==decoded.bytes)throw new MediaContractError('MEDIA_DIGEST_MISMATCH');return {blobRef,decoded,ephemeralUrlRetained:false};
  }
  throw new MediaContractError('MEDIA_DOWNLOAD_FAILED');
}

export async function composeXhsDeliveryImage(rawBytes:Uint8Array,rawAsset:RawProviderMediaAssetV2,spec:MediaCompositionSpecV1):Promise<{bytes:Buffer;contentDigest:string;layout:{safeArea:{left:96;right:96;top:120;bottom:120};fontSizePx:number;lineCount:number;contrastRatio:number;glyphBounds:{left:number;right:number;top:number;bottom:number}}}>{
  const decoded=await decodeAndValidateXhsImage(rawBytes,rawAsset.mimeType);if(decoded.contentDigest!==rawAsset.contentDigest||spec.rawAssetId!==rawAsset.id||spec.rawContentDigest!==rawAsset.contentDigest)throw new MediaContractError('MEDIA_DIGEST_MISMATCH');
  const safeArea={left:96 as const,right:96 as const,top:120 as const,bottom:120 as const};let fontSizePx=72;let lines:string[]=[];let contrastRatio=21;let glyphBounds={left:96,right:984,top:120,bottom:1320};let overlays:Array<{input:Buffer}>=[];
  if(spec.mode==='EXACT_OVERLAY'){
    const text=spec.overlayCopy;if(text===null||text.length===0)throw new MediaContractError('MEDIA_TEXT_OVERFLOW');if(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu.test(text))throw new MediaContractError('MEDIA_EMOJI_UNSUPPORTED');const font=await reviewedFont();assertGlyphCoverage(font,text);
    const fit=fitText(font,text);fontSizePx=fit.fontSize;lines=fit.lines;contrastRatio=contrast(spec.colorTokens.foreground,spec.colorTokens.panel);if(contrastRatio<4.5)throw new MediaContractError('MEDIA_CONTRAST_INVALID');
    const lineHeight=fontSizePx*1.2;const textHeight=lines.length*lineHeight;const panelTop=120;const panelBottom=Math.min(1320,panelTop+128+textHeight);const baseline=panelTop+64+fontSizePx;glyphBounds={left:144,right:936,top:panelTop+48,bottom:baseline+(lines.length-1)*lineHeight+fontSizePx*0.25};if(glyphBounds.left<96||glyphBounds.right>984||glyphBounds.top<120||glyphBounds.bottom>1320)throw new MediaContractError('MEDIA_SAFE_AREA_INVALID');
    const paths=lines.map((line,index)=>font.getPath(line,144,baseline+index*lineHeight,fontSizePx,{kerning:true}).toPathData(3)).map((data)=>`<path d="${escapeAttribute(data)}"/>`).join('');
    overlays=[{input:Buffer.from(`<svg width="1080" height="1440" xmlns="http://www.w3.org/2000/svg"><rect x="96" y="120" width="888" height="${panelBottom-panelTop}" rx="36" fill="${escapeAttribute(spec.colorTokens.panel)}"/><g fill="${escapeAttribute(spec.colorTokens.foreground)}">${paths}</g><rect x="144" y="${panelBottom-24}" width="180" height="8" rx="4" fill="${escapeAttribute(spec.colorTokens.accent)}"/></svg>`)}];
  }
  const bytes=await sharp(Buffer.from(rawBytes),{failOn:'error',limitInputPixels:1080*1440*2}).rotate().composite(overlays).png({compressionLevel:9,adaptiveFiltering:false,palette:false,effort:10}).toBuffer();const final=await decodeAndValidateXhsImage(bytes,'image/png');if(final.metadataState!=='CLEAN')throw new MediaContractError('MEDIA_METADATA_FORBIDDEN');
  return {bytes,contentDigest:sha256(bytes),layout:{safeArea,fontSizePx,lineCount:lines.length,contrastRatio,glyphBounds}};
}

let fontPromise:Promise<opentype.Font>|undefined;
async function reviewedFont():Promise<opentype.Font>{fontPromise??=(async()=>{const bytes=await readFile(path.resolve(fontAssetManifest.path));if(sha256(bytes)!==fontAssetManifest.sha256)throw new MediaContractError('MEDIA_DIGEST_MISMATCH');return opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));})();return fontPromise;}
function assertGlyphCoverage(font:opentype.Font,text:string){for(const character of Array.from(text)){if(/\s/u.test(character))continue;const glyph=font.charToGlyph(character);if(glyph.index===0)throw new MediaContractError('MEDIA_GLYPH_MISSING',undefined,{character:`U+${character.codePointAt(0)?.toString(16).toUpperCase()}`});}}
function fitText(font:opentype.Font,text:string):{fontSize:number;lines:string[]}{for(let size=72;size>=48;size-=4){const lines=wrapText(font,text,size,792);if(lines.length<=3&&lines.every((line)=>font.getAdvanceWidth(line,size,{kerning:true})<=792))return {fontSize:size,lines};}throw new MediaContractError('MEDIA_TEXT_OVERFLOW');}
function wrapText(font:opentype.Font,text:string,fontSize:number,maxWidth:number):string[]{const lines:string[]=[];let current='';for(const character of Array.from(text)){if(character==='\n'){if(current.length>0)lines.push(current);current='';continue;}const candidate=current+character;if(current.length>0&&font.getAdvanceWidth(candidate,fontSize,{kerning:true})>maxWidth){lines.push(current);current=character;}else current=candidate;}if(current.length>0)lines.push(current);return lines;}

export class EvoLinkMediaAdapter implements MediaGenerationProvider {
  readonly #fetcher:(url:string,init?:RequestInit)=>Promise<Response>;readonly #now:()=>Date;readonly #tickets=new MediaSecretTicketUseGuard();
  public constructor(private readonly input:{apiKey:string;fetcher?:(url:string,init?:RequestInit)=>Promise<Response>;now?:()=>Date}){if(Buffer.byteLength(input.apiKey)<16)throw new MediaContractError('MEDIA_SECRET_NOT_CONFIGURED');this.#fetcher=input.fetcher??((url,init)=>fetch(url,init));this.#now=input.now??(()=>new Date());}
  public async submit(request:MediaProviderExactRequest,ticket:MediaSecretTicket):Promise<ProviderSubmissionResult>{this.#tickets.consume(ticket,{purpose:'MEDIA_PROVIDER',scope:'media:submit',now:this.#now().toISOString()});const observedAt=this.#now().toISOString();let response:Response;
    try{response=await this.#fetcher(PROVIDER_CREATE_URL,{method:'POST',headers:{authorization:`Bearer ${this.input.apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:PROVIDER_MODEL,prompt:request.promptText,size:'1080x1440',n:1,prompt_extend:false}),signal:AbortSignal.timeout(30_000)});}catch{return {kind:'UNKNOWN',stableCode:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE',observedAt};}
    if(!response.ok){if([400,401,402,403].includes(response.status))return {kind:'DEFINITELY_NOT_CREATED',stableCode:'MEDIA_PROVIDER_TASK_FAILED',observedAt};return {kind:'UNKNOWN',stableCode:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE',observedAt};}
    const value=await safeJson(response);const taskId=textField(value,'id');if(taskId===null)return {kind:'UNKNOWN',stableCode:'MEDIA_SUBMIT_UNKNOWN_CHARGE_STATE',observedAt};const reserved=numberField(recordField(value,'usage'),'credits_reserved');return {kind:'ACCEPTED',providerTaskRef:taskId,reservedAmount:reserved,providerUsageDigest:recordField(value,'usage')===null?null:sha256(Buffer.from(JSON.stringify(recordField(value,'usage')))),observedAt};
  }
  public async inspect(providerTaskRef:string,ticket:MediaSecretTicket):Promise<ProviderTaskObservation>{this.#tickets.consume(ticket,{purpose:'MEDIA_PROVIDER',scope:'media:inspect',now:this.#now().toISOString()});const observedAt=this.#now().toISOString();if(!/^task-unified-[a-z0-9-]+$/u.test(providerTaskRef))return {state:'UNKNOWN',providerTaskRef,stableCode:'MEDIA_PROVIDER_TASK_UNKNOWN',observedAt};let response:Response;
    try{response=await this.#fetcher(`${PROVIDER_TASK_ORIGIN}/v1/tasks/${encodeURIComponent(providerTaskRef)}`,{method:'GET',headers:{authorization:`Bearer ${this.input.apiKey}`},signal:AbortSignal.timeout(15_000)});}catch{return {state:'UNKNOWN',providerTaskRef,stableCode:'MEDIA_PROVIDER_TASK_UNKNOWN',observedAt};}
    if(!response.ok)return {state:response.status>=500||response.status===429?'UNKNOWN':'FAILED',providerTaskRef,stableCode:response.status>=500||response.status===429?'MEDIA_PROVIDER_TASK_UNKNOWN':'MEDIA_PROVIDER_TASK_FAILED',observedAt};const value=await safeJson(response);if(textField(value,'id')!==providerTaskRef)return {state:'FAILED',providerTaskRef,stableCode:'MEDIA_PROVIDER_TASK_MISMATCH',observedAt};const status=textField(value,'status');const model=textField(value,'model');if(model!==null&&model!==PROVIDER_MODEL)return {state:'FAILED',providerTaskRef,stableCode:'MEDIA_PROVIDER_TASK_MISMATCH',observedAt};if(status==='pending')return {state:'PENDING',providerTaskRef,observedAt};if(status==='processing')return {state:'PROCESSING',providerTaskRef,observedAt};if(status==='failed')return {state:'FAILED',providerTaskRef,stableCode:'MEDIA_PROVIDER_TASK_FAILED',observedAt};if(status==='completed'){const results=arrayField(value,'results');const result=results?.find((item):item is string=>typeof item==='string');if(result===undefined)return {state:'FAILED',providerTaskRef,stableCode:'MEDIA_RESULT_EMPTY',observedAt};return {state:'COMPLETED',providerTaskRef,resultRef:result,resultExpiresAt:null,finalAmount:numberField(recordField(value,'usage'),'credits_final'),providerUsageDigest:recordField(value,'usage')===null?null:sha256(Buffer.from(JSON.stringify(recordField(value,'usage')))),observedAt};}return {state:'UNKNOWN',providerTaskRef,stableCode:'MEDIA_PROVIDER_TASK_UNKNOWN',observedAt};
  }
  public publicSnapshot(){return {adapterRef:'media-adapter://first/v1',profileRef:'media-capability://wan-text-to-image/v1',modelRef:'media-model://wan-text-to-image/v1',checkedAt:'2026-08-24T00:00:00.000Z',source:'https://evolink.ai/zh/wan-image?model=wan2.5-text-to-image',secretConfigured:true,secretPresentInOutput:false,temporaryResultUrlRetained:false};}
}

export function buildDeterministicZip(entries:Array<{fileName:string;bytes:Uint8Array;digest:string}>):Buffer {
  const locals:Buffer[]=[];const central:Buffer[]=[];let offset=0;const seen=new Set<string>();for(const entry of entries){if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(entry.fileName)||seen.has(entry.fileName))throw new MediaContractError('MEDIA_PACKAGE_TAMPERED');seen.add(entry.fileName);const bytes=Buffer.from(entry.bytes);if(sha256(bytes)!==entry.digest)throw new MediaContractError('MEDIA_PACKAGE_TAMPERED');const name=Buffer.from(entry.fileName,'utf8');const crc=crc32(bytes);
    const local=Buffer.alloc(30+name.length);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(0,8);local.writeUInt16LE(0,10);local.writeUInt16LE(0x0021,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);name.copy(local,30);locals.push(local,bytes);
    const header=Buffer.alloc(46+name.length);header.writeUInt32LE(0x02014b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);header.writeUInt16LE(0x0800,8);header.writeUInt16LE(0,10);header.writeUInt16LE(0,12);header.writeUInt16LE(0x0021,14);header.writeUInt32LE(crc,16);header.writeUInt32LE(bytes.length,20);header.writeUInt32LE(bytes.length,24);header.writeUInt16LE(name.length,28);header.writeUInt32LE(offset,42);name.copy(header,46);central.push(header);offset+=local.length+bytes.length;}
  const centralBytes=Buffer.concat(central);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,centralBytes,end]);
}

const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let index=0;index<256;index+=1){let value=index;for(let bit=0;bit<8;bit+=1)value=(value&1)!==0?0xedb88320^(value>>>1):value>>>1;table[index]=value>>>0;}return table;})();
function crc32(bytes:Uint8Array){let value=0xffffffff;for(const byte of bytes)value=CRC_TABLE[(value^byte)&0xff]!^(value>>>8);return (value^0xffffffff)>>>0;}
function sniffMime(bytes:Buffer):DecodedXhsImage['mimeType']|null{if(bytes.subarray(0,8).equals(PNG_SIGNATURE))return'image/png';if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg';if(bytes.length>=12&&bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')return'image/webp';return null;}
function containerEndsExactly(bytes:Buffer,mime:DecodedXhsImage['mimeType']){if(mime==='image/jpeg')return bytes.length>=4&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9;if(mime==='image/webp')return bytes.length>=12&&bytes.readUInt32LE(4)+8===bytes.length;let offset=8;while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset);const type=bytes.subarray(offset+4,offset+8).toString('ascii');offset+=12+length;if(type==='IEND')return offset===bytes.length;}return false;}
function normalMime(value:string){return value.toLowerCase().split(';')[0]?.trim()==='image/jpg'?'image/jpeg':value.toLowerCase().split(';')[0]?.trim();}
function numberHeader(value:string|null){if(value===null)return null;const parsed=Number(value);return Number.isSafeInteger(parsed)?parsed:null;}
function blockedAddress(address:string){const version=net.isIP(address);if(version===4){const [a,b]=address.split('.').map(Number);return a===0||a===10||a===127||a===169&&b===254||a===172&&b!==undefined&&b>=16&&b<=31||a===192&&b===168||a===224||a===255;}if(version===6){const value=address.toLowerCase();return value==='::'||value==='::1'||value.startsWith('fe8')||value.startsWith('fe9')||value.startsWith('fea')||value.startsWith('feb')||value.startsWith('fc')||value.startsWith('fd')||value.startsWith('::ffff:127.')||value.startsWith('::ffff:10.')||value.startsWith('::ffff:192.168.');}return true;}
function contrast(foreground:string,background:string){const luminance=(hex:string)=>{if(!/^#[0-9a-f]{6}$/iu.test(hex))throw new MediaContractError('MEDIA_CONTRAST_INVALID');const channels=[1,3,5].map((index)=>Number.parseInt(hex.slice(index,index+2),16)/255).map((value)=>value<=0.03928?value/12.92:((value+0.055)/1.055)**2.4);return 0.2126*channels[0]!+0.7152*channels[1]!+0.0722*channels[2]!;};const a=luminance(foreground);const b=luminance(background);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);}
function escapeAttribute(value:string){return value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');}
async function safeJson(response:Response):Promise<Record<string,unknown>>{try{const value=await response.json();return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}catch{return {};}}
function textField(value:Record<string,unknown>|null,key:string){const field=value?.[key];return typeof field==='string'&&field.length>0?field:null;}
function numberField(value:Record<string,unknown>|null,key:string){const field=value?.[key];return typeof field==='number'&&Number.isFinite(field)?field:null;}
function recordField(value:Record<string,unknown>|null,key:string){const field=value?.[key];return field!==null&&typeof field==='object'&&!Array.isArray(field)?field as Record<string,unknown>:null;}
function arrayField(value:Record<string,unknown>|null,key:string){const field=value?.[key];return Array.isArray(field)?field:null;}
