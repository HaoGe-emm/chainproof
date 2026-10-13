# ChainProof 2.0 — Stage 5A pre-release acceptance

检查日期：**2026-10-13（Asia/Shanghai）**。采用方案 A：发布单文件存证产品，**不发布正式 Version History**。本轮只做发布准备；没有 Git 提交、推送、合并、Tag、Vercel 发布、生产设置修改或公共链写入。

## 1. Git、现有网站与数据保护

- 当前分支 `feature/chainproof-v2`；本地该分支和 `main` HEAD 均为 `7f6fd8fc126af2a9493f84755f710b4eab2f1e57`，2.0 工作主要仍为未提交修改/未跟踪源文件。没有清理工作区。
- 本地 origin：`https://github.com/HaoGe-emm/chainproof.git`。GitHub 公开 API 核对远程 `main` 为同一提交；不能用本地 HEAD 推断当前 Vercel deployment 的具体 ID。
- 用户本轮亲自核对 Vercel：绑定 `HaoGe-emm/chainproof`；Production Branch `main`；Framework Next.js；Root `./`；Node24.x；Install/Build/Output/Development Override 均关闭。Include files outside root Enabled。Skip unchanged deployments 的实际行为未确认，不能依赖它避免部署。
- 原正式网站 `https://chainproof-two.vercel.app` 首页 GET200，标题 ChainProof。官网只读浏览器 smoke 检查与2.0本地构建测试分开记录。
- 不依赖离线31338，没有启动/重建/恢复/重置31337或31338。八个受保护合约、ABI、主网/哈希/钱包及恢复工具文件的 SHA-256 未改变；三份已有备份字节未改变。Opening记录位于 `.local-evm/release-5a/opening-1791892293252.json`。
- 所有原素材、历史文档、链备份保留。新增 `.gitignore` 规则仅防误上传，不删除文件。

## 2. 发布范围与 A–O 回归

| 项目 | 实际检查 / 结论 | 限制 |
| --- | --- | --- |
| A 首页/导航 | 四个主导航、四个首页入口、真实主网示例证书链接；浏览器回归通过 | 新版尚未部署官网 |
| B 钱包 | 初始化只读账户/链；模拟连接拒绝、账户切换、disconnect、旧异步请求隔离通过 | 不是本轮真实 MetaMask 主网人工验收；没有新增断开按钮，处理钱包断开事件 |
| C 错误网络 | 提示；用户操作后仅切677；4902添加参数、genesis核对静态审阅和模拟通过 | 不自动切Hardhat；真实扩展添加网络交互待Preview人工检查 |
| D SHA-256 | 浏览器 File.arrayBuffer + crypto.subtle.digest；64位hex；同文件/改一字/空文件/读失败测试通过 | 文件整体读入内存，大文件需考虑设备内存；原文件不上传 |
| E Create Proof | 模拟 provider 强制检查旧合约地址和registerProof(bytes32) calldata；拒绝、重复、RPC错误、回执成功/失败、账户变更和刷新恢复通过 | 没有发真实主网交易；TxHash不等于成功 |
| F Verify | 已登记/未登记/失败与Retry浏览器检查通过，真实已知proof另做RPC读取 | 未登记和错误场景使用标明的夹具 |
| G My Proofs | 部署起点25857169、indexed owner、10000分块、六块项目策略、最新优先、10条显示分页、部分结果/钱包切换检查通过；真实owner事件查询命中已知交易 | 完整已知钱包历史未在真实MetaMask会话重新全量验收；单RPC服务限制仍存在 |
| H RPC异常 | 新增429有界退避、超时缩块并抛错；既有范围限制/部分失败测试及浏览器Retry通过 | 不是压测公共RPC；失败不显示为空记录 |
| I 公开证书 | 无钱包真实mainnet读取；非法URL/不存在/错误深链通过 | 读取来自公共RPC，不提供版权认证 |
| J Verify Your Copy | 实际浏览器哈希，MATCH/MISMATCH/读失败及不存在/RPC失败不得MATCH通过 | 正例夹具明确标识；真实证书仅做本地不同文件MISMATCH，本轮无新登记 |
| K QR/分享 | jsQR解码；复制完整Hash/钱包/证书链接；localhost、虚拟Preview和Production当前origin链接通过 | 虚拟origin是本地拦截测试，不是Vercel已部署验证；Preview保护可能阻止他人扫码访问 |
| L 打印/PDF | 浏览器print媒体、隐藏交互、QR保留、生成单页A4并渲染检查；修正深色页面边缘 | 系统打印对话框和实际打印机待人工；PDF是链上数据展示副本 |
| M 刷新/深链 | 主产品刷新恢复、证书直达、所有Version History直达及reload通过 | 交易恢复依赖当前tab的sessionStorage，禁用时明确提示 |
| N 桌面/移动 | 320/375/768/1440宽度主页面无横向溢出，证书长URL/字段/375截图检查通过 | 真实手机Safari/MetaMask浏览器待人工 |
| O Version History | 见下一节：默认关闭及flag/query/storage攻击检查通过 | 不公开部署V2，不展示本地Work为主网 |

