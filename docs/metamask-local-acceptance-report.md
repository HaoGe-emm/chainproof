# ChainProof 4C-2 交付与人工验收报告

日期：2026-10-13。以下原4C-2开发报告保留历史记录。随后用户报告真实扩展已创建Work6并追加第二版；本轮只读链上数据已核对。最新备份、两处修复、质量检查及恢复命令以 [4C-2收尾报告](metamask-local-state-fixes.md) 为准，不使用历史 --fresh 指引恢复现有Work6。自动化Mock/Node签名仍不能冒充扩展操作。

## 1. Git 分支及工作区

当前 `feature/chainproof-v2`。原工作区已有大量未提交修改、未跟踪文档/测试/演示素材，全部保留。本轮未提交、推送、合并或发布。演示封面的 SHA-256 仍为 `BFD74ECD09141ED1A892C0EE4BF360D182872B459870FDADB5A117A7E100BD47`。

## 2. 原备份与 31337 数据

备份 `.local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json` 及 `.json.sha256` 存在；校验和结构验证通过。文件 SHA-256：`42f570726d0077e00d62634b40154670560860e6fdd4bf66069f17cd1033bc8b`。确认包含 6 Work、16 Version、5 Proof，Work 4 有三版，前驱 0、1、2，登记钱包/时间、关联时间、交易/事件字段完整。

该备份是带签名交易的重放归档，不是 Hardhat 原生内存状态转储。原 31337 的 8545 端口检查时连接被拒绝；本轮未启动、恢复、重置或写入它。无法由已停止的进程证明停机前是否存在晚于备份的新交易，保护结论限于已校验归档至区块 25。原 deployment、历史快照和恢复脚本校验未变。

## 3. 新隔离链与部署

| 项目 | 本轮值 |
| --- | --- |
| 网络 | ChainProof MetaMask Local Test |
| Chain ID | 31338 / 0x7a6a |
| RPC | http://127.0.0.1:18547，仅 loopback |
| 页面 | http://127.0.0.1:3006/metamask-local |
| 本地旧存证副本 | 0x057ef64e23666f000b34ae31332854acbd1c8544 |
| 本地 V2 | 0x261d8c5e9742e6f7f1076fa1f560894524e19cad |
| V2 部署区块 | 2 |
| 元数据 session | 1c0004c3-820f-4a00-8f0a-d89fd8eb6ceb |

全新 EDR 实例，非 fork。真实部署与初始化回执成功，开发者样例 Work 1 有三版；该样例不属于用户 MetaMask 钱包。元数据在 `.metamask-local/sessions/<session>/deployment.json`。每次新会话以对应文件为准，不能只认重复出现的地址。

## 4. MetaMask 集成方式

`lib/metamask-local-session.ts` 建立独立钱包会话，复用现有 MetaMask Provider 选择函数。只有 Connect 点击请求授权；Switch to Local 31338 是另一个明确动作。展示网站获授权的地址，清理监听器，并使用请求序号和会话 revision 丢弃过期结果。原主网连接器业务代码未改变。

## 5. EIP-1193

使用 Provider.request、eth_requestAccounts、eth_accounts、eth_chainId 及 accountsChanged/chainChanged/disconnect；按用户点击请求 switch/add。用户交易用 viem custom(EIP-1193) 交给扩展，HTTP RPC 不提供解锁账户代签。品牌标记和 API 形状不能证明扩展真实可信，浏览器安全仍是前提。

## 6. 创建 Work

全新测试钱包先用 Register Local Proof 登记自己的文件，再点击 Create Work。执行钱包/部署指纹/原存证授权模拟检查，最后发送前再检查。扩展确认后显示本地交易 Hash，等待成功回执，核对实际交易及事件，再查询 Work 和 Version 1。无成功回执不会显示最终成功。

## 7. 追加版本

同钱包分别登记第二、第三个不同文件；Add Version 使用当前链上版本数作为 expectedPreviousVersionNumber。合约执行 controller、原登记者、重复 Hash 和顺序校验。成功后从合约重新读取时间线，每页十版，分别显示原登记时间与关联时间。公开 Work URL 刷新恢复读取不依赖 localStorage。

## 8. 拒绝、账户切换及未知提交

区分授权拒绝、网络切换拒绝、交易拒绝和 EVM 回滚。同步提交锁防止同一时刻双击。会话 revision 防止 A→B→A 后旧预检复活。已广播交易保留捕获的 owner 与网络，切账户不会当作撤销。

已知 pending Hash 可在刷新后只读续查；替换记录保留替换原因和 Hash，并核对真实 calldata。广播后未取得 Hash 的不确定状态锁定再提交，用户从扩展活动复制公开 Hash 后，Track MetaMask Transaction 仅查询原交易，不重发。存储不可用时告知恢复限制。

## 9. 错误网络与配置拦截

固定 31338/18547；拒绝 677、31337、公共 RPC、主网地址、旧本地地址或无代码目标。每次写入校验双合约代码 Hash、genesis、部署区块 Hash、V2 immutable 绑定，钱包侧区块指纹也必须一致。最终请求强制 chainId=0x7a6a，验证 from/to/data。自定义传输拒绝其他写入/签名方法，避免 SDK 备用调用绕过检查。

RPC 只监听 127.0.0.1，HTTP 禁止 eth_sendTransaction、账户签名、reset、impersonation/admin；只接受 chainId 31338 的签名原始交易。Next 无资金或签名 API。生产配置接口服务端关闭，环境变量/URL 参数不能开启本地入口。

## 10. 自动化结果

