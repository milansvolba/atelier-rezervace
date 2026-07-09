"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Booking,
  PHYSICAL_RESOURCES,
  RESOURCE_LABELS,
  ResourceId,
  resourcesConflict,
} from "@/lib/types";
import {
  DAY_NAMES_MON_FIRST,
  MONTH_NAMES,
  addDays,
  addMonths,
  iso,
  monthMatrix,
  startOfWeekMon,
} from "@/lib/calendar";

type ViewMode = "day" | "week" | "month" | "quarter" | "year";
type Role = "admin" | "member";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const DAY_START = 6;
const DAY_END = 20;

function pct(time: string) {
  const [h, m] = time.split(":").map(Number);
  const minutes = (h - DAY_START) * 60 + m;
  return Math.max(0, Math.min(100, (minutes / ((DAY_END - DAY_START) * 60)) * 100));
}

function fmt(d: Date) {
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
}

function fmtFull(d: Date) {
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}

const RESOURCE_OPTIONS: { value: ResourceId; label: string }[] = [
  { value: "okno1", label: "Okno 1" },
  { value: "stul1", label: "Stůl 1" },
  { value: "stul2", label: "Stůl 2" },
  { value: "bar", label: "Bar" },
  { value: "pingpong", label: "Pingpongový stůl" },
  { value: "klubovna", label: "Klubovna (celá)" },
  { value: "atelier", label: "Celý ateliér / kurz" },
];

// Rychlé dvouhodinové bloky pro pingpong / krátké rezervace — ať nikdo
// pokaždé nemusí ručně vypisovat čas.
function twoHourBlocks() {
  const blocks: { start: string; end: string }[] = [];
  for (let h = DAY_START; h < DAY_END; h += 2) {
    blocks.push({ start: `${String(h).padStart(2, "0")}:00`, end: `${String(h + 2).padStart(2, "0")}:00` });
  }
  return blocks;
}

// Popisek aktuálního rozsahu — vždy viditelný, ať je jasné, na co se člověk dívá.
function rangeLabel(view: ViewMode, anchor: Date): string {
  if (view === "day") return fmtFull(anchor);
  if (view === "week") {
    const mon = startOfWeekMon(anchor);
    const sun = addDays(mon, 6);
    const sameMonth = mon.getMonth() === sun.getMonth();
    const left = sameMonth ? `${mon.getDate()}.` : fmt(mon);
    return `${left} – ${fmt(sun)} ${sun.getFullYear()}`;
  }
  if (view === "month") return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  if (view === "quarter") {
    const q = Math.floor(anchor.getMonth() / 3);
    const first = q * 3;
    return `${q + 1}. kvartál ${anchor.getFullYear()} (${MONTH_NAMES[first]}–${MONTH_NAMES[first + 2]})`;
  }
  return `Rok ${anchor.getFullYear()}`;
}

function shiftAnchor(view: ViewMode, anchor: Date, dir: 1 | -1): Date {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, dir * 7);
  if (view === "month") return addMonths(anchor, dir);
  if (view === "quarter") return addMonths(anchor, dir * 3);
  return new Date(anchor.getFullYear() + dir, anchor.getMonth(), 1);
}

// Zjistí "efektivní" stav místa v daný den — including nepřímé blokace
// (např. Okno 1 je obsazené, protože je pronajatý pingpong nebo klubovna).
type Effective =
  | { kind: "confirmed"; items: Booking[] }
  | { kind: "blocked"; by: Booking }
  | { kind: "pending"; items: Booking[] }
  | { kind: "free" };

function effectiveStatus(resource: ResourceId, dateISO: string, bookings: Booking[]): Effective {
  const day = bookings.filter((b) => b.date === dateISO);
  const direct = day.filter((b) => b.resource === resource && b.status === "confirmed");
  if (direct.length) return { kind: "confirmed", items: direct };
  const blocking = day.find(
    (b) => b.status === "confirmed" && b.resource !== resource && resourcesConflict(resource, b.resource)
  );
  if (blocking) return { kind: "blocked", by: blocking };
  const pending = day.filter((b) => b.resource === resource && b.status === "pending");
  if (pending.length) return { kind: "pending", items: pending };
  return { kind: "free" };
}

