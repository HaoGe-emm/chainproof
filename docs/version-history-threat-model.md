# Version History threat model — 4A

## 4B controls implemented

The single-controller local V2 is now executable and tested. Atomic creation checks original ownership before creating any state; appends enforce controller, original proof owner/existence/time, unique per-work hash and exact previous number. Original reference is immutable; only two nonpayable write functions exist. No upgrade/admin/signature/deletion/transfer path or write loop. External reads use Solidity `view`/STATICCALL before any state update. Real reverted local transactions and adversarial return/mutation fixtures verify failure atomicity; a deterministic 60-step sequence verifies history invariants.

Local browser writes are locked to an exact loopback RPC and chain 31337, with deployment bytecode hashes, genesis/deployment block hashes and immutable binding checks, simulation, reviewed confirmation and exact receipt events. Public mainnet addresses are rejected in local manifests. Production is gated off. Local wallet selection is intentionally an unlocked development account selection, not human identity authentication. Loopback Hardhat RPC exposes developer accounts; malicious local software or websites may reach it, so never fund these accounts, expose the port or treat this as hardened wallet infrastructure. No fork is used.

UI history and labels distinguish Prototype/Demo, actual Local EVM records and existing Mainnet proofs. RPC error never becomes empty history; switching accounts cancels prior scans. Public local work reads need no wallet; original registration time and association time have separate sources. Local transactions have no misleading BOTScan/certificate links. Source/metadata and IP-rights limitations below remain relevant. See `version-history-security-review.md` for residual risks; this is not a professional audit.

Protected facts: old registry owner/time/hash, future authorized association sender/time/order, and accurate UI source labels. Unprovable claims: authorship, copyright, real-world identity, actual creation time and causal derivation between files. A hash commits bytes, not the meaning or legitimacy of content.

| Threat / misleading claim | Attack or failure | Mitigation / remaining limit |
| --- | --- | --- |
| Linking another wallet's hash | B claims A's registration as B's prior version | Proposed C requires caller == controller == old registeredWallet. Local simulation cannot establish authorization; 4A never attaches real proofs to demo works. Future collaboration requires specific owner consent, not a broad role alone. |
| Impersonating an author | An attacker registers copied bytes first | Say Registered Wallet, not Verified Author; no copyright/identity claims. Existing unique-hash registry has no dispute or ownership correction. Legitimate authors may be unable to register an already claimed hash; this cannot be fixed by association. |
| Wallet theft | Attacker makes valid appends with stolen keys | Explicitly state wallet control does not prove human identity. No key/seed handling; no automatic signatures. Immutable bad appends remain public; recovery/dispute policy is unresolved. |
| Wallet loss | Controller can no longer append | Past data readable; no automatic recovery/admin bypass. Controller transfer alone cannot transfer old proof ownership. Multi-signature or recovery requires separate consent and review. |
| Fake version order | User inserts newer-created file as version 1 | Sequential append + expected head proves append order only. Show association order and user-provided labels; never equate with creation chronology. |
| Timestamp misreading | Register date displayed as creation/association date | Separately label old registry registeredTimestamp, V2 associationTimestamp, work.createdAt and optional user-claimed date. Local times are device timestamps; mock registration dates are fixtures. Block time is not independent creation evidence. |
| Metadata tampering | Editing titles/descriptions/storage | Local fields explicitly User-provided · Local; validate storage schema and fixture membership. C optional immutable digest detects changed committed bytes but doesn't prove their truth or availability. No raw HTML rendering. |
| Database abuse | Operator rewrites rows, deletes consent or impersonates wallet | If B chosen: server verifies domain/nonce/expiry/chain signatures, enforces ACLs and verifies old proof owner, maintains audit/versioned backups; offer independent signature verification. Availability and unsigned statements remain service-dependent. |
| Frontend misrepresentation | Demo becomes Registered on Mainnet in UI | Separate types, store namespace and sections. Demo proof buttons reveal synthetic facts instead of opening certificates for unregistered fixtures. Real certificate links require live confirmed old proof. Bad/RPC-failed reads never promote to verified. |
| RPC lies / partial logs / reorg | Incomplete history shown as complete or fabricated records | Chain/contract-bound reads; bounded confirmed logs; partial/error labels; future canonical state cross-check and optional independent explorer/provider. A single RPC can lie; confirmations are not absolute finality. |
| Race / stale parent | Two concurrent appends silently reorder intention | Expected head checked atomically; stale transaction reverts, user reviews new head. Handle wallet changes and receipt events as existing Create Proof does. |
| Duplicate or cross-work reuse | Same hash spammed or called exclusive property | Unique per work; allow authorized reuse in other works. Clearly state grouping is not exclusive ownership; measure spam/storage/Gas and bound queries. |
| Branch confusion | Conflicting successors called one canonical latest | No branching in minimum. Later branch IDs/parent DAG and explicit head selection policy required; newest never means truest. |
| Share link laundering | Local URL implies a publicly confirmed history | Prototype URL is device/origin-local; other devices show unavailable. No URL embeds private metadata. Future locator includes chain/registry; DB/local descriptions remain distinguished. |
| Metadata/hash privacy | Guessable content linked to wallets and work | Original files never uploaded; only local SHA comparison. Explain public fingerprints and future associations can reveal relationships; don't publish local labels without separate consent. |
| Storage poisoning/loss | DevTools alters fixture ownership; storage disabled/cleared | Whitelist known demo proofs, validate replay/IDs/order, fail visibly without overwriting malformed data. Storage denial switches to stated in-memory mode. Still untrusted and lossy; no security claims. |

