import { Resend } from "resend";
import { Booking, CourseSignup, RESOURCE_LABELS } from "./types";
import { getTemplate, renderTemplate } from "./emailTemplates";
import { logEmail } from "./emailLog";
import type { Voucher } from "./vouchers";
import { castingText } from "./voucherConfig";
import type { InvoiceItem } from "./invoices";
import { addressLine, idsLine, icoMissing } from "./invoiceFormat";
import { signupNotifyTo } from "./signupContact";
import { SIMPLIFIED_LIMIT_CZK } from "./billingInput";
import { escapeHtml } from "./html";

// Odesílatel musí být na doméně ověřené v Resendu (DNS záznam u ateliernapobrezi.cz).
const FROM = "Ateliér na pobřeží <rezervace@ateliernapobrezi.cz>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "milan.svolba@gmail.com,petr.svolba@gmail.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Zprávy z kontaktního formuláře na webu: výchozí příjemci jsou admini, jde změnit proměnnou CONTACT_EMAILS.
const CONTACT_EMAILS = (process.env.CONTACT_EMAILS || "")
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
  meta: { type: string; bookingId?: string; signupId?: string },
  opts?: { replyTo?: string }
): Promise<boolean> {
  const recipient = Array.isArray(to) ? to.join(", ") : to;
  const c = getClient();
  if (!c) {
    // RESEND_API_KEY zatím není nastavený (např. lokální vývoj) — jen zalogujeme a pokračujeme,
    // ať kvůli chybějícímu klíči nespadne celá žádost/rezervace.
    console.warn(`[email] RESEND_API_KEY není nastavený, e-mail "${subject}" pro ${recipient} se neodeslal.`);
    await logEmail({ ...meta, recipient, subject, status: "skipped", error: "RESEND_API_KEY není nastavený" });
    return false;
  }
  try {
    await c.emails.send({ from: FROM, to, subject, html, ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}) });
    await logEmail({ ...meta, recipient, subject, status: "sent" });
    return true;
  } catch (err) {
    console.error(`[email] Odeslání "${subject}" pro ${recipient} selhalo:`, err);
    await logEmail({ ...meta, recipient, subject, status: "failed", error: String(err) });
    return false;
  }
}

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

function isWholeSpace(resource: Booking["resource"]) {
  return resource === "atelier" || resource === "klubovna";
}

function wrap(bodyHtml: string, afterFooterHtml = "") {
  // Logo ateliéru nahoře (soubor public/logo.png, 705×160 px, zobrazí se zmenšené na výšku 36 px).
  const logo = `<p style="margin:0 0 20px;"><a href="https://ateliernapobrezi.cz"><img src="${APP_URL}/logo.png" alt="Ateliér na pobřeží" width="159" height="36" style="display:block;border:0;height:36px;width:auto;"></a></p>`;
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">${logo}${bodyHtml}<p style="margin-top:24px;color:#888;font-size:12px;line-height:1.5;"><strong style="color:#555;">Ateliér na pobřeží</strong><br><a href="https://www.ateliernapobrezi.cz" style="color:#888;">www.ateliernapobrezi.cz</a></p>${afterFooterHtml}</div>`;
}

// Sestaví e-mail ze šablony (výchozí, nebo upravená adminem) a odešle ho.
async function sendFromTemplate(
  key: Parameters<typeof getTemplate>[0],
  to: string | string[],
  vars: Record<string, string>,
  meta: { bookingId?: string; signupId?: string },
  afterFooterHtml = ""
) {
  const tpl = await getTemplate(key);
  const subject = renderTemplate(tpl.subject, vars);
  const html = wrap(renderTemplate(tpl.body, vars), afterFooterHtml);
  await send(to, subject, html, { type: key, ...meta });
}

