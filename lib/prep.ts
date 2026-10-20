import { iso, addDays } from "./calendar";
import { Booking, ResourceId, resourcesConflict, timesOverlap } from "./types";

// Příprava a úklid kolem akce na CELÝ ateliér (resource "atelier": kurz, firemní akce, pronájem celého ateliéru).
// V těchto oknech se nesmí rezervovat nic nového, kromě toho, co povoluje role:
//  - admin: smí vše (jen on může okna přebít),
//  - člen: smí jen jednotlivá místa (stoly, okno), ne celý ateliér, klubovnu ani pingpong,
//  - veřejnost (žádosti): nesmí nic.
// Okna (konstanty níže jdou změnit na jednom místě):
//  - akce od 12:00 dál (odpolední/večerní): příprava téhož dne 8:00–14:00, úklid následující den 8:00–12:00,
//  - akce začínající před 12:00 (dopolední): příprava den předtím 12:00–20:00,
//    úklid téhož dne od konce akce (nejdřív od 12:00) do 20:00, pokud akce končí do 13:00; jinak následující den 8:00–12:00.
export const DAY_START = "08:00";
export const NOON = "12:00";
export const DAY_END = "20:00";
const PREP_SAME_DAY_END = "14:00";
const MORNING_EVENT_END_LIMIT = "13:00";

export type WindowKind = "prep" | "cleanup";
export interface PrepWindow {
  date: string;
  start: string;
  end: string;
  kind: WindowKind;
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return iso(addDays(new Date(y, m - 1, d), days));
}

export function eventWindows(date: string, startTime: string, endTime: string): PrepWindow[] {
  const list: PrepWindow[] = [];
  if (startTime >= NOON) list.push({ date, start: DAY_START, end: PREP_SAME_DAY_END, kind: "prep" });
  else list.push({ date: shiftDate(date, -1), start: NOON, end: DAY_END, kind: "prep" });
  if (startTime < NOON && endTime <= MORNING_EVENT_END_LIMIT) {
    const from = endTime > NOON ? endTime : NOON;
    if (from < DAY_END) list.push({ date, start: from, end: DAY_END, kind: "cleanup" });
  } else {
    list.push({ date: shiftDate(date, 1), start: DAY_START, end: NOON, kind: "cleanup" });
  }
  return list;
}

export type PrepRole = "admin" | "member" | "public";

// Co smí daná role rezervovat uvnitř oken přípravy a úklidu.
const MEMBER_BLOCKED: ResourceId[] = ["atelier", "klubovna", "pingpong"];
export function restrictedInWindow(role: PrepRole, resource: ResourceId): boolean {
  if (role === "admin") return false;
  if (role === "member") return MEMBER_BLOCKED.includes(resource);
  return true;
}

type Slot = Pick<Booking, "date" | "startTime" | "endTime">;
type Cand = Slot & { resource: ResourceId };

export interface PrepConflict {
  booking: Booking;
  kind: "window" | "own";
}

// `existing` = potvrzené rezervace z dne předtím, téhož dne a dne potom (bez ignorované).
export function findPrepConflict(candidate: Cand, existing: Booking[], role: PrepRole): PrepConflict | null {
  if (role === "admin") return null;
  // 1) nový termín zasahuje do přípravy/úklidu existující akce na celý ateliér
  if (restrictedInWindow(role, candidate.resource)) {
    for (const e of existing) {
      if (e.resource !== "atelier") continue;
      for (const w of eventWindows(e.date, e.startTime, e.endTime)) {
        if (w.date === candidate.date && timesOverlap(candidate.startTime, candidate.endTime, w.start, w.end)) {
          return { booking: e, kind: "window" };
        }
      }
    }
  }
  // 2) nová akce na celý ateliér: její vlastní příprava a úklid musí být bez jiných rezervací
  if (candidate.resource === "atelier") {
    for (const w of eventWindows(candidate.date, candidate.startTime, candidate.endTime)) {
      for (const e of existing) {
        if (e.date === w.date && resourcesConflict("atelier", e.resource) && timesOverlap(e.startTime, e.endTime, w.start, w.end)) {
          return { booking: e, kind: "own" };
        }
      }
    }
  }
  return null;
}

export function prepMessage(role: PrepRole, kind: "window" | "own"): string {
  if (kind === "own") {
    return "Před a po akci na celý ateliér potřebujeme čas na přípravu a úklid, a v tom čase už je jiná rezervace. Vyberte prosím jiný termín.";
  }
  return role === "member"
    ? "V době přípravy nebo úklidu ateliéru před a po akci si můžete rezervovat jen jednotlivé stoly."
    : "V tomto čase probíhá příprava nebo úklid ateliéru před a po akci, rezervace není možná. Vyberte prosím jiný čas.";
}

// Okna přípravy a úklidu připadající na daný den (pro popisky v kalendáři).
export function windowsOnDate(bookings: Pick<Booking, "resource" | "date" | "startTime" | "endTime" | "status">[], date: string): PrepWindow[] {
  const out: PrepWindow[] = [];
  for (const b of bookings) {
    if (b.status !== "confirmed" || b.resource !== "atelier") continue;
    for (const w of eventWindows(b.date, b.startTime, b.endTime)) if (w.date === date) out.push(w);
  }
  return out;
}

// Stav jedné půlky dne pro rezervaci CELÉHO ateliéru (veřejný kalendář): dopoledne 8:00–12:00, odpoledne 12:00–20:00.
// taken = už rezervováno (vč. míst, která celý ateliér blokují), prep = příprava nebo úklid kolem akce, pending = čeká na schválení.
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
  if (windowsOnDate(bookings, date).some((w) => timesOverlap(half.start, half.end, w.start, w.end))) return "prep";
  const pending = bookings.some(
    (b) => b.status === "pending" && b.date === date && resourcesConflict("atelier", b.resource) && timesOverlap(half.start, half.end, b.startTime, b.endTime)
  );
  return pending ? "pending" : "free";
}
