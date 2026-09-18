# Certificate Verification using Blockchain

A modern web application for issuing and publicly verifying digital certificates using **SHA-256 hashing, IPFS, Firebase, and the Ethereum Sepolia testnet**.

The platform is designed around a simple principle: **anyone should be able to verify a certificate without creating an account, connecting a wallet, or paying anything.** Blockchain access is required only for authorized users who issue or manage certificates.

---

## ✨ Features

### Public certificate verification
- Verify a certificate using its **Certificate ID**
- Upload the **original PDF or image** to compare its SHA-256 fingerprint
- Open verification directly from a certificate **QR code**
- No account required
- No MetaMask required
- No cryptocurrency or payment required

### Certificate issuance
Authorized uploaders can:
- Sign in with email and password
- Connect MetaMask
- Enter recipient and certificate details
- Upload a PDF or image certificate
- Generate a SHA-256 document hash locally
- Store the certificate file on IPFS
- Write the certificate record to the Ethereum Sepolia blockchain
- View the transaction on Etherscan

### Certificate revocation
Authorized users can:
- Revoke certificates on-chain
- Keep the historical record available
- Clearly display revoked status during verification

### Role-based access
The application supports:
- **Uploader** — issue and manage certificates created by their account
- **Admin** — manage authorized uploaders and view the certificate registry

Roles are controlled using **Firebase Authentication custom claims** and enforced by the backend.

---

## 🧭 How it works

```text
                  CERTIFICATE ISSUANCE

 Certificate File
        │
        ▼
   SHA-256 Hash
        │
        ├──────────────► IPFS
        │                 │
        │                 └── CID
        ▼
 Ethereum Sepolia
        │
        └──────────────► Blockchain Record
                           │
                           ▼
                    Certificate Registry


                  PUBLIC VERIFICATION

 Certificate ID ─────────────┐
                             │
 Original File ──────────────┼──► Backend Metadata
                             │
 QR Code ────────────────────┘
                                      │
                                      ▼
                              SHA-256 Comparison
                                      │
                                      ▼
                              Blockchain Record
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                    ✅ VALID                  ❌ INVALID
```

The original certificate file is not stored directly on-chain. Instead, its **SHA-256 hash** is recorded with its IPFS CID.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     React + Vite                         │
│                                                         │
│  Public Verification   │   Login   │   Uploader/Admin  │
└──────────────┬──────────┴──────────┴─────────┬──────────┘
               │                               │
               │                               │ Authenticated API
               │                               ▼
               │                      ┌─────────────────┐
               │                      │ Express Backend │
               │                      │     + CORS      │
               │                      │   + Rate Limit  │
               │                      └───────┬─────────┘
               │                              │
               │                 ┌────────────┼────────────┐
               │                 ▼            ▼            ▼
               │              Firebase      Pinata      Firebase
               │               Auth          IPFS       Firestore
               │
               ▼
      Ethereum Sepolia
       Public RPC / Viem
               │
               ▼
       CertificateRegistry
           Smart Contract
```

### Frontend
Built with:
- React
- TypeScript
- Vite
- React Router
- Viem
- Firebase Authentication

### Backend
Built with:
- Node.js
- Express
- TypeScript
- Firebase Admin SDK
- Multer
- CORS
- Express Rate Limit

### Storage
- **Firebase Firestore** — certificate metadata, users, activity
- **Pinata IPFS** — certificate files
- **Ethereum Sepolia** — certificate hash, issuer, timestamp, CID, revocation state

---

## 🔐 Security model

The project separates public verification from protected certificate-management operations.

### Public
The following operations do not require authentication:
- Look up a certificate by ID
- Find a certificate by document hash
- Verify a certificate against its blockchain record

### Protected
The following require Firebase authentication:
- Uploading files to IPFS
- Creating certificate metadata
- Listing certificates
- Revoking certificates
- Managing uploaders

### Role enforcement
The backend verifies the Firebase ID token and reads the user's custom `role` claim.

```text
Firebase user
     │
     ▼
ID token
     │
     ▼
Express authentication
     │
     ├── admin
     │
     └── uploader
```

Uploaders are restricted to certificates created by their own account.

Admins can access the broader registry and uploader-management functions.

---

## ⛓️ Smart contract

The project uses the `CertificateRegistry` smart contract deployed on **Ethereum Sepolia**.

The contract supports:

- `issueCertificate(...)`
- `getCertificate(...)`
- `revokeCertificate(...)`
- `authorizedUploaders(...)`
- `setUploader(...)`

The frontend interacts with the contract through **Viem**.

### Network

```text
Network: Ethereum Sepolia
Chain ID: 11155111
Explorer: https://sepolia.etherscan.io
```

### Current deployed contract

```text
0x889D6D748af92acaDD51adf3D994a2DaAe46d60D
```

> This address is a public contract address. Do not put private keys or wallet recovery phrases in the repository.

---

## 🦊 MetaMask

MetaMask is required only for actions that create or change blockchain state.

### Public verification
No MetaMask required.

### Certificate issuance
The uploader must:
1. Install MetaMask
2. Switch to Ethereum Sepolia
3. Connect the wallet
4. Approve the transaction

The application checks for the presence of an EVM wallet and reports a clear error when one is not installed.

Never share:
- Secret Recovery Phrase
- Private key
- Wallet passwords

---

## 📁 Project structure

```text
certificate-verification/
│
├── src/
│   ├── api.ts
│   ├── App.tsx
│   ├── auth.ts
│   ├── blockchain.ts
│   ├── config.ts
│   ├── firebase.ts
│   ├── main.tsx
│   └── styles.css
│
├── server/
│   ├── index.ts
│   └── scripts/
│       └── set-admin.ts
│
├── CertificateRegistry.sol
├── firestore.rules
│
├── index.html
├── netlify.toml
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.server.json
├── vite.config.ts
├── .env.example
├── .gitignore
└── README.md
```

Generated build output such as `dist/` should not be committed.

---

## ⚙️ Environment variables

The frontend uses Vite environment variables.

Create a local `.env` file from `.env.example`.

### Frontend variables

```env
VITE_API_URL=
VITE_PUBLIC_URL=
VITE_CHAIN_ID=11155111
VITE_CHAIN_NAME=Sepolia
VITE_RPC_URL=
VITE_EXPLORER_URL=https://sepolia.etherscan.io
VITE_CONTRACT_ADDRESS=

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