## 3. Version History 生产隔离

统一服务器判断在 `lib/development-features.ts`：必须同时满足 `NODE_ENV === development` 与对应标志精确为 `1`。缺少变量默认false；production和Vercel Preview的正常production构建永远false。

| 功能 | 开发标志 | 生产直接访问 |
| --- | --- | --- |
| 浏览器原型 | CHAINPROOF_VERSION_PROTOTYPE | `/works`、`/works/new`、`/works/[workId]`仅显示 Version History unavailable，无模拟记录/控件 |
| 原本地EVM | CHAINPROOF_LOCAL_EVM | `/local-evm/works`及详情/新建只显示禁用说明 |
| MetaMask隔离EVM | CHAINPROOF_METAMASK_LOCAL | `/metamask-local`仅显示禁用说明 |

禁用页面可能HTTP200，它们是明确的“未提供此功能”界面；**不能根据200认定交易功能开放**。两条config GET返回404，POST/PUT/PATCH/DELETE返回405。服务器不会因URL/query/header/body里的变量而开启功能。

测试包括：所有标志开启的生产预览、未设置开发标志的最终构建/预览、模拟保存的合法Local Work4/6、直达/刷新、查询参数欺骗、无RPC流量、无钱包连接/切链/签名/发送请求。主导航无Version History。开发代码、V2 Solidity和工具都仍保留，但不激活生产功能。

服务器门禁不能保护用户单独启动的Hardhat裸RPC。本轮不启动它们；发布不要运行 `dev:version`、setup、resume、fund或恢复命令。

## 4. BOT生产配置

`lib/chainproof.ts`固定：677 / `https://rpc.botchain.ai` / `https://scan.botchain.ai` / 原合约 `0xC64CEF65ccd720664cc3bfd7D970b6F866E53052`。ABI保持registerProof/getProof/ProofRegistered。无测试网回退。

最新本轮只读核验：快照26544358，原代码1062bytes，Keccak256 `0xf1737614e88192546a33fff680f0892d435fa13aa755d2f429f38d54aced73bc`。已知交易 `0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc` 成功；Hash `0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625`返回登记钱包 `0x89F415bb42e356E8b892C10B05522e0a8Ef151F3`、时间1791426243、exists true。owner单区块事件筛选返回该交易。

完整只读输出：`.local-evm/compatibility/2026-10-13T11-58-01-095Z-253e10b7/mainnet-readonly.json`；owner结果位于 `.local-evm/release-5a/owner-read-957fc5d4-bc12-4ffa-b4da-a935b62ced04.json`。构造模拟不是部署，本轮所有公共方法只读/估算。

