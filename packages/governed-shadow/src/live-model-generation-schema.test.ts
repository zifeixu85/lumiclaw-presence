import {Ajv, type ValidateFunction} from 'ajv';
import {describe, expect, it} from 'vitest';
import {hasFrozenFounderFault, liveModelGenerationSchema, ShadowContractError} from './mission.js';
import type {TaskContract} from './types.js';

const x = {kind: 'X', posts: ['LumiClaw Presence is generally available in every market today.'], altText: 'Founder update card'};
const sourceX = {kind: 'X', posts: ['Founder update.'], altText: 'Founder update card'};
const xiaohongshu = {kind: 'XIAOHONGSHU', title: '创始人动态', body: '公开安全的本地演练草稿。', topics: ['品牌运营'], coverLabel: '合成封面'};
const bluesky = {kind: 'BLUESKY', posts: ['Product update.'], embedUrl: 'https://example.invalid/product', altText: 'Product update card'};
const linkedin = {kind: 'LINKEDIN', commentary: 'Product account update.', authorKind: 'COMPANY', linkTitle: 'Product update', linkUrl: 'https://example.invalid/product'};
const issue = {code: 'CLAIM_OVERREACH', severity: 'BLOCKING', path: '/content/posts/0', message: 'Unsupported availability claim.', evidenceRefIds: ['evidence-public-safe'], nextResponsibleRoleId: 'founder-identity-producer'};

function task(kind: TaskContract['kind']): TaskContract { return {kind} as TaskContract; }
function validator(kind: TaskContract['kind'], input: Record<string, unknown> = {}): ValidateFunction {
  const exactInput = kind === 'AUDIT_REVISIONS' && Object.keys(input).length === 0 ? {projection: {evidenceRefIds: ['evidence-public-safe']}} : input;
  return new Ajv({allErrors: true, strict: false}).compile(liveModelGenerationSchema(task(kind), exactInput));
}
function revision(platform: string, content: unknown) { return {platform, content}; }
function decision(platform: string, outcome = 'PASS', issues: unknown[] = []) { return {platform, outcome, issues}; }
function expectAccepted(validate: ValidateFunction, values: unknown[]) { for (const value of values) expect(validate(value), JSON.stringify(validate.errors)).toBe(true); }
function expectRejected(validate: ValidateFunction, values: unknown[]) { for (const value of values) expect(validate(value), JSON.stringify(value)).toBe(false); }

