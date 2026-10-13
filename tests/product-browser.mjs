// All RPC and wallet calls in this suite are isolated test fixtures. No real
// wallet, signing key, or mainnet write endpoint is available to these tests.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, encodeFunctionResult, parseAbi } from "viem";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.CHAINPROOF_TEST_URL || "http://localhost:3001";
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
const owner = "0x0000000000000000000000000000000000000002";
const other = "0x0000000000000000000000000000000000000003";
const contract = "0xc64cef65ccd720664cc3bfd7d970b6f866e53052";
const hash = `0x${createHash("sha256").update("ChainProof isolated product test").digest("hex")}`;
const transaction = `0x${"b".repeat(64)}`;
const genesis = `0x${"1".repeat(64)}`;
const abi = parseAbi(["function getProof(bytes32 fileHash) view returns (address owner, uint256 timestamp, bool exists)", "event ProofRegistered(bytes32 indexed fileHash, address indexed owner, uint256 timestamp)"]);
const file = { name: "product-test.txt", mimeType: "text/plain", buffer: Buffer.from("ChainProof isolated product test") };
const log = { address: contract, data: encodeAbiParameters([{ type: "uint256" }], [BigInt(1700000000)]), topics: encodeEventTopics({ abi, eventName: "ProofRegistered", args: { fileHash: hash, owner } }), blockNumber: "0x18b8b8b", blockHash: genesis, logIndex: "0x0", transactionIndex: "0x0", transactionHash: transaction, removed: false };
const block = { hash: genesis, number: "0x0", parentHash: genesis, nonce: "0x0000000000000000", sha3Uncles: genesis, logsBloom: `0x${"0".repeat(512)}`, transactionsRoot: genesis, stateRoot: genesis, receiptsRoot: genesis, miner: owner, difficulty: "0x0", totalDifficulty: "0x0", extraData: "0x", size: "0x1", gasLimit: "0x1c9c380", gasUsed: "0x0", timestamp: "0x6553f100", transactions: [], uncles: [] };
const receipt = { transactionHash: transaction, transactionIndex: "0x0", blockHash: genesis, blockNumber: "0x18b8b8b", from: owner, to: contract, cumulativeGasUsed: "0x100", gasUsed: "0x100", effectiveGasPrice: "0x1", contractAddress: null, logsBloom: block.logsBloom, type: "0x0", status: "0x1", logs: [log] };

