import { sql, ensureSchema } from "./db";

export interface DiscountTier {
  id: string;
  minFillPercent: number;
  discountPercent: number;
  sortOrder: number;
}

function rowToTier(r: Record<string, unknown>): DiscountTier {
  return {
    id: r.id as string,
    minFillPercent: r.min_fill_percent as number,
    discountPercent: r.discount_percent as number,
    sortOrder: r.sort_order as number,
  };
}

export const discountStore = {
  async all(): Promise<DiscountTier[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM discount_tiers ORDER BY sort_order`;
    return rows.map(rowToTier);
  },

  async upsert(t: DiscountTier): Promise<DiscountTier> {
    await ensureSchema();
    await sql`
      INSERT INTO discount_tiers (id, min_fill_percent, discount_percent, sort_order, updated_at)
      VALUES (${t.id}, ${t.minFillPercent}, ${t.discountPercent}, ${t.sortOrder}, now())
      ON CONFLICT (id) DO UPDATE SET
        min_fill_percent = ${t.minFillPercent},
        discount_percent = ${t.discountPercent},
        sort_order = ${t.sortOrder},
        updated_at = now()
    `;
    return t;
  },

  async remove(id: string): Promise<void> {
    await ensureSchema();
    await sql`DELETE FROM discount_tiers WHERE id = ${id}`;
  },
};

// Vrátí procento slevy pro danou naplněnost skupiny (0-100).
// Tiers jsou seřazené podle min_fill_percent sestupně — vezme první tier, kam se fillPercent vejde.
export function computeDiscountPercent(fillPercent: number, tiers: DiscountTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.minFillPercent - a.minFillPercent);
  const match = sorted.find((t) => fillPercent >= t.minFillPercent);
  return match ? match.discountPercent : 0;
}

// Naplněnost skupiny v procentech vzhledem ke kapacitě termínu (0-100).
export function fillPercentFor(people: number, capacity: number | null): number {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(100, Math.round((people / capacity) * 100));
}

export interface PriceBreakdown {
  pricePerPerson: number;
  people: number;
  fillPercent: number;
  discountPercent: number;
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
}

// totalPrice = pricePerPerson × people × (1 − discountPercent / 100)
export function computePrice(
  pricePerPerson: number,
  people: number,
  capacity: number | null,
  tiers: DiscountTier[]
): PriceBreakdown {
  const fillPercent = fillPercentFor(people, capacity);
  const discountPercent = computeDiscountPercent(fillPercent, tiers);
  const totalBeforeDiscount = pricePerPerson * people;
  const totalAfterDiscount = Math.round(totalBeforeDiscount * (1 - discountPercent / 100));
  return { pricePerPerson, people, fillPercent, discountPercent, totalBeforeDiscount, totalAfterDiscount };
}
