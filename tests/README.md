# ChainProof tests

Run `npm test` for offline tests using Node.js 22.18+ or Node.js 24 (native TypeScript support). Tests cover certificate validation and read states, local SHA-256 matching, file read errors, QR decoding, historical log ranges and retry behavior, and cancellation during rapid wallet changes.

`npm run lint` runs the project's TypeScript check. `npm run build` checks the production build.

For the optional browser regression check, start the production preview on port 3001 with `npm run start -- --port 3001`, then run `node tests/certificate-browser.mjs` with Playwright available. `PLAYWRIGHT_MODULE` can point to an existing Playwright installation; `CHAINPROOF_BROWSER_CHANNEL=msedge` uses an installed Edge browser. `CHAINPROOF_TEST_URL` can change the local preview URL.

The browser check first reads a real mainnet proof with no wallet. Later error, file, and account-switch scenarios use RPC test fixtures. No test submits transactions. Screenshots and a sample one-page certificate PDF are written under the ignored `.next/certificate-qa` directory.

`node tests/product-browser.mjs` adds isolated product regression scenarios: navigation and 320–1440px layouts, Verify results and Retry, registration rejection and duplicate blocking, successful and failed receipts, refresh recovery, account changes, wallet disconnects, and partial history errors. Its wallet is a JavaScript test provider, not MetaMask; all network RPC requests are intercepted and write methods are rejected. Synthetic transaction hashes and registrations in these scenarios are test fixtures, never reported as mainnet activity.

The real-certificate check also chooses `docs/demo-mismatch.txt` locally and verifies MISMATCH against the actual mainnet certificate. It does not claim to have the original registered file or to demonstrate its MATCH.

## Stage 4A Version History

Stage5A release gate: the prototype requires **development** mode and `CHAINPROOF_VERSION_PROTOTYPE=1`. Run `tests/version-history-browser.mjs` only against an explicitly enabled development server, not a production preview. Production `/works`, `/works/new` and `/works/[workId]` display an unavailable message even if flags are enabled. `tests/release-production-browser.mjs` verifies direct URLs, reload, poisoned browser storage, no RPC or wallet permission requests and no simulated Work records.

`npm test` also checks the isolated local work/version model, append order, old versus association times, foreign wallet and duplicate rejection, reproducible demo bytes, storage tampering, source isolation and unchanged certificate paths. These model tests do not test an executable V2 contract; no Solidity or EVM framework is added in 4A.

With the same local preview and Playwright environment, run `node tests/version-history-browser.mjs`. It first performs a real read-only lookup of the existing single-file mainnet proof and opens its unchanged certificate. Later absent/error/race scenarios use intercepted test fixtures. Work creation and appends are always local demo operations; there is no signer or signing request. Screenshots go under ignored `.next/version-qa`. The suite covers no-wallet access, timeline actions, full-hash copy, local byte comparison without a mainnet MATCH claim, stale lookups, reload, device-local availability, invalid/disabled storage and 320–1440px layouts. Read RPC methods are restricted to `eth_chainId` and `eth_call`.

## Stage 4B actual local contracts

`npm run test:contracts:local` compiles Solidity 0.8.20 and executes original/V2 contracts in an isolated in-process Hardhat EDR network, including adversarial fixtures and deterministic invariant tests. It has no HTTP/public RPC target, no fork and no real wallet keys. `npm test` includes separate local manifest/origin safety tests. Native EDR dependency access may require Windows sandbox approval.

Start `npm run dev:version:local`, then run `node tests/local-version-browser.mjs` with Playwright available as above. This suite actually mines local transactions at fixed 127.0.0.1:8545, chain 31337, through a reviewed local developer wallet confirmation UI; it is not a JavaScript mock work store. It tests create/append/receipt gating, permission and duplicate failures, account switch, fresh-browser chain restoration, RPC outage/wrong network, mobile layout and original mainnet certificate read-only compatibility. No public transaction or real MetaMask signature is sent. Fault responses are intercepted only to test failure handling. Artifacts/screenshots are in ignored `.local-evm`. See `docs/version-history-local-testing.md` for stop/reset and production gating.
