/** @type {import('next').NextConfig} */
const nextConfig = {
  // Web nepoužívá optimalizaci obrázků Next.js (jediný obrázek je logo ve /public).
  // Vypnutím se zavře koncový bod /_next/image, který byl terčem několika známých zranitelností.
  images: { unoptimized: true },
};
export default nextConfig;
