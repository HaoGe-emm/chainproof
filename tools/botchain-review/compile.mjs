// Experimental outputs only; never updates stable ABI/artifacts/configuration.
import solc from "solc";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {root} from "../local-evm/compile.mjs";
export const variants=[{name:"paris-200",evmVersion:"paris",enabled:true,runs:200},{name:"shanghai-200",evmVersion:"shanghai",enabled:true,runs:200},{name:"paris-1",evmVersion:"paris",enabled:true,runs:1},{name:"shanghai-1",evmVersion:"shanghai",enabled:true,runs:1},{name:"paris-unoptimized",evmVersion:"paris",enabled:false,runs:200}];
export function withoutMetadata(hex){
  if(!/^(?:[0-9a-fA-F]{2})*$/.test(hex))throw new Error("Invalid bytecode");
  if(hex.length<4)return hex;const size=parseInt(hex.slice(-4),16),start=hex.length-4-size*2;
  return size>0&&start>=0&&parseInt(hex.slice(start,start+2),16)>=0xa0&&parseInt(hex.slice(start,start+2),16)<=0xbf?hex.slice(0,start):hex;
}
export function disassemble(hex,limit=Infinity){
  const instructions=[];for(let pc=0;pc<hex.length/2&&instructions.length<limit;){const opcode=parseInt(hex.slice(pc*2,pc*2+2),16),size=opcode>=0x60&&opcode<=0x7f?opcode-0x5f:0;
    if(pc+1+size>hex.length/2)throw new Error("Truncated PUSH operand");instructions.push({pc,opcode,operand:hex.slice((pc+1)*2,(pc+1+size)*2)});pc+=1+size;}
  return instructions;
}
export function analyze(contract){
  const creation=contract.evm.bytecode.object,runtime=contract.evm.deployedBytecode.object,offset=creation.lastIndexOf(runtime);
  if(offset<0||offset%2)throw new Error("Cannot distinguish constructor code from embedded runtime data");
  // Solidity source maps contain one entry per emitted instruction, excluding
  // embedded runtime, literal data pools and CBOR. Do not decode those as code.
  const initCount=contract.evm.bytecode.sourceMap.split(";").length,runtimeCount=contract.evm.deployedBytecode.sourceMap.split(";").length;
  const init=disassemble(creation,initCount),code=disassemble(runtime,runtimeCount);
  if(init.length!==initCount||code.length!==runtimeCount)throw new Error("Source map/instruction mismatch");
  const count=(list,opcode)=>list.filter(i=>i.opcode===opcode).length;
  const last=code.at(-1);return {creationBytes:creation.length/2,runtimeBytes:runtime.length/2,runtimeCodeBytes:last.pc+1+last.operand.length/2,embeddedRuntimeOffset:offset/2,constructorPush0:count(init,0x5f),runtimePush0:count(code,0x5f),runtimeOpcodeSet:[...new Set(code.map(i=>i.opcode))].sort((a,b)=>a-b).map(v=>`0x${v.toString(16).padStart(2,"0")}`),constructor:init,runtime:code};
}
export async function compileVariant(variant){
  if(!variants.some(v=>JSON.stringify(v)===JSON.stringify(variant)))throw new Error("Only reviewed experimental variants accepted");
  const sources={};for(const name of ["ChainProof.sol","ChainProofVersionRegistry.sol"])sources[name]={content:await readFile(path.join(root,"contracts",name),"utf8")};
  const settings={optimizer:{enabled:variant.enabled,runs:variant.runs},evmVersion:variant.evmVersion,metadata:{bytecodeHash:"ipfs",appendCBOR:true,useLiteralContent:false},outputSelection:{"*":{"*":["abi","metadata","evm.bytecode.object","evm.bytecode.sourceMap","evm.deployedBytecode.object","evm.deployedBytecode.sourceMap","evm.deployedBytecode.immutableReferences","storageLayout"]}}};
  const output=JSON.parse(solc.compile(JSON.stringify({language:"Solidity",sources,settings})));const errors=(output.errors??[]).filter(e=>e.severity==="error");if(errors.length)throw new Error(errors.map(e=>e.formattedMessage).join("\n"));
  const contract=output.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry;
  return {variant,compiler:solc.version(),settings,sourceHashes:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,createHash("sha256").update(v.content).digest("hex")])),warnings:output.errors??[],contracts:output.contracts,analysis:analyze(contract)};
}
export async function experimentDirectory(){const directory=path.join(root,".local-evm/compatibility",`${new Date().toISOString().replace(/[:.]/g,"-")}-${randomUUID().slice(0,8)}`);await mkdir(directory,{recursive:true});return directory;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const directory=await experimentDirectory(),summary=[];for(const variant of variants){const artifact=await compileVariant(variant);await writeFile(path.join(directory,`${variant.name}.json`),JSON.stringify(artifact,null,2),{flag:"wx"});summary.push({variant:variant.name,...artifact.analysis,constructor:undefined,runtime:undefined});}await writeFile(path.join(directory,"compile-summary.json"),JSON.stringify(summary,null,2),{flag:"wx"});console.log(JSON.stringify({directory,compiler:solc.version(),summary}));
}
