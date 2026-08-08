import {describe, expect, it} from 'vitest';
import {LiveRuntimeTicketStore} from './live-runtime-security.js';

const bootstrap = 'public-safe-conformance-bootstrap-value-0001';
const binding = {missionId: 'mission-1', campaignDigest: 'a'.repeat(64), action: 'MODEL_GENERATE' as const, roleId: 'independent-auditor', taskId: 'task-1', attempt: 1};

describe('Live Runtime scoped tickets', () => {
  it('is disabled without a secret and never accepts an arbitrary bootstrap', () => {
    const store = new LiveRuntimeTicketStore(undefined);
    expect(store.enabled).toBe(false);
    expect(() => store.issue(bootstrap, binding)).toThrowError(expect.objectContaining({code: 'LIVE_RUNTIME_BOOTSTRAP_UNAVAILABLE'}));
  });

  it('binds one Mission/role/Task/attempt/action and rejects reuse or cross-scope use', () => {
    const store = new LiveRuntimeTicketStore(bootstrap);
    const first = store.issue(bootstrap, binding);
    expect(() => store.consume(first.ticket, {...binding, roleId: 'founder-identity-producer'})).toThrowError(expect.objectContaining({code: 'LIVE_RUNTIME_TICKET_SCOPE_MISMATCH'}));
    expect(() => store.consume(first.ticket, binding)).toThrowError(expect.objectContaining({code: 'LIVE_RUNTIME_TICKET_REUSED'}));
    const second = store.issue(bootstrap, binding);
    store.consume(second.ticket, binding);
    expect(() => store.consume(second.ticket, binding)).toThrowError(expect.objectContaining({code: 'LIVE_RUNTIME_TICKET_REUSED'}));
  });

  it('expires tickets and rejects a wrong bootstrap without disclosing either value', () => {
    let clock = 0; const store = new LiveRuntimeTicketStore(bootstrap, () => clock);
    expect(() => store.issue('wrong-bootstrap-value-that-is-long-enough-0001', binding)).toThrowError(expect.objectContaining({code: 'LIVE_RUNTIME_BOOTSTRAP_INVALID'}));
    const issued = store.issue(bootstrap, binding); clock = 10 * 60_000 + 1;
    expect(() => store.consume(issued.ticket, binding)).toThrowError(expect.objectContaining({code: 'LIVE_RUNTIME_TICKET_EXPIRED_OR_UNKNOWN'}));
  });
});
