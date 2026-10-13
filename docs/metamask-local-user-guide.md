# 第一次使用 MetaMask 本地测试：中文点击指南

这两个账号连接 **本地模拟网络 31338**。不是 BOT 主网，也不是 Bohr Testnet；余额里的 ETH 只在你电脑上模拟。

## 1. 先启动项目

已经有 Work 6 的当前节点继续运行时，直接打开 `http://127.0.0.1:3006/metamask-local?work=6`，不要执行 --fresh。关机后恢复现有历史，在 `D:\HKS` 的终端先校验，再显式启动（要求旧服务停止、端口空闲）：

```powershell
npm run resume:metamask:local -- ".local-evm/backups/chain31338-2026-10-13T07-36-17-756Z-496b7473.json"
npm run resume:metamask:local -- ".local-evm/backups/chain31338-2026-10-13T07-36-17-756Z-496b7473.json" --start
```

等终端显示就绪。打开 `http://127.0.0.1:3006/metamask-local`，应看到黄色 METAMASK LOCAL TEST、CHAIN ID 31338 标识。没有启动时打不开本地链接是正常的。端口占用时先确认哪个服务在用，不强行结束未知进程。

## 2. 准备专用钱包

在 Chrome/Edge 右上角的浏览器用户头像菜单中选择新增配置，给它起名“ChainProof 本地测试”。用这个配置打开 [MetaMask 官方下载页](https://metamask.io/download/)，按官方商店流程安装扩展。

点击浏览器右上角 MetaMask 图标，选择创建全新测试钱包，自己完成扩展向导。不要选择导入现有主钱包；任何恢复资料都由你自己保管，不输入项目、不发给助手。此步骤助手不会代你操作。

在扩展的账户菜单中准备两个普通账户，分别作为 Account 1 和 Account 2。不要使用真实资产账户，也不要导入 Hardhat 默认开发账户。账户菜单名称随扩展版本可能略有不同。

## 3. 连接网站并添加网络

回到本地页面，点击 **Connect MetaMask**。扩展应弹出网站授权；确认网址是 `127.0.0.1:3006`，选 Account 1，再由你点击连接。页面应显示它的完整授权地址。

点击页面 **Switch to Local 31338**。如果扩展显示添加网络，核对：

- 名称：ChainProof MetaMask Local Test
- RPC：http://127.0.0.1:18547
- Chain ID：31338
- 货币符号：ETH
- 区块浏览器：留空

亲自确认。页面应显示 Wallet Chain ID: 31338。拒绝切换会显示 Network Switch Rejected，且不发送交易。若 ID 正确但显示 Incorrect Local Configuration，检查扩展中 RPC 是否与上述地址完全一致，不使用公共 RPC。

## 4. 准备模拟余额

在扩展账户名称下复制 **公开地址**。你可以把两个地址发给助手，并明确同意只注入 31338 模拟资金；或者按 [测试说明](metamask-local-testing.md) 自己先预演、再确认资金命令。

预期每个账户收到 5 个本地模拟 ETH。不要从主网转钱，不使用公开 Faucet，不支付真实 BOT/ETH。若余额仍为零，检查当前网络、公开地址及测试服务是否运行。

## 5. 准备三个文件

用记事本创建三个不同内容的文件，例如：

```
v1.txt：ChainProof version one
v2.txt：ChainProof version two
v3.txt：ChainProof version three
```

文件内容不同才会有不同 Hash。你无需手动计算 Hash，不要选择开发者示例 Hash 来冒充自己的登记。

## 6. 创建作品

点击页面文件选择区，选择 v1.txt。页面应显示文件名、大小和指纹；文件在浏览器本地处理。

先点击 **Register Local Proof**。MetaMask 应弹出交易确认，检查发送账户为你的测试 Account 1、网络 31338、页面显示的 Original registry 地址、转账 value 为零。由你点击确认。等待页面显示 **Local Proof Registered**。后续 Create Work 和 Add Version 的目标应为页面的 Version registry 地址；每次确认都核对发送账户和网络。

再点击 **Create Work**。MetaMask 应再次弹出确认；先试一次拒绝，应显示 **Transaction Rejected**，没有新作品。重新点击并亲自确认，等 **Work Created**。页面显示的是实际 Work ID，不一定是 1 或 4。

## 7. 追加版本

选择 v2.txt，先 **Register Local Proof** 并确认，再 **Add Version** 并确认。预期 Version Count=2，第二版前驱为 1。

对 v3.txt 重复相同步骤。预期 Version Count=3，三版前驱为 0、1、2。重复使用相同 Hash 时 Add 按钮禁用并显示 Duplicate Hash。

如果提示 Original Proof Not Found，先用当前账户登记该文件。如果提示 Unauthorized Wallet，检查当前网站授权账户与作品 controller/原登记钱包是否相同。

## 8. 测试第二个账户

在 MetaMask 切换 Account 2，并确保它获准连接当前网站。如果页面地址没变，再点击 Connect MetaMask 授权该账户；未授权的全局选中账户不会被网站自动知道。

用 Account 2 选择第四个新文件并登记，再查看 Account 1 的 Work。预期显示 Unauthorized Wallet for selected Work，不能追加。切回并授权 Account 1，应恢复正常权限。

## 9. 网络、等待与刷新

切到 31337 或 677，页面应显示 Wrong Network，写入按钮禁用。测试这一步只切网络，不在公共网络发送交易。再通过页面按钮切回 31338。

交易一旦已广播，切账户或关页面不会取消它。页面会继续显示原 Transaction Owner。如果显示 Pending Confirmation / RPC Error，恢复服务后点击 **Retry Local Receipt**；不要重复提交。

如果显示 **Submission Uncertain**，打开 MetaMask 的活动记录，复制该本地交易的公开 Hash，填入页面 **Wallet transaction Hash**，点击 **Track MetaMask Transaction**。这是查询，不是再次签名或转账。不要填私钥。

记下当前带 `?work=数字` 的页面地址，刷新应重新读取时间线。新浏览器也能读取还在运行的 31338 节点；这不证明版本关系已在 BOT 主网上。

## 10. 验收结束

把真实扩展中成功/拒绝、两个账户、三版顺序及刷新结果告诉助手。当前自动化通过的 Mock 不能代替这些步骤。

停止前先运行 `npm run backup:metamask:local`，记下新文件路径，再使用 `npm run verify:backup:metamask -- "新文件路径"` 验证。确认没有此后新交易或未确认交易，再由你 Ctrl+C 停止或关机。31338 是内存链；使用对应归档的 resume 命令恢复，不能用 --fresh 或旧 31337 命令。出现 MetaMask 旧本地 pending/nonce 记录时先暂停，在专用测试配置内核对，勿修改主钱包活动。

当前 Work 6 与两处状态修复的五分钟验收步骤见 [收尾报告](metamask-local-state-fixes.md)。被拒绝的新操作不显示当前交易 Hash；旧成功信息仅以 Previous Successful Transaction 展示。Add Version readiness 与当前作品追加权限一致。
