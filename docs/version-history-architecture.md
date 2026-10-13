# Version History — stage 4A architecture

## 4B implementation status (supersedes 4A proposal choices)

The six product decisions are now approved: separate V2, one immutable controller, linear append, cross-work hash reuse, no collaboration/transfer/recovery, and no mandatory public metadata. **Only isolated local Hardhat chain 31337 is deployed.** Original BOT Mainnet chain 677/address/ABI/routes remain unchanged.

Implemented atomic `createWork(initialFileHash)` rather than empty work creation; first version is validated and committed with the work. Version identity is `(workId, versionNumber)` and predecessor is the preceding number, removing global version IDs, separate ID indexes and metadata commitments from the initial draft. This reduces storage and avoids empty work ambiguity. Titles/descriptions remain only in the old 4A prototype; the actual local chain UI shows numeric works and no metadata persistence requirement.

Existing `/works` prototype is preserved. Actual local contract interaction uses **`/local-evm/works`** and its new/detail pages, gated by development mode + `CHAINPROOF_LOCAL_EVM=1` + loopback origin. Normal production renders a disabled notice and its config endpoint returns 404. Local chain config lives in ignored `.local-evm/deployment.json`, never in mainnet config or public static files. `lib/local-evm-safety.ts` validates chain 31337, exact loopback RPC, addresses, code hashes and locator fields; runtime reads also verify genesis/deployment block hash and immutable original binding.

The local developer wallet uses unlocked Hardhat accounts through viem with an explicit confirmation dialog for each transaction. It never reads/injects/switches/signs MetaMask, stores keys, or sends to a public chain. This choice isolates the existing mainnet wallet session. This wallet is a testing tool, not a production wallet framework. Never fund its well-known development accounts. A genuine MetaMask integration and public deployment require a separate approval stage.

Local history is recovered from canonical V2 reads and old local `getProof`, without localStorage. Discovery uses indexed controller, deployment-block-bounded 500-block ranges and existing adaptive retry/split logic; stale scans are canceled and failures retain partial labels. Local automining uses one mined receipt; this is not BOT finality. Details load ten versions per page and cross-check original wallet/time and predecessor. Receipts must succeed and emit the expected contract/controller/hash/work/ordinal event before success. No local certificate/transaction link points to BOTScan.

Hardhat 3.19.0 (EDR) is the only EVM framework, used programmatically; pinned solc 0.8.20 compiles offline after dependency installation. Native Node tests plus existing viem avoid ethers/wagmi and plugin suites. A `pnpm-workspace.yaml` permission only enables necessary esbuild installation scripts. See the contract spec, local testing guide, security review and measured Gas report for current deliverables. The remaining 4A sections are historical rationale, not an assertion that no 4B implementation exists.

Status: design and local interaction prototype, 2026-10-12. No V2 contract is deployed. Choices below are recommendations awaiting approval for 4B.

## Scope and existing implementation

Stages 1–3 are present in `app/register`, `app/verify`, `app/my-proofs`, `app/proof/[hash]`, `components/proof-certificate.tsx`, and the public viem reader in `lib/chainproof.ts`. SHA-256 stays in `lib/proof.ts`; history scanning uses the deployment boundary, indexed owner filter, adaptive ranges and six-block confirmation lag in `lib/proof-history.ts`. Registration checks receipts and exact emitted hash/owner. Public certificate lookup is independent of wallet access.

Existing immutable registry: chain 677; RPC `https://rpc.botchain.ai`; contract `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052`; explorer `https://scan.botchain.ai`; deployment block 25857169. Its only stored fields are proof owner and timestamp, keyed by hash. It has no proxy, work ID, version order, collaborator or upgrade method. Event order is registration order, not creation order or a work relationship.

Scope: organize hashes, show distinct registration/association dates, navigate individual proofs, compare local bytes, and research public sharing. No real association writes, signatures, deployments, new database or change to old routes in 4A.

## A / B / C comparison

| Question | A: browser-local association | B: shared off-chain database | C: separate association contract |
| --- | --- | --- | --- |
| Wallet | No wallet needed; address text is not authorization | Wallet session/signatures needed for controlled writes; ordinary email accounts optional | Transaction sender authorizes creation/append; reads need no wallet |
| Cross-device | No, unless explicit export/import is added | Yes while service is available | Yes with network + registry address + work ID |
| Public sharing | Local route alone cannot share data | Public read API; service dependence | Public RPC calls/events; no proprietary database required |
| Mutability | DevTools/storage can rewrite everything | Operators/admins can alter/delete records; signatures can detect some tampering | Append-only relations independently inspectable; descriptions remain claims |
| Loss risk | Clearing storage, origin change, device loss | Backup/operator failure, signing key/session loss | Wallet loss stops appends; existing chain data remains readable; chain/RPC availability still matters |
| Cost / complexity | Small implementation, no association Gas | Medium: API, sessions, access control, backups, abuse prevention | Higher: contract tests/review, Gas, confirmations, indexing and migrations |
| Privacy | Local labels remain on device; exports leak labels | Metadata, wallet IDs, access logs reach service | Hashes/relations/wallets are public permanently |
| Product fit | Good draft organizer/prototype; unsuitable for chain-confirmed relation claims | Good collaboration UX, weaker database independence | Fits independently verifiable wallet-established relations, with strict limits |

