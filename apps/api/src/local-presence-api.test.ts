import {afterEach, describe, expect, it} from 'vitest';
import {buildApi} from './server.js';

const apps: ReturnType<typeof buildApi>[] = [];
const now = () => new Date('2026-08-16T08:00:00.000Z');
const localIdentity = {organizationName: '星河工作室', brandName: '星河', brandPositioning: '帮助独立团队清楚表达跨市场产品价值。', productName: '星河翻译助手', productDescription: '一个由本机资料确认的多语言产品说明助手。', campaignName: '星河产品首发', campaignObjective: '让目标市场理解产品定位并邀请结构化反馈。', callToAction: '阅读完整说明并分享反馈。'};
afterEach(async () => Promise.all(apps.splice(0).map(async (app) => app.close())));

function makeApp() { const app = buildApi({now}); apps.push(app); return app; }

describe('SDD-006 local onboarding API', () => {
  it('starts with display-name-only local identity and rejects browser secret-shaped fields', async () => {
    const app = makeApp();
    expect((await app.inject({method: 'GET', url: '/api/v1/local-workspace'})).json()).toMatchObject({code: 'LOCAL_FIRST_OPEN', profile: null});
    const forbidden = await app.inject({method: 'POST', url: '/api/v1/local-owner-profile', payload: {displayName: 'Owner', apiKey: 'forbidden'}});
    expect(forbidden.statusCode).toBe(422); expect(forbidden.json().code).toBe('BROWSER_SECRET_FIELD_FORBIDDEN');
    const created = await app.inject({method: 'POST', url: '/api/v1/local-owner-profile', payload: {displayName: '  A梦 Owner  '}});
    expect(created.statusCode).toBe(201); expect(created.json()).toMatchObject({requiresEmail: false, requiresPassword: false, remoteRegistration: false, profile: {displayName: 'A梦 Owner', state: 'PROFILE_READY'}});
    const reopened = await app.inject({method: 'GET', url: '/api/v1/local-workspace'});
    expect(reopened.json()).toMatchObject({code: 'LOCAL_WORKSPACE_REOPENED', profile: {displayName: 'A梦 Owner'}, session: {state: 'MATERIAL_CHOICE'}});
  });

  it('persists real MD/TXT extraction through the onboarding source and fails closed for PDF and invalid bytes', async () => {
    const app = makeApp();
    await app.inject({method: 'POST', url: '/api/v1/local-owner-profile', payload: {displayName: 'Owner'}});
    await app.inject({method: 'POST', url: '/api/v1/local-onboarding/materials-path'});
    const uploaded = await app.inject({method: 'POST', url: '/api/v1/local-materials', headers: {'content-type': 'text/markdown', 'x-lumiclaw-file-name': encodeURIComponent('产品资料.md')}, payload: Buffer.from('# Product\nEvidence-bound local material')});
    expect(uploaded.statusCode).toBe(201); expect(uploaded.json()).toMatchObject({code: 'LOCAL_MATERIAL_READY', material: {fileName: '产品资料.md', state: 'READY', extractedText: '# Product\nEvidence-bound local material'}});
    const pdf = await app.inject({method: 'POST', url: '/api/v1/local-materials', headers: {'content-type': 'application/pdf', 'x-lumiclaw-file-name': 'brief.pdf'}, payload: Buffer.from('%PDF')});
    expect(pdf.statusCode).toBe(415); expect(pdf.json().code).toBe('LOCAL_MATERIAL_TYPE_PLANNED');
    const binary = await app.inject({method: 'POST', url: '/api/v1/local-materials', headers: {'content-type': 'text/plain', 'x-lumiclaw-file-name': 'brief.txt'}, payload: Buffer.from([0xff])});
    expect(binary.statusCode).toBe(422); expect(binary.json().code).toBe('LOCAL_MATERIAL_UTF8_REQUIRED');
    const early = await app.inject({method: 'POST', url: '/api/v1/local-onboarding/complete', payload: localIdentity});
    expect(early.statusCode).toBe(422); expect(early.json().code).toBe('LOCAL_ONBOARDING_NOT_READY');
    const context = await app.inject({method: 'POST', url: '/api/v1/local-onboarding/context', payload: {marketCode: 'CN', contentLocale: 'zh-CN', platform: 'XIAOHONGSHU', timeZone: 'Asia/Shanghai'}});
    expect(context.statusCode).toBe(200); expect(context.json().session).toMatchObject({marketCode: 'CN', contentLocale: 'zh-CN', platform: 'XIAOHONGSHU', timeZone: 'Asia/Shanghai'});
    const completed = await app.inject({method: 'POST', url: '/api/v1/local-onboarding/complete', payload: localIdentity});
    expect(completed.statusCode).toBe(200); expect(completed.json()).toMatchObject({source: 'LOCAL_PRIVATE_USER_CONFIRMED', dataMode: 'LOCAL_PRIVATE', session: {state: 'COMPLETED', dataMode: 'LOCAL_PRIVATE'}, campaign: {document: {dataMode: 'LOCAL_PRIVATE', graph: {organization: {displayName: '星河工作室', dataMode: 'LOCAL_PRIVATE'}, brands: [{name: '星河'}], products: [{name: '星河翻译助手'}]}, brief: {name: '星河产品首发'}}}});
    const reopen = (await app.inject({method: 'GET', url: '/api/v1/local-workspace'})).json();
    expect(reopen).toMatchObject({profile: {state: 'ONBOARDING_COMPLETE'}, session: {dataMode: 'LOCAL_PRIVATE'}, materials: [{digest: expect.stringMatching(/^[a-f0-9]{64}$/u)}], campaign: {mode: 'LOCAL_PRIVATE', document: {dataMode: 'LOCAL_PRIVATE', graph: {organization: {displayName: '星河工作室'}, products: [{name: '星河翻译助手'}]}, brief: {name: '星河产品首发'}}}});
    expect(JSON.stringify(reopen.campaign)).not.toContain('LumiClaw Presence local launch');
    const authorityHeaders = {'x-lumiclaw-organization-id': reopen.campaign.document.organizationId};
    const listed = await app.inject({method: 'GET', url: '/api/v1/campaigns', headers: authorityHeaders});
    expect(listed.json()).toMatchObject({mode: 'LOCAL_PRIVATE', campaigns: [{mode: 'LOCAL_PRIVATE', name: '星河产品首发'}]});
    const runtime = await app.inject({method: 'POST', url: `/api/v1/campaigns/${reopen.campaign.document.id}/shadow-missions`, headers: {...authorityHeaders, 'idempotency-key': 'local-runtime-forbidden', 'if-match': reopen.campaign.etag}, payload: {sourceDigest: reopen.campaign.digest, fault: 'BETA_TO_GA'}});
    expect(runtime.statusCode).toBe(403); expect(runtime.json()).toMatchObject({code: 'LOCAL_PRIVATE_RUNTIME_REQUIRES_SDD_007', mode: 'LOCAL_PRIVATE', live: false});
  });

  it('labels example/team metrics, exposes repository Skills, and keeps manual completion awaiting reconciliation', async () => {
    const app = makeApp();
    await app.inject({method: 'POST', url: '/api/v1/local-owner-profile', payload: {displayName: 'Owner'}});
    const example = await app.inject({method: 'POST', url: '/api/v1/local-onboarding/example'});
    expect(example.statusCode).toBe(201); expect(example.json()).toMatchObject({source: 'PUBLIC_SAFE_EXAMPLE', externalActionAllowed: false, session: {state: 'COMPLETED'}});
    const document = example.json().campaign.document;
    const revision = document.artifactRevisions[0];
    const handoff = await app.inject({method: 'POST', url: '/api/v1/manual-publish-handoffs', payload: {organizationId: document.organizationId, campaignId: document.id, artifactRevisionId: revision.id, platform: revision.platform, action: 'OWNER_REPORTED_COMPLETE'}});
    expect(handoff.statusCode).toBe(201); expect(handoff.json()).toMatchObject({code: 'MANUAL_HANDOFF_AWAITING_RECONCILIATION', createsPublishedState: false, readBackEvidencePresent: false, handoff: {state: 'AWAITING_RECONCILIATION', evidenceReceiptId: null}});
    expect(JSON.stringify(handoff.json())).not.toContain('PUBLISHED');
    const team = (await app.inject({method: 'GET', url: '/api/v1/ai-team'})).json();
    expect(team).toMatchObject({metricSource: 'NO_RUNTIME_OBSERVATION'}); expect(team.agents).toHaveLength(6); expect(team.agents.every((agent: {metrics: {tokens: number; dailyCompleted: number; source: string}}) => agent.metrics.tokens === 0 && agent.metrics.dailyCompleted === 0 && agent.metrics.source === 'NO_RUNTIME_OBSERVATION')).toBe(true);
    const skill = await app.inject({method: 'GET', url: '/api/v1/skills/independent-action-audit'});
    expect(skill.statusCode).toBe(200); expect(skill.json()).toMatchObject({source: 'REPOSITORY_OWNED', skill: {license: 'Apache-2.0', files: ['SKILL.md']}}); expect(skill.json().skill.content).toContain('# Independent action audit');
  });

  it('reports readiness from deterministic probes without inventing runtime green', async () => {
    const readiness = (await makeApp().inject({method: 'GET', url: '/api/v1/environment-readiness'})).json();
    expect(readiness.secretCollectionAllowed).toBe(false);
    expect(readiness.items).toContainEqual(expect.objectContaining({service: 'POSTGRESQL', state: 'AVAILABLE', source: 'POSTGRESQL_PROBE'}));
    expect(readiness.items).toContainEqual(expect.objectContaining({service: 'AGENTTEAMS_RUNTIME', state: 'NOT_CONFIGURED', reasonCode: 'SDD_007_REQUIRED'}));
  });
});
