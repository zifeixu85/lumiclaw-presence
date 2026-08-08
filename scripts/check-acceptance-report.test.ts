import {describe, expect, it} from 'vitest';
import {checkAcceptanceReport} from './check-acceptance-report.mjs';

describe('acceptance report gate', () => {
  it('rejects a conversational completion claim without evidence structure', () => {
    const result = checkAcceptanceReport('# Done\nEverything passed.');
    expect(result.missingHeadings.length).toBeGreaterThan(0);
    expect(result.missingCriteria).toContain('AC-01');
    expect(result.missingTerms).toContain('Rollback');
  });
});
