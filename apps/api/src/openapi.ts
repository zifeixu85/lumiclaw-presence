import {campaignDocumentSchema, organizationGraphSchema} from '@lumiclaw/domain';

export const openApiDocument = {
  openapi: '3.1.0',
  info: {title: 'LumiClaw Presence Control API', version: '0.1.0-m1', description: 'DEMO_SEED / NOT_LIVE Campaign walking skeleton. No external action endpoint exists.'},
  servers: [{url: '/'}],
  paths: {
    '/api/v1/campaigns': {
      get: {summary: 'List organization-scoped Campaigns', parameters: [organizationHeader()], responses: {'200': {description: 'Campaign summaries'}}},
      post: {summary: 'Create a Campaign', parameters: [organizationHeader(), idempotencyHeader()], requestBody: {required: true, content: {'application/json': {schema: {$ref: '#/components/schemas/CampaignDocument'}}}}, responses: {'201': {description: 'Created'}, '409': {description: 'Idempotency conflict'}, '422': {description: 'Domain validation failed'}, '428': {description: 'Required control header missing'}}}
    },
    '/api/v1/campaigns/{campaignId}': {
      get: {summary: 'Reopen a Campaign', parameters: [organizationHeader(), campaignId()], responses: {'200': {description: 'Campaign aggregate'}, '404': {description: 'Not found'}}},
      put: {summary: 'Save a new Campaign snapshot', parameters: [organizationHeader(), idempotencyHeader(), ifMatchHeader(), campaignId()], requestBody: {required: true, content: {'application/json': {schema: {$ref: '#/components/schemas/CampaignDocument'}}}}, responses: {'200': {description: 'Saved'}, '409': {description: 'Idempotency conflict'}, '412': {description: 'ETag conflict'}, '422': {description: 'Domain validation failed'}, '428': {description: 'Required control header missing'}}}
    },
    '/api/v1/campaigns/{campaignId}/mission-contract': {get: {summary: 'Read the persisted future AgentTeams adapter input contract', parameters: [organizationHeader(), campaignId()], responses: {'200': {description: 'Mission contract/source digest'}, '404': {description: 'Not found'}}}},
    '/api/v1/campaigns/{campaignId}/schedule-preview': {post: {summary: 'Resolve an IANA wall time and constrained RRULE without executing it', parameters: [organizationHeader(), campaignId()], requestBody: {required: true, content: {'application/json': {schema: {type: 'object'}}}}, responses: {'200': {description: 'Non-live schedule and occurrence rows ready to persist with Campaign PUT'}, '422': {description: 'Invalid IANA zone, DST gap, or constrained RRULE'}}}},
    '/api/v1/campaigns/demo-template': {get: {summary: 'Return a public-safe, non-persisted DEMO_SEED template', responses: {'200': {description: 'Synthetic Campaign document'}}}}
  },
  components: {schemas: {CampaignDocument: campaignDocumentSchema, OrganizationGraph: organizationGraphSchema}}
} as const;

function organizationHeader() { return {name: 'X-LumiClaw-Organization-Id', in: 'header', required: true, schema: {type: 'string', format: 'uuid'}} as const; }
function idempotencyHeader() { return {name: 'Idempotency-Key', in: 'header', required: true, schema: {type: 'string', minLength: 8, maxLength: 128}} as const; }
function ifMatchHeader() { return {name: 'If-Match', in: 'header', required: true, schema: {type: 'string'}} as const; }
function campaignId() { return {name: 'campaignId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}} as const; }
