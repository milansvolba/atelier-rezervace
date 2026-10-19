"use client";

import { useEffect, useMemo, useState } from "react";
import { DAY_NAMES_MON_FIRST, MONTH_NAMES, iso, monthMatrix } from "@/lib/calendar";
import { DEFAULT_UI_TEXTS, fillText } from "@/lib/uiTexts";
import { groupDiscountPercent } from "@/lib/pricing";

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
  castingPrice: number | null;
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
  const [tiers, setTiers] = useState<{ minFillPercent: number; discountPercent: number }[]>([]);
  const [buyingTopic, setBuyingTopic] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");
  const [payResult, setPayResult] = useState<null | "ok" | "cancel">(null);
  const [step, setStep] = useState(2);
  const [signupPhone, setSignupPhone] = useState("");
  const [withCasting, setWithCasting] = useState(false);

  // Návrat ze Stripe Checkout (success_url / cancel_url vedou na /kurzy?platba=...).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("platba");
    if (p === "ok") setPayResult("ok");
    else if (p === "zrusena") setPayResult("cancel");
  }, []);

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

  useEffect(() => {
    fetch("/api/discount-tiers")
      .then((r) => r.json())
      .then((data) => setTiers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Vypocita procento skupinove slevy pro dany pocet lidi a kapacitu terminu.
  function discountFor(people: number, _capacity: number | null) {
    return groupDiscountPercent(people);
  }

  // Seskupi vypsane terminy podle nazvu kurzu (tema) pro vyber "Koupit".
  const topics = useMemo(() => {
    const map = new Map<string, { title: string; price: number | null; count: number }>();
    courses.forEach((c) => {
      if (!map.has(c.title)) map.set(c.title, { title: c.title, price: c.price, count: 0 });
      map.get(c.title)!.count++;
    });
    return Array.from(map.values());
  }, [courses]);

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupFor) return;
    setSignupSent(null);
    // Kurz s cenou se platí hned přes Stripe Checkout (cenu i slevu počítá server).
    const course = courses.find((c) => c.id === signupFor);
    if (course?.price) {
      setPayBusy(true);
      setPayError("");
      try {
        const r = await fetch("/api/signups/checkout", {
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
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        setPayError(data.error || "Platbu se nepodařilo zahájit, zkuste to prosím znovu.");
      } catch {
        setPayError("Platbu se nepodařilo zahájit, zkuste to prosím znovu.");
      }
      setPayBusy(false);
      return;
    }
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

  // Texty průvodce (výchozí znění z lib/uiTexts.ts; správa textů v adminu je později přepíše).
  const t = (key: string, vars?: Record<string, string>) => fillText(DEFAULT_UI_TEXTS[key]?.text ?? key, vars);

  function seatsWord(n: number) {
    return n === 1 ? "místo" : n <= 4 ? "místa" : "míst";
  }

  const selectedCourse = signupFor ? courses.find((c) => c.id === signupFor) ?? null : null;
  const maxSeats = selectedCourse ? Math.max(1, Math.min(6, selectedCourse.spotsLeft ?? 6)) : 6;

  function quoteFor(c: CourseCard, n: number) {
    if (!c.price) return null;
    const discount = discountFor(n, c.capacity);
    const total = c.price * n;
    const totalAfter = Math.round(total * (1 - discount / 100));
    const casting = withCasting && c.castingPrice ? c.castingPrice * n : 0;
    return { discount, total, totalAfter, casting, grand: totalAfter + casting };
  }
  const quote = selectedCourse ? quoteFor(selectedCourse, signupPeople) : null;

  // Nabídka "přidejte další místo", pokud by se tím zvýšila sleva.
  function nudgeFor(c: CourseCard, n: number, max: number) {
    if (!c.price) return null;
    const current = discountFor(n, c.capacity);
    for (let k = n + 1; k <= max; k++) {
      const dk = discountFor(k, c.capacity);
      if (dk > current) {
        const more = k - n;
        return { label: "ještě " + more + " " + seatsWord(more), percent: dk };
      }
    }
    return null;
  }
  const nudge = selectedCourse ? nudgeFor(selectedCourse, signupPeople, maxSeats) : null;

  // Odeslání objednávky z posledního kroku: kurz s cenou jde na Stripe, kurz bez ceny jako běžná přihláška.
  async function submitOrder() {
    if (!selectedCourse) return;
    setPayBusy(true);
    setPayError("");
    const note = (signupPhone ? "Tel: " + signupPhone + ". " : "") + signupNote;
    const payload = JSON.stringify({
      bookingId: selectedCourse.id,
      name: signupName,
      contact: signupContact,
      people: signupPeople,
      note,
      honeypot,
      casting: withCasting,
    });
    try {
      if (selectedCourse.price) {
        const r = await fetch("/api/signups/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        setPayError(data.error || t("kurzy.err.pay"));
      } else {
        const r = await fetch("/api/signups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (r.ok) {
          setSignupSent("ok");
          setSignupName("");
          setSignupContact("");
          setSignupPhone("");
          setSignupNote("");
          setSignupPeople(1);
          setSignupFor(null);
          setStep(2);
        } else {
          setPayError(t("kurzy.err.signup"));
        }
      }
    } catch {
      setPayError(t("kurzy.err.pay"));
    }
    setPayBusy(false);
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
      {payResult === "ok" && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-4">
          {t("kurzy.pay.ok")}
        </p>
      )}
      {payResult === "cancel" && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {t("kurzy.pay.cancel")}
        </p>
      )}
      <div>
        <h1 className="text-xl font-semibold mb-1">Kurzy</h1>
        <p className="text-sm text-gray-500">
          Vypsané termíny sochařských kurzů. Přihlaste se na některý z nich, nebo si napište o vlastní termín pro skupinu.
        </p>
      </div>

      {topics.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-medium mb-3">Vyberte kurz</p>
          <div className="space-y-2">
            {topics.map((t) => (
              <div key={t.title} className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2 first:border-t-0 first:pt-0 flex-wrap">
                <div>
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.price ? <p className="text-xs text-gray-500">{t.price} Kč/os.</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setBuyingTopic(buyingTopic === t.title ? null : t.title)}
                  className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs shrink-0"
                >
                  {buyingTopic === t.title ? "Zavřít" : "Koupit"}
                </button>
              </div>
            ))}
          </div>
          {buyingTopic && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm font-medium mb-2">{buyingTopic} — pro koho?</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setTopicFilter(buyingTopic);
                    requestAnimationFrame(() => {
                      document.getElementById("course-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className="h-9 px-4 rounded-md border border-gray-300 text-sm"
                >
                  Pro jednotlivce — vybrat vypsaný termín
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomNote((n) => (n ? n : `Téma: ${buyingTopic}`));
                    setShowCustomForm(true);
                    requestAnimationFrame(() => {
                      document.getElementById("custom-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className="h-9 px-4 rounded-md border border-gray-300 text-sm"
                >
                  Pro skupinu — domluvit termín
                </button>
              </div>
            </div>
          )}
          {topicFilter && (
            <button
              type="button"
              onClick={() => setTopicFilter(null)}
              className="mt-3 text-xs text-gray-500 underline"
            >
              Zobrazit všechny termíny
            </button>
          )}
        </div>
      )}

      <div className="space-y-3" id="course-list">
        {loading && <p className="text-sm text-gray-400">Načítám termíny…</p>}
        {!loading && courses.length === 0 && (
          <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-5">
            Momentálně nemáme vypsaný žádný termín. Napište nám níže o poptávku na vlastní termín.
          </p>
        )}
        {signupSent === "ok" && !selectedCourse && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-4">{t("kurzy.signup.ok")}</p>
        )}
        {selectedCourse ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
              <p className="font-medium">{selectedCourse.title}</p>
              <p className="text-gray-500">
                {fmtDate(selectedCourse.date)} · {selectedCourse.startTime}–{selectedCourse.endTime}
              </p>
              {quote && (
                <p className="mt-1">
                  {signupPeople} {seatsWord(signupPeople)} ·{" "}
                  {quote.discount > 0 && <span>{t("kurzy.summary.discount", { percent: String(quote.discount) })} · </span>}
                  <strong>{quote.grand} Kč</strong>
                  {quote.discount > 0 && <span className="text-gray-400 line-through ml-2">{quote.total + quote.casting} Kč</span>}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400">{t("kurzy.step.label", { step: String(step) })}</p>
              <h2 className="text-lg font-semibold">
                {step === 2 ? t("kurzy.step2.title") : step === 3 ? t("kurzy.step3.title") : t("kurzy.step4.title")}
              </h2>
            </div>

            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Méně míst"
                    disabled={signupPeople <= 1}
                    onClick={() => setSignupPeople(Math.max(1, signupPeople - 1))}
                    className="h-10 w-10 rounded-md border border-gray-300 text-lg disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="text-xl font-semibold w-8 text-center">{signupPeople}</span>
                  <button
                    type="button"
                    aria-label="Více míst"
                    disabled={signupPeople >= maxSeats}
                    onClick={() => setSignupPeople(Math.min(maxSeats, signupPeople + 1))}
                    className="h-10 w-10 rounded-md border border-gray-300 text-lg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                {nudge && (
                  <p className="text-sm text-green-700">
                    {t("kurzy.step2.nudge", { more: nudge.label, percent: String(nudge.percent) })}
                  </p>
                )}
                {selectedCourse.castingPrice ? (
                  <label className="flex items-start gap-2 text-sm rounded-md border border-gray-200 p-3">
                    <input type="checkbox" className="mt-1" checked={withCasting} onChange={(e) => setWithCasting(e.target.checked)} />
                    <span>
                      Přidat odlitek do betonu pro každého účastníka (+{selectedCourse.castingPrice} Kč/os.)
                      <br />
                      <span className="text-xs text-gray-500">Vaše dílo vám odléváme do speciálního betonu. Termín předání domluvíme na kurzu.</span>
                    </span>
                  </label>
                ) : null}
                {selectedCourse.spotsLeft !== null && (
                  <p className="text-xs text-gray-500">{t("kurzy.step2.hint", { spots: String(selectedCourse.spotsLeft) })}</p>
                )}
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => setSignupFor(null)}
                    className="h-10 px-4 rounded-md border border-gray-300 text-sm"
                  >
                    {t("kurzy.nav.change")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm"
                  >
                    {t("kurzy.nav.next")}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(4);
                }}
                className="space-y-3"
              >
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
                    {t("kurzy.field.name")}
                    <input
                      required
                      autoComplete="name"
                      className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {t("kurzy.field.email")}
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                      value={signupContact}
                      onChange={(e) => setSignupContact(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {t("kurzy.field.phone")}
                    <input
                      type="tel"
                      autoComplete="tel"
                      className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  {t("kurzy.field.note")}
                  <input
                    className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
                    value={signupNote}
                    onChange={(e) => setSignupNote(e.target.value)}
                  />
                </label>
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="h-10 px-4 rounded-md border border-gray-300 text-sm"
                  >
                    {t("kurzy.nav.back")}
                  </button>
                  <button className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">{t("kurzy.nav.next")}</button>
                </div>
              </form>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Jméno</dt>
                    <dd>{signupName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">E-mail</dt>
                    <dd>{signupContact}</dd>
                  </div>
                  {signupPhone && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Telefon</dt>
                      <dd>{signupPhone}</dd>
                    </div>
                  )}
                  {signupNote && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Poznámka</dt>
                      <dd>{signupNote}</dd>
                    </div>
                  )}
                </dl>
                {quote && selectedCourse.price && (
                  <div className="border-t border-gray-100 pt-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>
                        {signupPeople} × {selectedCourse.price} Kč
                      </span>
                      <span>{quote.total} Kč</span>
                    </div>
                    {quote.discount > 0 && (
                      <div className="flex justify-between text-green-700">
                        <span>{t("kurzy.summary.discount", { percent: String(quote.discount) })}</span>
                        <span>−{quote.total - quote.totalAfter} Kč</span>
                      </div>
                    )}
                    {quote.casting > 0 && (
                      <div className="flex justify-between">
                        <span>{signupPeople} × betonový odlitek</span>
                        <span>{quote.casting} Kč</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-base pt-1">
                      <span>Celkem</span>
                      <span>{quote.grand} Kč</span>
                    </div>
                  </div>
                )}
                {payError && <p className="text-sm text-red-700">{payError}</p>}
                <div className="flex gap-2 flex-wrap items-center">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="h-10 px-4 rounded-md border border-gray-300 text-sm"
                  >
                    {t("kurzy.nav.back")}
                  </button>
                  <button
                    type="button"
                    onClick={submitOrder}
                    disabled={payBusy}
                    className="h-10 px-5 rounded-md bg-gray-900 text-white text-sm disabled:opacity-60"
                  >
                    {payBusy ? t("kurzy.pay.busy") : quote ? t("kurzy.pay.button", { total: String(quote.grand) }) : "Odeslat přihlášku"}
                  </button>
                </div>
                {quote && <p className="text-xs text-gray-500">{t("kurzy.pay.hint")}</p>}
              </div>
            )}
          </div>
        ) : (
          courses
            .filter((c) => !topicFilter || c.title === topicFilter)
            .map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-gray-500">
                      {fmtDate(c.date)} · {c.startTime}–{c.endTime}
                      {c.price ? " · " + c.price + " Kč/os." : ""}
                    </p>
                    {c.note && <p className="text-sm text-gray-500 mt-1">{c.note}</p>}
                    {c.capacity && (
                      <p className="text-xs text-gray-400 mt-1">
                        {c.spotsLeft !== null && c.spotsLeft > 0
                          ? "Volných míst: " + c.spotsLeft + " z " + c.capacity
                          : "Kapacita naplněna — napište nám, dáme vědět při uvolnění."}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Jednoduchý signál záměru pro Analytics MVP (bez celého konverzního
                      // trychtýře) — klik na konkrétní vypsaný termín kurzu.
                      if (typeof window !== "undefined" && window.gtag) {
                        window.gtag("event", "vyber_terminu_kurzu", {
                          event_category: "rezervace",
                          kurz: c.title,
                          datum: c.date,
                        });
                      }
                      setSignupFor(c.id);
                      setStep(2);
                      setSignupPeople(1);
                      setWithCasting(false);
                      setSignupSent(null);
                      setPayError("");
                      requestAnimationFrame(() => {
                        document.getElementById("course-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    disabled={c.spotsLeft === 0}
                    className="h-9 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-40 shrink-0"
                  >
                    {t("kurzy.pick")}
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5" id="custom-form">
        <p className="font-medium mb-1">Kurz na míru pro skupinu</p>
        <p className="text-sm text-gray-500 mb-4">
          Nevyhovuje vám žádný vypsaný termín? Klikněte na den, který by se vám hodil, a pošlete nám poptávku —
          potvrdíme ho, nebo nabídneme nejbližší volný termín.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Skupiny navíc mají výhodnější cenu za osobu — čím víc vás bude, tím větší sleva. {/* TODO copy: doladit finální formulaci a umístění (Milan) */}
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
