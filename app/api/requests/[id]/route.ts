import { NextRequest, NextResponse } from "next/server";
import { store, findConflict } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { sendRequesterDecisionEmail } from "@/lib/email";

// PATCH /api/requests/:id  { action: "approve" | "reject" }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action } = await req.json();
  const all = await store.all();
  const booking = all.find((b) => b.id === params.id);
  if (!booking) return NextResponse.json({ error: "žádost nenalezena" }, { status: 404 });

  if (action === "approve") {
    const conflict = await findConflict(booking.resource, booking.date, booking.startTime, booking.endTime, booking.id);
    if (conflict) {
      return NextResponse.json(
        { error: `Mezitím vznikla kolize s: ${conflict.title}. Nejdřív to vyřešte.` },
        { status: 409 }
      );
    }
    await store.update(booking.id, { status: "confirmed" });
  } else if (action === "reject") {
    await store.update(booking.id, { status: "rejected" });
  } else {
    return NextResponse.json({ error: "neznámá akce" }, { status: 400 });
  }

  const updated = (await store.all()).find((b) => b.id === params.id);
  if (updated) await sendRequesterDecisionEmail(updated, action === "approve");
  return NextResponse.json(updated);
}
