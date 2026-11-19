import { sql, ensureSchema } from "./db";
import { RecipientGroup, parseEmailList } from "./recipients";

// Nastavení uložená v databázi (tabulka app_settings, klíč → hodnota). Dnes jen příjemci e-mailů správy,
// ale tabulka je obecná, takže další nastavení nevyžadují změnu databáze.
//
// Pravidlo pro příjemce: hodnota z administrace má přednost. Když není vyplněná (nebo databáze nejde přečíst),
// použije se záložní hodnota z proměnné prostředí ve Vercelu a nakonec výchozí adresa v kódu.
// Díky tomu e-mail nikdy nezůstane bez příjemce a před prvním uložením se nic nezmění.

const KEYS: Record<RecipientGroup, string> = {
  admin: "recipients.admin",
  invoice: "recipients.invoice",
  contact: "recipients.contact",
};

function envList(name: string, fallback: string): string[] {
  return parseEmailList(process.env[name] || fallback).emails;
}

// Záložní hodnoty bez databáze: proměnné z Vercelu, jinak výchozí adresy v kódu.
function fallbackFor(group: RecipientGroup): string[] {
  if (group === "admin") return envList("ADMIN_EMAILS", "milan.svolba@gmail.com,petr.svolba@gmail.com");
  if (group === "invoice") return envList("INVOICE_EMAILS", "milan.svolba@gmail.com");
  const contactEnv = envList("CONTACT_EMAILS", "");
  return contactEnv.length ? contactEnv : fallbackFor("admin");
}

async function readStored(): Promise<Record<RecipientGroup, { emails: string[]; updatedAt: string | null; updatedBy: string | null }>> {
  const empty = { emails: [] as string[], updatedAt: null as string | null, updatedBy: null as string | null };
  const result = { admin: { ...empty }, invoice: { ...empty }, contact: { ...empty } };
  await ensureSchema();
  const rows = await sql`SELECT key, value, updated_at, updated_by FROM app_settings WHERE key LIKE 'recipients.%'`;
  for (const r of rows) {
    const group = (Object.keys(KEYS) as RecipientGroup[]).find((g) => KEYS[g] === r.key);
    if (!group) continue;
    result[group] = {
      emails: parseEmailList(String(r.value ?? "")).emails,
      updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
      updatedBy: (r.updated_by as string | null) ?? null,
    };
  }
  return result;
}

// Komu se má e-mail dané skupiny poslat právě teď. Nikdy nehází výjimku a nikdy nevrátí prázdný seznam.
export async function getRecipients(group: RecipientGroup): Promise<string[]> {
  try {
    const stored = await readStored();
    if (stored[group].emails.length) return stored[group].emails;
    // Zprávy z kontaktu bez vlastního nastavení chodí stejným lidem jako upozornění pro správce (včetně jejich nastavení).
    if (group === "contact") {
      const contactEnv = envList("CONTACT_EMAILS", "");
      if (contactEnv.length) return contactEnv;
      return stored.admin.emails.length ? stored.admin.emails : fallbackFor("admin");
    }
  } catch (e) {
    console.error("[settings] Příjemce e-mailů se nepodařilo načíst z databáze, použije se záložní hodnota:", e);
  }
  return fallbackFor(group);
}

export interface RecipientSetting {
  group: RecipientGroup;
  stored: string[];
  effective: string[];
  source: "settings" | "fallback";
  updatedAt: string | null;
  updatedBy: string | null;
}

// Pro stránku v administraci: uložená hodnota, to, co se opravdu používá, a odkud to je.
export async function getRecipientSettings(): Promise<RecipientSetting[]> {
  const stored = await readStored();
  const groups: RecipientGroup[] = ["admin", "invoice", "contact"];
  return groups.map((group) => {
    const own = stored[group].emails;
    let effective = own;
    if (!own.length) {
      if (group === "contact") {
        const contactEnv = envList("CONTACT_EMAILS", "");
        effective = contactEnv.length ? contactEnv : stored.admin.emails.length ? stored.admin.emails : fallbackFor("admin");
      } else {
        effective = fallbackFor(group);
      }
    }
    return {
      group,
      stored: own,
      effective,
      source: own.length ? "settings" : "fallback",
      updatedAt: stored[group].updatedAt,
      updatedBy: stored[group].updatedBy,
    };
  });
}

// Uloží příjemce dané skupiny. Prázdný seznam smaže vlastní nastavení (vrátí se záložní hodnota).
export async function saveRecipients(group: RecipientGroup, emails: string[], updatedBy: string): Promise<void> {
  await ensureSchema();
  const key = KEYS[group];
  if (!emails.length) {
    await sql`DELETE FROM app_settings WHERE key = ${key}`;
    return;
  }
  await sql`
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES (${key}, ${emails.join(", ")}, now(), ${updatedBy})
    ON CONFLICT (key) DO UPDATE SET value = ${emails.join(", ")}, updated_at = now(), updated_by = ${updatedBy}
  `;
}
