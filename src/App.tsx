import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { createUserWithEmailAndPassword, onAuthStateChanged, type User } from "firebase/auth";
import { api, type CertificateMeta } from "./api";
import { auth } from "./firebase";
import { config, isConfigured } from "./config";
import { hashFile, isAuthorizedWallet, issueOnChain, readCertificate, revokeOnChain, setUploaderOnChain, wallet } from "./blockchain";
import { login, logout, roleOf } from "./auth";
import type { Address } from "viem";

type Notice = { kind: "error" | "success"; text: string } | null;
const cidUrl = (cid: string) => `${import.meta.env.VITE_IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs"}/${cid}`;
const explorer = (tx: string) => `${config.explorerUrl}/tx/${tx}`;
const short = (value: string) => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "—";
const secureId = () => `CERT-${crypto.getRandomValues(new Uint32Array(3)).reduce((value, part) => value + part.toString(36), "").toUpperCase()}`;
const copy = (text: string) => navigator.clipboard.writeText(text);

function Shell({ children }: { children: React.ReactNode }) { return <><header><Link className="brand" to="/"><span>◇</span> Certificate Verification</Link><nav><Link to="/verify">Verify</Link><Link to="/about">About</Link><Link to="/portal">Workspace</Link></nav></header>{children}<footer>© 2026 Certificate Verification. All rights reserved by Trushant Rathod.</footer></>; }
function NoticeBox({ notice }: { notice: Notice }) { return notice ? <p className={`notice ${notice.kind}`}>{notice.text}</p> : null; }
function Loading({ label = "Checking the registry…" }: { label?: string }) { return <div className="loading"><i />{label}</div>; }

function Home() { return <Shell><main className="home"><section className="hero"><p className="eyebrow">A SIMPLE WAY TO CHECK CERTIFICATES</p><h1>Verify every certificate.<br /><em>Trust every credential.</em></h1><p className="lead">A simple way to check whether a certificate is genuine, unchanged, and recorded by the issuing organization.</p><div className="actions"><Link className="button primary" to="/verify">Verify certificate</Link><Link className="button" to="/portal">Issue certificate</Link></div></section><section className="proof" aria-label="Certificate verification path"><div className="certificate-card"><span>Certificate</span><b>VERIFIED</b><small>Credential ID · C-2026-…</small></div><div className="path"><b>SHA-256 hash</b><i>↓</i><b>Blockchain record</b><i>↓</i><b className="verified">✓ Verified</b></div></section><section className="features"><article><b>The document is checked</b><p>We compare the uploaded document with its original digital fingerprint. Even a small change is detected.</p></article><article><b>Easy for anyone to verify</b><p>Use a certificate ID, upload the original file, or scan its QR code. No account or wallet is needed.</p></article><article><b>Clear certificate status</b><p>A certificate can be marked revoked while its verification history remains available for transparency.</p></article></section></main></Shell>; }

