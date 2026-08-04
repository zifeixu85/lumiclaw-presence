import {createHash} from 'node:crypto';

const exactKeys = ['bootstrap', 'campaignDigest', 'missionId', 'organizationId'];
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const bootstrapPattern = /^[A-Za-z0-9_-]{32,128}$/u;

export class LiveUatTransportError extends Error {
  constructor() {
    super('LIVE_UAT_TRANSPORT_INVALID');
    this.name = 'LiveUatTransportError';
    this.code = 'LIVE_UAT_TRANSPORT_INVALID';
  }
}

export function parseLiveUatTransport(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') === 0 || Buffer.byteLength(raw, 'utf8') > 4096) throw new LiveUatTransportError();
  let value;
  try { value = JSON.parse(raw); } catch { throw new LiveUatTransportError(); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new LiveUatTransportError();
  const keys = Object.keys(value).sort();
  if (keys.length !== exactKeys.length || keys.some((key, index) => key !== exactKeys[index])) throw new LiveUatTransportError();
  const {organizationId, missionId, campaignDigest, bootstrap} = value;
  if (typeof organizationId !== 'string' || !uuidPattern.test(organizationId)
    || typeof missionId !== 'string' || !uuidPattern.test(missionId)
    || typeof campaignDigest !== 'string' || !digestPattern.test(campaignDigest)
    || typeof bootstrap !== 'string' || !bootstrapPattern.test(bootstrap)) throw new LiveUatTransportError();
  return {organizationId, missionId, campaignDigest, bootstrap};
}

export function serializeLiveUatTransport(value) {
  const parsed = parseLiveUatTransport(JSON.stringify(value));
  return `${JSON.stringify(parsed)}\n`;
}

export function createRedactedTransportReceipt(value) {
  return {
    status: 'PASS',
    mode: 'LIVE_UAT_STDIN_TRANSPORT_CONFORMANCE',
    fieldCount: 4,
    nestedChildProcess: true,
    fieldDigests: {
      organizationId: digest(value.organizationId),
      missionId: digest(value.missionId),
      campaignDigest: digest(value.campaignDigest),
      bootstrap: digest(value.bootstrap)
    },
    secretPresent: false
  };
}

export function isRedactedTransportReceipt(value) {
  return value?.status === 'PASS'
    && value?.mode === 'LIVE_UAT_STDIN_TRANSPORT_CONFORMANCE'
    && value?.fieldCount === 4
    && value?.nestedChildProcess === true
    && value?.secretPresent === false
    && value?.fieldDigests !== null
    && typeof value.fieldDigests === 'object'
    && Object.keys(value.fieldDigests).sort().join(',') === 'bootstrap,campaignDigest,missionId,organizationId'
    && Object.values(value.fieldDigests).every((entry) => typeof entry === 'string' && digestPattern.test(entry));
}

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
