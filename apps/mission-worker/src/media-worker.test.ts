import crypto from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {LocalContentAddressedBlobStore,type BlobRef} from '@lumiclaw/blob-store';
import {PostgresMediaArtifactRepository} from '@lumiclaw/db';
import {createMediaGenerationSpec,issueMediaSecretTicket,sha256Digest,snapshotDigest,type MediaSecretTicket} from '@lumiclaw/domain';
import {ControlledFakeMediaAdapter,controlledFakeMediaTicketAuthority} from '@lumiclaw/providers';
import {Pool} from 'pg';
import {describe,expect,it} from 'vitest';
import {MediaArtifactWorker,mediaCrashStages,type MediaCrashStage} from './media-worker.js';

const url=process.env.SDD012_MEDIA_WORKER_POSTGRES_URL;
const suite=url===undefined?describe.skip:describe;
const owner='018f0000-0000-7000-8000-000000000022';
const account='018f0000-0000-7000-8000-000000000023';
const revision='xhs-worker-base';
const revisionDigest=sha256Digest('xhs-worker-base');
const prompt='无文字、无徽标、无人物隐私的杭州城市光影插画背景';

suite('SDD-012 media worker crash recovery',()=>{
  it('fails closed or recovers all five frozen stages without a second submission',async()=>{
    const pool=new Pool({connectionString:url!});
    const blobRoot=await mkdtemp(path.join(os.tmpdir(),'lumiclaw-sdd012-blob-'));
    const blobStore=new LocalContentAddressedBlobStore(blobRoot);
    await seed(pool,await blobStore.put(Buffer.from('public-safe worker source')));
    const repository=new PostgresMediaArtifactRepository(url!,blobStore);
    const provider=new ControlledFakeMediaAdapter();
    let submissions=0;
    const counted={submit:async(...args:Parameters<typeof provider.submit>)=>{submissions+=1;return provider.submit(...args);},inspect:provider.inspect.bind(provider)};
    try{
      const results:Record<MediaCrashStage,string>={} as Record<MediaCrashStage,string>;
      for(const [index,stage] of mediaCrashStages.entries()){
        const now=new Date(Date.now()+index*60_000);
        const spec=createMediaGenerationSpec({ownerId:owner,artifactRevisionId:revision,artifactRevisionDigest:revisionDigest,imageSpecPosition:index+1,promptTextPrivateRef:`private-prompt://sdd012/${index+1}`,promptText:prompt,altText:`杭州城市光影插画 ${index+1}`,overlayCopy:`让品牌在每个市场被看见 ${index+1}`,createdAt:now.toISOString()});
        const job=(await repository.enqueue(owner,[spec],1,'media-adapter://controlled-fake/v1',`worker-crash-${stage}`,now)).jobs[0]!;
        let armed=true;
        const worker=()=>new MediaArtifactWorker({repository,blobStore,provider:counted,workerId:`worker-${index}`,leaseMs:10,modelRef:'media-model://controlled-fake/v1',capabilityProfileRef:'media-capability://xhs-1080x1440/v1',providerAdapterSnapshotDigest:sha256Digest('controlled-fake-adapter'),maturity:'CONTROLLED_FAKE',providerSecretFingerprint:controlledFakeMediaTicketAuthority.currentSecretFingerprint,resolvePrompt:async()=>prompt,resolveResult:async(observation)=>({bytes:await provider.resolve(observation.resultRef!),declaredMime:'image/png'}),ticket:async(scope)=>ticket(scope),resolveGovernance:(ownerId,at)=>repository.resolveApprovedGovernance(ownerId,at),crashAfter:(value)=>{if(armed&&value===stage){armed=false;throw new Error(`FROZEN:${stage}`);}}});
        await expect(worker().processOnce(now)).rejects.toThrow(`FROZEN:${stage}`);
        let state=(await repository.getJob(owner,job.id))!.job.state;
        if(stage==='SUBMISSION_INTENT_PERSISTED'){
          expect(await worker().processOnce(new Date(now.getTime()+20))).toBe('IDLE');state=(await repository.getJob(owner,job.id))!.job.state;expect(state).toBe('UNKNOWN_CHARGE_STATE');results[stage]='REVIEW_REQUIRED_NO_RETRY';continue;
        }
        for(let attempt=0;attempt<4&&state!=='READY_FOR_REVIEW';attempt+=1){await worker().processOnce(new Date(now.getTime()+20+attempt*20));state=(await repository.getJob(owner,job.id))!.job.state;}
        expect(state).toBe('READY_FOR_REVIEW');const workspace=await repository.getWorkspace(owner);const final=workspace.finalAssets.find((value)=>value.position===index+1)!;expect(await blobStore.has(final.blobRef)).toBe(true);expect(final).toMatchObject({width:1080,height:1440,mimeType:'image/png',metadataStripped:true});results[stage]='RECOVERED_SAME_TASK';
      }
      expect(results).toEqual({SUBMISSION_INTENT_PERSISTED:'REVIEW_REQUIRED_NO_RETRY',PROVIDER_TASK_PERSISTED:'RECOVERED_SAME_TASK',DOWNLOADING_TRANSITION_PERSISTED:'RECOVERED_SAME_TASK',RAW_BLOB_BEFORE_DB_COMMIT:'RECOVERED_SAME_TASK',FINAL_BLOB_BEFORE_DB_COMMIT:'RECOVERED_SAME_TASK'});expect(submissions).toBe(4);const rows=(await pool.query<{tasks:string;raw:string;final:string}>(`select count(distinct provider_task_id)::text tasks,(select count(*) from media_raw_assets_v2)::text raw,(select count(*) from media_composited_assets_v2)::text final from media_generation_jobs_v2 where provider_task_id is not null`)).rows[0];expect(rows).toEqual({tasks:'4',raw:'4',final:'4'});
    }finally{await repository.close();await pool.end();await rm(blobRoot,{recursive:true,force:true});}
  },120_000);
});