function Verify() {
  const { certificateId } = useParams(); const [id, setId] = useState(certificateId || ""); const [file, setFile] = useState<File>(); const [checking, setChecking] = useState(Boolean(certificateId)); const [result, setResult] = useState<{ meta?: CertificateMeta; state: "valid" | "revoked" | "invalid" | "missing"; reason?: string }>();
  const verify = async (event?: FormEvent) => { event?.preventDefault(); setChecking(true); setResult(undefined); try {
    const hash = file ? await hashFile(file) : undefined; const response = hash ? await api.findByHash(hash) : await api.publicCertificate(id.trim()); const meta = response.certificate;
    if (!meta) return setResult({ state: "missing", reason: "No certificate metadata matches that ID or document hash." });
    const chain = await readCertificate(meta.certificateId);
    if (!chain.issuedAt || chain.issuedAt === 0n) return setResult({ meta, state: "missing", reason: "This ID is not present in the blockchain registry." });
    if (chain.documentHash.toLowerCase() !== meta.documentHash.toLowerCase() || (hash && hash.toLowerCase() !== chain.documentHash.toLowerCase())) return setResult({ meta, state: "invalid", reason: "The uploaded document hash does not match the immutable blockchain record." });
    setResult({ meta, state: chain.revoked ? "revoked" : "valid" });
  } catch (error) { setResult({ state: "invalid", reason: error instanceof Error ? error.message : "Verification failed." }); } finally { setChecking(false); } };
  useEffect(() => { if (certificateId) void verify(); }, [certificateId]);
  return <Shell><main className="page narrow"><p className="eyebrow">PUBLIC VERIFICATION</p><h2>Check a certificate</h2><p className="muted">Enter the certificate ID or upload the original document. QR links open this page automatically.</p><form className="verify-form" onSubmit={verify}><label>Certificate ID<input value={id} onChange={(e) => { setId(e.target.value); setFile(undefined); }} placeholder="CERT-…" /></label><span className="or">or</span><label className="file">Upload PDF or image<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => { setFile(e.target.files?.[0]); setId(""); }} /><b>{file?.name || "Choose original certificate"}</b></label><button className="button primary" disabled={checking || (!id && !file)}>{checking ? "Verifying…" : "Verify"}</button></form>{checking && <Loading label={file ? "Hashing document and checking blockchain…" : "Checking blockchain record…"} />}{result && <VerificationResult result={result} />}</main></Shell>;
}
function VerificationResult({ result }: { result: { meta?: CertificateMeta; state: "valid" | "revoked" | "invalid" | "missing"; reason?: string } }) { const m = result.meta; return <section className={`result ${result.state}`}><div className="result-title"><b>{result.state === "valid" ? "✓ Valid certificate" : result.state === "revoked" ? "! Certificate revoked" : result.state === "missing" ? "? Certificate not found" : "× Verification failed"}</b><p>{result.reason || (result.state === "valid" ? "The file and record match the immutable blockchain entry." : "This credential remains on-chain but is no longer valid.")}</p></div>{m && <><dl><dt>Certificate ID</dt><dd>{m.certificateId}<button onClick={() => copy(m.certificateId)}>Copy</button></dd><dt>Recipient</dt><dd>{m.recipientName}</dd><dt>Credential</dt><dd>{m.credential}</dd><dt>Issuer</dt><dd>{m.organization}</dd><dt>Issued</dt><dd>{m.issueDate}</dd><dt>Status</dt><dd>{result.state.toUpperCase()}</dd><dt>Document hash</dt><dd className="mono">{short(m.documentHash)}<button onClick={() => copy(m.documentHash)}>Copy</button></dd><dt>IPFS CID</dt><dd><a href={cidUrl(m.cid)} target="_blank" rel="noreferrer">{short(m.cid)}</a></dd><dt>Issuer wallet</dt><dd className="mono">{short(m.issuerWallet)}</dd><dt>Transaction</dt><dd><a href={explorer(m.transactionHash)} target="_blank" rel="noreferrer">View on explorer ↗</a></dd></dl><img className="qr" alt={`QR code for ${m.certificateId}`} src={`https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(`${config.publicUrl}/verify/${m.certificateId}`)}`} /></>}</section>; }

