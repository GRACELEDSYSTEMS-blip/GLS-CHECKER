from pathlib import Path

app = Path("gls-checker/src/App.js")
s = app.read_text()

s = s.replace("setPendingUpload(nulk)", "setPendingUpload(null)")
s = s.replace('const [tab, setTab] = useState("deliver");', 'const [tab, setTab] = useState("home");', 1)

anchor = '  const [search, setSearch] = useState("");\n'
if 'const [checkerLookup, setCheckerLookup]' not in s:
    s = s.replace(anchor, anchor + r'''
  const [checkerLookup, setCheckerLookup] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(() => {
    const saved = Number(localStorage.getItem("gls_low_stock_threshold"));
    return Number.isFinite(saved) && saved >= 0 ? saved : 5;
  });
  const [lockMinutes, setLockMinutes] = useState(() => {
    const saved = Number(localStorage.getItem("gls_lock_minutes"));
    return [1, 5, 10, 15, 30].includes(saved) ? saved : 5;
  });
''', 1)

s = s.replace('// Lock again after 5 minutes of inactivity or after being away for 1 minute.', '// Lock again after the chosen inactivity period or after being away for 1 minute.', 1)
s = s.replace('inactivityTimer = setTimeout(lock, 5 * 60 * 1000);', 'inactivityTimer = setTimeout(lock, lockMinutes * 60 * 1000);', 1)
s = s.replace('}, [securityUnlocked]);', '}, [securityUnlocked, lockMinutes]);', 1)

load_anchor = '  // ── LOAD DATA FROM FIRESTORE ──────────────────────────\n'
if 'localStorage.setItem("gls_low_stock_threshold"' not in s:
    setting_effects = r'''  useEffect(() => {
    localStorage.setItem("gls_low_stock_threshold", String(lowStockThreshold));
  }, [lowStockThreshold]);

  useEffect(() => {
    localStorage.setItem("gls_lock_minutes", String(lockMinutes));
  }, [lockMinutes]);

'''
    s = s.replace(load_anchor, setting_effects + load_anchor, 1)

if 'transactionId: entry.id' not in s:
    s = s.replace('''      newSales.push({
        id: Date.now() + 1,
        name: custForm.name,''', '''      newSales.push({
        id: Date.now() + 1,
        transactionId: entry.id,
        name: custForm.name,''', 1)
    s = s.replace('''      newSales.push({
        id: Date.now() + 2,
        name: custForm.name,''', '''      newSales.push({
        id: Date.now() + 2,
        transactionId: entry.id,
        name: custForm.name,''', 1)

undo_anchor = '  // ── FINANCE / SEARCH ───────────────────────────────────\n'
if 'async function undoTransaction' not in s:
    undo_fn = r'''  async function undoTransaction(entry) {
    const checkers = entry.checkers || [];

    if (checkers.length === 0) {
      window.alert("This transaction has no checker records to restore.");
      return;
    }

    const ok = window.confirm(
      `Undo this sale for ${entry.name}?\n\n${checkers.length} checker${checkers.length === 1 ? "" : "s"} will be returned to Unused Stock, the matching sales record will be removed, and this customer transaction will be removed.`
    );
    if (!ok) return;

    const serialsByType = {
      WASSCE: new Set(checkers.filter(ch => ch.type === "WASSCE").map(ch => ch.serial)),
      BECE: new Set(checkers.filter(ch => ch.type === "BECE").map(ch => ch.serial)),
    };

    const newPool = {
      ...pool,
      wassce: (pool.wassce || []).map(c =>
        serialsByType.WASSCE.has(c.serial)
          ? { ...c, used: false, manualCustomer: undefined, manualDate: undefined }
          : c
      ),
      bece: (pool.bece || []).map(c =>
        serialsByType.BECE.has(c.serial)
          ? { ...c, used: false, manualCustomer: undefined, manualDate: undefined }
          : c
      ),
    };

    const isMatchingLegacySale = (sale) =>
      !sale.transactionId &&
      sale.name === entry.name &&
      (sale.phone || "") === (entry.phone || "") &&
      sale.date === entry.date &&
      sale.time === entry.time;

    const newSales = sales.filter(sale =>
      sale.transactionId
        ? sale.transactionId !== entry.id
        : !isMatchingLegacySale(sale)
    );

    const newCustomers = customers.filter(c => c.id !== entry.id);

    setPool(newPool);
    setSales(newSales);
    setCustomers(newCustomers);
    setSyncing(true);

    await Promise.all([
      saveData("pool", newPool),
      saveData("sales", newSales),
      saveData("customers", newCustomers),
    ]);

    setSyncing(false);
    window.alert("Sale undone. The checker(s) are back in Unused Stock.");
  }

'''
    s = s.replace(undo_anchor, undo_fn + undo_anchor, 1)

