# Hardhat 本地链备份、恢复与数据保护

检查日期：2026-10-13。分支：`feature/chainproof-v2`。第1–9节是原 Hardhat 3.19.0 / chain31337 的历史检查与命令；新增31338独立流程见第10节。两个格式、命令和文件不可互换；均不部署公共网络合约。

## 1. 当前数据在哪里

当前 EDR 模拟链在进程内存中，没有配置可持久化链数据库。`.local-evm/deployment.json` 是合约定位和代码校验信息；`artifacts.json` 是编译产物；`files/` 是已知本地测试文件；它们都不是链状态数据库。

终端关闭并导致进程退出、电脑关机、进程崩溃或重新启动 Hardhat，都不会自动保留其内存链。新节点默认生成新链。进程仍存活时断开某个前端页面，不会清除链数据。`evm_snapshot` 的进程内标识也不能跨进程充当磁盘备份。

原 `dev:version:local` 启动器每次新建 EDR 并执行 setup；setup 会部署两个合约、登记五个文件、只创建一个三版种子作品，并写部署配置。没有持久化加载步骤，也没有显式 hardhat_reset 调用，但新建模拟链本身已经是新状态。合约地址在相同默认账户/nonce 下可能相同，不能据此认定原作品或交易历史存在。

本轮增加防覆盖检查：`dev:version`（新增同名别名）、`dev:version:local`、`dev:chain:local`、`setup:chain:local` 在已有 deployment.json 时拒绝初始化；setup 还拒绝非空链。保护检查在部署与文件写入之前执行。当前节点没有被停止、修改或重启。

## 2. 备份类别与文件

| 类型 | 本项目情况 |
| --- | --- |
| A：作品/版本 JSON | 旧 `.local-evm/review/local-history-snapshot.json`。6 Work、16 Version 完整，含 Work 4 的三版及所引用原 proof 信息；不能导入 EVM，缺完整原交易和区块历史。 |
| B：事件/交易档案 | 新备份保存每块、完整交易字段、回执及事件；包括失败交易。 |
| C：原生全 EVM 状态转储 | 没有实现或宣称支持。没有使用 evm_snapshot 当作可跨进程文件。 |
| D：可重放交易 | 新备份包含原本地已签名交易的编码、nonce、费用和区块时间/环境参数，使用原字节重放，不读取或保存私钥。 |
| E：节点磁盘数据库 | 当前不存在；本轮没有引入数据库或改变当前节点运行配置。 |

新文件目录 `.local-evm/backups/`，当前两份有效版本：

```
chain31337-2026-10-13T01-08-38-363Z-c79f49a1.json
chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json
```

每份均有相邻 `.json.sha256` 文件；第二份是交付前再次只读核对的版本。两次链状态相同，观测时间及校验值不同。旧备份未改写。基准与具体校验值见 `local-evm-recovery-baseline.json`。

备份保存原合约/V2 地址、代码与代码 Hash、ABI、默认账户公开地址及创世余额/nonce、固定 head、所有 6 Work/16 Version、5 原 proof、26 个区块、25 交易、27 事件。包含完整 Work 4。签名 r/s/v 是已有交易的公开字段，不是私钥。没有助记词、真实钱包秘密或环境变量值。

## 3. 展示、业务重建和历史重放的区别

- **展示恢复：** 读取旧 JSON 展示记录，不意味着合约存在或能继续调用。
- **业务重建：** 新部署后按 Hash/controller/前驱重建关系，通常产生新时间、nonce、交易与区块 Hash。不能描述成原链历史恢复。
- **本轮已验证的历史重放：** 在全新独立 EDR 中，以同一版本、创世设置和默认账户状态，逐块提交原已签名交易，恢复原区块时间、baseFee、prevRandao、coinbase、Gas limit。实际测试全部归档块 Hash、交易 Hash、事件和相关合约读取一致。因此当前第 0–25 块的归档历史和 ChainProof 业务状态已可重复恢复。

第三种机制仍属于 D 类重放，**不是通用 C 类原生状态导入**。未归档的 mempool、过滤器/订阅、snapshot ID、RPC 运行参数，以及不通过交易发生的任意 Hardhat 管理状态修改，不保证恢复。没有为所有账户每个 storage slot 生成通用状态 dump。当前归档范围的准确性由逐块 Hash 和所有相关业务读取核对支持；不能把这个结果泛化为任何链都可恢复。

