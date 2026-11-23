# Logo Ateliér na pobřeží – výchozí logo (v2, od 20. 11. 2026)

Tady jsou **zdrojové soubory loga** pro web, e-maily, poukazy, tisk a sociální sítě. Každá session si je bere odsud. Je to logo v2 v opravené podobě (stav plátna z 23. 11. 2026). Pravidla použití: `claude/brandmanual-2026-11-15.md` v projektu a design plátno „Brandmanuál – Ateliér na pobřeží“ (listy 04–06).

## Který soubor kdy
| Podoba | Kdy | Soubory |
|---|---|---|
| **A · vedle sebe (VÝCHOZÍ)** | web, hlavičky, e-maily, poukaz, tiskoviny na šířku | `logo-2radky-cerne`, `logo-2radky-bile` |
| **A · web (bez okraje)** | vložení do stránky: SVG oříznuté těsně na logo, s `aria-label` | `logo-web-cerne` |
| **B · pod sebou** | merch, plakáty na výšku, štítky, čtvercové formáty | `logo-pod-sebou-cerne`, `logo-pod-sebou-bile` |
| **C · samostatný symbol** | avatar, favicon, razítko, výšivka (jen kde je název uvedený jinde) | `symbol-cerne`, `symbol-bile` |

- **černé** (`-cerne`) na světlou plochu, **bílé** (`-bile`) na tmavou plochu nebo klidnou tmavou část fotky.
- Zatím je tu jen složka `svg/` (vektor, průhledné pozadí, libovolná velikost). Průhledná PNG a vektorová PDF pro tiskárnu se doplní později (vykreslí se ze SVG).

## Pravidla (stručně)
- **Ochranná zóna 1 L** ze všech stran (L = šířka nohy symbolu, 108 jednotek v SVG). SVG mají okraj 0,5 L, zbytek zóny držet při sazbě.
- **Minimální šířka:** A 200 px / 40 mm, B 90 px / 20 mm, C 16 px / 5 mm. Pod minimem použít jen symbol. Výšivka a sítotisk: ověřit s výrobcem.
- **Nedělat:** neroztahovat, neotáčet, nepřebarvovat (jen černá nebo bílá), žádné stíny, obrysy a přechody, neměnit odsazení a poměr symbolu a textu, nesestavovat logo z písma, ne na rušivé ploše.
- **Alt text:** „Ateliér na pobřeží“ (v psaném textu vždy s diakritikou a malým p).

## Poznámky
- Nápis v logu je **„ATELIER“ bez čárky** (druhý řádek „na pobřeží“ diakritiku má). Zda je to záměr, je otevřený bod v manuálu (list 14).
- Tyto soubory jsou **vektorové kopie z designového plátna „Atelier na pobrezi Logo“** (23. 11. 2026). Originální exporty od Milana jsou na jeho počítači ve složce `CLAUDOVO/logo-nove`. Pokud se originály liší, mají přednost.
- Rastrové logo, které je právě na webu (`public/logo.png`, `lib/voucher-assets/logo.png`), je starší soubor. Výměna za logo v2 je samostatný krok (viz `dokumentace/ukoly.md`).
- Vlastní písmo loga (Atelier NP, projekt Glyphr) zde není, jen hotové logo.
