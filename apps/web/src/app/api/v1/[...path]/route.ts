import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

const controlApi = process.env.CONTROL_API_URL ?? 'http://127.0.0.1:4100';
const forwardedRequestHeaders = ['content-type', 'x-lumiclaw-organization-id', 'idempotency-key', 'if-match'];
const forwardedResponseHeaders = ['content-type', 'etag', 'location', 'idempotency-replayed'];

async function proxy(request: NextRequest, context: {params: Promise<{path: string[]}>}): Promise<NextResponse> {
  const {path} = await context.params;
  const target = new URL(`/api/v1/${path.join('/')}${request.nextUrl.search}`, controlApi);
  const headers = new Headers();
  forwardedRequestHeaders.forEach((name) => {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  });
  try {
    const init: RequestInit = {method: request.method, headers, cache: 'no-store'};
    if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer();
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    forwardedResponseHeaders.forEach((name) => {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    });
    return new NextResponse(upstream.body, {status: upstream.status, headers: responseHeaders});
  } catch {
    return NextResponse.json({code: 'CONTROL_PLANE_UNAVAILABLE', mode: 'DEMO_SEED', live: false}, {status: 503});
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