// --- Zpráva z kontaktního formuláře na webu ---
// Jde adminům (nebo na CONTACT_EMAILS). Reply-To je e-mail odesílatele, takže odpověď jde rovnou jemu.
// Systémový e-mail, pevný text v kódu. Text od návštěvníka se ošetřuje (escapeHtml).
export async function sendContactMessageEmail(m: { name: string; email: string; message: string }) {
  const to = CONTACT_EMAILS.length ? CONTACT_EMAILS : ADMIN_EMAILS;
  const subject = "Zpráva z webu od " + m.name.slice(0, 60);
  const html = wrap(`
    <p><strong>Nová zpráva z kontaktního formuláře na webu</strong></p>
    <p>Od: ${escapeHtml(m.name)} (<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>)</p>
    <p style="white-space:pre-wrap;border-left:3px solid #ddd;margin:16px 0;padding:4px 0 4px 14px;">${escapeHtml(m.message)}</p>
    <p style="color:#888;font-size:13px;">Odpovědět můžete přímo na tento e-mail, odpověď půjde odesílateli.</p>
  `);
  await send(to, subject, html, { type: "contact_message" }, { replyTo: m.email });
}

// --- Přihlašovací odkaz (magic link) pro admina/člena ---
// Systémový e-mail, needitovatelný přes admin šablony (bezpečnostně citlivé).
export async function sendMagicLinkEmail(user: { name: string; email: string }, link: string) {
  const subject = "Přihlášení do rezervací — Ateliér na pobřeží";
  const html = wrap(`
    <p>Dobrý den${user.name ? ` ${user.name}` : ""},</p>
    <p>klikněte na tlačítko níže a budete přihlášeni. Odkaz platí 15 minut a jde použít jen jednou.</p>
    <p style="margin-top:20px;"><a href="${link}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Račte vstoupit</a></p>
    <p style="color:#888;font-size:13px;margin-top:16px;">Pokud jste o přihlášení nežádali, tento e-mail prostě ignorujte.</p>
  `);
  await send(user.email, subject, html, { type: "magic_link" });
}

// --- E-maily pro členy klubu (NÁVRH textů ke schválení Milanem) ---
// Vrací true, jen když e-mail opravdu odešel (podle toho se v administraci ukáže potvrzení).

// Tlačítko „Zaplatit členství“: plné černé. Tlačítko „Zaber si flek“: obrácené barvy (bílé s černým ohraničením).
const BTN_FILLED = "background:#111;color:#fff;border:2px solid #111;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;";
const BTN_OUTLINE = "background:#fff;color:#111;border:2px solid #111;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;";

// E-mail 1: po schválení žádosti (nebo ručním přidání placeného člena). Jen platba.
export async function sendMembershipPaymentEmail(user: { name: string; email: string }, payLink: string): Promise<boolean> {
  const subject = "Vaše žádost o členství je schválená";
  const html = wrap(`
    <p>Ahoj ${escapeHtml(user.name)}!</p>
    <p>Vítej v Klubu na pobřeží. Díky, že do toho jdeš.</p>
    <p>Kartou zaplatíš přes online platební bránu Stripe. Potom ti přijde potvrzení a odkaz na rezervaci místa v Klubu na pobřeží. S každou další měsíční platbou ti přijde e-mailem potvrzení. Pokud potřebuješ daňový doklad, napiš Milanovi. Členství můžeš kdykoliv zrušit v rezervačním systému.</p>
    <p style="margin-top:20px;"><a href="${payLink}" style="${BTN_FILLED}">Zaplatit členství</a></p>
    <p style="color:#888;font-size:13px;margin-top:10px;">Tenhle odkaz na platbu platí 30 dní.</p>
  `);
  return send(user.email, subject, html, { type: "membership_payment" });
}

