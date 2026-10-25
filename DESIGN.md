---
version: alpha
name: Ateliér na pobřeží
description: >
  Design system a obsahová pravidla pro ateliernapobrezi.cz (PHP web) a
  rezervace.ateliernapobrezi.cz (Next.js). Jeden soubor pro tokeny, komponenty
  a UX writing. Zdrojem hodnot je produkční styles.css k 24. 10. 2026.
colors:
  background: "#f2f2f0"
  surface: "#ffffff"
  ink: "#1c1c1c"
  ink-soft: "#57615c"
  accent: "#d3a53c"
  accent-hover: "#e0b555"
  accent-soft: "#f0dba9"
  accent-dark: "#6c5319"
  sea: "#2f4a4a"
  navy: "#141d33"
  line: "#e3e3e1"
typography:
  display:
    fontFamily: Comfortaa
    fontWeight: 500
    lineHeight: 1.15
  body:
    fontFamily: Work Sans
    fontSize: 1rem
    lineHeight: 1.6
  h1:
    fontFamily: Comfortaa
    fontSize: clamp(2.2rem, 5vw, 3.6rem)
    fontWeight: 500
  h2:
    fontFamily: Comfortaa
    fontSize: clamp(1.6rem, 3vw, 2.4rem)
    fontWeight: 500
  h3:
    fontFamily: Comfortaa
    fontSize: 1.3rem
    fontWeight: 500
  eyebrow:
    fontFamily: Work Sans
    fontSize: 0.8rem
    letterSpacing: 0.14em
rounded:
  sm: 8px
  md: 14px
  pill: 999px
spacing:
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  section: 64px
  container-max: 1120px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.navy}"
    rounded: "{rounded.pill}"
    padding: 13px 26px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.navy}"
  button-outline:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: 13px 26px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: 32px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 12px 14px
  banner:
    backgroundColor: "{colors.sea}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 48px
---

# Ateliér na pobřeží – design system

Tento soubor je jediný zdroj pravdy o vzhledu a textech webu a rezervačního
systému. Čtou ho lidé i AI agenti (Claude). **Než se změní barva, komponenta
nebo text tlačítka, změní se nejdřív tady.** Návrhy, které čekají na Milanovo
schválení, jsou označené `NÁVRH`.

## 1. Atmosféra a značka

Industriální ateliér v bývalé továrně na čokoládu (Kolinea, Kolín, od roku 1896).
Klid, odpočinek od obrazovek, tvoření rukama, upcyklace. Vzhled: světlé
neutrální plochy, tmavý text, jediný teplý akcent (hořčicová zlatá), zaoblené
tvary, hodně vzduchu. Fotky mají nést atmosféru, ne dekorace.

Co značka **není**: korporátní, křiklavá, přeplácaná, „wellness“ klišé.

## 2. Barvy

| Role | Token | Hodnota | Použití |
|---|---|---|---|
| Pozadí stránky | `background` | #f2f2f0 | plocha stránky |
| Plocha | `surface` | #ffffff | karty, hlavička, prokládané sekce |
| Text/nadpisy | `ink` | #1c1c1c | nadpisy, logo, navigace |
| Běžný text | `ink-soft` | #57615c | odstavce, popisky |
| Akcent | `accent` | #d3a53c | pozadí tlačítek, linky, ikony |
| Akcent – hover | `accent-hover` | #e0b555 | hover primárního tlačítka |
| Akcent – jemný | `accent-soft` | #f0dba9 | pozadí ikon, placeholder |
| Akcent – tmavý | `accent-dark` | #6c5319 | **text** na jemném akcentu |
| Petrolej | `sea` | #2f4a4a | odkazy, banner, focus |
| Námořnická | `navy` | #141d33 | text na tlačítku, overlay galerie |
| Linka | `line` | #e3e3e1 | ohraničení karet, oddělovače |

