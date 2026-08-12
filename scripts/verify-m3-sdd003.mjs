import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const npmCliCandidates = [
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  path.join(process.cwd(), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
];
const npmCli = npmCliCandidates.find((candidate) => existsSync(candidate));
if (npmCli === undefined) throw new Error(`npm-cli.js not found: ${npmCliCandidates.join(', ')}`);

const steps = [
  ['domain', ['test', '--', '--run', 'packages/domain/src/action-grant.test.ts']],
  ['repositoryContract', ['test', '--', '--run', 'apps/action-operator/src/outbox-consumer.test.ts', 'apps/api/src/action-grant-routes.test.ts', 'apps/api/src/receipt-routes.test.ts']],
  ['typecheck', ['run', 'typecheck']],
  ['freshPostgres', ['run', 'verify:m3-fresh-postgres']],
];

const results = {};
for (const [name, args] of steps) {
  const run = spawnSync(process.execPath, [npmCli, ...args], {stdio: 'inherit', shell: false});
  results[name] = run.status === 0 ? 'PASS' : 'FAIL';
  if (run.status !== 0) break;
}

const freshEvidencePath = path.join(process.cwd(), '.evidence', 'sdd-003', 'fresh-postgres.json');
const freshEvidence = existsSync(freshEvidencePath)
  ? JSON.parse(readFileSync(freshEvidencePath, 'utf8'))
  : {steps: {}};
const exactStep = (name) => freshEvidence.steps?.[name]?.status ?? 'NOT_RUN';

const requiredExactSteps = ['postClaimRevoke', 'lateCompletionFencing', 'crossCampaignOccurrence', 'dispatchStateMatrix', 'outboxArtifactTamper', 'crossProcess', 'productionRoles', 'postgresRepository'];
const status = Object.values(results).every((value) => value === 'PASS')
  && Object.keys(results).length === steps.length
  && requiredExactSteps.every((name) => exactStep(name) === 'PASS')
  ? 'PASS'
  : 'FAIL';
const evidence = {
  schemaVersion: 1,
  sdd: 'SDD-003',
  module: 'M3-01',
  status,
  database: results.freshPostgres === 'PASS' ? 'fresh' : 'not-verified',
  migrations: results.freshPostgres ?? 'NOT_RUN',
  domain: results.domain ?? 'NOT_RUN',
  repositoryContract: results.repositoryContract ?? 'NOT_RUN',
  typecheck: results.typecheck ?? 'NOT_RUN',
  postClaimRevoke: exactStep('postClaimRevoke'),
  lateCompletionFencing: exactStep('lateCompletionFencing'),
  crossCampaignOccurrence: exactStep('crossCampaignOccurrence'),
  dispatchStateMatrix: exactStep('dispatchStateMatrix'),
  outboxArtifactTamper: exactStep('outboxArtifactTamper'),
  crossProcessRestart: exactStep('crossProcess'),
  productionRoles: exactStep('productionRoles'),
  appendOnly: exactStep('postgresRepository'),
  sse: exactStep('crossProcess'),
  externalActions: 0,
  connectorMode: 'CONTROLLED_FAKE',
};
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
process.exitCode = status === 'PASS' ? 0 : 1;
