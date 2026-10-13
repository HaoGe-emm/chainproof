# 4C-2 收尾：31338 备份与状态修复

检查日期：2026-10-13。只处理数据保护与两处状态问题，未进入 4C-3。

## 1. Git 与工作区

分支 `feature/chainproof-v2`。保留原有未提交修改、未跟踪文件和演示素材。未 commit、push、merge 或部署。原 31337 工具、备份格式和恢复核心语义未改。

## 2. 当前 31338 节点

固定 http://127.0.0.1:18547，chainId 31338。当前用户节点未停止、重启、reset 或重新部署，未在此节点发送测试写入。原副本 `0x057ef64e23666f000b34ae31332854acbd1c8544`，V2 `0x261d8c5e9742e6f7f1076fa1f560894524e19cad`；两个运行时代码和 V2 原合约绑定经核对。

## 3. 独立备份

```
D:\HKS\.local-evm\backups\chain31338-2026-10-13T07-36-17-756Z-496b7473.json
D:\HKS\.local-evm\backups\chain31338-2026-10-13T07-36-17-756Z-496b7473.json.sha256
```

文件 SHA-256：`e6dc9107f5c0d740b1bd71c4e5d877a4fc446fe912196afacab07bb3e4e26c60`。独占创建，旧文件未覆盖。采用独立 `chainproof-metamask-replay-v1` 格式；旧 `chainproof-local-replay-v1` 只适用 31337，两者不可互换。

包含固定 head、代码/ABI/部署指纹、完整区块与已签名交易、回执/事件、原 proof、Work/Version、触及账户的创世及归档末端余额/nonce。签名交易是公开数据，不包含钱包私钥/助记词、原始用户文件或环境秘密。原交易只允许在自建空 31338 节点重放；不能广播到公共网络。

## 4. 实际数量

归档至区块 20：**6 Work、9 Version、7 原 proof、20 交易、22 事件、21 个区块（含创世块）**。不套用原 31337 的 6/16 数量。

head Hash：`0x78c7dc04e340127b8b6aa235e5c81b9b076c51b09da1ab8a8dadf7bd7e9704b1`。

## 5. Work 6

Controller：`0xb6bF6a936F529650992B71e2DeB79E80Fd3da71B`，Version Count=2，createdAt=1791874527。

| 版本 | Fingerprint | 原登记时间 | 关联时间 | 前驱 |
| --- | --- | --- | --- | --- |
| 1 | 0xf215e2c0c0e88251edc05198f01add8b64fd37cc7a4d2354bdae8f21bf7945d9 | 1791874513 | 1791874527 | 0 |
| 2 | 0x79a6392de12af958c712f6d5aaa473f720c113219c4109ff6f14653cadef1fba | 1791874768 | 1791874790 | 1 |

两个 Hash 的原登记者均为 Controller。关联交易分别为 `0x2127b7432078de8522f1f1ebbc921c8889df62a3ae1c3164e255a5a42bc17c35`（块18）和 `0x02ee64f03c28eedbe207b8fc27287e6215a37793ba1bdabc5a82645623235db0`（块20）。时间戳仅表示本地链登记/关联时间。

附件所述 Account 2 只有 `0x53cf…6f1d` 缩写；当前归档交易/事件未能提供其完整地址，故未推断或冒充确认。人工验收以扩展实际授权地址为准。用户已报告扩展创建 Work 6、追加第二版、拒绝、无权限与错网测试；链上读取独立确认成功交易结果，助手没有代用户操作扩展。

## 6. 恢复结果与范围

实际独立恢复报告：`.metamask-local/recovery-tests/2026-10-13T07-39-16-870Z-dd14db1b/result.json`。18548 自建空 EDR 重放通过：全部 20 原交易 Hash、22 事件、区块编号/Hash、时间戳、合约代码、Work/Version/原 proof、前驱、membership、账户余额与 nonce 一致，区块 Hash 差异为空。原 18547 未受影响。

