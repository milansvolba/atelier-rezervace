// Klientsky bezpečné konstanty poukazů (lib/vouchers.ts importuje databázi, tak ho do prohlížeče nepouštíme).
export const VOUCHER_VALID_MONTHS = 12;

// Slovní podoba počtu odlitků pro 2. pád ("včetně 2 betonových odlitků").
export function castingText(n: number): string {
  return n === 1 ? "1 betonového odlitku" : n + " betonových odlitků";
}
