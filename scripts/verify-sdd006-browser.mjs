import axe from 'axe-core';
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SDD006_WEB_URL ?? 'http://127.0.0.1:3166';
const evidenceDirectory = path.resolve('docs/reports/evidence/sdd-006');
const fixtureName = 'sdd-006-local-private-fixture.md';
const fixtureBytes = Buffer.from('# 星河公开安全测试资料\n用于验证本机私有初始化，不含客户或私密资料。');
const screenshots = [];
await mkdir(evidenceDirectory, {recursive: true});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'zh-CN'});
await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: baseUrl});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
const checks = {};

try {
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: '先告诉我怎么称呼你。'}).waitFor();
  checks.firstOpenDisplayNameOnly = await page.locator('input').count() === 1 && await page.locator('input[type=email],input[type=password],input[name*=key i]').count() === 0;
  await capture(page, '01-first-open.png', screenshots);
  await assertAxe(page, 'zh-first-open');
  await assertZhDoesNotExposeLegacyEnglish(page, 'zh-first-open');

  await page.getByLabel('本地显示名称').fill('SDD-006 Owner');
  await page.getByRole('button', {name: '继续'}).click();
  await page.getByRole('heading', {name: '用示例快速体验，或带上真实本地资料。'}).waitFor();
  await page.getByRole('button', {name: '选择本地资料路径'}).click();
  await page.getByRole('heading', {name: '添加品牌或产品资料'}).waitFor();
  await page.locator('input[type=file]').setInputFiles({name: fixtureName, mimeType: 'text/markdown', buffer: fixtureBytes});
  await page.getByText(fixtureName).waitFor();
  await page.getByLabel('组织名称 Organization').fill('星河工作室');
  await page.getByLabel('品牌名称 Brand').fill('星河');
  await page.getByLabel('品牌定位').fill('帮助独立团队清楚表达跨市场产品价值。');
  await page.getByLabel('产品名称 Product').fill('星河翻译助手');
  await page.getByLabel('产品说明').fill('一个由本机资料确认、用于跨市场产品表达的翻译助手。');
  await page.getByLabel('Campaign 名称').fill('星河产品首发');
  await page.getByLabel('Campaign 目标').fill('让目标用户理解产品如何帮助小团队准备多市场内容。');
  await page.getByLabel('行动号召').fill('阅读完整说明并分享反馈。');
  checks.mdUploadVisible = true;
  checks.extractedTextVisible = await page.getByText('查看提取文本').isVisible();
  checks.pdfDocxHonest = await page.getByText(/PDF、DOCX：PLANNED/u).isVisible();
  checks.localAuthorityFieldsConfirmed = (await page.locator('form input[required], form textarea[required]').count()) === 8;
  await capture(page, '02-local-private-onboarding-confirmed.png', screenshots);
  await assertAxe(page, 'zh-local-onboarding');
  await page.getByRole('button', {name: '创建我的 Campaign 并进入工作区'}).click();

  await page.getByRole('heading', {name: '今天需要你处理的事'}).waitFor({timeout: 20_000});
  const todayBody = await page.locator('body').innerText();
  checks.workspaceEntered = true;
  checks.localPrivateWorkspaceBadge = todayBody.includes('LOCAL_PRIVATE') && todayBody.includes('星河产品首发');
  checks.noPublicExampleCampaignLeak = !todayBody.includes('LumiClaw Presence local launch') && !todayBody.includes('PUBLIC_SAFE_EXAMPLE');
  await capture(page, '03-local-private-today-workspace.png', screenshots);
  await assertAxe(page, 'zh-today-workspace');
  await assertZhDoesNotExposeLegacyEnglish(page, 'zh-today-workspace');

  await page.getByRole('link', {name: '品牌资料'}).click();
  await page.getByRole('heading', {name: '品牌与产品资料'}).waitFor();
  const knowledge = await page.locator('body').innerText();
  checks.authoritativeOrganizationBrandProductVisible = ['星河工作室', '星河', '星河翻译助手', fixtureName].every((value) => knowledge.includes(value));
  await capture(page, '04-local-private-knowledge-graph.png', screenshots);

  await page.getByRole('link', {name: 'Campaign'}).click();
  await page.getByRole('heading', {name: '星河产品首发'}).waitFor();
  checks.campaignOwnAuthority = (await page.locator('body').innerText()).includes('LOCAL_PRIVATE');
  await page.getByRole('tab', {name: '完整内容'}).click();
  const revisionButton = page.getByRole('button').filter({hasText: 'NEEDS_REVIEW'}).first();
  await revisionButton.focus();
  await revisionButton.click();
  await page.getByRole('dialog').waitFor();
  const dialogText = await page.getByRole('dialog').innerText();
  checks.fullContentBeforeApproval = dialogText.includes('星河翻译助手') && dialogText.includes('LOCAL_PRIVATE');
  checks.approvalBlockedWithoutAudit = await page.getByRole('button', {name: '确认准确版本'}).isDisabled();
  checks.compactActiveAgentAndTrace = dialogText.includes('当前工作 Agent') && dialogText.includes('展开每一步历史留痕') && !['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].every((code) => dialogText.includes(code));
  await capture(page, '05-full-content-review-drawer.png', screenshots);
  await assertAxe(page, 'zh-content-drawer');
  await assertZhDoesNotExposeLegacyEnglish(page, 'zh-content-drawer');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state: 'detached'});
  checks.drawerFocusRestored = await revisionButton.evaluate((element) => document.activeElement === element);

  await page.getByRole('link', {name: 'AI 团队'}).click();
  await page.getByRole('heading', {name: '六位职责稳定的 AI 团队成员'}).waitFor();
  checks.frozenTeamTabsPresent = (await Promise.all(['工作概览', 'AI 员工', '团队技能', '定时任务'].map(async (label) => page.getByRole('tab', {name: label}).isVisible()))).every(Boolean);
  checks.metricProvenance = await page.getByText('NO_RUNTIME_OBSERVATION', {exact: true}).isVisible();
  await capture(page, '06-ai-team-work-overview.png', screenshots);
  await assertAxe(page, 'zh-team-overview');

  const employeesTab = page.getByRole('tab', {name: 'AI 员工'});
  await employeesTab.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/ai-team\?view=employees$/u);
  await page.reload({waitUntil: 'networkidle'});
  checks.teamUrlStateRestored = await page.getByRole('tab', {name: 'AI 员工'}).getAttribute('aria-selected') === 'true';
  checks.sixAgents = (await Promise.all(['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map(async (code) => page.getByText(code, {exact: true}).count()))).every((count) => count >= 1);
  await capture(page, '07-ai-team-employees.png', screenshots);

  await page.getByRole('tab', {name: '团队技能'}).click();
  await page.waitForURL(/\/ai-team\?view=skills$/u);
  checks.teamSkillsRoute = await page.getByText('REPOSITORY_OWNED', {exact: true}).first().isVisible() && await page.getByText('AVAILABLE', {exact: true}).first().isVisible();
  await capture(page, '08-ai-team-skills.png', screenshots);
  await page.getByRole('tab', {name: '定时任务'}).click();
  await page.waitForURL(/\/ai-team\?view=schedules$/u);
  checks.scheduledTasksHonest = await page.getByText('当前没有持久定时任务').isVisible() && await page.getByText('PLANNED · NO_RUNTIME_OBSERVATION', {exact: true}).isVisible() && await page.getByText(/SDD-007/u).isVisible();
  await capture(page, '09-ai-team-scheduled-tasks.png', screenshots);
  await assertAxe(page, 'zh-team-schedules');

  await page.getByRole('link', {name: '发布中心'}).click();
  await page.getByRole('heading', {name: '发布授权与审阅导出'}).waitFor();
  await page.getByRole('button', {name: '复制审阅稿'}).click();
  await page.getByText('审阅稿已复制；没有创建发布交接。').waitFor();
  const downloadStarted = page.waitForEvent('download');
  await page.getByRole('button', {name: '下载审阅素材'}).click();
  await downloadStarted;
  await page.getByText('审阅素材已下载；没有创建发布交接。').waitFor();
  checks.reviewExportsDoNotClaimHandoff = true;
  checks.openOfficialBlockedWithoutAuthorization = await page.getByRole('button', {name: '打开官方发布页'}).isDisabled();
  checks.ownerCompleteBlockedWithoutAuthorization = await page.getByRole('button', {name: '人工完成已阻断'}).isDisabled();
  const publishBody = await page.locator('body').innerText();
  checks.publishAuthorizationTruth = ['BLOCKED', 'INDEPENDENT_AUDIT_PASS', 'EXACT_EXTERNAL_ACTION_OWNER_DECISION', 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED', 'SDD_007_REQUIRED', 'CONNECTOR_SDD_REQUIRED'].every((value) => publishBody.includes(value)) && !publishBody.includes('PUBLISHED');
  const workspaceForBypass = await page.request.get(`${baseUrl}/api/v1/local-workspace`).then((response) => response.json());
  const revisionForBypass = workspaceForBypass.campaign.document.artifactRevisions[0];
  const bypassResponse = await page.request.post(`${baseUrl}/api/v1/manual-publish-handoffs`, {data: {organizationId: workspaceForBypass.campaign.document.organizationId, campaignId: workspaceForBypass.campaign.document.id, artifactRevisionId: revisionForBypass.id, platform: revisionForBypass.platform, action: 'OWNER_REPORTED_COMPLETE'}});
  const bypassBody = await bypassResponse.json();
  const reopenedForBypass = await page.request.get(`${baseUrl}/api/v1/local-workspace`).then((response) => response.json());
  const apiBypass = {status: bypassResponse.status(), body: bypassBody, handoffCount: reopenedForBypass.handoffs.length};
  checks.apiBypassCannotCreateManualHandoff = apiBypass.status === 409 && apiBypass.body.code === 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED' && apiBypass.body.createsHandoff === false && apiBypass.handoffCount === 0;
  await page.reload({waitUntil: 'networkidle'});
  const reopenedPublishBody = await page.locator('body').innerText();
  checks.publishBlockReopened = reopenedPublishBody.includes('MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED') && await page.getByRole('button', {name: '人工完成已阻断'}).isDisabled();
  await capture(page, '10-publish-center-blocked.png', screenshots);
  await assertAxe(page, 'zh-publish-blocked');
  await assertZhDoesNotExposeLegacyEnglish(page, 'zh-publish');

  await page.getByRole('link', {name: '账号'}).click();
  checks.connectorControlsDisabled = await page.getByRole('button', {name: /添加账号/u}).first().isDisabled() && await page.getByRole('button', {name: /测试连接/u}).first().isDisabled();
  await page.getByRole('link', {name: '设置'}).click();
  await page.getByRole('heading', {name: '本机设置与环境'}).waitFor();
  checks.runtimeNotConfigured = await page.getByText('AGENTTEAMS_RUNTIME').isVisible() && await page.getByText('SDD_007_REQUIRED').isVisible();
  checks.noBrowserSecretInput = await page.locator('input').count() === 0;

  await page.goto(`${baseUrl}/en`, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: 'What needs your attention today'}).waitFor();
  checks.englishTodayLocalized = await page.getByText('Owner queue', {exact: true}).isVisible() && await page.getByText('Readiness exceptions', {exact: true}).isVisible();
  await capture(page, '11-en-today-workspace.png', screenshots);
  await assertAxe(page, 'en-today-workspace');
  await page.getByRole('link', {name: 'AI Team'}).click();
  await page.getByRole('heading', {name: 'Six AI team members with stable responsibilities'}).waitFor();
  checks.englishTeamLocalized = (await Promise.all(['Work overview', 'AI employees', 'Team skills', 'Scheduled tasks'].map(async (label) => page.getByRole('tab', {name: label}).isVisible()))).every(Boolean);
  await capture(page, '12-en-ai-team-overview.png', screenshots);
  await assertAxe(page, 'en-team-overview');
  await page.getByRole('link', {name: 'Publish Center'}).click();
  await page.getByRole('heading', {name: 'Publishing authorization and review exports'}).waitFor();
  checks.englishPublishGateLocalized = await page.getByRole('button', {name: 'Open official publishing page'}).isDisabled() && await page.getByRole('button', {name: 'Manual completion blocked'}).isDisabled() && await page.getByText('External publishing is not authorized').isVisible();
  await capture(page, '13-en-publish-center-blocked.png', screenshots);
  await assertAxe(page, 'en-publish-blocked');

  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.setViewportSize({width: 800, height: 900});
  await page.reload({waitUntil: 'networkidle'});
  checks.desktopGate = await page.getByRole('heading', {name: '请使用桌面浏览器继续'}).isVisible();
  await capture(page, '14-desktop-gate.png', screenshots);

  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  if (failed.length > 0) throw new Error(`SDD006_BROWSER_CHECKS_FAILED:${failed.join(',')}`);
  if (consoleErrors.length > 0) throw new Error(`SDD006_BROWSER_CONSOLE_ERRORS:${consoleErrors.join(' | ')}`);
  await writeFile(path.join(evidenceDirectory, 'browser-verification.json'), `${JSON.stringify({schemaVersion: 1, result: 'PASS', baseUrl, generatedAt: new Date().toISOString(), locales: ['zh-CN', 'en'], checks, consoleErrors, screenshots}, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', checks: Object.keys(checks).length, screenshots: screenshots.length, evidence: 'docs/reports/evidence/sdd-006/browser-verification.json'}));
} finally {
  await browser.close();
}

async function capture(targetPage, name, output) {
  await targetPage.screenshot({path: path.join(evidenceDirectory, name), fullPage: true});
  output.push(name);
}

async function assertAxe(targetPage, label) {
  await targetPage.addScriptTag({content: axe.source});
  const violations = await targetPage.evaluate(async () => (await globalThis.axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa']}})).violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')));
  if (violations.length > 0) {
    const details = violations.map((item) => `${item.id}[${item.nodes.map((node) => node.target.join(' ')).join('|')}]`).join(',');
    throw new Error(`AXE_${label.toUpperCase().replaceAll('-', '_')}:${details}`);
  }
}

async function assertZhDoesNotExposeLegacyEnglish(targetPage, label) {
  const body = await targetPage.locator('body').innerText();
  const forbidden = [
    'A governed public presence starts locally.',
    'Owner queue',
    'Campaign context',
    'The active responsibility is visible',
    'Readiness exceptions',
    'Campaign brief',
    'Platform content',
    'Approval blocked:',
    'Responsibility',
    'Manual checklist',
    'No local handoff receipt yet.'
  ];
  const exposed = forbidden.filter((phrase) => body.includes(phrase));
  if (exposed.length > 0) throw new Error(`ZH_HARDCODED_ENGLISH_${label.toUpperCase().replaceAll('-', '_')}:${exposed.join('|')}`);
}
