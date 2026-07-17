import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ── FIRESTORE HELPERS ────────────────────────────────────
async function loadData(key) {
  try {
    const snap = await getDoc(doc(db, "gls", key));
    return snap.exists() ? snap.data().value : null;
  } catch { return null; }
}
async function saveData(key, val) {
  try { await setDoc(doc(db, "gls", key), { value: val }); } catch(e) { console.error(e); }
}

// ── COST TIER ────────────────────────────────────────────
function getCostTier(qty) {
  if (qty >= 30) return 15.00;
  if (qty >= 10) return 16.50;
  return 17.50;
}

const SELL = 21.50;

// ── TIMESTAMP ────────────────────────────────────────────
function nowStamp() {
  const now = new Date();
  return {
    date: now.toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" }),
    time: now.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }),
    iso: now.toISOString(),
  };
}

// ── PARSE CSV ────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const codes = [];
  for (const line of lines) {
    if (line.toLowerCase().startsWith("serial")) continue;
    const parts = line.split(",");
    if (parts.length >= 2) {
      const serial = parts[0].trim();
      const pin    = parts[1].trim();
      if (serial && pin) codes.push({ serial, pin, used: false });
    }
  }
  return codes;
}

// ── ICONS ────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const CopyIcon   = () => <Icon d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2M8 4h8" />;
const CheckIcon  = () => <Icon d="M20 6L9 17l-5-5" />;
const UploadIcon = () => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />;
const SearchIcon = () => <Icon d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />;
const SendIcon   = () => <Icon d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />;
const UserIcon   = () => <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;
const BoxIcon    = () => <Icon d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />;

