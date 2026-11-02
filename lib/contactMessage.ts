import { createHash } from "crypto";
import { sql, ensureSchema } from "./db";
import { validEmail } from "./signupContact";

// Zprávy z kontaktního formuláře na hlavním webu (ateliernapobrezi.cz/kontakt).

export const CONTACT_LIMITS = {
  nameMax: 100,
  emailMax: 200,
  messageMin: 5,
  messageMax: 3000,
  // Omezení počtu zpráv za hodinu: z jedné IP, z jednoho e-mailu a celkem.
  perIpPerHour: 5,
  perEmailPerHour: 3,
  totalPerHour: 60,
  // Víc odkazů než tohle je skoro jistě spam.
  maxLinks: 2,
};

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export type ContactValidation = { ok: true; value: ContactInput } | { ok: false; error: string };

// Vyčistí řídicí znaky a zbytečné mezery. U zprávy zachová odřádkování.
function clean(s: unknown, multiline: boolean): string {
  let t = String(s ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (!multiline) t = t.replace(/\s+/g, " ");
  else t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

export function validateContact(body: unknown): ContactValidation {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = clean(b.name, false);
  const email = clean(b.email, false);
  const message = clean(b.message, true);

  if (!name) return { ok: false, error: "Vyplňte prosím jméno." };
  if (name.length > CONTACT_LIMITS.nameMax) return { ok: false, error: "Jméno je moc dlouhé." };
  if (!email || email.length > CONTACT_LIMITS.emailMax || !validEmail(email)) {
    return { ok: false, error: "E-mail nevypadá správně." };
  }
  if (message.length < CONTACT_LIMITS.messageMin) {
    return { ok: false, error: "Napište nám prosím aspoň pár slov." };
  }
  if (message.length > CONTACT_LIMITS.messageMax) {
    return { ok: false, error: "Zpráva je moc dlouhá. Zkraťte ji prosím nebo nám napište e-mailem." };
  }
  return { ok: true, value: { name, email, message } };
}

// Hodně odkazů ve zprávě = nejspíš spam.
export function looksLikeSpam(message: string): boolean {
  const links = (message.match(/https?:\/\/|www\./gi) || []).length;
  return links > CONTACT_LIMITS.maxLinks;
}

// IP se neukládá, jen nevratný otisk (kvůli omezení počtu zpráv).
export function hashIp(ip: string | null | undefined): string | null {
  const v = (ip || "").trim();
  if (!v) return null;
  return createHash("sha256").update(v + (process.env.CONTACT_IP_SALT || "atelier")).digest("hex").slice(0, 32);
}

export async function saveContactMessage(input: ContactInput, ipHash: string | null): Promise<string> {
  await ensureSchema();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO contact_messages (id, name, email, message, ip_hash, created_at)
    VALUES (${id}, ${input.name}, ${input.email.toLowerCase()}, ${input.message}, ${ipHash}, now())
  `;
  return id;
}

// true = limit je překročený a zprávu je potřeba odmítnout.
export async function isRateLimited(email: string, ipHash: string | null): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE email = ${email.toLowerCase()})::int AS by_email,
      count(*) FILTER (WHERE ${ipHash}::text IS NOT NULL AND ip_hash = ${ipHash})::int AS by_ip
    FROM contact_messages
    WHERE created_at > now() - interval '1 hour'
  `;
  const r = rows[0] as { total: number; by_email: number; by_ip: number };
  return (
    r.total >= CONTACT_LIMITS.totalPerHour ||
    r.by_email >= CONTACT_LIMITS.perEmailPerHour ||
    r.by_ip >= CONTACT_LIMITS.perIpPerHour
  );
}
