# ChainProof 2.0 release decision — 4C-3

Date: **2026-10-13**. Decision recommendation **A: first release ChainProof 2.0 without public Version History**. This assessment does not authorize a commit, push, Vercel release, network change or public transaction. Stage 5 has not started.

## A versus B

| Dimension | A: existing mainnet single-file product | B: public V2 first |
| --- | --- | --- |
| User value | File integrity check, public proof, wallet history, shareable certificate | Adds immutable grouping and ordered association history |
| Reliability | Reuses deployed registry and tested main flows | Adds new code/config, logs, finality and two-registry dependencies |
| Development | Release/config review and existing finality wording | Testnet acceptance, public client/reorg policy, deployment/verification |
| Cost | No new contract deployment | Deployment and every association; original registration also costs Gas |
| Maintenance | Existing RPC/certificate/product support | Permanent bindings, index scans, time/rights explanations, long histories |
| Security | Existing limits remain; no new authorization layer | Dependency identity and controller compromise/irreversible links |
| Hackathon | Working real mainnet demo with verifiable transaction | Richer timeline demo already possible clearly labelled on isolated local EVM |
| Demand | Single-file use cases already established in product | No evidence supplied of sustained public multi-version demand |
| Simpler alternative | Certificates for each registered version; user-maintained list labelled unverified | Necessary when independently verifiable on-chain grouping is actually required |
| Timing | Can prepare sooner after ordinary release review | Not justified to skip outstanding deployment gates |

## What can be included after normal release review

Homepage, Create Proof, Verify Provenance, My Proofs, Proof Certificate, Verify Your Copy, QR link, PDF/print and mobile improvements have existing tests/manual acceptance. Current-stage automated test and build results are in `chainproof-4c3-assessment.md`. Core mainnet address/ABI/network remain unchanged.

This does not certify that earlier uncommitted work is already in production, professionally audited or free of RPC/finality limitations. Before approving A: review the exact dirty-tree release diff, exclude private/local artifacts, preserve metadata privacy, recheck live single-file flows, and decide whether "Confirmed" should mean inclusion or the approved confirmation policy. No new public V2 address should be configured.

Version History `/works` remains a clearly labelled prototype. Real local `/local-evm` and `/metamask-local` writes are blocked in production even when environment/query flags try to enable them. The separately running loopback Hardhat RPC is not secured by these Next gates; keep it private and do not publish developer launch services. Decide whether to hide prototype navigation for public submission or retain its explicit demo-only explanation; no UI/config change was made this stage.

## Why not deploy immediately

Positive evidence: immutable append-only design, exercised authorization/atomicity, bounded append Gas, genuine old contract reads, selected Shanghai/Cancun opcode probes and constructor simulation. Missing: authoritative chain-677 fork schedule, approved real testnet deployment, exact old source/mutability verification, reliable event-service policy, public finality/replacement/reorg implementation and independent security review. In particular the wrong original-registry binding is a P1 deployment gate. It is not acceptable to treat ABI conformity or local tests as identity verification.

Choose B later if public grouping has demonstrated user value and these gates are closed, with explicit approval for compiler settings, testnet actions and a separate mainnet release. Choose C if new high-severity findings affect the already deployed single-file product or production config; none was demonstrated in this assessment's tested paths.

## Recommended sequence / approvals

1. User accepts this assessment and confirms A/B scope.
2. A release preparation: exact file/config review, approved finality terminology and prototype visibility, regression checks. No automatic publishing.
3. Separate approval for Git commit/push and Vercel production release.
4. If proceeding with B, separate approval for testnet wallet actions/funding/deployments and target settings; execute `version-history-testnet-plan.md` and review evidence.
5. Separate approval for permanent compiler/auth/ABI changes if any; then independent review and mainnet deployment checklist.
6. Only separately authorized mainnet deployment/signing/config activation may publish V2. Local/mainnet accounts and manifests remain distinct.

Local, in-process, non-destructive experiments can continue if requested. Public testnet transactions, mainnet deployment, repository publication and Vercel release are distinct approvals; no approval is inferred from successful tests or this recommendation.
