# 本地 EVM 只读恢复基准

核对日期：2026-10-13（Asia/Shanghai）。分支：`feature/chainproof-v2`。
数据来源仅为仍在运行的本地 Hardhat chain 31337，不是 BOT Chain Mainnet。

固定区块读取、完整逐字段数据和校验值见 [机器可读基准](local-evm-recovery-baseline.json)。本轮没有向原节点发送写入交易、停止或重置节点。

| 项目 | 观测值 |
| --- | --- |
| 客户端 | HardhatNetwork/3.19.0，EDR |
| Chain ID | 31337 |
| RPC | http://127.0.0.1:8545 |
| 最新区块 | 25 |
| 最新区块 Hash | `0x4f02e2c4c258b8ef31eaa2985e35f33bfca8b23a9e8c53cf12ef2ca60ce95801` |
| 创世块 Hash | `0x48c18d8db43e2d7710d10f78eaf230f8ca04f94972d06cc24e7172beb3b5bfa6` |
| 原合约 | `0x5fbdb2315678afecb367f032d93f642f64180aa3` |
| 原合约运行时代码 Hash | `0x2c33220be6896a79c354df757529560584da06d3c610b62288b0cc4bd3275421` |
| V2 合约 | `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512` |
| V2 运行时代码 Hash | `0xcf4f04af2b6d63e7006cf0a7e815a61df9f8135965c271c51f648ad46ba9ce2a` |
| 作品 / 版本 | 6 / 16 |
| 原登记记录 | 5（包含尚未关联至作品的登记） |
| 归档区块 / 交易 / 事件 | 26（0–25）/ 25 / 27 |

作品版本数量：Work 1=3、2=3、3=3、4=3、5=1、6=3。全部 controller 是本地开发账户 `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`。每个版本的原登记钱包、时间、文件指纹、关联时间与前驱都通过实际存储读取和回执事件交叉核对。25 笔交易包含失败回执；失败交易同样归档和重放。

## Work 4

| Version | File Hash | 原登记时间（秒） | 关联时间（秒） | 前驱 | 原交易所在区块 |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | `0x617551388bd15d2ade1b342fcb7f85713dbae107f93b04043e71600b43a79e70` | 1791791833 | 1791814034 | 0 | 18 |
| 2 | `0x1e73cc528a7f9af4d51de91b54d2613994eedd04d71672519f102bb724408832` | 1791791834 | 1791815112 | 1 | 19 |
| 3 | `0xc8beab298fd57026fab4ef4c4d7e0749fad8deae8a0cefa3da883b8cb99c1808` | 1791791835 | 1791815218 | 2 | 20 |

原登记钱包均为上述 controller。时间来自本地合约字段，不代表文件创作时间。相关交易 Hash、logIndex 等完整信息保存在 JSON 基准和新归档中。

## 与旧备份比较

旧文件 `.local-evm/review/local-history-snapshot.json` 中的 6 个作品、16 个版本全部一致，Work 4 三版无缺失、无重复、前驱为 0/1/2；controller、createdAt、versionCount、文件 Hash、原 owner/time、关联时间逐字段一致。旧文件保持原样，SHA-256 记录于 JSON 基准。

旧文件属于 A 类展示/业务数据清单，没有完整原交易、事件和区块历史，也不能直接导入 EVM。它仅记录已关联版本引用的原 proof；并未完整导出未关联的原登记记录。本轮新增归档为 A+B+D：完整相关业务读取、全部区块/回执/事件和可重放的已签名本地交易，不是原生 C 类状态转储，也没有 E 类磁盘节点数据库。

新归档在 `.local-evm/backups/`，文件名含 UTC 时间和随机标识，并有 `.sha256` 校验文件。最后一次只读导出仍观测相同区块 Hash、6/16 数量，证明本轮测试未改变原链记录。

完整链历史重放条件与局限见 [备份恢复说明](local-evm-backup-recovery.md)。
