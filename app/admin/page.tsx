"use client";

import { useEffect, useMemo, useState } from "react";
import { Booking, PHYSICAL_RESOURCES, RESOURCE_LABELS, ResourceId } from "@/lib/types";

const DAY_START = 8;
const DAY_END = 20;

function pct(time: string) {
  const [h, m] = time.split(":").map(Number);
  const minutes = (h - DAY_START) * 60 + m;
  return Math.max(0, Math.min(100, (minutes / ((DAY_END - DAY_START) * 60)) * 100));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (saved) setToken(saved);
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      localStorage.setItem("admin_token", pw);
      setToken(pw);
      setLoginErr(false);
    } else {
      setLoginErr(true);
    }
  }

  if (!token) {
    return (
      <main className="max-w-sm mx-auto mt-12">
        <form onSubmit={login} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="font-medium">Přihlášení adminů</p>
          <p className="text-xs text-gray-500">
            Zatím jednoduché sdílené heslo (demo). Před ostrým provozem vyměnit za jmenné účty Milana a Petra.
          </p>
          <input
            type="password"
            className="w-full h-10 border border-gray-300 rounded-md px-2"
            placeholder="Heslo"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {loginErr && <p className="text-sm text-red-600">Špatné heslo.</p>}
          <button className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">Přihlásit</button>
        </form>
      </main>
    );
  }

  return <AdminDashboard token={token} onLogout={() => { localStorage.removeItem("admin_token"); setToken(null); }} />;
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ resource: ResourceId; startTime: string; endTime: string; title: string }>({
    resource: "stul1",
    startTime: "09:00",
    endTime: "11:00",
    title: "",
  });

  async function load() {
    const res = await fetch(`/api/bookings?date=${date}`);
    setBookings(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const pending = bookings.filter((b) => b.status === "pending");
  const confirmedByResource = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const r of PHYSICAL_RESOURCES) map[r] = [];
    for (const b of bookings) {
      if (b.status !== "confirmed") continue;
      if (map[b.resource]) map[b.resource].push(b);
    }
    return map;
  }, [bookings]);

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ ...form, date }),
    });
    if (res.ok) {
      setForm((f) => ({ ...f, title: "" }));
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se uložit.");
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    setError(null);
    const res = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se rozhodnout.");
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <input
          type="date"
          className="h-10 border border-gray-300 rounded-md px-2 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-800">
          Odhlásit
        </button>
      </div>

      {error && <div className="bg-white border border-red-200 text-red-600 rounded-xl p-3 text-sm">{error}</div>}

      {pending.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-medium mb-3">Žádosti ke schválení</p>
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {RESOURCE_LABELS[p.resource]} · {p.date} {p.startTime}–{p.endTime}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.requesterName} · {p.requesterContact}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decide(p.id, "approve")} className="h-8 px-3 rounded-md border border-gray-300 text-xs">
                    Schválit
                  </button>
                  <button onClick={() => decide(p.id, "reject")} className="h-8 px-3 rounded-md border border-gray-300 text-xs">
                    Zamítnout
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="font-medium mb-3">Rozpis {date}</p>
        <div className="space-y-2.5">
          {PHYSICAL_RESOURCES.map((r) => (
            <div key={r} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-sm">{RESOURCE_LABELS[r]}</div>
              <div className="relative flex-1 h-7 bg-gray-100 rounded-md">
                {confirmedByResource[r].map((b) => (
                  <div
                    key={b.id}
                    className="absolute top-0 bottom-0 bg-[#5DCAA5] rounded-md text-[11px] text-[#04342C] flex items-center px-1.5 overflow-hidden whitespace-nowrap"
                    style={{ left: `${pct(b.startTime)}%`, width: `${pct(b.endTime) - pct(b.startTime)}%` }}
                    title={`${b.title} ${b.startTime}–${b.endTime}`}
                  >
                    {b.title}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={createBooking} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="font-medium">Nová rezervace ({date})</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Místo
            <select
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
              value={form.resource}
              onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value as ResourceId }))}
            >
              <option value="okno1">Okno 1</option>
              <option value="stul1">Stůl 1</option>
              <option value="stul2">Stůl 2</option>
              <option value="bar">Bar</option>
              <option value="pingpong">Pingpongový stůl</option>
              <option value="klubovna">Klubovna (celá)</option>
              <option value="atelier">Celý ateliér / kurz</option>
            </select>
          </label>
          <label className="text-sm">
            Kdo / co
            <input
              required
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Jméno nebo název akce"
            />
          </label>
          <label className="text-sm">
            Od
            <input
              type="time"
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Do
            <input
              type="time"
              className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </label>
        </div>
        <button className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">Zapsat rezervaci</button>
      </form>
    </main>
  );
}
