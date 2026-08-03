import {readFile} from 'node:fs/promises';
import path from 'node:path';

export function flattenMessages(value, prefix = '') {
  if (typeof value === 'string') return [[prefix, 'string']];
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return [[prefix, typeof value]];
  }
  return Object.entries(value).flatMap(([key, nested]) =>
    flattenMessages(nested, prefix === '' ? key : `${prefix}.${key}`)
  );
}

export function compareCatalogs(defaultCatalog, candidateCatalog) {
  const expected = new Map(flattenMessages(defaultCatalog));
  const actual = new Map(flattenMessages(candidateCatalog));
  const missing = [...expected.keys()].filter((key) => !actual.has(key));
  const extra = [...actual.keys()].filter((key) => !expected.has(key));
  const mismatched = [...expected.entries()]
    .filter(([key, type]) => actual.has(key) && actual.get(key) !== type)
    .map(([key]) => key);
  return {missing: missing.sort(), extra: extra.sort(), mismatched: mismatched.sort()};
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const root = process.cwd();
  const zh = JSON.parse(await readFile(path.join(root, 'apps/web/messages/zh-CN.json'), 'utf8'));
  const en = JSON.parse(await readFile(path.join(root, 'apps/web/messages/en.json'), 'utf8'));
  const result = compareCatalogs(zh, en);
  if (Object.values(result).some((items) => items.length > 0)) {
    console.error(JSON.stringify({code: 'MESSAGE_CATALOG_PARITY_FAILED', ...result}, null, 2));
    process.exit(1);
  }
  console.info(JSON.stringify({status: 'PASS', keys: flattenMessages(zh).length, locales: ['zh-CN', 'en']}));
}
