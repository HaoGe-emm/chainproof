# ChainProof

**Make digital work verifiable.**

ChainProof creates verifiable provenance records for digital work on BOT Chain, linking a file fingerprint to a registered wallet and blockchain timestamp.

**Live Demo:** [chainproof-two.vercel.app](https://chainproof-two.vercel.app)

ChainProof 2.0 is deployed on Vercel. This release includes single-file registration, verification, wallet history, and public proof certificates.

## Problem

AI-generated content, digital creation, and online collaboration make files easy to generate, copy, and modify. Independently checking whether a file matches a previously registered version is harder, especially when the only record belongs to a single platform.

## Solution

ChainProof follows a simple flow: **Create Proof → On-chain Registration → Verify Provenance**.

1. Compute the file's SHA-256 fingerprint locally with the browser's Web Crypto API.
2. Register that fingerprint on BOT Chain through a MetaMask transaction.
3. Share a public certificate backed by the contract's registration record.
4. Recompute a file's fingerprint to check whether its bytes match the registered version.

Raw files never leave the browser. The contract records the fingerprint, registering wallet, and registration timestamp; it does not store the file itself.

## ChainProof 2.0 Features

| Feature | What it does |
| --- | --- |
| **Create Proof** | Select or drag a file, calculate its fingerprint, and register it through MetaMask. Detect an existing registration before submitting; display transaction results and BOTScan links. |
| **Verify Provenance** | Look up a locally calculated fingerprint and show the registered wallet and time when a record exists. No wallet is required. |
| **My Proofs** | List the connected wallet's registrations from real `ProofRegistered` events, with incremental block scanning, pagination, copy actions, and transaction links. Loading, partial results, and RPC errors are distinguished from an empty history. |
| **Proof Certificate** | Open a public `/proof/[hash]` page showing the fingerprint, registered wallet, timestamp, contract, and network without connecting a wallet. |
| **Verify Your Copy** | Compare a locally selected file against a certificate's registered fingerprint. Show **MATCH** or **MISMATCH** only after the registration has been loaded successfully. |
| **QR Code** | Share the certificate URL through a QR code generated for the current site's origin. Local preview links are explicitly identified as unsuitable for public sharing. |
| **Print / Save as PDF** | Use the browser's print dialog and A4 certificate layout to print or save a copy of the displayed record. |
| **Local SHA-256 hashing** | Use `crypto.subtle.digest("SHA-256", ...)` and output a 64-character hexadecimal fingerprint. No file upload is needed. |
| **Wallet and responsive UI** | Connect MetaMask, handle account/network changes, and use the proof workflow on desktop or mobile layouts. |

Opening a certificate confirms the **Registered** record, not a file match. Its copy status starts at **NOT CHECKED** until a file is selected. A missing record or RPC failure cannot produce a verified MATCH.

## Why BOT Chain?

BOT Chain provides the public registration record rather than acting as file storage. The deployed Solidity contract associates each fingerprint with the transaction sender and blockchain timestamp, and emits an event that supports wallet history queries.

Anyone can query the contract independently of ChainProof's interface. BOTScan exposes registration transactions, while the frontend uses viem to read contract state and prepare wallet transactions. ChainProof does not maintain a database of proof records.

Registering a new proof is a **real mainnet transaction** and requires BOT for gas. Reading a record or verifying a file uses RPC queries without a wallet signature or transaction gas payment.

## Mainnet Deployment

| Setting | Value |
| --- | --- |
| Network | BOT Chain Mainnet |
| Chain ID | `677` |
| RPC | `https://rpc.botchain.ai` |
| Native currency | BOT |
| Contract | `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052` |
| Contract explorer | [View contract on BOTScan](https://scan.botchain.ai/address/0xC64CEF65ccd720664cc3bfd7D970b6F866E53052) |

The production proof workflows use this original ChainProof contract. They do not fall back to Bohr Testnet or a local Hardhat chain.

### Real Mainnet Proof

The [read-only evidence report](docs/botchain-readonly-evidence.json), checked on October 13, 2026, records a successful registration receipt and matching `ProofRegistered` event and `getProof` result:

- **Transaction:** `0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc`
- **Transaction explorer:** [View the successful registration on BOTScan](https://scan.botchain.ai/tx/0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc)
- **File fingerprint:** `0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625`
- **Registered wallet:** `0x89F415bb42e356E8b892C10B05522e0a8Ef151F3`
- **Registration time:** October 8, 2026, 02:24:03 UTC
- **Registration block:** `25922443`
- **Public certificate:** [Open the real mainnet proof certificate](https://chainproof-two.vercel.app/proof/0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625)

The certificate can be inspected without the original file. Testing MATCH for this specific record requires a file with that exact fingerprint; opening its link alone does not verify a copy.

## Smart Contract

The [original ChainProof contract](contracts/ChainProof.sol) exposes:

- `registerProof(bytes32 fileHash)` — register a fingerprint once under `msg.sender` at `block.timestamp`. Duplicate registration reverts with `"Proof already exists"`.
- `getProof(bytes32 fileHash)` — return `(address owner, uint256 timestamp, bool exists)`; `exists` is determined by `timestamp != 0`.
- `ProofRegistered(bytes32 indexed fileHash, address indexed owner, uint256 timestamp)` — identify the registered fingerprint, wallet, and timestamp for event queries.

The SHA-256 fingerprint is the mapping key; the stored proof contains the registering wallet and timestamp. Title and Proof Type are interface fields, not permanent on-chain metadata or certified facts.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **File hashing:** browser Web Crypto API, SHA-256
- **Blockchain integration:** viem and MetaMask
- **Contract:** Solidity on BOT Chain Mainnet
- **Certificate sharing:** QR codes and browser printing
- **Hosting:** Vercel, Node.js 24.x

## Running Locally

Use **Node.js 24.x** and pnpm. The repository uses `pnpm-lock.yaml` for reproducible dependency installation:

```bash
pnpm install --frozen-lockfile
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To check and run a production build:

```bash
npm test
npm run lint
npm run build
npm run start
```

No wallet private key or seed phrase is required in project configuration. Verification and public certificates do not require MetaMask. Create Proof requires MetaMask connected to BOT Chain Mainnet and BOT for gas, even when the frontend runs locally. File hashing requires a secure browser context, such as HTTPS or localhost.

## Demo Flow

### Inspect a proof without a transaction

1. Open the [public mainnet certificate](https://chainproof-two.vercel.app/proof/0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625).
2. Inspect its registered wallet, timestamp, and fingerprint; cross-check the linked mainnet transaction.
3. Copy the certificate link, scan its QR code, or use **Print / Save as PDF**.
4. Use **Verify Your Copy** to select a local file. An unrelated file shows MISMATCH; MATCH requires the exact registered bytes.

### Create and verify your own proof

1. Connect MetaMask and confirm BOT Chain Mainnet, Chain ID `677`.
2. Open **Create Proof** and select a file. Its bytes are hashed locally.
3. Review the fingerprint and approve the registration transaction in MetaMask. This spends real BOT for gas.
4. Wait for a successful receipt and inspect the BOTScan transaction link.
5. Open **My Proofs**, then share the corresponding public certificate.
6. Select the original file in **Verify Provenance** or **Verify Your Copy**.
7. Change one character in a text file and compare it with the same certificate: the changed bytes produce a different fingerprint and MISMATCH.

A changed file may have its own separate registration. **No Matching Proof** means its current fingerprint was not found in this contract; it does not by itself establish that a file was modified.

## Use Cases

- Version-specific records for AI-generated content
- Hackathon submission fingerprints
- Research report and dataset integrity checks
- Digital artwork and creative deliverables
- Comparing delivered files against a previously registered copy

## Privacy and Proof Boundaries

- **Raw files stay in the browser.** ChainProof does not upload or persist their contents. Filenames, Title, and Proof Type are not sent to the contract.
- **Registration metadata is public.** Fingerprints, registering wallets, timestamps, and transaction history are visible on-chain. Known or guessable content can sometimes be identified by comparing hashes.
- **A proof identifies a registration, not a person.** The contract records which wallet registered a fingerprint and when. It cannot establish real-world identity, authorship, copyright, originality, or the truth of the content.
- **A timestamp is the blockchain registration time.** It is not a verified creation date. Someone can register another person's publicly available file first.
- **Verification compares bytes.** A matching fingerprint supports file integrity against that registered version; it cannot recover the original file or its name.
- **A certificate is a view of the record.** A QR code or printed PDF does not independently certify ownership or replace checking the live contract record and comparing the file.
- **Availability depends on network services.** RPC failures are shown as errors, not treated as missing proofs. A successful transaction receipt is not a guarantee against every possible chain reorganization.

## Historical Testnet Deployment

An earlier deployment used Bohr Testnet: Chain ID `968`, RPC `https://rpc.bohr.life`, contract `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052`, and [testnet explorer](https://scan.bohr.life). This is historical information only; the current production frontend uses mainnet exclusively.

## Hackathon

Built for **ETH Wuhan 2026** and **BOT Chain BUILD BEYOND 2026**.
