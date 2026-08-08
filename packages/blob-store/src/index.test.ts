import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {BlobIntegrityError, LocalContentAddressedBlobStore} from './index.js';

const roots: string[] = [];

async function makeStore(): Promise<LocalContentAddressedBlobStore> {
  const root = await mkdtemp(path.join(tmpdir(), 'lumiclaw-blob-test-'));
  roots.push(root);
  return new LocalContentAddressedBlobStore(root);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, {recursive: true, force: true})));
});

describe('LocalContentAddressedBlobStore', () => {
  it('writes and reads deterministic idempotent content', async () => {
    const store = await makeStore();
    const input = new TextEncoder().encode('DEMO_SEED / NOT_LIVE');
    const first = await store.put(input);
    const second = await store.put(input);

    expect(second).toEqual(first);
    expect(new TextDecoder().decode(await store.get(first))).toBe('DEMO_SEED / NOT_LIVE');
  });

  it('commits concurrent identical writes atomically without temporary-file residue', async () => {
    const store = await makeStore();
    const input = new TextEncoder().encode('same immutable evidence');
    const refs = await Promise.all(Array.from({length: 8}, async () => store.put(input)));
    const [ref] = refs;

    expect(ref).toBeDefined();
    expect(refs).toEqual(Array.from({length: 8}, () => ref));
    const destination = store.pathFor(ref!);
    const entries = await readdir(path.dirname(destination));
    expect(entries).toEqual([path.basename(destination)]);
    expect(entries.some((entry) => entry.endsWith('.tmp'))).toBe(false);
  });

  it('fails closed for malformed or traversal-like references', async () => {
    const store = await makeStore();
    await expect(store.get({algorithm: 'sha256', digest: '../escape', size: 1})).rejects.toBeInstanceOf(
      BlobIntegrityError
    );
  });

  it('detects corrupted bytes at an otherwise valid address', async () => {
    const store = await makeStore();
    const ref = await store.put(new TextEncoder().encode('original'));
    const location = store.pathFor(ref);
    expect(new TextDecoder().decode(await readFile(location))).toBe('original');
    await writeFile(location, 'corrupt!');

    await expect(store.get(ref)).rejects.toBeInstanceOf(BlobIntegrityError);
    await expect(store.has(ref)).resolves.toBe(false);
  });

  it('reports a missing object without creating it', async () => {
    const store = await makeStore();
    const missing = {
      algorithm: 'sha256' as const,
      digest: '0'.repeat(64),
      size: 0
    };
    await expect(store.has(missing)).resolves.toBe(false);
    await expect(store.get(missing)).rejects.toMatchObject({code: 'ENOENT'});
  });
});
