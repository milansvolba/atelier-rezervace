import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";
import { getSession, verifyPayToken } from "@/lib/auth";
import { createMembershipCheckout, createPortalUrl } from "@/lib/membership";

export const dynamic = "force-dynamic";

// GET /api/membership/manage
//  - s ?token=... (odkaz z uvítacího e-mailu): založí předplatné na platební stránce Stripe,
//  - bez tokenu, ale s přihlášením: aktivní člen jde do zákaznického portálu Stripe
//    (karta, faktury, zrušení), ostatní na platbu předplatného.
// Portál se nikdy neotevírá přes token z e-mailu, jen po přihlášení.
export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
  const token = req.nextUrl.searchParams.get("token");

  let userId: string | null = null;
  let viaToken = false;
  if (token) {
    userId = await verifyPayToken(token);
    viaToken = !!userId;
  }
  if (!userId) {
    const session = await getSession(req);
    userId = session ? session.id : null;
  }
  if (!userId) return NextResponse.redirect(base + "/admin?clenstvi=prihlasit", 303);

  const user = await users.byId(userId);
  if (!user) return NextResponse.redirect(base + "/admin?clenstvi=chyba", 303);

  // Členství zdarma (guestlist): platit nemusí.
  if (user.membershipFree) return NextResponse.redirect(base + "/admin?clenstvi=zdarma", 303);

  const hasSubscription =
    !!user.stripeCustomerId && (user.membershipStatus === "active" || user.membershipStatus === "past_due");

  try {
    if (hasSubscription) {
      if (viaToken) return NextResponse.redirect(base + "/admin?clenstvi=aktivni", 303);
      return NextResponse.redirect(await createPortalUrl(user.stripeCustomerId as string), 303);
    }
    return NextResponse.redirect(await createMembershipCheckout(user), 303);
  } catch (err) {
    console.error("[membership] " + (err instanceof Error ? err.message : String(err)));
    return NextResponse.redirect(base + "/admin?clenstvi=chyba", 303);
  }
}
