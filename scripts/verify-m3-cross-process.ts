import {spawn, type ChildProcess} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {
  createDemoCampaignDocument, createPublishingSchedule, exportEd25519PrivateKey, exportEd25519PublicKey,
  generateEd25519KeyPair, sha256Digest,
} from '@lumiclaw/domain';
import {PostgresCampaignRepository} from '@lumiclaw/db';
import {PostgresActionRepository} from '@lumiclaw/db';
import {Pool} from 'pg';
import {OutboxConsumer} from '../apps/action-operator/src/outbox-consumer.js';
import {connectorByPlatform} from '../apps/action-operator/src/connectors.js';

const connectionString = process.env.DATABASE_URL;
const operatorConnectionString = process.env.OPERATOR_DATABASE_URL;
const adminConnectionString = process.env.ADMIN_DATABASE_URL;
if (!connectionString || !operatorConnectionString || !adminConnectionString) throw new Error('DATABASE_URL, OPERATOR_DATABASE_URL, and ADMIN_DATABASE_URL are required; this verifier never skips PostgreSQL or role separation.');
const root = process.cwd();
const evidenceDir = path.join(root, '.evidence', 'sdd-003');
await mkdir(evidenceDir, {recursive: true});
const apiPort = 4210;
const operatorPort = 4212;
const apiBase = `http://127.0.0.1:${apiPort}`;
const keyPair = generateEd25519KeyPair();
const childEnv = {
  ...process.env, DATABASE_URL: connectionString,
  SDD003_SIGNER_PRIVATE_KEY: exportEd25519PrivateKey(keyPair.privateKey),
  SDD003_SIGNER_PUBLIC_KEY: exportEd25519PublicKey(keyPair.publicKey),
};
const children: ChildProcess[] = [];
const logs: string[] = [];
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
type ReceiptView = {id: string; actionGrantId: string; state: string};
type GrantView = {id: string};

