import {createHash} from 'node:crypto';
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.join(root, '.evidence/sdd-001');

async function readJson(relativePath) {
  const value = await readFile(path.join(evidenceRoot, relativePath), 'utf8');
  return JSON.parse(value);
}

async function assertEvidence() {
  const [api, compose, agentteams, browser, licenses, secretScan, sourcePackage, sbom] = await Promise.all([
    readJson('api-integration.json'),
    readJson('compose-verification.json'),
    readJson('agentteams-image-smoke.json'),
    readJson('browser-verification.json'),
    readJson('license-inventory.json'),
    readJson('secret-scan.json'),
    readJson('source-packages/source-package-manifest.json'),
    readJson('sbom.cdx.json')
  ]);
  const failures = [];
  if (api.result !== 'PASS' || api.cleanup !== 'PASS') failures.push('api-integration');
  if (compose.result !== 'PASS' || compose.cleanup !== 'PASS') failures.push('compose-verification');
  if (agentteams.result !== 'PASS' || agentteams.cleanup !== 'PASS' || agentteams.liveAgentTeamRun !== false) failures.push('agentteams-image-smoke');
  if (browser.result !== 'PASS' || browser.consoleErrorCount !== 0) failures.push('browser-verification');
  if (!Array.isArray(licenses.disallowed) || licenses.disallowed.length !== 0) failures.push('license-inventory');
  if (secretScan.status !== 'PASS' || !Array.isArray(secretScan.findings) || secretScan.findings.length !== 0) failures.push('secret-scan');
  if (sourcePackage.publicSafe !== true || sourcePackage.secretScan !== 'PASS') failures.push('source-package');
  if (sbom.bomFormat !== 'CycloneDX') failures.push('sbom');
  if (failures.length > 0) throw new Error(`EVIDENCE_VALIDATION_FAILED:${failures.join(',')}`);
}

async function collect(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute)));
    else if (entry.isFile() && entry.name !== 'run-manifest.json') files.push(absolute);
  }
  return files;
}

await assertEvidence();
const files = await collect(evidenceRoot);
const manifestFiles = [];
for (const file of files.sort()) {
  const value = await readFile(file);
  const metadata = await stat(file);
  manifestFiles.push({
    path: path.relative(root, file),
    bytes: metadata.size,
    sha256: createHash('sha256').update(value).digest('hex')
  });
}

const manifest = {
  schemaVersion: '1.0.0',
  sdd: 'SDD-001',
  maturity: 'ENGINEERING_VERIFIED',
  generatedAt: new Date().toISOString(),
  fixtureDisclosure: 'Synthetic/local Campaign evidence only; not customer UAT, live platform execution, or production verification.',
  validatedGates: [
    'api-integration',
    'compose-verification',
    'agentteams-image-smoke',
    'browser-verification',
    'license-inventory',
    'secret-scan',
    'source-package',
    'sbom'
  ],
  files: manifestFiles
};
await writeFile(path.join(evidenceRoot, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.info(JSON.stringify({status: 'PASS', files: manifestFiles.length}));
