import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const required = (value: string | undefined, name: string) => { if (!value) throw new Error(`${name} is not configured.`); return value; };
const firebase = () => {
  if (!getApps().length) initializeApp({ credential: cert({ projectId: required(process.env.FIREBASE_PROJECT_ID, "FIREBASE_PROJECT_ID"), clientEmail: required(process.env.FIREBASE_CLIENT_EMAIL, "FIREBASE_CLIENT_EMAIL"), privateKey: required(process.env.FIREBASE_PRIVATE_KEY, "FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n") }) });
  return { auth: getAuth(), db: getFirestore() };
};
const app = express();
app.use(cors({ origin: (process.env.CLIENT_URL || "http://localhost:5173").split(","), methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "200kb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: "draft-8", legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ ok: true }));

type Claims = { uid: string; email?: string; role?: string };
declare global { namespace Express { interface Request { user?: Claims } } }
async function authenticated(req: Request, res: Response, next: NextFunction) {
  try { const token = req.header("authorization")?.replace(/^Bearer\s+/i, ""); if (!token) throw new Error("Missing bearer token"); const decoded = await firebase().auth.verifyIdToken(token); req.user = { uid: decoded.uid, email: decoded.email, role: typeof decoded.role === "string" ? decoded.role : undefined }; next(); }
  catch { res.status(401).json({ error: "Authentication required." }); }
}
const allow = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => roles.includes(req.user?.role || "") ? next() : res.status(403).json({ error: "You do not have permission for this action." });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter: (_r, file, cb) => cb(null, /^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.mimetype)) });
const safe = (value: unknown, max = 300) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : undefined;
const id = (value: unknown) => { const result = safe(value, 100); return result && /^[A-Za-z0-9_-]+$/.test(result) ? result : undefined; };


app.post("/users/ensure-uploader", authenticated, async (req, res) => {
  try {
    const { auth, db } = firebase();
    const user = await auth.getUser(req.user!.uid);
    const existingRole = typeof user.customClaims?.role === "string" ? user.customClaims.role : undefined;
    if (existingRole === "admin" || existingRole === "uploader") return res.json({ role: existingRole });
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: "uploader" });
    const email = user.email || "";
    const name = safe(req.body?.name) || user.displayName || email.split("@")[0] || "Uploader";
    const record = { uid: user.uid, name, email, active: true, role: "uploader", updatedAt: new Date().toISOString() };
    await db.collection("users").doc(user.uid).set(record, { merge: true });
    res.json({ role: "uploader" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not assign uploader role." });
  }
});

app.post("/uploads", authenticated, allow("admin", "uploader"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Upload a PDF, PNG, JPEG, or WEBP certificate (up to 10 MB)." });
    const jwt = required(process.env.PINATA_JWT, "PINATA_JWT");
    const form = new FormData(); form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    const result = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const payload = await result.json() as { IpfsHash?: string; error?: { details?: string } };
    if (!result.ok || !payload.IpfsHash) throw new Error(payload.error?.details || "Pinata upload failed.");
    res.status(201).json({ cid: payload.IpfsHash });
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : "Upload failed." }); }
});

app.get("/public/certificates/:certificateId", async (req, res) => {
  try { const doc = await firebase().db.collection("certificates").doc(req.params.certificateId).get(); res.json({ certificate: doc.exists ? doc.data() : undefined }); }
  catch { res.status(503).json({ error: "Certificate metadata service is unavailable." }); }
});
app.get("/public/certificates", async (req, res) => {
  const documentHash = safe(req.query.documentHash, 66); if (!documentHash || !/^0x[0-9a-f]{64}$/i.test(documentHash)) return res.status(400).json({ error: "A SHA-256 document hash is required." });
  try { const snapshot = await firebase().db.collection("certificates").where("documentHash", "==", documentHash.toLowerCase()).limit(1).get(); res.json({ certificate: snapshot.empty ? undefined : snapshot.docs[0].data() }); }
  catch { res.status(503).json({ error: "Certificate metadata service is unavailable." }); }
});

