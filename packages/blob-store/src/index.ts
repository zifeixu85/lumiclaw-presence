import {createHash, randomUUID} from 'node:crypto';
import {mkdir, open, readFile, rename, rm, stat} from 'node:fs/promises';
import path from 'node:path';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export type BlobRef = {
  algorithm: 'sha256';
  digest: string;
  size: number;
};

export interface BlobStore {
  put(input: Uint8Array): Promise<BlobRef>;
  get(ref: BlobRef): Promise<Uint8Array>;
  has(ref: BlobRef): Promise<boolean>;
}

export class BlobIntegrityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'BlobIntegrityError';
  }
}

export class LocalContentAddressedBlobStore implements BlobStore {
  public constructor(private readonly root: string) {}

  public async put(input: Uint8Array): Promise<BlobRef> {
    const digest = sha256(input);
    const ref = {algorithm: 'sha256' as const, digest, size: input.byteLength};
    const destination = this.pathFor(ref);
    const directory = path.dirname(destination);
    await mkdir(directory, {recursive: true});

    if (await this.has(ref)) {
      return ref;
    }

    const temporary = path.join(directory, `.${digest}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(input);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, destination);
    } catch (error: unknown) {
      await handle?.close().catch(() => undefined);
      if (!(await this.has(ref))) {
        throw error;
      }
    } finally {
      await rm(temporary, {force: true});
    }

    return ref;
  }

  public async get(ref: BlobRef): Promise<Uint8Array> {
    const location = this.pathFor(ref);
    const value = await readFile(location);
    if (value.byteLength !== ref.size || sha256(value) !== ref.digest) {
      throw new BlobIntegrityError(`Blob ${ref.digest} failed size or digest verification.`);
    }
    return value;
  }

  public async has(ref: BlobRef): Promise<boolean> {
    const location = this.pathFor(ref);
    try {
      const metadata = await stat(location);
      if (!metadata.isFile() || metadata.size !== ref.size) {
        return false;
      }
      const value = await readFile(location);
      return sha256(value) === ref.digest;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  public pathFor(ref: BlobRef): string {
    validateRef(ref);
    const location = path.resolve(this.root, ref.digest.slice(0, 2), ref.digest.slice(2));
    const resolvedRoot = path.resolve(this.root);
    if (!location.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new BlobIntegrityError('Blob path escaped its configured root.');
    }
    return location;
  }
}

export function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function validateRef(ref: BlobRef): void {
  if (ref.algorithm !== 'sha256' || !SHA256_PATTERN.test(ref.digest)) {
    throw new BlobIntegrityError('Blob reference must contain a lowercase SHA-256 digest.');
  }
  if (!Number.isSafeInteger(ref.size) || ref.size < 0) {
    throw new BlobIntegrityError('Blob reference size must be a non-negative safe integer.');
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
