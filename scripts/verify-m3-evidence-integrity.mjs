import {readFile} from 'node:fs/promises';
import {verifyNamedEvidenceBinding} from './lib/m3-named-postgres-tests.mjs';

const evidence = JSON.parse(await readFile('.evidence/sdd-003/fresh-postgres.json', 'utf8'));
const namedEvidence = JSON.parse(await readFile(
  '.evidence/sdd-003/named-postgres-tests.json',
  'utf8',
));
const reporterBytes = await readFile(
  '.evidence/sdd-003/postgres-repository-vitest.json',
);
const namedBinding = verifyNamedEvidenceBinding(evidence, namedEvidence, reporterBytes);
const required = [
  'postClaimRevoke',
  'lateCompletionFencing',
  'crossCampaignOccurrence',
  'dispatchStateMatrix',
  'outboxArtifactTamper',
  'crossProcess',
  'productionRoles',
  'postgresRepository',
];
const failures = required.filter((name) => evidence.steps?.[name]?.status !== 'PASS');
if (evidence.status !== 'PASS' || evidence.cleanup !== 'PASS' || failures.length > 0) {
  throw new Error(`M3 evidence integrity failed: ${failures.join(', ') || evidence.status}`);
}
if (evidence.steps.outboxArtifactTamper.connectorCalls !== 0) {
  throw new Error('Outbox Artifact tamper evidence did not record connectorCalls=0.');
}
if (evidence.externalActions !== 0 || evidence.connectorMode !== 'CONTROLLED_FAKE') {
  throw new Error('M3 evidence violated the controlled-fake boundary.');
}
process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  exactSteps: required,
  namedPostgresTests: Object.fromEntries(
    Object.entries(namedBinding.tests).map(([name, value]) => [name, {
      id: value.id,
      status: value.status,
      executed: value.executed,
      reporterSha256: value.reporterSha256,
    }]),
  ),
}, null, 2)}\n`);
