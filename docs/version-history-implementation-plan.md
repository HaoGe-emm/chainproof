# Version History — 4B implementation plan and decisions

## 4B completion update

All six product decisions have been accepted and implemented **locally only**. The old decision list below is historical; do not ask again for those decisions. Atomic creation now requires the first registered hash; the minimal V2 omits global version IDs and metadata digests, using per-work consecutive numbers. It is deployed only to an in-memory Hardhat node, not BOT testnet/mainnet. No database, collaboration, recovery or signature delegation was added.

Current modules: `contracts/ChainProofVersionRegistry.sol`; compiler-generated `lib/version-registry-abi.ts`; isolated client/manifest guards; gated `/local-evm/works` routes; local wallet/receipt UI; `tools/local-evm` runtime, setup, launcher and executable tests. Existing prototype and mainnet modules are retained. See `version-history-contract-spec.md` and `version-history-local-testing.md` for exact commands, tests and local addresses.

Before 4C: human acceptance, independent contract review (automated tests are not an audit), review of genuine wallet integration and chain/RPC finality, approved deployment environment and costs, source/code verification and deployment ownership, reproducible build/locator validation and explicit deployment consent. Key-loss/dispute/rights limitations remain; advanced collaboration stays excluded. No public deployment is implied by completing local tests.

Stage 4A stops at architecture + browser-local prototype. Existing mainnet single-file registration remains the production feature. No commit, deployment, signature or mainnet association transaction is authorized by this plan.

## Decisions needed before 4B

1. Approve C for independently auditable associations, or choose A/B with explicitly local/off-chain product wording. A low-cost organizer need not have a new contract.
2. Approve the minimum single-controller / old-proof-owner / linear append policy. If multi-wallet collaboration is essential, specify who invites, who consents, who appends, how revocation applies and whose registration is accepted; estimate separately.
3. Allow one authorized hash in multiple works? Recommendation yes; duplicate within work no. Approve no branches initially, or specify head/fork semantics.
4. Approve no transfer/recovery in first registry, understanding wallet-loss and old immutable ownership constraints. Recovery and disputes require separate design, not a frontend bypass.
5. Decide whether public titles/descriptions are required. Recommendation start with numeric IDs/optional commitments and user-local descriptions; publicly available metadata needs an approved availability/privacy approach. Digest alone is insufficient to display a title on another device.
6. Choose local EVM tooling and an explicitly authorized test environment; confirm contract review budget, Gas tolerance and target chain confirmation policy. Deployment must be a separate human approval step.

## Modules and task order

| Step | Implementation / gate |
| --- | --- |
| 1. Freeze policy | Confirm the above, align wording and invariants; preserve old ABI/address/routes. |
| 2. Executable contract | Separate non-upgradeable V2 registry, immutable old address, pagination/events and expected-head checks. No automatic deploy scripts with a mainnet default. |
| 3. Local EVM verification | Isolated mock old registry; unit/property tests and gas snapshots; network disabled. Compile Solidity 0.8.20 and inspect storage/bytecode; independent review before any chain write. |
| 4. Source adapters | New `lib/version-registry.ts` / ABI/config separate from old `lib/chainproof.ts`; locator validation, state/event decoding, bounded reads, canceled stale requests and explicit errors. Unknown registry never falls back. |
| 5. UI behind feature gate | Separate prototype adapter from chain adapter. Work creation/append user actions, metadata source labels, wallet/controller/old-owner checks, receipt event checks, rejected/pending/reverted states. Do not alter old Create Proof. |
| 6. History and sharing | Public read-only work route, paginated timeline + canonical state cross-check, certificate navigation, local byte comparison with confirmed version records, current-origin public URL + chain/registry locator. No wallet needed for reads. |
| 7. Compatibility | Live read-only old proof and transaction checks, all old tests, links, history scan and existing ABI unchanged. Existing users never re-register a hash to retain old features. |
| 8. Controlled validation | Only after approval, use an appropriate test deployment and measured Gas; approve privacy/metadata language, collaboration limits and failure UX. |
| 9. Mainnet gate | Reviewed source/tests, reproducible build, measured fees, correct old registry binding, confirmation policy, explorer verification plan, retention/migration plan and explicit user deployment consent. |

C requires a **new separate contract**, not changing ChainProof.sol. A/B do not require one. No database needed for minimal C state; public rich metadata may prompt a separate storage decision. No external storage, paid service or EVM framework was added in 4A. Prototype local storage is not a production persistence strategy.

## Testing plan

- Model: linked work IDs, unique per-work hashes, multiple-work reuse, consecutive ordinals/parents, fixture isolation, owner/controller denial, distinct times, bounded schema restore and corrupted/disabled storage.
- Contracts in 4B: all invariants from `version-history-contract-design.md`, failed old registry reads, contract wallet behavior if supported, stale concurrent append, event/state consistency, pagination bounds and Gas snapshots. Tests cannot use a mainnet RPC signer.
- UI: no-wallet creation in prototype; simulated actor switch; repeated append; reload/storage errors; copy full hash; no cross-device share claim; live old proof and certificate navigation; lookup absent/RPC failure; newest lookup wins; 320/375/768/1440px layouts.
- Regression: existing `npm test`, type check (`npm run lint`), build, product-browser and certificate-browser suites. File bytes remain local, no mocked record reported as mainnet, no actual transaction sent by browser tests.
- Release acceptance is separate from test success. Design assertions are not EVM security tests until an executable contract exists.

## Main difficulties / estimates

Do not estimate Gas or time as if requirements were fixed. Most uncertainty is in multi-wallet consent, key recovery, metadata availability and source-bound public routing. The linear single-controller model is smaller, but deliberately excludes these capabilities. Review workload includes irreversible association mistakes, front-end/RPC trust and cross-registry migration. Obtain measured execution Gas before proposing native BOT costs.

## 4A manual prototype acceptance

1. Open `/works`: persistent Prototype / Demo banner, local-only disclosure, no extra main navigation item.
2. `/works/new`: create a titled demo work, select simulated controller A or B (not MetaMask), no signature.
3. Detail: choose demo fixtures and labels, append V1/V2/V3; observe registration fixture time vs local association time and declared label vs append number. Try a duplicate, actor mismatch and foreign wallet's fixture.
4. Copy Hash, View Demo Proof, Verify File locally with the displayed sample bytes; UI says Demo byte match, not a mainnet match.
5. Use the isolated mainnet compatibility panel with the known real hash; show live owner/time and open unchanged certificate. It does not become part of the demo timeline. Wrong hash/RPC error never shows a confirmed candidate.
6. Reload the local work; open its URL in another browser/origin: unavailable, not a published work. Block storage and observe the in-memory warning. No data exported automatically.
7. Inspect mobile widths; run tests/type check/build. Stop for human acceptance before 4B.