| 检查 | 结果与边界 |
| --- | --- |
| npm test | 65/65，通过；含已有 SHA/证书/事件/备份校验 |
| npm run test:wallet:local | 23/23，通过；与 npm test 的钱包单元项有重叠，不能相加为独立总数 |
| npm run test:contracts:local | 27/27，通过；原合约、安全与恢复测试，仅各自本地实例 |
| metamask-local-browser.mjs | 通过：Mock EIP-1193 + 临时 Node 签名器 + 真实 31338 合约交易 |
| metamask-production-gate.mjs | 通过：config404、写方法405、参数伪装无效、无本地 RPC 请求 |
| local-production-gate.mjs | 通过：旧本地开发入口生产隔离 |
| product-browser.mjs | 通过：原导航、存证/验证、拒绝/恢复、账户竞态和 My Proofs 等 |
| certificate-browser.mjs | 通过：真实主网公开只读、二维码/复制/打印/移动端，测试夹具 MATCH/MISMATCH/ERROR |

测试未修改已有断言来掩盖问题。Node 对无 package type 的 TypeScript 文件发出模块类型性能警告；没有测试失败或 TypeScript/build 错误。主网查询均只读。

## 11. 实际扩展签名验收

**未完成，待用户人工验收。** 尚未取得用户 Account 1/2 公开地址或注入许可，未给用户钱包发送模拟资金，也未代用户授权、签名。两个新账户应使用专用本地网络 31338，不使用真实资产钱包。见中文指南逐步完成扩展授权、拒绝、三版交易、切账户、网络和刷新验证。

## 12. lint、build 与旧业务

最终 `npm run lint`、`npm run build` 均 exit 0。Next 16.3.8 构建成功。旧 Mainnet 仍 chainId 677、RPC https://rpc.botchain.ai、合约 0xC64CEF65ccd720664cc3bfd7D970b6F866E53052。旧 SHA、主网 ABI/合约、Create Proof、Verify、My Proofs、Certificate 及 31337 恢复核心源码与本轮开始基准一致；旧文件的本轮变动仅有 layout/footer 与 site-header 的本地路径标识。

## 13. 本轮文件

新增：

- app/metamask-local/page.tsx、layout.tsx、config/route.ts
- components/metamask-local.tsx
- lib/metamask-local-session.ts、metamask-local-config.ts、metamask-local-client.ts
- tools/metamask-local/runtime.mjs、start.mjs、fund.mjs、provider.test.mjs
- tests/metamask-session.test.mjs、metamask-receipt.test.mjs、metamask-local-browser.mjs、metamask-production-gate.mjs
- docs/metamask-local-integration.md、metamask-local-testing.md、metamask-local-user-guide.md、本报告

修改：components/site-header.tsx、app/layout.tsx、next.config.ts、package.json、.gitignore、tsconfig.json；Next 生成的 next-env.d.ts 保留现有生成状态。没有添加依赖。pnpm-lock 等其他既有未提交变动继续保留。

本地未跟踪测试证据：`.metamask-local/qa/browser.json` 明确标识 Mock，时间线截图；session 目录保存新部署配置与只读公开历史清单。最终清单 `observed-history-1791863767349.json` 观察到区块 79、11 Work/27 Version，均为开发者/自动化测试记录。它只是数据清单，不是完整 EVM 状态备份，不混入 31337 归档，也不代表用户真实扩展验收。

## 14. 已修复问题与剩余风险

修复并复测：配置失败时 Retry 不可见；同 tick 双击；钱包初始快照、账户 A-B-A 和晚到请求；广播后响应丢失误判；pending 跨会话数据混淆；替换原因丢失；SDK 替代钱包写方法绕过风险。业务成功由交易、回执与事件共同确认。

剩余边界：真实扩展版本兼容/弹窗流程待人工验收；Provider 注入不可认证；可信依赖/RPC 恶意行为不由指纹完全解决；跨标签页可手动并发提交，最终由合约规则约束；浏览器拒绝存储时刷新恢复有限；31338 为临时内存链，停止后测试状态不持久化；再次启动可能需在专用测试钱包处理旧本地 nonce/pending。loopback/CORS 不是本机访问认证。公开 Hardhat 开发 fixture 只用于 Node 工具和测试，不在生产静态包中；不得持有真实资产。本轮不是第三方安全审计。

## 15. 启动与人工页面

```powershell
cd D:\HKS
npm run dev:metamask:local -- --fresh
```

打开 http://127.0.0.1:3006/metamask-local 。需要专用浏览器配置与两个新钱包。先预演资金命令，目标公开地址确认后才实际注入 5 模拟 ETH；详见 testing 文档。--fresh 明确新建 31338 会话并保留旧元数据文件，原 31337 归档不受影响；它不会恢复本轮临时测试链历史。

服务结束状态：本轮启动的 18547/3006 隔离节点和开发服务、3007 生产预览已关闭；端口检查均无监听。原 8545 仍未启动。只关闭本轮自有进程，电脑不关机。下次人工验收需要先执行上述启动命令。

## 16. 进入 4C-3 的条件

先由用户完成真实扩展人工验收，并记录 Account 1/2 的公开地址、本地交易 Hash、成功/拒绝、三版前驱、账户权限、错链与刷新恢复结果。再评估候选 bytecode、依赖信任、BOT EVM/opcode 兼容性、公共网络部署/资金权限、第三方审查需求及独立发布计划。当前未授权公共部署，自动化通过不能替代以上门槛。

本阶段停在人工验收，不自动进入部署阶段。
