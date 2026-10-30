// Ceny kurzů: množstevní slevy podle počtu lidí v objednávce a volitelný betonový odlitek.
// Společné pro server (výpočet částky do Stripe) i průvodce objednávkou (zobrazení ceny).

export const GROUP_DISCOUNTS = [
  { minPeople: 5, percent: 15 },
  { minPeople: 3, percent: 10 },
  { minPeople: 2, percent: 5 },
];

export function groupDiscountPercent(people: number): number {
  const m = GROUP_DISCOUNTS.find((d) => people >= d.minPeople);
  return m ? m.percent : 0;
}

// Typ kurzu termínu: klíč z VOUCHER_COURSES, nebo "none" = jednorázový kurz mimo web (bez poukazu a odlitku).
// Starší termíny bez uloženého typu se rozpoznají podle názvu (jako dřív), nový typ má přednost.
export const COURSE_TYPE_NONE = "none";

export function courseTypeKey(b: { title: string; courseType?: string | null }): string {
  if (b.courseType) return b.courseType;
  const t = b.title.toLowerCase();
  if (t.includes("hlav")) return "hlava";
  if (t.includes("reli")) return "relief";
  return COURSE_TYPE_NONE;
}

export function isValidCourseType(v: unknown): v is string {
  return typeof v === "string" && (v === COURSE_TYPE_NONE || VOUCHER_COURSES.some((c) => c.key === v));
}

// Cena betonového odlitku za osobu podle typu kurzu (Kč vč. DPH); null = odlitek není v nabídce.
export function castingPriceForType(typeKey: string): number | null {
  return VOUCHER_COURSES.find((c) => c.key === typeKey)?.castingPrice ?? null;
}

export function castingPriceFor(b: { title: string; courseType?: string | null }): number | null {
  return castingPriceForType(courseTypeKey(b));
}

export interface OrderPrice {
  discountPercent: number;
  courseBefore: number;
  courseAfter: number;
  castingTotal: number;
  total: number;
}

// Slevu dostává jen cena kurzu; odlitek se počítá za každý objednaný kus (0 až počet osob) bez slevy.
// Počet odlitků z požadavku: true = pro všechny (starší klient), číslo = tolik odlitků, vždy 0 až počet osob.
export function clampCastings(raw: unknown, people: number): number {
  if (raw === true) return people;
  const n = Math.floor(Number(raw) || 0);
  return Math.max(0, Math.min(people, n));
}

export function computeOrder(pricePerPerson: number, people: number, castings: number, castingPrice: number): OrderPrice {
  const discountPercent = groupDiscountPercent(people);
  const courseBefore = pricePerPerson * people;
  const courseAfter = Math.round(courseBefore * (1 - discountPercent / 100));
  const castingTotal = castingPrice * Math.max(0, Math.min(people, castings));
  return { discountPercent, courseBefore, courseAfter, castingTotal, total: courseAfter + castingTotal };
}

// Kurzy, na které lze koupit dárkový poukaz: základní cena za 1 osobu (vc. DPH, bez slevy) a cena odlitku.
// "match" slouží už jen jako záloha pro starší termíny bez typu (viz courseTypeKey).
export const VOUCHER_COURSES = [
  { key: "hlava", title: "Modelování hlavy", pricePerPerson: 8270, castingPrice: 3900, match: "hlav" },
  { key: "relief", title: "Modelování reliéfu", pricePerPerson: 6470, castingPrice: 3100, match: "reli" },
] as const;

export function voucherCourse(key: string) {
  return VOUCHER_COURSES.find((c) => c.key === key) ?? null;
}
