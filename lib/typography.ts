// České typografické pravidlo: za jednopísmennými předložkami a spojkami (k, s, v, z, o, u, a, i) a mezi číslem
// a následujícím slovem (včetně dat „20. 2. 2027“) nesmí vzniknout zalomení řádku. Nahrazuje mezeru pevnou mezerou.
const NBSP = " ";
export function typo(s: string): string {
  return s
    .replace(/(^|[\s(])([kKsSvVzZoOuUaAiI]) (?=\S)/g, "$1$2" + NBSP)
    .replace(/(^|[\s(])(pro|až|do|od|za) (?=\d)/gi, "$1$2" + NBSP)
    .replace(/(\d\.?) (?=[\dA-Za-zÁ-ž])/g, "$1" + NBSP);
}
