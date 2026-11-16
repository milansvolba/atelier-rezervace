import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { PromoCode } from "./promo";
import { waves } from "./voucherMotifs";

// Tisková stránka se slevovými kupóny: A4 na výšku, 4 kupóny (2 × 2, každý velikosti A6), čárkované čáry pro rozstříhání.
// Vzhled navazuje na dárkový poukaz (lib/voucherPdf.ts, DESIGN.md sekce 10): bílá karta, vlnky, zlatý akcent, písma Comfortaa a Work Sans.
// NÁVRH ke schválení Milanem (vznikl 2026-11-16). Texty vykají, za webovou adresou není tečka.

const ASSETS = path.join(process.cwd(), "lib", "voucher-assets");
const asset = (f: string) => path.join(ASSETS, f);

const C = { ink: "#1c1c1c", soft: "#57615c", accent: "#d3a53c", accentSoft: "#f0dba9", accentDark: "#6c5319", sea: "#2f4a4a", navy: "#141d33", line: "#e3e3e1", white: "#ffffff" };
const MM = 72 / 25.4;
const mm = (v: number) => v * MM;

const CARD_W = 105; // A6
const CARD_H = 148.5;
const PAD = 5; // odstup rámečku od hrany kupónu (domácí tiskárny netisknou do kraje)

type Doc = InstanceType<typeof PDFDocument>;

