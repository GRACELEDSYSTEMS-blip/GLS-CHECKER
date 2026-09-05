from pathlib import Path
p=Path('gls-checker/src/App.js')
s=p.read_text()
block='''  useEffect(() => {\n    if (!loaded || !lowStockNotifications || lowStockThreshold <= 0) return;\n    if (!("Notification" in window) || Notification.permission !== "granted") return;\n\n    const low = [];\n    if (wLeft <= lowStockThreshold) low.push(`WASSCE ${wLeft}`);\n    if (bLeft <= lowStockThreshold) low.push(`BECE ${bLeft}`);\n    const key = low.join("|");\n\n    if (key && key !== lowStockNoticeRef.current) {\n      new Notification("GLS Checker — Low stock", {\n        body: `Low stock: ${low.join(", ")}.`,\n        icon: "/icon-192.png",\n      });\n      lowStockNoticeRef.current = key;\n    }\n    if (!key) lowStockNoticeRef.current = "";\n  }, [loaded, lowStockNotifications, lowStockThreshold, wLeft, bLeft]);\n\n'''
if block in s:
    s=s.replace(block,'',1)
    anchor='''  const wLeft = pool.wassce.filter((c) => !c.used).length;\n  const bLeft = pool.bece.filter((c) => !c.used).length;\n'''
    s=s.replace(anchor,anchor+'\n'+block,1)
p.write_text(s)
