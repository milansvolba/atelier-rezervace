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
  stul1: "Stůl s monitorem",
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
export type BookingSource = "admin" | "member" | "public";

// Kategorie rezervace: "pronajem" = klasický pronájem prostoru/míst,
// "kurz" = termín kurzu (veřejně zobrazovaný na /kurzy, se zápisem účastníků).
export type BookingCategory = "pronajem" | "kurz";

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
  userId?: string; // vyplněno, pokud rezervaci založil přihlášený admin/člen — pro "Moje rezervace"
  extraMonitor?: boolean; // mobilní druhý monitor přisazený ke stolu
  createdAt: string;
  category?: BookingCategory; // default "pronajem" u starých záznamů
  capacity?: number; // kapacita kurzu (počet míst), jen category="kurz"
  price?: number; // cena kurzu za osobu v Kč, jen category="kurz"
  heardAbout?: string; // nepovinné, z veřejného formuláře žádosti — viz REFERRAL_OPTIONS níže
}

// Přihláška účastníka na vypsaný termín kurzu (Booking s category="kurz").
export type SignupStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export interface CourseSignup {
  id: string;
  bookingId: string;
  name: string;
  contact: string;
  people: number; // počet osob
  note?: string;
  status: SignupStatus;
  createdAt: string;
  heardAbout?: string; // nepovinné, z veřejné přihlášky / nákupu — viz REFERRAL_OPTIONS níže
  phone?: string; // komu volat (u poukazu obdarovaný, jinak kupující)
  notifyEmail?: string; // e-mail pro změny termínu, když se liší od `contact` (obdarovaný u poukazu)
}

// "Odkud o nás víte?" — nepovinné pole na veřejných formulářích (žádost o pronájem/kurz,
// přihláška/platba na kurz, nákup dárkového poukazu). Ukládá se rovnou jako hotový popisek
// (ne interní kód), ať se dá v adminu zobrazit a sčítat bez dalšího překladu.
export const REFERRAL_OPTIONS: { value: string; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "pinterest", label: "Pinterest" },
  { value: "doporuceni", label: "Osobní doporučení" },
  { value: "plakat", label: "Plakát / leták" },
  { value: "tisk", label: "Časopis / noviny" },
  { value: "jine", label: "Jinde" },
];

// Spojí výběr z REFERRAL_OPTIONS s volným textem u "Jinde" do jednoho uloženého řetězce.
// Prázdný výběr vrací undefined (pole je nepovinné, nic se neukládá).
export function resolveHeardAbout(selected: string, otherText: string): string | undefined {
  if (!selected) return undefined;
  if (selected === "jine") {
    const custom = otherText.trim();
    return custom ? `Jiné: ${custom}` : "Jiné";
  }
  return REFERRAL_OPTIONS.find((o) => o.value === selected)?.label ?? selected;
}

// Vrátí true, pokud by dvě rezervace na stejný den kolidovaly (překryv času + konflikt zdrojů).
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export function resourcesConflict(a: ResourceId, b: ResourceId) {
  if (a === b) return true;
  return CONFLICTS[a]?.includes(b) || CONFLICTS[b]?.includes(a);
}
