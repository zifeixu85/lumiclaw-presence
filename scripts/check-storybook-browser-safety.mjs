import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDirectory = path.join(root, 'apps/web/storybook-static/assets');
const candidates = (await readdir(assetsDirectory)).filter((name) => /^platform-preview\.stories-.*\.js$/u.test(name));
if (candidates.length !== 1) throw new Error(`STORYBOOK_PLATFORM_BUNDLE_COUNT_INVALID:${candidates.length}`);

const bundlePath = path.join(assetsDirectory, candidates[0]);
const bundle = await readFile(bundlePath, 'utf8');
const forbidden = [
  ['NODE_CRYPTO', /node:crypto/u],
  ['NODE_BUFFER', /\bBuffer\.(?:alloc|from)\b/u],
  ['NODE_DIGEST_FIXTURE', /createDemoCampaignDocument|digestCampaign/u]
].filter(([, pattern]) => pattern.test(bundle)).map(([code]) => code);
if (forbidden.length > 0) throw new Error(`STORYBOOK_BROWSER_UNSAFE_BUNDLE:${forbidden.join(',')}`);

console.info(JSON.stringify({status: 'PASS', bundle: path.relative(root, bundlePath), bytes: (await stat(bundlePath)).size, forbidden: []}));
