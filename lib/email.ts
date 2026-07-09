import { Resend } from "resend";
import { Booking, RESOURCE_LABELS } from "./types";

// Odesílatel musí být na doméně ověřené v Resendu (DNS záznam u ateliernapobrezi.cz).
const FROM = "Atelier na Pobřeží <rezervace@ateliernapobrezi.cz>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "milan.svolba@gmail.com,petr.svolba@gmail.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    client = new Resend(key);
  }
  return client;
}

async function send(to: string | string[], subject: string, html: string) {
  const c = getClient();
  if (!c) {
    // RESEND_API_KEY zatím není nastavený (např. lokální vývoj) — jen zalogujeme a pokračujeme,
    // ať kvůli chybějícímu klíči nespadne celá žádost/rezervace.
    console.warn(`[email] RESEND_API_KEY není nastavený, e-mail "${subject}" pro ${to} se neodeslal.`);
    return;
  }
  try {
    await c.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`[email] Odeslání "${subject}" pro ${to} selhalo:`, err);
  }
}

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

function isWholeSpace(resource: Booking["resource"]) {
  return resource === "atelier" || resource === "klubovna";
}

function wrap(bodyHtml: string) {
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">${bodyHtml}<p style="margin-top:24px;color:#888;font-size:12px;">Atelier na Pobřeží · rezervace.ateliernapobrezi.cz</p></div>`;
}

// --- Přihlašovací odkaz (magic link) pro admina/člena ---
export async function sendMagicLinkEmail(user: { name: string; email: string }, link: string) {
  const subject = "Přihlášení do rezervací — Atelier na Pobřeží";
  const html = wrap(`
    <p>Dobrý den${user.name ? ` ${user.name}` : ""},</p>
    <p>klikněte na tlačítko níže a budete přihlášeni. Odkaz platí 15 minut a jde použít jen jednou.</p>
    <p style="margin-top:20px;"><a href="${link}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Račte vstoupit</a></p>
    <p style="color:#888;font-size:13px;margin-top:16px;">Pokud jste o přihlášení nežádali, tento e-mail prostě ignorujte.</p>
  `);
  await send(user.email, subject, html);
}

// --- Uvítací e-mail pro nově založený účet (rovnou s přihlašovacím odkazem) ---
export async function sendWelcomeEmail(user: { name: string; email: string; role: "admin" | "member" }, link: string) {
  const subject = "Vítejte v Atelieru na Pobřeží! 🎉";
  const html = wrap(`
    <p>Ahoj ${user.name}!</p>
    <p>Právě jsi dostal/a přístup do rezervačního systému Atelieru na Pobřeží 🎨 — od teď si můžeš sám/sama zabookovat stůl, okno, pingpong, nebo klidně celou klubovnu, bez čekání na schválení.</p>
    <p style="margin-top:20px;"><a href="${link}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Pojď dovnitř →</a></p>
    <p style="color:#888;font-size:13px;margin-top:16px;">Tenhle odkaz platí 15 minut. Až vyprší, stačí na přihlašovací stránce znovu zadat svůj e-mail a pošleme nový.</p>
  `);
  await send(user.email, subject, html);
}

// --- Adminům: nová žádost od veřejnosti ---
export async function sendAdminNewRequestEmail(booking: Booking) {
  const what = isWholeSpace(booking.resource)
    ? `pronájem ${RESOURCE_LABELS[booking.resource].toLowerCase()}`
    : `rezervaci místa ${RESOURCE_LABELS[booking.resource]}`;
  const subject = `Nová žádost — ${RESOURCE_LABELS[booking.resource]} (${fmtDate(booking.date)})`;
  const html = wrap(`
    <p><strong>${booking.requesterName}</strong> žádá o ${what} na <strong>${fmtDate(booking.date)}</strong> od ${booking.startTime} do ${booking.endTime}.</p>
    ${booking.note ? `<p>Účel: ${booking.note}</p>` : ""}
    <p>Kontakt: ${booking.requesterContact}</p>
    <p style="margin-top:16px;"><a href="${APP_URL}/admin" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Zobrazit a rozhodnout</a></p>
    <p style="color:#888;font-size:13px;">Termín se v rozpisu zablokuje až po schválení.</p>
  `);
  await send(ADMIN_EMAILS, subject, html);
}

