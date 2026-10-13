# Version Registry local Gas measurements

Measured from real transactions in isolated Hardhat 3.19.0 EDR, chain 31337, Shanghai, no fork. Compiler: `0.8.20+commit.a1b79de6.Emscripten.clang`; optimizer enabled, 200 runs; no viaIR. Seed files: known UTF-8 local-version-1/2/3 fixture bytes; addresses and fields come from fresh local deployments. Run `npm run dev:version:local` or local node + `npm run setup:chain:local`; generated receipts and `.local-evm/gas.json` reproduce these measurements.

| Operation | Measurement | Gas |
| --- | --- | ---: |
| createWork(initial hash), including Version 1 | actual successful receipt gasUsed | 151,369 |
| addVersion 2 | actual successful receipt gasUsed | 108,095 |
| addVersion 3 | actual successful receipt gasUsed | 108,095 |
| getWork | eth_estimateGas for an equivalent transaction | 26,161 |
| getVersion | eth_estimateGas for an equivalent transaction | 31,030 |

Read estimates are **not actual browser fees**. Public eth_call queries do not create transactions or charge the querying wallet transaction Gas. They can still consume RPC resources. No fixed BOT amount or mainnet gas price is inferred from this local EVM.

## Storage / optimization / limits

Work uses two slots (controller + createdAt packed; count). Version uses two slots (hash; predecessor + association time packed). Each per-work linked hash uses one mapping value slot. Creation also advances global next ID; appending updates existing count and adds immutable version/membership slots. Original owner/time are read from original registry rather than duplicated, saving permanent storage at the expense of one read dependency.

No write loops; per-append execution is constant-size, though permanent state and discovery history grow. Combining controller/createdAt/count into a single slot with narrower reviewed integer widths is a possible future optimization, but would change bounds/layout and needs tests; not silently applied. Removing per-work membership would require an unbounded duplicate scan and is not acceptable. Removing expected predecessor would weaken concurrency semantics.

Fixture hash zero bytes, access warmness, block settings and target EVM pricing can change exact gas. A real chain may have additional costs/policies. Local ETH balances/prices are synthetic; mainnet cost must be measured/simulated against an approved deployment and current fee policy in a future stage, not assumed here. Mined reverts may consume Gas without successful state change.

## 4C-1 scaling check — 2026-10-12

`tools/local-evm/security-review.test.mjs` created a fresh original registry and V2 in an isolated in-process Hardhat EVM, then executed a real 100-version sequence. This did not reset the separately running interactive node or deploy to a public chain. Compiler settings remain Solidity 0.8.20, optimizer enabled with 200 runs, Shanghai, no viaIR.

| Operation | Successful local receipt gasUsed |
| --- | ---: |
| Create Work including Version 1 | 151,369 |
| Append Version 2 | 108,095 |
| Append Version 10 | 108,095 |
| Append Version 100 | 108,095 |

Output is saved to ignored `.local-evm/review/scale-gas.json`. Reproduce with `npm run test:contracts:local`; the measurements come from actual mined receipts rather than estimates. Equal append values in this fixture support the constant-size write design. They do not guarantee identical gas for every calldata value, execution context or target network.

The measured **last-ten-version storage read** loop took approximately **2.8064 ms** using an in-process provider. It is not an HTTP/public-RPC benchmark, does not measure the browser, and does not include the old-registry proof cross-checks. The frontend reads up to ten versions per page and performs one `getVersion` plus one `getProof` per entry: **20 contract reads for a full page**, in addition to work and environment checks. Its real latency depends on RPC round trips and failures; do not apply the in-process timing to it.

Work discovery still scans deployment-bounded event ranges and accumulates matching work IDs. Paging version details bounds each page, but total contract storage, log discovery and the rendered work list grow with use. Longer histories therefore create read/UI costs even while each append stays constant-size. Future public-chain preparation should measure representative remote latency, log limits and wallet histories and define a bounded list-loading policy.

No BOT gas price, fixed BOT fee or public deployment cost is inferred. The earlier `getWork` / `getVersion` estimates remain local execution estimates; browser `eth_call` does not charge the querying wallet a transaction fee. Shanghai compatibility on BOT Chain still requires separate evidence before any public deployment.

