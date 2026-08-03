import {randomBytes} from 'node:crypto';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function createUuidV7(now = Date.now(), random: Uint8Array = randomBytes(10)): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 0xffffffffffff) {
    throw new RangeError('UUIDv7 timestamp must be a non-negative 48-bit integer.');
  }
  if (random.length !== 10) throw new RangeError('UUIDv7 requires exactly 10 random bytes.');

  const bytes = Buffer.alloc(16);
  let timestamp = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes[6] = 0x70 | (random[0]! & 0x0f);
  bytes[7] = random[1]!;
  bytes[8] = 0x80 | (random[2]! & 0x3f);
  bytes.set(random.subarray(3), 9);

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}
