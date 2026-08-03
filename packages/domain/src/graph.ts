import {validateGraphShape} from './graph-schema.js';
import type {OrganizationGraph, ValidationIssue, ValidationResult} from './types.js';

export function validateOrganizationGraph(value: unknown, now = new Date()): ValidationResult {
  const shape = validateGraphShape(value);
  if (!shape.valid) return {ok: false, issues: shape.issues};

  const graph = shape.value;
  const issues: ValidationIssue[] = [];
  const organizationId = graph.organization.id;
  const collections = [graph.identities, graph.brands, graph.products, graph.markets, graph.channelAccounts, graph.accountMandates];
  const allIds = [organizationId, ...collections.flatMap((items) => items.map((item) => item.id))];
  if (new Set(allIds).size !== allIds.length) {
    issues.push(issue('GRAPH_DUPLICATE_ID', '/', 'Every graph object ID must be unique.'));
  }

  for (const [name, items] of [
    ['identities', graph.identities], ['brands', graph.brands], ['products', graph.products],
    ['markets', graph.markets], ['channelAccounts', graph.channelAccounts], ['accountMandates', graph.accountMandates]
  ] as const) {
    items.forEach((item, index) => {
      if (item.organizationId !== organizationId) {
        issues.push(issue('GRAPH_ORGANIZATION_SCOPE_MISMATCH', `/${name}/${index}/organizationId`, 'Object organization scope does not match the graph organization.'));
      }
    });
  }

  const identities = byId(graph.identities);
  const brands = byId(graph.brands);
  const products = byId(graph.products);
  const markets = byId(graph.markets);
  const accounts = byId(graph.channelAccounts);

  graph.products.forEach((product, index) => {
    if (!brands.has(product.brandId)) issues.push(issue('GRAPH_BRAND_NOT_FOUND', `/products/${index}/brandId`, 'Product brand is not present in this graph.'));
  });
  graph.channelAccounts.forEach((account, index) => {
    if (!identities.has(account.identityId)) issues.push(issue('GRAPH_IDENTITY_NOT_FOUND', `/channelAccounts/${index}/identityId`, 'Channel account identity is not present in this graph.'));
  });
  graph.accountMandates.forEach((mandate, index) => {
    const path = `/accountMandates/${index}`;
    const account = accounts.get(mandate.channelAccountId);
    if (account === undefined) issues.push(issue('GRAPH_ACCOUNT_NOT_FOUND', `${path}/channelAccountId`, 'Mandate account is not present in this graph.'));
    if (!identities.has(mandate.identityId)) issues.push(issue('GRAPH_IDENTITY_NOT_FOUND', `${path}/identityId`, 'Mandate identity is not present in this graph.'));
    if (!products.has(mandate.productId)) issues.push(issue('GRAPH_PRODUCT_NOT_FOUND', `${path}/productId`, 'Mandate product is not present in this graph.'));
    if (!markets.has(mandate.marketId)) issues.push(issue('GRAPH_MARKET_NOT_FOUND', `${path}/marketId`, 'Mandate market is not present in this graph.'));
    if (account !== undefined && account.identityId !== mandate.identityId) {
      issues.push(issue('GRAPH_MANDATE_TUPLE_MISMATCH', path, 'Mandate identity does not match the channel account identity.'));
    }
    const validFrom = Date.parse(mandate.validFrom);
    const validUntil = Date.parse(mandate.validUntil);
    if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil) || validFrom > now.getTime() || validUntil <= now.getTime() || validUntil <= validFrom) {
      issues.push(issue('GRAPH_MANDATE_EXPIRED', path, 'Mandate validity window does not include the validation time.'));
    }
  });

  return issues.length === 0 ? {ok: true} : {ok: false, issues};
}

function byId<T extends {id: string}>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function issue(code: ValidationIssue['code'], path: string, message: string): ValidationIssue {
  return {code, path, message};
}

export function assertOrganizationGraph(value: unknown, now?: Date): asserts value is OrganizationGraph {
  const result = validateOrganizationGraph(value, now);
  if (!result.ok) throw new Error(JSON.stringify({code: 'ORGANIZATION_GRAPH_INVALID', issues: result.issues}));
}
