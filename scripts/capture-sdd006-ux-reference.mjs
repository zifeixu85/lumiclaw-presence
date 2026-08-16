import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const prototypeUrl = process.env.UX14_PROTOTYPE_URL ?? 'http://127.0.0.1:4175';
const evidenceDirectory = path.resolve('docs/reports/evidence/sdd-006/prototype-reference');
const screenshots = [];

await mkdir(evidenceDirectory, {recursive: true});
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'zh-CN'});

try {
  await page.goto(prototypeUrl, {waitUntil: 'networkidle'});
  await page.addStyleTag({content: '*,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.locator('#view-today.active').waitFor();
  await capture('prototype-today.png');

  await page.locator('.main-nav [data-view-target="ai-team"]').click();
  await page.locator('#view-ai-team.active').waitFor();
  await capture('prototype-ai-team.png');

  await page.locator('.main-nav [data-view-target="campaign"]').click();
  await page.locator('#view-campaign.active').waitFor();
  await page.locator('[data-campaign-tab="overview"]').first().click();
  await capture('prototype-campaign.png');

  await page.locator('#view-campaign [data-open-content="linkedin"]').first().click();
  await page.locator('#content-workspace.open').waitFor();
  await capture('prototype-review.png');
  await page.locator('#close-content').click();
  await page.locator('#content-workspace').waitFor({state: 'hidden'});

  await page.locator('.main-nav [data-view-target="approval"]').click();
  await page.locator('#view-approval.active').waitFor();
  await capture('prototype-publish.png');

  await writeFile(path.join(evidenceDirectory, 'prototype-reference.json'), `${JSON.stringify({
    schemaVersion: 1,
    source: 'Owner-frozen UX 1.4 visual prototype',
    prototypeUrl,
    viewport: {width: 1440, height: 900},
    screenshots,
  }, null, 2)}\n`);
  console.info(JSON.stringify({status: 'PASS', screenshots: screenshots.length, evidence: path.relative(process.cwd(), evidenceDirectory)}));
} finally {
  await browser.close();
}

async function capture(name) {
  const screenshotPath = path.join(evidenceDirectory, name);
  await page.screenshot({path: screenshotPath, fullPage: false});
  screenshots.push({name, sha256: createHash('sha256').update(await readFile(screenshotPath)).digest('hex')});
}