## Explicit residual risks

No on-chain relation can independently establish that one file was genuinely derived from another. Same-wallet rules prevent linking someone else's *registration*, but cannot prevent that wallet registering copied material. Single-controller policy excludes multi-wallet works and cannot recover a lost old registration wallet. Permanent appends may contain mistakes. RPC trust, metadata availability and actual BOT Chain finality need further validation. 4A tests demonstrate model/UX boundaries, not smart-contract security.

## Abuse cases to keep in acceptance tests

Owner B attempts A's hash; controller A selects actor B; duplicate hash; missing fixture/hash; altered stored owner/hash/parent; mainnet proof loaded but never treated as a demo association; RPC failure after a prior successful lookup clears the prior candidate; a new browser opens a local work URL with no data; matching demo bytes never produces mainnet MATCH wording. No test connects a signer to mainnet.

## 4C-1 threat model update — 2026-10-12

The 4A alternatives above are historical context. The executable design remains the independent, immutable single-controller V2 described in the 4B specification; this review introduces no new authorization mode.

| Boundary | Executed attack or observation | Control / remaining assumption |
| --- | --- | --- |
| Original registry identity | A malicious ABI-compatible fixture passes the zero-hash probe, forges a registrant and supplies a future registration time; associations succeed. | The constructor cannot authenticate its dependency. Independently verify chain, original address and code before deployment; immutable binding then prevents address substitution. Do not describe the probe as registry authentication. |
| Registry availability / return integrity | Reverting, malformed and inconsistent returns fail without partial writes or ID consumption. | Typed STATICCALL and atomic EVM rollback fail closed. A malicious dependency can still deny service or lie consistently. |
| Local session intention | Switching A → B → A during preflight previously let a stale transaction continue; a delayed connect could restore an old selection. | Session invalidation and approval locks now reject stale pre-send work. Browser regression observed zero stale sends after the fix. Already submitted transactions remain real local transactions and cannot be cancelled merely by changing UI selection. |
| Raw developer RPC | A disposable loopback node accepted an unlocked-account send with an untrusted Origin and wildcard CORS. | The RPC is unauthenticated; Next gates protect the application, not this port. Browser local-network protections may constrain access, but are not a contract guarantee. Never fund these accounts; keep the server temporary and loopback-only. |
| Ordering under competing transactions | Two queued transactions with the same parent produced one success and one revert. | Exact predecessor comparison and receipt verification preserve intended linear order. Outsiders cannot append a different registrant's hash. |
| State consistency across wallets | 240 seeded actions exercised 3 wallets, 6 works and 30 hashes against an independent state model. | Bounded evidence for atomicity, uniqueness and immutable history; not formal verification or an exhaustive adversarial search. |
| Production entry points | Production config GET returned 404; unsupported methods returned 405; client-side flag spoofing caused no local RPC calls. | Authoritative NODE_ENV/development gates remain server-side. A compromised host or edited server environment is outside this UI boundary. |
| Large history / presentation | Writes at versions 2, 10 and 100 used equal gas in the local sample; timeline reads are paged. | Storage and event discovery still grow. Duplicate detection in only loaded rows can mislabel an unloaded duplicate as Ready; the contract still rejects it. |
| Target EVM compatibility | Local execution uses Shanghai; BOT support has not yet been established by this review. | Require target-chain opcode/bytecode compatibility evidence before public deployment; do not equate EVM-compatible or correct chainId with support for every compiler target. |

The zero bytes32 value is not independently forbidden by either contract. An absent zero hash fails; a legitimately registered zero hash follows the same authorization rules as other bytes32 values. This boundary does not imply knowledge of a real file with that SHA-256 digest.

Residual identity, copied-file, wallet compromise, rights-dispute and immutable-mistake risks remain unchanged. No test establishes real-world authorship or copyright, and no local outcome is a BOT Chain Mainnet version record. The review is not an independent professional audit and does not approve public deployment.
