# ChainProof 2.0 — 5B-1 Preview safety preparation

检查日期：2026-10-13（Asia/Shanghai）。**只读检查和文档准备，不暂存、提交、推送、合并、Tag、部署、登录账号、读取个人Token或发送公共链交易。** 当前分支feature/chainproof-v2，方案A，公共V2仍未部署。

## 1. 生产身份：事实、线索与待确认

| 项目 | 结果 | 依据 / 可信边界 |
| --- | --- | --- |
| 正式域名 | https://chainproof-two.vercel.app | 用户指定，当前匿名GET200、标题ChainProof、Server Vercel |
| Production Deployment ID | **尚未确认** | 没有Vercel只读连接/认证API；未登录或读取凭据 |
| 当前不可变deployment URL | **尚未确认当前绑定** | 找到了下面历史记录的候选URL，不能当作当前别名已确认 |
| 当前生产实际Git SHA | **尚未确认当前绑定** | GitHub历史有独立记录，但不是当前Vercel别名映射证据 |
| 生产分支 | main | 用户在5A亲自核对Vercel Settings，本轮重申 |
| GitHub main HEAD | 7f6fd8fc126af2a9493f84755f710b4eab2f1e57 | 本轮GitHub公开branches/main API |
| 本地main、feature HEAD | 同上 | 本轮git rev-parse，全部2.0修改仍未提交 |
| 正式域名→具体Deployment映射 | **待Dashboard核验** | 公开网页响应没有deployment/commit身份头 |
| 项目回滚权限/候选保留 | **待Dashboard核验** | 不能从网站匿名访问推断套餐、权限或部署保留状态 |

`x-vercel-id`是一次HTTP请求的追踪信息，不是dpl Deployment ID。本地Next BUILD_ID、GitHub numeric deployment ID、Git HEAD也均不能替代Vercel当前生产身份。

### GitHub公开历史线索（不冒充当前生产证明）

独立公开Production环境记录：GitHub deployment **6925872971**，Source SHA `7f6fd8fc126af2a9493f84755f710b4eab2f1e57`；状态success，时间 **2026-10-08T02:39:22Z**。其environment/target URL为：

`https://chainproof-gy9pmvfo3-haoge-emm.vercel.app`

匿名读取该URL被重定向到Vercel登录页，最终HTTP200属于登录页，不是ChainProof内容验证成功。没有输入账号或自动登录。此观察表明**该历史部署URL有访问门槛**，不证明尚不存在的Preview采用同一种保护配置，也不证明当前正式域名仍绑定它。GitHub记录的production_environment布尔值为false但environment标签为Production，因此不把它当作强身份认证。

