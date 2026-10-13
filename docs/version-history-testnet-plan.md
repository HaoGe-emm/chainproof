# Future BOT testnet validation plan — 4C-3

Date: 2026-10-13. **Plan only: no faucet claim, wallet signature, public deployment or public write performed.** Local MetaMask acceptance is already user-confirmed; public testing requires separate explicit approval.

## Environment identity and availability

Official [quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/) lists **Bohr Testnet, 968**, RPC `https://rpc.bohr.life`, explorer `https://scan.bohr.life`, native BOT. [Official faucet instructions](https://dev-docs.botchain.ai/docs/Developers/claim-test-tbot-tokens/) link `https://faucet.botchain.ai/basic/` and describe test tBOT allocation (10 per 24 hours). These are test assets, not real BOT funding.

Read checks on 2026-10-13:

- RPC returns **968**; genesis `0x395bd3d6583216495648e8322032761c1a377eddf04f59de0c693c7d6682aee6`.
- Client string `Geth/v1.5.13-f6e21988-20260822/linux-amd64/go1.27.1`; RPC latest height exceeded 26.6 million.
- BASEFEE/PUSH0/MCOPY/transient/BLOBBASEFEE probe calls succeeded. Exact fork activation schedule remains unknown; these probes do not certify the whole fork.
- Explorer stats/blocks APIs returned HTTP 200 and live blocks. Block **26697796** Hash `0x2019c03a468b46ecb66a5d296f2f825b721c0791f817df2dce6d7895fb8617c5` matches the RPC at that exact height. The initially rendered explorer homepage was stale-looking; use live API/receipt checks, not headline counts alone.
- Faucet UI GET returned HTTP 200. CAPTCHA, rate limits and actual token delivery were **not tested**; availability to fund a future wallet is unconfirmed.

Testnet is a credible candidate for the next approved test, not a mainnet-equivalence certificate. Different genesis/client builds/validator and fee policies may diverge. Wallet databases may call 968 Datagram/DGRAM; verify chain ID, endpoint and genesis rather than the label. Never reuse the mainnet old address as an empty testnet dependency: deploy a **test-only original copy** after approval. Pin code and deployment manifests per network.

## Proposed execution gates

1. Obtain approval for chain 968 test-only deployments and interactions, capped test funds/transaction count, chosen compiler target, and separate test wallet. Do not request/export private keys or seed phrases.
2. Recheck official sources, ID/genesis, live explorer block and faucet delivery; if any differ, stop.
3. Resolve compiler target with operator fork evidence. Compile frozen source, metadata, optimizer, ABI, source/bytecode hashes into a separate testnet release bundle; no automatic mainnet fallback.
4. Deploy the test original registry; receipt, runtime/hash, known absent proof and source verification must match.
5. Deploy V2 bound to that test original; verify immutable address, runtime, source settings and receipts. This step is not authorized now.
6. Register three deterministic distinct test-file Hashes with wallet A; create Work and append V2/V3, each after wallet confirmation and successful receipt. Compare storage, predecessors 0/1/2, original and association times, events and explorer.
7. Wallet B must fail to create using A's Hash or append A's Work; test own registered Hash cross-Work reuse, duplicate rejection, missing proof, stale predecessor and two competing appends. Check no partial writes/events after failure.
8. Test refusal before send; refusal must not reuse earlier TxHash. Wrong chain, changed account, disconnected provider and stale async completion must block writes. Never silently switch or sign.
9. Test RPC delay/rate limit/offline/receipt timeout with an interceptor; never automatically rebroadcast. Distinguish Pending/Unknown, Included and Confirmed. Verify canonical block Hash, observed safe/finalized semantics and replacement/reorg handling under controlled local simulation plus testnet observation.
10. In a fresh browser without localStorage or wallet, read Work/history via storage + deployment-bounded logs. Validate controller, version order and events from exactly that network/contract. Show TESTNET throughout; no mainnet certificates for test-only Hashes.
11. Measure actual testnet receipt gasUsed, effectiveGasPrice and total test-asset fee, plus bounded list/detail/log latency. Compare dense wallet histories, >10,000 ranges, backoff and interrupted scans; partial results must remain partial.
12. Verify explorer source/ABI/event decoding, browser refresh/reconnect/mobile, existing mainnet regression and production isolation. Save reproducible public receipts/source manifest and test summary without keys.

## Acceptance criteria

All positive operations have successful public **testnet** receipts and matching storage/events; all denied writes are rejected or revert without state changes. No test-only relationship appears as mainnet. Fresh-browser recovery works; no provider failure is represented as "no Works". Complete history claims require a completed bounded scan at a validated stable snapshot. Latency/limits/finality policy are explicitly documented. Approved release bytecode is reproducible and verified. Independent security findings are resolved or explicitly accepted.

No claim of mainnet readiness follows from a green local or testnet suite alone. Mainnet requires a separate address/source/chain/fee/config and human-signing review.

## Pause / rollback

If registry identity, block consistency, authorization or code verification fails, stop public writes and leave production V2 disabled. Deployed append-only records cannot be removed or patched. A replacement contract would require a new reviewed address and explicit migration/product decision; no automatic redeploy. Keep existing single-file mainnet product and all local archives unchanged. A fork-only alternative can test VM execution if faucet/testnet becomes unavailable, but cannot validate real wallets, validators, public RPC reliability, fees or explorer verification.