VITE_IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs
```

### Backend variables

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

PINATA_JWT=

CLIENT_URL=
PORT=
```

### Important

`.env` must **never** be committed to Git.

Only non-secret frontend Firebase configuration and other public client configuration belong in `VITE_*` variables.

The backend's Firebase service-account private key and Pinata JWT must remain server-side.

---

## 🚀 Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in the required values.

### 3. Run the frontend

```bash
npm run dev
```

The Vite development server normally runs at:

```text
http://localhost:5173
```

### 4. Run the backend

Use the server script defined in `package.json`.

The backend exposes:

```text
GET /health
```

which should return:

```json
{
  "ok": true
}
```

---

## 🔑 Creating an admin

New accounts are assigned the default **uploader** role.

Administrator access should be granted manually to trusted accounts.

The repository includes an admin utility:

```bash
npx tsx server/scripts/set-admin.ts your-email@example.com
```

The script uses Firebase Admin credentials from the environment and assigns the user's Firebase custom claim:

```text
role=admin
```

After changing a role, the user should sign out and sign back in so a refreshed Firebase ID token contains the new claim.

---

## 🧪 Verification flow

A certificate can be checked in three ways.

### 1. Certificate ID

The verifier enters the ID printed on the certificate.

### 2. Original certificate file

The verifier uploads the original PDF or image.

The application calculates:

```text
SHA-256(original file)
```

and compares it with the hash registered for the certificate.

### 3. QR code

The QR code opens a route like:

```text
/verify/CERT-...
```

The certificate metadata is retrieved and the on-chain record is checked.

---

## ✅ Verification states

The application can show:

| State | Meaning |
|---|---|
| `valid` | The certificate exists and the document hash matches the blockchain record |
| `revoked` | The certificate exists but has been revoked |
| `invalid` | The uploaded document or registry data does not match |
| `missing` | The certificate cannot be found in the expected registry |

---

## 🗃️ Firestore data

The backend stores certificate metadata such as:

```text
certificateId
recipientName
recipientEmail
credential
organization
issueDate
expiryDate
description
documentHash
cid
issuerWallet
transactionHash
blockNumber
status
uploaderUid
createdAt
```

The backend associates each issued certificate with the Firebase UID of the uploader.

This prevents one uploader from seeing or revoking certificates belonging to another uploader.

---

## 🌐 Deployment

The intended deployment architecture is:

```text
                    Internet
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
      Netlify                    Render
     Frontend                    Backend
          │                         │
          └────────────┬────────────┘
                       │
             Firebase / Pinata
                       │
                       ▼
                 Ethereum Sepolia
```

### Frontend — Netlify

Build command:

```bash
npm run build
```

Publish directory:

```text
dist
```

Set the required `VITE_*` variables in Netlify.

### Backend — Render

Set the required backend environment variables in Render.

Expose:

```text
GET /health
```

and confirm it responds successfully after deployment.

Set:

```env
CLIENT_URL=https://your-netlify-domain.netlify.app
```

### SPA routing

The Netlify configuration should route application paths back to `index.html` so routes such as:

```text
/verify
/verify/CERT-...
/login
/register
/portal
/about
```

continue to work after a page refresh.

---

## 🛡️ Production checklist

Before going live:

- [ ] `.env` is not committed
- [ ] No private keys are present in source code
- [ ] Pinata JWT is backend-only
- [ ] Firebase service-account credentials are backend-only
- [ ] `VITE_API_URL` points to the Render API
- [ ] `CLIENT_URL` points to the Netlify frontend
- [ ] `VITE_CONTRACT_ADDRESS` points to the deployed contract
- [ ] Sepolia chain ID is `11155111`
- [ ] Render `/health` returns `{ "ok": true }`
- [ ] Frontend production build succeeds
- [ ] Public verification works without login
- [ ] Certificate issuance works with MetaMask + Sepolia
- [ ] Unauthorized wallets are rejected
- [ ] Uploader certificate ownership is enforced
- [ ] Admin uploader management works
- [ ] Revocation works
- [ ] QR verification works
- [ ] Etherscan transaction links open correctly

---

## 🧰 Main technologies

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Build | Vite |
| Routing | React Router |
| Blockchain | Ethereum Sepolia |
| Blockchain client | Viem |
| Wallet | MetaMask / EVM wallet |
| Backend | Node.js + Express |
| Authentication | Firebase Authentication |
| Database | Firebase Firestore |
| File storage | Pinata IPFS |
| Smart contract | Solidity |
| Frontend hosting | Netlify |
| Backend hosting | Render |

---

## 📌 Project goals

This project demonstrates how blockchain can be used as a **tamper-evident verification layer** for digital credentials without forcing certificate recipients to understand or interact with cryptocurrency.

The application focuses on:

- simple public verification
- cryptographic document fingerprints
- transparent blockchain records
- role-based certificate issuance
- certificate revocation
- low-cost Ethereum testnet deployment

---

## 👤 Project owner

**Trushant Rathod**

---