## 4C-3 comparative measurements — 2026-10-13

Five frozen-source experiments used Solidity0.8.20, Hardhat3.19.0 and fresh **in-process 31339** networks (`merge` for Paris, `shanghai` for Shanghai), no fork/listener. IPFS/CBOR metadata defaults explicitly recorded; no viaIR. Actual deployments and 100 append sequences were mined locally. No protected 31337/31338 node or public chain was written to.

| Target / optimizer runs | Deploy gasUsed | Create incl. V1 | Add V2 | Add V10 | Add V100 | getProof estimate | getWork estimate | getVersion estimate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Paris / 200 | 641745 | 151383 | 108109 | 108109 | 108097 | 26285 | 26164 | 31035 |
| Shanghai / 200 | 634299 | 151369 | 108095 | 108095 | 108083 | 26282 | 26161 | 31030 |
| Paris / 1 | 636333 | 151468 | 108232 | 108232 | 108220 | 26285 | 26141 | 31012 |
| Shanghai / 1 | 628688 | 151453 | 108217 | 108217 | 108205 | 26282 | 26138 | 31007 |
| Paris / disabled | 1264580 | 154885 | 111272 | 111272 | 111260 | 26909 | 27002 | 32253 |

The fixture is SHA-256(`Compatibility version N`); V100 calldata zero-byte differences explain the 12-gas difference. The earlier fixture still reproduced 108095 at V2/V10/V100 in the 27-test contract suite. There is no version-count-dependent write loop. Queries are estimates for equivalent transactions, **not fees charged for eth_call**.

Initial matrix: 20 sequential in-process reads (10 versions + 10 original proofs) took approximately 7.3–11.8ms; one indexed WorkCreated discovery query took 0.56–1.67ms. Repeat timings vary by host load. These do not include network round trips and cannot predict remote/browser latency. RPC raw evidence records per-request elapsed time including Windows HTTP process startup where applicable, so those timings also are not clean transport-only benchmarks. Sparse known-Hash historical scans spanning 1/100/10000/10001 blocks and a single-block owner-topic query succeeded; dense limits/rate reliability remain unmeasured.

Paris200 costs 7446 more deployment gas and 14 more gas per fixture write than Shanghai200. Runs1 saves deployment bytes/Gas but increases append cost; no obvious benefit justifies changing stable configuration or storage/permission rules now. Keeping membership mapping preserves bounded duplicate checks. Storage stays Work two slots, Version two slots, per-linked-Hash mapping slot plus counters. Data and discovery grow even though append execution stays bounded.

### Observed mainnet quote, not a paid fee

At mainnet snapshot **26531131**, inspection began **2026-10-13T09:12:42.221Z**, gas-price and priority-fee quotes were **20gwei**, sampled base fees zero, five-block reward percentiles included **20–22gwei**. Sources: fixed official RPC `eth_gasPrice`, `eth_maxPriorityFeePerGas`, `eth_feeHistory`; raw run linked in the compatibility document. A prior sampled mainnet block26530898 contained type2 transactions. This establishes observed fee support, not a fixed future price or full fee policy.

Illustration only: `local gasUsed × observed quote(wei/gas) ÷ 10^18`. Using Shanghai200 local Gas and the observed 20–22gwei percentiles gives deploy ~0.012686–0.013955 BOT, Create ~0.003027–0.003330 BOT, append ~0.002162–0.002378 BOT. This is **not a confidence interval, actual mainnet receipt cost or guarantee**; it excludes any unestablished chain-specific fee rules and future price changes. Original file registration is a separate transaction and is not included. Mainnet constructor estimates were 648806 (Paris) /641110 (Shanghai), which are simulations, not measured deployed Gas.

No mainnet fee was paid or public V2 deployed. Do not use these illustrations as a fixed quoted cost. Before future deployment, refresh fee policy/quotes/limits, simulate exact signed parameters and measure actual approved testnet receipts; mainnet still requires separate approval.
