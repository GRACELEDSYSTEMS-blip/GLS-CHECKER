import { useEffect, useRef, useState } from "react";

const PIN_KEY = "gls_security_pin_v1";
const BIO_KEY = "gls_security_biometric_v1";
const ITERATIONS = 180000;

function bytesToB64Url(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function randomBytes(size = 32) {
  const out = new Uint8Array(size);
  crypto.getRandomValues(out);
  return out;
}

async function derivePin(pin, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToB64Url(bits);
}

async function savePin(pin) {
  const salt = randomBytes(16);
  const hash = await derivePin(pin, salt);
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt: bytesToB64Url(salt), hash }));
}

async function verifyPin(pin) {
  try {
    const saved = JSON.parse(localStorage.getItem(PIN_KEY) || "null");
    if (!saved?.salt || !saved?.hash) return false;
    const hash = await derivePin(pin, b64UrlToBytes(saved.salt));
    return hash === saved.hash;
  } catch {
    return false;
  }
}

async function platformBiometricAvailable() {
  try {
    return !!(
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    );
  } catch {
    return false;
  }
}

function derToRaw(signature, size = 32) {
  const bytes = new Uint8Array(signature);
  if (bytes[0] !== 0x30) return bytes;
  let offset = 2;
  if (bytes[1] & 0x80) offset = 2 + (bytes[1] & 0x7f);
  if (bytes[offset] !== 0x02) return bytes;
  const rLen = bytes[offset + 1];
  let r = bytes.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  if (bytes[offset] !== 0x02) return bytes;
  const sLen = bytes[offset + 1];
  let s = bytes.slice(offset + 2, offset + 2 + sLen);
  while (r.length > size && r[0] === 0) r = r.slice(1);
  while (s.length > size && s[0] === 0) s = s.slice(1);
  const raw = new Uint8Array(size * 2);
  raw.set(r.slice(-size), size - Math.min(size, r.length));
  raw.set(s.slice(-size), size * 2 - Math.min(size, s.length));
  return raw;
}

async function registerBiometric() {
  const challenge = randomBytes(32);
  const userId = randomBytes(16);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "GLS Checker" },
      user: {
        id: userId,
        name: "gls-owner",
        displayName: "GLS Owner",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  });

  if (!credential) throw new Error("Biometric setup was cancelled.");
  const publicKey = credential.response.getPublicKey?.();
  const algorithm = credential.response.getPublicKeyAlgorithm?.();
  if (!publicKey || !algorithm) {
    throw new Error("This browser cannot securely save the biometric credential yet.");
  }

  localStorage.setItem(BIO_KEY, JSON.stringify({
    id: bytesToB64Url(credential.rawId),
    publicKey: bytesToB64Url(publicKey),
    algorithm,
  }));
}

async function verifyBiometric() {
  const saved = JSON.parse(localStorage.getItem(BIO_KEY) || "null");
  if (!saved?.id || !saved?.publicKey || !saved?.algorithm) return false;

  const challenge = randomBytes(32);
  const expectedChallenge = bytesToB64Url(challenge);
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: b64UrlToBytes(saved.id) }],
      userVerification: "required",
      timeout: 60000,
    },
  });

  if (!assertion) return false;
  const clientData = JSON.parse(new TextDecoder().decode(assertion.response.clientDataJSON));
  if (
    clientData.type !== "webauthn.get" ||
    clientData.challenge !== expectedChallenge ||
    clientData.origin !== window.location.origin
  ) return false;

  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(window.location.hostname))
  );
  const authData = new Uint8Array(assertion.response.authenticatorData);
  if (authData.length < 37) return false;
  for (let i = 0; i < 32; i += 1) {
    if (authData[i] !== rpIdHash[i]) return false;
  }
  if ((authData[32] & 0x04) === 0) return false;

  const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", assertion.response.clientDataJSON));
  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData, 0);
  signed.set(clientHash, authData.length);

  let keyAlgorithm;
  let verifyAlgorithm;
  let signature = new Uint8Array(assertion.response.signature);

  if (saved.algorithm === -7) {
    keyAlgorithm = { name: "ECDSA", namedCurve: "P-256" };
    verifyAlgorithm = { name: "ECDSA", hash: "SHA-256" };
    signature = derToRaw(signature, 32);
  } else if (saved.algorithm === -257) {
    keyAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    verifyAlgorithm = { name: "RSASSA-PKCS1-v1_5" };
  } else {
    return false;
  }

  const publicKey = await crypto.subtle.importKey(
    "spki",
    b64UrlToBytes(saved.publicKey),
    keyAlgorithm,
    false,
    ["verify"]
  );

  return crypto.subtle.verify(verifyAlgorithm, publicKey, signature, signed);
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg,#07184A 0%,#0A1F5C 55%,#162E78 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box",
    fontFamily: "'Segoe UI',sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    background: "#fff",
    borderRadius: 24,
    padding: "28px 24px",
    boxShadow: "0 24px 70px rgba(0,0,0,.28)",
    textAlign: "center",
  },
  shield: {
    width: 64,
    height: 64,
    borderRadius: 20,
    margin: "0 auto 14px",
    display: "grid",
    placeItems: "center",
    background: "#FFF8E5",
    fontSize: 30,
  },
  brand: { color: "#C9A84C", fontWeight: 900, letterSpacing: 2, fontSize: 13 },
  title: { color: "#0A1F5C", margin: "8px 0 6px", fontSize: 24, fontWeight: 900 },
  sub: { color: "#6B7280", fontSize: 13, lineHeight: 1.55, marginBottom: 20 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1.5px solid #D9DEE8",
    borderRadius: 14,
    padding: "14px 16px",
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: 800,
    color: "#0A1F5C",
    outline: "none",
    marginBottom: 10,
  },
  primary: {
    width: "100%",
    border: "none",
    borderRadius: 14,
    padding: 14,
    fontWeight: 900,
    fontSize: 15,
    color: "#0A1F5C",
    background: "linear-gradient(135deg,#C9A84C,#E8C96A)",
    cursor: "pointer",
    marginTop: 4,
  },
  secondary: {
    width: "100%",
    border: "1px solid #D9DEE8",
    borderRadius: 14,
    padding: 13,
    fontWeight: 800,
    fontSize: 14,
    color: "#0A1F5C",
    background: "#F8FAFC",
    cursor: "pointer",
    marginTop: 10,
  },
  error: { color: "#B91C1C", background: "#FEF2F2", padding: "9px 12px", borderRadius: 10, fontSize: 12, marginBottom: 10 },
  note: { color: "#9CA3AF", fontSize: 11, lineHeight: 1.5, marginTop: 14 },
};

