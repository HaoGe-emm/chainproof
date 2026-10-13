import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.CHAINPROOF_TEST_URL || "http://localhost:3003";
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  const response = await page.request.get(`${base}/local-evm/config`);
  assert.equal(response.status(), 404);
  const requests = [];
  page.on("request", (request) => { if (request.url().startsWith("http://127.0.0.1:8545")) requests.push(request.url()); });
  for (const suffix of ["?CHAINPROOF_LOCAL_EVM=1&NODE_ENV=development&NEXT_PUBLIC_LOCAL_EVM=1", "?chainId=31337&rpcUrl=http%3A%2F%2F127.0.0.1%3A8545"]) {
    const attempted = await page.request.get(`${base}/local-evm/config${suffix}`, { headers: { Origin: "http://127.0.0.1:3002", "X-Forwarded-Host": "localhost", "X-Chainproof-Local-Evm": "1" } });
    assert.equal(attempted.status(), 404, "Client-controlled parameters cannot enable production config");
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const attempted = await page.request.fetch(`${base}/local-evm/config`, { method, data: { jsonrpc: "2.0", id: 1, method: "eth_sendTransaction", params: [] } });
    assert.equal(attempted.status(), 405, `${method} is not a transaction proxy`);
  }
  for (const path of ["/local-evm/works", "/local-evm/works/new", "/local-evm/works/1"]) {
    await page.goto(`${base}${path}`);
    await page.getByRole("heading", { name: "Local EVM development disabled", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm Local Transaction", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Create Work", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Connect Local Test Wallet", exact: true }).count(), 0);
  }
  assert.deepEqual(requests, [], "Disabled production routes must not contact local RPC");
  console.log("PASS: production config404; spoofed client parameters404; write methods405; all local routes have no wallet/write controls or local RPC requests");
} finally { await browser.close(); }
