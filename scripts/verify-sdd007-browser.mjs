import axe from "axe-core";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const staticRoot = path.resolve("apps/web/storybook-static");
const evidenceRoot = path.resolve(".evidence/sdd-007/browser");
await mkdir(evidenceRoot, { recursive: true });
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = path.resolve(staticRoot, relative);
    if (!file.startsWith(`${staticRoot}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    const extension = path.extname(file);
    const contentType = extension === ".html" ? "text/html; charset=utf-8" : extension === ".json" ? "application/json" : extension === ".css" ? "text/css" : extension === ".js" ? "text/javascript" : "application/octet-stream";
    response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
if (address === null || typeof address === "string") throw new Error("SDD007_STORYBOOK_SERVER_FAILED");
const origin = `http://127.0.0.1:${address.port}`;
const index = JSON.parse(await readFile(path.join(staticRoot, "index.json"), "utf8"));
const stories = Object.values(index.entries);
const storyId = (exportName) => {
  const entry = stories.find((item) => item.exportName === exportName);
  if (entry === undefined) throw new Error(`SDD007_STORY_NOT_FOUND:${exportName}`);
  return entry.id;
};
const checks = {};
const screenshots = [];
const consoleErrors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 800 }, locale: "zh-CN" });
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await openStory("AITeamPersistentRuntime");
  await page.getByText("运行环境降级", { exact: true }).waitFor();
  checks.zhStableState = (await page.locator(".lc-runtime-board header").innerText()).includes("DEGRADED");
  checks.exactlySixMembers = await page.locator(".lc-runtime-board .lc-agent-avatar").count() === 6;
  checks.realJobNotFixtureSuccess = await page.getByText(/ORCHESTRATE · presence-mission-leader/u).isVisible() && await page.getByText(/^ACKNOWLEDGED · task-orche/u).isVisible() && !await page.getByText(/fixture.*success|模拟成功/iu).isVisible().catch(() => false);
  checks.tokensUnobserved = await page.getByText("Token", { exact: true }).isVisible() && (await page.locator(".lc-runtime-board dl").innerText()).includes("—");
  const trace = page.locator(".lc-runtime-board details").first();
  await trace.evaluate((node) => { node.open = true; });
  checks.progressiveTrace = await page.getByText(/TASK_ACKNOWLEDGED/u).isVisible() && await page.getByText(/run=runtime-run-public-safe/u).isVisible();
  checks.publicPayloadRedactedSurface = !(await page.locator("body").innerText()).includes("sdd007-browser-secret-sentinel");
  await page.getByRole("tab", { name: /工作概览/u }).focus();
  await page.keyboard.press("Tab");
  checks.keyboardTabs = await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null);
  await assertAxe("zh-runtime");
  checks.desktop1024 = await noHorizontalOverflow();
  await capture("01-runtime-degraded-zh-1024x800.png");

  await page.setViewportSize({ width: 800, height: 900 });
  await openStory("AITeamPersistentRuntime", false);
  checks.narrowViewportFailClosed = await page.getByText("MIN_DESKTOP_WIDTH = 1024px", { exact: true }).isVisible() && !await page.locator(".lc-runtime-board").isVisible();
  checks.narrowViewportNoOverflow = await noHorizontalOverflow();
  await capture("02-runtime-desktop-gate-zh-800x900.png");

  await page.setViewportSize({ width: 1024, height: 800 });
  await openStory("AITeamPersistentRuntimeEnglishUnreachable");
  await page.getByText("Runtime unreachable", { exact: true }).waitFor();
  checks.englishStableState = (await page.locator(".lc-runtime-board header").innerText()).includes("UNREACHABLE");
  checks.unreachableNeverGreen = await page.getByText(/BLOCKED · task-orch/u).isVisible() && !await page.getByText("Runtime ready", { exact: true }).isVisible().catch(() => false);
  checks.englishTokenNull = await page.getByText("Tokens", { exact: true }).isVisible() && (await page.locator(".lc-runtime-board dl").innerText()).includes("—");
  await assertAxe("en-unreachable");
  checks.englishDesktop1024 = await noHorizontalOverflow();
  await capture("03-runtime-unreachable-en-1024x800.png");

  if (consoleErrors.length > 0) throw new Error(`SDD007_BROWSER_CONSOLE_ERRORS:${consoleErrors.join(" | ")}`);
  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  if (failed.length > 0) throw new Error(`SDD007_BROWSER_CHECKS_FAILED:${failed.join(",")}`);
  const evidence = { schemaVersion: 1, status: "PASS", classification: "PUBLIC_SAFE_ENGINEERING_STORY", browser: "Playwright Chromium", locales: ["zh-CN", "en"], viewports: ["1024x800", "800x900"], checks, screenshots, consoleErrors };
  await writeFile(path.join(evidenceRoot, "browser-verification.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({ ...evidence, evidence: ".evidence/sdd-007/browser/browser-verification.json" }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function openStory(exportName, expectRuntime = true) {
  await page.goto(`${origin}/iframe.html?id=${encodeURIComponent(storyId(exportName))}&viewMode=story`, { waitUntil: "networkidle" });
  await (expectRuntime ? page.locator(".lc-runtime-board") : page.locator(".lc-desktop-gate")).waitFor();
}
async function noHorizontalOverflow() {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}
async function assertAxe(label) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await globalThis.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    return result.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")).map((item) => item.id);
  });
  if (violations.length > 0) throw new Error(`SDD007_AXE_${label}:${violations.join(",")}`);
}
async function capture(name) {
  const output = path.join(evidenceRoot, name);
  await page.screenshot({ path: output, fullPage: false });
  screenshots.push({ name, sha256: createHash("sha256").update(await readFile(output)).digest("hex"), viewport: page.viewportSize() });
}
