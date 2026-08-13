import {existsSync, readFileSync} from 'node:fs';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {runAggregate} from './lib/m3-sdd003-runner.mjs';

const evidenceDir = path.join(process.cwd(), '.evidence', 'sdd-003');
await mkdir(evidenceDir, {recursive: true});

const aggregate = runAggregate();
const freshEvidencePath = path.join(evidenceDir, 'fresh-postgres.json');
const freshEvidence = existsSync(freshEvidencePath)
  ? JSON.parse(readFileSync(freshEvidencePath, 'utf8'))
  : null;
const evidence = {
  ...aggregate,
  sdd: 'SDD-003',
  module: 'M3-01',
  database: aggregate.steps.freshPostgres.status === 'PASS' ? 'fresh' : 'not-verified',
  externalActions: freshEvidence?.externalActions ?? null,
  connectorMode: freshEvidence?.connectorMode ?? null,
};

await writeFile(
  path.join(evidenceDir, 'aggregate.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
process.exitCode = evidence.status === 'PASS' ? 0 : 1;
