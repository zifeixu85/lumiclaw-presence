import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';

const root = process.cwd();
const api = process.env.LUMICLAW_LIVE_API_URL ?? 'http://127.0.0.1:4129';
const leader = 'presence-mission-leader';
const teamName = 'sdd002-governed-shadow';
const controller = 'agentteams-controller';
const expectedRoles = [leader, 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'];
const titleByKind = {PROJECT_COORDINATION: 'Coordinate exact SHADOW Project', FREEZE_EVIDENCE: 'Freeze Claim and Evidence bindings', PLAN_CAMPAIGN: 'Allocate persisted activation plan', PRODUCE_FOUNDER: 'Produce initial X and Xiaohongshu revisions', PRODUCE_PRODUCT: 'Produce Bluesky and LinkedIn revisions', AUDIT_REVISIONS: 'Independently audit four initial revision digests', PRODUCE_FOUNDER_CORRECTION: 'Correct rejected X revision', REAUDIT_CORRECTION: 'Independently re-audit corrected X revision'};

const rl = createInterface({input: process.stdin, output: process.stdout});
const organizationId = (await rl.question('Organization ID: ')).trim();
const missionId = (await rl.question('Live Mission ID: ')).trim();
const campaignDigest = (await rl.question('Expected Campaign digest: ')).trim();
const bootstrap = (await rl.question('Runtime broker bootstrap (input is not persisted): ')).trim();
rl.close();
if (!/^[a-f0-9]{64}$/u.test(campaignDigest) || bootstrap.length < 32) throw new Error('LIVE_UAT_INPUT_INVALID');

const organizationHeaders = {'x-lumiclaw-organization-id': organizationId};
let mission; let etag; let projectId; let eventCounter = 0; let lastTaskId = null; const receipts = [];

function digest(value) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex'); }
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])])); return value; }
function run(executable, args, label, input) {
  try { return execFileSync(executable, args, {cwd: root, encoding: 'utf8', timeout: 90_000, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], input}).trim(); }
  catch (error) { throw new Error(`${label}:${String(error?.stderr ?? error?.message ?? 'FAILED').trim()}`); }
}
function agt(resource) { return JSON.parse(run('docker', ['exec', controller, 'agt', 'get', resource, '-o', 'json'], `agt-get-${resource}`)); }
function workspace(role) { return `/root/.copaw-worker/${role}/.copaw/workspaces/default`; }
function callTool(role, tool, action, payload, actor) {
  const code = `import asyncio,base64,json,sys; from copaw_worker.hooks.tools.${tool} import ${tool}; payload=json.loads(base64.b64decode(sys.argv[2]).decode()); response=asyncio.run(${tool}(sys.argv[1], payload)); print(response.content[0]["text"])`;
  const args = ['exec']; if (actor) args.push('-e', `AGENTTEAMS_MATRIX_USER_ID=${actor}`);
  args.push('-w', workspace(role), `agentteams-worker-${role}`, '/opt/venv/standard/bin/python', '-c', code, action, Buffer.from(JSON.stringify(payload)).toString('base64'));
  return JSON.parse(run('docker', args, `${role}:${action}`));
}
function projectState() {
  const code = 'import json,sys; from dataclasses import asdict; from copaw_worker.task import FileSystemTaskStore,parse_dag_tasks; s=FileSystemTaskStore(); m=s.read_project_meta(sys.argv[1]); p=s.read_project_plan(sys.argv[1]); print(json.dumps({"project":asdict(m),"tasks":[asdict(x) for x in parse_dag_tasks(p)]}))';
  return JSON.parse(run('docker', ['exec', '-w', workspace(leader), `agentteams-worker-${leader}`, '/opt/venv/standard/bin/python', '-c', code, projectId], 'project-state'));
}
function acceptTask(taskId) {
  const code = 'import sys; from copaw_worker.task import FileSystemTaskStore,parse_dag_tasks,_replace_task_status,replace_dag_tasks; s=FileSystemTaskStore(); p=s.read_project_plan(sys.argv[1]); s.write_project_plan(sys.argv[1],replace_dag_tasks(p,_replace_task_status(parse_dag_tasks(p),sys.argv[2],"completed"))); print("accepted")';
  run('docker', ['exec', '-w', workspace(leader), `agentteams-worker-${leader}`, '/opt/venv/standard/bin/python', '-c', code, projectId, taskId], `accept:${taskId}`);
}
async function request(pathname, init, expected = 200) {
  const response = await fetch(`${api}${pathname}`, init); const body = await response.json();
  if (response.status !== expected) throw new Error(`API_${response.status}_${body.code ?? 'FAILED'}`);
  return {body, etag: response.headers.get('etag')};
}
async function issue(action, task = null) {
  const body = {missionId, campaignDigest, action, roleId: action === 'FAIL' ? null : task?.roleId ?? null, taskId: task?.id ?? null, attempt: action === 'FAIL' ? null : task?.attempt ?? null, agentTeamsSourceTarSha256: mission.runtimeExpectation.agentTeamsSourceTarSha256, agentTeamsBuildDigest: mission.runtimeExpectation.agentTeamsBuildDigest, imageDigests: mission.runtimeExpectation.imageDigests};
  return (await request(`/api/v1/shadow-missions/${missionId}/live-runner/tickets`, {method: 'POST', headers: {...organizationHeaders, 'x-lumiclaw-runner-bootstrap': bootstrap, 'content-type': 'application/json'}, body: JSON.stringify(body)})).body.ticket;
}
async function runtimeEvent(body, action, task = null) {
  const ticket = await issue(action, task); eventCounter += 1;
  const response = await request(`/api/v1/shadow-missions/${missionId}/runtime-events`, {method: 'POST', headers: {...organizationHeaders, 'x-lumiclaw-runtime-ticket': ticket, 'idempotency-key': `live-uat-${String(eventCounter).padStart(3, '0')}`, 'if-match': etag, 'content-type': 'application/json'}, body: JSON.stringify(body)});
  mission = response.body.mission; etag = response.etag; return response;
}
async function modelFromWorker(role, task) {
  const ticket = await issue('MODEL_GENERATE', task);
  const requestBody = {taskId: task.id, roleId: task.roleId, attempt: task.attempt, inputProjectionDigest: task.inputProjectionDigest};
  const input = JSON.stringify({url: `${api}/api/v1/shadow-missions/${missionId}/live-model-generate`, organizationId, ticket, body: requestBody});
  const code = 'import json,sys,urllib.request; x=json.loads(sys.stdin.read()); data=json.dumps(x["body"],separators=(",",":")).encode(); req=urllib.request.Request(x["url"],data=data,headers={"content-type":"application/json","x-lumiclaw-organization-id":x["organizationId"],"x-lumiclaw-runtime-ticket":x["ticket"]}); response=urllib.request.urlopen(req,timeout=150); print(response.read().decode())';
  const output = run('docker', ['exec', '-i', '-w', workspace(role), `agentteams-worker-${role}`, '/opt/venv/standard/bin/python', '-c', code], `${role}:live-provider-broker`, input);
  const result = JSON.parse(output); mission = result.mission; etag = mission.etag;
  if (result.maturity !== 'LIVE_PROVIDER_CANARY' || result.receipt.provider !== 'DEEPSEEK' || result.receipt.secretPresent !== false || result.receipt.runtimeOutputDigest !== digest(result.payload)) throw new Error(`LIVE_PROVIDER_RECEIPT_INVALID:${task.id}`);
  receipts.push({taskId: task.id, roleId: task.roleId, model: result.receipt.model, responseIdDigest: digest(result.receipt.response.id ?? ''), tokenUsage: result.receipt.tokenUsage, estimatedCostUsd: result.receipt.estimatedCostUsd, latencyMs: result.receipt.latencyMs, modelOutputDigest: result.receipt.outputDigest, runtimeOutputDigest: result.receipt.runtimeOutputDigest, secretPresent: false});
  return result.payload;
}

