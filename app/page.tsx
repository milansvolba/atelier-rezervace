"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Booking,
  ResourceId,
  RESOURCE_LABELS,
  resourcesConflict,
  timesOverlap,
} from "@/lib/types";
import { HALF_DAYS, HalfDayState, halfDayState, findPrepConflict, prepMessage } from "@/lib/prep";
import {
  DAY_NAMES,
  DAY_NAMES_MON_FIRST,
  MONTH_NAMES,
  addDays,
  addMonths,
  iso,
  monthMatrix,
  nextDays,
} from "@/lib/calendar";

type ViewMode = "week" | "month" | "quarter" | "year";
// Veřejný kalendář: volno (zelená), rezervováno (šedá), čeká na schválení (žlutá); důvody (úklid, akce) vidí jen členové a admin.
// Příprava a úklid před akcí je světlejší šedá s pruhy (nejde rezervovat celý ateliér).
const HALF_STYLE: Record<HalfDayState, { className: string; style?: React.CSSProperties; label: string }> = {
  free: { className: "bg-green-100", label: "volno" },
  taken: { className: "bg-gray-300", label: "rezervováno" },
  prep: {
    className: "bg-gray-200",
    style: { backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.7) 0 3px, transparent 3px 6px)" },
    label: "příprava a úklid před akcí",
  },
  pending: { className: "bg-[#FAC775]", label: "čeká na schválení" },
};