function LoginPage() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const friendly = (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (/auth\/invalid-credential|auth\/wrong-password|auth\/invalid-login-credentials/i.test(message)) return "Wrong email or password. Please check your details and try again.";
    if (/auth\/user-not-found/i.test(message)) return "No account was found with this email address.";
    if (/auth\/invalid-email/i.test(message)) return "Please enter a valid email address.";
    if (/auth\/too-many-requests/i.test(message)) return "Too many attempts. Please wait a moment before trying again.";
    if (/auth\/user-disabled/i.test(message)) return "This account has been disabled. Contact an administrator.";
    return message || "We couldn't sign you in. Please try again.";
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setNotice(null);
    try {
      await login(String(data.get("email")).trim(), String(data.get("password")));
      setNotice({ kind: "success", text: "Signed in successfully. Opening your workspace…" });
      window.setTimeout(() => navigate("/portal"), 300);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setNotice({
        kind: "error",
        text: message || "We couldn't sign you in. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return <Shell>
    <main className="page auth auth-experience">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-card auth-card-large auth-card-modern">
        <div className="auth-layout">
          <div className="auth-copy">
            <Link className="auth-back" to="/verify">← Verify a certificate</Link>
            <div className="auth-brand-mark" aria-hidden="true">◇</div>
            <p className="eyebrow">SECURE WORKSPACE</p>
            <h2>Welcome back<span>.</span></h2>
            <p className="auth-lead">Sign in to issue certificates and manage your verification records.</p>
            <div className="auth-trust">
              <span><b>✓</b> Firebase-secured account</span>
              <span><b>✓</b> Sepolia blockchain issuing</span>
              <span><b>✓</b> Your wallet approves every transaction</span>
            </div>
          </div>

          <div className="auth-form-side">
            <form className="auth-form" onSubmit={submit} noValidate>
          <label className="field">
            <span>Email address</span>
            <div className="field-control">
              <input
                required
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                aria-label="Email address"
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="field-control">
              <input
                required
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-label="Password"
              />
              <button
                type="button"
                className="field-action"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button className="button primary auth-submit" disabled={busy}>
            <span>{busy ? "Signing in…" : "Sign in"}</span>
            {!busy && <span aria-hidden="true">→</span>}
          </button>
            </form>

            <NoticeBox notice={notice} />

            <div className="auth-switch auth-switch-modern">
              <span>New here?</span>
              <button className="auth-secondary" onClick={() => navigate("/register")}>Create an account <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </Shell>;
}

function RegisterPage() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    const confirm = String(data.get("confirmPassword"));

    if (password.length < 6) {
      return setNotice({ kind: "error", text: "Password must be at least 6 characters." });
    }
    if (password !== confirm) {
      return setNotice({ kind: "error", text: "Passwords do not match." });
    }

    try {
      if (!auth) throw new Error("Firebase is not configured.");
      const created = await createUserWithEmailAndPassword(auth, String(data.get("email")).trim(), password);
      await api.ensureUploader();
      await created.user.getIdToken(true);
      setNotice({ kind: "success", text: "Account created. Your workspace is ready." });
      setTimeout(() => navigate("/portal"), 700);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const friendly =
        /auth\/email-already-in-use/i.test(message) ? "An account already exists with this email." :
        /auth\/invalid-email/i.test(message) ? "Please enter a valid email address." :
        /auth\/weak-password/i.test(message) ? "Choose a stronger password with at least 6 characters." :
        /auth\/network-request-failed/i.test(message) ? "We couldn't reach the service. Please check your connection and try again." :
        message || "Could not create your account. Please try again.";
      setNotice({ kind: "error", text: friendly });
    }
  };

  return <Shell>
    <main className="page auth auth-experience register-auth">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-card auth-card-large auth-card-modern">
        <div className="auth-layout">
          <div className="auth-copy">
            <Link className="auth-back" to="/login">← Back to sign in</Link>
            <div className="auth-brand-mark" aria-hidden="true">◇</div>
            <p className="eyebrow">CREATE ACCOUNT</p>
            <h2>Start issuing certificates<span>.</span></h2>
            <p className="auth-lead">Create your uploader account. You can start using the workspace once your account is set up.</p>
            <div className="auth-trust">
              <span><b>01</b> Create your account</span>
              <span><b>02</b> Open the workspace</span>
              <span><b>03</b> Connect MetaMask when issuing</span>
            </div>
          </div>

          <div className="auth-form-side">
            <form className="auth-form" onSubmit={submit} noValidate>
          <label className="field">
            <span>Email address</span>
            <div className="field-control">
              <input required name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="field-control">
              <input required name="password" type="password" autoComplete="new-password" minLength={6} placeholder="At least 6 characters" />
            </div>
          </label>

          <label className="field">
            <span>Confirm password</span>
            <div className="field-control">
              <input required name="confirmPassword" type="password" autoComplete="new-password" minLength={6} placeholder="Re-enter your password" />
            </div>
          </label>

          <button className="button primary auth-submit">
            <span>Create account</span>
            <span aria-hidden="true">→</span>
          </button>
            </form>

            <NoticeBox notice={notice} />

            <div className="auth-switch auth-switch-modern">
              <span>Already registered?</span>
              <button className="auth-secondary" onClick={() => navigate("/login")}>Back to sign in <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </Shell>;
}


function AboutPage() {
  return <Shell>
    <main className="page about-page">
      <section className="about-hero">
        <p className="eyebrow">ABOUT THE PLATFORM</p>
        <h2>How certificate verification works</h2>
        <p className="about-intro">
          This platform helps organizations issue certificates and lets anyone check
          whether a certificate is authentic and unchanged.
        </p>
      </section>

      <section className="about-grid">
        <article className="about-card">
          <span className="about-number">01</span>
          <h3>For someone checking a certificate</h3>
          <p>
            You do not need an account, MetaMask, cryptocurrency, or a wallet.
            Open <b>Verify</b> and use one of these options:
          </p>
          <div className="about-list">
            <div><b>Certificate ID</b><span>Enter the ID printed on the certificate.</span></div>
            <div><b>Original file</b><span>Upload the original PDF or image to compare it with the recorded certificate.</span></div>
            <div><b>QR code</b><span>Scan the QR code on the certificate to open its verification page automatically.</span></div>
          </div>
        </article>

        <article className="about-card">
          <span className="about-number">02</span>
          <h3>For an uploader</h3>
          <p>Uploaders use a normal account and a MetaMask wallet to issue certificates.</p>
          <div className="about-list">
            <div><b>1. Create an account</b><span>Use the Create account option on the sign-in page.</span></div>
            <div><b>2. Open your workspace</b><span>Sign in to access the certificate issuing workspace.</span></div>
            <div><b>3. Connect MetaMask</b><span>Click the wallet action when issuing a certificate and approve the connection in MetaMask.</span></div>
            <div><b>4. Fill in certificate details</b><span>Enter the recipient, credential, issuer, dates, and certificate file.</span></div>
            <div><b>5. Issue</b><span>The file is hashed, stored on IPFS, and its record is written to the Sepolia blockchain.</span></div>
          </div>
        </article>

        <article className="about-card about-card-wide">
          <span className="about-number">03</span>
          <h3>What is the hash code?</h3>
          <p>
            A hash is a unique digital fingerprint of the certificate file. The platform
            creates a <b>SHA-256</b> hash from the actual file contents.
          </p>
          <div className="hash-example">
            <span>Example SHA-256 fingerprint</span>
            <code>7f4d8c1a…9b21e6</code>
          </div>
          <p className="about-note">
            The important part is that the hash is generated from the file itself.
            Change even a small part of the document and the resulting hash changes.
            During verification, the uploaded file is hashed again and compared with
            the recorded fingerprint.
          </p>
        </article>

        <article className="about-card">
          <span className="about-number">04</span>
          <h3>How MetaMask is used</h3>
          <p>
            MetaMask is the wallet used by authorized uploaders to approve blockchain
            actions. You only need it when issuing or managing certificates that require
            an on-chain transaction.
          </p>
          <div className="about-steps">
            <span>Install MetaMask</span>
            <span>Open the wallet</span>
            <span>Switch to Sepolia</span>
            <span>Connect to the workspace</span>
            <span>Approve the transaction</span>
          </div>
          <p className="about-warning">
            Never share your MetaMask Secret Recovery Phrase or private key with anyone.
          </p>
        </article>

        <article className="about-card">
          <span className="about-number">05</span>
          <h3>What happens after upload?</h3>
          <div className="flow">
            <div><b>Certificate file</b><span>Your PDF or image</span></div>
            <i>↓</i>
            <div><b>SHA-256</b><span>Digital fingerprint</span></div>
            <i>↓</i>
            <div><b>IPFS</b><span>Certificate file storage</span></div>
            <i>↓</i>
            <div><b>Sepolia</b><span>Blockchain record</span></div>
            <i>↓</i>
            <div className="flow-final"><b>Verify</b><span>Anyone can check it</span></div>
          </div>
        </article>

        <article className="about-card about-card-wide contact-card">
          <span className="about-number">06</span>
          <h3>Need administrator access?</h3>
          <p>
            Administrator access is restricted. There is no separate admin sign-in
            shown to normal users. Contact the project owner to request administrator
            access for your email address.
          </p>
          <div className="owner-box">
            <span>Project owner</span>
            <strong>Trushant Rathod</strong>
            <small>Contact the owner directly to request admin access.</small>
          </div>
        </article>
      </section>
    </main>
  </Shell>;
}

function Portal() { const [user, setUser] = useState<User | null>(auth?.currentUser || null); const [role, setRole] = useState<string>(); const [ready, setReady] = useState(Boolean(!auth)); useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, async (next) => { setUser(next); if (!next) { setRole(undefined); setReady(true); return; } try { let nextRole = await roleOf(next); if (!nextRole) { await api.ensureUploader(); await next.getIdToken(true); nextRole = await roleOf(next); } setRole(nextRole); } catch { setRole(undefined); } finally { setReady(true); } }); }, []); if (!ready) return <Shell><main className="page"><Loading /></main></Shell>; if (!auth) return <Shell><main className="page"><h2>Firebase setup required</h2><p>Add the public Firebase variables to enable authentication.</p></main></Shell>; if (!user) return <Navigate to="/login" replace />; if (role !== "admin" && role !== "uploader") return <Shell><main className="page"><h2>Access unavailable</h2><p className="muted">Your account could not be assigned the default uploader role.</p><button className="button" onClick={() => logout()}>Sign out</button></main></Shell>; return <Shell><main className="page workspace"><div className="workspace-head"><div><p className="eyebrow">{role.toUpperCase()} WORKSPACE</p><h2>{role === "admin" ? "Registry control" : "Issue credentials"}</h2><p className="muted">Signed in as {user.email}</p></div><button className="button" onClick={() => logout()}>Sign out</button></div>{role === "admin" ? <Admin /> : <Uploader />}</main></Shell>; }