try {
  const opened = await request(`/api/v1/shadow-missions/${missionId}`, {headers: organizationHeaders}); mission = opened.body.mission; etag = opened.etag; projectId = mission.runtimeProjectId;
  if (mission.providerMode !== 'LIVE_DEEPSEEK_UAT' || mission.providerMaturity !== 'LIVE_PROVIDER_CANARY' || mission.sourceCampaignDigest !== campaignDigest || mission.state !== 'WAITING_RUNTIME') throw new Error('LIVE_MISSION_BINDING_MISMATCH');
  const manifest = JSON.parse(await readFile(path.join(root, 'infra/agentteams/image-manifest.json'), 'utf8'));
  if (manifest.sourceTarSha256 !== mission.runtimeExpectation.agentTeamsSourceTarSha256 || digest(manifest.images.map(({component, digest: value}) => ({component, digest: value}))) !== digest(mission.runtimeExpectation.imageDigests)) throw new Error('LIVE_RUNTIME_MANIFEST_MISMATCH');
  for (const image of manifest.images) {
    const ref = `${image.repository}:${image.tag}`; const repoDigests = JSON.parse(run('docker', ['image', 'inspect', ref, '--format', '{{json .RepoDigests}}'], `image:${image.component}`));
    if (!repoDigests.includes(`${image.repository}@${image.digest}`)) throw new Error(`LIVE_IMAGE_DIGEST_MISMATCH:${image.component}`);
  }
  const workersDoc = agt('workers'); const teamsDoc = agt('teams'); const workers = workersDoc.workers.filter((item) => expectedRoles.includes(item.name)); const team = teamsDoc.teams.find((item) => item.name === teamName);
  if (workersDoc.total !== 6 || workers.length !== 6 || workers.some((item) => item.phase !== 'Running') || team?.phase !== 'Active' || team.workerMembers?.length !== 6 || team.workerMembers.filter((item) => item.role === 'team_leader' && item.name === leader).length !== 1) throw new Error('LIVE_AGENTTEAMS_TOPOLOGY_INVALID');
  const roomId = team.teamRoomID; const dag = mission.tasks.map((task) => ({taskId: task.id, title: titleByKind[task.kind], assignedTo: task.roleId, taskKind: task.kind, attempt: task.attempt, dependsOn: task.prerequisiteTaskIds}));
  const created = callTool(leader, 'projectflow', 'create_project', {projectId, title: 'SDD-002 Live DeepSeek local UAT', source: campaignDigest, requester: 'lumiclaw-postgresql-control-plane'}); if (!created.ok && !String(created.error).includes('already exists')) throw new Error('LIVE_PROJECT_CREATE_FAILED');
  const planned = callTool(leader, 'projectflow', 'plan_dag', {projectId, tasks: dag}); if (!planned.ok || planned.tasks.length !== 8) throw new Error('LIVE_DAG_PLAN_FAILED');
  const bindings = mission.roleContexts.map((context) => ({roleId: context.roleId, roleIdentityId: context.identityId, runtimeActorId: workers.find((worker) => worker.name === context.roleId)?.matrixUserID}));
  if (bindings.some((binding) => typeof binding.runtimeActorId !== 'string')) throw new Error('LIVE_MEMBER_BINDING_MISSING');
  const dispatchBase = {schemaVersion: 1, projectId, runtimeVersion: 'v1.2.0', buildDigest: mission.runtimeExpectation.agentTeamsBuildDigest, memberBindings: bindings, memberSetDigest: digest([...bindings].sort((a, b) => a.roleId.localeCompare(b.roleId))), dagDigest: digest(mission.tasks.map((task) => ({taskId: task.id, assignedTo: task.roleId, taskKind: task.kind, attempt: task.attempt, inputProjectionSchema: task.inputProjectionSchema, dependsOn: task.prerequisiteTaskIds}))), dispatchedAt: new Date(projectState().project.created_at).toISOString()};
  await runtimeEvent({kind: 'PROJECT_DISPATCHED', receipt: {...dispatchBase, receiptDigest: digest({...dispatchBase, memberBindings: [...bindings].sort((a, b) => a.roleId.localeCompare(b.roleId))})}}, 'PROJECT_DISPATCH');

  for (const node of dag) {
    lastTaskId = node.taskId; const taskBefore = mission.tasks.find((item) => item.id === node.taskId); const worker = workers.find((item) => item.name === node.assignedTo); if (!taskBefore || !worker?.matrixUserID) throw new Error('LIVE_TASK_BINDING_MISSING');
    const delegated = callTool(leader, 'taskflow', 'delegate_task', {projectId, taskId: node.taskId, roomId, spec: JSON.stringify({schemaVersion: 1, projectId, taskId: node.taskId, roleId: node.assignedTo, roleIdentityId: taskBefore.roleIdentityId, inputDigest: taskBefore.inputDigest, inputProjectionSchema: taskBefore.inputProjectionSchema, inputProjectionDigest: taskBefore.inputProjectionDigest, outputSchema: taskBefore.outputSchema, outputSchemaVersion: 1, executionMode: 'SHADOW_PREP_ONLY', externalActionAllowed: false})});
    if (!delegated.ok || delegated.task.status !== 'assigned') throw new Error(`LIVE_TASK_DELEGATE_FAILED:${node.taskId}`);
    const ack = callTool(node.assignedTo, 'taskflow', 'ack_task', {taskId: node.taskId}, worker.matrixUserID); if (!ack.ok || ack.task.status !== 'in_progress') throw new Error(`LIVE_TASK_ACK_FAILED:${node.taskId}`);
    const ackBase = {schemaVersion: 1, projectId, taskId: node.taskId, roleId: node.assignedTo, runtimeActorId: worker.matrixUserID, attempt: taskBefore.attempt, inputProjectionSchema: taskBefore.inputProjectionSchema, inputProjectionDigest: taskBefore.inputProjectionDigest, runtimeState: 'in_progress', acknowledgedAt: new Date(ack.task.acknowledged_at).toISOString()};
    await runtimeEvent({kind: 'TASK_ACK', receipt: {...ackBase, receiptDigest: digest(ackBase)}}, 'TASK_ACK', taskBefore);
    const task = mission.tasks.find((item) => item.id === node.taskId); if (!task) throw new Error('LIVE_TASK_REOPEN_FAILED');
    const payload = task.roleId === leader ? {projectId, externalActionAllowed: false} : await modelFromWorker(task.roleId, task);
    const outputDigest = digest(payload); const runtimeResult = {schemaVersion: 1, taskId: task.id, roleId: task.roleId, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest, payload, outputDigest, maturity: task.roleId === leader ? 'CANARY' : 'CANARY', externalActionAllowed: false};
    const submitted = callTool(task.roleId, 'taskflow', 'submit_task', {taskId: task.id, status: 'SUCCESS', summary: JSON.stringify(runtimeResult), deliverables: [], notes: ['LIVE_DEEPSEEK_UAT', 'NO_ACTION_GRANT', 'NO_CONNECTOR', 'NO_EXTERNAL_ACTION']}, worker.matrixUserID); if (!submitted.ok || !submitted.verified) throw new Error(`LIVE_TASK_SUBMIT_FAILED:${task.id}`);
    const checked = callTool(leader, 'taskflow', 'check_task', {taskId: task.id}); if (!checked.ok || !checked.effective || checked.task.status !== 'submitted') throw new Error(`LIVE_TASK_CHECK_FAILED:${task.id}`);
    const persisted = JSON.parse(checked.result.summary); const resultDigest = digest(persisted); if (persisted.outputDigest !== outputDigest) throw new Error('LIVE_TASK_ROUNDTRIP_MISMATCH');
    const submitBase = {schemaVersion: 1, projectId, taskId: task.id, roleId: task.roleId, runtimeActorId: worker.matrixUserID, attempt: task.attempt, ackReceiptDigest: mission.tasks.find((item) => item.id === task.id).runtimeAck.receiptDigest, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest, runtimeState: 'submitted', submittedAt: new Date(checked.task.submitted_at).toISOString(), resultDigest, resultSource: 'AGENTTEAMS_CHECK_TASK_PERSISTED_SUMMARY', runtimeObservationId: digest({projectId, taskId: task.id, resultDigest, inputProjectionDigest: task.inputProjectionDigest})};
    const submission = {schemaVersion: 1, missionId, taskId: task.id, roleId: task.roleId, roleIdentityId: task.roleIdentityId, inputDigest: task.inputDigest, inputProjectionSchema: task.inputProjectionSchema, inputProjectionDigest: task.inputProjectionDigest, skillLockDigest: task.skillLockDigest, outputSchema: task.outputSchema, outputSchemaVersion: 1, payload, outputDigest, runtimeResultMaturity: 'CANARY', runtimeReceipt: {...submitBase, receiptDigest: digest(submitBase)}};
    await runtimeEvent({kind: 'TASK_SUBMIT', submission}, 'TASK_SUBMIT', task); acceptTask(task.id);
  }
  const completed = callTool(leader, 'projectflow', 'complete_project', {projectId}); if (!completed.ok) throw new Error('LIVE_PROJECT_COMPLETE_FAILED');
  await runtimeEvent({kind: 'FINALIZE_ACCEPTED_OUTPUTS'}, 'FINALIZE');
  if (mission.state !== 'AWAITING_OWNER_REVIEW' || mission.modelCalls.length !== 7 || mission.revisions.length !== 5 || mission.audits.length !== 5 || mission.actionGrantCount !== 0 || mission.connectorCount !== 0 || mission.externalActionCount !== 0) throw new Error('LIVE_UAT_FINAL_STATE_INVALID');
  const evidence = {schemaVersion: 1, status: 'PASS', maturity: 'LIVE_PROVIDER_VERIFIED', generatedAt: new Date().toISOString(), missionId, campaignDigest, runtime: {name: 'AgentTeams', version: 'v1.2.0', sourceTarSha256: manifest.sourceTarSha256, images: manifest.images, memberCount: 6, taskCount: 8}, provider: {name: 'DeepSeek', model: mission.providerModel, receiptCount: receipts.length, receipts}, state: mission.state, noAction: {actionGrantCount: 0, connectorCount: 0, externalActionCount: 0}, secretPresent: false, ownerReviewRequired: true};
  await mkdir(path.join(root, '.evidence/sdd-002'), {recursive: true}); await writeFile(path.join(root, '.evidence/sdd-002/deepseek-live-canary.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', maturity: 'LIVE_PROVIDER_VERIFIED', missionId, state: mission.state, modelReceipts: receipts.length, ownerReviewRequired: true, externalActionCount: 0, evidence: '.evidence/sdd-002/deepseek-live-canary.json'}));
} catch (error) {
  try {
    if (mission?.runtimeExpectation) { const ticket = await issue('FAIL', mission.tasks.find((task) => task.id === lastTaskId) ?? null); await fetch(`${api}/api/v1/shadow-missions/${missionId}/live-runner/fail`, {method: 'POST', headers: {...organizationHeaders, 'x-lumiclaw-runtime-ticket': ticket, 'content-type': 'application/json'}, body: JSON.stringify({code: 'LIVE_UAT_RUNNER_INTERRUPTED', failedTaskId: lastTaskId, retryable: true})}); }
  } catch {}
  throw error;
}
