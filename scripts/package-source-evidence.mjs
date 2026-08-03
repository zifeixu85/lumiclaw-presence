import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const topLevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: root, encoding: 'utf8'}).trim();
if (path.resolve(topLevel) !== root) throw new Error('Run source packaging from the Git worktree root.');

execFileSync(process.execPath, ['scripts/secret-scan.mjs'], {cwd: root, stdio: 'pipe'});

const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', head], {
  cwd: root,
  encoding: 'utf8'
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort((left, right) => left.localeCompare(right, 'en'));

const forbidden = files.filter((file) =>
  /(^|\/)(?:\.git|node_modules|\.evidence|\.next|dist|storybook-static|private|references)(?:\/|$)|(^|\/)\.env(?:\.|$)|\.(?:key|pem|p12|log)$/u.test(file)
);
if (forbidden.length > 0) throw new Error(`Refusing to package forbidden paths: ${forbidden.join(', ')}`);

const evidenceRoot = path.join(root, '.evidence/sdd-001/source-packages');
const archive = path.join(evidenceRoot, 'lumiclaw-presence-sdd-001-source.zip');
const manifestPath = path.join(evidenceRoot, 'source-package-manifest.json');
await mkdir(evidenceRoot, {recursive: true});
await rm(archive, {force: true});

execFileSync('git', ['archive', '--format=zip', `--output=${archive}`, head], {
  cwd: root,
  stdio: 'pipe'
});

const archiveBytes = await readFile(archive);
const archiveStat = await stat(archive);
const manifest = {
  schemaVersion: '1.0.0',
  sdd: 'SDD-001',
  taskId: '019fc6d8-2c5a-76d3-b3ad-ddb96b56f62e',
  base: '4568277f9dc8e302141b93bb38ded20200fb31a9',
  head,
  sourceRevision: head,
  workingTreeSnapshot: false,
  branch: execFileSync('git', ['branch', '--show-current'], {cwd: root, encoding: 'utf8'}).trim(),
  worktree: root,
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  secretScan: 'PASS',
  exclusions: ['credentials', 'runtime state', 'private data', 'references', 'node_modules', 'build output', '.git'],
  archive: path.relative(root, archive),
  fileCount: files.length,
  bytes: archiveStat.size,
  sha256: createHash('sha256').update(archiveBytes).digest('hex'),
  files
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.info(JSON.stringify({status: 'PASS', archive: manifest.archive, fileCount: files.length, bytes: archiveStat.size, sha256: manifest.sha256}));
