import {spawnSync} from 'node:child_process';
import {chmod, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const project = 'lumiclaw-sdd003-verify';
const compose = ['compose', '--project-name', project, '-f', 'compose.yml', '-f', 'compose.sdd003-verify.yml'];
const evidenceDir = path.join(root, '.evidence', 'sdd-003');
const actionGrantEvidenceDir = path.join(root, '.evidence', 'm3-01');
const transcriptPath = path.join(evidenceDir, 'fresh-postgres-transcript.log');
await Promise.all([
  mkdir(evidenceDir, {recursive: true}),
  mkdir(actionGrantEvidenceDir, {recursive: true}),
]);
if (process.platform !== 'win32') {
  // The verifier image runs as a non-root UID which can differ from the
  // GitHub runner UID. Limit cross-UID writes to ignored evidence folders.
  await Promise.all([
    chmod(evidenceDir, 0o777),
    chmod(actionGrantEvidenceDir, 0o777),
  ]);
}

const transcript = [];
const steps = {};
function run(label, command, args, {allowFailure = false} = {}) {
  transcript.push(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {cwd: root, env: process.env, encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024});
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  transcript.push(stdout, stderr, `[exit ${result.status ?? 1}]`);
  process.stdout.write(stdout); process.stderr.write(stderr);
  if (!allowFailure && result.status !== 0) throw new Error(`${label} failed with exit ${result.status ?? 1}`);
  return result;
}
function docker(label, args, options) { return run(label, 'docker', [...compose, ...args], options); }
function verifier(label, args, options) { return docker(label, ['run', '--rm', 'verifier', ...args], options); }
function sql(label, statement, options) {
  return docker(label, ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-v', 'ON_ERROR_STOP=1', '-At', '-c', statement], options);
}
function roleSql(label, user, password, statement, options) {
  return docker(label, [
    'exec', '-T', '-e', `PGPASSWORD=${password}`, 'postgres', 'psql',
    '-v', 'VERBOSITY=verbose', '-h', '127.0.0.1', '-U', user, '-d', 'lumiclaw',
    '-c', statement,
  ], options);
}

let status = 'FAIL';
let cleanup = 'FAIL';
let error = null;
try {
  docker('clean-before', ['down', '--volumes', '--remove-orphans'], {allowFailure: true});
  docker('postgres-up', ['up', '--detach', 'postgres']);
  docker('clean-build', ['build', '--no-cache', 'migrate']);
  docker('migrate-first', ['run', '--rm', 'migrate']);
  docker('migrate-second', ['run', '--rm', 'migrate']);
  const migrationCount = sql('migration-count', "select count(*) from pgmigrations where name='000018_sdd003_authoritative_action_scope'").stdout.trim();
  if (migrationCount !== '1') throw new Error(`Migration 000018 count was ${migrationCount}.`);
  const predecessorMigrationCount = sql(
    'receipt-predecessor-migration-count',
    "select count(*) from pgmigrations where name='000020_receipt_predecessor_boundary'",
  ).stdout.trim();
  if (predecessorMigrationCount !== '1') {
    throw new Error(`Migration 000020 count was ${predecessorMigrationCount}.`);
  }
  steps.freshMigrations = {status: 'PASS', passed: 2, total: 2};

  sql('create-login-principals', "create role sdd003_api login password 'sdd003-api-controlled' in role lumiclaw_api; create role sdd003_operator login password 'sdd003-operator-controlled' in role lumiclaw_action_operator;");
  const apiRole = sql('api-role-membership', "select pg_has_role('sdd003_api','lumiclaw_api','member')").stdout.trim();
  const operatorRole = sql('operator-role-membership', "select pg_has_role('sdd003_operator','lumiclaw_action_operator','member')").stdout.trim();
  if (apiRole !== 't' || operatorRole !== 't') throw new Error('Production-role membership probe failed.');

  verifier('action-grant', ['npm', 'run', 'verify:m3-action-grant']);
  const actionGrantEvidence = JSON.parse(await readFile(
    path.join(actionGrantEvidenceDir, 'action-grant-integration.json'),
    'utf8',
  ));
  const predecessorChecks = [
    'receiptPredecessorMissing',
    'receiptPredecessorCrossGrant',
    'receiptPredecessorIllegalTransition',
  ];
  const failedPredecessorChecks = predecessorChecks.filter(
    (name) => actionGrantEvidence.checks?.[name]?.status !== 'PASS'
      || actionGrantEvidence.checks?.[name]?.sqlstate !== '42501'
      || actionGrantEvidence.checks?.[name]?.before !== actionGrantEvidence.checks?.[name]?.after,
  );
  if (failedPredecessorChecks.length > 0) {
    throw new Error(`Receipt predecessor probes failed: ${failedPredecessorChecks.join(', ')}`);
  }
  steps.actionGrantVerifier = {status: 'PASS'};
  steps.receiptPredecessorBoundary = {
    status: 'PASS',
    role: 'sdd003_api',
    expectedSqlstate: '42501',
    probes: Object.fromEntries(predecessorChecks.map((name) => [name, actionGrantEvidence.checks[name]])),
    positivePaths: {
      confirmHandoff: actionGrantEvidence.checks?.apiRoleConfirmHandoff === true,
      reconcile: actionGrantEvidence.checks?.apiRoleReconcile === true,
    },
  };
  if (!steps.receiptPredecessorBoundary.positivePaths.confirmHandoff
      || !steps.receiptPredecessorBoundary.positivePaths.reconcile) {
    throw new Error('Receipt predecessor positive API-role paths were not both proven.');
  }
  const validReceiptDelete = 'delete from action_receipts where id=(select id from action_receipts limit 1)';
  const validGrantDelete = 'delete from action_grants where id=(select id from action_grants limit 1)';
  const apiPermissionProbe = roleSql('api-valid-receipt-delete-denied', 'sdd003_api', 'sdd003-api-controlled', validReceiptDelete, {allowFailure: true});
  const operatorPermissionProbe = roleSql('operator-valid-grant-delete-denied', 'sdd003_operator', 'sdd003-operator-controlled', validGrantDelete, {allowFailure: true});
  const is42501 = (probe) => (probe.stdout + probe.stderr).includes('42501');
  if (!is42501(apiPermissionProbe) || !is42501(operatorPermissionProbe)) throw new Error('Legal least-privilege probes did not fail with SQLSTATE 42501.');
  steps.productionRoles = {status: 'PASS', passed: 4, total: 4, sqlstate: '42501'};
  sql('isolate-cross-process', 'truncate table organizations cascade');
  verifier('cross-process', ['npm', 'run', 'verify:m3-cross-process']);
  steps.crossProcess = {status: 'PASS'};
  const crossProcessEvidence = JSON.parse(await readFile(path.join(evidenceDir, 'cross-process.json'), 'utf8'));
  const tamper = crossProcessEvidence.checks?.outboxArtifactTamper;
  if (tamper?.connectorCalls !== 0 || tamper?.receiptState !== 'NOT_EXECUTED') throw new Error('Exact Outbox Artifact tamper assertion was missing or failed.');
  steps.outboxArtifactTamper = {status: 'PASS', test: 'PostgreSQL Outbox Artifact tamper yields connectorCalls=0', connectorCalls: 0};
  sql('isolate-postgres-repository', 'truncate table organizations cascade');
  docker('postgres-repository', [
    'run', '--rm',
    '-e', 'DATABASE_URL=postgres://postgres:sdd003-controlled-fake@postgres:5432/lumiclaw',
    'verifier',
    'npm', 'test', '--', '--run',
    'packages/db/src/action-repository.test.ts',
    '--reporter=json',
    '--outputFile=.evidence/sdd-003/postgres-repository-vitest.json',
  ]);
  verifier('named-postgres-tests', ['node', 'scripts/verify-m3-named-postgres-tests.mjs']);
  const namedEvidence = JSON.parse(await readFile(
    path.join(evidenceDir, 'named-postgres-tests.json'),
    'utf8',
  ));
  if (namedEvidence.status !== 'PASS') {
    throw new Error('Named PostgreSQL adversarial evidence did not pass.');
  }
  steps.postgresRepository = {
    status: 'PASS',
    reporter: '.evidence/sdd-003/postgres-repository-vitest.json',
    reporterSha256: namedEvidence.reporterSha256,
  };
  for (const name of [
    'postClaimRevoke',
    'lateCompletionFencing',
    'crossCampaignOccurrence',
    'dispatchStateMatrix',
  ]) {
    const namedTest = namedEvidence.tests?.[name];
    if (namedTest?.status !== 'PASS' || namedTest?.executed !== true) {
      throw new Error(`Named PostgreSQL adversarial test ${name} was not executed and passed.`);
    }
    steps[name] = namedTest;
  }
  status = 'PASS';
} catch (cause) {
  error = cause instanceof Error ? cause.message : String(cause);
} finally {
  try { docker('clean-after', ['down', '--volumes', '--remove-orphans']); cleanup = 'PASS'; } catch {}
  const evidence = {schemaVersion: 1, sdd: 'SDD-003', status, cleanup, database: 'fresh', migrations: steps.freshMigrations?.status ?? 'FAIL', steps, externalActions: 0, connectorMode: 'CONTROLLED_FAKE', transcript: '.evidence/sdd-003/fresh-postgres-transcript.log', error};
  await writeFile(transcriptPath, `${transcript.join('\n')}\n`);
  await writeFile(path.join(evidenceDir, 'fresh-postgres.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify(evidence, null, 2));
}
if (status !== 'PASS') process.exitCode = 1;
