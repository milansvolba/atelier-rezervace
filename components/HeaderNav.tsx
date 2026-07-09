"use client";

import { usePathname } from "next/navigation";

// Odkaz "Přihlásit" v hlavičce se ukazuje jen mimo /admin — jakmile je člověk
// na admin stránce, přihlášení/odhlášení řeší rovnou ona sama, ať se to nezdvojuje.
export default function HeaderNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <a href="/admin" className="text-sm text-gray-500 hover:text-gray-800">
      Přihlásit
    </a>
  );
}