function cellClasses(kind: Effective["kind"]) {
  switch (kind) {
    case "confirmed":
      return "bg-[#5DCAA5] text-[#04342C]";
    case "blocked":
      return "bg-[#F0997B] text-[#4A1B0C]";
    case "pending":
      return "bg-[#FAC775] text-[#412402]";
    default:
      return "bg-gray-100 text-gray-400";
  }
}

export default function AdminPage() {
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined);

  async function load() {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setSession(data.user);
  }

  useEffect(() => {
    load();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
  }

  if (session === undefined) {
    return <main className="max-w-sm mx-auto mt-12 text-sm text-gray-400">Načítám…</main>;
  }

  if (!session) {
    return <LoginForm />;
  }

  return <AdminDashboard session={session} onLogout={logout} />;
}

// Přihlášení bez hesla — magic link poslaný e-mailem (funguje jen pro účty,
// které existují v tabulce users; nové členy zakládá admin ručně).
function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chyba = params.get("chyba");
    if (chyba === "neplatny_odkaz") setError("Odkaz už není platný — vyžádejte si nový.");
    else if (chyba === "ucet_nenalezen") setError("Tenhle účet v systému nemáme.");
    else if (chyba === "chybi_token") setError("Odkaz je neúplný — vyžádejte si nový.");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se odeslat odkaz.");
    }
  }

  if (sent) {
    return (
      <main className="max-w-sm mx-auto mt-12">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
          <p className="font-medium">Zkontrolujte e-mail</p>
          <p className="text-sm text-gray-500">
            Na <strong>{email}</strong> jsme poslali přihlašovací odkaz. Klikněte na něj — platí 15 minut.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto mt-12">
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="font-medium">Přihlášení</p>
        <p className="text-xs text-gray-500">Zadejte e-mail, na který máte založený účet — pošleme vám přihlašovací odkaz.</p>
        <input
          type="email"
          required
          autoFocus
          className="w-full h-10 border border-gray-300 rounded-md px-2"
          placeholder="vas@email.cz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={sending} className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-50">
          {sending ? "Odesílám…" : "Poslat přihlašovací odkaz"}
        </button>
      </form>
    </main>
  );
}

