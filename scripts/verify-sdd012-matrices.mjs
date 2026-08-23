import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const privateEvidenceDirectory=path.resolve('.evidence/sdd-012');
const publicEvidenceDirectory=path.resolve('docs/reports/evidence/sdd-012');
const rawResultPath=path.join(privateEvidenceDirectory,'matrix-vitest.json');
await mkdir(privateEvidenceDirectory,{recursive:true});
await mkdir(publicEvidenceDirectory,{recursive:true});

const files=[
  'packages/domain/src/media-artifact.test.ts',
  'packages/providers/src/media-integration.test.ts',
  'scripts/media-provider-secret-cli.test.ts'
];
const command=['vitest','run',...files,'--configLoader=runner','--reporter=json',`--outputFile=${rawResultPath}`];
const run=spawnSync('npx',command,{cwd:process.cwd(),encoding:'utf8',timeout:300_000});
if(run.status!==0)throw new Error(`SDD012_MATRIX_TESTS_FAILED\n${run.stdout}\n${run.stderr}`);

const raw=JSON.parse(await readFile(rawResultPath,'utf8'));
const assertions=raw.testResults.flatMap((testFile)=>testFile.assertionResults.map((assertion)=>({
  file:path.relative(process.cwd(),testFile.name),
  title:[...assertion.ancestorTitles,assertion.title].join(' > '),
  status:assertion.status
})));
const requireMatches=(patterns)=>patterns.map((pattern)=>{
  const matches=assertions.filter((assertion)=>pattern.test(assertion.title));
  if(matches.length===0||matches.some((assertion)=>assertion.status!=='passed'))throw new Error(`SDD012_MATRIX_ASSERTION_MISSING_OR_FAILED:${pattern}`);
  return matches.map((assertion)=>assertion.title);
}).flat();

const matrix={
  providerNeutralAndUnknownCharge:requireMatches([/provider-neutral media contracts/u,/submission intent before the billable call/u,/timeout-before-task-id to UNKNOWN/u,/polls the same task/u]),
  secureDownloaderAndBlob:requireMatches([/rejects empty bytes/u,/rejects html bytes/u,/rejects svg bytes/u,/blocks credentials, HTTP and private addresses, detects DNS drift, and pins the reviewed transport address/u,/bounded safe redirects/u]),
  deterministicCompositor:requireMatches([/reviewed, content-addressed OFL font/u,/renders exact overlay deterministically/u,/fails closed for emoji/u,/fails closed for missing glyph/u,/fails closed for overflow/u]),
  governanceAndTamper:requireMatches([/Owner NO_OVERLAY/u,/Producer\/Auditor separation/u,/invalidates audit, decision and package lineage/u,/deterministic binary ZIP and rejects digest mismatches/u]),
  isolatedSecretGate:requireMatches([/terminal-only isolated media Provider Secret gate/u,/MODEL_PROVIDER scope/u,/rejects symlink roots/u])
};
const result={
  schemaVersion:1,
  sdd:'SDD-012',
  classification:'PUBLIC_SAFE_SYNTHETIC',
  result:'PASS',
  generatedAt:new Date().toISOString(),
  command:['npx',...command.filter((value)=>!value.startsWith('--outputFile='))],
  testFiles:files,
  tests:{total:raw.numTotalTests,passed:raw.numPassedTests,failed:raw.numFailedTests,pending:raw.numPendingTests},
  matrix,
  claims:{providerEvidence:false,externalActionCount:0}
};
await writeFile(path.join(publicEvidenceDirectory,'fault-security-compositor-matrix.json'),`${JSON.stringify(result,null,2)}\n`);
console.info(JSON.stringify({status:'PASS',tests:result.tests,evidence:'docs/reports/evidence/sdd-012/fault-security-compositor-matrix.json'}));
