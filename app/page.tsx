"use client";

import { useEffect, useState } from "react";
import { Booking, ResourceId, RESOURCE_LABELS } from "@/lib/types";

function nextDays(n: number) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

export default function PublicPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
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

  const days = nextDays(7);

  // Den je pro veřejnost "obsazený", pokud existuje potvrzená rezervace typu
  // atelier nebo klubovna (tedy něco, co blokuje celý prostor nebo jeho podstatnou část).
  function dayStatus(d: Date) {
    const iso = d.toISOString().slice(0, 10);
    const dayBookings = bookings.filter((b) => b.date === iso);
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

  return (
    <main className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="font-medium mb-1">Obsazenost prostoru</p>
        <p className="text-sm text-gray-500 mb-4">
          Zobrazuje jen pronájem celého ateliéru nebo klubovny. Jednotlivá pracovní místa si rezervujeme interně.
        </p>
        <div className="grid grid-cols-7 gap-2 mb-4">
          {days.map((d) => {
            const status = dayStatus(d);
            const bg = status === "rental" ? "bg-rental" : status === "pending" ? "bg-pending" : "bg-free";
            return (
              <div key={d.toISOString()} className="text-center">
                <div className="text-xs text-gray-400 mb-1">{DAY_NAMES[d.getDay()]}</div>
                <div className={`h-10 rounded-md ${bg} flex items-center justify-center text-xs`}>
                  {d.getDate()}.
                </div>
              </div>
            );
          })}
        </div>
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
