import {describe, expect, it} from 'vitest';
import {compareCatalogs} from './check-message-parity.mjs';

describe('message parity gate', () => {
  it('rejects missing, extra, and structurally mismatched keys', () => {
    expect(
      compareCatalogs(
        {Shell: {title: 'a', nested: {value: 'b'}}},
        {Shell: {title: 'a', nested: 'wrong', extra: 'x'}}
      )
    ).toEqual({
      missing: ['Shell.nested.value'],
      extra: ['Shell.extra', 'Shell.nested'],
      mismatched: []
    });
  });
});
