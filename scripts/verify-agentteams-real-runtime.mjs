import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const controller = 'agentteams-controller';
const leader = 'presence-mission-leader';
const teamName = 'sdd002-governed-shadow';
const controlProject = 'lumiclaw-sdd002-agentteams-e2e';
const controlApi = 'http://127.0.0.1:4125';
let projectId = '';
let controlPlaneRunning = false;
const runtimeModel = 'mock-agentteams-conformance';
const expectedRoles = [
  leader,
  'evidence-claim-steward',
  'campaign-planner',
  'founder-identity-producer',
  'product-account-producer',
  'independent-auditor'
];
const events = [];
process.env.LUMICLAW_API_PORT = '4125';
process.env.LUMICLAW_WEB_PORT = '3125';

function run(executable, args, label, timeout = 30_000) {
  const startedAt = new Date().toISOString();
  try {
    const output = execFileSync(executable, args, {cwd: root, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe']}).trim();
    events.push({label, startedAt, status: 'PASS'});
    return output;
  } catch (error) {
    events.push({label, startedAt, status: 'FAIL'});
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
    throw new Error(`${label}: ${stderr || (error instanceof Error ? error.message : 'unknown failure')}`);
  }
}

function agt(resource) {
  return JSON.parse(run('docker', ['exec', controller, 'agt', 'get', resource, '-o', 'json'], `agt-get-${resource}`));
}

function workspace(role) {
  return `/root/.copaw-worker/${role}/.copaw/workspaces/default`;
}

function callTool(role, tool, action, payload, actor) {
  const modulePath = `copaw_worker.hooks.tools.${tool}`;
  const code = `import asyncio,base64,json,sys; from ${modulePath} import ${tool}; payload=json.loads(base64.b64decode(sys.argv[2]).decode()); response=asyncio.run(${tool}(sys.argv[1], payload)); print(response.content[0]["text"])`;
  const args = ['exec'];
  if (actor) args.push('-e', `AGENTTEAMS_MATRIX_USER_ID=${actor}`);
  args.push('-w', workspace(role), `agentteams-worker-${role}`, '/opt/venv/standard/bin/python', '-c', code, action, Buffer.from(JSON.stringify(payload)).toString('base64'));
  return JSON.parse(run('docker', args, `${role}:${tool}:${action}`, 45_000));
}

function projectState() {
  const code = 'import json,sys; from dataclasses import asdict; from copaw_worker.task import FileSystemTaskStore,parse_dag_tasks; s=FileSystemTaskStore(); m=s.read_project_meta(sys.argv[1]); p=s.read_project_plan(sys.argv[1]); print(json.dumps({"project":asdict(m),"tasks":[asdict(x) for x in parse_dag_tasks(p)]}))';
  return JSON.parse(run('docker', ['exec', '-w', workspace(leader), `agentteams-worker-${leader}`, '/opt/venv/standard/bin/python', '-c', code, projectId], 'project-state'));
}

function acceptSubmittedTask(taskId) {
  // AgentTeams v1.2.0 exposes create/plan/ready plus ACK/Submit, but no public
  // projectflow action for accepting a checked result. Use its typed state
  // primitives without changing Manager, Worker, Matrix, or any runtime source.
  const code = 'import sys; from copaw_worker.task import FileSystemTaskStore,parse_dag_tasks,_replace_task_status,replace_dag_tasks; s=FileSystemTaskStore(); p=s.read_project_plan(sys.argv[1]); s.write_project_plan(sys.argv[1],replace_dag_tasks(p,_replace_task_status(parse_dag_tasks(p),sys.argv[2],"completed"))); print("accepted")';
  run('docker', ['exec', '-w', workspace(leader), `agentteams-worker-${leader}`, '/opt/venv/standard/bin/python', '-c', code, projectId, taskId], `accept-checked-result:${taskId}`);
}

function digest(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}

async function request(pathname, init, expected) {
  const response = await fetch(`${controlApi}${pathname}`, init);
  const body = await response.json();
  if (response.status !== expected) throw new Error(`${init?.method ?? 'GET'} ${pathname}: expected ${expected}, received ${response.status} ${JSON.stringify(body)}`);
  return {body, etag: response.headers.get('etag')};
}

async function waitForControlApi() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${controlApi}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('PRODUCT_CONTROL_PLANE_NOT_HEALTHY');
}

function cleanupControlPlane() {
  if (!controlPlaneRunning) return;
  try { execFileSync('docker', ['compose', '--project-name', controlProject, 'down', '--volumes', '--remove-orphans'], {cwd: root, encoding: 'utf8', stdio: 'ignore'}); } catch {}
  controlPlaneRunning = false;
}
process.on('exit', cleanupControlPlane);

run('docker', ['compose', '--project-name', controlProject, 'down', '--volumes', '--remove-orphans'], 'control-plane-clean-start', 60_000);
controlPlaneRunning = true;
run('docker', ['compose', '--project-name', controlProject, 'up', '--build', '--detach', 'api'], 'control-plane-fresh-build', 420_000);
await waitForControlApi();

const template = await request('/api/v1/campaigns/demo-template', undefined, 200);
const campaign = template.body.document;
const organizationHeaders = {'x-lumiclaw-organization-id': campaign.organizationId};
const createdCampaign = await request('/api/v1/campaigns', {method: 'POST', headers: {...organizationHeaders, 'content-type': 'application/json', 'idempotency-key': 'real-runtime-campaign'}, body: JSON.stringify(campaign)}, 201);
const startedMission = await request(`/api/v1/campaigns/${campaign.id}/shadow-missions`, {method: 'POST', headers: {...organizationHeaders, 'content-type': 'application/json', 'idempotency-key': 'real-runtime-mission', 'if-match': createdCampaign.etag}, body: JSON.stringify({sourceDigest: createdCampaign.body.digest, fault: 'BETA_TO_GA'})}, 201);
let productMission = startedMission.body.mission;
let productEtag = startedMission.etag;
projectId = productMission.runtimeProjectId;
let runtimeEventCounter = 0;
async function runtimeEvent(body, expected = 200) {
  runtimeEventCounter += 1;
  const response = await request(`/api/v1/shadow-missions/${productMission.id}/runtime-events`, {method: 'POST', headers: {...organizationHeaders, 'content-type': 'application/json', 'idempotency-key': `real-runtime-event-${String(runtimeEventCounter).padStart(3, '0')}`, 'if-match': productEtag}, body: JSON.stringify(body)}, expected);
  productMission = response.body.mission; productEtag = response.etag; return response;
}

const sourceByPlatform = new Map(campaign.artifactRevisions.map((revision) => [revision.platform, revision]));
const runtimeDraft = (platform, revision, content) => ({platform, revision, sourceRevisionDigest: digest(sourceByPlatform.get(platform)), contentDigest: digest(content), content});
const sourceX = sourceByPlatform.get('X'); const faultyX = structuredClone(sourceX.content); faultyX.posts = ['LumiClaw Presence is generally available in every market today.'];
const founderPayload = {revisions: [runtimeDraft('X', 1, faultyX), runtimeDraft('X', 2, structuredClone(sourceX.content)), runtimeDraft('XIAOHONGSHU', 1, structuredClone(sourceByPlatform.get('XIAOHONGSHU').content))]};
const productPayload = {revisions: [runtimeDraft('BLUESKY', 1, structuredClone(sourceByPlatform.get('BLUESKY').content)), runtimeDraft('LINKEDIN', 1, structuredClone(sourceByPlatform.get('LINKEDIN').content))]};
const auditIssue = {code: 'CLAIM_OVERREACH', severity: 'BLOCKING', path: '/content/posts/0', message: '“Generally available” exceeds the frozen approved product-direction Claim.', evidenceRefIds: campaign.evidenceRefs.map((item) => item.id), nextResponsibleRoleId: 'founder-identity-producer'};
const auditorPayload = {decisions: [...founderPayload.revisions, ...productPayload.revisions].map((draft) => ({platform: draft.platform, revision: draft.revision, revisionContentDigest: draft.contentDigest, outcome: draft.platform === 'X' && draft.revision === 1 ? 'FAIL' : 'PASS', issues: draft.platform === 'X' && draft.revision === 1 ? [auditIssue] : []}))};
const payloadByRole = {
  'presence-mission-leader': {projectId, externalActionAllowed: false},
  'evidence-claim-steward': {frozen: true, claimEvidenceDigest: digest({claims: campaign.claims, evidence: campaign.evidenceRefs})},
  'campaign-planner': {activationPlanDigest: digest(campaign.activationPlan)},
  'founder-identity-producer': founderPayload,
  'product-account-producer': productPayload,
  'independent-auditor': auditorPayload
};
const titleByRole = {
  'presence-mission-leader': 'Coordinate exact SHADOW Project', 'evidence-claim-steward': 'Freeze Claim and Evidence bindings', 'campaign-planner': 'Allocate persisted activation plan',
  'founder-identity-producer': 'Produce X and Xiaohongshu revisions', 'product-account-producer': 'Produce Bluesky and LinkedIn revisions', 'independent-auditor': 'Independently audit exact revision digests'
};
const dag = productMission.tasks.map((task) => ({taskId: task.id, title: titleByRole[task.roleId], assignedTo: task.roleId, dependsOn: task.prerequisiteTaskIds}));
const workersDocument = agt('workers');
const teamsDocument = agt('teams');
const workers = workersDocument.workers.filter((worker) => expectedRoles.includes(worker.name));
if (workersDocument.total !== 6 || workers.length !== 6 || new Set(workers.map((worker) => worker.name)).size !== 6) throw new Error('REAL_RUNTIME_MEMBER_COUNT_NOT_EXACTLY_SIX');
if (workers.some((worker) => worker.phase !== 'Running' || worker.runtime !== 'copaw' || worker.model !== runtimeModel)) throw new Error('REAL_RUNTIME_MEMBER_NOT_READY_OR_PINNED');
const team = teamsDocument.teams.find((item) => item.name === teamName);
if (!team || team.phase !== 'Active' || team.leaderReady !== true || team.readyWorkers !== 5 || team.totalWorkers !== 5) throw new Error('REAL_RUNTIME_TEAM_NOT_ACTIVE');
if (team.workerMembers.length !== 6 || team.workerMembers.filter((member) => member.role === 'team_leader').length !== 1 || team.workerMembers.find((member) => member.role === 'team_leader')?.name !== leader) throw new Error('REAL_RUNTIME_LEADER_TOPOLOGY_INVALID');
const roomId = team.teamRoomID;
if (typeof roomId !== 'string' || roomId.length === 0) throw new Error('REAL_RUNTIME_TEAM_ROOM_MISSING');

const manifest = JSON.parse(await readFile(path.join(root, 'infra/agentteams/image-manifest.json'), 'utf8'));
const created = callTool(leader, 'projectflow', 'create_project', {projectId, title: 'SDD-002 Governed SHADOW Campaign', source: productMission.sourceCampaignDigest, requester: 'lumiclaw-postgresql-control-plane'});
if (!created.ok && !String(created.error).includes('already exists')) throw new Error(`REAL_PROJECT_CREATE_FAILED:${created.error}`);
const planned = callTool(leader, 'projectflow', 'plan_dag', {projectId, tasks: dag});
if (!planned.ok || planned.tasks.length !== 6) throw new Error('REAL_PROJECT_DAG_PLAN_FAILED');
await runtimeEvent({kind: 'PROJECT_DISPATCHED', buildDigest: `sha256:${manifest.sourceTarSha256}`});

const taskEvidence = [];
for (const node of dag) {
  let current = projectState().tasks.find((item) => item.task_id === node.taskId);
  if (!current) throw new Error(`REAL_DAG_NODE_MISSING:${node.taskId}`);
  let checked = callTool(leader, 'taskflow', 'check_task', {taskId: node.taskId});
  if (!(checked.ok && checked.effective)) {
    if (current.status === 'pending') {
      const productTask = productMission.tasks.find((task) => task.id === node.taskId);
      const payload = payloadByRole[node.assignedTo];
      if (!productTask || payload === undefined) throw new Error(`PRODUCT_TASK_CONTRACT_MISSING:${node.taskId}`);
      const contract = {
        schemaVersion: 1,
        projectId,
        taskId: node.taskId,
        roleId: node.assignedTo,
        roleIdentityId: productTask.roleIdentityId,
        inputDigest: productTask.inputDigest,
        skillLockDigest: productTask.skillLockDigest,
        outputSchema: productTask.outputSchema,
        outputSchemaVersion: productTask.outputSchemaVersion,
        outputDigest: digest(payload),
        executionMode: 'SHADOW_PREP_ONLY',
        externalActionAllowed: false
      };
      const delegated = callTool(leader, 'taskflow', 'delegate_task', {projectId, taskId: node.taskId, roomId, spec: JSON.stringify({...contract, payload})});
      if (!delegated.ok || delegated.task.status !== 'assigned') throw new Error(`REAL_TASK_DELEGATE_FAILED:${node.taskId}`);
    } else if (current.status !== 'delegated') {
      throw new Error(`REAL_TASK_STATE_NOT_RESUMABLE:${node.taskId}:${current.status}`);
    }
    const runtimeWorker = workers.find((worker) => worker.name === node.assignedTo);
    if (!runtimeWorker?.matrixUserID) throw new Error(`REAL_WORKER_IDENTITY_MISSING:${node.assignedTo}`);
    const acknowledged = callTool(node.assignedTo, 'taskflow', 'ack_task', {taskId: node.taskId}, runtimeWorker.matrixUserID);
    if (!acknowledged.ok || acknowledged.task.status !== 'in_progress') throw new Error(`REAL_TASK_ACK_FAILED:${node.taskId}:${acknowledged.error ?? ''}`);
    await runtimeEvent({kind: 'TASK_ACK', taskId: node.taskId, roleId: node.assignedTo});
    const productTask = productMission.tasks.find((task) => task.id === node.taskId); const payload = payloadByRole[node.assignedTo];
    if (!productTask || payload === undefined) throw new Error(`PRODUCT_TASK_CONTRACT_MISSING_AFTER_ACK:${node.taskId}`);
    const receipt = {
      schemaVersion: 1,
      taskId: node.taskId,
      roleId: node.assignedTo,
      payload,
      outputDigest: digest(payload),
      maturity: 'MOCK_CONFORMANCE',
      externalActionAllowed: false
    };
    const submitted = callTool(node.assignedTo, 'taskflow', 'submit_task', {taskId: node.taskId, status: 'SUCCESS', summary: JSON.stringify(receipt), deliverables: [], notes: ['REAL_AGENTTEAMS_V1_2_0_TASK_PROTOCOL', 'NO_ACTION_GRANT', 'NO_CONNECTOR', 'NO_EXTERNAL_ACTION']}, runtimeWorker.matrixUserID);
    if (!submitted.ok || submitted.verified !== true || submitted.task.status !== 'submitted') throw new Error(`REAL_TASK_SUBMIT_FAILED:${node.taskId}:${submitted.error ?? ''}`);
    checked = callTool(leader, 'taskflow', 'check_task', {taskId: node.taskId});
    const submission = {schemaVersion: 1, missionId: productMission.id, taskId: productTask.id, roleId: productTask.roleId, roleIdentityId: productTask.roleIdentityId, inputDigest: productTask.inputDigest, skillLockDigest: productTask.skillLockDigest, outputSchema: productTask.outputSchema, outputSchemaVersion: 1, payload, outputDigest: digest(payload)};
    if (node.assignedTo === 'evidence-claim-steward') {
      const quarantined = await runtimeEvent({kind: 'TASK_SUBMIT', submission: {...submission, outputDigest: '0'.repeat(64)}}, 422);
      if (quarantined.body.code !== 'RUNTIME_SUBMISSION_QUARANTINED') throw new Error('PRODUCT_DIGEST_MISMATCH_NOT_QUARANTINED');
    }
    await runtimeEvent({kind: 'TASK_SUBMIT', submission});
  }
  if (!checked.ok || checked.effective !== true || checked.task.status !== 'submitted') throw new Error(`REAL_TASK_CHECK_FAILED:${node.taskId}`);
  current = projectState().tasks.find((item) => item.task_id === node.taskId);
  if (current?.status !== 'completed') acceptSubmittedTask(node.taskId);
  taskEvidence.push({
    taskId: node.taskId,
    roleId: node.assignedTo,
    dependsOn: node.dependsOn,
    protocol: ['DELEGATE', 'ACK', 'SUBMIT', 'CHECK', 'ACCEPT'],
    taskStatus: checked.task.status,
    resultStatus: checked.result.status,
    effective: checked.effective,
    inputDigest: productMission.tasks.find((task) => task.id === node.taskId)?.inputDigest,
    outputSchema: productMission.tasks.find((task) => task.id === node.taskId)?.outputSchema,
    outputDigest: productMission.tasks.find((task) => task.id === node.taskId)?.acceptedOutputDigest
  });
}

const beforeComplete = projectState();
if (beforeComplete.tasks.some((task) => task.status !== 'completed')) throw new Error('REAL_PROJECT_DAG_NOT_COMPLETED');
const ready = callTool(leader, 'projectflow', 'ready_nodes', {projectId});
if (!ready.ok || ready.readyNodes.length !== 0) throw new Error('REAL_PROJECT_READY_SET_NOT_EMPTY');
const completed = callTool(leader, 'projectflow', 'complete_project', {projectId});
if (!completed.ok || completed.project.status !== 'completed') throw new Error('REAL_PROJECT_COMPLETE_FAILED');
await runtimeEvent({kind: 'FINALIZE_ACCEPTED_OUTPUTS'});
if (productMission.state !== 'NEEDS_OWNER_REVIEW' || productMission.revisions.length !== 5 || productMission.audits.length !== 5) throw new Error('PRODUCT_RUNTIME_OUTPUT_NOT_MATERIALIZED');
if (productMission.revisions.filter((revision) => revision.producerRoleId === 'founder-identity-producer').length !== 3 || productMission.audits.some((audit) => audit.auditorRoleId !== 'independent-auditor')) throw new Error('PRODUCT_PRODUCER_AUDITOR_SEPARATION_FAILED');
const correctedRevision = productMission.revisions.find((revision) => revision.id === productMission.fault.correctedRevisionId);
if (!correctedRevision) throw new Error('PRODUCT_CORRECTED_REVISION_MISSING');
const ownerReview = await request(`/api/v1/shadow-missions/${productMission.id}/owner-reviews`, {method: 'POST', headers: {...organizationHeaders, 'content-type': 'application/json', 'idempotency-key': 'real-runtime-owner-review', 'if-match': productEtag}, body: JSON.stringify({revisionId: correctedRevision.id, revisionDigest: correctedRevision.digest, decision: 'READY_FOR_FUTURE_EXECUTION'})}, 200);
productMission = ownerReview.body.mission; productEtag = ownerReview.etag;
if (productMission.reviews.length !== 1 || productMission.reviews[0].createsActionGrant !== false) throw new Error('PRODUCT_EXACT_OWNER_REVIEW_BOUNDARY_FAILED');

run('docker', ['restart', `agentteams-worker-${leader}`], 'restart-leader', 45_000);
let recoveredTeam;
for (let attempt = 0; attempt < 30; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  try {
    recoveredTeam = agt('teams').teams.find((item) => item.name === teamName);
    if (recoveredTeam?.leaderReady === true) break;
  } catch {}
}
if (recoveredTeam?.leaderReady !== true) throw new Error('REAL_RUNTIME_LEADER_RESTART_NOT_READY');
const recoveredProject = projectState();
if (recoveredProject.project.status !== 'completed' || recoveredProject.tasks.some((task) => task.status !== 'completed')) throw new Error('REAL_PROJECT_RESTART_RECOVERY_FAILED');

for (const image of manifest.images) {
  const reference = `${image.repository}:${image.tag}`;
  const repoDigests = JSON.parse(run('docker', ['image', 'inspect', reference, '--format', '{{json .RepoDigests}}'], `image-digest:${image.component}`));
  if (!repoDigests.includes(`${image.repository}@${image.digest}`)) throw new Error(`REAL_RUNTIME_IMAGE_DIGEST_MISMATCH:${image.component}`);
}
const cliVersion = run('docker', ['exec', controller, 'agt', 'version'], 'agt-version');
const providerProbeCode = 'import json,urllib.request; body=json.dumps({"model":"mock-agentteams-conformance","messages":[{"role":"user","content":"Return the public-safe SHADOW conformance receipt only."}],"response_format":{"type":"json_object"}}).encode(); req=urllib.request.Request("http://host.docker.internal:28333/v1/chat/completions",data=body,headers={"content-type":"application/json"}); response=urllib.request.urlopen(req,timeout=5); data=json.loads(response.read().decode()); print(json.dumps({"status":response.status,"maturity":response.headers.get("x-lumiclaw-maturity"),"model":data.get("model"),"content":json.loads(data["choices"][0]["message"]["content"])}))';
const providerRuntimeProbe = JSON.parse(run('docker', ['exec', `agentteams-worker-${leader}`, '/opt/venv/standard/bin/python', '-c', providerProbeCode], 'agentteams-container-model-provider-probe'));
if (providerRuntimeProbe.status !== 200 || providerRuntimeProbe.maturity !== 'MOCK_CONFORMANCE' || providerRuntimeProbe.content?.externalActionAllowed !== false) throw new Error('PUBLIC_SAFE_RUNTIME_MODEL_CONTAINER_PROBE_FAILED');
const mockHealth = await fetch('http://127.0.0.1:28333/health', {signal: AbortSignal.timeout(3_000)}).then((response) => response.json());
if (mockHealth.provider !== 'PUBLIC_SAFE_MOCK' || mockHealth.maturity !== 'MOCK_CONFORMANCE' || mockHealth.realModelClaim !== false || mockHealth.requestCounts?.chatCompletions < 1) throw new Error('PUBLIC_SAFE_RUNTIME_MODEL_MATURITY_INVALID');

run('docker', ['compose', '--project-name', controlProject, 'restart', 'api'], 'product-api-restart', 60_000);
await waitForControlApi();
const reopenedProduct = await request(`/api/v1/shadow-missions/${productMission.id}`, {headers: organizationHeaders}, 200);
if (reopenedProduct.body.mission.etag !== productMission.etag || reopenedProduct.body.mission.revisions.length !== 5 || reopenedProduct.body.mission.audits.length !== 5 || reopenedProduct.body.mission.reviews.length !== 1) throw new Error('PRODUCT_POSTGRES_RESTART_RECOVERY_FAILED');
const publicEvidence = await request(`/api/v1/shadow-missions/${productMission.id}/evidence`, {headers: organizationHeaders}, 200);
if (publicEvidence.body.evidence.noAction.actionGrantCount !== 0 || publicEvidence.body.evidence.noAction.connectorCount !== 0 || publicEvidence.body.evidence.noAction.externalActionCount !== 0) throw new Error('PRODUCT_PUBLIC_EVIDENCE_NO_ACTION_FAILED');
run('docker', ['compose', '--project-name', controlProject, 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-v', 'ON_ERROR_STOP=1', '-c', `update missions set payload=jsonb_set(payload,'{state}',to_jsonb('FAILED'::text)) where id='${productMission.id}'`], 'tamper-aggregate-state');
const diverged = await request(`/api/v1/shadow-missions/${productMission.id}`, {headers: organizationHeaders}, 422);
if (diverged.body.code !== 'CONTROL_PLANE_HISTORY_DIVERGED') throw new Error('NORMALIZED_HISTORY_DIVERGENCE_NOT_REJECTED');
run('docker', ['compose', '--project-name', controlProject, 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-v', 'ON_ERROR_STOP=1', '-c', `update missions set payload=jsonb_set(payload,'{state}',to_jsonb(state)) where id='${productMission.id}'`], 'restore-aggregate-state');
const databaseCounts = JSON.parse(run('docker', ['compose', '--project-name', controlProject, 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'lumiclaw', '-At', '-c', "select json_build_object('campaigns',(select count(*) from campaigns),'missions',(select count(*) from missions),'agent_runs',(select count(*) from agent_runs),'agent_tasks',(select count(*) from agent_tasks),'revisions',(select count(*) from governed_artifact_revisions),'audits',(select count(*) from audit_decisions),'owner_reviews',(select count(*) from owner_reviews),'action_tables',(select count(*) from information_schema.tables where table_schema='public' and table_name in ('action_grants','connectors','action_outbox')))"], 'product-database-counts'));
if (databaseCounts.campaigns !== 1 || databaseCounts.missions !== 1 || databaseCounts.agent_runs !== 6 || databaseCounts.agent_tasks !== 6 || databaseCounts.revisions !== 5 || databaseCounts.audits !== 5 || databaseCounts.owner_reviews !== 1 || databaseCounts.action_tables !== 0) throw new Error('PRODUCT_CONTROL_PLANE_COUNTS_INVALID');

const evidence = {
  schemaVersion: 1,
  status: 'PASS',
  maturity: 'ENGINEERING_VERIFIED',
  generatedAt: new Date().toISOString(),
  runtime: {
    name: 'AgentTeams',
    requestedVersion: 'v1.2.0',
    sourceTagCommit: manifest.sourceTagCommit,
    sourceTarSha256: manifest.sourceTarSha256,
    cliVersion,
    images: manifest.images,
    realAgentTeamsAcceptance: true,
    realModelAcceptance: false,
    modelMaturity: 'MOCK_CONFORMANCE'
  },
  topology: {
    team: teamName,
    phase: recoveredTeam.phase,
    leader: leader,
    leaderCount: 1,
    workerCount: 5,
    memberCount: 6,
    roomBindingDigest: digest(roomId),
    members: workers.map(({name, phase, runtime, model, identity}) => ({name, phase, runtime, model, identity}))
  },
  project: {
    id: projectId,
    status: recoveredProject.project.status,
    planType: 'dag',
    taskCount: recoveredProject.tasks.length,
    tasks: taskEvidence,
    restartRecovered: true
  },
  productControlPlane: {
    persistedCampaignId: campaign.id,
    sourceCampaignDigest: createdCampaign.body.digest,
    missionId: productMission.id,
    runtimeProjectId: productMission.runtimeProjectId,
    sameProjectBinding: productMission.runtimeProjectId === projectId,
    state: productMission.state,
    immutableRevisionCount: productMission.revisions.length,
    auditDecisionCount: productMission.audits.length,
    syntheticExactOwnerReviewCount: productMission.reviews.length,
    digestMismatchQuarantined: true,
    normalizedHistoryDivergenceRejected: true,
    apiRestartRecovered: true,
    databaseCounts,
    runtimeEvidenceMaturity: 'REAL_AGENTTEAMS_WITH_MOCK_MODEL_CONFORMANCE'
  },
  provider: {...mockHealth, runtimeContainerProbe: providerRuntimeProbe},
  noAction: {executionMode: 'SHADOW_PREP_ONLY', externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0},
  boundedRuntimeGap: {
    code: 'AGENTTEAMS_V1_2_0_PROJECTFLOW_ACCEPT_ACTION_ABSENT',
    observed: true,
    contributionMade: false,
    minimumBridge: 'After official taskflow CHECK returns effective=true, the verifier uses the existing typed FileSystemTaskStore DAG status primitive. No AgentTeams source or image is modified.'
  },
  events
};
cleanupControlPlane();
await mkdir(path.join(root, '.evidence/sdd-002'), {recursive: true});
await writeFile(path.join(root, '.evidence/sdd-002/agentteams-real-runtime.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.info(JSON.stringify({status: 'PASS', realAgentTeamsAcceptance: true, realModelAcceptance: false, memberCount: 6, tasks: 6, restartRecovered: true, evidence: '.evidence/sdd-002/agentteams-real-runtime.json'}));
