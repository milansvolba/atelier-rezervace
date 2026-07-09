// Sdílené pomocné funkce pro práci s kalendářem (veřejná stránka i admin).

export const DAY_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
export const DAY_NAMES_MON_FIRST = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
export const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

// POZOR: záměrně NEpoužívá toISOString() — ten převádí na UTC a podle časového
// pásma/hodiny prohlížeče by mohl posunout kalendářní den o jeden vpřed/vzad
// (typicky kolem půlnoci). Bereme rovnou lokální rok/měsíc/den tak, jak je
// uživatel v prohlížeči vidí.
export function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function nextDays(n: number, from: Date = new Date()) {
  const days = [];
  for (let i = 0; i < n; i++) days.push(addDays(from, i));
  return days;
}

// Pondělí týdne, ve kterém leží zadané datum.
export function startOfWeekMon(d: Date) {
  const offset = (d.getDay() + 6) % 7; // 0 = pondělí
  return addDays(d, -offset);
}

// Mřížka dnů pro daný měsíc, pondělím počínaje, s vyplňovacími dny okolních měsíců.
export function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