For B, establish wallet sessions with domain/chain-bound nonce and expiry, verify signatures server-side, invalidate sessions and enforce per-work access controls. Check original proof ownership independently of user input. A signature confirms wallet control, not authorship. Authentication can use [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361); per-action typed signatures additionally need domain separation, nonce, expiry and replay controls beyond [EIP-712](https://eips.ethereum.org/EIPS/eip-712). Neither a database row nor a login proves a relationship on-chain. Not implemented here.

## Recommendation and decision gates

Use **A only for 4A**: isolated, clearly labeled local demo with simulated authorization and editable local storage. For a **4B product promising independently verifiable relationships**, recommend a small **C registry**, subject to user approval, contract review and local EVM tests. No database is necessary for an initial linear history. If low cost and collaboration editing are more important than publicly auditable relations, choose B and retain explicit off-chain wording instead. C is not automatically superior: it cannot prove actual derivation or authorship and costs Gas for every association.

Minimal recommended C policy: one controller, one linear append chain, no delegation/transfer/recovery/admin, no mutable descriptions, unique hash within a work. Multiple works may reference the same hash, by the same authorized registration wallet only; these are separate organizational assertions, not exclusive ownership. Multi-wallet works and branching are postponed until consent and governance rules are specified. This policy is intentionally restrictive, not a general collaboration solution.

## Data model and provenance of fields

Canonical registry locator: `(chainId, versionRegistryAddress, workId)`. A bare work ID is not globally unique.

| Entity / field | Proposed C representation | Source and meaning |
| --- | --- | --- |
| Work.workId | uint256, monotonically allocated, 0 reserved | Registry-generated ID, not inferred from a file |
| Work.creator / controller | address (equal, immutable initially) | `msg.sender` at creation; wallet, not person |
| Work.createdAt | uint64 | V2 creation block timestamp |
| Work.title / description | Display metadata, not required for on-chain core | User-provided local/export data initially; public cross-device descriptions need a separately approved availability mechanism |
| Work.metadataDigest | bytes32 optional commitment, 0 = none | Commitment to canonical metadata bytes; neither available content nor true statements are guaranteed |
| Version.versionId | uint256 global sequence, 0 reserved | V2-generated ID |
| Version.workId | uint256 | V2 parent work |
| Version.fileHash | bytes32 | Same SHA-256 bytes32 as old registry |
| Version.versionNumber | uint32/uint64, constrained consecutive | Association sequence, not actual creation sequence |
| Version.previousVersionId | uint256 | Prior head ID, or 0 for first |
| Version.registeredWallet | address returned by old registry | Wallet that first registered this hash in this registry |
| Version.registeredTimestamp | uint256 returned by old registry | Time first registered in **this registry**, not first known use or creation time |
| Version.associationTimestamp | uint64 V2 block timestamp | Time wallet established the association |
| Version.versionLabel / metadata | Optional user description / digest | Self-described; never inferred from content |
| claimedCreationTime | Optional unverified metadata, never a canonical timestamp | User assertion only; omitted from prototype UI |

For a compact contract, read original owner/time from the immutable old registry when presenting each version rather than duplicate both storage slots; include owner in the association event and cross-check old `getProof`. Keep a paginated ID index for enumeration. Metadata commitments are optional and do not require any external storage service in the first implementation; no titles need be permanently published.

The 4A model in `lib/version-history.ts` uses `demo-UUID` IDs, explicit `source: demo`, local device timestamps and known synthetic proof fixtures. It is **not** the C storage schema or an authenticated registry. No real proof is persisted in that store. Fixtures and real read-only lookup are separate UI sections.

## Authorization and key invariants

1. Anyone may create a work for **themselves**, subject to nonzero sender; no arbitrary creator argument.
2. Append requires `msg.sender == work.controller`, old proof exists with nonzero timestamp and old owner equals sender. B cannot include A's proof, even if B knows the file/hash.
3. Missing work/proof, duplicate hash within work, stale previous head or skipped ordinal revert. Increment IDs/count only after checks; a failed call consumes no sequence. Creation does not grant ownership of any bytes.
4. Caller supplies expected head to prevent two pending appends from silently changing intended order. Future collaborators must individually consent to a specific work/hash/parent; controller permission alone cannot appropriate their proof.
5. No edit, delete, owner override, secret or generic external call. Registry is bound to one immutable old proof contract on one chain. Its read calls are `view`/STATICCALL; never trust caller-supplied owner/time.
6. Same hash in another work is permitted under the same ownership rule. Cross-work reuse means grouping, not new registration.
7. Local fixture actor selection demonstrates rules but **is not a wallet signature**. Manipulating local state has no effect on chain ownership; UI must never promote it to verified data.

Wallet loss: old history stays readable, but no appends/recovery under this minimal model. Controller transfer would not transfer old registry proof ownership; a recovery design cannot bypass that constraint. Stolen keys can authorize misleading new records. A legitimate registration wallet can still have registered someone else's file. No technical rule proves copyright or real authorship.

## Compatibility research case

Original proof `0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625`; transaction `0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc`. The 4A UI reads the old registry and shows confirmed owner/time separately. Recheck live results; no cached fixture is passed off as a live read. Only its registered wallet could attach this hash under the proposed C rules. That attachment would have a **new** association time; it cannot be backdated to the original registration.

On 2026-10-12, the browser acceptance check performed a live `getProof` read: owner `0x89f415bb42e356e8b892c10b05522e0a8ef151f3`, timestamp `1791426243` (`2026-10-08 02:24:03 UTC`), exists true. The unchanged certificate opened successfully without a wallet. This verifies the old single-file record, not any work association.

Old `registerProof`, `getProof`, event ABI, My Proofs, `/proof/[hash]`, address and deployment boundary stay intact. No migration/re-registration is necessary for existing proofs. V2 reads old records rather than registering the same hash again. Association costs Gas once V2 exists; it is not another file registration fee. Unknown V2 IDs show not found, never a fabricated history.

## Public page, querying, and sharing

Future `/works/[workId]` resolves against an explicit known registry locator. Read work header, paginate version IDs, then read versions + old proofs; verify both sources and show independent RPC error states. Work header/count and version mappings remain canonical even if an event provider is incomplete. Events use deployment-block-bounded adaptive ranges, indexed work/controller, confirmed heads and partial-state labeling, reusing the stage 1 approach without modifying it. Finality policy must be validated against BOT Chain before production; six confirmations is an existing heuristic, not an absolute guarantee.

C association proves that a wallet made an append at a block time; it does not prove actual revision/derivation. A version can be registered before an earlier-numbered version. Labels and claimed creation dates remain user information. B uses signed service metadata and availability guarantees; A needs explicit untrusted export/import to cross devices. No such sharing system exists in 4A: a copied local URL alone has no data on another device/origin, and the prototype says so. Old single-file certificates remain publicly shareable independently.

## V2 design and Gas

See `version-history-contract-design.md` for an unimplemented interface, storage outline, event design and invariants. No Solidity artifact or deployment configuration is added in 4A. New storage and external reads are main cost contributors; larger descriptions should not become unbounded storage. Compiler packing needs inspection, not assumptions; [Solidity contract documentation](https://docs.soliditylang.org/en/latest/contracts.html) describes state, visibility and events.

Do not quote a BOT cost without measurement. In 4B compile optimized Solidity 0.8.20, measure receipt gas in local EVM for create/first append/later append/stale head/reused hash/metadata commitment; include external old registry reads and cold/warm access. Reverts also consume execution Gas when mined. Estimate target-chain fees using a simulated successful call and current fee data only after deployment is separately authorized; total native token cost is `gasUsed * effectiveGasPrice / 1e18`, not an invented constant. Public `eth_call` reads have RPC/infrastructure cost but no user transaction Gas. RPC/gas policy may differ from Ethereum; validate on an authorized test environment before mainnet.

## Risks and next steps

Key risks: false authorship language, unauthorized linking, stolen/lost keys, timestamp and ordering confusion, public metadata leakage, frontend/RPC deception, permanent bad associations, gas/storage growth, incompatible future migration. See threat model and 4B plan. Approve policy first, then implement/test locally, independently review, use an explicitly authorized test deployment, and consider mainnet only after measured costs and acceptance. 4A must stop before those write/deployment steps.

The local prototype has no multi-tab conflict coordination: simultaneous edits can overwrite local changes (last write wins). Use one tab for acceptance. It has no export/import or public work publication, and storage can be cleared or denied. These limitations must not be described as production persistence guarantees.