describe('Live task-specific generation schemas', () => {
  it('accepts exactly one unordered X/Xiaohongshu founder set and rejects every wider semantic shape', () => {
    const validate = validator('PRODUCE_FOUNDER');
    const xRevision = revision('X', x); const xhsRevision = revision('XIAOHONGSHU', xiaohongshu);
    const caseVariant = revision('X', {...x, posts: ['LumiClaw Presence is GENERALLY AVAILABLE for this frozen fault.']});
    expectAccepted(validate, [{revisions: [xRevision, xhsRevision]}, {revisions: [xhsRevision, xRevision]}, {revisions: [caseVariant, xhsRevision]}]);
    expectRejected(validate, [
      {revisions: [xRevision, revision('X', {...x, altText: 'Different X item'})]},
      {revisions: [xRevision, revision('BLUESKY', bluesky)]},
      {revisions: [revision('X', xiaohongshu), xhsRevision]},
      {revisions: [xRevision]},
      {revisions: [xRevision, xhsRevision, revision('X', x)]},
      {revisions: [xRevision, xhsRevision], extra: true},
      {revisions: [{...xRevision, revision: 1}, xhsRevision]},
      {revisions: [revision('X', {...x, extra: true}), xhsRevision]},
      {revisions: [revision('X', {...x, posts: ['Founder update without the frozen phrase.']}), xhsRevision]},
      {revisions: [revision('X', {...x, posts: ['LumiClaw Presence is broadly available.']}), xhsRevision]},
      {revisions: [revision('X', {...x, posts: ['LumiClaw Presence is available generally.']}), xhsRevision]},
      {revisions: [revision('X', {...x, posts: ['LumiClaw Presence is generally-available.']}), xhsRevision]},
      {revisions: [revision('X', {...x, posts: ['generally', 'available']}), xhsRevision]},
      {revisions: [revision('X', {...x, posts: ['Founder update.'], altText: 'generally available'}), xhsRevision]},
      {revisions: [revision('X', {...x, posts: ['LumiClaw is generаlly available.']}), xhsRevision]},
      {revisions: [revision('X', sourceX), revision('XIAOHONGSHU', {...xiaohongshu, body: 'generally available'} )]}
    ]);
  });

  it('keeps the shared frozen-fault predicate equivalent to the Founder X phrase schema cases', () => {
    expect(hasFrozenFounderFault(x)).toBe(true);
    expect(hasFrozenFounderFault({...x, posts: ['Generally Available.']})).toBe(true);
    for (const content of [
      sourceX,
      {...x, posts: ['broadly available']},
      {...x, posts: ['available generally']},
      {...x, posts: ['generally-available']},
      {...x, posts: ['generally', 'available']},
      {...x, posts: ['generаlly available']},
      {...x, posts: ['Founder update.'], altText: 'generally available'}
    ]) expect(hasFrozenFounderFault(content)).toBe(false);
  });

  it('accepts exactly one unordered Bluesky/LinkedIn product set and rejects duplicates, mismatches and unknown fields', () => {
    const validate = validator('PRODUCE_PRODUCT');
    const blueskyRevision = revision('BLUESKY', bluesky); const linkedinRevision = revision('LINKEDIN', linkedin);
    expectAccepted(validate, [{revisions: [blueskyRevision, linkedinRevision]}, {revisions: [linkedinRevision, blueskyRevision]}]);
    expectRejected(validate, [
      {revisions: [blueskyRevision, revision('BLUESKY', {...bluesky, altText: 'Different Bluesky item'})]},
      {revisions: [blueskyRevision, revision('X', x)]},
      {revisions: [revision('BLUESKY', linkedin), linkedinRevision]},
      {revisions: [blueskyRevision]},
      {revisions: [blueskyRevision, linkedinRevision, revision('LINKEDIN', linkedin)]},
      {revisions: [blueskyRevision, linkedinRevision], failedAuditDigest: 'a'.repeat(64)},
      {revisions: [blueskyRevision, {...linkedinRevision, contentDigest: 'a'.repeat(64)}]},
      {revisions: [blueskyRevision, revision('LINKEDIN', {...linkedin, extra: true})]}
    ]);
  });

  it('binds the one-item X correction to the exact server projection content', () => {
    const input = {projection: {sourceRevisions: [{platform: 'X', content: sourceX}]}};
    const validate = validator('PRODUCE_FOUNDER_CORRECTION', input); const exact = revision('X', sourceX);
    expectAccepted(validate, [{revisions: [exact]}]);
    expectRejected(validate, [
      {revisions: [revision('X', {...sourceX, posts: ['Changed by model.']})]},
      {revisions: [revision('XIAOHONGSHU', xiaohongshu)]},
      {revisions: []},
      {revisions: [exact, exact]},
      {revisions: [exact], failedAuditDigest: 'a'.repeat(64)},
      {revisions: [{...exact, revision: 2}]},
      {revisions: [revision('X', {...sourceX, extra: true})]}
    ]);
    expect(() => liveModelGenerationSchema(task('PRODUCE_FOUNDER_CORRECTION'), {projection: {sourceRevisions: []}})).toThrowError(ShadowContractError);
  });

  it('accepts one closed initial audit decision per platform in any order and rejects invalid issue shapes', () => {
    const validate = validator('AUDIT_REVISIONS');
    const values = [decision('X', 'FAIL', [issue]), decision('BLUESKY'), decision('LINKEDIN'), decision('XIAOHONGSHU')];
    expectAccepted(validate, [{decisions: values}, {decisions: [...values].reverse()}]);
    expectRejected(validate, [
      {decisions: [values[0], decision('X', 'ESCALATE', [issue]), values[2], values[3]]},
      {decisions: [decision('X'), values[1], values[2], values[3]]},
      {decisions: [decision('X', 'FAIL'), values[1], values[2], values[3]]},
      {decisions: [values[0], decision('BLUESKY', 'FAIL', [issue]), values[2], values[3]]},
      {decisions: [values[0], values[1], values[2], decision('MASTODON')]},
      {decisions: values.slice(0, 3)},
      {decisions: [...values, decision('X')]},
      {decisions: values, extra: true},
      {decisions: [{...values[0], revision: 1}, ...values.slice(1)]},
      {decisions: [decision('X', 'FAIL', [{...issue, message: undefined}]), ...values.slice(1)]},
      {decisions: [decision('X', 'FAIL', [{...issue, extra: true}]), ...values.slice(1)]}
    ]);
  });

  it('accepts exactly one closed X re-audit decision and rejects relabeling or server-derived fields', () => {
    const validate = validator('REAUDIT_CORRECTION'); const accepted = decision('X');
    expectAccepted(validate, [{decisions: [accepted]}]);
    expectRejected(validate, [
      {decisions: [decision('BLUESKY')]},
      {decisions: [decision('X', 'ESCALATE', [issue])]},
      {decisions: [decision('X', 'FAIL', [issue])]},
      {decisions: []},
      {decisions: [accepted, accepted]},
      {decisions: [accepted], failedAuditDigest: 'a'.repeat(64)},
      {decisions: [{...accepted, revisionContentDigest: 'a'.repeat(64)}]},
      {decisions: [decision('X', 'FAIL', [{...issue, nextResponsibleRoleId: 'owner'}])]},
      {decisions: [decision('X', 'FAIL', [{...issue, extra: true}])]}
    ]);
  });
});
