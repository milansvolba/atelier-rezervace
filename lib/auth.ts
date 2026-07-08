import { NextRequest } from "next/server";

// ZJEDNODUŠENÁ DEMO AUTENTIZACE — jedno sdílené heslo z env proměnné.
// Před ostrým nasazením nahradit skutečnými jmennými admin účty (Milan, Petr, ...),
// viz specifikace. Heslo se posílá jako "x-admin-token" hlavička.
const DEMO_PASSWORD = process.env.ADMIN_PASSWORD || "atelier2026";

export function requireAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  return token === DEMO_PASSWORD;
}

export function checkPassword(pw: string) {
  return pw === DEMO_PASSWORD;
}
