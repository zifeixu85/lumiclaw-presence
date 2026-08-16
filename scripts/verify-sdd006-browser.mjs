import axe from 'axe-core';
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SDD006_WEB_URL ?? 'http://127.0.0.1:3166';
const evidenceDirectory = path.resolve('docs/reports/evidence/sdd-006');
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
  await page.screenshot({path: path.join(evidenceDirectory, '01-first-open.png'), fullPage: true});
  await assertAxe(page, 'first-open');

  await page.getByLabel('本地显示名称').fill('SDD-006 Owner');
  await page.getByRole('button', {name: '继续'}).click();
  await page.getByRole('heading', {name: '用示例快速体验，或带上真实本地资料。'}).waitFor();
  await page.getByRole('button', {name: '选择本地资料路径'}).click();
  await page.getByRole('heading', {name: '添加品牌或产品资料'}).waitFor();
  await page.locator('input[type=file]').setInputFiles({name: 'sdd-006-public-safe-brief.md', mimeType: 'text/markdown', buffer: Buffer.from('# SDD-006 public-safe browser fixture\nNo customer or private material.')});
  await page.getByText('sdd-006-public-safe-brief.md').waitFor();
  checks.mdUploadVisible = true;
  checks.pdfDocxHonest = await page.getByText(/PDF、DOCX：PLANNED/u).isVisible();
  await page.screenshot({path: path.join(evidenceDirectory, '02-local-material-onboarding.png'), fullPage: true});
  await page.getByRole('button', {name: '保存上下文并进入工作区'}).click();

  await page.getByRole('heading', {name: '今天需要你处理的事'}).waitFor({timeout: 20_000});
  checks.workspaceEntered = true;
  await page.screenshot({path: path.join(evidenceDirectory, '03-today-workspace.png'), fullPage: true});
  await assertAxe(page, 'today-workspace');

  await page.getByRole('link', {name: 'Campaign'}).click();
  await page.getByRole('heading', {name: 'LumiClaw Presence local launch'}).waitFor();
  await page.getByRole('tab', {name: '批准前的完整内容'}).click();
  const revisionButton = page.getByRole('button').filter({hasText: 'NEEDS_REVIEW'}).first();
  await revisionButton.focus(); await revisionButton.click();
  await page.getByRole('dialog').waitFor();
  checks.fullContentBeforeApproval = await page.getByRole('dialog').getByText(/A local, evidence-bound campaign skeleton/u).isVisible();
  checks.approvalBlockedWithoutAudit = await page.getByRole('button', {name: '确认准确版本'}).isDisabled();
  await page.screenshot({path: path.join(evidenceDirectory, '04-full-content-review-drawer.png'), fullPage: true});
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state: 'detached'});
  checks.drawerFocusRestored = await revisionButton.evaluate((element) => document.activeElement === element);

  await page.getByRole('link', {name: 'AI 团队'}).click();
  await page.getByRole('heading', {name: '六位职责稳定的 AI 团队成员'}).waitFor();
  checks.sixAgents = (await Promise.all(['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map(async (code) => page.getByText(code, {exact: true}).count()))).every((count) => count >= 1);
  checks.metricProvenance = await page.getByText(/NO_RUNTIME_OBSERVATION/u).first().isVisible();
  await page.screenshot({path: path.join(evidenceDirectory, '05-ai-team.png'), fullPage: true});

  await page.getByRole('link', {name: '发布中心'}).click();
  await page.getByRole('heading', {name: '桌面人工发布助手'}).waitFor();
  await page.getByRole('button', {name: '复制正文'}).click();
  await page.getByRole('button', {name: '我已人工完成'}).click();
  await page.getByText('OWNER_REPORTED_COMPLETE · AWAITING_RECONCILIATION').waitFor();
  checks.manualHandoffNeverPublished = (await page.locator('body').innerText()).includes('AWAITING_RECONCILIATION') && !(await page.locator('body').innerText()).includes('PUBLISHED');
  await page.reload({waitUntil: 'networkidle'});
  await page.getByText('OWNER_REPORTED_COMPLETE').waitFor();
  checks.handoffReopened = true;
  await page.screenshot({path: path.join(evidenceDirectory, '06-publish-center-awaiting.png'), fullPage: true});

  await page.getByRole('link', {name: '账号'}).click();
  checks.connectorControlsDisabled = await page.getByRole('button', {name: /添加账号/u}).first().isDisabled() && await page.getByRole('button', {name: /测试连接/u}).first().isDisabled();
  await page.getByRole('link', {name: '设置'}).click();
  await page.getByRole('heading', {name: '本机设置与环境'}).waitFor();
  checks.runtimeNotConfigured = await page.getByText('AGENTTEAMS_RUNTIME').isVisible() && await page.getByText('SDD_007_REQUIRED').isVisible();
  checks.noBrowserSecretInput = await page.locator('input').count() === 0;

  await page.setViewportSize({width: 800, height: 900});
  await page.reload({waitUntil: 'networkidle'});
  checks.desktopGate = await page.getByRole('heading', {name: '请使用桌面浏览器继续'}).isVisible();

  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  if (failed.length > 0) throw new Error(`SDD006_BROWSER_CHECKS_FAILED:${failed.join(',')}`);
  if (consoleErrors.length > 0) throw new Error(`SDD006_BROWSER_CONSOLE_ERRORS:${consoleErrors.join(' | ')}`);
  await writeFile(path.join(evidenceDirectory, 'browser-verification.json'), `${JSON.stringify({schemaVersion: 1, result: 'PASS', baseUrl, generatedAt: new Date().toISOString(), checks, consoleErrors, screenshots: ['01-first-open.png', '02-local-material-onboarding.png', '03-today-workspace.png', '04-full-content-review-drawer.png', '05-ai-team.png', '06-publish-center-awaiting.png']}, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', checks: Object.keys(checks).length, evidence: 'docs/reports/evidence/sdd-006/browser-verification.json'}));
} finally {
  await browser.close();
}

async function assertAxe(targetPage, label) {
  await targetPage.addScriptTag({content: axe.source});
  const violations = await targetPage.evaluate(async () => (await globalThis.axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa']}})).violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')));
  if (violations.length > 0) {
    const details = violations.map((item) => `${item.id}[${item.nodes.map((node) => node.target.join(' ')).join('|')}]`).join(',');
    throw new Error(`AXE_${label.toUpperCase().replaceAll('-', '_')}:${details}`);
  }
}
