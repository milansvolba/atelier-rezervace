import type { Metadata } from "next";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";

export const metadata: Metadata = {
  title: "Atelier na Pobřeží — rezervace",
  description: "Rozpis obsazenosti a rezervace klubovny s ateliérem",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <header className="flex items-center justify-between mb-6">
            <a href="/" className="font-medium text-lg">
              Atelier na Pobřeží
            </a>
            <HeaderNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