这是**D 类签名交易历史重放**并恢复相关业务状态；不是仅展示 JSON，不是重新部署后近似重建，也不是 C 类通用原生 EVM 状态导入。没有恢复未归档 mempool、snapshot 标识、订阅和任意不经交易发生的 Hardhat 管理状态修改。只能保证已验证的归档范围及匹配运行时。

## 7. 能否关机

归档范围通过恢复验证。只有在当前 head/业务状态仍与归档一致、无未确认交易、两个备份文件可靠保存的情况下，才可由用户安全关机。31338 仍是内存链；突然关机会失去上次备份后的新交易。本任务没有关机或关闭用户节点。

建议把 JSON 与 `.sha256` 一起复制到独立安全存储；Git 忽略的备份不会随 push 保存。每次新增交易后重新 backup、verify。不要执行 --fresh 来找回历史。

## 8. 下次开机的命令

仅校验，不启动：

```powershell
cd D:\HKS
npm run verify:backup:metamask -- ".local-evm/backups/chain31338-2026-10-13T07-36-17-756Z-496b7473.json"
npm run resume:metamask:local -- ".local-evm/backups/chain31338-2026-10-13T07-36-17-756Z-496b7473.json"
```

在旧进程已停止、18547/3006 空闲后才执行：

```powershell
npm run resume:metamask:local -- ".local-evm/backups/chain31338-2026-10-13T07-36-17-756Z-496b7473.json" --start
```

工具仅创建自有空节点，重放并核对原历史，再启动前端；端口占用或 active.json 不匹配则拒绝，不重置、接管或覆盖。默认预演已验证，恢复引擎已实际验证；为保护仍在运行的服务，本轮没有执行原端口 --start。保存 `.metamask-local/active.json`、session 的 deployment.json、源码/锁文件及可用测试文件。恢复后访问 http://127.0.0.1:3006/metamask-local?work=6 。旧 31337 resume 命令不能恢复这份文件。

## 9. 拒绝后旧 Hash 的根因与修复

原 `last` 状态在成功交易后长期保留；新操作开始及 4001 拒绝未清理，却被通用卡片展示为当前 Hash。现在新操作先清理当前交易展示；只在真正广播并取得 Hash 后设置当前交易。成功回执单独保留 `previous`，以独立 Previous Successful Transaction 卡片展示。选择新文件/钱包/作品会开始新的显示上下文；仍在进行的广播不会因此被取消或丢弃。回滚保留其真实当前交易 Hash，RPC 超时保留 pending，未知提交继续锁定并只读跟踪。

## 10. Ready 状态冲突的根因与修复

原 phase 初始固定为 Ready to Submit，与按钮授权检查分离。现在 `metaSubmitState` 同时决定 Register/Create/Add 的按钮和 handler 准入；当前作品的 Add Version readiness 按断开、错网、配置/查询错误、交易中、作品、controller、文件原登记权限与重复 Hash 等条件计算。只有 Add 的全部条件满足才显示 Ready to Submit。

文件结果绑定当前 Hash，作品结果绑定当前 Work ID；账户事件与原有请求取消机制结合，防止旧结果暂时启用新操作。Create 是独立创建动作，可在自己的原 proof 合法时创建别的 Work；它不会授予修改当前他人作品的权限。状态明确标注 Add Version readiness。

## 11. 本轮文件

新增 `tools/metamask-local/archive.mjs`、`recover.mjs`、`resume.mjs`、`archive.test.mjs`；`lib/metamask-local-readiness.ts`；`tests/metamask-readiness.test.mjs`；本文。修改 `components/metamask-local.tsx`、`tests/metamask-local-browser.mjs`、package scripts，以及 acceptance/user-guide/testing/integration/backup-recovery 文档。

未修改 Solidity、旧主网配置/ABI/业务页面、原 31337 备份工具。浏览器自动测试强制 18548，并将前端固定 18547 请求仅在测试上下文转发；无钱包新上下文同样转发，禁止测试误写当前链。

