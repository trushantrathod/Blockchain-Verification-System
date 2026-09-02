export const config = {
  apiUrl: import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "",
  publicUrl: import.meta.env.VITE_PUBLIC_URL?.replace(/\/$/, "") || window.location.origin,
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 11155111),
  chainName: import.meta.env.VITE_CHAIN_NAME || "Sepolia",
  rpcUrl: import.meta.env.VITE_RPC_URL || "",
  explorerUrl: import.meta.env.VITE_EXPLORER_URL?.replace(/\/$/, "") || "https://sepolia.etherscan.io",
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isConfigured = Boolean(config.apiUrl && config.rpcUrl && config.contractAddress && firebaseConfig.apiKey);
