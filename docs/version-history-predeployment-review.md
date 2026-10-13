# ChainProof Version History — 4C-1 部署前审查报告

报告完成日期：2026-10-13（Asia/Shanghai）。测试与链上只读证据采集日期：2026-10-12。
工作目录：`D:\HKS`；分支：`feature/chainproof-v2`。

## 1. 审查结论

在真实原 registry 的可信绑定前提下，本轮没有复现 V2 的 controller/登记钱包授权绕过、历史覆盖、同作品重复关联或前驱跳号。已复现并修复两处本地账户异步竞态及一处空样例配置错误；合约源码、授权规则、存储结构、公开 ABI 和版本语义未改动。

生产版本的本地页面与配置接口禁用检查通过，旧主网业务的源代码基线与浏览器回归通过。当前成果可提交人工验收，并作为下一步隔离本地钱包验证的基础；尚不满足直接公开部署的条件。

本报告属于开发安全审查，包含代码核查与可重复的本地攻击测试。它没有构成独立第三方安全审计、形式化证明或无漏洞承诺。

## 2. 问题分级

| 等级 | 发现和当前状态 |
| --- | --- |
| P0 | 本轮范围内没有演示成功的公共网络误写、真实凭据泄漏或重大授权绕过；未覆盖所有历史、设备、扩展与部署环境。 |
| P1 条件性影响 | 错绑兼容的恶意原 registry 时，可接受其虚假 owner 和未来登记时间。已用实际本地交易复现。这是部署可信前提，不能把构造函数探测当成依赖身份验证；正确绑定真实旧合约时未演示此攻击成立。公开部署须先通过依赖核验。 |
| P2 已修复 | A→B→A 账户切换后旧预检查继续发送；延迟连接响应覆盖新账户。修复后对应浏览器场景均为零发送。 |
| P2 保留 | 原始本地解锁 RPC 接受非预期客户端写入，跨来源响应为 `*`。这是本地测试基础设施的信任边界，Next 页面禁用无法保护独立 RPC。 |
| P3 已修复 | 合法 `samples: []` 被错误显示为 RPC 故障。 |
| P3 保留 | 追加前重复提示只搜索已加载的十个版本；未加载重复项仍由模拟调用和合约拒绝。零 Hash 如果由旧合约合法登记则可关联，属于既有 bytes32 语义。 |

详细条件、路径、代码位置、复现步骤、影响与建议见 [security-findings](version-history-security-findings.md)。没有为测试通过而更改 Solidity 核心设计。

## 3. Solidity 与关键不变量

审查范围包含原 `ChainProof.sol`、V2 源码、生成 ABI、事件 ABI、本地客户端、配置校验、三个本地页面、API 路由、交易状态组件、编译/部署/启动脚本、钱包和旧产品相关回归测试，以及 4A/4B 文档。

`createWork` 先调用旧 `getProof`，确认 exists、非零登记时间与 owner==sender，再原子创建 Work 和 Version 1。`addVersion` 要求目标存在、sender==controller==原登记钱包、Hash 未在该 Work 使用、预期前驱等于当前计数。事件由实际成功写入发出。

已验证的关键不变量：

1. 成功创建产生唯一递增 Work ID；失败创建不消耗 ID。
2. 每个 Work 的 controller 和创建时间不变；每个 Version 的 Hash、关联时间与前驱不变。
3. Version 从 1 连续递增，首版前驱为 0，后续前驱为 N-1。
4. 同 Work 内 Hash 唯一；满足授权的同 Hash 跨 Work 复用允许。
5. 失败交易不留下版本、membership、计数变化或成功事件。
6. 正常事件参数与可读取存储一致；前端 ABI 与编译输出一致。

外部读取使用 typed `view` 的 STATICCALL，发生在写入前，异常会整体回滚。测试中的外部状态写入尝试失败；合约没有可持久化重入写入的通路、转账、delegatecall、管理员、升级、删除、转移或修改历史入口。追加操作没有遍历历史的循环。uint64 版本上限通过测试专用存储注入验证；uint256 ID 采用 Solidity 检查运算。

