// Only run against an isolated local production preview, never the public site.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { VERSION_DEMO_KEY, createDemoWork, encodeDemoWorks, DEMO_WALLETS } from "../lib/version-history.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.CHAINPROOF_TEST_URL || "http://127.0.0.1:3009";
const target = new URL(base);
assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
try {
  const context = await browser.newContext(), page = await context.newPage(), requests = [], walletMethods = [];
  const stored = encodeDemoWorks([4, 6].map(n => createDemoWork({ workId: `demo-00000000-0000-0000-0000-00000000000${n}`, controller: DEMO_WALLETS[0], title: `Local Work ${n}`, description: "Isolated fixture, not mainnet", now: 1700000500 })));
  await context.addInitScript(({ key, stored }) => {
    window.releaseWalletMethods = [];
    window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, async request({ method }) {
      window.releaseWalletMethods.push(method);
      if (method === "eth_accounts") return [];
      if (method === "eth_chainId") return "0x2a5";
      throw new Error(`No permission for wallet method ${method}`);
    } };
    localStorage.setItem(key, stored);
  }, { key: VERSION_DEMO_KEY, stored });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === target.origin) return route.continue();
    requests.push(url.href);
    return route.abort("blockedbyclient");
  });
  for (const path of ["/works", "/works/new", "/works/4", "/works/6", "/works/demo-poison"]) {
    for (const suffix of ["", "?NODE_ENV=development&CHAINPROOF_VERSION_PROTOTYPE=1&CHAINPROOF_LOCAL_EVM=1&CHAINPROOF_METAMASK_LOCAL=1"]) {
      await page.goto(`${base}${path}${suffix}`);
      await page.getByRole("heading", { name: "Version History unavailable", exact: true }).waitFor();
      const main = await page.locator("main").innerText();
      assert.ok(!main.includes("Local Work 4") && !main.includes("Local Work 6"));
      assert.equal(await page.locator("main input, main button, main select").count(), 0);
      assert.equal(await page.getByRole("link", { name: /Create a demo work|Add Version/ }).count(), 0);
      assert.equal(await page.getByRole("navigation").getByRole("link", { name: /Version|Works/ }).count(), 0);
      await page.reload();
      await page.getByRole("heading", { name: "Version History unavailable", exact: true }).waitFor();
      walletMethods.push(...await page.evaluate(() => window.releaseWalletMethods));
    }
  }
  assert.deepEqual(requests, [], "Blocked prototype does not contact any local or public RPC");
  assert.ok(walletMethods.every(m => ["eth_accounts", "eth_chainId"].includes(m)), "Visit cannot connect, switch, sign or submit");
  assert.equal((await page.request.get(`${base}/.local-evm/backups/chain31338.json`)).status(), 404);
  assert.equal((await page.request.get(`${base}/.env.local`)).status(), 404);
  await context.close();
  console.log("PASS: production direct/deep links, refresh, poisoned storage and query spoofing cannot expose Version History, records or write controls; no RPC or wallet permission request.");
} finally { await browser.close(); }
