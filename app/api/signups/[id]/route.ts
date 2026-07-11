import { NextRequest, NextResponse } from "next/server";
import { signupStore } from "@/lib/signups";
import { store } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { sendSignupDecisionEmail } from "@/lib/email";

// PATCH /api/signups/:id  { action: "approve" | "reject" }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action } = await req.json();
  const signup = await signupStore.byId(params.id);
  if (!signup) return NextResponse.json({ error: "přihláška nenalezena" }, { status: 404 });

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "neznámá akce" }, { status: 400 });
  }
  const updated = await signupStore.updateStatus(params.id, action === "approve" ? "confirmed" : "rejected");

  const all = await store.all();
  const booking = all.find((b) => b.id === signup.bookingId);
  if (booking && updated) await sendSignupDecisionEmail(booking, updated, action === "approve");

  return NextResponse.json(updated);
}
