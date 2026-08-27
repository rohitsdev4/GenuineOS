// ─── File generation engine: PDF docs (pdf-lib), Excel (exceljs), PPT (pptxgenjs)
// Produces base64 files ready for browser download or Telegram sendDocument.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import type { DocPayload, FileFormat, GeneratedFile, LineItem, PptxPayload, XlsxPayload } from '@/lib/types';

const INK = rgb(0.09, 0.13, 0.19); // slate-900-ish
const MUTED = rgb(0.42, 0.47, 0.55);
const ACCENT = rgb(0.02, 0.47, 0.34); // emerald-700
const ACCENT_SOFT = rgb(0.91, 0.96, 0.93);
const LINE = rgb(0.85, 0.88, 0.92);

const DOC_TITLES: Record<string, string> = { invoice: 'INVOICE', quotation: 'QUOTATION', estimate: 'ESTIMATE' };

// ── helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) =>
  'Rs. ' +
  (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const sanitize = (s: string) => s.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '-').slice(0, 40);

function defaultDocNumber(format: string) {
  const prefix = format === 'invoice' ? 'INV' : format === 'quotation' ? 'QUO' : 'EST';
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
}

function computeTotals(items: LineItem[], taxRate = 0, discount = 0) {
  const lines = (items || []).map((it) => ({
    ...it,
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
  }));
  const subtotal = lines.reduce((s, it) => s + it.qty * it.rate, 0);
  const discountAmt = Math.max(0, Number(discount) || 0);
  const taxable = Math.max(0, subtotal - discountAmt);
  const tax = (taxable * (Number(taxRate) || 0)) / 100;
  return { lines, subtotal, discountAmt, taxable, tax, total: taxable + tax };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

/** Indian numbering system words (crore / lakh / thousand). */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - n) * 100);
  if (n === 0 && paise === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  let out = parts.join(' ') + ' Rupees';
  if (paise > 0) out += ` and ${twoDigits(paise)} Paise`;
  return out + ' Only';
}

// ── PDF document (invoice / quotation / estimate) ────────────────────────────

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

