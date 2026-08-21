import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {chromium} from '@playwright/test';

const root = process.cwd();
const storybookDir = path.join(root, 'apps/web/storybook-static');
const evidenceDir = path.join(root, 'docs/reports/evidence/pr-567-convergence');
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const consoleErrors = [];
const screenshots = [];
const server = createStaticServer(storybookDir);
let browser;

try {
  await mkdir(evidenceDir, {recursive: true});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('PR567_STORYBOOK_SERVER_ADDRESS_INVALID');
  const storybookBase = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({headless: true, executablePath: chromePath});
  const page = await browser.newPage({viewport: {width: 1440, height: 1100}});
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await capture(page, `${storybookBase}/iframe.html?id=m3-desktop-manual-publish-assistant--chinese-desktop&viewMode=story`, '.manual-publish-evidence', '01-manual-publish-assistant.png', async () => {
    const snapshot = await page.evaluate(() => ({
      path: document.querySelector('.manual-publish-evidence')?.getAttribute('data-current-path'),
      cards: document.querySelectorAll('.manual-publish-card').length,
      executableElements: document.querySelectorAll('.manual-publish-evidence a,.manual-publish-evidence button,.manual-publish-evidence input,.manual-publish-evidence form').length,
      text: document.body.innerText
    }));
    if (snapshot.path !== 'MANUAL_DESKTOP_ASSISTANT' || snapshot.cards !== 6 || snapshot.executableElements !== 0 || !snapshot.text.includes('等待系统核对')) throw new Error(`PR567_MANUAL_PUBLISH_EVIDENCE_INVALID: ${JSON.stringify(snapshot)}`);
  });

  await capture(page, `${storybookBase}/iframe.html?id=m2-sdd-005-market-localization-evidence--japan-conflict-blocked&viewMode=story`, '.market-evidence', '02-market-localization-jp-conflict.png', async () => {
    const snapshot = await page.evaluate(() => ({
      marketButtons: document.querySelectorAll('.market-evidence__markets button').length,
      selected: document.querySelector('.market-evidence__selected h2')?.textContent,
      sourceLinks: document.querySelectorAll('.market-evidence__grid a').length,
      text: document.body.innerText
    }));
    if (snapshot.marketButtons !== 3 || !snapshot.selected?.includes('JP · ja-JP · BLUESKY') || snapshot.sourceLinks < 3 || !snapshot.text.includes('BLOCKED_BY_CONFLICT') || !snapshot.text.includes('PUBLIC_SAFE_FIXTURE')) throw new Error('PR567_MARKET_LOCALIZATION_EVIDENCE_INVALID');
  });

  if (consoleErrors.length > 0) throw new Error(`PR567_BROWSER_CONSOLE_ERRORS: ${consoleErrors.join(' | ')}`);
  const productionEvidence = JSON.parse(await readFile(path.join(root, 'docs/reports/evidence/sdd-006/browser-verification.json'), 'utf8'));
  const evidence = {
    schemaVersion: 1,
    status: 'PASS',
    browser: 'Google Chrome headless (real Blink runtime)',
    publicSafeFixtures: true,
    customerEvidence: false,
    consoleErrorCount: 0,
    checks: {
      manualPublishSixPlatformReadOnlyEvidence: true,
      marketLocalizationExactThreeConflictEvidence: true,
      productionBilingualDesktopEvidenceReferenced: productionEvidence.checks?.desktopGate === true && productionEvidence.checks?.englishTodayLocalized === true
    },
    screenshots,
    productionEvidence: 'docs/reports/evidence/sdd-006/browser-verification.json'
  };
  await writeFile(path.join(evidenceDir, 'browser-verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({status: evidence.status, checks: Object.keys(evidence.checks).length, screenshots: screenshots.length, evidence: 'docs/reports/evidence/pr-567-convergence/browser-verification.json'}));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

async function capture(page, url, selector, fileName, assertPage) {
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.locator(selector).waitFor({state: 'visible'});
  await assertPage();
  const target = path.join(evidenceDir, fileName);
  await page.screenshot({path: target, fullPage: true});
  const bytes = await readFile(target);
  screenshots.push({name: fileName, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex')});
}

function createStaticServer(directory) {
  const contentTypes = {'.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let target = path.resolve(directory, relative);
      if (!target.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('PR567_STATIC_PATH_ESCAPE');
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      response.writeHead(200, {'content-type': contentTypes[path.extname(target)] ?? 'application/octet-stream'});
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}
