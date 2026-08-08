import {createServer, type Server} from 'node:http';

export const FOUNDATION_MODE = 'DEMO_SEED' as const;

export type FoundationService =
  | 'api'
  | 'mission-worker'
  | 'action-operator'
  | 'web';

export type HealthPayload = {
  service: FoundationService;
  status: 'ok';
  mode: typeof FOUNDATION_MODE;
  live: false;
};

export function createHealthPayload(service: FoundationService): HealthPayload {
  return {service, status: 'ok', mode: FOUNDATION_MODE, live: false};
}

export function startHealthServer(service: FoundationService, port: number): Server {
  const payload = createHealthPayload(service);
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404, {'content-type': 'application/json'});
      response.end(JSON.stringify({code: 'FOUNDATION_ROUTE_NOT_FOUND'}));
      return;
    }

    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'application/json'
    });
    response.end(JSON.stringify(payload));
  });

  server.listen(port, '0.0.0.0');
  return server;
}
