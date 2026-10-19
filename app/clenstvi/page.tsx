// Stránka členství: sem vede odkaz z uvítacího e-mailu (úvod před platbou) i návrat ze Stripe (poděkování).
export const dynamic = "force-dynamic";

export const metadata = { title: "Členství — Atelier na Pobřeží" };

export default function MembershipPage({ searchParams }: { searchParams: { token?: string; platba?: string } }) {
  const token = searchParams.token;
  const payHref = token ? "/api/membership/manage?token=" + encodeURIComponent(token) : null;
  const paid = searchParams.platba === "ok";
  const cancelled = searchParams.platba === "zrusena";

  return (
    <main className="flex justify-center px-4 py-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 w-full max-w-md space-y-5">
        {paid ? (
          <>
            <h1 className="text-xl font-semibold">Děkujeme, členství je zaplacené</h1>
            <p className="text-sm text-gray-700">
              Platba proběhla v pořádku a tvoje členství v Ateliéru na Pobřeží je aktivní.
            </p>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>Fakturu ti Stripe pošle e-mailem.</li>
              <li>Rezervace ateliéru, pingpongu a stolů najdeš po přihlášení.</li>
              <li>Předplatné můžeš kdykoli zrušit: po přihlášení klikni nahoře na Členství.</li>
            </ul>
            <a
              href="/admin"
              className="block text-center bg-black text-white rounded-md py-3 font-semibold hover:bg-gray-800"
            >
              Přejít do rezervací
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Členství v klubu</h1>
            {cancelled && (
              <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
                Platba nebyla dokončena a nic se ti nestrhlo. Můžeš to zkusit znovu.
              </p>
            )}
            {payHref ? (
              <>
                <p className="text-sm text-gray-700">
                  Jsi o krok od členství v Ateliéru na Pobřeží. Členství je měsíční předplatné.
                </p>
                <p className="text-2xl font-semibold">
                  249 Kč <span className="text-sm font-normal text-gray-500">měsíčně, včetně DPH</span>
                </p>
                <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                  <li>Platíš kartou na zabezpečené stránce Stripe. Údaje o kartě k nám nedorazí.</li>
                  <li>Po každé platbě ti Stripe pošle fakturu e-mailem.</li>
                  <li>Předplatné můžeš kdykoli zrušit: po přihlášení do rezervací klikni nahoře na Členství.</li>
                </ul>
                <a
                  href={payHref}
                  className="block text-center bg-black text-white rounded-md py-3 font-semibold hover:bg-gray-800"
                >
                  Pokračovat k platbě
                </a>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  Odkaz na platbu členství najdeš v uvítacím e-mailu. Pokud už členem jsi, přihlas se do rezervací
                  a klikni nahoře na Členství.
                </p>
                <a href="/admin" className="block text-center border border-gray-300 rounded-md py-3 font-medium hover:bg-gray-50">
                  Přihlásit se do rezervací
                </a>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