async function environment(initial = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const state = { proof: "absent", receipt: "success", logMode: "empty", logCalls: 0, ...initial };
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(({ owner, genesis, wallet, blockStorage, contract, expectedData }) => {
    if (blockStorage) Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Test storage disabled"); } });
    const listeners = new Map();
    const settings = { accounts: [owner], network: "0x2a5", sends: 0, requests: [], ...wallet };
    window.testWallet = settings;
    window.changeWallet = (accounts) => { settings.accounts = accounts; listeners.get("accountsChanged")?.(accounts); };
    window.disconnectWallet = () => { settings.accounts = []; listeners.get("disconnect")?.({ code: 4900 }); };
    window.ethereum = {
      isMetaMask: true,
      on: (name, fn) => listeners.set(name, fn), removeListener: (name) => listeners.delete(name),
      request: async ({ method, params }) => {
        settings.requests.push({ method, params });
        if (method === "eth_accounts") return settings.accounts;
        if (method === "eth_requestAccounts") { if (settings.rejectConnect) throw { code: 4001 }; return settings.accounts; }
        if (method === "eth_chainId") return settings.network;
        if (method === "wallet_switchEthereumChain") { if (settings.rejectNetwork) throw { code: 4001 }; if (settings.unknownNetwork && !settings.added) throw { code: 4902 }; if (params[0].chainId !== "0x2a5") throw new Error("Non-mainnet switch blocked"); settings.network = "0x2a5"; listeners.get("chainChanged")?.("0x2a5"); return null; }
        if (method === "wallet_addEthereumChain") { const network = params[0]; if (network.chainId !== "0x2a5" || network.rpcUrls[0] !== "https://rpc.botchain.ai" || network.blockExplorerUrls[0] !== "https://scan.botchain.ai" || network.nativeCurrency.symbol !== "BOT" || network.nativeCurrency.decimals !== 18) throw new Error("Incorrect mainnet addition"); settings.added = true; return null; }
        if (method === "eth_getBlockByNumber") return { hash: genesis };
        if (method === "eth_sendTransaction") { if (params[0].to.toLowerCase() !== contract || params[0].data !== expectedData) throw new Error("Wrong registerProof target/bytes32"); settings.sends += 1; if (settings.rejectTransaction) throw { code: 4001 }; return `0x${"b".repeat(64)}`; }
        throw new Error(`Unexpected test wallet method: ${method}`);
      },
    };
  }, { owner, genesis, wallet: initial.wallet || {}, blockStorage: Boolean(initial.blockStorage), contract, expectedData: encodeFunctionData({ abi: parseAbi(["function registerProof(bytes32)"]), functionName: "registerProof", args: [hash] }) });
  await context.route("https://rpc.botchain.ai/**", async (route) => {
    const item = route.request().postDataJSON();
    let result;
    if (item.method === "eth_chainId") result = "0x2a5";
    else if (item.method === "eth_call") {
      if (state.holdLookup) await state.holdLookup;
      if (state.proof === "error") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: item.id, error: { code: -32000, message: "Fixture RPC unavailable" } }) });
      result = encodeFunctionResult({ abi, functionName: "getProof", result: state.proof === "registered" ? [owner, BigInt(1700000000), true] : ["0x0000000000000000000000000000000000000000", BigInt(0), false] });
    } else if (item.method === "eth_getBlockByNumber") result = block;
    else if (item.method === "eth_blockNumber") result = "0x18b8b91";
    else if (item.method === "eth_getTransactionReceipt") {
      if (state.holdReceipt) await state.holdReceipt;
      result = { ...receipt, status: state.receipt === "failed" ? "0x0" : "0x1", logs: state.receipt === "failed" ? [] : receipt.logs };
    } else if (item.method === "eth_getLogs") {
      state.logCalls += 1;
      if (state.logMode === "partial-error" && state.logCalls > 1) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: item.id, error: { code: -32000, message: "Historical fixture unavailable" } }) });
      const range = item.params[0];
      const owns = range.topics[2].toLowerCase() === `0x${owner.slice(2).padStart(64, "0")}`;
      result = owns && state.logMode !== "empty" && BigInt(range.fromBlock) <= BigInt(log.blockNumber) && BigInt(range.toBlock) >= BigInt(log.blockNumber) ? [log] : [];
    } else throw new Error(`Blocked non-read RPC method: ${item.method}`);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: item.id, result }) });
  });
  return { context, page, state, errors };
}
async function ready(page) {
  await page.goto(`${base}/register`);
  await page.locator("#file-input").setInputFiles(file);
  await page.getByText("Ready to Register", { exact: true }).waitFor();
}
async function close(env) { assert.deepEqual(env.errors, []); await env.context.close(); }
await mkdir(".next/product-qa", { recursive: true });
try {
  let env = await environment();
  await env.page.goto(base);
  assert.deepEqual(await env.page.evaluate(() => window.testWallet.requests.map(r => r.method).filter(m => !["eth_accounts", "eth_chainId"].includes(m))), [], "Initial visit cannot prompt, switch, sign or submit");
  assert.equal(await env.page.getByRole("navigation").getByRole("link").count(), 4);
  assert.equal(await env.page.getByRole("navigation").getByRole("link", { name: "Home", exact: true }).getAttribute("aria-current"), "page");
  for (const width of [320, 375, 768, 1440]) {
    await env.page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/register", "/verify", "/my-proofs", `/proof/${hash}`]) {
      await env.page.goto(`${base}${path}`);
      await env.page.getByRole("navigation").waitFor();
      assert.ok(await env.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}px: ${path}`);
    }
  }
  await env.page.goto(base);
  await env.page.screenshot({ path: ".next/product-qa/home.png", fullPage: true });
  await close(env);
  console.log("PASS: unified navigation and 320/375/768/1440px layouts");

  for (const mode of ["registered", "absent", "error"]) {
    env = await environment({ proof: mode });
    await env.page.goto(`${base}/verify`);
    await env.page.locator("#file-input").setInputFiles(file);
    await env.page.getByText(mode === "registered" ? "Registered Fingerprint Found" : mode === "absent" ? "No Matching Proof" : "Verification Error", { exact: true }).waitFor();
    if (mode === "error") {
      assert.equal(await env.page.getByText("No Matching Proof", { exact: true }).count(), 0);
      env.state.proof = "registered";
      await env.page.getByRole("button", { name: "Retry", exact: true }).click();
      await env.page.getByText("Registered Fingerprint Found", { exact: true }).waitFor();
    }
    await close(env);
  }
  env = await environment({ proof: "registered" });
  await env.page.goto(`${base}/register`);
  await env.page.locator("#file-input").setInputFiles(file);
  await env.page.getByText("Already Registered", { exact: true }).waitFor();
  assert.equal(await env.page.getByRole("button", { name: "Create Proof", exact: true }).isDisabled(), true);
  assert.equal(await env.page.evaluate(() => window.testWallet.sends), 0);
  await close(env);
  env = await environment({ proof: "error" });
  await env.page.goto(`${base}/register`);
  await env.page.locator("#file-input").setInputFiles(file);
  await env.page.getByText("Registration Check Error", { exact: true }).waitFor();
  assert.equal(await env.page.getByRole("button", { name: "Create Proof", exact: true }).isDisabled(), true);
  env.state.proof = "absent";
  await env.page.getByRole("button", { name: "Retry registration check" }).click();
  await env.page.getByText("Ready to Register", { exact: true }).waitFor();
  await close(env);
  console.log("PASS: Verify three outcomes and Retry; duplicate registration and preflight RPC error block submission");

  for (const [wallet, message] of [
    [{ rejectConnect: true }, "Wallet connection was declined."],
    [{ network: "0x1", rejectNetwork: true }, "Network switch was declined."],
    [{ rejectTransaction: true }, "Transaction was declined."],
  ]) {
    env = await environment({ wallet });
    await ready(env.page);
    await env.page.getByRole("button", { name: "Create Proof", exact: true }).click();
    await env.page.getByRole("alert").filter({ hasText: message }).waitFor();
    assert.equal(await env.page.getByRole("heading", { name: "Registration Included", exact: true }).count(), 0);
    await close(env);
  }
  for (const mode of ["success", "failed"]) {
    env = await environment({ receipt: mode });
    let release;
    env.state.holdReceipt = new Promise((resolve) => { release = resolve; });
    await ready(env.page);
    await env.page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent === "Create Proof");
      button.click(); button.click();
    });
    // Status text may also appear on the disabled button during the submitted phase.
    // The transaction card is identified by its explorer link; the exact hash is asserted below.
    await env.page.getByRole("link", { name: "View on BOTScan", exact: false }).waitFor();
    assert.equal(await env.page.getByRole("heading", { name: "Registration Included", exact: true }).count(), 0);
    assert.equal(await env.page.evaluate(() => window.testWallet.sends), 1);
    assert.equal(await env.page.getByRole("link", { name: "View on BOTScan", exact: false }).getAttribute("href"), `https://scan.botchain.ai/tx/${transaction}`);
    if (mode === "success") {
      // Resume the same submitted transaction after refresh; never request a second send.
      await env.page.reload();
      await env.page.getByText("Waiting for Receipt", { exact: true }).first().waitFor();
      await env.page.evaluate((address) => window.changeWallet([address]), other);
    }
    release();
    if (mode === "success") {
      await env.page.getByRole("heading", { name: "Registration Included", exact: true }).waitFor();
      assert.ok((await env.page.locator("main").innerText()).includes(owner));
      assert.equal(await env.page.evaluate(() => window.testWallet.sends), 0, "Refresh must not submit again");
    } else {
      await env.page.getByRole("alert").filter({ hasText: "Transaction failed on BOT Chain" }).waitFor();
      assert.equal(await env.page.getByRole("heading", { name: "Registration Included", exact: true }).count(), 0);
    }
    await close(env);
  }
  env = await environment();
  await ready(env.page);
  let releaseLookup;
  env.state.holdLookup = new Promise((resolve) => { releaseLookup = resolve; });
  await env.page.getByRole("button", { name: "Create Proof", exact: true }).click();
  await env.page.getByText("Checking Existing Proof", { exact: true }).first().waitFor();
  await env.page.evaluate((address) => window.changeWallet([address]), other);
  releaseLookup();
  await env.page.getByRole("alert").filter({ hasText: "Wallet or network changed" }).waitFor();
  assert.equal(await env.page.evaluate(() => window.testWallet.sends), 0);
  await close(env);
  console.log("PASS: wallet/network rejection, receipt success/failure, refresh recovery, and pre-send account switch guard");

  env = await environment({ wallet: { network: "0x1", unknownNetwork: true } });
  await ready(env.page);
  await env.page.getByRole("button", { name: "Create Proof", exact: true }).click();
  await env.page.getByRole("heading", { name: "Registration Included", exact: true }).waitFor();
  assert.equal(await env.page.evaluate(() => window.testWallet.added), true);
  assert.ok(await env.page.evaluate(() => window.testWallet.requests.filter(r => r.method === "wallet_switchEthereumChain").every(r => r.params[0].chainId === "0x2a5")));
  await env.page.getByText("A successful transaction receipt includes the requested registration. This is not a guarantee of chain finality.", { exact: true }).waitFor();
  await close(env);
  console.log("PASS: missing mainnet network addition uses677/correct RPC/explorer/BOT; mocked write has exact original contract and SHA-256 bytes32; receipt wording does not promise finality");

  env = await environment({ blockStorage: true });
  let releaseStorageReceipt;
  env.state.holdReceipt = new Promise((resolve) => { releaseStorageReceipt = resolve; });
  await ready(env.page);
  await env.page.getByRole("button", { name: "Create Proof", exact: true }).click();
  await env.page.getByText(/This browser cannot save recovery details/).waitFor();
  assert.equal(await env.page.getByText(/Refreshing resumes the receipt check/).count(), 0);
  releaseStorageReceipt();
  await env.page.getByRole("heading", { name: "Registration Included", exact: true }).waitFor();
  await close(env);
  console.log("PASS: disabled session storage has an accurate recovery warning and does not break receipt tracking");

  env = await environment({ logMode: "partial-error" });
  await env.page.goto(`${base}/my-proofs`);
  await env.page.getByRole("heading", { name: "Scan Failed", exact: true }).waitFor();
  await env.page.getByText("1 PROOF FOUND SO FAR", { exact: true }).waitFor();
  assert.equal(await env.page.getByText("No proofs found for this wallet in the confirmed history of this contract.", { exact: true }).count(), 0);
  await env.page.evaluate(() => window.disconnectWallet());
  await env.page.getByText("Connect Wallet to view your proofs.", { exact: true }).waitFor();
  assert.equal(await env.page.getByRole("link", { name: "View Certificate", exact: true }).count(), 0);
  await close(env);
  console.log("PASS: partial historical failures remain partial; disconnect immediately clears wallet records");
} finally { await browser.close(); }
