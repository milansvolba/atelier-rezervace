"use client";

import { usePathname } from "next/navigation";

// Malý textový odkaz zpět na hlavní web ateliéru. Logo vede na web také, ale část lidí neví, že je
// klikací, proto je tu i viditelný text. V administraci se neukazuje (tam má člověk vlastní navigaci).
export default function BackToSite() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <a
      href="https://ateliernapobrezi.cz"
      className="inline-block mb-2 text-xs font-display text-gray-500 hover:text-gray-800"
    >
      ← Zpět na web ateliéru
    </a>
  );
}
