from pathlib import Path

p = Path('gls-checker/src/App.js')
s = p.read_text()

# Add finance period state.
anchor = '  const [search, setSearch] = useState("");\n'
if 'const [financePeriod, setFinancePeriod]' not in s:
    s = s.replace(anchor, anchor + '  const [financePeriod, setFinancePeriod] = useState("all");\n', 1)

# Improve customer search to include PIN.
old = '''    (\n      c.checkers &&\n      c.checkers.some(\n        ch =>\n          ch.serial.includes(search)\n      )\n    )\n  );\n'''
new = '''    (\n      c.checkers &&\n      c.checkers.some(\n        ch =>\n          String(ch.serial || "").toLowerCase().includes(search.toLowerCase()) ||\n          String(ch.pin || "").toLowerCase().includes(search.toLowerCase())\n      )\n    )\n  );\n'''
s = s.replace(old, new, 1)

# Add period helpers and history delivery helpers before exportCSV.
anchor = '  function exportCSV() {\n'
if 'const periodSales =' not in s:
    helpers = r'''  function saleDateValue(sale) {
    const parsed = Date.parse(sale.date || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const periodSales = sales.filter((sale) => {
    if (financePeriod === "all") return true;
    const ts = saleDateValue(sale);
    if (!ts) return false;
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (financePeriod === "today") return ts >= start.getTime();
    const days = financePeriod === "7d" ? 7 : 30;
    start.setDate(start.getDate() - (days - 1));
    return ts >= start.getTime();
  });

  const periodRevenue = periodSales.reduce((a, sale) => a + sale.price * sale.qty, 0);
  const periodProfit = periodSales.reduce((a, sale) => a + sale.profit, 0);
  const periodSold = periodSales.reduce((a, sale) => a + sale.qty, 0);

  function buildHistoryCodes(entry) {
    const groups = ["WASSCE", "BECE"]
      .map((type) => {
        const list = (entry.checkers || []).filter((ch) => ch.type === type);
        if (!list.length) return "";
        const lines = list.map((ch, i) =>
          `${list.length > 1 ? `Checker ${i + 1}\n` : ""}Serial: ${ch.serial}\nPIN: ${ch.pin}`
        ).join("\n\n");
        const portal = type === "WASSCE"
          ? "https://ghana.waecdirect.org/"
          : "https://eresults.waecgh.org";
        return `${type} RESULT CHECKER${list.length > 1 ? "S" : ""}\n${lines}\n\nCheck results at: ${portal}`;
      })
      .filter(Boolean);
    return `GRACE-LED SYSTEMS\n\nHello ${entry.name},\n\nHere ${entry.totalQty > 1 ? "are your checker details" : "is your checker detail"}:\n\n${groups.join("\n\n")}`;
  }

  function resendTransaction(entry) {
    openWhatsAppBusiness(buildHistoryCodes(entry), entry.phone || "");
  }

  async function copyTransactionCodes(entry) {
    try {
      await navigator.clipboard.writeText(buildHistoryCodes(entry));
      window.alert("Checker details copied.");
    } catch {
      window.alert("Could not copy the checker details on this device.");
    }
  }

  function exportPeriodSalesCSV() {
    const rows = [["Name", "Phone", "Type", "Qty", "Unit Price", "Revenue", "Profit", "Date", "Time"]];
    periodSales.forEach((sale) => {
      rows.push([
        sale.name,
        sale.phone || "",
        sale.type,
        sale.qty,
        sale.price,
        +(sale.price * sale.qty).toFixed(2),
        sale.profit,
        sale.date,
        sale.time,
      ]);
    });
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `GLS_Finance_${financePeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

'''
    s = s.replace(anchor, helpers + anchor, 1)

# Finance period report UI before Breakdown by Type card.
anchor = '''            <div style={S.card}>\n              <div style={S.goldBar} />\n\n              <div style={S.secTitle}>\n                Breakdown by Type\n              </div>\n'''
if 'Finance Period' not in s:
    ui = r'''            <div style={S.card}>
              <div style={S.goldBar} />
              <div style={S.secTitle}>📅 Finance Period</div>
              <select style={{ ...S.select, marginBottom: 14 }} value={financePeriod} onChange={(e) => setFinancePeriod(e.target.value)}>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
              <div style={S.statGrid}>
                <div style={S.stat("#EEF2FF")}><div style={{ ...S.statVal, color: "#0A1F5C", fontSize: 20 }}>{periodSold}</div><div style={{ ...S.statLbl, color: "#0A1F5C" }}>Sold</div></div>
                <div style={S.stat("#F0FDF4")}><div style={{ ...S.statVal, color: "#16A34A", fontSize: 18 }}>GH¢{periodRevenue.toFixed(2)}</div><div style={{ ...S.statLbl, color: "#16A34A" }}>Revenue</div></div>
                <div style={{ ...S.stat("#ECFDF5"), gridColumn: "1 / -1" }}><div style={{ ...S.statVal, color: "#059669", fontSize: 20 }}>GH¢{periodProfit.toFixed(2)}</div><div style={{ ...S.statLbl, color: "#059669" }}>Profit for selected period</div></div>
              </div>
              <button style={{ ...S.btnRed, width: "100%", padding: "10px 12px", color: "#0A1F5C", background: "#EEF2FF", borderColor: "#C7D2FE" }} onClick={exportPeriodSalesCSV} disabled={periodSales.length === 0}>
                ⬇ Export Selected Period
              </button>
            </div>

'''
    s = s.replace(anchor, ui + anchor, 1)

# Make sales log honor period selection.
s = s.replace('''                {[...sales]\n                  .reverse()\n''', '''                {[...periodSales]\n                  .reverse()\n''', 1)

# Rename sales log title to make filtering obvious.
s = s.replace('''                    🧾 Sales Log\n''', '''                    🧾 Sales Log · Selected Period\n''', 1)

# Customer placeholder includes PIN.
s = s.replace('placeholder="Search name, phone or serial..."', 'placeholder="Search name, phone, serial or PIN..."', 1)

# Add resend/copy controls before edit/undo buttons.
anchor = '''                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>\n                      <button\n                        style={{ ...S.btnRed, flex: 1, padding: "10px 12px", color: "#0A1F5C", background: "#EEF2FF", borderColor: "#C7D2FE" }}\n                        onClick={() => editTransaction(c)}\n'''
if 'Resend on WhatsApp' not in s and anchor in s:
    controls = r'''                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button
                        style={{ ...S.btnRed, flex: 1, minWidth: 135, padding: "10px 12px", color: "#065F46", background: "#ECFDF5", borderColor: "#A7F3D0" }}
                        onClick={() => resendTransaction(c)}
                      >
                        📲 Resend on WhatsApp
                      </button>
                      <button
                        style={{ ...S.btnRed, flex: 1, minWidth: 110, padding: "10px 12px", color: "#0A1F5C", background: "#F8FAFC", borderColor: "#CBD5E1" }}
                        onClick={() => copyTransactionCodes(c)}
                      >
                        📋 Copy Codes
                      </button>
                    </div>

'''
    s = s.replace(anchor, controls + anchor, 1)

p.write_text(s)
