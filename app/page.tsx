"use client";

import { useEffect, useMemo, useState } from "react";
import { Booking, ResourceId, RESOURCE_LABELS } from "@/lib/types";
import { DAY_NAMES, DAY_NAMES_MON_FIRST, MONTH_NAMES, addDays, iso, monthMatrix, nextDays } from "@/lib/calendar";

type ViewMode = "week" | "month" | "quarter" | "year";
type DayFlag = "free" | "on-request" | "pending" | "rental";

function statusBg(status: DayFlag) {
  switch (status) {
    case "rental":
      return "bg-rental";
    case "pending":
      return "bg-pending";
    case "on-request":
      return "bg-blue-100";
    default:
      return "bg-free";
  }
}

// Popisek zobrazeného rozsahu — veřejná stránka nemá navigaci vzad/vpřed,
// vždy ukazuje aktuální týden/měsíc/kvartál/rok od dneška, ale ať je jasné, co přesně to je.
function publicRangeLabel(view: ViewMode, today: Date): string {
  if (view === "week") {
    const end = addDays(today, 6);
    const sameMonth = today.getMonth() === end.getMonth();
    const left = sameMonth ? `${today.getDate()}.` : `${today.getDate()}. ${today.getMonth() + 1}.`;
    return `${left} – ${end.getDate()}. ${end.getMonth() + 1}. ${end.getFullYear()}`;
  }
  if (view === "month") return `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
  if (view === "quarter") {
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 1);
    return `${MONTH_NAMES[today.getMonth()]} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
  }
  const end = new Date(today.getFullYear(), today.getMonth() + 11, 1);
  return `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

// Rychlé předvolby pro pronájem celého prostoru — časy jsou rovnou v popisku,
// ať je jasné, co která volba znamená.
const WHOLE_SPACE_PRESETS: { label: string; start: string; end: string }[] = [
  { label: "8:00–12:00", start: "08:00", end: "12:00" },
  { label: "12:00–16:00", start: "12:00", end: "16:00" },
  { label: "Celý den (8:00–20:00)", start: "08:00", end: "20:00" },
];

// Pingpong se pronajímá po dvouhodinových blocích od 6:00 do 20:00.
function pingpongBlocks(): { label: string; start: string; end: string }[] {
  const blocks: { label: string; start: string; end: string }[] = [];
  for (let h = 6; h < 20; h += 2) {
    const start = `${String(h).padStart(2, "0")}:00`;
    const end = `${String(h + 2).padStart(2, "0")}:00`;
    blocks.push({ label: `${h}:00–${h + 2}:00`, start, end });
  }
  return blocks;
}

// Veřejnost smí žádat jen o tyhle tři produkty — jednotlivá coworkingová místa
// (stoly, okno, bar) rezervuje jen tým dovnitř.
const PUBLIC_RESOURCE_OPTIONS: { value: ResourceId; label: string }[] = [
  { value: "atelier", label: "Celý ateliér (oslava, akce)" },
  { value: "klubovna", label: "Klubovna (posezení s přáteli)" },
  { value: "pingpong", label: "Pingpongový stůl" },
];

export default function PublicPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [view, setView] = useState<ViewMode>("week");
  const [showForm, setShowForm] = useState(false);
  const [resource, setResource] = useState<ResourceId>("atelier");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState<null | "ok" | "err">(null);
  const [customTime, setCustomTime] = useState(false);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then(setBookings);
  }, [submitted]);

  // Den je "pronajato", pokud existuje potvrzená rezervace celého ateliéru/klubovny.
  // "Na vyžádání" znamená, že je obsazené jen nějaké coworkingové místo (stůl/pingpong) —
  // pronájem celého prostoru má přednost (přináší víc peněz), takže to nejde rovnou
  // označit za nedostupné, jen je potřeba se domluvit.
  function dayStatus(d: Date): DayFlag {
    const key = iso(d);
    const dayBookings = bookings.filter((b) => b.date === key);
    const hasConfirmedWhole = dayBookings.some(
      (b) => b.status === "confirmed" && (b.resource === "atelier" || b.resource === "klubovna")
    );
    if (hasConfirmedWhole) return "rental";
    const hasPendingWhole = dayBookings.some(
      (b) => b.status === "pending" && (b.resource === "atelier" || b.resource === "klubovna")
    );
    if (hasPendingWhole) return "pending";
    const hasIndividual = dayBookings.some(
      (b) => b.status === "confirmed" && b.resource !== "atelier" && b.resource !== "klubovna"
    );
    if (hasIndividual) return "on-request";
    return "free";
  }

  const today = new Date();
  const isWholeSpace = resource === "atelier" || resource === "klubovna";
  const isPingpong = resource === "pingpong";

  // Při přepnutí typu rezervace rovnou nastavit rozumný výchozí čas, ať vidí
  // konkrétní hodiny a nemusí nic manuálně dopočítávat.
  useEffect(() => {
    if (resource === "pingpong") {
      setStartTime("06:00");
      setEndTime("08:00");
    } else {
      setStartTime("08:00");
      setEndTime("12:00");
    }
  }, [resource]);

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
        <p className="text-sm font-medium text-gray-700 mb-1">{publicRangeLabel(view, today)}</p>
        <p className="text-sm text-gray-500 mb-4">
          Modrá = obsazené jen nějaké pracovní místo, o celý prostor si můžete i tak napsat — domluvíme se.
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

        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-free border border-gray-300 inline-block" /> volno
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 inline-block" /> na vyžádání
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-pending inline-block" /> čeká na schválení
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rental inline-block" /> pronajato
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
              {PUBLIC_RESOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Datum
            <input
              required
              type="date"
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2 cursor-pointer"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onClick={(e) => {
                const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                if (typeof el.showPicker === "function") {
                  try {
                    el.showPicker();
                  } catch {
                    // některé prohlížeče showPicker nepodporují — normální klik na pole pak stačí
                  }
                }
              }}
            />
          </label>

          {(isWholeSpace || isPingpong) && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Vyberte čas</p>
              <div className="flex flex-wrap gap-2">
                {(isWholeSpace ? WHOLE_SPACE_PRESETS : pingpongBlocks()).map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => {
                      setStartTime(p.start);
                      setEndTime(p.end);
                    }}
                    className={`h-8 px-3 rounded-md border text-xs ${
                      startTime === p.start && endTime === p.end ? "border-gray-800 font-medium" : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!customTime ? (
            <button
              type="button"
              onClick={() => setCustomTime(true)}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Upravit čas ručně (teď: {startTime}–{endTime})
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
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
          )}

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