## 4. 备份与校验

在 `D:\HKS`，保持当前节点运行：

```powershell
npm run backup:chain:local
```

命令默认只读固定 `127.0.0.1:8545`；先验证 chainId 与 Hardhat 版本，以固定区块查询，末尾再次核对 head，变化时失败并要求重试。只支持本轮已验证的 legacy/2930/1559 交易及限定规模；未知交易类型不静默省略。写入新 UTC 时间+随机名，使用独占创建，绝不覆盖旧备份。正文 SHA-256、文件 SHA-256、代码 Hash、计数、事件与版本不变量均校验。校验提供完整性检查，不提供数字签名式来源认证；仍需保护本地备份文件。

复制终端输出的实际新文件名，然后校验：

```powershell
npm run verify:backup:local -- ".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json"
```

默认只验证，不启动节点、不发交易。JSON 与 `.sha256` 必须一起保存；建议另外复制到安全的独立磁盘。若校验失败，保留文件并查原因，不修改 checksum 来掩盖差异。

## 5. 独立恢复测试

```powershell
npm run restore:chain:isolated -- ".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json" --apply
```

只有明确 `--apply` 才写入。工具自己创建并拥有空 Hardhat 节点，默认回环 18545；可显式使用 18546。不接受任意目标 RPC、公共网络或当前 8545。端口占用时安全拒绝；不重置或接管既有节点。每次测试创建独立 `.local-evm/recovery-tests/<时间-标识>/`，保存输入副本、校验及结果。完成后只关闭自己的节点。

如需暂时保留独立节点读取结果，附加 `--serve`；结束按 Ctrl+C。HTTP 接口可独立读取历史，不依赖浏览器 storage 或钱包。它是测试 RPC 包装器，无产品后端/数据库；不暴露 reset 等管理方法，只监听回环，解锁开发账户仍不应用于真实资产。CORS 限制不等于认证。

## 6. 恢复实测

完整 6/16 归档先后在两个独立 18545 实例重放，最终工具的结果位于：

```
.local-evm/recovery-tests/2026-10-13T01-27-04-974Z-0c4e3e3f/result.json
```

6 Work、16 Version、5 原 proof、25 原交易 Hash、27 事件、全部登记/关联时间、版本前驱与 controller 一致。创世块与全部已归档区块 Hash 相同，没有 Hash 差异。V2 immutable 原合约绑定和两个代码 Hash 一致。原文件不能从 Hash 还原，恢复不声称找回任意原始文件内容。

自动测试额外关闭并重建独立节点，再次重放已观测的短链夹具；通过同端口重复恢复拒绝、无 wallet/storage 的 HTTP 读取、损坏备份、错误 chain/address、丢失版本/原登记/回执、错误时间/前驱与失败释放端口测试。首次测试暴露 Hardhat 内置 server.listen 缺少端口错误监听，现由恢复工具自己管理 HTTP listener，并在失败时关闭其 EDR；没有降低断言或删除失败场景。

## 7. 下次开机继续开发

**现在仍在运行的服务继续使用，不执行恢复来替换它。** 如果电脑已关闭，或由你确认旧服务均停止，使用恢复入口：

```powershell
npm run resume:version:local -- ".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json"
```

该命令仍是预演，只核对备份与受保护 deployment.json。确认无误后，由你明确启动：

```powershell
npm run resume:version:local -- ".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json" --start
```

工具只在 8545/3002 空闲时创建自己全新的节点和前端。它不会停止旧服务；占用即失败。必须精确重放归档历史，并与原 manifest 一致，才启动 Next.js。没有重新部署初始化或覆盖 manifest；合约部署交易作为原历史的一部分重放。然后访问 `http://127.0.0.1:3002/local-evm/works/4`，确认 Version Count=3、三条 Hash、前驱 0/1/2。

恢复入口的 `--start` 在本轮没有执行，因为当前服务仍在运行。本轮验证了它的默认无副作用预演、manifest 匹配与共用恢复引擎，并实际测试了引擎的端口占用拒绝；没有为了验收停止旧服务。后续需要你停止旧服务后的人工验收。

