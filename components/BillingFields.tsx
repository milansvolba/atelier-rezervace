"use client";

import { useEffect, useRef, useState } from "react";
import { BillingInput, icoValid, normalizeIco, SIMPLIFIED_LIMIT_CZK } from "@/lib/billingInput";

const input = "mt-1 w-full h-10 border border-gray-300 rounded-md px-2";

// Fakturační údaje v krocích objednávky (kurzy, poukazy). Firma: vyplní se IČO, zbytek dohledá ARES (jde upravit).
// Soukromá osoba: adresa jen když objednávka přesáhne limit zjednodušeného dokladu (needAddress).
export default function BillingFields({ value, onChange, needAddress }: { value: BillingInput; onChange: (v: BillingInput) => void; needAddress: boolean }) {
  const [aresMsg, setAresMsg] = useState("");
  const [aresBusy, setAresBusy] = useState(false);
  const lastLooked = useRef("");

  const ico = normalizeIco(value.ico ?? "");

  async function lookup(code: string) {
    setAresBusy(true);
    setAresMsg("");
    try {
      const r = await fetch("/api/ares?ico=" + encodeURIComponent(code));
      if (r.ok) {
        const c = await r.json();
        onChange({ ...value, isCompany: true, ico: code, company: c.company, street: c.street, zip: c.zip, city: c.city, dic: c.dic ?? value.dic });
        setAresMsg("Údaje načteny z ARES, zkontrolujte je prosím.");
      } else if (r.status === 404) {
        setAresMsg("Firmu se nepodařilo dohledat, vyplňte údaje ručně.");
      } else {
        setAresMsg("ARES teď neodpovídá, vyplňte údaje ručně.");
      }
    } catch {
      setAresMsg("ARES teď neodpovídá, vyplňte údaje ručně.");
    }
    setAresBusy(false);
  }

  // Jakmile je IČO kompletní a správné, údaje se samy dohledají (jen jednou pro dané IČO).
  useEffect(() => {
    if (value.isCompany && icoValid(ico) && lastLooked.current !== ico) {
      lastLooked.current = ico;
      lookup(ico);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ico, value.isCompany]);

  const set = (patch: Partial<BillingInput>) => onChange({ ...value, ...patch });

  const addressFields = (required: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label className="text-sm sm:col-span-3">
        Ulice a číslo
        <input required={required} autoComplete="street-address" className={input} value={value.street ?? ""} onChange={(e) => set({ street: e.target.value })} />
      </label>
      <label className="text-sm">
        PSČ
        <input required={required} autoComplete="postal-code" className={input} value={value.zip ?? ""} onChange={(e) => set({ zip: e.target.value })} />
      </label>
      <label className="text-sm sm:col-span-2">
        Město
        <input required={required} autoComplete="address-level2" className={input} value={value.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
      </label>
    </div>
  );

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.isCompany} onChange={(e) => set({ isCompany: e.target.checked })} />
        Nakupuji na firmu (doklad na IČO)
      </label>

      {value.isCompany && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              IČO
              <input
                required
                inputMode="numeric"
                maxLength={10}
                className={input}
                value={value.ico ?? ""}
                onChange={(e) => set({ ico: e.target.value })}
                placeholder="8 číslic"
              />
            </label>
            <label className="text-sm">
              DIČ (jen plátci DPH)
              <input className={input} value={value.dic ?? ""} onChange={(e) => set({ dic: e.target.value })} placeholder="CZ12345678" />
            </label>
            <label className="text-sm sm:col-span-2">
              Název firmy
              <input required className={input} value={value.company ?? ""} onChange={(e) => set({ company: e.target.value })} />
            </label>
          </div>
          {addressFields(true)}
          <p className="text-xs text-gray-500">
            {aresBusy ? "Dohledávám firmu v ARES…" : aresMsg || "Stačí zadat IČO, ostatní údaje se zkusíme doplnit z rejstříku ARES."}
          </p>
        </div>
      )}

      {!value.isCompany && needAddress && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            U objednávky nad {SIMPLIFIED_LIMIT_CZK.toLocaleString("cs-CZ")} Kč potřebujeme pro daňový doklad vaši adresu.
          </p>
          {addressFields(true)}
        </div>
      )}
    </div>
  );
}
