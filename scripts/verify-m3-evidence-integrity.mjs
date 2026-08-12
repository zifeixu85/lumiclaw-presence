import {readFile} from 'node:fs/promises';

const evidence = JSON.parse(await readFile('.evidence/sdd-003/fresh-postgres.json', 'utf8'));
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
process.stdout.write(`${JSON.stringify({status: 'PASS', exactSteps: required}, null, 2)}\n`);
