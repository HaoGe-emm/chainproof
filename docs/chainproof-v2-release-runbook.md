# ChainProof 2.0 — Stage 5B release runbook

Prepared2026-10-13，方案A。**以下是待批准的操作步骤，不是本轮执行记录。** Stage5A未执行任何提交/推送/合并/Tag/平台发布。正式发布仍使用旧BOT677单文件合约；V2不部署、不启用。

## 0. 固定目标与证据

- Repository：`https://github.com/HaoGe-emm/chainproof`，origin同仓库；远程main核验SHA `7f6fd8fc126af2a9493f84755f710b4eab2f1e57`。
- 用户已核实Vercel Production Branch：**main**；Root `./`、Next.js、Node24.x、默认Install/Build/Output。不能通过默认Git分支猜测生产分支。
- Production：`https://chainproof-two.vercel.app`。记录当前Production Deployment ID、不可变deployment URL、实际Git SHA、UTC发布时间、原首页/读取检查结果及可回滚目标截图。不提供Token或秘密变量。当前生产Git SHA尚未由部署页证实，不推定等于远程HEAD。
- 若上述设置在执行时变化，停止，不再沿用此计划。Skip unchanged deployments未确认；**任何推送都按可能触发部署处理**。

## 1. 人工审核并准备提交（需批准commit）

先保持feature分支，阅读Git完整diff及未跟踪文件。不要git add .，不要清理用户文件。对Stage5A的文件清单和源代码进行人工验收；V2源码可以随发布源代码保留，但生产入口必须禁用，不能配置公共V2地址。

应提交：

