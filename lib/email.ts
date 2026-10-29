import { Resend } from "resend";
import { Booking, CourseSignup, RESOURCE_LABELS } from "./types";
import { getTemplate, renderTemplate } from "./emailTemplates";
import { logEmail } from "./emailLog";
import type { Voucher } from "./vouchers";
import { castingText } from "./voucherConfig";
import type { InvoiceItem } from "./invoices";
import { addressLine, idsLine, icoMissing } from "./invoiceFormat";
import { SIMPLIFIED_LIMIT_CZK } from "./billingInput";

// Odesílatel musí být na doméně ověřené v Resendu (DNS záznam u ateliernapobrezi.cz).
const FROM = "Atelier na Pobřeží <rezervace@ateliernapobrezi.cz>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "milan.svolba@gmail.com,petr.svolba@gmail.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Podklady k dokladům jdou jen na tyto adresy (proměnná INVOICE_EMAILS, čárkou oddělené); výchozí je Milan.
const INVOICE_EMAILS = (process.env.INVOICE_EMAILS || "milan.svolba@gmail.com")
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

// Odešle e-mail a zapíše pokus do email_log (bez ohledu na to, jestli se
// odeslání povedlo) — meta.type odpovídá klíči šablony nebo systémovému typu
// e-mailu (magic_link, welcome), meta.bookingId/signupId je jen pro přehled v adminu.
async function send(
  to: string | string[],
  subject: string,
  html: string,
  meta: { type: string; bookingId?: string; signupId?: string }
) {
  const recipient = Array.isArray(to) ? to.join(", ") : to;
  const c = getClient();
  if (!c) {
    // RESEND_API_KEY zatím není nastavený (např. lokální vývoj) — jen zalogujeme a pokračujeme,
    // ať kvůli chybějícímu klíči nespadne celá žádost/rezervace.
    console.warn(`[email] RESEND_API_KEY není nastavený, e-mail "${subject}" pro ${recipient} se neodeslal.`);
    await logEmail({ ...meta, recipient, subject, status: "skipped", error: "RESEND_API_KEY není nastavený" });
    return;
  }
  try {
    await c.emails.send({ from: FROM, to, subject, html });
    await logEmail({ ...meta, recipient, subject, status: "sent" });
  } catch (err) {
    console.error(`[email] Odeslání "${subject}" pro ${recipient} selhalo:`, err);
    await logEmail({ ...meta, recipient, subject, status: "failed", error: String(err) });
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

// Sestaví e-mail ze šablony (výchozí, nebo upravená adminem) a odešle ho.
async function sendFromTemplate(
  key: Parameters<typeof getTemplate>[0],
  to: string | string[],
  vars: Record<string, string>,
  meta: { bookingId?: string; signupId?: string }
) {
  const tpl = await getTemplate(key);
  const subject = renderTemplate(tpl.subject, vars);
  const html = wrap(renderTemplate(tpl.body, vars));
  await send(to, subject, html, { type: key, ...meta });
}

// --- Přihlašovací odkaz (magic link) pro admina/člena ---
// Systémový e-mail, needitovatelný přes admin šablony (bezpečnostně citlivé).
export async function sendMagicLinkEmail(user: { name: string; email: string }, link: string) {
  const subject = "Přihlášení do rezervací — Atelier na Pobřeží";
  const html = wrap(`
    <p>Dobrý den${user.name ? ` ${user.name}` : ""},</p>
    <p>klikněte na tlačítko níže a budete přihlášeni. Odkaz platí 15 minut a jde použít jen jednou.</p>
    <p style="margin-top:20px;"><a href="${link}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Račte vstoupit</a></p>
    <p style="color:#888;font-size:13px;margin-top:16px;">Pokud jste o přihlášení nežádali, tento e-mail prostě ignorujte.</p>
  `);
  await send(user.email, subject, html, { type: "magic_link" });
}

// --- Uvítací e-mail pro nově založený účet (rovnou s přihlašovacím odkazem) ---
export async function sendWelcomeEmail(
  user: { name: string; email: string; role: "admin" | "member" },
  link: string,
  payLink?: string
) {
  const subject = "Vítejte v Atelieru na Pobřeží! 🎉";
  const payBlock = payLink
    ? `
    <p style="margin-top:22px;"><strong>Členství v klubu</strong><br>Členství funguje jako měsíční předplatné. Platbu kartou založíš na zabezpečené stránce Stripe, fakturu dostaneš e-mailem. Předplatné můžeš kdykoli zrušit po přihlášení do rezervací.</p>
    <p style="margin-top:10px;"><a href="${payLink}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Zaplatit členství</a></p>
    <p style="color:#888;font-size:13px;margin-top:10px;">Tenhle odkaz na platbu platí 30 dní.</p>`
    : "";
  const html = wrap(`
    <p>Ahoj ${user.name}!</p>
    <p>Právě jsi dostal/a přístup do rezervačního systému Atelieru na Pobřeží 🎨.</p>
    <p style="margin-top:16px;">Teď si můžeš rezervovat místo:</p>
    <p style="margin-top:10px;"><a href="${link}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Zaber si flek</a></p>
    <p style="color:#888;font-size:13px;margin-top:16px;">Tenhle odkaz platí 15 minut. Až vyprší, stačí na přihlašovací stránce znovu zadat svůj e-mail a pošleme nový.</p>
    ${payBlock}
  `);
  await send(user.email, subject, html, { type: "welcome" });
}

// --- Adminům: nová žádost od veřejnosti (pronájem, nebo poptávka na kurz) ---
export async function sendAdminNewRequestEmail(booking: Booking) {
  const isCourse = booking.category === "kurz";
  const noteBlock = booking.note ? `<p>${isCourse ? "Poznámka" : "Účel"}: ${booking.note}</p>` : "";
  const vars = {
    name: booking.requesterName || "",
    date: fmtDate(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    noteBlock,
    contact: booking.requesterContact || "",
    adminUrl: `${APP_URL}/admin`,
  };
  if (isCourse) {
    await sendFromTemplate("admin_new_request_kurz", ADMIN_EMAILS, vars, { bookingId: booking.id });
    return;
  }
  const what = isWholeSpace(booking.resource)
    ? `pronájem ${RESOURCE_LABELS[booking.resource].toLowerCase()}`
    : `rezervaci místa ${RESOURCE_LABELS[booking.resource]}`;
  await sendFromTemplate(
    "admin_new_request_pronajem",
    ADMIN_EMAILS,
    { ...vars, what, resourceLabel: RESOURCE_LABELS[booking.resource] },
    { bookingId: booking.id }
  );
}

// --- Žadateli: potvrzení přijetí žádosti (pronájem, nebo poptávka na kurz) ---
export async function sendRequesterReceivedEmail(booking: Booking) {
  if (!booking.requesterContact) return;
  const isCourse = booking.category === "kurz";
  const vars = {
    name: booking.requesterName || "",
    date: fmtDate(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
  };
  if (isCourse) {
    await sendFromTemplate("requester_received_kurz", booking.requesterContact, vars, { bookingId: booking.id });
    return;
  }
  const what = isWholeSpace(booking.resource)
    ? `pronájem ${RESOURCE_LABELS[booking.resource].toLowerCase()}`
    : `rezervaci místa ${RESOURCE_LABELS[booking.resource]}`;
  await sendFromTemplate("requester_received_pronajem", booking.requesterContact, { ...vars, what }, { bookingId: booking.id });
}

// --- Žadateli: rozhodnutí (schváleno / zamítnuto), volitelně s poznámkou od admina ---
export async function sendRequesterDecisionEmail(booking: Booking, approved: boolean, adminNote?: string) {
  if (!booking.requesterContact) return;
  const isCourse = booking.category === "kurz";
  const note = adminNote?.trim();
  const vars = {
    name: booking.requesterName || "",
    date: fmtDate(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    noteBlock: note ? `<p>${note}</p>` : "",
    noteSuffix: note ? `, ${note}` : "",
  };
  if (isCourse) {
    const key = approved ? "requester_decision_kurz_approved" : "requester_decision_kurz_rejected";
    await sendFromTemplate(key, booking.requesterContact, vars, { bookingId: booking.id });
    return;
  }
  const what = isWholeSpace(booking.resource)
    ? `pronájem ${RESOURCE_LABELS[booking.resource].toLowerCase()}`
    : `rezervaci místa ${RESOURCE_LABELS[booking.resource]}`;
  const key = approved ? "requester_decision_pronajem_approved" : "requester_decision_pronajem_rejected";
  await sendFromTemplate(key, booking.requesterContact, { ...vars, what }, { bookingId: booking.id });
}

// --- Rezervistovi: admin změnil termín/místo existující rezervace nebo kurzu ---
export async function sendBookingChangedEmail(contact: string, before: Booking, after: Booking) {
  const isCourse = after.category === "kurz" || before.category === "kurz";
  await sendFromTemplate(
    "booking_changed",
    contact,
    {
      whatChanged: isCourse ? "termín vašeho kurzu" : `vaši rezervaci „${before.title}"`,
      beforeLabel: RESOURCE_LABELS[before.resource],
      beforeDate: fmtDate(before.date),
      beforeStart: before.startTime,
      beforeEnd: before.endTime,
      afterLabel: RESOURCE_LABELS[after.resource],
      afterDate: fmtDate(after.date),
      afterStart: after.startTime,
      afterEnd: after.endTime,
    },
    { bookingId: after.id }
  );
}

// --- Rezervistovi: admin zrušil rezervaci nebo termín kurzu ---
export async function sendBookingCancelledEmail(contact: string, booking: Booking) {
  const isCourse = booking.category === "kurz";
  await sendFromTemplate(
    "booking_cancelled",
    contact,
    {
      whatCancelled: isCourse ? "termín kurzu" : `vaši rezervaci „${booking.title}"`,
      resourceLabel: RESOURCE_LABELS[booking.resource],
      date: fmtDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
    { bookingId: booking.id }
  );
}

// --- Adminům: nová přihláška na vypsaný termín kurzu ---
export async function sendAdminNewSignupEmail(booking: Booking, signup: CourseSignup) {
  await sendFromTemplate(
    "admin_new_signup",
    ADMIN_EMAILS,
    {
      name: signup.name,
      people: String(signup.people),
      peopleWord: signup.people === 1 ? "osoba" : "osoby/osob",
      courseTitle: booking.title,
      date: fmtDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
      noteBlock: signup.note ? `<p>Poznámka: ${signup.note}</p>` : "",
      contact: signup.contact,
      adminUrl: `${APP_URL}/admin`,
    },
    { bookingId: booking.id, signupId: signup.id }
  );
}

// --- Přihlášenému: potvrzení přijetí přihlášky ---
export async function sendSignupReceivedEmail(booking: Booking, signup: CourseSignup) {
  await sendFromTemplate(
    "signup_received",
    signup.contact,
    {
      name: signup.name,
      courseTitle: booking.title,
      date: fmtDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
    { bookingId: booking.id, signupId: signup.id }
  );
}

// --- Přihlášenému: rozhodnutí o přihlášce ---
// Storno přihlášky na kurz zadané adminem (s případnou vratkou).
export async function sendSignupCancelledEmail(booking: Booking, signup: CourseSignup, refundCzk: number) {
  const refundLine = refundCzk > 0
    ? `<p>Vrátíme vám <strong>${refundCzk} Kč</strong> na kartu, kterou jste platili. Penize obvykle dorazí do 5–10 pracovních dnů.</p>`
    : "";
  const html = wrap(
    `<p>Dobrý den, ${signup.name},</p><p>vaše přihláška na kurz <strong>${booking.title}</strong> (${fmtDate(booking.date)}, ${booking.startTime}–${booking.endTime}) byla stornována.</p>${refundLine}<p>V případě dotazů nám napšete odpovědí na tento e-mail.</p>`
  );
  await send(signup.contact, "Storno přihlášky na kurz", html, { type: "signup_cancelled", bookingId: booking.id, signupId: signup.id });
}

export async function sendSignupDecisionEmail(booking: Booking, signup: CourseSignup, approved: boolean) {
  const key = approved ? "signup_decision_approved" : "signup_decision_rejected";
  await sendFromTemplate(
    key,
    signup.contact,
    {
      name: signup.name,
      courseTitle: booking.title,
      date: fmtDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
    { bookingId: booking.id, signupId: signup.id }
  );
}

// --- Dárkové poukazy na kurzy ---
// Texty zadává kupující (jméno, vzkaz), proto se do HTML escapují.
function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Částka bez haléřů a s mezerou tisíců: 12 170 Kč (do e-mailů pro lidi; doklady mají fmtCzk s haléři).
function fmtKc(n: number) {
  return n.toLocaleString("cs-CZ", { maximumFractionDigits: 0 }).replace(/\u00a0/g, " ") + " Kč";
}

const STUDIO_INFO_HTML =
  `<p><strong>Kde nás najdete:</strong> Ateliér na pobřeží, Na pobřeží 67, Kolín (areál bývalé továrny Kolinea).</p>` +
  `<p><strong>Co s sebou:</strong> pohodlné oblečení, které může být od hlíny. Materiál a pomůcky zajišťujeme.</p>`;

function voucherSummaryHtml(v: Voucher, booking?: Booking) {
  const people = v.people + " " + (v.people === 1 ? "osoba" : v.people <= 4 ? "osoby" : "osob");
  return (
    `<p>Kurz: <strong>${esc(v.courseTitle)}</strong><br>` +
    `Počet osob: ${people}${v.castingCount > 0 ? ", včetně " + castingText(v.castingCount) : ""}<br>` +
    (v.recipientName ? `Pro: ${esc(v.recipientName)}<br>` : "") +
    (booking ? `Termín: ${fmtDate(booking.date)}, ${booking.startTime}–${booking.endTime}<br>` : "") +
    `Platí do: ${fmtDate(v.expiresAt.slice(0, 10))}</p>`
  );
}

// Kupujícímu po zaplacení: kód poukazu a jak ho uplatnit.
export async function sendVoucherEmail(v: Voucher, booking?: Booking) {
  const redeem = booking
    ? `<p>Obdarovaný už má na uvedený termín <strong>potvrzené místo</strong>, nemusí nic dalšího řešit. Při příchodu stačí zmínit kód poukazu.</p>` + STUDIO_INFO_HTML
    : `<p>Termín zatím není zvolený. Obdarovaný si ho vybere sám na <a href="${APP_URL}/kurzy">${APP_URL}/kurzy</a>: u vybraného termínu zvolí „Mám dárkový poukaz“ a zadá kód <strong>${esc(v.code)}</strong>. Místo bude hned potvrzené.</p>`;
  const msg = v.message ? `<p>Vzkaz od kupujícího:<br><em>${esc(v.message)}</em></p>` : "";
  const html = wrap(
    `<p>Dobrý den,</p>` +
      `<p>děkujeme za objednávku, platba proběhla v pořádku. Váš dárkový poukaz v hodnotě <strong>${fmtKc(v.amountCzk)}</strong>:</p>` +
      `<p style="font-size:22px;letter-spacing:2px;"><strong>${esc(v.code)}</strong></p>` +
      voucherSummaryHtml(v, booking) +
      msg +
      redeem +
      `<p>Poukaz můžete přeposlat obdarovanému: stačí mu předat tento e-mail nebo jen kód.</p>` +
      DOKLAD_NOTE
  );
  await send(v.buyerEmail, "Váš dárkový poukaz " + v.code, html, { type: "voucher_buyer", bookingId: booking?.id });
}

// Adminům: nový zaplacený poukaz (a upozornění, když něco vyžaduje ruční zásah).
export async function sendAdminNewVoucherEmail(
  v: Voucher,
  opts: { booking?: Booking; overbooked?: boolean; signupFailed?: boolean } = {}
) {
  const warn =
    (opts.overbooked ? `<p><strong>Pozor:</strong> termín už neměl dost volných míst, přihláška přesto vznikla. Zkontrolujte kapacitu.</p>` : "") +
    (opts.signupFailed ? `<p><strong>Pozor:</strong> poukaz vznikl, ale přihlášku na zvolený termín se nepodařilo vytvořit. Doplňte ji ručně v adminu.</p>` : "");
  const html = wrap(
    `<p>Byl zaplacen nový dárkový poukaz <strong>${esc(v.code)}</strong> (${fmtKc(v.amountCzk)}).</p>` +
      voucherSummaryHtml(v, opts.booking) +
      `<p>Kupující: ${esc(v.buyerName)}, ${esc(v.buyerEmail)}</p>` +
      (v.message ? `<p>Vzkaz: ${esc(v.message)}</p>` : "") +
      warn +
      `<p><a href="${APP_URL}/admin">Otevřít admin</a></p>`
  );
  await send(ADMIN_EMAILS, "Nový dárkový poukaz " + v.code, html, { type: "voucher_admin", bookingId: opts.booking?.id });
}

// Uplatnění poukazu v aplikaci: potvrzení obdarovanému + upozornění adminům.
export async function sendVoucherRedeemedEmails(v: Voucher, booking: Booking, signup: CourseSignup, overbooked: boolean) {
  const html = wrap(
    `<p>Dobrý den,</p>` +
      `<p>poukaz <strong>${esc(v.code)}</strong> je uplatněný a vaše místo na kurzu je <strong>potvrzené</strong>.</p>` +
      `<p>Kurz: <strong>${esc(booking.title)}</strong><br>Termín: ${fmtDate(booking.date)}, ${booking.startTime}–${booking.endTime}<br>Počet osob: ${signup.people}${v.castingCount > 0 ? ", včetně " + castingText(v.castingCount) : ""}</p>` +
      STUDIO_INFO_HTML +
      `<p>V případě dotazů nám napište odpovědí na tento e-mail.</p>`
  );
  const adminHtml = wrap(
    `<p>Byl uplatněn dárkový poukaz <strong>${esc(v.code)}</strong> na termín ${fmtDate(booking.date)} (${esc(booking.title)}).</p>` +
      `<p>Přihlášen: ${esc(signup.name)}, ${esc(signup.contact)}, ${signup.people} os.${v.castingCount > 0 ? ", vč. odlitků: " + v.castingCount : ""}</p>` +
      (overbooked ? `<p><strong>Pozor:</strong> termín mezitím přesáhl kapacitu, zkontrolujte ji.</p>` : "") +
      `<p><a href="${APP_URL}/admin">Otevřít admin</a></p>`
  );
  await Promise.all([
    send(signup.contact, "Poukaz uplatněn, vaše místo je potvrzené", html, { type: "voucher_redeemed", bookingId: booking.id, signupId: signup.id }),
    send(ADMIN_EMAILS, "Uplatněn poukaz " + v.code, adminHtml, { type: "voucher_redeemed_admin", bookingId: booking.id, signupId: signup.id }),
  ]);
}

// --- Doklady k platbám ---
const DOKLAD_NOTE = `<p style="font-size:13px;color:#555;">Potvrzení o platbě ze Stripe není daňový doklad. Daňový doklad (fakturu) vám zašleme samostatně.</p>`;

// Zákazníkovi po zaplacení kurzu: upozornění, že daňový doklad přijde zvlášť.
export async function sendDokladNoteEmail(to: string, signupId?: string, bookingId?: string) {
  await send(to, "Doklad k vaší platbě", wrap(`<p>Dobrý den,</p><p>děkujeme za platbu.</p>${DOKLAD_NOTE}`), { type: "doklad_note", signupId, bookingId });
}

function fmtCzk(n: number) {
  return n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Kč";
}

// Adminům po zaplacení: podklady pro vystavení daňového dokladu v Caflou.
export async function sendAdminInvoiceBasisEmail(item: InvoiceItem) {
  const b = item.billing;
  const addr = addressLine(b?.address);
  const ids = idsLine(b);
  const paid = item.paidAt ? fmtDate(item.paidAt.slice(0, 10)) : "";
  const who = b?.company || b?.name || item.description;
  const html = wrap(
    `<p><strong>Vystavte daňový doklad v Caflou.</strong></p>` +
      `<p>Odběratel: ${esc(b?.company || b?.name || "—")}${b?.company && b?.name ? `<br>Kontaktní osoba: ${esc(b.name)}` : ""}<br>E-mail: ${esc(b?.email || "—")}<br>Adresa: ${esc(addr || (item.amountCzk <= SIMPLIFIED_LIMIT_CZK ? `neuvedena (zjednodušený doklad do ${SIMPLIFIED_LIMIT_CZK.toLocaleString("cs-CZ").replace(/\u00a0/g, " ")} Kč)` : "—"))}<br>${ids ? esc(ids) : "IČO/DIČ: neuvedeno (nejspíš fyzická osoba)"}</p>` +
      (icoMissing(b) ? `<p style="background:#fff4d6;padding:8px;"><strong>Pozor: chybí IČO.</strong> Zákazník nakupuje na firmu, ale IČO nevyplnil. Dohledejte ho v ARES (Caflou ho umí načíst podle názvu nebo DIČ).</p>` : "") +
      `<p>Položka: ${esc(item.description)}<br>Celkem vč. DPH 21 %: <strong>${fmtCzk(item.amountCzk)}</strong><br>Základ: ${fmtCzk(item.baseCzk)} · DPH: ${fmtCzk(item.vatCzk)}<br>Datum přijetí platby (DUZP): <strong>${paid}</strong><br>Stripe: ${esc(item.id)}</p>` +
      `<p>Doklad je už zaplacený (kartou, Stripe). Po vystavení ho v adminu odškrtněte: <a href="${APP_URL}/admin">Otevřít admin</a></p>`
  );
  await send(INVOICE_EMAILS, "Doklad k vystavení: " + who + ", " + fmtCzk(item.amountCzk), html, { type: "invoice_basis" });
}
