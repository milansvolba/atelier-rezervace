"use client";

import { useState } from "react";

// Žádost o členství v klubu (NÁVRH textů ke schválení). Odesílá se na /api/membership/request.
export default function RequestForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", consent: false, honeypot: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/membership/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setState("done");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Nepodařilo se nám odeslat žádost. Zkuste to prosím znovu, nebo nám napište na info@ateliernapobrezi.cz.");
    } catch {
      setError("Nepodařilo se nám odeslat žádost. Zkuste to prosím znovu, nebo nám napište na info@ateliernapobrezi.cz.");
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <div className="space-y-2" role="status">
        <p className="text-sm font-semibold">Žádost jsme přijali.</p>
        <p className="text-sm text-gray-700">
          Ozveme se vám e-mailem, jakmile ji schválíme. V e-mailu najdete odkaz na platbu členství.
        </p>
      </div>
    );
  }

  const field = "mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-[#2f4a4a]";
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        Jméno
        <input
          required
          autoComplete="name"
          maxLength={100}
          className={field}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        E-mail
        <input
          required
          type="email"
          autoComplete="email"
          maxLength={200}
          className={field}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        Telefon <span className="text-gray-500">(nepovinné)</span>
        <input
          type="tel"
          autoComplete="tel"
          maxLength={40}
          className={field}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        Vzkaz <span className="text-gray-500">(nepovinné)</span>
        <textarea
          rows={3}
          maxLength={1000}
          className={field}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        />
      </label>
      {/* Past na roboty: člověk toto pole nevidí. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>
          Web
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.honeypot}
            onChange={(e) => setForm((f) => ({ ...f, honeypot: e.target.value }))}
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          required
          className="mt-1"
          checked={form.consent}
          onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
        />
        <span>Souhlasím, že Ateliér na pobřeží zpracuje tyto údaje, aby mohl vyřídit moji žádost o členství.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={state === "sending"}
        className="block w-full text-center bg-black text-white rounded-md py-3 font-semibold hover:bg-gray-800 disabled:opacity-50"
      >
        {state === "sending" ? "Odesílám…" : "Chci do klubu"}
      </button>
    </form>
  );
}
