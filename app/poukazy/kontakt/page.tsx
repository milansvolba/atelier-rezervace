"use client";

import { useEffect, useState } from "react";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return d + ". " + m + ". " + y;
}

// Doplnění kontaktu na obdarovaného po koupi poukazu s pevným termínem (odkaz z e-mailu, ?t=token).
export default function KontaktObdarovanehoPage() {
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<null | { courseTitle: string; date: string | null; startTime: string | null; endTime: string | null }>(null);
  const [loadErr, setLoadErr] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    setToken(t);
    fetch("/api/vouchers/contact?t=" + encodeURIComponent(t))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setLoadErr(d.error || "Odkaz není platný.");
          return;
        }
        setInfo(d);
        setName(d.recipientName || "");
        setEmail(d.recipientEmail || "");
        setPhone(d.recipientPhone || "");
      })
      .catch(() => setLoadErr("Nepodařilo se načíst údaje, zkuste to prosím znovu."));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/vouchers/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, recipientName: name, recipientEmail: email, recipientPhone: phone }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setDone(true);
      else setError(d.error || "Uložení se nepodařilo, zkuste to prosím znovu.");
    } catch {
      setError("Uložení se nepodařilo, zkuste to prosím znovu.");
    }
    setBusy(false);
  }

  const input = "mt-1 w-full h-10 border border-gray-300 rounded-md px-2";

  return (
    <main className="max-w-xl mx-auto space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Kontakt na obdarovaného</h1>
        {loadErr ? (
          <p className="text-sm text-red-700">{loadErr} Pokud potřebujete pomoct, napište nám odpovědí na e-mail s poukazem.</p>
        ) : !info ? (
          <p className="text-sm text-gray-500">Načítám…</p>
        ) : done ? (
          <>
            <p className="text-sm text-gray-700">Děkujeme, kontakt je uložený. Když bude potřeba termín změnit nebo někoho zastihnout, ozveme se na tento kontakt.</p>
            <a href="https://ateliernapobrezi.cz" className="block text-center bg-black text-white rounded-md py-3 font-semibold hover:bg-gray-800">
              Zpátky na web
            </a>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-gray-700">
              {info.courseTitle}
              {info.date ? ", " + fmtDate(info.date) + (info.startTime ? ", " + info.startTime + "–" + info.endTime : "") : ""}
            </p>
            <p className="text-xs text-gray-600">
              Kontakt použijeme jen kdyby bylo potřeba termín změnit nebo někoho na kurzu zastihnout. Nic mu neposíláme dopředu, překvapení zůstane.
            </p>
            <label className="block text-sm">Jméno a příjmení obdarovaného<input className={input} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block text-sm">E-mail<input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm">Telefon<input type="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="h-10 px-5 rounded-md bg-gray-900 text-white text-sm disabled:opacity-60">
              {busy ? "Ukládám…" : "Uložit kontakt"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
