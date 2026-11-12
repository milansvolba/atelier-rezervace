"use client";

import { useEffect, useMemo, useState } from "react";
import { DAY_NAMES_MON_FIRST, MONTH_NAMES, iso, monthMatrix } from "@/lib/calendar";
import { DEFAULT_UI_TEXTS, fillText } from "@/lib/uiTexts";
import { groupDiscountPercent } from "@/lib/pricing";
import { resolveHeardAbout } from "@/lib/types";
import { HeardAboutField } from "@/components/HeardAboutField";
import { spotsPhrase } from "@/lib/invoiceFormat";
import BillingFields from "@/components/BillingFields";
import { BillingInput, emptyBilling } from "@/lib/billingInput";
import { kc, num } from "@/lib/money";

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
  courseType?: string;
}

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

// Délka kurzu z času začátku a konce, např. "10 hodin".
function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (!Number.isFinite(mins) || mins <= 0) return "";
  const h = Math.round((mins / 60) * 2) / 2;
  const txt = String(h).replace(".", ",");
  const word = h === 1 ? "hodina" : h > 1 && h < 5 ? "hodiny" : "hodin";
  return `${txt}\u00a0${word}`;
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
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");
  const [payResult, setPayResult] = useState<null | "ok" | "cancel">(null);
  const [step, setStep] = useState(2);
  // Stará chybová hláška (např. z neúspěšného pokusu o platbu) se po změně kroku nebo údajů nesmí ukazovat dál.
  const [signupPhone, setSignupPhone] = useState("");
  const [billing, setBilling] = useState<BillingInput>(emptyBilling);
  useEffect(() => {
    setPayError("");
  }, [step, billing, signupPeople]);
  // Sdílené pro krokový formulář přihlášky/platby i pro poptávku na míru níže (nikdy se nepoužívají zároveň).
  const [heardAbout, setHeardAbout] = useState("");
  const [heardAboutOther, setHeardAboutOther] = useState("");
  const [castings, setCastings] = useState(0); // počet odlitků (0 až počet míst)
  // Uplatnění dárkového poukazu (kód se ověří na serveru, poukaz určuje počet osob a odlitek).
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<null | { code: string; people: number; castingCount: number }>(null);
  const [voucherErr, setVoucherErr] = useState("");
  const [voucherDone, setVoucherDone] = useState(false);
  const [voucherFromLink, setVoucherFromLink] = useState(false);
  // Režim poukazu (přišli jsme z e-mailu a kód je ověřený): jen termíny kurzu z poukazu, bez nákupu.
  const [voucherLinkErr, setVoucherLinkErr] = useState("");
  const [voucherMode, setVoucherMode] = useState<null | { type: string; courseTitle: string }>(null);

  // Odkaz z e-mailu s poukazem (/kurzy?poukaz=ATL-XXXX-XXXX): kód se předvyplní a pole poukazu se otevře.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("poukaz");
    if (code && /^[A-Za-z0-9 -]{6,20}$/.test(code)) {
      setVoucherCode(code.toUpperCase());
      setVoucherOpen(true);
      setVoucherFromLink(true);
      fetch("/api/vouchers/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
        .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
        .then(({ ok, data }) => {
          if (ok && data.people) {
            setVoucherInfo({ code: String(data.code || code).toUpperCase(), people: data.people, castingCount: Number(data.castingCount) || 0 });
            setVoucherMode({ type: String(data.type || ""), courseTitle: String(data.courseTitle || "") });
          } else {
            setVoucherFromLink(false);
            setVoucherLinkErr(data.error || t("kurzy.voucher.err"));
          }
        })
        .catch(() => {
          setVoucherFromLink(false);
          setVoucherLinkErr(t("kurzy.voucher.err"));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Návrat ze Stripe Checkout (success_url / cancel_url vedou na /kurzy?platba=...).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("platba");
    if (p === "ok") setPayResult("ok");
    else if (p === "zrusena") setPayResult("cancel");
  }, []);

  const [terminGone, setTerminGone] = useState(false);
  const [terminHandled, setTerminHandled] = useState(false);
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
        heardAbout: resolveHeardAbout(heardAbout, heardAboutOther),
      }),
    });
    if (res.ok) {
      setCustomSent("ok");
      setShowCustomForm(false);
      setCustomName("");
      setCustomContact("");
      setCustomPeople("");
      setCustomNote("");
      setHeardAbout("");
      setHeardAboutOther("");
    } else {
      setCustomSent("err");
    }
  }

  // Texty průvodce (výchozí znění z lib/uiTexts.ts; správa textů v adminu je později přepíše).
  const t = (key: string, vars?: Record<string, string>) => fillText(DEFAULT_UI_TEXTS[key]?.text ?? key, vars);

  function seatsWord(n: number) {
    return n === 1 ? "místo" : n <= 4 ? "místa" : "míst";
  }

  // Výběr termínu (kliknutí na kartu i odkaz z marketingového webu /kurzy?termin=ID).
  function pickCourse(c: CourseCard) {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "vyber_terminu_kurzu", {
        event_category: "rezervace",
        kurz: c.title,
        datum: c.date,
      });
    }
    setSignupFor(c.id);
    if (!voucherMode) resetVoucher();
    setVoucherDone(false);
    // V režimu poukazu krok 2 (počet míst, odlitek, kód) odpadá: vše je dané poukazem.
    setStep(voucherMode ? 3 : 2);
    setSignupPeople(voucherMode ? voucherInfo?.people ?? 1 : 1);
    setCastings(voucherMode ? voucherInfo?.castingCount ?? 0 : 0);
    setSignupSent(null);
    setPayError("");
    requestAnimationFrame(() => {
      document.getElementById("course-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Odkaz z marketingového webu: /kurzy?termin=ID rovnou otevře přihlášku na ten termín.
  useEffect(() => {
    if (loading || terminHandled) return;
    const id = new URLSearchParams(window.location.search).get("termin");
    if (!id) {
      setTerminHandled(true);
      return;
    }
    const c = courses.find((x) => x.id === id);
    if (c && c.spotsLeft !== 0 && !voucherFromLink) pickCourse(c);
    else if (!voucherFromLink) setTerminGone(true);
    setTerminHandled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, courses, terminHandled]);

  const selectedCourse = signupFor ? courses.find((c) => c.id === signupFor) ?? null : null;
  const maxSeats = selectedCourse ? Math.max(1, Math.min(6, selectedCourse.spotsLeft ?? 6)) : 6;

  function quoteFor(c: CourseCard, n: number) {
    if (!c.price) return null;
    const discount = discountFor(n, c.capacity);
    const total = c.price * n;
    const totalAfter = Math.round(total * (1 - discount / 100));
    const casting = c.castingPrice ? c.castingPrice * Math.min(castings, n) : 0;
    return { discount, total, totalAfter, casting, grand: totalAfter + casting };
  }
  const quote = selectedCourse && !voucherInfo ? quoteFor(selectedCourse, signupPeople) : null;

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

  function resetVoucher() {
    setVoucherOpen(false);
    setVoucherCode("");
    setVoucherInfo(null);
    setVoucherErr("");
  }

  async function checkVoucher() {
    if (!selectedCourse) return;
    setPayBusy(true);
    setVoucherErr("");
    try {
      const r = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucherCode, bookingId: selectedCourse.id, dryRun: true }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.people) {
        setVoucherInfo({ code: voucherCode, people: data.people, castingCount: Number(data.castingCount) || 0 });
        setSignupPeople(data.people);
        setCastings(Number(data.castingCount) || 0);
      } else {
        setVoucherErr(data.error || t("kurzy.voucher.err"));
      }
    } catch {
      setVoucherErr(t("kurzy.voucher.err"));
    }
    setPayBusy(false);
  }

  async function redeemVoucher() {
    if (!selectedCourse || !voucherInfo) return;
    setPayBusy(true);
    setPayError("");
    try {
      const r = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucherInfo.code,
          bookingId: selectedCourse.id,
          name: signupName,
          contact: signupContact,
          phone: signupPhone,
          note: signupNote,
          honeypot,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        // Poděkování na samostatné stránce (kalendář, kontakty); zbytek níže zůstává jako záloha.
        window.location.href = "/dekujeme?termin=" + encodeURIComponent(selectedCourse.id);
        setVoucherDone(true);
        setSignupFor(null);
        setVoucherMode(null);
        setVoucherFromLink(false);
        resetVoucher();
        setStep(2);
        setSignupPeople(1);
        setCastings(0);
        setPayBusy(false);
        return;
      }
      setPayError(data.error || t("kurzy.voucher.err"));
    } catch {
      setPayError(t("kurzy.voucher.err"));
    }
    setPayBusy(false);
  }

  // Odeslání objednávky z posledního kroku: kurz s cenou jde na Stripe, kurz bez ceny jako běžná přihláška.
  async function submitOrder() {
    if (!selectedCourse) return;
    setPayBusy(true);
    setPayError("");
    const payload = JSON.stringify({
      bookingId: selectedCourse.id,
      name: signupName,
      contact: signupContact,
      people: signupPeople,
      phone: signupPhone,
      note: signupNote,
      honeypot,
      casting: Math.min(castings, signupPeople),
      heardAbout: resolveHeardAbout(heardAbout, heardAboutOther),
      billing: selectedCourse.price ? billing : undefined,
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
          setHeardAbout("");
          setHeardAboutOther("");
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
      {voucherFromLink && !voucherDone && (
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
          <p>{voucherMode ? t("kurzy.voucher.fromLinkReady", { code: voucherInfo?.code ?? "", people: String(voucherInfo?.people ?? 1), seats: seatsWord(voucherInfo?.people ?? 1), course: voucherMode.courseTitle }) : t("kurzy.voucher.fromLink")}</p>
          {voucherMode && (
            <button
              type="button"
              className="text-xs underline text-green-900"
              onClick={() => {
                setVoucherMode(null);
                setVoucherFromLink(false);
                setSignupFor(null);
                resetVoucher();
              }}
            >
              {t("kurzy.voucher.leaveMode")}
            </button>
          )}
        </div>
      )}
      {voucherLinkErr && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-4">
          {voucherLinkErr}{voucherLinkErr.includes("rezervace@") ? "" : " Napište nám prosím na rezervace@ateliernapobrezi.cz, rádi pomůžeme."}
        </p>
      )}
      <div>
        <h1 className="text-xl font-semibold mb-1">Kurzy</h1>
        <p className="text-sm text-gray-500">
          {voucherMode
            ? t("kurzy.voucher.intro")
            : "Vypsané termíny sochařských kurzů. Přihlaste se na některý z nich, nebo si napište o vlastní termín pro skupinu."}
        </p>
      </div>

      {topics.length > 1 && !voucherMode && !selectedCourse && (
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtr podle kurzu">
          <button
            type="button"
            onClick={() => setTopicFilter(null)}
            aria-pressed={!topicFilter}
            className={"h-9 px-4 rounded-full border text-sm " + (!topicFilter ? "bg-gray-900 text-white border-gray-900" : "border-gray-300")}
          >
            Všechny kurzy
          </button>
          {topics.map((tp) => (
            <button
              key={tp.title}
              type="button"
              onClick={() => setTopicFilter(tp.title)}
              aria-pressed={topicFilter === tp.title}
              className={"h-9 px-4 rounded-full border text-sm " + (topicFilter === tp.title ? "bg-gray-900 text-white border-gray-900" : "border-gray-300")}
            >
              {tp.title}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3" id="course-list">
        {loading && (
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <p className="text-sm text-gray-500">{t("kurzy.loading")}</p>
            {[0, 1].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="h-5 w-1/2 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {terminGone && !selectedCourse && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">{t("kurzy.termin.gone")}</p>
        )}
        {!loading && courses.length === 0 && (
          <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-5">
            Momentálně nemáme vypsaný žádný termín. Napište nám níže o poptávku na vlastní termín.
          </p>
        )}
        {signupSent === "ok" && !selectedCourse && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-4">{t("kurzy.signup.ok")}</p>
        )}
        {voucherDone && !selectedCourse && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-4">{t("kurzy.voucher.ok")}</p>
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
                  <strong>{kc(quote.grand)}</strong>
                  {quote.discount > 0 && <span className="text-gray-400 line-through ml-2">{kc(quote.total + quote.casting)}</span>}
                </p>
              )}
            </div>

            <div>
              {!voucherMode && <p className="text-xs text-gray-400">{t("kurzy.step.label", { step: String(step) })}</p>}
              <h2 className="text-lg font-semibold">
                {step === 2 ? t(voucherInfo ? "kurzy.step2.titleVoucher" : "kurzy.step2.title") : step === 3 ? t("kurzy.step3.title") : t("kurzy.step4.title")}
              </h2>
            </div>

            {step === 2 && (
              <div className="space-y-3">
                {voucherInfo && (
                  <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3">
                    {t("kurzy.voucher.applied", { code: voucherInfo.code.toUpperCase(), people: String(voucherInfo.people), seats: seatsWord(voucherInfo.people) })}
                    {voucherInfo.castingCount > 0 ? " " + t("kurzy.voucher.casting", { count: String(voucherInfo.castingCount) }) : ""}
                  </p>
                )}
                {!voucherInfo && <div className="flex items-center gap-3">
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
                </div>}
                {nudge && !voucherInfo && (
                  <p className="text-sm text-green-700">
                    {t("kurzy.step2.nudge", { more: nudge.label, percent: String(nudge.percent) })}
                  </p>
                )}
                {selectedCourse.castingPrice && !voucherInfo ? (
                  signupPeople === 1 ? (
                    <label className="flex items-start gap-2 text-sm rounded-md border border-gray-200 p-3">
                      <input type="checkbox" className="mt-1" checked={castings > 0} onChange={(e) => setCastings(e.target.checked ? 1 : 0)} />
                      <span>
                        Přidat odlitek do betonu (+{kc(selectedCourse.castingPrice)})
                        <br />
                        <span className="text-xs text-gray-500">Vaše dílo vám odléváme do speciálního betonu. Termín předání domluvíme na kurzu.</span>
                      </span>
                    </label>
                  ) : (
                    <div className="text-sm rounded-md border border-gray-200 p-3 space-y-2">
                      <p>Odlitky do betonu (+{selectedCourse.castingPrice} Kč za kus). Kolik jich chcete?</p>
                      <div className="flex items-center gap-3">
                        <button type="button" aria-label="Méně odlitků" disabled={castings <= 0} onClick={() => setCastings(Math.max(0, castings - 1))} className="h-9 w-9 rounded-md border border-gray-300 text-lg disabled:opacity-40">−</button>
                        <span className="text-lg font-semibold w-8 text-center">{Math.min(castings, signupPeople)}</span>
                        <button type="button" aria-label="Více odlitků" disabled={castings >= signupPeople} onClick={() => setCastings(Math.min(signupPeople, castings + 1))} className="h-9 w-9 rounded-md border border-gray-300 text-lg disabled:opacity-40">+</button>
                        <button type="button" onClick={() => setCastings(signupPeople)} className="text-xs underline">pro každého</button>
                      </div>
                      <p className="text-xs text-gray-500">Vaše dílo vám odléváme do speciálního betonu. Termín předání domluvíme na kurzu.</p>
                    </div>
                  )
                ) : null}
                {!voucherInfo && (
                  <div className="rounded-md border border-gray-200 p-3 space-y-2">
                    {!voucherOpen ? (
                      <button type="button" onClick={() => setVoucherOpen(true)} className="text-sm underline">
                        {t("kurzy.voucher.have")}
                      </button>
                    ) : (
                      <>
                        <label className="block text-sm">
                          {t("kurzy.voucher.label")}
                          <input
                            className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2 uppercase"
                            placeholder="ATL-XXXX-XXXX"
                            value={voucherCode}
                            onChange={(e) => setVoucherCode(e.target.value)}
                          />
                        </label>
                        {voucherErr && <p className="text-sm text-red-700">{voucherErr}</p>}
                        <button
                          type="button"
                          disabled={payBusy || !voucherCode.trim()}
                          onClick={checkVoucher}
                          className="h-9 px-4 rounded-md border border-gray-300 text-sm disabled:opacity-50"
                        >
                          {t("kurzy.voucher.use")}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {!voucherInfo && signupPeople >= 6 && (selectedCourse.spotsLeft === null || selectedCourse.spotsLeft > 6) && (
                  <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="min-w-0 flex-1">{t("kurzy.step2.maxSeats", { max: "6" })}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomNote((n) => (n ? n : `Téma: ${selectedCourse.title}`));
                        setShowCustomForm(true);
                        requestAnimationFrame(() => {
                          document.getElementById("custom-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }}
                      className="h-9 px-4 rounded-md border border-amber-300 bg-white text-gray-900 text-sm shrink-0"
                    >
                      {t("kurzy.step2.maxSeatsButton")}
                    </button>
                  </div>
                )}
                {selectedCourse.spotsLeft !== null && !voucherInfo && (
                  <p className="text-xs text-gray-500">{t("kurzy.step2.hint", { spots: String(selectedCourse.spotsLeft), ...spotsPhrase(selectedCourse.spotsLeft) })}</p>
                )}
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupFor(null);
                      if (!voucherMode) resetVoucher();
                    }}
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
                  if (voucherInfo) redeemVoucher();
                  else setStep(4);
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
                      required={!!voucherInfo}
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
                {quote && <BillingFields value={billing} onChange={setBilling} />}
                <HeardAboutField
                  value={heardAbout}
                  onChange={setHeardAbout}
                  otherValue={heardAboutOther}
                  onOtherChange={setHeardAboutOther}
                />
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => (voucherMode ? setSignupFor(null) : setStep(2))}
                    className="h-10 px-4 rounded-md border border-gray-300 text-sm"
                  >
                    {voucherMode ? t("kurzy.nav.change") : t("kurzy.nav.back")}
                  </button>
                  <button disabled={payBusy} className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm disabled:opacity-60">
                    {voucherInfo ? (payBusy ? t("kurzy.voucher.busy") : t("kurzy.voucher.button")) : t("kurzy.nav.next")}
                  </button>
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
                  {quote && billing.isCompany && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Doklad na firmu</dt>
                      <dd className="text-right">
                        {billing.company}, IČO {billing.ico}
                        {billing.dic ? ", DIČ " + billing.dic : ""}
                        <br />
                        {billing.street}, {billing.zip} {billing.city}
                      </dd>
                    </div>
                  )}
                </dl>
                {quote && selectedCourse.price && (
                  <div className="border-t border-gray-100 pt-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>
                        {signupPeople} × {selectedCourse.price} Kč
                      </span>
                      <span>{kc(quote.total)}</span>
                    </div>
                    {quote.discount > 0 && (
                      <div className="flex justify-between text-green-700">
                        <span>{t("kurzy.summary.discount", { percent: String(quote.discount) })}</span>
                        <span>−{kc(quote.total - quote.totalAfter)}</span>
                      </div>
                    )}
                    {quote.casting > 0 && (
                      <div className="flex justify-between">
                        <span>{Math.min(castings, signupPeople)} × betonový odlitek</span>
                        <span>{kc(quote.casting)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-base pt-1">
                      <span>Celkem</span>
                      <span>{kc(quote.grand)}</span>
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
                    onClick={voucherInfo ? redeemVoucher : submitOrder}
                    disabled={payBusy}
                    className="h-10 px-5 rounded-md bg-gray-900 text-white text-sm disabled:opacity-60"
                  >
                    {voucherInfo ? (payBusy ? t("kurzy.voucher.busy") : t("kurzy.voucher.button")) : payBusy ? t(selectedCourse.price ? "kurzy.pay.busy" : "kurzy.signup.busy") : quote ? t("kurzy.pay.button", { total: num(quote.grand) }) : "Odeslat přihlášku"}
                  </button>
                </div>
                {quote && <p className="text-xs text-gray-500">{t("kurzy.pay.hint")}</p>}
                {quote && (
                  <p className="text-xs text-gray-500">
                    {t("kurzy.terms.lead")}{" "}
                    <a href="https://ateliernapobrezi.cz/obchodni-podminky" target="_blank" rel="noopener noreferrer" className="underline">{t("kurzy.terms.link")}</a>.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          courses
            .filter((c) => !topicFilter || c.title === topicFilter)
            .filter((c) => !voucherMode || (c.courseType === voucherMode.type && (c.spotsLeft === null || c.spotsLeft >= (voucherInfo?.people ?? 1))))
            .map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-gray-500">
                      {fmtDate(c.date)} · {c.startTime}–{c.endTime}
                      {c.price && !voucherMode ? " · " + kc(c.price) + "/os." : ""}
                    </p>
                    {c.note && <p className="text-sm text-gray-500 mt-1">{c.note}</p>}
                    <dl className="mt-3 space-y-1 text-sm text-gray-600">
                      {durationLabel(c.startTime, c.endTime) && (
                        <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Délka</dt><dd>{durationLabel(c.startTime, c.endTime)}</dd></div>
                      )}
                      <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Kde</dt><dd>{t("kurzy.fact.place")}</dd></div>
                      <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">V ceně</dt><dd>{t("kurzy.fact.included")}</dd></div>
                      {voucherMode ? (
                        <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Změna termínu</dt><dd>{t("kurzy.fact.cancelVoucher")}</dd></div>
                      ) : (
                        <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Zrušení</dt><dd>{t("kurzy.fact.cancel")}</dd></div>
                      )}
                    </dl>
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
                    onClick={() => pickCourse(c)}
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

      {!voucherMode && !selectedCourse && !loading && (
        <p className="text-sm text-gray-600">
          Jste skupina, nebo vám žádný termín nevyhovuje?{" "}
          <button
            type="button"
            className="underline"
            onClick={() => document.getElementById("custom-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Pošlete nám poptávku na vlastní termín
          </button>
          .
        </p>
      )}

      {!voucherMode && (
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
            <HeardAboutField
              value={heardAbout}
              onChange={setHeardAbout}
              otherValue={heardAboutOther}
              onOtherChange={setHeardAboutOther}
            />
            <button className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm">Odeslat poptávku</button>
          </form>
        )}
        {customSent === "ok" && <p className="text-sm text-green-700 mt-3">Poptávka odeslána, ozveme se s potvrzením nebo návrhem termínu.</p>}
        {customSent === "err" && <p className="text-sm text-red-700 mt-3">Něco se nepovedlo, zkuste to prosím znovu.</p>}
      </div>
      )}
    </main>
  );
}
