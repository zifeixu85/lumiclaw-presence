import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const evidenceDir = path.join(root, '.evidence/sdd-002/browser');
const appBase = process.env.SDD002_BROWSER_APP_URL ?? 'http://127.0.0.1:3124';
const storybookBase = process.env.SDD002_STORYBOOK_URL ?? 'http://127.0.0.1:6022';
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = await mkdtemp(path.join(os.tmpdir(), 'lumiclaw-sdd002-chrome-'));
const port = 29_000 + Math.floor(Math.random() * 500);
const checks = {};
const screenshots = [];
let chrome;
let cdp;

class CdpPage {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.consoleWarnings = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) {
        if (message.method === 'Runtime.exceptionThrown') this.consoleErrors.push(message.params?.exceptionDetails?.text ?? 'Runtime exception');
        if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) {
          const target = message.params.type === 'error' ? this.consoleErrors : this.consoleWarnings;
          target.push((message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? '').join(' '));
        }
        if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params?.entry?.level)) {
          const target = message.params.entry.level === 'error' ? this.consoleErrors : this.consoleWarnings;
          const entry = message.params.entry;
          const location = entry.url === undefined ? '' : ` [${entry.url}${entry.lineNumber === undefined ? '' : `:${entry.lineNumber}`} ]`;
          target.push(`${entry.text ?? 'Browser log entry'}${location}`);
        }
        return;
      }
      const pending = this.pending.get(message.id);
      if (pending === undefined) return;
      this.pending.delete(message.id);
      if (message.error !== undefined) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject, method});
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
      try {
        if (await this.evaluate(expression)) return;
      } catch {}
      await delay(150);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }

  async navigate(url) {
    await this.send('Page.navigate', {url});
    await this.waitFor("document.readyState === 'complete'", `page load ${url}`);
  }

  async viewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: mobile ? 2 : 1, mobile, screenWidth: width, screenHeight: height});
  }

  async screenshot(name) {
    const target = path.join(evidenceDir, `${name}.png`);
    const result = await this.send('Page.captureScreenshot', {format: 'png', fromSurface: true, captureBeyondViewport: true});
    await writeFile(target, Buffer.from(result.data, 'base64'));
    screenshots.push(path.relative(root, target));
  }
}

