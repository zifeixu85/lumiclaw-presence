import {Ajv, type ErrorObject} from 'ajv';
import type {CampaignDocument} from './campaign-types.js';
import type {ValidationIssue} from './types.js';

const id = {type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'} as const;
const dateTime = {type: 'string', format: 'date-time'} as const;

export const campaignDocumentSchema = {
  $id: 'https://lumiclaw.dev/schemas/m1/campaign-document.v1.json',
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'id', 'organizationId', 'dataMode', 'live', 'graph', 'brief', 'goalProfile', 'evidenceRefs', 'claims', 'activationPlan', 'capabilitySnapshots', 'artifactRevisions', 'missionContract'],
  properties: {
    schemaVersion: {const: 1}, id, organizationId: id, dataMode: {const: 'DEMO_SEED'}, live: {const: false},
    graph: {type: 'object'},
    brief: {type: 'object', additionalProperties: false, required: ['schemaVersion', 'name', 'objective', 'callToAction', 'contentLanguage', 'targetWindowStart', 'targetWindowEnd'], properties: {schemaVersion: {const: 1}, name: {type: 'string', minLength: 1, maxLength: 120}, objective: {type: 'string', minLength: 1, maxLength: 2000}, callToAction: {type: 'string', minLength: 1, maxLength: 500}, contentLanguage: {enum: ['en', 'zh-CN']}, targetWindowStart: dateTime, targetWindowEnd: dateTime}},
    goalProfile: {type: 'object', additionalProperties: false, required: ['schemaVersion', 'primaryGoal', 'supportingSignal', 'measurementNotes'], properties: {schemaVersion: {const: 1}, primaryGoal: {const: 'LAUNCH_MOMENTUM'}, supportingSignal: {const: 'MARKET_LEARNING'}, measurementNotes: {type: 'string', minLength: 1, maxLength: 1000}}},
    evidenceRefs: {type: 'array', minItems: 1, items: {type: 'object', required: ['id', 'organizationId', 'schemaVersion', 'label', 'sourceUrl', 'capturedAt', 'contentDigest', 'publicSafe'], properties: {id, organizationId: id, schemaVersion: {const: 1}, label: {type: 'string'}, sourceUrl: {type: 'string'}, capturedAt: dateTime, contentDigest: {type: 'string', pattern: '^[0-9a-f]{64}$'}, publicSafe: {const: true}}}},
    claims: {type: 'array', minItems: 1, items: {type: 'object', required: ['id', 'organizationId', 'schemaVersion', 'version', 'subjectType', 'subjectId', 'marketIds', 'statement', 'effectiveFrom', 'effectiveUntil', 'status', 'evidenceRefIds'], properties: {id, organizationId: id, schemaVersion: {const: 1}, version: {type: 'integer', minimum: 1}, subjectType: {const: 'PRODUCT'}, subjectId: id, marketIds: {type: 'array', minItems: 1, items: id}, statement: {type: 'string', minLength: 1}, effectiveFrom: dateTime, effectiveUntil: dateTime, status: {enum: ['DRAFT', 'APPROVED', 'STALE', 'REVOKED']}, evidenceRefIds: {type: 'array', items: id}}}},
    activationPlan: {type: 'object', required: ['schemaVersion', 'summary', 'units'], properties: {schemaVersion: {const: 1}, summary: {type: 'string', minLength: 1}, units: {type: 'array', minItems: 4, maxItems: 4, items: {type: 'object', required: ['id', 'organizationId', 'schemaVersion', 'identityId', 'productId', 'marketId', 'channelAccountId', 'accountMandateId', 'platform', 'plannedAction'], properties: {id, organizationId: id, schemaVersion: {const: 1}, identityId: id, productId: id, marketId: id, channelAccountId: id, accountMandateId: id, platform: {enum: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']}, plannedAction: {const: 'PREPARE'}}}}}},
    capabilitySnapshots: {type: 'array', minItems: 4, items: {type: 'object'}},
    artifactRevisions: {type: 'array', minItems: 4, items: {type: 'object'}},
    missionContract: {type: 'object', additionalProperties: false, required: ['schemaVersion', 'sourceDigest', 'executionMode', 'live', 'roleIds', 'artifactPlatforms', 'externalActionAllowed'], properties: {schemaVersion: {const: 1}, sourceDigest: {type: 'string', pattern: '^[0-9a-f]{64}$'}, executionMode: {const: 'SHADOW_PREP_ONLY'}, live: {const: false}, roleIds: {type: 'array', minItems: 6, maxItems: 6, uniqueItems: true, items: {type: 'string'}}, artifactPlatforms: {type: 'array', const: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']}, externalActionAllowed: {const: false}}}
  }
} as const;

const ajv = new Ajv({allErrors: true, strict: false, formats: {'date-time': true}});
const validate = ajv.compile<CampaignDocument>(campaignDocumentSchema);

export function validateCampaignShape(value: unknown): {valid: true; value: CampaignDocument} | {valid: false; issues: ValidationIssue[]} {
  if (validate(value)) return {valid: true, value: value as CampaignDocument};
  return {valid: false, issues: (validate.errors ?? []).map((error: ErrorObject) => ({code: 'SCHEMA_INVALID', path: error.instancePath || '/', message: error.message ?? 'Campaign schema validation failed.'}))};
}
