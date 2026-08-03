import {describe, expect, it} from 'vitest';
import {createDemoOrganizationGraph} from './graph-fixture.js';
import {validateOrganizationGraph} from './graph.js';
import {createUuidV7, isUuidV7} from './id.js';

const now = new Date('2026-08-03T00:00:00.000Z');

describe('organization graph v1', () => {
  it('accepts the four-account demo graph', () => {
    const graph = createDemoOrganizationGraph();
    expect(validateOrganizationGraph(graph, now)).toEqual({ok: true});
    expect(new Set(graph.channelAccounts.map((account) => account.platform))).toEqual(new Set(['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU']));
  });

  it('rejects a cross-organization object', () => {
    const graph = createDemoOrganizationGraph();
    graph.products[0]!.organizationId = graph.identities[0]!.id;
    const result = validateOrganizationGraph(graph, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain('GRAPH_ORGANIZATION_SCOPE_MISMATCH');
  });

  it('rejects an account mandate whose identity differs from the account', () => {
    const graph = createDemoOrganizationGraph();
    graph.accountMandates[0]!.identityId = graph.identities[1]!.id;
    const result = validateOrganizationGraph(graph, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain('GRAPH_MANDATE_TUPLE_MISMATCH');
  });

  it('rejects an expired mandate and a missing product edge', () => {
    const graph = createDemoOrganizationGraph();
    graph.accountMandates[0]!.validUntil = '2026-01-01T00:00:00.000Z';
    graph.accountMandates[1]!.productId = graph.identities[0]!.id;
    const result = validateOrganizationGraph(graph, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((issue) => issue.code);
      expect(codes).toContain('GRAPH_MANDATE_EXPIRED');
      expect(codes).toContain('GRAPH_PRODUCT_NOT_FOUND');
    }
  });

  it('rejects malformed mandate timestamps at the schema boundary', () => {
    const graph = createDemoOrganizationGraph();
    graph.accountMandates[0]!.validFrom = 'not-a-date';
    const result = validateOrganizationGraph(graph, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((item) => item.code)).toContain('SCHEMA_INVALID');
  });

  it('creates RFC 9562 version/variant-shaped UUIDv7 values deterministically with injected entropy', () => {
    const value = createUuidV7(1_788_000_000_000, Buffer.from('00112233445566778899', 'hex'));
    expect(value).toBe('01a04d1a-d800-7011-a233-445566778899');
    expect(isUuidV7(value)).toBe(true);
  });
});
