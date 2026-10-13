# Version History 4C-1 security findings

Review date: 2026-10-12 (Asia/Shanghai). Branch: `feature/chainproof-v2`.
Developer security review and executable counterexamples; not an independent audit or certification.
Line references describe the reviewed source after the small frontend fixes.

## P0 — none demonstrated within this review

No public transaction, real signature, credential disclosure, or Solidity authorization bypass against the genuine original registry was demonstrated. This is a bounded observation: no formal proof, independent audit, exhaustive fuzzing, public V2 deployment or hostile browser extension assessment was performed.

## R1 — P1 impact if deployed with an untrusted original registry (deployment prerequisite)

- **Classification:** confirmed trust-boundary counterexample, not an exploit of a V2 correctly bound to the genuine immutable ChainProof.
- **Locations:** `contracts/ChainProofVersionRegistry.sol:41` (constructor), `:89` (external proof check); `lib/local-version-registry.ts:16` (local manifest binding).
- **Condition:** deployer binds V2 to a compatible dishonest contract, or trusts an attacker-edited local deployment manifest. Existing code/ABI checks cannot establish the truth of a compatible contract's data.
- **Reproduce:** run `npm run test:contracts:local`; the new malicious registry returns a valid zero-hash probe, then reports a chosen owner/nonzero timestamp/exists for a hash absent from the genuine registry. `createWork` succeeds. Changing it to report a future registration time also permits `addVersion`.
- **Impact:** V2 relationships can rely on fabricated ownership/time under that wrong deployment. The frontend rejects a future registration timestamp during history cross-check, so malicious dependency data can also make a successfully created relation unreadable in the UI.
- **Action:** stop public deployment until chain, old address, independently verified source/runtime code, deployment history, immutable binding and known receipt/proof are approved. Current mainnet runtime hash observation is evidence from one RPC, not independent verification. Immutable binding cannot be repaired after deploying to the wrong address.
- **Coverage:** `security-review.test.mjs`, malicious registry and malformed/inconsistent return tests. No Solidity or ABI modification made. A future contract policy change requires approval.

## R2 — P2: account changes did not invalidate an approved asynchronous preflight (fixed)

- **Locations:** `components/local-version-history.tsx:118`, `:160`; `lib/local-version-registry.ts:74`.
- **Condition:** a slow local simulation/check is in flight, and selected wallet changes A → B → A before the final pre-send check.
- **Reproduce before fix:** `node tests/version-security-browser.mjs --baseline` held the actual `createWork` simulation, switched accounts twice, then released it. One real local transaction was sent; the Create Work button had also become enabled while that preflight remained pending.
- **Impact:** an obsolete local approval could continue after disconnection; a second confirmation/rejection could misrepresent what had already been approved. No public signer exists in this module.
- **Fix:** capture monotonic request epoch, require it before writing, preserve the lock until preflight completes, and reject new approval requests while approval is active.
- **Regression:** default `version-security-browser.mjs` confirms zero sends, no reopened transaction button, and no navigation to a successful work. `--baseline` is forensic pre-fix mode and is expected to fail against fixed code; do not use it as the normal regression command.

## R3 — P2: late connection response overwrote the selected wallet (fixed)

- **Location:** `components/local-version-history.tsx:106`.
- **Condition:** A's account lookup is delayed; user selects/connects B; A's response arrives later.
- **Reproduce before fix:** held the first `eth_accounts`, connected B, then released A. A's Ready to Create state replaced B's unauthorized state.
- **Impact:** visible wallet state diverged from the user's latest selection.
- **Fix:** connection request sequence is invalidated by a newer connection, disconnect, account selection or unmount; late responses and errors are ignored.
- **Regression:** default `version-security-browser.mjs` keeps the newer wallet and sends no transaction.

## R4 — P2: raw local unlocked RPC bypasses the application's confirmation UI (open infrastructure limitation)

