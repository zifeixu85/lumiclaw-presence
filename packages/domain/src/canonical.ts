import {createHash} from 'node:crypto';

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
