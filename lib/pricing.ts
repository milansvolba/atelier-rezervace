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

// Cena betonového odlitku za osobu podle názvu kurzu (Kč vč. DPH); null = odlitek není v nabídce.
export function castingPriceFor(title: string): number | null {
  const t = title.toLowerCase();
  if (t.includes("hlav")) return 3900;
  if (t.includes("reli")) return 3100;
  return null;
}

export interface OrderPrice {
  discountPercent: number;
  courseBefore: number;
  courseAfter: number;
  castingTotal: number;
  total: number;
}

// Slevu dostává jen cena kurzu; odlitek se počítá za každého účastníka bez slevy.
export function computeOrder(pricePerPerson: number, people: number, withCasting: boolean, castingPrice: number): OrderPrice {
  const discountPercent = groupDiscountPercent(people);
  const courseBefore = pricePerPerson * people;
  const courseAfter = Math.round(courseBefore * (1 - discountPercent / 100));
  const castingTotal = withCasting ? castingPrice * people : 0;
  return { discountPercent, courseBefore, courseAfter, castingTotal, total: courseAfter + castingTotal };
}

// Kurzy, na které lze koupit dárkový poukaz: základní cena za 1 osobu (vc. DPH, bez slevy) a cena odlitku.
// "match" je část názvu termínu kurzu v rezervačním kalendáři, podle které se termíny přiřazují.
export const VOUCHER_COURSES = [
  { key: "hlava", title: "Modelování hlavy", pricePerPerson: 8270, castingPrice: 3900, match: "hlav" },
  { key: "relief", title: "Modelování reliéfu", pricePerPerson: 6470, castingPrice: 3100, match: "reli" },
] as const;

export function voucherCourse(key: string) {
  return VOUCHER_COURSES.find((c) => c.key === key) ?? null;
}