- **Locations:** `tools/local-evm/start.mjs:12`, `tools/local-evm/node.mjs`; `lib/local-version-registry.ts:14`.
- **Condition:** a client can reach the running local RPC. Browser exploitation additionally depends on local-network access permissions and browser policy; a raw HTTP client is sufficient.
- **Reproduce:** the contract security suite starts its own disposable server on a random loopback port. A POST with `Origin: http://untrusted-review.invalid` obtains unlocked accounts and submits a zero-value local transaction. Actual receipt status is success and `Access-Control-Allow-Origin` is `*`. It does not use/reset the user's running node.
- **Impact:** local records/balances can be changed without the Next confirmation dialog. Development RPC methods may also permit reset/state modification. Production Next route denial does not secure a separately running Hardhat node.
- **Action:** treat this as disposable trusted local infrastructure, never fund/import these accounts into real-wallet workflows, keep exact loopback binding, close the node when unused. Before testing a real wallet adapter, isolate the browser profile and accounts; evaluate a separate authenticated/restricted RPC facade or locked-account node if protection from local clients is required. CORS alone is not authentication.
- **Coverage:** executable HTTP/service-level counterexample; not a claim that every browser can bypass local-network access protections. No RPC infrastructure redesign performed.

## R5 — P3: valid deployment without samples looked like an RPC failure (fixed)

- **Location:** `components/local-version-history.tsx:57`.
- **Condition/reproduction:** serve an otherwise valid local manifest with `samples: []`. The old `samples[0].hash` access threw.
- **Impact:** usable contracts were shown as unavailable.
- **Fix:** optional first fixture with an empty hash input fallback. Sample metadata is not required for canonical contract reads.
- **Coverage:** browser regression loads controls with an empty input and no RPC-offline error.

## R6 — P3: duplicate hint only inspects loaded versions (open UX limitation)

- **Locations:** `components/local-version-history.tsx:100`; `lib/local-version-registry.ts:32`.
- **Condition:** work has more than ten versions; select a hash already linked in an unloaded page.
- **Reproduction by code path:** candidate check searches only `versions.some`; initial history fetch returns ten entries. Such a hash can show Ready until simulation rejects it as `HashAlreadyLinked`.
- **Impact:** misleading readiness, not duplicate storage or an authorization bypass. Contract membership and simulation remain authoritative.
- **Recommendation:** query existing `isHashLinked` during candidate validation, with request cancellation. Deferred to avoid expanding this review's edits. Not separately exercised with an 11-version browser fixture; contract duplicate behavior and 100-version reads are tested.

## R7 — P3 / known semantic limit: registered zero hash is allowed

- **Locations:** `contracts/ChainProof.sol:18`; `contracts/ChainProofVersionRegistry.sol:89`.
- **Condition/reproduction:** zero bytes32 is absent → V2 reverts. Register zero in the local old contract with A → A can create its work.
- **Impact:** registration does not prove that a file was supplied or that its bytes actually hash to the registered value. This also applies to arbitrary nonzero bytes32 submitted directly to the original contract.
- **Action:** document legacy semantics. Rejecting zero alone does not prove file possession and would change policy; no change made.
- **Coverage:** explicit mined test for absent and legitimately registered zero, plus invalid bytes32 client encoding rejection.

## Remaining unscored prerequisites

- Shanghai opcode compatibility with BOT has not been independently established. The local compiler explicitly targets Shanghai; obtain target-node/operator evidence and approved read-only simulation before public deployment. Solidity's [0.8.20 release notes](https://www.soliditylang.org/blog/2023/05/10/solidity-0.8.20-release-announcement/) describe the compatibility concern.
- Works discovery retains every matching ID in memory/DOM; ranges and retries bound individual requests, not total wallet-history growth. Detail pages add ten versions at a time, but accumulated display grows. No million-record browser stress test was performed.
- No actual real-wallet adapter was tested for V2, nor replacement/dropped transaction/reorg finality policy. Local confirmation is not public-chain finality.
- Source/bundle credential scans found no matching secrets, but cannot prove absence in all Git history, ignored files, extension stores or future deployments. No real wallet store was accessed.
- Timestamp/sequence data prove registered wallet assertions and association order. They do not prove original authorship, copyright, identity, file creation time or derivation between versions.
