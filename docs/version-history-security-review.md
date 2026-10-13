# Version Registry 4B security review — local development only

This is a developer review with executable local EVM tests, **not a professional security audit**. No BOT testnet/mainnet deployment occurred. Solidity compiler: 0.8.20, optimizer 200, Shanghai. Compiler warnings were checked; runtime/manifest safety is separate from constructor validation.

## Checks / evidence

| Area | Implemented control and test |
| --- | --- |
| Access / authorization | Existing work + immutable controller + original proof owner==sender; denied third-party initial proof and appends, missing proofs/works, call forwarding spoof attempt. No owner/time input. |
| External contract trust | Immutable reference, code/ABI consistency probe; malformed/reverting/zero-time fixtures fail atomically. Probe cannot prove a malicious registry honest. Local runtime validates both deployed code hashes and binding. |
| State consistency | Atomic work+V1; append only after all checks; mined reverted transaction leaves count/membership/events unchanged. Immutable previous entries checked. |
| Duplicate / ordering | Per-work membership; authorized reuse across work allowed; exact previous number prevents stale parallel append/reordering. Deterministic 60-step randomized operations check count/parent/unique hash/original-owner invariants. |
| Events | Successful receipts must emit exact registry/controller/hash/work/number before frontend success; event fields cross-checked against canonical entries. Frontend event ABI checked against compiler ABI. |
| Front-running | Others cannot link victim's hashes under their controller; global next ID may be allocated by another transaction, so receipt supplies actual ID. Owner can still associate copied content previously registered by themselves. |
| Reentrancy | Only typed view call to old registry; EVM STATICCALL prohibits writes and logging in descendants; performed before state updates. Mutable-registry fixture fails without changing its counter. No value transfer, callbacks or generic external target. |
| Denial of service / Gas grief | No write/history loop, each write O(1); public pagination ten versions, bounded adaptive discovery. Malicious/unavailable old registry can block writes; trusted old code binding needed. Local bytecode trust does not constitute a universal registry audit. |
| Integer limits | Checked uint256 IDs; uint64 count/time with explicit limits; test-only storage injection verifies max count fails without link mutation. No unchecked arithmetic. |
| Network / addresses | Manifest schema refuses chain 677/968 and remote RPC/mainnet address/zero placeholders; runtime checks local 31337, code, genesis/deployment hash and immutable binding. Production/development/origin gates prevent production wallet controls. |
| UI races / receipts | Same-tick confirmation lock, pre-send selected-account check, old scan cancellation, wallet switch clears IDs, successful event receipt requirement, partial scan errors, no automatic resend or real MetaMask signing. |
| Wallet compromise / identity | Developer accounts are public/unlocked; never fund/expose them. Registry authority is wallet registration, not rights/identity. Stolen real controller keys would authorize future appends; no recovery/transfer implemented. |

## Issues found and corrected

- npm installation failed against existing pnpm symlink layout; used existing pnpm and its lock, individually enabled esbuild install script. No removal of existing source/workspace files.
- Installed Hardhat server API requires hostname/port positional arguments; corrected launcher to bind exact loopback 8545.
- Existing product Next dev service was running; isolated local build directory/port instead of terminating it.
- PublicClient cannot type eth_accounts; use local WalletClient.getAddresses. Generated full ABI caused event type inference depth; event-only typed ABI is cross-checked with compiler output.
- Double confirmation and late account selection risk: explicit ref locks and selected-account predicate immediately before write. Pending receipt stays linked to captured owner.
- Local RPC reset/no bytecode must report Contract Not Deployed before querying missing deployment block.
- Successful receipt followed by failed timeline refresh retains confirmed Version Added status with separate refresh failure, rather than misreporting transaction confirmation. Timeline cross-checks original wallet, predecessor and time.
- Existing browser regression had an ambiguous transient text locator (submitted status also appears on its disabled button). Scoped the test to the actual explorer link and retained exact hash/receipt assertions; production business logic was not changed.
- Local scripts explicitly disable Hardhat telemetry and pin the EVM framework/compiler versions for reproducibility.

## Remaining risks / deployment gate

The old registry may have a copied file registered by an unrelated real-world claimant; strict ownership rules cannot settle rights. No identity/originality/copyright/creation-date claim is made. Relationships and timestamps are publicly attributable wallet assertions only.

No key recovery, controller transfer, collaboration, upgrade, editing, deletion or dispute resolution. Permanent wrong associations cannot be corrected in place. Current one-confirmation local mining is not an approved BOT finality policy. Single RPC/frontend can lie; independent source verification remains needed. Local HTTP unlocked accounts are deliberately test infrastructure, vulnerable if exposed or funded. Metadata publishing is excluded.

Deterministic invariant sequence is not exhaustive fuzzing or formal verification. Gas boundary injection is test-only, not a production route. No static analyzer or independent third-party audit was run. A future public deployment requires independent review, broader property/adversarial testing, genuine wallet integration and replacement/timeout/reorg policy, approved target environment/config/code verification, measured chain fees and explicit human approval. Test success does not authorize deployment.

## 4C-1 review update — 2026-10-12

The 4B results above are retained as history. This follow-up is a developer security review, not an independent audit or authorization to deploy. Solidity authorization, storage, public ABI and version semantics were not changed. All attack transactions used isolated local EVM instances; no public-network V2 was deployed.

### Executed evidence