// E-mail 2: po první zaplacené platbě (a hned po přidání člena zdarma). Přístup, jak se dostat dovnitř, tlačítko k rezervacím.
// Kódy ke schránce s klíči se do e-mailu ani do kódu nikdy nepíšou, posílá je Milan v SMS.
export async function sendMembershipAccessEmail(user: { name: string; email: string }, loginLink: string): Promise<boolean> {
  const subject = "Vítejte v Klubu na pobřeží 🎉";
  const html = wrap(`
    <p>Vítejte, přátelé, v Klubu na pobřeží. Díky, že do toho jdete. Krom jiného jste získali přístup do Ateliéru na pobřeží, kde si můžete <a href="${APP_URL}" style="color:#111;text-decoration:underline;">zarezervovat</a> místo nebo aktivitu, kdykoliv je v kalendáři volno.</p>
    <p>Do ateliéru se dostanete z ulice Na pobřeží, od kolejí. Na dveřích je poštovní schránka a v ní schránka s klíči. Kódy k ní vám pošleme v SMS.</p>
    <p style="margin-top:20px;"><a href="${loginLink}" style="${BTN_OUTLINE}">Zaber si flek</a></p>
    <p style="color:#888;font-size:13px;margin-top:10px;">Tlačítko vás rovnou přihlásí do rezervací. Odkaz platí 7 dní. Potom se stačí přihlásit zadáním e-mailu na rezervace.ateliernapobrezi.cz.</p>
  `);
  return send(user.email, subject, html, { type: "membership_access" });
}

