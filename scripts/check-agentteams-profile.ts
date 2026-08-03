import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {
  probeRuntime,
  validateRuntimeProfile,
  validateTeamProfile,
  type RuntimeProfile,
  type TeamProfile
} from '../packages/runtime-agentteams/src/index.js';

const root = process.cwd();
const runtime = JSON.parse(
  await readFile(path.join(root, 'infra/agentteams/runtime-profile.json'), 'utf8')
) as RuntimeProfile;
const team = JSON.parse(
  await readFile(path.join(root, 'infra/agentteams/team-profile.json'), 'utf8')
) as TeamProfile;

const runtimeErrors = validateRuntimeProfile(runtime);
const teamErrors = validateTeamProfile(team);
if (runtimeErrors.length > 0 || teamErrors.length > 0) {
  throw new Error(JSON.stringify({runtimeErrors, teamErrors}));
}

const controlledFetch = async () =>
  new Response(JSON.stringify({controller: 'v1.2.0', kubeMode: 'controlled-fixture'}), {
    status: 200,
    headers: {'content-type': 'application/json'}
  });
const report = await probeRuntime(runtime, 'http://controlled-fixture.invalid', 'CONTROLLED_FIXTURE', controlledFetch);
const outputDir = path.join(root, '.evidence/sdd-002');
await mkdir(outputDir, {recursive: true});
await writeFile(
  path.join(outputDir, 'agentteams-capability-report.json'),
  `${JSON.stringify({...report, teamProfileValidation: 'PASS', roleCount: team.roles.length}, null, 2)}\n`
);
console.info(JSON.stringify(report));
