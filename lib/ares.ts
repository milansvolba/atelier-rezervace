// Dohledání firmy v ARES (veřejný rejstřík ekonomických subjektů) podle IČO.

export interface AresCompany {
  company: string;
  street: string;
  zip: string;
  city: string;
  dic?: string;
}

// Zpracuje odpověď ARES REST API (ekonomicke-subjekty/{ico}); úmyslně defenzivně, formát se může lišit.
export function parseAres(json: unknown): AresCompany | null {
  const j = json as {
    obchodniJmeno?: string;
    dic?: string;
    sidlo?: {
      nazevUlice?: string;
      nazevObce?: string;
      nazevCastiObce?: string;
      cisloDomovni?: number | string;
      cisloOrientacni?: number | string;
      cisloOrientacniPismeno?: string;
      psc?: number | string;
    };
  } | null;
  if (!j || !j.obchodniJmeno) return null;
  const s = j.sidlo ?? {};
  const number = s.cisloDomovni
    ? String(s.cisloDomovni) + (s.cisloOrientacni ? "/" + s.cisloOrientacni + (s.cisloOrientacniPismeno ?? "") : "")
    : "";
  // Obce bez ulic: adresa je "část obce + číslo popisné".
  const streetName = s.nazevUlice || s.nazevCastiObce || s.nazevObce || "";
  const street = [streetName, number].filter(Boolean).join(" ").trim();
  const zipRaw = s.psc ? String(s.psc).padStart(5, "0") : "";
  return {
    company: j.obchodniJmeno.trim(),
    street,
    zip: zipRaw ? zipRaw.slice(0, 3) + " " + zipRaw.slice(3) : "",
    city: s.nazevObce ?? "",
    dic: j.dic ? String(j.dic).toUpperCase() : undefined,
  };
}

export async function fetchAres(ico: string): Promise<AresCompany | null> {
  const res = await fetch("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/" + encodeURIComponent(ico), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return parseAres(await res.json());
}