// Přihlašovací odkaz platný 7 dní pro e-mail 2 (běžný přihlašovací odkaz platí jen 15 minut).
export async function membershipLoginLink(email: string): Promise<string> {
  const { createMagicLinkToken } = await import("./auth");
  const token = await createMagicLinkToken(email, "7d");
  return `${APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

// Uvítání ručně založeného účtu: admin dostane přihlášení, placený člen odkaz na platbu, člen zdarma rovnou přístup.
export async function sendWelcomeEmail(
  user: { name: string; email: string; role: "admin" | "member" },
  link: string,
  payLink?: string
): Promise<boolean> {
  if (payLink) return sendMembershipPaymentEmail(user, payLink);
  if (user.role === "member") return sendMembershipAccessEmail(user, await membershipLoginLink(user.email));
  const subject = "Máte přístup do rezervací — Ateliér na pobřeží";
  const html = wrap(`
    <p>Dobrý den ${escapeHtml(user.name)},</p>
    <p>právě jste dostali přístup do administrace rezervací Ateliéru na pobřeží.</p>
    <p style="margin-top:20px;"><a href="${link}" style="${BTN_FILLED}">Přihlásit se</a></p>
    <p style="color:#888;font-size:13px;margin-top:10px;">Odkaz platí 15 minut. Až vyprší, zadejte na přihlašovací stránce svůj e-mail a pošleme nový.</p>
  `);
  return send(user.email, subject, html, { type: "welcome" });
}

// Adminům: někdo požádal o členství na stránce /clenstvi.
export async function sendAdminMembershipRequestEmail(r: { name: string; email: string; phone: string | null; message: string | null }) {
  const subject = "Nová žádost o členství: " + r.name.slice(0, 60);
  const html = wrap(`
    <p><strong>Nová žádost o členství v klubu</strong></p>
    <p>Jméno: ${escapeHtml(r.name)}<br>E-mail: <a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>${r.phone ? "<br>Telefon: " + escapeHtml(r.phone) : ""}</p>
    ${r.message ? `<p style="white-space:pre-wrap;border-left:3px solid #ddd;margin:16px 0;padding:4px 0 4px 14px;">${escapeHtml(r.message)}</p>` : ""}
    <p style="margin-top:20px;"><a href="${APP_URL}/admin" style="${BTN_FILLED}">Otevřít a schválit</a></p>
    <p style="color:#888;font-size:13px;margin-top:10px;">V administraci otevřete Účty, nahoře uvidíte žádosti ke schválení.</p>
  `);
  await send(ADMIN_EMAILS, subject, html, { type: "membership_request", ...(r.email ? {} : {}) });
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
  if (isCourse) {
    // Kurz: vlastní šablona s názvem kurzu (bez interního názvu místnosti typu "Celý ateliér / kurz").
    await sendFromTemplate(
      "course_changed",
      contact,
      {
        courseTitle: after.title,
        beforeDate: fmtDate(before.date),
        beforeStart: before.startTime,
        beforeEnd: before.endTime,
        afterDate: fmtDate(after.date),
        afterStart: after.startTime,
        afterEnd: after.endTime,
      },
      { bookingId: after.id }
    );
    return;
  }
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

// --- Přihlášeným na kurz: admin změnil / zrušil termín (e-mail dostane obdarovaný, když ho známe, jinak kupující) ---
// Vrací počet odeslaných e-mailů. Adresy se nedublují (víc přihlášek stejného člověka dostane jeden e-mail).
export async function notifyCourseSignups(
  signups: CourseSignup[],
  send: (to: string) => Promise<void>,
  alreadyNotified: string[] = []
): Promise<number> {
  const seen = new Set(alreadyNotified.map((a) => a.toLowerCase()));
  let n = 0;
  for (const s of signups) {
    if (s.status !== "confirmed") continue;
    const to = signupNotifyTo(s);
    if (!to || seen.has(to.toLowerCase())) continue;
    seen.add(to.toLowerCase());
    await send(to);
    n++;
  }
  return n;
}

// --- Rezervistovi: admin zrušil rezervaci nebo termín kurzu ---
export async function sendBookingCancelledEmail(contact: string, booking: Booking) {
  const isCourse = booking.category === "kurz";
  if (isCourse) {
    await sendFromTemplate(
      "course_cancelled",
      contact,
      { courseTitle: booking.title, date: fmtDate(booking.date), startTime: booking.startTime, endTime: booking.endTime },
      { bookingId: booking.id }
    );
    return;
  }
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
      contact: signup.phone ? `${signup.contact}, tel. ${signup.phone}` : signup.contact,
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
    `<p>Dobrý den,</p><p>vaše přihláška na kurz <strong>${booking.title}</strong> (${fmtDate(booking.date)}, ${booking.startTime}–${booking.endTime}) byla stornována.</p>${refundLine}<p>V případě dotazů nám napište odpovědí na tento e-mail.</p>`
  );
  const to = signupNotifyTo(signup);
  if (!to) return;
  await send(to, "Storno přihlášky na kurz", html, { type: "signup_cancelled", bookingId: booking.id, signupId: signup.id });
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

// Odkaz na mapu je vlastní, aby si adresu Gmail nepřevedl na špatně ohraničený odkaz.
const STUDIO_MAP_URL = "https://mapy.com/cs/zakladni?q=" + encodeURIComponent("Na pobřeží 67, Kolín");
const STUDIO_INFO_HTML =
  `<p><strong>Kde nás najdete:</strong> <a href="${STUDIO_MAP_URL}">Ateliér na pobřeží, Na pobřeží 67, Kolín</a> (areál bývalé továrny Kolinea).</p>` +
  `<p><strong>Co s sebou:</strong> pohodlné oblečení, které může být od hlíny. Materiál a pomůcky zajišťujeme.</p>`;

function emailButton(href: string, label: string) {
  return `<p style="margin:18px 0;"><a href="${href}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${esc(label)}</a></p>`;
}

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

// U poukazu s pevným termínem: komu se ozveme při změně termínu + odkaz na doplnění kontaktu na obdarovaného.
function voucherContactBlock(v: Voucher) {
  const got = [v.recipientEmail, v.recipientPhone].filter(Boolean).map((x) => esc(x as string));
  const text = got.length
    ? `<p><strong>Kontakt na obdarovaného:</strong> ${got.join(", ")}. Kdyby bylo potřeba termín změnit nebo někoho zastihnout, ozveme se na tento kontakt.</p>`
    : `<p><strong>Kontakt na obdarovaného zatím nemáme.</strong> Kdyby bylo potřeba termín změnit, ozveme se vám${v.buyerPhone ? " (tel. " + esc(v.buyerPhone) + ")" : ""}. Pokud nám dáte e-mail nebo telefon obdarovaného, dozví se o změně rovnou.</p>`;
  const btn = v.manageToken ? emailButton(`${APP_URL}/poukazy/kontakt?t=${encodeURIComponent(v.manageToken)}`, got.length ? "Změnit kontakt na obdarovaného" : "Doplnit kontakt na obdarovaného") : "";
  return text + btn;
}

