import { config } from "./config";
import { auth } from "./firebase";

async function request<T>(path: string, init: RequestInit = {}, secured = false): Promise<T> {
  if (!config.apiUrl) throw new Error("VITE_API_URL is not configured.");
  const headers = new Headers(init.headers);
  if (secured) { const user = auth?.currentUser; if (!user) throw new Error("Please sign in first."); headers.set("Authorization", `Bearer ${await user.getIdToken()}`); }
  const response = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload as T;
}
export type CertificateMeta = { certificateId: string; recipientName: string; recipientEmail?: string; credential: string; organization: string; issueDate: string; expiryDate?: string; description?: string; documentHash: string; cid: string; issuerWallet: string; transactionHash: string; blockNumber?: string; status: "valid" | "revoked"; createdAt?: string };
export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  ensureUploader: () => request<{ role: string }>("/users/ensure-uploader", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, true),
  publicCertificate: (id: string) => request<{ certificate?: CertificateMeta }>(`/public/certificates/${encodeURIComponent(id)}`),
  findByHash: (hash: string) => request<{ certificate?: CertificateMeta }>(`/public/certificates?documentHash=${encodeURIComponent(hash)}`),
  upload: (file: File) => { const form = new FormData(); form.append("file", file); return request<{ cid: string }>("/uploads", { method: "POST", body: form }, true); },
  saveCertificate: (certificate: CertificateMeta) => request<{ certificate: CertificateMeta }>("/certificates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(certificate) }, true),
  certificates: () => request<{ certificates: CertificateMeta[] }>("/certificates", {}, true),
  uploaders: () => request<{ users: { uid: string; name: string; email: string; walletAddress: string; active: boolean }[] }>("/uploaders", {}, true),
  saveUploader: (user: { name: string; email: string; walletAddress: string; active: boolean }) => request("/uploaders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(user) }, true),
  revoke: (certificateId: string) => request(`/certificates/${encodeURIComponent(certificateId)}/revoke`, { method: "POST" }, true)
};