- `app/`、`components/`、`lib/`：主产品及服务器门禁；本地/原型源码保留但生产关闭。
- `contracts/ChainProof.sol`（不改变其业务）、`ChainProofVersionRegistry.sol`（源码/本地测试用途，未公共部署）。
- `package.json`、唯一`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`next.config.ts`、`tsconfig.json`、`postcss.config.mjs`、Next生成的`next-env.d.ts`（审核后）、`.gitignore`、AGENTS/CLAUDE指导文件。
- `tests/`、`tools/`中的源测试/隔离工具，以及公开合成夹具；绝不执行这些本地链启动/部署工具作为Vercel build。
- README、经过审阅的docs（包括Stage5A两份文档、demo-mismatch.txt测试文件）。阶段4C文档是技术历史，不是公共V2功能承诺。

不得提交/部署：

- node_modules、.next/.next-local-evm/.next-metamask-local/out、缓存、日志/临时文件。
- `.local-evm/`全部真实本地状态/备份/原始RPC报告、`.metamask-local/`manifest、`docs/local-evm-recovery-baseline.json`。
- `.env*`、`.vercel/`metadata与任何Token、私钥、助记词、钱包导出文件。
- `.presentation-build/`内部素材/过程文件；演示成品若确需发布应另外审阅批准，原文件保留。

经批准后可执行的命令示意（**本轮未执行**）：

```powershell
git branch --show-current
git status --short
git diff --check
git add .gitignore README.md AGENTS.md CLAUDE.md package.json pnpm-lock.yaml pnpm-workspace.yaml next.config.ts postcss.config.mjs tsconfig.json next-env.d.ts app components lib contracts tests tools docs
git diff --cached --name-only
git diff --cached
git commit -m "Prepare ChainProof 2.0 single-file provenance release"
```

暂存清单必须确认忽略的本地数据/素材没有出现；若出现秘密，停止提交并报告，不能只删除日志掩盖。不要使用-f强行添加被忽略文件。必要时用更细的文件列表替代目录，避免把新增用户材料自动纳入。未纳入发布的用户文件继续留在当前工作区，禁止reset/clean。

## 2. 独立Preview（需批准feature push和Preview创建）

优先使用已有Git集成，在确认feature不是生产分支后：

```powershell
git push -u origin feature/chainproof-v2
```

**该push可能立即触发Vercel Preview**；请求授权必须同时明确这两个效果。不要push main、不加--force，不设置生产域名、不执行vercel --prod、不Promote、不创建Tag。GitHub PR的创建也是外部操作，若需要先批准；本轮不创建PR。

若自动Preview未触发，可在经批准后用Vercel Create Deployment选择该feature分支/精确提交，确认Target为Preview；不能因为部署skip就改main或生产设置。没有可靠Preview隔离时停止，先确认项目设置。临时独立Preview项目是备选，也需要创建项目授权，不能转绑正式域名。

## 3. Preview验收，不影响现有正式站

- 使用唯一生成的Preview URL，不是chainproof-two.vercel.app；确认target Preview、Git branch/SHA与批准的提交一致。
- 查看安装/构建日志：Node24.x；pnpm-lock9.0被正确识别；实际安装器/版本；Linux Next/SWC/Tailwind原生依赖安装及build成功；不运行Hardhat或使用生产私钥。保留默认Install，不设置一个可能被旧pnpm解析的笼统override。
- 配置不添加CHAINPROOF开发变量、应用秘密或本地RPC。证书使用当前origin；无需硬编码生产域名。即使误加开发flag也必须保持生产代码门禁。
- 无钱包打开首页、Create、Verify、My Proofs空连接提示和真实 `/proof/0x8ed3...f625`；刷新/直达有效。
- 真实mainnet已知证书读取/QR/复制链接/文件不同副本MISMATCH、未登记proof与RPC失败说明。MATCH用独立自动化夹具验证，不为验收新增真实登记。
- 用新的测试上下文检查SHA64位/稳定/改字变化；原文件不上传。复制完整Hash/钱包、长链接换行、手机Safari/Chrome/MetaMask浏览器、PDF保存/一页A4及白色边缘人工核验。
- `/works`、`/works/new`、`/works/4`、`/works/6`、随机Work深链只能显示不可用，无记录/交易控件。`/local-evm/...`和`/metamask-local`禁用，两config404及非GET405；不向127.0.0.1链发请求。
- MetaMask连接/断开事件/切账户、错误网络提示及拒绝连接/切链/交易。**Preview仍指向真实旧mainnet合约，不能把它当作无Gas沙盒**；仅拒绝/取消写入，不确认真实交易，不导入开发账户私钥。
- My Proofs实际钱包只读历史及分页/部分扫描；RPC失败不显示无记录。连接钱包仅选择账户，不能将其与交易授权混同。
- 开始/结束分别GET正式站三条既有页面，记录原Production Deployment ID/域名绑定未变化。对外扫码者可能被Vercel Deployment Protection拦截，需确认保护策略；不能未经批准关闭保护。

Stage5A本地虚拟Preview origin测试，不等于这个真实Preview已经验收。任何Linux、扩展、深链或隔离失败均停止Promote/merge。

## 4. 合入正式分支（需批准PR/merge/生产部署）

在用户验收Preview并批准生产发布后，首选通过审阅PR `feature/chainproof-v2 → main` 合入。执行前只读重新比较remote main，确认没有新的用户提交；若有冲突，在feature上审阅解决并重新生成Preview，不覆盖main。

建议保留审阅过的merge commit以便后续反向回滚；合并方式由用户确认。可以在GitHub PR页面执行经批准的merge，避免在有未提交文件的当前目录直接切换main。必要的本地整合应使用干净隔离checkout/worktree，经用户确认后进行；不能用reset/clean消除工作区修改。

**合入main通常会自动触发生产部署**，因此merge批准必须明确包含生产部署这一效果。不同时采用“merge自动发布”与“手工Promote Preview”两条路径；如决定Promote，另行审查其与main源记录一致性并单独批准。任何生产设置、保护策略、域名修改也独立授权。

发布前保存旧deployment回滚目标，确保回滚权限/保留状态。发布后核对main SHA、Production deployment及正式域名确实对应已验收版本；不能只看build成功。

## 5. 正式站发布后人工验收

1. 首页/导航、手机无溢出、公开证书深链与刷新。
2. 主网677、原合约和BOTScan链接；不出现Hardhat/local数据/版本历史入口。
3. 无钱包真实旧proof、My Proofs公开地址历史、QR链接为正式域名、复制及PDF。
4. MetaMask账户切换/断开、错误网络/拒绝流程、文件本地SHA与读错误。
5. 不存在/RPC故障状态不声称验证通过；Registered不是文件MATCH或版权认证。
6. Create Proof成功端到端需要用户**另行明确同意真实主网交易和Gas**，用其钱包人工签名小文件；保存receipt/Hash，验证同文件与改字。默认发布验收不发送这笔交易，自动化使用Mock已覆盖参数/回执。助手不接触私钥，不自动签名。

## 6. 回滚方案（必须预先批准，执行时确认目标）

若导航/读取/生产门禁等核心出现异常，暂停新的写入验收，保留日志/版本SHA。优先从Vercel Production Deployment tile选择**Instant Rollback**至已记录的旧正式deployment。不要猜测ID或删除新deployment；回滚作用于网站，不删除链上交易，也不修复不可变合约。

当前官方说明Hobby通常只能回滚到上一个production deployment；Pro/Enterprise可选择符合条件的历史deployment。已确认项目套餐/权限和目标可用后才执行。回滚是生产变更，需要授权；不能因“紧急”自动执行。

恢复源记录：在隔离feature中建立反向变更并通过PR恢复main，merge commit可使用审核过的 `git revert -m 1 <release-merge-sha>`；squash则revert其提交。明确识别提交和主父，不用reset/force push。反向PR合并和后续生产build均需批准。不要假定每次新push一定自动重新绑定生产域名；按照平台当前rollback/promote行为核对，不自动Undo Rollback。

若Instant Rollback不可用，可对记录的旧源码建立恢复PR并重新构建旧版本，或者经批准恢复一个保留deployment；重建可能受依赖/平台变化影响，先做Preview。保留旧部署比临时重装更可靠。环境配置也要与旧记录比对，平台回滚不把新的环境变量更改自动应用到旧build。

## 7. 明确授权清单

| 操作 | 必须确认的范围 |
| --- | --- |
| Git暂存/commit | 精确文件、审阅diff、提交信息 |
| feature push | 仓库/分支；允许可能触发Preview |
| Preview创建/保护调整 | 指定项目与目标；不得覆盖正式域名 |
| PR创建 | 公开目标仓库、feature→main及内容 |
| merge main | 经验收commit，合并方式及自动Production效果 |
| Production Promote/发布设置 | 独立明确批准，避免与merge流程重复 |
| 回滚 | 指定旧deployment/源码、批准生产切换与恢复提交 |
| 真实主网存证测试 | 另行同意用户钱包签名和Gas；不包含任何V2部署 |

Tag、公共testnet/mainnet V2部署、链恢复/重置均不在5B方案A发布所需步骤中，不执行。本轮到此为止，等待用户授权Preview。

### 官方依据（2026-10-13）

- [Git分支与Preview/Production](https://vercel.com/docs/git)
- [Node24支持及package engines](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [锁文件与默认安装器](https://vercel.com/docs/package-managers)
- [Instant Rollback范围与行为](https://vercel.com/docs/instant-rollback)
