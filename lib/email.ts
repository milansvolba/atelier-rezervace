import { Resend } from "resend";
import { Booking, CourseSignup, RESOURCE_LABELS } from "./types";
import { getTemplate, renderTemplate } from "./emailTemplates";
import { logEmail } from "./emailLog";
import type { Voucher } from "./vouchers";
import { castingText } from "./voucherConfig";
import { button, esc, htmlToText, renderEmail, styleEmailBody } from "./emailLayout";

// Odesílatel musí být na doméně ověřené v Resendu (DNS záznam u ateliernapobrezi.cz).
// Odpovědi zákazníků chodí na rezervace@ (přeposílá se na schránky provozovatelů).
const FROM = "Ateliér na pobřeží <rezervace@ateliernapobrezi.cz>";
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

// Odešle e-mail a zapíše pokus do email_log (bez ohledu na to, jestli se
// odeslání povedlo) — meta.type odpovídá klíči šablony nebo systémovému typu
// e-mailu (magic_link, welcome), meta.bookingId/signupId je jen pro přehled v adminu.
// K HTML se vždy posílá i textová verze (lepší doručitelnost).
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
    await c.emails.send({ from: FROM, to, subject, html, text: htmlToText(html) });
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

// 1 osoba, 2–4 osoby, 5 a více osob.
function peopleWord(n: number) {
  return n === 1 ? "osoba" : n >= 2 && n <= 4 ? "osoby" : "osob";
}

// Společná obálka e-mailu (logo, nadpis, patička). Text uvnitř se zestylizuje
// (odstavce, odkazy, tlačítka) a nadpis stránky je title.
function wrap(bodyHtml: string, title: string, opts: { replyLine?: boolean } = {}) {
  return renderEmail({ title, bodyHtml: styleEmailBody(bodyHtml), replyLine: opts.replyLine });
}

// Předmět bez dovětku s názvem ateliéru slouží jako nadpis e-mailu.
function titleFromSubject(subject: string) {
  return subject.replace(/\s+[—–-]\s+Ate(?:lier|liér) na Pobřeží$/i, "").replace(/\s+[—–-]\s+Ateliér na pobřeží$/i, "");
}

// Sestaví e-mail ze šablony (výchozí, nebo upravená adminem) a odešle ho.
// Proměnné se do předmětu vkládají tak, jak jsou, do těla escapované (text od zákazníků
// se nesmí dostat do HTML). Jedinou výjimkou je noteBlock, který už je hotové HTML.
const RAW_HTML_VARS = new Set(["noteBlock"]);

async function sendFromTemplate(
  key: Parameters<typeof getTemplate>[0],
  to: string | string[],
  vars: Record<string, string>,
  meta: { bookingId?: string; signupId?: string }
) {
  const tpl = await getTemplate(key);
  const subject = renderTemplate(tpl.subject, vars);
  const bodyVars = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, RAW_HTML_VARS.has(k) ? v : esc(v)]));
  const html = wrap(renderTemplate(tpl.body, bodyVars), titleFromSubject(subject), { replyLine: !key.startsWith("admin_") });
  await send(to, subject, html, { type: key, ...meta });
}

// --- Přihlašovací odkaz (magic link) pro admina/člena ---
// Systémový e-mail, needitovatelný přes admin šablony (bezpečnostně citlivé).
// Chodí jen členům a adminům, proto se tyká.
export async function sendMagicLinkEmail(user: { name: string; email: string }, link: string) {
  const subject = "Přihlášení do rezervací — Ateliér na pobřeží";
  const html = wrap(
    `<p>Ahoj${user.name ? ` ${esc(user.name)}` : ""},</p>
    <p>klikni na tlačítko níže a přihlásíme tě. Odkaz platí 15 minut a jde použít jen jednou.</p>
    ${button("Račte vstoupit", link)}
    <p style="font-size:14px;">Pokud jsi o přihlášení nežádal/a, tento e-mail prostě ignoruj.</p>`,
    "Přihlášení do rezervací",
    { replyLine: false }
  );
  await send(user.email, subject, html, { type: "magic_link" });
}

// --- Uvítací e-mail pro nově založený účet (rovnou s přihlašovacím odkazem) ---
export async function sendWelcomeEmail(
  user: { name: string; email: string; role: "admin" | "member" },
  link: string,
  payLink?: string
) {
  const subject = "Vítej v Ateliéru na pobřeží! 🎉";
  const payBlock = payLink
    ? `
    <p style="margin-top:22px;"><strong>Členství v klubu</strong><br>Členství funguje jako měsíční předplatné. Platbu kartou založíš na zabezpečené stránce Stripe, fakturu dostaneš e-mailem. Předplatné můžeš kdykoli zrušit po přihlášení do rezervací.</p>
    ${button("Zaplatit členství", payLink)}
    <p style="font-size:14px;">Tenhle odkaz na platbu platí 30 dní.</p>`
    : "";
  const html = wrap(
    `
    <p>Ahoj ${esc(user.name)}!</p>
    <p>Právě jsi dostal/a přístup do rezervačního systému Ateliéru na pobřeží 🎨.</p>
    <p>Teď si můžeš rezervovat místo:</p>
    ${button("Zaber si flek", link)}
    <p style="font-size:14px;">Tenhle odkaz platí 15 minut. Až vyprší, stačí na přihlašovací stránce znovu zadat svůj e-mail a pošleme nový.</p>
    ${payBlock}
  `,
    "Vítej v Ateliéru na pobřeží"
  );
  await send(user.email, subject, html, { type: "welcome" });
}

