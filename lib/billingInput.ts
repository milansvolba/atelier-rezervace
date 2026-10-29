// Fakturační údaje, které zákazník zadává přímo v našem formuláři (kurzy i poukazy) před přesměrováním na Stripe.
// Čisté funkce bez DB a bez Node API, smí se importovat i v prohlížeči.

export interface BillingInput {
  isCompany: boolean;
  company?: string;
  ico?: string;
  dic?: string;
  street?: string;
  zip?: string;
  city?: string;
}

// Zjednodušený daňový doklad lze vystavit jen do této částky vč. DPH (§30 zákona o DPH); nad ni potřebujeme adresu odběratele.
// Hranici i pravidlo má potvrdit účetní.
export const SIMPLIFIED_LIMIT_CZK = 10000;

export const emptyBilling: BillingInput = { isCompany: false };

// Kontrolní součet IČO (8 číslic, modulo 11).
export function icoValid(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(ico[i]) * (8 - i);
  const r = sum % 11;
  const c = r === 0 ? 1 : r === 1 ? 0 : 11 - r;
  return c === Number(ico[7]);
}

export function normalizeIco(v: string): string {
  return v.replace(/\s+/g, "");
}

export function normalizeDic(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

// Potřebuje soukromá osoba u této částky uvést adresu?
export function needsPrivateAddress(totalCzk: number): boolean {
  return totalCzk > SIMPLIFIED_LIMIT_CZK;
}

function clean(v: unknown, max = 120): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export type BillingResult = { ok: true; value: BillingInput | null } | { ok: false; error: string };

// Zkontroluje údaje z formuláře. Firma: vše kromě DIČ povinné. Soukromá osoba: adresa povinná jen nad limitem zjednodušeného dokladu.
export function parseBillingInput(raw: unknown, totalCzk: number): BillingResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const isCompany = r.isCompany === true;
  const street = clean(r.street);
  const zip = clean(r.zip, 10);
  const city = clean(r.city);
  const hasAddress = !!(street && zip && city);

  if (isCompany) {
    const company = clean(r.company, 200);
    const ico = normalizeIco(clean(r.ico, 12));
    const dic = normalizeDic(clean(r.dic, 16));
    if (company.length < 2) return { ok: false, error: "Vyplňte prosím název firmy." };
    if (!icoValid(ico)) return { ok: false, error: "IČO nevypadá správně. Zkontrolujte ho prosím (8 číslic)." };
    if (dic && !/^[A-Z]{2}[0-9A-Z]{2,12}$/.test(dic)) return { ok: false, error: "DIČ zadejte ve tvaru CZ12345678." };
    if (!hasAddress) return { ok: false, error: "Vyplňte prosím adresu firmy (ulice, PSČ, město)." };
    return { ok: true, value: { isCompany: true, company, ico, dic: dic || undefined, street, zip, city } };
  }

  if (needsPrivateAddress(totalCzk) && !hasAddress) {
    return { ok: false, error: "U objednávky nad " + SIMPLIFIED_LIMIT_CZK.toLocaleString("cs-CZ") + " Kč potřebujeme pro daňový doklad vaši adresu (ulice, PSČ, město)." };
  }
  return { ok: true, value: hasAddress ? { isCompany: false, street, zip, city } : null };
}
