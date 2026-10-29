// Čisté pomocné funkce pro kontakty u přihlášek (bez DB, smí se importovat i v prohlížeči).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(s: string | undefined | null): boolean {
  return !!s && EMAIL_RE.test(s.trim());
}

// Telefon: povolí +, mezery, pomlčky, závorky; musí mít 9 až 15 číslic. Vrací vyčištěný tvar, nebo null.
export function cleanPhone(s: string | undefined | null): string | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (!/^[+0-9 ()\-./]+$/.test(t)) return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return t.replace(/\s+/g, " ").slice(0, 30);
}

// Kam poslat změnu termínu / storno: e-mail obdarovaného, jinak kontakt v přihlášce, pokud je to e-mail.
export function signupNotifyTo(s: { contact: string; notifyEmail?: string }): string | null {
  if (validEmail(s.notifyEmail)) return s.notifyEmail!.trim();
  return validEmail(s.contact) ? s.contact.trim() : null;
}