// --- Žadateli: potvrzení přijetí žádosti ---
export async function sendRequesterReceivedEmail(booking: Booking) {
  const what = isWholeSpace(booking.resource)
    ? `pronájem ${RESOURCE_LABELS[booking.resource].toLowerCase()}`
    : `rezervaci místa ${RESOURCE_LABELS[booking.resource]}`;
  const subject = "Přijali jsme vaši žádost — Atelier na Pobřeží";
  const html = wrap(`
    <p>Dobrý den ${booking.requesterName || ""},</p>
    <p>vaši žádost o ${what} na <strong>${fmtDate(booking.date)}</strong> od ${booking.startTime} do ${booking.endTime} jsme přijali. Ozveme se co nejdřív, nejpozději následující pracovní den.</p>
  `);
  if (booking.requesterContact) await send(booking.requesterContact, subject, html);
}

// --- Žadateli: rozhodnutí (schváleno / zamítnuto), volitelně s poznámkou od admina ---
export async function sendRequesterDecisionEmail(booking: Booking, approved: boolean, adminNote?: string) {
  const what = isWholeSpace(booking.resource)
    ? `pronájem ${RESOURCE_LABELS[booking.resource].toLowerCase()}`
    : `rezervaci místa ${RESOURCE_LABELS[booking.resource]}`;
  const subject = approved
    ? `Vaše rezervace je potvrzená — ${fmtDate(booking.date)}`
    : `K vaší žádosti — ${fmtDate(booking.date)}`;
  const note = adminNote?.trim();
  const html = wrap(
    approved
      ? `<p>Dobrý den ${booking.requesterName || ""},</p><p>vaše žádost o ${what} na <strong>${fmtDate(booking.date)}</strong> od ${booking.startTime} do ${booking.endTime} je potvrzená.</p>${note ? `<p>Poznámka: ${note}</p>` : ""}<p>Těšíme se na vás.</p>`
      : `<p>Dobrý den ${booking.requesterName || ""},</p><p>vaši žádost o ${what} na <strong>${fmtDate(booking.date)}</strong> od ${booking.startTime} do ${booking.endTime} bohužel nemůžeme potvrdit${note ? `, ${note}` : ""}.</p><p>Pokud vám vyhovuje jiný termín, napište nám znovu.</p>`
  );
  if (booking.requesterContact) await send(booking.requesterContact, subject, html);
}

// --- Rezervistovi: admin změnil termín/místo existující rezervace ---
export async function sendBookingChangedEmail(contact: string, before: Booking, after: Booking) {
  const subject = `Změna rezervace — ${fmtDate(after.date)}`;
  const html = wrap(`
    <p>Dobrý den,</p>
    <p>administrátor upravil vaši rezervaci „${before.title}".</p>
    <p><strong>Původně:</strong> ${RESOURCE_LABELS[before.resource]}, ${fmtDate(before.date)} ${before.startTime}–${before.endTime}</p>
    <p><strong>Nově:</strong> ${RESOURCE_LABELS[after.resource]}, ${fmtDate(after.date)} ${after.startTime}–${after.endTime}</p>
  `);
  await send(contact, subject, html);
}

// --- Rezervistovi: admin zrušil rezervaci ---
export async function sendBookingCancelledEmail(contact: string, booking: Booking) {
  const subject = `Zrušení rezervace — ${fmtDate(booking.date)}`;
  const html = wrap(`
    <p>Dobrý den,</p>
    <p>administrátor zrušil vaši rezervaci „${booking.title}" (${RESOURCE_LABELS[booking.resource]}, ${fmtDate(booking.date)} ${booking.startTime}–${booking.endTime}).</p>
    <p>Pokud budete chtít nový termín, napište nám.</p>
  `);
  await send(contact, subject, html);
}
