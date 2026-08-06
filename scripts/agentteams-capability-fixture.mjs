import {createServer} from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '8090', 10);
const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({status: 'ok', fixture: true, live: false}));
    return;
  }
  if (request.url === '/api/v1/version') {
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({controller: 'v1.2.0', kubeMode: 'controlled-fixture'}));
    return;
  }
  response.writeHead(404, {'content-type': 'application/json'});
  response.end(JSON.stringify({code: 'FIXTURE_ROUTE_NOT_FOUND'}));
});

server.listen(port, '0.0.0.0', () => {
  console.info(JSON.stringify({status: 'ready', fixture: true, liveAgentTeamRun: false, port}));
});
