import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";

// Data se mění za běhu (nové kurzy, přihlášky) — nechceme, aby to Next.js
// zkoušel staticky prerenderovat při buildu.
export const dynamic = "force-dynamic";

// GET /api/courses — veřejný seznam vypsaných (potvrzených, budoucích) termínů kurzů.
// Na rozdíl od /api/bookings tady záměrně vracíme i název a kapacitu — jde o
// veřejnou nabídku kurzů, ne o soukromé rezervace míst.
export async function GET() {
  const all = await store.all();
  const today = new Date().toISOString().slice(0, 10);
  const courses = all.filter((b) => b.category === "kurz" && b.status === "confirmed" && b.date >= today);

  const withCapacity = await Promise.all(
    courses.map(async (c) => {
      const taken = c.capacity ? await signupStore.confirmedPeopleForBooking(c.id) : 0;
      return {
        id: c.id,
        title: c.title,
        date: c.date,
        startTime: c.startTime,
        endTime: c.endTime,
        note: c.note,
        capacity: c.capacity ?? null,
        price: c.price ?? null,
        spotsLeft: c.capacity ? Math.max(0, c.capacity - taken) : null,
      };
    })
  );

  withCapacity.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  return NextResponse.json(withCapacity);
}
