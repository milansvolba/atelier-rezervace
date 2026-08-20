// Obecný "něco se změnilo" webhook pro propojené systémy Ateliéru na pobřeží.
// Účel: informovat napojené weby/appky (typicky ateliernapobrezi.cz), že mají
// smysl si znovu stáhnout čerstvá data, místo aby čekaly na TTL cache. Zatím
// se používá jen pro kurzy (viz lib/data.ts), ale je záměrně obecný - stejný
// mechanismus může v budoucnu spouštět i jiné napojené zobrazení dat.
//
// Bezpečně "fire-and-forget": chyba, timeout nebo výpadek příjemce nikdy
// nesmí shodit ani zpomalit samotnou operaci (vytvoření/úpravu/smazání
// rezervace) - proto je zabalený v try/catch a má krátký timeout.
//
// Payload je záměrně minimální (jen typ události a pár identifikátorů) -
// příjemce si při triggeru vždy sám stáhne čerstvá data z veřejného API,
// místo aby slepě věřil obsahu webhooku. Bez WEBHOOK_URL / WEBHOOK_SECRET
// v env se webhook prostě přeskočí (appka funguje dál, jen bez notifikace -
// napojený web má vlastní TTL fallback).
export function notifyDataChanged(event: string, detail?: Record<string, unknown>) {
  const url = process.env.WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url || !secret) return;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
    body: JSON.stringify({ event, ...detail, ts: Date.now() }),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {
    // Ignorovat - viz komentář výše, webhook je jen optimalizace doručení.
  });
}

