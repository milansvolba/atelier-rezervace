// Společný vzhled všech e-mailů (logo, barvy, tlačítko, patička) podle DESIGN.md.
// E-maily jsou tabulkové HTML s inline styly, protože jen takové spolehlivě fungují
// v Gmailu, Outlooku i Apple Mailu. Webové písmo Comfortaa se načte jen v klientech,
// které to umí (např. Apple Mail), jinde zůstane záložní písmo.

const INK = "#1c1c1c";
const INK_SOFT = "#57615c";
const ACCENT = "#d3a53c";
const NAVY = "#141d33";
const SEA = "#2f4a4a";
const BG = "#f2f2f0";
const LINE = "#e3e3e1";
const HEAD_FONT = "Comfortaa, 'Trebuchet MS', Verdana, sans-serif";
const BODY_FONT = "'Work Sans', 'Segoe UI', Arial, sans-serif";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
const SITE_URL = "https://www.ateliernapobrezi.cz/";

// Escapování textu zadaného uživatelem (jména, poznámky, vzkazy) před vložením do HTML.
export function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Zaoblené zlaté tlačítko (v klasickém Outlooku se zobrazí hranaté, jinde kulaté).
export function button(label: string, url: string) {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;"><tr>` +
    `<td align="center" bgcolor="${ACCENT}" style="background:${ACCENT};border-radius:999px;">` +
    `<a href="${url}" style="display:inline-block;padding:13px 26px;font-family:${BODY_FONT};font-size:16px;font-weight:600;` +
    `color:${NAVY};text-decoration:none;border-radius:999px;">${label}</a></td></tr></table>`
  );
}

const BTN_MARK = `(?=[^>]*(?:class="[^"]*\\bbtn\\b[^"]*"|background:\\s*#111))`;
const BTN_IN_P = new RegExp(`<p[^>]*>\\s*<a\\s${BTN_MARK}([^>]*)>([\\s\\S]*?)</a>\\s*</p>`, "gi");
const BTN_ALONE = new RegExp(`<a\\s${BTN_MARK}([^>]*)>([\\s\\S]*?)</a>`, "gi");

function hrefOf(attrs: string) {
  return /href="([^"]*)"/i.exec(attrs)?.[1] ?? "#";
}

// Převede texty šablon (výchozí i upravené v adminu) na stylovaný HTML obsah:
// odstavce, tučný text, odkazy a tlačítka. Tlačítko je odkaz s class="btn"
// (nebo starý černý odkaz s background:#111), nejlépe sám v odstavci.
export function styleEmailBody(html: string): string {
  const baseP = `margin:0 0 16px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:${INK_SOFT}`;
  let out = html;
  out = out.replace(BTN_IN_P, (_m, attrs: string, label: string) => button(label, hrefOf(attrs)));
  out = out.replace(
    BTN_ALONE,
    (_m, attrs: string, label: string) =>
      `<a href="${hrefOf(attrs)}" style="display:inline-block;padding:13px 26px;background:${ACCENT};color:${NAVY};` +
      `font-weight:600;text-decoration:none;border-radius:999px;">${label}</a>`
  );
  out = out.replace(/<p(\s[^>]*)?>/gi, (_m, attrs: string | undefined) => {
    const a = attrs ?? "";
    const own = /style="([^"]*)"/i.exec(a)?.[1];
    if (own !== undefined) return `<p${a.replace(/style="[^"]*"/i, `style="${baseP};${own}"`)}>`;
    return `<p${a} style="${baseP}">`;
  });
  out = out.replace(/<strong>/gi, `<strong style="color:${INK};font-weight:600;">`);
  out = out.replace(/<a\s(?![^>]*style=)([^>]*)>/gi, `<a $1 style="color:${SEA};text-decoration:underline;">`);
  return out;
}

export interface LayoutOptions {
  title: string;
  bodyHtml: string;
  // Skrytý náhled textu v seznamu e-mailů (nepovinné).
  preheader?: string;
  // Věta „stačí odpovědět na tento e-mail“ v patičce. Pro interní e-maily adminům nedává smysl.
  replyLine?: boolean;
}

export function renderEmail({ title, bodyHtml, preheader, replyLine = true }: LayoutOptions): string {
  const logo = `${APP_URL}/logo.png`;
  const footerLine2 =
    `+420 724 241 721 · <a href="${SITE_URL}" style="color:${SEA};text-decoration:underline;">ateliernapobrezi.cz</a>` +
    (replyLine ? " · stačí odpovědět na tento e-mail" : "");
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@500&family=Work+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; background:${BG}; }
  @media only screen and (max-width:480px) {
    .px { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:22px !important; }
    .logo { width:160px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BG}" style="background:${BG};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td class="px" bgcolor="#ffffff" style="background:#ffffff;border-radius:14px 14px 0 0;border-bottom:3px solid ${ACCENT};padding:28px 32px 22px 32px;">
      <a href="${SITE_URL}"><img class="logo" src="${logo}" width="200" alt="Ateliér na pobřeží" style="display:block;border:0;height:auto;width:200px;max-width:100%;"></a>
    </td></tr>
    <tr><td class="px" bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 16px 32px;">
      <h1 class="h1" style="margin:0 0 18px 0;font-family:${HEAD_FONT};font-weight:500;font-size:26px;line-height:1.2;color:${INK};">${esc(title)}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td class="px" bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 14px 14px;border-top:1px solid ${LINE};padding:18px 32px 24px 32px;">
      <p style="margin:0 0 4px 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${INK_SOFT};"><strong style="color:${INK};">Ateliér na pobřeží</strong> · Na pobřeží 67, Kolín</p>
      <p style="margin:0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${INK_SOFT};">${footerLine2}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Čistý text z hotového HTML e-mailu. Posílá se jako alternativa k HTML:
// zlepšuje doručitelnost a hodí se pro čtečky a klienty bez HTML.
export function htmlToText(html: string): string {
  const decode = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  const text = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const l = label.replace(/<[^>]+>/g, "").trim();
      if (!l) return ""; // odkaz jen s obrázkem (logo)
      if (l === href || href.startsWith("https://www.ateliernapobrezi.cz")) return l;
      return `${l} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h1|p|table)>/gi, "\n\n")
    .replace(/<\/(tr|li)>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, "");
  return decode(text)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
