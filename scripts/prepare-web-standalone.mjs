import {cp, mkdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(root, 'apps/web');
const standaloneRoot = path.join(webRoot, '.next/standalone/apps/web');

await copyDirectory(path.join(webRoot, '.next/static'), path.join(standaloneRoot, '.next/static'));

const publicRoot = path.join(webRoot, 'public');
if (await isDirectory(publicRoot)) {
  await copyDirectory(publicRoot, path.join(standaloneRoot, 'public'));
}

console.info('Prepared standalone Web static and public assets.');

async function copyDirectory(source, destination) {
  for (const candidate of [source, destination]) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Refusing to copy a path outside the repository: ${resolved}`);
    }
  }
  await mkdir(path.dirname(destination), {recursive: true});
  await cp(source, destination, {recursive: true, force: true});
}

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}