生产浏览器没有导入Hardhat运行时、私钥或签名配置。页面访问只读取已授权账户；连接/切网络/发送交易均来自用户点击。读文件只送Hash作为getProof参数；文件名、Title/Proof Type为屏幕标签，不上传、不进链。

## 5. 工程与安全

- 实测 Node24.21.0、Next16.3.8、TypeScript5.9.3、viem2.57.3。已补package.json engines24.x，与用户确认的Vercel24.x一致。Next包最低Node要求>=20.9.0。
- 只有pnpm-lock.yaml，无package-lock混用；所有package依赖specifier与lock importer一致。`pnpm install --frozen-lockfile --lockfile-only --ignore-scripts`完成，离线复核也完成。使用pnpm11.25.0进行核验，没有升级依赖。这个检查**不是全新Linux安装/构建验证**。
- Vercel官方当前表列pnpm6–10，lockfile9.0对应9/10。不要假定云端运行本地11.25；保留默认Install配置，在Preview日志核对实际安装器和Linux原生依赖。未启用Corepack、未新增vercel.json、未修改项目设置。
- public/静态资产不存在新增外部图片依赖；候选源文件相对及@/导入的真实大小写检查无错误。需Preview最终确认Linux构建。
- 两条开发config route有node:fs动态依赖，但生产门禁先返回404，不读取本地manifest。不使用文件上传API、数据库、后端存证服务或主网私钥。证书是动态路径，不能改为静态导出output:export而丢失任意Hash深链。
- 候选源代码/文档扫描发现零疑似凭据；扫描不会打印匹配值。已检查根目录无.env文件。模式扫描不是数学证明；5B提交前仍需复查暂存内容。
- 忽略node_modules、Next各构建目录、.env*、日志/系统文件、.local-evm、.metamask-local、.vercel、.presentation-build和docs/local-evm-recovery-baseline.json。最后一项是本地数据导出，应保留本机而不公开。tests/fixtures/local-replay-prefix.json是已知公开开发账户生成的合成测试夹具，不是用户链备份。

### 环境变量清单

正式产品不需要应用秘密环境变量；RPC、合约、网络是公开常量。不要在平台自定义NODE_ENV；让Next/Vercel设置production。三个CHAINPROOF开发标志在生产和Preview应省略。PLAYWRIGHT_MODULE、CHAINPROOF_TEST_URL、CHAINPROOF_BROWSER_CHANNEL是测试命令配置，不是发布环境配置。生产证书URL使用window.location.origin，不需要硬编码域名或NEXT_PUBLIC_SITE_URL。

## 6. 执行的检查

| 命令 | 本轮结果 |
| --- | --- |
| npm test | **77/77通过**（包含新增门禁、429、超时测试） |
| npm run lint | 通过；该script实际执行tsc --noEmit，不是ESLint |
| npm run build | 最终修复后通过 |
| npm run test:contracts:local | 27/27通过，隔离EVM授权/安全/恢复 |
| npm run test:wallet:local | 48/48通过，测试环境签名/恢复/状态保护 |
| npm run test:compatibility:local | 10/10通过，独立进程内31339 |
| node tests/product-browser.mjs | 通过；钱包/RPC夹具，实际Hash、calldata、receipt状态、导航、响应式 |
| node tests/certificate-browser.mjs | 通过；真实证书只读及独立夹具、复制、QR、PDF、异步钱包 |
| node tests/release-production-browser.mjs | 通过；新增原型门禁/直达/刷新/合法存储/无RPC与权限请求 |
| node tests/local-production-gate.mjs | 通过；原本地链入口/config隔离 |
| node tests/metamask-production-gate.mjs | 通过；MetaMask本地链入口/config隔离 |
| node tests/live-site-readonly.mjs | 通过；现有官网 /、/register、/verify 均200，无钱包、无非GET/HEAD请求 |
| pnpm frozen lockfile，线上metadata与离线核验 | 通过；非clean Linux install |
| 主网read-only脚本与owner事件查询 | 通过；未发送公共交易 |

