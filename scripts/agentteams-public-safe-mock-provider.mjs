import {createServer} from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '28333', 10);
const model = 'mock-agentteams-conformance';
const responseText = JSON.stringify({maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false, message: 'Public-safe deterministic AgentTeams runtime fixture.'});
const requestCounts = {models: 0, embeddings: 0, chatCompletions: 0, notFound: 0};

const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-lumiclaw-maturity', 'MOCK_CONFORMANCE');
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({status: 'ok', provider: 'PUBLIC_SAFE_MOCK', maturity: 'MOCK_CONFORMANCE', model, requestCounts, realModelClaim: false, externalActionAllowed: false}));
      return;
    }
    if (request.method === 'GET' && request.url === '/v1/models') {
      requestCounts.models += 1;
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({object: 'list', data: [{id: model, object: 'model', owned_by: 'lumiclaw-public-safe-mock'}]}));
      return;
    }
    if (request.method === 'POST' && request.url === '/v1/embeddings') {
      requestCounts.embeddings += 1;
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({object: 'list', data: [{object: 'embedding', index: 0, embedding: Array.from({length: 32}, () => 0)}], model, usage: {prompt_tokens: 0, total_tokens: 0}}));
      return;
    }
    if (request.method === 'POST' && request.url === '/v1/chat/completions') {
      requestCounts.chatCompletions += 1;
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
      const id = `chatcmpl-public-safe-${Date.now()}`;
      if (body.stream === true) {
        response.writeHead(200, {'content-type': 'text/event-stream', connection: 'keep-alive'});
        response.write(`data: ${JSON.stringify({id, object: 'chat.completion.chunk', model, choices: [{index: 0, delta: {role: 'assistant', content: responseText}, finish_reason: null}]})}\n\n`);
        response.write(`data: ${JSON.stringify({id, object: 'chat.completion.chunk', model, choices: [{index: 0, delta: {}, finish_reason: 'stop'}]})}\n\n`);
        response.end('data: [DONE]\n\n');
        return;
      }
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model, choices: [{index: 0, message: {role: 'assistant', content: responseText}, finish_reason: 'stop'}], usage: {prompt_tokens: 0, completion_tokens: 0, total_tokens: 0}}));
      return;
    }
    requestCounts.notFound += 1;
    response.writeHead(404, {'content-type': 'application/json'});
    response.end(JSON.stringify({error: {code: 'PUBLIC_SAFE_MOCK_ROUTE_NOT_FOUND', externalActionAllowed: false}}));
  });
});

server.listen(port, '0.0.0.0', () => console.info(JSON.stringify({status: 'READY', provider: 'PUBLIC_SAFE_MOCK', model, port, externalActionAllowed: false})));
