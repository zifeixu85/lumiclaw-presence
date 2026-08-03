import {createServer} from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '4002', 10);
const server = createServer((request, response) => {
  response.setHeader('cache-control', 'no-store'); response.setHeader('content-type', 'application/json');
  if (request.method !== 'GET' || request.url !== '/health') { response.writeHead(404); response.end(JSON.stringify({code: 'ACTION_OPERATOR_DORMANT', actionGrantRoutes: 0, connectorRoutes: 0, externalActionAllowed: false})); return; }
  response.writeHead(200); response.end(JSON.stringify({service: 'action-operator', status: 'ok', mode: 'DEMO_SEED', live: false, state: 'DORMANT_NO_GRANTS', actionGrantRoutes: 0, connectorRoutes: 0, externalActionAllowed: false}));
});
server.listen(port, '0.0.0.0');