套件有重叠，不能累加为独立用例数。浏览器测试使用独立127.0.0.1:3009；只关闭本轮创建的预览，不操作用户服务。模拟钱包不是实际MetaMask人工主网验收。历史4C-2人工本地钱包验收也不能替代本轮公开部署后验收。

`tests/local-version-browser.mjs`、`tests/version-security-browser.mjs`及`tests/metamask-local-browser.mjs`需要独立的开发EVM/manifest，本轮不重跑；它们属于暂缓发布的版本写入功能，不能为了回归擅自恢复8545/18547。`tests/version-history-browser.mjs`只适用于显式开启原型的development服务，不再对production运行。上述业务模型/合约/钱包仍通过本轮离线和隔离EVM套件核验，生产不可用路径则由三个专门浏览器门禁测试核验。

打印最终产物 `.next/certificate-qa/certificate.pdf` 为一页A4（约594.96×841.92pt），已用Poppler渲染目视核对无黑色边缘、内容裁切或缺失；不应提交这些QA产物。公开站检查记录 `.local-evm/release-5a/live-site-1791893331492.json`。初次源扫描129文件无疑似凭据/导入大小写/lock specifier错误；新文档与最终文件清单另经复核。

## 7. 本轮小范围修复

1. `/works`生产直达会展示模拟原型：增加统一开发门禁；复用到两条本地layout/config，默认关闭，保留源码。
2. 生产禁用MetaMask本地页的页头/页脚仍带31338标签：仅开发模式显示本地标签。
3. 成功单回执写作Registration Confirmed：改为**Registration Included**及明确非最终性说明；Waiting for Confirmation改Waiting for Receipt。只改文案，没有改变写入/回执规则。浏览器精确断言同步更新，未删除或放宽安全断言。
4. PDF深色页边：print中的:root color-scheme明确light，补计算样式断言并渲染复核。
5. 缺失Node要求和忽略规则：补engines24.x、可复现安装说明、素材/平台metadata/本地数据导出的忽略规则。

修改文件：`.gitignore`、`package.json`、`README.md`、`app/globals.css`、`app/register/page.tsx`、三条开发layout、两条config route、`components/site-header.tsx`、`tests/README.md`、`tests/product-browser.mjs`、`tests/certificate-browser.mjs`、`tests/proof-history.test.mjs`。新增 `lib/development-features.ts`、`tests/development-features.test.mjs`、`tests/release-production-browser.mjs`、`tests/live-site-readonly.mjs`及本轮两份文档。`next-env.d.ts`为Next生成文件，构建可能更新其类型引用。

## 8. 决策、剩余限制与阻断

**符合方案A；具备进入经授权Vercel Preview验证的本地基础，不等于已经通过云端发布验收。** 未发现本轮证据表明旧1.0核心存在严重发布阻断问题。

Preview前必须记录当前生产Deployment ID/不可变URL和实际Git SHA（本轮用户提供了项目设置，未提供该deployment记录），并批准feature提交/推送或明确的Preview创建。禁止修改main或生产域名来“测试”。Preview必须验证Linux安装/构建、保护策略与扫码、真实扩展/手机。正式发布前用户必须验收Preview并单独批准合并/生产发布。

仍有限制：单公共RPC和日志文档矛盾；六块策略不是官方最终性保证；版权/身份/创作时间不能由Hash登记证明；大文件内存；无本轮真实主网签名验收；无公共V2、无专业安全审计。这些必须如实保留，不展示模拟记录为主网。

下一步严格按 `chainproof-v2-release-runbook.md`，等待授权。本轮不恢复离线本地节点、不关机。

### 参考（2026-10-13核对）

- [Vercel Node版本](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel lockfile与安装器](https://vercel.com/docs/package-managers)
- [Git生产/Preview分支](https://vercel.com/docs/git)
- [已核对远程main](https://api.github.com/repos/HaoGe-emm/chainproof/branches/main)
