import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';

const evidenceDirectory=path.resolve('docs/reports/evidence/sdd-012');
await mkdir(evidenceDirectory,{recursive:true});
const canary={
  schemaVersion:1,
  sdd:'SDD-012',
  classification:'PUBLIC_SAFE_SYNTHETIC',
  result:'PENDING',
  status:'NOT_RUN_NO_KEY',
  reason:'Owner media-provider Secret and approved spend were not provided to this Executor.',
  providerEvidence:false,
  ownerVisualUat:'PENDING',
  secretCaptured:false,
  signedUrlCaptured:false,
  rawProviderBodyCaptured:false,
  externalActionCount:0
};
await writeFile(path.join(evidenceDirectory,'real-provider-canary.json'),`${JSON.stringify(canary,null,2)}\n`);

const publicNames=[
  'media-golden-package.json',
  'postgres-verification.json',
  'fault-security-compositor-matrix.json',
  'browser-verification.json',
  'compose-verification.json',
  'real-provider-canary.json',
  'DEPENDENCY-LICENSE-REVIEW.md',
  '01-governed-final-preview-zh.png',
  '02-controlled-audit-blocked-zh.png',
  '03-controlled-audit-blocked-en.png',
  '04-desktop-gate.png',
  '05-engineering-visual-confirmed-zh.png',
  '06-engineering-package-ready-zh.png'
];
const evidenceFiles=[];
for(const name of publicNames){
  const absolute=path.join(evidenceDirectory,name);const bytes=await readFile(absolute);
  evidenceFiles.push({path:`docs/reports/evidence/sdd-012/${name}`,bytes:(await stat(absolute)).size,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const assetNames=['assets/media/ASSET-MANIFEST.json','assets/media/fonts/NotoSansSC-Regular.otf','assets/media/fonts/OFL-NotoSansCJK.txt','assets/media/templates/editorial-panel-v1.json','assets/media/logo/lumiclaw-mark-v1.svg'];
const assetFiles=[];
for(const name of assetNames){const bytes=await readFile(name);assetFiles.push({path:name,bytes:(await stat(name)).size,sha256:createHash('sha256').update(bytes).digest('hex')});}
const ephemeralFiles=[];
for(const name of ['.evidence/sdd-012/license-inventory.json','.evidence/sdd-012/sbom.cdx.json']){const bytes=await readFile(name);ephemeralFiles.push({path:name,bytes:(await stat(name)).size,sha256:createHash('sha256').update(bytes).digest('hex')});}

const manifest={
  schemaVersion:1,
  sdd:'SDD-012',
  classification:'PUBLIC_SAFE_SYNTHETIC',
  result:'PASS_WITH_OWNER_UAT_PENDING',
  generatedAt:new Date().toISOString(),
  source:{base:'a2c37deaca20b1eb31616bb6eb4f56436dcd3db3',headAtRun:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),workingTreeDirty:true},
  claims:{maturity:'ENGINEERING_VERIFIED_RECEIPT_PLUMBING_REAL_A5_PENDING',ownerUat:'PENDING',realProviderCanary:'NOT_RUN_NO_KEY',controlledFakeEngineering:true,controlledAuditEvidence:'CONTROLLED_FIXTURE',agentTeamsAuditExecuted:false,authoritativeAuditReceipt:false,authoritativePackageGenerated:false,nextState:'WAITING_FOR_REAL_DEEPSEEK_MEDIA_A5_OWNER_UAT',providerEvidence:false,customerEvidence:false,businessOutcome:false,productionReady:false,platformCompliance:false,externalActionCount:0},
  evidenceFiles,
  assetFiles,
  ephemeralCiEvidence:ephemeralFiles
};
await writeFile(path.join(evidenceDirectory,'run-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
console.info(JSON.stringify({status:'PASS',publicEvidenceFiles:evidenceFiles.length,assetFiles:assetFiles.length,ephemeralFiles:ephemeralFiles.length,evidence:'docs/reports/evidence/sdd-012/run-manifest.json'}));
