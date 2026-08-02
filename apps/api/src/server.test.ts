import {afterEach, describe, expect, it} from 'vitest';
import {buildApi} from './server.js';

const apps = [] as ReturnType<typeof buildApi>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('api foundation health', () => {
  it('returns an explicit non-live identity', async () => {
    const app = buildApi();
    apps.push(app);
    const response = await app.inject({method: 'GET', url: '/health'});

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: 'api',
      status: 'ok',
      mode: 'DEMO_SEED',
      live: false
    });
  });

  it('does not expose M1 routes', async () => {
    const app = buildApi();
    apps.push(app);
    const response = await app.inject({method: 'POST', url: '/api/v1/campaigns'});

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({code: 'FOUNDATION_ROUTE_NOT_FOUND'});
  });
});
