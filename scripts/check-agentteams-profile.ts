import {createHash} from 'node:crypto';
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
const runtimeProfilePath = path.join(root, 'infra/agentteams/runtime-profile.json');
const teamProfilePath = path.join(root, 'infra/agentteams/team-profile.json');
const runtimeText = await readFile(runtimeProfilePath, 'utf8');
const teamText = await readFile(teamProfilePath, 'utf8');
const runtime = JSON.parse(runtimeText) as RuntimeProfile;
const team = JSON.parse(teamText) as TeamProfile;

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
  `${JSON.stringify({
    ...report,
    runtimeProfileValidation: 'PASS',
    teamProfileValidation: 'PASS',
    roleCount: team.roles.length,
    profiles: {
      runtime: {
        path: 'infra/agentteams/runtime-profile.json',
        sha256: createHash('sha256').update(runtimeText).digest('hex'),
        id: runtime.id,
        runtime: runtime.runtime,
        version: runtime.version,
        images: runtime.images
      },
      team: {
        path: 'infra/agentteams/team-profile.json',
        sha256: createHash('sha256').update(teamText).digest('hex'),
        id: team.id,
        runtimeVersion: team.runtimeVersion,
        executionMode: team.executionMode,
        externalActionAllowed: team.externalActionAllowed,
        modelMaturity: team.modelMaturity,
        roles: team.roles.map(({id, orchestrationOnly, permissions, skillLocks}) => ({id, orchestrationOnly, permissions, skillLocks})),
        skillLocks: [...new Set(team.roles.flatMap((role) => role.skillLocks))].sort()
      }
    }
  }, null, 2)}\n`
);
console.info(JSON.stringify(report));
