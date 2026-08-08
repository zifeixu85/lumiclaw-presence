import {describe, expect, it} from 'vitest';
import {createHealthPayload} from './index.js';

describe('foundation health payload', () => {
  it('cannot be mistaken for live business state', () => {
    expect(createHealthPayload('action-operator')).toEqual({
      service: 'action-operator',
      status: 'ok',
      mode: 'DEMO_SEED',
      live: false
    });
  });
});
