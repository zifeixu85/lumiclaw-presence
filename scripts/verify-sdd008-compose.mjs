import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';

const project='lumiclaw-sdd008-verify';const webPort='3188';const apiPort='4188';
const apiUrl=`http://127.0.0.1:${apiPort}`;const webUrl=`http://127.0.0.1:${webPort}`;
const evidencePath=path.resolve('docs/reports/evidence/sdd-008/compose-verification.json');
const latestMigration='000016_sdd012_a5_auditor_receipt_authority';const rollbackDepthThroughSdd008=6;
const checks={};const events=[];let result='FAIL';let failure=null;
let migrationManifest=null;let apiContractResults=null;let sourceSnapshotManifest=null;let restartTranscript=null;

function docker(args,inherit=false){const command=['compose','--project-name',project,...args];const startedAt=new Date().toISOString();try{const output=execFileSync('docker',command,{cwd:process.cwd(),encoding:'utf8',stdio:inherit?'inherit':['ignore','pipe','pipe'],env:{...process.env,LUMICLAW_WEB_PORT:webPort,LUMICLAW_API_PORT:apiPort},timeout:900_000});events.push({command:['docker',...command],startedAt,result:'PASS'});return output??'';}catch(error){events.push({command:['docker',...command],startedAt,result:'FAIL'});throw error;}}
function dockerExpectedFailure(args){const command=['compose','--project-name',project,...args];const run=spawnSync('docker',command,{cwd:process.cwd(),encoding:'utf8',env:{...process.env,LUMICLAW_WEB_PORT:webPort,LUMICLAW_API_PORT:apiPort},timeout:180_000});events.push({command:['docker',...command],startedAt:new Date().toISOString(),result:run.status===0?'UNEXPECTED_PASS':'EXPECTED_FAIL'});return {status:run.status,output:`${run.stdout??''}\n${run.stderr??''}`};}
async function waitHealthy(timeoutMs=300_000){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){const raw=docker(['ps','--format','json']).trim();const rows=raw===''?[]:raw.startsWith('[')?JSON.parse(raw):raw.split('\n').map((line)=>JSON.parse(line));const states=new Map(rows.map((row)=>[row.Service,row.Health||row.State]));if(['postgres','api','mission-worker','action-operator','web'].every((service)=>states.get(service)==='healthy'))return;await new Promise((resolve)=>setTimeout(resolve,1800));}throw new Error('SDD008_COMPOSE_HEALTH_TIMEOUT');}
function pg(sql,database='lumiclaw'){return docker(['exec','-T','postgres','psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At','-c',sql]).trim();}
async function json(route,init={}){const response=await fetch(`${apiUrl}${route}`,init);return {status:response.status,headers:response.headers,body:await response.json()};}
function knowledgeHeaders(version,key,extra={}){return {'if-match':`"knowledge-${version}"`,'idempotency-key':key,'content-type':'application/json',...extra};}

