import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { Voucher } from "./vouchers";
import type { Booking } from "./types";
import { motifForTopic, waves, type Motif } from "./voucherMotifs";

// PDF dárkového poukazu (A4, 2 strany): přední strana s motivem kurzu, jménem a kartami, zadní s kódem, QR a návodem.
// Vzhled schválen 15. 11. 2026, viz dokumentace/poukaz-pdf.md. Texty a rozvržení drží návrh, který vznikl v HTML.
// Soubory (písma, logo, podpis) leží v lib/voucher-assets a do funkcí je přidává outputFileTracingIncludes v next.config.mjs.

const ASSETS = path.join(process.cwd(), "lib", "voucher-assets");
const asset = (f: string) => path.join(ASSETS, f);

const C = {
  ink: "#1c1c1c",
  soft: "#57615c",
  accent: "#d3a53c",
  accentSoft: "#f0dba9",
  accentDark: "#6c5319",
  sea: "#2f4a4a",
  navy: "#141d33",
  line: "#e3e3e1",
  white: "#ffffff",
};

const MM = 72 / 25.4;
const mm = (v: number) => v * MM;
const OX = 8; // bílý okraj kolem karty (domácí tiskárny netisknou do kraje)
const OY = 8;
const CARD_W = 194;
const CARD_H = 281;
const LEFT = 16;
const INNER_W = CARD_W - 2 * LEFT;

const COURSE_NAMES: Record<string, string> = { hlava: "Modelování hlavy", relief: "Modelování reliéfu" };
const WEEKDAYS = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