async function buildDocPdf(format: string, raw: DocPayload): Promise<{ bytes: Uint8Array; summary: string }> {
  const p: DocPayload = {
    docNumber: raw.docNumber || defaultDocNumber(format),
    date: raw.date || new Date().toISOString().slice(0, 10),
    dueDays: raw.dueDays ?? 15,
    business: raw.business || { name: 'My Business' },
    client: raw.client || { name: 'Client' },
    items: Array.isArray(raw.items) && raw.items.length ? raw.items : [{ description: 'Professional services', qty: 1, rate: 0 }],
    taxRate: Number(raw.taxRate) || 0,
    discount: Number(raw.discount) || 0,
    notes: raw.notes || '',
  };
  const t = computeTotals(p.items, p.taxRate, p.discount);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${DOC_TITLES[format] ?? 'DOCUMENT'} ${p.docNumber}`);
  pdf.setAuthor('GenuineOS AI');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const W = 595.28;
  const M = 48; // margin

  // top accent band
  page.drawRectangle({ x: 0, y: 841.89 - 8, width: W, height: 8, color: ACCENT });

  // header — business (left)
  let y = 792;
  page.drawText(p.business.name || 'My Business', { x: M, y, size: 17, font: bold, color: INK });
  y -= 17;
  for (const line of [p.business.address, p.business.phone && `Phone: ${p.business.phone}`, p.business.email && `Email: ${p.business.email}`]) {
    if (!line) continue;
    page.drawText(String(line), { x: M, y, size: 9, font, color: MUTED });
    y -= 12;
  }

  // header — doc info (right)
  const title = DOC_TITLES[format] ?? 'DOCUMENT';
  const tw = bold.widthOfTextAtSize(title, 24);
  page.drawText(title, { x: W - M - tw, y: 792, size: 24, font: bold, color: ACCENT });
  const dueDate = new Date(new Date(p.date!).getTime() + (p.dueDays || 0) * 86400000).toISOString().slice(0, 10);
  const info: [string, string][] = [
    ['No.', p.docNumber!],
    ['Date', fmtDate(p.date!)],
    ...(format === 'invoice' ? ([['Due Date', fmtDate(dueDate)]] as [string, string][]) : []),
  ];
  let iy = 760;
  for (const [k, v] of info) {
    const kw = font.widthOfTextAtSize(`${k}: `, 9);
    const vw = font.widthOfTextAtSize(v, 9);
    page.drawText(`${k}: `, { x: W - M - kw - vw, y: iy, size: 9, font, color: MUTED });
    page.drawText(v, { x: W - M - vw, y: iy, size: 9, font: bold, color: INK });
    iy -= 13;
  }

  // billed to
  y = Math.min(y, iy) - 18;
  page.drawRectangle({ x: M, y: y - 66, width: 240, height: 78, color: ACCENT_SOFT });
  page.drawText(format === 'invoice' ? 'BILLED TO' : 'PREPARED FOR', { x: M + 10, y: y - 2, size: 8, font: bold, color: ACCENT });
  let by = y - 16;
  page.drawText(p.client.name || 'Client', { x: M + 10, y: by, size: 11, font: bold, color: INK });
  by -= 13;
  for (const line of [p.client.address, p.client.phone, p.client.email]) {
    if (!line) continue;
    for (const l of wrapText(String(line), font, 8.5, 215)) {
      page.drawText(l, { x: M + 10, y: by, size: 8.5, font, color: MUTED });
      by -= 11;
    }
  }

  // items table
  y = Math.min(y - 92, 620);
  const cols = { desc: M + 4, qty: 372, rate: 436, amt: 508 };
  const colW = { desc: 320, qty: 60, rate: 70, amt: 87 };
  const drawRowBg = (yy: number, h: number, color = ACCENT_SOFT) =>
    page.drawRectangle({ x: M, y: yy, width: W - 2 * M, height: h, color });
  const drawRowLines = (yy: number, h: number) => {
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.7, color: LINE });
  };

  // table head
  const headH = 24;
  drawRowBg(y - headH, headH, ACCENT);
  page.drawText('DESCRIPTION', { x: cols.desc, y: y - headH + 8, size: 8.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText('QTY', { x: cols.qty, y: y - headH + 8, size: 8.5, font: bold, color: rgb(1, 1, 1) });
  const rw = bold.widthOfTextAtSize('RATE', 8.5);
  page.drawText('RATE', { x: cols.rate + colW.rate - rw, y: y - headH + 8, size: 8.5, font: bold, color: rgb(1, 1, 1) });
  const aw = bold.widthOfTextAtSize('AMOUNT', 8.5);
  page.drawText('AMOUNT', { x: cols.amt + colW.amt - aw - 4, y: y - headH + 8, size: 8.5, font: bold, color: rgb(1, 1, 1) });
  y -= headH;
  drawRowLines(y, headH);

  // rows
  for (const it of t.lines) {
    const descLines = wrapText(it.description || '-', font, 9.5, colW.desc - 8);
    const rowH = Math.max(22, descLines.length * 12 + 10);
    if (y - rowH < 150) break; // single-page guard
    let ry = y - 15;
    for (const l of descLines) {
      page.drawText(l, { x: cols.desc, y: ry, size: 9.5, font, color: INK });
      ry -= 12;
    }
    page.drawText(String(it.qty), { x: cols.qty, y: y - 15, size: 9.5, font, color: INK });
    const rTxt = money(it.rate).replace('Rs. ', '');
    const rW = font.widthOfTextAtSize(rTxt, 9.5);
    page.drawText(rTxt, { x: cols.rate + colW.rate - rW, y: y - 15, size: 9.5, font, color: INK });
    const aTxt = money(it.qty * it.rate).replace('Rs. ', '');
    const aW = font.widthOfTextAtSize(aTxt, 9.5);
    page.drawText(aTxt, { x: cols.amt + colW.amt - aW - 4, y: y - 15, size: 9.5, font: bold, color: INK });
    y -= rowH;
    drawRowLines(y, rowH);
  }

  // totals block (right)
  y -= 16;
  const totalRows: [string, string, boolean][] = [
    ['Subtotal', money(t.subtotal), false],
    ...(t.discountAmt > 0 ? ([['Discount', `- ${money(t.discountAmt)}`, false]] as [string, string, boolean][]) : []),
    ...(t.tax > 0 ? ([[`GST (${p.taxRate}%)`, money(t.tax), false]] as [string, string, boolean][]) : []),
    ['TOTAL PAYABLE', money(t.total), true],
  ];
  for (const [k, v, isTotal] of totalRows) {
    const vw = (isTotal ? bold : font).widthOfTextAtSize(v, isTotal ? 11 : 9.5);
    page.drawText(k, { x: W - M - 200, y, size: isTotal ? 11 : 9.5, font: isTotal ? bold : font, color: isTotal ? INK : MUTED });
    page.drawText(v, { x: W - M - vw, y, size: isTotal ? 11 : 9.5, font: isTotal ? bold : font, color: isTotal ? ACCENT : INK });
    if (isTotal) page.drawLine({ start: { x: W - M - 200, y: y + 14 }, end: { x: W - M, y: y + 14 }, thickness: 1, color: ACCENT });
    y -= isTotal ? 18 : 15;
  }

  // amount in words
  y -= 6;
  const wordsLines = wrapText(`Amount in words: ${amountInWords(t.total)}`, font, 9, W - 2 * M);
  for (const l of wordsLines) {
    page.drawText(l, { x: M, y, size: 9, font, color: MUTED });
    y -= 12;
  }

  // notes
  if (p.notes) {
    y -= 8;
    for (const l of wrapText(`Notes: ${p.notes}`, font, 8.5, W - 2 * M)) {
      page.drawText(l, { x: M, y, size: 8.5, font, color: MUTED });
      y -= 11;
    }
  }

  // footer
  page.drawLine({ start: { x: M, y: 70 }, end: { x: W - M, y: 70 }, thickness: 0.7, color: LINE });
  page.drawText('Generated by GenuineOS AI', {
    x: M, y: 56, size: 8, font, color: MUTED,
  });
  page.drawText(`${DOC_TITLES[format]} ${p.docNumber}`, { x: W - M - bold.widthOfTextAtSize(`${DOC_TITLES[format]} ${p.docNumber}`, 8), y: 56, size: 8, font: bold, color: MUTED });

  const bytes = await pdf.save();
  const summary = `${title} ${p.docNumber} — ${p.client.name} — ${t.lines.length} items — Total ${money(t.total)} (incl. GST ${money(t.tax)})`;
  return { bytes, summary };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Excel workbook ───────────────────────────────────────────────────────────

async function buildXlsx(raw: XlsxPayload): Promise<{ bytes: Uint8Array; summary: string }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenuineOS AI';
  const sheets = raw.sheets?.length ? raw.sheets : [{ name: 'Sheet1', headers: ['A', 'B'], rows: [] }];
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name?.slice(0, 31) || `Sheet${wb.worksheets.length + 1}`);
    if (s.headers?.length) {
      const header = ws.addRow(s.headers);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      });
      header.height = 22;
    }
    for (const row of s.rows || []) {
      const added = ws.addRow(row);
      added.eachCell((cell) => {
        cell.border = {
          top: { style: 'hair' }, bottom: { style: 'hair' },
          left: { style: 'hair' }, right: { style: 'hair' },
        };
        if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
      });
    }
    // auto column widths
    const widths: number[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const len = String(cell.value ?? '').length + 3;
        widths[col] = Math.min(42, Math.max(widths[col] || 10, len));
      });
    });
    widths.forEach((w, i) => {
      if (w) ws.getColumn(i).width = w;
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = s.headers?.length ? { from: { row: 1, column: 1 }, to: { row: 1, column: s.headers.length } } : undefined;
  }
  const buffer = await wb.xlsx.writeBuffer();
  const summary = `Excel workbook — ${sheets.length} sheet(s): ${sheets.map((s) => s.name).join(', ')}`;
  return { bytes: new Uint8Array(buffer), summary };
}

// ── PowerPoint deck ──────────────────────────────────────────────────────────

async function buildPptx(raw: PptxPayload): Promise<{ bytes: Uint8Array; summary: string }> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';
  pptx.author = 'GenuineOS AI';
  pptx.title = raw.title || 'Presentation';

  const BG = '0B1220';
  const ACCENT_HEX = '10B981';
  const INK_HEX = 'F8FAFC';
  const MUTED_HEX = '94A3B8';

  // title slide
  const title = pptx.addSlide();
  title.background = { color: BG };
  title.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.14, fill: { color: ACCENT_HEX } });
  title.addText(raw.title || 'Presentation', {
    x: 0.8, y: 2.4, w: 11.7, h: 1.6, fontSize: 44, bold: true, color: INK_HEX, fontFace: 'Arial',
  });
  title.addText(raw.subtitle || 'Generated by GenuineOS AI', {
    x: 0.85, y: 4.0, w: 11, h: 0.7, fontSize: 18, color: ACCENT_HEX, fontFace: 'Arial',
  });

  for (const s of raw.slides || []) {
    const slide = pptx.addSlide();
    slide.background = { color: BG };
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.14, fill: { color: ACCENT_HEX } });
    slide.addText(s.title || '', {
      x: 0.8, y: 0.55, w: 11.7, h: 0.9, fontSize: 30, bold: true, color: INK_HEX, fontFace: 'Arial',
    });
    const bullets = (s.bullets || []).map((b) => ({
      text: String(b),
      options: { bullet: { characterCode: '25CF' }, color: INK_HEX, fontSize: 17, breakLine: true },
    }));
    if (bullets.length) {
      slide.addText(bullets, {
        x: 1.0, y: 1.8, w: 11.3, h: 4.9, fontSize: 17, color: INK_HEX, lineSpacingMultiple: 1.4, fontFace: 'Arial',
      });
    }
    slide.addText(`${raw.title || ''}`, {
      x: 0.8, y: 6.95, w: 6, h: 0.4, fontSize: 10, color: MUTED_HEX, fontFace: 'Arial',
    });
  }

  const base64 = (await pptx.write({ outputType: 'base64' })) as string;
  const summary = `PowerPoint deck — 1 title + ${(raw.slides || []).length} content slides`;
  return { bytes: base64ToBytes(base64), summary };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin);
}

// ── public entry ─────────────────────────────────────────────────────────────

export async function generateFile(
  format: FileFormat,
  payload: unknown
): Promise<GeneratedFile> {
  if (format === 'invoice' || format === 'quotation' || format === 'estimate') {
    const { bytes, summary } = await buildDocPdf(format, payload as DocPayload);
    const p = payload as DocPayload;
    const name = `${(p.docNumber || defaultDocNumber(format))}-${sanitize(p.client?.name || 'client')}.pdf`;
    return { filename: name, mime: 'application/pdf', base64: Buffer.from(bytes).toString('base64'), summary };
  }
  if (format === 'xlsx') {
    const { bytes, summary } = await buildXlsx(payload as XlsxPayload);
    const name = `${sanitize((payload as XlsxPayload).fileName || 'workbook')}.xlsx`;
    return {
      filename: name,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Buffer.from(bytes).toString('base64'),
      summary,
    };
  }
  if (format === 'pptx') {
    const { bytes, summary } = await buildPptx(payload as PptxPayload);
    const name = `${sanitize((payload as PptxPayload).title || 'deck')}.pptx`;
    return {
      filename: name,
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      base64: Buffer.from(bytes).toString('base64'),
      summary,
    };
  }
  throw new Error(`Unknown format: ${format}`);
}
