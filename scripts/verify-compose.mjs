import {execFileSync, spawnSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const project = 'lumiclaw-sdd000-verify';
const evidenceDir = path.join(root, '.evidence/sdd-000');
const events = [];
const checks = {};

function docker(args, options = {}) {
  const startedAt = new Date().toISOString();
  const command = ['docker', 'compose', '--project-name', project, ...args];
  try {
    const output = execFileSync('docker', command.slice(1), {
      cwd: root,
      encoding: 'utf8',
      stdio: options.capture === false ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: {...process.env, LUMICLAW_WEB_PORT: '3110', LUMICLAW_API_PORT: '4110'}
    });
    events.push({command, startedAt, status: 'PASS'});
    return output ?? '';
  } catch (error) {
    events.push({command, startedAt, status: 'FAIL'});
    throw error;
  }
}

function expectDockerFailure(args, code) {
  const result = spawnSync('docker', ['compose', '--project-name', project, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env, LUMICLAW_WEB_PORT: '3110', LUMICLAW_API_PORT: '4110'}
  });
  events.push({command: ['docker', 'compose', '--project-name', project, ...args], status: result.status === 0 ? 'FAIL' : 'PASS', expectedFailure: code});
  if (result.status === 0) throw new Error(`Expected Docker failure did not occur: ${code}`);
}

