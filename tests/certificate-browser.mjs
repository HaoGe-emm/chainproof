// Optional browser regression check. Start the app, then set PLAYWRIGHT_MODULE
// to an installed Playwright module path if it is not available in this project.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { encodeFunctionResult, parseAbi } from "viem";
import jsQR from "jsqr";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.CHAINPROOF_TEST_URL || "http://localhost:3001";
const owner = "0x89f415bb42e356e8b892c10b05522e0a8ef151f3";
const realHash = "0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625";
const abi = parseAbi(["function getProof(bytes32 fileHash) view returns (address owner, uint256 timestamp, bool exists)"]);
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
const methods = [];
async function readQrTarget(targetPage) {
  const qrImage = await targetPage.locator(".certificate-qr").evaluate(async (image) => {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return { width: canvas.width, height: canvas.height, data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  });
  return jsQR(new Uint8ClampedArray(qrImage.data), qrImage.width, qrImage.height)?.data;
}
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (request.url() === "https://rpc.botchain.ai/") {
    const body = request.postDataJSON();
    methods.push(...(Array.isArray(body) ? body : [body]).map((item) => item.method));
  }
});
await mkdir(".next/certificate-qa", { recursive: true });

try {
  // Real public mainnet read with no wallet injected, followed by print QA.
  await page.goto(`${base}/proof/${realHash}`);
  await page.getByText("REGISTERED ON BOT CHAIN MAINNET", { exact: true }).waitFor({ timeout: 45000 });
  assert.equal(await page.evaluate(() => Boolean(window.ethereum)), false);
  assert.equal(await page.getByRole("link", { name: "View Contract on BOTScan" }).count(), 1);
  await page.getByRole("img", { name: "QR code for this public certificate" }).waitFor();
  assert.equal(await readQrTarget(page), `${base}/proof/${realHash}`);
  await page.getByText("NOT CHECKED", { exact: true }).waitFor();
  assert.equal(await page.getByText("MATCH", { exact: true }).count(), 0);
  assert.equal(await page.locator(".certificate-public-link").getAttribute("href"), `${base}/proof/${realHash}`);
  assert.equal(await page.locator(".certificate-local-notice").isVisible(), true);
  assert.equal(await page.getByRole("group", { name: "Primary certificate actions" }).getByRole("button", { name: "Copy Certificate Link" }).count(), 1);
  assert.equal(await page.getByRole("group", { name: "Primary certificate actions" }).getByRole("link", { name: "Verify Your Copy" }).count(), 1);
  assert.equal(await page.getByRole("group", { name: "Secondary certificate actions" }).getByRole("button", { name: "Copy Fingerprint" }).count(), 1);
  await page.getByRole("button", { name: "Copy Wallet", exact: true }).click();
  await page.getByText("Wallet address copied.", { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).toLowerCase(), owner);
  await page.getByRole("button", { name: "Copy Fingerprint", exact: true }).click();
  await page.getByText("Fingerprint copied.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), realHash);
  await page.getByRole("button", { name: "Copy Certificate Link" }).click();
  await page.getByText("Certificate link copied.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/proof/${realHash}`);
  await page.locator("#certificate-file").setInputFiles("docs/demo-mismatch.txt");
  await page.getByText("MISMATCH", { exact: true }).waitFor();
  assert.equal(await page.getByText("REGISTERED ON BOT CHAIN MAINNET", { exact: true }).count(), 1);
  await page.screenshot({ path: ".next/certificate-qa/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile layout must not overflow");
  await page.screenshot({ path: ".next/certificate-qa/mobile.png", fullPage: true });
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), "light", "Print uses a light page canvas, not the screen's dark margins");
  assert.equal(await page.locator(".app-shell > header").isVisible(), false);
  assert.equal(await page.locator("#verify-your-copy").isVisible(), false);
  assert.equal(await page.getByRole("button", { name: "Copy Certificate Link" }).isVisible(), false);
  assert.equal(await page.locator(".certificate-qr").isVisible(), true);
  await page.pdf({ path: ".next/certificate-qa/certificate.pdf", preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 1280, height: 1100 });
  console.log("PASS: real mainnet public certificate and local demo MISMATCH, clipboard, mobile layout, and print visibility");

  // Browser-only synthetic RPC responses for testing file matching. These do not
  // claim that the test file was registered on mainnet and never submit a transaction.
  const testOwner = "0x0000000000000000000000000000000000000002";
  let mode = "registered";
  await page.route("https://rpc.botchain.ai/**", async (route) => {
    const item = route.request().postDataJSON();
    const result = item.method === "eth_chainId" ? "0x2a5" : encodeFunctionResult({
      abi, functionName: "getProof", result: mode === "absent"
        ? ["0x0000000000000000000000000000000000000000", BigInt(0), false]
        : [testOwner, BigInt(1700000000), true],
    });
    const body = mode === "error"
      ? { jsonrpc: "2.0", id: item.id, error: { code: -32000, message: "Simulated read failure" } }
      : { jsonrpc: "2.0", id: item.id, result };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  const hash = `0x${createHash("sha256").update("alpha").digest("hex")}`;
  await page.goto(`${base}/proof/${hash}`);
  await page.locator("#certificate-file").waitFor({ state: "attached" });
  await page.locator("#certificate-file").setInputFiles({ name: "original.txt", mimeType: "text/plain", buffer: Buffer.from("alpha") });
  await page.getByText("MATCH", { exact: true }).waitFor();
  assert.equal(await page.getByText("REGISTERED ON BOT CHAIN MAINNET", { exact: true }).count(), 1);
  assert.equal(await page.getByText("NOT CHECKED", { exact: true }).count(), 0);
  await page.locator("#certificate-file").setInputFiles({ name: "original.txt", mimeType: "text/plain", buffer: Buffer.from("alphb") });
  await page.getByText("MISMATCH", { exact: true }).waitFor();
  assert.equal(await page.getByText("REGISTERED ON BOT CHAIN MAINNET", { exact: true }).count(), 1);
  await page.evaluate(() => { File.prototype.arrayBuffer = async () => { throw new Error("Simulated file read failure"); }; });
  await page.locator("#certificate-file").setInputFiles({ name: "unreadable.txt", mimeType: "text/plain", buffer: Buffer.from("alpha") });
  await page.getByText("ERROR", { exact: true }).waitFor();
  mode = "error";
  await page.goto(`${base}/proof/${hash}`);
  await page.getByText("Verification Error", { exact: true }).waitFor({ timeout: 20000 });
  assert.equal(await page.locator("#certificate-file").count(), 0);
  assert.equal(await page.getByText("MATCH", { exact: true }).count(), 0);
  mode = "registered";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("REGISTERED ON BOT CHAIN MAINNET", { exact: true }).waitFor();
  mode = "absent";
  await page.goto(`${base}/proof/${hash}`);
  await page.getByText("Proof Not Found", { exact: true }).waitFor();
  assert.equal(await page.locator("#certificate-file").count(), 0);
  assert.equal(await page.getByText("MATCH", { exact: true }).count(), 0);
  await page.goto(`${base}/proof/invalid`);
  await page.getByText("Invalid Fingerprint", { exact: true }).waitFor();
  assert.equal(await page.locator("#certificate-file").count(), 0);
  console.log("PASS: browser-only test fixtures display MATCH/MISMATCH/ERROR; failed and absent lookups never display MATCH");

  // Serve this local build under virtual deployment origins. No deployment is performed.
  for (const origin of ["https://chainproof-git-feature-chainproof-v2-example.vercel.app", "https://chainproof-two.vercel.app"]) {
    const originContext = await browser.newContext({ viewport: { width: 375, height: 850 } });
    await originContext.route(`${origin}/**`, async (route) => {
      const requested = new URL(route.request().url());
      const response = await route.fetch({ url: `${base}${requested.pathname}${requested.search}` });
      await route.fulfill({ response });
    });
    await originContext.route("https://rpc.botchain.ai/**", async (route) => {
      const item = route.request().postDataJSON();
      const result = item.method === "eth_chainId" ? "0x2a5" : encodeFunctionResult({ abi, functionName: "getProof", result: [owner, BigInt(1791426243), true] });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: item.id, result }) });
    });
    const originPage = await originContext.newPage();
    await originPage.goto(`${origin}/proof/${realHash}`);
    await originPage.locator(".certificate-qr").waitFor();
    assert.equal(await readQrTarget(originPage), `${origin}/proof/${realHash}`);
    assert.equal(await originPage.locator(".certificate-public-link").getAttribute("href"), `${origin}/proof/${realHash}`);
    assert.equal(await originPage.locator(".certificate-local-notice").count(), 0);
    assert.ok(await originPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Long deployment URL must wrap on mobile");
    await originContext.close();
  }
  console.log("PASS: current-origin links and QR codes on simulated Vercel Preview and Production, including long mobile URLs");

  const walletContext = await browser.newContext();
  await walletContext.addInitScript(({ owner }) => {
    const listeners = new Map();
    window.ethereum = {
      isMetaMask: true,
      on: (name, callback) => listeners.set(name, callback),
      removeListener: (name) => listeners.delete(name),
      request: ({ method }) => {
        if (method === "eth_chainId") return Promise.resolve("0x2a5");
        if (method === "eth_accounts") return new Promise((resolve) => { window.finishAccountSnapshot = () => resolve([owner]); });
        throw new Error(`Unexpected wallet method: ${method}`);
      },
    };
    window.switchTestAccount = (address) => listeners.get("accountsChanged")([address]);
  }, { owner });
  const walletPage = await walletContext.newPage();
  const emptyWallet = "0x0000000000000000000000000000000000000001";
  let holdOldLogs = true;
  let releaseOldLogs;
  let signalOldLogs;
  const oldLogsStarted = new Promise((resolve) => { signalOldLogs = resolve; });
  await walletPage.route("https://rpc.botchain.ai/**", async (route) => {
    const item = route.request().postDataJSON();
    let result;
    if (item.method === "eth_chainId") result = "0x2a5";
    else if (item.method === "eth_blockNumber") result = `0x${(BigInt(25922443) + BigInt(6)).toString(16)}`;
    else if (item.method === "eth_getLogs") {
      const filter = item.params[0];
      const ownerTopic = `0x${owner.slice(2).padStart(64, "0")}`;
      if (filter.topics[2].toLowerCase() === ownerTopic && BigInt(filter.fromBlock) <= BigInt(25922443) && BigInt(filter.toBlock) >= BigInt(25922443)) {
        if (holdOldLogs) {
          signalOldLogs();
          await new Promise((resolve) => { releaseOldLogs = resolve; });
          holdOldLogs = false;
        }
        result = [{
          address: "0xc64cef65ccd720664cc3bfd7d970b6f866e53052",
          topics: ["0x6979dae16feac53541a63b91de904f762731ce0f18bdbc8d6a6b7b1a506bed14", realHash, ownerTopic],
          data: "0x000000000000000000000000000000000000000000000000000000006ac6fec3",
          blockNumber: "0x18b8b8b", logIndex: "0x4", transactionIndex: "0x0", removed: false,
          blockHash: `0x${"1".repeat(64)}`,
          transactionHash: "0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc",
        }];
      } else result = [];
    } else throw new Error(`Unexpected history RPC: ${item.method}`);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: item.id, result }) });
  });
  await walletPage.goto(`${base}/my-proofs`);
  await walletPage.waitForFunction(() => Boolean(window.finishAccountSnapshot));
  await walletPage.evaluate((address) => { window.switchTestAccount(address); window.finishAccountSnapshot(); }, emptyWallet);
  await walletPage.getByText("No proofs found for this wallet in the confirmed history of this contract.", { exact: true }).waitFor();
  assert.equal(await walletPage.getByRole("button", { name: "0x0000...0001", exact: true }).count(), 1);
  await walletPage.evaluate((address) => window.switchTestAccount(address), owner);
  await oldLogsStarted;
  await walletPage.evaluate((address) => window.switchTestAccount(address), emptyWallet);
  await walletPage.getByText("No proofs found for this wallet in the confirmed history of this contract.", { exact: true }).waitFor();
  releaseOldLogs();
  await walletPage.waitForTimeout(250);
  assert.equal(await walletPage.getByRole("link", { name: "View Certificate", exact: true }).count(), 0);
  await walletPage.evaluate((address) => window.switchTestAccount(address), owner);
  await walletPage.getByText("1 PROOF FOUND", { exact: true }).waitFor();
  assert.equal(await walletPage.getByRole("link", { name: "View Certificate", exact: true }).getAttribute("href"), `/proof/${realHash}`);
  await walletPage.getByRole("button", { name: "Copy Hash", exact: true }).click();
  await walletPage.getByRole("button", { name: "Copied", exact: true }).waitFor();
  await walletPage.getByRole("button", { name: "Copy Hash", exact: true }).waitFor({ timeout: 5000 });
  await walletContext.close();
  console.log("PASS: late initial wallet snapshot, rapid accountsChanged, delayed old logs, singular count, and transient copy feedback");
  assert.deepEqual(errors, []);
  assert.ok(methods.every((method) => ["eth_chainId", "eth_call"].includes(method)), "Certificate RPC must be read-only");
} finally {
  await browser.close();
}
