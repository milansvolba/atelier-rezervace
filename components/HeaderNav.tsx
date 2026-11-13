"use client";

import { usePathname } from "next/navigation";

// Odkaz "Přihlásit" v hlavičce se ukazuje jen mimo /admin — jakmile je člověk
// na admin stránce, přihlášení/odhlášení řeší rovnou ona sama, ať se to nezdvojuje.
export default function HeaderNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-display">
      {pathname !== "/" && (
        <a href="/" className="py-1 text-sm text-gray-500 hover:text-gray-800">
          Rezervace
        </a>
      )}
      {pathname !== "/kurzy" && (
        <a href="/kurzy" className="py-1 text-sm text-gray-500 hover:text-gray-800">
          Kurzy
        </a>
      )}
      <a href="/admin" className="py-1 text-sm text-gray-500 hover:text-gray-800">
        Přihlásit
      </a>
    </div>
  );
}
