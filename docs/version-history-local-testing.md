# Version History local EVM testing

## Requirements / installation

Windows or another Node-supported desktop, Node 24 recommended (Hardhat 3 + native Node test TypeScript), available 127.0.0.1 ports 8545 and 3002. Existing project uses pnpm lock/layout: run `pnpm install --frozen-lockfile`. A fresh npm-only checkout can install with `npm install`, but do not mix npm installation into an existing pnpm linked node_modules layout (npm Arborist failed here); npm run scripts work with either installed layout. Only Hardhat 3.19.0 and pinned solc 0.8.20 were added as dev tools. esbuild's necessary install script is individually allowed by pnpm-workspace.yaml; no blanket script permission.

No real keys, seed phrases, signing requests, fork RPC or public deployment script is required. Do not fund Hardhat's well-known developer accounts. The node is memory-only and listens on loopback; never expose it publicly.

## One command

```
npm run dev:version:local
```

Starts its own Hardhat EVM 31337 on `http://127.0.0.1:8545`, compiles/deploys local original + V2, registers five known file hashes (first three for the same wallet, fourth for another wallet to test denial, fifth additional candidate), creates Work 1 with three versions, then starts Next dev on 127.0.0.1:3002 with the explicit local feature flag. Open:

- `http://127.0.0.1:3002/local-evm/works`
- `http://127.0.0.1:3002/local-evm/works/new`
- `http://127.0.0.1:3002/local-evm/works/1`

The launcher does not automatically open a GUI browser. It fails if ports are occupied instead of killing another service. Local Next cache is `.next-local-evm`, separate from `.next`; it preserves an existing 3000 product dev server. Ctrl+C stops only its child Next and EVM. If Next startup exits unsuccessfully, the launcher stops the EVM and reports failure.

## Separate commands

Terminal 1: `npm run dev:chain:local`.

Terminal 2: `npm run setup:chain:local`, then set `$env:CHAINPROOF_LOCAL_EVM = '1'` in PowerShell and run `npm run dev -- --hostname 127.0.0.1 --port 3002`.

`npm run compile:chain:local` regenerates ABI/artifacts without deployment. `npm run setup:chain:local` deploys **new local copies** each time; it never overwrites/delete old records in a running chain. Its new registry starts with Work 1 and replaces only generated local manifest. To reset, stop/restart your own memory EVM, then setup again. No reset/clean command touches Git or user files.

## Addresses / generated data

On a fresh node, original local registry: `0x5fbdb2315678afecb367f032d93f642f64180aa3`; local V2: `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`. These are **not BOT mainnet addresses**. Repeated setup on an existing node allocates different addresses; source of truth is ignored `.local-evm/deployment.json`. It stores public addresses, hashes, deployment locator/code hashes and sample names, no keys. `.local-evm/files/local-version-1.txt` through `local-version-5.txt` are reproducible sample files. Artifacts, gas.json and QA images are also ignored local output.

Public account 1: `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`; account 2: `0x70997970c51812dc3a010c7d01b50e0d17dc79c8`. Select these in the page's **Connect Local Test Wallet** control. The custom local wallet sends via unlocked RPC only after a **Confirm Local Transaction** dialog; there is no MetaMask use, signature relay, key import or network switch. The original header wallet still belongs to the mainnet product; it is not used for local transactions. This developer wallet is not intended as production wallet infrastructure.

## Manual acceptance

1. Open local Work 1 without a wallet. Read three actual local versions; compare distinct Original Registration Time and Version Association Time and predecessors 0/1/2.
2. Open new work, select account 1 and connect local wallet. Prepared local-version-1 -> Ready to Create -> Create Work -> review loopback chain/address -> Confirm Local Transaction. Only successful expected event receipt opens the new actual work ID.
3. Reconnect local wallet on detail (account selection is deliberately not persisted across route mounts), choose local-version-2 -> Add Version -> confirm. Repeat for local-version-3. Reload or open the detail in a fresh browser; count/history recover from contracts, not localStorage.
4. Try duplicate hash, account-2-owned file with account 1, account 2 on account 1's work, and unknown bytes32 hash. Each fails permission/existence checks without a sent transaction; Solidity independently enforces these rules if frontend checks are bypassed.
5. Reject confirmation and rapidly click Confirm twice; rejection sends nothing and double click sends once. A previously submitted pending transaction cannot be re-submitted while its receipt is unresolved. Retry Local Receipt only reads. If you refresh while pending, page progress is lost; inspect actual public local Work/events after mining, not fabricated success. No automatic resend on mount.
6. List local works, change account, reconnect: prior IDs clear immediately. Scan errors show failed/partial results, never a false empty list. Stop the node to observe Local RPC Offline; restart/setup then Retry reloads the fresh source. Do not stop unrelated processes.
7. Local timeline offers no false BOTScan or mainnet certificate links. `/works` remains a labeled mock prototype; original mainnet `/register`, `/verify`, `/my-proofs`, `/proof/[hash]` retain 677 and original address. Existing public certificate can be read without wallet.
8. `npm run build` + a normal `npm run start` disables the local route and returns 404 for config, even if the local flag is present. Only an explicitly flagged development server on loopback enables local writes.

## Tests / stop

`npm test`; `npm run lint` (TypeScript); `npm run build`; `npm run test:contracts:local` (in-process isolated EDR, not the running UI EVM). Browser integration: with launcher running and Playwright available, run `node tests/local-version-browser.mjs`. Use `PLAYWRIGHT_MODULE` for an existing Playwright module and `CHAINPROOF_BROWSER_CHANNEL=msedge` for installed Edge. The browser performs genuine local transactions; only fault scenarios are intercepted, never reported as real mainnet relations. Existing product/certificate/prototype browser suites remain available as documented in tests/README.

Windows managed sandbox may require approval for EDR native dependency realpath, browser process or loopback listeners. Approve only the local named scripts, not a public deployment. No Slither/Foundry/Ganache or third-party audit was added; security review distinguishes testing from audit.
