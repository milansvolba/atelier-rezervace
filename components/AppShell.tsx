"use client";

import { usePathname } from "next/navigation";

// Společný obal stránky (hlavička + obsah). Veřejné stránky mají úzký sloupec; admin se na širokých
// obrazovkách (od lg) rozšíří na dva sloupce, a protože hlavička je uvnitř stejného obalu, logo i menu
// zůstávají zarovnané s levým a pravým okrajem obsahu. Na mobilu je okraj stejný pro logo i obsah.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = !!pathname && pathname.startsWith("/admin");
  return (
    <div className={`mx-auto px-4 py-6 max-w-3xl ${admin ? "lg:max-w-7xl" : ""}`}>
      {children}
    </div>
  );
}
