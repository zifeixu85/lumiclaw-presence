import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, mkdtemp, rm, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const storybookDir = path.join(root, 'apps/web/storybook-static');
const evidenceDir = path.join(root, '.evidence/sdd-005/browser');
const screenshotPath = path.join(evidenceDir, 'market-localization-jp-conflict-desktop.png');
const evidencePath = path.join(root, '.evidence/sdd-005/browser-verification.json');
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = await mkdtemp(path.join(os.tmpdir(), 'lumiclaw-sdd005-chrome-'));
const debugPort = 29_500 + Math.floor(Math.random() * 400);
let chrome;
let cdp;
let server;

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
        if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') this.consoleErrors.push((message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? '').join(' '));
        if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') this.consoleErrors.push(message.params.entry.text ?? 'Browser log error');
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
    return new Promise((resolvePromise, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method}: Chrome DevTools response timed out`)); }, 15_000);
      this.pending.set(id, {resolve: resolvePromise, reject, method, timeout});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (response.exceptionDetails !== undefined) throw new Error(`Browser evaluation failed: ${response.exceptionDetails.text}`);
    return response.result?.value;
  }

  async waitFor(expression, description) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try { if (await this.evaluate(expression)) return; } catch {}
      await delay(150);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }
}

try {
  await mkdir(evidenceDir, {recursive: true});
  server = createStaticServer(storybookDir);
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('SDD005_STORYBOOK_SERVER_ADDRESS_INVALID');
  const storybookBase = `http://127.0.0.1:${address.port}`;

  chrome = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--safebrowsing-disable-auto-update',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  await waitForChrome(debugPort);
  const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === 'page');
  if (target?.webSocketDebuggerUrl === undefined) throw new Error('SDD005_CHROME_PAGE_UNAVAILABLE');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, {once: true});
    socket.addEventListener('error', reject, {once: true});
  });
  cdp = new CdpPage(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 1100});

  const index = await fetch(`${storybookBase}/index.json`).then((response) => response.json());
  const stories = Object.values(index.entries).filter((entry) => entry.type === 'story' && entry.title === 'M2/SDD-005 Market Localization Evidence');
  if (stories.length !== 3) throw new Error(`SDD005_EXPECTED_THREE_DESKTOP_STORIES_RECEIVED_${stories.length}`);
  const story = stories.find((entry) => entry.name === 'Japan Conflict Blocked');
  if (story === undefined) throw new Error('SDD005_JAPAN_CONFLICT_STORY_NOT_FOUND');
  const storyUrl = `${storybookBase}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
  await cdp.send('Page.navigate', {url: storyUrl});
  await cdp.waitFor("document.querySelector('.market-evidence') !== null && document.body.innerText.includes('MARKET_KNOWLEDGE_CONFLICT')", 'SDD-005 JP conflict evidence');

  const initial = await snapshot(cdp);
  assertSnapshot(initial, 'JP', 'ja-JP', 'BLUESKY', true);
  for (const [market, locale, platform] of [['US', 'en-US', 'X'], ['DE', 'de-DE', 'LINKEDIN'], ['JP', 'ja-JP', 'BLUESKY']]) {
    await cdp.evaluate(`([...document.querySelectorAll('.market-evidence__markets button')].find((button) => button.textContent.includes(${JSON.stringify(market)})))?.click(); true`);
    await cdp.waitFor(`document.querySelector('.market-evidence__selected h2')?.textContent.includes(${JSON.stringify(`${market} · ${locale} · ${platform}`)})`, `${market} market selection`);
    assertSnapshot(await snapshot(cdp), market, locale, platform, market === 'JP');
  }
  if (cdp.consoleErrors.length > 0) throw new Error(`SDD005_BROWSER_CONSOLE_ERRORS: ${cdp.consoleErrors.join(' | ')}`);

  const capture = await cdp.send('Page.captureScreenshot', {format: 'png', fromSurface: true, captureBeyondViewport: true});
  const screenshot = Buffer.from(capture.data, 'base64');
  await writeFile(screenshotPath, screenshot);
  const screenshotEvidence = {
    path: path.relative(root, screenshotPath),
    width: screenshot.readUInt32BE(16),
    height: screenshot.readUInt32BE(20),
    bytes: screenshot.byteLength,
    sha256: createHash('sha256').update(screenshot).digest('hex')
  };
  const evidence = {
    schemaVersion: 1,
    status: 'PASS',
    browser: 'Google Chrome headless (real Blink runtime)',
    storyId: story.id,
    publicSafeFixture: true,
    customerEvidence: false,
    marketChecks: ['US/en-US/X', 'JP/ja-JP/BLUESKY/BLOCKED_BY_CONFLICT', 'DE/de-DE/LINKEDIN'],
    consoleErrorCount: cdp.consoleErrors.length,
    screenshot: screenshotEvidence
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify(evidence));
} finally {
  cdp?.socket.close();
  await new Promise((resolvePromise) => server?.close(resolvePromise) ?? resolvePromise());
  if (chrome !== undefined) {
    chrome.kill('SIGTERM');
    await Promise.race([new Promise((resolvePromise) => chrome.once('exit', resolvePromise)), delay(2_000)]);
  }
  await rm(profile, {recursive: true, force: true});
}

function createStaticServer(directory) {
  const contentTypes = {'.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let target = path.resolve(directory, relative);
      if (!target.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('SDD005_STATIC_PATH_ESCAPE');
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      response.writeHead(200, {'content-type': contentTypes[path.extname(target)] ?? 'application/octet-stream'});
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}

async function snapshot(page) {
  return page.evaluate(`(() => ({
    heading: document.querySelector('.market-evidence__selected h2')?.textContent ?? '',
    selectedMarket: document.querySelector('.market-evidence__markets button[aria-pressed="true"] span')?.textContent ?? '',
    marketButtons: document.querySelectorAll('.market-evidence__markets button').length,
    sourceLinks: document.querySelectorAll('.market-evidence__grid a').length,
    producer: document.querySelector('[data-testid="producer-context"]')?.textContent ?? '',
    auditor: document.querySelector('[data-testid="auditor-context"]')?.textContent ?? '',
    text: document.body.innerText,
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))()`);
}

function assertSnapshot(value, market, locale, platform, conflictExpected) {
  if (value.marketButtons !== 3 || value.selectedMarket !== market || !value.heading.includes(`${market} · ${locale} · ${platform}`)) throw new Error(`SDD005_${market}_SELECTION_FAILED`);
  if (value.sourceLinks < 3 || !value.auditor.includes('AUDITOR_EVIDENCE') || !value.text.includes('PUBLIC_SAFE_FIXTURE / 非客户证据') || !value.text.includes('OWNER UAT PENDING')) throw new Error(`SDD005_${market}_EVIDENCE_FAILED`);
  if (conflictExpected !== value.producer.includes('BLOCKED_BY_CONFLICT')) throw new Error(`SDD005_${market}_CONFLICT_BOUNDARY_FAILED`);
  if (value.scrollWidth > value.width) throw new Error(`SDD005_${market}_HORIZONTAL_CLIPPING_${value.scrollWidth}`);
}

async function waitForChrome(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('SDD005_CHROME_DEBUG_ENDPOINT_TIMEOUT');
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
