"use client";

import { useEffect, useMemo, useState } from "react";
import { Booking, ResourceId, RESOURCE_LABELS } from "@/lib/types";

type ViewMode = "week" | "month" | "quarter" | "year";

const DAY_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const DAY_NAMES_MON_FIRST = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function nextDays(n: number) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

// Vrátí mřížku dnů pro daný měsíc, pondělím počínaje, včetně vyplňovacích
// dnů z okolních měsíců (aby řádky vždy měly 7 dní).
function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = pondělí
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function PublicPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [view, setView] = useState<ViewMode>("week");
  const [showForm, setShowForm] = useState(false);
  const [resource, setResource] = useState<ResourceId>("atelier");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState<null | "ok" | "err">(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then(setBookings);
  }, [submitted]);

  // Den je pro veřejnost "obsazený", pokud existuje potvrzená rezervace typu
  // atelier nebo klubovna (tedy něco, co blokuje celý prostor nebo jeho podstatnou část).
  function dayStatus(d: Date) {
    const key = iso(d);
    const dayBookings = bookings.filter((b) => b.date === key);
    const hasConfirmedWhole = dayBookings.some(
      (b) => b.status === "confirmed" && (b.resource === "atelier" || b.resource === "klubovna")
    );
    const hasPendingWhole = dayBookings.some(
      (b) => b.status === "pending" && (b.resource === "atelier" || b.resource === "klubovna")
    );
    if (hasConfirmedWhole) return "rental";
    if (hasPendingWhole) return "pending";
    return "free";
  }

  function statusBg(status: string) {
    return status === "rental" ? "bg-rental" : status === "pending" ? "bg-pending" : "bg-free";
  }

  const today = new Date();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource,
        date,
        startTime,
        endTime,
        title: `${RESOURCE_LABELS[resource]} — ${name}`,
        requesterName: name,
        requesterContact: contact,
        note,
      }),
    });
    if (res.ok) {
      setSubmitted("ok");
      setShowForm(false);
      setName("");
      setContact("");
      setNote("");
    } else {
      setSubmitted("err");
    }
  }

  const monthsToShow = useMemo(() => {
    const count = view === "month" ? 1 : view === "quarter" ? 3 : view === "year" ? 12 : 0;
    const list: { year: number; month: number }[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      list.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <main className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <p className="font-medium">Obsazenost prostoru</p>
          <div className="flex gap-1 bg-gray-100 rounded-md p-1 text-xs">
            {(["week", "month", "quarter", "year"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`h-7 px-2.5 rounded ${view === v ? "bg-white shadow-sm font-medium" : "text-gray-500"}`}
              >
                {v === "week" ? "Týden" : v === "month" ? "Měsíc" : v === "quarter" ? "Kvartál" : "Rok"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Zobrazuje jen pronájem celého ateliéru nebo klubovny. Jednotlivá pracovní místa si rezervujeme interně.
        </p>

        {view === "week" && (
          <div className="grid grid-cols-7 gap-2 mb-4">
            {nextDays(7).map((d) => {
              const status = dayStatus(d);
              return (
                <div key={iso(d)} className="text-center">
                  <div className="text-xs text-gray-400 mb-1">{DAY_NAMES[d.getDay()]}</div>
                  <div className={`h-10 rounded-md ${statusBg(status)} flex items-center justify-center text-xs`}>
                    {d.getDate()}.
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view !== "week" && (
          <div
            className={`mb-4 grid gap-4 ${
              view === "month" ? "grid-cols-1" : view === "quarter" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {monthsToShow.map(({ year, month }) => (
              <div key={`${year}-${month}`}>
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  {MONTH_NAMES[month]} {year}
                </p>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAY_NAMES_MON_FIRST.map((n) => (
                    <div key={n} className="text-center text-[10px] text-gray-400">
                      {n[0]}
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {monthMatrix(year, month).map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1">
                      {week.map((d, di) =>
                        d ? (
                          <div
                            key={di}
                            className={`aspect-square rounded-sm ${statusBg(dayStatus(d))} flex items-center justify-center text-[10px]`}
                            title={iso(d)}
                          >
                            {view === "year" ? "" : d.getDate()}
                          </div>
                        ) : (
                          <div key={di} />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-free border border-gray-300 inline-block" /> volno
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rental inline-block" /> pronajato
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-pending inline-block" /> čeká na schválení
          </span>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="h-10 px-4 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
        >
          Požádat o rezervaci
        </button>
      </div>

      {submitted === "ok" && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
          Žádost jsme přijali. Ozveme se co nejdřív, nejpozději následující pracovní den.
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="font-medium">Žádost o rezervaci</p>

          <label className="block text-sm">
            Co chcete rezervovat
            <select
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
              value={resource}
              onChange={(e) => setResource(e.target.value as ResourceId)}
            >
              <option value="atelier">Celý ateliér (oslava, akce)</option>
              <option value="klubovna">Klubovna (posezení s přáteli)</option>
              <option value="pingpong">Pingpongový stůl</option>
              <option value="stul1">Stůl 1 (coworking)</option>
              <option value="stul2">Stůl 2 (coworking)</option>
              <option value="bar">Bar / Stůl 3 (coworking)</option>
              <option value="okno1">Okno 1 (coworking)</option>
            </select>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">
              Datum
              <input
                required
                type="date"
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Od
              <input
                required
                type="time"
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Do
              <input
                required
                type="time"
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>

          <label className="block text-sm">
            Jméno
            <input
              required
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jana Nováková"
            />
          </label>

          <label className="block text-sm">
            Kontakt (e-mail nebo telefon)
            <input
              required
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="jana@example.com"
            />
          </label>

          <label className="block text-sm">
            Poznámka (nepovinné)
            <textarea
              className="mt-1 w-full border border-gray-300 rounded-md px-2 py-2"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="K čemu prostor potřebujete, kolik lidí přijde…"
            />
          </label>

          <p className="text-xs text-gray-400">
            Údaje použijeme jen ke komunikaci o téhle rezervaci a smažeme je nejpozději 12 měsíců po akci.
          </p>

          {submitted === "err" && <p className="text-sm text-red-600">Něco se nepovedlo, zkuste to prosím znovu.</p>}

          <button type="submit" className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">
            Odeslat žádost
          </button>
        </form>
      )}
    </main>
  );
}
