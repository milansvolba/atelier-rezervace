# PDF dárkového poukazu

Stav: připraveno k nasazení po sloučení Pull requestu (15. 11. 2026). Schválený vzhled a pravidla jsou v projektu Claude (`claude/poukazy-design-final-2026-11-15.md`).

## Jak to funguje
- Po zaplacení (Stripe webhook, větev `kind=voucher`) se zavolá `sendVoucherEmail`. Ta vytvoří PDF (`generateVoucherPdf` v `lib/voucherPdf.ts`) a přiloží ho k e-mailu `voucher_buyer` přes Resend.
- Při chybě generování e-mail odejde bez přílohy, v e-mailu je tlačítko „Stáhnout poukaz (PDF)“ (`/api/vouchers/pdf?t=<manageToken>`). Admin má v seznamu poukazů „Stáhnout PDF“ a „Poslat znovu“.
- PDF má 2 strany. Přední: motiv podle kurzu, název kurzu, „Dárkový poukaz“, „Pro <jméno ve 4. pádu>“, karty (V ceně poukazu, volitelně Termín kurzu), podpis. Zadní: kód, platnost, QR na `…/kurzy?poukaz=KÓD`, návod a kontakty.

## Podle čeho se mění obsah
- Motiv: `Voucher.topic` (`hlava` = hlava z vln, jinak vlny). Nový kurz = nový motiv v `lib/voucherMotifs.ts` (`motifForTopic`) a název v `COURSE_NAMES` v `lib/voucherPdf.ts`.
- Jméno obdarovaného: `Voucher.recipientName` (zadává kupující ve 4. pádu). Prázdné = řádek „Pro“ se vynechá.
- Počet osob: `Voucher.people`. Věta o odlitku: jen když `castingCount > 0`.
- Termín: `booking` (pevný termín) → karta „Termín kurzu“ a jiný text kroku 1.

## Pravidla vzhledu (nedodržet = chyba)
- Obrázek ani pruh vlnek se nikdy neořezává (všechny linie leží uvnitř výšky obrázku).
- Za webovou adresou v textech nikdy tečka.
- Texty vykají. Žádná cena, žádné IČO/DIČ na poukazu.
- Podpis na poukazu je vymyšlený (`lib/voucher-assets/petr-podpis.png`), ne skutečný. Nepoužívat skutečný podpis.

## Test
Lokálně: `npx tsx` skript, který zavolá `generateVoucherPdf` s ukázkovým poukazem (s termínem, bez, 6 jmen, bez jména) a výstup převede na obrázek. Na Vercel preview: koupit poukaz se Stripe testovacími klíči a zkontrolovat přílohu v e-mailu.
