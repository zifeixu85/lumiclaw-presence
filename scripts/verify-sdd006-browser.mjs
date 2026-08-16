import axe from 'axe-core';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const baseUrl = process.env.SDD006_WEB_URL ?? 'http://127.0.0.1:3166';
const evidenceDirectory = path.resolve('docs/reports/evidence/sdd-006');
const fixtureName = 'sdd-006-local-private-fixture.md';
const fixtureBytes = Buffer.from('# 星河公开安全测试资料\n用于验证本机私有初始化，不含客户或私密资料。');
const screenshots = [];
const checks = {};

await mkdir(evidenceDirectory, {recursive: true});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: 'zh-CN'});
await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: baseUrl});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));

try {
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: '先告诉我怎么称呼你。'}).waitFor();
  checks.firstOpenDisplayNameOnly = await page.locator('input').count() === 1 && await page.locator('input[type=email],input[type=password],input[name*=key i]').count() === 0;
  checks.onboardingStepRail = await page.getByText('初始化进度', {exact: true}).isVisible() && (await page.locator('.lc-onboarding-step').count()) === 4;
  await capture(page, '01-first-open.png');
  await assertAxe(page, 'zh-first-open');
  await assertZhDoesNotExposeLegacyEnglish(page, 'zh-first-open');

  await page.getByLabel('本地显示名称').fill('SDD-006 Owner');
  await page.getByRole('button', {name: '继续'}).click();
  await page.getByRole('heading', {name: '用示例快速体验，或带上真实本地资料。'}).waitFor();
  checks.twoHonestPaths = await page.getByText('公开安全示例', {exact: true}).isVisible() && await page.getByText('仅保存在本机', {exact: true}).isVisible();
  await capture(page, '02-onboarding-path-choice.png');
  await assertAxe(page, 'zh-path-choice');

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
  checks.contextFieldsRemainDistinct = (await Promise.all(['目标市场 Market', '内容语言 Locale', '首选平台 Platform', '排程时区 Time Zone'].map((label) => page.getByLabel(label).isVisible()))).every(Boolean);
  await page.getByLabel('Campaign 名称').scrollIntoViewIfNeeded();
  await capture(page, '03-local-private-context-confirmation.png');
  await assertAxe(page, 'zh-local-context');
  await page.getByRole('button', {name: '创建我的 Campaign 并进入工作区'}).click();

  await page.getByRole('heading', {name: '今天需要处理 3 件事'}).waitFor({timeout: 20_000});
  const todayBody = await page.locator('body').innerText();
  checks.workspaceEntered = true;
  checks.localPrivateWorkspaceBadge = todayBody.includes('本机资料') && !todayBody.includes('演示数据');
  checks.noPublicExampleCampaignLeak = !todayBody.includes('LumiClaw Presence local launch') && !todayBody.includes('PUBLIC_SAFE_EXAMPLE');
  checks.todayHierarchy = ['待你处理', '持续 Goal', 'Campaign 团队角色', '本周时间线'].every((value) => todayBody.includes(value));
  checks.noHorizontalOverflow1440 = await hasNoHorizontalOverflow(page);
  await assertNoStableCodeHeadlines(page, 'zh-today');
  await capture(page, '04-today.png');
  await assertAxe(page, 'zh-today');
  await assertZhDoesNotExposeLegacyEnglish(page, 'zh-today');

  await page.locator('.lc-sidebar a[href$="/campaigns"]').click();
  await page.getByRole('heading', {name: '星河产品首发'}).waitFor();
  const campaignBody = await page.locator('body').innerText();
  checks.campaignOwnAuthority = campaignBody.includes('本机资料') && !campaignBody.includes('演示数据');
  checks.campaignInformationArchitecture = ['平台内容计划', 'Campaign 准备情况', '当前协作责任'].every((value) => campaignBody.includes(value));
  await assertNoStableCodeHeadlines(page, 'zh-campaign');
  await capture(page, '05-campaign.png');

  const revisionButton = page.getByRole('button', {name: /阅读全文并审阅/u}).first();
  await revisionButton.focus();
  await revisionButton.click();
  await page.getByRole('dialog').waitFor();
  const drawerMotion = await page.locator('[role=dialog]').evaluate((element) => ({duration: getComputedStyle(element).animationDuration, modal: element.getAttribute('aria-modal')}));
  const dialogText = await page.getByRole('dialog').innerText();
  checks.fullContentBeforeApproval = dialogText.includes('星河翻译助手') && dialogText.includes('媒体预览') && dialogText.includes('平台预览');
  checks.approvalBlockedWithoutAudit = await page.getByRole('button', {name: '确认准确版本'}).isDisabled();
  checks.compactActiveAgentAndTrace = dialogText.includes('内容责任') && dialogText.includes('展开每一步历史留痕') && !['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].every((code) => dialogText.includes(code));
  checks.drawerMotionContract = drawerMotion.duration === '0.24s' && drawerMotion.modal === 'true';
  checks.drawerScrollLock = await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden');
  await capture(page, '06-full-content-review-drawer.png');
  await assertAxe(page, 'zh-content-drawer');
  await assertZhDoesNotExposeLegacyEnglish(page, 'zh-content-drawer');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state: 'detached'});
  checks.drawerFocusRestored = await revisionButton.evaluate((element) => document.activeElement === element);

  await page.locator('.lc-sidebar a[href$="/ai-team"]').click();
  await page.getByRole('heading', {name: 'AI 团队'}).waitFor();
  const teamBody = await page.locator('body').innerText();
  checks.frozenTeamTabsPresent = (await Promise.all(['工作概览', 'AI 员工', '团队技能', '定时任务'].map((label) => page.getByRole('tab', {name: new RegExp(`^${label}`, 'u')}).isVisible()))).every(Boolean);
  checks.metricProvenance = teamBody.includes('暂无权威运行观测') && teamBody.includes('真实 Token、完成量和异常只来自权威运行观测');
  checks.noFakeLiveAnimation = (await page.locator('[data-runtime=running], .animate-pulse').count()) === 0;
  await assertNoStableCodeHeadlines(page, 'zh-team-overview');
  await capture(page, '07-ai-team-overview.png');
  await assertAxe(page, 'zh-team-overview');

  const overviewTab = page.getByRole('tab', {name: /^工作概览/u});
  await overviewTab.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForURL(/\/ai-team\?view=employees$/u);
  checks.teamKeyboardTabs = true;
  await page.reload({waitUntil: 'networkidle'});
  checks.teamUrlStateRestored = await page.getByRole('tab', {name: /^AI 员工/u}).getAttribute('aria-selected') === 'true';
  const employeeBody = await page.locator('body').innerText();
  checks.sixAgents = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].every((code) => employeeBody.includes(code));
  checks.professionalAgentAvatars = await page.locator('.lc-agent-card .lc-agent-avatar').count() === 6;
  await capture(page, '08-ai-employees.png');

  await page.getByRole('tab', {name: /^团队技能/u}).click();
  await page.waitForURL(/\/ai-team\?view=skills$/u);
  checks.teamSkillsReadable = await page.getByText('只读技能库', {exact: true}).isVisible() && await page.locator('.lc-rule-sheet button').count() === 5;
  await capture(page, '09-team-skills.png');
  const skillButton = page.locator('.lc-rule-sheet button').first();
  await skillButton.focus();
  await skillButton.click();
  await page.getByRole('dialog').waitFor();
  await page.getByText(/SKILL\.md/u).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state: 'detached'});
  checks.skillDrawerFocusRestored = await skillButton.evaluate((element) => document.activeElement === element);

  await page.getByRole('tab', {name: /^定时任务/u}).click();
  await page.waitForURL(/\/ai-team\?view=schedules$/u);
  const scheduleBody = await page.locator('body').innerText();
  checks.scheduledTasksHonest = scheduleBody.includes('还没有定时任务') && scheduleBody.includes('已规划，未运行') && !scheduleBody.includes('SDD_007_REQUIRED');
  await assertNoStableCodeHeadlines(page, 'zh-team-schedules');
  await capture(page, '10-scheduled-tasks.png');
  await assertAxe(page, 'zh-team-schedules');

  await page.locator('.lc-sidebar a[href$="/publish"]').click();
  await page.getByRole('heading', {name: '发布中心'}).waitFor();
  const publishBody = await page.locator('body').innerText();
  checks.targetPlatformAndAccountVisible = await page.getByText('目标账号', {exact: false}).isVisible() && await page.getByText('官方发布页：X', {exact: true}).isVisible() && publishBody.includes('尚未连接') && !publishBody.includes('PLANNED_NOT_CONNECTED');
  await page.getByRole('button', {name: '复制审阅稿'}).click();
  await page.getByText('审阅稿已复制；没有创建发布交接。').waitFor();
  const downloadStarted = page.waitForEvent('download');
  await page.getByRole('button', {name: '下载审阅素材'}).click();
  await downloadStarted;
  await page.getByText('审阅素材已下载；没有创建发布交接。').waitFor();
  checks.reviewExportsDoNotClaimHandoff = true;
  checks.openOfficialBlockedWithoutAuthorization = await page.getByRole('button', {name: '打开官方发布页'}).isDisabled();
  checks.ownerCompleteBlockedWithoutAuthorization = await page.getByRole('button', {name: '人工发布尚未开放'}).isDisabled();
  const workspaceForBypass = await page.request.get(`${baseUrl}/api/v1/local-workspace`).then((response) => response.json());
  const authorization = workspaceForBypass.publishAuthorization;
  checks.publishAuthorizationTruth = authorization.state === 'BLOCKED' && authorization.auditState === 'MISSING' && authorization.ownerDecisionState === 'MISSING' && authorization.externalActionAllowed === false;
  const revisionForBypass = workspaceForBypass.campaign.document.artifactRevisions[0];
  const bypassResponse = await page.request.post(`${baseUrl}/api/v1/manual-publish-handoffs`, {data: {organizationId: workspaceForBypass.campaign.document.organizationId, campaignId: workspaceForBypass.campaign.document.id, artifactRevisionId: revisionForBypass.id, platform: revisionForBypass.platform, action: 'OWNER_REPORTED_COMPLETE'}});
  const bypassBody = await bypassResponse.json();
  const reopenedForBypass = await page.request.get(`${baseUrl}/api/v1/local-workspace`).then((response) => response.json());
  checks.apiBypassCannotCreateManualHandoff = bypassResponse.status() === 409 && bypassBody.code === 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED' && bypassBody.createsHandoff === false && reopenedForBypass.handoffs.length === 0;
  await assertNoStableCodeHeadlines(page, 'zh-publish');
  await capture(page, '11-publish-center.png');
  await assertAxe(page, 'zh-publish');

  await page.locator('.lc-sidebar a[href$="/knowledge"]').click();
  await page.getByRole('heading', {name: '品牌与产品资料'}).waitFor();
  const knowledge = await page.locator('body').innerText();
  checks.authoritativeOrganizationBrandProductVisible = ['星河工作室', '星河', '星河翻译助手', fixtureName].every((value) => knowledge.includes(value));
  checks.brandContextSeparationVisible = ['Market', 'Locale', 'Platform', 'Time Zone'].every((value) => knowledge.includes(value));
  await assertNoStableCodeHeadlines(page, 'zh-brand');
  await capture(page, '12-brand-knowledge.png');

  await page.locator('.lc-sidebar a[href$="/accounts"]').click();
  checks.connectorControlsDisabled = await page.getByRole('button', {name: /添加账号/u}).first().isDisabled() && await page.getByRole('button', {name: /测试连接/u}).first().isDisabled();
  await page.locator('.lc-sidebar .lc-nav-item[href$="/settings"]').click();
  await page.getByRole('heading', {name: '本机设置与环境'}).waitFor();
  const runtimeRow = page.getByText('AgentTeams 运行环境', {exact: true}).locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  await runtimeRow.locator('details summary').click();
  checks.runtimeNotConfiguredInDiagnostics = (await runtimeRow.innerText()).includes('SDD_007_REQUIRED');
  checks.noBrowserSecretInput = await page.locator('input[type="password"], input[name*="key" i], input[name*="secret" i], input[placeholder*="api key" i], input[placeholder*="secret" i]').count() === 0;
  await capture(page, '13-settings-readiness.png');
  await assertAxe(page, 'zh-settings');

  await page.goto(`${baseUrl}/en`, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: 'You have 3 items to handle today'}).waitFor();
  checks.englishTodayLocalized = await page.getByText('Needs your attention', {exact: true}).isVisible() && await page.getByText('Continuous Goal', {exact: true}).isVisible();
  await capture(page, '14-en-today.png');
  await assertAxe(page, 'en-today');
  await page.locator('.lc-sidebar a[href$="/ai-team"]').click();
  await page.getByRole('heading', {name: 'AI Team'}).waitFor();
  checks.englishTeamLocalized = (await Promise.all(['Work overview', 'AI employees', 'Team skills', 'Scheduled tasks'].map((label) => page.getByRole('tab', {name: new RegExp(`^${label}`, 'u')}).isVisible()))).every(Boolean);
  await capture(page, '15-en-ai-team.png');
  await assertAxe(page, 'en-team');
  await page.locator('.lc-sidebar a[href$="/publish"]').click();
  await page.getByRole('heading', {name: 'Publish Center'}).waitFor();
  checks.englishPublishGateLocalized = await page.getByRole('button', {name: 'Open official publishing page'}).isDisabled() && await page.getByRole('button', {name: 'Manual publishing unavailable'}).isDisabled() && await page.getByText('Publishing is not ready yet').isVisible();
  await capture(page, '16-en-publish-center.png');
  await assertAxe(page, 'en-publish');

  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(`${baseUrl}/zh-CN/ai-team`, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: 'AI 团队'}).waitFor();
  checks.reducedMotionRespected = await page.locator('[role=tabpanel]').evaluate((element) => getComputedStyle(element).animationName === 'none');
  await page.emulateMedia({reducedMotion: 'no-preference'});

  await page.setViewportSize({width: 1024, height: 900});
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: '今天需要处理 3 件事'}).waitFor();
  checks.noHorizontalOverflow1024 = await hasNoHorizontalOverflow(page);
  checks.desktopWorkspaceAt1024 = await page.locator('.lc-desktop-app').isVisible();

  await page.setViewportSize({width: 800, height: 900});
  await page.reload({waitUntil: 'networkidle'});
  checks.desktopGate = await page.getByRole('heading', {name: '请使用桌面浏览器继续'}).isVisible();
  await capture(page, '17-desktop-gate.png');

  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  if (failed.length > 0) throw new Error(`SDD006_BROWSER_CHECKS_FAILED:${failed.join(',')}`);
  if (consoleErrors.length > 0) throw new Error(`SDD006_BROWSER_CONSOLE_ERRORS:${consoleErrors.join(' | ')}`);
  await writeFile(path.join(evidenceDirectory, 'browser-verification.json'), `${JSON.stringify({schemaVersion: 2, result: 'PASS', baseUrl, viewport: {width: 1440, height: 900}, generatedAt: new Date().toISOString(), locales: ['zh-CN', 'en'], checks, consoleErrors, screenshots}, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', checks: Object.keys(checks).length, screenshots: screenshots.length, evidence: 'docs/reports/evidence/sdd-006/browser-verification.json'}));
} finally {
  await browser.close();
}

async function capture(targetPage, name) {
  await targetPage.waitForTimeout(320);
  const screenshotPath = path.join(evidenceDirectory, name);
  await targetPage.screenshot({path: screenshotPath, fullPage: false});
  const digest = createHash('sha256').update(await readFile(screenshotPath)).digest('hex');
  screenshots.push({name, width: targetPage.viewportSize()?.width, height: targetPage.viewportSize()?.height, sha256: digest});
}

async function assertAxe(targetPage, label) {
  await targetPage.addScriptTag({content: axe.source});
  const violations = await targetPage.evaluate(async () => (await globalThis.axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa']}})).violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')));
  if (violations.length > 0) {
    const details = violations.map((item) => `${item.id}[${item.nodes.map((node) => node.target.join(' ')).join('|')}]`).join(',');
    throw new Error(`AXE_${label.toUpperCase().replaceAll('-', '_')}:${details}`);
  }
}

async function assertNoStableCodeHeadlines(targetPage, label) {
  const headlines = await targetPage.locator('main h1, main h2, main h3').allInnerTexts();
  const forbidden = ['SDD_007_REQUIRED', 'NOT_CONFIGURED', 'LOCAL_PRIVATE', 'PUBLIC_SAFE_EXAMPLE', 'NO_RUNTIME_OBSERVATION'];
  const exposed = headlines.flatMap((headline) => forbidden.filter((code) => headline.includes(code)).map((code) => `${headline}:${code}`));
  if (exposed.length > 0) throw new Error(`STABLE_CODE_HEADLINE_${label.toUpperCase().replaceAll('-', '_')}:${exposed.join('|')}`);
}

async function assertZhDoesNotExposeLegacyEnglish(targetPage, label) {
  const body = await targetPage.locator('body').innerText();
  const forbidden = ['A governed public presence starts locally.', 'Owner queue', 'Campaign context', 'The active responsibility is visible', 'Readiness exceptions', 'Campaign brief', 'Platform content', 'Approval blocked:', 'Responsibility', 'Manual checklist', 'No local handoff receipt yet.'];
  const exposed = forbidden.filter((phrase) => body.includes(phrase));
  if (exposed.length > 0) throw new Error(`ZH_HARDCODED_ENGLISH_${label.toUpperCase().replaceAll('-', '_')}:${exposed.join('|')}`);
}

async function hasNoHorizontalOverflow(targetPage) {
  return targetPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= document.body.clientWidth);
}