filtered_anchor = '  const filtered = customers.filter(c =>\n'
if 'const todaySales = sales.filter' not in s:
    calc = r'''  const todayLabel = nowStamp().date;
  const todaySales = sales.filter(sale => sale.date === todayLabel);
  const todaySold = todaySales.reduce((sum, sale) => sum + sale.qty, 0);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.price * sale.qty, 0);
  const todayProfit = todaySales.reduce((sum, sale) => sum + sale.profit, 0);

  const lookupTerm = checkerLookup.trim().toLowerCase();
  const checkerLookupResults = lookupTerm
    ? ["wassce", "bece"].flatMap((key) =>
        (pool[key] || [])
          .filter((c) =>
            String(c.serial || "").toLowerCase().includes(lookupTerm) ||
            String(c.pin || "").toLowerCase().includes(lookupTerm)
          )
          .map((c) => {
            const type = key.toUpperCase();
            const linked = c.used ? findCheckerCustomer(type, c.serial) : null;
            return { ...c, type, linked };
          })
      )
    : [];

'''
    s = s.replace(filtered_anchor, calc + filtered_anchor, 1)

tabs_anchor = '''        <div style={S.tabs}>
          <button
            style={S.tab(tab === "deliver")}
'''
if 'style={S.tab(tab === "home")}' not in s:
    home_btn = '''        <div style={S.tabs}>
          <button
            style={S.tab(tab === "home")}
            onClick={() => setTab("home")}
          >
            🏠 HOME
          </button>

          <button
            style={S.tab(tab === "deliver")}
'''
    s = s.replace(tabs_anchor, home_btn, 1)