// Popisek zobrazeného rozsahu — jde listovat vzad/vpřed přes anchor, takže
// nejde vždy nutně o "dnešek", ale o aktuálně zvolený rozsah.
function publicRangeLabel(view: ViewMode, anchor: Date): string {
  if (view === "week") {
    const end = addDays(anchor, 6);
    const sameMonth = anchor.getMonth() === end.getMonth();
    const left = sameMonth ? `${anchor.getDate()}.` : `${anchor.getDate()}. ${anchor.getMonth() + 1}.`;
    return `${left} – ${end.getDate()}. ${end.getMonth() + 1}. ${end.getFullYear()}`;
  }
  if (view === "month") return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  if (view === "quarter") {
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 1);
    return `${MONTH_NAMES[anchor.getMonth()]} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
  }
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 11, 1);
  return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

// Posun rozsahu vzad/vpřed podle zvoleného pohledu — stejná logika jako v adminu,
// jen bez "day" varianty (veřejná stránka denní pohled nemá).
function shiftAnchor(view: ViewMode, anchor: Date, dir: 1 | -1): Date {
  if (view === "week") return addDays(anchor, dir * 7);
  if (view === "month") return addMonths(anchor, dir);
  if (view === "quarter") return addMonths(anchor, dir * 3);
  return new Date(anchor.getFullYear() + dir, anchor.getMonth(), 1);
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
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [resource, setResource] = useState<ResourceId>("atelier");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState<null | "ok" | "err">(null);
  const [submitError, setSubmitError] = useState("");
  const [customTime, setCustomTime] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then(setBookings);
  }, [submitted]);

  // Každý den je rozdělený na dopoledne (levá půlka) a odpoledne (pravá půlka); barva ukazuje,
  // jestli jde v tu dobu požádat o celý ateliér.
  function dayHalves(d: Date): HalfDayState[] {
    const key = iso(d);
    // Veřejnost vidí jen volno, rezervováno a čeká na schválení: příprava/úklid se tváří jako rezervováno.
    return HALF_DAYS.map((h): HalfDayState => {
      const st = halfDayState(bookings, key, h);
      return st === "prep" ? "taken" : st;
    });
  }

  function renderDayCell(d: Date, tall: boolean, showNumber: boolean) {
    const past = iso(d) < todayISO;
    const halves = dayHalves(d);
    const title = past
      ? undefined
      : "Dopoledne: " + HALF_STYLE[halves[0]].label + ", odpoledne: " + HALF_STYLE[halves[1]].label + ". Klikněte pro žádost o tento den.";
    return (
      <button
        type="button"
        disabled={past}
        onClick={() => startBookingFor(d)}
        title={title}
        className={`relative overflow-hidden w-full ${tall ? "h-10 rounded-md text-xs" : "aspect-square rounded-sm text-[10px]"} flex items-center justify-center ${
          past ? "opacity-40 cursor-default" : "hover:ring-2 hover:ring-gray-300"
        }`}
      >
        {halves.map((h, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`absolute top-0 bottom-0 ${i === 0 ? "left-0" : "right-0"} w-1/2 ${HALF_STYLE[h].className}`}
            style={HALF_STYLE[h].style}
          />
        ))}
        <span className="relative text-gray-800">{showNumber ? d.getDate() + (tall ? "." : "") : ""}</span>
      </button>
    );
  }

  const today = new Date();
  const todayISO = iso(today);
  const isWholeSpace = resource === "atelier" || resource === "klubovna";

  // Lidi v testování klikali rovnou na den v kalendáři a čekali, že tím
  // rezervaci začnou — tak ať to tak i funguje, místo aby museli hledat
  // samostatné tlačítko "Požádat o rezervaci".
  function startBookingFor(d: Date) {
    setDate(iso(d));
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
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

  // Zjistí, jestli zvolený termín koliduje s existující potvrzenou rezervací —
  // odeslání žádosti to nijak neblokuje (ateliér se to snaží vždycky nějak
  // vyřešit), jen se žadateli zobrazí upozornění, ať ví, na čem je.
  const conflictingBooking = useMemo(() => {
    if (!date) return null;
    return (
      bookings.find(
        (b) =>
          b.status === "confirmed" &&
          b.date === date &&
          (b.resource === resource || resourcesConflict(resource, b.resource)) &&
          timesOverlap(startTime, endTime, b.startTime, b.endTime)
      ) || null
    );
  }, [bookings, date, resource, startTime, endTime]);

  // Příprava a úklid: nový termín celého ateliéru nesmí zasáhnout do přípravy jiné akce (ani naopak).
  const prepConflict = useMemo(() => {
    if (!date) return null;
    return findPrepConflict(
      { resource, date, startTime, endTime },
      bookings.filter((b) => b.status === "confirmed"),
      "public"
    );
  }, [bookings, date, resource, startTime, endTime]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(null);
    setSubmitError("");
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
      const data = await res.json().catch(() => ({}));
      setSubmitError(typeof data.error === "string" ? data.error : "");
      setSubmitted("err");
    }
  }

  const monthsToShow = useMemo(() => {
    const count = view === "month" ? 1 : view === "quarter" ? 3 : view === "year" ? 12 : 0;
    const list: { year: number; month: number }[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() + i, 1);
      list.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return list;
  }, [anchor, view]);

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
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}
            className="h-7 w-7 rounded-md border border-gray-300 text-sm"
            aria-label="Předchozí"
          >
            ‹
          </button>
          <p className="text-sm font-medium text-gray-700">{publicRangeLabel(view, anchor)}</p>
          <button
            onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}
            className="h-7 w-7 rounded-md border border-gray-300 text-sm"
            aria-label="Následující"
          >
            ›
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="h-7 px-2.5 rounded-md border border-gray-300 text-xs text-gray-500"
          >
            Dnes
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Každý den je rozdělený na dopoledne (levá půlka) a odpoledne (pravá půlka). Zelená je volno pro celý ateliér.
        </p>

        {view === "week" && (
          <div className="grid grid-cols-7 gap-2 mb-4">
            {nextDays(7, anchor).map((d) => (
              <div key={iso(d)} className="text-center">
                <div className="text-xs text-gray-400 mb-1">{DAY_NAMES[d.getDay()]}</div>
                {renderDayCell(d, true, true)}
              </div>
            ))}
          </div>
        )}

        {view !== "week" && (
          <div
            className={`mb-4 grid gap-4 ${
              view === "month"
                ? "grid-cols-1 max-w-xs"
                : view === "quarter"
                ? "grid-cols-1 sm:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
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
                <div className={view === "month" ? "space-y-0.5" : "space-y-1"}>
                  {monthMatrix(year, month).map((week, wi) => (
                    <div key={wi} className={`grid grid-cols-7 ${view === "month" ? "gap-0.5" : "gap-1"}`}>
                      {week.map((d, di) =>
                        d ? <div key={di}>{renderDayCell(d, false, view !== "year")}</div> : <div key={di} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 mb-4">
          {(["free", "taken", "pending"] as HalfDayState[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm inline-block ${HALF_STYLE[k].className}`} style={HALF_STYLE[k].style} /> {HALF_STYLE[k].label}
            </span>
          ))}
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
        <form ref={formRef} onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
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

          {date && conflictingBooking && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
              Tento termín už je obsazený. Vyberte prosím jiný čas nebo den.
            </div>
          )}
          {date && !conflictingBooking && prepConflict && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">{prepMessage("public", prepConflict.kind)}</div>
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

          {submitted === "err" && <p className="text-sm text-red-600">{submitError || "Něco se nepovedlo, zkuste to prosím znovu."}</p>}

          <button
            type="submit"
            disabled={!!conflictingBooking || !!prepConflict}
            className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-40"
          >
            Odeslat žádost
          </button>
        </form>
      )}
    </main>
  );
}