export default function SecurityGate({ onUnlock }) {
  const hasPin = !!localStorage.getItem(PIN_KEY);
  const [mode, setMode] = useState(hasPin ? "unlock" : "setup");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioSaved, setBioSaved] = useState(!!localStorage.getItem(BIO_KEY));
  const inputRef = useRef(null);

  useEffect(() => {
    platformBiometricAvailable().then(setBioAvailable);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, [mode]);

  const cleanPin = (value) => value.replace(/\D/g, "").slice(0, 6);

  async function finishPinUnlock() {
    if (bioAvailable && !bioSaved) setMode("offerBiometric");
    else onUnlock();
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    setError("");
    if (pin.length < 4 || pin.length > 6) {
      setError("Use a 4–6 digit PIN.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "setup") {
        if (pin !== confirmPin) {
          setError("The PINs do not match.");
          return;
        }
        await savePin(pin);
        setPin("");
        setConfirmPin("");
        if (bioAvailable) setMode("offerBiometric");
        else onUnlock();
      } else {
        const ok = await verifyPin(pin);
        if (!ok) {
          setError("Incorrect PIN.");
          setPin("");
          return;
        }
        setPin("");
        await finishPinUnlock();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleBiometricUnlock() {
    setError("");
    setBusy(true);
    try {
      const ok = await verifyBiometric();
      if (ok) onUnlock();
      else setError("Biometric verification failed. Use your PIN instead.");
    } catch (e) {
      setError(e?.name === "NotAllowedError" ? "Biometric unlock was cancelled." : "Biometric unlock is unavailable. Use your PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBiometricSetup() {
    setError("");
    setBusy(true);
    try {
      await registerBiometric();
      setBioSaved(true);
      onUnlock();
    } catch (e) {
      setError(e?.name === "NotAllowedError" ? "Biometric setup was cancelled." : (e?.message || "Could not enable biometric unlock."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.shield}>{mode === "offerBiometric" ? "👆" : "🔐"}</div>
        <div style={styles.brand}>GRACE-LED SYSTEMS</div>

        {mode === "offerBiometric" ? (
          <>
            <div style={styles.title}>Enable biometric unlock?</div>
            <div style={styles.sub}>
              Use your phone's fingerprint, face or secure device unlock to open GLS Checker faster. Your biometric data stays on your phone.
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button style={styles.primary} onClick={handleBiometricSetup} disabled={busy}>
              {busy ? "Setting up…" : "👆 Enable Fingerprint / Device Unlock"}
            </button>
            <button style={styles.secondary} onClick={onUnlock} disabled={busy}>Not now — use PIN only</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={styles.title}>{mode === "setup" ? "Create your GLS PIN" : "GLS Checker Locked"}</div>
            <div style={styles.sub}>
              {mode === "setup" ? "Choose a 4–6 digit PIN. It will protect access to your checker stock, customers and finance screens on this device." : "Enter your PIN to continue."}
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <input
              ref={inputRef}
              style={styles.input}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(cleanPin(e.target.value))}
              aria-label="GLS PIN"
            />
            {mode === "setup" && (
              <input
                style={styles.input}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(cleanPin(e.target.value))}
                aria-label="Confirm GLS PIN"
              />
            )}
            <button style={styles.primary} type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "setup" ? "Create PIN" : "Unlock"}
            </button>
            {mode === "unlock" && bioAvailable && bioSaved && (
              <button style={styles.secondary} type="button" onClick={handleBiometricUnlock} disabled={busy}>
                👆 Use Fingerprint / Device Unlock
              </button>
            )}
            <div style={styles.note}>
              Security settings are stored only in this browser/app installation. GLS never receives your fingerprint or face data.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
