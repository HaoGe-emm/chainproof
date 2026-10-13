# BOT Chain EVM compatibility — 4C-3

Assessment date: **2026-10-13**. Read-only public observations and isolated local experiments; no public deployment or transaction was sent. This is not a professional audit.

## Evidence and limits

| Question | Evidence | Conclusion |
| --- | --- | --- |
| Network | Official quick guide; `eth_chainId` | Mainnet 677; Bohr testnet 968 |
| Berlin | EVM claim; old contract storage/calls work | Full EIP-2929/2930 pricing and semantics not independently established |
| London | BASEFEE probe passes; base fee field; type-2 transactions observed in mainnet blocks 26531128/26531129 | Selected London features demonstrated, not the complete fork |
| Paris | Paris-target V2 constructor simulation works | Compiler target compatibility evidence; Ethereum Merge consensus/PREVRANDAO semantics not confirmed |
| Shanghai / PUSH0 | Pure PUSH0 probe passes; Shanghai-target constructor returns runtime | PUSH0 demonstrated on this RPC at the sampled block; not proof of all Shanghai rules |
| Cancun | MCOPY, transient storage round trip, BLOBBASEFEE probes pass; blob fields present | Selected Cancun instructions demonstrated; full fork activation, limits and blob transaction lifecycle unverified |
| Exact active fork | No authoritative chain-677 activation schedule located | **Unknown**; do not label the chain fully Cancun/Shanghai certified |
| Pricing | `eth_gasPrice`, priority fee, fee history | Observed quotes, not a permanent tariff |
| Finality | safe/finalized tags respond; official Parlia/fast-finality description | No officially recommended application confirmation number established |

The official RPC documentation describes Parlia/FFG and EIP-4844, but also says mainnet `eth_getLogs` is disabled. Actual historical filtered queries succeeded. Documentation and endpoint behavior therefore differ; availability must be rechecked before release. Marketing descriptions and a generic EVM label cannot resolve the activation schedule.

## Mainnet observations

Full run started **2026-10-13 09:12:42 UTC (17:12:42 China time)**. Snapshot block **26531131**, hash `0x5ddc9d541f8d32e0d914f8d00773864c6073c3ffafa8be94174844153e74ad17`. Client string: `Geth/v1.5.13-7ebdbab3-20260822/linux-amd64/go1.26.5`. This string is self-reported, not binary attestation.

- Genesis: `0x161a4ff8b4c95e95b314899c4ea8f9782c4ae8851362ffe0d47c0b8a05f7b784`.
- Gas limit 35,000,000; sampled base fee zero; gas-price/priority quote 20,000,000,000 wei. Five-block reward percentiles included 20–22 gwei.
- `eth_call` probes: BASEFEE returned zero; PUSH0 returned a zero word; zero-length MCOPY succeeded; TSTORE/TLOAD returned one; BLOBBASEFEE returned one.
- Paris-200 V2 constructor simulation returned 2,554 bytes; Shanghai-200 returned 2,517 bytes. Both queried the genuine old registry in the constructor. Corresponding estimates: 648,806 and 641,110 gas. These are simulations/estimates, **not deployed contracts or measured public receipts**.
- `eth_getLogs` with contract + known Hash topic returned the same one event for spans 1, 100, 10,000 and 10,001 blocks. No maximum span/result-volume limit was established; this is a sparse-history test. Requests include timings in raw evidence.
- Known registration receipt was read twice with matching block Hash.

Node direct HTTP timed out for mainnet. Normal Windows HTTP succeeded without changing TLS validation or PowerShell execution policy. This is an observed local connectivity issue, not proof the chain was down. The transport supports only fixed official URLs and explicitly enumerated read/simulation methods. It has no wallet, signer or broadcast path.

## Compiler and instruction experiments

Installed Solidity **0.8.20+commit.a1b79de6.Emscripten.clang**, Hardhat **3.19.0**. Stable local compiler remains optimizer enabled, 200 runs, Shanghai, no viaIR. Defaults are IPFS bytecode metadata, appended CBOR, literal-content embedding disabled. Experimental inputs explicitly record those options. Constructor parameter is the **same-network original Registry address**, immutable at runtime.

