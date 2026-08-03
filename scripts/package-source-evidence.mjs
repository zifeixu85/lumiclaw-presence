import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const topLevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: root, encoding: 'utf8'}).trim();
if (path.resolve(topLevel) !== root) throw new Error('Run source packaging from the Git worktree root.');
const worktreeStatus = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {cwd: root, encoding: 'utf8'}).trim();
if (worktreeStatus !== '') throw new Error('Refusing to package a dirty Worktree. Commit the exact reviewed source first.');

execFileSync(process.execPath, ['scripts/secret-scan.mjs'], {cwd: root, stdio: 'pipe'});

const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const tree = execFileSync('git', ['ls-tree', '-r', head], {
  cwd: root,
  encoding: 'utf8'
})
  .trim()
  .split('\n')
  .filter(Boolean);
const symlinks = tree.filter((entry) => entry.startsWith('120000 '));
if (symlinks.length > 0) throw new Error(`Refusing to package symbolic links: ${symlinks.join(', ')}`);
const files = tree
  .map((entry) => entry.slice(entry.indexOf('\t') + 1))
  .sort((left, right) => left.localeCompare(right, 'en'));

const forbidden = files.filter((file) =>
  /(^|\/)(?:\.git|node_modules|\.evidence|\.next|\.runtime|\.cache|\.turbo|coverage|dist|build|out|output|tmp|storybook-static|private|references|browser-state|database-state)(?:\/|$)|(^|\/)\.env(?:\.|$)|\.(?:key|pem|p12|log|sqlite|sqlite3|db)$/u.test(file)
);
if (forbidden.length > 0) throw new Error(`Refusing to package forbidden paths: ${forbidden.join(', ')}`);

const evidenceRoot = path.join(root, '.evidence/sdd-002/source-packages');
const archive = path.join(evidenceRoot, 'lumiclaw-presence-sdd-002-source.zip');
const manifestPath = path.join(evidenceRoot, 'source-package-manifest.json');
await mkdir(evidenceRoot, {recursive: true});
await rm(archive, {force: true});

execFileSync('git', ['archive', '--format=zip', `--output=${archive}`, head], {
  cwd: root,
  stdio: 'pipe'
});
execFileSync('unzip', ['-t', archive], {cwd: root, stdio: 'pipe'});
const archiveEntries = execFileSync('unzip', ['-Z1', archive], {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(Boolean);
const unsafeArchiveEntries = archiveEntries.filter((entry) => {
  const normalized = entry.endsWith('/') ? entry.slice(0, -1) : entry;
  return normalized.length === 0 || path.isAbsolute(normalized) || normalized.includes('\\') || normalized.split('/').some((segment) => segment === '..' || segment === '');
});
if (unsafeArchiveEntries.length > 0) throw new Error(`Refusing unsafe ZIP paths: ${unsafeArchiveEntries.join(', ')}`);
const archiveFiles = archiveEntries.filter((entry) => !entry.endsWith('/'));
if (archiveFiles.length !== files.length) throw new Error(`ZIP file count ${archiveFiles.length} does not match Git tree count ${files.length}.`);
const archiveFileSet = new Set(archiveFiles);
const archiveMismatch = files.filter((file) => !archiveFileSet.has(file));
if (archiveMismatch.length > 0) throw new Error(`ZIP is missing Git tree files: ${archiveMismatch.join(', ')}`);

const archiveBytes = await readFile(archive);
const archiveStat = await stat(archive);
const manifest = {
  schemaVersion: '1.0.0',
  sdd: 'SDD-002',
  taskId: 'SDD-002-EXECUTOR',
  base: '4377103b3fea493a591af7f069fd697d9601f1ca',
  head,
  sourceRevision: head,
  workingTreeSnapshot: false,
  branch: execFileSync('git', ['branch', '--show-current'], {cwd: root, encoding: 'utf8'}).trim(),
  worktree: root,
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  secretScan: 'PASS',
  pathScan: 'PASS',
  archiveCrcTest: 'PASS',
  symlinkCount: 0,
  exclusions: ['credentials', 'runtime state', 'browser state', 'database state', 'private data', 'references', 'node_modules', 'build/cache output', '.git'],
  archive: path.relative(root, archive),
  fileCount: files.length,
  bytes: archiveStat.size,
  sha256: createHash('sha256').update(archiveBytes).digest('hex'),
  files
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.info(JSON.stringify({status: 'PASS', archive: manifest.archive, fileCount: files.length, bytes: archiveStat.size, sha256: manifest.sha256}));
