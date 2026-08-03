import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const lockText = await readFile(path.join(root, 'package-lock.json'), 'utf8');
const lock = JSON.parse(lockText);
const sourceLockSha256 = createHash('sha256').update(lockText).digest('hex');
const packages = Object.entries(lock.packages ?? {})
  .filter(([location, metadata]) => location.startsWith('node_modules/') && metadata.link !== true)
  .map(([location, metadata]) => ({
    name: metadata.name ?? location.replace(/^node_modules\//u, ''),
    version: metadata.version ?? 'unknown',
    license: metadata.license ?? 'UNKNOWN',
    resolved: metadata.resolved ?? null,
    integrity: metadata.integrity ?? null,
    dev: metadata.dev === true
  }))
  .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));

const disallowedExpressions = [/\bAGPL(?:-|\b)/iu, /\bGPL(?:-|\b)/iu, /\bSSPL(?:-|\b)/iu, /\bBUSL(?:-|\b)/iu, /\bBSL-1\.1\b/iu, /\bUNKNOWN\b/iu];
const disallowed = packages.filter(({license}) => disallowedExpressions.some((expression) => expression.test(license)));
const inventory = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  source: 'package-lock.json',
  packageCount: packages.length,
  policy: 'docs/DEPENDENCY-POLICY.md',
  disallowed,
  packages
};

const evidenceDir = path.join(root, '.evidence/sdd-002');
await mkdir(evidenceDir, {recursive: true});
await writeFile(path.join(evidenceDir, 'license-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);

const summary = {
  schemaVersion: inventory.schemaVersion,
  sourceLockSha256,
  packageCount: inventory.packageCount,
  uniqueLicenses: [...new Set(packages.map(({license}) => license))].sort(),
  disallowedCount: disallowed.length,
  fullInventory: '.evidence/sdd-002/license-inventory.json'
};
await mkdir(path.join(root, 'docs/dependencies'), {recursive: true});
await writeFile(path.join(root, 'docs/dependencies/LICENSE-INVENTORY.json'), `${JSON.stringify(summary, null, 2)}\n`);

const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const workspaceLocations = Object.entries(lock.packages ?? {})
  .filter(([location, metadata]) => location !== '' && !location.startsWith('node_modules/') && metadata.name !== undefined)
  .map(([location]) => location)
  .sort();
const directPackages = new Map();
for (const [classification, dependencies] of [
  ['runtime', rootPackage.dependencies ?? {}],
  ['development', rootPackage.devDependencies ?? {}]
]) {
  for (const [name, version] of Object.entries(dependencies)) directPackages.set(name, {name, version, classification});
}
for (const location of workspaceLocations) {
  const workspacePackage = JSON.parse(await readFile(path.join(root, location, 'package.json'), 'utf8'));
  for (const [classification, dependencies] of [
    ['runtime', workspacePackage.dependencies ?? {}],
    ['development', workspacePackage.devDependencies ?? {}]
  ]) {
    for (const [name, version] of Object.entries(dependencies)) {
      if (!name.startsWith('@lumiclaw/')) directPackages.set(name, {name, version, classification});
    }
  }
}
const agentTeams = JSON.parse(await readFile(path.join(root, 'infra/agentteams/image-manifest.json'), 'utf8'));
const providers = JSON.parse(await readFile(path.join(root, 'infra/providers/provider-manifest.json'), 'utf8'));
const composeText = await readFile(path.join(root, 'compose.yml'), 'utf8');
const postgresImage = /^\s+image:\s+(postgres:[^\n]+)$/mu.exec(composeText)?.[1] ?? null;
const dockerfile = await readFile(path.join(root, 'infra/compose/Dockerfile'), 'utf8');
const nodeImages = [...dockerfile.matchAll(/^FROM\s+([^\s]+).*$/gmu)].map((match) => match[1]);
const versionManifest = {
  schemaVersion: '1.0.0',
  sourceLockSha256,
  runtime: {
    node: rootPackage.engines.node,
    npm: rootPackage.engines.npm,
    packageManager: rootPackage.packageManager,
    typescript: rootPackage.devDependencies.typescript,
    moduleSystem: 'ESM'
  },
  directPackages: [...directPackages.values()].sort((left, right) => left.name.localeCompare(right.name)),
  overrides: rootPackage.overrides ?? {},
  containers: {
    node: [...new Set(nodeImages)],
    postgres: postgresImage,
    agentTeams: agentTeams.images
  },
  externalRuntime: {
    agentTeams: {requestedVersion: agentTeams.requestedVersion, source: agentTeams.source, sourceTagCommit: agentTeams.sourceTagCommit, sourceTarSha256: agentTeams.sourceTarSha256},
    providers
  },
  lockfile: {format: lock.lockfileVersion, packages: Object.keys(lock.packages ?? {}).length}
};
await writeFile(path.join(root, 'docs/dependencies/VERSION-MANIFEST.json'), `${JSON.stringify(versionManifest, null, 2)}\n`);

if (disallowed.length > 0) {
  console.error(JSON.stringify({code: 'DEPENDENCY_LICENSE_GATE_FAILED', disallowed}, null, 2));
  process.exit(1);
}
console.info(JSON.stringify({status: 'PASS', packages: packages.length, licenses: summary.uniqueLicenses}));