// Kupujícímu po zaplacení: kód poukazu a jak ho uplatnit.
export async function sendVoucherEmail(v: Voucher, booking?: Booking) {
  const redeem = booking
    ? `<p>Obdarovaný už má na uvedený termín <strong>potvrzené místo</strong>, nemusí nic dalšího řešit. Při příchodu stačí zmínit kód poukazu.</p>` +
      STUDIO_INFO_HTML +
      voucherContactBlock(v)
    : `<p>Termín zatím není zvolený. Obdarovaný si ho vybere sám, stačí kliknout na tlačítko níže. Kód se doplní automaticky a místo bude hned potvrzené.</p>` +
      emailButton(`${APP_URL}/kurzy?poukaz=${encodeURIComponent(v.code)}`, "Využít poukaz a vybrat termín") +
      `<p style="color:#666;font-size:13px;">Kdyby tlačítko nešlo otevřít, zadá kód <strong>${esc(v.code)}</strong> ručně na <a href="${APP_URL}/kurzy">rezervace.ateliernapobrezi.cz/kurzy</a>.</p>`;
  const msg = v.message ? `<p>Vzkaz od kupujícího:<br><em>${esc(v.message)}</em></p>` : "";
  const html = wrap(
    `<p>Dobrý den,</p>` +
      `<p>děkujeme za objednávku, platba proběhla v pořádku. Váš dárkový poukaz v hodnotě <strong>${fmtKc(v.amountCzk)}</strong>:</p>` +
      `<p style="margin:16px 0 4px;color:#666;font-size:13px;">Kód poukazu</p>` +
      `<p style="display:inline-block;margin:0 0 16px;padding:12px 20px;border:2px solid #111;border-radius:8px;font-size:22px;letter-spacing:2px;"><strong>${esc(v.code)}</strong></p>` +
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
      `<p>Kupující: ${esc(v.buyerName)}, ${esc(v.buyerEmail)}${v.buyerPhone ? ", tel. " + esc(v.buyerPhone) : ""}</p>` +
      (v.recipientEmail || v.recipientPhone ? `<p>Obdarovaný: ${[v.recipientName, v.recipientEmail, v.recipientPhone].filter(Boolean).map((x) => esc(x as string)).join(", ")}</p>` : "") +
      (v.message ? `<p>Vzkaz: ${esc(v.message)}</p>` : "") +
      warn +
      `<p><a href="${APP_URL}/admin">Otevřít admin</a></p>`
  );
  await send(ADMIN_EMAILS, "Nový dárkový poukaz " + v.code, html, { type: "voucher_admin", bookingId: opts.booking?.id });
}

