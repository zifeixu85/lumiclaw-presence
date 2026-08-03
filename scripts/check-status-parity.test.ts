import {describe, expect, it} from 'vitest';
import {compareModuleStates, extractModuleStates} from './check-status-parity.mjs';

describe('implementation status parity gate', () => {
  it('detects a changed state without modifying either document', () => {
    const left = extractModuleStates('| M0-03 | Work | `IN_PROGRESS` |');
    const right = extractModuleStates('| M0-03 | 工作 | `EVIDENCE_READY` |');
    expect(compareModuleStates(left, right)).toEqual([
      {id: 'M0-03', english: 'IN_PROGRESS', chinese: 'EVIDENCE_READY'}
    ]);
  });
});