来源：[公开部署记录](https://api.github.com/repos/HaoGe-emm/chainproof/deployments/6925872971)、[公开部署状态](https://api.github.com/repos/HaoGe-emm/chainproof/deployments/6925872971/statuses)、[远程main](https://api.github.com/repos/HaoGe-emm/chainproof/branches/main)。均2026-10-13核验。

### 手工获取准确基准，不需要Token

1. 使用你自己已经正常登录的Vercel Dashboard，进入ChainProof项目Overview，打开**当前Production Deployment**，不要仅选Deployments列表最新一条或GitHub最新commit。
2. 复制页面显示的Deployment ID及deployment详情页URL。若只显示短ID，提供整条详情URL，不自行添加dpl前缀。
3. 在Domains/URL列表复制这条部署的**唯一生成URL**，不要拿正式域名或`*-git-main-*`等可变化的分支别名当不可变URL。
4. 在Source/Git字段复制完整commit SHA和分支；短SHA可打开对应GitHub提交复制完整值。
5. 核对该部署的Domains包含chainproof-two.vercel.app，结合项目当前Production tile/域名页面确认当前绑定；保存截图和核对时间。
6. 查看Instant Rollback对话框的可用目标及项目套餐/权限，不点击确认回滚。记录旧部署可回滚/保留状态。
7. 同时提供Settings → Git/Environments中的Preview branch tracking/自动部署规则；Settings → Deployment Protection状态；Environment Variables仅提供名称、作用环境/分支和是否相同，**不要复制秘密值、登录链接nonce、Cookie或Token**。

目前请求已发给用户，等待补齐。信息不足时只完成准备，不创建Preview。

## 2. 文件审核及具体清单

本轮打开了git status、完整diff的主要生产变更、git diff --cached和所有未跟踪候选；暂存区为空。检查初始为14个已跟踪修改、113个未跟踪源文件；加上本轮文档/清单后最终数目以生成清单为准。

**建议提交的每个文件逐行列在 `chainproof-v2-preview-files.txt`。** 清单包含本轮准备文档/清单，不含已跟踪且未改变的文件。原ChainProof.sol、主网lib/chainproof.ts/lib/wallet.ts/lib/proof.ts已在main且未改动，不需要为了提交而复制它们。

| 内容 | 主要审核结论 |
| --- | --- |
| 首页、layout、导航 | 新主产品入口及响应式；没有Version History主导航 |
| Create Proof | Title可选屏幕标签；重复/预检失败阻止；发送前账户/链核对；sessionStorage只存公开交易元数据；回执/事件匹配才Included |
| Verify、My Proofs | 本地Hash，RPC失败独立状态；部署有界owner扫描、部分结果、账户取消、分页 |
| 公开证书组件/路由 | Promise params适配Next；链读取无钱包；Registered与文件MATCH分开；当前origin QR、完整复制与A4打印 |
| 钱包provider/FilePicker | 旧快照/文件任务不会覆盖新选择；断开事件清空；不自动请求账户权限或签名 |
| 三组Version History页面/工具 | 源码保留；服务器NODE_ENV+精确flag门禁；生产直达也无记录/本地交易控件 |
| package/config/lock | engines24.x；只有pnpm-lock；常规build没有Hardhat启动/部署；开发distDir与正式.next区分；Next生成types引用审核 |
| 测试与文档 | 安全/恢复/匹配测试、技术历史及发布方案；未把本地记录称作Mainnet |

候选文件凭据模式扫描无疑似私钥、助记词、Token、API Secret，未发现超10MiB文件或不应纳入的目录；根目录无.env文件。模式扫描有边界，不等于审计保证。最终暂存内容须再检查，禁止用-f添加忽略文件。

明确排除：`.local-evm/`（包括31337/31338备份）、`.metamask-local/`、`docs/local-evm-recovery-baseline.json`、node_modules、所有.next目录、.env*、.vercel、.presentation-build、日志/缓存/系统临时文件。只新增报告，不覆盖素材或原备份。

`tests/fixtures/local-replay-prefix.json`是必要的**合成测试夹具**：公开Hardhat控制地址0xf39F…2266、1 Work/3 Version；不是用户交互链的6 Work备份，不能据此宣称保留了Work4/6。候选docs中的本地统计和公开代码Hash为技术报告，不是可恢复的用户链状态备份。

本轮再核对5A八个受保护源码/ABI/恢复文件及三份备份均未变化。审核记录位于忽略的 `.local-evm/release-5b1/`，没有写入节点或恢复数据。

## 3. GitHub→Vercel触发关系

已知：仓库HaoGe-emm/chainproof，Production Branch main；本轮远程仅有main，尚无feature/chainproof-v2；公开GitHub Actions workflow数量为0，本地没有新增自动生产发布workflow或vercel.json。

[Vercel官方Git规则](https://vercel.com/docs/git)通常把非生产分支的push作为Preview，生产分支更新作为Production。**当前项目实际Preview branch规则、Git integration部署限制、ignored build策略或自定义别名尚未从Dashboard确认，不能保证一定自动生成。**

前提是Production Branch仍main、正式域名未分配给feature、没有外部自动Promote等行为；则push feature不会把main正式部署替换。5B-2必须核对Target=Preview和源SHA，不通过改变main、关闭生产保护或绑定正式域名让部署“成功”。Skip unchanged规则没有可靠确认，不能依赖它避免部署。

## 4. Preview安全性与环境

- Preview **仍是BOT Chain Mainnet677**，合约 `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052`，RPC `https://rpc.botchain.ai`，Explorer `https://scan.botchain.ai`。它是网站预览，不是无Gas链沙盒。
- 主网getProof/getLogs/receipt等读取不花钱包Gas，不签名；地址/Hash查询仍会向公共RPC透露查询元数据。RPC故障或限流须显示错误/部分结果。
- Create页面明确Mainnet/交易费用，写入固定旧registerProof合约。**人工验收不确认任何交易，不签署任何写入，不发送主网交易**；参数、成功回执等用现有Mock自动化检查，不为MATCH新增登记。
- 所有正式页没有本地RPC回退或开发已解锁钱包。开发源码不会由于正常production/Preview build环境而开放。三条门禁离线测试本轮再跑3/3通过；完整浏览器门禁及77/27/48/10套件是5A本日已完成的证据，本轮不冒充重新运行全部测试。
- 应用没有必须的秘密env。NODE_ENV交由Next/Vercel设置production；三个CHAINPROOF开发标志在Preview/Production均应省略。不要配置私钥、wallet seed或Hardhat地址；NEXT_PUBLIC变量会进入客户端，不能保存秘密。
- 真实Preview/Production环境变量清单及分支覆盖尚未知。按[官方环境说明](https://vercel.com/docs/environment-variables)，在Dashboard分别检查作用域和feature分支覆盖，仅核对名字/是否存在，不读取秘密值。证书URL用当前origin；不需要生产域名env。
- 当前历史deployment URL跳转登录，Preview保护策略需Settings确认。扫码者可能需要Vercel认证；不要自动绕过、读取bypass token或关闭保护。[保护文档](https://vercel.com/docs/deployment-protection)
- 本地Node24.21.0、Next16.3.8，与用户确认Vercel24.x相容，5A最终生产build已通过；还不是全新Linux安装证明。云端安装器、Linux原生依赖/Node实际版本以真实Preview日志为准，保留默认Install/Build/Output。

## 5. 5B-2精确执行计划（未执行）

### A. 提交内容和说明

提交经过审核的清单中完整产品、生产门禁、配置/lock、测试/工具和文档；V2代码只作为禁用的开发功能。推荐消息：

`Prepare ChainProof 2.0 release A with production isolation`

本轮新文件不会改变业务逻辑；将来若用户在此期间继续编辑，必须重生成/对比清单和审核Hash，不能盲用旧清单。

### B. 经批准后才可运行的命令

```powershell
Set-Location -LiteralPath D:\HKS
git branch --show-current
git status --short
git diff --check
# 必须仍是 feature/chainproof-v2，生产基准和清单已确认。
git --literal-pathspecs add --pathspec-from-file=docs/chainproof-v2-preview-files.txt
git diff --cached --name-only
git diff --cached
# 出现任何未批准文件/秘密/本地数据立即停止，不继续提交。
git commit -m "Prepare ChainProof 2.0 release A with production isolation"
git rev-parse HEAD
# 需独立或合并范围明确的授权：push可能触发Preview。
git push -u origin feature/chainproof-v2
```

使用literal pathspec确保 `[hash]`/`[workId]`作为真实文件名，不被glob解释。没有git add .、force、reset、clean、main写入、Tag或生产命令。

### C–D. 预期部署及取得URL

预期Target Preview，Source feature/chainproof-v2及新commit完整SHA。实际随机部署域名现在不能预先知道。可从Vercel Deployments选这次feature记录，或GitHub commit Checks里的Vercel Details入口取得URL。记录新Preview Deployment ID、唯一deployment URL、Source SHA和Ready状态；分支alias可以随push变化，不替代唯一URL。

对照 `git rev-parse HEAD` 与Dashboard Source完整SHA；分支名称相同不足以确认代码版本。若没有自动部署，先检查Git集成/branch规则/skip及GitHub Checks。经**额外批准**才能手工创建指定commit的Preview，不用生产Deploy/Promote命令。

### E. 确认正式站未改变

前后对照Production Deployment ID、唯一URL、Source SHA、域名映射及截图时间；main HEAD不得改变。重复GET正式 `/`、`/register`、`/verify`和已有只读案例。仅200/页面相似不能证明部署ID没有变化，必须结合Dashboard基准。保存新旧结果，发现正式绑定改变即停止，报告，不自动回滚。

### F. Preview人工验收

1. 确认部署Preview/正确commit，进入网址只做安全读操作。
2. 首页、四导航、深链/刷新、桌面及手机；无钱包可打开真实单文件证书。
3. SHA256重复/改字/读失败；文件不上传。Verify已登记/未登记/RPC失败，失败不能MATCH。
4. My Proofs钱包连接/切账户/断开及只读历史、分页、加载/部分结果；连接/切网络不是交易签名。
5. QR解码/完整复制与网址origin；保护页面需你手动正常认证，无Token提供给助手。打印单页白底A4及免责声明。
6. `/works`、new、4、6及随机详情都是Unavailable；local-evm/metamask-local禁用；config404/写method405；无本地RPC流量或本地数据。
7. Create页面显示677/旧合约/Mainnet费用提示，重复禁用；**不点击发送以尝试成功，不确认任何交易**。如出现交易或签名请求直接拒绝。成功链写入回归只跑隔离Mock，不用真实钱包证明成功。
8. Build日志确认Node24和默认正确lock installer、Linux依赖成功；Runtime logs检查错误/404/异常，不复制Cookie/env/Token。
9. 结束确认正式deployment基准与main不变；用户给出Preview验收结论后，才另行讨论合并/正式发布。

### G. 失败处理和日志

在具体deployment详情的Build Logs查看安装/编译错误；Runtime Logs/Observability及浏览器控制台/Network查看运行、RPC或深链错误。[构建日志指南](https://vercel.com/docs/deployments/logs)

构建失败只保留failed Preview记录并报告，不改main、Production settings或正式域名。运行失败复现于本地/Preview，提交修复和下一次feature push仍需授权；不自动重试部署、Promote、关闭保护或发交易。保留失败SHA、部署ID和脱敏错误。无Preview创建或被保护不意味着产品功能失败，先核实实际平台规则。

### H. 需要明确授权的操作

1. 清单中精确文件的git add和commit；如有变化重新审阅。
2. push到HaoGe-emm/chainproof的feature/chainproof-v2，明确接受可能自动创建Preview和公开源码。
3. 若自动部署未发生，手工创建指定commit的**Preview**。
4. 保护策略修改/Preview环境修改均单独批准；首选保持设置、由用户正常访问。
5. PR、merge main、Production发布、Promote、回滚等**不属于5B-2 Preview授权**，后续单独批准。

## 6. 回滚途径及限制

Preview不替换正式站时无需生产回滚；保留旧Production不动。若未来批准正式发布，可用Instant Rollback恢复已记录的旧production deployment。官方Hobby通常限制上一次生产部署，Pro/Enterprise允许符合条件的历史目标；实际项目套餐、权限、保留和目标可用性必须确认。[官方回滚说明](https://vercel.com/docs/instant-rollback)

回滚网站不回滚链上交易，也不自动把当前环境变量应用到旧build。没有合适目标时，可对确实记录的旧Source建立恢复PR/构建预览；重建有依赖变化风险。任何回滚、revert、merge或重新发布都须授权，禁止reset/force-push。现在既未创建Preview，也没有为当前生产做任何变更。

## 7. 结论

文件和本地发布基础已准备好，**仍不能直接执行push或创建Preview**：需补生产真实身份/域名映射基准，确认项目实际Preview规则、变量作用域和访问保护，再取得5B-2明确授权。当前main HEAD只作仓库证据，历史deployment只作候选线索。已停止，等待用户补充/验收。