// Adminům: kupující doplnil nebo změnil kontakt na obdarovaného.
export async function sendAdminVoucherContactEmail(v: Voucher, booking?: Booking) {
  const html = wrap(
    `<p>U poukazu <strong>${esc(v.code)}</strong>${booking ? " (termín " + fmtDate(booking.date) + ", " + booking.startTime + "–" + booking.endTime + ")" : ""} byl doplněn kontakt na obdarovaného.</p>` +
      `<p>${[v.recipientName, v.recipientEmail, v.recipientPhone].filter(Boolean).map((x) => esc(x as string)).join(", ")}</p>` +
      `<p><a href="${APP_URL}/admin">Otevřít admin</a></p>`
  );
  await send(ADMIN_EMAILS, "Doplněn kontakt na obdarovaného: " + v.code, html, { type: "voucher_contact_admin", bookingId: booking?.id });
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

// Kurz zaplacený online: jediný e-mail zákazníkovi (potvrzení místa + platba).
// Text je v šablonách (admin → E-maily, klíč course_paid); schválil Milan 2026-11-11 (bez zmínky o dokladu a vracení peněz, to je v obchodních podmínkách).
function weekdayCz(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function shortTime(t: string) {
  return t.replace(/^0/, "");
}

export async function sendCoursePaidEmail(booking: Booking, signup: CourseSignup, amountCzk: number, castingCount = 0) {
  const to = signupNotifyTo(signup);
  if (!to) return;
  const people = signup.people + " " + (signup.people === 1 ? "osoba" : signup.people <= 4 ? "osoby" : "osob");
  const stamp = (date: string, time: string) => date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
  const calUrl =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: booking.title + " – Ateliér na pobřeží",
      dates: stamp(booking.date, booking.startTime) + "/" + stamp(booking.date, booking.endTime),
      ctz: "Europe/Prague",
      location: "Ateliér na pobřeží, Na pobřeží 67, Kolín",
      details: "Pohodlné oblečení, které může být od hlíny. Materiál a pomůcky zajišťujeme.",
    }).toString();
  await sendFromTemplate(
    "course_paid",
    to,
    {
      courseTitle: booking.title,
      weekday: weekdayCz(booking.date),
      date: fmtDate(booking.date),
      startTime: shortTime(booking.startTime),
      endTime: shortTime(booking.endTime),
      amount: fmtKc(amountCzk),
      people,
      castingNote: castingCount > 0 ? ", včetně " + castingText(castingCount) : "",
      calendarUrl: calUrl.replace(/&/g, "&amp;"),
    },
    { bookingId: booking.id, signupId: signup.id },
    `<p style="margin:4px 0 0;color:#888;font-size:12px;">Objednáním kurzu souhlasíte s <a href="https://ateliernapobrezi.cz/obchodni-podminky" style="color:#888;">obchodními podmínkami</a>.</p>`
  );
}

// --- Doklady k platbám ---
const DOKLAD_NOTE = `<p style="font-size:13px;color:#555;">Potvrzení o platbě ze Stripe není daňový doklad. Daňový doklad (fakturu) vám zašleme samostatně.</p>`;

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
  const membership = item.kind === "clenstvi";
  const html = wrap(
    `<p><strong>Vystavte daňový doklad v Caflou.</strong></p>` +
      `<p>Odběratel: ${esc(b?.company || b?.name || "—")}${b?.company && b?.name ? `<br>Kontaktní osoba: ${esc(b.name)}` : ""}<br>E-mail: ${esc(b?.email || "—")}<br>Adresa: ${esc(addr || (item.amountCzk <= SIMPLIFIED_LIMIT_CZK ? `neuvedena (zjednodušený doklad do ${SIMPLIFIED_LIMIT_CZK.toLocaleString("cs-CZ").replace(/\u00a0/g, " ")} Kč)` : "—"))}<br>${ids ? esc(ids) : "IČO/DIČ: neuvedeno (nejspíš fyzická osoba)"}</p>` +
      (icoMissing(b) ? `<p style="background:#fff4d6;padding:8px;"><strong>Pozor: chybí IČO.</strong> Zákazník nakupuje na firmu, ale IČO nevyplnil. Dohledejte ho v ARES (Caflou ho umí načíst podle názvu nebo DIČ).</p>` : "") +
      `<p>Položka: ${esc(item.description)}<br>Celkem vč. DPH 21 %: <strong>${fmtCzk(item.amountCzk)}</strong><br>Základ: ${fmtCzk(item.baseCzk)} · DPH: ${fmtCzk(item.vatCzk)}<br>Datum přijetí platby (DUZP): <strong>${paid}</strong><br>Stripe: ${esc(item.id)}</p>` +
      `<p>Doklad je už zaplacený (${membership ? "měsíční platba členství, Stripe" : "kartou, Stripe"}). Po vystavení ho v adminu odškrtněte tlačítkem „Vystaveno“.</p>` +
      emailButton(`${APP_URL}/admin`, "Otevřít frontu dokladů")
  );
  await send(INVOICE_EMAILS, "Doklad k vystavení: " + who + ", " + fmtCzk(item.amountCzk) + (membership ? " (členství)" : ""), html, { type: "invoice_basis" });
}
