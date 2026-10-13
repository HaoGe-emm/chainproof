# ChainProof 4C-2 — MetaMask local integration

Date: 2026-10-13. Branch: `feature/chainproof-v2`. Original implementation report; subsequent human feedback and read-only on-chain evidence confirm Work 6 and two versions. The [closeout report](metamask-local-state-fixes.md) supersedes the earlier no-backup/startup guidance: 31338 now has an independent signed-history archive and verified replay, while continuous disk persistence and native state import remain unavailable.

## Architecture and network separation

| Source | Chain / endpoint | State and purpose |
| --- | --- | --- |
| Existing BOT Chain Mainnet | 677 / rpc.botchain.ai | Original published file proofs; original contract/config/ABI unchanged |
| Original Hardhat local | 31337 / 127.0.0.1:8545 | Protected 6 Work / 16 Version archive and recovery mechanism unchanged |
| MetaMask Local Test | 31338 / 127.0.0.1:18547 | New EDR instance and new local deployments, separate `.metamask-local/` files |

The original 31337 endpoint was unavailable when inspected (connection refused). The required archive and checksum validated, including six works and sixteen versions through block 25. No restoration/restart was attempted. Since the old process is unavailable, this review cannot prove whether additional unbacked transactions happened before it stopped; the confirmed protection covers the saved archive only.

`tools/metamask-local/start.mjs` owns a fresh loopback EDR and Next dev on port 3006. Its deployment uses development account index 3, so the fresh addresses differ from the original 31337 deployment. It calls pinned solc 0.8.20 without invoking the old setup/saveArtifacts/recovery code. A developer-owned sample Work 1 has three actual local versions; these are not the user's MetaMask registrations. Matching numeric IDs in different networks do not identify the same Work.

The observed deployment is original `0x057ef64e23666f000b34ae31332854acbd1c8544`, V2 `0x261d8c5e9742e6f7f1076fa1f560894524e19cad`. Future session metadata is authoritative: genesis/deployment hashes change on fresh startup even if addresses repeat.

## EIP-1193 provider and authorization

Existing `getMetaMask` selection is reused, while a separate `LocalWalletSession` avoids the old mainnet connector's network-switch behavior. It checks API shape, subscribes to accountsChanged/chainChanged/disconnect, passively reads eth_accounts/eth_chainId, and requests eth_requestAccounts only on Connect. The UI displays the address authorized to the website; it cannot inspect an unshared globally selected account. A separate button triggers switch/add for 0x7a6a; no automatic network switch occurs.

Session revisions invalidate initial snapshots, late connections and A-B-A preflights. Removed/unmounted sessions do not request new authorization. The MetaMask brand flag is not authenticated identity: injected-provider integrity still depends on a trusted browser and extension. See the [EIP-1193 specification](https://eips.ethereum.org/EIPS/eip-1193) and [MetaMask provider reference](https://docs.metamask.io/wallet/reference/provider-api/).

## Contract reads and writes

The public reader is fixed to 31338/18547. Manifest validation rejects 677, 31337, public endpoints, mainnet addresses and the legacy local addresses. Runtime checks chainId, code presence/hashes, genesis/deployment block hashes and immutable original binding. The generated V2 ABI is reused; old registerProof/getProof interfaces are separately included. Canonical reads cross-check proof owner/time, predecessor and membership.

For each register/create/add click: capture authorized owner and revision, check wallet network, verify deployment, simulate, then recheck before the extension send request. Wallet genesis/deployment blocks must match the public reader configuration. The final EIP request requires exact from/to/calldata and includes chainId 0x7a6a. viem uses custom(EIP-1193), never an HTTP unlocked-account wallet for user operations.

The dedicated RPC does not expose eth_sendTransaction, eth_sign, personal_sign, reset, impersonation or storage administration. It accepts valid signed raw transactions only for 31338. Internal deployment/seed operations use the owned development provider; they do not create a work for a user. The optional funding CLI signs with the publicly known Hardhat development fixture, only after explicit target confirmation; it never accesses MetaMask keys. No signing/funding API exists in Next.

## Transaction lifecycle and recovery

Synchronous ref locking prevents duplicate clicks. Awaiting Wallet Confirmation precedes an extension request; submitted/pending phases display the actual local hash and captured owner. Successful receipts are checked against actual transaction from/to/input/chain/value and exact contract event fields. Reverts or a replaced/cancelled operation do not show success. Repricing records the replacement hash/reason and checks its actual data before accepting it.

Known pending hashes are saved as public sessionStorage metadata, scoped by genesis and registry, and can resume reads after refresh. Metadata validation rejects other networks/sessions and oversized numeric IDs. Receipts are also re-bound to that configuration before querying, including in-memory state.

If the extension request may have broadcast but returned no usable hash, the UI enters Submission Uncertain, keeps submissions locked and saves only the captured public intent. The user can copy the local transaction hash from MetaMask activity into Track MetaMask Transaction; this performs reads only. Unknown submission is not labelled rejected or reverted. Storage denial is disclosed; it cannot provide cross-refresh protection when metadata cannot be saved. The user must retain/check the wallet activity hash in that case.

Histories do not depend on browser storage: discovery uses indexed controller, deployment-bound 500-block ranges, adaptive retries and partial-result labels. Details load ten versions per page. Registration and association times remain distinct local contract facts. No local record gets a mainnet certificate or BOTScan transaction link.

## Production and old-product boundaries

Page and config API require NODE_ENV development plus CHAINPROOF_METAMASK_LOCAL=1; config additionally requires exact loopback host. Production config GET404, write methods405, and the page renders a disabled notice without wallet controls or RPC requests. URL/NEXT_PUBLIC parameters cannot bypass the server checks. Next's config API returns public metadata only.

`.next-metamask-local` is a separate dev output directory. The mainnet wallet control is suppressed only on the MetaMask local path; its footer is labelled local. Other routes preserve original rendering and business code. Original 31337 pages/config/recovery scripts and both Solidity sources remain unchanged.

## Tests and remaining boundaries

Mock provider tests, actual isolated EVM tests with ephemeral Node signers, and actual MetaMask extension tests are separate categories. Automated tests demonstrate the first two. The extension installation/authorization/signature dialogs have not been operated or accepted on behalf of the user.

All development balances are simulated. The dedicated node remains temporary memory state; --fresh explicitly starts a new 31338 session and retains old metadata files, not a complete chain backup. Chain 31337 backups remain separate. Public-chain V2 deployment, wallet recovery/collaboration, public finality/reorg policy, third-party audit and BOT opcode compatibility remain outside this stage.

Loopback/CORS and method filtering reduce exposed capability but are not authentication. Any local client with a signing key can submit on this local network; public default development keys must never hold real assets. A malicious browser/extension/RPC can misrepresent data; fingerprints and interface probes alone do not prove the dependency's honesty. Wallet ownership proves registration authority, not copyright, identity, originality or file creation time.
