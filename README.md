# ChainProof

ChainProof creates verifiable provenance records for digital work on BOT Chain.

## Problem

AI and digital creation make files easy to generate, copy, and modify. It can be difficult to independently verify whether a file matches a version that was registered earlier.

## Solution

- Files are hashed locally in the browser using SHA-256.
- Raw files never leave the user's device.
- Only the file fingerprint is registered on BOT Chain.
- Anyone can later verify whether a file matches the registered version.

## Features

- Local SHA-256 hashing
- MetaMask wallet connection
- BOT Chain smart contract integration
- Create provenance proofs
- Verify provenance
- Detect modified files
- BOTScan transaction links

## Use Cases

- AI-generated content
- Hackathon submissions
- Research reports
- Creative work
- Digital deliverables

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- viem
- Solidity
- BOT Chain

## Smart Contract

The [ChainProof contract](contracts/ChainProof.sol) exposes two functions:

- `registerProof(bytes32 fileHash)` registers a file fingerprint once and emits `ProofRegistered`. A duplicate registration reverts.
- `getProof(bytes32 fileHash)` returns the creator wallet, registration timestamp, and whether the fingerprint exists.

The contract stores the file hash as the mapping key, together with the creator wallet and registration timestamp. The Title and Proof Type fields in the UI are presentation fields; they are not stored on-chain.

## Mainnet Deployment

The frontend uses BOT Chain Mainnet for proof creation and verification.

- **Network:** BOT Chain Mainnet
- **Chain ID:** `677`
- **RPC:** `https://rpc.botchain.ai`
- **Mainnet Contract Address:** `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052`
- **Mainnet Explorer:** [BOTScan](https://scan.botchain.ai)
- **Native Token:** BOT

## Testnet Deployment

Historical Bohr Testnet deployment (not used by the current frontend):

- **Network:** Bohr Testnet
- **Chain ID:** `968`
- **RPC:** `https://rpc.bohr.life`
- **Contract Address:** `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052`
- **Explorer:** [BOTScan](https://scan.bohr.life)

MetaMask may show a different network or currency label for Chain ID `968`. This historical deployment is not selected by the current frontend.

## Running Locally

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run build` to check the production build. Creating a proof requires MetaMask and mainnet BOT for gas; verification does not require a wallet.

## Demo Flow

1. Connect MetaMask.
2. Upload a file through the browser picker; it is processed locally.
3. Click **Create Proof**.
4. Confirm the transaction in MetaMask.
5. Verify the same file on the **Verify Provenance** page.
6. Modify the file and select it again.
7. Verification fails because the fingerprint has changed.

## Privacy

Raw files never leave the browser. Only SHA-256 fingerprints are written on-chain. The file's contents, name, Title, and Proof Type are not sent to the contract.

## Hackathon

Built for **ETH Wuhan 2026** and **BOT Chain BUILD BEYOND 2026**.
