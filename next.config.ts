import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone' dihapus (8 Sep 2026) — Dockerfile CMD-nya pakai
  // "npm start" -> "next start", yang TIDAK KOMPATIBEL dengan standalone
  // output (butuh "node .next/standalone/server.js" + copy manual public/
  // dan .next/static ke dalamnya). Sebelumnya ini cuma memicu warning startup
  // tanpa standalone-nya benar-benar terpakai. Daripada restrukturisasi
  // Dockerfile (berisiko untuk deployment yang sudah jalan), config-nya yang
  // disesuaikan ke cara deploy yang sudah terbukti jalan (next start biasa).
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    qualities: [75, 85, 90],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "frame-src 'self' blob:",
              "object-src 'self' blob:",
              "connect-src 'self' ws: wss: http: https:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
