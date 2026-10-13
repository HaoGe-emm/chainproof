# Separate V2 registry — design only

No deployed address, ABI export, Solidity build artifact, deployment script or callable wallet write path exists for this design. The original ChainProof contract is unchanged. This document is a technical option, not reviewed or deployable contract code.

## Proposed interface (notation only)

```
constructor(oldProofRegistry)
createWork(bytes32 metadataDigest) -> workId
appendVersion(uint256 workId, bytes32 fileHash,
              uint256 expectedPreviousVersionId, bytes32 metadataDigest) -> versionId
getWork(uint256 workId) -> creator, controller, createdAt, count, head, metadataDigest
getVersion(uint256 versionId) -> workId, ordinal, hash, previousId, associatedAt, metadataDigest
getVersionIds(uint256 workId, uint256 offset, uint256 limit) -> ids
```

Constructor must reject zero/non-contract old registry and verify the expected interface; construction belongs to an approved future deployment. Network ID + old address must be checked in deployment tooling. An immutable old registry reference cannot be swapped by admin. `createWork` is open to any sender, sets creator=controller=sender, increments work ID; no title string or arbitrary creator address. Counts/IDs need documented bounds before selecting integer widths. There is no proxy, admin, controller transfer or metadata edit in the proposed minimum.

## Minimal state

- `immutable oldProofRegistry` implementing `getProof(bytes32)`.
- `nextWorkId`, `nextVersionId`, starting at 1; 0 denotes no work/version.
- `works[id] = {creator/controller, createdAt, count, head, metadataDigest}`.
- `versions[id] = {workId, ordinal, fileHash, previousId, associatedAt, metadataDigest}`.
- `versionIds[workId]` append-only index; bound pagination (e.g. limit <= 50; decide in implementation).
- `linked[workId][fileHash]` prohibits duplicate hash within work. No global exclusivity.
- Original registration wallet/time are obtained from old immutable records, not trusted inputs; association sender is explicitly emitted. Read availability of the old registry is a dependency.

## Atomic append algorithm

1. Require existing work and sender == immutable controller.
2. Require expectedPreviousVersionId == work.head, and no existing linked hash in work.
3. Perform a typed `view` call to old `getProof(fileHash)`; revert on read failure, absent proof, zero timestamp or owner != sender. Do not allow caller to bypass these checks with supplied proof data.
4. Allocate version ID and ordinal = count + 1. Store previous = head, associatedAt = block.timestamp, immutable metadataDigest. Enforce safe casts/bounds; timestamp cannot replace old registeredTimestamp.
5. Set linked, append ID, update head/count, emit event. All actions revert atomically if any check fails.

No signature scheme is needed for the minimal direct sender model. For later multi-wallet cooperation, an append would require both an authorized contributor and that contributor's old proof ownership, plus a clearly defined approval/consent policy binding work/hash/parent. Inviting a wallet never lets the controller append that wallet's proof without consent. Typed signatures would need nonces, deadline, chain ID, contract domain and contract-wallet verification; not implemented or approved in 4A.

## Events and query design

```
WorkCreated(uint256 indexed workId, address indexed controller,
            uint256 createdAt, bytes32 metadataDigest)
VersionAssociated(uint256 indexed workId, uint256 indexed versionId,
                  address indexed registeredWallet,
                  bytes32 fileHash, uint256 ordinal,
                  uint256 previousVersionId, uint256 associationTimestamp,
                  bytes32 metadataDigest)
```

Topics: work/controller for work discovery; work/version/wallet for association. File hash is in event data because only three indexed arguments are available without an anonymous event. Duplicate lookup uses `linked`, not an unbounded log scan. Public detail uses canonical mappings/pagination; discovery scans confirmed logs from V2 deployment block. Preserve tx hash/block/log order from receipts; late/partial RPC failures never mean empty history. Document unknown registry as unsupported rather than falling back to another chain.

## Security test plan for 4B

Use only a local in-process EVM with a mock old registry and throwaway local accounts. Network calls to mainnet must be disabled in contract tests. No local EVM dependency was installed for 4A because there is no executable Solidity draft.

- Anyone creates own work; cannot set creator to another account; ID 0 missing.
- A controller appends own existing proof; old timestamp preserved by reads; new association time distinct.
- A third-party controller cannot append another wallet's proof; missing work/proof and failed old read revert.
- Repeat hash in same work reverts; same authorized hash in another work allowed.
- Wrong previous head, stale concurrent append and ordinal overflow revert without sequence gaps.
- Noncontroller cannot append even if that wallet registered the hash; invited/collaborator wallets have **no** permission in minimal design.
- Property tests: head points to latest entry, ordinal == index+1, parent matches preceding entry, all hashes unique in work, every associated hash owner equals controller, no deletion/edit path.
- Event arguments match canonical state, page boundaries terminate correctly, first vs subsequent append gas measured.
- Verify source-boundary and no role/admin/upgrade escape hatch; review compiled storage/bytecode before deployment.

## Upgrade/migration constraints

Deploying a future registry creates a new locator and timeline; it does not modify old registry state. Old work and certificate URLs must remain source-bound and readable. A new registry may reference old work entries via explicit provenance and fresh authorization, but cannot claim a fresh association happened at an old timestamp. Key recovery/controller transfer and fork resolution require new policy and tests; they cannot be added silently after immutable deployment. Multi-wallet works, branches and editable descriptions are intentionally excluded from the minimum; choosing any of them reopens the design gate.
