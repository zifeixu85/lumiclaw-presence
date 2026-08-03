import {campaignDocumentSchema, organizationGraphSchema} from '@lumiclaw/domain';

export const openApiDocument = {
  openapi: '3.1.0',
  info: {title: 'LumiClaw Presence Control API', version: '0.2.0-m2', description: 'DEMO_SEED / NOT_LIVE governed SHADOW Campaign. No ActionGrant, connector, schedule execution, or external action endpoint exists.'},
  servers: [{url: '/'}],
  paths: {
    '/api/v1/campaigns': {
      get: {summary: 'List organization-scoped Campaigns', parameters: [organizationHeader()], responses: {'200': {description: 'Campaign summaries'}}},
      post: {summary: 'Create a Campaign', parameters: [organizationHeader(), idempotencyHeader()], requestBody: {required: true, content: {'application/json': {schema: {$ref: '#/components/schemas/CampaignDocument'}}}}, responses: {'201': {description: 'Created'}, '409': {description: 'Idempotency conflict'}, '422': {description: 'Domain validation failed'}, '428': {description: 'Required control header missing'}}}
    },
    '/api/v1/campaigns/{campaignId}': {
      get: {summary: 'Reopen a Campaign', parameters: [organizationHeader(), campaignId()], responses: {'200': {description: 'Campaign aggregate'}, '404': {description: 'Not found'}}},
      put: {summary: 'Save a new Campaign snapshot and server-derive any appended schedule rows', parameters: [organizationHeader(), idempotencyHeader(), ifMatchHeader(), campaignId()], requestBody: {required: true, content: {'application/json': {schema: {$ref: '#/components/schemas/CampaignDocument'}}}}, responses: {'200': {description: 'Saved'}, '409': {description: 'Idempotency conflict'}, '412': {description: 'ETag conflict'}, '422': {description: 'Domain validation failed'}, '428': {description: 'Required control header missing'}}}
    },
    '/api/v1/campaigns/{campaignId}/mission-contract': {get: {summary: 'Read the persisted future AgentTeams adapter input contract', parameters: [organizationHeader(), campaignId()], responses: {'200': {description: 'Mission contract/source digest'}, '404': {description: 'Not found'}}}},
    '/api/v1/campaigns/{campaignId}/schedule-preview': {post: {summary: 'Resolve an IANA wall time and constrained RRULE without executing it', parameters: [organizationHeader(), campaignId()], requestBody: {required: true, content: {'application/json': {schema: {$ref: '#/components/schemas/SchedulePreviewInput'}}}}, responses: {'200': {description: 'Non-live proposal; Campaign PUT validates it and re-derives authoritative schedule/occurrence IDs, timestamps, states, scope, and ArtifactRevision bindings'}, '422': {description: 'Invalid IANA zone, DST gap, or constrained RRULE'}}}},
    '/api/v1/campaigns/demo-template': {get: {summary: 'Return a public-safe, non-persisted DEMO_SEED template', responses: {'200': {description: 'Synthetic Campaign document'}}}},
    '/api/v1/campaigns/{campaignId}/shadow-missions': {
      get: {summary: 'List PostgreSQL-owned SHADOW Missions', parameters: [organizationHeader(), campaignId()], responses: {'200': {description: 'Mission list'}}},
      post: {summary: 'Queue an exact-digest six-member SHADOW Mission', parameters: [organizationHeader(), idempotencyHeader(), ifMatchHeader(), campaignId()], responses: {'201': {description: 'Queued; no external action'}}}
    },
    '/api/v1/shadow-missions/{missionId}': {get: {summary: 'Reopen a governed Mission with business state and progressively disclosed evidence', parameters: [organizationHeader()], responses: {'200': {description: 'Mission'}}}},
    '/api/v1/shadow-missions/{missionId}/runtime-events': {post: {summary: 'Import exact Project dispatch, Task ACK/Submit, and finalization events from the AgentTeams adapter; digest/schema/role validation is authoritative in PostgreSQL', parameters: [organizationHeader(), idempotencyHeader(), ifMatchHeader()], responses: {'200': {description: 'Runtime event accepted'}, '422': {description: 'Runtime submission quarantined or schema rejected'}}}},
    '/api/v1/shadow-missions/{missionId}/public-safe-flight': {post: {summary: 'Run deterministic MOCK_CONFORMANCE fault/re-audit flight; never claims real AgentTeams', parameters: [organizationHeader(), idempotencyHeader(), ifMatchHeader()], responses: {'200': {description: 'Public-safe conformance result'}}}},
    '/api/v1/shadow-missions/{missionId}/owner-reviews': {post: {summary: 'Record exact NON_EXECUTABLE Owner Review; never creates ActionGrant', parameters: [organizationHeader(), idempotencyHeader(), ifMatchHeader()], responses: {'200': {description: 'Review recorded'}}}},
    '/api/v1/shadow-missions/{missionId}/evidence': {get: {summary: 'Export allowlisted, redacted, replayable evidence', parameters: [organizationHeader()], responses: {'200': {description: 'Public-safe evidence'}}}}
  },
  components: {schemas: {CampaignDocument: campaignDocumentSchema, OrganizationGraph: organizationGraphSchema, SchedulePreviewInput: {type: 'object', additionalProperties: false, required: ['localStart', 'timeZone', 'foldPreference', 'misfirePolicy'], properties: {localStart: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$'}, timeZone: {type: 'string', minLength: 1}, rrule: {type: ['string', 'null'], description: 'M1 accepts exactly FREQ=DAILY|WEEKLY;INTERVAL=1..30;COUNT=1..50.'}, foldPreference: {enum: ['EARLIER', 'LATER']}, misfirePolicy: {enum: ['SKIP', 'HOLD_FOR_OWNER']}}}}}
} as const;

function organizationHeader() { return {name: 'X-LumiClaw-Organization-Id', in: 'header', required: true, schema: {type: 'string', format: 'uuid'}} as const; }
function idempotencyHeader() { return {name: 'Idempotency-Key', in: 'header', required: true, schema: {type: 'string', minLength: 8, maxLength: 128}} as const; }
function ifMatchHeader() { return {name: 'If-Match', in: 'header', required: true, schema: {type: 'string'}} as const; }
function campaignId() { return {name: 'campaignId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}} as const; }