await mkdir(path.dirname(evidencePath),{recursive:true});
try{
  docker(['down','--volumes','--remove-orphans']);
  if(process.env.SDD008_SKIP_BUILD!=='1')docker(['build','api'],true);
  docker(['up','--no-build','--detach'],true);await waitHealthy();checks.freshComposeHealthy=true;
  if(pg("select count(*) from pgmigrations where name='000011_guided_knowledge_onboarding'")!=='1')throw new Error('SDD008_MIGRATION_11_MISSING');
  if(pg('select name from pgmigrations order by run_on desc,name desc limit 1')!==latestMigration)throw new Error('SDD008_LATEST_MIGRATION_UNEXPECTED');
  checks.nextMigrationNumberApplied=true;

  pg('create database lumiclaw_sdd008_empty_down');
  docker(['exec','-T','-e','DATABASE_URL=postgres://postgres@postgres:5432/lumiclaw_sdd008_empty_down','api','npm','--workspace','@lumiclaw/db','run','migrate:up']);
  docker(['exec','-T','-e','DATABASE_URL=postgres://postgres@postgres:5432/lumiclaw_sdd008_empty_down','api','npm','--workspace','@lumiclaw/db','run','migrate:down','--',String(rollbackDepthThroughSdd008)]);
  if(pg("select to_regclass('public.knowledge_snapshots') is null",'lumiclaw_sdd008_empty_down')!=='t'||pg('select name from pgmigrations order by run_on desc,name desc limit 1','lumiclaw_sdd008_empty_down')!=='000010_onboarding_completion_reservation'||pg("select count(*) from information_schema.columns where table_name='local_onboarding_sessions' and column_name='completion_digest'",'lumiclaw_sdd008_empty_down')!=='1')throw new Error('SDD008_EMPTY_DOWN_DID_NOT_REMOVE_ONLY_SDD008_AND_LATER_SCHEMA');
  checks.freshEmptyDownPass=true;

  pg('create database lumiclaw_sdd008_legacy');
  docker(['exec','-T','-e','DATABASE_URL=postgres://postgres@postgres:5432/lumiclaw_sdd008_legacy','api','npm','--workspace','@lumiclaw/db','run','migrate:up']);
  docker(['exec','-T','-e','DATABASE_URL=postgres://postgres@postgres:5432/lumiclaw_sdd008_legacy','api','npm','--workspace','@lumiclaw/db','run','migrate:down','--',String(rollbackDepthThroughSdd008)]);
  const legacyText='# Legacy public-safe fixture\\nOwner review is required.';const legacyDigest=createHash('sha256').update(legacyText).digest('hex');const ownerId='018f0000-0000-7000-8000-000000000001';const materialId='018f0000-0000-7000-8000-000000000002';
  pg(`insert into local_owner_profiles(id,singleton_key,schema_version,display_name,state,created_at,updated_at) values('${ownerId}',true,1,'Legacy fixture Owner','PROFILE_READY',now(),now());insert into local_onboarding_sessions(owner_profile_id,schema_version,path,state,data_mode,organization_id,campaign_id,market_code,content_locale,platform,time_zone,material_ids,created_at,updated_at,market_codes,content_locales,platforms,default_time_zone,completion_digest) values('${ownerId}',1,'LOCAL_MATERIALS','MATERIALS_READY','LOCAL_PRIVATE',null,null,null,null,null,null,'["${materialId}"]'::jsonb,now(),now(),'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,null,null);insert into local_material_manifests(owner_profile_id,id,schema_version,file_name,media_type,byte_size,digest,state,extracted_text,failure_code,blob_ref,created_at,updated_at) values('${ownerId}','${materialId}',1,'legacy.md','text/markdown',${Buffer.byteLength(legacyText)},'${legacyDigest}','READY',${sqlLiteral(legacyText)},null,'{"algorithm":"sha256","digest":"${legacyDigest}","size":${Buffer.byteLength(legacyText)}}'::jsonb,now(),now());`,'lumiclaw_sdd008_legacy');
  docker(['exec','-T','-e','DATABASE_URL=postgres://postgres@postgres:5432/lumiclaw_sdd008_legacy','api','npm','--workspace','@lumiclaw/db','run','migrate:up']);
  const legacy=pg("select status||'|'||trim(blob_digest)||'|'||source_kind from source_document_revisions",'lumiclaw_sdd008_legacy');
  if(legacy!==`LEGACY_NEEDS_REVIEW|${legacyDigest}|LEGACY_LOCAL_MATERIAL`)throw new Error('SDD008_LEGACY_MIGRATION_LOST_DIGEST_OR_AUTO_APPROVED');
  const legacyDown=dockerExpectedFailure(['exec','-T','-e','DATABASE_URL=postgres://postgres@postgres:5432/lumiclaw_sdd008_legacy','api','npm','--workspace','@lumiclaw/db','run','migrate:down','--',String(rollbackDepthThroughSdd008)]);
  if(legacyDown.status===0||!legacyDown.output.includes('SDD008_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED'))throw new Error('SDD008_LEGACY_POPULATED_DOWN_NOT_BLOCKED');
  checks.legacyUpgradePreservesDigestAndRequiresReview=true;checks.populatedDownBlocksDestructiveRollback=true;
  migrationManifest={schemaVersion:1,sdd:'SDD-008',classification:'PUBLIC_SAFE_SYNTHETIC',migrations:JSON.parse(pg("select json_agg(name order by run_on)::text from pgmigrations")),sdd008Migration:'000011_guided_knowledge_onboarding',latestMigration,rollbackDepthThroughSdd008,freshEmptyDown:{result:'PASS',schemaRemoved:true,earlierMigration10Preserved:true},isolatedSdd008PopulatedDown:{result:'BLOCKED',stableCode:'SDD008_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED',schemaAndDataPreserved:true},legacyUpgrade:{result:'PASS',status:'LEGACY_NEEDS_REVIEW',sourceKind:'LEGACY_LOCAL_MATERIAL',digestPreserved:true}};

  execFileSync(process.execPath,['scripts/verify-sdd008-browser.mjs'],{cwd:process.cwd(),stdio:'inherit',env:{...process.env,SDD008_WEB_URL:webUrl},timeout:300_000});checks.realChromiumBilingualOrdinaryFlow=true;
  const workspace=await json('/api/v1/local-workspace');if(workspace.status!==200||workspace.body.knowledge?.session?.state!=='KNOWLEDGE_APPROVED_NEEDS_GOAL')throw new Error('SDD008_BROWSER_RESULT_NOT_APPROVED');
  const approved=workspace.body.knowledge.approvedHistory[0];const role=await json(`/api/v1/knowledge/snapshots/${approved.id}/role-context`,{headers:{'x-lumiclaw-snapshot-digest':approved.canonicalDigest}});
  if(role.status!==200||role.body.roleContext.sourceDigests.length!==5)throw new Error('SDD008_ROLE_CONTEXT_SOURCE_BINDING_INVALID');
  const accountItems=role.body.roleContext.items.filter((item)=>item.kind==='ACCOUNT_PROFILE').map((item)=>JSON.parse(item.normalizedValue));const x=accountItems.find((item)=>item.platformCode==='X');const xhs=accountItems.find((item)=>item.platformCode==='XIAOHONGSHU');
  if(accountItems.length!==2||x?.targetMarket!=='US'||x?.contentLocale!=='en-US'||xhs?.targetMarket!=='CN'||xhs?.contentLocale!=='zh-CN'||role.body.roleContext.targetMarket!=='SG'||role.body.roleContext.timeZone!=='Asia/Singapore')throw new Error('SDD008_PLATFORM_PROFILES_OR_DEFAULT_CONTEXT_COLLAPSED');
  checks.fiveSourcesBoundIntoRoleContext=true;checks.independentPlatformProfilesAndDefaultContext=true;
  sourceSnapshotManifest={schemaVersion:1,sdd:'SDD-008',classification:'PUBLIC_SAFE_SYNTHETIC',snapshot:{id:approved.id,version:approved.version,state:approved.state,canonicalDigest:approved.canonicalDigest,sourceRevisionDigests:approved.sourceRevisionDigests,profileRevisionDigests:approved.profileRevisionDigests,itemBindingCount:approved.itemBindings.length,conflictDecisionCount:approved.conflictDecisions.length},sources:workspace.body.knowledge.sources.map((source)=>({documentId:source.documentId,revisionId:source.id,label:source.label,fileName:source.fileName,sourceKind:source.sourceKind,mediaType:source.mediaType,byteSize:source.byteSize,blobDigest:source.blobDigest,extractedTextDigest:source.extractedTextDigest,status:source.status})),roleContext:{snapshotId:role.body.roleContext.snapshotId,snapshotDigest:role.body.roleContext.snapshotDigest,targetMarket:role.body.roleContext.targetMarket,contentLocale:role.body.roleContext.contentLocale,timeZone:role.body.roleContext.timeZone,sourceDigests:role.body.roleContext.sourceDigests,itemCount:role.body.roleContext.items.length,accounts:[x,xhs].map((profile)=>({platformCode:profile.platformCode,handleOrDisplayName:profile.handleOrDisplayName,accountExists:profile.accountExists,producerMandates:profile.producerMandates,targetMarket:profile.targetMarket,contentLocale:profile.contentLocale}))}};
  const beforeCounts=pg("select json_build_object('sources',(select count(*) from source_document_revisions),'profiles',(select count(*) from knowledge_profile_revisions),'snapshots',(select count(*) from knowledge_snapshots),'approved',(select count(*) from knowledge_snapshots where state='APPROVED'),'campaigns',(select count(*) from campaigns),'agent_runs',(select count(*) from agent_runs))::text");
  docker(['restart','api']);await waitHealthy();docker(['restart','postgres','api']);await waitHealthy();
  const reopened=await json('/api/v1/local-workspace');const afterCounts=pg("select json_build_object('sources',(select count(*) from source_document_revisions),'profiles',(select count(*) from knowledge_profile_revisions),'snapshots',(select count(*) from knowledge_snapshots),'approved',(select count(*) from knowledge_snapshots where state='APPROVED'),'campaigns',(select count(*) from campaigns),'agent_runs',(select count(*) from agent_runs))::text");
  if(reopened.body.knowledge.session.currentSnapshotId!==approved.id||reopened.body.knowledge.sources.length!==5||beforeCounts!==afterCounts)throw new Error('SDD008_RESTART_DUPLICATED_OR_LOST_STATE');
  checks.apiAndPostgresRestartRestoreWithoutDuplicates=true;
  restartTranscript={schemaVersion:1,sdd:'SDD-008',classification:'PUBLIC_SAFE_SYNTHETIC',result:'PASS',sequence:['restart api','restart postgres and api','GET /api/v1/local-workspace'],beforeCounts:JSON.parse(beforeCounts),afterCounts:JSON.parse(afterCounts),restored:{sessionState:reopened.body.knowledge.session.state,currentSnapshotId:reopened.body.knowledge.session.currentSnapshotId,snapshotVersion:approved.version,snapshotDigest:approved.canonicalDigest,sourceCount:reopened.body.knowledge.sources.length},duplicateRevisionDetected:false};

  let overview=reopened.body.knowledge;const product=overview.profiles.product.payload;const versionBefore=Number(pg("select count(*) from knowledge_profile_revisions where kind='PRODUCT'"));
  const racing=await Promise.all(['A','B'].map((suffix)=>json('/api/v1/profiles/product',{method:'PUT',headers:knowledgeHeaders(overview.session.rowVersion,`race-product-${suffix}-0001`),body:JSON.stringify({...product,description:`Concurrent public-safe edit ${suffix}`})})));
  if(racing.filter((entry)=>entry.status===200).length!==1||racing.filter((entry)=>entry.status===412).length!==1||Number(pg("select count(*) from knowledge_profile_revisions where kind='PRODUCT'"))!==versionBefore+1)throw new Error('SDD008_OPTIMISTIC_CONCURRENCY_LAST_WRITE_WON');
  checks.concurrentEditReturnsSnapshotStale=true;
  overview=(await json('/api/v1/onboarding/session')).body.overview;
  const digestTamper=await json('/api/v1/knowledge/snapshots/approve',{method:'POST',headers:knowledgeHeaders(overview.session.rowVersion,'digest-tamper-0001'),body:JSON.stringify({snapshotId:overview.draft.id,canonicalDigest:'0'.repeat(64)})});
  if(digestTamper.status!==422||digestTamper.body.code!=='SNAPSHOT_APPROVAL_DIGEST_MISMATCH')throw new Error('SDD008_DIGEST_TAMPER_NOT_REJECTED');
  const secret=await json('/api/v1/profiles/accounts/X',{method:'PUT',headers:knowledgeHeaders(overview.session.rowVersion,'secret-reject-0001'),body:JSON.stringify({...x,apiKey:'sk-public-safe-test-value-123456789'})});
  if(secret.status!==422||secret.body.code!=='BROWSER_SECRET_FIELD_FORBIDDEN')throw new Error('SDD008_SECRET_FIELD_NOT_REJECTED');
  const auditText=pg("select coalesce(string_agg(redacted_metadata::text,'|'),'') from knowledge_audit_events where event_code='KNOWLEDGE_REQUEST_REJECTED'");
  if(!auditText.includes('SNAPSHOT_STALE')||!auditText.includes('SNAPSHOT_APPROVAL_DIGEST_MISMATCH')||!auditText.includes('BROWSER_SECRET_FIELD_FORBIDDEN')||auditText.includes('sk-public-safe-test-value'))throw new Error('SDD008_REJECTION_AUDIT_NOT_REDACTED');
  checks.tamperStaleAndSecretRejectionsAreRedactedInAudit=true;

  const activeSource=overview.sources[0];const blobPath=`/var/lib/lumiclaw/blobs/${activeSource.blobDigest.slice(0,2)}/${activeSource.blobDigest.slice(2)}`;
  docker(['exec','-T','api','node','-e',`require('node:fs').unlinkSync(${JSON.stringify(blobPath)})`]);
  const missingBlob=await json('/api/v1/knowledge/snapshots/approve',{method:'POST',headers:knowledgeHeaders(overview.session.rowVersion,'missing-blob-0001'),body:JSON.stringify({snapshotId:overview.draft.id,canonicalDigest:overview.draft.canonicalDigest})});
  if(missingBlob.status!==422||missingBlob.body.code!=='SOURCE_BLOB_MISSING')throw new Error('SDD008_MISSING_BLOB_APPROVAL_NOT_BLOCKED');
  const sourceFixture=sourcesForRestore(activeSource.fileName);docker(['exec','-T','api','node','--input-type=module','-e',`import {LocalContentAddressedBlobStore} from '@lumiclaw/blob-store';const store=new LocalContentAddressedBlobStore(process.env.BLOB_ROOT);await store.put(Buffer.from(${JSON.stringify(sourceFixture)},'base64'));`]);
  checks.missingBlobFailsClosed=true;
  const deleted=await json(`/api/v1/knowledge/sources/${activeSource.documentId}`,{method:'DELETE',headers:{'if-match':`"knowledge-${overview.session.rowVersion}"`,'idempotency-key':'source-delete-0001'}});
  if(deleted.status!==200||deleted.body.overview?.sources?.length!==4)throw new Error(`SDD008_SOURCE_DELETE_DID_NOT_CREATE_NEW_DRAFT:${deleted.status}:${deleted.body.code}:${deleted.body.overview?.sources?.length??'none'}`);
  const staleRole=await json(`/api/v1/knowledge/snapshots/${approved.id}/role-context`,{headers:{'x-lumiclaw-snapshot-digest':approved.canonicalDigest}});
  if(staleRole.status!==412||Number(pg(`select count(*) from knowledge_snapshot_source_bindings where snapshot_id='${approved.id}'`))!==5)throw new Error('SDD008_HISTORICAL_SNAPSHOT_OVERWRITTEN_ON_DELETE');
  checks.sourceDeleteInvalidatesCurrentButPreservesHistory=true;
  const snapshotDelete=dockerExpectedFailure(['exec','-T','postgres','psql','-U','postgres','-d','lumiclaw','-v','ON_ERROR_STOP=1','-c',`delete from knowledge_snapshots where id='${approved.id}'`]);
  const snapshotResurrect=dockerExpectedFailure(['exec','-T','postgres','psql','-U','postgres','-d','lumiclaw','-v','ON_ERROR_STOP=1','-c',`update knowledge_snapshots set state='DRAFT',approved_by=null,approved_at=null where id='${approved.id}'`]);
  const bindingDelete=dockerExpectedFailure(['exec','-T','postgres','psql','-U','postgres','-d','lumiclaw','-v','ON_ERROR_STOP=1','-c',`delete from knowledge_snapshot_source_bindings where snapshot_id='${approved.id}' and source_revision_id='${activeSource.id}'`]);
  if(snapshotDelete.status===0||!snapshotDelete.output.includes('KNOWLEDGE_SNAPSHOT_IMMUTABLE')||snapshotResurrect.status===0||!snapshotResurrect.output.includes('KNOWLEDGE_SNAPSHOT_STATE_TRANSITION_INVALID')||bindingDelete.status===0||!bindingDelete.output.includes('KNOWLEDGE_REVISION_IMMUTABLE'))throw new Error('SDD008_SNAPSHOT_OR_BINDING_IMMUTABILITY_NOT_ENFORCED');
  checks.snapshotPayloadStateApprovalAndSourceBindingsAreImmutable=true;
  const boundary=spawnSync('docker',['compose','--project-name',project,'exec','-T','postgres','psql','-U','postgres','-d','lumiclaw','-v','ON_ERROR_STOP=1','-c',`insert into knowledge_snapshot_source_bindings(owner_profile_id,snapshot_id,source_revision_id,source_digest) values('018f0000-0000-7000-8000-00000000ffff','${approved.id}','${activeSource.id}','${activeSource.blobDigest}')`],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,LUMICLAW_WEB_PORT:webPort,LUMICLAW_API_PORT:apiPort}});
  if(boundary.status===0)throw new Error('SDD008_COMPOSITE_OWNER_BOUNDARY_NOT_ENFORCED');checks.compositeOwnerSourceBoundaryEnforced=true;

  if(Number(pg('select count(*) from campaigns'))!==0||Number(pg('select count(*) from agent_runs'))!==0)throw new Error('SDD008_CREATED_CAMPAIGN_OR_AGENT_RUN');checks.noGoalCampaignAgentRunOrPlatformAction=true;
  const mainDataBeforeDown=pg("select json_build_object('documents',(select count(*) from source_documents),'revisions',(select count(*) from source_document_revisions),'snapshots',(select count(*) from knowledge_snapshots),'source_bindings',(select count(*) from knowledge_snapshot_source_bindings))::text");
  const mainDown=dockerExpectedFailure(['exec','-T','api','npm','--workspace','@lumiclaw/db','run','migrate:down','--',String(rollbackDepthThroughSdd008)]);
  const mainSchemaPreserved=pg("select to_regclass('public.knowledge_snapshots') is not null");
  const mainDataAfterDown=pg("select json_build_object('documents',(select count(*) from source_documents),'revisions',(select count(*) from source_document_revisions),'snapshots',(select count(*) from knowledge_snapshots),'source_bindings',(select count(*) from knowledge_snapshot_source_bindings))::text");
  const mainDownBlockedByLaterSdd009Authority=mainDown.output.includes('SDD009_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED');
  if(mainDown.status===0||!mainDownBlockedByLaterSdd009Authority||mainSchemaPreserved!=='t'||mainDataAfterDown!==mainDataBeforeDown)throw new Error(`SDD008_MAIN_POPULATED_DOWN_NOT_BLOCKED_BY_FIRST_LATER_AUTHORITY:${mainDown.status}:${mainSchemaPreserved}:${mainDataBeforeDown}:${mainDataAfterDown}:${mainDown.output.slice(-1200)}`);checks.populatedMainDownPreservesSchemaAndData=true;checks.mainPopulatedDownStopsAtFirstLaterAuthority=true;
  migrationManifest.mainPopulatedDown={result:'BLOCKED',stableCode:'SDD009_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED',reason:'SDD-009 context bindings created by the current SDD-008 journey are the first populated later authority encountered while walking migrations 16 through 11.',schemaAndDataPreserved:true};
  apiContractResults={schemaVersion:1,sdd:'SDD-008',classification:'PUBLIC_SAFE_SYNTHETIC',result:'PASS',contracts:[{name:'approved exact RoleContext',method:'GET',route:'/api/v1/knowledge/snapshots/:id/role-context',status:200},{name:'concurrent stale ETag',method:'PUT',route:'/api/v1/profiles/product',statuses:[200,412],stableCode:'SNAPSHOT_STALE'},{name:'digest tamper',method:'POST',route:'/api/v1/knowledge/snapshots/approve',status:422,stableCode:'SNAPSHOT_APPROVAL_DIGEST_MISMATCH'},{name:'secret-shaped account field',method:'PUT',route:'/api/v1/profiles/accounts/X',status:422,stableCode:'BROWSER_SECRET_FIELD_FORBIDDEN'},{name:'missing source blob',method:'POST',route:'/api/v1/knowledge/snapshots/approve',status:422,stableCode:'SOURCE_BLOB_MISSING'},{name:'delete source creates new draft',method:'DELETE',route:'/api/v1/knowledge/sources/:id',status:200},{name:'historical RoleContext fails stale after source change',method:'GET',route:'/api/v1/knowledge/snapshots/:id/role-context',status:412,stableCode:'SNAPSHOT_STALE'}],rejectionAudit:{redacted:true,rawSecretPresent:false},ownerBoundary:{compositeForeignKeysEnforced:true},externalActionCount:0};
  result='PASS';
}catch(error){failure=error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error);throw error;}finally{
  try{docker(['down','--volumes','--remove-orphans']);checks.cleanup=true;}catch(error){checks.cleanup=false;if(failure===null)failure=String(error);}
  const generatedAt=new Date().toISOString();
  await writeFile(evidencePath,`${JSON.stringify({schemaVersion:1,result,generatedAt,project,checks,events,failure},null,2)}\n`);
  const namedEvidence=[['migration-manifest.json',migrationManifest],['api-contract-results.json',apiContractResults],['source-snapshot-digest-manifest.json',sourceSnapshotManifest],['restart-transcript.json',restartTranscript]];
  for(const [name,value] of namedEvidence)await writeFile(path.join(path.dirname(evidencePath),name),`${JSON.stringify(value??{schemaVersion:1,sdd:'SDD-008',classification:'PUBLIC_SAFE_SYNTHETIC',result:'NOT_AVAILABLE',failure},null,2)}\n`);
  const evidenceNames=['compose-verification.json','browser-verification.json','migration-manifest.json','api-contract-results.json','source-snapshot-digest-manifest.json','restart-transcript.json','DEPENDENCY-LICENSE-REVIEW.md','01-first-open-zh.png','02-five-source-draft.png','03-structured-review-ready.png','04-approved-snapshot.png','05-approved-snapshot-en.png','06-desktop-gate.png'];
  const evidenceFiles=[];for(const name of evidenceNames){const absolute=path.join(path.dirname(evidencePath),name);const bytes=await readFile(absolute);const metadata=await stat(absolute);evidenceFiles.push({path:`docs/reports/evidence/sdd-008/${name}`,bytes:metadata.size,sha256:createHash('sha256').update(bytes).digest('hex')});}
  const runManifest={schemaVersion:1,sdd:'SDD-008',classification:'PUBLIC_SAFE_SYNTHETIC',result,generatedAt,source:{base:'001ef2e5e8e10402d93f5f3dd02fff2a1a2315c0',headAtRun:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),workingTreeDirty:true},runtime:{node:process.version,platform:process.platform,architecture:process.arch,dockerComposeProject:project},claims:{maturity:'ENGINEERING_VERIFIED',ownerUat:'PENDING',customerEvidence:false,businessOutcome:false,agentRun:false,externalAction:false},evidenceFiles};
  await writeFile(path.join(path.dirname(evidencePath),'run-manifest.json'),`${JSON.stringify(runManifest,null,2)}\n`);
  console.info(JSON.stringify({status:result,evidence:'docs/reports/evidence/sdd-008/compose-verification.json',checks:Object.keys(checks).length}));
}

function sqlLiteral(value){return `'${value.replaceAll("'","''")}'`;}
function sourcesForRestore(fileName){const match={
  'founder-voice.md':'# Founder voice\nEvidence before claims. Never guarantee growth.',
  'product-facts.md':'# Product facts\nPostgreSQL is the control-plane source of truth.',
  'brand-boundaries.txt':'The current publishing path is manual-only and Owner-gated.'
}[fileName];if(match===undefined)throw new Error('SDD008_RESTORE_FIXTURE_NOT_FOUND');return Buffer.from(match).toString('base64');}
