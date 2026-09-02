import { createPublicClient, createWalletClient, custom, defineChain, http, keccak256, stringToHex, type Address, type Hex } from "viem";
import { config } from "./config";

export const certificateKey = (id: string) => keccak256(stringToHex(id.trim()));
export const registryAbi = [
  { type: "function", name: "authorizedUploaders", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "getCertificate", stateMutability: "view", inputs: [{ name: "certificateId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "documentHash", type: "bytes32" }, { name: "issuer", type: "address" }, { name: "issuedAt", type: "uint64" }, { name: "revoked", type: "bool" }, { name: "cid", type: "string" }] }] },
  { type: "function", name: "issueCertificate", stateMutability: "nonpayable", inputs: [{ name: "certificateId", type: "bytes32" }, { name: "documentHash", type: "bytes32" }, { name: "cid", type: "string" }], outputs: [] },
  { type: "function", name: "revokeCertificate", stateMutability: "nonpayable", inputs: [{ name: "certificateId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "setUploader", stateMutability: "nonpayable", inputs: [{ name: "uploader", type: "address" }, { name: "allowed", type: "bool" }], outputs: [] }
] as const;
const chain = defineChain({ id: config.chainId, name: config.chainName, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl || "https://ethereum-sepolia-rpc.publicnode.com"] } } });
const client = () => { if (!config.rpcUrl) throw new Error("VITE_RPC_URL is not configured."); return createPublicClient({ chain, transport: http(config.rpcUrl) }); };
const address = () => { if (!config.contractAddress) throw new Error("VITE_CONTRACT_ADDRESS is not configured."); return config.contractAddress; };
export const hashFile = async (file: File): Promise<Hex> => {
  const bytes = new Uint8Array(await file.arrayBuffer()); const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
};
export const readCertificate = (id: string) => client().readContract({ address: address(), abi: registryAbi, functionName: "getCertificate", args: [certificateKey(id)] });
export const isAuthorizedWallet = (account: Address) => client().readContract({ address: address(), abi: registryAbi, functionName: "authorizedUploaders", args: [account] });
export async function wallet() {
  if (!window.ethereum) throw new Error("No wallet found. Install MetaMask or another EVM wallet.");
  const walletClient = createWalletClient({ chain, transport: custom(window.ethereum) }); const [account] = await walletClient.requestAddresses();
  const chainId = await walletClient.getChainId(); if (chainId !== config.chainId) throw new Error(`Switch your wallet to ${config.chainName} (chain ${config.chainId}).`);
  return { walletClient, account };
}
export async function issueOnChain(id: string, hash: Hex, cid: string) { const { walletClient, account } = await wallet(); const tx = await walletClient.writeContract({ account, address: address(), abi: registryAbi, functionName: "issueCertificate", args: [certificateKey(id), hash, cid] }); await client().waitForTransactionReceipt({ hash: tx }); return { tx, account }; }
export async function revokeOnChain(id: string) { const { walletClient, account } = await wallet(); const tx = await walletClient.writeContract({ account, address: address(), abi: registryAbi, functionName: "revokeCertificate", args: [certificateKey(id)] }); await client().waitForTransactionReceipt({ hash: tx }); return tx; }
export async function setUploaderOnChain(uploader: Address, allowed: boolean) { const { walletClient, account } = await wallet(); const tx = await walletClient.writeContract({ account, address: address(), abi: registryAbi, functionName: "setUploader", args: [uploader, allowed] }); await client().waitForTransactionReceipt({ hash: tx }); return tx; }

declare global { interface Window { ethereum?: import("viem").EIP1193Provider } }
