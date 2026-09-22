import JsBarcode from "jsbarcode";

/* ── Sheet (Avery) specs — inches on US Letter (8.5 × 11) ──────────────────── */
export interface SheetSpec {
  id: string;
  name: string;
  cols: number;
  rows: number;
  labelW: number;
  labelH: number;
  marginTop: number;
  marginLeft: number;
  pitchX: number; // column-to-column distance
  pitchY: number; // row-to-row distance
}

export const PAGE_W = 8.5;
export const PAGE_H = 11;

export const SHEETS: SheetSpec[] = [
  { id: "5160", name: 'Avery 5160 — 1" × 2⅝" · 30 per sheet', cols: 3, rows: 10, labelW: 2.625, labelH: 1, marginTop: 0.5, marginLeft: 0.1875, pitchX: 2.75, pitchY: 1 },
  { id: "5195", name: 'Avery 5195 — ⅔" × 1¾" · 60 per sheet', cols: 4, rows: 15, labelW: 1.75, labelH: 0.6667, marginTop: 0.5, marginLeft: 0.28125, pitchX: 2.0625, pitchY: 0.6667 },
];

/* ── Roll / single-label printer sizes (inches) ────────────────────────────── */
export interface RollSpec { id: string; name: string; w: number; h: number }

export const ROLLS: RollSpec[] = [
  { id: "dymo30252", name: 'Dymo 30252 Address — 1⅛" × 3½"', w: 3.5, h: 1.125 },
  { id: "dymo30336", name: 'Dymo 30336 — 1" × 2⅛"', w: 2.125, h: 1 },
  { id: "dymo30299", name: 'Dymo 30299 Jewelry — ¾" × 2³⁄₁₆"', w: 2.1875, h: 0.75 },
  { id: "z2x1", name: '2" × 1"', w: 2, h: 1 },
  { id: "z3x2", name: '3" × 2"', w: 3, h: 2 },
  { id: "custom", name: "Custom size", w: 2, h: 1 },
];

export interface LabelData {
  title: string;
  value: string; // barcode value
  price?: string;
  vendorId?: string;
  message?: string; // optional custom message printed across the bottom
}

/* ── Saved label defaults — written by the print dialogs, read back to pre-select next time ─── */
export const LABEL_KEYS = {
  mode: "rustic-halo-label-mode",
  sheet: "rustic-halo-label-sheet",
  roll: "rustic-halo-label-roll",
  customW: "rustic-halo-label-custom-w",
  customH: "rustic-halo-label-custom-h",
  orientation: "rustic-halo-label-orientation",
  message: "rustic-halo-label-message",
  invPrefix: "rustic-halo-label-inv-prefix",
} as const;

export interface LabelDefaults {
  mode: "sheet" | "roll";
  sheetId: string;
  rollId: string;
  customW: string;
  customH: string;
  orientation: "landscape" | "portrait";
  /** Optional custom message printed across the bottom of every label. */
  message: string;
  /** Print AntiqueSoft-compatible barcode values such as INV123456789. */
  invPrefix: boolean;
}

const BASE_DEFAULTS: Omit<LabelDefaults, "message" | "invPrefix"> = {
  mode: "sheet",
  sheetId: "5160",
  rollId: "dymo30252",
  customW: "2",
  customH: "1",
  orientation: "landscape",
};

/** The custom label message (printed across the bottom of every label). */
export function getLabelMessage(): string {
  try {
    return localStorage.getItem(LABEL_KEYS.message) ?? "";
  } catch {
    return "";
  }
}

