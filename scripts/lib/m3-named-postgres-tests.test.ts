import {describe, expect, it} from 'vitest';
import {
  requiredM3PostgresTests,
  verifyNamedEvidenceBinding,
  verifyNamedPostgresTests,
} from './m3-named-postgres-tests.mjs';

const file = 'C:/repo/packages/db/src/action-repository.test.ts';
const assertion = (id: string, status = 'passed') => ({
  ancestorTitles: ['PostgreSQL ActionRepository'],
  fullName: `PostgreSQL ActionRepository [${id}] adversarial behavior`,
  status,
  title: `[${id}] adversarial behavior`,
  duration: 1,
  failureMessages: [],
});
const reporter = (assertions = Object.values(requiredM3PostgresTests).map((id) => assertion(id)), name = file) => ({
  success: assertions.every((item) => item.status === 'passed'),
  numFailedTests: assertions.filter((item) => item.status === 'failed').length,
  numPendingTests: assertions.filter((item) => item.status === 'pending').length,
  numTodoTests: assertions.filter((item) => item.status === 'todo').length,
  testResults: [{name, status: 'passed', assertionResults: assertions}],
});

describe('M3 named PostgreSQL evidence parser', () => {
  it('binds each required ID to one executed passing assertion', () => {
    const result = verifyNamedPostgresTests(reporter());
    expect(result.status).toBe('PASS');
    expect(Object.keys(result.tests)).toEqual(Object.keys(requiredM3PostgresTests));
    expect(Object.values(result.tests).every((item) => item.executed && item.status === 'PASS')).toBe(true);
  });

  it('fails when a required test is missing', () => {
    const assertions = Object.values(requiredM3PostgresTests).slice(1).map((id) => assertion(id));
    expect(() => verifyNamedPostgresTests(reporter(assertions))).toThrow(/appeared 0 times/);
  });

  it.each(['pending', 'todo', 'failed'])('fails when a required test is %s', (status) => {
    const ids = Object.values(requiredM3PostgresTests);
    const assertions = ids.map((id, index) => assertion(id, index === 0 ? status : 'passed'));
    expect(() => verifyNamedPostgresTests(reporter(assertions))).toThrow();
  });

  it('fails when a required ID is duplicated', () => {
    const assertions = Object.values(requiredM3PostgresTests).map((id) => assertion(id));
    assertions.push(assertion(requiredM3PostgresTests.postClaimRevoke));
    expect(() => verifyNamedPostgresTests(reporter(assertions))).toThrow(/appeared 2 times/);
  });

  it('fails when the required tests come from another file', () => {
    expect(() => verifyNamedPostgresTests(reporter(undefined, 'C:/repo/test/decoy.test.ts'))).toThrow(/unexpected file/);
  });

  it('fails on malformed reporter data', () => {
    expect(() => verifyNamedPostgresTests({success: true})).toThrow(/malformed/);
  });

  it('detects reporter digest or fresh-evidence mismatches', () => {
    const bytes = Buffer.from(JSON.stringify(reporter()));
    const parsed = verifyNamedPostgresTests(JSON.parse(bytes.toString('utf8')), bytes);
    const fresh = {steps: Object.fromEntries(Object.entries(parsed.tests))};
    expect(() => verifyNamedEvidenceBinding(fresh, {...parsed, reporterSha256: '0'.repeat(64)}, bytes)).toThrow(/digest/);
    expect(() => verifyNamedEvidenceBinding({steps: {}}, parsed, bytes)).toThrow(/postClaimRevoke/);
  });
});
