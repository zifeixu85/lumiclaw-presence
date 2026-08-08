import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';

export type LiveTicketAction = 'PROJECT_DISPATCH' | 'TASK_ACK' | 'MODEL_GENERATE' | 'TASK_SUBMIT' | 'FINALIZE' | 'FAIL';
export type LiveTicketBinding = {
  missionId: string;
  campaignDigest: string;
  action: LiveTicketAction;
  roleId: string | null;
  taskId: string | null;
  attempt: number | null;
};

type TicketRecord = LiveTicketBinding & {digest: string; expiresAt: number; used: boolean};

export class LiveRuntimeTicketStore {
  readonly #bootstrapDigest: string | null;
  readonly #tickets = new Map<string, TicketRecord>();
  readonly #now: () => number;

  constructor(bootstrapSecret: string | undefined, now: () => number = () => Date.now()) {
    this.#bootstrapDigest = bootstrapSecret === undefined || bootstrapSecret.length < 32 ? null : hash(bootstrapSecret);
    this.#now = now;
  }

  get enabled(): boolean { return this.#bootstrapDigest !== null; }

  issue(bootstrapSecret: string, binding: LiveTicketBinding): {ticket: string; expiresAt: string} {
    if (this.#bootstrapDigest === null) throw new LiveTicketError('LIVE_RUNTIME_BOOTSTRAP_UNAVAILABLE');
    if (!constantTimeEqual(hash(bootstrapSecret), this.#bootstrapDigest)) throw new LiveTicketError('LIVE_RUNTIME_BOOTSTRAP_INVALID');
    const value = randomBytes(32).toString('base64url');
    const digest = hash(value); const expiresAt = this.#now() + 10 * 60_000;
    this.#tickets.set(digest, {...structuredClone(binding), digest, expiresAt, used: false});
    this.#purge();
    return {ticket: value, expiresAt: new Date(expiresAt).toISOString()};
  }

  consume(ticket: string, expected: LiveTicketBinding): void {
    if (ticket.length < 32) throw new LiveTicketError('LIVE_RUNTIME_TICKET_REQUIRED');
    const digest = hash(ticket); const record = this.#tickets.get(digest);
    if (record === undefined || record.expiresAt <= this.#now()) throw new LiveTicketError('LIVE_RUNTIME_TICKET_EXPIRED_OR_UNKNOWN');
    if (record.used) throw new LiveTicketError('LIVE_RUNTIME_TICKET_REUSED');
    const scopeMatches = hash({...record, used: false}) === hash({...structuredClone(expected), digest: record.digest, expiresAt: record.expiresAt, used: false});
    record.used = true;
    if (!scopeMatches) throw new LiveTicketError('LIVE_RUNTIME_TICKET_SCOPE_MISMATCH');
  }

  #purge(): void {
    const threshold = this.#now() - 60_000;
    for (const [key, record] of this.#tickets) if (record.expiresAt < threshold) this.#tickets.delete(key);
  }
}

export class LiveTicketError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'LiveTicketError'; }
}

export function readComposeSecret(path: '/run/secrets/deepseek_api_key' | '/run/secrets/lumiclaw_runtime_broker_bootstrap' | '/run/secrets/lumiclaw_runtime_import_token'): string | undefined {
  try {
    const value = readFileSync(path, 'utf8').trim();
    return value.length >= 32 ? value : undefined;
  } catch { return undefined; }
}

function hash(value: unknown): string { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex'); }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  return value;
}
function constantTimeEqual(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
