import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createMagicLinkToken, createPayToken } from "@/lib/auth";
import { membershipRequests } from "@/lib/membershipRequests";
import { users } from "@/lib/users";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/admin/membership-requests/:id { action: "approve" | "reject" } (jen admin)
// approve: vytvoří účet člena a pošle e-mail s odkazem na první platbu. Vrací welcomeEmailSent,
// aby administrace mohla ukázat, že e-mail opravdu odešel.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action } = await req.json().catch(() => ({ action: "" }));
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "neplatná akce" }, { status: 400 });
  }
  const request = await membershipRequests.byId(params.id);
  if (!request) return NextResponse.json({ error: "žádost nenalezena" }, { status: 404 });

  if (action === "reject") {
    if (!(await membershipRequests.decide(request.id, "rejected"))) {
      return NextResponse.json({ error: "žádost už je vyřízená" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  // Tento e-mail už má účet: žádost jen uzavřeme a řekneme to adminovi, ať nevznikne duplicita.
  if (await users.byEmail(request.email)) {
    await membershipRequests.decide(request.id, "approved");
    return NextResponse.json({ error: "tento e-mail už účet má, žádost jsem uzavřel" }, { status: 409 });
  }

  // Nejdřív zabereme žádost (ochrana proti dvojkliku), potom založíme účet.
  if (!(await membershipRequests.decide(request.id, "approved"))) {
    return NextResponse.json({ error: "žádost už je vyřízená" }, { status: 409 });
  }
  try {
    const user = await users.add({ name: request.name, email: request.email, role: "member", free: false });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
    const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(await createMagicLinkToken(user.email))}`;
    const payLink = `${appUrl}/clenstvi?token=${encodeURIComponent(await createPayToken(user.id))}`;
    const welcomeEmailSent = await sendWelcomeEmail(user, link, payLink);
    return NextResponse.json({ ok: true, welcomeEmailSent });
  } catch (err) {
    console.error("[membership-request] Schválení selhalo:", err);
    await membershipRequests.reopen(request.id);
    return NextResponse.json({ error: "Nepodařilo se založit účet. Zkuste to prosím znovu." }, { status: 500 });
  }
}
