// Actual transactions execute only on isolated Hardhat 31337 using unlocked
// development accounts. No MetaMask or public-chain write endpoint exists here.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { createPublicClient, http, defineChain, encodeFunctionData } from "viem";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = "http://127.0.0.1:3002";
const config = JSON.parse(await readFile(".local-evm/deployment.json", "utf8"));
const artifacts = JSON.parse(await readFile(".local-evm/artifacts.json", "utf8"));
const abi = artifacts.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry.abi;
const chain = defineChain({ id: 31337, name: "Local", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } });
const client = createPublicClient({ chain, transport: http("http://127.0.0.1:8545", { retryCount: 0 }) });
assert.equal(await client.getChainId(), 31337);
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await context.newPage();
const errors = []; const writes = [];
page.on("pageerror", (error) => errors.push(error.message));
await context.route("https://rpc.botchain.ai/**", async (route) => {
  const item = route.request().postDataJSON();
  assert.ok(["eth_chainId", "eth_call", "eth_getLogs", "eth_blockNumber", "eth_getBlockByNumber"].includes(item.method), "Public RPC is read-only in tests");
  await route.continue();
});
await context.route("http://127.0.0.1:8545/**", async (route) => {
  const item = route.request().postDataJSON();
  if (item.method === "eth_sendTransaction") writes.push(item.params[0]);
  await route.continue();
});
async function connect() { await page.getByRole("button", { name: "Connect Local Test Wallet", exact: true }).click(); await page.getByText("Local Test Wallet Connected", { exact: true }).waitFor(); }
async function confirm() { await page.getByRole("dialog", { name: "Local wallet transaction confirmation" }).waitFor(); await page.getByRole("button", { name: "Confirm Local Transaction", exact: true }).click(); }
await mkdir(".local-evm/qa", { recursive: true });
try {
  await page.goto(`${base}/local-evm/works/new`);
  await page.getByRole("combobox", { name: "Unlocked local development account", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => Boolean(window.ethereum)), false);
  await connect();
  await page.getByText("Ready to Create", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Create Work", exact: true }).click();
  await page.getByRole("button", { name: "Reject Local Transaction", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Transaction Rejected. Nothing was sent." }).waitFor();
  assert.equal(writes.length, 0);
  await page.getByRole("button", { name: "Create Work", exact: true }).click();
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  await page.route("http://127.0.0.1:8545/**", async (route) => {
    const item = route.request().postDataJSON();
    if (item.method === "eth_getTransactionReceipt") await hold;
    await route.fallback();
  });
  await page.evaluate(() => { const element = [...document.querySelectorAll("button")].find((button) => button.textContent === "Confirm Local Transaction"); element.click(); element.click(); });
  await page.getByText("Waiting for Receipt", { exact: true }).waitFor();
  assert.ok(page.url().endsWith("/new"), "No success navigation before receipt");
  assert.equal(writes.length, 1, "Same-tick confirmation cannot double-submit");
  release();
  await page.waitForURL(/\/local-evm\/works\/[1-9][0-9]*$/);
  await page.unroute("http://127.0.0.1:8545/**");
  const workUrl = page.url(); const workId = BigInt(workUrl.split("/").at(-1));
  await page.getByRole("heading", { name: "Local Version 1", exact: true }).waitFor();
  assert.equal((await client.readContract({ address: config.registry, abi, functionName: "getWork", args: [workId] })).versionCount, BigInt(1));
  await connect();
  for (const index of [1, 2]) {
    await page.getByRole("combobox", { name: "Prepared local files", exact: true }).selectOption(config.samples[index].hash);
    await page.getByText("Ready to Add Version", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Add Version", exact: true }).click(); await confirm();
    await page.getByRole("heading", { name: `Local Version ${index + 1}`, exact: true }).waitFor();
  }
  assert.equal(await page.getByTestId("local-version").count(), 3);
  assert.equal(await page.getByTestId("local-version-count").innerText(), "3");
  const stored = await client.readContract({ address: config.registry, abi, functionName: "getVersion", args: [workId, BigInt(3)] });
  assert.equal(stored.fileHash, config.samples[2].hash); assert.equal(stored.previousVersionNumber, BigInt(2));
  assert.equal(await page.locator('a[href*="scan.botchain.ai/tx"]').count(), 0);
  assert.equal(await page.locator('a[href^="/proof/"]').count(), 0, "Local versions must not masquerade as mainnet certificates");
  console.log("PASS: real local atomic creation, explicit rejection, receipt gating, duplicate-submit lock, V2/V3 append and contract state matching");

  await page.getByText("Duplicate Hash", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Add Version", exact: true }).isDisabled(), true);
  await page.getByRole("combobox", { name: "Prepared local files", exact: true }).selectOption(config.samples[3].hash);
  await page.getByText("Unauthorized Wallet", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Local registered file hash", exact: true }).fill(`0x${"f".repeat(64)}`);
  await page.getByText("Original Proof Not Found", { exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Unlocked local development account", exact: true }).selectOption(config.accounts[1]);
  await connect();
  await page.getByRole("combobox", { name: "Prepared local files", exact: true }).selectOption(config.samples[3].hash);
  await page.getByText("Unauthorized Wallet", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Local Version 3", exact: true }).waitFor();
  const fresh = await browser.newContext(); const freshPage = await fresh.newPage();
  await freshPage.goto(workUrl); await freshPage.getByRole("heading", { name: "Local Version 3", exact: true }).waitFor();
  assert.equal(await freshPage.getByTestId("local-version").count(), 3); await fresh.close();
  await page.goto(`${base}/local-evm/works`); await connect();
  await page.getByText("Scan Complete", { exact: true }).waitFor();
  assert.ok(await page.getByRole("link", { name: `Local Work ${workId}`, exact: true }).isVisible());
  await page.getByRole("combobox", { name: "Unlocked local development account", exact: true }).selectOption(config.accounts[1]);
  assert.equal(await page.getByRole("link", { name: `Local Work ${workId}`, exact: true }).count(), 0);
  await connect(); await page.getByText("Scan Complete", { exact: true }).waitFor();
  await page.getByText("No local works found for this wallet in the completed scan.", { exact: true }).waitFor();
  let releaseOldLogs, oldLogsStarted;
  const delayedLogs = new Promise((resolve) => { releaseOldLogs = resolve; });
  const started = new Promise((resolve) => { oldLogsStarted = resolve; });
  await page.route("http://127.0.0.1:8545/**", async (route) => {
    const item = route.request().postDataJSON();
    if (item.method === "eth_getLogs" && item.params[0].topics[2]?.toLowerCase() === `0x${config.accounts[0].slice(2).padStart(64, "0")}`) { oldLogsStarted(); await delayedLogs; }
    await route.fallback();
  });
  await page.goto(`${base}/local-evm/works`); await connect(); await started;
  await page.getByRole("combobox", { name: "Unlocked local development account", exact: true }).selectOption(config.accounts[1]);
  await connect(); await page.getByText("No local works found for this wallet in the completed scan.", { exact: true }).waitFor();
  releaseOldLogs(); await page.waitForTimeout(200);
  assert.equal(await page.getByRole("link", { name: `Local Work ${workId}`, exact: true }).count(), 0, "Late old-account logs cannot replace new-account data");
  await page.unroute("http://127.0.0.1:8545/**");
  console.log("PASS: permissions, duplicate/missing proof, account switch clears previous scan, refresh and fresh-browser chain reconstruction");

  // A fault-injected transaction really reverts in the local EVM; do not mock a receipt.
  await page.goto(`${base}/local-evm/works/new`); await connect();
  await page.getByText("Ready to Create", { exact: true }).waitFor();
  await page.route("http://127.0.0.1:8545/**", async (route) => {
    const item = route.request().postDataJSON();
    if (item.method !== "eth_sendTransaction") return route.fallback();
    item.params[0].data = encodeFunctionData({ abi, functionName: "createWork", args: [`0x${"f".repeat(64)}`] });
    item.params[0].gas = "0x7a120";
    const response = await fetch("http://127.0.0.1:8545", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    await route.fulfill({ contentType: "application/json", body: await response.text() });
  });
  await page.getByRole("button", { name: "Create Work", exact: true }).click(); await confirm();
  await page.getByRole("alert").filter({ hasText: "Transaction Reverted" }).waitFor();
  assert.ok(page.url().endsWith("/new"));
  await page.unroute("http://127.0.0.1:8545/**");
  console.log("PASS: actual mined local revert never displays creation success");

  await page.goto(workUrl);
  await page.getByRole("heading", { name: "Local Version 3", exact: true }).waitFor();
  for (const width of [320, 375, 768, 1440]) { await page.setViewportSize({ width, height: 950 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px local timeline overflow`); }
  await page.screenshot({ path: ".local-evm/qa/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 }); await page.screenshot({ path: ".local-evm/qa/mobile.png", fullPage: true });
  await page.route("http://127.0.0.1:8545/**", (route) => route.abort());
  await page.getByRole("button", { name: "Retry / Refresh Local Data", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Local RPC Offline" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Add Version", exact: true }).count(), 0);
  await page.unroute("http://127.0.0.1:8545/**");
  await page.getByRole("button", { name: "Retry / Refresh Local Data", exact: true }).click();
  await page.getByRole("heading", { name: "Local Version 3", exact: true }).waitFor();
  await page.route("http://127.0.0.1:8545/**", async (route) => {
    const item = route.request().postDataJSON();
    if (item.method === "eth_chainId") await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: item.id, result: "0x2a5" }) });
    else await route.fallback();
  });
  await page.getByRole("button", { name: "Retry / Refresh Local Data", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Wrong Local Network" }).waitFor();
  await page.unroute("http://127.0.0.1:8545/**");
  await page.route("http://127.0.0.1:8545/**", async (route) => {
    const item = route.request().postDataJSON();
    if (item.method === "eth_getCode") await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: item.id, result: "0x" }) });
    else await route.fallback();
  });
  await page.getByRole("button", { name: "Retry / Refresh Local Data", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Contract Not Deployed" }).waitFor();
  await page.unroute("http://127.0.0.1:8545/**");
  await page.goto(`${base}/local-evm/works/999999`);
  await page.getByRole("alert").filter({ hasText: "Work Not Found" }).waitFor();
  // Existing public mainnet certificate remains separate, read only and wallet-free.
  await page.goto(`${base}/proof/0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625`);
  await page.getByText("REGISTERED ON BOT CHAIN MAINNET", { exact: true }).waitFor({ timeout: 45000 });
  assert.deepEqual(errors, []);
  console.log("PASS: loopback-only writes, mobile, local RPC outage/wrong-chain rejection, missing work, and unchanged real mainnet certificate");
} finally { await context.close(); await browser.close(); }
