// Úvodní stránka členství: sem vede odkaz z uvítacího e-mailu. Teprve tlačítkem se jde na platbu (Stripe).
export const dynamic = "force-dynamic";

export const metadata = { title: "Členství — Atelier na Pobřeží" };

export default function MembershipPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  const payHref = token ? "/api/membership/manage?token=" + encodeURIComponent(token) : null;

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 w-full max-w-md space-y-5">
        <h1 className="text-xl font-semibold">Členství v klubu</h1>
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
      </div>
    </main>
  );
}
