import {createServer} from 'node:http';
import {MemoryActionRepository, PostgresActionRepository} from '@lumiclaw/db';
import type {ActionRepository} from '@lumiclaw/domain';
import {OutboxConsumer} from './outbox-consumer.js';

const port = Number.parseInt(process.env.PORT ?? '4002', 10);
const connectionString = process.env.DATABASE_URL;

// Select repository: Postgres when DATABASE_URL is set, memory otherwise (DEMO mode).
let repo: ActionRepository;
let consumer: OutboxConsumer;

if (connectionString !== undefined) {
  repo = new PostgresActionRepository(connectionString);
  consumer = new OutboxConsumer(repo, `operator-${process.pid ?? 'main'}-${Date.now()}`);
  consumer.start();
} else {
  repo = new MemoryActionRepository();
  consumer = new OutboxConsumer(repo, 'operator-demo');
  consumer.start();
}

const server = createServer((request, response) => {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-type', 'application/json');

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200);
    response.end(JSON.stringify({
      service: 'action-operator',
      status: 'ok',
      mode: connectionString ? 'POSTGRESQL' : 'DEMO_SEED',
      live: false,
      state: consumer.running ? 'CONSUMING' : 'STOPPED',
      actionGrantRoutes: 1, // outbox consumer
      connectorRoutes: 3,   // Bluesky, LinkedIn, Xiaohongshu
      externalActionAllowed: false,
    }));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({
    code: 'ACTION_OPERATOR_ROUTE_NOT_FOUND',
    actionGrantRoutes: 1,
    connectorRoutes: 3,
    externalActionAllowed: false,
  }));
});

server.listen(port, '0.0.0.0');
