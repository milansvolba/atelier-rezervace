"use client";

import { REFERRAL_OPTIONS } from "@/lib/types";

// Sdílený ovládaný formulářový prvek "Odkud o nás víte?" — používá se na všech veřejných
// formulářích (žádost o pronájem/kurz, přihláška/platba na kurz, nákup dárkového poukazu).
export function HeardAboutField({
  value,
  onChange,
  otherValue,
  onOtherChange,
}: {
  value: string;
  onChange: (v: string) => void;
  otherValue: string;
  onOtherChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      Odkud o nás víte? (nepovinné)
      <select
        className="mt-1 w-full h-10 border border-gray-300 rounded-md px-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Nevyplněno —</option>
        {REFERRAL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value === "jine" && (
        <input
          className="mt-2 w-full h-10 border border-gray-300 rounded-md px-2"
          placeholder="Upřesněte prosím"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
        />
      )}
    </label>
  );
}
