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
};
export default nextConfig;