// Rychlé vytvoření rezervace z modálu — nepřepíná na celý denní pohled.
function QuickAddModal({
  resource,
  date,
  members,
  onClose,
  onSaved,
  onOpenDay,
}: {
  resource: ResourceId;
  date: string;
  members: AppUser[];
  onClose: () => void;
  onSaved: () => void;
  onOpenDay: () => void;
}) {
  const [form, setForm] = useState({ resource, startTime: "09:00", endTime: "11:00", title: "", requesterContact: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [matchedMemberId, setMatchedMemberId] = useState<string | null>(null);
  const showQuickBlocks = form.resource === "pingpong" || form.resource === "klubovna";

  function onTitleChange(value: string) {
    const match = members.find((m) => m.name.toLowerCase() === value.trim().toLowerCase());
    setMatchedMemberId(match ? match.id : null);
    setForm((f) => ({
      ...f,
      title: value,
      requesterContact: match && !f.requesterContact ? match.email : f.requesterContact,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, date, memberUserId: matchedMemberId }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se uložit.");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form onSubmit={save} className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">
            Nová rezervace · {fmt(new Date(date))}
          </p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">
            ✕
          </button>
        </div>

        <label className="block text-sm">
          Místo
          <select
            className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
            value={form.resource}
            onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value as ResourceId }))}
          >
            {RESOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Kdo / co
          <input
            required
            autoFocus
            list="quickadd-member-suggestions"
            className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
            value={form.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Jméno nebo název akce"
          />
          <datalist id="quickadd-member-suggestions">
            {members.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </label>

        <div className="grid grid-cols-2 gap-3">
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

        {showQuickBlocks && (
          <div className="flex flex-wrap gap-2">
            {twoHourBlocks().map((b) => (
              <button
                type="button"
                key={b.start}
                onClick={() => setForm((f) => ({ ...f, startTime: b.start, endTime: b.end }))}
                className={`h-8 px-2.5 rounded-md border text-xs ${
                  form.startTime === b.start && form.endTime === b.end
                    ? "border-gray-800 font-medium"
                    : "border-gray-300 text-gray-500"
                }`}
              >
                {b.start}–{b.end}
              </button>
            ))}
          </div>
        )}

        <label className="block text-sm">
          Kontakt (pro upozornění, nepovinné)
          <input
            className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
            value={form.requesterContact}
            onChange={(e) => setForm((f) => ({ ...f, requesterContact: e.target.value }))}
            placeholder="e-mail nebo telefon"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onOpenDay} className="text-xs text-gray-500 hover:text-gray-800">
            Zobrazit celý den →
          </button>
          <button disabled={saving} className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-50">
            {saving ? "Ukládám…" : "Zapsat rezervaci"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Detail existující rezervace — náhled, úprava, nebo smazání, s volitelným
// upozorněním rezervisty e-mailem (pokud u rezervace máme kontakt). Server hlídá,
// že člen smí takhle sahat jen na vlastní rezervace — admin na cokoli.
function BookingDetailModal({
  booking,
  onClose,
  onSaved,
}: {
  booking: Booking;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [form, setForm] = useState({
    resource: booking.resource,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    title: booking.title,
    requesterContact: booking.requesterContact || "",
  });
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const showQuickBlocks = form.resource === "pingpong" || form.resource === "klubovna";
  const hasContact = !!(booking.requesterContact || form.requesterContact);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, notify }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se uložit.");
    }
  }

  async function confirmDelete() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notify }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se smazat.");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">
            {mode === "view" ? "Detail rezervace" : mode === "edit" ? "Změnit rezervaci" : "Smazat rezervaci"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">
            ✕
          </button>
        </div>

        {mode === "view" && (
          <>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-gray-500">Kde:</span> {RESOURCE_LABELS[booking.resource]}
              </p>
              <p>
                <span className="text-gray-500">Kdy:</span> {fmt(new Date(booking.date))} {booking.startTime}–{booking.endTime}
              </p>
              <p>
                <span className="text-gray-500">Kdo:</span> {booking.title}
              </p>
              <p>
                <span className="text-gray-500">Kontakt:</span> {booking.requesterContact || "— (nezadán)"}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setMode("delete")}
                className="h-9 px-3 rounded-md border border-red-200 text-red-600 text-sm"
              >
                Smazat
              </button>
              <button onClick={() => setMode("edit")} className="h-9 px-3 rounded-md bg-gray-900 text-white text-sm">
                Změnit
              </button>
            </div>
          </>
        )}

        {mode === "edit" && (
          <form onSubmit={saveEdit} className="space-y-3">
            <label className="block text-sm">
              Místo
              <select
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={form.resource}
                onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value as ResourceId }))}
              >
                {RESOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Kdo / co
              <input
                required
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm">
                Datum
                <input
                  type="date"
                  className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
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
            {showQuickBlocks && (
              <div className="flex flex-wrap gap-2">
                {twoHourBlocks().map((b) => (
                  <button
                    type="button"
                    key={b.start}
                    onClick={() => setForm((f) => ({ ...f, startTime: b.start, endTime: b.end }))}
                    className={`h-8 px-2.5 rounded-md border text-xs ${
                      form.startTime === b.start && form.endTime === b.end
                        ? "border-gray-800 font-medium"
                        : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {b.start}–{b.end}
                  </button>
                ))}
              </div>
            )}
            <label className="block text-sm">
              Kontakt (pro upozornění, nepovinné)
              <input
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={form.requesterContact}
                onChange={(e) => setForm((f) => ({ ...f, requesterContact: e.target.value }))}
                placeholder="e-mail nebo telefon"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!hasContact}
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Informovat rezervistu o změně
              {!hasContact && <span className="text-xs text-gray-400">(chybí kontakt)</span>}
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setMode("view")} className="text-xs text-gray-500 hover:text-gray-800">
                ← Zpět
              </button>
              <button disabled={saving} className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-50">
                {saving ? "Ukládám…" : "Uložit změny"}
              </button>
            </div>
          </form>
        )}

        {mode === "delete" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Opravdu smazat rezervaci „{booking.title}" ({fmt(new Date(booking.date))} {booking.startTime}–{booking.endTime})?
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!hasContact}
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Informovat rezervistu o zrušení
              {!hasContact && <span className="text-xs text-gray-400">(chybí kontakt)</span>}
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setMode("view")} className="text-xs text-gray-500 hover:text-gray-800">
                ← Zpět
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="h-10 px-4 rounded-md bg-red-600 text-white text-sm disabled:opacity-50"
              >
                {saving ? "Mažu…" : "Potvrdit smazání"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Správa účtů (jen admin) — ruční přidání/odebrání jmenných účtů.
function MembersPanel({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<AppUser[]>([]);
  const [form, setForm] = useState<{ name: string; email: string; role: Role }>({
    name: "",
    email: "",
    role: "member",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) setList(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ name: "", email: "", role: "member" });
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se přidat.");
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Opravdu odebrat tento účet?")) return;
    setError(null);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se odebrat.");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
    <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="font-medium">Účty</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
      </div>
      {list.length > 0 && (
        <div className="space-y-2">
          {list.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between text-sm border-t border-gray-100 pt-2 first:border-t-0 first:pt-0"
            >
              <span>
                {u.name} · {u.email} · <span className="text-gray-400">{u.role === "admin" ? "admin" : "člen"}</span>
              </span>
              <button onClick={() => removeUser(u.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">
                Odebrat
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={addUser} className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-100">
        <label className="text-xs">
          Jméno
          <input
            required
            className="mt-1 h-9 w-32 border border-gray-300 rounded-md px-2 text-sm block"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="text-xs">
          E-mail
          <input
            required
            type="email"
            className="mt-1 h-9 w-48 border border-gray-300 rounded-md px-2 text-sm block"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label className="text-xs">
          Role
          <select
            className="mt-1 h-9 border border-gray-300 rounded-md px-2 text-sm block"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
          >
            <option value="member">Člen</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button disabled={saving} className="h-9 px-3 rounded-md bg-gray-900 text-white text-sm disabled:opacity-50">
          {saving ? "Přidávám…" : "Přidat"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
    </div>
  );
}

function AdminDashboard({ session, onLogout }: { session: SessionUser; onLogout: () => void }) {
  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(new Date());
  const [filterResource, setFilterResource] = useState<ResourceId | "summary">("summary");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ resource: ResourceId; date: string } | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [matchedMemberId, setMatchedMemberId] = useState<string | null>(null);
  const [form, setForm] = useState<{ resource: ResourceId; startTime: string; endTime: string; title: string; requesterContact: string }>({
    resource: "stul1",
    startTime: "09:00",
    endTime: "11:00",
    title: "",
    requesterContact: "",
  });

  const date = iso(anchor);
  const isAdmin = session.role === "admin";

  async function load() {
    const res = await fetch("/api/bookings");
    setBookings(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  // Pro našeptávání jmen registrovaných členů při zadávání rezervace — jen admin
  // (GET /api/users je admin-only a jen admin zadává rezervace "za někoho jiného").
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTitleChange(value: string) {
    const match = members.find((m) => m.name.toLowerCase() === value.trim().toLowerCase());
    setMatchedMemberId(match ? match.id : null);
    setForm((f) => ({
      ...f,
      title: value,
      requesterContact: match && !f.requesterContact ? match.email : f.requesterContact,
    }));
  }

  function goto(view_: ViewMode, d: Date) {
    setAnchor(d);
    setView(view_);
  }

  const pending = useMemo(
    () => bookings.filter((b) => b.status === "pending").sort((a, b) => (a.date < b.date ? -1 : 1)),
    [bookings]
  );

  const myBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.userId === session.id && b.status === "confirmed" && b.date >= iso(new Date()))
        .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1)),
    [bookings, session.id]
  );

  const confirmedByResourceToday = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const r of Object.keys(RESOURCE_LABELS)) map[r] = [];
    for (const b of bookings) {
      if (b.status !== "confirmed" || b.date !== date) continue;
      if (map[b.resource]) map[b.resource].push(b);
    }
    return map;
  }, [bookings, date]);

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, date, memberUserId: matchedMemberId }),
    });
    if (res.ok) {
      setForm((f) => ({ ...f, title: "", requesterContact: "" }));
      setMatchedMemberId(null);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: noteDrafts[id] }),
    });
    if (res.ok) {
      setNoteDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Nepodařilo se rozhodnout.");
    }
  }

  const showQuickBlocks = form.resource === "pingpong" || form.resource === "klubovna";

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-md p-1 text-xs">
          {(["day", "week", "month", "quarter", "year"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`h-7 px-2.5 rounded ${view === v ? "bg-white shadow-sm font-medium" : "text-gray-500"}`}
            >
              {v === "day" ? "Den" : v === "week" ? "Týden" : v === "month" ? "Měsíc" : v === "quarter" ? "Kvartál" : "Rok"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {session.name} · {isAdmin ? "admin" : "člen"}
          </span>
          {isAdmin && (
            <button onClick={() => setShowMembers(true)} className="text-sm text-gray-500 hover:text-gray-800">
              Účty
            </button>
          )}
          <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-800">
            Odhlásit
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}
            className="h-8 w-8 rounded-md border border-gray-300 text-sm"
            aria-label="Předchozí"
          >
            ‹
          </button>
          <p className="font-medium min-w-[220px]">{rangeLabel(view, anchor)}</p>
          <button
            onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}
            className="h-8 w-8 rounded-md border border-gray-300 text-sm"
            aria-label="Následující"
          >
            ›
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="h-8 px-3 rounded-md border border-gray-300 text-xs text-gray-500"
          >
            Dnes
          </button>
        </div>

        {view !== "day" && view !== "week" && (
          <select
            className="h-8 border border-gray-300 rounded-md px-2 text-sm"
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value as ResourceId | "summary")}
          >
            <option value="summary">Souhrn (všechna místa)</option>
            {PHYSICAL_RESOURCES.map((r) => (
              <option key={r} value={r}>
                {RESOURCE_LABELS[r]}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="bg-white border border-red-200 text-red-600 rounded-xl p-3 text-sm">{error}</div>}

      {isAdmin && pending.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
              {pending.length}
            </span>
            <p className="font-semibold text-amber-900">Žádosti ke schválení</p>
          </div>
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="border-t border-amber-200 pt-3 first:border-t-0 first:pt-0 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-amber-950">
                      {RESOURCE_LABELS[p.resource]} · {fmt(new Date(p.date))} {p.startTime}–{p.endTime}
                    </p>
                    <p className="text-xs text-amber-800/70">
                      {p.requesterName} · {p.requesterContact}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => decide(p.id, "approve")} className="h-8 px-3 rounded-md bg-white border border-amber-300 text-xs hover:bg-amber-100">
                      Schválit
                    </button>
                    <button onClick={() => decide(p.id, "reject")} className="h-8 px-3 rounded-md bg-white border border-amber-300 text-xs hover:bg-amber-100">
                      Zamítnout
                    </button>
                  </div>
                </div>
                <input
                  className="w-full h-8 border border-amber-200 rounded-md px-2 text-xs bg-white"
                  placeholder="Poznámka pro žadatele (nepovinné, přidá se do e-mailu s rozhodnutím)"
                  value={noteDrafts[p.id] || ""}
                  onChange={(e) => setNoteDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {myBookings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-medium mb-3">Moje rezervace</p>
          <div className="space-y-2">
            {myBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between text-sm border-t border-gray-100 pt-2 first:border-t-0 first:pt-0 gap-3"
              >
                <span>
                  {RESOURCE_LABELS[b.resource]} · {fmt(new Date(b.date))} {b.startTime}–{b.endTime} · {b.title}
                </span>
                <button
                  onClick={() => setDetailBooking(b)}
                  className="h-7 px-2.5 rounded-md border border-gray-300 text-xs shrink-0"
                >
                  Změnit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "day" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="font-medium mb-3">Rozpis {fmt(anchor)}</p>
            <div className="space-y-2.5">
              {(["atelier", "klubovna"] as ResourceId[]).map((r) =>
                confirmedByResourceToday[r].length > 0 ? (
                  <div key={r} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-sm font-medium">{RESOURCE_LABELS[r]}</div>
                    <div className="relative flex-1 h-7 bg-gray-100 rounded-md">
                      {confirmedByResourceToday[r].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setDetailBooking(b)}
                          className="absolute top-0 bottom-0 bg-[#F0997B] rounded-md text-[11px] text-[#4A1B0C] flex items-center px-1.5 overflow-hidden whitespace-nowrap hover:opacity-80"
                          style={{ left: `${pct(b.startTime)}%`, width: `${pct(b.endTime) - pct(b.startTime)}%` }}
                          title={`${b.title} ${b.startTime}–${b.endTime} — klik pro detail`}
                        >
                          {b.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
              {PHYSICAL_RESOURCES.map((r) => (
                <div key={r} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-sm">{RESOURCE_LABELS[r]}</div>
                  <div className="relative flex-1 h-7 bg-gray-100 rounded-md">
                    {confirmedByResourceToday[r].map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setDetailBooking(b)}
                        className="absolute top-0 bottom-0 bg-[#5DCAA5] rounded-md text-[11px] text-[#04342C] flex items-center px-1.5 overflow-hidden whitespace-nowrap hover:opacity-80"
                        style={{ left: `${pct(b.startTime)}%`, width: `${pct(b.endTime) - pct(b.startTime)}%` }}
                        title={`${b.title} ${b.startTime}–${b.endTime} — klik pro detail`}
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={createBooking} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <p className="font-medium">Nová rezervace ({fmt(anchor)})</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Místo
                <select
                  className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                  value={form.resource}
                  onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value as ResourceId }))}
                >
                  {RESOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Kdo / co
                <input
                  required
                  list="dayform-member-suggestions"
                  className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                  value={form.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Jméno nebo název akce"
                />
                <datalist id="dayform-member-suggestions">
                  {members.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
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

            {showQuickBlocks && (
              <div className="flex flex-wrap gap-2">
                {twoHourBlocks().map((b) => (
                  <button
                    type="button"
                    key={b.start}
                    onClick={() => setForm((f) => ({ ...f, startTime: b.start, endTime: b.end }))}
                    className={`h-8 px-2.5 rounded-md border text-xs ${
                      form.startTime === b.start && form.endTime === b.end
                        ? "border-gray-800 font-medium"
                        : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {b.start}–{b.end}
                  </button>
                ))}
              </div>
            )}

            <label className="block text-sm">
              Kontakt (pro upozornění, nepovinné)
              <input
                className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                value={form.requesterContact}
                onChange={(e) => setForm((f) => ({ ...f, requesterContact: e.target.value }))}
                placeholder="e-mail nebo telefon"
              />
            </label>

            <button className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">Zapsat rezervaci</button>
          </form>
        </>
      )}

      {view === "week" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left text-xs text-gray-400 font-normal pb-2 w-28">Místo</th>
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = addDays(startOfWeekMon(anchor), i);
                  return (
                    <th key={i} className="text-xs text-gray-400 font-normal pb-2">
                      <button onClick={() => goto("day", d)} className="hover:text-gray-800">
                        {DAY_NAMES_MON_FIRST[i]} {d.getDate()}.
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PHYSICAL_RESOURCES.map((r) => (
                <tr key={r}>
                  <td className="text-sm py-1 pr-2 whitespace-nowrap">{RESOURCE_LABELS[r]}</td>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = addDays(startOfWeekMon(anchor), i);
                    const dISO = iso(d);
                    const eff = effectiveStatus(r, dISO, bookings);
                    const cellText =
                      eff.kind === "confirmed"
                        ? eff.items.map((b) => `${b.startTime}–${b.endTime}`).join(", ")
                        : eff.kind === "blocked"
                        ? `${eff.by.startTime}–${eff.by.endTime}`
                        : eff.kind === "pending"
                        ? "čeká"
                        : "";
                    const hoverTitle =
                      eff.kind === "confirmed"
                        ? eff.items.map((b) => `${b.title} ${b.startTime}–${b.endTime}`).join(", ")
                        : eff.kind === "blocked"
                        ? `Blokováno (${RESOURCE_LABELS[eff.by.resource]} ${eff.by.startTime}–${eff.by.endTime})`
                        : eff.kind === "pending"
                        ? "Čeká na schválení"
                        : "volno — klik pro rezervaci";
                    return (
                      <td key={i} className="p-1">
                        <button
                          onClick={() =>
                            eff.kind === "confirmed" && eff.items.length === 1
                              ? setDetailBooking(eff.items[0])
                              : setQuickAdd({ resource: r, date: dISO })
                          }
                          title={hoverTitle}
                          className={`w-full h-10 rounded-md text-[10px] px-1 flex items-center justify-center text-center overflow-hidden ${cellClasses(
                            eff.kind
                          )}`}
                        >
                          <span className="truncate">{cellText}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(view === "month" || view === "quarter" || view === "year") && (
        <div
          className={`grid gap-4 ${
            view === "month" ? "grid-cols-1" : view === "quarter" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          }`}
        >
          {(() => {
            const count = view === "month" ? 1 : view === "quarter" ? 3 : 12;
            const startMonth = view === "quarter" ? Math.floor(anchor.getMonth() / 3) * 3 : anchor.getMonth();
            const months = Array.from({ length: count }).map((_, i) => {
              const d = new Date(anchor.getFullYear(), startMonth + i, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            });
            return months.map(({ year, month }) => (
              <div key={`${year}-${month}`} className="bg-white border border-gray-200 rounded-xl p-4">
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
                        const dISO = iso(d);
                        let kind: Effective["kind"] | "mixed" = "free";
                        let title = "";
                        if (filterResource === "summary") {
                          const statuses = PHYSICAL_RESOURCES.map((r) => effectiveStatus(r, dISO, bookings).kind);
                          const freeCount = statuses.filter((k) => k === "free").length;
                          title = `${freeCount} / ${PHYSICAL_RESOURCES.length} volno`;
                          kind = freeCount === PHYSICAL_RESOURCES.length ? "free" : freeCount === 0 ? "confirmed" : "pending";
                        } else {
                          const eff = effectiveStatus(filterResource, dISO, bookings);
                          kind = eff.kind;
                          title =
                            eff.kind === "confirmed"
                              ? eff.items.map((b) => `${b.title} ${b.startTime}–${b.endTime}`).join(", ")
                              : eff.kind === "blocked"
                              ? `Blokováno (${RESOURCE_LABELS[eff.by.resource]} ${eff.by.startTime}–${eff.by.endTime})`
                              : eff.kind === "pending"
                              ? "Čeká na schválení"
                              : "volno";
                        }
                        return (
                          <button
                            key={di}
                            onClick={() => {
                              if (filterResource !== "summary") {
                                const eff = effectiveStatus(filterResource, dISO, bookings);
                                if (eff.kind === "confirmed" && eff.items.length === 1) {
                                  setDetailBooking(eff.items[0]);
                                  return;
                                }
                              }
                              setQuickAdd({
                                resource: filterResource === "summary" ? "stul1" : filterResource,
                                date: dISO,
                              });
                            }}
                            title={title}
                            className={`aspect-square rounded-sm text-[10px] flex items-center justify-center ${cellClasses(
                              kind as Effective["kind"]
                            )}`}
                          >
                            {view === "year" ? "" : d.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 inline-block" /> volno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#5DCAA5] inline-block" /> rezervováno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#FAC775] inline-block" /> čeká na schválení
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#F0997B] inline-block" /> blokováno jiným místem
        </span>
      </div>

      {quickAdd && (
        <QuickAddModal
          resource={quickAdd.resource}
          date={quickAdd.date}
          members={members}
          onClose={() => setQuickAdd(null)}
          onSaved={load}
          onOpenDay={() => {
            goto("day", new Date(quickAdd.date));
            setQuickAdd(null);
          }}
        />
      )}

      {detailBooking && (
        <BookingDetailModal booking={detailBooking} onClose={() => setDetailBooking(null)} onSaved={load} />
      )}

      {showMembers && <MembersPanel onClose={() => setShowMembers(false)} />}
    </main>
  );
}
