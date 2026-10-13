# Version Registry deployment feasibility — 4C-3

Date: **2026-10-13**. **No public V2 deployment is authorized or performed.** Core Solidity, ABI and production config are unchanged. Recommendation: release the existing single-file product first, keep Version History developmental.

## Genuine old dependency

Mainnet 677; original address `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052` (the research script normalizes EIP-55 casing without changing its 20 bytes).

- Successful creation receipt: `0x72bd59f3b4c46176845456310b4cc8a64e8a09bfbec2c6442f6d09e9de4be9c1`, block **25857169**.
- Runtime length **1,062 bytes**. Full **Keccak-256 of raw deployed bytecode**, including metadata: `0xf1737614e88192546a33fff680f0892d435fa13aa755d2f429f38d54aced73bc`.
- Same bytes/hash independently obtained from the explorer API. That API returned no verified source/compiler settings/ABI, no proxy type and an empty implementations list. Lack of a proxy label is supporting evidence, not independent proof of immutability.
- CBOR compiler marker is `0x000822` = **0.8.34**. This is bytecode metadata evidence, not a verified-source reproducible build. The local original copy is compiled with 0.8.20 and **must not be assumed byte-identical**.
- Known Hash `0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625` returns wallet `0x89F415bb42e356E8b892C10B05522e0a8Ef151F3`, timestamp **1791426243**, exists true.
- Registration transaction `0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc`: successful receipt at block **25922443**; decoded ProofRegistered contains exactly that Hash, owner and timestamp. Re-read receipt has the same block Hash.
- Zero-Hash read returns the absent tuple. ABI `getProof(bytes32) -> (address,uint256,bool)` is compatible. A known successful read is not full source verification.

