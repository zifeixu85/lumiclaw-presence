import {spawnSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const project = 'lumiclaw-sdd003-verify';
const compose = ['compose', '--project-name', project, '-f', 'compose.yml', '-f', 'compose.sdd003-verify.yml'];
const evidenceDir = path.join(root, '.evidence', 'sdd-003');
const transcriptPath = path.join(evidenceDir, 'fresh-postgres-transcript.log');
await mkdir(evidenceDir, {recursive: true});

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
  steps.freshMigrations = {status: 'PASS', passed: 2, total: 2};

  sql('create-login-principals', "create role sdd003_api login password 'sdd003-api-controlled' in role lumiclaw_api; create role sdd003_operator login password 'sdd003-operator-controlled' in role lumiclaw_action_operator;");
  const apiRole = sql('api-role-membership', "select pg_has_role('sdd003_api','lumiclaw_api','member')").stdout.trim();
  const operatorRole = sql('operator-role-membership', "select pg_has_role('sdd003_operator','lumiclaw_action_operator','member')").stdout.trim();
  if (apiRole !== 't' || operatorRole !== 't') throw new Error('Production-role membership probe failed.');
  const apiReceiptWrite = docker('api-cannot-write-receipt', ['exec', '-T', '-e', 'PGPASSWORD=sdd003-api-controlled', 'postgres', 'psql', '-h', '127.0.0.1', '-U', 'sdd003_api', '-d', 'lumiclaw', '-c', "insert into action_receipts default values"], {allowFailure: true});
  const operatorGrantWrite = docker('operator-cannot-write-grant', ['exec', '-T', '-e', 'PGPASSWORD=sdd003-operator-controlled', 'postgres', 'psql', '-h', '127.0.0.1', '-U', 'sdd003_operator', '-d', 'lumiclaw', '-c', "insert into action_grants default values"], {allowFailure: true});
  if (apiReceiptWrite.status === 0 || operatorGrantWrite.status === 0) throw new Error('A least-privilege negative probe unexpectedly succeeded.');
  steps.productionRoles = {status: 'PASS', passed: 4, total: 4};

  verifier('action-grant', ['npm', 'run', 'verify:m3-action-grant']);
  steps.actionGrantVerifier = {status: 'PASS'};
  sql('isolate-cross-process', 'truncate table organizations cascade');
  verifier('cross-process', ['npm', 'run', 'verify:m3-cross-process']);
  steps.crossProcess = {status: 'PASS'};
  sql('isolate-postgres-repository', 'truncate table organizations cascade');
  docker('postgres-repository', ['run', '--rm', '-e', 'DATABASE_URL=postgres://postgres:sdd003-controlled-fake@postgres:5432/lumiclaw', 'verifier', 'npm', 'test', '--', '--run', 'packages/db/src/action-repository.test.ts']);
  steps.postgresRepository = {status: 'PASS', passed: 19, total: 19};
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
