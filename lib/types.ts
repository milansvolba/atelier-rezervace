// Sedm "produktů", které jde v systému rezervovat.
// ateliér a klubovna jsou skupinové produkty, které blokují víc fyzických míst najednou.
export type ResourceId =
  | "atelier"
  | "klubovna"
  | "pingpong"
  | "okno1"
  | "stul1"
  | "stul2"
  | "bar";

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  atelier: "Celý ateliér / kurz",
  klubovna: "Klubovna (celá)",
  pingpong: "Pingpongový stůl",
  okno1: "Okno 1",
  stul1: "Stůl 1",
  stul2: "Stůl 2",
  bar: "Bar (Stůl 3)",
};

// Fyzická místa zobrazovaná v interní denní mřížce (bez skupinových produktů).
export const PHYSICAL_RESOURCES: ResourceId[] = [
  "okno1",
  "stul1",
  "stul2",
  "bar",
  "pingpong",
];

// Explicitní tabulka konfliktů podle zadání klienta — NENÍ odvozená geometricky,
// jde o přesně vyjmenovaná pravidla (viz rezervacni-system-specifikace.md).
// Pokud je rezervace pro klíč X, blokuje zároveň všechny zdroje v poli.
export const CONFLICTS: Record<ResourceId, ResourceId[]> = {
  atelier: ["okno1", "stul1", "stul2", "bar", "pingpong", "klubovna"],
  klubovna: ["okno1", "stul2", "bar", "atelier"],
  pingpong: ["okno1", "stul1", "atelier"],
  okno1: ["klubovna", "pingpong", "atelier"],
  stul1: ["pingpong", "atelier"],
  stul2: ["klubovna", "atelier"],
  bar: ["klubovna", "atelier"],
};

export type BookingStatus = "confirmed" | "pending" | "rejected";
export type BookingSource = "admin" | "public";

export interface Booking {
  id: string;
  resource: ResourceId;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  title: string;
  requesterName?: string;
  requesterContact?: string;
  note?: string;
  status: BookingStatus;
  source: BookingSource;
  extraMonitor?: boolean; // mobilní druhý monitor přisazený ke stolu
  createdAt: string;
}

// Vrátí true, pokud by dvě rezervace na stejný den kolidovaly (překryv času + konflikt zdrojů).
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export function resourcesConflict(a: ResourceId, b: ResourceId) {
  if (a === b) return true;
  return CONFLICTS[a]?.includes(b) || CONFLICTS[b]?.includes(a);
}
