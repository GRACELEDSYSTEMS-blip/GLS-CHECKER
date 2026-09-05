import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import SecurityGate from "./SecurityGate";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ── FIRESTORE HELPERS ────────────────────────────────────
async function loadData(key) {
  try {
    const snap = await getDoc(doc(db, "gls", key));
    return snap.exists() ? snap.data().value : null;
  } catch {
    return null;
  }
}

async function saveData(key, val) {
  try {
    await setDoc(doc(db, "gls", key), { value: val });
  } catch (e) {
    console.error(e);
  }
}

// ── COST TIER ────────────────────────────────────────────
function getCostTier(qty) {
  if (qty >= 30) return 15.0;
  if (qty >= 10) return 16.5;
  return 17.5;
}

const SELL = 21.5;

// ── TIMESTAMP ────────────────────────────────────────────
function nowStamp() {
  const now = new Date();

  return {
    date: now.toLocaleDateString("en-GH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),

    time: now.toLocaleTimeString("en-GH", {
      hour: "2-digit",
      minute: "2-digit",
    }),

    iso: now.toISOString(),
  };
}

// ── PARSE CSV ────────────────────────────────────────────
function parseCSV(text) {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const codes = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith("serial")) continue;

    const parts = line.split(",");

    if (parts.length >= 2) {
      const serial = parts[0].trim();
      const pin = parts[1].trim();

      if (serial && pin) {
        codes.push({
          serial,
          pin,
          used: false,
        });
      }
    }
  }

  return codes;
}

// ── ICONS ────────────────────────────────────────────────
async function parseCheckerPDF(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join("\n"));
  }

  const text = pages.join("\n");
  const detectedType = /\bBECE\b/i.test(text)
    ? "BECE"
    : /\bWASSCE\b/i.test(text)
      ? "WASSCE"
      : null;

  const codes = [];
  const regex = /Serial\s*:\s*([A-Z0-9-]+)[\s\S]{0,100}?PIN\s*:\s*([0-9]{6,20})/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    codes.push({
      serial: match[1].trim(),
      pin: match[2].trim(),
      used: false,
    });
  }

  return { codes, detectedType };
}

const Icon = ({ d, size = 18, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const CopyIcon = () => (
  <Icon d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2M8 4h8" />
);

const CheckIcon = () => (
  <Icon d="M20 6L9 17l-5-5" />
);

const UploadIcon = () => (
  <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
);

const SearchIcon = () => (
  <Icon d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
);

const SendIcon = () => (
  <Icon d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
);

const UserIcon = () => (
  <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
);

const BoxIcon = () => (
  <Icon d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
);

// ── STYLES ───────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "'Segoe UI',sans-serif",
    background: "#F8F9FC",
    minHeight: "100vh",
    color: "#1A1A2E",
  },

  header: {
    background: "linear-gradient(135deg,#0A1F5C 0%,#1A3080 100%)",
    padding: "24px 20px 0",
    textAlign: "center",
  },

  brand: {
    color: "#C9A84C",
    fontSize: 19,
    fontWeight: 800,
    letterSpacing: 2,
    marginBottom: 2,
  },

  tag: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 18,
  },

  tabs: {
    display: "flex",
    justifyContent: "center",
  },

  tab: (a) => ({
    padding: "10px 14px",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.8,
    borderRadius: "8px 8px 0 0",
    background: a ? "#F8F9FC" : "transparent",
    color: a ? "#0A1F5C" : "rgba(255,255,255,0.65)",
    transition: "all 0.2s",
  }),

  body: {
    padding: "18px 14px",
    maxWidth: 540,
    margin: "0 auto",
  },

  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    boxShadow: "0 2px 12px rgba(10,31,92,0.07)",
  },

  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 5,
    textTransform: "uppercase",
  },

  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid #E5E7EB",
    borderRadius: 10,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    color: "#1A1A2E",
    background: "#FAFAFA",
  },

  select: {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid #E5E7EB",
    borderRadius: 10,
    fontSize: 15,
    outline: "none",
    background: "#FAFAFA",
    color: "#1A1A2E",
    boxSizing: "border-box",
  },

  row: {
    display: "flex",
    gap: 12,
    marginBottom: 12,
  },

  col: {
    flex: 1,
    minWidth: 0,
  },

  btnGold: {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg,#C9A84C,#E8C96A)",
    border: "none",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 15,
    color: "#0A1F5C",
    cursor: "pointer",
  },

  btnNavy: {
    width: "100%",
    padding: "13px",
    background: "#0A1F5C",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    color: "#fff",
    cursor: "pointer",
  },

  btnWA: {
    flex: 1,
    padding: "13px",
    background: "#25D366",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  btnSMS: {
    flex: 1,
    padding: "13px",
    background: "#0A1F5C",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  btnCopy: (c) => ({
    width: "100%",
    padding: "11px",
    background: c ? "#16A34A" : "#F3F4F6",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    color: c ? "#fff" : "#6B7280",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "background 0.3s",
    marginTop: 10,
  }),

  btnRed: {
    padding: "8px 14px",
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 11,
    color: "#DC2626",
    cursor: "pointer",
  },

  msgBox: {
    background: "#F0F4FF",
    border: "1.5px solid #C7D2FE",
    borderRadius: 12,
    padding: 16,
    fontSize: 13,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    fontFamily: "monospace",
    color: "#1A1A2E",
    marginBottom: 12,
    maxHeight: 260,
    overflowY: "auto",
  },

  secTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0A1F5C",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 14,
  },

  stat: (col) => ({
    background: col,
    borderRadius: 14,
    padding: "14px 16px",
  }),

  statVal: {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 2,
  },

  statLbl: {
    fontSize: 11,
    fontWeight: 600,
    opacity: 0.7,
    letterSpacing: 0.5,
  },

  histRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "11px 0",
    borderBottom: "1px solid #F3F4F6",
  },

  hLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1A1A2E",
  },

  hSub: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 3,
  },

  hAmt: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0A1F5C",
  },

  badge: (t) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 700,
    background: t === "WASSCE" ? "#EEF2FF" : "#FFF7ED",
    color: t === "WASSCE" ? "#3730A3" : "#C2410C",
    letterSpacing: 0.5,
    marginLeft: 4,
  }),

  goldBar: {
    height: 3,
    background: "linear-gradient(90deg,#C9A84C,#E8C96A)",
    borderRadius: 2,
    marginBottom: 14,
  },

  pill: (u) => ({
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 700,
    background: u ? "#F3F4F6" : "#D1FAE5",
    color: u ? "#9CA3AF" : "#065F46",
  }),

  uploadBox: {
    border: "2px dashed #C9A84C",
    borderRadius: 14,
    padding: "28px 20px",
    textAlign: "center",
    background: "#FFFBF0",
    cursor: "pointer",
    marginBottom: 14,
  },

  toast: {
    background: "#D1FAE5",
    color: "#065F46",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center",
    marginBottom: 12,
  },

  errBox: {
    background: "#FEF2F2",
    color: "#DC2626",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center",
    marginBottom: 12,
  },

  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#F3F4F6",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 14,
  },

  custCard: {
    background: "#F8F9FF",
    border: "1px solid #E0E7FF",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 10,
  },

  custName: {
    fontWeight: 800,
    fontSize: 15,
    color: "#0A1F5C",
    marginBottom: 4,
  },

  custMeta: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 1.9,
  },

  codeBox: {
    background: "#EEF2FF",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    fontFamily: "monospace",
    color: "#1A1A2E",
    marginTop: 8,
    lineHeight: 1.8,
  },

  qtyCard: (avail) => ({
    flex: 1,
    borderRadius: 12,
    padding: "14px 12px",
    textAlign: "center",
    background: avail ? "#F0F9FF" : "#FEF2F2",
    border: `1.5px solid ${avail ? "#BAE6FD" : "#FECACA"}`,
  }),

  qtyControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },

  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 18,
    background: "#0A1F5C",
    color: "#fff",
  },

  qtyVal: {
    fontSize: 22,
    fontWeight: 900,
    minWidth: 32,
    textAlign: "center",
  },

  syncing: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#9CA3AF",
    fontSize: 14,
  },
};

