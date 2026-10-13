"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import type { Hex } from "viem";
import FilePicker from "@/components/file-picker";
import { getMetaMask } from "@/lib/wallet";
import { LocalWalletSession,walletMessage,type WalletSnapshot } from "@/lib/metamask-local-session";
import { validateMetaDeployment,type MetaDeployment } from "@/lib/metamask-local-config";
import { checkMetaDeployment,metaReader,metaProof,metaWork,metaVersions,scanMetaWorks,sendMeta,confirmMeta,pendingKey,restorePending,type PendingMeta,type MetaIntent } from "@/lib/metamask-local-client";
import { versionRegistryAbi } from "@/lib/version-registry-abi";
import { metaSubmitState } from "@/lib/metamask-local-readiness";
const button="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40";
const secondary="rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-40";
const input="mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-[#14161b] px-4 py-3 text-sm";
const time=(v:bigint)=>new Date(Number(v)*1000).toISOString().replace("T"," ").replace(".000Z"," UTC");
export default function MetaMaskLocal(){
  const [config,setConfig]=useState<MetaDeployment|null>(null),[envError,setEnvError]=useState("");
  const [wallet,setWallet]=useState<WalletSnapshot>({address:null,chainId:null,revision:0});
  const [available,setAvailable]=useState<boolean|null>(null),[connecting,setConnecting]=useState(false);
  const [hash,setHash]=useState(""),[candidate,setCandidate]=useState<Awaited<ReturnType<typeof metaProof>>|null>(null),[candidateState,setCandidateState]=useState(""),[checkedHash,setCheckedHash]=useState("");
  const [selected,setSelected]=useState("1"),[work,setWork]=useState<Awaited<ReturnType<typeof metaWork>>|null>(null),[versions,setVersions]=useState<Awaited<ReturnType<typeof metaVersions>>>([]),[workState,setWorkState]=useState("");
  const [ids,setIds]=useState<bigint[]>([]),[scanState,setScanState]=useState("Wallet Disconnected"),[scanProgress,setScanProgress]=useState("");
  const [linked,setLinked]=useState(false),[retry,setRetry]=useState(0),[pageBusy,setPageBusy]=useState(false),[loadedWorkId,setLoadedWorkId]=useState("");
  const [pending,setPending]=useState<PendingMeta|null>(null),[last,setLast]=useState<PendingMeta|null>(null),[previous,setPrevious]=useState<PendingMeta|null>(null),[busy,setBusy]=useState(false),[phase,setPhase]=useState(""),[error,setError]=useState(""),[storageWarning,setStorageWarning]=useState("");
  const [uncertain,setUncertain]=useState<Omit<PendingMeta,"transaction">|null>(null),[recoveryHash,setRecoveryHash]=useState("");
  const session=useRef<LocalWalletSession|null>(null),mounted=useRef(true),locked=useRef(false),receiptBusy=useRef(false),readEpoch=useRef(0),currentConfig=useRef<MetaDeployment|null>(null);
  currentConfig.current=config;
  const workId=/^[1-9][0-9]{0,77}$/.test(selected)&&BigInt(selected)<BigInt(2)**BigInt(256)?BigInt(selected):null;
  const networkReady=wallet.chainId===31338;
  const proofOwner=candidate?.[0].toLowerCase()===wallet.address?.toLowerCase();
  const proofChecked=checkedHash===hash.toLowerCase();
  const workReady=Boolean(work&&loadedWorkId===String(workId));
  const readiness=metaSubmitState({address:wallet.address,chainId:wallet.chainId,configReady:Boolean(config),envError,locked:busy||Boolean(pending)||Boolean(uncertain)||locked.current,hashValid:/^0x[0-9a-fA-F]{64}$/.test(hash),proofState:proofChecked?candidateState:"Checking Original Proof",proofExists:proofChecked&&Boolean(candidate?.[2]),proofOwner:proofChecked&&proofOwner,workState:workState==="Local Work Loaded"&&!workReady?"Loading Work":workState,workReady,controller:Boolean(workReady&&work?.controller.toLowerCase()===wallet.address?.toLowerCase()),linked:proofChecked&&linked});
  useEffect(()=>{if(!locked.current){setPhase("");setLast(null);setError("");}},[hash,wallet.revision]); // In-flight broadcasts remain intact; a new file/account starts a new context.
  useEffect(()=>{
    mounted.current=true;
    const provider=getMetaMask();setAvailable(Boolean(provider));
    if(provider){try{const local=new LocalWalletSession(provider,(snapshot)=>{if(mounted.current){readEpoch.current++;setWallet(snapshot);setIds([]);setCandidate(null);setLinked(false);}});session.current=local;void local.start();}catch(cause){setAvailable(false);setError(walletMessage(cause));}}
    const value=new URLSearchParams(window.location.search).get("work");if(value)setSelected(value);
    return()=>{mounted.current=false;readEpoch.current++;session.current?.stop();session.current=null;};
  },[]);
  useEffect(()=>{
    let active=true;setConfig(null);setEnvError("");
    void(async()=>{
      if(!["127.0.0.1","localhost","[::1]"].includes(window.location.hostname))throw new Error("Incorrect Local Configuration");
      const response=await fetch("/metamask-local/config",{cache:"no-store"});if(!response.ok)throw new Error("Contract Not Found");
      const cfg=validateMetaDeployment(await response.json());await checkMetaDeployment(cfg);
      if(!active)return;setConfig(cfg);
      try{
        const text=sessionStorage.getItem(pendingKey(cfg));const stored=text?restorePending(JSON.parse(text),cfg):null;
        if(stored){locked.current=true;setPending(stored);setLast(stored);setPhase("Pending Confirmation · restored from local transaction Hash");}
        else if(text)setStorageWarning("Saved transaction metadata is invalid or belongs to another local session.");
        const unknownText=sessionStorage.getItem(`${pendingKey(cfg)}:uncertain`);
        if(!stored && unknownText){const unknown=JSON.parse(unknownText);if(restorePending({...unknown,transaction:`0x${"0".repeat(64)}`},cfg)){locked.current=true;setUncertain(unknown);setPhase("Submission Uncertain");}}
      }catch{setStorageWarning("Session storage unavailable. Record the transaction Hash before refreshing.");}
    })().catch(cause=>{if(active)setEnvError(walletMessage(cause));});
    return()=>{active=false;};
  },[retry]);
  async function loadWork(cfg:MetaDeployment,id:bigint){
    const ticket=++readEpoch.current;setLoadedWorkId("");setWork(null);setVersions([]);setWorkState("Loading Work");
    try{await checkMetaDeployment(cfg);const record=await metaWork(cfg,id);const page=await metaVersions(cfg,id,BigInt(1),record.versionCount,record.controller);if(mounted.current&&ticket===readEpoch.current){setLoadedWorkId(String(id));setWork(record);setVersions(page);setWorkState("Local Work Loaded");}}
    catch(cause){if(mounted.current&&ticket===readEpoch.current)setWorkState(walletMessage(cause));}
  }
  useEffect(()=>{if(config){if(workId)void loadWork(config,workId);else{readEpoch.current++;setWork(null);setVersions([]);setWorkState("Work Not Found");}}},[config,selected,wallet.revision]); // Public reads always use 31338, never the wallet's wrong network.
  useEffect(()=>{
    let active=true;setIds([]);setScanProgress("");if(!config||!wallet.address){setScanState("Wallet Disconnected");return;}
    setScanState("Scanning · Partial Results until complete");
    void scanMetaWorks(config,wallet.address,()=>!active,(found,block)=>{if(active){setIds(current=>[...current,...found]);setScanProgress(`Scanned through local block ${block}`);}}).then(complete=>{if(active&&complete)setScanState("Scan Complete");}).catch(cause=>{if(active)setScanState(`Scan Failed / Partial Results · ${walletMessage(cause)}`);});
    return()=>{active=false;};
  },[config,wallet.address,wallet.revision,retry,phase]);
  useEffect(()=>{
    let active=true;setCandidate(null);setCheckedHash("");setLinked(false);setCandidateState("");
    if(!config||!/^0x[0-9a-fA-F]{64}$/.test(hash))return;
    setCandidateState("Checking Original Proof");
    void(async()=>{
      await checkMetaDeployment(config);const proof=await metaProof(config,hash.toLowerCase() as Hex);
      const used=workId&&work?await metaReader.readContract({address:config.registry,abi:versionRegistryAbi,functionName:"isHashLinked",args:[workId,hash.toLowerCase() as Hex]}):false;
      if(active){setCheckedHash(hash.toLowerCase());setCandidate(proof);setLinked(used);setCandidateState(!proof[2]?"Original Proof Not Found":proof[0].toLowerCase()!==wallet.address?.toLowerCase()?"Unauthorized Wallet":"Original Proof Ready");}
    })().catch(cause=>{if(active){setCheckedHash(hash.toLowerCase());setCandidateState(walletMessage(cause));}});return()=>{active=false;};
  },[config,hash,wallet.address,wallet.revision,work,selected,phase]);
  async function connect(){
    if(!session.current){setError("MetaMask is required");return;}
    setConnecting(true);setError("");try{await session.current.connect();}catch(cause){setError(walletMessage(cause,"connect"));}finally{if(mounted.current)setConnecting(false);}
  }
  function chooseWork(value:string){if(!locked.current){setPhase("");setLast(null);setError("");}setSelected(value);if(/^[1-9][0-9]{0,77}$/.test(value))window.history.replaceState(null,"",`/metamask-local?work=${value}`);}
  async function switchNetwork(){
    if(!session.current){setError("MetaMask is required");return;}
    setConnecting(true);setError("");try{await session.current.switchNetwork();}catch(cause){setError(walletMessage(cause,"switch"));}finally{if(mounted.current)setConnecting(false);}
  }
  function savePending(cfg:MetaDeployment,value:PendingMeta|null){
    try{if(value)sessionStorage.setItem(pendingKey(cfg),JSON.stringify(value));else sessionStorage.removeItem(pendingKey(cfg));}catch{setStorageWarning("Session storage unavailable. Record the transaction Hash before refreshing.");}
  }
  async function submit(kind:MetaIntent["kind"]){
    if(locked.current||!config||!session.current||!readiness[kind])return;
    locked.current=true;setLast(null);setBusy(true);setError("");setPhase("Awaiting Wallet Confirmation");
    const cfg=config,local=session.current;
    const intent:MetaIntent=kind==="add"?{kind,hash:hash.toLowerCase() as Hex,workId:String(workId),previous:String(work!.versionCount)}:{kind,hash:hash.toLowerCase() as Hex};
    try{
      const result=await sendMeta(cfg,local,intent,()=>mounted.current&&currentConfig.current?.session===cfg.session);
      // A broadcast transaction belongs to captured owner even if selection changed.
      if(!mounted.current)return;setLast(result);setPending(result);savePending(cfg,result);setPhase("Transaction Submitted");
    }catch(cause){if(mounted.current){
      const unknown=(cause as {unknown?:Omit<PendingMeta,"transaction">}).unknown;
      if(unknown){setUncertain(unknown);setPhase("Submission Uncertain");setError("The wallet may have broadcast. Check MetaMask activity for its local transaction Hash; do not resend.");try{sessionStorage.setItem(`${pendingKey(cfg)}:uncertain`,JSON.stringify(unknown));}catch{setStorageWarning("Record the wallet transaction Hash before refreshing.");}}
      else{locked.current=false;setPhase(walletMessage(cause));setError(walletMessage(cause));}
    }}
    finally{if(mounted.current)setBusy(false);}
  }
  async function waitForPending(cfg:MetaDeployment,details:PendingMeta){
    if(receiptBusy.current)return;receiptBusy.current=true;setPhase("Pending Confirmation");
    try{
      const result=await confirmMeta(cfg,details,(replacement,reason)=>{if(mounted.current){setPending(replacement);setLast(replacement);savePending(cfg,replacement);setPhase(`Pending Confirmation · replacement ${reason}`);}});
      if(!mounted.current)return;setLast(result.current);setPrevious(result.current);setPending(null);savePending(cfg,null);locked.current=false;setError("");
      setPhase(details.intent.kind==="register"?"Local Proof Registered":details.intent.kind==="create"?"Work Created":"Version Added");
      if(result.result!==null){setSelected(String(result.result));window.history.replaceState(null,"",`/metamask-local?work=${result.result}`);await loadWork(cfg,result.result);}
    }catch(cause){
      if(!mounted.current)return;const message=(cause as Error).message??"";
      if(message.includes("Transaction Reverted")||message.includes("Transaction Replaced")){setPending(null);savePending(cfg,null);locked.current=false;setPhase(message.includes("Transaction Replaced")?"Transaction Replaced / Cancelled":"Transaction Reverted");setError(message.includes("Transaction Replaced")?"Replacement did not perform the approved operation.":"Transaction Reverted");}
      else{setPhase("Pending Confirmation / RPC Error");setError(walletMessage(cause));} // Timeout does not mean failure; do not resend.
    }finally{receiptBusy.current=false;}
  }
  useEffect(()=>{if(config&&pending)void waitForPending(config,pending);},[config,pending]);
  function trackUnknown(){if(!config||!uncertain||!/^0x[0-9a-fA-F]{64}$/.test(recoveryHash))return;const details={...uncertain,transaction:recoveryHash as Hex};setUncertain(null);setPending(details);setLast(details);savePending(config,details);setError("");try{sessionStorage.removeItem(`${pendingKey(config)}:uncertain`);}catch{}}
  async function more(){if(!config||!workId||!work||pageBusy)return;const stamp=readEpoch.current;setPageBusy(true);try{await checkMetaDeployment(config);const page=await metaVersions(config,workId,BigInt(versions.length+1),work.versionCount,work.controller);if(mounted.current&&stamp===readEpoch.current)setVersions(current=>[...current,...page]);}catch(cause){if(mounted.current)setError(walletMessage(cause));}finally{if(mounted.current)setPageBusy(false);}}
  return <div className="w-full min-w-0 max-w-4xl self-center py-10">
    <aside className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-5 text-sm leading-6"><p className="font-semibold text-amber-300">METAMASK LOCAL TEST · LOCAL EVM · CHAIN ID 31338</p><p className="mt-2">NOT DEPLOYED TO BOT CHAIN MAINNET</p><p className="mt-2 text-zinc-400">Only a new, asset-free test wallet. RPC: http://127.0.0.1:18547. ETH here is simulated. Original chain 31337 and BOT Mainnet 677 are separate. No BOTScan or mainnet certificate links are generated.</p></aside>
    <h1 className="mt-8 text-3xl font-semibold">MetaMask Local Version History</h1>
    <div className="mt-6 rounded-xl border border-white/10 p-5"><p className="text-sm">{wallet.address?"Authorized Wallet":"Wallet Disconnected"}</p><p data-testid="meta-wallet" className="mt-2 break-all font-mono text-xs">{wallet.address??"No account authorized to this website"}</p><p className="mt-2 text-sm">Wallet Chain ID: {wallet.chainId??"Unknown"}{wallet.chainId!==null&&!networkReady?" · Wrong Network · writes disabled":""}</p><div className="mt-4 flex flex-wrap gap-3"><button className={secondary} onClick={()=>void connect()} disabled={connecting||available===false}>Connect MetaMask</button><button className={secondary} onClick={()=>void switchNetwork()} disabled={connecting||busy}>Switch to Local 31338</button></div>{available===false&&<p className="mt-3 text-sm text-amber-200">MetaMask is required.</p>}<p className="mt-3 text-xs text-zinc-400">Connect grants website access. Switching networks requires your separate click. The extension will ask you to confirm each transaction.</p></div>
    {envError&&<p role="alert" className="mt-5 text-red-300">{envError}</p>}
    {!config&&!envError&&<p role="status" className="mt-5">Checking isolated RPC and deployment…</p>}
    {config&&<>
      <p className="mt-5 break-all text-xs leading-6 text-zinc-500">Source: fresh 31338 deployment · session {config.session}<br/>Original registry: {config.original}<br/>Version registry: {config.registry}</p>
      <section className="mt-8 rounded-xl border border-white/10 p-5"><h2 className="text-xl font-semibold">1. Select and register a local file</h2><p className="my-4 text-sm leading-6 text-zinc-400">Files stay in your browser. Register each new fingerprint with your own test wallet before linking it. Developer seed Work {config.seededWorkId} belongs to a developer account, not your MetaMask wallet.</p><FilePicker disabled={busy||Boolean(pending)} onChange={value=>setHash(value?`0x${value.hash}`:"")}/><label className="mt-4 block text-sm">File fingerprint (bytes32)<input aria-label="MetaMask local file hash" value={hash} maxLength={66} onChange={e=>setHash(e.target.value)} className={`${input} font-mono`} disabled={busy||Boolean(pending)}/></label><p role="status" className="mt-4 text-sm text-amber-200">{candidateState||"Select a file or enter a valid SHA-256 fingerprint"}</p>{candidate?.[2]&&<p className="mt-3 break-all text-xs leading-6 text-zinc-400">Original Registered Wallet: {candidate[0]}<br/>Original Registration Time: {time(candidate[1])}</p>}<div className="mt-5 flex flex-wrap gap-3"><button className={button} onClick={()=>void submit("register")} disabled={!readiness.register}>Register Local Proof</button><button className={button} onClick={()=>void submit("create")} disabled={!readiness.create}>Create Work</button></div></section>
      <section className="mt-8 rounded-xl border border-white/10 p-5"><h2 className="text-xl font-semibold">2. Your local works</h2><p role="status" className="mt-3 text-sm">{scanState}</p><p className="mt-2 text-xs text-zinc-500">{scanProgress}</p><div className="mt-4 flex flex-wrap gap-3">{ids.map(id=><button key={String(id)} className={secondary} onClick={()=>chooseWork(String(id))}>Local Work {String(id)}</button>)}</div>{scanState==="Scan Complete"&&!ids.length&&<p className="mt-3 text-sm text-zinc-400">No works for this authorized wallet in the completed local scan.</p>}</section>
      <section className="mt-8"><h2 className="text-xl font-semibold">3. Public local timeline</h2><label className="mt-4 block text-sm">Work ID<input aria-label="MetaMask local Work ID" value={selected} onChange={e=>chooseWork(e.target.value)} maxLength={78} className={input} disabled={busy||Boolean(pending)}/></label><p role="status" className="mt-4 text-sm">{workState}</p>{work&&<><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-zinc-500">Controller Wallet · V2 storage</dt><dd className="break-all font-mono text-xs">{work.controller}</dd></div><div><dt className="text-zinc-500">Work Creation Time · local block</dt><dd>{time(work.createdAt)}</dd></div><div><dt className="text-zinc-500">Version Count</dt><dd data-testid="meta-count">{String(work.versionCount)}</dd></div></dl><ol className="mt-6 space-y-4">{versions.map(v=><li key={String(v.number)} data-testid="meta-version" className="rounded-xl border border-white/10 p-5"><h3 className="font-semibold">Local Version {String(v.number)}</h3><p className="mt-3 break-all font-mono text-xs leading-6">{v.fileHash}</p><p className="mt-3 text-sm">Original Registration Time: {time(v.registeredAt)}<br/>Version Association Time: {time(v.associatedAt)}<br/>Previous Version: {String(v.previousVersionNumber)}</p><p className="mt-3 text-xs text-amber-200">Source: isolated 31338 contracts · no mainnet certificate</p></li>)}</ol>{versions.length<Number(work.versionCount)&&<button className={`${secondary} mt-4`} disabled={pageBusy} onClick={()=>void more()}>Load next 10 versions</button>}<p className="mt-5 text-sm">Next Version: {String(work.versionCount+BigInt(1))}</p>{linked&&<p className="mt-3 text-amber-200">Duplicate Hash</p>}{wallet.address&&work.controller.toLowerCase()!==wallet.address.toLowerCase()&&<p className="mt-3 text-amber-200">Unauthorized Wallet for selected Work</p>}<button className={`${button} mt-4`} onClick={()=>void submit("add")} disabled={!readiness.add}>Add Version</button></>}</section>
      <section className="mt-8 rounded-xl border border-white/10 p-5"><p role="status" data-testid="meta-phase" className="text-sm">{phase||readiness.status}</p><p data-testid="meta-readiness" className="mt-2 text-xs text-zinc-400">Add Version readiness: {readiness.status}</p>{last&&<><p data-testid="meta-current-transaction" className="mt-3 break-all text-xs">Current Transaction Hash · LOCAL 31338 ONLY<br/>{last.transaction}</p><p data-testid="meta-tx-owner" className="mt-3 break-all text-xs">Transaction Owner: {last.owner}</p><p className="mt-2 text-xs text-zinc-500">Changing accounts cannot cancel an already broadcast transaction.</p></>}{pending&&<button className={`${secondary} mt-4`} onClick={()=>void waitForPending(config,pending)}>Retry Local Receipt</button>}</section>
      {previous&&previous.transaction!==last?.transaction&&<section data-testid="meta-previous-transaction" className="mt-5 rounded-xl border border-white/10 p-5"><p className="text-sm text-zinc-400">Previous Successful Transaction · LOCAL 31338 ONLY</p><p className="mt-3 break-all font-mono text-xs">{previous.transaction}</p><p className="mt-2 break-all text-xs text-zinc-500">Previous Transaction Owner: {previous.owner}</p><p className="mt-2 text-xs text-zinc-500">Historical confirmation; this Hash does not belong to a rejected or unsubmitted new operation.</p></section>}
      {uncertain&&<section className="mt-5 rounded-xl border border-amber-300/30 p-5"><p className="break-all text-sm">Submission owner: {uncertain.owner} · local 31338. Read the transaction Hash from MetaMask activity.</p><label className="mt-3 block text-sm">Wallet transaction Hash<input aria-label="Wallet transaction Hash" value={recoveryHash} onChange={e=>setRecoveryHash(e.target.value)} className={input} maxLength={66}/></label><button className={`${secondary} mt-4`} onClick={trackUnknown}>Track MetaMask Transaction</button><p className="mt-3 text-xs text-zinc-400">This only reads an existing transaction. It does not sign or resend.</p></section>}
    </>}
    <button className={`${secondary} mt-5`} disabled={busy||Boolean(pending)} onClick={()=>{setError("");setRetry(n=>n+1);}}>Retry / Refresh MetaMask Local Data</button>
    {error&&<p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}{storageWarning&&<p className="mt-4 text-sm text-amber-200">{storageWarning}</p>}
    <p className="mt-8 text-xs leading-6 text-zinc-500">Wallet registration proves a wallet assertion, not identity, authorship, copyright or creation time. This node is ephemeral. Keep the original 31337 backups separately.</p><Link href="/" className="mt-4 inline-block text-sm underline">Return to mainnet product (separate wallet workflow)</Link>
  </div>;
}
