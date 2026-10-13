// Fixed existing site, GET/read only. Never connects a wallet or selects a file.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = "https://chainproof-two.vercel.app";
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
try {
  const context = await browser.newContext(), page = await context.newPage(), forbidden = [], states = [];
  await context.route("**/*", route => {
    const request = route.request();
    if (request.method() !== "GET" && request.method() !== "HEAD") { forbidden.push({ url: request.url(), method: request.method() }); return route.abort(); }
    return route.continue();
  });
  for (const path of ["/", "/register", "/verify"]) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 30000 });
    assert.equal(response.status(), 200);
    assert.equal(await page.title(), "ChainProof");
    assert.equal(await page.evaluate(() => Boolean(window.ethereum)), false);
    states.push({ path, status: response.status(), heading: await page.locator("h1").innerText() });
  }
  assert.deepEqual(forbidden, [], "Existing pages must not auto-submit requests on visit without a wallet/file");
  const report = { checkedAt: new Date().toISOString(), website: base, states, wallet: "none", writes: 0, scope: "Existing1.0 site GET smoke only, not2.0 deployed acceptance" };
  await mkdir(".local-evm/release-5a", { recursive: true });
  await writeFile(`.local-evm/release-5a/live-site-${Date.now()}.json`, JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify(report));
  await context.close();
} finally { await browser.close(); }