function termText(b: Booking): string {
  const [y, m, d] = b.date.split("-").map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d}. ${m}. ${y}, ${b.startTime} až ${b.endTime}`;
}

export function peopleAcc(n: number): string {
  return n === 1 ? "1 osobu" : n >= 2 && n <= 4 ? `${n} osoby` : `${n} osob`;
}

export function voucherPdfFilename(v: Pick<Voucher, "code">): string {
  return `poukaz-${v.code}.pdf`;
}

export function voucherQrUrl(code: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://rezervace.ateliernapobrezi.cz").replace(/\/$/, "");
  return `${base}/kurzy?poukaz=${encodeURIComponent(code)}`;
}

// Texty, které se mění podle objednávky. Samostatná funkce, aby šly otestovat bez kreslení.
export function voucherPdfTexts(v: Voucher, booking?: Booking) {
  const hasTerm = !!booking;
  return {
    course: COURSE_NAMES[v.topic] ?? v.courseTitle,
    recipient: (v.recipientName ?? "").trim(),
    people: peopleAcc(v.people),
    includes: "Materiál, vybavení, lektor a občerstvení." + (v.castingCount > 0 ? " Součástí je také odlitek." : ""),
    term: booking ? termText(booking) : "",
    valid: fmtDate(v.expiresAt.slice(0, 10)),
    redeem: hasTerm ? "Termín je už zarezervovaný, stačí poukaz přinést na kurz" : "Kód zadejte na www.ateliernapobrezi.cz/kod",
    step1: hasTerm
      ? "Termín je už zarezervovaný, nemusíte nic dalšího řešit."
      : "Naskenujte QR kód na poukazu, nebo zadejte kód poukazu na www.ateliernapobrezi.cz/kod",
  };
}

type Doc = InstanceType<typeof PDFDocument>;

function drawMotif(doc: Doc, m: Motif, x: number, y: number) {
  for (const l of m.lines) {
    const p = (pt: [number, number]) => [mm(x + pt[0]), mm(y + pt[1])] as const;
    if (l.maskBelow) {
      doc.save();
      const [sx, sy] = p(l.pts[0]);
      doc.moveTo(sx, sy);
      for (const pt of l.pts.slice(1)) doc.lineTo(...p(pt));
      doc.lineTo(...p([m.w, m.h])).lineTo(...p([0, m.h])).closePath().fill(C.white);
      doc.restore();
    }
    doc.save();
    doc.lineWidth(mm(l.width)).lineJoin("round").lineCap("round").strokeColor(l.color).strokeOpacity(l.opacity);
    const [sx, sy] = p(l.pts[0]);
    doc.moveTo(sx, sy);
    for (const pt of l.pts.slice(1)) doc.lineTo(...p(pt));
    doc.stroke();
    doc.restore();
  }
}

function cardFrame(doc: Doc) {
  doc.save();
  doc.lineWidth(mm(0.3)).roundedRect(mm(OX), mm(OY), mm(CARD_W), mm(CARD_H), mm(3.7)).fillAndStroke(C.white, C.line);
  doc.restore();
}

function textMm(doc: Doc, s: string, x: number, y: number, o: { font: string; size: number; color: string; width?: number; align?: "left" | "center"; spacing?: number; lineGap?: number }) {
  doc.font(o.font).fontSize(o.size).fillColor(o.color);
  doc.text(s, mm(OX + x), mm(OY + y), { width: o.width !== undefined ? mm(o.width) : undefined, align: o.align ?? "left", characterSpacing: o.spacing ?? 0, lineGap: o.lineGap ?? 0 });
}

function heightMm(doc: Doc, s: string, o: { font: string; size: number; width: number; spacing?: number; lineGap?: number }): number {
  doc.font(o.font).fontSize(o.size);
  return doc.heightOfString(s, { width: mm(o.width), characterSpacing: o.spacing ?? 0, lineGap: o.lineGap ?? 0 }) / MM;
}

function roundRectMm(doc: Doc, x: number, y: number, w: number, h: number, r: number, o: { fill?: string; stroke?: string; lw?: number }) {
  doc.save();
  doc.lineWidth(mm(o.lw ?? 0.3));
  const rr = doc.roundedRect(mm(OX + x), mm(OY + y), mm(w), mm(h), mm(r));
  if (o.fill && o.stroke) rr.fillAndStroke(o.fill, o.stroke);
  else if (o.fill) rr.fill(o.fill);
  else if (o.stroke) rr.stroke(o.stroke);
  doc.restore();
}

function logo(doc: Doc) {
  doc.image(asset("logo.png"), mm(OX + LEFT), mm(OY + 12), { width: mm(54) });
}

// Karta ve stylu webu: štítek, nadpis, krátký text. Výška se spočítá předem, aby měly karty v řadě stejnou výšku.
interface Card {
  tag: string;
  title: string;
  text?: string;
}

function measureCard(doc: Doc, c: Card, w: number): number {
  const iw = w - 10;
  let h = 5 + 4 + 3 + heightMm(doc, c.title, { font: "Comfortaa500", size: 13, width: iw });
  if (c.text) h += 1.2 + heightMm(doc, c.text, { font: "Work400", size: 9.5, width: iw });
  return h + 5.5;
}

function drawCard(doc: Doc, c: Card, x: number, y: number, w: number, h: number) {
  roundRectMm(doc, x, y, w, h, 3.7, { fill: C.white, stroke: C.line, lw: 0.3 });
  const iw = w - 10;
  // štítek (pilulka)
  const tag = c.tag.toUpperCase();
  const sp = 7 * 0.14;
  doc.font("Work400").fontSize(7);
  const tw = doc.widthOfString(tag, { characterSpacing: sp }) / MM;
  roundRectMm(doc, x + 5, y + 5, tw + 6, 4, 2, { fill: C.accentSoft });
  textMm(doc, tag, x + 8, y + 5.9, { font: "Work400", size: 7, color: C.accentDark, spacing: sp });
  let cy = y + 5 + 4 + 3;
  textMm(doc, c.title, x + 5, cy, { font: "Comfortaa500", size: 13, color: C.navy, width: iw });
  cy += heightMm(doc, c.title, { font: "Comfortaa500", size: 13, width: iw });
  if (c.text) textMm(doc, c.text, x + 5, cy + 1.2, { font: "Work400", size: 9.5, color: C.soft, width: iw });
}

function front(doc: Doc, v: Voucher, t: ReturnType<typeof voucherPdfTexts>) {
  doc.addPage({ size: "A4", margin: 0 });
  cardFrame(doc);
  doc.save();
  doc.roundedRect(mm(OX), mm(OY), mm(CARD_W), mm(CARD_H), mm(3.7)).clip();
  drawMotif(doc, motifForTopic(v.topic), OX, OY + 32);
  doc.restore();
  logo(doc);

  textMm(doc, t.course.toUpperCase(), LEFT, 131, { font: "Work400", size: 10, color: C.accentDark, spacing: 10 * 0.28 });
  textMm(doc, "Dárkový poukaz", LEFT, 139.5, { font: "Comfortaa500", size: 38, color: C.navy });

  let afterNames = 160;
  if (t.recipient) {
    doc.font("Work400").fontSize(11).fillColor(C.soft);
    doc.text("Pro ", mm(OX + LEFT), mm(OY + 160), { width: mm(INNER_W), continued: true, lineGap: 2 });
    doc.font("Comfortaa500").fontSize(16).fillColor(C.sea).text(t.recipient, { continued: false, lineGap: 2 });
    afterNames = doc.y / MM - OY;
  }

  const cards: Card[] = [{ tag: "V ceně poukazu", title: `Kurz pro ${t.people}`, text: t.includes }];
  if (t.term) cards.push({ tag: "Termín kurzu", title: t.term, text: "Místo je pro Vás už rezervované." });
  const gap = 4;
  const cw = (INNER_W - gap * (cards.length - 1)) / cards.length;
  const ch = Math.max(...cards.map((c) => measureCard(doc, c, cw)));
  const cy = Math.max(afterNames + 7, t.recipient ? 0 : 168);
  cards.forEach((c, i) => drawCard(doc, c, LEFT + i * (cw + gap), cy, cw, ch));

  // Pozdrav a podpis dole (podpis je vymyšlený pro poukazy, ne skutečný).
  const png = fs.readFileSync(asset("petr-podpis.png")); // rozměry z hlavičky PNG (IHDR)
  const sh = 25;
  const sw = (sh * png.readUInt32BE(16)) / png.readUInt32BE(20);
  const top = 232.5;
  textMm(doc, "Těší se na Vás odborný lektor", 0, top, { font: "Comfortaa500", size: 11, color: C.sea, width: CARD_W, align: "center" });
  doc.image(asset("petr-podpis.png"), mm(OX + (CARD_W - sw) / 2), mm(OY + top + 7.5), { height: mm(sh) });
  textMm(doc, "Petr Švolba", 0, top + 7.5 + sh + 0.8, { font: "Work400", size: 8, color: C.soft, width: CARD_W, align: "center", spacing: 8 * 0.08 });
}

function drawQr(doc: Doc, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  doc.save();
  doc.fillColor("#000000");
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) doc.rect(mm(OX + x + c * cell) - 0.15, mm(OY + y + r * cell) - 0.15, mm(cell) + 0.3, mm(cell) + 0.3);
    }
  }
  doc.fill();
  doc.restore();
}

function back(doc: Doc, v: Voucher, t: ReturnType<typeof voucherPdfTexts>) {
  doc.addPage({ size: "A4", margin: 0 });
  cardFrame(doc);
  logo(doc);

  // Karta s kódem a QR.
  const cTop = 38;
  const cH = 54;
  roundRectMm(doc, LEFT, cTop, INNER_W, cH, 3.7, { fill: C.white, stroke: C.line });
  const colX = LEFT + 8;
  const colW = INNER_W - 16 - 40 - 8;
  textMm(doc, "KÓD POUKAZU", colX, cTop + 7, { font: "Work400", size: 7.5, color: C.soft, spacing: 7.5 * 0.14 });
  doc.font("Comfortaa700").fontSize(19);
  const codeW = doc.widthOfString(v.code, { characterSpacing: 19 * 0.05 }) / MM;
  roundRectMm(doc, colX, cTop + 12, codeW + 12, 13.5, 3.7, { fill: C.accentSoft, stroke: C.accent, lw: 0.5 });
  textMm(doc, v.code, colX + 6, cTop + 12 + 3.3, { font: "Comfortaa700", size: 19, color: C.navy, spacing: 19 * 0.05 });
  const rH = heightMm(doc, t.redeem, { font: "Work400", size: 9.5, width: colW, lineGap: 2 });
  textMm(doc, t.redeem, colX, cTop + 28.5, { font: "Work400", size: 9.5, color: C.soft, width: colW, lineGap: 2 });
  const vy = cTop + 28.5 + rH + 3.5;
  doc.font("Work400").fontSize(10);
  const pw = doc.widthOfString("Platnost do ") / MM;
  textMm(doc, "Platnost do ", colX, vy, { font: "Work400", size: 10, color: C.soft });
  textMm(doc, t.valid, colX + pw, vy - 0.1, { font: "Comfortaa500", size: 10, color: C.navy });
  // QR kód v bílém rámečku
  const qx = LEFT + INNER_W - 8 - 40;
  roundRectMm(doc, qx, cTop + 7, 40, 40, 2.4, { fill: C.white, stroke: C.line, lw: 0.25 });
  drawQr(doc, voucherQrUrl(v.code), qx + 2.2, cTop + 7 + 2.2, 35.6);

  // Pruh vlnek.
  doc.save();
  doc.roundedRect(mm(OX), mm(OY), mm(CARD_W), mm(CARD_H), mm(3.7)).clip();
  drawMotif(doc, waves(194, 18, 5, 1.2, 0.1), OX, OY + 106);
  doc.restore();

  textMm(doc, "Jak poukaz využít", LEFT, 130, { font: "Comfortaa500", size: 24, color: C.navy });

  // Návod ve třech krocích.
  const steps = [
    { title: "Vyberte termín", text: t.step1 },
    { title: "Přijďte do ateliéru", text: "Poukaz s sebou vezměte vytištěný, nebo stačí říct číslo kódu." },
    { title: "Tvořte", text: "Materiál, vybavení, lektora i občerstvení máme na starosti my." },
  ];
  let sy = 150;
  const sw = INNER_W - 17;
  for (const s of steps) {
    doc.save();
    doc.lineWidth(mm(0.35)).circle(mm(OX + LEFT + 5.5), mm(OY + sy + 5.5), mm(5.5)).stroke(C.accent);
    doc.restore();
    textMm(doc, String(steps.indexOf(s) + 1), LEFT, sy + 3.1, { font: "Comfortaa500", size: 13, color: C.navy, width: 11, align: "center" });
    textMm(doc, s.title, LEFT + 17, sy, { font: "Comfortaa500", size: 14, color: C.navy });
    const th = heightMm(doc, s.title, { font: "Comfortaa500", size: 14, width: sw });
    textMm(doc, s.text, LEFT + 17, sy + th + 1.2, { font: "Work400", size: 11, color: C.soft, width: sw, lineGap: 1.5 });
    sy += th + 1.2 + heightMm(doc, s.text, { font: "Work400", size: 11, width: sw, lineGap: 1.5 }) + 8;
  }

  // Dvě informační karty dole.
  const info = [
    { h: "Kde nás najdete", t: "Ateliér na pobřeží\nNa pobřeží 67, Kolín\nwww.ateliernapobrezi.cz" },
    { h: "Potřebujete poradit?", t: "Napište na rezervace@ateliernapobrezi.cz\nnebo zavolejte na +420 724 241 721." },
  ];
  const iw = (INNER_W - 4) / 2;
  const heights = info.map((c) => 5 + heightMm(doc, c.h, { font: "Comfortaa500", size: 11.5, width: iw - 10 }) + 1.5 + heightMm(doc, c.t, { font: "Work400", size: 10, width: iw - 10, lineGap: 1.5 }) + 5);
  const ih = Math.max(...heights);
  info.forEach((c, i) => {
    const x = LEFT + i * (iw + 4);
    const y = CARD_H - 14 - ih;
    roundRectMm(doc, x, y, iw, ih, 3.7, { fill: C.white, stroke: C.line });
    textMm(doc, c.h, x + 5, y + 5, { font: "Comfortaa500", size: 11.5, color: C.navy, width: iw - 10 });
    textMm(doc, c.t, x + 5, y + 5 + heightMm(doc, c.h, { font: "Comfortaa500", size: 11.5, width: iw - 10 }) + 1.5, { font: "Work400", size: 10, color: C.soft, width: iw - 10, lineGap: 1.5 });
  });
}

// Vygeneruje PDF poukazu a vrátí ho jako Buffer.
export async function generateVoucherPdf(v: Voucher, booking?: Booking): Promise<Buffer> {
  const t = voucherPdfTexts(v, booking);
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    font: asset("WorkSans-400.ttf"), // vlastní výchozí písmo, ať pdfkit nehledá vestavěné soubory Helvetica
    info: { Title: "Dárkový poukaz " + v.code, Author: "Ateliér na pobřeží" },
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
  front(doc, v, t);
  back(doc, v, t);
  doc.end();
  return done;
}