STATICCALL 的限制见 [Solidity 官方 view functions 文档](https://docs.soliditylang.org/en/v0.8.20/contracts.html#view-functions)。恶意依赖仍可返回谎言、回滚或消耗可用 Gas，因此信任/可用性问题仍须单独处理。

## 4. 对抗性测试

新增八组实际本地 EVM 测试，和此前十五组一起运行：

- 直接发送交易绕过前端，尝试非 controller、他人的 Hash、不存在作品/Hash、重复 Hash、非法前驱与未登记零值。失败回执均回滚且没有事件或部分状态。
- 两笔同钱包交易在关闭自动挖矿后，以不同 nonce、相同预期前驱排队；同块执行结果为 success/reverted，只有一个新版本。
- 兼容恶意 registry 返回伪造 owner 与未来时间：实际成功，作为信任边界反例保存。
- 原 registry 回滚、错误 ABI、exists/时间不一致、零 owner：安全回滚且不消耗 ID。
- 零 Hash 未登记时回滚，合法登记后允许；非法 bytes32 长度由客户端编码拒绝。
- 三账户、六作品、三十 Hash，以三个随机种子执行 240 次混合操作，对照模型核查成功/失败、计数、controller 与全部不可变历史。
- 实际登记并关联 100 个不同 Hash，读取版本并测量 Gas。
- 独立临时回环 RPC 以不可信 Origin 获取解锁账户、发送零价值交易，验证 `Access-Control-Allow-Origin: *` 与真实成功回执。没有重置交互节点或使用真实钱包。

此前测试继续覆盖零地址/EOA/缺失接口构造参数、转发调用 sender 检查、STATICCALL 写入失败、整数边界、事件一致性与公开读取边界。随机测试有明确有限样本，未替代形式化验证。

## 5. 网络与生产隔离

旧业务固定使用 BOT Chain Mainnet chainId 677、`https://rpc.botchain.ai`、合约 `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052`。V2 本地客户端固定 chainId 31337、`http://127.0.0.1:8545`；不能通过 URL 或 manifest 改成公共 RPC。

本地 manifest 拒绝公共链、旧主网地址和占位地址；运行时进一步检查两个代码哈希、创世块、部署区块哈希及 immutable 原 registry 地址。manifest 自身是本地可信配置，不能用它证明受攻击部署进程的诚实。

独立生产预览使用 `127.0.0.1:3004`，即使运行时设置本地开关仍关闭本地功能。实际结果：配置 GET 404；伪造环境查询参数、Origin 与转发主机提示仍为 404；POST/PUT/PATCH/DELETE 为 405；三个本地页面均无连接/确认/创建按钮且不请求本地 RPC。配置接口只提供 GET，不是签名或交易代理。

本地启动器显式绑定回环 8545/3002，生产预览显式绑定回环 3004。系统 CIM 监听表查询受限，未为了检查扩大权限；以实际启动参数和回环访问作为证据，不声称完成所有防火墙/局域网渗透检查。再次启动器发现 3002 已被原进程占用，按设计退出，没有终止或重置原节点。

原始 Hardhat RPC 的解锁账户仍可由能够访问它的其他客户端使用。浏览器本地网络权限会影响网页能否访问，但不能把 UI 确认当成 RPC 鉴权。禁止给这些测试账户充值真实资产；进入钱包隔离验证前需确认浏览器配置和节点访问策略。

## 6. 旧主网兼容性与数据真实性

与审查开始时 SHA-256 文件基线对照，36 个 app/components/lib/contracts 文件中仅 `components/local-version-history.tsx` 有本轮变化。原合约、主网 ABI/地址/chainId/RPC、SHA-256、Create Proof、Verify、My Proofs、证书、钱包逻辑均保持一致。

实际只读查询确认 chainId=677、旧地址有代码，已知 getProof 结果为 owner `0x89F415bb42e356E8b892C10B05522e0a8Ef151F3`、timestamp `1791426243`、exists=true。真实存证交易 `0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc` 回执成功，事件的 fileHash/owner/timestamp 与 getProof 一致。

该存证交易区块为 **25922443**；已知原合约部署区块为 **25857169**，两者不能混用。单 RPC 观测的旧运行时代码哈希为 `0xf1737614e88192546a33fff680f0892d435fa13aa755d2f429f38d54aced73bc`。这尚不是独立源码验证或多来源一致性证明。

证书在无钱包浏览器继续公开读取；文件 MATCH/MISMATCH 与 RPC/不存在状态的测试夹具明确隔离，没有冒充主网记录。当前站点 QR、复制完整地址/Hash/链接、移动端及打印通过回归。生成 PDF 额外核查为一页，MediaBox 约 594.96×841.92 pt（A4）。旧钱包拒签、重复登记、回执恢复、账户切换、My Proofs 部分失败状态均通过隔离夹具测试，没有真实主网交易。

凭据检查：76 个非忽略文本文件与 23 个生产 JS bundle 的私钥/助记词/常见 Token 字面量模式扫描均未命中；没有发现 Git 跟踪的 env/key/keystore 文件，生产包未发现已知 Hardhat 开发密钥。仅出现库相关标识符，不等于密钥泄漏。扫描未覆盖所有 Git 历史与忽略文件，也未读取真实钱包存储或打印环境变量值。

## 7. Gas 与扩展性

Hardhat 3.19.0 EDR，chainId 31337，无 fork；solc `0.8.20+commit.a1b79de6`，optimizer 200，Shanghai，无 viaIR。

| 操作 | 本地成功回执 gasUsed |
| --- | ---: |
| Create Work + Version 1 | 151369 |
| Add Version 2 | 108095 |
| Add Version 10 | 108095 |
| Add Version 100 | 108095 |

每次追加与重复检查为固定量存储访问，未随 100 版历史增长；链上总存储仍持续增长。Work 占两个 slot，Version 两个 slot，membership 一个映射值。此前 getWork/getVersion 的本地估算为 26161/31030；不是浏览器支付费用。

最后十个 getVersion 的进程内读取耗时约 2.8064ms，不能套用到公共 RPC 或浏览器。实际前端一页十版执行二十次合约读取（每版 getVersion+getProof），另有环境和作品查询。作品事件从部署区块起按 500 块范围扫描，失败缩小范围/重试并显示部分结果；列表最终仍累积全部匹配 ID/DOM，未做海量钱包历史压力测试。应补充公开 RPC 延迟/范围限制与列表分页评估。

详细说明见 [Gas report](version-history-gas-report.md)。没有推算固定 BOT 费用。

## 8. 执行命令与结果

| 实际命令 | 结果 |
| --- | --- |
| `npm test` | 33/33，通过 |
| `npm run lint` | 通过；此项目脚本是 TypeScript `tsc --noEmit` |
| `npm run build` | Next.js 16.3.8 生产构建通过 |
| `npm run test:contracts:local` | 23/23，通过，约 75 秒 |
| `node tests/version-security-browser.mjs --baseline`（修复前） | 两处竞态成功复现，旧预检查发送一笔本地交易 |
| `node tests/version-security-browser.mjs`（修复后） | 竞态零发送、审批锁及空样例通过 |
| `node tests/local-version-browser.mjs` | 创建、V2/V3、真实本地回滚、权限、刷新、新浏览器恢复、离线/错链/缺合约、移动端与主网旧证书通过 |
| `node tests/local-production-gate.mjs` | 404/405、客户端参数攻击、三个页面禁用、零本地 RPC 请求，通过 |
| `node tests/product-browser.mjs` | 原产品隔离钱包/RPC 回归通过 |
| `node tests/certificate-browser.mjs` | 真实旧证书只读及隔离匹配/错误、QR、复制、打印、账户/请求竞态通过 |
| `node tests/version-review-evidence.mjs` | 主网只读记录/事件一致；备份六个本地作品、十六版 |
| 固定 solc 本地编译、`git diff --check` | 通过；目标 Solidity 编译无警告 |

浏览器使用已安装 Edge 与已有运行时 Playwright，通过 `PLAYWRIGHT_MODULE`、`CHAINPROOF_BROWSER_CHANNEL=msedge`、`CHAINPROOF_TEST_URL=http://127.0.0.1:3004` 指定。没有新增大型测试框架。首次证据脚本的非浏览器网络请求超时；改用实际浏览器网络栈后通过，未更换公共 RPC 或降低断言。Node 类型推断警告与 Git LF/CRLF 提示属于现有工具信息，没有伪装成失败或审计结果。

## 9. 本轮文件变更和保存

| 文件 | 原因 |
| --- | --- |
| `components/local-version-history.tsx` | 连接请求序号、预发送 epoch、审批锁与空样例修复 |
| `package.json` | 合约测试脚本同时运行所有本地 `*.test.mjs` |
| `tools/local-evm/security-review.test.mjs` | 八组对抗性本地 EVM 测试 |
| `tests/version-security-browser.mjs` | 竞态复现及修复后的浏览器回归 |
| `tests/local-production-gate.mjs` | 扩展生产请求/参数攻击检查 |
| `tests/version-review-evidence.mjs` | 五种只读 RPC 白名单、真实证据和本地历史快照 |
| `docs/version-history-security-review.md` | 追加本轮安全证据与边界 |
| `docs/version-history-threat-model.md` | 追加异步竞态、依赖与原始 RPC 风险 |
| `docs/version-history-contract-spec.md` | 澄清原接口信任和零 Hash/时间语义 |
| `docs/version-history-gas-report.md` | 补充 2/10/100 版实测与 RPC 成本 |
| `docs/version-history-security-findings.md` | 分级问题、代码位置与复现步骤 |
| `docs/version-history-predeployment-review.md` | 本交付报告与部署门槛 |

此前未提交修改/未跟踪文件全部保留。封面 `chainproof-cover.png` 保留 1575847 字节，SHA-256 `BFD74ECD09141ED1A892C0EE4BF360D182872B459870FDADB5A117A7E100BD47`。本轮没有 Git 提交、推送、合并或 Vercel 发布。

诊断文件保存于忽略目录 `.local-evm/review/`：`browser-before.json`、`browser-after.json`、`scale-gas.json`、`mainnet-read-only.json`、`local-history-snapshot.json`。本地快照包括验收 Work 4 的三版以及本轮本地测试作品；它是历史备份，不是主网证据，也不是节点状态自动恢复文件。关机后内存节点会停止，重新运行部署初始化会得到新的本地实例，不能把快照冒充其当前链上记录。

## 10. 未解决风险及部署前核验清单

1. 核对人工批准的网络清单：BOT Mainnet 677、精确 RPC/Explorer、旧合约地址与部署区块；本地 31337 不允许进入生产地址配置。
2. 用可信的独立来源核对 chain/genesis、旧合约部署回执、已验证源码/编译设置/运行时哈希及是否可升级；单一 RPC 的当前读数不足以批准可信绑定。
3. 核对构造参数与部署交易输入；部署后只读核对 immutable originalRegistry。错绑后无法原位更正。
4. 确认 BOT 对 Shanghai 字节码的支持，必要时先执行批准的只读创建代码模拟。Solidity [0.8.20 官方说明](https://www.soliditylang.org/blog/2023/05/10/solidity-0.8.20-release-announcement/)明确指出目标 EVM 支持要求；本轮没有据 chainId 或旧合约存在就推断兼容。
5. 定义真实钱包连接、账户/网络变更取消、交易替换/丢弃/超时、回执事件绑定和公开链确认/reorg 策略，并用隔离节点验证。
6. 解决或明确接受本地未鉴权 RPC 风险；真实钱包与公开开发账户必须隔离，禁止接收真实资金。任何未来写入环境需单独批准。
7. 明确零 Hash、不可纠错关联、钱包丢失/被盗、无控制权转移以及未加载重复提示的产品政策。
8. 检查更大事件历史和远程 RPC 限流、分页/内存/DOM 增长；保护失败与部分结果状态。
9. 安排适当的第三方审查与部署参数双人复核。没有 Slither/形式化验证，也没有真实 V2 钱包生命周期或公共链部署演练。
10. 登记钱包与关联权限只能证明钱包做出了记录，不能证明真实身份、版权、原创性、文件实际创作时间或版本因果关系；抢先登记公开文件的问题仍存在。

## 11. 4C-2 建议与当前停止点

**可以在人工验收后进入隔离本地 EVM 的真实钱包适配验证，前提是先批准具体测试账户、节点策略与网络拒绝规则。** 需要把解锁账户测试工具与真实钱包 adapter 区分，并继续禁止公共网络部署/写入。这个结论不批准进入公共测试网或主网。

公开部署当前不具备条件：依赖身份的独立验证、Shanghai 兼容性、真实钱包交易生命周期、公开链最终性、独立安全评估与明确部署批准尚未完成。本轮完成报告及低风险修复后停止功能开发，等待人工验收。

项目文件和本地历史快照已保存。2026-10-13 用户最新要求为“任务完成后不用关机”。此前获批启动的延迟非强制关机辅助进程已终止；系统撤销查询返回没有进行中的关机（1116），并确认辅助进程不存在。当前不再安排关机，电脑保持运行。
