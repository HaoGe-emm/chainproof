// Security regression uses loopback contracts only. --baseline records the pre-fix counterexamples.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { toFunctionSelector } from "viem";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = "http://127.0.0.1:3002";
const config = JSON.parse(await readFile(".local-evm/deployment.json", "utf8"));
const baseline = process.argv.includes("--baseline");
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
const evidence = { baseline, results: [] };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
async function environment() {
  const context = await browser.newContext(); const page = await context.newPage(); const sends = [];
  await context.route("https://rpc.botchain.ai/**", (route) => route.abort());
  await context.route("http://127.0.0.1:8545/**", async (route) => {
    const request = route.request().postDataJSON();
    if (request.method === "eth_sendTransaction") sends.push(request);
    await route.continue();
  });
  await page.goto(`${base}/local-evm/works/new`);
  await page.getByRole("combobox", { name: "Unlocked local development account", exact: true }).waitFor();
  const select = page.getByRole("combobox", { name: "Unlocked local development account", exact: true });
  const connect = async () => { await page.getByRole("button", { name: "Connect Local Test Wallet", exact: true }).click(); await page.getByText("Local Test Wallet Connected", { exact: true }).waitFor(); };
  return { context, page, sends, select, connect };
}
try {
  {
    const { context, page, select, connect, sends } = await environment();
    const started = deferred(), release = deferred(), finished = deferred(); let held = false;
    await page.route("http://127.0.0.1:8545/**", async (route) => {
      if (route.request().postDataJSON().method === "eth_accounts" && !held) { held = true; started.resolve(); await release.promise; await route.fallback(); finished.resolve(); }
      else await route.fallback();
    });
    await page.getByRole("button", { name: "Connect Local Test Wallet", exact: true }).click(); await started.promise;
    await select.selectOption(config.accounts[1]); await connect();
    release.resolve(); await finished.promise;
    if (baseline) await page.getByText("Ready to Create", { exact: true }).waitFor();
    else { await page.getByText("Unauthorized Wallet", { exact: true }).waitFor(); await page.waitForTimeout(400); assert.equal(await page.getByText("Ready to Create", { exact: true }).count(), 0); }
    evidence.results.push({ case: "stale connect overwrites newer selection", reproduced: baseline, sends: sends.length });
    assert.equal(sends.length, 0); await context.close();
  }
  {
    const { context, page, select, connect, sends } = await environment(); await connect();
    await page.getByText("Ready to Create", { exact: true }).waitFor();
    const started = deferred(), release = deferred(); let held = false;
    const selector = toFunctionSelector("createWork(bytes32)");
    await page.route("http://127.0.0.1:8545/**", async (route) => {
      const item = route.request().postDataJSON();
      if (!held && item.method === "eth_call" && item.params[0].data?.startsWith(selector)) { held = true; started.resolve(); await release.promise; }
      await route.fallback();
    });
    await page.getByRole("button", { name: "Create Work", exact: true }).click();
    await page.getByRole("button", { name: "Confirm Local Transaction", exact: true }).click(); await started.promise;
    await select.selectOption(config.accounts[1]); await connect();
    await select.selectOption(config.accounts[0]); await connect();
    await page.getByText("Ready to Create", { exact: true }).waitFor();
    const enabled = await page.getByRole("button", { name: "Create Work", exact: true }).isEnabled();
    assert.equal(enabled, baseline, "Pending preflight must retain its submission lock");
    release.resolve();
    if (baseline) { await page.waitForURL(/\/local-evm\/works\/[0-9]+$/); assert.equal(sends.length, 1); }
    else { await page.getByRole("alert").filter({ hasText: "Wallet Disconnected" }).waitFor(); assert.equal(sends.length, 0); assert.ok(page.url().endsWith("/new")); }
    evidence.results.push({ case: "A-B-A wallet change invalidates approved preflight", reproduced: baseline, sends: sends.length, extraDialogWasEnabled: enabled });
    await context.close();
  }
  if (!baseline) {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.route("**/local-evm/config", (route) => route.fulfill({ json: { ...config, samples: [] } }));
    await page.goto(`${base}/local-evm/works/new`);
    await page.getByRole("combobox", { name: "Unlocked local development account", exact: true }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Local registered file hash", exact: true }).inputValue(), "");
    assert.equal(await page.getByText(/Local RPC Offline/).count(), 0);
    evidence.results.push({ case: "valid deployment without sample fixtures", passed: true }); await context.close();
  }
  await mkdir(".local-evm/review", { recursive: true });
  await writeFile(`.local-evm/review/browser-${baseline ? "before" : "after"}.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await browser.close(); }
