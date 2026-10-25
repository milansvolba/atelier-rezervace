"use client";

import { useRef } from "react";

// Odkaz na hlavní web, který před odchodem upozorní, když má člověk rozdělaný formulář.
// "Rozdělaný" = v některém formuláři na stránce je vyplněné textové pole (jméno, kontakt, poznámka).
// Předvyplněné výchozí hodnoty (datum, čas, výběr z nabídky) se nepočítají, ať dialog nevyskakuje zbytečně.
// Vlastní text jde ukázat jen u kliknutí na tento odkaz; při zavření záložky nebo tlačítku Zpět v prohlížeči
// ukazují prohlížeče vlastní hlášku a její text změnit nejde.
function hasUnfinishedForm(): boolean {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "form textarea, form input[type=text], form input[type=email], form input[type=tel], form input:not([type])"
  );
  return Array.from(fields).some((el) => el.value.trim() !== "");
}

export default function LeaveLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <a
        href={href}
        className={className}
        aria-label={ariaLabel}
        onClick={(e) => {
          if (hasUnfinishedForm()) {
            e.preventDefault();
            dialogRef.current?.showModal();
          }
        }}
      >
        {children}
      </a>
      <dialog
        ref={dialogRef}
        aria-labelledby="leave-title"
        className="rounded-xl border border-gray-200 p-5 max-w-sm w-[calc(100%-2rem)] shadow-lg backdrop:bg-black/30"
      >
        <p id="leave-title" className="font-display font-semibold text-lg">
          Opravdu už odcházíte?
        </p>
        <p className="mt-1 text-sm text-gray-600">Místo zatím není zarezervované.</p>
        <div className="mt-5 flex justify-end gap-3">
          <a href={href} className="h-10 px-4 inline-flex items-center rounded-md border border-gray-300 text-sm text-gray-700 hover:border-gray-500">
            Odejít
          </a>
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            className="h-10 px-4 rounded-md bg-gray-900 text-white text-sm"
          >
            Dokončit rezervaci
          </button>
        </div>
      </dialog>
    </>
  );
}
