# MetaMask 31338 隔离测试

本阶段只使用本地模拟链。真实 MetaMask 扩展确认必须由用户完成；自动化 Mock 结果不能代替此验收。

**已有Work6后请先读 [收尾恢复指南](metamask-local-state-fixes.md)。以下 --fresh 是早期全新环境初始化说明，不能用于恢复当前历史；现有节点不重启。关机后用新的31338 resume命令。浏览器自动写入测试现在强制只使用独立18548恢复节点。**

## 启动

在 `D:\HKS`：

```powershell
npm run dev:metamask:local -- --fresh
```

本轮测试后会关闭自己的测试进程。已有新链 metadata 时必须明确 --fresh，它只更换 31338 的 active 指针并启动新链；旧 session 文件保留，31337 及其备份不变。端口占用时拒绝，不杀其他进程。首次没有 metadata 时可省略 --fresh。

RPC 仅监听 `127.0.0.1:18547`；页面为 `http://127.0.0.1:3006/metamask-local`。代码编译/部署两个本地合约及开发者示例，所有回执必须成功后才报告启动完成。没有公共网络参数、fork 或默认主网部署脚本。

## MetaMask 设置

使用独立浏览器配置，安装官方扩展，创建全新的空测试钱包并准备两个普通账户。不要导入现有主钱包或 Hardhat 公开开发密钥。不要把任何秘密发给助手或放入项目。

| 字段 | 值 |
| --- | --- |
| 名称 | ChainProof MetaMask Local Test |
| Chain ID | 31338（0x7a6a） |
| RPC | http://127.0.0.1:18547 |
| Symbol | ETH（本地模拟余额） |
| Explorer | 留空 |

Connect MetaMask 只请求网站账户授权。Switch to Local 31338 是另外的明确用户动作；4902 时请求添加网络。若添加失败可在扩展里按表手动添加；不要改成公共 RPC。仅 ID 正确但配置错误时，钱包/公共 RPC 的指纹检查会阻止写入。

## 本地模拟资金

只提供两个测试账户的公开地址。先预演：

```powershell
npm run fund:metamask:local -- 0x你的测试账户公开地址
```

它仅打印目标及检查结果。用户确认地址后：

```powershell
npm run fund:metamask:local -- 0x你的测试账户公开地址 --confirm-address=0x你的测试账户公开地址
```

两个位置必须一致。仅转入 5 个本地模拟 ETH，固定 RPC/chainId，检查 genesis、代码和本地服务；不使用公共 Faucet、BOT 或真实 ETH。公开 Hardhat fixture 只在 Node 工具内使用，前端不包含此 fixture，用户也无需操作密钥。每个新 --fresh 会清空该新链资金，需要重新确认并准备模拟余额。

## 人工验收记录

1. Connect 授权 Account 1，显示网站授权地址；未点击切换前不自动改变网络。
2. 拒绝一次网络切换，再主动切入 31338；677/31337 均应禁用写入。
3. 准备三个内容不同的文件，选择 v1；原始文件不上传。
4. Register Local Proof：检查 MetaMask 31338、原 registry 地址、零 value，亲自确认；页面回执成功后显示 Local Proof Registered。
5. Create Work：先 Reject 一次，确认无新作品；再发起并确认，读取实际 Work ID/Version 1。
6. 对 v2 先 Register Local Proof，再 Add Version；先 Reject 一次，无版本计数增长，再确认成功。
7. 对 v3 重复登记/追加，得到三版与前驱 0、1、2。登记和关联时间分别显示。
8. 保留 Hash 不换文件，再 Add 应禁用并显示 Duplicate Hash。
9. Account 2 授权给网站后，用其自己的新文件登记；不能追加到 Account 1 的 Work。切回 Account 1 恢复权限。
10. 广播后切账户/网络，旧交易仍归 captured owner，不能描述为取消；回执查询仍绑定 31338。
11. 刷新既有 Work URL，时间线从合约恢复。pending 的公共 hash 可续查，不重发。RPC 超时保留 pending；未返回 hash 时检查 MetaMask activity，再使用 Track MetaMask Transaction。
12. 不要为人工断网测试停止正在保存未确认交易的服务。可用浏览器网络工具临时阻断 RPC请求并恢复；不得停止原 31337。预期 RPC Unavailable，而非 Work Not Found。

生成的 Work ID 不保证为 1/4；seed Work 1 是开发者示例。本地自动测试也可能生成同编号作品，不能与原 31337 Work 4 混为同一记录。开始人工验收前 --fresh 会只留新链的开发者示例。

MetaMask 切换了全局账户，但网站地址没变化时，检查该账户是否已授权给当前网站；必要时再次 Connect 授权。页面不会猜测未共享的账户。

## 运行自动测试

```powershell
npm test
npm run test:wallet:local
npm run test:contracts:local
npm run lint
npm run build
```

浏览器脚本：`tests/metamask-local-browser.mjs`、`tests/metamask-production-gate.mjs`。使用已安装 Edge/Playwright，并设置 PLAYWRIGHT_MODULE、CHAINPROOF_BROWSER_CHANNEL=msedge。前者需 3006/18547 运行；后者使用独立生产预览 3007。测试 provider 是 Mock，签名器是内存中新生成的 Node 测试账户，不是扩展。

## 停止与局限

测试完成后 Ctrl+C 关闭该启动器拥有的 31338/3006；不停止原节点。31338 目前没有完整持久化/重放机制，保留的 manifest/QA 只是定位和测试证据。再次 --fresh 是新链，MetaMask 旧本地 pending/nonce 可能需要你在专用测试配置中按扩展的活动/nonce 管理功能处理；不要对主钱包做此操作。

普通用户的逐步点击指南见 [metamask-local-user-guide](metamask-local-user-guide.md)。实际扩展验收完成前不得进入公共部署阶段或声称真实钱包测试通过。
