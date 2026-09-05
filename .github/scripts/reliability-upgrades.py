from pathlib import Path

app = Path("gls-checker/src/App.js")
s = app.read_text()

# 1) Strengthen PDF parsing while keeping text-based retailer PDFs fast.
start = s.index("async function parseCheckerPDF(file) {")
end = s.index("\nconst Icon =", start)
new_pdf = r'''async function parseCheckerPDF(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => String(item.str || "").trim())
      .filter(Boolean);
    pages.push(items.join("\n"));
  }

  const text = pages.join("\n");
  const detectedType = /\bBECE\b/i.test(text)
    ? "BECE"
    : /\bWASSCE\b/i.test(text)
      ? "WASSCE"
      : null;

  const codes = [];
  const seen = new Set();
  const patterns = [
    /Serial(?:\s+Number)?\s*[:#-]?\s*([A-Z]{2,6}[A-Z0-9-]{5,40})[\s\S]{0,180}?PIN\s*[:#-]?\s*([0-9]{6,20})/gi,
    /([A-Z]{2,6}[A-Z0-9-]{5,40})[\s\S]{0,80}?PIN\s*[:#-]?\s*([0-9]{6,20})/gi,
  ];

  patterns.forEach((regex) => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const serial = match[1].trim().toUpperCase();
      const pin = match[2].trim();
      const key = `${serial}|${pin}`;
      if (!seen.has(key)) {
        seen.add(key);
        codes.push({ serial, pin, used: false });
      }
    }
  });

  // Fallback for PDFs that split labels/values across separate text items.
  if (codes.length === 0) {
    const serials = [...text.matchAll(/(?:Serial(?:\s+Number)?\s*[:#-]?\s*)?([A-Z]{2,6}[A-Z0-9-]{5,40})/gi)]
      .map((m) => m[1].trim().toUpperCase())
      .filter((v) => /\d/.test(v));
    const pins = [...text.matchAll(/PIN\s*[:#-]?\s*([0-9]{6,20})/gi)].map((m) => m[1].trim());
    const count = Math.min(serials.length, pins.length);
    for (let i = 0; i < count; i += 1) {
      const key = `${serials[i]}|${pins[i]}`;
      if (!seen.has(key)) {
        seen.add(key);
        codes.push({ serial: serials[i], pin: pins[i], used: false });
      }
    }
  }

  return { codes, detectedType };
}
'''
s = s[:start] + new_pdf + s[end:]

# 2) Add backup/notification state.
anchor = '  const fileRef = useRef();\n'
if 'const backupRef = useRef();' not in s:
    s = s.replace(anchor, anchor + '  const backupRef = useRef();\n  const lowStockNoticeRef = useRef("");\n', 1)

anchor = '  const [lockMinutes, setLockMinutes] = useState(() => {\n'
if 'const [lowStockNotifications, setLowStockNotifications]' not in s:
    pos = s.index(anchor)
    endpos = s.index('  });\n', pos) + len('  });\n')
    extra = r'''
  const [lowStockNotifications, setLowStockNotifications] = useState(() =>
    localStorage.getItem("gls_low_stock_notifications") === "true"
  );
'''
    s = s[:endpos] + extra + s[endpos:]

anchor = '  useEffect(() => {\n    localStorage.setItem("gls_lock_minutes", String(lockMinutes));\n  }, [lockMinutes]);\n'
if 'gls_low_stock_notifications' not in s[s.index(anchor):s.index(anchor)+1200]:
    extra = r'''

  useEffect(() => {
    localStorage.setItem("gls_low_stock_notifications", String(lowStockNotifications));
  }, [lowStockNotifications]);
'''
    s = s.replace(anchor, anchor + extra, 1)

# 3) Add browser low-stock notifications.
load_anchor = '  // ── LOAD DATA FROM FIRESTORE ──────────────────────────\n'
if 'Low stock: ' not in s:
    effect = r'''  useEffect(() => {
    if (!loaded || !lowStockNotifications || lowStockThreshold <= 0) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const low = [];
    if (wLeft <= lowStockThreshold) low.push(`WASSCE ${wLeft}`);
    if (bLeft <= lowStockThreshold) low.push(`BECE ${bLeft}`);
    const key = low.join("|");

    if (key && key !== lowStockNoticeRef.current) {
      new Notification("GLS Checker — Low stock", {
        body: `Low stock: ${low.join(", ")}.`,
        icon: "/icon-192.png",
      });
      lowStockNoticeRef.current = key;
    }
    if (!key) lowStockNoticeRef.current = "";
  }, [loaded, lowStockNotifications, lowStockThreshold, wLeft, bLeft]);

'''
    s = s.replace(load_anchor, effect + load_anchor, 1)

