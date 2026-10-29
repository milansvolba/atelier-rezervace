// Texty viditelné zákazníkům (průvodce objednávkou kurzu, hlášky). Výchozí znění je tady;
// správa textů v adminu je později bude moci přepsat (stejný princip jako e-mailové šablony).
// Zástupné symboly {{promenna}} se při zobrazení nahradí skutečnými hodnotami (viz fillText).

export interface UiTextDef {
  group: string;
  label: string;
  description: string; // kde a kdy se text zákazníkovi zobrazí
  vars: string[];
  text: string;
}

export const DEFAULT_UI_TEXTS: Record<string, UiTextDef> = {
  "kurzy.pick": {
    group: "Objednávka kurzu",
    label: "Tlačítko u termínu",
    description: "Krok 1: tlačítko u každého vypsaného termínu kurzu.",
    vars: [],
    text: "Vybrat termín",
  },
  "kurzy.step.label": {
    group: "Objednávka kurzu",
    label: "Označení kroku",
    description: "Malý popisek nad nadpisem kroku v průvodci objednávkou.",
    vars: ["step"],
    text: "Krok {{step}} ze 4",
  },
  "kurzy.step2.title": {
    group: "Objednávka kurzu",
    label: "Krok 2: nadpis",
    description: "Nadpis kroku, kde zákazník vybírá počet míst.",
    vars: [],
    text: "Kolik míst chcete rezervovat?",
  },
  "kurzy.step2.titleVoucher": {
    group: "Objednávka kurzu",
    label: "Krok 2: nadpis při uplatnění poukazu",
    description: "Nadpis kroku 2, když zákazník uplatňuje dárkový poukaz (počet míst je už daný poukazem).",
    vars: [],
    text: "Váš poukaz je platný",
  },
  "kurzy.step2.hint": {
    group: "Objednávka kurzu",
    label: "Krok 2: nápověda pod počtem míst",
    description: "Drobný text pod výběrem počtu míst. Proměnné: spots = počet volných míst, remaining = „Zbývá“/„Zbývají“, places = správně vyskloňované „volné místo/volná místa/volných míst“.",
    vars: ["spots", "remaining", "places"],
    text: "{{remaining}} {{spots}} {{places}}. Čím víc vás přijde, tím větší sleva.",
  },
  "kurzy.step2.maxSeats": {
    group: "Objednávka kurzu",
    label: "Krok 2: upozornění na limit míst online",
    description: "Zobrazí se pod počtem míst, když zákazník dosáhne největšího počtu, který jde zaplatit online, a termín má volných míst víc. Proměnná max = nejvyšší počet míst online.",
    vars: ["max"],
    text: "Online lze zaplatit nejvýše {{max}} míst. Pro větší skupinu nebo firmu domluvíme termín na míru.",
  },
  "kurzy.step2.maxSeatsButton": {
    group: "Objednávka kurzu",
    label: "Krok 2: tlačítko v upozornění na limit míst",
    description: "Tlačítko v žlutém upozornění na limit míst online. Přesune zákazníka k poptávce kurzu na míru pro skupinu.",
    vars: [],
    text: "Domluvit termín pro skupinu",
  },
  "kurzy.step2.nudge": {
    group: "Objednávka kurzu",
    label: "Krok 2: nabídka přidat další místo",
    description: "Zobrazí se, když by další místo zvýšilo slevu. more = např. 'ještě 1 místo', percent = nová sleva.",
    vars: ["more", "percent"],
    text: "Přidejte {{more}} a získáte slevu {{percent}} %.",
  },
  "kurzy.step3.title": {
    group: "Objednávka kurzu",
    label: "Krok 3: nadpis",
    description: "Nadpis kroku s kontaktními údaji.",
    vars: [],
    text: "Kam vám pošleme potvrzení?",
  },
  "kurzy.field.name": {
    group: "Objednávka kurzu",
    label: "Pole: jméno",
    description: "Popisek pole se jménem v kroku 3.",
    vars: [],
    text: "Jméno a příjmení",
  },
  "kurzy.field.email": {
    group: "Objednávka kurzu",
    label: "Pole: e-mail",
    description: "Popisek pole s e-mailem v kroku 3.",
    vars: [],
    text: "E-mail",
  },
  "kurzy.field.phone": {
    group: "Objednávka kurzu",
    label: "Pole: telefon",
    description: "Popisek pole s telefonem v kroku 3 (nepovinné).",
    vars: [],
    text: "Telefon (nepovinné)",
  },
  "kurzy.field.note": {
    group: "Objednávka kurzu",
    label: "Pole: poznámka",
    description: "Popisek pole s poznámkou v kroku 3 (nepovinné).",
    vars: [],
    text: "Poznámka (nepovinné)",
  },
  "kurzy.step4.title": {
    group: "Objednávka kurzu",
    label: "Krok 4: nadpis",
    description: "Nadpis posledního kroku se shrnutím objednávky.",
    vars: [],
    text: "Zkontrolujte objednávku",
  },
  "kurzy.summary.discount": {
    group: "Objednávka kurzu",
    label: "Řádek slevy ve shrnutí",
    description: "Zobrazí se v cenovém shrnutí, pokud je sleva. percent = procento slevy.",
    vars: ["percent"],
    text: "Skupinová sleva {{percent}} %",
  },
  "kurzy.pay.button": {
    group: "Objednávka kurzu",
    label: "Tlačítko platby",
    description: "Hlavní tlačítko v kroku 4. total = celková cena v Kč.",
    vars: ["total"],
    text: "Zaplatit {{total}} Kč",
  },
  "kurzy.signup.busy": {
    group: "Objednávka kurzu",
    label: "Tlačítko přihlášky: čekání",
    description: "Text tlačítka během odesílání přihlášky na termín bez ceny (bez platby).",
    vars: [],
    text: "Odesílám…",
  },
  "kurzy.pay.busy": {
    group: "Objednávka kurzu",
    label: "Tlačítko platby: čekání",
    description: "Text tlačítka během přesměrování na platební stránku.",
    vars: [],
    text: "Přesměrovávám na platbu…",
  },
  "kurzy.pay.hint": {
    group: "Objednávka kurzu",
    label: "Poznámka pod tlačítkem platby",
    description: "Krátké ujištění pod tlačítkem Zaplatit.",
    vars: [],
    text: "Platba proběhne na zabezpečené stránce Stripe. Po zaplacení je vaše místo potvrzené a pošleme vám e-mail.",
  },
  "kurzy.nav.next": {
    group: "Objednávka kurzu",
    label: "Tlačítko Pokračovat",
    description: "Tlačítko pro přechod na další krok.",
    vars: [],
    text: "Pokračovat",
  },
  "kurzy.nav.back": {
    group: "Objednávka kurzu",
    label: "Tlačítko Zpět",
    description: "Tlačítko pro návrat na předchozí krok.",
    vars: [],
    text: "Zpět",
  },
  "kurzy.nav.change": {
    group: "Objednávka kurzu",
    label: "Tlačítko Vybrat jiný termín",
    description: "Vrátí zákazníka ze kroku 2 zpět na seznam termínů.",
    vars: [],
    text: "Vybrat jiný termín",
  },
  "kurzy.pay.ok": {
    group: "Hlášky",
    label: "Po úspěšné platbě",
    description: "Zelená hláška nahoře na stránce Kurzy po návratu ze zaplacené platby.",
    vars: [],
    text: "Máte rezervováno. Místo je vaše a nikdo vám ho nevyfoukne. Děkujeme, těšíme se na vás. Potvrzení vám přijde e-mailem.",
  },
  "kurzy.pay.cancel": {
    group: "Hlášky",
    label: "Platba nedokončena",
    description: "Žlutá hláška po návratu z platební stránky bez zaplacení.",
    vars: [],
    text: "Platba nebyla dokončena. Místa držíme ještě asi půl hodiny, můžete to zkusit znovu.",
  },
  "kurzy.err.pay": {
    group: "Hlášky",
    label: "Chyba při zahájení platby",
    description: "Červená hláška, když se platbu nepodaří zahájit (a server nevrátil konkrétní důvod).",
    vars: [],
    text: "Platbu se nepodařilo zahájit, zkuste to prosím znovu.",
  },
  "kurzy.signup.ok": {
    group: "Hlášky",
    label: "Přihláška odeslána (bez platby)",
    description: "Zelená hláška po odeslání přihlášky na termín, který nemá cenu a neplatí se online.",
    vars: [],
    text: "Přihláška odeslána, ozveme se.",
  },
  "kurzy.err.signup": {
    group: "Hlášky",
    label: "Chyba při odeslání přihlášky",
    description: "Červená hláška, když se přihlášku bez platby nepodaří odeslat.",
    vars: [],
    text: "Něco se nepovedlo, zkuste to prosím znovu.",
  },
  "kurzy.voucher.have": {
    group: "Dárkový poukaz",
    label: "Odkaz „Mám poukaz“",
    description: "Krok 2: odkaz, který otevře pole pro zadání kódu dárkového poukazu.",
    vars: [],
    text: "Mám dárkový poukaz",
  },
  "kurzy.voucher.label": {
    group: "Dárkový poukaz",
    label: "Pole s kódem poukazu",
    description: "Popisek pole pro kód poukazu v kroku 2.",
    vars: [],
    text: "Kód poukazu",
  },
  "kurzy.voucher.use": {
    group: "Dárkový poukaz",
    label: "Tlačítko Použít poukaz",
    description: "Krok 2: ověří kód poukazu.",
    vars: [],
    text: "Použít poukaz",
  },
  "kurzy.voucher.applied": {
    group: "Dárkový poukaz",
    label: "Poukaz ověřen",
    description: "Zelená hláška po ověření kódu. code = kód, people = počet osob, seats = slovo místo/místa/míst.",
    vars: ["code", "people", "seats"],
    text: "Poukaz {{code}} je platný: {{people}} {{seats}}.",
  },
  "kurzy.voucher.casting": {
    group: "Dárkový poukaz",
    label: "Poukaz zahrnuje odlitek",
    description: "Dodatek k hlášce o ověřeném poukazu, pokud poukaz zahrnuje betonový odlitek.",
    vars: ["count"],
    text: "Včetně betonových odlitků: {{count}}.",
  },
  "kurzy.voucher.button": {
    group: "Dárkový poukaz",
    label: "Tlačítko Uplatnit poukaz",
    description: "Hlavní tlačítko v kroku 4 při uplatnění poukazu (místo platby).",
    vars: [],
    text: "Uplatnit poukaz a potvrdit místo",
  },
  "kurzy.voucher.busy": {
    group: "Dárkový poukaz",
    label: "Tlačítko Uplatnit: čekání",
    description: "Text tlačítka během uplatňování poukazu.",
    vars: [],
    text: "Uplatňuji poukaz…",
  },
  "kurzy.voucher.ok": {
    group: "Hlášky",
    label: "Poukaz uplatněn",
    description: "Zelená hláška po úspěšném uplatnění poukazu.",
    vars: [],
    text: "Máte rezervováno. Místo je vaše a nikdo vám ho nevyfoukne. Děkujeme, těšíme se na vás. Potvrzení vám přijde e-mailem.",
  },
  "kurzy.voucher.err": {
    group: "Hlášky",
    label: "Chyba poukazu",
    description: "Červená hláška, když se poukaz nepodaří ověřit nebo uplatnit (a server nevrátil konkrétní důvod).",
    vars: [],
    text: "Poukaz se nepodařilo ověřit, zkuste to prosím znovu.",
  },
};

// Nahradí {{promenna}} v textu skutečnou hodnotou. Chybějící proměnná = prázdný řetězec.
export function fillText(str: string, vars: Record<string, string> = {}): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
