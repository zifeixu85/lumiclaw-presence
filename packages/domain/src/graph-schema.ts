import {Ajv, type ErrorObject} from 'ajv';
import type {OrganizationGraph, ValidationIssue} from './types.js';

const id = {type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'} as const;
const version = {const: 1} as const;
const scopedBase = {
  id,
  organizationId: id,
  schemaVersion: version
} as const;

export const organizationGraphSchema = {
  $id: 'https://lumiclaw.dev/schemas/m1/organization-graph.v1.json',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'organization', 'identities', 'brands', 'products', 'markets', 'channelAccounts', 'accountMandates'],
  properties: {
    schemaVersion: version,
    organization: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'schemaVersion', 'slug', 'displayName', 'dataMode', 'live'],
      properties: {
        id,
        schemaVersion: version,
        slug: {type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', minLength: 2, maxLength: 64},
        displayName: {type: 'string', minLength: 1, maxLength: 120},
        dataMode: {const: 'DEMO_SEED'},
        live: {const: false}
      }
    },
    identities: {
      type: 'array', minItems: 1,
      items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'kind', 'displayName', 'publicBio'], properties: {...scopedBase, kind: {enum: ['PERSON', 'PRODUCT']}, displayName: {type: 'string', minLength: 1, maxLength: 120}, publicBio: {type: 'string', minLength: 1, maxLength: 1000}}}
    },
    brands: {
      type: 'array', minItems: 1,
      items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'name', 'positioning'], properties: {...scopedBase, name: {type: 'string', minLength: 1, maxLength: 120}, positioning: {type: 'string', minLength: 1, maxLength: 1000}}}
    },
    products: {
      type: 'array', minItems: 1,
      items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'brandId', 'name', 'description'], properties: {...scopedBase, brandId: id, name: {type: 'string', minLength: 1, maxLength: 120}, description: {type: 'string', minLength: 1, maxLength: 2000}}}
    },
    markets: {
      type: 'array', minItems: 1,
      items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'code', 'displayName', 'primaryLanguage'], properties: {...scopedBase, code: {type: 'string', pattern: '^[A-Z0-9-]{2,16}$'}, displayName: {type: 'string', minLength: 1, maxLength: 120}, primaryLanguage: {type: 'string', pattern: '^[a-z]{2,3}(?:-[A-Z]{2})?$'}}}
    },
    channelAccounts: {
      type: 'array', minItems: 4,
      items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'identityId', 'platform', 'displayHandle', 'connectionState'], properties: {...scopedBase, identityId: id, platform: {enum: ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']}, displayHandle: {type: 'string', minLength: 1, maxLength: 120}, connectionState: {const: 'NOT_CONNECTED'}}}
    },
    accountMandates: {
      type: 'array', minItems: 4,
      items: {type: 'object', additionalProperties: false, required: ['id', 'organizationId', 'schemaVersion', 'channelAccountId', 'identityId', 'productId', 'marketId', 'role', 'allowedActions', 'requiresOwnerReview', 'validFrom', 'validUntil'], properties: {...scopedBase, channelAccountId: id, identityId: id, productId: id, marketId: id, role: {enum: ['FOUNDER_VOICE', 'PRODUCT_VOICE']}, allowedActions: {type: 'array', const: ['PREPARE']}, requiresOwnerReview: {const: true}, validFrom: {type: 'string', format: 'date-time'}, validUntil: {type: 'string', format: 'date-time'}}}
    }
  }
} as const;

const ajv = new Ajv({allErrors: true, strict: true, formats: {'date-time': true}});
const validate = ajv.compile<OrganizationGraph>(organizationGraphSchema);

export function validateGraphShape(value: unknown): {valid: true; value: OrganizationGraph} | {valid: false; issues: ValidationIssue[]} {
  if (validate(value)) return {valid: true, value: value as OrganizationGraph};
  return {
    valid: false,
    issues: (validate.errors ?? []).map((error: ErrorObject) => ({
      code: 'SCHEMA_INVALID',
      path: error.instancePath || '/',
      message: error.message ?? 'Schema validation failed.'
    }))
  };
}
