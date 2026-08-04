import {createServer} from 'node:http';
import {createHash} from 'node:crypto';

const port = Number.parseInt(process.env.PORT ?? '28333', 10);
const model = 'mock-agentteams-conformance';
const genericResponse = {maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false, message: 'Public-safe deterministic AgentTeams runtime fixture.'};
const requestCounts = {models: 0, embeddings: 0, chatCompletions: 0, notFound: 0};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}

function digest(value) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex'); }

function generatedTaskResult(body) {
  const message = [...(Array.isArray(body.messages) ? body.messages : [])].reverse().find((item) => item?.role === 'user' && typeof item.content === 'string');
  let input;
  try { input = JSON.parse(message?.content ?? ''); } catch { return genericResponse; }
  if (input?.kind !== 'LUMICLAW_PUBLIC_SAFE_SHADOW_TASK' || input.externalActionAllowed !== false || input.campaign === undefined) return genericResponse;
  const campaign = input.campaign; const byPlatform = new Map(campaign.artifactRevisions.map((revision) => [revision.platform, revision]));
  const draft = (platform, revision, content) => ({platform, revision, sourceRevisionDigest: digest(byPlatform.get(platform)), contentDigest: digest(content), content});
  let payload;
  if (input.roleId === 'presence-mission-leader') payload = {projectId: input.projectId, externalActionAllowed: false};
  else if (input.roleId === 'evidence-claim-steward') payload = {frozen: true, claimEvidenceDigest: digest({claims: campaign.claims, evidence: campaign.evidenceRefs})};
  else if (input.roleId === 'campaign-planner') payload = {activationPlanDigest: digest(campaign.activationPlan)};
  else if (input.roleId === 'founder-identity-producer') {
    const sourceX = byPlatform.get('X'); const faultyX = structuredClone(sourceX.content); faultyX.posts = ['LumiClaw Presence is generally available in every market today.'];
    payload = {revisions: [draft('X', 1, faultyX), draft('X', 2, structuredClone(sourceX.content)), draft('XIAOHONGSHU', 1, structuredClone(byPlatform.get('XIAOHONGSHU').content))]};
  } else if (input.roleId === 'product-account-producer') {
    payload = {revisions: [draft('BLUESKY', 1, structuredClone(byPlatform.get('BLUESKY').content)), draft('LINKEDIN', 1, structuredClone(byPlatform.get('LINKEDIN').content))]};
  } else if (input.roleId === 'independent-auditor') {
    const revisions = [...(input.upstream?.founder?.revisions ?? []), ...(input.upstream?.product?.revisions ?? [])];
    payload = {decisions: revisions.map((revision) => {
      const text = JSON.stringify(revision.content).toLowerCase(); const fault = revision.platform === 'X' && revision.revision === 1 && text.includes('generally available');
      const issue = {code: 'CLAIM_OVERREACH', severity: 'BLOCKING', path: '/content/posts/0', message: '“Generally available” exceeds the frozen approved product-direction Claim.', evidenceRefIds: campaign.evidenceRefs.map((item) => item.id), nextResponsibleRoleId: 'founder-identity-producer'};
      return {platform: revision.platform, revision: revision.revision, revisionContentDigest: revision.contentDigest, outcome: fault ? 'FAIL' : 'PASS', issues: fault ? [issue] : []};
    })};
  } else return genericResponse;
  const outputDigest = digest(payload);
  return {schemaVersion: 1, taskId: input.taskId, roleId: input.roleId, payload, outputDigest, maturity: 'MOCK_CONFORMANCE', externalActionAllowed: false};
}

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
      const responseText = JSON.stringify(generatedTaskResult(body));
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
