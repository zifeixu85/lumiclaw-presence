import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.join(root, '.evidence/sdd-002');
const output = path.join(evidenceRoot, 'sbom.cdx.json');
await mkdir(evidenceRoot, {recursive: true});
execFileSync(path.join(root, 'node_modules/.bin/cyclonedx-npm'), ['--output-file', output, '--output-format', 'JSON'], {cwd: root, stdio: 'pipe'});

const [lockText, inventoryText, sbomText] = await Promise.all([
  readFile(path.join(root, 'package-lock.json'), 'utf8'),
  readFile(path.join(evidenceRoot, 'license-inventory.json'), 'utf8'),
  readFile(output, 'utf8')
]);
const sourceLockSha256 = createHash('sha256').update(lockText).digest('hex');
const inventory = JSON.parse(inventoryText);
if (inventory.status !== 'PASS' || inventory.sourceLockSha256 !== sourceLockSha256 || inventory.packageCount !== inventory.packages?.length) throw new Error('SBOM_INVENTORY_PROVENANCE_INVALID');
const sbom = JSON.parse(sbomText);
const existing = Array.isArray(sbom.metadata?.component?.properties) ? sbom.metadata.component.properties : [];
sbom.metadata.component.properties = [
  ...existing.filter((property) => !String(property?.name).startsWith('lumiclaw:')),
  {name: 'lumiclaw:source-lock-sha256', value: sourceLockSha256},
  {name: 'lumiclaw:license-inventory-package-count', value: String(inventory.packageCount)},
  {name: 'lumiclaw:license-inventory-path', value: '.evidence/sdd-002/license-inventory.json'}
];
await writeFile(output, `${JSON.stringify(sbom, null, 2)}\n`);
console.info(JSON.stringify({status: 'PASS', bomFormat: sbom.bomFormat, specVersion: sbom.specVersion, components: sbom.components?.length ?? 0, sourceLockSha256}));
