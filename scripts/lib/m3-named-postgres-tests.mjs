import {createHash} from 'node:crypto';

export const requiredM3PostgresTests = {
  postClaimRevoke: 'M3_PG_POST_CLAIM_REVOKE',
  lateCompletionFencing: 'M3_PG_LATE_COMPLETION_FENCING',
  crossCampaignOccurrence: 'M3_PG_CROSS_CAMPAIGN_SCOPE',
  dispatchStateMatrix: 'M3_PG_DISPATCH_STATE_MATRIX',
};

const expectedFile = 'packages/db/src/action-repository.test.ts';
const normalizePath = (value) => String(value).replaceAll('\\', '/');

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function verifyNamedPostgresTests(reporter, reporterBytes = Buffer.from(JSON.stringify(reporter))) {
  if (reporter === null || typeof reporter !== 'object' || !Array.isArray(reporter.testResults)) {
    throw new Error('M3 named PostgreSQL reporter is malformed.');
  }
  if (reporter.success !== true || reporter.numFailedTests !== 0) {
    throw new Error('M3 named PostgreSQL reporter did not record a successful test run.');
  }

  const assertions = reporter.testResults.flatMap((suite) => {
    if (suite === null || typeof suite !== 'object' || !Array.isArray(suite.assertionResults)) return [];
    return suite.assertionResults.map((assertion) => ({suite, assertion}));
  });
  const reporterSha256 = sha256Bytes(reporterBytes);
  const tests = {};

  for (const [evidenceName, id] of Object.entries(requiredM3PostgresTests)) {
    const matches = assertions.filter(({assertion}) =>
      assertion !== null
      && typeof assertion === 'object'
      && [assertion.title, assertion.fullName].some((value) => typeof value === 'string' && value.includes(`[${id}]`))
    );
    if (matches.length !== 1) {
      throw new Error(`Required M3 PostgreSQL test ${id} appeared ${matches.length} times; expected exactly once.`);
    }
    const [{suite, assertion}] = matches;
    const file = normalizePath(suite.name);
    if (!file.endsWith(expectedFile)) {
      throw new Error(`Required M3 PostgreSQL test ${id} ran from unexpected file ${file}.`);
    }
    if (assertion.status !== 'passed') {
      throw new Error(`Required M3 PostgreSQL test ${id} was ${String(assertion.status)} instead of passed.`);
    }
    tests[evidenceName] = {
      status: 'PASS',
      id,
      fullName: assertion.fullName,
      file: expectedFile,
      executed: true,
      reporterSha256,
    };
  }

  return {schemaVersion: 1, status: 'PASS', reporterSha256, tests};
}

export function verifyNamedEvidenceBinding(freshEvidence, namedEvidence, reporterBytes) {
  const parsed = verifyNamedPostgresTests(JSON.parse(reporterBytes.toString('utf8')), reporterBytes);
  if (namedEvidence?.status !== 'PASS' || namedEvidence?.reporterSha256 !== parsed.reporterSha256) {
    throw new Error('Named PostgreSQL evidence does not match the reporter digest.');
  }
  for (const [name, expectedId] of Object.entries(requiredM3PostgresTests)) {
    const fresh = freshEvidence?.steps?.[name];
    const named = namedEvidence?.tests?.[name];
    const actual = parsed.tests[name];
    if (fresh?.status !== 'PASS' || fresh?.id !== expectedId || fresh?.reporterSha256 !== parsed.reporterSha256
        || named?.status !== 'PASS' || named?.id !== expectedId || named?.executed !== true
        || actual?.status !== 'PASS' || actual?.id !== expectedId) {
      throw new Error(`Named PostgreSQL evidence binding failed for ${name}.`);
    }
  }
  return parsed;
}