function ticket(scope:'media:submit'|'media:inspect'):MediaSecretTicket{const issued=new Date();return issueMediaSecretTicket({...controlledFakeMediaTicketAuthority,purpose:'MEDIA_PROVIDER',scope,secretFingerprint:controlledFakeMediaTicketAuthority.currentSecretFingerprint,nonce:`${scope}-${crypto.randomUUID()}`,issuedAt:issued.toISOString(),expiresAt:new Date(issued.getTime()+60_000).toISOString()});}

async function seed(pool:Pool,sourceBlob:BlobRef){
  const organization='018f0000-0000-7000-8000-000000000024';const document='018f0000-0000-7000-8000-000000000025';const source='018f0000-0000-7000-8000-000000000026';const snapshot='018f0000-0000-7000-8000-000000000027';
  const organizationPayload={name:'Synthetic Org',brandName:'Synthetic Brand',description:'Public safe',audiences:['operators'],facts:['public'],approvedClaims:[]};const organizationDigest=sha256Digest(organizationPayload);const sourceRevisionDigests=[{revisionId:source,digest:sourceBlob.digest}];const profileRevisionDigests=[{revisionId:organization,digest:organizationDigest}];const snapshotBase={id:snapshot,ownerId:owner,version:1,sessionRowVersion:1,sourceRevisionDigests,profileRevisionDigests,itemBindings:[],conflictDecisions:[],gaps:[]};const snapshotCanonicalDigest=snapshotDigest(snapshotBase);
  await pool.query(`insert into local_owner_profiles(id,singleton_key,schema_version,display_name,state,created_at,updated_at) values($1,true,1,'SDD-012 worker owner','PROFILE_READY',now(),now())`,[owner]);
  await pool.query(`insert into knowledge_profile_revisions(owner_profile_id,id,kind,platform_code,version,digest,payload,created_at) values($1,$2,'ACCOUNT','XIAOHONGSHU',1,$3,$4,now()),($1,$5,'ORGANIZATION',null,1,$6,$7,now())`,[owner,account,sha256Digest('account-worker'),{classification:'PUBLIC_SAFE_SYNTHETIC'},organization,organizationDigest,organizationPayload]);
  await pool.query(`insert into source_documents(owner_profile_id,id,source_kind,label,sensitivity,created_at,deleted_at) values($1,$2,'PUBLIC_SAFE_EXAMPLE','worker source','PUBLIC_SAFE',now(),null)`,[owner,document]);
  await pool.query(`insert into source_document_revisions(owner_profile_id,id,document_id,version,source_kind,label,file_name,media_type,byte_size,blob_digest,blob_ref,extracted_text_digest,extracted_text,candidate_items,status,sensitivity,created_at) values($1,$2,$3,1,'PUBLIC_SAFE_EXAMPLE','worker source','worker.txt','text/plain',$4,$5,$6,$5,'public-safe worker source','[]','READY','PUBLIC_SAFE',now())`,[owner,source,document,sourceBlob.size,sourceBlob.digest,sourceBlob]);
  await pool.query(`insert into knowledge_snapshots(owner_profile_id,id,version,state,session_row_version,canonical_digest,source_revision_digests,profile_revision_digests,item_bindings,conflict_decisions,gaps,approved_by,approved_at,created_at) values($1,$2,1,'APPROVED',1,$3,$4,$5,'[]','[]','[]',$1,now(),now())`,[owner,snapshot,snapshotCanonicalDigest,JSON.stringify(sourceRevisionDigests),JSON.stringify(profileRevisionDigests)]);
  await pool.query(`insert into knowledge_snapshot_source_bindings(owner_profile_id,snapshot_id,source_revision_id,source_digest) values($1,$2,$3,$4)`,[owner,snapshot,source,sourceBlob.digest]);
  await pool.query(`insert into artifact_revisions_v3(owner_profile_id,id,activation_unit_id,platform_code,revision,parent_revision_id,producer_identity_id,canonical_digest,execution_bundle_id,execution_bundle_digest,account_profile_revision_id,payload,created_at) values($1,$2,'activation-worker','XIAOHONGSHU',1,null,'xhs-producer',$3,'bundle-worker',$4,$5,$6,now())`,[owner,revision,revisionDigest,sha256Digest('bundle-worker'),account,{classification:'PUBLIC_SAFE_SYNTHETIC'}]);
}
