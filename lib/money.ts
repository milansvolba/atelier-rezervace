// Částka ve tvaru "8 270 Kč" (pevná mezera u tisíců, podle DESIGN.md sekce 6). Bez dalších závislostí, použitelné i v klientských stránkách.
export function kc(n: number): string {
  return Math.round(n).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }).replace(/[   ]/g, " ") + " Kč";
}
// Jen číslo s mezerou u tisíců (pro texty, kde "Kč" následuje ve vlastním textu).
export function num(n: number): string {
  return Math.round(n).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }).replace(/[   ]/g, " ");
}
