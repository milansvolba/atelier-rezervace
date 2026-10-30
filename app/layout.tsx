import type { Metadata } from "next";
import { Comfortaa, Work_Sans } from "next/font/google";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";
import AppShell from "@/components/AppShell";
import BackToSite from "@/components/BackToSite";
import LeaveLink from "@/components/LeaveLink";
import AnalyticsConsent from "@/components/AnalyticsConsent";

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
title: "Ateliér na pobřeží — rezervace",
description: "Rozpis obsazenosti a rezervace klubovny s ateliérem",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
  <html lang="cs" className={`${comfortaa.variable} ${workSans.variable}`}>
    <body className="min-h-screen font-body">
      <AppShell>
        <BackToSite />
        <header className="flex items-center justify-between mb-6">
          <LeaveLink href="https://ateliernapobrezi.cz" ariaLabel="Ateliér na pobřeží – hlavní web">
            <img src="/logo.png" alt="Ateliér na pobřeží" className="h-10 w-auto" />
          </LeaveLink>
          <HeaderNav />
        </header>
        {children}
      </AppShell>
      <AnalyticsConsent />
    </body>
  </html>
);
}
