import {Ajv, type ErrorObject} from 'ajv';
import type {CampaignDocument} from './campaign-types.js';
import {organizationGraphSchema} from './graph-schema.js';
import type {ValidationIssue} from './types.js';

const id = {type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'} as const;
const dateTime = {type: 'string', format: 'date-time'} as const;
const platform = {enum: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']} as const;
const stringArray = {type: 'array', items: {type: 'string'}} as const;
const fieldConstraint = {type: 'object', additionalProperties: false, required: ['required'], properties: {required: {type: 'boolean'}, maxLength: {type: 'integer', minimum: 1}, maxItems: {type: 'integer', minimum: 1}}} as const;
const capabilitySnapshot = {
  type: 'object', additionalProperties: false,
  required: ['id', 'organizationId', 'schemaVersion', 'channelAccountId', 'platform', 'capturedAt', 'expiresAt', 'source', 'executionMode', 'constraints', 'disclaimer'],
  properties: {id, organizationId: id, schemaVersion: {const: 1}, channelAccountId: id, platform, capturedAt: dateTime, expiresAt: dateTime, source: {const: 'M1_PUBLIC_SAFE_FIXTURE'}, executionMode: {enum: ['PREPARE_ONLY', 'DIRECT_PLANNED_NOT_CONNECTED', 'NATIVE_HANDOFF_PLANNED']}, constraints: {type: 'object', minProperties: 1, additionalProperties: fieldConstraint}, disclaimer: {type: 'string', minLength: 1}}
} as const;
const xArtifact = {type: 'object', additionalProperties: false, required: ['kind', 'posts', 'altText'], properties: {kind: {const: 'X'}, posts: stringArray, altText: {type: 'string'}}} as const;
const blueskyArtifact = {type: 'object', additionalProperties: false, required: ['kind', 'posts', 'embedUrl', 'altText'], properties: {kind: {const: 'BLUESKY'}, posts: stringArray, embedUrl: {type: 'string'}, altText: {type: 'string'}}} as const;
const linkedinArtifact = {type: 'object', additionalProperties: false, required: ['kind', 'commentary', 'authorKind', 'linkTitle', 'linkUrl'], properties: {kind: {const: 'LINKEDIN'}, commentary: {type: 'string'}, authorKind: {enum: ['PERSON', 'COMPANY']}, linkTitle: {type: 'string'}, linkUrl: {type: 'string'}}} as const;
const xiaohongshuArtifact = {type: 'object', additionalProperties: false, required: ['kind', 'title', 'body', 'topics', 'coverLabel'], properties: {kind: {const: 'XIAOHONGSHU'}, title: {type: 'string'}, body: {type: 'string'}, topics: stringArray, coverLabel: {type: 'string'}}} as const;
const missionRoleIds = ['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'] as const;
const artifactRequired = ['id', 'organizationId', 'campaignId', 'activationUnitId', 'schemaVersion', 'revision', 'platform', 'capabilitySnapshotId', 'claimIds', 'content', 'createdAt'] as const;
const artifactBase = {id, organizationId: id, campaignId: id, activationUnitId: id, schemaVersion: {const: 1}, revision: {type: 'integer', minimum: 1}, capabilitySnapshotId: id, claimIds: {type: 'array', minItems: 1, uniqueItems: true, items: id}, createdAt: dateTime} as const;
const artifactRevision = {
  oneOf: [
    {type: 'object', additionalProperties: false, required: artifactRequired, properties: {...artifactBase, platform: {const: 'X'}, content: xArtifact}},
    {type: 'object', additionalProperties: false, required: artifactRequired, properties: {...artifactBase, platform: {const: 'BLUESKY'}, content: blueskyArtifact}},
    {type: 'object', additionalProperties: false, required: artifactRequired, properties: {...artifactBase, platform: {const: 'LINKEDIN'}, content: linkedinArtifact}},
    {type: 'object', additionalProperties: false, required: artifactRequired, properties: {...artifactBase, platform: {const: 'XIAOHONGSHU'}, content: xiaohongshuArtifact}}
  ]
} as const;

export const campaignDocumentSchema = {
  $id: 'https://lumiclaw.dev/schemas/m1/campaign-document.v1.json',
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'id', 'organizationId', 'dataMode', 'live', 'graph', 'brief', 'goalProfile', 'evidenceRefs', 'claims', 'activationPlan', 'capabilitySnapshots', 'artifactRevisions', 'publishingSchedules', 'scheduleOccurrences', 'missionContract'],
  properties: {
    schemaVersion: {const: 1}, id, organizationId: id, dataMode: {const: 'DEMO_SEED'}, live: {const: false},
    graph: organizationGraphSchema,
    brief: {type: 'object', additionalProperties: false, required: ['schemaVersion', 'name', 'objective', 'callToAction', 'contentLanguage', 'targetWindowStart', 'targetWindowEnd'], properties: {schemaVersion: {const: 1}, name: {type: 'string', minLength: 1, maxLength: 120}, objective: {type: 'string', minLength: 1, maxLength: 2000}, callToAction: {type: 'string', minLength: 1, maxLength: 500}, contentLanguage: {enum: ['en', 'zh-CN']}, targetWindowStart: dateTime, targetWindowEnd: dateTime}},
    goalProfile: {type: 'object', additionalProperties: false, required: ['schemaVersion', 'primaryGoal', 'supportingSignal', 'measurementNotes'], properties: {schemaVersion: {const: 1}, primaryGoal: {const: 'LAUNCH_MOMENTUM'}, supportingSignal: {const: 'MARKET_LEARNING'}, measurementNotes: {type: 'string', minLength: 1, maxLength: 1000}}},
    evidenceRefs: {type: 'array', minItems: 1, items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'label', 'sourceUrl', 'capturedAt', 'contentDigest', 'publicSafe'], properties: {id, organizationId: id, schemaVersion: {const: 1}, label: {type: 'string'}, sourceUrl: {type: 'string'}, capturedAt: dateTime, contentDigest: {type: 'string', pattern: '^[0-9a-f]{64}$'}, publicSafe: {const: true}}}},
    claims: {type: 'array', minItems: 1, items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'version', 'subjectType', 'subjectId', 'marketIds', 'statement', 'effectiveFrom', 'effectiveUntil', 'status', 'evidenceRefIds'], properties: {id, organizationId: id, schemaVersion: {const: 1}, version: {type: 'integer', minimum: 1}, subjectType: {const: 'PRODUCT'}, subjectId: id, marketIds: {type: 'array', minItems: 1, uniqueItems: true, items: id}, statement: {type: 'string', minLength: 1}, effectiveFrom: dateTime, effectiveUntil: dateTime, status: {enum: ['DRAFT', 'APPROVED', 'STALE', 'REVOKED']}, evidenceRefIds: {type: 'array', uniqueItems: true, items: id}}}},
    activationPlan: {type: 'object', additionalProperties: false, required: ['schemaVersion', 'summary', 'units'], properties: {schemaVersion: {const: 1}, summary: {type: 'string', minLength: 1}, units: {type: 'array', minItems: 4, maxItems: 4, items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'identityId', 'productId', 'marketId', 'channelAccountId', 'accountMandateId', 'platform', 'plannedAction'], properties: {id, organizationId: id, schemaVersion: {const: 1}, identityId: id, productId: id, marketId: id, channelAccountId: id, accountMandateId: id, platform: {enum: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']}, plannedAction: {const: 'PREPARE'}}}}}},
    capabilitySnapshots: {type: 'array', minItems: 4, maxItems: 4, items: capabilitySnapshot},
    artifactRevisions: {type: 'array', minItems: 4, maxItems: 4, items: artifactRevision},
    publishingSchedules: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'campaignId', 'schemaVersion', 'version', 'kind', 'localStart', 'timeZone', 'rrule', 'foldPreference', 'misfirePolicy', 'sourceArtifactRevisionIds', 'status', 'invalidationReason', 'createdAt', 'updatedAt'], properties: {id, organizationId: id, campaignId: id, schemaVersion: {const: 1}, version: {type: 'integer', minimum: 1}, kind: {enum: ['ONCE', 'RRULE']}, localStart: {type: 'string'}, timeZone: {type: 'string'}, rrule: {type: ['string', 'null']}, foldPreference: {enum: ['EARLIER', 'LATER']}, misfirePolicy: {enum: ['SKIP', 'HOLD_FOR_OWNER']}, sourceArtifactRevisionIds: {type: 'array', minItems: 1, uniqueItems: true, items: id}, status: {enum: ['ACTIVE', 'INVALIDATED']}, invalidationReason: {enum: ['CONTENT_OR_ACCOUNT_EDIT', 'SCHEDULE_EDIT', null]}, createdAt: dateTime, updatedAt: dateTime}}},
    scheduleOccurrences: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'campaignId', 'scheduleId', 'scheduleVersion', 'schemaVersion', 'ordinal', 'localWallTime', 'scheduledForUtc', 'utcOffsetMinutes', 'state', 'misfireReason'], properties: {id, organizationId: id, campaignId: id, scheduleId: id, scheduleVersion: {type: 'integer', minimum: 1}, schemaVersion: {const: 1}, ordinal: {type: 'integer', minimum: 1}, localWallTime: {type: 'string'}, scheduledForUtc: dateTime, utcOffsetMinutes: {type: 'integer', minimum: -960, maximum: 960}, state: {enum: ['PENDING', 'MISSED', 'NEEDS_OWNER', 'INVALIDATED']}, misfireReason: {enum: ['PAST_DUE', null]}}}},
    missionContract: {type: 'object', additionalProperties: false, required: ['schemaVersion', 'sourceDigest', 'executionMode', 'live', 'roleIds', 'artifactPlatforms', 'externalActionAllowed'], properties: {schemaVersion: {const: 1}, sourceDigest: {type: 'string', pattern: '^[0-9a-f]{64}$'}, executionMode: {const: 'SHADOW_PREP_ONLY'}, live: {const: false}, roleIds: {type: 'array', const: missionRoleIds}, artifactPlatforms: {type: 'array', const: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']}, externalActionAllowed: {const: false}}}
  }
} as const;

const rfc3339DateTime = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
const ajv = new Ajv({allErrors: true, strict: false, formats: {'date-time': (value: string) => rfc3339DateTime.test(value) && Number.isFinite(Date.parse(value))}});
const validate = ajv.compile<CampaignDocument>(campaignDocumentSchema);

export function validateCampaignShape(value: unknown): {valid: true; value: CampaignDocument} | {valid: false; issues: ValidationIssue[]} {
  if (validate(value)) return {valid: true, value: value as CampaignDocument};
  return {valid: false, issues: (validate.errors ?? []).map((error: ErrorObject) => ({code: 'SCHEMA_INVALID', path: error.instancePath || '/', message: error.message ?? 'Campaign schema validation failed.'}))};
}
