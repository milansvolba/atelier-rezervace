"use client";

import { useEffect, useState } from "react";
import { VOUCHER_COURSES, computeOrder } from "@/lib/pricing";
import { VOUCHER_VALID_MONTHS } from "@/lib/voucherConfig";
import { resolveHeardAbout } from "@/lib/types";
import { HeardAboutField } from "@/components/HeardAboutField";

interface Term {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  spotsLeft: number | null;
}

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return d + ". " + m + ". " + y;
}

// Veřejný nákup dárkového poukazu na kurz. Cenu vždy znovu počítá server (POST /api/vouchers/checkout);
// tady se počítá jen pro zobrazení. Odkaz z webu: /poukazy nebo /poukazy?kurz=hlava|relief.
export default function PoukazyPage() {
  const [topic, setTopic] = useState<string>(VOUCHER_COURSES[0].key);
  const [people, setPeople] = useState(1);
  const [castings, setCastings] = useState(0); // počet odlitků (0 až počet osob)
  const [terms, setTerms] = useState<Term[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [heardAbout, setHeardAbout] = useState("");
  const [heardAboutOther, setHeardAboutOther] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | "ok" | "cancel">(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const k = q.get("kurz");
    if (k && VOUCHER_COURSES.some((c) => c.key === k)) setTopic(k);
    if (q.get("platba") === "ok") setResult("ok");
    if (q.get("platba") === "zrusena") setResult("cancel");
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTerms(Array.isArray(d) ? d : []))
      .catch(() => setTerms([]));
  }, []);

  const course = VOUCHER_COURSES.find((c) => c.key === topic) ?? VOUCHER_COURSES[0];
  const courseTerms = terms.filter((t) => t.title.toLowerCase().includes(course.match) && (t.spotsLeft === null || t.spotsLeft >= people));
  const price = computeOrder(course.pricePerPerson, people, Math.min(castings, people), course.castingPrice);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/vouchers/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          people,
          casting: Math.min(castings, people),
          bookingId: bookingId || undefined,
          buyerName,
          buyerEmail,
          recipientName,
          message,
          heardAbout: resolveHeardAbout(heardAbout, heardAboutOther),
          honeypot,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Platbu se nepodařilo zahájit, zkuste to prosím znovu.");
    } catch {
      setError("Platbu se nepodařilo zahájit, zkuste to prosím znovu.");
    }
    setBusy(false);
  }

  const input = "mt-1 w-full h-10 border border-gray-300 rounded-md px-2";

  if (result === "ok") {
    return (
      <main className="max-w-xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h1 className="text-xl font-semibold">Děkujeme, poukaz je zaplacený</h1>
          <p className="text-sm text-gray-700">Kód poukazu a návod, jak ho uplatnit, vám právě posíláme e-mailem. Pokud nic nedorazí do pár minut, mrkněte do nevyžádané pošty.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Dárkový poukaz na kurz</h1>
        <p className="text-sm text-gray-500">
          Poukaz platí {VOUCHER_VALID_MONTHS} měsíců od zaplacení. Obdarovaný si termín vybere sám na stránce kurzů, nebo mu ho vyberete rovnou vy.
        </p>
      </div>
      {result === "cancel" && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">Platba nebyla dokončena. Můžete to zkusit znovu.</p>
      )}
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Kurz</legend>
          {VOUCHER_COURSES.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm rounded-md border border-gray-200 p-3">
              <input type="radio" name="kurz" checked={topic === c.key} onChange={() => { setTopic(c.key); setBookingId(""); }} />
              <span>{c.title} — {c.pricePerPerson} Kč/os.</span>
            </label>
          ))}
        </fieldset>

        <div>
          <p className="text-sm font-medium mb-1">Pro kolik osob</p>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Méně osob" disabled={people <= 1} onClick={() => { setPeople(people - 1); setBookingId(""); }} className="h-10 w-10 rounded-md border border-gray-300 text-lg disabled:opacity-40">−</button>
            <span className="text-xl font-semibold w-8 text-center">{people}</span>
            <button type="button" aria-label="Více osob" disabled={people >= 6} onClick={() => { setPeople(people + 1); setBookingId(""); }} className="h-10 w-10 rounded-md border border-gray-300 text-lg disabled:opacity-40">+</button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Čím víc osob, tím větší skupinová sleva (od 2 osob).</p>
        </div>

        {people === 1 ? (
          <label className="flex items-start gap-2 text-sm rounded-md border border-gray-200 p-3">
            <input type="checkbox" className="mt-1" checked={castings > 0} onChange={(e) => setCastings(e.target.checked ? 1 : 0)} />
            <span>Přidat betonový odlitek (+{course.castingPrice} Kč)</span>
          </label>
        ) : (
          <div className="text-sm rounded-md border border-gray-200 p-3 space-y-2">
            <p>Betonové odlitky (+{course.castingPrice} Kč za kus). Kolik jich chcete?</p>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Méně odlitků" disabled={castings <= 0} onClick={() => setCastings(Math.max(0, castings - 1))} className="h-9 w-9 rounded-md border border-gray-300 text-lg disabled:opacity-40">−</button>
              <span className="text-lg font-semibold w-8 text-center">{Math.min(castings, people)}</span>
              <button type="button" aria-label="Více odlitků" disabled={castings >= people} onClick={() => setCastings(Math.min(people, castings + 1))} className="h-9 w-9 rounded-md border border-gray-300 text-lg disabled:opacity-40">+</button>
              <button type="button" onClick={() => setCastings(people)} className="text-xs underline">pro každého</button>
            </div>
          </div>
        )}

        <label className="block text-sm">
          Termín
          <select className={input} value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            <option value="">Zatím nevybírat — obdarovaný si vybere sám</option>
            {courseTerms.map((t) => (
              <option key={t.id} value={t.id}>{fmtDate(t.date)} · {t.startTime}–{t.endTime}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">Vaše jméno<input required className={input} autoComplete="name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} /></label>
          <label className="text-sm">Váš e-mail (pošleme na něj poukaz)<input required type="email" className={input} autoComplete="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} /></label>
          <label className="text-sm">Jméno obdarovaného (nepovinné)<input className={input} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></label>
        </div>
        <label className="block text-sm">
          Vzkaz na poukaz (nepovinné)
          <input className={input} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <HeardAboutField
          value={heardAbout}
          onChange={setHeardAbout}
          otherValue={heardAboutOther}
          onOtherChange={setHeardAboutOther}
        />

        <div className="border-t border-gray-100 pt-3 text-sm space-y-1">
          <div className="flex justify-between"><span>{people} × {course.pricePerPerson} Kč</span><span>{price.courseBefore} Kč</span></div>
          {price.discountPercent > 0 && (
            <div className="flex justify-between text-green-700"><span>Skupinová sleva {price.discountPercent} %</span><span>−{price.courseBefore - price.courseAfter} Kč</span></div>
          )}
          {price.castingTotal > 0 && (
            <div className="flex justify-between"><span>{Math.min(castings, people)} × betonový odlitek</span><span>{price.castingTotal} Kč</span></div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1"><span>Celkem</span><span>{price.total} Kč</span></div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="h-10 px-5 rounded-md bg-gray-900 text-white text-sm disabled:opacity-60">
          {busy ? "Přesměrovávám na platbu…" : "Zaplatit " + price.total + " Kč"}
        </button>
        <p className="text-xs text-gray-500">Platba proběhne na zabezpečené stránce Stripe. Poukaz vám přijde e-mailem hned po zaplacení.</p>
      </form>
    </main>
  );
}