// ── STYLES ───────────────────────────────────────────────
const S = {
  app:      { fontFamily:"'Segoe UI',sans-serif", background:"#F8F9FC", minHeight:"100vh", color:"#1A1A2E" },
  header:   { background:"linear-gradient(135deg,#0A1F5C 0%,#1A3080 100%)", padding:"24px 20px 0", textAlign:"center" },
  brand:    { color:"#C9A84C", fontSize:19, fontWeight:800, letterSpacing:2, marginBottom:2 },
  tag:      { color:"rgba(255,255,255,0.55)", fontSize:11, letterSpacing:1, marginBottom:18 },
  tabs:     { display:"flex", justifyContent:"center" },
  tab: a => ({ padding:"10px 14px", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, letterSpacing:0.8,
               borderRadius:"8px 8px 0 0", background: a?"#F8F9FC":"transparent",
               color: a?"#0A1F5C":"rgba(255,255,255,0.65)", transition:"all 0.2s" }),
  body:     { padding:"18px 14px", maxWidth:540, margin:"0 auto" },
  card:     { background:"#fff", borderRadius:16, padding:20, marginBottom:14, boxShadow:"0 2px 12px rgba(10,31,92,0.07)" },
  label:    { display:"block", fontSize:11, fontWeight:700, color:"#6B7280", letterSpacing:1, marginBottom:5, textTransform:"uppercase" },
  input:    { width:"100%", padding:"10px 14px", border:"1.5px solid #E5E7EB", borderRadius:10, fontSize:15,
              outline:"none", boxSizing:"border-box", color:"#1A1A2E", background:"#FAFAFA" },
  select:   { width:"100%", padding:"10px 14px", border:"1.5px solid #E5E7EB", borderRadius:10, fontSize:15,
              outline:"none", background:"#FAFAFA", color:"#1A1A2E", boxSizing:"border-box" },
  row:      { display:"flex", gap:12, marginBottom:12 },
  col:      { flex:1, minWidth:0 },
  btnGold:  { width:"100%", padding:"13px", background:"linear-gradient(135deg,#C9A84C,#E8C96A)", border:"none",
              borderRadius:12, fontWeight:800, fontSize:15, color:"#0A1F5C", cursor:"pointer" },
  btnNavy:  { width:"100%", padding:"13px", background:"#0A1F5C", border:"none", borderRadius:12,
              fontWeight:700, fontSize:15, color:"#fff", cursor:"pointer" },
  btnWA:    { flex:1, padding:"13px", background:"#25D366", border:"none", borderRadius:12,
              fontWeight:700, fontSize:14, color:"#fff", cursor:"pointer", display:"flex",
              alignItems:"center", justifyContent:"center", gap:6 },
  btnSMS:   { flex:1, padding:"13px", background:"#0A1F5C", border:"none", borderRadius:12,
              fontWeight:700, fontSize:14, color:"#fff", cursor:"pointer", display:"flex",
              alignItems:"center", justifyContent:"center", gap:6 },
  btnCopy: c=>({ width:"100%", padding:"11px", background: c?"#16A34A":"#F3F4F6", border:"none", borderRadius:12,
                 fontWeight:700, fontSize:14, color: c?"#fff":"#6B7280", cursor:"pointer",
                 display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                 transition:"background 0.3s", marginTop:10 }),
  btnRed:   { padding:"8px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8,
              fontWeight:700, fontSize:11, color:"#DC2626", cursor:"pointer" },
  msgBox:   { background:"#F0F4FF", border:"1.5px solid #C7D2FE", borderRadius:12, padding:16, fontSize:13,
              lineHeight:1.7, whiteSpace:"pre-wrap", fontFamily:"monospace", color:"#1A1A2E",
              marginBottom:12, maxHeight:260, overflowY:"auto" },
  secTitle: { fontSize:12, fontWeight:800, color:"#0A1F5C", letterSpacing:1.5, textTransform:"uppercase",
              marginBottom:14, display:"flex", alignItems:"center", gap:8 },
  statGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 },
  stat: col=>({ background:col, borderRadius:14, padding:"14px 16px" }),
  statVal:  { fontSize:24, fontWeight:900, marginBottom:2 },
  statLbl:  { fontSize:11, fontWeight:600, opacity:0.7, letterSpacing:0.5 },
  histRow:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start",
              padding:"11px 0", borderBottom:"1px solid #F3F4F6" },
  hLabel:   { fontSize:13, fontWeight:600, color:"#1A1A2E" },
  hSub:     { fontSize:11, color:"#9CA3AF", marginTop:3 },
  hAmt:     { fontSize:14, fontWeight:800, color:"#0A1F5C" },
  badge: t=>({ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700,
               background: t==="WASSCE"?"#EEF2FF":"#FFF7ED",
               color: t==="WASSCE"?"#3730A3":"#C2410C", letterSpacing:0.5, marginLeft:4 }),
  goldBar:  { height:3, background:"linear-gradient(90deg,#C9A84C,#E8C96A)", borderRadius:2, marginBottom:14 },
  poolRow:  { display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"9px 0", borderBottom:"1px solid #F3F4F6", fontSize:13 },
  pill: u => ({ padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700,
                background: u?"#F3F4F6":"#D1FAE5", color: u?"#9CA3AF":"#065F46" }),
  uploadBox:{ border:"2px dashed #C9A84C", borderRadius:14, padding:"28px 20px", textAlign:"center",
              background:"#FFFBF0", cursor:"pointer", marginBottom:14 },
  toast:    { background:"#D1FAE5", color:"#065F46", padding:"10px 16px", borderRadius:10,
              fontSize:13, fontWeight:600, textAlign:"center", marginBottom:12 },
  errBox:   { background:"#FEF2F2", color:"#DC2626", padding:"10px 16px", borderRadius:10,
              fontSize:13, fontWeight:600, textAlign:"center", marginBottom:12 },
  searchBox:{ display:"flex", alignItems:"center", gap:10, background:"#F3F4F6", borderRadius:10,
              padding:"10px 14px", marginBottom:14 },
  custCard: { background:"#F8F9FF", border:"1px solid #E0E7FF", borderRadius:12, padding:"14px 16px", marginBottom:10 },
  custName: { fontWeight:800, fontSize:15, color:"#0A1F5C", marginBottom:4 },
  custMeta: { fontSize:12, color:"#6B7280", lineHeight:1.9 },
  codeBox:  { background:"#EEF2FF", borderRadius:8, padding:"8px 12px", fontSize:12,
              fontFamily:"monospace", color:"#1A1A2E", marginTop:8, lineHeight:1.8 },
  qtyCard: avail=>({ flex:1, borderRadius:12, padding:"14px 12px", textAlign:"center",
              background: avail?"#F0F9FF":"#FEF2F2", border:`1.5px solid ${avail?"#BAE6FD":"#FECACA"}` }),
  qtyControls:{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:6 },
  qtyBtn:   { width:32, height:32, borderRadius:8, border:"none", cursor:"pointer",
              fontWeight:900, fontSize:18, background:"#0A1F5C", color:"#fff" },
  qtyVal:   { fontSize:22, fontWeight:900, minWidth:32, textAlign:"center" },
  syncing:  { textAlign:"center", padding:"60px 20px", color:"#9CA3AF", fontSize:14 },
};

