import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const project = 'lumiclaw-sdd002-agentteams-image-verify';
const composeFile = 'infra/agentteams/compose.agentteams-profile.yml';
const evidencePath = path.join(root, '.evidence/sdd-002/agentteams-image-smoke.json');
const events = [];
const baseArgs = ['compose', '--project-name', project, '-f', composeFile, '--profile', 'agentteams-smoke'];

function docker(args, options = {}) {
  const command = ['docker', ...baseArgs, ...args];
  const startedAt = new Date().toISOString();
  try {
    const output = execFileSync(command[0], command.slice(1), {
      cwd: root,
      encoding: 'utf8',
      stdio: options.capture === false ? 'inherit' : ['ignore', 'pipe', 'pipe']
    });
    events.push({command, startedAt, status: 'PASS'});
    return output ?? '';
  } catch (error) {
    events.push({command, startedAt, status: 'FAIL'});
    throw error;
  }
}

await mkdir(path.dirname(evidencePath), {recursive: true});
const runtimeProfile = JSON.parse(await readFile(path.join(root, 'infra/agentteams/runtime-profile.json'), 'utf8'));
let result = 'FAIL';
let cleanup = 'FAIL';
let primaryError = null;
let cleanupError = null;
let manager = null;
let worker = null;
try {
  docker(['down', '--volumes', '--remove-orphans']);
  docker(['config', '--quiet']);
  docker(['up', '--build', '--detach', '--wait', 'capability-fixture'], {capture: false});
  manager = JSON.parse(docker(['run', '--rm', '--no-deps', 'agentteams-manager-probe']));
  worker = JSON.parse(docker(['run', '--rm', '--no-deps', 'agentteams-worker-probe']));
  for (const [component, response] of [['manager', manager], ['worker', worker]]) {
    if (response.controller !== 'v1.2.0' || response.kubeMode !== 'controlled-fixture') {
      throw new Error(`${component.toUpperCase()}_IMAGE_PROBE_CONTRACT_FAILED`);
    }
  }
  result = 'PASS';
} catch (error) {
  primaryError = error instanceof Error ? error.message : 'UNKNOWN_AGENTTEAMS_IMAGE_SMOKE_ERROR';
  throw error;
} finally {
  try {
    docker(['down', '--volumes', '--remove-orphans']);
    cleanup = 'PASS';
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : 'UNKNOWN_AGENTTEAMS_CLEANUP_ERROR';
  }
  await writeFile(evidencePath, `${JSON.stringify({
    schemaVersion: '1.0.0',
    kind: 'AGENTTEAMS_IMAGE_CLI_AND_ADAPTER_CONTRACT_SMOKE',
    project,
    result,
    cleanup,
    generatedAt: new Date().toISOString(),
    images: runtimeProfile.images,
    probes: {manager, worker},
    liveAgentTeamRun: false,
    limitations: [
      'CONTROLLED_VERSION_FIXTURE_ONLY',
      'NO_MANAGER_WORKER_OR_MISSION_STARTED',
      'NO_MODEL_PROVIDER_OR_PLATFORM_SECRET'
    ],
    primaryError,
    cleanupError,
    events
  }, null, 2)}\n`);
  if (cleanupError !== null && primaryError === null) throw new Error(cleanupError);
}

console.info(JSON.stringify({status: result, project, evidence: '.evidence/sdd-002/agentteams-image-smoke.json'}));
