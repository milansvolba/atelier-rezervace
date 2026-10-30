"use client";

import { useEffect, useState } from "react";

interface Course {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

const PHONE_DISPLAY = "+420 724 241 721";
const PHONE_TEL = "+420724241721";
const WHATSAPP_URL = "https://wa.me/420724241721";
const EMAIL = "rezervace@ateliernapobrezi.cz";
const ADDRESS = "Ateliér na pobřeží, Na pobřeží 67, Kolín";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return d + ". " + m + ". " + y;
}

// 20261113T090000 (čas zadaný v pražském pásmu; kalendář si ho převede podle ctz/TZID).
function icsStamp(date: string, time: string) {
  return date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
}

function googleCalendarUrl(c: Course) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: c.title + " – Ateliér na pobřeží",
    dates: icsStamp(c.date, c.startTime) + "/" + icsStamp(c.date, c.endTime),
    ctz: "Europe/Prague",
    location: ADDRESS,
    details: "Pohodlné oblečení, které může být od hlíny. Materiál a pomůcky zajišťujeme.",
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

// Soubor .ics pro Apple Kalendář, Outlook a další (stáhne se z dat v prohlížeči, nic se neposílá na server).
function icsDataUrl(c: Course) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atelier na pobrezi//rezervace//CS",
    "BEGIN:VEVENT",
    "UID:" + c.id + "@rezervace.ateliernapobrezi.cz",
    "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
    "DTSTART;TZID=Europe/Prague:" + icsStamp(c.date, c.startTime),
    "DTEND;TZID=Europe/Prague:" + icsStamp(c.date, c.endTime),
    "SUMMARY:" + esc(c.title + " – Ateliér na pobřeží"),
    "LOCATION:" + esc(ADDRESS),
    "DESCRIPTION:" + esc("Pohodlné oblečení, které může být od hlíny. Materiál a pomůcky zajišťujeme."),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
}

// Poděkování po úspěšné přihlášce (poukaz i platba kartou). Texty jsou návrh k doladění; stránku lze později přesunout na hlavní web.
export default function DekujemePage() {
  const [course, setCourse] = useState<Course | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("termin") ?? "";
    fetch("/api/courses")
      .then((r) => r.json())
      .then((list: Course[]) => setCourse(Array.isArray(list) ? list.find((c) => c.id === id) ?? null : null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const btn = "inline-flex items-center justify-center h-10 px-4 rounded-md text-sm";

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Děkujeme, těšíme se na vás!</h1>
        <p className="text-gray-700">Vaše místo je potvrzené. Všechny instrukce a potvrzení vám pošleme e-mailem.</p>
        {course && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
            <p className="font-medium">{course.title}</p>
            <p className="text-gray-600">
              {fmtDate(course.date)} · {course.startTime}–{course.endTime}
            </p>
            <p className="text-gray-600">{ADDRESS}</p>
          </div>
        )}
        {loaded && !course && <p className="text-sm text-gray-500">Podrobnosti termínu najdete v potvrzovacím e-mailu.</p>}
        {course && (
          <div className="pt-1">
            <p className="text-sm font-medium mb-2">Přidat událost do kalendáře</p>
            <div className="flex gap-2 flex-wrap">
              <a href={googleCalendarUrl(course)} target="_blank" rel="noopener noreferrer" className={btn + " bg-gray-900 text-white"}>
                Google Kalendář
              </a>
              <a href={icsDataUrl(course)} download="kurz-ateliernapobrezi.ics" className={btn + " border border-gray-300"}>
                Apple, Outlook a další (.ics)
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-2 text-sm">
        <h2 className="text-base font-semibold">Kdybyste cokoli potřebovali</h2>
        <p className="text-gray-700">Ptejte se nás kdykoli, rádi poradíme a odpovíme.</p>
        <ul className="space-y-1">
          <li>
            WhatsApp: <a className="underline" href={WHATSAPP_URL}>{PHONE_DISPLAY}</a>
          </li>
          <li>
            Telefon: <a className="underline" href={"tel:" + PHONE_TEL}>{PHONE_DISPLAY}</a>
          </li>
          <li>
            E-mail: <a className="underline" href={"mailto:" + EMAIL}>{EMAIL}</a>
          </li>
        </ul>
      </section>
    </main>
  );
}