body_anchor = '''      <div style={S.body}>
        {tab === "deliver" && (
'''
if '{tab === "home" && (' not in s:
    dashboard = r'''      <div style={S.body}>
        {tab === "home" && (
          <>
            <div style={S.statGrid}>
              <div style={S.stat("#EEF2FF")}>
                <div style={{ ...S.statVal, color: "#0A1F5C" }}>{wLeft}</div>
                <div style={{ ...S.statLbl, color: "#0A1F5C" }}>WASSCE Available</div>
              </div>
              <div style={S.stat("#FFF7ED")}>
                <div style={{ ...S.statVal, color: "#C2410C" }}>{bLeft}</div>
                <div style={{ ...S.statLbl, color: "#C2410C" }}>BECE Available</div>
              </div>
              <div style={S.stat("#F0FDF4")}>
                <div style={{ ...S.statVal, color: "#16A34A" }}>{todaySold}</div>
                <div style={{ ...S.statLbl, color: "#16A34A" }}>Sold Today</div>
              </div>
              <div style={S.stat("#ECFDF5")}>
                <div style={{ ...S.statVal, color: "#059669", fontSize: 19 }}>GH¢{todayProfit.toFixed(2)}</div>
                <div style={{ ...S.statLbl, color: "#059669" }}>Today's Profit</div>
              </div>
            </div>

            {(wLeft <= lowStockThreshold || bLeft <= lowStockThreshold) && lowStockThreshold > 0 && (
              <div style={{ ...S.card, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                <div style={{ fontWeight: 900, color: "#9A3412", marginBottom: 6 }}>⚠️ Low Stock</div>
                <div style={{ fontSize: 13, color: "#9A3412", lineHeight: 1.7 }}>
                  {wLeft <= lowStockThreshold && <>WASSCE: {wLeft} remaining<br /></>}
                  {bLeft <= lowStockThreshold && <>BECE: {bLeft} remaining<br /></>}
                  Alert threshold: {lowStockThreshold}
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={S.goldBar} />
              <div style={S.secTitle}>📊 Today at a glance</div>
              <div style={S.histRow}><span style={S.hLabel}>Revenue today</span><span style={S.hAmt}>GH¢{todayRevenue.toFixed(2)}</span></div>
              <div style={S.histRow}><span style={S.hLabel}>Checkers sold today</span><span style={S.hAmt}>{todaySold}</span></div>
              <div style={{ ...S.histRow, borderBottom: "none" }}><span style={S.hLabel}>Total stock available</span><span style={S.hAmt}>{wLeft + bLeft}</span></div>
            </div>

            <div style={S.card}>
              <div style={S.goldBar} />
              <div style={S.secTitle}>🔎 Checker Lookup</div>
              <div style={S.searchBox}>
                <SearchIcon />
                <input style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, outline: "none", color: "#1A1A2E" }} placeholder="Enter serial number or PIN..." value={checkerLookup} onChange={(e) => setCheckerLookup(e.target.value)} />
              </div>
              {lookupTerm && checkerLookupResults.length === 0 && <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 10 }}>No checker found.</div>}
              {checkerLookupResults.slice(0, 20).map((c) => (
                <div key={`${c.type}-${c.serial}`} style={S.custCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div style={S.custName}>{c.serial}</div><span style={S.pill(c.used)}>{c.used ? "Used" : "Available"}</span></div>
                  <div style={S.custMeta}><b>{c.type}</b><br />PIN: <span style={{ fontFamily: "monospace" }}>{c.pin}</span>{c.used && (<><br />Customer: {c.linked?.name || c.manualCustomer || "Not linked"}<br />Used: {c.linked ? `${c.linked.date}${c.linked.time ? ` · ${c.linked.time}` : ""}` : c.manualDate || "Date not recorded"}</>)}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={S.goldBar} />
              <div style={S.secTitle}>⚙️ Settings</div>
              <label style={S.label}>Low-stock alert threshold</label>
              <select style={{ ...S.select, marginBottom: 14 }} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(Number(e.target.value))}>
                {[0, 2, 3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n === 0 ? "Off" : `${n} checkers`}</option>)}
              </select>
              <label style={S.label}>Auto-lock after inactivity</label>
              <select style={S.select} value={lockMinutes} onChange={(e) => setLockMinutes(Number(e.target.value))}>
                {[1, 5, 10, 15, 30].map(n => <option key={n} value={n}>{n} minute{n === 1 ? "" : "s"}</option>)}
              </select>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10, lineHeight: 1.5 }}>These settings are saved on this device.</div>
            </div>
          </>
        )}

        {tab === "deliver" && (
'''
    s = s.replace(body_anchor, dashboard, 1)

customer_meta_anchor = '''                    <div style={S.codeBox}>
                      {c.checkers?.map(
'''
if 'onClick={() => undoTransaction(c)}' not in s:
    undo_ui = r'''                    <button style={{ ...S.btnRed, width: "100%", marginTop: 10, padding: "10px 12px" }} onClick={() => undoTransaction(c)}>
                      ↩ Undo This Sale
                    </button>

                    <div style={S.codeBox}>
                      {c.checkers?.map(
'''
    s = s.replace(customer_meta_anchor, undo_ui, 1)

app.write_text(s)

html = Path("gls-checker/public/index.html")
h = html.read_text()
h = h.replace("grid-template-columns: repeat(4, 1fr)", "grid-template-columns: repeat(5, 1fr)")
h = h.replace('const names = ["DELIVER", "STOCK", "FINANCE", "CUSTOMERS"];', 'const names = ["HOME", "DELIVER", "STOCK", "FINANCE", "CUSTOMERS"];')
html.write_text(h)
