// One source for button permissions and selected-work submission readiness.
export type MetaReadinessInput = {
  address: string | null; chainId: number | null; configReady: boolean; envError: string;
  locked: boolean; hashValid: boolean; proofState: string; proofExists: boolean; proofOwner: boolean;
  workState: string; workReady: boolean; controller: boolean; linked: boolean;
};
export function metaSubmitState(s: MetaReadinessInput) {
  const global = !s.address ? "Wallet Disconnected" : s.chainId !== 31338 ? "Wrong Network" : s.envError || (!s.configReady ? "Checking isolated RPC and deployment" : s.locked ? "Transaction in Progress" : "");
  const available = !global;
  const proofReady = s.proofState === "Original Proof Ready" && s.proofExists && s.proofOwner;
  const register = available && s.hashValid && s.proofState === "Original Proof Not Found";
  const create = available && s.hashValid && proofReady;
  const add = create && s.workReady && s.workState === "Local Work Loaded" && s.controller && !s.linked;
  const queryError = (value: string) => /RPC|Contract|Configuration|Receipt/.test(value) && value !== "Original Proof Ready";
  const status = global || (queryError(s.workState) ? s.workState : queryError(s.proofState) ? s.proofState :
    !s.workReady || s.workState !== "Local Work Loaded" ? s.workState || "Loading Work" :
    !s.controller ? "Unauthorized Wallet for selected Work" : !s.hashValid ? "Select a file or enter a valid SHA-256 fingerprint" :
    s.proofState === "Original Proof Not Found" ? "Proof Not Found" :
    !s.proofState || s.proofState === "Checking Original Proof" ? "Checking Original Proof" :
    !s.proofExists || !s.proofOwner ? s.proofState || "Unauthorized Wallet" :
    s.linked ? "Duplicate Hash" : add ? "Ready to Submit" : s.proofState);
  return {register, create, add, status};
}