Sources checked 2026-10-13: [contract API](https://scan.botchain.ai/api/v2/smart-contracts/0xc64cef65ccd720664cc3bfd7d970b6f866e53052), [registration transaction](https://scan.botchain.ai/tx/0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc), and fixed official RPC read evidence in `botchain-readonly-evidence.json`.

## Binding / deployment sequence (future authorization required)

1. A: independently establish chain ID **677**, genesis and endpoint/operator identity; wallet display name alone is insufficient.
2. B: use approved exact old address, never a local fixture or testnet address.
3. C: read runtime at a stable block from independent channels; fail closed if missing.
4. D: compare against the trusted creation record and full code Hash above; obtain verified source/metadata or independently analyze exact runtime for delegatecall, upgrade, mutation and destructive paths. Resolve any mismatch before signing.
5. E: call known registered and absent Hashes; compare owner/time/existence with authenticated event/receipt.
6. F: produce reproducible approved V2 input/output, compiler version, metadata, target, source hashes, constructor encoding and predicted immutable substitutions. **Only future approved deployment** may use this argument. Current F rehearsal is local or `eth_call` only.
7. G: after any future approved deployment, read V2 code, `originalRegistry()`, deployment receipt, immutable slots/code Hash, source verification and known reads again. Never activate frontend from a TxHash alone.

Constructor rejects zero/EOA (code-length test), incompatible/throwing ABI and inconsistent zero-Hash existence probe. It cannot determine registry honesty, correct chain or provenance of an ABI-conforming malicious contract. `immutable` prevents changing the address after deployment, but an incorrect permanent binding would remain incorrect. A malicious dependency can forge owners/times; existing local adversarial tests demonstrate this. Treat genuine dependency identification as a **P1 deployment gate**.

## Authorization / invariants

`createWork` checks the original proof and sender before atomically creating Work + Version 1. `addVersion` checks Work existence, controller == sender, original exists/time and owner == sender, per-Work duplicate membership and expected predecessor. Numbering is contiguous; V1 parent 0; VN parent N-1. No caller-supplied owner/time, transfer/admin, delete/overwrite or unbounded write loop. External `view` dependency uses static calls; malformed/reverting calls roll back. Checked arithmetic and uint64 time/count bounds prevent wrapping.

Tests cover mined unauthorized/duplicate/missing/stale transactions, atomicity, queued competing appends, malicious registry behavior, integer boundaries and bounded invariants. No observed authorization bypass against the genuine local original; this is not a universal security claim or independent audit.

## What public fields would prove

| Field | Source | Meaning / limitation |
| --- | --- | --- |
| Hash, original wallet/time | Old storage, ProofRegistered receipt | Wallet registered this fingerprint at block time |
| Work ID/controller/creation/count | V2 storage | Wallet established an append-only grouping |
| Version number/Hash/parent/association time | V2 storage | Contract insertion order and association time |
| Transaction Hash/block/log order | Event/receipt RPC | Recoverable inclusion evidence; reorg validation required |
| Network/contract | Checked environment + code identity | Must be independently verified, not a user label |
| Title, description, version label | User/local browser data | Not on-chain authenticated; may not follow across devices |
| Identity/originality/copyright/actual creation date | None | Not established by either registry |

Original registration and later association are different times. Version order need not equal real-world creation order. A third party can register a public copied file first; the contracts cannot adjudicate rights. Mainnet old certificates prove single-file registration only; local Work links do not prove mainnet version relationships.

## Finality and events

The [official RPC guide](https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/) describes Parlia/FFG. No authoritative recommended product confirmation count was located. Sequential safe/finalized requests succeeded but were made at different moments and cannot infer a fixed lag. Physical finality marketing is not an application guarantee.

Current My Proofs scans from old deployment block, 10,000-block chunks, six-block project policy, strict topics/owner/address decoding, retries/range shrinking, partial states, removed-log rejection and account cancellation. Reuse this mechanism with **V2's actual deployment block**, WorkCreated controller topic and VersionAdded work topic; do not use the old deployment block for a new contract. Six blocks are a project choice, not official finality.

Before public V2: define Submitted (TxHash only), Included (successful receipt), Confirmed (approved policy/canonical block), Failed (mined revert), Pending/Unknown (no conclusive receipt). Preserve submitted Hash on timeout; never retry sending automatically. Re-read receipt/block identity on refresh; handle wallet replacement/cancellation/nonce and reorg by invalidating orphaned records/cursors and rescanning overlap. Cross-check storage at a consistent snapshot and cache key (chain, registry, wallet, stable block Hash). Differentiate provider errors from empty results; apply bounded concurrency/backoff and partial-loading labels.

The existing mainnet Create Proof page waits for a receipt but uses "Registration Confirmed" with the default one-receipt policy. That is evidence of inclusion, not a verified BOT finality guarantee. Flagged for a separately approved wording/policy change; production logic was not changed this stage. Recent type-2 inclusion is observed, not an assurance every provider accepts every fee parameter.

## Risk gates

| Priority | Issue | Status / gate |
| --- | --- | --- |
| P0 | No critical exploit observed in tested genuine-dependency paths | Testing scope limited; no audit claim |
| P1 | Permanent wrong or malicious Registry binding | Constructor mitigates shape errors; independent source/runtime identity required before mainnet |
| P1 | Wrong public network / accidental local configuration exposure | Production local gates pass; future public deployment/config must fail closed and be approved |
| P2 | Full active fork schedule unknown | Positive opcode/simulation evidence; authoritative confirmation + real testnet deployment required |
| P2 | Logs availability contradicts docs; unknown dense-result/rate limits | Sparse tests succeed; operator policy and stress/alternative read paths required |
| P2 | Finality/replacement/reorg policy incomplete | Required public V2 client work; existing UI terminology review pending |
| P2 | Exact old verified-source build unavailable | Bytecode/hash/ABI verified; source and mutability review needed |
| P2 | No third-party audit; bounded property coverage | Independent review and broader adversarial testing before mainnet |
| P2 | First-register rule, compromised controller, irreversible mistaken links | Product limitation; disclose, no hidden admin/recovery promised |
| P3 | Per-page duplicate precheck / long-history discovery costs | Contract protects duplicates; bounded loading + membership precheck future UX |

P1 items block recommending direct mainnet deployment. Testnet validation is planned in `version-history-testnet-plan.md`. Local Gas and fee examples are in `version-history-gas-report.md`; reads are not paid public transactions. Do not change storage/authentication to save small amounts of Gas during this assessment.