const WEEK_FMT = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}. ${m}. ${y}`;
};

// QR vede na přehled kurzů na hlavním webu (v rezervacích jde vybrat jen vypsaný termín). Kód se nepřenáší v adrese.
export function promoQrUrl(_code?: string): string {
  return "https://www.ateliernapobrezi.cz/kurzy";
}

export function promoPdfTexts(p: PromoCode) {
  return {
    headline: p.kind === "percent" ? `Sleva ${p.value} %` : `Kurz za ${p.value} Kč na osobu`,
    sub: p.scope === "poukaz" ? "na dárkový poukaz v Ateliéru na pobřeží" : "na kurz v Ateliéru na pobřeží",
    note: p.kind === "percent" ? "Sleva se týká ceny kurzu, ne odlitku." : "Cena se týká samotného kurzu.",
    valid: "Platí do " + WEEK_FMT(p.expiresAt),
    how: "Kód zadejte při objednávce kurzu na www.ateliernapobrezi.cz/kurzy (QR kód vás tam zavede)",
    rules: "Kód je jednorázový a nelze ho spojit s dárkovým poukazem.",
  };
}

function rr(doc: Doc, x: number, y: number, w: number, h: number, r: number, o: { fill?: string; stroke?: string; lw?: number }) {
  doc.save();
  doc.lineWidth(mm(o.lw ?? 0.3));
  const p = doc.roundedRect(mm(x), mm(y), mm(w), mm(h), mm(r));
  if (o.fill && o.stroke) p.fillAndStroke(o.fill, o.stroke);
  else if (o.fill) p.fill(o.fill);
  else if (o.stroke) p.stroke(o.stroke);
  doc.restore();
}

function txt(doc: Doc, s: string, x: number, y: number, o: { font: string; size: number; color: string; width?: number; align?: "left" | "center"; spacing?: number; lineGap?: number }) {
  doc.font(o.font).fontSize(o.size).fillColor(o.color);
  doc.text(s, mm(x), mm(y), { width: o.width !== undefined ? mm(o.width) : undefined, align: o.align ?? "left", characterSpacing: o.spacing ?? 0, lineGap: o.lineGap ?? 0 });
}

function qr(doc: Doc, url: string, x: number, y: number, size: number) {
  const q = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = q.modules.size;
  const cell = size / n;
  doc.save();
  doc.fillColor("#000000");
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c)) doc.rect(mm(x + c * cell) - 0.15, mm(y + r * cell) - 0.15, mm(cell) + 0.3, mm(cell) + 0.3);
  doc.fill();
  doc.restore();
}

// Jeden kupón; (ox, oy) je levý horní roh dlaždice A6 na stránce.
function coupon(doc: Doc, p: PromoCode, ox: number, oy: number) {
  const t = promoPdfTexts(p);
  const x = ox + PAD;
  const y = oy + PAD;
  const w = CARD_W - 2 * PAD; // 95
  const h = CARD_H - 2 * PAD; // 138.5
  rr(doc, x, y, w, h, 3.7, { fill: C.white, stroke: C.line });

  // Vlnky nahoře (nikdy neořezané: vykreslují se celé uvnitř svého obdélníku a ten leží uvnitř karty).
  const mw = w - 12;
  const motif = waves(mw, 24, 14, 0.9, 0.05);
  for (const l of motif.lines) {
    doc.save();
    doc.lineWidth(mm(l.width)).lineJoin("round").lineCap("round").strokeColor(l.color).strokeOpacity(l.opacity);
    l.pts.forEach((pt, i) => (i === 0 ? doc.moveTo(mm(x + 6 + pt[0]), mm(y + 20 + pt[1])) : doc.lineTo(mm(x + 6 + pt[0]), mm(y + 20 + pt[1]))));
    doc.stroke();
    doc.restore();
  }

  doc.image(asset("logo.png"), mm(x + 6), mm(y + 7), { width: mm(34) });

  txt(doc, "SLEVOVÝ KÓD", x + 6, y + 50, { font: "Work400", size: 7.5, color: C.accentDark, spacing: 7.5 * 0.28 });
  txt(doc, t.headline, x + 6, y + 55.5, { font: "Comfortaa500", size: 24, color: C.navy, width: w - 12 });
  txt(doc, t.sub, x + 6, y + 68, { font: "Work400", size: 9.5, color: C.soft, width: w - 12 });

  // Karta s kódem.
  const cy = y + 76;
  rr(doc, x + 6, cy, w - 12, 14, 3, { fill: C.white, stroke: C.accent, lw: 0.5 });
  txt(doc, p.code, x + 6, cy + 4, { font: "Comfortaa700", size: 15, color: C.navy, width: w - 12, align: "center", spacing: 15 * 0.04 });

  // Jak kód použít + QR.
  const qy = cy + 18;
  qr(doc, promoQrUrl(p.code), x + w - 6 - 22, qy, 22);
  txt(doc, t.how, x + 6, qy, { font: "Work400", size: 8, color: C.soft, width: w - 12 - 22 - 4, lineGap: 1.2 });
  txt(doc, t.note, x + 6, qy + 15, { font: "Work400", size: 7.5, color: C.soft, width: w - 12 - 22 - 4, lineGap: 1 });

  txt(doc, t.valid, x + 6, y + h - 13.5, { font: "Comfortaa500", size: 9, color: C.sea, width: w - 12 });
  txt(doc, t.rules, x + 6, y + h - 8, { font: "Work400", size: 7, color: C.soft, width: w - 12 });
}

// Vygeneruje PDF; kódy se rozdělí po čtyřech na stránku.
export async function generatePromoSheetPdf(codes: PromoCode[]): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    font: asset("WorkSans-400.ttf"),
    info: { Title: "Slevové kupóny", Author: "Ateliér na pobřeží" },
  });
  doc.registerFont("Work400", asset("WorkSans-400.ttf"));
  doc.registerFont("Comfortaa500", asset("Comfortaa-500.ttf"));
  doc.registerFont("Comfortaa700", asset("Comfortaa-700.ttf"));
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (let i = 0; i < codes.length; i += 4) {
    doc.addPage({ size: "A4", margin: 0 });
    // Čárkované čáry pro rozstříhání (mezi kupóny).
    doc.save();
    doc.lineWidth(0.4).strokeColor("#b9b9b6").dash(mm(2), { space: mm(2) });
    doc.moveTo(mm(CARD_W), 0).lineTo(mm(CARD_W), mm(297)).stroke();
    doc.moveTo(0, mm(CARD_H)).lineTo(mm(210), mm(CARD_H)).stroke();
    doc.restore();
    codes.slice(i, i + 4).forEach((p, k) => coupon(doc, p, (k % 2) * CARD_W, Math.floor(k / 2) * CARD_H));
  }
  if (codes.length === 0) doc.addPage({ size: "A4", margin: 0 });
  doc.end();
  return done;
}
