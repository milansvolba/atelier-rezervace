import { NextRequest } from "next/server";
import { store } from "@/lib/data";
import { RESOURCE_LABELS } from "@/lib/types";

// Vždy čerstvá data z DB, žádné cachování response (viz commit "vypnout cache
// na Neon fetch klientovi" — cache tu už jednou dělala problémy).
export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Escapování textových hodnot podle RFC 5545 §3.3.11.
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Skládání řádků na max. 75 znaků s pokračovací mezerou na dalším řádku (RFC 5545 §3.1).
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = "";
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const chunkSize = first ? 74 : 73;
    result += (first ? "" : "\r\n ") + rest.slice(0, chunkSize);
    rest = rest.slice(chunkSize);
    first = false;
  }
  return result;
}

function localToICS(dateISO: string, time: string): string {
  const [y, m, d] = dateISO.split("-");
  const [h, min] = time.split(":");
  return `${y}${m}${d}T${h}${min}00`;
}

// Standardní EU pravidla pro CET/CEST (poslední neděle v březnu/říjnu) — napevno,
// ať feed nezávisí na tom, v jakém pásmu běží samotný serverless runtime.
const VTIMEZONE_PRAGUE_LINES = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Prague",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19810329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19961027T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

// Veřejný, ale netušitelný feed potvrzených rezervací pro odběr v Google/Apple
// kalendáři (Nastavení kalendáře → Přidat kalendář → Z URL). Přístup hlídá sdílený
// token v query stringu (env CALENDAR_FEED_TOKEN) — kalendářové appky se nedokážou
// přihlásit přes naše /admin, takže tohle je jediná realistická ochrana feedu.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.CALENDAR_FEED_TOKEN;
  if (!expected || token !== expected) {
    return new Response("Neplatný nebo chybějící token.", { status: 403 });
  }

  const all = await store.all();
  const confirmed = all.filter((b) => b.status === "confirmed");

  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours()
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atelier na Pobrezi//Rezervace//CS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Atelier na Pobřeží – rezervace",
    "X-WR-TIMEZONE:Europe/Prague",
    ...VTIMEZONE_PRAGUE_LINES,
  ];

  for (const b of confirmed) {
    const descParts = [`Místo: ${RESOURCE_LABELS[b.resource]}`];
    if (b.requesterContact) descParts.push(`Kontakt: ${b.requesterContact}`);
    if (b.note) descParts.push(`Poznámka: ${b.note}`);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@rezervace.ateliernapobrezi.cz`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Prague:${localToICS(b.date, b.startTime)}`,
      `DTEND;TZID=Europe/Prague:${localToICS(b.date, b.endTime)}`,
      `SUMMARY:${icsEscape(b.title)}`,
      `LOCATION:${icsEscape("Atelier na Pobřeží")}`,
      `DESCRIPTION:${icsEscape(descParts.join("\n"))}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const body = lines.map(foldLine).join("\r\n") + "\r\n";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

