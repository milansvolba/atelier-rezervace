"use client";

import { useEffect, useState } from "react";

// Správa slevových promokódů (jen admin): vytvoření dávky jedinečných kódů, přehled, zrušení a tisk kupónů (4 na A4).
// Pravidla viz lib/promo.ts. Použitý kód zrušit nejde. Kód se spotřebuje až po zaplacení.

interface PromoRow {
  id: string;
  code: string;
  kind: "percent" | "fixed_price";
  value: number;
  scope: "kurz" | "poukaz" | "oboje";
  bookingId?: string;
  label?: string;
  expiresAt: string;
  status: "active" | "reserved" | "used" | "void";
  usedAt?: string;
  usedEmail?: string;
  maxPeople?: number;
}

const STATUS_LABEL: Record<PromoRow["status"], string> = { active: "volný", reserved: "rozdělaná platba", used: "použitý", void: "zrušený" };
const SCOPE_LABEL: Record<PromoRow["scope"], string> = { kurz: "kurz", poukaz: "poukaz", oboje: "kurz i poukaz" };

function fmtD(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d + ". " + m + ". " + y;
}

export default function PromoAdmin({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState("16");
  const [maxPeople, setMaxPeople] = useState("1");
  const [kind, setKind] = useState<"percent" | "fixed_price">("percent");
  const [value, setValue] = useState("20");
  const [scope, setScope] = useState<"kurz" | "poukaz" | "oboje">("kurz");
  const [expiresOn, setExpiresOn] = useState("2027-01-31");
  const [label, setLabel] = useState("");
  const [filter, setFilter] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [terms, setTerms] = useState<{ id: string; title: string; date: string }[]>([]);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/promo");
    if (r.ok) setRows(await r.json());
    else setError("Kódy se nepodařilo načíst.");
    setLoading(false);
  }
  useEffect(() => {
    load();
    // Termíny kurzů pro volitelné omezení kódu (veřejný seznam, jen budoucí).
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTerms(Array.isArray(d) ? d.map((c: { id: string; title: string; date: string }) => ({ id: c.id, title: c.title, date: c.date })) : []))
      .catch(() => setTerms([]));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const n = Number(count);
    // Potvrzení, ať se omylem nevytvoří desítky kódů (kódy se pak jen ruší, nemažou).
    if (!window.confirm("Vytvořit " + n + " jednorázových kódů (" + (kind === "percent" ? "sleva " + value + " %" : "kurz za " + value + " Kč") + ", platnost do " + fmtD(expiresOn) + (bookingId && scope !== "poukaz" ? ", jen na vybraný termín" : "") + ")?")) return;
    setBusy(true);
    const r = await fetch("/api/admin/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: n, kind, value: Number(value), scope, maxPeople: Number(maxPeople), expiresOn, label: label.trim() || undefined, bookingId: scope !== "poukaz" && bookingId ? bookingId : undefined }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(d.error || "Kódy se nepodařilo vytvořit.");
      return;
    }
    await load();
    if (label.trim()) setFilter(label.trim());
  }

  async function voidOne(id: string) {
    if (!window.confirm("Zrušit tento kód? Už se nebude dát použít.")) return;
    const r = await fetch("/api/admin/promo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    if (!r.ok) setError("Kód se nepodařilo zrušit.");
    await load();
  }

  const labels = Array.from(new Set(rows.map((r) => r.label).filter(Boolean))) as string[];
  const shown = filter ? rows.filter((r) => r.label === filter) : rows;
  const printable = shown.filter((r) => r.status === "active" || r.status === "reserved");

  const input = "mt-1 w-full h-9 border border-gray-300 rounded-md px-2 text-sm";
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl p-5 w-full max-w-3xl space-y-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="font-medium">Slevové kódy</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
        </div>
        <p className="text-xs text-gray-500">
          Každý kód jde použít jen jednou a spotřebuje se až po zaplacení. Sleva se týká jen ceny kurzu (ne odlitků) a nesčítá se s množstevní slevou: platí výhodnější. S dárkovým poukazem se kód nespojí.
        </p>

        <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3 border border-gray-200 rounded-md p-3">
          <label className="text-sm">Počet kódů
            <input className={input} type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <label className="text-sm">Nejvýš míst na kód
            <input className={input} type="number" min={1} max={6} value={maxPeople} onChange={(e) => setMaxPeople(e.target.value)} />
          </label>
          <label className="text-sm">Typ slevy
            <select className={input} value={kind} onChange={(e) => { const k = e.target.value as "percent" | "fixed_price"; setKind(k); setValue(k === "percent" ? "20" : "30"); }}>
              <option value="percent">Procenta z ceny kurzu</option>
              <option value="fixed_price">Pevná cena kurzu za osobu (Kč)</option>
            </select>
          </label>
          <label className="text-sm">{kind === "percent" ? "Sleva (%)" : "Výsledná cena kurzu (Kč, min. 15)"}
            <input className={input} type="number" min={kind === "percent" ? 1 : 15} max={kind === "percent" ? 100 : 100000} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label className="text-sm">Kde platí
            <select className={input} value={scope} onChange={(e) => setScope(e.target.value as "kurz" | "poukaz" | "oboje")}>
              <option value="kurz">Jen kurz</option>
              <option value="poukaz">Jen dárkový poukaz</option>
              <option value="oboje">Kurz i poukaz</option>
            </select>
          </label>
          <label className="text-sm">Jen na termín (nepovinné)
            <select className={input} disabled={scope === "poukaz"} value={scope === "poukaz" ? "" : bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">Všechny termíny</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.title} · {fmtD(t.date)}</option>)}
            </select>
          </label>
          <label className="text-sm">Platí do (včetně)
            <input className={input} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </label>
          <label className="text-sm">Název dávky (pro vás)
            <input className={input} maxLength={80} placeholder="např. Firemní akce 26. 11." value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <div className="col-span-2 md:col-span-3 flex items-center gap-3">
            <button disabled={busy} className="h-9 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-60">{busy ? "Vytvářím…" : "Vytvořit kódy"}</button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        </form>

        <div className="flex items-center gap-3 flex-wrap text-sm">
          <label className="flex items-center gap-2">Dávka:
            <select className="h-8 border border-gray-300 rounded-md px-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Všechny</option>
              {labels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <span className="text-gray-500">{shown.length} kódů, volných {shown.filter((r) => r.status === "active").length}</span>
          {printable.length > 0 && (
            <a
              className="h-8 px-3 rounded-md border border-gray-300 inline-flex items-center"
              target="_blank"
              rel="noreferrer"
              href={filter ? "/api/admin/promo/pdf?label=" + encodeURIComponent(filter) : "/api/admin/promo/pdf?ids=" + printable.slice(0, 200).map((r) => r.id).join(",")}
            >
              Tisk kupónů (PDF, 4 na A4)
            </a>
          )}
        </div>

        {loading && <p className="text-sm text-gray-400">Načítám…</p>}
        {!loading && shown.length === 0 && <p className="text-sm text-gray-400">Zatím žádné kódy.</p>}
        <div className="space-y-1">
          {shown.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm border-t border-gray-100 pt-1.5">
              <span className="font-mono">{r.code}</span>
              <span className="text-gray-600 flex-1 min-w-0 truncate">
                {r.kind === "percent" ? r.value + " %" : "kurz za " + r.value + " Kč"} · {SCOPE_LABEL[r.scope]} · do {fmtD(r.expiresAt)}{r.bookingId ? " · jen na termín" : ""}{r.label ? " · " + r.label : ""}
              </span>
              <span className={r.status === "used" ? "text-gray-400" : r.status === "void" ? "text-gray-400 line-through" : "text-green-700"}>{STATUS_LABEL[r.status]}{r.usedAt ? " " + fmtD(r.usedAt) : ""}{r.usedEmail ? " (" + r.usedEmail + ")" : ""}</span>
              {(r.status === "active" || r.status === "reserved") && (
                <button onClick={() => voidOne(r.id)} className="text-xs underline text-gray-500">Zrušit</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
