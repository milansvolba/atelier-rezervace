import { iso, addDays } from "./calendar";
import { Booking, resourcesConflict, timesOverlap } from "./types";

// Příprava a úklid před akcí na CELÝ ateliér (resource "atelier"; kurz, firemní akce i pronájem celého ateliéru).
// - Akce odpoledne (začíná v 12:00 a později): téhož dne dopoledne 8:00–12:00 nejde rezervovat celý ateliér.
// - Akce dopoledne (začíná před 12:00): den předtím odpoledne 12:00–20:00 nejde rezervovat celý ateliér.
// Pravidlo se týká jen rezervací celého ateliéru. Členové si dál mohou rezervovat jednotlivá místa mimo čas samotné akce.
export const DAY_START = "08:00";
export const NOON = "12:00";
export const DAY_END = "20:00";

export interface PrepWindow {
  date: string;
  start: string;
  end: string;
}

export function prepWindow(date: string, startTime: string): PrepWindow {
  if (startTime >= NOON) return { date, start: DAY_START, end: NOON };
  const [y, m, d] = date.split("-").map(Number);
  return { date: iso(addDays(new Date(y, m - 1, d), -1)), start: NOON, end: DAY_END };
}

type Slot = Pick<Booking, "date" | "startTime" | "endTime">;

// Překrývá nová rezervace celého ateliéru okno přípravy nějaké existující akce, nebo její vlastní příprava
// zasahuje do existující rezervace celého ateliéru? `existing` jsou potvrzené rezervace s resource "atelier".
export function findPrepConflict<T extends Slot>(candidate: Slot, existing: T[]): T | null {
  const myPrep = prepWindow(candidate.date, candidate.startTime);
  for (const e of existing) {
    const theirPrep = prepWindow(e.date, e.startTime);
    const hitsTheirPrep = theirPrep.date === candidate.date && timesOverlap(candidate.startTime, candidate.endTime, theirPrep.start, theirPrep.end);
    const hitsMyPrep = e.date === myPrep.date && timesOverlap(e.startTime, e.endTime, myPrep.start, myPrep.end);
    if (hitsTheirPrep || hitsMyPrep) return e;
  }
  return null;
}

export const PREP_MESSAGE =
  "Před akcí na celý ateliér potřebujeme volný půlden na přípravu a úklid (dopoledne před odpolední akcí, odpoledne dne předtím před dopolední akcí). Vyberte prosím jiný čas.";

// Stav jedné půlky dne pro rezervaci CELÉHO ateliéru (veřejný kalendář): dopoledne 8:00–12:00, odpoledne 12:00–20:00.
// taken = už rezervováno (vč. míst, která celý ateliér blokují), prep = příprava a úklid před akcí, pending = čeká na schválení.
export type HalfDayState = "free" | "taken" | "prep" | "pending";
export const HALF_DAYS = [
  { key: "morning", label: "dopoledne", start: DAY_START, end: NOON },
  { key: "afternoon", label: "odpoledne", start: NOON, end: DAY_END },
] as const;

type PublicBooking = Pick<Booking, "resource" | "date" | "startTime" | "endTime" | "status">;

export function halfDayState(bookings: PublicBooking[], date: string, half: { start: string; end: string }): HalfDayState {
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const taken = confirmed.some(
    (b) => b.date === date && resourcesConflict("atelier", b.resource) && timesOverlap(half.start, half.end, b.startTime, b.endTime)
  );
  if (taken) return "taken";
  const prep = confirmed.some((b) => {
    if (b.resource !== "atelier") return false;
    const w = prepWindow(b.date, b.startTime);
    return w.date === date && timesOverlap(half.start, half.end, w.start, w.end);
  });
  if (prep) return "prep";
  const pending = bookings.some(
    (b) => b.status === "pending" && b.date === date && resourcesConflict("atelier", b.resource) && timesOverlap(half.start, half.end, b.startTime, b.endTime)
  );
  return pending ? "pending" : "free";
}
