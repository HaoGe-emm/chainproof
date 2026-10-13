# ChainProof 4C-3 delivery report

Assessment: **2026-10-13**. Research/local tests only. **No public transaction, deployment, real signature, commit, push, merge, Vercel publication or stage5 work.**

## 1. Project state

Branch `feature/chainproof-v2`. Large existing dirty working tree and user assets preserved. Protected Solidity, ABI, mainnet network/history configuration, stable local compiler/recovery scripts and active31338 manifest are unchanged from the opening SHA-256 baseline.

31337 archive: six Works/16 Versions, Work4 has three. 31338 opening live read and archive: six Works/nine Versions, seven original proofs, 20 transactions, Work6 has two Versions. Opening read had head20 and matched the archive. **Final re-read of18547 returned ECONNREFUSED: current in-memory state cannot be confirmed.** No reset/restart/redeploy or stop of either user chain was performed, and no archive was overwritten. Both archive SHA-256 checks still pass; their checksums and observations are in `botchain-readonly-evidence.json`. Offline31337 was not restarted; its archive is the source for that chain's counts. Do not infer that the final31338 node is live, or restart it automatically to hide this limitation.

## 2. BOT compatibility

677 identity established; BASEFEE, PUSH0, MCOPY, transient storage and BLOBBASEFEE read probes pass. Selected London/Shanghai/Cancun feature evidence is positive. **Exact full active fork remains unknown**. Type2 inclusion was observed. See [compatibility assessment](botchain-evm-compatibility.md) for official sources, live readings and repository provenance limits.

## 3. Solidity bytecode

Solc0.8.20 / Hardhat3.19.0; five Paris/Shanghai/optimizer variants. All compiled and passed local100-version sequences. Proper PUSH-aware source-map-bounded disassembly; Paris has no PUSH0 and works pre-Shanghai, Shanghai fails there. Stable config remains Shanghai200; no permanent target change. ABI/storage layout unchanged. Artifacts reproducible for identical inputs, deployed code requires immutable-address patching.

## 4. Old mainnet check

Known creation successful at25857169. Runtime1062bytes, Keccak-256 `0xf1737614e88192546a33fff680f0892d435fa13aa755d2f429f38d54aced73bc`, matches explorer API. Known registration successful at25922443, owner `0x89F415bb42e356E8b892C10B05522e0a8Ef151F3`, time1791426243, exists true; receipt, event and storage agree. Bytecode compiler metadata indicates0.8.34; verified source/settings unavailable from inspected API. No assumption that local old copy has identical runtime.

## 5. V2 deployment safety

Immutable original Registry; zero/EOA/ABI shape failures rejected. Controller + old owner checks, duplicate prevention, expected parent, atomic append, immutable history and bounded writes tested. Malicious ABI-conforming dependency remains a **P1 identity/binding gate**. The ordered A–G verification and data provenance matrix are in [deployment feasibility](version-history-deployment-feasibility.md).

## 6. Gas and cost

Shanghai200 local: deployment634299; Create151369; V2/V10 append108095; V100108083 (calldata variation). Paris200 deployment641745; Create151383; append108109. No linear append growth. Observed20gwei public quote and20–22gwei reward percentiles permit explicitly illustrative calculations only. No actual V2 public fee paid. [Gas report](version-history-gas-report.md) includes all variants/read estimates/performance limits.

## 7. Public finality

safe/finalized calls respond; official recommended confirmations not found. Existing six-block scan policy is project-specific. Reuse deployment-bounded adaptive logs/partial state/cancellation; extend with canonical receipt/block validation, overlap rescan and transaction replacement/Unknown handling before public V2. Current receipt-based Confirmed wording needs approved policy review. Official logs-disable statement conflicts with successful sparse RPC reads; service limits remain unresolved.

## 8. Testnet preparation

Bohr968 official parameters and live RPC established. Explorer API block26697796 agrees with RPC Hash. Faucet UI responds, actual funding untested. Exact fork parity with677 unknown. [Testnet plan](version-history-testnet-plan.md) specifies future approved deployments, separate old copy, wallet tests, public reads, source verification, Gas and acceptance gates. No public test was sent.

## 9. Tests executed this stage

| Command/check | Result |
| --- | --- |
| `npm test` | 72/72 passed |
| `npm run test:wallet:local` | 48/48 passed |
| `npm run test:contracts:local` | 27/27 passed |
| `npm run test:compatibility:local` | 10/10 passed, final matrix rerun |
| `npm run compile:compatibility:local` | All five variants compiled |
| `npm run lint` | Passed; existing script is TypeScript no-emit check |
| `npm run build` | Passed, Next16.3.8 production build |
| `tests/metamask-production-gate.mjs` on Edge | Passed; local31338 disabled despite flag/query spoofing |
| `tests/local-production-gate.mjs` on Edge | Passed; local31337 disabled, config404/method405/no local RPC |
| Public read script | Completed677 checks, known receipt/state/code/probes/constructor simulations; also968 checks |

Suites overlap; counts are not unique coverage. Production preview was owned by this assessment on127.0.0.1:3009, then stopped; existing services left intact. Public reads and failed connectivity attempts are kept separately. No automated test can establish an independent audit or permission to deploy.

## 10. File changes

- New `tools/botchain-review/compile.mjs`: isolated build/instruction experiments.
- New `tools/botchain-review/readonly.mjs`, `system-http.ps1`: fixed-endpoint read-only RPC with normal Windows HTTP fallback.
- New `tools/botchain-review/compatibility.test.mjs`: actual31339 EVM comparisons and read-only transport guard tests.
- `package.json`: three explicit compile/test/read-review scripts; no new dependencies.
- New four requested assessment/feasibility/testnet/decision documents, this report and `botchain-readonly-evidence.json`.
- Appended dated findings to existing security-review and gas-report; historical results retained.
- Ignored `.local-evm/compatibility/`: experimental artifacts/evidence/protection hashes. No mainnet/frontend/Solidity/ABI/recovery config rewrite.

## 11. Outstanding deployment blockers

P1: independently authenticated old runtime/source/mutability and exact immutable binding; fail-closed public deployment/config process. P2: authoritative active fork, real approved testnet deployment, consistent logs service/limits, finality/replacement/reorg policy and independent review. Public wallet acceptance has only been completed locally. Final31338 RPC is offline/unreachable; original archive is intact, but current unarchived data cannot be inferred and restoration must be a separate authorized action. Irreversible controller mistakes/compromise and first-wallet registration's real-world rights limitations must remain disclosed. No copyright/originality conclusion is supported.

## 12. Decision

**A — recommend first publishing the existing ChainProof2.0 product without formal public Version History**, after normal release/diff review and approved terminology/development visibility decisions. It offers a working mainnet verification/certificate flow without new contract risk; public multi-version demand has not yet been demonstrated. B becomes reasonable after testnet/deployment gates close and grouping value is confirmed. No immediate V2 mainnet deployment recommendation. [Decision comparison](chainproof-v2-release-decision.md).

## 13. Required next authorizations

- Non-destructive local experiments can continue when requested; never reset protected nodes.
- Permanent compiler/ABI/core auth or production-policy changes require explicit scoped approval.
- Testnet funding/signing/deployment requires separate approval for968 and test-only accounts/assets.
- Mainnet signing/deployment/config activation requires a separate explicit approval after review; not implied by testnet success.
- Git commit/push/merge and Vercel publication are separately user-approved actions.

Assessment complete; stop and await user acceptance. Existing local backup limitations/restart instructions remain in the previous recovery documents. This task does not stop user nodes or shut down the computer.
