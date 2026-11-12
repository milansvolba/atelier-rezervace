// CENÍK KURZŮ: jediné místo, kde se zadávají ceny. Z něj se berou ceny kurzů na stránce /kurzy, platba, dárkové poukazy i odlitky.
// Všechny částky jsou v Kč včetně DPH.
//
// JAK ZMĚNIT CENU: u příslušného řádku přepište číslo (pricePerPerson = kurz za 1 osobu, castingPrice = betonový odlitek za kus).
//   Změna se projeví po sloučení (po nasazení asi za minutu). Už zaplacené objednávky a poukazy se nemění.
// JAK PŘIDAT NOVÝ KURZ: zkopírujte celý jeden řádek { ... }, a změňte:
//   key           krátký klíč bez mezer a diakritiky, např. "ruka" (po prvním použití už neměnit, ukládá se u termínů a poukazů)
//   title         název kurzu, tak jak se má ukázat zákazníkovi
//   pricePerPerson cena kurzu za osobu
//   castingPrice  cena betonového odlitku za kus
//   match         část názvu malými písmeny, podle které se poznají starší termíny bez typu (např. "ruk")
// Za posledním řádkem nechte čárku. Soubor je jen seznam, nic dalšího nepřepisujte.
// Slevy pro více lidí se nastavují jinde (GROUP_DISCOUNTS v lib/pricing.ts): 2 osoby 5 %, 3-4 osoby 10 %, 5 a více 15 %.

export const CENIK = [
  { key: "hlava", title: "Modelování hlavy", pricePerPerson: 8270, castingPrice: 3490, match: "hlav" },
  { key: "relief", title: "Modelování reliéfu", pricePerPerson: 6470, castingPrice: 2990, match: "reli" },
] as const;