function start(command: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(command, args, {cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false});
  child.stdout?.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr?.on('data', (chunk) => logs.push(String(chunk)));
  children.push(child);
  return child;
}
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => { child.once('exit', () => resolve()); setTimeout(resolve, 5000); });
}
async function waitHealth(url: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Health timeout: ${url}`);
}
async function json(url: string, init: RequestInit | undefined, expected: number) {
  const response = await fetch(`${apiBase}${url}`, init);
  const body = await response.json() as Record<string, unknown>;
  if (response.status !== expected) throw new Error(`${url}: expected ${expected}, got ${response.status} ${JSON.stringify(body)}`);
  return {response, body};
}

let result = 'FAIL';
const checks: Record<string, unknown> = {};
try {
  const campaign = createDemoCampaignDocument();
  const campaignRepo = new PostgresCampaignRepository(adminConnectionString);
  const created = await campaignRepo.create(campaign.organizationId, campaign, 'sdd003-cross-process-seed', sha256Digest(campaign));
  if (!created.ok) throw new Error(`Campaign seed failed: ${created.code}`);
  const schedule = createPublishingSchedule({
    organizationId: campaign.organizationId, campaignId: campaign.id,
    artifactRevisions: campaign.artifactRevisions, localStart: '2026-08-13T09:00',
    timeZone: 'Asia/Shanghai', foldPreference: 'EARLIER', misfirePolicy: 'HOLD_FOR_OWNER',
  }, new Date('2026-08-12T00:00:00.000Z'));
  const scheduledCampaign = structuredClone(created.envelope.document);
  scheduledCampaign.publishingSchedules.push(schedule.schedule);
  scheduledCampaign.scheduleOccurrences.push(...schedule.occurrences);
  const scheduled = await campaignRepo.update(campaign.organizationId, campaign.id, scheduledCampaign, created.envelope.etag, 'sdd003-cross-process-schedule', sha256Digest(scheduledCampaign));
  if (!scheduled.ok) throw new Error(`Campaign schedule failed: ${scheduled.code}`);
  const stored = scheduled.envelope;
  campaign.publishingSchedules = stored.document.publishingSchedules;
  campaign.scheduleOccurrences = stored.document.scheduleOccurrences;
  await campaignRepo.close();

  let api = start(process.execPath, [tsxCli, 'scripts/m3-api-process.ts'], {...childEnv, PORT: String(apiPort)});
  await waitHealth(`${apiBase}/health`);
  const headers = {'content-type': 'application/json', 'x-lumiclaw-organization-id': campaign.organizationId};
  const bskyUnit = campaign.activationPlan.units.find((item) => item.platform === 'BLUESKY')!;
  const bskyRevision = campaign.artifactRevisions.find((item) => item.platform === 'BLUESKY')!;

  const streamController = new AbortController();
  const streamResponse = await fetch(`${apiBase}/api/v1/campaigns/${campaign.id}/receipts/stream`, {
    headers: {'x-lumiclaw-organization-id': campaign.organizationId}, signal: streamController.signal,
  });
  if (!streamResponse.ok || !streamResponse.body) throw new Error('SSE subscription failed.');
  const reader = streamResponse.body.getReader();
  const ssePromise = (async () => {
    let text = '';
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const next = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SSE read timeout.')), Math.max(1, deadline - Date.now()))),
      ]);
      if (next.done) break;
      text += new TextDecoder().decode(next.value);
      if (text.includes('receipt_created')) return text;
    }
    throw new Error('SSE did not receive receipt_created.');
  })();

  const issued = await json(`/api/v1/campaigns/${campaign.id}/action-grants`, {
    method: 'POST', headers: {...headers, 'idempotency-key': 'sdd003-cross-process-grant', 'if-match': stored.etag},
    body: JSON.stringify({platform: 'BLUESKY', executionMode: 'DIRECT', scheduleOccurrenceId: campaign.scheduleOccurrences[0]!.id, artifactRevisionId: bskyRevision.id, activationUnitId: bskyUnit.id}),
  }, 201);
  const issuedGrant = issued.body.grant as {id: string};
  const grantId = issuedGrant.id;
  checks.issuedByApiA = grantId;

  const operator = start(process.execPath, [tsxCli, 'apps/action-operator/src/server.ts'], {...process.env, DATABASE_URL: operatorConnectionString, PORT: String(operatorPort)});
  await waitHealth(`http://127.0.0.1:${operatorPort}/health`);
  const sseText = await ssePromise;
  streamController.abort();
  checks.sse = sseText.includes(grantId);

  let receipts: ReceiptView[] = [];
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    receipts = (await json(`/api/v1/campaigns/${campaign.id}/receipts`, {headers}, 200)).body.receipts as ReceiptView[];
    if (receipts.some((item) => item.actionGrantId === grantId)) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const receipt = receipts.find((item) => item.actionGrantId === grantId);
  if (!receipt || receipt.state !== 'PUBLISHED') throw new Error('Independent operator did not persist PUBLISHED controlled-fake receipt.');
  await stop(operator);

  const tamperedIssue = await json(`/api/v1/campaigns/${campaign.id}/action-grants`, {
    method: 'POST', headers: {...headers, 'idempotency-key': 'sdd003-cross-process-tamper', 'if-match': stored.etag},
    body: JSON.stringify({platform: 'BLUESKY', executionMode: 'DIRECT', scheduleOccurrenceId: campaign.scheduleOccurrences[0]!.id, artifactRevisionId: bskyRevision.id, activationUnitId: bskyUnit.id}),
  }, 201);
  const tamperedGrantId = (tamperedIssue.body.grant as {id: string}).id;
  const adminPool = new Pool({connectionString: adminConnectionString});
  await adminPool.query(
    `update outbox set payload=jsonb_set(payload, '{revision,content,posts,0}', to_jsonb($1::text)) where aggregate_id=$2`,
    ['tampered content that was never approved', tamperedGrantId],
  );
  let connectorCalls = 0;
  const operatorRepo = new PostgresActionRepository(operatorConnectionString);
  const tamperConsumer = new OutboxConsumer(operatorRepo, 'tamper-proof-operator', 60000, () => new Date(), undefined, {
    ...connectorByPlatform,
    BLUESKY: {...connectorByPlatform.BLUESKY!, execute: async (...args) => {
      connectorCalls += 1;
      return connectorByPlatform.BLUESKY!.execute(...args);
    }},
  });
  await tamperConsumer.processOne();
  await operatorRepo.close();
  const tamperReceipts = (await json(`/api/v1/campaigns/${campaign.id}/receipts`, {headers}, 200)).body.receipts as ReceiptView[];
  const tamperReceipt = tamperReceipts.find((item) => item.actionGrantId === tamperedGrantId);
  if (connectorCalls !== 0 || tamperReceipt?.state !== 'NOT_EXECUTED') throw new Error('Tampered Outbox Artifact reached connector or lacked NOT_EXECUTED evidence.');
  checks.outboxArtifactTamper = {connectorCalls, receiptState: tamperReceipt.state};
  await adminPool.end();
  await stop(api);

  api = start(process.execPath, [tsxCli, 'scripts/m3-api-process.ts'], {...childEnv, PORT: String(apiPort)});
  await waitHealth(`${apiBase}/health`);
  const grantsAfterRestart = (await json(`/api/v1/campaigns/${campaign.id}/action-grants`, {headers}, 200)).body.grants as GrantView[];
  const receiptsAfterRestart = (await json(`/api/v1/campaigns/${campaign.id}/receipts`, {headers}, 200)).body.receipts as ReceiptView[];
  if (!grantsAfterRestart.some((item) => item.id === grantId) || !receiptsAfterRestart.some((item) => item.id === receipt.id)) throw new Error('API B did not reopen the same Grant and Receipt.');
  checks.apiRestart = true;

  const wrongOrg = campaign.organizationId.replace(/.$/u, campaign.organizationId.endsWith('9') ? '8' : '9');
  await json(`/api/v1/campaigns/${campaign.id}/receipts/${receipt.id}`, {headers: {'x-lumiclaw-organization-id': wrongOrg}}, 404);
  checks.crossOrganizationHidden = true;

  const operatorAgain = start(process.execPath, [tsxCli, 'apps/action-operator/src/server.ts'], {...process.env, DATABASE_URL: operatorConnectionString, PORT: String(operatorPort)});
  await waitHealth(`http://127.0.0.1:${operatorPort}/health`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await stop(operatorAgain);
  const receiptsNoReplay = (await json(`/api/v1/campaigns/${campaign.id}/receipts`, {headers}, 200)).body.receipts as ReceiptView[];
  if (receiptsNoReplay.filter((item) => item.actionGrantId === grantId).length !== 1) throw new Error('Operator restart duplicated the controlled action.');
  checks.noReplayAfterOperatorRestart = true;
  result = 'PASS';
} finally {
  for (const child of children.reverse()) await stop(child);
  await writeFile(path.join(evidenceDir, 'cross-process.json'), `${JSON.stringify({
    schemaVersion: 1, sdd: 'SDD-003', status: result, checks,
    connectorMode: 'CONTROLLED_FAKE', externalActions: 0, logs,
  }, null, 2)}\n`);
}

console.info(JSON.stringify({status: result, evidence: '.evidence/sdd-003/cross-process.json', connectorMode: 'CONTROLLED_FAKE', externalActions: 0}));
if (result !== 'PASS') process.exitCode = 1;
