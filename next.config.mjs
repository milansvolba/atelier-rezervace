/** @type {import('next').NextConfig} */
const nextConfig = {
  // Web nepoužívá optimalizaci obrázků Next.js (jediný obrázek je logo ve /public).
  // Vypnutím se zavře koncový bod /_next/image, který byl terčem několika známých zranitelností.
  images: { unoptimized: true },
  // PDF dárkového poukazu (lib/voucherPdf.ts): knihovna pdfkit zůstává mimo balíček a písma, logo a podpis
  // (lib/voucher-assets) se přidají k funkcím, které poukaz generují.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/stripe/webhook": ["./lib/voucher-assets/**/*"],
    "/api/vouchers/pdf": ["./lib/voucher-assets/**/*"],
    "/api/vouchers/[id]": ["./lib/voucher-assets/**/*"],
    "/api/admin/promo/pdf": ["./lib/voucher-assets/**/*"],
  },
  // Bezpečnostní hlavičky pro všechny stránky a rozhraní. Úplnou Content-Security-Policy (zdroje skriptů) zatím nezapínáme,
  // aby nerozbila Stripe a Google Analytics; tady jsou jen pravidla, která nic nerozbijí (ochrana před vložením do cizího rámu).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
        ],
      },
    ];
  },
};
export default nextConfig;