**Pravidla kontrastu (WCAG AA, běžný text min. 4,5 : 1):**
- Text na tlačítku `accent` je `navy` (kontrast přibližně 7 : 1). Neměnit na bílou.
- `accent` (#d3a53c) má na bílé jen přibližně 2,3 : 1. **Nepoužívat jako barvu textu**
  na světlém pozadí. Pro text použít `accent-dark` nebo `sea`. Viz otevřené body.
- Bílý text smí být jen na `sea`, `navy` nebo na ztmaveném overlay přes fotku.
- Význam nikdy jen barvou (stavy rezervace mají vždy i textový popisek).

## 3. Typografie

- Nadpisy a navigace: **Comfortaa**, váha 500, řádkování 1,15.
- Text: **Work Sans**, řádkování 1,6. Záložní: Segoe UI, sans-serif.
- Eyebrow (malý nadpis nad H1): 0,8 rem, verzálky, prostrkání 0,14 em.
- Odkazy v textu jsou vždy podtržené (i bez hoveru).
- Jeden `h1` na stránku, úrovně nadpisů se nepřeskakují.

## 4. Rozvržení, mezery, tvary

- Kontejner max. 1 120 px, boční padding 24 px.
- Sekce mají svislý padding 64 px. Mezery: 8 / 16 / 24 / 32 / 48 / 64 px.
- Mřížky: 3 nebo 2 sloupce, pod 860 px jeden sloupec. Navigace se sbaluje pod 760 px.
- Zaoblení: karty a obrázky 14 px, pole formuláře 8 px, tlačítka plně oblá (pill).
- Stín jen při hoveru karty (jemný, `0 12px 28px rgba(38,48,44,.08)`).

## 5. Komponenty

U každé komponenty je vedle vzhledu i obsahové pravidlo. Příklady jsou skutečné
texty z webu, pokud není uvedeno `NÁVRH`.

### Tlačítko (`.btn`)
- **Primární** (zlaté, tmavý text): jedna hlavní akce na sekci. Příklad: „Rezervovat kurz“.
- **Outline**: vedlejší akce. Příklad: „Zjistit více“.
- **Obsah:** sloveso v infinitivu, 1–3 slova, říká, co se stane. Bez vykřičníku,
  bez „Klikněte zde“. Příklady: „Vybrat termín“, „Požádat o rezervaci“,
  „Zaplatit a rezervovat“.
- Stejná akce má stejný text všude (viz slovník).
- Prázdné tlačítko (`.btn:empty`) se nezobrazuje.

### Karta (`.card`, `.card-clickable`)
- Struktura: štítek (tag) → nadpis H3 → 1–2 věty → odkaz „Zjistit více →“.
- Celá karta je klikací, odkaz je poslední `<a>` v kartě.
- **Obsah:** nadpis říká, co to je (podstatné jméno), popis říká, pro koho nebo proč.

### Karta kurzu
- Štítek (Nejoblíbenější / Pro všechny) → název → popis (1–2 věty) →
  řádek faktů `délka · pro koho · od cena` → odkaz „Zobrazit detail a termíny“.
- Řádek faktů vždy ve stejném pořadí. Formáty viz sekce 6.

### Hero a slider
- Eyebrow + H1 + jedna úvodní věta (`lead`, max. 46 znaků na řádek) + 1–2 tlačítka.
- Text přes fotku je bílý na overlay. Slider se přepíná i klávesnicí a má popisky šipek.
- **Obsah:** H1 pojmenuje nabídku, ne slogan. Úvodní věta nese konkrétní slib.

### Formulář (`input`, `select`, `textarea`, `label`)
- Popisek vždy nad polem, nikdy jen placeholder.
- Povinná a nepovinná pole se označují slovy („nepovinné“), ne jen hvězdičkou.
- **Fokus musí být viditelný** (obrys min. 2 px v `sea`). Viz otevřené body.
- Chybová hláška stojí u pole a říká, co udělat (viz sekce 6, vzory).

### Banner (`.banner`, `.banner-photo`)
- Petrolejové pozadí, bílý text, jedna věta + jedno tlačítko.

### Rychlé fakty a vybavení (`.quickfact-card`, `.amenity-item`)
- Krátký nadpis (1–3 slova) + jedna věta. Ikona nikdy nenahrazuje text.

### FAQ (`.faq-list`)
- Otázka vlevo, odpověď vpravo (pod 860 px pod sebou). Otázka je celá věta
  v 1. osobě („Potřebuji mít zkušenosti se sochařením?“). Odpověď začíná
  přímou odpovědí (Ne. / Ano. / Určitě.), pak důvod.

### Akordeon „Co je v ceně a víc o kurzu“ (`.activity-toggle`)
- Tlačítko s ikonou +/−, detail se rozbalí pod kartou.

### Kalendář obsazenosti (rezervace)
- Přepínač Týden / Měsíc / Kvartál / Rok, šipky, tlačítko „Dnes“.
- Veřejné stavy (podle `app/page.tsx`, ověřeno v kódu 25. 10. 2026):
  **volno** (`bg-green-100`, #dcfce7), **rezervováno** (`bg-gray-300`, #d1d5db),
  **čeká na schválení** (#FAC775), **příprava a úklid před akcí** (`bg-gray-200`
  se šikmými pruhy). Každý stav má barvu i textovou legendu. Důvody (úklid, akce)
  vidí jen členové a admin.
- Každý den je rozdělený na dopoledne (levá půlka) a odpoledne (pravá půlka).
- Modrá „na vyžádání“ byla zrušena (20. 10. 2026). Starý název „pronajato“ se
  nepoužívá, v kódu je „rezervováno“.
- `NÁVRH:` stavy „volno“ a „rezervováno“ používají výchozí barvy Tailwindu, ne
  značkovou paletu. Sladit se značkou (např. volno = `accent-soft`, rezervováno =
  `line`), ale až po ověření kontrastu a čitelnosti legendy.

### Cookie lišta
- Dvě stejně výrazná tlačítka: „Odmítnout“ a „Přijmout“. Odmítnutí nesmí být schované.

### Stránka 404
- Velké „404“ v akcentu, jedna věta, odkaz zpět na úvod.

## 6. Obsahová pravidla (UX writing)

### 6.1 Hlas
Mluvíme **vykáním**, teple a lidsky, jako host-hostitel. Krátké věty. Konkrétní
slova místo marketingu. Lehký humor smí být, ale nikdy na úkor srozumitelnosti.
Hlavní téma: odpočinek, tvoření, žádné starosti („Nemusíte nic nosit ani
zařizovat“).

Píšeme **komu je co určeno** a **co je v ceně** hned v textu (pro lidi i pro AI
vyhledávání): dárek, pár, kamarádi, firemní tým.

### 6.2 Tón podle situace
| Situace | Tón | Příklad |
|---|---|---|
| Nabídka, hero | pozvání, klid | „Užijte si den bez starostí v inspirativním industriálním ateliéru.“ |
| Cena, podmínky | věcně, přesně | „Cena zahrnuje materiál, vybavení, vedení lektorem a občerstvení.“ |
| Rezervace, platba | jasně, uklidňující | „Místo je potvrzeno. Potvrzení jsme vám poslali e-mailem.“ `NÁVRH` |
| Chyba | klidně, řekne, co dál, nikdy nevinit | „Nepodařilo se nám odeslat žádost. Zkuste to prosím znovu, nebo nám napište na info@ateliernapobrezi.cz.“ `NÁVRH` |
| Prázdný stav | nabídne další krok | „Zatím tu nejsou žádné vypsané termíny. Napište nám, domluvíme vlastní.“ `NÁVRH` |
| Zrušení, zamítnutí | vstřícně, s alternativou | „Tento termín bohužel nejde. Rádi najdeme jiný.“ `NÁVRH` |

### 6.3 Slovník (jedno slovo = jedna věc)
| Používat | Nepoužívat | Poznámka |
|---|---|---|
| kurz | workshop (pro vlastní kurzy), lekce | „workshop“ jen u firemních akcí |
| rezervace | booking, objednávka | platba kurzu = „platba“ |
| termín | datum kurzu | |
| lektor | instruktor | Petr Švolba je „lektor“ |
| poukaz / dárkový poukaz | voucher, kupón | |
| pronájem | rent | |
| ateliér | klubovna (veřejně) | „klubovna“ je interní název zdroje |
| přihláška | registrace | |
| odlití | casting | |
| Ateliér na pobřeží | Atelier na Pobřeží | vždy s diakritikou, „pobřeží“ malé p |

`NÁVRH:` sjednotit navigaci a nadpisy: **„Pronájem“** (menu), „Pronájem ateliéru“
(H1 stránky). Dnes se střídá „Pronájem prostor“, „Pronájem ateliéru“ a „Pronajměte si ateliér“.

### 6.4 Formáty
- **Cena:** `8 270 Kč` (nezlomitelná mezera mezi tisíci i před Kč, `&nbsp;`). „od“ před cenou malým.
- **Délka:** `8–10 hodin` (půlčtvrtková pomlčka bez mezer, ne `8 - 10`), `zhruba 6 hodin`.
- **Datum:** `24. 10. 2026` (mezery po tečkách). Měsíc slovy: `24. října 2026`.
- **Čas:** `9:00–17:00`.
- **Telefon:** `+420 724 241 721`. **Adresa:** `Na pobřeží 67, Kolín`.
- **Řádek faktů:** `délka · pro koho · od cena` (oddělovač střední tečka).
- Číslovky u počtu míst: „2 místa“, „5 míst“ (správný pád).

### 6.5 Interpunkce a styl
- Žádné dvojité tečky (`..`), žádné trojité vykřičníky.
- Emoji jen výjimečně (dnes 😉 a 📍), nikdy místo slova a nikdy v tlačítkách.
- Nadpisy bez tečky na konci. Velká písmena jen na začátku (ne Title Case).
- Pevná mezera po jednopísmenných předložkách (k, s, v, z, o, u, a, i).

### 6.6 Vzory microcopy
**Tlačítka:** „Rezervovat kurz“ · „Vybrat termín“ · „Zobrazit detail a termíny“ ·
„Požádat o rezervaci“ · „Zaplatit a rezervovat“ · „Zjistit více →“ · „Kontaktovat nás“.

**Chybová hláška (vzorec):** co se stalo + co s tím + kontakt.
„E-mail nevypadá správně. Zkontrolujte ho prosím, například jmeno@domena.cz.“ `NÁVRH`

**Potvrzení (vzorec):** výsledek + co bude dál + kdy.
„Žádost jsme přijali. Ozveme se vám do dvou pracovních dnů.“ `NÁVRH: ověřit lhůtu`

**Prázdný stav (vzorec):** proč je prázdno + jedna akce. Nadpis začíná slovesem nebo říká fakt.

**Nepovinné pole „Odkud o nás víte?“:** neutrální otázka, volba „Jiné“ otevře vlastní pole.

**E-maily:** předmět = co se stalo („Potvrzení vaší přihlášky na kurz Modelování hlavy“).
Tělo: oslovení, jedna věta výsledek, detaily seznamem, kontakt.
`NÁVRH:` členům tykat, veřejnosti vykat (viz „Co zbývá doladit“ v dokumentaci).

**Platba (Stripe):** stavy „Zaplatit a rezervovat“ → přesměrování → „Platba proběhla, místo je potvrzeno“
nebo „Platba byla zrušena, místo jsme neuložili“. `NÁVRH`

### 6.7 Přístupnost a inkluze
- Odkazy popisují cíl („Zobrazit detail kurzu Modelování hlavy“), ne „zde“.
- Alt text popisuje, co je na fotce (ne název souboru).
- Jednoduchá čeština, věty do cca 20 slov, žádný žargon bez vysvětlení.
- „Přeskočit na obsah“ je první prvek stránky.

## 7. Pokyny pro AI agenty (Agent Prompt Guide)

Při tvorbě nebo úpravě stránky, komponenty či textu pro Ateliér:
1. Použij **jen tokeny z tohoto souboru**. Žádné nové hex hodnoty natvrdo; novou barvu nejdřív přidej do `colors`.
2. Použij existující komponentu. Novou vytvoř jen tehdy, když žádná nevyhovuje, a zapiš ji do sekce 5.
3. Piš česky, vykáním, podle sekce 6. Před finálním textem projdi slovník a formáty.
4. Text na světlém pozadí nikdy v barvě `accent`.
5. Každá změna se zapíše do `dokumentace/zmeny.md`. U textů říkej, že jde o návrh ke schválení Milanem.
6. Web ateliernapobrezi.cz **není v gitu**. Úpravy jdou přes FTP, texty přes `data/content.json` a admin.
   Texty upravované přímo na stránce (inline) stačí zapsat jako `t(klíč, výchozí)` v šabloně. Pole ve formuláři
   `admin.php` se navíc při uložení tiše zahodí, pokud klíč není v `content_defaults()` ani v `content.json`.
   Cíl tlačítek se nastavuje klíči `<název>_target` (hodnoty z `internal_link_targets()`, např. `kontakt`, `kurzy_vyber`).
   Postup pro nová pole je vždy podle aktuální `dokumentace/web-ateliernapobrezi.md`.

## 8. Otevřené body z auditu (24. 10. 2026)

**Texty (opravit hned, jsou vidět na živém webu):**
- „tembulding“ → teambuilding (Domů, slide Pronájem prostoru).
- „tvůrčí činnosi“ → činnosti; „všednách dní“ → všedních dní.
- „zpracovats tématem“ (Kurzy, Konzultace předem) – věta je rozbitá.
- „něvenujete“ → nevěnujete (Pronájem, Firemní teambuilding, na dvou místech v `content.json`).
- „přítelky, příteli“ → přítelkyni, příteli (Dárkové poukazy, úvodní text).
- „v ateléru třeba u dobré kávy.Představíme“ → v ateliéru třeba u dobré kávy. Představíme (banner Lidé).
- „Stačí pohodlném, ideálně nekancelářské oblečení“ – chybí „v“ a shoda (např. „Stačí pohodlné, ideálně nekancelářské oblečení“).
- „ještě nednesete“ → „ještě neodnesete“.
- Dvojitá tečka v patičce („k pronájmu..“) a u „s občerstvením..“.
- Mezera za otázkou u FAQ („Co s sebou?Stačí“): v datech chybí jen u části odpovědí, ověřit ve vykreslené stránce, zda jde o skutečnou vadu.
- V rezervačním systému chybí diakritika a velké P v titulku (`app/layout.tsx`): „Atelier na Pobřeží — rezervace“ → „Ateliér na pobřeží — rezervace“.

**Odkazy a názvy:**
- Domů, slide Pronájem: „Zjistit více o pronájmu“ vedlo na rezervace a „Kontaktovat nás“ na /pronajem. Oprava: klíče `hero_pronajem_btn_primary_target` = `pronajem`, `hero_pronajem_btn_secondary_target` = `kontakt`.
- Závěrečné tlačítko „Vybrat termín kurzu“ vedlo na /kontakt. Oprava: `banner_home_button_target` = `kurzy_vyber`.
- Střídá se „Pronájem prostor / ateliéru“ a „kurzy výtvarné / sochařské“ (og:description).

**Design:**
- `accent` jako barva textu (eyebrow, štítek `.tag`, hover odkazů) má kontrast cca 2,3 : 1. Nahradit `accent-dark` / `sea`.
- Pole formuláře při fokusu ztrácí obrys (`outline: none`), mění se jen barva okraje. Doplnit viditelný fokus.
- Barvy mimo tokeny natvrdo v CSS: #fff8f2, #cbb89f, #26302c, rgba(38,48,44,…). Převést na tokeny.
- Tři různá zaoblení (8 / 14 / pill) jsou v pořádku, ale jen pokud jsou záměrná. Potvrdit.
- Rezervační systém (Tailwind): značkové barvy a písma v `tailwind.config.ts` a `layout.tsx` odpovídají webu (ověřeno 25. 10. 2026). Stránky ale značkové třídy `brand-*` skoro nepoužívají a kalendář má výchozí barvy Tailwindu (viz Kalendář obsazenosti). Odkazy mají v `globals.css` natvrdo #2f4a4a a #d3a53c.

## 9. Správa tohoto souboru

- Vlastník: Milan. Úpravy komponent a tokenů jde dělat s Claudem.
- Změna tokenu = nová drobná verze, přejmenování nebo smazání tokenu = velká změna.
- Kontrola formátu: `npx @google/design.md lint DESIGN.md`.
- Hodnoty tokenů jsou převzaté z produkčního `styles.css` (24. 10. 2026). Při změně CSS se mění i tady.

### Změny
- 2026-10-25: stavy kalendáře opraveny podle kódu (tři veřejné stavy + příprava a úklid), upřesněn postup pro CMS pole a tlačítka, doplněny další překlepy z `content.json`.
- 2026-10-24: první verze, sestavená z auditu živého webu a rezervačního systému.
