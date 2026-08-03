import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDirectory = path.join(root, 'apps/web/storybook-static/assets');
const candidates = (await readdir(assetsDirectory)).filter((name) => /\.stories-.*\.js$/u.test(name)).sort();
if (candidates.length < 2) throw new Error(`STORYBOOK_STORY_BUNDLE_COUNT_INVALID:${candidates.length}`);
const bundles = [];
for (const candidate of candidates) {
  const bundlePath = path.join(assetsDirectory, candidate); const bundle = await readFile(bundlePath, 'utf8');
  const forbidden = [
    ['NODE_CRYPTO', /node:crypto/u],
    ['NODE_BUFFER', /\bBuffer\.(?:alloc|from)\b/u],
    ['NODE_DIGEST_FIXTURE', /createDemoCampaignDocument|digestCampaign/u]
  ].filter(([, pattern]) => pattern.test(bundle)).map(([code]) => code);
  if (forbidden.length > 0) throw new Error(`STORYBOOK_BROWSER_UNSAFE_BUNDLE:${candidate}:${forbidden.join(',')}`);
  bundles.push({bundle: path.relative(root, bundlePath), bytes: (await stat(bundlePath)).size});
}
console.info(JSON.stringify({status: 'PASS', bundles, forbidden: []}));
