import {readFile, writeFile} from 'node:fs/promises';
import {verifyNamedPostgresTests} from './lib/m3-named-postgres-tests.mjs';

const reporterPath = '.evidence/sdd-003/postgres-repository-vitest.json';
const evidencePath = '.evidence/sdd-003/named-postgres-tests.json';
const bytes = await readFile(reporterPath);
const result = verifyNamedPostgresTests(JSON.parse(bytes.toString('utf8')), bytes);
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
