import * as pdfjsLib from "pdfjs-dist/build/pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.entry";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function normalizeText(items) {
  return items.map((item) => item.str || "").join("\n");
}

export async function parseCheckerPDF(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  let text = "";

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    text += `\n${normalizeText(content.items)}`;
  }

  const compact = text.replace(/\s+/g, " ");
  const type = /\bBECE\b/i.test(compact) && !/\bWASSCE\b/i.test(compact)
    ? "BECE"
    : /\bWASSCE\b/i.test(compact) && !/\bBECE\b/i.test(compact)
      ? "WASSCE"
      : null;

  const pairPattern = /Serial\s*:\s*([A-Z0-9-]+)[\s\S]{0,120}?PIN\s*:\s*([0-9]{6,20})/gi;
  const codes = [];
  const seen = new Set();
  let match;

  while ((match = pairPattern.exec(text)) !== null) {
    const serial = match[1].trim();
    const pin = match[2].trim();
    const key = `${serial}|${pin}`;
    if (!seen.has(key)) {
      seen.add(key);
      codes.push({ serial, pin, used: false });
    }
  }

  // Some PDF generators separate text objects in unusual ways. Retry on compact text.
  if (codes.length === 0) {
    pairPattern.lastIndex = 0;
    while ((match = pairPattern.exec(compact)) !== null) {
      const serial = match[1].trim();
      const pin = match[2].trim();
      const key = `${serial}|${pin}`;
      if (!seen.has(key)) {
        seen.add(key);
        codes.push({ serial, pin, used: false });
      }
    }
  }

  return { codes, detectedType: type, pages: pdf.numPages };
}
