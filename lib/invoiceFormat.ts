// Čisté pomocné funkce pro zobrazení fakturačních údajů (bez DB, smí se importovat i v prohlížeči).

export interface BillingLike {
  name: string;
  company?: string;
  ico?: string;
  address: { line1?: string; line2?: string; city?: string; postalCode?: string; country?: string };
  taxIds: { type: string; value: string }[];
}

const COUNTRIES: Record<string, string> = { CZ: "Česko", SK: "Slovensko", DE: "Německo", AT: "Rakousko", PL: "Polsko" };

export function countryName(code?: string): string {
  if (!code) return "";
  return COUNTRIES[code.toUpperCase()] ?? code;
}

// Stripe ukládá české DIČ jako typ eu_vat (nebo cz_vat) s hodnotou CZ12345678.
export function taxIdLabel(t: { type: string; value: string }): string {
  const isCz = t.type === "cz_vat" || (t.type === "eu_vat" && t.value.toUpperCase().startsWith("CZ"));
  if (isCz) return "DIČ";
  if (t.type === "eu_vat") return "VAT ID";
  return t.type;
}

export function addressLine(a: BillingLike["address"] | undefined): string {
  if (!a) return "";
  return [a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(" "), countryName(a.country)].filter(Boolean).join(", ");
}

// "IČO 12345678 · DIČ CZ12345678" (prázdné, když nic není).
export function idsLine(b: BillingLike | null | undefined): string {
  if (!b) return "";
  const parts: string[] = [];
  if (b.ico) parts.push("IČO " + b.ico);
  for (const t of b.taxIds) parts.push(taxIdLabel(t) + " " + t.value);
  return parts.join(" · ");
}

// 2026-10-31 -> 31. 10. 2026
export function czDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Number(m[3]) + ". " + Number(m[2]) + ". " + m[1] : iso;
}

// Skloňování pro "Zbývá 1 volné místo / Zbývají 2 volná místa / Zbývá 5 volných míst".
export function spotsPhrase(n: number): { remaining: string; places: string } {
  if (n === 1) return { remaining: "Zbývá", places: "volné místo" };
  if (n >= 2 && n <= 4) return { remaining: "Zbývají", places: "volná místa" };
  return { remaining: "Zbývá", places: "volných míst" };
}
