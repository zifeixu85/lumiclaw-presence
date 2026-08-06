import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {LocalContentAddressedBlobStore, type BlobRef} from './index.js';

const root = process.env.BLOB_ROOT ?? '/var/lib/lumiclaw/blobs';
const markerPath = process.env.BLOB_MARKER_PATH ?? '/tmp/lumiclaw-blob-ref.json';
const store = new LocalContentAddressedBlobStore(root);
const command = process.argv[2];

if (command === 'write') {
  const ref = await store.put(new TextEncoder().encode('SDD-000 persistence marker · DEMO_SEED / NOT_LIVE'));
  await writeFile(markerPath, `${JSON.stringify(ref)}\n`, {mode: 0o600});
  console.info(JSON.stringify(ref));
} else if (command === 'read') {
  const ref = JSON.parse(await readFile(path.resolve(markerPath), 'utf8')) as BlobRef;
  const value = await store.get(ref);
  console.info(JSON.stringify({ref, value: new TextDecoder().decode(value)}));
} else {
  throw new Error('Expected smoke command: write or read.');
}
