import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {DEMO_CONFIG, assertPublicSafeEvidence} from './initial-demo-contract.mjs';

const profile = await mkdtemp(path.join(os.tmpdir(), 'lumiclaw-initial-demo-chrome-'));
const debugPort = await reservePort();
const screenshots = [];
const checks = {};
let chrome;
let page;

class CdpPage {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.consoleWarningCount = 0;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) {
        if (message.method === 'Runtime.exceptionThrown') this.consoleErrors.push(message.params?.exceptionDetails?.text ?? 'Runtime exception');
        if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') this.consoleErrors.push('console.error');
        if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'warning') this.consoleWarningCount += 1;
        if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') this.consoleErrors.push(message.params.entry.text ?? 'Browser log error');
        if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'warning') this.consoleWarningCount += 1;
        return;
      }
      const pending = this.pending.get(message.id);
      if (pending === undefined) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error !== undefined) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: Chrome DevTools response timed out`));
      }, 15_000);
      this.pending.set(id, {resolve, reject, method, timeout});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails !== undefined) throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text}`);
    return result.result?.value;
  }

  async waitFor(expression, description, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try { if (await this.evaluate(expression)) return; } catch {}
      await delay(150);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }

  async navigate(url, readyExpression, description) {
    await this.send('Page.navigate', {url});
    await this.waitFor(`location.href === ${JSON.stringify(url)} && document.readyState !== 'loading'`, `DOM ready for ${description}`);
    await this.waitFor(readyExpression, description, 45_000);
  }

  async viewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: mobile ? 2 : 1, mobile, screenWidth: width, screenHeight: height});
  }

  async screenshot(name) {
    const target = path.join(DEMO_CONFIG.evidenceRoot, `${name}.png`);
    const result = await this.send('Page.captureScreenshot', {format: 'png', fromSurface: true, captureBeyondViewport: true});
    await writeFile(target, Buffer.from(result.data, 'base64'), {mode: 0o600});
    screenshots.push(path.relative(DEMO_CONFIG.root, target));
  }
}

try {
  await mkdir(DEMO_CONFIG.evidenceRoot, {recursive: true});
  chrome = spawn(DEMO_CONFIG.chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--safebrowsing-disable-auto-update',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'
  ], {stdio: ['ignore', 'ignore', 'ignore']});
  await waitForChrome(debugPort);
  const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === 'page');
  if (target?.webSocketDebuggerUrl === undefined) throw new Error('INITIAL_DEMO_CHROME_PAGE_UNAVAILABLE');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', reject, {once: true});
  });
  page = new CdpPage(socket);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Log.enable');

  await page.viewport(1440, 1000, false);
  await page.navigate(`${DEMO_CONFIG.webBase}/mission`, "document.querySelectorAll('.role-card').length === 6 && document.querySelectorAll('.task-node').length === 8", 'zh-CN Mission');
  checks.missionZhDesktop = await missionSnapshot(page, 1440);
  await page.screenshot('mission-zh-desktop');

  await page.navigate(`${DEMO_CONFIG.webBase}/review`, "document.querySelector('.review-desk') !== null && document.body.innerText.includes('CLAIM_OVERREACH')", 'zh-CN Review');
  checks.reviewZhDesktop = await reviewSnapshot(page, '已失效', 1440);
  await page.screenshot('review-zh-desktop');

  await page.navigate(`${DEMO_CONFIG.webBase}/en/mission`, "document.querySelectorAll('.role-card').length === 6 && document.body.innerText.includes('Six roles. One reviewable production line.')", 'English Mission');
  checks.missionEnDesktop = await missionSnapshot(page, 1440);

  await page.navigate(`${DEMO_CONFIG.webBase}/en/review`, "document.querySelector('.review-desk') !== null && document.body.innerText.includes('CLAIM_OVERREACH')", 'English Review');
  checks.reviewEnDesktop = await reviewSnapshot(page, 'Invalidated', 1440);

  await page.viewport(390, 844, true);
  await page.navigate(`${DEMO_CONFIG.webBase}/mission`, "document.querySelectorAll('.role-card').length === 6 && document.querySelectorAll('.task-node').length === 8", '390px zh-CN Mission');
  checks.missionZh390 = await missionSnapshot(page, 390);
  await page.screenshot('mission-zh-390');

  await page.navigate(`${DEMO_CONFIG.webBase}/review`, "document.querySelector('.review-desk') !== null && document.body.innerText.includes('CLAIM_OVERREACH')", '390px zh-CN Review');
  checks.reviewZh390 = await reviewSnapshot(page, '已失效', 390);
  await page.screenshot('review-zh-390');

  if (page.consoleErrors.length > 0) throw new Error('INITIAL_DEMO_BROWSER_CONSOLE_ERROR');
  const evidence = {
    schemaVersion: DEMO_CONFIG.schemaVersion,
    status: 'PASS',
    browser: 'Google Chrome headless (real Blink runtime)',
    maturity: DEMO_CONFIG.providerMaturity,
    realAgentTeamsClaim: false,
    consoleErrorCount: 0,
    consoleWarningCount: page.consoleWarningCount,
    checks,
    screenshots
  };
  assertPublicSafeEvidence(evidence);
  await writeFile(path.join(DEMO_CONFIG.evidenceRoot, 'browser-smoke.json'), `${JSON.stringify(evidence, null, 2)}\n`, {mode: 0o600});
  console.info(JSON.stringify({status: 'PASS', pages: 6, screenshots: screenshots.length, evidence: `${DEMO_CONFIG.evidenceDisplayRoot}/browser-smoke.json`}));
} catch (error) {
  const candidate = error instanceof Error ? error.message : '';
  const code = /^INITIAL_DEMO_[A-Z0-9_]+$/u.test(candidate) ? candidate : 'INITIAL_DEMO_BROWSER_SMOKE_FAILED';
  const evidence = {schemaVersion: DEMO_CONFIG.schemaVersion, status: 'FAIL', code, maturity: DEMO_CONFIG.providerMaturity, realAgentTeamsClaim: false, externalActionAllowed: false};
  assertPublicSafeEvidence(evidence);
  await mkdir(DEMO_CONFIG.evidenceRoot, {recursive: true});
  await writeFile(path.join(DEMO_CONFIG.evidenceRoot, 'browser-failure.json'), `${JSON.stringify(evidence, null, 2)}\n`, {mode: 0o600});
  console.error(JSON.stringify({status: 'FAIL', code, evidence: `${DEMO_CONFIG.evidenceDisplayRoot}/browser-failure.json`}));
  process.exitCode = 1;
} finally {
  page?.socket.close();
  if (chrome !== undefined) {
    chrome.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2_000)]);
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { await rm(profile, {recursive: true, force: true}); break; }
    catch (error) { if (attempt === 4) throw error; await delay(150); }
  }
}

