import type { NextConfig } from "next";

// Il login Google accetta solo il callback del dominio principale (ID client OAuth "fitup-ruota Vercel"):
// dal dominio corto delle TV, login e backend rimandano lì.
const TV_SHORT_HOST = process.env.TV_SHORT_HOST || "fitup-tv.vercel.app";
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN || "https://fitup-ruota.vercel.app";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // test in locale da telefoni/TV della stessa rete (solo `next dev`)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  async redirects() {
    const has = [{ type: "host" as const, value: TV_SHORT_HOST }];
    return ["/login", "/admin", "/admin/:path*", "/api/auth/:path*"].map((source) => ({
      source,
      has,
      destination: `${ADMIN_ORIGIN}${source}`,
      permanent: false,
    }));
  },
};

export default nextConfig;
