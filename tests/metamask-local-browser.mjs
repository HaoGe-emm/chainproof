// Mock EIP-1193 + ephemeral Node test signers + actual 31338 EVM.
// This is NOT a real MetaMask browser-extension signature acceptance test.
import assert from "node:assert/strict";
import {createRequire}from "node:module";
import {readFile,mkdir,writeFile}from "node:fs/promises";
import {randomUUID}from "node:crypto";
import {createPublicClient,createWalletClient,http,parseEther,keccak256,toFunctionSelector}from "viem";
import {generatePrivateKey,privateKeyToAccount,mnemonicToAccount}from "viem/accounts";
import {metaTestChain}from "../tools/metamask-local/runtime.mjs";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const config=JSON.parse(await readFile(".metamask-local/active.json","utf8")),base="http://127.0.0.1:3006",rpc=process.env.CHAINPROOF_METAMASK_TEST_RPC,browserRpc="http://127.0.0.1:18547";
assert.equal(rpc,"http://127.0.0.1:18548","Browser test writes require the owned isolated recovery node; existing 18547 is forbidden");
const transport=http(rpc,{retryCount:0}),reader=createPublicClient({chain:metaTestChain,transport});
assert.equal(await reader.getChainId(),31338);assert.equal((await reader.getBlock({blockNumber:BigInt(0)})).hash,config.genesisHash);
const accounts=[privateKeyToAccount(generatePrivateKey()),privateKeyToAccount(generatePrivateKey())];
const run=randomUUID();
const funding=createWalletClient({account:mnemonicToAccount("test test test test test test test test test test test junk"),chain:metaTestChain,transport});
for(const account of accounts)await funding.sendTransaction({to:account.address,value:parseEther("2")});
const wallets=accounts.map(account=>createWalletClient({account,chain:metaTestChain,transport})),broadcasts=[];
const browser=await chromium.launch({headless:true,channel:process.env.CHAINPROOF_BROWSER_CHANNEL||undefined});
const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
await context.route("https://rpc.botchain.ai/**",route=>route.abort());
await context.route(`${browserRpc}/**`,async route=>{const response=await fetch(rpc,{method:"POST",headers:{"Content-Type":"application/json"},body:route.request().postData(),redirect:"error"});try{await route.fulfill({status:response.status,contentType:"application/json",body:await response.text()});}catch(cause){if(!/already handled|closed|disposed/i.test(cause.message))throw cause;}});
await context.exposeBinding("mockWalletSend",async(_,tx,forceRevert,loseResponse)=>{
  assert.equal(tx.chainId,"0x7a6a");assert.ok([config.original,config.registry].includes(tx.to.toLowerCase()));
  const index=accounts.findIndex(a=>a.address.toLowerCase()===tx.from.toLowerCase());assert.ok(index>=0);
  const hash=await wallets[index].sendTransaction({to:tx.to,data:tx.data,value:BigInt(0),...(forceRevert?{gas:BigInt(30000)}:tx.gas?{gas:BigInt(tx.gas)}:{})});broadcasts.push({hash,owner:accounts[index].address});if(loseResponse)throw new Error("Fixture RPC timeout after broadcast");return hash;
});
await context.addInitScript(({addresses,rpc})=>{
  const handlers=new Map(),settings={authorized:false,index:0,chain:"0x2a5",rejectConnect:false,rejectSwitch:false,rejectTx:false,sends:0,switches:0,badGenesis:false};
  const emit=(name,value)=>{for(const fn of handlers.get(name)||[])fn(value);};
  window.mockWallet=settings;window.mockAccount=index=>{settings.index=index;emit("accountsChanged",settings.authorized?[addresses[index]]:[]);};window.mockChain=chain=>{settings.chain=chain;emit("chainChanged",chain);};
  window.ethereum={isMetaMask:true,on:(name,fn)=>{if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeListener:(name,fn)=>handlers.get(name)?.delete(fn),request:async({method,params=[]})=>{
    if(method==="eth_accounts")return settings.authorized?[addresses[settings.index]]:[];
    if(method==="eth_requestAccounts"){if(settings.rejectConnect)throw {code:4001};settings.authorized=true;emit("accountsChanged",[addresses[settings.index]]);return [addresses[settings.index]];}
    if(method==="eth_chainId")return settings.chain;
    if(method==="wallet_switchEthereumChain"){settings.switches++;if(settings.rejectSwitch)throw {code:4001};settings.chain=params[0].chainId;emit("chainChanged",settings.chain);return null;}
    if(method==="wallet_addEthereumChain")return null;
    if(method==="eth_sendTransaction"){settings.sends++;if(settings.rejectTx)throw {code:4001};return window.mockWalletSend(params[0],settings.forceRevert,settings.loseResponse);}
    if(settings.badGenesis&&method==="eth_getBlockByNumber")return {hash:`0x${"f".repeat(64)}`};
    const response=await fetch(rpc,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});const result=await response.json();if(result.error)throw result.error;return result.result;
  }};
},{addresses:accounts.map(a=>a.address),rpc:browserRpc});
const select=async(name)=>{await page.locator("#file-input").setInputFiles({name:`${name}.txt`,mimeType:"text/plain",buffer:Buffer.from(`MetaMask isolated browser fixture ${run} ${name}`)});await page.getByRole("textbox",{name:"MetaMask local file hash",exact:true}).inputValue();};
const status=()=>page.getByTestId("meta-phase");
const deadline=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error(`Fixture barrier timed out: ${label}`)),20000);timer.unref();})]);
const register=async(name)=>{console.log(`QA register ${name}`);await select(name);await page.getByText("Original Proof Not Found",{exact:true}).waitFor();await page.getByRole("button",{name:"Register Local Proof",exact:true}).click();await status().filter({hasText:"Local Proof Registered"}).waitFor();await page.getByText("Original Proof Ready",{exact:true}).waitFor();};
try{
  console.log("QA start local page");await page.goto(`${base}/metamask-local`);await page.getByText("Local Work Loaded",{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.mockWallet.switches),0);assert.equal(broadcasts.length,0);
  assert.equal(await page.getByRole("button",{name:"Connect Wallet",exact:true}).count(),0,"Mainnet connect control suppressed only in this test module");
  await page.evaluate(()=>window.mockWallet.rejectConnect=true);await page.getByRole("button",{name:"Connect MetaMask",exact:true}).click();await page.getByRole("alert").filter({hasText:"Connection Rejected"}).waitFor();
  await page.evaluate(()=>window.mockWallet.rejectConnect=false);await page.getByRole("button",{name:"Connect MetaMask",exact:true}).click();await page.getByTestId("meta-wallet").filter({hasText:accounts[0].address}).waitFor();
  await page.getByText(/Wrong Network · writes disabled/).waitFor();assert.equal(broadcasts.length,0);
  await page.evaluate(()=>window.mockWallet.rejectSwitch=true);await page.getByRole("button",{name:"Switch to Local 31338",exact:true}).click();await page.getByRole("alert").filter({hasText:"Network Switch Rejected"}).waitFor();
  await page.evaluate(()=>window.mockWallet.rejectSwitch=false);await page.getByRole("button",{name:"Switch to Local 31338",exact:true}).click();await page.getByText("Wallet Chain ID: 31338",{exact:true}).waitFor();
  await register("v1");const previousRegistration=broadcasts.at(-1).hash;const before=broadcasts.length;
  await page.evaluate(()=>window.mockWallet.rejectTx=true);await page.getByRole("button",{name:"Create Work",exact:true}).click();await status().filter({hasText:"Transaction Rejected"}).waitFor();assert.equal(broadcasts.length,before);assert.equal(await page.getByTestId("meta-current-transaction").count(),0);assert.ok((await page.getByTestId("meta-previous-transaction").textContent()).includes(previousRegistration));assert.equal(await status().getByText("Transaction Submitted",{exact:true}).count(),0);
  await page.evaluate(()=>window.mockWallet.rejectTx=false);
  let release,started;const held=new Promise(resolve=>{release=resolve;}),seen=new Promise(resolve=>{started=resolve;});
  await page.route(`${browserRpc}/**`,async route=>{if(route.request().postDataJSON().method==="eth_getTransactionReceipt"){started();await held;}try{await route.fallback();}catch{}});
  const beforeCreate=broadcasts.length;await page.getByRole("button",{name:"Create Work",exact:true}).click({trial:true});await page.evaluate(()=>{const b=[...document.querySelectorAll("button")].find(v=>v.textContent==="Create Work");b.click();b.click();});await deadline(seen,"create receipt");assert.equal(broadcasts.length,beforeCreate+1,"Same-tick clicks cannot broadcast twice");
  assert.equal(await page.getByRole("button",{name:"Create Work",exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.mockAccount(1));await page.getByTestId("meta-wallet").filter({hasText:accounts[1].address}).waitFor();
  assert.ok((await page.getByTestId("meta-tx-owner").textContent()).includes(accounts[0].address));
  await status().filter({hasText:"Pending Confirmation / RPC Error"}).waitFor({timeout:20000});assert.equal(await page.getByTestId("meta-current-transaction").count(),1);assert.ok(!(await status().textContent()).includes("Rejected"));
  release();await page.getByRole("button",{name:"Retry Local Receipt",exact:true}).click();await status().filter({hasText:"Work Created"}).waitFor();await page.getByTestId("meta-count").filter({hasText:/^1$/}).waitFor();
  const workId=await page.getByRole("textbox",{name:"MetaMask local Work ID",exact:true}).inputValue();
  await page.unroute(`${browserRpc}/**`);
  await register("account2-own");await page.getByText("Unauthorized Wallet for selected Work",{exact:true}).first().waitFor();assert.ok((await page.getByTestId("meta-readiness").textContent()).includes("Unauthorized Wallet"));assert.ok(!(await page.getByTestId("meta-readiness").textContent()).includes("Ready to Submit"));assert.equal(await page.getByRole("button",{name:"Add Version",exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.mockAccount(0));await page.getByTestId("meta-wallet").filter({hasText:accounts[0].address}).waitFor();
  await register("v2");await page.getByTestId("meta-readiness").filter({hasText:"Ready to Submit"}).waitFor();const previousV2Registration=broadcasts.at(-1).hash;await page.evaluate(()=>window.mockWallet.rejectTx=true);await page.getByRole("button",{name:"Add Version",exact:true}).click();await status().filter({hasText:"Transaction Rejected"}).waitFor();assert.equal(await page.getByTestId("meta-count").textContent(),"1");assert.equal(await page.getByTestId("meta-current-transaction").count(),0);assert.ok((await page.getByTestId("meta-previous-transaction").textContent()).includes(previousV2Registration));
  await page.evaluate(()=>window.mockWallet.rejectTx=false);
  let releaseRefresh,receiptStarted;const refreshHeld=new Promise(r=>{releaseRefresh=r;}),refreshSeen=new Promise(r=>{receiptStarted=r;});
  await page.route(`${browserRpc}/**`,async route=>{if(route.request().postDataJSON().method==="eth_getTransactionReceipt"){receiptStarted();await refreshHeld;}try{await route.fallback();}catch{}});
  await page.getByRole("button",{name:"Add Version",exact:true}).click();await deadline(refreshSeen,"refresh receipt");const broadcastsAtRefresh=broadcasts.length;await page.reload();await page.getByTestId("meta-tx-owner").filter({hasText:accounts[0].address}).waitFor();
  releaseRefresh();await status().filter({hasText:"Version Added"}).waitFor();assert.equal(broadcasts.length,broadcastsAtRefresh,"Refresh only resumes receipt lookup, never signs/sends");await page.getByTestId("meta-count").filter({hasText:/^2$/}).waitFor();await page.unroute(`${browserRpc}/**`);
  await page.getByRole("button",{name:"Connect MetaMask",exact:true}).click();await page.getByRole("button",{name:"Switch to Local 31338",exact:true}).click();await page.getByText("Wallet Chain ID: 31338",{exact:true}).waitFor();
  await register("v3");await page.getByRole("button",{name:"Add Version",exact:true}).click();await status().filter({hasText:"Version Added"}).waitFor();await page.getByTestId("meta-count").filter({hasText:/^3$/}).waitFor();
  await page.getByText("Duplicate Hash",{exact:true}).waitFor();assert.ok((await page.getByTestId("meta-readiness").textContent()).includes("Duplicate Hash"));assert.equal(await page.getByRole("button",{name:"Add Version",exact:true}).isDisabled(),true);
  const lastAdded=broadcasts.at(-1).hash;await select("v4-rejected");await page.getByText("Original Proof Not Found",{exact:true}).waitFor();const beforeRejectedRegistration=broadcasts.length;await page.evaluate(()=>window.mockWallet.rejectTx=true);await page.getByRole("button",{name:"Register Local Proof",exact:true}).click();await status().filter({hasText:"Transaction Rejected"}).waitFor();assert.equal(broadcasts.length,beforeRejectedRegistration);assert.equal(await page.getByTestId("meta-current-transaction").count(),0);assert.ok((await page.getByTestId("meta-previous-transaction").textContent()).includes(lastAdded));assert.equal(await page.getByTestId("meta-count").textContent(),"3");await page.evaluate(()=>window.mockWallet.rejectTx=false);await select("v3");await page.getByText("Original Proof Ready",{exact:true}).waitFor();
  for(const chain of ["0x1","0x2a5","0x7a69"]){await page.evaluate(value=>window.mockChain(value),chain);await page.getByText(/Wrong Network · writes disabled/).waitFor();assert.equal(await page.getByRole("button",{name:"Create Work",exact:true}).isDisabled(),true);assert.ok((await page.getByTestId("meta-readiness").textContent()).includes("Wrong Network"));}
  await page.evaluate(()=>window.mockChain("0x7a6a"));await page.getByText("Wallet Chain ID: 31338",{exact:true}).waitFor();
  await page.evaluate(()=>window.mockWallet.forceRevert=true);await page.getByRole("button",{name:"Create Work",exact:true}).click();await status().filter({hasText:"Transaction Reverted"}).waitFor();assert.equal(await page.getByTestId("meta-count").textContent(),"3");await page.evaluate(()=>window.mockWallet.forceRevert=false);
  await page.evaluate(()=>window.mockWallet.badGenesis=true);const beforeConfusion=broadcasts.length;await page.getByRole("button",{name:"Create Work",exact:true}).click();await page.getByRole("alert").filter({hasText:"Incorrect Local Configuration"}).waitFor();assert.equal(broadcasts.length,beforeConfusion);await page.evaluate(()=>window.mockWallet.badGenesis=false);
  let releaseCall,callStarted;const callHold=new Promise(r=>{releaseCall=r;}),callSeen=new Promise(r=>{callStarted=r;});let heldOnce=false;
  await page.route(`${browserRpc}/**`,async route=>{const item=route.request().postDataJSON();if(!heldOnce&&item.method==="eth_call"&&item.params[0].data?.startsWith(toFunctionSelector("createWork(bytes32)"))){heldOnce=true;callStarted();await callHold;}await route.fallback();});
  const beforeRace=broadcasts.length;await page.getByRole("button",{name:"Create Work",exact:true}).click();await deadline(callSeen,"ABA preflight");await page.evaluate(()=>{window.mockAccount(1);window.mockAccount(0);});releaseCall();await page.getByRole("alert").filter({hasText:"Wallet Changed"}).waitFor();assert.equal(broadcasts.length,beforeRace);await page.unroute(`${browserRpc}/**`);
  await page.evaluate(()=>window.mockWallet.loseResponse=true);await page.getByRole("button",{name:"Create Work",exact:true}).click();await status().filter({hasText:"Submission Uncertain"}).waitFor();assert.equal(await page.getByRole("button",{name:"Create Work",exact:true}).isDisabled(),true);
  const lost=broadcasts.at(-1).hash,countBeforeRecovery=broadcasts.length;await page.reload();await page.getByRole("textbox",{name:"Wallet transaction Hash",exact:true}).fill(lost);await page.getByRole("button",{name:"Track MetaMask Transaction",exact:true}).click();await status().filter({hasText:"Work Created"}).waitFor();assert.equal(broadcasts.length,countBeforeRecovery,"Unknown submission recovery never resends");
  await page.getByRole("textbox",{name:"MetaMask local Work ID",exact:true}).fill(workId);
  await page.reload();await page.getByTestId("meta-count").filter({hasText:/^3$/}).waitFor();
  const fresh=await browser.newContext();await fresh.route(`${browserRpc}/**`,async route=>{const response=await fetch(rpc,{method:"POST",headers:{"Content-Type":"application/json"},body:route.request().postData(),redirect:"error"});try{await route.fulfill({status:response.status,contentType:"application/json",body:await response.text()});}catch(cause){if(!/already handled|closed|disposed/i.test(cause.message))throw cause;}});const noWallet=await fresh.newPage();await noWallet.goto(`${base}/metamask-local?work=${workId}`);await noWallet.getByTestId("meta-count").filter({hasText:/^3$/}).waitFor();assert.equal(await noWallet.evaluate(()=>Boolean(window.ethereum)),false);await fresh.close();
  await page.route(`${browserRpc}/**`,route=>route.abort());await page.getByRole("button",{name:"Retry / Refresh MetaMask Local Data",exact:true}).click();await page.getByRole("alert").filter({hasText:"RPC Unavailable"}).waitFor();assert.equal(await page.getByText("Work Not Found",{exact:true}).count(),0);await page.unroute(`${browserRpc}/**`);
  await page.getByRole("button",{name:"Retry / Refresh MetaMask Local Data",exact:true}).click();await page.getByTestId("meta-count").filter({hasText:/^3$/}).waitFor();
  await page.route(`${browserRpc}/**`,async route=>{const item=route.request().postDataJSON();if(item.method==="eth_getCode")await route.fulfill({json:{jsonrpc:"2.0",id:item.id,result:"0x"}});else await route.fallback();});await page.getByRole("button",{name:"Retry / Refresh MetaMask Local Data",exact:true}).click();await page.getByRole("alert").filter({hasText:"Contract Not Found"}).waitFor();await page.unroute(`${browserRpc}/**`);await page.getByRole("button",{name:"Retry / Refresh MetaMask Local Data",exact:true}).click();await page.getByTestId("meta-count").filter({hasText:/^3$/}).waitFor();
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);}
  await mkdir(".metamask-local/qa-closeout",{recursive:true});await page.screenshot({path:".metamask-local/qa-closeout/timeline.png",fullPage:true});
  assert.deepEqual(errors,[]);await writeFile(".metamask-local/qa-closeout/browser.json",JSON.stringify({kind:"Mock EIP-1193 + generated Node signers; NOT extension acceptance",chainId:31338,workId,broadcasts,passed:true},null,2));
  console.log("PASS: mock connect/reject/switch, signed local create/V2/V3, duplicate/permission denial, account switch after broadcast, wrong-chain and same-ID RPC confusion, ABA cancellation, refresh/fresh no-wallet history, RPC outage and mobile.");
}catch(cause){console.log(JSON.stringify({diagnosticPhase:await status().textContent().catch(()=>null),alerts:await page.getByRole("alert").allTextContents().catch(()=>[]),lastBroadcast:broadcasts.at(-1)}));await mkdir(".metamask-local/qa-closeout",{recursive:true});await page.screenshot({path:".metamask-local/qa-closeout/failure.png",fullPage:true});throw cause;}
finally{await context.close();await browser.close();}
