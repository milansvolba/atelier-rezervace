import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { courseFlags } from "@/lib/courseFlags";
import { castingPriceFor, courseTypeKey } from "@/lib/pricing";

// Data se mění za běhu (nové kurzy, přihlášky) — nechceme, aby to Next.js
// zkoušel staticky prerenderovat při buildu.
export const dynamic = "force-dynamic";

// GET /api/courses — veřejný seznam vypsaných (potvrzených, budoucích) termínů kurzů.
// Na rozdíl od /api/bookings tady záměrně vracíme i název a kapacitu — jde o
// veřejnou nabídku kurzů, ne o soukromé rezervace míst.
export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  // Firemní akce (příznak v adminu) se na veřejné stránce neukazují.
  const [all, hidden] = await Promise.all([store.all(), courseFlags.corporateIds()]);
  const courses = all.filter(
    (b) => b.category === "kurz" && b.status === "confirmed" && b.date >= today && !hidden.has(b.id)
  );

  // Obsazenost všech termínů jedním dotazem (dřív se ptalo zvlášť na každý termín).
  const takenById = await signupStore.confirmedPeopleByBooking(courses.map((c) => c.id));
  const withCapacity = courses.map((c) => {
    const taken = c.capacity ? takenById.get(c.id) ?? 0 : 0;
    return {
      id: c.id,
      title: c.title,
      date: c.date,
      startTime: c.startTime,
      endTime: c.endTime,
      note: c.note,
      capacity: c.capacity ?? null,
      price: c.price ?? null,
      courseType: courseTypeKey(c),
      castingPrice: castingPriceFor(c),
      spotsLeft: c.capacity ? Math.max(0, c.capacity - taken) : null,
    };
  });

  withCapacity.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  // Krátká sdílená cache na Vercelu: většina návštěvníků dostane odpověď hned, bez probouzení serveru a databáze.
  // Obsazenost se tím může zpozdit nejvýš o ~minutu; před platbou ji server stejně znovu ověří.
  return NextResponse.json(withCapacity, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
  });
}
