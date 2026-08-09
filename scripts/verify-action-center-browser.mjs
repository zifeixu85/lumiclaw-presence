import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const storybookBase = process.env.SDD004_STORYBOOK_URL ?? 'http://127.0.0.1:6024';
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const evidenceDirectory = path.join(root, '.evidence/sdd-004/browser');
const profile = await mkdtemp(path.join(os.tmpdir(), 'lumiclaw-sdd004-chrome-'));
const debuggingPort = 30_000 + Math.floor(Math.random() * 500);
let chrome;
let page;

class CdpPage {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) {
        if (message.method === 'Runtime.exceptionThrown') this.consoleErrors.push(message.params?.exceptionDetails?.text ?? 'Runtime exception');
        if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
          this.consoleErrors.push((message.params.args ?? []).map((argument) => argument.value ?? argument.description ?? '').join(' '));
        }
        return;
      }
      const pending = this.pending.get(message.id);
      if (pending === undefined) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error === undefined) pending.resolve(message.result ?? {});
      else pending.reject(new Error(`${pending.method}:${message.error.message}`));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}:Chrome response timed out`));
      }, 15_000);
      this.pending.set(id, {resolve, reject, timeout, method});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails !== undefined) throw new Error(`Browser evaluation failed:${result.exceptionDetails.text}`);
    return result.result?.value;
  }

  async waitFor(expression, description, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(expression)) return;
      } catch {}
      await delay(125);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }

  async navigate(url) {
    await this.send('Page.navigate', {url});
    await this.waitFor(`location.href === ${JSON.stringify(url)} && document.readyState !== 'loading'`, `DOM ready:${url}`);
  }

  async viewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: mobile ? 2 : 1, mobile, screenWidth: width, screenHeight: height});
  }

  async screenshot(name) {
    const target = path.join(evidenceDirectory, `${name}.png`);
    const result = await this.send('Page.captureScreenshot', {format: 'png', fromSurface: true, captureBeyondViewport: true});
    await writeFile(target, Buffer.from(result.data, 'base64'));
    return path.relative(root, target);
  }
}

try {
  await mkdir(evidenceDirectory, {recursive: true});
  chrome = spawn(chromePath, [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profile}`,
    'about:blank'
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  await waitForChrome(debuggingPort);
  const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
  const pageTarget = targets.find((target) => target.type === 'page');
  if (pageTarget?.webSocketDebuggerUrl === undefined) throw new Error('Chrome page target unavailable.');
  const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', reject, {once: true});
  });
  page = new CdpPage(socket);
  await page.send('Page.enable');
  await page.send('Runtime.enable');

  const storybookIndex = await fetch(`${storybookBase}/index.json`).then((response) => response.json());
  const stories = Object.values(storybookIndex.entries)
    .filter((entry) => entry.type === 'story' && entry.title === 'SDD-004/Action Center State Matrix');
  if (stories.length !== 10) throw new Error(`Expected 10 Action Center stories, received ${stories.length}.`);

  const checks = [];
  const screenshots = [];
  for (const story of stories) {
    const narrow = story.id.endsWith('--english-unknown-narrow');
    const width = narrow ? 390 : 1280;
    await page.viewport(width, narrow ? 844 : 900, narrow);
    const url = `${storybookBase}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
    await page.navigate(url);
    await page.waitFor("document.querySelector('.action-center') !== null", `Action Center story:${story.id}`);
    const snapshot = await page.evaluate(`(() => {
      const root = document.querySelector('.action-center');
      const button = root.querySelector('.action-center__button');
      return {
        id: ${JSON.stringify(story.id)},
        state: root.dataset.state,
        text: root.innerText,
        buttonText: button?.textContent?.trim() ?? '',
        buttonDisabled: button?.disabled ?? null,
        checkboxes: root.querySelectorAll('input[type="checkbox"]').length,
        statusRegions: root.querySelectorAll('[role="status"]').length,
        headingCount: root.querySelectorAll('h2,h3,h4').length,
        scrollWidth: document.documentElement.scrollWidth,
        width: window.innerWidth
      };
    })()`);
    if (!snapshot.text.includes('NOT_LIVE') || !snapshot.text.includes('externalActionAllowed=false')) throw new Error(`Story ${story.id} lost its no-action boundary.`);
    if (snapshot.statusRegions !== 1 || snapshot.headingCount < 6) throw new Error(`Story ${story.id} lost semantic status/headings.`);
    if (snapshot.scrollWidth > snapshot.width) throw new Error(`Story ${story.id} clips horizontally:${snapshot.scrollWidth}>${snapshot.width}.`);
    if (snapshot.state === 'UNKNOWN' && (!snapshot.text.includes('不会重复发布') && !snapshot.text.includes('will not publish again'))) throw new Error('UNKNOWN lost the no-repeat explanation.');
    if (snapshot.state === 'UNKNOWN' && (snapshot.buttonText.includes('受控尝试') || snapshot.buttonText.includes('controlled attempt'))) throw new Error('UNKNOWN exposed a retry-shaped action.');
    if (snapshot.state === 'OWNER_ACTION_REQUIRED' && !snapshot.text.includes('FIXTURE_NO_RETURN_EVIDENCE')) throw new Error('Incomplete Handoff lost its no-return-evidence receipt.');
    checks.push(snapshot);
  }

  const interactive = stories.find((story) => story.id.endsWith('--interactive-grant-confirmation'));
  if (interactive === undefined) throw new Error('Interactive Grant confirmation story is missing.');
  await page.viewport(1280, 900, false);
  await page.navigate(`${storybookBase}/iframe.html?id=${encodeURIComponent(interactive.id)}&viewMode=story`);
  await page.waitFor("document.querySelector('.action-center__button')?.disabled === true", 'dangerous action initially disabled');
  await page.evaluate("document.body.tabIndex = -1; document.body.focus(); true");
  await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Tab', code: 'Tab'});
  await page.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Tab', code: 'Tab'});
  await page.waitFor("document.activeElement === document.querySelector('.action-center__confirmation input')", 'keyboard focus on exact-scope confirmation');
  await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key: ' ', code: 'Space'});
  await page.send('Input.dispatchKeyEvent', {type: 'keyUp', key: ' ', code: 'Space'});
  await page.waitFor("document.querySelector('.action-center__button')?.disabled === false", 'dangerous action enabled after exact confirmation');
  await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Tab', code: 'Tab'});
  await page.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Tab', code: 'Tab'});
  await page.waitFor("document.activeElement === document.querySelector('.action-center__button')", 'keyboard focus on gated action');
  const confirmation = await page.evaluate(`({
    checked: document.querySelector('.action-center__confirmation input').checked,
    enabled: !document.querySelector('.action-center__button').disabled,
    buttonFocused: document.activeElement === document.querySelector('.action-center__button'),
    focusVisible: document.querySelector('.action-center__button').matches(':focus-visible')
  })`);
  if (!confirmation.checked || !confirmation.enabled || !confirmation.buttonFocused || !confirmation.focusVisible) throw new Error('Keyboard exact-scope confirmation/focus gate failed.');

  for (const [suffix, name] of [
    ['--unknown-reconciliation-only', 'unknown-reconciliation-desktop'],
    ['--published-with-native-evidence', 'published-evidence-desktop'],
    ['--english-unknown-narrow', 'unknown-reconciliation-en-390']
  ]) {
    const story = stories.find((entry) => entry.id.endsWith(suffix));
    if (story === undefined) throw new Error(`Screenshot story missing:${suffix}`);
    const narrow = suffix.endsWith('narrow');
    await page.viewport(narrow ? 390 : 1280, narrow ? 844 : 900, narrow);
    await page.navigate(`${storybookBase}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
    await page.waitFor("document.querySelector('.action-center') !== null", `screenshot story:${story.id}`);
    screenshots.push(await page.screenshot(name));
  }

  if (page.consoleErrors.length > 0) throw new Error(`Browser console errors:${page.consoleErrors.join(' | ')}`);
  const evidence = {
    schemaVersion: '1.0.0',
    status: 'PASS',
    maturity: 'ENGINEERING_VERIFIED_UI_FOUNDATION',
    externalActionClaim: false,
    storyCount: stories.length,
    checks,
    confirmation,
    screenshots,
    consoleErrors: page.consoleErrors
  };
  const evidencePath = path.join(evidenceDirectory, 'browser-verification.json');
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', stories: stories.length, screenshots, evidence: path.relative(root, evidencePath)}));
} finally {
  page?.socket.close();
  if (chrome !== undefined) {
    chrome.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2_000)]);
  }
  await rm(profile, {recursive: true, force: true});
}

async function waitForChrome(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