新追加的数据仍在新进程内存中。每次停止前重新 backup、verify，选择最近且完整的备份。旧归档仅恢复其 head 之前的数据，不能恢复此后未备份的修改。不要因为文件名更晚就忽略实际 head/数量。

## 8. 停止与误操作保护

当前第 25 块对应的 6/16 数据已获得可重放备份并测试。**在尚未产生未备份新交易、校验成功且两份文件都已可靠保存的情况下，可以由你安全停止服务或关机。** 内存会消失，但归档范围能恢复。没有持续磁盘持久化、崩溃自动恢复或自动备份保证；突然断电可能丢失最后一次备份之后的数据。

必须保存备份 JSON+checksum、`.local-evm/deployment.json`、项目源码/锁文件、编译产物与可用测试文件。备份目录被 Git 忽略，不会自动随仓库 push；需单独保存。使用已安装的匹配 Hardhat 3.19.0/solc 0.8.20，不要为了恢复升级运行时。

Work 4 消失时先停下写入：确认 URL/链 ID/地址是否正确、是否误启空节点、是否选了旧备份。保持当前进程和文件，先用独立 18545 恢复验证，再由你决定停止错误服务并恢复。不得执行 reset、clean、setup 或删除 manifest 来“修好”页面。若所有归档丢失，仅凭 Hash 清单不能找回原交易/区块历史。

## 9. 质量检查与变更

- `npm test`：48/48（原 33 + 新 15 个备份校验测试）。
- `npm run test:recovery:local`：4/4；最新版恢复测试也包含在全部合约测试中。
- `npm run test:contracts:local`：27/27（原 23 + 新 4）。
- `npm run lint`、`npm run build`：通过。
- 原主网地址/ABI/SHA-256/页面/钱包业务未改；旧产品单元回归保留。没有公共 RPC 调用、主网交易、真实钱包签名、提交/推送/合并/发布。

新增 backup/recovery/resume/setup-safety 工具、单元与本地恢复测试、已观测的短链公开测试夹具、基准 Markdown/JSON、本文和普通用户指南；package scripts 添加对应入口。修改 node/start/setup 仅增加保护与清晰拒绝信息。原用户文件、旧快照、封面和当前部署配置保留。

机器可读结果与基准用于核对，不是安全审计认证。任意管理命令修改、不同 EDR 版本/创世参数、未归档区块、异常 nonce、未知交易类型或损坏文件均可能阻止精确重放；工具应明确失败，不自动退回近似业务重建。

## 10. 31338 独立归档与恢复（4C-2 收尾）

当前31338/18547未停止或重置。只读新增归档 `chain31338-2026-10-13T07-36-17-756Z-496b7473.json` 及 `.json.sha256`，均在 `.local-evm/backups/`。文件SHA-256为 `e6dc9107f5c0d740b1bd71c4e5d877a4fc446fe912196afacab07bb3e4e26c60`。实际块20、6 Work/9 Version/7 Proof/20交易/22事件，Work6两版完整。

```powershell
npm run backup:metamask:local
npm run verify:backup:metamask -- ".local-evm/backups/chain31338-2026-10-13T07-36-17-756Z-496b7473.json"
npm run restore:metamask:isolated -- ".local-evm/backups/chain31338-2026-10-13T07-36-17-756Z-496b7473.json" --apply
```

备份只读固定18547，独占写新文件；默认恢复命令只验证，--apply仅创建自有空18548。独立实测保留全部归档块/交易Hash、事件、登记及关联时间、余额/nonce、两合约代码和业务读取。属于可验证的交易历史重放，不是通用状态dump。原31337工具及归档校验未变。

未来关机后用 `npm run resume:metamask:local -- "上述31338文件路径" --start`，仅在18547/3006空闲且active.json匹配时创建新节点并重放；不覆盖元数据，不执行初始化。当前节点仍运行时禁止执行恢复来替代它，禁止 --fresh。默认无 --start 的预演已核对；原端口启动为保护现有服务未在本轮执行。

保存JSON+checksum、`.metamask-local/active.json`、相应session/deployment.json和匹配源码/依赖。关机前确保无备份后新增交易和pending；若新增则重新backup/verify。详细核对、限制、准确命令及五分钟指南见 [31338收尾报告](metamask-local-state-fixes.md)。
