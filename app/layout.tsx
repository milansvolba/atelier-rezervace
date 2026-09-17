import type { Metadata } from "next";
import { Comfortaa, Work_Sans } from "next/font/google";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";

// Stejné fonty jako hlavní web ateliernapobrezi.cz (Comfortaa pro nadpisy a logo, Work Sans pro text) —
// latin-ext kvůli české diakritice.
const comfortaa = Comfortaa({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-comfortaa",
});

const workSans = Work_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: "Atelier na Pobřeží — rezervace",
  description: "Rozpis obsazenosti a rezervace klubovny s ateliérem",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${comfortaa.variable} ${workSans.variable}`}>
      <body className="min-h-screen font-body">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <header className="flex items-center justify-between mb-6">
            <a href="/">
              <img src="/logo.png" alt="Ateliér na pobřeží" className="h-10 w-auto" />
            </a>
            <HeaderNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
