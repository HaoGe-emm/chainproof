// Node-only funding from the PUBLIC Hardhat development mnemonic. Never import
// this known test seed into a real wallet; no user key/seed is read or stored.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPublicClient,createWalletClient,http,isAddress,parseEther,keccak256,defineChain } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { root } from "../local-evm/compile.mjs";
import { validateMetaDeployment } from "../../lib/metamask-local-config.ts";
export function fundingTarget(args){
  const address=args[0];if(!isAddress(address)||/^0x0{40}$/i.test(address))throw new Error("Provide the confirmed PUBLIC test wallet address only");
  if(args.slice(1).some(v=>v!==`--confirm-address=${address}`))throw new Error("Only explicit matching --confirm-address is accepted; RPC/network overrides forbidden");
  return {address,confirmed:args.includes(`--confirm-address=${address}`)};
}
if(process.argv[1]?.endsWith("fund.mjs")){
  try{
    const {address,confirmed}=fundingTarget(process.argv.slice(2));
    const b=validateMetaDeployment(JSON.parse(await readFile(path.join(root,".metamask-local/active.json"),"utf8")));
    const transport=http("http://127.0.0.1:18547",{retryCount:0,timeout:4000}),reader=createPublicClient({transport});
    if(await reader.getChainId()!==31338 || (await reader.getBlock({blockNumber:BigInt(0)})).hash!==b.genesisHash || keccak256(await reader.getCode({address:b.registry}))!==b.registryCodeHash || !(await reader.request({method:"web3_clientVersion"})).includes("HardhatNetwork"))throw new Error("Incorrect isolated funding RPC/configuration");
    console.log(JSON.stringify({mode:confirmed?"CONFIRMED LOCAL SIMULATED TRANSFER":"DRY RUN, NO TRANSFER",chainId:31338,rpc:b.rpcUrl,to:address,simulatedETH:"5"}));
    if(confirmed){
      const account=mnemonicToAccount("test test test test test test test test test test test junk");
      if(account.address.toLowerCase()!==b.funder.toLowerCase())throw new Error("Wrong PUBLIC development funder");
      const chain=defineChain({id:31338,name:"MetaMask Local Test",nativeCurrency:{name:"Simulated ETH",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["http://127.0.0.1:18547"]}}});
      const wallet=createWalletClient({account,chain,transport});
      const hash=await wallet.sendTransaction({to:address,value:parseEther("5")});const receipt=await reader.waitForTransactionReceipt({hash});if(receipt.status!=="success")throw new Error("Local funding reverted");
      console.log(JSON.stringify({transaction:hash,status:"LOCAL SIMULATED ETH ONLY",block:String(receipt.blockNumber)}));
    }
  }catch(cause){console.error(`Funding refused: ${cause.shortMessage||cause.message}`);process.exitCode=1;}
}
