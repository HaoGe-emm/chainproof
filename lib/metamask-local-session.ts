import type { Address, EIP1193Provider } from "viem";
export const META_CHAIN_ID = 31338;
export const META_RPC = "http://127.0.0.1:18547";
export type LocalProvider = EIP1193Provider & { isMetaMask?: boolean };
export type WalletSnapshot = { address: Address | null; chainId: number | null; revision: number };
export function errorCode(cause: unknown): number | null {
  const item = cause as { code?: unknown; cause?: unknown };
  return typeof item?.code === "number" ? item.code : item?.cause ? errorCode(item.cause) : null;
}
export function walletMessage(cause: unknown, context: "connect" | "switch" | "transaction" = "transaction"): string {
  if (errorCode(cause) === 4001) return context === "connect" ? "Connection Rejected" : context === "switch" ? "Network Switch Rejected" : "Transaction Rejected";
  if (errorCode(cause) === -32002) return "A wallet request is already pending. Open MetaMask.";
  const text = (cause as { message?: string })?.message ?? "";
  if(/insufficient funds|insufficient balance|余额不足/i.test(text))return "Insufficient simulated ETH on local 31338.";
  for (const known of ["Wallet Changed", "Wrong Network", "MetaMask is required", "Wallet Disconnected", "Contract Not Found", "Incorrect Local Configuration", "Transaction Reverted", "Receipt does not match", "RPC Unavailable", "Unauthorized Wallet", "Duplicate Hash", "Original Proof Not Found", "Work Not Found"]) if (text.includes(known)) return known;
  const item = cause as { data?: { errorName?: string }; cause?: unknown };
  if (item?.data?.errorName) return ({ NotController: "Unauthorized Wallet", NotOriginalRegistrant: "Unauthorized Wallet", HashAlreadyLinked: "Duplicate Hash", OriginalProofNotFound: "Original Proof Not Found", WorkNotFound: "Work Not Found", UnexpectedPreviousVersion: "Version order changed. Refresh before retrying." } as Record<string, string>)[item.data.errorName] ?? "Contract Call Failed";
  if (item?.cause) return walletMessage(item.cause, context);
  return "RPC Unavailable / Contract Call Failed. Retry without resending a pending transaction.";
}
// Separate session from the mainnet provider. The extension, not this class, signs.
export class LocalWalletSession {
  state: WalletSnapshot = { address: null, chainId: null, revision: 0 };
  private active = true;
  private requests = 0;
  private connecting = false;
  readonly provider: LocalProvider;
  private publish: (value: WalletSnapshot) => void;
  constructor(provider: LocalProvider, publish: (value: WalletSnapshot) => void) {
    if(!provider || typeof provider.request!=="function" || typeof provider.on!=="function" || typeof provider.removeListener!=="function")throw new Error("MetaMask is required");
    this.provider = provider; this.publish = publish;
  }
  private update(address: Address | null, chainId: number | null) {
    if (!this.active) return;
    this.state = { address, chainId, revision: this.state.revision + 1 }; this.publish(this.state);
  }
  private accounts = (accounts: Address[]) => this.update(accounts[0] ?? null, this.state.chainId);
  private chain = (chain: string) => this.update(this.state.address, Number(chain));
  private disconnected = () => this.update(null, null);
  async start() {
    this.provider.on("accountsChanged", this.accounts); this.provider.on("chainChanged", this.chain); this.provider.on("disconnect", this.disconnected);
    const stamp = this.state.revision;
    try { const [accounts, chain] = await Promise.all([this.provider.request({ method: "eth_accounts" }), this.provider.request({ method: "eth_chainId" })]); if (this.active && stamp === this.state.revision) this.update(accounts[0] ?? null, Number(chain)); } catch { if (this.active && stamp === this.state.revision) this.disconnected(); }
  }
  stop() { this.active = false; this.requests++; this.provider.removeListener("accountsChanged", this.accounts); this.provider.removeListener("chainChanged", this.chain); this.provider.removeListener("disconnect", this.disconnected); }
  async connect() {
    if(!this.active)throw new Error("Wallet Disconnected");
    if (this.connecting) throw { code: -32002 };
    this.connecting = true; const ticket = ++this.requests;
    try {
      const granted = await this.provider.request({ method: "eth_requestAccounts" });
      const stamp = this.state.revision;
      const [accounts, chain] = await Promise.all([this.provider.request({ method: "eth_accounts" }), this.provider.request({ method: "eth_chainId" })]);
      if (!this.active || ticket !== this.requests || stamp !== this.state.revision || granted[0]?.toLowerCase() !== accounts[0]?.toLowerCase()) throw new Error("Wallet Changed");
      if (!accounts[0]) throw new Error("Wallet Disconnected");
      this.update(accounts[0], Number(chain)); return accounts[0];
    } finally { this.connecting = false; }
  }
  async switchNetwork() {
    if(!this.active)throw new Error("Wallet Disconnected");
    try { await this.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a6a" }] }); }
    catch (cause) {
      if (errorCode(cause) !== 4902) throw cause;
      await this.provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7a6a", chainName: "ChainProof MetaMask Local Test", rpcUrls: [META_RPC], nativeCurrency: { name: "Simulated Local ETH", symbol: "ETH", decimals: 18 } }] });
      if (Number(await this.provider.request({ method: "eth_chainId" })) !== META_CHAIN_ID) await this.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a6a" }] });
    }
    const stamp = this.state.revision;
    const [accounts, chain] = await Promise.all([this.provider.request({ method: "eth_accounts" }), this.provider.request({ method: "eth_chainId" })]);
    if (this.active && stamp === this.state.revision) this.update(accounts[0] ?? null, Number(chain));
    if (Number(chain) !== META_CHAIN_ID) throw new Error("Wrong Network");
  }
  async assertCurrent(account: Address, stamp: number) {
    const [accounts, chain] = await Promise.all([this.provider.request({ method: "eth_accounts" }), this.provider.request({ method: "eth_chainId" })]);
    if (!this.active || stamp !== this.state.revision || accounts[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet Changed");
    if (Number(chain) !== META_CHAIN_ID) throw new Error("Wrong Network");
  }
}