/** The saved defaults the print dialogs seed from (last choices, or the base format). */
export function getLabelDefaults(): LabelDefaults {
  const g = (k: string, d: string) => {
    try {
      return localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  };
  return {
    mode: g(LABEL_KEYS.mode, BASE_DEFAULTS.mode) === "roll" ? "roll" : "sheet",
    sheetId: g(LABEL_KEYS.sheet, BASE_DEFAULTS.sheetId),
    rollId: g(LABEL_KEYS.roll, BASE_DEFAULTS.rollId),
    customW: g(LABEL_KEYS.customW, BASE_DEFAULTS.customW),
    customH: g(LABEL_KEYS.customH, BASE_DEFAULTS.customH),
    orientation: g(LABEL_KEYS.orientation, BASE_DEFAULTS.orientation) === "portrait" ? "portrait" : "landscape",
    message: getLabelMessage(),
    invPrefix: g(LABEL_KEYS.invPrefix, "false") === "true",
  };
}

export function setLabelDefault(key: keyof typeof LABEL_KEYS, value: string) {
  try {
    localStorage.setItem(LABEL_KEYS[key], value);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Barcode PNG plus its pixel dimensions (the dims let the PDF renderer keep the aspect ratio).
 *  `withText` bakes the human-readable number under the bars (portrait layout); the horizontal
 *  layout passes false and renders the number itself so price/vendor can flank it on one line. */
export function makeBarcode(value: string, withText = true): { url: string; w: number; h: number } | null {
  if (!value) return null;
  try {
    const canvas = document.createElement("canvas");
    // Bar height 70 balances "fills the width" against "leaves a little vertical padding".
    JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 70, displayValue: withText, fontSize: 16, textMargin: 1, margin: 0 });
    return { url: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

export function makeBarcodeDataUrl(value: string, withText = true): string | null {
  return makeBarcode(value, withText)?.url ?? null;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Format a price string for the label ("12" → "12.00"); leaves non-numeric values as-is. */
export function fmtPrice(p?: string): string {
  if (!p) return "";
  const n = Number(p);
  return Number.isFinite(n) ? n.toFixed(2) : p;
}

/** Prefix an AntiqueSoft stock id when that source specifically requires INV. */
export function withInvPrefix(value: string): string {
  if (!value) return value;
  return /^INV/i.test(value) ? value : `INV${value}`;
}

/** One barcode PNG per distinct value (shared across repeats). */
function barcodeUrlMap(labels: LabelData[], withText: boolean): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const l of labels) if (!m.has(l.value)) m.set(l.value, makeBarcodeDataUrl(l.value, withText));
  return m;
}

const jobHasPrice = (labels: LabelData[]) => labels.some((l) => !!l.price);
const jobHasBottom = (labels: LabelData[]) => labels.some((l) => !!l.message?.trim() || !!l.vendorId);

/** Max price font (pt) and right-strip width (in) for a label height; shared by print + preview. */
export function priceSideMetrics(heightIn: number): { maxFontPt: number; stripWidthIn: number } {
  const maxFontPt = Math.max(10, Math.min(24, heightIn * 20));
  return { maxFontPt, stripWidthIn: (maxFontPt / 72) * 1.55 };
}

/** Reserved height (in) for the bottom row (message + vendor id). */
const BOTTOM_ROW_IN = 0.2;

/** Auto-fit the rotated price font so even a long price (e.g. "$1000.00") fits the price strip. */
export function priceFontPt(heightIn: number, priceStr: string): number {
  const { maxFontPt } = priceSideMetrics(heightIn);
  const chars = Math.max(1, priceStr.length);
  const availIn = Math.max(0.2, heightIn - BOTTOM_ROW_IN - 0.06); // strip height the rotated text runs through
  const fitByLength = (availIn * 72) / (chars * 0.6); // ~0.6em average glyph advance
  return Math.max(7, Math.min(maxFontPt, fitByLength));
}

/** Layout B (price in a horizontal bottom band) suits landscape labels; portrait keeps the
 *  rotated price up the right edge, where vertical space is the only space to spend. */
export const isHorizontalLabel = (w: number, h: number) => w >= h;

/** Font sizes (pt) + row heights (in) for the horizontal layout, by label height.
 *  Price + vendor sit on the barcode-number line; the message gets its own full-width row. */
export function horizontalLabelMetrics(h: number): { sideFont: number; numFont: number; numRowIn: number; msgRowIn: number } {
  const sideFont = Math.min(15, Math.max(9, h * 12)); // price + vendor, flanking the number
  const numFont = Math.min(9, Math.max(6.5, h * 8)); // the barcode number itself
  return { sideFont, numFont, numRowIn: Math.max(sideFont, numFont) / 72 + 0.05, msgRowIn: 6.5 / 72 + 0.05 };
}

let _measureCanvas: HTMLCanvasElement | null = null;
/** Approx rendered text width in inches at a given point size (96-dpi reference). */
function textWidthIn(text: string, fontPt: number, bold: boolean, mono: boolean): number {
  if (!text) return 0;
  try {
    _measureCanvas ??= document.createElement("canvas");
    const ctx = _measureCanvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.font = `${bold ? "bold " : ""}${((fontPt * 96) / 72).toFixed(1)}px ${mono ? '"Courier New", monospace' : "Arial, Helvetica, sans-serif"}`;
    return ctx.measureText(text).width / 96;
  } catch {
    return (text.length * fontPt * 0.55) / 72; // rough fallback if canvas is unavailable
  }
}

/** Shrink the vendor/number/price fonts together so all three fit on one line within `availIn`. */
export function fitMidrowFonts(value: string, priceStr: string, vendorStr: string, availIn: number, numFont: number, sideFont: number): { numFont: number; sideFont: number } {
  const gaps = 0.12; // breathing room between the three items (doesn't scale with font)
  const textOnly =
    textWidthIn(vendorStr, sideFont, true, false) +
    textWidthIn(value, numFont, false, true) +
    textWidthIn(priceStr, sideFont, true, false);
  if (textOnly + gaps <= availIn) return { numFont, sideFont };
  const scale = Math.max(0.5, (availIn - gaps) / textOnly);
  return { numFont: numFont * scale, sideFont: sideFont * scale };
}

export function labelInnerHtml(label: LabelData, barcodeUrl: string | null, showTitle: boolean, widthIn: number, heightIn: number): string {
  const title = showTitle && label.title ? `<div class="ttl">${escapeHtml(label.title)}</div>` : "";
  const bc = barcodeUrl ? `<img class="bc" src="${barcodeUrl}" />` : `<div class="nobc">No barcode</div>`;
  const priceStr = label.price ? `$${fmtPrice(label.price)}` : "";
  const msgTxt = label.message?.trim();

  if (isHorizontalLabel(widthIn, heightIn)) {
    // Layout B: full-width barcode; vendor and price flank the number on one line, freeing the
    // whole bottom row for the message. Fonts auto-shrink if the three don't fit the width.
    const m = horizontalLabelMetrics(heightIn);
    const vendorStr = label.vendorId ? `V#${label.vendorId}` : "";
    const fit = fitMidrowFonts(label.value, priceStr, vendorStr, widthIn - 0.12, m.numFont, m.sideFont);
    const price = priceStr ? `<span class="price" style="font-size:${fit.sideFont.toFixed(1)}pt">${escapeHtml(priceStr)}</span>` : "<span></span>";
    const num = `<span class="num" style="font-size:${fit.numFont.toFixed(1)}pt">${escapeHtml(label.value)}</span>`;
    const vendor = vendorStr ? `<span class="vendor" style="font-size:${fit.sideFont.toFixed(1)}pt">${escapeHtml(vendorStr)}</span>` : "<span></span>";
    const midrow = `<div class="midrow">${vendor}${num}${price}</div>`;
    const msgrow = msgTxt ? `<div class="msgrow">${escapeHtml(msgTxt)}</div>` : "";
    return `${title}${bc}${midrow}${msgrow}`;
  }

  // Portrait: rotated price strip on the right, message + vendor along the bottom.
  const price = priceStr
    ? `<div class="price-side"><span class="price" style="font-size:${priceFontPt(heightIn, priceStr).toFixed(1)}pt">${escapeHtml(priceStr)}</span></div>`
    : "";
  const msg = msgTxt ? `<span class="msg">${escapeHtml(msgTxt)}</span>` : "<span></span>";
  const vendor = label.vendorId ? `<span class="vendor">V#${escapeHtml(label.vendorId)}</span>` : "<span></span>";
  const bottom = msgTxt || label.vendorId ? `<div class="bottomrow">${msg}${vendor}</div>` : "";
  return `${title}${bc}${price}${bottom}`;
}

function labelCss(w: number, h: number, showTitle: boolean, reservePrice = true, reserveBottom = true, reserveMsg = true): string {
  if (isHorizontalLabel(w, h)) {
    const { sideFont, numFont, numRowIn, msgRowIn } = horizontalLabelMetrics(h);
    const hasMsg = reserveMsg; // only a message needs the extra full-width row; vendor rides the number line
    const bottomPad = numRowIn + (hasMsg ? msgRowIn : 0);
    const barMax = Math.max(0.2, h - bottomPad - (showTitle ? 0.26 : 0.16));
    return `
      .label { box-sizing: border-box; position: relative; width: ${w}in; height: ${h}in;
        padding: 0.05in 0.06in; padding-bottom: ${bottomPad.toFixed(3)}in;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        overflow: hidden; font-family: Arial, Helvetica, sans-serif; color: #000; text-align: center; }
      .label .ttl { font-size: 7pt; font-weight: 600; line-height: 1.05; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .label .bc { max-width: 100%; height: auto; max-height: ${barMax.toFixed(2)}in; object-fit: contain; }
      .label .midrow { position: absolute; left: 0.06in; right: 0.06in; bottom: ${(hasMsg ? msgRowIn + 0.01 : 0.03).toFixed(3)}in;
        display: flex; align-items: baseline; gap: 0.05in; }
      .label .price { font-size: ${sideFont.toFixed(1)}pt; font-weight: 800; line-height: 1; white-space: nowrap; }
      .label .num { flex: 1; text-align: center; font-family: "Courier New", monospace; font-size: ${numFont.toFixed(1)}pt; line-height: 1; white-space: nowrap; overflow: hidden; }
      .label .vendor { font-size: ${sideFont.toFixed(1)}pt; font-weight: 800; line-height: 1; white-space: nowrap; }
      .label .msgrow { position: absolute; left: 0.06in; right: 0.06in; bottom: 0.03in;
        font-size: 6.5pt; font-weight: 600; line-height: 1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .label .nobc { font-size: 7pt; color: #999; }
    `;
  }

  const { stripWidthIn } = priceSideMetrics(h);
  // Only reserve the rotated price strip / bottom row when the job actually has that content,
  // otherwise a barcode-only label gets pushed into the upper-left corner instead of centered.
  const rightPad = (reservePrice ? stripWidthIn + 0.05 : 0.05).toFixed(3);
  const bottomPad = (reserveBottom ? BOTTOM_ROW_IN : 0.04).toFixed(3);
  return `
    .label { box-sizing: border-box; position: relative; width: ${w}in; height: ${h}in;
      padding: 0.04in 0.05in; padding-right: ${rightPad}in; padding-bottom: ${bottomPad}in;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      overflow: hidden; font-family: Arial, Helvetica, sans-serif; color: #000; text-align: center; }
    .label .ttl { font-size: 7pt; font-weight: 600; line-height: 1.05; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .label .bc { max-width: 100%; height: auto; max-height: ${showTitle ? "0.40in" : "0.44in"}; object-fit: contain; }
    .label .price-side { position: absolute; top: 0; right: 0; bottom: ${(BOTTOM_ROW_IN - 0.02).toFixed(3)}in; width: ${stripWidthIn.toFixed(3)}in;
      display: flex; align-items: center; justify-content: center; }
    .label .price { transform: rotate(-90deg); font-weight: 800; white-space: nowrap; line-height: 1; }
    .label .bottomrow { position: absolute; left: 0.06in; right: 0.06in; bottom: 0.03in;
      display: flex; align-items: baseline; justify-content: space-between; gap: 0.06in; }
    .label .msg { font-size: 6.5pt; font-weight: 600; line-height: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
    .label .vendor { font-size: 9pt; font-weight: 800; line-height: 1; white-space: nowrap; }
    .label .nobc { font-size: 7pt; color: #999; }
  `;
}

// Wait for the barcode <img>s to actually decode before printing — a fixed delay races the
// data-URL images and Safari prints blank/half-painted labels. Print once, then self-close.
// ponytail: 3s safety net covers an image that never resolves; bump if barcodes get huge.
const AUTO_PRINT = `<script>(function(){
  var done=false;
  function go(){ if(done)return; done=true;
    window.addEventListener('afterprint',function(){setTimeout(function(){try{window.close();}catch(e){}},100);});
    window.focus(); window.print(); }
  var imgs=[].slice.call(document.images||[]);
  var pending=imgs.filter(function(i){return !i.complete;});
  var left=pending.length;
  if(!left){go();} else { pending.forEach(function(i){
    function tick(){ if(--left<=0) go(); }
    i.addEventListener('load',tick); i.addEventListener('error',tick); }); }
  setTimeout(go,3000);
})();</scr`+`ipt>`;

/** Print an HTML document in a real print window (Safari-safe); falls back to a hidden
 *  iframe only if a popup blocker kills the window. The embedded AUTO_PRINT script drives
 *  the actual print() in both cases, after the barcode images have loaded. */
function printHtml(html: string) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }
  // Popup blocked — hidden iframe fallback (window.close() inside an iframe is a no-op, so
  // the script's self-close can't touch the app; we reap the iframe on a timer instead).
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  setTimeout(() => iframe.parentNode?.removeChild(iframe), 60_000);
  iframe.srcdoc = html;
}

/**
 * Print a flat sequence of labels onto Avery sheets, starting at 1-based `startPos`.
 * Labels fill left-to-right, top-to-bottom; positions before `startPos` are left blank;
 * overflow continues onto additional sheets.
 */
export function printAverySheet(spec: SheetSpec, startPos: number, labels: LabelData[]) {
  if (labels.length === 0) return;
  // Avery specs are all landscape → horizontal layout → bars-only barcode (number rendered separately).
  const urls = barcodeUrlMap(labels, false);
  const showTitle = spec.labelH >= 0.85;
  const perSheet = spec.cols * spec.rows;
  const total = (startPos - 1) + labels.length;
  const sheets = Math.max(1, Math.ceil(total / perSheet));
  let body = "";
  for (let s = 0; s < sheets; s++) {
    let cells = "";
    for (let p = 0; p < perSheet; p++) {
      const idx = s * perSheet + p;
      if (idx < startPos - 1 || idx >= total) continue;
      const label = labels[idx - (startPos - 1)];
      const col = p % spec.cols;
      const row = Math.floor(p / spec.cols);
      const left = spec.marginLeft + col * spec.pitchX;
      const top = spec.marginTop + row * spec.pitchY;
      cells += `<div class="label" style="position:absolute;left:${left}in;top:${top}in;">${labelInnerHtml(label, urls.get(label.value) ?? null, showTitle, spec.labelW, spec.labelH)}</div>`;
    }
    body += `<div class="sheet">${cells}</div>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${PAGE_W}in ${PAGE_H}in; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .sheet { position: relative; width: ${PAGE_W}in; height: ${PAGE_H}in; page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
    ${labelCss(spec.labelW, spec.labelH, showTitle, jobHasPrice(labels), jobHasBottom(labels), labels.some((l) => !!l.message?.trim()))}
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>${body}${AUTO_PRINT}</body></html>`;
  printHtml(html);
}

/** Trim `str` with an ellipsis so it fits `maxW` (inches) at the doc's current font. */
function fitText(doc: import("jspdf").jsPDF, str: string, maxW: number): string {
  if (doc.getTextWidth(str) <= maxW) return str;
  let s = str;
  while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
  return s + "…";
}

/** Place a barcode image centered in a box (x0..x1, y0..y1), keeping aspect, capped at `maxH`. */
function drawBarcodePdf(doc: import("jspdf").jsPDF, value: string, x0: number, x1: number, y0: number, y1: number, maxH: number, withText = true) {
  const bc = makeBarcode(value, withText);
  if (!bc) {
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.text("No barcode", (x0 + x1) / 2, (y0 + y1) / 2, { align: "center", baseline: "middle" });
    return;
  }
  const aspect = bc.w / bc.h;
  let drawH = Math.min(maxH, y1 - y0);
  let drawW = drawH * aspect;
  if (drawW > x1 - x0) { drawW = x1 - x0; drawH = drawW / aspect; }
  doc.addImage(bc.url, "PNG", (x0 + x1) / 2 - drawW / 2, (y0 + y1) / 2 - drawH / 2, drawW, drawH);
}

/** Draw one label onto the current PDF page (origin top-left, inches). Mirrors LabelPreview. */
function drawLabelPdf(doc: import("jspdf").jsPDF, w: number, h: number, label: LabelData) {
  const showTitle = h >= 0.85;
  const priceStr = label.price ? `$${fmtPrice(label.price)}` : "";
  const msgTxt = label.message?.trim();
  doc.setFont("helvetica", "normal");

  if (showTitle && label.title) {
    doc.setFont("helvetica", "bold").setFontSize(7);
    doc.text(fitText(doc, label.title, w - 0.12), w / 2, 0.04, { align: "center", baseline: "top" });
  }
  const topY = 0.05 + (showTitle && label.title ? 0.14 : 0);

  if (isHorizontalLabel(w, h)) {
    // Layout B: full-width barcode; vendor + number + price on one line; message full-width below.
    const m = horizontalLabelMetrics(h);
    const bottomPad = m.numRowIn + (msgTxt ? m.msgRowIn : 0);
    // Cap the barcode below the full gap so it centers with a little padding above and below.
    const barMax = Math.max(0.2, h - bottomPad - (showTitle ? 0.26 : 0.16));
    drawBarcodePdf(doc, label.value, 0.06, w - 0.06, topY, h - bottomPad, barMax, false);

    // Auto-shrink the trio so vendor + number + price fit the width on one line.
    const vendorStr = label.vendorId ? `V#${label.vendorId}` : "";
    const { numFont, sideFont } = fitMidrowFonts(label.value, priceStr, vendorStr, w - 0.12, m.numFont, m.sideFont);
    const lineY = h - (msgTxt ? m.msgRowIn + 0.01 : 0.03);
    doc.setFont("courier", "normal").setFontSize(numFont);
    doc.text(label.value, w / 2, lineY, { align: "center", baseline: "bottom" });
    if (vendorStr) {
      doc.setFont("helvetica", "bold").setFontSize(sideFont);
      doc.text(vendorStr, 0.06, lineY, { baseline: "bottom" });
    }
    if (priceStr) {
      doc.setFont("helvetica", "bold").setFontSize(sideFont);
      doc.text(priceStr, w - 0.06, lineY, { align: "right", baseline: "bottom" });
    }
    if (msgTxt) {
      doc.setFont("helvetica", "bold").setFontSize(6.5);
      doc.text(fitText(doc, msgTxt, w - 0.12), w / 2, h - 0.03, { align: "center", baseline: "bottom" });
    }
    return;
  }

  // Portrait: rotated price up the right strip; message + vendor along the bottom.
  const hasBottom = !!(msgTxt || label.vendorId);
  const { stripWidthIn } = priceSideMetrics(h);
  const x1 = w - (priceStr ? stripWidthIn + 0.05 : 0.05);
  const bottom = h - (hasBottom ? BOTTOM_ROW_IN : 0.04);
  drawBarcodePdf(doc, label.value, 0.05, x1, topY, bottom, showTitle ? 0.4 : 0.44);

  if (priceStr) {
    const pTop = 0.04;
    const pBottom = h - (hasBottom ? BOTTOM_ROW_IN : 0.04);
    const maxRun = pBottom - pTop - 0.04;
    const basePt = priceFontPt(h, priceStr);
    doc.setFont("helvetica", "bold").setFontSize(basePt);
    let tw = doc.getTextWidth(priceStr);
    if (tw > maxRun) { doc.setFontSize(basePt * (maxRun / tw)); tw = doc.getTextWidth(priceStr); }
    doc.text(priceStr, w - stripWidthIn / 2, (pTop + pBottom) / 2 + tw / 2, { angle: 90, baseline: "middle" });
  }
  if (hasBottom) {
    const by = h - 0.05;
    if (msgTxt) {
      doc.setFont("helvetica", "bold").setFontSize(6.5);
      doc.text(fitText(doc, msgTxt, w - 0.12 - 0.5), 0.06, by, { baseline: "bottom" });
    }
    if (label.vendorId) {
      doc.setFont("helvetica", "bold").setFontSize(9);
      doc.text(`V#${label.vendorId}`, w - 0.06, by, { align: "right", baseline: "bottom" });
    }
  }
}

/**
 * Print labels for a roll / single-label printer as a PDF whose page size IS the label size.
 * PDF (not HTML) because Safari ignores `@page size` for non-standard sizes and re-orients the
 * content — a PDF page carries its own physical dimensions, so it prints 1:1 in every browser.
 * ponytail: `orientation` is currently ignored (callers pass "landscape"); add a 90° page swap
 * here if a portrait-fed stock ever needs it.
 */
export async function printRollLabels(w: number, h: number, _orientation: "landscape" | "portrait", labels: LabelData[]) {
  if (labels.length === 0) return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "in", format: [w, h], orientation: w >= h ? "landscape" : "portrait" });
  labels.forEach((label, i) => {
    if (i > 0) doc.addPage([w, h], w >= h ? "landscape" : "portrait");
    drawLabelPdf(doc, w, h, label);
  });
  doc.autoPrint(); // Chrome opens the print dialog automatically; in Safari press ⌘P on the PDF.
  const url = doc.output("bloburl");
  if (!window.open(url, "_blank")) doc.save("labels.pdf"); // popup blocked → download instead
}
