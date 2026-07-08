import { Booking, ResourceId, resourcesConflict, timesOverlap } from "./types";

// DEMO ÚLOŽIŠTĚ — pole v paměti procesu. Přežije jen v rámci jednoho "teplého"
// serverless běhu na Vercelu, po chvíli nečinnosti nebo redeploy zmizí.
// Než appku začnete používat naostro, tohle je potřeba vyměnit za skutečnou
// databázi (např. Vercel Postgres) — viz poznámka v README.md.

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const seed: Booking[] = [
  {
    id: "b1",
    resource: "okno1",
    date: todayISO(0),
    startTime: "09:00",
    endTime: "12:00",
    title: "Petra — coworking",
    status: "confirmed",
    source: "admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b2",
    resource: "stul1",
    date: todayISO(0),
    startTime: "10:00",
    endTime: "13:00",
    title: "Jakub — coworking",
    status: "confirmed",
    source: "admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b3",
    resource: "stul1",
    date: todayISO(0),
    startTime: "14:00",
    endTime: "18:00",
    title: "Tomáš — coworking",
    extraMonitor: true,
    status: "confirmed",
    source: "admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b4",
    resource: "bar",
    date: todayISO(0),
    startTime: "13:00",
    endTime: "15:00",
    title: "host",
    status: "confirmed",
    source: "admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b5",
    resource: "atelier",
    date: todayISO(3),
    startTime: "16:00",
    endTime: "19:00",
    title: "Kurz keramiky se Zuzkou",
    status: "confirmed",
    source: "admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b6",
    resource: "atelier",
    date: todayISO(3),
    startTime: "9:00",
    endTime: "17:00",
    title: "Oslava narozenin — Tomáš V.",
    requesterName: "Tomáš V.",
    requesterContact: "tomas@example.com",
    status: "confirmed",
    source: "public",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b7",
    resource: "stul2",
    date: todayISO(11),
    startTime: "09:00",
    endTime: "17:00",
    title: "Kurz keramiky (jiný lektor) — čeká na schválení",
    requesterName: "Klára N.",
    requesterContact: "klara@example.com",
    note: "Ráda by využila i druhý monitor.",
    status: "pending",
    source: "public",
    createdAt: new Date().toISOString(),
  },
];

// globalThis trik, aby pole přežilo hot-reload v dev módu
const g = globalThis as unknown as { __bookings?: Booking[] };
if (!g.__bookings) g.__bookings = seed;
export const store = {
  all(): Booking[] {
    return g.__bookings!;
  },
  add(b: Booking) {
    g.__bookings!.push(b);
    return b;
  },
  update(id: string, patch: Partial<Booking>) {
    const b = g.__bookings!.find((x) => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    return b;
  },
  byDate(date: string) {
    return g.__bookings!.filter((b) => b.date === date);
  },
};

// Zjistí, jestli by nová rezervace kolidovala s existujícími potvrzenými.
// Nepotvrzené (pending) žádosti podle specifikace nic neblokují, dokud je admin neschválí.
export function findConflict(
  resource: ResourceId,
  date: string,
  startTime: string,
  endTime: string,
  ignoreId?: string
): Booking | null {
  const existing = store.byDate(date).filter((b) => b.status === "confirmed" && b.id !== ignoreId);
  for (const b of existing) {
    if (resourcesConflict(resource, b.resource) && timesOverlap(startTime, endTime, b.startTime, b.endTime)) {
      return b;
    }
  }
  return null;
}
