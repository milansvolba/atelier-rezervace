import { Resend } from "resend";
import { Booking, CourseSignup, RESOURCE_LABELS } from "./types";
import { getTemplate, renderTemplate } from "./emailTemplates";
import { logEmail } from "./emailLog";

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
export async function sendWelcomeEmail(user: { name: string; email: string; role: "admin" | "member" }, link: string) {
  const subject = "Vítejte v Atelieru na Pobřeží! 🎉";
  const html = wrap(`
    <p>Ahoj ${user.name}!</p>
    <p>Právě jsi dostal/a přístup do rezervačního systému Atelieru na Pobřeží 🎨.</p>
    <p style="margin-top:16px;">Teď si můžeš rezervovat místo:</p>
    <p style="margin-top:10px;"><a href="${link}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Zaber si flek</a></p>
    <p style="color:#888;font-size:13px;margin-top:16px;">Tenhle odkaz platí 15 minut. Až vyprší, stačí na přihlašovací stránce znovu zadat svůj e-mail a pošleme nový.</p>
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