# 4) Duplicate protection by BOTH serial and PIN for imported files.
old = '''      const allExistingSerials = new Set([\n        ...(pool.wassce || []).map((c) => c.serial.toUpperCase()),\n        ...(pool.bece || []).map((c) => c.serial.toUpperCase()),\n      ]);\n      const seen = new Set();\n'''
new = '''      const allExistingSerials = new Set([\n        ...(pool.wassce || []).map((c) => c.serial.toUpperCase()),\n        ...(pool.bece || []).map((c) => c.serial.toUpperCase()),\n      ]);\n      const allExistingPins = new Set([\n        ...(pool.wassce || []).map((c) => String(c.pin || "").trim()),\n        ...(pool.bece || []).map((c) => String(c.pin || "").trim()),\n      ]);\n      const seen = new Set();\n      const seenPins = new Set();\n'''
s = s.replace(old, new, 1)
s = s.replace('''        if (seen.has(serial) || allExistingSerials.has(serial)) {\n          duplicates += 1;\n          return;\n        }\n\n        seen.add(serial);\n        valid.push({ serial, pin, used: false });\n''', '''        if (\n          seen.has(serial) ||\n          seenPins.has(pin) ||\n          allExistingSerials.has(serial) ||\n          allExistingPins.has(pin)\n        ) {\n          duplicates += 1;\n          return;\n        }\n\n        seen.add(serial);\n        seenPins.add(pin);\n        valid.push({ serial, pin, used: false });\n''', 1)

# 5) Add full backup/restore and transaction editing before finance section.
finance_anchor = '  // ── FINANCE / SEARCH ───────────────────────────────────\n'
if 'function exportBackup()' not in s:
    helpers = r'''  function exportBackup() {
    const backup = {
      app: "GLS Checker",
      version: 1,
      exportedAt: new Date().toISOString(),
      pool,
      customers,
      sales,
      settings: {
        lowStockThreshold,
        lockMinutes,
        lowStockNotifications,
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `GLS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validPool = parsed && parsed.pool && Array.isArray(parsed.pool.wassce) && Array.isArray(parsed.pool.bece);
      const validCustomers = Array.isArray(parsed?.customers);
      const validSales = Array.isArray(parsed?.sales);
      if (!validPool || !validCustomers || !validSales) {
        window.alert("This is not a valid GLS Checker backup file.");
        return;
      }

      const ok = window.confirm(
        `Restore this backup?\n\nWASSCE stock: ${parsed.pool.wassce.length}\nBECE stock: ${parsed.pool.bece.length}\nCustomer transactions: ${parsed.customers.length}\nSales records: ${parsed.sales.length}\n\nThis will replace the current app data.`
      );
      if (!ok) return;

      setSyncing(true);
      await Promise.all([
        saveData("pool", parsed.pool),
        saveData("customers", parsed.customers),
        saveData("sales", parsed.sales),
      ]);
      setPool(parsed.pool);
      setCustomers(parsed.customers);
      setSales(parsed.sales);

      if (parsed.settings) {
        if (Number.isFinite(Number(parsed.settings.lowStockThreshold))) {
          setLowStockThreshold(Number(parsed.settings.lowStockThreshold));
        }
        if ([1, 5, 10, 15, 30].includes(Number(parsed.settings.lockMinutes))) {
          setLockMinutes(Number(parsed.settings.lockMinutes));
        }
        if (typeof parsed.settings.lowStockNotifications === "boolean") {
          setLowStockNotifications(parsed.settings.lowStockNotifications);
        }
      }

      setSyncing(false);
      window.alert("Backup restored successfully.");
    } catch (error) {
      console.error(error);
      setSyncing(false);
      window.alert("Could not restore this backup file.");
    }
  }

  async function editTransaction(entry) {
    const nameInput = window.prompt("Edit customer name:", entry.name || "");
    if (nameInput === null) return;
    const phoneInput = window.prompt("Edit phone number:", entry.phone || "");
    if (phoneInput === null) return;
    const amountInput = window.prompt("Edit total amount paid (GH¢):", String(entry.totalPrice ?? ""));
    if (amountInput === null) return;

    const name = nameInput.trim();
    const phone = phoneInput.trim();
    const totalPrice = Number(amountInput);
    if (!name || !phone || !Number.isFinite(totalPrice) || totalPrice < 0) {
      window.alert("Please enter a valid name, phone number and total amount.");
      return;
    }

    const unitPrice = entry.totalQty > 0 ? totalPrice / entry.totalQty : SELL;
    const newCustomers = customers.map((c) =>
      c.id === entry.id ? { ...c, name, phone, totalPrice: +totalPrice.toFixed(2) } : c
    );
    const isLegacyMatch = (sale) =>
      !sale.transactionId &&
      sale.name === entry.name &&
      (sale.phone || "") === (entry.phone || "") &&
      sale.date === entry.date &&
      sale.time === entry.time;
    const newSales = sales.map((sale) => {
      const matches = sale.transactionId ? sale.transactionId === entry.id : isLegacyMatch(sale);
      if (!matches) return sale;
      const price = +unitPrice.toFixed(2);
      return {
        ...sale,
        name,
        phone,
        price,
        profit: +((price - sale.cost) * sale.qty).toFixed(2),
      };
    });

    setCustomers(newCustomers);
    setSales(newSales);
    setSyncing(true);
    await Promise.all([saveData("customers", newCustomers), saveData("sales", newSales)]);
    setSyncing(false);
    window.alert("Transaction updated.");
  }

  async function enableLowStockNotifications() {
    if (!("Notification" in window)) {
      window.alert("Notifications are not supported on this device/browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setLowStockNotifications(true);
      window.alert("Low-stock notifications enabled.");
    } else {
      setLowStockNotifications(false);
      window.alert("Notification permission was not granted.");
    }
  }

'''
    s = s.replace(finance_anchor, helpers + finance_anchor, 1)