| Target / optimizer | Creation bytes | Runtime bytes | Constructor / runtime PUSH0 | Local deploy gasUsed | Create Work | Add V2 |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Paris / 200 | 3024 | 2554 | 0 / 0 | 641745 | 151383 | 108109 |
| Shanghai / 200 | 2973 | 2517 | 14 / 37 | 634299 | 151369 | 108095 |
| Paris / 1 | 2999 | 2529 | 0 / 0 | 636333 | 151468 | 108232 |
| Shanghai / 1 | 2947 | 2491 | 14 / 38 | 628688 | 151453 | 108217 |
| Paris / disabled | 6401 | 5426 | 0 / 0 | 1264580 | 154885 | 111272 |

All five compiled and executed 100-version scenarios on isolated in-process chain **31339**. ABI/storage layout match between Paris-200 and Shanghai-200; recompilation of identical inputs produced identical bytes. Shanghai bytecode reverted on a pre-Shanghai `merge` VM, while Paris worked. This is a local incompatibility demonstration, not a public chain test.

Disassembly steps over PUSH1–PUSH32 operands and uses compiler source-map instruction counts to exclude embedded runtime, literal pools and CBOR. A `0x5f` byte in operand/metadata is not counted as an instruction. The emitted instruction set is static analysis, not a reachability proof. Immutable address slots are patched during construction: deployed/simulated runtime Hashes depend on constructor arguments; unpatched compiler runtime alone is insufficient for identity verification.

**Recommendation:** retain the stable configuration now. Paris-200 is a conservative candidate if network fork evidence remains incomplete (no PUSH0, +7,446 local deployment gas and +14 gas per fixture write versus Shanghai). Shanghai-200 has positive RPC evidence but still requires approved testnet deployment and authoritative activation information. No permanent compiler target change was made; it requires user approval.

## Public repository evidence

Candidate public repository `BOTChain-bot/BOTCHAIN`, inspected commit `f285cf699eb9dfb2e5fd373059cca2ce80d26268` (2026-02-25), contains Shanghai/Cancun VM implementations. Its `params/config.go` contains Rialto 968 and other networks but no chain-677 activation schedule. The official node guide links a different deployment repository. We did not establish that this candidate is the live chain's authoritative source or binary. **Do not transfer BSC/56 or Rialto/968 fork settings to BOT/677.**

## Reproduce and artifacts

```powershell
npm run compile:compatibility:local
npm run test:compatibility:local
npm run check:botchain:readonly -- --system-http --mainnet-only
```

The HTTP fallback requires existing PowerShell 7; it does not bypass execution policy. Outputs use exclusive UUID/timestamp directories under ignored `.local-evm/compatibility/`. Stable ABI, artifacts and production network files are untouched. See `botchain-readonly-evidence.json` for shareable facts and artifact integrity hashes. Raw evidence includes failed attempts; they were retained.

## Sources (checked 2026-10-13)

- [BOT official quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/)
- [Official JSON-RPC guide: limitations and consensus](https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/)
- [Official blob API: safe/finalized tags](https://dev-docs.botchain.ai/docs/Developers/blob-api/)
- [Official node guide](https://dev-docs.botchain.ai/docs/Developers/bot-chain-node-configuration-best-practices/)
- [Candidate repository, pinned commit](https://github.com/BOTChain-bot/BOTCHAIN/tree/f285cf699eb9dfb2e5fd373059cca2ce80d26268)
- [Solidity 0.8.20 release: default Shanghai/PUSH0](https://www.soliditylang.org/blog/2023/05/10/solidity-0.8.20-release-announcement/)
- [Geth eth namespace: read simulation semantics](https://geth.ethereum.org/docs/interacting-with-geth/rpc/ns-eth)

Raw mainnet run: `.local-evm/compatibility/2026-10-13T09-12-42-217Z-401afe4c/mainnet-readonly.json`. Earlier successful local matrix: `.local-evm/compatibility/2026-10-13T08-31-19-959Z-822f6c74/local-results.json`. Explorer GET records: `.local-evm/compatibility/web-evidence-20261013/`.
