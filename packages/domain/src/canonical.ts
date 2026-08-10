import {createHash, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject} from 'node:crypto';

export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};

export function canonicalize(value: unknown): string {
  return serialize(value, '$');
}

export function sha256Digest(value: unknown): string {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

function serialize(value: unknown, path: string): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}.`);
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map((item, index) => serialize(item, `${path}[${index}]`)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => {
      const entry = record[key];
      if (entry === undefined) throw new TypeError(`Undefined value at ${path}.${key}.`);
      return `${JSON.stringify(key)}:${serialize(entry, `${path}.${key}`)}`;
    }).join(',')}}`;
  }
  throw new TypeError(`Unsupported canonical value at ${path}.`);
}

// ---------------------------------------------------------------------------
// Ed25519 — used for ActionGrant owner signatures
// ---------------------------------------------------------------------------

/** Generate a demo Ed25519 key pair. Intended for DEMO_SEED mode only. */
export function generateEd25519KeyPair(): {publicKey: KeyObject; privateKey: KeyObject} {
  return generateKeyPairSync('ed25519');
}

/**
 * Export an Ed25519 public key to a compact base64url string
 * (SPKI DER → base64url).  Suitable for embedding in ActionGrant.
 */
export function exportEd25519PublicKey(publicKey: KeyObject): string {
  return publicKey.export({type: 'spki', format: 'der'}).toString('base64url');
}

/**
 * Import an Ed25519 public key from the compact base64url form
 * produced by {@link exportEd25519PublicKey}.
 */
export function importEd25519PublicKey(encoded: string): KeyObject {
  return createPublicKey({
    key: Buffer.from(encoded, 'base64url'),
    format: 'der',
    type: 'spki',
  });
}

/**
 * Create an Ed25519 signature over `message` (typically the SHA-256 grant digest).
 * Returns base64url-encoded signature.
 */
export function ed25519Sign(privateKey: KeyObject, message: string): string {
  return sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64url');
}

/**
 * Verify an Ed25519 signature against the original message.
 * Returns true when the signature is valid for the given public key.
 */
export function ed25519Verify(publicKey: KeyObject, message: string, signature: string): boolean {
  return verify(null, Buffer.from(message, 'utf8'), publicKey, Buffer.from(signature, 'base64url'));
}

/**
 * Compute a stable key identifier from an Ed25519 public key.
 * Uses SHA-256 of the SPKI DER encoding so the keyId is a
 * collision-resistant fingerprint of the actual key material.
 */
export function computeOwnerKeyId(publicKey: KeyObject): string {
  return createHash('sha256').update(publicKey.export({type: 'spki', format: 'der'})).digest('hex');
}