try {
  await mkdir(evidenceDir, {recursive: true});
  chrome = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--safebrowsing-disable-auto-update',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  await waitForChrome(port);
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const pageTarget = targets.find((target) => target.type === 'page');
  if (pageTarget?.webSocketDebuggerUrl === undefined) throw new Error('Chrome page target was not available.');
  const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}); });
  cdp = new CdpPage(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');

  const index = await fetch(`${storybookBase}/index.json`).then((response) => response.json());
  const stories = Object.values(index.entries).filter((entry) => entry.type === 'story' && entry.title === 'M2/Governed SHADOW Mission States');
  if (stories.length !== 14) throw new Error(`Expected 14 governed SHADOW state stories, received ${stories.length}.`);
  const renderedStates = [];
  for (const story of stories) {
    const mobile = story.id.endsWith('--english-queued-390-px');
    await cdp.viewport(mobile ? 390 : 1280, mobile ? 844 : 900, mobile);
    await cdp.navigate(`${storybookBase}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
    await cdp.waitFor("document.querySelector('.shadow-console,.mission-empty,.review-desk') !== null", `Storybook story ${story.id}`);
    const state = await cdp.evaluate(`(() => ({
      id: ${JSON.stringify(story.id)},
      roles: document.querySelectorAll('.role-card').length,
      tasks: document.querySelectorAll('.task-node').length,
      text: document.body.innerText,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth
    }))()`);
    if (!state.text.includes('NOT_LIVE')) throw new Error(`Story ${story.id} lost the NOT_LIVE marker.`);
    if (state.scrollWidth > state.width) throw new Error(`Story ${story.id} horizontally clips at ${state.width}px.`);
    renderedStates.push({id: state.id, roles: state.roles, tasks: state.tasks, width: state.width, scrollWidth: state.scrollWidth});
  }
  const queuedStory = renderedStates.find((story) => story.id.endsWith('--queued'));
  const englishMobileStory = renderedStates.find((story) => story.id.endsWith('--english-queued-390-px'));
  if (queuedStory?.roles !== 6 || queuedStory.tasks !== 6 || englishMobileStory?.width !== 390) throw new Error('Storybook six-member or 390px acceptance failed.');
  checks.storybookRealBrowserStateMatrix = {count: renderedStates.length, renderedStates};
  await cdp.navigate(`${storybookBase}/iframe.html?id=${encodeURIComponent(englishMobileStory.id)}&viewMode=story`);
  await cdp.waitFor("document.querySelectorAll('.role-card').length === 6", 'mobile Storybook six-role roster');
  await cdp.screenshot('storybook-en-queued-390');

  await cdp.viewport(1440, 1000, false);
  await cdp.navigate(`${appBase}/mission`);
  await cdp.waitFor("document.querySelector('.campaign-control button.primary-action') !== null", 'hydrated empty Campaign');
  const initialBoundary = await cdp.evaluate(`(() => ({
    text: document.body.innerText,
    boundaries: document.querySelectorAll('.governance-boundaries article').length,
    createText: document.querySelector('button.primary-action')?.textContent?.trim()
  }))()`);
  if (initialBoundary.boundaries !== 2 || !initialBoundary.text.includes('Claim / Evidence 只约束未来执行') || !initialBoundary.text.includes('排程按钮是独立校验')) throw new Error('UX-M1-001 governance boundary separation is missing.');
  if (initialBoundary.createText !== '创建并保存') throw new Error('Fresh product route did not hydrate the zh-CN Campaign state.');
  await cdp.evaluate("document.querySelector('button.primary-action').click(); true");
  await cdp.waitFor("document.body.innerText.includes('数据库版本') && [...document.querySelectorAll('button')].some((button) => button.textContent.includes('启动六成员 SHADOW'))", 'saved Campaign and SHADOW start control');
  await cdp.evaluate("document.querySelector('.m1-editor-disclosure summary').click(); true");
  await cdp.waitFor("document.querySelector('.schedule-editor .secondary-action') !== null", 'M1 schedule disclosure');
  const foldReason = await scheduleReason(cdp);
  if (!foldReason.disabled || !foldReason.reason.includes('DST 重叠')) throw new Error('Saved content must expose the independent missing-fold disabled reason.');
  await cdp.evaluate(`(() => {
    const field = document.querySelector('.m1-editor-disclosure textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(field, field.value + ' ');
    field.dispatchEvent(new Event('input', {bubbles: true}));
    return true;
  })()`);
  await cdp.waitFor("document.querySelector('#schedule-disabled-reason')?.textContent.includes('内容尚未保存')", 'unsaved-content schedule reason');
  const unsavedReason = await scheduleReason(cdp);
  if (!unsavedReason.disabled || !unsavedReason.reason.includes('内容尚未保存')) throw new Error('Unsaved content must have its own schedule disabled reason.');
  await cdp.evaluate("document.querySelector('button.primary-action').click(); true");
  await cdp.waitFor("!document.body.innerText.includes('有未保存修改') && document.querySelector('#schedule-disabled-reason')?.textContent.includes('DST 重叠')", 'saved draft returns to fold reason');
  checks.uxM1001DistinctBoundariesAndDisabledReasons = {boundaryCards: initialBoundary.boundaries, foldReason: foldReason.reason, unsavedReason: unsavedReason.reason};

  await cdp.evaluate("[...document.querySelectorAll('button')].find((button) => button.textContent.includes('启动六成员 SHADOW')).click(); true");
  await cdp.waitFor("[...document.querySelectorAll('button')].some((button) => button.textContent.includes('运行公开安全故障演练'))", 'queued SHADOW Mission');
  await cdp.evaluate("[...document.querySelectorAll('button')].find((button) => button.textContent.includes('运行公开安全故障演练')).click(); true");
  await cdp.waitFor("document.querySelectorAll('.role-card').length === 6 && document.querySelectorAll('.task-node').length === 6 && document.body.innerText.includes('等待 Owner 精确确认')", 'fault flight awaiting exact Owner Review', 60_000);
  const mission = await missionSnapshot(cdp);
  assertMissionSnapshot(mission, 'desktop zh-CN Mission');
  await cdp.screenshot('product-zh-mission-desktop');

  await cdp.navigate(`${appBase}/review`);
  await cdp.waitFor("document.querySelector('.review-desk') !== null && document.body.innerText.includes('4/4 PASS')", 'hydrated exact Owner Review');
  const rejected = await cdp.evaluate(`(() => ({
    failedAudit: document.body.innerText.includes('CLAIM_OVERREACH'),
    invalidated: document.body.innerText.includes('已失效'),
    diff: document.querySelectorAll('.revision-diff del').length === 1 && document.querySelectorAll('.revision-diff ins').length === 1,
    buttons: document.querySelectorAll('.revision-card .review-action').length
  }))()`);
  if (!rejected.failedAudit || !rejected.invalidated || !rejected.diff || rejected.buttons !== 4) throw new Error('Fault refusal, invalidation, diff, or exact four-revision review was not visible.');
  for (let count = 1; count <= 4; count += 1) {
    await cdp.evaluate("[...document.querySelectorAll('.revision-card .review-action')].find((button) => !button.disabled).click(); true");
    await cdp.waitFor(`[...document.querySelectorAll('.revision-card .review-action')].filter((button) => button.textContent.includes('已记录（不可执行）')).length === ${count}`, `persisted Owner Review ${count}/4`);
  }
  const review = await cdp.evaluate(`(() => ({
    reviewed: [...document.querySelectorAll('.revision-card .review-action')].filter((button) => button.textContent.includes('已记录（不可执行）')).length,
    grants: [...document.querySelectorAll('.no-action-proof strong')].map((node) => node.textContent),
    noGrantBoundary: document.body.innerText.includes('Owner Review ≠ ActionGrant')
  }))()`);
  if (review.reviewed !== 4 || !review.noGrantBoundary || review.grants.slice(0, 3).some((value) => value !== '0')) throw new Error('Exact non-executable Owner Review boundary failed.');
  checks.productHydratedMissionAndReview = {mission, rejected, review};
  await cdp.screenshot('product-zh-review-desktop');

  await cdp.navigate(`${appBase}/en/mission`);
  await cdp.waitFor("document.querySelectorAll('.role-card').length === 6 && document.body.innerText.includes('Six roles. One reviewable production line.')", 'hydrated English Mission');
  const english = await missionSnapshot(cdp);
  assertMissionSnapshot(english, 'desktop English Mission');
  checks.englishHydratedMission = english;

  await cdp.viewport(390, 844, true);
  await cdp.navigate(`${appBase}/mission`);
  await cdp.waitFor("document.querySelectorAll('.role-card').length === 6 && document.body.innerText.includes('SHADOW 已完成')", '390px zh-CN Mission');
  const mobileMission = await missionSnapshot(cdp);
  assertMissionSnapshot(mobileMission, '390px zh-CN Mission');
  if (mobileMission.width !== 390 || mobileMission.scrollWidth > 390) throw new Error(`390px Mission clips horizontally at ${mobileMission.scrollWidth}px.`);
  checks.mobile390Mission = mobileMission;
  await cdp.screenshot('product-zh-mission-390');
  await cdp.navigate(`${appBase}/review`);
  await cdp.waitFor("document.querySelector('.review-desk') !== null && document.body.innerText.includes('4/4 PASS')", '390px Review');
  const mobileReview = await cdp.evaluate("({width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, reviewed: [...document.querySelectorAll('.revision-card .review-action')].filter((button) => button.textContent.includes('已记录（不可执行）')).length})");
  if (mobileReview.width !== 390 || mobileReview.scrollWidth > 390 || mobileReview.reviewed !== 4) throw new Error('390px Owner Review clipping or persisted-review acceptance failed.');
  checks.mobile390Review = mobileReview;
  await cdp.screenshot('product-zh-review-390');

  if (cdp.consoleErrors.length > 0) throw new Error(`Browser runtime emitted errors: ${cdp.consoleErrors.join(' | ')}`);
  const evidence = {schemaVersion: '1.0.0', status: 'PASS', browser: 'Google Chrome headless (real Blink runtime)', appBase, storybookBase, modelMaturity: 'MOCK_CONFORMANCE', realAgentTeamsClaim: false, consoleErrorCount: cdp.consoleErrors.length, consoleWarningCount: cdp.consoleWarnings.length, consoleWarnings: cdp.consoleWarnings, checks, screenshots};
  await writeFile(path.join(root, '.evidence/sdd-002/browser-verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', storyCount: stories.length, screenshots: screenshots.length, evidence: '.evidence/sdd-002/browser-verification.json'}));
} finally {
  cdp?.socket.close();
  chrome?.kill('SIGTERM');
  await rm(profile, {recursive: true, force: true});
}

async function waitForChrome(debugPort) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`); if (response.ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

async function scheduleReason(page) {
  return page.evaluate(`(() => ({
    disabled: document.querySelector('.schedule-editor .secondary-action')?.disabled,
    reason: document.querySelector('#schedule-disabled-reason')?.textContent ?? ''
  }))()`);
}

async function missionSnapshot(page) {
  return page.evaluate(`(() => ({
    roles: document.querySelectorAll('.role-card').length,
    tasks: document.querySelectorAll('.task-node').length,
    grants: Number(document.querySelectorAll('.no-action-proof strong')[0]?.textContent),
    connectors: Number(document.querySelectorAll('.no-action-proof strong')[1]?.textContent),
    actions: Number(document.querySelectorAll('.no-action-proof strong')[2]?.textContent),
    executionAllowed: document.querySelectorAll('.no-action-proof strong')[3]?.textContent,
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))()`);
}

function assertMissionSnapshot(snapshot, label) {
  if (snapshot.roles !== 6 || snapshot.tasks !== 6 || snapshot.grants !== 0 || snapshot.connectors !== 0 || snapshot.actions !== 0 || snapshot.executionAllowed !== 'FALSE') throw new Error(`${label} lost six-member or no-action proof.`);
}

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