app.get("/certificates", authenticated, allow("admin", "uploader"), async (req, res) => {
  try {
    const { db } = firebase();

    // Admins can see the complete certificate registry.
    // Uploaders must only see certificates they created.
    const query = req.user!.role === "admin"
      ? db.collection("certificates").orderBy("createdAt", "desc").limit(100)
      : db.collection("certificates").where("uploaderUid", "==", req.user!.uid).limit(100);

    const snapshot = await query.get();
    const certificates = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    res.json({ certificates });
  } catch {
    res.status(503).json({ error: "Certificate registry is unavailable." });
  }
});
app.post("/certificates", authenticated, allow("admin", "uploader"), async (req, res) => {
  const certificateId = id(req.body.certificateId); const documentHash = safe(req.body.documentHash, 66); const cid = safe(req.body.cid, 120);
  const recipientName = safe(req.body.recipientName); const credential = safe(req.body.credential); const organization = safe(req.body.organization); const issuerWallet = safe(req.body.issuerWallet, 42); const transactionHash = safe(req.body.transactionHash, 66);
  if (!certificateId || !documentHash || !/^0x[0-9a-f]{64}$/i.test(documentHash) || !cid || !recipientName || !credential || !organization || !issuerWallet || !/^0x[0-9a-f]{40}$/i.test(issuerWallet) || !transactionHash) return res.status(400).json({ error: "Invalid certificate data." });
  try {
    const { db } = firebase();

    const existingCertificate = await db.collection("certificates").doc(certificateId).get();
    if (existingCertificate.exists) {
      return res.status(409).json({
        error: "Certificate ID already exists. Please use a different Certificate ID.",
        code: "DUPLICATE_CERTIFICATE_ID",
      });
    }

    const existingFile = await db.collection("certificates")
      .where("documentHash", "==", documentHash.toLowerCase())
      .limit(1)
      .get();

    if (!existingFile.empty) {
      const existingData = existingFile.docs[0].data();
      return res.status(409).json({
        error: "This certificate file has already been uploaded.",
        code: "DUPLICATE_FILE",
        certificateId: existingData.certificateId || existingFile.docs[0].id,
      });
    }

    const record: Record<string, unknown> = {
      certificateId,
      documentHash: documentHash.toLowerCase(),
      cid,
      recipientName,
      credential,
      organization,
      issuerWallet: issuerWallet.toLowerCase(),
      transactionHash,
      status: "valid",
      uploaderUid: req.user!.uid,
      createdAt: new Date().toISOString(),
    };

    const recipientEmail = safe(req.body.recipientEmail);
    const issueDate = safe(req.body.issueDate, 20);
    const expiryDate = safe(req.body.expiryDate, 20);
    const description = safe(req.body.description, 1500);
    const blockNumber = safe(req.body.blockNumber, 30);

    if (recipientEmail) record.recipientEmail = recipientEmail;
    if (issueDate) record.issueDate = issueDate;
    if (expiryDate) record.expiryDate = expiryDate;
    if (description) record.description = description;
    if (blockNumber) record.blockNumber = blockNumber;

    await db.collection("certificates").doc(certificateId).create(record);
    await db.collection("activity").add({
      type: "certificate_issued",
      certificateId,
      by: req.user!.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({ certificate: record });
  } catch (error) {
    console.error("Firestore certificate save failed:", error);

    if (error instanceof Error && /already exists|already-exists|ALREADY_EXISTS/i.test(error.message)) {
      return res.status(409).json({
        error: "Certificate ID already exists. Please use a different Certificate ID.",
        code: "DUPLICATE_CERTIFICATE_ID",
      });
    }

    res.status(500).json({
      error: "Could not save certificate metadata. Please try again.",
    });
  }
});
app.post("/certificates/:certificateId/revoke", authenticated, allow("admin", "uploader"), async (req, res) => {
  const certificateId = id(req.params.certificateId);
  if (!certificateId) return res.status(400).json({ error: "Invalid certificate ID." });

  try {
    const { db } = firebase();
    const ref = db.collection("certificates").doc(certificateId);
    const snapshot = await ref.get();

    if (!snapshot.exists) return res.status(404).json({ error: "Certificate not found." });

    const certificate = snapshot.data() || {};
    if (req.user!.role !== "admin" && certificate.uploaderUid !== req.user!.uid) {
      return res.status(403).json({ error: "You can only revoke certificates issued by your account." });
    }

    await ref.update({ status: "revoked", revokedAt: new Date().toISOString() });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: "Could not update the certificate status." });
  }
});

app.get("/uploaders", authenticated, allow("admin"), async (_req, res) => { const snapshot = await firebase().db.collection("users").where("role", "==", "uploader").limit(200).get(); res.json({ users: snapshot.docs.map((doc) => doc.data()) }); });
app.post("/uploaders", authenticated, allow("admin"), async (req, res) => {
  const name = safe(req.body.name); const email = safe(req.body.email, 320); const walletAddress = safe(req.body.walletAddress, 42)?.toLowerCase(); const active = req.body.active !== false;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !walletAddress || !/^0x[0-9a-f]{40}$/i.test(walletAddress)) return res.status(400).json({ error: "Enter a valid name, email, and EVM wallet address." });
  try { const { auth, db } = firebase(); const user = await auth.getUserByEmail(email); await auth.setCustomUserClaims(user.uid, { role: active ? "uploader" : "inactive" }); const record = { uid: user.uid, name, email, walletAddress, active, role: "uploader", updatedAt: new Date().toISOString() }; await db.collection("users").doc(user.uid).set(record, { merge: true }); res.status(201).json({ user: record }); }
  catch { res.status(400).json({ error: "The user must create their Firebase account before being added as an uploader." }); }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => res.status(400).json({ error: error instanceof Error ? error.message : "Request failed." }));
app.listen(Number(process.env.PORT || 8787), () => console.log(`Certificate API listening on ${process.env.PORT || 8787}`));
