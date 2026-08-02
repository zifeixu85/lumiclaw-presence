import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const topLevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: root, encoding: 'utf8'}).trim();
if (path.resolve(topLevel) !== root) throw new Error('Run source packaging from the Git worktree root.');

execFileSync(process.execPath, ['scripts/secret-scan.mjs'], {cwd: root, stdio: 'pipe'});

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
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

const evidenceRoot = path.join(root, '.evidence/sdd-000/source-packages');
const archive = path.join(evidenceRoot, 'lumiclaw-presence-sdd-000-source.zip');
const manifestPath = path.join(evidenceRoot, 'source-package-manifest.json');
await mkdir(evidenceRoot, {recursive: true});
await rm(archive, {force: true});

const zip = spawnSync('zip', ['-q', archive, '-@'], {
  cwd: root,
  encoding: 'utf8',
  input: `${files.join('\n')}\n`
});
if (zip.status !== 0) throw new Error(`zip failed: ${zip.stderr || zip.stdout}`);

const archiveBytes = await readFile(archive);
const archiveStat = await stat(archive);
const manifest = {
  schemaVersion: '1.0.0',
  sdd: 'SDD-000',
  base: '5acc7cd508f07fdeabe74e39e366158bf58463f6',
  head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
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