# 6) Add Backup/Restore + notifications to Settings card.
settings_anchor = '''              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10, lineHeight: 1.5 }}>These settings are saved on this device.</div>\n'''
if 'Download Full Backup' not in s:
    settings_ui = r'''              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10, lineHeight: 1.5 }}>These settings are saved on this device.</div>

              <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 16, paddingTop: 16 }}>
                <label style={S.label}>Low-stock notifications</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button
                    style={{ ...S.btnRed, flex: 1, color: "#0A1F5C", background: "#EEF2FF", borderColor: "#C7D2FE" }}
                    onClick={enableLowStockNotifications}
                  >
                    {lowStockNotifications ? "✓ Notifications On" : "Enable Notifications"}
                  </button>
                  {lowStockNotifications && (
                    <button style={S.btnRed} onClick={() => setLowStockNotifications(false)}>Turn Off</button>
                  )}
                </div>

                <label style={S.label}>Backup & Restore</label>
                <button style={{ ...S.btnGold, marginBottom: 8 }} onClick={exportBackup}>⬇ Download Full Backup</button>
                <button
                  style={{ ...S.btnRed, width: "100%", padding: "11px 12px", color: "#0A1F5C", background: "#EEF2FF", borderColor: "#C7D2FE" }}
                  onClick={() => backupRef.current?.click()}
                >
                  ⬆ Restore Backup
                </button>
                <input
                  ref={backupRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    importBackup(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 8, lineHeight: 1.5 }}>
                  Backup includes stock, customers, sales and these device settings. Restoring replaces current app data only after confirmation.
                </div>
              </div>
'''
    s = s.replace(settings_anchor, settings_ui, 1)

# 7) Add Edit Transaction button beside Undo.
old_btn = '''                    <button style={{ ...S.btnRed, width: "100%", marginTop: 10, padding: "10px 12px" }} onClick={() => undoTransaction(c)}>\n                      ↩ Undo This Sale\n                    </button>\n'''
if 'Edit Transaction' not in s:
    new_btn = r'''                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        style={{ ...S.btnRed, flex: 1, padding: "10px 12px", color: "#0A1F5C", background: "#EEF2FF", borderColor: "#C7D2FE" }}
                        onClick={() => editTransaction(c)}
                      >
                        ✏️ Edit Transaction
                      </button>
                      <button style={{ ...S.btnRed, flex: 1, padding: "10px 12px" }} onClick={() => undoTransaction(c)}>
                        ↩ Undo Sale
                      </button>
                    </div>
'''
    s = s.replace(old_btn, new_btn, 1)

app.write_text(s)
