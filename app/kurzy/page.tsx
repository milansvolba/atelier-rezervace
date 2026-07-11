"use client";

import { useEffect, useMemo, useState } from "react";
import { DAY_NAMES_MON_FIRST, MONTH_NAMES, iso, monthMatrix } from "@/lib/calendar";

interface CourseCard {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
  capacity: number | null;
  price: number | null;
  spotsLeft: number | null;
}

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

// Veřejná stránka kurzů — záměrně oddělená od detailního kalendáře pronájmu
// prostoru (rezervace.ateliernapobrezi.cz). Kdo chce kurz, nezajímá ho
// obsazenost jednotlivých stolů — vidí jen vypsané termíny a jednoduchou
// možnost poptat si vlastní termín pro skupinu.
export default function KurzyPage() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupFor, setSignupFor] = useState<string | null>(null);
  const [signupName, setSignupName] = useState("");
  const [signupContact, setSignupContact] = useState("");
  const [signupPeople, setSignupPeople] = useState(1);
  const [signupNote, setSignupNote] = useState("");
  const [signupSent, setSignupSent] = useState<null | "ok" | "err">(null);
  const [honeypot, setHoneypot] = useState("");

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customName, setCustomName] = useState("");
  const [customContact, setCustomContact] = useState("");
  const [customPeople, setCustomPeople] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [customSent, setCustomSent] = useState<null | "ok" | "err">(null);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [signupSent]);

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupFor) return;
    setSignupSent(null);
    const res = await fetch("/api/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: signupFor,
        name: signupName,
        contact: signupContact,
        people: signupPeople,
        note: signupNote,
        honeypot,
      }),
    });
    if (res.ok) {
      setSignupSent("ok");
      setSignupName("");
      setSignupContact("");
      setSignupNote("");
      setSignupPeople(1);
      setSignupFor(null);
    } else {
      setSignupSent("err");
    }
  }

  function startCustomFor(d: Date) {
    setCustomDate(iso(d));
    setShowCustomForm(true);
    requestAnimationFrame(() => {
      document.getElementById("custom-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    setCustomSent(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "atelier",
        category: "kurz",
        date: customDate,
        startTime: "09:00",
        endTime: "16:00",
        title: `Poptávka kurzu na míru — ${customName}`,
        requesterName: customName,
        requesterContact: customContact,
        note: `Počet osob: ${customPeople || "neuvedeno"}. ${customNote}`.trim(),
      }),
    });
    if (res.ok) {
      setCustomSent("ok");
      setShowCustomForm(false);
      setCustomName("");
      setCustomContact("");
      setCustomPeople("");
      setCustomNote("");
    } else {
      setCustomSent("err");
    }
  }

  const today = new Date();
  const todayISO = iso(today);
  const monthsToShow = useMemo(() => {
    const list: { year: number; month: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      list.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Kurzy Vysochej</h1>
        <p className="text-sm text-gray-500">
          Vypsané termíny sochařských kurzů. Přihlaste se na některý z nich, nebo si napište o vlastní termín pro skupinu.
        </p>
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-gray-400">Načítám termíny…</p>}
        {!loading && courses.length === 0 && (
          <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-5">
            Momentálně nemáme vypsaný žádný termín. Napište nám níže o poptávku na vlastní termín.
          </p>
        )}
        {courses.map((c) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-gray-500">
                  {fmtDate(c.date)} · {c.startTime}–{c.endTime}
                  {c.price ? ` · ${c.price} Kč/os.` : ""}
                </p>
                {c.note && <p className="text-sm text-gray-500 mt-1">{c.note}</p>}
                {c.capacity && (
                  <p className="text-xs text-gray-400 mt-1">
                    {c.spotsLeft !== null && c.spotsLeft > 0
                      ? `Volných míst: ${c.spotsLeft} z ${c.capacity}`
                      : "Kapacita naplněna — napište nám, dáme vědět při uvolnění."}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSignupFor(signupFor === c.id ? null : c.id);
                  setSignupSent(null);
                }}
                disabled={c.spotsLeft === 0}
                className="h-9 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-40 shrink-0"
              >
                {signupFor === c.id ? "Zavřít" : "Přihlásit se"}
              </button>
            </div>

            {signupFor === c.id && (
              <form onSubmit={submitSignup} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <input
                  type="text"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm">
                    Jméno
                    <input
                      required
                      className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Kontakt (e-mail nebo telefon)
                    <input
                      required
                      className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                      value={signupContact}
                      onChange={(e) => setSignupContact(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Počet osob
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                      value={signupPeople}
                      onChange={(e) => setSignupPeople(Number(e.target.value))}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  Poznámka (nepovinné)
                  <input
                    className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                    value={signupNote}
                    onChange={(e) => setSignupNote(e.target.value)}
                  />
                </label>
                <button className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">Odeslat přihlášku</button>
                {signupSent === "ok" && <p className="text-sm text-green-700">Přihláška odeslána, ozveme se.</p>}
                {signupSent === "err" && <p className="text-sm text-red-700">Něco se nepovedlo, zkuste to prosím znovu.</p>}
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5" id="custom-form">
        <p className="font-medium mb-1">Kurz na míru pro skupinu</p>
        <p className="text-sm text-gray-500 mb-4">
          Nevyhovuje vám žádný vypsaný termín? Klikněte na den, který by se vám hodil, a pošlete nám poptávku —
          potvrdíme ho, nebo nabídneme nejbližší volný termín.
        </p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-4">
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
                    {week.map((d, di) => {
                      if (!d) return <div key={di} />;
                      const past = iso(d) < todayISO;
                      const selected = customDate === iso(d);
                      return (
                        <button
                          type="button"
                          key={di}
                          disabled={past}
                          onClick={() => startCustomFor(d)}
                          className={`aspect-square rounded-sm flex items-center justify-center text-[10px] ${
                            selected ? "bg-gray-900 text-white" : "bg-gray-100"
                          } ${past ? "opacity-40 cursor-default" : "hover:ring-2 hover:ring-gray-300"}`}
                        >
                          {d.getDate()}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {showCustomForm && (
          <form onSubmit={submitCustom} className="pt-4 border-t border-gray-100 space-y-3">
            <p className="text-sm font-medium">Poptávka na {fmtDate(customDate)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                Jméno / kontaktní osoba
                <input
                  required
                  className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Kontakt (e-mail nebo telefon)
                <input
                  required
                  className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                  value={customContact}
                  onChange={(e) => setCustomContact(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Přibližný počet osob
                <input
                  className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                  value={customPeople}
                  onChange={(e) => setCustomPeople(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm">
              Poznámka (např. preferovaný čas, téma kurzu)
              <input
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
              />
            </label>
            <button className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">Odeslat poptávku</button>
          </form>
        )}
        {customSent === "ok" && <p className="text-sm text-green-700 mt-3">Poptávka odeslána, ozveme se s potvrzením nebo návrhem termínu.</p>}
        {customSent === "err" && <p className="text-sm text-red-700 mt-3">Něco se nepovedlo, zkuste to prosím znovu.</p>}
      </div>
    </main>
  );
}
