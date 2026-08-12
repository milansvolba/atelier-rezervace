import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";

// Stejné fonty jako hlavní web ateliernapobrezi.cz (Fraunces pro nadpisy, Work Sans pro text) —
// latin-ext kvůli české diakritice.
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
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
    <html lang="cs" className={`${fraunces.variable} ${workSans.variable}`}>
      <body className="min-h-screen font-body">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <header className="flex items-center justify-between mb-6">
            <a href="/" className="font-display text-lg text-brand-ink">
              Ateliér <span className="text-brand-accent">na pobřeží</span>
            </a>
            <HeaderNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