- `npm run test:contracts:local`: **23/23 passed**, consisting of the previous 15 tests and 8 additional cases in `tools/local-evm/security-review.test.mjs`. Direct mined transactions exercise unauthorized senders, missing/duplicate proofs, bad predecessors, failed-call atomicity and external-registry failures.
- A deterministic model ran **240 actions across 3 accounts, 6 works and 30 hashes**. Stored versions, controller, membership and parent order were compared with the model. This is bounded property testing, not exhaustive fuzzing.
- Two queued appends using the same expected predecessor produced receipts `[success, reverted]`; the loser added no entry or event.
- A conforming malicious original registry supplied forged ownership and a future registration time that V2 accepted. This is an executable counterexample to interpreting the constructor probe as proof of registry identity or honesty. It does not demonstrate a bypass when the immutable dependency is the genuine, unchanged ChainProof contract.
- A separate disposable loopback Hardhat server returned `Access-Control-Allow-Origin: *` and mined a zero-value unlocked-account transaction carrying an untrusted `Origin`. This demonstrates unauthenticated RPC access at the service boundary. It does not establish that every browser can bypass its local-network permission policy.
- Local browser tests reproduced an account A → B → A preflight race: before the fix, one stale send occurred and another transaction button became available; after the fix, there were zero stale sends and the button remained locked. Stale connection completion and an empty sample list were also corrected and tested in `tests/version-security-browser.mjs`.
- `npm test`: **33 passed**. `npm run lint` and `npm run build` passed. Production gate probes returned **404** for the local configuration GET and **405** for unsupported methods; client-side flag spoofing did not expose local controls or produce local RPC traffic.

### Fixes and retained boundaries

The local frontend now invalidates connection and pre-send requests with a monotonically changing session marker, keeps the transaction lock during approval, and handles an empty valid fixture list. These corrections are confined to local development interaction; they do not change Solidity authorization or the existing mainnet product.

The constructor's ABI probe remains a shape/consistency check. Before any public deployment, independently confirm the target chain, genuine original address, deployed code and immutable binding. A manifest whose hashes are supplied by the same local deployment process protects against accidental mismatch, not a compromised process rewriting both manifest and code. The trusted original must also be checked for proxy or other mutable behavior.

Raw local RPC remains intentionally unauthenticated test infrastructure. UI confirmation, Next production gates and hostname checks do not secure that separately running server. Keep it loopback-only, never fund development accounts, and stop it when unused. Treat arbitrary local processes and browser requests allowed to access it as capable of changing or resetting its synthetic state.

The loaded timeline's duplicate precheck covers only loaded versions. A duplicate in an unloaded page can still display Ready to Add; simulation and the contract reject it. This remaining **P3 UX issue** does not permit a duplicate association. The existing `isHashLinked` view can support a complete future precheck.

Zero bytes32 is accepted only when genuinely registered by the sender in the original registry; this preserves existing bytes32 semantics. Future timestamps from a malicious registry are another dependency-trust counterexample, not a permitted user timestamp argument. Changing either rule requires a separately reviewed product/contract decision.

Shanghai opcode compatibility with BOT Chain has not been established by these local tests. Public deployment remains blocked on that evidence, original-contract identity/binding checks, public-wallet and finality/replacement policy, and human approval. Test success and the absence of observed additional bypasses do not prove universal security. See `version-history-predeployment-review.md` and `version-history-security-findings.md` for the complete 4C-1 assessment.

## 4C-3 evidence update — 2026-10-13

Previous dated results are retained. No Solidity authorization/storage/ABI or production configuration was changed. User-confirmed 4C-2 real MetaMask acceptance is evidence of **local 31338** wallet behavior only.

Mainnet read-only probes now demonstrate PUSH0 plus selected Cancun instructions and both Paris/Shanghai V2 constructor simulations. These improve the earlier compatibility evidence, but do not establish an authoritative full fork schedule or actual public deployment. See `botchain-evm-compatibility.md`.

The genuine old registry's 1,062-byte runtime Keccak-256 is `0xf1737614e88192546a33fff680f0892d435fa13aa755d2f429f38d54aced73bc`; RPC and explorer API agree. Its compiler metadata indicates 0.8.34; explorer API did not provide verified source/settings. ABI/known proof/event/creation receipt checks pass, but exact source/mutability verification remains a gate. Local compiler 0.8.20 output must not be used as a byte-identical fingerprint for that deployed old code.

**P1:** constructor shape checks cannot prevent an intentionally or accidentally incorrect ABI-conforming immutable registry binding. Independent network/address/creation/runtime/known-proof verification is mandatory before mainnet. No bypass against the genuine old registry was observed; this deployment-trust issue is still unresolved for a future public release. Production local gates passed even with development flags supplied: config GET404, write-method405, no local wallet controls or RPC requests. This does not secure a separately running raw Hardhat node.

**P2:** official mainnet log-disable documentation conflicts with observed successful sparse filtered reads; full limits/availability remain unknown. Full fork activation, public-wallet replacement/reorg/finality policy, original verified-source reproduction and independent audit remain outstanding. My Proofs' six-block threshold is a project policy. Existing receipt-based "Registration Confirmed" text does not establish official finality; changing production policy/text requires a separate approved task.

**P3:** bounded version pages do not bound total discovery history; duplicate prechecks may miss unloaded pages, with contract rejection retained. No storage/auth redesign was applied for marginal Gas savings.

Current-stage tests: npm test72/72; wallet/recovery48/48; contract/security27/27; new compatibility10/10; both production local-route browser gates passed; lint and build passed. Suites overlap and should not be summed into unique-test coverage. All actual new deployment/writes were isolated in-process chain31339. Reproducible input/bytecode, PUSH-aware disassembly, 100-version sequences and wrong-hardfork rejection were tested. This remains developer review and bounded testing, **not a professional security audit**. Public deployment is not recommended until P1 gates and the testnet/public-client plan are complete.
