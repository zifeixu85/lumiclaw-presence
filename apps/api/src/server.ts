import Fastify, {type FastifyInstance} from 'fastify';

export function buildApi(): FastifyInstance {
  const app = Fastify({logger: false});

  app.get('/health', async () => ({
    service: 'api',
    status: 'ok',
    mode: 'DEMO_SEED',
    live: false
  }));

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({code: 'FOUNDATION_ROUTE_NOT_FOUND'});
  });

  return app;
}

async function start(): Promise<void> {
  const app = buildApi();
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  await app.listen({host: '0.0.0.0', port});
}

if (process.argv[1]?.endsWith('/server.js')) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
