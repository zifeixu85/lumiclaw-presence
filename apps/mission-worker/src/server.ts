import {PostgresShadowMissionRepository} from '@lumiclaw/governed-shadow';
import {createServer} from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '4001', 10);
const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined) throw new Error('DATABASE_URL is required.');
const repository = new PostgresShadowMissionRepository(connectionString);
const server = createServer(async (request, response) => {
  response.setHeader('cache-control', 'no-store'); response.setHeader('content-type', 'application/json');
  if (request.method !== 'GET' || request.url !== '/health') { response.writeHead(404); response.end(JSON.stringify({code: 'MISSION_WORKER_ROUTE_NOT_FOUND', externalActionAllowed: false})); return; }
  try {
    if (!await repository.health()) throw new Error('missions marker missing');
    response.writeHead(200); response.end(JSON.stringify({service: 'mission-worker', status: 'ok', mode: 'DEMO_SEED', live: false, controlPlane: 'POSTGRESQL', executionMode: 'SHADOW_PREP_ONLY', runtimeAdapter: 'agentteams-v1.2.0', runtimeAcceptance: 'SEPARATE_REAL_RUNTIME_EVIDENCE_REQUIRED', externalActionAllowed: false}));
  } catch {
    response.writeHead(503); response.end(JSON.stringify({service: 'mission-worker', status: 'unavailable', code: 'CONTROL_PLANE_UNAVAILABLE', live: false, externalActionAllowed: false}));
  }
});
server.listen(port, '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { server.close(() => { void repository.close().finally(() => { process.exitCode = 0; }); }); });
