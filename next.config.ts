import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://lntdirhpnollkntuoryq.supabase.co https://*.tile.openstreetmap.org https://raw.githubusercontent.com data: blob:",
  "connect-src 'self' https://lntdirhpnollkntuoryq.supabase.co https://generativelanguage.googleapis.com https://api.open-meteo.com https://clothing-detection-production.up.railway.app https://www.googleapis.com https://identitytoolkit.googleapis.com https://mwwhui--outfitr-leffa-tryon-leffatryon-tryon.modal.run",
  "frame-src 'self' https://accounts.google.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lntdirhpnollkntuoryq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "developers.google.com",
        pathname: "/identity/images/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