function Uploader() {
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [certificates, setCertificates] = useState<CertificateMeta[]>([]);

  const refresh = () =>
    api
      .certificates()
      .then((v) => setCertificates(v.certificates))
      .catch(() => {});

  useEffect(() => {
    refresh();
  }, []);

  const issue = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File;

    if (!file?.size) {
      setNotice({
        kind: "error",
        text: "Choose a certificate PDF or image.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      // Hash the file locally first so we can detect an already-uploaded
      // certificate before asking MetaMask to sign anything.
      const documentHash = await hashFile(file);
      const existing = await api.findByHash(documentHash);

      if (existing.certificate) {
        setNotice({
          kind: "error",
          text: `This certificate file has already been uploaded${
            existing.certificate.certificateId
              ? ` as ${existing.certificate.certificateId}`
              : ""
          }. Please choose a different file.`,
        });
        return;
      }

      const { account } = await wallet();

      if (!(await isAuthorizedWallet(account))) {
        throw new Error(
          "This connected wallet is not an authorized uploader."
        );
      }

      const id = secureId();
      const { cid } = await api.upload(file);
      const { tx } = await issueOnChain(
        id,
        documentHash,
        cid
      );

      const certificate: CertificateMeta = {
        certificateId: id,
        documentHash,
        cid,
        issuerWallet: account,
        transactionHash: tx,
        recipientName: String(data.get("recipientName")),
        recipientEmail: String(
          data.get("recipientEmail") || ""
        ),
        credential: String(data.get("credential")),
        organization: String(data.get("organization")),
        issueDate: String(data.get("issueDate")),
        expiryDate: String(
          data.get("expiryDate") || ""
        ),
        description: String(
          data.get("description") || ""
        ),
        status: "valid",
      };

      await api.saveCertificate(certificate);

      setNotice({
        kind: "success",
        text: `Certificate ${id} is issued and ready to verify.`,
      });

      form.reset();
      refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "";

      const friendly =
        /Certificate ID already exists|DUPLICATE_CERTIFICATE_ID|already exists/i.test(
          message
        )
          ? "Certificate ID already exists. Please try again."
          : /This certificate file has already been uploaded|DUPLICATE_FILE/i.test(
              message
            )
          ? message
          : /user rejected|user denied|denied transaction|rejected the request|User denied transaction signature/i.test(
              message
            )
          ? "You cancelled the MetaMask transaction."
          : /No wallet found|Install MetaMask/i.test(
              message
            )
          ? "MetaMask is not installed. Please install MetaMask and try again."
          : /Switch your wallet to/i.test(message)
          ? message
          : /insufficient funds/i.test(message)
          ? "Your wallet does not have enough SepoliaETH to pay the network fee."
          : message || "Issuance failed.";

      setNotice({
        kind: "error",
        text: friendly,
      });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm(`Revoke ${id}? This cannot be undone.`)) {
      return;
    }

    try {
      await revokeOnChain(id);
      await api.revoke(id);
      setNotice({
        kind: "success",
        text: "Certificate revoked.",
      });
      refresh();
    } catch (e) {
      setNotice({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Revocation failed.",
      });
    }
  };

  return (
    <>
      <section className="panel">
        <h3>Issue a certificate</h3>
        <p className="muted">
          Preparing → Hashing → IPFS → Blockchain → Confirming → Ready
        </p>

        <form className="issue-grid" onSubmit={issue}>
          <label>
            Recipient name
            <input required name="recipientName" />
          </label>

          <label>
            Recipient email
            <input name="recipientEmail" type="email" />
          </label>

          <label>
            Course / credential
            <input required name="credential" />
          </label>

          <label>
            Organization / issuer
            <input required name="organization" />
          </label>

          <label>
            Issue date
            <input required name="issueDate" type="date" />
          </label>

          <label>
            Expiry date
            <input name="expiryDate" type="date" />
          </label>

          <label className="wide">
            Description
            <textarea name="description" rows={2} />
          </label>

          <label className="wide">
            Certificate file
            <input
              required
              name="file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
            />
          </label>

          <button className="button primary" disabled={busy}>
            {busy ? "Checking & issuing…" : "Connect wallet & issue"}
          </button>
        </form>

        <NoticeBox notice={notice} />
      </section>

      <CertificateTable
        certificates={certificates}
        onRevoke={revoke}
      />
    </>
  );
}

function Admin() { const [notice, setNotice] = useState<Notice>(null); const [users, setUsers] = useState<{ uid: string; name: string; email: string; walletAddress: string; active: boolean }[]>([]); const [certificates, setCertificates] = useState<CertificateMeta[]>([]); const refresh = () => { api.uploaders().then((v) => setUsers(v.users)).catch((e) => setNotice({ kind: "error", text: e.message })); api.certificates().then((v) => setCertificates(v.certificates)).catch(() => {}); }; useEffect(() => { refresh(); }, []); const add = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); const item = { name: String(data.get("name")), email: String(data.get("email")), walletAddress: String(data.get("walletAddress")) as Address, active: true }; try { await setUploaderOnChain(item.walletAddress, true); await api.saveUploader(item); setNotice({ kind: "success", text: "Uploader authorized on-chain and in Firebase." }); form.reset(); refresh(); } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not add uploader." }); } };
  const toggle = async (u: { name: string; email: string; walletAddress: string; active: boolean }) => { try { await setUploaderOnChain(u.walletAddress as Address, !u.active); await api.saveUploader({ ...u, active: !u.active }); setNotice({ kind: "success", text: `${u.name} ${u.active ? "deactivated" : "reactivated"}.` }); refresh(); } catch (e) { setNotice({ kind: "error", text: e instanceof Error ? e.message : "Update failed." }); } };
  const stats = useMemo(() => ({ total: certificates.length, valid: certificates.filter((c) => c.status === "valid").length, revoked: certificates.filter((c) => c.status === "revoked").length, uploaders: users.filter((u) => u.active).length }), [certificates, users]); return <><section className="stats">{Object.entries(stats).map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</section><section className="panel"><h3>Authorize uploader</h3><p className="muted">The user must have already registered with Firebase. This writes their authorization to both Sepolia and Firebase.</p><form className="issue-grid compact" onSubmit={add}><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Wallet address<input name="walletAddress" placeholder="0x…" required pattern="0x[a-fA-F0-9]{40}" /></label><button className="button primary">Authorize uploader</button></form><NoticeBox notice={notice} /></section><section className="panel"><h3>Uploaders</h3>{users.length ? <div className="list">{users.map((u) => <div key={u.uid}><span><b>{u.name}</b><small>{u.email} · {short(u.walletAddress)}</small></span><button className="button small" onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Reactivate"}</button></div>)}</div> : <p className="muted">No uploaders yet.</p>}</section><CertificateTable certificates={certificates} /></>; }

function CertificateTable({ certificates, onRevoke }: { certificates: CertificateMeta[]; onRevoke?: (id: string) => void }) { return <section className="panel"><h3>Certificates</h3>{certificates.length ? <div className="table-wrap"><table><thead><tr><th>ID</th><th>Recipient</th><th>Credential</th><th>Status</th><th /></tr></thead><tbody>{certificates.map((c) => <tr key={c.certificateId}><td><Link to={`/verify/${c.certificateId}`}>{c.certificateId}</Link></td><td>{c.recipientName}</td><td>{c.credential}</td><td><span className={`status ${c.status}`}>{c.status}</span></td><td>{onRevoke && c.status === "valid" && <button className="text-button danger" onClick={() => onRevoke(c.certificateId)}>Revoke</button>}</td></tr>)}</tbody></table></div> : <p className="muted">No certificates have been issued.</p>}</section>; }

export default function App() { return <Routes><Route path="/" element={<Home />} /><Route path="/about" element={<AboutPage />} /><Route path="/verify" element={<Verify />} /><Route path="/verify/:certificateId" element={<Verify />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/portal" element={<Portal />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }

