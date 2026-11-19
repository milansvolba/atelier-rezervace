// Čisté pomocné funkce pro příjemce e-mailů správy (bez databáze, smí se importovat i v prohlížeči).

export type RecipientGroup = "admin" | "invoice" | "contact";

export const RECIPIENT_GROUPS: { key: RecipientGroup; label: string; help: string }[] = [
  {
    key: "admin",
    label: "Upozornění pro správce",
    help: "Nové žádosti o pronájem a kurz, přihlášky, zaplacené a uplatněné poukazy, poptávky firem, upozornění na slevové kódy.",
  },
  {
    key: "invoice",
    label: "Podklady k dokladům",
    help: "E-mail „Doklad k vystavení“ (firmy a členství), podle kterého se vystavuje faktura v Caflou.",
  },
  {
    key: "contact",
    label: "Zprávy z kontaktního formuláře",
    help: "Zprávy z webu. Když nic nevyplníte, chodí stejným lidem jako upozornění pro správce.",
  },
];

export const MAX_RECIPIENTS = 10;

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Rozdělí text s adresami (oddělené čárkou, středníkem, mezerou nebo novým řádkem).
// Adresy převede na malá písmena a odstraní duplicity; neplatné vrátí zvlášť.
export function parseEmailList(text: string): { emails: string[]; invalid: string[] } {
  const parts = String(text ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (!EMAIL_RE.test(p) || p.length > 254) {
      invalid.push(p);
      continue;
    }
    const lower = p.toLowerCase();
    if (!emails.includes(lower)) emails.push(lower);
  }
  return { emails, invalid };
}