## 12. 自动化检查

| 检查 | 最终结果 |
| --- | --- |
| npm test | 72/72，通过 |
| npm run test:wallet:local | 48/48，通过，含18个新31338导出/恢复检查与7个就绪检查；与npm test部分重叠 |
| npm run test:contracts:local | 27/27，通过，保留原31337恢复与安全检查 |
| npm run lint / npm run build | 均exit0，Next16.3.8生产构建成功 |
| metamask-local-browser.mjs | 通过：真实隔离18548 EVM交易，Mock Provider与内存测试签名器；不是助手操作真实扩展 |
| metamask-production-gate / local-production-gate | 通过：3009生产预览，变量/参数不能开启配置/写入入口 |
| product-browser.mjs | 通过：原主网产品Mock回归、导航/移动端/重复/拒绝/回执恢复/账户与部分结果 |

保留既有断言；新增拒绝新登记/创建/追加后当前 Hash 为空、上次成功信息隔离、RPC 超时 pending、账户切换、权限/错链/重复就绪、恢复异常等断言。修正浏览器测试夹具的新上下文隔离、双击前就绪等待及故意超时后的已取消路由处理；没有修改或降低产品断言。测试证据 `.metamask-local/qa-closeout/browser.json` 明确标识Mock，截图 `timeline.png`。

只读结束比较（2026-10-13T07:57:29.213Z，即北京时间15:57:29）再次确认当前18547的head、config、代码、余额/nonce、全部Work/Proof/区块与归档一致，差异为空。原31337备份 SHA-256仍为 `42f570726d0077e00d62634b40154670560860e6fdd4bf66069f17cd1033bc8b`，封面校验未变。Node模块类型警告仅为性能提示，无测试或构建错误。

结束检查通过：本轮自建18548/3009已关闭；当前18547仍返回chainId31338、head20，3006的Work6入口返回200。用户节点未关闭，电脑未关机。本轮没有登记/创建/追加到当前链；测试写入仅发生在已关闭的隔离克隆中。

## 13. 限制

依赖匹配 Hardhat 3.19.0、solc 0.8.20、Shanghai 创世参数；只归档支持的 legacy/2930/1559 交易，未知类型拒绝。哈希校验是完整性检查，不是备份来源签名认证；需保管文件。没有持续磁盘数据库或自动备份，也不恢复原始文件内容。真实扩展 UI 修复由用户再验收；Mock 不替代该步骤。未做第三方专业审计。

## 14. 4C-3

本轮停在收尾，尚需用户确认两处修复、完成其余真实扩展验收和部署前安全/兼容性评估。没有进入 4C-3 或授权公共网络部署。

## 五分钟人工验收（不新增链上记录）

1. 保持现有节点运行，打开 http://127.0.0.1:3006/metamask-local?work=6 ，选择 31338。确认 Controller 完整地址、Count=2、两条 Hash 及前驱 0、1 与上表相同。
2. Account 1 选原来未登记的 V3 文件，点击 Register Local Proof，在扩展点击 Reject。预期 Transaction Rejected，当前交易 Hash 不显示；如果保留旧成功记录，只出现在 Previous Successful Transaction 卡片。Count 仍2。
3. 切换并授权 Account 2，Work ID 保持6。预期 Unauthorized Wallet for selected Work，Add 禁用，Add Version readiness 不显示 Ready to Submit。无需签名。
4. 切到 Chain ID1，预期 Wrong Network、所有写入禁用。再通过明确点击切回31338，切回/授权 Account1。未登记V3显示 Proof Not Found且可登记；已在作品内的V1/V2显示 Duplicate Hash而不允许重复追加。这是正常状态，不为验证修复额外发送成功交易。
5. 记录结果。若你后来确实新增交易，结束前运行 backup:metamask:local 并验证新文件，不能继续使用仅到块20的旧备份来保证新数据。