export default function App() {
  const [securityUnlocked, setSecurityUnlocked] = useState(false);
  const [tab, setTab] = useState("deliver");

  const [pool, setPool] = useState({
    wassce: [],
    bece: [],
  });

  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [custForm, setCustForm] = useState({
    name: "",
    phone: "",
  });

  const [wQty, setWQty] = useState(0);
  const [bQty, setBQty] = useState(0);

  const [message, setMessage] = useState("");
  const [codesMsg, setCodesMsg] = useState("");
  const [lastEntry, setLastEntry] = useState(null);

  const [copied, setCopied] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [deliverErr, setDeliverErr] = useState("");

  const [uploadType, setUploadType] = useState("WASSCE");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const [pendingUpload, setPendingUpload] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const fileRef = useRef();

  const [search, setSearch] = useState("");

  // Each checker type remembers its own Stock view.
  const [stockView, setStockView] = useState({
    wassce: "unused",
    bece: "unused",
  });

  // Lock again after 5 minutes of inactivity or after being away for 1 minute.
  useEffect(() => {
    if (!securityUnlocked) return undefined;

    let inactivityTimer;
    let hiddenAt = null;

    const lock = () => setSecurityUnlocked(false);
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(lock, 5 * 60 * 1000);
    };
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else {
        if (hiddenAt && Date.now() - hiddenAt >= 60 * 1000) {
          lock();
          return;
        }
        hiddenAt = null;
        resetTimer();
      }
    };

    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((name) => window.addEventListener(name, resetTimer, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((name) => window.removeEventListener(name, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [securityUnlocked]);

  // ── LOAD DATA FROM FIRESTORE ──────────────────────────
  useEffect(() => {
    (async () => {
      const p = await loadData("pool");
      const c = await loadData("customers");
      const s = await loadData("sales");

      if (p) setPool(p);
      if (c) setCustomers(c);
      if (s) setSales(s);

      setLoaded(true);
    })();
  }, []);

  const wLeft = pool.wassce.filter((c) => !c.used).length;
  const bLeft = pool.bece.filter((c) => !c.used).length;

  // ── SAVE HELPERS ──────────────────────────────────────
  async function persistPool(newPool) {
    setPool(newPool);
    setSyncing(true);

    await saveData("pool", newPool);

    setSyncing(false);
  }

  async function persistCustomers(newCustomers) {
    setCustomers(newCustomers);
    setSyncing(true);

    await saveData("customers", newCustomers);

    setSyncing(false);
  }

  // ── UPLOAD PDF / CSV ─────────────────────────────────
  async function handleFile(file) {
    if (!file) return;

    setUploadErr("");
    setUploadMsg("");
    setPendingUpload(null);
    setUploadBusy(true);

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      let codes = [];
      let detectedType = null;

      if (isPdf) {
        const parsed = await parseCheckerPDF(file);
        codes = parsed.codes;
        detectedType = parsed.detectedType;
      } else {
        const text = await file.text();
        codes = parseCSV(text);
      }

      if (codes.length === 0) {
        setUploadErr(
          isPdf
            ? "No checker Serial/PIN pairs were found in this PDF."
            : "No valid codes found in this CSV."
        );
        return;
      }

      const type = detectedType || uploadType;
      const key = type.toLowerCase();
      const allExistingSerials = new Set([
        ...(pool.wassce || []).map((c) => c.serial.toUpperCase()),
        ...(pool.bece || []).map((c) => c.serial.toUpperCase()),
      ]);
      const seen = new Set();
      const valid = [];
      let duplicates = 0;
      let invalid = 0;

      codes.forEach((code) => {
        const serial = String(code.serial || "").trim().toUpperCase();
        const pin = String(code.pin || "").trim();
        const isValid = /^[A-Z0-9-]{5,40}$/.test(serial) && /^\d{6,20}$/.test(pin);

        if (!isValid) {
          invalid += 1;
          return;
        }

        if (seen.has(serial) || allExistingSerials.has(serial)) {
          duplicates += 1;
          return;
        }

        seen.add(serial);
        valid.push({ serial, pin, used: false });
      });

      setPendingUpload({
        fileName: file.name,
        source: isPdf ? "PDF" : "CSV",
        type,
        codes: valid,
        found: codes.length,
        duplicates,
        invalid,
      });

      if (detectedType && detectedType !== uploadType) {
        setUploadType(detectedType);
      }
    } catch (error) {
      console.error(error);
      setUploadErr("Could not read this file. Please try the original retailer PDF or a CSV file.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function confirmPendingUpload() {
    if (!pendingUpload || pendingUpload.codes.length === 0) return;

    const key = pendingUpload.type.toLowerCase();
    const newPool = {
      ...pool,
      [key]: [...(pool[key] || []), ...pendingUpload.codes],
    };

    await persistPool(newPool);

    const count = pendingUpload.codes.length;
    setUploadMsg(`✅ ${count} ${pendingUpload.type} checker${count === 1 ? "" : "s"} added to Unused Stock.`);
    setPendingUpload(null);
    setUploadErr("");
    setTimeout(() => setUploadMsg(""), 5000);
  }

  // ── DELIVER ────────────────────────────────────────────
  async function deliver() {
    setDeliverErr("");

    if (!custForm.name.trim()) {
      setDeliverErr("Please enter the customer's name.");
      return;
    }

    if (!custForm.phone.trim()) {
      setDeliverErr("Please enter the customer's phone number.");
      return;
    }

    if (wQty === 0 && bQty === 0) {
      setDeliverErr("Please select at least 1 checker.");
      return;
    }

    if (wQty > wLeft) {
      setDeliverErr(
        `Not enough WASSCE checkers. Only ${wLeft} left.`
      );
      return;
    }

    if (bQty > bLeft) {
      setDeliverErr(
        `Not enough BECE checkers. Only ${bLeft} left.`
      );
      return;
    }

    const { date, time, iso } = nowStamp();

    const wCheckers = pool.wassce
      .filter(c => !c.used)
      .slice(0, wQty);

    const bCheckers = pool.bece
      .filter(c => !c.used)
      .slice(0, bQty);

    // Mark selected checkers as used
    const wUpdated = [...pool.wassce];
    const bUpdated = [...pool.bece];

    let wc = 0;
    let bc = 0;

    wUpdated.forEach((c, i) => {
      if (!c.used && wc < wQty) {
        wUpdated[i] = { ...c, used: true };
        wc++;
      }
    });

    bUpdated.forEach((c, i) => {
      if (!c.used && bc < bQty) {
        bUpdated[i] = { ...c, used: true };
        bc++;
      }
    });

    const newPool = {
      wassce: wUpdated,
      bece: bUpdated
    };

    setPool(newPool);

    // ── BUILD CODES MESSAGE ──
    let codesSection = "";

    if (wCheckers.length > 0) {
      codesSection +=
        `📘 WASSCE CHECKER${wCheckers.length > 1 ? "S" : ""}\n──────────────────`;

      wCheckers.forEach((c, i) => {
        codesSection +=
          `\n${wCheckers.length > 1 ? `\n🔹 Checker ${i + 1}` : ""}\nSerial:  ${c.serial}\nPIN:     ${c.pin}`;
      });
    }

    if (bCheckers.length > 0) {
      if (codesSection) codesSection += "\n\n";

      codesSection +=
        `📗 BECE CHECKER${bCheckers.length > 1 ? "S" : ""}\n──────────────────`;

      bCheckers.forEach((c, i) => {
        codesSection +=
          `\n${bCheckers.length > 1 ? `\n🔹 Checker ${i + 1}` : ""}\nSerial:  ${c.serial}\nPIN:     ${c.pin}`;
      });
    }

    const totalQty = wQty + bQty;

    let portalSection = "🌐 Check results at:";

    if (wCheckers.length > 0) {
      portalSection += "\nWASSCE: https://ghana.waecdirect.org/";
    }

    if (bCheckers.length > 0) {
      portalSection += "\nBECE: https://eresults.waecgh.org";
    }

    const newCodesMsg =
`${codesSection}

${portalSection}`;

    // ── BUILD BRANDED MESSAGE ──
    const msg =
`━━━━━━━━━━━━━━━━━━━━━━
✦ GRACE-LED SYSTEMS ✦
  Working Heartily, Serving Faithfully
━━━━━━━━━━━━━━━━━━━━━━

Hello ${custForm.name},

Your Result${totalQty > 1 ? "s" : ""} Checker${totalQty > 1 ? "s are" : " is"} ready! 🎓
Your checker code${totalQty > 1 ? "s have" : " has"} been sent in the message above. 👆

📌 HOW TO CHECK
──────────────────
1. Visit the official WAEC results portal
2. Enter your Serial Number & PIN
3. View your results

━━━━━━━━━━━━━━━━━━━━━━
Delivered: ${date} at ${time}
📲 Support: 0206586661
━━━━━━━━━━━━━━━━━━━━━━
Thank you for choosing GRACE-LED SYSTEMS!`;

    const allCheckers = [
      ...wCheckers.map(c => ({
        ...c,
        type: "WASSCE"
      })),

      ...bCheckers.map(c => ({
        ...c,
        type: "BECE"
      }))
    ];

    const entry = {
      id: Date.now(),
      name: custForm.name,
      phone: custForm.phone,
      checkers: allCheckers,
      wQty,
      bQty,
      totalQty,
      date,
      time,
      iso,
      totalPrice: +(totalQty * SELL).toFixed(2)
    };

    const wCost = getCostTier(pool.wassce.length);
    const bCost = getCostTier(pool.bece.length);

    const newSales = [...sales];

    if (wQty > 0) {
      newSales.push({
        id: Date.now() + 1,
        name: custForm.name,
        phone: custForm.phone,
        type: "WASSCE",
        qty: wQty,
        price: SELL,
        cost: wCost,
        profit: +((SELL - wCost) * wQty).toFixed(2),
        date,
        time
      });
    }

    if (bQty > 0) {
      newSales.push({
        id: Date.now() + 2,
        name: custForm.name,
        phone: custForm.phone,
        type: "BECE",
        qty: bQty,
        price: SELL,
        cost: bCost,
        profit: +((SELL - bCost) * bQty).toFixed(2),
        date,
        time
      });
    }

    const newCustomers = [
      ...customers,
      entry
    ];

    setCustomers(newCustomers);
    setSales(newSales);

    setMessage(msg);
    setCodesMsg(newCodesMsg);

    setLastEntry({
      ...entry,
      msg
    });

    setCopied(false);
    setCopiedCodes(false);

    setCustForm({
      name: "",
      phone: ""
    });

    setWQty(0);
    setBQty(0);

    // Save everything to Firestore
    setSyncing(true);

    await Promise.all([
      saveData("pool", newPool),
      saveData("customers", newCustomers),
      saveData("sales", newSales)
    ]);

    setSyncing(false);
  }

  // ── WHATSAPP / SMS / COPY ──────────────────────────────
  function openWhatsAppBusiness(msg, phone) {
    const clean = phone.replace(/\D/g, "");

    const intl = clean.startsWith("0")
      ? "233" + clean.slice(1)
      : clean;

    window.open(
      `https://api.whatsapp.com/send?phone=${intl}&text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  function openSMS(msg, phone) {
    const clean = phone.replace(/\D/g, "");

    window.open(
      `sms:${clean}?body=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  function copyMsg() {
    navigator.clipboard.writeText(message);

    setCopied(true);

    setTimeout(
      () => setCopied(false),
      2500
    );
  }

  // ── STOCK MANAGEMENT ───────────────────────────────────

  function findCheckerCustomer(type, serial) {
    const match = customers.find(c =>
      c.checkers?.some(
        ch =>
          ch.type === type &&
          ch.serial === serial
      )
    );

    return match || null;
  }

  async function editChecker(key, index) {
    const checker = pool[key][index];
    const label = key.toUpperCase();

    const nextSerial = window.prompt(
      `Step 1 of 2 — Edit ${label} serial number:`,
      checker.serial
    );

    if (nextSerial === null) return;

    const serial = nextSerial.trim();

    if (!serial) {
      window.alert(
        "Serial number cannot be empty."
      );
      return;
    }

    const duplicate = pool[key].some(
      (c, i) =>
        i !== index &&
        c.serial === serial
    );

    if (duplicate) {
      window.alert(
        "Another checker already has that serial number."
      );
      return;
    }

    const nextPin = window.prompt(
      `Step 2 of 2 — Edit ${label} PIN:`,
      checker.pin
    );

    if (nextPin === null) return;

    const pin = nextPin.trim();

    if (!pin) {
      window.alert(
        "PIN cannot be empty."
      );
      return;
    }

    const oldSerial = checker.serial;

    const updatedChecker = {
      ...checker,
      serial,
      pin
    };

    const newPool = {
      ...pool,

      [key]: pool[key].map(
        (c, i) =>
          i === index
            ? updatedChecker
            : c
      )
    };

    // If this is already a used checker,
    // also correct it inside Customer history.
    let newCustomers = customers;

    if (checker.used) {
      const type = key.toUpperCase();

      newCustomers = customers.map(c => ({
        ...c,

        checkers:
          c.checkers?.map(ch =>
            ch.type === type &&
            ch.serial === oldSerial
              ? {
                  ...ch,
                  serial,
                  pin
                }
              : ch
          ) || []
      }));

      setCustomers(newCustomers);
    }

    setPool(newPool);

    setSyncing(true);

    await Promise.all([
      saveData(
        "pool",
        newPool
      ),

      checker.used
        ? saveData(
            "customers",
            newCustomers
          )
        : Promise.resolve()
    ]);

    setSyncing(false);
  }

  async function deleteChecker(key, index) {
    const checker = pool[key][index];

    const extra = checker.used
      ? "\n\nThis removes it from the Used Pool only. Existing customer/sales history will remain."
      : "";

    if (
      !window.confirm(
        `Delete checker ${checker.serial}?${extra}`
      )
    ) {
      return;
    }

    const newPool = {
      ...pool,

      [key]: pool[key].filter(
        (_, i) => i !== index
      )
    };

    await persistPool(newPool);
  }

  async function clearPoolSection(key, used) {
    const label =
      `${key.toUpperCase()} ${used ? "used" : "unused"}`;

    const extra = used
      ? " Existing customer/sales history will remain."
      : "";

    if (
      !window.confirm(
        `Clear ALL ${label} checkers? This cannot be undone.${extra}`
      )
    ) {
      return;
    }

    const newPool = {
      ...pool,

      [key]: pool[key].filter(
        c => c.used !== used
      )
    };

    await persistPool(newPool);
  }

  async function moveBackToUnused(key, index) {
    const checker = pool[key][index];

    if (
      !window.confirm(
        `Move ${checker.serial} back to Unused?\n\nThis changes stock status only; existing customer/sales history will remain for reference.`
      )
    ) {
      return;
    }

    const newPool = {
      ...pool,

      [key]: pool[key].map(
        (c, i) =>
          i === index
            ? {
                ...c,
                used: false,
                manualCustomer: undefined,
                manualDate: undefined
              }
            : c
      )
    };

    await persistPool(newPool);
  }

  async function addUsedChecker(key) {
    const label = key.toUpperCase();

    const s = window.prompt(
      `Enter ${label} serial number:`
    );

    if (s === null) return;

    const serial = s.trim();

    if (!serial) {
      window.alert(
        "Serial number cannot be empty."
      );
      return;
    }

    if (
      pool[key].some(
        c => c.serial === serial
      )
    ) {
      window.alert(
        "That serial number already exists in this pool."
      );
      return;
    }

    const p = window.prompt(
      `Enter ${label} PIN:`
    );

    if (p === null) return;

    const pin = p.trim();

    if (!pin) {
      window.alert(
        "PIN cannot be empty."
      );
      return;
    }

    const customer =
      window.prompt(
        "Customer name (optional — for a sale made outside the app):",
        ""
      ) ?? "";

    const { date } = nowStamp();

    const checker = {
      serial,
      pin,
      used: true,
      manualCustomer: customer.trim(),
      manualDate: date,
      manual: true
    };

    const newPool = {
      ...pool,

      [key]: [
        ...pool[key],
        checker
      ]
    };

    await persistPool(newPool);
  }

  // ── FINANCE / SEARCH ───────────────────────────────────
  const totalRevenue = sales.reduce(
    (a, s) =>
      a + s.price * s.qty,
    0
  );

  const totalProfit = sales.reduce(
    (a, s) =>
      a + s.profit,
    0
  );

  const totalSold = sales.reduce(
    (a, s) =>
      a + s.qty,
    0
  );

  const filtered = customers.filter(c =>
    c.name
      .toLowerCase()
      .includes(
        search.toLowerCase()
      ) ||

    (
      c.phone &&
      c.phone.includes(search)
    ) ||

    (
      c.checkers &&
      c.checkers.some(
        ch =>
          ch.serial.includes(search)
      )
    )
  );

  function exportCSV() {
    const rows = [[
      "Name",
      "Phone",
      "Type",
      "Qty",
      "Serial(s)",
      "PIN(s)",
      "Date",
      "Time",
      "Total Price"
    ]];

    customers.forEach(c => {
      const serials = c.checkers
        .map(ch => ch.serial)
        .join(" | ");

      const pins = c.checkers
        .map(ch => ch.pin)
        .join(" | ");

      const types = [
        ...new Set(
          c.checkers.map(
            ch => ch.type
          )
        )
      ].join("+");

      rows.push([
        c.name,
        c.phone || "",
        types,
        c.totalQty,
        serials,
        pins,
        c.date,
        c.time,
        c.totalPrice
      ]);
    });

    const csv = rows
      .map(
        r =>
          r.map(
            v => `"${v}"`
          ).join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv"
      }
    );

    const a =
      document.createElement("a");

    a.href =
      URL.createObjectURL(blob);

    a.download =
      "GLS_Sales_Export.csv";

    a.click();
  }

  if (!securityUnlocked) {
    return <SecurityGate onUnlock={() => setSecurityUnlocked(true)} />;
  }

  if (!loaded) {
    return (
      <div style={S.syncing}>
        <div
          style={{
            fontSize: 32,
            marginBottom: 12
          }}
        >
          ⏳
        </div>

        <div>
          Loading your data...
        </div>
      </div>
    );
  }  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.brand}>GRACE-LED SYSTEMS</div>

        <div style={S.tag}>
          Working Heartily, Serving Faithfully

          {syncing && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                color: "#C9A84C",
              }}
            >
              ● Syncing...
            </span>
          )}
        </div>

        <div style={S.tabs}>
          <button
            style={S.tab(tab === "deliver")}
            onClick={() => setTab("deliver")}
          >
            📲 DELIVER
          </button>

          <button
            style={S.tab(tab === "stock")}
            onClick={() => setTab("stock")}
          >
            📦 STOCK
          </button>

          <button
            style={S.tab(tab === "finance")}
            onClick={() => setTab("finance")}
          >
            💰 FINANCE
          </button>

          <button
            style={S.tab(tab === "customers")}
            onClick={() => setTab("customers")}
          >
            👥 CUSTOMERS
          </button>
        </div>
      </div>

      <div style={S.body}>
        {tab === "deliver" && (
          <>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: wLeft > 0 ? "#D1FAE5" : "#FEF2F2",
                  borderRadius: 12,
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 22,
                    color: wLeft > 0 ? "#065F46" : "#DC2626",
                  }}
                >
                  {wLeft}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: wLeft > 0 ? "#065F46" : "#DC2626",
                  }}
                >
                  WASSCE LEFT
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  background: bLeft > 0 ? "#D1FAE5" : "#FEF2F2",
                  borderRadius: 12,
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 22,
                    color: bLeft > 0 ? "#065F46" : "#DC2626",
                  }}
                >
                  {bLeft}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: bLeft > 0 ? "#065F46" : "#DC2626",
                  }}
                >
                  BECE LEFT
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.goldBar} />

              <div style={S.secTitle}>
                <SendIcon /> New Delivery
              </div>

              {deliverErr && (
                <div style={S.errBox}>
                  {deliverErr}
                </div>
              )}

              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>
                    Customer Name *
                  </label>

                  <input
                    style={S.input}
                    placeholder="e.g. Kwame Mensah"
                    value={custForm.name}
                    onChange={(e) =>
                      setCustForm({
                        ...custForm,
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                <div style={S.col}>
                  <label style={S.label}>
                    Phone Number *
                  </label>

                  <input
                    style={S.input}
                    placeholder="0241234567"
                    type="tel"
                    value={custForm.phone}
                    onChange={(e) =>
                      setCustForm({
                        ...custForm,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <label
                style={{
                  ...S.label,
                  marginBottom: 10,
                }}
              >
                Number of Checkers
              </label>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={S.qtyCard(wLeft > 0)}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: wLeft > 0 ? "#0369A1" : "#DC2626",
                      marginBottom: 4,
                    }}
                  >
                    📘 WASSCE
                  </div>

                  <div
                    style={{
                      fontSize: 10,
                      color: "#9CA3AF",
                      marginBottom: 6,
                    }}
                  >
                    {wLeft} available
                  </div>

                  <div style={S.qtyControls}>
                    <button
                      style={S.qtyBtn}
                      onClick={() =>
                        setWQty((q) =>
                          Math.max(0, q - 1)
                        )
                      }
                    >
                      −
                    </button>

                    <span
                      style={{
                        ...S.qtyVal,
                        color: "#0A1F5C",
                      }}
                    >
                      {wQty}
                    </span>

                    <button
                      style={S.qtyBtn}
                      onClick={() =>
                        setWQty((q) =>
                          Math.min(wLeft, q + 1)
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={S.qtyCard(bLeft > 0)}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: bLeft > 0 ? "#C2410C" : "#DC2626",
                      marginBottom: 4,
                    }}
                  >
                    📗 BECE
                  </div>

                  <div
                    style={{
                      fontSize: 10,
                      color: "#9CA3AF",
                      marginBottom: 6,
                    }}
                  >
                    {bLeft} available
                  </div>

                  <div style={S.qtyControls}>
                    <button
                      style={S.qtyBtn}
                      onClick={() =>
                        setBQty((q) =>
                          Math.max(0, q - 1)
                        )
                      }
                    >
                      −
                    </button>

                    <span
                      style={{
                        ...S.qtyVal,
                        color: "#0A1F5C",
                      }}
                    >
                      {bQty}
                    </span>

                    <button
                      style={S.qtyBtn}
                      onClick={() =>
                        setBQty((q) =>
                          Math.min(bLeft, q + 1)
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {wQty + bQty > 0 && (
                <div
                  style={{
                    background: "#F0F9FF",
                    border: "1px solid #BAE6FD",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 14,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "#0369A1",
                      fontWeight: 600,
                    }}
                  >
                    Total: {wQty + bQty} checker
                    {wQty + bQty > 1 ? "s" : ""}
                  </span>

                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#0A1F5C",
                    }}
                  >
                    GH¢
                    {((wQty + bQty) * SELL).toFixed(2)}
                  </span>
                </div>
              )}

              <button
                style={S.btnGold}
                onClick={deliver}
              >
                ⚡ Deliver Checker
                {wQty + bQty > 1 ? "s" : ""}
              </button>
            </div>

            {message && (
              <div style={S.card}>
                <div style={S.goldBar} />

                <div style={S.secTitle}>
                  ✦ Ready to Send
                </div>

                {lastEntry && (
                  <div
                    style={{
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 12,
                      fontSize: 12,
                    }}
                  >
                    <b style={{ color: "#065F46" }}>
                      ✅ Saved to cloud
                    </b>{" "}
                    · {lastEntry.totalQty} checker
                    {lastEntry.totalQty > 1 ? "s" : ""} ·{" "}
                    {lastEntry.date} {lastEntry.time}
                  </div>
                )}

                <div
                  style={{
                    background: "#065F46",
                    borderRadius: 10,
                    padding: "8px 14px",
                    marginBottom: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  📤 Step 1 — Send codes first
                </div>

                <div style={S.msgBox}>
                  {codesMsg}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <button
                    style={S.btnWA}
                    onClick={() =>
                      openWhatsAppBusiness(
                        codesMsg,
                        lastEntry.phone
                      )
                    }
                  >
                    <span style={{ fontSize: 16 }}>
                      💬
                    </span>{" "}
                    WA Business
                  </button>

                  <button
                    style={S.btnSMS}
                    onClick={() =>
                      openSMS(
                        codesMsg,
                        lastEntry.phone
                      )
                    }
                  >
                    <span style={{ fontSize: 16 }}>
                      💬
                    </span>{" "}
                    SMS
                  </button>
                </div>

                <button
                  style={S.btnCopy(copiedCodes)}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      codesMsg
                    );

                    setCopiedCodes(true);

                    setTimeout(
                      () => setCopiedCodes(false),
                      2500
                    );
                  }}
                >
                  {copiedCodes ? (
                    <>
                      <CheckIcon /> Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon /> Copy Codes
                    </>
                  )}
                </button>

                <div
                  style={{
                    background: "#0A1F5C",
                    borderRadius: 10,
                    padding: "8px 14px",
                    marginBottom: 8,
                    marginTop: 16,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  📤 Step 2 — Send branded message
                </div>

                <div style={S.msgBox}>
                  {message}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 0,
                  }}
                >
                  <button
                    style={S.btnWA}
                    onClick={() =>
                      openWhatsAppBusiness(
                        message,
                        lastEntry.phone
                      )
                    }
                  >
                    <span style={{ fontSize: 16 }}>
                      💬
                    </span>{" "}
                    WA Business
                  </button>

                  <button
                    style={S.btnSMS}
                    onClick={() =>
                      openSMS(
                        message,
                        lastEntry.phone
                      )
                    }
                  >
                    <span style={{ fontSize: 16 }}>
                      💬
                    </span>{" "}
                    SMS
                  </button>
                </div>

                <button
                  style={S.btnCopy(copied)}
                  onClick={copyMsg}
                >
                  {copied ? (
                    <>
                      <CheckIcon /> Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon /> Copy Message
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {tab === "stock" && (
          <>
            <div style={S.card}>
              <div style={S.goldBar} />

              <div style={S.secTitle}>
                <UploadIcon /> Upload Checker PDF / CSV
              </div>

              {uploadMsg && (
                <div style={S.toast}>
                  {uploadMsg}
                </div>
              )}

              {uploadErr && (
                <div style={S.errBox}>
                  {uploadErr}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>
                  Checker Type
                </label>

                <select
                  style={S.select}
                  value={uploadType}
                  onChange={(e) =>
                    setUploadType(e.target.value)
                  }
                >
                  <option value="WASSCE">
                    WASSCE — Senior High School
                  </option>

                  <option value="BECE">
                    BECE — Junior High School
                  </option>
                </select>
              </div>

              <div
                style={S.uploadBox}
                onClick={() =>
                  fileRef.current.click()
                }
              >
                <div
                  style={{
                    fontSize: 32,
                    marginBottom: 8,
                  }}
                >
                  📂
                </div>

                <div
                  style={{
                    fontWeight: 700,
                    color: "#0A1F5C",
                    fontSize: 14,
                  }}
                >
                  {uploadBusy ? "Reading file…" : "Tap to upload PDF or CSV"}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#9CA3AF",
                    marginTop: 4,
                  }}
                >
                  New uploads always enter the Unused Pool
                </div>
              </div>

              {pendingUpload && (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1.5px solid #D9DEE8",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0A1F5C", marginBottom: 6 }}>
                    Review before adding to stock
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>
                    📄 {pendingUpload.fileName}<br />
                    🎓 {pendingUpload.type} · {pendingUpload.source}<br />
                    ✅ {pendingUpload.codes.length} new checker{pendingUpload.codes.length === 1 ? "" : "s"}<br />
                    🔁 {pendingUpload.duplicates} duplicate{pendingUpload.duplicates === 1 ? "" : "s"} skipped<br />
                    ⚠️ {pendingUpload.invalid} invalid entr{pendingUpload.invalid === 1 ? "y" : "ies"} skipped
                  </div>

                  {pendingUpload.codes.length > 0 ? (
                    <>
                      <div
                        style={{
                          marginTop: 10,
                          maxHeight: 150,
                          overflowY: "auto",
                          background: "#fff",
                          borderRadius: 9,
                          padding: "8px 10px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          lineHeight: 1.7,
                        }}
                      >
                        {pendingUpload.codes.slice(0, 20).map((c) => (
                          <div key={c.serial}>{c.serial} · {c.pin}</div>
                        ))}
                        {pendingUpload.codes.length > 20 && (
                          <div>…and {pendingUpload.codes.length - 20} more</div>
                        )}
                      </div>
                      <button style={{ ...S.btnGold, marginTop: 12 }} onClick={confirmPendingUpload}>
                        Add {pendingUpload.codes.length} to Unused Stock
                      </button>
                    </>
                  ) : (
                    <div style={{ ...S.errBox, marginTop: 10, marginBottom: 0 }}>
                      Nothing new to add.
                    </div>
                  )}

                  <button
                    type="button"
                    style={{ ...S.btnRed, width: "100%", marginTop: 8 }}
                    onClick={() => setPendingUpload(nulk)}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.csv,application/pdf,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  handleFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>

            {["wassce", "bece"].map((key) => {
              const label = key.toUpperCase();

              const unused = pool[key]
                .map((c, i) => ({ c, i }))
                .filter((x) => !x.c.used);

              const used = pool[key]
                .map((c, i) => ({ c, i }))
                .filter((x) => x.c.used);

              const showingUsed =
                stockView[key] === "used";

              const rows =
                showingUsed ? used : unused;

              return (
                <div
                  key={key}
                  style={S.card}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        ...S.secTitle,
                        marginBottom: 0,
                      }}
                    >
                      <BoxIcon /> {label} Stock
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#0A1F5C",
                      }}
                    >
                      {unused.length} available ·{" "}
                      {used.length} used
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    <button
                      onClick={() =>
                        setStockView((v) => ({
                          ...v,
                          [key]: "unused",
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: "1px solid #D1D5DB",
                        cursor: "pointer",
                        fontWeight: 800,
                        background: !showingUsed
                          ? "#0A1F5C"
                          : "#F9FAFB",
                        color: !showingUsed
                          ? "#fff"
                          : "#6B7280",
                      }}
                    >
                      Unused ({unused.length})
                    </button>

                    <button
                      onClick={() =>
                        setStockView((v) => ({
                          ...v,
                          [key]: "used",
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: "1px solid #D1D5DB",
                        cursor: "pointer",
                        fontWeight: 800,
                        background: showingUsed
                          ? "#0A1F5C"
                          : "#F9FAFB",
                        color: showingUsed
                          ? "#fff"
                          : "#6B7280",
                      }}
                    >
                      Used ({used.length})
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: showingUsed
                          ? "#6B7280"
                          : "#065F46",
                      }}
                    >
                      {showingUsed
                        ? "Delivered / manually sold checkers"
                        : "Ready-to-sell checkers"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      {showingUsed && (
                        <button
                          style={{
                            ...S.btnRed,
                            color: "#0A1F5C",
                            background: "#EEF2FF",
                            borderColor: "#C7D2FE",
                          }}
                          onClick={() =>
                            addUsedChecker(key)
                          }
                        >
                          ＋ Add Used
                        </button>
                      )}

                      {rows.length > 0 && (
                        <button
                          style={S.btnRed}
                          onClick={() =>
                            clearPoolSection(
                              key,
                              showingUsed
                            )
                          }
                        >
                          🗑 Clear{" "}
                          {showingUsed
                            ? "Used"
                            : "Unused"}
                        </button>
                      )}
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <div
                      style={{
                        color: "#9CA3AF",
                        fontSize: 13,
                        textAlign: "center",
                        padding: "18px 0",
                      }}
                    >
                      No{" "}
                      {showingUsed
                        ? "used"
                        : "unused"}{" "}
                      {label} checkers.
                    </div>
                  ) : (
                    rows.map(({ c, i }) => {
                      const linked = c.used
                        ? findCheckerCustomer(
                            label,
                            c.serial
                          )
                        : null;

                      const customerName =
                        linked?.name ||
                        c.manualCustomer ||
                        "Not linked to a customer";

                      const usedDate = linked
                        ? `${linked.date}${
                            linked.time
                              ? ` · ${linked.time}`
                              : ""
                          }`
                        : c.manualDate ||
                          "Date not recorded";

                      return (
                        <div
                          key={`${c.serial}-${i}`}
                          style={{
                            background: "#F8F9FF",
                            border:
                              "1px solid #E0E7FF",
                            borderRadius: 12,
                            padding: "12px 14px",
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={S.pill(
                                c.used
                              )}
                            >
                              {c.used
                                ? "Used"
                                : "Available"}
                            </span>

                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                                justifyContent:
                                  "flex-end",
                              }}
                            >
                              <button
                                style={{
                                  ...S.btnRed,
                                  color: "#0A1F5C",
                                  background:
                                    "#EEF2FF",
                                  borderColor:
                                    "#C7D2FE",
                                }}
                                onClick={() =>
                                  editChecker(
                                    key,
                                    i
                                  )
                                }
                              >
                                ✏️ Edit Serial & PIN
                              </button>

                              {c.used && (
                                <button
                                  style={{
                                    ...S.btnRed,
                                    color: "#065F46",
                                    background:
                                      "#ECFDF5",
                                    borderColor:
                                      "#A7F3D0",
                                  }}
                                  onClick={() =>
                                    moveBackToUnused(
                                      key,
                                      i
                                    )
                                  }
                                >
                                  ↩ Unused
                                </button>
                              )}

                              <button
                                style={S.btnRed}
                                onClick={() =>
                                  deleteChecker(
                                    key,
                                    i
                                  )
                                }
                              >
                                🗑 Delete
                              </button>
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: 1,
                              color: "#9CA3AF",
                              marginBottom: 3,
                            }}
                          >
                            SERIAL NUMBER
                          </div>

                          <div
                            style={{
                              fontFamily:
                                "monospace",
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#0A1F5C",
                              wordBreak:
                                "break-all",
                              marginBottom: 8,
                            }}
                          >
                            {c.serial}
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: 1,
                              color: "#9CA3AF",
                              marginBottom: 3,
                            }}
                          >
                            PIN
                          </div>

                          <div
                            style={{
                              fontFamily:
                                "monospace",
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#1A1A2E",
                              wordBreak:
                                "break-all",
                            }}
                          >
                            {c.pin}
                          </div>

                          {c.used && (
                            <div
                              style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop:
                                  "1px solid #E5E7EB",
                                fontSize: 11,
                                color: "#6B7280",
                                lineHeight: 1.7,
                              }}
                            >
                              <div>
                                <b>Customer:</b>{" "}
                                {customerName}
                              </div>

                              <div>
                                <b>Used:</b>{" "}
                                {usedDate}
                              </div>

                              {c.manual && (
                                <div>
                                  <b>Source:</b>{" "}
                                  Manually added sale
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {showingUsed &&
                    used.length > 0 && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#9CA3AF",
                          lineHeight: 1.5,
                          marginTop: 6,
                        }}
                      >
                        Editing a used checker also
                        updates the matching checker
                        details in Customer history.
                        Deleting or moving it back
                        changes Stock only; existing
                        sales/customer history remains
                        for reference.
                      </div>
                    )}
                </div>
              );
            })}
          </>
        )}

        {tab === "finance" && (
          <>
            <div style={S.statGrid}>
              <div style={S.stat("#EEF2FF")}>
                <div
                  style={{
                    ...S.statVal,
                    color: "#0A1F5C",
                  }}
                >
                  {wLeft + bLeft}
                </div>

                <div
                  style={{
                    ...S.statLbl,
                    color: "#0A1F5C",
                  }}
                >
                  Stock Left
                </div>
              </div>

              <div style={S.stat("#FFF7ED")}>
                <div
                  style={{
                    ...S.statVal,
                    color: "#C2410C",
                  }}
                >
                  {totalSold}
                </div>

                <div
                  style={{
                    ...S.statLbl,
                    color: "#C2410C",
                  }}
                >
                  Total Sold
                </div>
              </div>

              <div style={S.stat("#F0FDF4")}>
                <div
                  style={{
                    ...S.statVal,
                    color: "#16A34A",
                  }}
                >
                  GH¢{totalRevenue.toFixed(2)}
                </div>

                <div
                  style={{
                    ...S.statLbl,
                    color: "#16A34A",
                  }}
                >
                  Revenue
                </div>
              </div>

              <div
                style={S.stat(
                  totalProfit >= 0
                    ? "#ECFDF5"
                    : "#FEF2F2"
                )}
              >
                <div
                  style={{
                    ...S.statVal,
                    color:
                      totalProfit >= 0
                        ? "#059669"
                        : "#DC2626",
                  }}
                >
                  GH¢{totalProfit.toFixed(2)}
                </div>

                <div
                  style={{
                    ...S.statLbl,
                    color:
                      totalProfit >= 0
                        ? "#059669"
                        : "#DC2626",
                  }}
                >
                  Profit
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.goldBar} />

              <div style={S.secTitle}>
                Breakdown by Type
              </div>

              {["WASSCE", "BECE"].map((t) => {
                const tS = sales.filter(
                  (s) => s.type === t
                );

                const tR = tS.reduce(
                  (a, s) =>
                    a + s.price * s.qty,
                  0
                );

                const tP = tS.reduce(
                  (a, s) =>
                    a + s.profit,
                  0
                );

                const tQ = tS.reduce(
                  (a, s) =>
                    a + s.qty,
                  0
                );

                return (
                  <div
                    key={t}
                    style={S.histRow}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <span style={S.hLabel}>
                          {t}
                        </span>

                        <span
                          style={S.badge(t)}
                        >
                          {t}
                        </span>
                      </div>

                      <div style={S.hSub}>
                        {tQ} sold · Revenue:
                        GH¢{tR.toFixed(2)}
                      </div>
                    </div>

                    <div
                      style={{
                        ...S.hAmt,
                        color: "#059669",
                      }}
                    >
                      GH¢{tP.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>

            {sales.length > 0 && (
              <div style={S.card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div style={S.secTitle}>
                    🧾 Sales Log
                  </div>

                  <button
                    style={S.btnRed}
                    onClick={exportCSV}
                  >
                    ⬇ Export CSV
                  </button>
                </div>

                {[...sales]
                  .reverse()
                  .map((s, i) => (
                    <div
                      key={i}
                      style={S.histRow}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={S.hLabel}>
                            {s.name}
                          </span>

                          <span
                            style={S.badge(
                              s.type
                            )}
                          >
                            {s.type}
                          </span>
                        </div>

                        <div style={S.hSub}>
                          {s.date} · {s.time} ·{" "}
                          {s.qty} checker
                          {s.qty > 1
                            ? "s"
                            : ""}{" "}
                          · Profit: GH¢
                          {s.profit.toFixed(2)}
                        </div>
                      </div>

                      <span style={S.hAmt}>
                        GH¢
                        {(
                          s.price * s.qty
                        ).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {tab === "customers" && (
          <>
            <div
              style={{
                ...S.stat("#EEF2FF"),
                marginBottom: 14,
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      ...S.statVal,
                      color: "#0A1F5C",
                    }}
                  >
                    {customers.length}
                  </div>

                  <div
                    style={{
                      ...S.statLbl,
                      color: "#0A1F5C",
                    }}
                  >
                    Total Customers
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "right",
                  }}
                >
                  <div
                    style={{
                      ...S.statVal,
                      color: "#0A1F5C",
                      fontSize: 18,
                    }}
                  >
                    {customers.reduce(
                      (a, c) =>
                        a + (c.wQty || 0),
                      0
                    )}{" "}
                    /{" "}
                    {customers.reduce(
                      (a, c) =>
                        a + (c.bQty || 0),
                      0
                    )}
                  </div>

                  <div
                    style={{
                      ...S.statLbl,
                      color: "#0A1F5C",
                    }}
                  >
                    WASSCE / BECE sold
                  </div>
                </div>
              </div>
            </div>

            <div style={S.searchBox}>
              <SearchIcon />

              <input
                style={{
                  flex: 1,
                  border: "none",
                  background:
                    "transparent",
                  fontSize: 14,
                  outline: "none",
                  color: "#1A1A2E",
                }}
                placeholder="Search name, phone or serial..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            {filtered.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  padding: "40px 0",
                  fontSize: 14,
                }}
              >
                <UserIcon />

                <p style={{ marginTop: 12 }}>
                  {search
                    ? "No results found."
                    : "No customers yet."}
                </p>
              </div>
            ) : (
              [...filtered]
                .reverse()
                .map((c) => (
                  <div
                    key={c.id}
                    style={S.custCard}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 4,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={S.custName}
                      >
                        {c.name}
                      </span>

                      {c.wQty > 0 && (
                        <span
                          style={S.badge(
                            "WASSCE"
                          )}
                        >
                          {c.wQty}× WASSCE
                        </span>
                      )}

                      {c.bQty > 0 && (
                        <span
                          style={S.badge(
                            "BECE"
                          )}
                        >
                          {c.bQty}× BECE
                        </span>
                      )}
                    </div>

                    <div style={S.custMeta}>
                      {c.phone && (
                        <span>
                          📱 {c.phone}
                          <br />
                        </span>
                      )}

                      📅 {c.date} &nbsp;·&nbsp;
                      🕐 {c.time}

                      <br />

                      💰 GH¢
                      {c.totalPrice?.toFixed(
                        2
                      )}
                    </div>

                    <div style={S.codeBox}>
                      {c.checkers?.map(
                        (ch, i) => (
                          <div key={i}>
                            <b>
                              {ch.type}
                            </b>{" "}
                            · Serial:{" "}
                            {ch.serial} · PIN:{" "}
                            {ch.pin}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