// --- Adminům: nová žádost od veřejnosti (pronájem, nebo poptávka na kurz) ---
export async function sendAdminNewRequestEmail(booking: Booking) {
  const isCourse = booking.category === "kurz";
  const noteBlock = booking.note ? `<p>${isCourse ? "Poznámka" : "Účel"}: ${esc(booking.note)}</p>` : "";
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
    noteBlock: note ? `<p>${esc(note)}</p>` : "",
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
      peopleWord: peopleWord(signup.people),
      courseTitle: booking.title,
      date: fmtDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
      noteBlock: signup.note ? `<p>Poznámka: ${esc(signup.note)}</p>` : "",
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
    ? `<p>Vrátíme vám <strong>${refundCzk} Kč</strong> na kartu, kterou jste platili. Peníze obvykle dorazí do 5–10 pracovních dnů.</p>`
    : "";
  const html = wrap(
    `<p>Dobrý den, ${esc(signup.name)},</p><p>vaše přihláška na kurz <strong>${esc(booking.title)}</strong> (${fmtDate(booking.date)}, ${booking.startTime}–${booking.endTime}) byla stornována.</p>${refundLine}<p>V případě dotazů nám napište odpovědí na tento e-mail.</p>`,
    "Storno přihlášky na kurz"
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
// Texty zadává kupující (jméno, vzkaz), proto se do HTML escapují (esc z emailLayout).
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
    ? `<p>Obdarovaný už má na uvedený termín <strong>potvrzené místo</strong>, nemusí nic dalšího řešit. Při příchodu stačí zmínit kód poukazu.</p>`
    : `<p>Termín zatím není zvolený. Obdarovaný si ho vybere sám na <a href="${APP_URL}/kurzy">${APP_URL}/kurzy</a>: u vybraného termínu zvolí „Mám dárkový poukaz“ a zadá kód <strong>${esc(v.code)}</strong>. Místo se mu hned potvrdí.</p>`;
  const msg = v.message ? `<p>Vzkaz od kupujícího:<br><em>${esc(v.message)}</em></p>` : "";
  const html = wrap(
    `<p>Dobrý den, ${esc(v.buyerName)},</p>` +
      `<p>děkujeme za objednávku, platba proběhla v pořádku. Váš dárkový poukaz:</p>` +
      `<p style="font-size:22px;letter-spacing:2px;"><strong>${esc(v.code)}</strong></p>` +
      voucherSummaryHtml(v, booking) +
      msg +
      redeem,
    "Váš dárkový poukaz"
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
    `<p>Byl zaplacen nový dárkový poukaz <strong>${esc(v.code)}</strong> (${v.amountCzk} Kč).</p>` +
      voucherSummaryHtml(v, opts.booking) +
      `<p>Kupující: ${esc(v.buyerName)}, ${esc(v.buyerEmail)}</p>` +
      (v.message ? `<p>Vzkaz: ${esc(v.message)}</p>` : "") +
      warn +
      `<p><a class="btn" href="${APP_URL}/admin">Otevřít admin</a></p>`,
    "Nový dárkový poukaz " + v.code,
    { replyLine: false }
  );
  await send(ADMIN_EMAILS, "Nový dárkový poukaz " + v.code, html, { type: "voucher_admin", bookingId: opts.booking?.id });
}

// Uplatnění poukazu v aplikaci: potvrzení obdarovanému + upozornění adminům.
export async function sendVoucherRedeemedEmails(v: Voucher, booking: Booking, signup: CourseSignup, overbooked: boolean) {
  const html = wrap(
    `<p>Dobrý den, ${esc(signup.name)},</p>` +
      `<p>poukaz <strong>${esc(v.code)}</strong> je uplatněný a vaše místo na kurzu je <strong>potvrzené</strong>.</p>` +
      `<p>Kurz: <strong>${esc(booking.title)}</strong><br>Termín: ${fmtDate(booking.date)}, ${booking.startTime}–${booking.endTime}<br>Počet osob: ${signup.people}${v.castingCount > 0 ? ", včetně " + castingText(v.castingCount) : ""}</p>` +
      `<p>V případě dotazů nám napište odpovědí na tento e-mail.</p>`,
    "Poukaz uplatněn, vaše místo je potvrzené"
  );
  const adminHtml = wrap(
    `<p>Byl uplatněn dárkový poukaz <strong>${esc(v.code)}</strong> na termín ${fmtDate(booking.date)} (${esc(booking.title)}).</p>` +
      `<p>Přihlášen: ${esc(signup.name)}, ${esc(signup.contact)}, ${signup.people} os.${v.castingCount > 0 ? ", vč. odlitků: " + v.castingCount : ""}</p>` +
      (overbooked ? `<p><strong>Pozor:</strong> termín mezitím přesáhl kapacitu, zkontrolujte ji.</p>` : "") +
      `<p><a class="btn" href="${APP_URL}/admin">Otevřít admin</a></p>`,
    "Uplatněn poukaz " + v.code,
    { replyLine: false }
  );
  await Promise.all([
    send(signup.contact, "Poukaz uplatněn, vaše místo je potvrzené", html, { type: "voucher_redeemed", bookingId: booking.id, signupId: signup.id }),
    send(ADMIN_EMAILS, "Uplatněn poukaz " + v.code, adminHtml, { type: "voucher_redeemed_admin", bookingId: booking.id, signupId: signup.id }),
  ]);
}
