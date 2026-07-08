import type { Metadata } from "next";
import "./globals.css";

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
            <a href="/admin" className="text-sm text-gray-500 hover:text-gray-800">
              Přihlásit
            </a>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