async function waitForHealthy(expected, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const output = docker(['ps', '--format', 'json']);
    const trimmed = output.trim();
    const rows = trimmed === ''
      ? []
      : trimmed.startsWith('[')
        ? JSON.parse(trimmed)
        : trimmed.split('\n').map((line) => JSON.parse(line));
    const health = new Map(rows.map((row) => [row.Service, row.Health || row.State]));
    if (expected.every((service) => health.get(service) === 'healthy')) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for healthy services: ${expected.join(', ')}`);
}

await mkdir(evidenceDir, {recursive: true});
let result = 'FAIL';
let primaryError = null;
try {
  docker(['down', '--volumes', '--remove-orphans']);
  expectDockerFailure([
    'run', '--rm', '-e', 'MIGRATIONS_DIR=/app/packages/db/fixtures/broken-migrations', 'migrate'
  ], 'MIGRATION_SQL_FAILURE');
  const servicesAfterBrokenMigration = docker(['ps', '--services', '--status', 'running'])
    .trim()
    .split('\n')
    .filter(Boolean);
  if (['api', 'mission-worker', 'action-operator', 'web'].some((service) => servicesAfterBrokenMigration.includes(service))) {
    throw new Error('A dependent application service ran after the broken migration.');
  }
  checks.brokenMigrationBlockedApplicationReadiness = true;
  docker(['down', '--volumes', '--remove-orphans']);
  docker(['up', '--build', '--detach'], {capture: false});
  await waitForHealthy(['postgres', 'api', 'mission-worker', 'action-operator', 'web']);
  checks.freshVolumeServicesHealthy = true;

  const initialMigrationRows = Number.parseInt(docker([
    'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At',
    '-c', 'SELECT count(*) FROM pgmigrations'
  ]).trim(), 10);
  if (initialMigrationRows !== 1) throw new Error(`Expected one migration ledger row, received ${initialMigrationRows}.`);
  checks.initialMigrationLedgerRows = initialMigrationRows;

  docker([
    'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-v', 'ON_ERROR_STOP=1',
    '-c',
    "INSERT INTO foundation_metadata(key,value) VALUES ('persistence_probe','{\"round\":1}'::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value"
  ]);
  docker(['run', '--rm', 'mission-worker', 'npm', '--workspace', '@lumiclaw/blob-store', 'run', 'smoke:write']);

  docker(['restart', 'postgres', 'mission-worker']);
  await waitForHealthy(['postgres', 'api', 'mission-worker', 'action-operator', 'web']);
  docker(['down']);
  docker(['up', '--detach']);
  await waitForHealthy(['postgres', 'api', 'mission-worker', 'action-operator', 'web']);

  const databaseMarker = docker([
    'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At',
    '-c', "SELECT value->>'round' FROM foundation_metadata WHERE key='persistence_probe'"
  ]).trim();
  if (databaseMarker !== '1') throw new Error('Database persistence marker was lost.');
  checks.databasePersistenceMarker = databaseMarker;
  const blobRead = docker(['run', '--rm', 'mission-worker', 'npm', '--workspace', '@lumiclaw/blob-store', 'run', 'smoke:read']);
  if (!blobRead.includes('SDD-000 persistence marker')) throw new Error('Blob persistence marker was lost.');
  checks.blobPersistence = true;

  const webChinese = await fetch('http://127.0.0.1:3110/').then((response) => response.text());
  const webEnglish = await fetch('http://127.0.0.1:3110/en/mission').then((response) => response.text());
  if (
    !webChinese.includes('DEMO_SEED / NOT_LIVE') ||
    !webEnglish.includes('This shows the workflow only; the AI team has not started') ||
    !webEnglish.includes('ADAPTER_CONTRACT_ONLY / NO_AGENT_TURN')
  ) {
    throw new Error('Locale route, customer-language, or non-live marker smoke failed.');
  }
  checks.webLocaleCustomerLanguageAndTruthMarkers = true;
  const prefixlessWithEnglishPreference = await fetch('http://127.0.0.1:3110/mission', {
    headers: {cookie: 'NEXT_LOCALE=en'}
  }).then((response) => response.text());
  if (!prefixlessWithEnglishPreference.includes('你现在可以做')) {
    throw new Error('Prefixless routes must remain on the default zh-CN locale.');
  }
  checks.defaultLocaleIgnoresPreferenceCookie = true;
  const faviconResponse = await fetch('http://127.0.0.1:3110/favicon.ico');
  if (!faviconResponse.ok || faviconResponse.headers.get('content-type') !== 'image/x-icon') {
    throw new Error('Standalone Web static-asset smoke failed.');
  }
  checks.webStandaloneStaticAssets = true;
  const apiHealth = await fetch('http://127.0.0.1:4110/health').then((response) => response.json());
  if (apiHealth.live !== false || apiHealth.mode !== 'DEMO_SEED') throw new Error('API health claim boundary failed.');
  checks.apiHealthClaimBoundary = true;

  expectDockerFailure(['run', '--rm', '-e', 'MIGRATIONS_DIR=/missing', 'migrate'], 'MIGRATION_DIRECTORY_MISSING');
  checks.migrationDirectoryFailure = true;
  expectDockerFailure([
    'run', '--rm', '--no-deps', '-e', 'DATABASE_URL=postgres://postgres@127.0.0.1:1/lumiclaw', 'migrate'
  ], 'POSTGRES_DEPENDENCY_UNAVAILABLE');
  checks.postgresDependencyFailure = true;

  docker(['run', '--rm', 'migrate']);
  const finalMigrationRows = Number.parseInt(docker([
    'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At',
    '-c', 'SELECT count(*) FROM pgmigrations'
  ]).trim(), 10);
  if (finalMigrationRows !== 1) throw new Error(`Migration replay changed the ledger to ${finalMigrationRows} rows.`);
  checks.finalMigrationLedgerRows = finalMigrationRows;
  result = 'PASS';
} catch (error) {
  primaryError = error instanceof Error ? error.message : 'UNKNOWN_COMPOSE_VERIFICATION_ERROR';
  throw error;
} finally {
  let cleanup = 'FAIL';
  let cleanupError = null;
  try {
    docker(['down', '--volumes', '--remove-orphans']);
    cleanup = 'PASS';
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : 'UNKNOWN_COMPOSE_CLEANUP_ERROR';
  }
  await writeFile(
    path.join(evidenceDir, 'compose-verification.json'),
    `${JSON.stringify({schemaVersion: '1.0.0', project, result, cleanup, generatedAt: new Date().toISOString(), checks, primaryError, cleanupError, events}, null, 2)}\n`
  );
  if (cleanupError !== null && primaryError === null) throw new Error(cleanupError);
}

console.info(JSON.stringify({status: result, project, evidence: '.evidence/sdd-000/compose-verification.json'}));