export default function App() {
  const [tab, setTab]             = useState("deliver");
  const [pool, setPool]           = useState({ wassce:[], bece:[] });
  const [customers, setCustomers] = useState([]);
  const [sales, setSales]         = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [syncing, setSyncing]     = useState(false);

  const [custForm, setCustForm]   = useState({ name:"", phone:"" });
  const [wQty, setWQty]           = useState(0);
  const [bQty, setBQty]           = useState(0);
  const [message, setMessage]     = useState("");
  const [lastEntry, setLastEntry] = useState(null);
  const [copied, setCopied]       = useState(false);
  const [deliverErr, setDeliverErr] = useState("");

  const [uploadType, setUploadType] = useState("WASSCE");
  const [uploadMsg, setUploadMsg]   = useState("");
  const [uploadErr, setUploadErr]   = useState("");
  const fileRef = useRef();
  const [search, setSearch]         = useState("");

  // ── LOAD from Firestore ──
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

  const wLeft = pool.wassce.filter(c => !c.used).length;
  const bLeft = pool.bece.filter(c => !c.used).length;

  // ── UPLOAD CSV ──
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const codes = parseCSV(e.target.result);
      if (codes.length === 0) { setUploadErr("No valid codes found."); return; }
      const key = uploadType.toLowerCase();
      const existing = pool[key] || [];
      const existingSerials = new Set(existing.map(c => c.serial));
      const fresh = codes.filter(c => !existingSerials.has(c.serial));
      const newPool = { ...pool, [key]: [...existing, ...fresh] };
      setPool(newPool);
      setSyncing(true);
      await saveData("pool", newPool);
      setSyncing(false);
      setUploadMsg(`✅ ${fresh.length} ${uploadType} checker${fresh.length > 1 ? "s" : ""} loaded!`);
      setUploadErr("");
      setTimeout(() => setUploadMsg(""), 4000);
    };
    reader.readAsText(file);
  }

  // ── DELIVER ──
  async function deliver() {
    setDeliverErr("");
    if (!custForm.name.trim())    { setDeliverErr("Please enter the customer's name."); return; }
    if (!custForm.phone.trim())   { setDeliverErr("Please enter the customer's phone number."); return; }
    if (wQty === 0 && bQty === 0) { setDeliverErr("Please select at least 1 checker."); return; }
    if (wQty > wLeft) { setDeliverErr(`Not enough WASSCE checkers. Only ${wLeft} left.`); return; }
    if (bQty > bLeft) { setDeliverErr(`Not enough BECE checkers. Only ${bLeft} left.`); return; }

    const { date, time, iso } = nowStamp();
    const wCheckers = pool.wassce.filter(c => !c.used).slice(0, wQty);
    const bCheckers = pool.bece.filter(c => !c.used).slice(0, bQty);

    // Mark used
    const wUpdated = [...pool.wassce]; const bUpdated = [...pool.bece];
    let wc = 0, bc = 0;
    wUpdated.forEach((c,i) => { if (!c.used && wc < wQty) { wUpdated[i] = {...c, used:true}; wc++; } });
    bUpdated.forEach((c,i) => { if (!c.used && bc < bQty) { bUpdated[i] = {...c, used:true}; bc++; } });
    const newPool = { wassce: wUpdated, bece: bUpdated };
    setPool(newPool);

    // Build message
    let checkerSection = "";
    if (wCheckers.length > 0) {
      checkerSection += `\n📘 WASSCE CHECKER${wCheckers.length > 1 ? "S" : ""}\n──────────────────`;
      wCheckers.forEach((c,i) => {
        checkerSection += `\n${wCheckers.length > 1 ? `Checker ${i+1}:\n` : ""}Serial:  ${c.serial}\nPIN:     ${c.pin}`;
        if (i < wCheckers.length - 1) checkerSection += "\n";
      });
    }
    if (bCheckers.length > 0) {
      checkerSection += `\n\n📗 BECE CHECKER${bCheckers.length > 1 ? "S" : ""}\n──────────────────`;
      bCheckers.forEach((c,i) => {
        checkerSection += `\n${bCheckers.length > 1 ? `Checker ${i+1}:\n` : ""}Serial:  ${c.serial}\nPIN:     ${c.pin}`;
        if (i < bCheckers.length - 1) checkerSection += "\n";
      });
    }

    const totalQty = wQty + bQty;
    const msg =
`━━━━━━━━━━━━━━━━━━━━━━
✦ GRACE-LED SYSTEMS ✦
  Working Heartily, Serving Faithfully
━━━━━━━━━━━━━━━━━━━━━━

Hello ${custForm.name},

Your Result${totalQty > 1 ? "s" : ""} Checker${totalQty > 1 ? "s are" : " is"} ready! 🎓

📋 CHECKER DETAILS${checkerSection}

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
      ...wCheckers.map(c => ({...c, type:"WASSCE"})),
      ...bCheckers.map(c => ({...c, type:"BECE"}))
    ];
    const entry = { id: Date.now(), name: custForm.name, phone: custForm.phone,
      checkers: allCheckers, wQty, bQty, totalQty, date, time, iso,
      totalPrice: +(totalQty * SELL).toFixed(2) };

    const wCost = getCostTier(pool.wassce.length);
    const bCost = getCostTier(pool.bece.length);
    const newSales = [...sales];
    if (wQty > 0) newSales.push({ id: Date.now()+1, name: custForm.name, phone: custForm.phone, type:"WASSCE", qty: wQty, price: SELL, cost: wCost, profit: +((SELL-wCost)*wQty).toFixed(2), date, time });
    if (bQty > 0) newSales.push({ id: Date.now()+2, name: custForm.name, phone: custForm.phone, type:"BECE",  qty: bQty, price: SELL, cost: bCost, profit: +((SELL-bCost)*bQty).toFixed(2), date, time });
    const newCustomers = [...customers, entry];

    setCustomers(newCustomers);
    setSales(newSales);
    setMessage(msg);
    setLastEntry({ ...entry, msg });
    setCopied(false);
    setCustForm({ name:"", phone:"" });
    setWQty(0); setBQty(0);

    // Save to Firestore
    setSyncing(true);
    await Promise.all([
      saveData("pool", newPool),
      saveData("customers", newCustomers),
      saveData("sales", newSales),
    ]);
    setSyncing(false);
  }

  function openWhatsAppBusiness(msg, phone) {
    const clean = phone.replace(/\D/g, "");
    const intl  = clean.startsWith("0") ? "233" + clean.slice(1) : clean;
    window.open(`https://api.whatsapp.com/send?phone=${intl}&text=${encodeURIComponent(msg)}`, "_blank");
  }
  function openSMS(msg, phone) {
    const clean = phone.replace(/\D/g, "");
    window.open(`sms:${clean}?body=${encodeURIComponent(msg)}`, "_blank");
  }
  function copyMsg() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function clearPool(key) {
    if (!window.confirm(`Clear ALL ${key.toUpperCase()} checkers? This cannot be undone.`)) return;
    const newPool = { ...pool, [key]: [] };
    setPool(newPool);
    await saveData("pool", newPool);
  }

  const totalRevenue = sales.reduce((a,s) => a + s.price * s.qty, 0);
  const totalProfit  = sales.reduce((a,s) => a + s.profit, 0);
  const totalSold    = sales.reduce((a,s) => a + s.qty, 0);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.checkers && c.checkers.some(ch => ch.serial.includes(search)))
  );

  function exportCSV() {
    const rows = [["Name","Phone","Type","Qty","Serial(s)","PIN(s)","Date","Time","Total Price"]];
    customers.forEach(c => {
      const serials = c.checkers.map(ch=>ch.serial).join(" | ");
      const pins    = c.checkers.map(ch=>ch.pin).join(" | ");
      const types   = [...new Set(c.checkers.map(ch=>ch.type))].join("+");
      rows.push([c.name, c.phone||"", types, c.totalQty, serials, pins, c.date, c.time, c.totalPrice]);
    });
    const csv  = rows.map(r => r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "GLS_Sales_Export.csv"; a.click();
  }

  if (!loaded) return (
    <div style={S.syncing}>
      <div style={{fontSize:32, marginBottom:12}}>⏳</div>
      <div>Loading your data...</div>
    </div>
  );

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.brand}>GRACE-LED SYSTEMS</div>
        <div style={S.tag}>
          Working Heartily, Serving Faithfully
          {syncing && <span style={{marginLeft:8, fontSize:10, color:"#C9A84C"}}>● Syncing...</span>}
        </div>
        <div style={S.tabs}>
          <button style={S.tab(tab==="deliver")}   onClick={()=>setTab("deliver")}>📲 DELIVER</button>
          <button style={S.tab(tab==="stock")}     onClick={()=>setTab("stock")}>📦 STOCK</button>
          <button style={S.tab(tab==="finance")}   onClick={()=>setTab("finance")}>💰 FINANCE</button>
          <button style={S.tab(tab==="customers")} onClick={()=>setTab("customers")}>👥 CUSTOMERS</button>
        </div>
      </div>

      <div style={S.body}>

        {tab==="deliver" && (
          <>
            <div style={{display:"flex", gap:10, marginBottom:14}}>
              <div style={{flex:1, background:wLeft>0?"#D1FAE5":"#FEF2F2", borderRadius:12, padding:"12px 14px", textAlign:"center"}}>
                <div style={{fontWeight:900, fontSize:22, color:wLeft>0?"#065F46":"#DC2626"}}>{wLeft}</div>
                <div style={{fontSize:11, fontWeight:700, color:wLeft>0?"#065F46":"#DC2626"}}>WASSCE LEFT</div>
              </div>
              <div style={{flex:1, background:bLeft>0?"#D1FAE5":"#FEF2F2", borderRadius:12, padding:"12px 14px", textAlign:"center"}}>
                <div style={{fontWeight:900, fontSize:22, color:bLeft>0?"#065F46":"#DC2626"}}>{bLeft}</div>
                <div style={{fontSize:11, fontWeight:700, color:bLeft>0?"#065F46":"#DC2626"}}>BECE LEFT</div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.goldBar}/>
              <div style={S.secTitle}><SendIcon/> New Delivery</div>
              {deliverErr && <div style={S.errBox}>{deliverErr}</div>}
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Customer Name *</label>
                  <input style={S.input} placeholder="e.g. Kwame Mensah"
                    value={custForm.name} onChange={e=>setCustForm({...custForm, name:e.target.value})}/>
                </div>
                <div style={S.col}>
                  <label style={S.label}>Phone Number *</label>
                  <input style={S.input} placeholder="0241234567" type="tel"
                    value={custForm.phone} onChange={e=>setCustForm({...custForm, phone:e.target.value})}/>
                </div>
              </div>
              <label style={{...S.label, marginBottom:10}}>Number of Checkers</label>
              <div style={{display:"flex", gap:12, marginBottom:16}}>
                <div style={S.qtyCard(wLeft>0)}>
                  <div style={{fontSize:11, fontWeight:700, color:wLeft>0?"#0369A1":"#DC2626", marginBottom:4}}>📘 WASSCE</div>
                  <div style={{fontSize:10, color:"#9CA3AF", marginBottom:6}}>{wLeft} available</div>
                  <div style={S.qtyControls}>
                    <button style={S.qtyBtn} onClick={()=>setWQty(q=>Math.max(0,q-1))}>−</button>
                    <span style={{...S.qtyVal, color:"#0A1F5C"}}>{wQty}</span>
                    <button style={S.qtyBtn} onClick={()=>setWQty(q=>Math.min(wLeft,q+1))}>+</button>
                  </div>
                </div>
                <div style={S.qtyCard(bLeft>0)}>
                  <div style={{fontSize:11, fontWeight:700, color:bLeft>0?"#C2410C":"#DC2626", marginBottom:4}}>📗 BECE</div>
                  <div style={{fontSize:10, color:"#9CA3AF", marginBottom:6}}>{bLeft} available</div>
                  <div style={S.qtyControls}>
                    <button style={S.qtyBtn} onClick={()=>setBQty(q=>Math.max(0,q-1))}>−</button>
                    <span style={{...S.qtyVal, color:"#0A1F5C"}}>{bQty}</span>
                    <button style={S.qtyBtn} onClick={()=>setBQty(q=>Math.min(bLeft,q+1))}>+</button>
                  </div>
                </div>
              </div>
              {(wQty+bQty)>0 && (
                <div style={{background:"#F0F9FF", border:"1px solid #BAE6FD", borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", justifyContent:"space-between"}}>
                  <span style={{fontSize:13, color:"#0369A1", fontWeight:600}}>Total: {wQty+bQty} checker{wQty+bQty>1?"s":""}</span>
                  <span style={{fontSize:15, fontWeight:800, color:"#0A1F5C"}}>GH¢{((wQty+bQty)*SELL).toFixed(2)}</span>
                </div>
              )}
              <button style={S.btnGold} onClick={deliver}>⚡ Deliver Checker{(wQty+bQty)>1?"s":""}</button>
            </div>

            {message && (
              <div style={S.card}>
                <div style={S.goldBar}/>
                <div style={S.secTitle}>✦ Ready to Send</div>
                {lastEntry && (
                  <div style={{background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12}}>
                    <b style={{color:"#065F46"}}>✅ Saved to cloud</b> · {lastEntry.totalQty} checker{lastEntry.totalQty>1?"s":""} · {lastEntry.date} {lastEntry.time}
                  </div>
                )}
                <div style={S.msgBox}>{message}</div>
                <div style={{display:"flex", gap:10}}>
                  <button style={S.btnWA} onClick={()=>openWhatsAppBusiness(message, lastEntry.phone)}>
                    <span style={{fontSize:18}}>💬</span> WhatsApp Business
                  </button>
                  <button style={S.btnSMS} onClick={()=>openSMS(message, lastEntry.phone)}>
                    <span style={{fontSize:18}}>💬</span> SMS
                  </button>
                </div>
                <button style={S.btnCopy(copied)} onClick={copyMsg}>
                  {copied ? <><CheckIcon/> Copied!</> : <><CopyIcon/> Copy as Backup</>}
                </button>
              </div>
            )}
          </>
        )}

        {tab==="stock" && (
          <>
            <div style={S.card}>
              <div style={S.goldBar}/>
              <div style={S.secTitle}><UploadIcon/> Upload Checker CSV</div>
              {uploadMsg && <div style={S.toast}>{uploadMsg}</div>}
              {uploadErr && <div style={S.errBox}>{uploadErr}</div>}
              <div style={{marginBottom:12}}>
                <label style={S.label}>Checker Type</label>
                <select style={S.select} value={uploadType} onChange={e=>setUploadType(e.target.value)}>
                  <option value="WASSCE">WASSCE — Senior High School</option>
                  <option value="BECE">BECE — Junior High School</option>
                </select>
              </div>
              <div style={S.uploadBox} onClick={()=>fileRef.current.click()}>
                <div style={{fontSize:32, marginBottom:8}}>📂</div>
                <div style={{fontWeight:700, color:"#0A1F5C", fontSize:14}}>Tap to upload CSV file</div>
                <div style={{fontSize:12, color:"#9CA3AF", marginTop:4}}>From serialandpin.com · SERIAL_NUMBER, PIN format</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}}
                onChange={e=>{ handleFile(e.target.files[0]); e.target.value=""; }}/>
            </div>

            {["wassce","bece"].map(key => {
              const label = key.toUpperCase();
              const left  = pool[key].filter(c=>!c.used).length;
              return (
                <div key={key} style={S.card}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
                    <div style={S.secTitle}><BoxIcon/> {label} Pool</div>
                    <div style={{display:"flex", alignItems:"center", gap:8}}>
                      <div style={{fontSize:12, fontWeight:700, color:"#0A1F5C"}}>{left}/{pool[key].length} left</div>
                      {pool[key].length > 0 && (
                        <button style={S.btnRed} onClick={()=>clearPool(key)}>🗑 Clear</button>
                      )}
                    </div>
                  </div>
                  {pool[key].length === 0
                    ? <div style={{color:"#9CA3AF", fontSize:13, textAlign:"center", padding:"12px 0"}}>No {label} checkers loaded yet.</div>
                    : pool[key].map((c,i) => (
                      <div key={i} style={S.poolRow}>
                        <span style={{fontFamily:"monospace", fontSize:12}}>{c.serial}</span>
                        <span style={S.pill(c.used)}>{c.used?"Used":"Available"}</span>
                      </div>
                    ))
                  }
                </div>
              );
            })}
          </>
        )}

        {tab==="finance" && (
          <>
            <div style={S.statGrid}>
              <div style={S.stat("#EEF2FF")}>
                <div style={{...S.statVal, color:"#0A1F5C"}}>{wLeft+bLeft}</div>
                <div style={{...S.statLbl, color:"#0A1F5C"}}>Stock Left</div>
              </div>
              <div style={S.stat("#FFF7ED")}>
                <div style={{...S.statVal, color:"#C2410C"}}>{totalSold}</div>
                <div style={{...S.statLbl, color:"#C2410C"}}>Total Sold</div>
              </div>
              <div style={S.stat("#F0FDF4")}>
                <div style={{...S.statVal, color:"#16A34A"}}>GH¢{totalRevenue.toFixed(2)}</div>
                <div style={{...S.statLbl, color:"#16A34A"}}>Revenue</div>
              </div>
              <div style={S.stat(totalProfit>=0?"#ECFDF5":"#FEF2F2")}>
                <div style={{...S.statVal, color:totalProfit>=0?"#059669":"#DC2626"}}>GH¢{totalProfit.toFixed(2)}</div>
                <div style={{...S.statLbl, color:totalProfit>=0?"#059669":"#DC2626"}}>Profit</div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.goldBar}/>
              <div style={S.secTitle}>Breakdown by Type</div>
              {["WASSCE","BECE"].map(t => {
                const tS = sales.filter(s=>s.type===t);
                const tR = tS.reduce((a,s)=>a+s.price*s.qty,0);
                const tP = tS.reduce((a,s)=>a+s.profit,0);
                const tQ = tS.reduce((a,s)=>a+s.qty,0);
                return (
                  <div key={t} style={S.histRow}>
                    <div>
                      <div style={{display:"flex", alignItems:"center"}}>
                        <span style={S.hLabel}>{t}</span>
                        <span style={S.badge(t)}>{t}</span>
                      </div>
                      <div style={S.hSub}>{tQ} sold · Revenue: GH¢{tR.toFixed(2)}</div>
                    </div>
                    <div style={{...S.hAmt, color:"#059669"}}>GH¢{tP.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
            {sales.length > 0 && (
              <div style={S.card}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
                  <div style={S.secTitle}>🧾 Sales Log</div>
                  <button style={S.btnRed} onClick={exportCSV}>⬇ Export CSV</button>
                </div>
                {[...sales].reverse().map((s,i) => (
                  <div key={i} style={S.histRow}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:"flex", alignItems:"center", gap:4, flexWrap:"wrap"}}>
                        <span style={S.hLabel}>{s.name}</span>
                        <span style={S.badge(s.type)}>{s.type}</span>
                      </div>
                      <div style={S.hSub}>{s.date} · {s.time} · {s.qty} checker{s.qty>1?"s":""} · Profit: GH¢{s.profit.toFixed(2)}</div>
                    </div>
                    <span style={S.hAmt}>GH¢{(s.price*s.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab==="customers" && (
          <>
            <div style={{...S.stat("#EEF2FF"), marginBottom:14, borderRadius:14}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div>
                  <div style={{...S.statVal, color:"#0A1F5C"}}>{customers.length}</div>
                  <div style={{...S.statLbl, color:"#0A1F5C"}}>Total Customers</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{...S.statVal, color:"#0A1F5C", fontSize:18}}>
                    {customers.reduce((a,c)=>a+(c.wQty||0),0)} / {customers.reduce((a,c)=>a+(c.bQty||0),0)}
                  </div>
                  <div style={{...S.statLbl, color:"#0A1F5C"}}>WASSCE / BECE sold</div>
                </div>
              </div>
            </div>
            <div style={S.searchBox}>
              <SearchIcon/>
              <input style={{flex:1, border:"none", background:"transparent", fontSize:14, outline:"none", color:"#1A1A2E"}}
                placeholder="Search name, phone or serial..."
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            {filtered.length===0
              ? <div style={{textAlign:"center", color:"#9CA3AF", padding:"40px 0", fontSize:14}}>
                  <UserIcon/>
                  <p style={{marginTop:12}}>{search?"No results found.":"No customers yet."}</p>
                </div>
              : [...filtered].reverse().map(c => (
                <div key={c.id} style={S.custCard}>
                  <div style={{display:"flex", alignItems:"center", flexWrap:"wrap", gap:4, marginBottom:4}}>
                    <span style={S.custName}>{c.name}</span>
                    {c.wQty>0 && <span style={S.badge("WASSCE")}>{c.wQty}× WASSCE</span>}
                    {c.bQty>0 && <span style={S.badge("BECE")}>{c.bQty}× BECE</span>}
                  </div>
                  <div style={S.custMeta}>
                    {c.phone && <span>📱 {c.phone}<br/></span>}
                    📅 {c.date} &nbsp;·&nbsp; 🕐 {c.time}
                    <br/>💰 GH¢{c.totalPrice?.toFixed(2)}
                  </div>
                  <div style={S.codeBox}>
                    {c.checkers?.map((ch,i) => (
                      <div key={i}><b>{ch.type}</b> · Serial: {ch.serial} · PIN: {ch.pin}</div>
                    ))}
                  </div>
                </div>
              ))
            }
          </>
        )}
      </div>
    </div>
  );
}