async function missionSnapshot(cdp, expectedWidth) {
  const snapshot = await cdp.evaluate(`(() => ({
    roles: document.querySelectorAll('.role-card').length,
    tasks: document.querySelectorAll('.task-node').length,
    grants: Number(document.querySelectorAll('.no-action-proof strong')[0]?.textContent),
    connectors: Number(document.querySelectorAll('.no-action-proof strong')[1]?.textContent),
    actions: Number(document.querySelectorAll('.no-action-proof strong')[2]?.textContent),
    executionAllowed: document.querySelectorAll('.no-action-proof strong')[3]?.textContent,
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))()`);
  if (snapshot.roles !== 6 || snapshot.tasks !== 8 || snapshot.grants !== 0 || snapshot.connectors !== 0 || snapshot.actions !== 0 || snapshot.executionAllowed !== 'FALSE' || snapshot.width !== expectedWidth || snapshot.scrollWidth > expectedWidth) throw new Error('INITIAL_DEMO_BROWSER_MISSION_CONTRACT_FAILED');
  return snapshot;
}

async function reviewSnapshot(cdp, invalidatedText, expectedWidth) {
  const snapshot = await cdp.evaluate(`(() => ({
    failedAudit: document.body.innerText.includes('CLAIM_OVERREACH'),
    invalidated: document.body.innerText.includes(${JSON.stringify(invalidatedText)}),
    diffDeleteCount: document.querySelectorAll('.revision-diff del').length,
    diffInsertCount: document.querySelectorAll('.revision-diff ins').length,
    reviewButtons: document.querySelectorAll('.revision-card .review-action').length,
    enabledReviewButtons: [...document.querySelectorAll('.revision-card .review-action')].filter((button) => !button.disabled).length,
    reviewedButtons: [...document.querySelectorAll('.revision-card .review-action')].filter((button) => button.disabled).length,
    grants: Number(document.querySelectorAll('.no-action-proof strong')[0]?.textContent),
    connectors: Number(document.querySelectorAll('.no-action-proof strong')[1]?.textContent),
    actions: Number(document.querySelectorAll('.no-action-proof strong')[2]?.textContent),
    executionAllowed: document.querySelectorAll('.no-action-proof strong')[3]?.textContent,
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))()`);
  const validReviewState = (snapshot.enabledReviewButtons === 4 && snapshot.reviewedButtons === 0) || (snapshot.enabledReviewButtons === 0 && snapshot.reviewedButtons === 4);
  if (!snapshot.failedAudit || !snapshot.invalidated || snapshot.diffDeleteCount !== 1 || snapshot.diffInsertCount !== 1 || snapshot.reviewButtons !== 4 || !validReviewState || snapshot.grants !== 0 || snapshot.connectors !== 0 || snapshot.actions !== 0 || snapshot.executionAllowed !== 'FALSE' || snapshot.width !== expectedWidth || snapshot.scrollWidth > expectedWidth) throw new Error('INITIAL_DEMO_BROWSER_REVIEW_CONTRACT_FAILED');
  return snapshot;
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({host: '127.0.0.1', port: 0}, () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : undefined;
      server.close((error) => error === undefined && port !== undefined ? resolve(port) : reject(error ?? new Error('INITIAL_DEMO_DEBUG_PORT_UNAVAILABLE')));
    });
  });
}

async function waitForChrome(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) return; } catch {}
    await delay(100);
  }
  throw new Error('INITIAL_DEMO_CHROME_UNAVAILABLE');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
