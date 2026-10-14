"use client";

import { useEffect, useState } from "react";

const GA_ID = "G-3D28LW4JGC";
const CLARITY_ID = "yxhpksh1yt";

function getCookie(name: string): string | null {
  const match = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  const d = new Date();
  d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

declare global {
  interface Window {
    gaLoaded?: boolean;
    clarityLoaded?: boolean;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

function loadGA() {
  if (window.gaLoaded) return;
  window.gaLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

function loadClarity() {
  if (window.clarityLoaded) return;
  window.clarityLoaded = true;
  (function (c: typeof window, l: Document, a: "clarity", r: "script", i: string) {
    const win = c as unknown as Record<string, unknown>;
    win[a] =
      win[a] ||
      function (...args: unknown[]) {
        ((win[a] as { q?: unknown[] }).q = (win[a] as { q?: unknown[] }).q || []).push(args);
      };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}

// Cookie lišta pro souhlas se sledováním (GDPR) — stejná logika jako na hlavním webu
// ateliernapobrezi.cz (inc/content.php -> render_analytics_banner), jen přepsaná do Reactu.
export default function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getCookie("cookie_consent");
    if (existing === "accepted") {
      loadGA();
      loadClarity();
    } else if (!existing) {
      setVisible(true);
    }
  }, []);

  function handleChoice(choice: "accepted" | "rejected") {
    setCookie("cookie_consent", choice);
    setVisible(false);
    if (choice === "accepted") {
      loadGA();
      loadClarity();
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Souhlas s cookies"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch gap-3 bg-brand-ink px-5 py-4 text-sm text-white shadow-[0_-2px_16px_rgba(0,0,0,0.2)] font-body sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="m-0 min-w-[260px] flex-1 leading-relaxed">
        Pro měření návštěvnosti a zlepšování webu používáme cookies (Google
        Analytics, Microsoft Clarity). Souhlas můžete kdykoliv odvolat
        smazáním cookies v prohlížeči.
      </p>
      <div className="flex justify-end gap-2.5 sm:shrink-0">
        <button
          type="button"
          onClick={() => handleChoice("rejected")}
          className="rounded-lg border border-white/40 bg-transparent px-4 py-2.5 text-sm text-white"
        >
          Odmítnout
        </button>
        <button
          type="button"
          onClick={() => handleChoice("accepted")}
          className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-navy"
        >
          Přijmout
        </button>
      </div>
    </div>
  );
}
