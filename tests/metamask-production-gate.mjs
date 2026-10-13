import assert from "node:assert/strict";
import {createRequire}from "node:module";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const base=process.env.CHAINPROOF_TEST_URL||"http://127.0.0.1:3007",browser=await chromium.launch({headless:true,channel:process.env.CHAINPROOF_BROWSER_CHANNEL||undefined});
try{
  const page=await browser.newPage(),requests=[];page.on("request",r=>{if(r.url().includes(":18547"))requests.push(r.url());});
  for(const suffix of ["","?CHAINPROOF_METAMASK_LOCAL=1&NODE_ENV=development","?chainId=31338&rpc=http://127.0.0.1:18547"]){assert.equal((await page.request.get(`${base}/metamask-local/config${suffix}`,{headers:{Origin:"http://127.0.0.1:3006"}})).status(),404);}
  for(const method of ["POST","PUT","DELETE","PATCH"])assert.equal((await page.request.fetch(`${base}/metamask-local/config`,{method,data:{method:"eth_sendTransaction"}})).status(),405);
  await page.goto(`${base}/metamask-local?CHAINPROOF_METAMASK_LOCAL=1`);await page.getByRole("heading",{name:"MetaMask local testing disabled",exact:true}).waitFor();
  for(const name of ["Connect MetaMask","Switch to Local 31338","Create Work","Register Local Proof","Add Version"])assert.equal(await page.getByRole("button",{name,exact:true}).count(),0);
  assert.deepEqual(requests,[]);console.log("PASS: production flag/query spoofing cannot expose config, wallet, local write proxy or 31338 RPC traffic.");
}finally{await browser.close();}
